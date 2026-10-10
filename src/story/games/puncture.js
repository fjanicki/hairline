import * as THREE from 'three';
import { takeStage, layer, gamePointer, texts, say, setTips, clamp, damp, smooth, disposeTree, esc, bloop, debugHook } from './lib/games-a-kit.js';
import './puncture.css';

// PUNCTURE (docs/DESIGN-R4.md "New minigames", Ch5 Sami's tube): a close shot of a water bucket and an
// inner tube. Drag to feed the tube through the water; bubbles rise where the hole is (stronger when
// it is under water and the tube is squeezed: the button held). Click the hole to mark it (a chalk
// cross), then patch it: sand (scrub), glue (hold, let go in the band), press (hold the patch 3 s).
// Left alone, the bubbles grow every 5 s, the tube drifts to the hole, at 15 s the hole pulses and
// Sami says so, and at 25 s Hugo's thumb finds it. Sami barks throughout (docs/SCRIPT-R4.md §6.5.2).
//
//   await playGame('puncture', ctx, d, {
//     at,                   // where the bucket stands: [x, y, z] (default: a step in front of Hugo)
//     facing,               // yaw (radians) the shot looks along (default: Hugo's facing)
//     who = 'Sami',         // who barks (the script's barks are Sami's)
//     text,                 // L.games.puncture: { hint: { dunk, mark, patch }, steps: { sand, glue, press },
//                           //   gauge, glueGauge, title, barks: { fast[], wrong, found, glue, patch, oldPatch,
//                           //   assist }, afterPatch (Hugo's thought), valve, thin, spill }
//   })  -> { tier (by the time to find the hole: < 8 s good, < 20 s middle, else poor; skip: middle),
//            found: 'player'|'assist', findSecs, misses, glue: 'good'|'thin'|'spill', assisted, skipped, secs }
// Sami's tier line (games.puncture.tiers) is the chapter's, after the game.

export const id = 'puncture';

// (The script's lines, docs/SCRIPT-R4.md §6.5.2, where it has them.)
const FALLBACK = {
  title: 'RUSTINE',
  hint: {
    dunk: 'Glisser la chambre à air dans l’eau, lentement',
    mark: 'Cliquer là où ça fait des bulles',
    sand: 'Frotter de gauche à droite pour poncer',
    glue: 'Maintenir pour encoller, relâcher à temps',
    patch: 'Maintenir le clic pour appuyer la rustine',
  },
  steps: { sand: 'Poncer autour du trou', glue: 'Maintenir pour encoller, relâcher à temps', press: 'Appuyer la rustine' },
  gauge: 'APPUI',
  glueGauge: 'COLLE',
  barks: {
    fast: ['Doucement, tu vas la noyer.', 'Ça fait des bulles ! Non. C’est toi qui fais des bulles.'],
    wrong: 'C’est pas là. Là, c’est de l’eau.',
    found: 'Là ! Le petit chapelet !',
    glue: 'Attends que ça sèche. Monsieur Durand dit que c’est là que tout le monde rate.',
    patch: 'Appuie ! Monsieur Durand compte jusqu’à trente. Moi, je compte vite.',
    oldPatch: 'Ça, c’est une vieille rustine. C’est monsieur Durand qui l’a mise. Il les coupe en ovale, à la main.',
    assist: 'Ça fait des grosses bulles, là. Même moi je vois.',
  },
  afterPatch: 'Trente secondes. Mon premier mécano disait pareil. Les vieux mécanos comptent tous.',
  valve: 'Ça, c’est la valve. Elle, elle a le droit de laisser passer l’air.',
  thin: 'Un peu juste, la colle.',
  spill: 'Trop de colle. Ça ne colle pas plus, ça colle partout.',
};

// The set, in the bucket's frame (metres; the shot looks down -Z, the bucket at the origin).
const BUCKET = { r0: 0.13, r1: 0.162, h: 0.29 };
const WATER_Y = 0.225;
const TUBE_R = 0.014;
const TUBE_LEN = 2.1; // the whole inner tube (a 700c loop)
const PATH = [
  [-0.7, 0.33, 0.26],
  [-0.38, 0.35, 0.08],
  [-0.15, 0.26, -0.02],
  [-0.07, 0.13, -0.04],
  [0.07, 0.13, -0.04],
  [0.15, 0.26, -0.02],
  [0.38, 0.35, 0.08],
  [0.7, 0.33, 0.26],
];
const SHOT = { pos: [0, 0.8, 0.4], look: [0, 0.15, -0.05], fov: 44 }; // high enough to see over the front rim
const MAX_BUBBLES = 64;
const MAX_RIPPLES = 10;
const FEED_PER_PX = 0.0015;
const PRESS_SECS = 3; // the press bar fills in 3 s (Sami counts to thirty, fast)
const STEP_IDLE = 3.5; // seconds without input before a patch step does itself

export async function play(ctx, d, opts = {}) {
  const { engine, audio, cam, camera, player } = ctx;
  const T = texts(FALLBACK, opts.text);
  const who = opts.who ?? 'Sami';

  // ---------------------------------------------------------------- the set
  const G = new THREE.Group();
  G.name = 'puncture-set';
  const facing = opts.facing ?? player.root.rotation.y;
  if (opts.at) G.position.set(opts.at[0], opts.at[1], opts.at[2]);
  else {
    // A step in front of Hugo, on his floor.
    const p = player.root.position;
    G.position.set(p.x + Math.sin(facing) * 0.9, p.y, p.z + Math.cos(facing) * 0.9);
  }
  // The shot looks along `facing`: the bucket's +Z points back at Hugo.
  G.rotation.y = facing + Math.PI;
  ctx.scene.add(G);
  const disposables = [];
  const own = (x) => (disposables.push(x), x);

  // Galvanised bucket: a lathe, a rolled rim, a wire handle.
  const zinc = own(new THREE.MeshStandardMaterial({ color: '#8f9498', metalness: 0.5, roughness: 0.42, side: THREE.DoubleSide, emissive: '#23272a' }));
  const prof = [];
  prof.push(new THREE.Vector2(0.001, 0));
  prof.push(new THREE.Vector2(BUCKET.r0, 0));
  for (let i = 1; i <= 8; i++) {
    const k = i / 8;
    prof.push(new THREE.Vector2(BUCKET.r0 + (BUCKET.r1 - BUCKET.r0) * k, BUCKET.h * k));
  }
  const bucket = new THREE.Mesh(own(new THREE.LatheGeometry(prof, 36)), zinc);
  bucket.castShadow = true;
  bucket.receiveShadow = true;
  const rim = new THREE.Mesh(own(new THREE.TorusGeometry(BUCKET.r1, 0.006, 6, 40)), zinc);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = BUCKET.h;
  const handle = new THREE.Mesh(own(new THREE.TorusGeometry(BUCKET.r1 + 0.004, 0.0028, 5, 24, Math.PI)), zinc);
  handle.position.y = BUCKET.h - 0.02;
  handle.rotation.set(-1.3, 0, 0); // pivots at the sides, fallen back behind the bucket
  // Water: dark, glossy, a little see-through, so the tube shows under it.
  const waterMat = own(new THREE.MeshStandardMaterial({ color: '#2f4045', roughness: 0.18, metalness: 0, envMapIntensity: 0.35, transparent: true, opacity: 0.42, depthWrite: false }));
  const water = new THREE.Mesh(own(new THREE.CircleGeometry(BUCKET.r0 + (BUCKET.r1 - BUCKET.r0) * (WATER_Y / BUCKET.h) - 0.002, 40)), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_Y;
  water.renderOrder = 2;
  G.add(bucket, rim, handle, water);

  // The tube: a fixed U through the water; feeding it scrolls the rubber (its texture, the valve, the hole).
  const curve = new THREE.CatmullRomCurve3(PATH.map((p) => new THREE.Vector3(...p)));
  const visLen = curve.getLength();
  const holeS0 = 0.95 + Math.random() * 0.6; // never at the valve (valveS = 0.2)
  const oldS = holeS0 + 0.24; // Durand's old oval patch: it goes under water just before the hole does
  const rubberTex = own(rubberTexture(oldS));
  rubberTex.wrapS = THREE.RepeatWrapping;
  rubberTex.repeat.set(visLen / TUBE_LEN, 1);
  const rubber = own(new THREE.MeshStandardMaterial({ color: '#ffffff', map: rubberTex, roughness: 0.62, metalness: 0 }));
  const tube = new THREE.Mesh(own(new THREE.TubeGeometry(curve, 180, TUBE_R, 12, false)), rubber);
  tube.castShadow = true;
  G.add(tube);
  // Presta valve: a brass stem on a black base, standing off the tube.
  const brass = own(new THREE.MeshStandardMaterial({ color: '#b39257', metalness: 0.8, roughness: 0.35 }));
  const valve = new THREE.Group();
  const vBase = new THREE.Mesh(own(new THREE.CylinderGeometry(0.0055, 0.0065, 0.022, 10)), own(new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5 })));
  vBase.position.y = 0.011;
  const vStem = new THREE.Mesh(own(new THREE.CylinderGeometry(0.0028, 0.0028, 0.034, 8)), brass);
  vStem.position.y = 0.036;
  valve.add(vBase, vStem);
  G.add(valve);

  // Bubbles (one instanced draw), ripples on the surface, the chalk ring and the patch decals.
  const bubbleMat = own(new THREE.MeshStandardMaterial({ color: '#e8f2f4', roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.6, emissive: '#5d6b70', emissiveIntensity: 0.4, depthWrite: false }));
  const bubbles = new THREE.InstancedMesh(own(new THREE.SphereGeometry(1, 10, 8)), bubbleMat, MAX_BUBBLES);
  bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bubbles.frustumCulled = false;
  bubbles.renderOrder = 3;
  G.add(bubbles);
  const B = Array.from({ length: MAX_BUBBLES }, () => ({ live: false, p: new THREE.Vector3(), v: 0, r: 0, t: 0, ph: 0, surf: 0 }));
  const rippleGeo = own(new THREE.RingGeometry(0.82, 1, 28));
  const R = Array.from({ length: MAX_RIPPLES }, () => {
    const m = new THREE.Mesh(rippleGeo, own(new THREE.MeshBasicMaterial({ color: '#dfe9ea', transparent: true, opacity: 0, depthWrite: false })));
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    m.renderOrder = 4;
    G.add(m);
    return { m, t: 1 };
  });
  // The chalk cross over the hole: two short strokes, drawn over everything.
  const chalkMat = own(new THREE.MeshBasicMaterial({ color: '#e9e2cf', transparent: true, opacity: 0.95, depthTest: false }));
  const strokeGeo = own(new THREE.PlaneGeometry(0.026, 0.0024));
  const chalk = new THREE.Group();
  for (const a of [0.75, -0.8]) {
    const m = new THREE.Mesh(strokeGeo, chalkMat);
    m.rotation.z = a;
    m.renderOrder = 8;
    chalk.add(m);
  }
  chalk.visible = false;
  G.add(chalk);
  // While the assist points: a soft pulse round the hole (under water too).
  const pulse = new THREE.Mesh(own(new THREE.RingGeometry(0.011, 0.016, 28)), own(new THREE.MeshBasicMaterial({ color: '#d9a441', transparent: true, opacity: 0, depthTest: false })));
  pulse.visible = false;
  pulse.renderOrder = 8;
  G.add(pulse);
  const scuff = new THREE.Mesh(own(new THREE.CircleGeometry(0.0115, 24)), own(new THREE.MeshStandardMaterial({ color: '#77736c', roughness: 0.95, transparent: true, opacity: 0, depthWrite: false, depthTest: false })));
  const glue = new THREE.Mesh(own(new THREE.CircleGeometry(0.0105, 24)), own(new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false })));
  const patchTex = own(patchTexture());
  const patch = new THREE.Mesh(own(new THREE.PlaneGeometry(0.02, 0.02)), own(new THREE.MeshStandardMaterial({ map: patchTex, roughness: 0.6, transparent: true, depthTest: false })));
  for (const [m, o] of [[scuff, 5], [glue, 6], [patch, 7]]) {
    m.visible = false;
    m.renderOrder = o;
    G.add(m);
  }

  // ---------------------------------------------------------------- state
  // Tube coordinates: s in [0, TUBE_LEN) along the rubber; u in [0, 1] along the visible U.
  // s(u) = u * visLen - feed (mod TUBE_LEN); feeding moves the rubber toward +u.
  const valveS = 0.2;
  const holeS = holeS0;
  const uWet = waterSpan(curve); // [u0, u1]: the part under water
  const uBottom = (uWet[0] + uWet[1]) / 2;
  const uDry = 0.79; // the dry crest on the right, nearest the camera: where the patch goes on
  const wrapS = (x) => ((x % TUBE_LEN) + TUBE_LEN) % TUBE_LEN;
  const uOf = (sCoord, feed) => wrapS(sCoord + feed) / visLen;
  // Start with the hole a little upstream of the water, so the first drag brings it in.
  let feed = wrapS(uWet[0] * visLen - 0.35 - holeS);

  const s = {
    t: 0,
    idle: 0,
    phase: 'search', // search | lift | sand | glue | dry | press | done
    phaseT: 0,
    pressure: 0,
    found: null,
    misses: 0,
    grow: 0,
    sand: 0,
    sandDir: 0,
    sandTravel: 0,
    glue: 0,
    glueGrade: null,
    pressT: 0,
    placed: false,
    assisted: false,
    steps: 0,
    bubbled: false,
    spawn: 0,
    pops: 0,
    liftFrom: 0,
    liftTo: 0,
    findSecs: 0,
    barkAt: -1e9,
    dunked: false,
    oldSaid: false,
    pulsed: false,
    fed: 0,
  };
  const stage = takeStage(ctx, d, { hidePlayer: true, rain: 0.2 });
  const P = gamePointer(ctx);
  const unhook = debugHook(ctx, id, { s, G, hole: () => holePos(new THREE.Vector3()), uOf: () => uOf(holeS, feed), uWet });
  const local = (v) => G.localToWorld(new THREE.Vector3(...v));
  cam.set({ pos: local(SHOT.pos), look: local(SHOT.look), fov: SHOT.fov });
  const shotPos = new THREE.Vector3();
  const shotLook = new THREE.Vector3();
  const closePos = new THREE.Vector3();
  const closeLook = new THREE.Vector3();
  let camK = 0; // 0 = the bucket shot, 1 = close on the hole

  // ---------------------------------------------------------------- the DOM
  const L = layer(
    ctx,
    'ga-puncture',
    `<div class="pu-card ga-paper"><div class="ga-head">${esc(T.title)}</div>
       <ol class="pu-steps"><li data-k="sand">${esc(T.steps.sand)}</li><li data-k="glue">${esc(T.steps.glue)}</li><li data-k="press">${esc(T.steps.press)}</li></ol></div>
     <div class="ga-meter pu-meter"><div class="ga-label">${esc(T.gauge)}</div><div class="ga-track"><div class="pu-band"></div><div class="ga-fill"></div></div></div>
     <div class="ga-tips"></div>`,
  );
  const tipsEl = L.querySelector('.ga-tips');
  const card = L.querySelector('.pu-card');
  const meter = L.querySelector('.pu-meter');
  const meterFill = meter.querySelector('.ga-fill');
  const meterLabel = meter.querySelector('.ga-label');
  const stepEl = (k) => card.querySelector(`[data-k="${k}"]`);
  requestAnimationFrame(() => L.classList.add('show'));
  const setMeter = (label, v, band) => {
    if (label === null) {
      meter.classList.remove('on');
      return;
    }
    meter.classList.add('on');
    if (meterLabel.textContent !== label) meterLabel.textContent = label;
    meterFill.style.width = `${Math.round(clamp(v, 0, 1.25) * 80)}%`; // 1.0 = 80% of the track
    meter.classList.toggle('band', !!band);
    meter.classList.toggle('warn', v > 1.08);
  };
  const tick = (k, ok = true) => {
    const e = stepEl(k);
    e.classList.add(ok ? 'done' : 'meh');
  };
  const barks = T.barks || {};
  const fastLine = bagOf(barks.fast);
  /** Sami's barks: at most one per 4 s (force: the beats that must land). */
  const bark = (line, force = false) => {
    if (!line || (!force && s.t - s.barkAt < 4)) return;
    s.barkAt = s.t;
    say(ctx, line, 2.6, who);
  };

  // ---------------------------------------------------------------- per-frame helpers (no allocation)
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const camLocal = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const dummy = new THREE.Object3D();
  const holeLocal = new THREE.Vector3();
  /** The hole on the visible U (local), or null when it is round the back of the loop. */
  const holeAt = (out) => {
    const u = uOf(holeS, feed);
    if (u < 0.005 || u > 0.995) return null;
    curve.getPointAt(u, out);
    // On the side of the tube facing the camera.
    camLocal.copy(camera.position);
    G.worldToLocal(camLocal);
    tmp2.copy(camLocal).sub(out).normalize();
    out.addScaledVector(tmp2, TUBE_R * 0.98);
    return out;
  };
  const holePos = (out) => {
    if (!holeAt(out)) return null;
    return G.localToWorld(out);
  };
  const wet = (u) => u > uWet[0] && u < uWet[1];
  const spawnBubble = (at, size) => {
    const b = B.find((x) => !x.live);
    if (!b) return;
    b.live = true;
    b.p.copy(at);
    b.p.x += (Math.random() - 0.5) * 0.004;
    b.p.z += (Math.random() - 0.5) * 0.004;
    b.r = (0.0025 + Math.random() * 0.003) * size;
    b.v = 0.09 + Math.random() * 0.07 + b.r * 6;
    b.t = 0;
    b.ph = Math.random() * 6.28;
    b.surf = 0;
  };
  const ripple = (x, z, size) => {
    const r = R.find((q) => q.t >= 1) || R[0];
    r.t = 0;
    r.size = size;
    r.m.position.set(x, WATER_Y + 0.001, z);
    r.m.visible = true;
  };
  const stepBubbles = (raw) => {
    let n = 0;
    for (let i = 0; i < MAX_BUBBLES; i++) {
      const b = B[i];
      if (!b.live) {
        dummy.scale.setScalar(0);
        dummy.position.set(0, -10, 0);
      } else {
        b.t += raw;
        if (b.surf > 0) {
          // Sitting on the surface a moment, then gone.
          b.surf -= raw;
          if (b.surf <= 0) b.live = false;
          b.p.y = WATER_Y + b.r * 0.35;
        } else {
          b.p.y += b.v * raw;
          b.p.x += Math.sin(b.t * 9 + b.ph) * 0.012 * raw;
          b.p.z += Math.cos(b.t * 7 + b.ph) * 0.01 * raw;
          if (b.p.y >= WATER_Y) {
            b.surf = 0.25 + Math.random() * 0.45;
            ripple(b.p.x, b.p.z, 0.006 + b.r * 2.2);
            if (s.pops < 9) {
              s.pops++;
              bloop(audio, { size: b.r / 0.004, volume: 0.06 });
            }
          }
        }
        dummy.position.copy(b.p);
        dummy.scale.set(b.r, b.surf > 0 ? b.r * 0.6 : b.r, b.r);
        n++;
      }
      dummy.updateMatrix();
      bubbles.setMatrixAt(i, dummy.matrix);
    }
    bubbles.instanceMatrix.needsUpdate = true;
    for (const r of R) {
      if (r.t >= 1) continue;
      r.t = Math.min(1, r.t + raw / 0.7);
      r.m.scale.setScalar(0.004 + r.size * smooth(r.t));
      r.m.material.opacity = 0.35 * (1 - r.t);
      if (r.t >= 1) r.m.visible = false;
    }
    return n;
  };
  /** Place a flat decal on the tube at the hole, facing the camera. */
  const decal = (m, lift) => {
    if (!holeAt(holeLocal)) return;
    m.position.copy(holeLocal).addScaledVector(tmp2, lift);
    m.lookAt(G.localToWorld(tmp.copy(camLocal)));
  };
  const placeRubber = () => {
    rubberTex.offset.x = -feed / TUBE_LEN;
    const uv = uOf(valveS, feed);
    valve.visible = uv > 0.01 && uv < 0.99;
    if (valve.visible) {
      curve.getPointAt(uv, valve.position);
      curve.getTangentAt(uv, tan);
      // Stand the valve off the side of the U that faces the wheel's centre (up and in).
      side.crossVectors(tan, up).cross(tan).normalize().negate();
      valve.position.addScaledVector(side, TUBE_R * 0.9);
      valve.quaternion.setFromUnitVectors(up, side);
    }
  };

  // ---------------------------------------------------------------- the loop
  let lastSpawn = 0;
  const r = await d.until((dt) => {
    const raw = engine.rawDt || dt;
    s.t += raw;
    s.phaseT += raw;
    P.update();
    if (P.touched) s.idle = 0;
    else s.idle += raw;
    s.pops = Math.max(0, s.pops - raw * 9);

    if (s.phase === 'search') {
      // The bubbles grow over time, and a step more every 5 s without input.
      s.grow = clamp((s.t - 10) / 14, 0, 1) * 0.5 + Math.min(3, Math.floor(s.idle / 5)) * 0.33;
      // Feed: drag along the tube (left / right); the button held squeezes.
      if (P.down) {
        feed = wrapS(feed + P.dragX * FEED_PER_PX);
        s.fed += Math.abs(P.dragX) * FEED_PER_PX;
        if (Math.abs(P.dragX) > 0.5 && Math.random() < Math.abs(P.dragX) * 0.02) audio.sfx('paint_slosh', { volume: 0.06, rate: 1.4, jitter: 0.1, fallback: false });
        if (Math.abs(P.dragX) / Math.max(1e-3, raw) > 1400) bark(fastLine()); // a yank, not a feed
      }
      // Durand's old patch, the first time it goes under (fair play: the craftsman's oval).
      const uo = uOf(oldS, feed);
      if (!s.oldSaid && wet(uo)) {
        s.oldSaid = true;
        bark(barks.oldPatch, true);
      }
      s.pressure = damp(s.pressure, P.down ? 1 : 0, P.down ? 8 : 3, raw);
      const u = uOf(holeS, feed);
      // The assist: the tube drifts until the hole sits at the bottom of the U, and the hands squeeze.
      const drifting = s.idle >= 6;
      if (drifting) {
        const du = uBottom - u; // u runs 0 .. TUBE_LEN / visLen: straight there never crosses the seam
        const step = clamp(du * visLen, -0.12 * raw, 0.12 * raw);
        feed = wrapS(feed + step);
        if (wet(u)) s.pressure = Math.max(s.pressure, 0.6);
      }
      // Bubbles from the hole while it is under water.
      if (wet(u) && holeAt(holeLocal)) {
        const rate = (2 + 16 * s.pressure) * (1 + s.grow * 1.5);
        if (s.t - lastSpawn > 1 / rate) {
          lastSpawn = s.t;
          spawnBubble(holeLocal, 1 + s.grow * 1.6 + s.pressure * 0.6);
        }
        if (!s.bubbled && s.pressure > 0.3) s.bubbled = true;
      }
      // Mark: a click on the tube near the hole.
      if (P.click) {
        const hit = P.pick([tube]);
        const hp = holePos(tmp);
        if (hit && hp && hit.point.distanceTo(hp) < 0.04 + s.grow * 0.02) {
          s.found = 'player';
        } else if (hit) {
          s.misses++;
          G.worldToLocal(tmp2.copy(hit.point));
          const nearValve = valve.visible && tmp2.distanceTo(valve.position) < 0.04;
          if (nearValve) say(ctx, T.valve, 2.4);
          else bark(barks.wrong, true);
          audio.sfx('tin_tap', { volume: 0.12, rate: 0.6, fallback: false });
        }
      }
      // 15 s without input: Sami sees it, and the hole pulses; 25 s: Hugo's thumb finds it.
      if (!s.found && s.idle >= 15 && !s.pulsed) {
        s.pulsed = true;
        s.assisted = true;
        bark(barks.assist, true);
      }
      pulse.visible = s.pulsed && !s.found && !!holeAt(holeLocal);
      if (!s.found && (s.idle >= 25 || s.t >= 60) && wet(u) && Math.abs(u - uBottom) < 0.05) {
        s.found = 'assist';
        s.assisted = true;
      }
      if (s.found) {
        s.findSecs = s.t;
        pulse.visible = false;
        bark(barks.found, true);
        audio.sfx('chalk_line', { volume: 0.3, fallback: (a) => a.scrape({ volume: 0.2 }) });
        chalk.visible = true;
        s.phase = 'lift';
        s.phaseT = 0;
        s.liftFrom = feed;
        // Bring the hole up to the dry crest by the shortest way.
        let want = wrapS(uDry * visLen - holeS);
        let dd = want - feed;
        if (dd > TUBE_LEN / 2) dd -= TUBE_LEN;
        if (dd < -TUBE_LEN / 2) dd += TUBE_LEN;
        s.liftTo = feed + dd;
      }
    } else if (s.phase === 'lift') {
      const k = smooth(Math.min(1, s.phaseT / 1.2));
      feed = wrapS(s.liftFrom + (s.liftTo - s.liftFrom) * k);
      camK = k;
      s.pressure = 0;
      if (s.phaseT >= 1.3) {
        s.phase = 'sand';
        s.phaseT = 0;
        s.idle = 0;
        card.classList.add('on');
        scuff.visible = true;
        ctx.mood?.focusOn(chalk, { slot: 3, strength: 1, decay: 0, floor: 0.6, offsetY: 0, radius: 0.22 });
      }
    } else if (s.phase === 'sand') {
      // Scrub: a stroke is a change of direction after some travel.
      if (P.down && Math.abs(P.dragX) > 0) {
        const dir = Math.sign(P.dragX);
        s.sandTravel += Math.abs(P.dragX);
        if (dir !== s.sandDir && s.sandTravel > 18) {
          s.sandDir = dir;
          s.sandTravel = 0;
          s.sand++;
          audio.sfx('sand_stroke', { volume: 0.22, rate: 1.5, jitter: 0.08, fallback: (a) => a.scrape({ volume: 0.18, freq: 3200 }) });
        }
      }
      if (s.idle >= STEP_IDLE && s.phaseT - (s.autoAt || 0) > 0.35) {
        s.autoAt = s.phaseT;
        s.sand++;
        s.assistStep = true;
        audio.sfx('sand_stroke', { volume: 0.18, rate: 1.5, fallback: (a) => a.scrape({ volume: 0.15, freq: 3200 }) });
      }
      scuff.material.opacity = Math.min(0.8, s.sand * 0.16);
      if (s.sand >= 5) {
        tick('sand', !s.assistStep);
        if (s.assistStep) s.steps++;
        s.assistStep = false;
        s.phase = 'glue';
        s.phaseT = 0;
        s.idle = 0;
        s.armed = false;
        audio.sfx('paint_lid_open', { volume: 0.2, fallback: false });
      }
    } else if (s.phase === 'glue') {
      // Hold: the glue spreads; let go in the band (0.8 .. 1.05). Over 1.15 it spills.
      // A hold carried over from the sanding doesn't count: the glue waits for a fresh press.
      if (!P.down) s.armed = true;
      const held = P.down && s.armed;
      const auto = s.idle >= STEP_IDLE && !s.glueHeld;
      if (held || auto) {
        if (!s.glueHeld && held) s.glueHeld = true;
        s.glue += raw / 1.1;
        if (auto) s.assistStep = true;
        glue.visible = true;
        if (Math.random() < raw * 6) audio.noise({ type: 'bandpass', freq: 900, q: 1.2, dur: 0.08, volume: 0.04, tail: 0.05 });
      }
      const letGo = (s.glueHeld && P.released) || (auto && s.glue >= 0.92) || s.glue >= 1.3;
      glue.scale.setScalar(Math.max(0.05, Math.min(1.35, s.glue)));
      setMeter(T.glueGauge, s.glue, true);
      if (letGo) {
        s.glueGrade = s.glue < 0.8 ? 'thin' : s.glue > 1.08 ? 'spill' : 'good';
        if (s.glueGrade !== 'good') say(ctx, T[s.glueGrade], 2.4);
        else bark(barks.glue, true);
        tick('glue', s.glueGrade === 'good' && !s.assistStep);
        if (s.assistStep) s.steps++;
        if (s.glueGrade !== 'good') s.steps++;
        s.assistStep = false;
        s.phase = 'dry';
        s.phaseT = 0;
        setMeter(null);
      }
    } else if (s.phase === 'dry') {
      // The glue goes from wet to tacky (it loses its shine); nothing to do but wait.
      glue.material.roughness = 0.08 + Math.min(1, s.phaseT / 1.6) * 0.6;
      if (s.phaseT >= 1.8) {
        s.phase = 'press';
        s.phaseT = 0;
        s.idle = 0;
        s.armed = false;
      }
    } else if (s.phase === 'press') {
      // Click places the patch; hold to press it down (1.2 s); let go early and it lifts a little.
      if (!P.down) s.armed = true;
      const held = P.down && s.armed;
      const auto = s.idle >= STEP_IDLE;
      if ((held || auto) && !s.placed) {
        s.placed = true;
        patch.visible = true;
        bark(barks.patch, true);
        audio.sfx('velcro_rip', { volume: 0.08, rate: 1.8, fallback: (a) => a.tick({ volume: 0.2 }) });
      }
      if (s.placed && (held || auto)) {
        s.pressT += raw;
        if (auto) s.assistStep = true;
      } else if (s.placed) s.pressT = Math.max(0, s.pressT - raw * 0.6);
      if (s.placed) setMeter(T.gauge, (s.pressT / PRESS_SECS) * 1.25, false); // fills the whole track
      patch.scale.setScalar(1 + 0.12 * (1 - Math.min(1, s.pressT / PRESS_SECS)));
      if (s.pressT >= PRESS_SECS) {
        tick('press', !s.assistStep);
        if (s.assistStep) s.steps++;
        s.assistStep = false;
        audio.sfx('tin_tap', { volume: 0.15, rate: 0.5, fallback: (a) => a.thud({ volume: 0.25 }) });
        ctx.mood?.pulse?.(0.04);
        setMeter(null);
        s.after = true;
        s.phase = 'done';
        s.phaseT = 0;
      }
    } else if (s.phase === 'done') {
      if (s.after && s.phaseT >= 0.9) {
        s.after = false;
        say(ctx, T.afterPatch, 3.4); // Hugo, once, after Sami's count
      }
      if (s.phaseT >= 2.2) return true;
    }

    // Place everything that rides on the rubber, the decals, the camera.
    placeRubber();
    if (chalk.visible) decal(chalk, 0.002);
    if (pulse.visible) {
      decal(pulse, 0.002);
      pulse.material.opacity = 0.45 + 0.4 * Math.sin(s.t * 6);
      pulse.scale.setScalar(1 + 0.25 * Math.sin(s.t * 6));
    }
    if (scuff.visible) decal(scuff, 0.0008);
    if (glue.visible) decal(glue, 0.0012);
    if (patch.visible) decal(patch, 0.0018 + 0.004 * (1 - Math.min(1, s.pressT / PRESS_SECS)));
    stepBubbles(raw);
    // Camera: the bucket shot, or close on the hole once it is out of the water.
    shotPos.set(...SHOT.pos);
    shotLook.set(...SHOT.look);
    if (camK > 0) {
      curve.getPointAt(uDry, closeLook);
      closePos.copy(closeLook).add(tmp.set(0.0, 0.13, 0.24));
      shotPos.lerp(closePos, camK);
      shotLook.lerp(closeLook, camK);
    }
    // A breath of hand-held drift.
    shotPos.x += Math.sin(s.t * 0.7) * 0.004;
    shotPos.y += Math.sin(s.t * 0.53 + 1) * 0.003;
    cam.set({ pos: G.localToWorld(shotPos), look: G.localToWorld(shotLook), fov: SHOT.fov - camK * 6 });

    // Tips for the phase.
    const H = T.hint || {};
    if (s.phase === 'search') setTips(tipsEl, [['l', H.dunk], ['l', H.mark]]);
    else if (s.phase === 'sand') setTips(tipsEl, [['l', H.sand]]);
    else if (s.phase === 'glue') setTips(tipsEl, [['l', H.glue]]);
    else if (s.phase === 'press') setTips(tipsEl, [['l', H.patch]]);
    else setTips(tipsEl, []);
    // Card: the active step.
    for (const k of ['sand', 'glue', 'press']) stepEl(k).classList.toggle('now', s.phase === k);
    return false;
  });

  // ---------------------------------------------------------------- end
  const skipped = r === 'skipped';
  P.dispose();
  unhook();
  L.classList.remove('show');
  setTimeout(() => L.remove(), 400);
  ctx.mood?.focusOn(null, { slot: 3 });
  stage.restore();
  disposeTree(G);
  for (const x of disposables) x.dispose?.();
  if (skipped) {
    if (!s.found) s.found = 'assist';
    if (!s.glueGrade) s.glueGrade = 'good';
  }
  // The tier is how fast the hole was found (the script's measure); the patch steps only add `assisted`.
  const find = s.findSecs || s.t;
  const tier = skipped ? 'middle' : s.found === 'assist' ? 'poor' : find < 8 ? 'good' : find < 20 ? 'middle' : 'poor';
  return { tier, found: s.found, findSecs: Math.round(find * 10) / 10, misses: s.misses, glue: s.glueGrade, assisted: s.assisted || s.steps > 0, skipped, secs: Math.round(s.t * 10) / 10 };
}

// ------------------------------------------------------------------ helpers

function bagOf(list) {
  const arr = Array.isArray(list) ? list : [list];
  let i = -1;
  return () => arr[(i = (i + 1) % arr.length)];
}

/** The part of the U under the water line, inside the bucket: [u0, u1]. */
function waterSpan(curve) {
  const p = new THREE.Vector3();
  let u0 = 1;
  let u1 = 0;
  for (let i = 0; i <= 400; i++) {
    const u = i / 400;
    curve.getPointAt(u, p);
    if (p.y < WATER_Y - TUBE_R * 0.6 && Math.hypot(p.x, p.z) < BUCKET.r1) {
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
    }
  }
  return [u0, u1];
}

/** Black rubber along the tube: a mould seam, the size printed twice, talc smudges. */
function rubberTexture(oldS) {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#1d1d1f';
  x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 2600; i++) {
    const v = 20 + Math.random() * 30;
    x.fillStyle = `rgba(${v}, ${v}, ${v + 2}, 0.5)`;
    x.fillRect(Math.random() * c.width, Math.random() * c.height, 2 + Math.random() * 6, 1);
  }
  // Mould seams.
  x.fillStyle = 'rgba(70, 70, 72, 0.7)';
  x.fillRect(0, 15, c.width, 1.5);
  x.fillRect(0, 47, c.width, 1.5);
  // Talc, worn into the grooves.
  for (let i = 0; i < 40; i++) {
    x.fillStyle = `rgba(190, 186, 176, ${0.04 + Math.random() * 0.08})`;
    x.beginPath();
    x.ellipse(Math.random() * c.width, Math.random() * c.height, 10 + Math.random() * 40, 3 + Math.random() * 6, 0, 0, 6.28);
    x.fill();
  }
  x.fillStyle = 'rgba(150, 148, 142, 0.75)';
  x.font = 'bold 15px system-ui, sans-serif';
  x.textBaseline = 'middle';
  for (const at of [260, 1280]) x.fillText('700×23/25C  ·  PRESTA 60 mm  ·  BUTYL', at, 32);
  // An old patch, cut in an oval by hand: black, its orange rim worn to a thin line.
  const ox = (oldS / TUBE_LEN) * c.width;
  for (const dx of [0, -c.width, c.width]) {
    x.fillStyle = '#c4672f';
    x.beginPath();
    x.ellipse(ox + dx, 32, 19, 14, 0, 0, 6.28);
    x.fill();
    x.fillStyle = '#141414';
    x.beginPath();
    x.ellipse(ox + dx, 32, 16.5, 11.5, 0, 0, 6.28);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A rubber patch: black centre, the orange feathered rim, foil already peeled. */
function patchTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 128, 128);
  const rr = (r, col) => {
    x.fillStyle = col;
    x.beginPath();
    x.roundRect(64 - r, 64 - r, r * 2, r * 2, r * 0.45);
    x.fill();
  };
  rr(62, '#d8662a');
  rr(54, '#e07a34');
  rr(44, '#1c1b1a');
  x.fillStyle = 'rgba(255, 255, 255, 0.08)';
  x.beginPath();
  x.ellipse(52, 50, 18, 10, -0.6, 0, 6.28);
  x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
