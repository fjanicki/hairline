import * as THREE from 'three';
import { takeStage, layer, gamePointer, texts, say, bag, setTips, tipsFromHint, clamp, damp, smooth, disposeTree, esc, clack, jingle, debugHook } from './lib/games-a-kit.js';
import './keyring.css';

// KEY RING (docs/DESIGN-R4.md "New minigames", Ch6 the bike shop): fourteen keys on a ring, close up,
// in front of the shop door's lock (docs/SCRIPT-R4.md §7.6.2). Drag or scroll to turn the ring; the
// key at the front (pointing at the lock) is highlighted, and the key under the mouse draws its cuts
// over the lock's silhouette (the pins seen through the keyway). Click a key (or anywhere: the front
// one) to try it: a wrong one goes in, won't turn (a dry clack), and Jo barks; the right one, the one
// with a small red ribbon, turns. After three wrong keys, or 20 s without input, the assist dialogue
// plays (Jo pointing: a red pencil ring), then the ring turns to the ribbon and it opens.
//
//   await playGame('keyring', ctx, d, {
//     at, facing,           // where the lock is ([x, y, z], default: in front of Hugo at hand height) and the shot's yaw
//     keys = 14,
//     who = 'Jo',           // who barks on a wrong key
//     assistAfter = 3,      // wrong keys before the assist (idle: 20 s)
//     text,                 // L.games.keyRing: { hint, counter, wrong[], assist: [{ who, text }] (d.say lines), inset, insetKey }
//   })  -> { tier (good: first try; middle: found in <= 3; poor: assisted; skip: middle), tries, wrong,
//            assisted, skipped, secs }
// `foundFast` (tries <= 3) is the chapter's d.say, after the game.

export const id = 'keyring';

// (The script's lines, docs/SCRIPT-R4.md §7.6.2.)
const FALLBACK = {
  hint: 'Molette ou glisser : tourner le trousseau · clic : essayer la clé',
  counter: 'Essai {n}',
  inset: 'SERRURE',
  insetKey: 'cette clé',
  wrong: ['Non.', 'Pas celle-là. Celle-là, c’est mon char.', 'Celle-là ouvre rien. Le proprio la garde pour l’ambiance.'],
  assist: [
    { who: 'Jo', text: 'Celle avec le ruban rouge. Ben là. Je l’ai mis moi-même.' },
    { who: 'Hugo', text: 'Tu savais.' },
    { who: 'Jo', text: 'Je voulais te voir chercher. Ça te fait une belle face.' },
  ],
};

const N_DEFAULT = 14;
const RING_R = 0.034;
const CUTS = 5;
const BLADE = { top: -0.0105, len: 0.05, spine: -0.0034, edge: 0.0042, step: 0.0072, first: 0.016, depth: 0.00068 };
const DEG = Math.PI / 180;
// The set, in G's frame (the shot looks down -Z): the ring hangs left of centre, the lock is on the
// door to the right, the door turned toward the camera so a key going in reads in three-quarter view.
const RING_AT = new THREE.Vector3(-0.07, 0.012, 0);
const LOCK_AT = new THREE.Vector3(0.17, 0.0, -0.05);
const DOOR_N = new THREE.Vector3(-0.9, 0, 0.44).normalize(); // out of the door, toward the camera side
const SHOT = { pos: [0.0, 0.035, 0.45], look: [0.03, -0.004, -0.02], fov: 38 };

export async function play(ctx, d, opts = {}) {
  const { engine, audio, cam, camera, player } = ctx;
  const T = texts(FALLBACK, opts.text);
  const nKeys = clamp(opts.keys ?? N_DEFAULT, 4, 20);
  const who = opts.who ?? 'Jo';
  const assistAfter = opts.assistAfter ?? 3;

  // ---------------------------------------------------------------- the set
  const G = new THREE.Group();
  G.name = 'keyring-set';
  const facing = opts.facing ?? player.root.rotation.y;
  if (opts.at) G.position.set(opts.at[0], opts.at[1], opts.at[2]);
  else {
    const p = player.root.position;
    G.position.set(p.x + Math.sin(facing) * 0.75, p.y + 1.3, p.z + Math.cos(facing) * 0.75);
  }
  G.rotation.y = facing + Math.PI;
  ctx.scene.add(G);
  const own = [];
  const keep = (x) => (own.push(x), x);

  // The door: old painted planks, the paint gone at the edges; a brass rose and cylinder for the lock.
  const doorTex = keep(doorTexture());
  const door = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.4, 1.4)), keep(new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.8 })));
  door.position.copy(LOCK_AT).addScaledVector(DOOR_N, -0.004);
  door.lookAt(tmpV(door.position).add(DOOR_N));
  door.receiveShadow = true;
  const brass = keep(new THREE.MeshStandardMaterial({ color: '#b08d4f', metalness: 0.85, roughness: 0.38 }));
  const rose = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.03, 0.032, 0.006, 32)), brass);
  const cyl = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.0145, 0.0145, 0.012, 28)), brass);
  const slot = new THREE.Mesh(keep(new THREE.BoxGeometry(0.0034, 0.011, 0.002)), keep(new THREE.MeshBasicMaterial({ color: '#0b0a09' })));
  const lock = new THREE.Group();
  lock.add(rose, cyl, slot);
  rose.rotation.x = Math.PI / 2;
  cyl.rotation.x = Math.PI / 2;
  cyl.position.z = 0.006;
  slot.position.set(0, 0.0015, 0.0121);
  lock.position.copy(LOCK_AT);
  lock.lookAt(tmpV(LOCK_AT).add(DOOR_N));
  G.add(door, lock);
  // The keyway's mouth (G frame): where a blade goes in, and the way in.
  const mouth = new THREE.Vector3().copy(LOCK_AT).addScaledVector(DOOR_N, 0.012);
  const inward = DOOR_N.clone().negate();

  // The ring: holder (the hand's pose) > spinner (the ring turning) > a pivot per key.
  const holder = new THREE.Group();
  holder.position.copy(RING_AT);
  const spinner = new THREE.Group();
  holder.add(spinner);
  G.add(holder);
  const steel = keep(new THREE.MeshStandardMaterial({ color: '#a9adb1', metalness: 0.9, roughness: 0.3 }));
  const ringMesh = new THREE.Mesh(keep(new THREE.TorusGeometry(RING_R, 0.0016, 8, 56)), steel);
  spinner.add(ringMesh);

  // The keys: random cuts; the right one brass with a square head, two brass decoys like it.
  const right = Math.floor(Math.random() * nKeys);
  const code = randomCode();
  const keyDefs = [];
  const decoys = new Set();
  while (decoys.size < Math.min(2, nKeys - 1)) {
    const i = Math.floor(Math.random() * nKeys);
    if (i !== right) decoys.add(i);
  }
  const looks = ['round', 'hex', 'clover', 'tab', 'round', 'tab', 'hex', 'square'];
  const metals = { brass: keep(new THREE.MeshStandardMaterial({ color: '#bf9a52', metalness: 0.85, roughness: 0.34, emissive: '#000000' })), steel: keep(new THREE.MeshStandardMaterial({ color: '#aeb2b5', metalness: 0.9, roughness: 0.3, emissive: '#000000' })), nickel: keep(new THREE.MeshStandardMaterial({ color: '#cfd0c9', metalness: 0.9, roughness: 0.22, emissive: '#000000' })) };
  const capColors = ['#a3392b', '#2f5d8a', '#2f6b45', '#d9a441', '#1d1d1d'];
  for (let i = 0; i < nKeys; i++) {
    let def;
    if (i === right) def = { code, bow: 'square', metal: 'brass', cap: null };
    else if (decoys.has(i)) def = { code: nearCode(code, 2), bow: 'square', metal: 'brass', cap: null };
    else
      def = {
        code: nearCode(code, 2 + Math.floor(Math.random() * 3)),
        bow: looks[i % looks.length],
        metal: ['steel', 'nickel', 'brass'][i % 3],
        cap: i % 3 === 1 ? capColors[i % capColors.length] : null,
      };
    keyDefs.push(def);
  }
  const keys = keyDefs.map((def, i) => {
    const pivot = new THREE.Group();
    const th = (i / nKeys) * Math.PI * 2;
    pivot.position.set(Math.cos(th) * RING_R, Math.sin(th) * RING_R, (i % 2 ? 1 : -1) * 0.0016);
    pivot.rotation.z = th + Math.PI / 2; // key -Y (the blade) points out along the radius
    // Each key's own material (cloned per key): the hover glow and the hint pulse are per key.
    const mat = keep(metals[def.metal].clone());
    const mesh = new THREE.Mesh(keep(keyGeometry(def)), mat);
    mesh.castShadow = true;
    mesh.userData.key = i;
    pivot.add(mesh);
    let cap = null;
    if (def.cap) {
      cap = new THREE.Mesh(keep(capGeometry(def.bow)), keep(new THREE.MeshStandardMaterial({ color: def.cap, roughness: 0.6 })));
      cap.userData.key = i;
      pivot.add(cap);
    }
    // Jo's ribbon on the right key: a small red bow through the hole, two tails.
    if (i === right) {
      const red = keep(new THREE.MeshStandardMaterial({ color: '#b3262b', roughness: 0.7, side: THREE.DoubleSide }));
      const knot = new THREE.Mesh(keep(new THREE.BoxGeometry(0.006, 0.004, 0.004)), red);
      knot.position.set(0, 0.0045, 0);
      const tail = keep(new THREE.PlaneGeometry(0.0032, 0.016));
      for (const a of [-0.35, 0.4]) {
        const t = new THREE.Mesh(tail, red);
        t.position.set(a * 0.012, 0.0045 + 0.008, 0.0012);
        t.rotation.z = a;
        pivot.add(t);
      }
      pivot.add(knot);
    }
    spinner.add(pivot);
    return { i, th, pivot, mesh, mat, cap, def, lift: 0 };
  });
  const pickables = keys.flatMap((k) => (k.cap ? [k.mesh, k.cap] : [k.mesh]));

  // ---------------------------------------------------------------- the DOM: the lock's silhouette
  const L = layer(
    ctx,
    'ga-keyring',
    `<div class="kr-card ga-paper"><div class="ga-head">${esc(T.inset)}</div><canvas width="440" height="200"></canvas><div class="kr-foot"><span class="kr-count"></span><span class="kr-cap">${esc(T.insetKey)}</span></div></div>
     <div class="kr-point"></div>
     <div class="ga-tips"></div>`,
  );
  const inset = L.querySelector('canvas');
  const pointEl = L.querySelector('.kr-point');
  setTips(L.querySelector('.ga-tips'), tipsFromHint(T.hint));
  const countEl = L.querySelector('.kr-count');
  const showCount = () => (countEl.textContent = String(T.counter || '').replace('{n}', String(s.tries + 1)));
  requestAnimationFrame(() => L.classList.add('show'));
  let insetFor = -2;
  const drawInset = (hover) => {
    if (hover === insetFor) return;
    insetFor = hover;
    drawSilhouette(inset, code, hover >= 0 ? keyDefs[hover].code : null);
  };
  drawInset(-1);

  // ---------------------------------------------------------------- state
  const stage = takeStage(ctx, d, { hidePlayer: true, rain: 0.2 });
  const P = gamePointer(ctx);
  const s = { t: 0, idle: 0, spin: 0, spinTo: 0, hover: -1, front: 0, phase: 'pick', phaseT: 0, tries: 0, wrong: 0, helped: false, assisted: false, auto: false, current: -1, done: false };
  showCount();
  const wrongLine = bag(Array.isArray(T.wrong) ? T.wrong : [T.wrong]);
  const unhook = debugHook(ctx, id, { s, right, keys, screenOf: (i) => screenOf(i) });
  const local = (v) => G.localToWorld(new THREE.Vector3(...v));
  cam.set({ pos: local(SHOT.pos), look: local(SHOT.look), fov: SHOT.fov });

  // Poses: rest (the hand holds the ring up) and "in the lock" for the chosen key.
  const rest = { p: RING_AT.clone(), q: new THREE.Quaternion() };
  const into = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  const axisQ = new THREE.Quaternion();
  const m4 = new THREE.Matrix4();
  const m4b = new THREE.Matrix4();
  const xAxis = new THREE.Vector3();
  const yAxis = new THREE.Vector3();
  const zAxis = new THREE.Vector3();
  /** Holder pose that puts key i's blade `depth` (0..1) into the keyway, cuts up. */
  const poseFor = (i, depth, out) => {
    const k = keys[i];
    // The key's frame in the holder (the spinner turned so it points at the lock, +X).
    spinner.updateMatrix();
    k.pivot.updateMatrix();
    m4.multiplyMatrices(spinner.matrix, k.pivot.matrix); // key -> holder
    // Wanted key frame in G: origin outside the mouth by (blade length - depth), -Y = inward, +X = up.
    const reach = -BLADE.top + BLADE.len; // origin (the bow's hole) to the tip
    const origin = tmpV(mouth).addScaledVector(inward, -(reach - depth * (BLADE.len - 0.004)));
    yAxis.copy(inward).negate();
    xAxis.set(0, 1, 0);
    zAxis.crossVectors(xAxis, yAxis).normalize();
    xAxis.crossVectors(yAxis, zAxis).normalize();
    m4b.makeBasis(xAxis, yAxis, zAxis).setPosition(origin);
    // holder = keyFrame * inverse(key -> holder)
    m4b.multiply(m4.invert());
    m4b.decompose(out.p, out.q, tmpS);
    return out;
  };
  const tmpS = new THREE.Vector3();
  const curP = new THREE.Vector3();
  const curQ = new THREE.Quaternion();

  /** Where key i's bow is on screen (CSS px). */
  const screenOf = (i) => {
    const k = keys[i];
    const v = k.mesh.localToWorld(tmpW.set(0, -0.006, 0));
    return P.project(v, new THREE.Vector3());
  };
  const tmpW = new THREE.Vector3();

  // ---------------------------------------------------------------- the loop
  const frame = (dt) => {
    const raw = engine.rawDt || dt;
    s.t += raw;
    s.phaseT += raw;
    P.update();
    if (P.touched) s.idle = 0;
    else s.idle += raw;

    if (s.phase === 'pick') {
      // Turn the ring: a drag (left button) or the wheel, a key's width per notch.
      if (P.down && Math.abs(P.dragX) + Math.abs(P.dragY) > 0) s.spinTo -= (P.dragX - P.dragY * 0.3) * 0.009;
      if (P.wheel) {
        s.spinTo += P.wheel * ((Math.PI * 2) / nKeys);
        audio.sfx('keys_jingle', { volume: 0.15, rate: 1.1, jitter: 0.08, fallback: (a) => jingle(a, { volume: 0.05, n: 2 }) }); // R4 Ch6 sounds
      }
      // Hover: the key under the mouse lifts a little and its cuts go over the silhouette.
      const hit = P.inside ? P.pick(pickables) : null;
      const hov = hit ? hit.object.userData.key : -1;
      if (hov !== s.hover) {
        s.hover = hov;
        if (hov >= 0) audio.tone({ freq: 3800 + Math.random() * 900, dur: 0.05, type: 'triangle', volume: 0.025, attack: 0.002 });
      }
      ctx.renderer.domElement.style.cursor = hov >= 0 ? 'pointer' : 'grab';
      // The front key: the one pointing at the lock (+X) right now.
      s.front = ((Math.round(-s.spin / ((Math.PI * 2) / nKeys)) % nKeys) + nKeys) % nKeys;
      drawInset(s.hover >= 0 ? s.hover : s.front);
      // The assist: after three wrong keys (once the last refusal has been read), or 20 s without input
      // (the dialogue plays outside this loop).
      if (!s.auto && ((s.wrong >= assistAfter && s.phaseT >= 1.4) || s.idle >= 20)) return 'assist';
      let tryKey = -1;
      if (P.click) tryKey = hov >= 0 ? hov : s.front;
      if (s.auto) tryKey = right;
      if (tryKey >= 0) {
        s.current = tryKey;
        s.tries++;
        s.phase = 'aim';
        s.phaseT = 0;
        // Spin the shortest way so the key points at the lock (+X), then hold that.
        const want = -keys[tryKey].th;
        s.spinTo = s.spin + wrapPi(want - s.spin);
        s.hover = -1;
        drawInset(tryKey);
        jingle(audio, { volume: 0.1, n: 4 });
        ctx.renderer.domElement.style.cursor = '';
      }
    } else if (s.phase === 'aim') {
      if (Math.abs(s.spin - s.spinTo) < 0.01 || s.phaseT > 0.7) {
        s.spin = s.spinTo;
        spinner.rotation.z = s.spin;
        curP.copy(holder.position);
        curQ.copy(holder.quaternion);
        poseFor(s.current, 1, into);
        s.phase = 'insert';
        s.phaseT = 0;
      }
    } else if (s.phase === 'insert') {
      const k = smooth(Math.min(1, s.phaseT / 0.55));
      holder.position.lerpVectors(curP, into.p, k);
      holder.quaternion.slerpQuaternions(curQ, into.q, k);
      if (s.phaseT >= 0.55) {
        audio.sfx('key_insert', { volume: 0.35, fallback: (a) => a.tick({ volume: 0.25 }) }); // R4 Ch6 sounds
        s.phase = s.current === right ? 'turn' : 'jiggle';
        s.phaseT = 0;
      }
    } else if (s.phase === 'jiggle') {
      // In, but it won't turn: a few degrees, a dry clack against the pins, a rattle, back.
      const tryTurn = s.phaseT < 0.18 ? -(s.phaseT / 0.18) * 9 * DEG : -9 * DEG * (1 - Math.min(1, (s.phaseT - 0.18) / 0.4));
      const a = tryTurn + Math.sin(s.phaseT * 40) * 2.5 * DEG * Math.max(0, 1 - s.phaseT / 0.7);
      axisQ.setFromAxisAngle(inward, a);
      holder.quaternion.copy(axisQ).multiply(into.q);
      holder.position.copy(into.p).sub(mouth).applyQuaternion(axisQ).add(mouth);
      if (s.phaseT >= 0.18 && s.phaseT - raw < 0.18) audio.sfx('key_stuck', { volume: 0.35, fallback: (x) => x.tick({ volume: 0.25 }) }); // R4 Ch6 sounds: the clack and the rattle
      if (s.phaseT >= 0.8) {
        s.wrong++;
        say(ctx, wrongLine(), 2.4, who);
        showCount();
        curP.copy(holder.position);
        curQ.copy(holder.quaternion);
        s.phase = 'back';
        s.phaseT = 0;
      }
    } else if (s.phase === 'back') {
      const k = smooth(Math.min(1, s.phaseT / 0.5));
      holder.position.lerpVectors(curP, rest.p, k);
      holder.quaternion.slerpQuaternions(curQ, rest.q, k);
      if (s.phaseT >= 0.5) {
        s.phase = 'pick';
        s.phaseT = 0;
        s.idle = Math.min(s.idle, 3);
        jingle(audio, { volume: 0.06, n: 3 });
      }
    } else if (s.phase === 'turn') {
      // Home: a quarter turn about the blade, the bolt goes, the door gives a little.
      const k = smooth(Math.min(1, s.phaseT / 0.6));
      axisQ.setFromAxisAngle(inward, -k * Math.PI / 2);
      holder.quaternion.copy(axisQ).multiply(into.q);
      holder.position.copy(into.p).sub(mouth).applyQuaternion(axisQ).add(mouth);
      if (s.phaseT >= 0.6 && !s.done) {
        s.done = true;
        audio.sfx('lock_turn', { volume: 0.45, fallback: (a) => clack(a, { volume: 0.4 }) }); // R4 Ch6 sounds
        ctx.mood?.pulse?.(0.04);
      }
      if (s.phaseT >= 1.6) return true;
    }

    // The ring's spin (eased) and the keys' hover lift / hint glow.
    s.spin = damp(s.spin, s.spinTo, 14, raw);
    spinner.rotation.z = s.spin;
    for (const k of keys) {
      const want = s.phase !== 'pick' ? 0 : k.i === s.hover ? 1 : s.hover < 0 && k.i === s.front ? 0.6 : 0;
      k.lift = damp(k.lift, want, 16, raw);
      k.mesh.position.z = k.lift * 0.012;
      if (k.cap) k.cap.position.z = k.mesh.position.z;
      const glow = s.helped && k.i === right && s.phase === 'pick' ? 0.35 + 0.25 * Math.sin(s.t * 5) : k.lift * 0.3;
      k.mat.emissive.setRGB(glow * 0.85, glow * 0.62, glow * 0.25);
    }
    // Jo's red pencil ring round the right key, while she points.
    if (s.helped && (s.phase === 'pick' || s.phase === 'aim')) {
      const p = screenOf(right);
      pointEl.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      pointEl.classList.add('on');
    } else pointEl.classList.remove('on');
    return false;
  };
  let r = await d.until(frame);
  if (r === 'assist') {
    // Jo points (the ring stays up through her lines), then the ring turns to the ribbon and it opens.
    s.helped = true;
    s.assisted = true;
    s.hover = -1;
    frame(0); // place the pencil ring now
    const lines = (Array.isArray(T.assist) ? T.assist : [T.assist]).filter(Boolean).map((l) => (typeof l === 'string' ? { who, text: l } : l));
    if (lines.length) await d.say(lines);
    s.auto = true;
    s.phase = 'pick';
    r = await d.until(frame);
  }

  // ---------------------------------------------------------------- end
  const skipped = r === 'skipped';
  P.dispose();
  unhook();
  L.classList.remove('show');
  setTimeout(() => L.remove(), 400);
  stage.restore();
  disposeTree(G);
  for (const x of own) x.dispose?.();
  const tries = skipped ? Math.max(1, s.tries) : s.tries;
  const tier = skipped ? 'middle' : s.assisted ? 'poor' : s.tries <= 1 ? 'good' : s.tries <= 3 ? 'middle' : 'poor';
  return { tier, tries, wrong: s.wrong, assisted: s.assisted, skipped, secs: Math.round(s.t * 10) / 10 };
}

// ------------------------------------------------------------------ helpers

const _v = new THREE.Vector3();
function tmpV(v) {
  return _v.copy(v);
}
const wrapPi = (a) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));

/** Five cut depths, 1 (shallow) .. 5 (deep). */
function randomCode() {
  return Array.from({ length: CUTS }, () => 1 + Math.floor(Math.random() * 5));
}

/** A code that differs from `code` in exactly n positions. */
function nearCode(code, n) {
  const c = code.slice();
  const idx = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, Math.min(CUTS, n));
  for (const i of idx) {
    let v;
    do v = 1 + Math.floor(Math.random() * 5);
    while (v === code[i]);
    c[i] = v;
  }
  return c;
}

/** The bow's outline (key frame: the hole at the origin, the bow below it, the blade further down). */
function bowShape(kind, grow = 0) {
  const s = new THREE.Shape();
  const cy = -0.0045;
  if (kind === 'square') {
    const w = 0.0105 + grow;
    s.moveTo(-w, cy - w + 0.002);
    s.lineTo(-w, cy + w - 0.003);
    s.quadraticCurveTo(-w, cy + w, -w + 0.003, cy + w);
    s.lineTo(w - 0.003, cy + w);
    s.quadraticCurveTo(w, cy + w, w, cy + w - 0.003);
    s.lineTo(w, cy - w + 0.002);
    s.lineTo(-w, cy - w + 0.002);
  } else if (kind === 'hex') {
    const r = 0.011 + grow;
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      if (i === 0) s.moveTo(Math.cos(a) * r, cy + Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, cy + Math.sin(a) * r);
    }
  } else if (kind === 'clover') {
    const r = 0.0052 + grow;
    s.absarc(0, cy + 0.0048, r, 0, Math.PI * 2, false);
    const t = new THREE.Shape();
    // Three lobes as one outline: walk round a trefoil.
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const rr = 0.0085 + grow + 0.0032 * Math.cos(3 * a + Math.PI / 2);
      pts.push(new THREE.Vector2(Math.cos(a) * rr, cy + Math.sin(a) * rr));
    }
    t.setFromPoints(pts);
    return t;
  } else if (kind === 'tab') {
    // A Yale-style head: a wide rounded top, narrowing to the shoulder.
    const w = 0.0115 + grow;
    s.moveTo(-0.006, cy - 0.009);
    s.quadraticCurveTo(-w, cy - 0.004, -w, cy + 0.002);
    s.quadraticCurveTo(-w, cy + 0.011, 0, cy + 0.0115 + grow);
    s.quadraticCurveTo(w, cy + 0.011, w, cy + 0.002);
    s.quadraticCurveTo(w, cy - 0.004, 0.006, cy - 0.009);
    s.lineTo(-0.006, cy - 0.009);
  } else {
    s.absarc(0, cy, 0.0102 + grow, 0, Math.PI * 2, false);
  }
  return s;
}

/** One key: bow (with the ring's hole) and blade (the cuts on the +X edge), extruded 2.2 mm. */
function keyGeometry(def) {
  const bow = bowShape(def.bow);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.0029, 0, Math.PI * 2, true);
  bow.holes.push(hole);
  const b = BLADE;
  const blade = new THREE.Shape();
  const tip = b.top - b.len;
  blade.moveTo(b.spine, b.top + 0.003);
  blade.lineTo(b.spine, tip + 0.0035);
  blade.lineTo(b.spine + 0.002, tip);
  blade.lineTo(b.edge - 0.0028, tip);
  blade.lineTo(b.edge, tip + 0.004);
  // Up the cutting edge, the deepest cut last-in (the tip end) first.
  for (let k = CUTS - 1; k >= 0; k--) {
    const y = b.top - b.first - k * b.step;
    const depth = def.code[k] * b.depth;
    blade.lineTo(b.edge, y - 0.0026);
    blade.lineTo(b.edge - depth, y - 0.0007);
    blade.lineTo(b.edge - depth, y + 0.0007);
    blade.lineTo(b.edge, y + 0.0026);
  }
  // The shoulder (stops the key at the right depth), then back up into the bow.
  blade.lineTo(b.edge, b.top - 0.004);
  blade.lineTo(b.edge + 0.0016, b.top - 0.0035);
  blade.lineTo(b.edge + 0.0016, b.top + 0.003);
  blade.lineTo(b.spine, b.top + 0.003);
  const g = new THREE.ExtrudeGeometry([bow, blade], { depth: 0.0022, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -0.0011);
  return g;
}

/** A coloured rubber cover over the bow (the hole left open). */
function capGeometry(kind) {
  const s = bowShape(kind, 0.0012);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.0034, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.0042, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -0.0021);
  return g;
}

/**
 * The inset: the keyway seen end-on with its five pins hanging at the lock's heights, in pencil; the
 * hovered key's cuts in signwriter red underneath. When they match, every pin sits on the red line.
 */
function drawSilhouette(cv, code, hover) {
  const x = cv.getContext('2d');
  const W = cv.width;
  const H = cv.height;
  x.clearRect(0, 0, W, H);
  const left = 40;
  const right = W - 40;
  const top = 26;
  const floor = H - 30;
  const step = (right - left) / (CUTS + 1);
  const pinW = step * 0.42;
  const depthPx = (v) => top + 34 + v * 15; // a deeper cut lets its pin hang lower
  // The keyway: a pencilled channel.
  x.lineCap = 'round';
  x.lineJoin = 'round';
  x.strokeStyle = 'rgba(59, 58, 54, 0.8)';
  x.lineWidth = 2.4;
  x.beginPath();
  x.moveTo(left - 14, top + 6);
  x.lineTo(right + 14, top + 4);
  x.moveTo(left - 14, floor);
  x.lineTo(right + 14, floor + 2);
  x.stroke();
  // Pins, hatched.
  for (let k = 0; k < CUTS; k++) {
    const cx = left + step * (k + 1);
    const y1 = depthPx(code[k]);
    x.fillStyle = 'rgba(59, 58, 54, 0.16)';
    x.fillRect(cx - pinW / 2, top + 4, pinW, y1 - top - 4);
    x.strokeStyle = 'rgba(59, 58, 54, 0.9)';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(cx - pinW / 2, top + 4);
    x.lineTo(cx - pinW / 2, y1 - 6);
    x.lineTo(cx, y1);
    x.lineTo(cx + pinW / 2, y1 - 6);
    x.lineTo(cx + pinW / 2, top + 4);
    x.stroke();
    x.save();
    x.beginPath();
    x.rect(cx - pinW / 2, top + 4, pinW, y1 - top - 4);
    x.clip();
    x.strokeStyle = 'rgba(59, 58, 54, 0.35)';
    x.lineWidth = 1;
    for (let h = -40; h < 120; h += 7) {
      x.beginPath();
      x.moveTo(cx - pinW / 2, top + h);
      x.lineTo(cx + pinW / 2, top + h + 14);
      x.stroke();
    }
    x.restore();
  }
  if (!hover) return;
  // The hovered key's top edge: a V cut under each pin, as deep as its own code. The right key's
  // cuts catch every pin tip exactly at the bottom of its V.
  const edge = top + 44;
  x.strokeStyle = '#a3392b';
  x.lineWidth = 3;
  x.beginPath();
  x.moveTo(left - 14, edge);
  for (let k = 0; k < CUTS; k++) {
    const cx = left + step * (k + 1);
    x.lineTo(cx - step * 0.4, edge);
    x.lineTo(cx, depthPx(hover[k]));
    x.lineTo(cx + step * 0.4, edge);
  }
  x.lineTo(right + 14, edge);
  x.lineTo(right + 14, floor - 4);
  x.stroke();
  x.fillStyle = 'rgba(163, 57, 43, 0.08)';
  x.lineTo(left - 14, floor - 4);
  x.closePath();
  x.fill();
}

/** Old door planks: dark green paint, worn to the wood at the edges, a few scratches. */
function doorTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 600;
  const x = c.getContext('2d');
  x.fillStyle = '#6b4f36';
  x.fillRect(0, 0, c.width, c.height);
  const planks = 6;
  for (let i = 0; i < planks; i++) {
    const x0 = (i / planks) * c.width;
    const w = c.width / planks;
    x.fillStyle = i % 2 ? '#2e4637' : '#2b4334';
    x.fillRect(x0 + 3, 0, w - 6, c.height);
    // Worn edges: the wood shows through.
    for (let k = 0; k < 60; k++) {
      x.fillStyle = `rgba(${120 + Math.random() * 40}, ${90 + Math.random() * 30}, 60, ${0.25 + Math.random() * 0.4})`;
      const ex = Math.random() < 0.5 ? x0 + 3 + Math.random() * 10 : x0 + w - 13 + Math.random() * 10;
      x.fillRect(ex, Math.random() * c.height, 2 + Math.random() * 6, 6 + Math.random() * 40);
    }
    x.fillStyle = 'rgba(0, 0, 0, 0.55)';
    x.fillRect(x0, 0, 3, c.height);
  }
  for (let k = 0; k < 2200; k++) {
    const v = Math.random() < 0.5 ? 0 : 255;
    x.fillStyle = `rgba(${v}, ${v}, ${v}, ${Math.random() * 0.05})`;
    x.fillRect(Math.random() * c.width, Math.random() * c.height, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  x.strokeStyle = 'rgba(200, 190, 160, 0.25)';
  for (let k = 0; k < 30; k++) {
    x.lineWidth = 0.6 + Math.random();
    x.beginPath();
    const sx = Math.random() * c.width;
    const sy = Math.random() * c.height;
    x.moveTo(sx, sy);
    x.lineTo(sx + (Math.random() - 0.5) * 60, sy + (Math.random() - 0.5) * 30);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
