import * as THREE from 'three';
import { L } from './script.js';
import { makeSteer } from './minigames.js';
import { buildScene5, aimBone, clampToBounds, LINE_Z0, LINE_Z1, LINE_Y } from '../world/scenes/scene5.js';

// Ch5 "The Wall": Rue des Tanneurs, Week 12. Day, then golden hour. See docs/DESIGN.md (Ch5).
//
// Beats: opening (Find Odile) -> Teach (Sami's chain, "Teech.") -> THE LINE (20 m in 16 s, W/S
// steady the brush) -> tier + sign + Ines's photo -> the run club passes ([E] Wave, Bastien's shin)
// -> the boot comes off on the bench ([E] Strap) -> golden-hour walk home (Sami rides past, jog/stop
// line, mural and bike thoughts) -> the watch on its nail -> the last STRIDE menu -> the notebook
// finale -> crane-up -> white.
//
// Every await goes through the Director (say / until / wait / interact / gate), so debug.skip()
// always progresses. Prompts ([E] Wave, [E] Strap) and the line auto-complete with no input.

const T = L.ch5;
const N = L.notebook.items;

const LINE_SPEED = 1.25; // m/s along the wall: 20 m in 16 s
const TIP_LEAD = 0.6; // the brush tip runs this far ahead of Hugo (so the camera sees it past his shoulder)
const LINE_AMP = 0.17; // metres of wobble at |offset| = 1
const LINE_BAND = 0.25;
// mean |offset| thresholds. Tuned with the steer below (399-seed sim): idle lands in 'middle',
// calm corrections reach 'good', erratic input lands in 'poor'.
const TIERS = { good: 0.25, middle: 0.45 };
const DEFAULT_CAM = { offset: [0, 2.6, 4.2], look: [0, 1.1, 0], lerp: 6 };
const LINE_CAM = { offset: [5.35, 1.8, 1.6], look: [-0.65, 1.5, -1.2], lerp: 5 };
const PROMPT_AUTO = 8; // seconds before [E] Wave / [E] Strap happen on their own

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();
// Per-frame scratch vectors for the arm poses and the brush (no allocation in the update hook).
const _sh = new THREE.Vector3();
const _up = new THREE.Vector3();
const _el = new THREE.Vector3();
const _tip = new THREE.Vector3();
const _hand = new THREE.Vector3();
const HAND_FALLBACK = new THREE.Vector3(-0.3, 1.35, -0.2);
const UP = new THREE.Vector3(0, 1, 0);

function dampAngle(a, b, lambda, dt) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}

const faceTo = (obj, x, z) => {
  obj.rotation.y = Math.atan2(x - obj.position.x, z - obj.position.z);
};

export default {
  id: 'wall',
  title: T.title,
  hope: 0.62,
  preset: 'wall',
  objective: T.objectives.start,
  music: { name: 'piano', volume: 0.36, fade: 3 },
  ambience: [],
  camera: { offset: DEFAULT_CAM.offset, look: DEFAULT_CAM.look, fov: 55, lerp: 6 },
  player: { spawn: [0, 6], facing: Math.PI, boot: true, limp: 0.7, painRate: 1 / 1.5, footsteps: 'boot' },
  build: (ctx) => buildScene5(ctx),

  async run(ctx, d) {
    ctx.player.firstStumbleDone = true;
    const W = ctx.world.current;
    if (!W?.cast || !W?.line) {
      console.warn('[hairline] ch5: scene extras missing (build fallback); running the short version');
      await shortRun(ctx, d);
      return;
    }
    await fullRun(ctx, d, W);
  },
};

// =============================================================================================
// The chapter
// =============================================================================================

async function fullRun(ctx, d, W) {
  const { ui, player, hotspots, mood, audio, cam, input, runner, world, engine } = ctx;
  const S = W.spots;
  const { odile, sami, neighbours, club } = W.cast;
  const bounds = W.bounds;

  // ------------------------------------------------------------------ helpers
  const fade = (to, dur, color) =>
    d.gate(ui.fade(to, dur, color), () => {
      ui.fade(to, 0, color);
      return false;
    });
  const followDefault = (snap = false) => {
    cam.follow(player.root, { ...DEFAULT_CAM, snap });
    cam.fov(55);
    if (snap) cam.snap();
  };
  const placePlayer = (x, z, facing) => {
    const [cx, cz] = clampToBounds(bounds, x, z);
    player.teleport(cx, cz, facing);
  };
  const sit = (char, on) => {
    char.play(on ? 'sad' : 'idle', 0.3);
    char.model.position.y = on ? -0.42 : 0;
  };
  /** Walk an NPC to `to`; snaps there on skip or after `max` s. gated=false runs it in the background. */
  const walkNpc = async (char, to, { speed = 1.1, face, max = 8, gated = true } = {}) => {
    const h = runner.walkTo(char, to, { speed, face });
    const snap = () => {
      h.stop?.();
      char.root.position.set(to[0], 0, to[1]);
      if (face !== undefined) char.root.rotation.y = face;
      char.play('idle', 0.2);
    };
    const p = Promise.race([Promise.resolve(h), engine.wait(max)]);
    const r = gated ? await d.gate(p, () => (snap(), false)) : await p;
    if (r !== 'skipped' && Math.hypot(char.root.position.x - to[0], char.root.position.z - to[1]) > 0.3) snap();
  };
  /** [E] prompt that happens by itself after PROMPT_AUTO s. */
  const pressE = async (text) => {
    ui.prompt(text);
    let t = 0;
    await d.until((dt) => {
      t += dt;
      return (t > 0.3 && input.pressed.has('KeyE')) || t > PROMPT_AUTO;
    });
    input.consume('KeyE');
    ui.prompt(null);
  };

  // Non-blocking thoughts that wait for the current bark to finish.
  const queue = [];
  let busyUntil = 0;
  const bark = (text, who, secs = 2.4) => {
    ui.thought(text, secs, who ? { who } : {});
    busyUntil = engine.now + secs + 0.2;
  };
  const thoughtSoon = (text, secs = 3.6) => queue.push({ text, secs });
  world.onUpdate(() => {
    if (queue.length && engine.now > busyUntil && !ui.modal) {
      const q = queue.shift();
      bark(q.text, null, q.secs);
    }
  });

  // ------------------------------------------------------------------ Hugo's arms (after the mixers)
  const H = player.char;
  const bones = {
    rArm: H.bone?.('RightArm'),
    rFore: H.bone?.('RightForeArm'),
    lArm: H.bone?.('LeftArm'),
    lFore: H.bone?.('LeftForeArm'),
    lHand: H.bone?.('LeftHand'),
  };
  const arm = { mode: null, w: 0, goal: 0, t: 0, target: new THREE.Vector3() };
  const setArm = (mode, on = true, target) => {
    if (on) arm.mode = mode;
    arm.goal = on ? 1 : 0;
    if (target) arm.target.copy(target);
  };
  let lineActive = false;
  world.onUpdate((_dt, raw) => {
    arm.t += raw;
    arm.w += (arm.goal - arm.w) * (1 - Math.exp(-7 * raw));
    if (arm.goal === 0 && arm.w < 0.01) arm.mode = null;
    const w = arm.w;
    if (arm.mode && w > 0.005) {
      if (arm.mode === 'wave' && bones.rArm && bones.rFore) {
        player.root.getWorldQuaternion(_q);
        const right = _v.set(-1, 0, 0).applyQuaternion(_q);
        const fwd = _w.set(0, 0, 1).applyQuaternion(_q);
        bones.rArm.updateWorldMatrix(true, false);
        const sh = _sh.setFromMatrixPosition(bones.rArm.matrixWorld);
        const up = _up.copy(sh).addScaledVector(right, 0.32).addScaledVector(UP, 0.85).addScaledVector(fwd, 0.15);
        aimBone(bones.rArm, up, w);
        bones.rFore.updateWorldMatrix(true, false);
        const el = _el.setFromMatrixPosition(bones.rFore.matrixWorld);
        const hand = el.addScaledVector(UP, 1).addScaledVector(right, 0.3 * Math.sin(arm.t * 8));
        aimBone(bones.rFore, hand, w);
      } else if (arm.mode === 'reach' && bones.rArm && bones.rFore) {
        aimBone(bones.rArm, arm.target, w);
        aimBone(bones.rFore, arm.target, w);
      } else if (arm.mode === 'brush' && bones.lArm && bones.lFore) {
        const tip = W.line.tip.getWorldPosition(_tip);
        aimBone(bones.lArm, tip, w);
        aimBone(bones.lFore, tip, w);
      }
    }
    if (lineActive) {
      const tip = W.line.tip.getWorldPosition(_tip);
      let hand;
      if (bones.lHand) {
        bones.lHand.updateWorldMatrix(true, false);
        hand = _hand.setFromMatrixPosition(bones.lHand.matrixWorld);
      } else hand = _hand.copy(player.root.position).add(HAND_FALLBACK);
      W.line.placeBrush(tip, hand);
    }
  });

  // ------------------------------------------------------------------ Sami and his bike
  const rig = W.samiRig;
  const bike = W.samiBike;
  const wheels = bike.userData?.wheels || [];
  const R = bike.userData?.wheelRadius || 0.34;
  const sc = { v: 0, speed: 0, path: [], loop: null, resolve: null, riding: false };
  const mount = (on) => {
    sc.riding = on;
    if (on) {
      sami.play('sneak', 0.2);
      sami.root.position.set(0, 0, -0.2);
      sami.root.rotation.y = 0;
      sami.model.position.y = 0.43;
      bike.rotation.z = 0;
    } else {
      sami.play('idle', 0.25);
      sami.model.position.y = 0;
      sami.root.position.set(0.55, 0, 0.1);
      sami.root.rotation.y = -Math.PI / 2;
      bike.rotation.z = 0.06; // on its stand
    }
  };
  const rideTo = (points, speed = 3) => {
    sc.path = points.map((p) => new THREE.Vector3(p[0], 0, p[1]));
    sc.speed = speed;
    mount(true);
    return new Promise((res) => {
      sc.resolve?.('replaced');
      sc.resolve = res;
    });
  };
  const parkAt = (x, z, facing) => {
    sc.path = [];
    sc.loop = null;
    sc.v = 0;
    rig.position.set(x, 0, z);
    if (facing !== undefined) rig.rotation.y = facing;
    mount(false);
    const r = sc.resolve;
    sc.resolve = null;
    r?.('parked');
  };
  world.onUpdate((dt) => {
    if (!sc.path.length) {
      sc.v = Math.max(0, sc.v - dt * 4);
    } else {
      const tgt = sc.path[0];
      const dx = tgt.x - rig.position.x;
      const dz = tgt.z - rig.position.z;
      const dist = Math.hypot(dx, dz);
      sc.v += (sc.speed - sc.v) * (1 - Math.exp(-2 * dt));
      if (dist < 0.2) {
        sc.path.shift();
        if (!sc.path.length) {
          if (sc.loop) sc.path = sc.loop.map((p) => new THREE.Vector3(p[0], 0, p[1]));
          else {
            const r = sc.resolve;
            sc.resolve = null;
            r?.('arrived');
          }
        }
      } else {
        rig.rotation.y = dampAngle(rig.rotation.y, Math.atan2(dx, dz), 4, dt);
        const step = Math.min(dist, sc.v * dt);
        rig.position.x += (dx / dist) * step;
        rig.position.z += (dz / dist) * step;
      }
    }
    if (sc.v > 0.01) for (const wh of wheels) wh.rotation.x += (sc.v * dt) / R;
  });

  // ------------------------------------------------------------------ the run club (moved by hand)
  const runners = club.map((c, i) => ({ c, i, state: 'off', x: 0, z: 0, v: 3.4 + (i % 3) * 0.12 }));
  const bastien = runners[0];
  let clubSpot = null;
  world.onUpdate((dt) => {
    for (const r of runners) {
      if (r.state === 'off' || r.state === 'gone') continue;
      const root = r.c.root;
      if (r.state === 'run') {
        r.z -= r.v * dt;
        root.position.set(r.x, 0, r.z);
        root.rotation.y = Math.PI;
        const a = r.c.play('run', 0.25);
        if (a) a.timeScale = 0.85;
        if (r === bastien && clubSpot && !r.leaving && r.z <= clubSpot[1] + 0.8) {
          r.state = 'spot';
        }
        if (r.z < -45.5) {
          r.state = 'fading';
          r.c.fade(0, 0.8).then(() => {
            r.state = 'gone';
            root.visible = false;
          });
        }
      } else if (r.state === 'spot') {
        // Jogging on the spot beside Hugo, so the watch doesn't pause.
        r.x += (clubSpot[0] - r.x) * (1 - Math.exp(-4 * dt));
        r.z += (clubSpot[1] - r.z) * (1 - Math.exp(-4 * dt));
        root.position.set(r.x, 0, r.z);
        const p = player.root.position;
        root.rotation.y = dampAngle(root.rotation.y, Math.atan2(p.x - r.x, p.z - r.z), 6, dt);
        const a = r.c.play('run', 0.3);
        if (a) a.timeScale = 0.55;
      } else if (r.state === 'fading') {
        r.z -= r.v * dt;
        root.position.set(r.x, 0, r.z);
      }
    }
  });

  // ------------------------------------------------------------------ staging at the start
  const [chX, chZ] = S.odileChair;
  const chairFacing = Math.atan2(W.wallX - chX, (LINE_Z0 + LINE_Z1) / 2 - chZ);
  odile.root.position.set(chX, 0, chZ);
  odile.root.rotation.y = chairFacing;
  sit(odile, true);
  // Sami loops lazily up and down the right-hand side of the street.
  const LOOP = [
    [3.5, -27],
    [2.3, -28.5],
    [2.3, -7.5],
    [3.5, -6],
  ];
  rig.position.set(3.5, 0, -10);
  rig.rotation.y = Math.PI;
  sc.loop = LOOP;
  rideTo(LOOP, 2.3);

  // ------------------------------------------------------------------ optional hotspots (SHOULD)
  let roam = true;
  const homes = W.neighbourHome;
  const talk = (n, lines) => async () => {
    const c = n.char;
    const p = player.root.position;
    const rot = c.root.rotation.y;
    faceTo(c.root, p.x, p.z);
    player.face(c.root.position.x, c.root.position.z);
    await d.say(lines);
    c.root.rotation.y = rot;
  };
  const optional = [];
  const addOptional = (o) => {
    hotspots.add({ radius: 1.5, ...o, enabled: () => roam });
    optional.push(o.id);
  };
  for (const n of homes) {
    if (!n.id || !T[n.id]) continue;
    addOptional({ id: n.id, pos: n.pos, prompt: T.prompts[n.id] ?? 'Talk', onInteract: talk(n, T[n.id]) });
  }
  addOptional({ id: 'shopCard', pos: S.shop, prompt: T.prompts.shopCard, onInteract: () => d.say(T.shopCard) });
  addOptional({
    id: 'boltHoles',
    pos: [W.wallX + 1.3, S.boltHoles[1]],
    prompt: T.prompts.boltHoles,
    onInteract: () => d.say(T.boltHoles),
  });
  const dropOptional = () => {
    roam = false;
    for (const id of optional) hotspots.remove(id);
  };

  // ==================================================================== opening: Find Odile
  hotspots.add({
    id: 'meet',
    pos: [chX, chZ + 0.4],
    radius: 2.6,
    auto: true,
    marker: true,
    required: true,
    onInteract: async () => {
      player.face(odile.root.position.x, odile.root.position.z);
      await d.say(T.opening);
    },
  });
  await d.interact('meet');

  // ==================================================================== Teach
  {
    const p = player.root.position;
    const stop = [THREE.MathUtils.clamp(p.x + 2.1, -3.6, 3.6), THREE.MathUtils.clamp(p.z - 3.4, -45, -12)];
    sc.loop = null;
    const ride = rideTo(
      [
        [THREE.MathUtils.clamp(stop[0] + 0.8, -3.6, 3.8), Math.min(rig.position.z - 1, stop[1] + 7)],
        stop,
      ],
      3.2,
    );
    await d.gate(Promise.race([ride, engine.wait(14)]), () => {
      parkAt(stop[0], stop[1], Math.PI);
      return false;
    });
    parkAt(rig.position.x, rig.position.z, rig.rotation.y);
    audio.noise({ type: 'highpass', freq: 2600, q: 0.7, dur: 0.08, volume: 0.22 });
    audio.tick({ volume: 0.35 });
    bark(T.teach.call[0].text, T.teach.call[0].who, 2.6);
    ui.objective(T.objectives.sami);
    const samiPos = sami.root.getWorldPosition(new THREE.Vector3());
    hotspots.add({
      id: 'sami',
      pos: [samiPos.x, samiPos.z],
      radius: 1.9,
      prompt: T.prompts.sami,
      required: true,
      onInteract: async () => {
        const sp = sami.root.getWorldPosition(new THREE.Vector3());
        player.face(sp.x, sp.z);
        const pp = player.root.position;
        // Sami turns to Hugo (his root is inside the rig, so turn in rig space).
        sami.root.rotation.y = Math.atan2(pp.x - sp.x, pp.z - sp.z) - rig.rotation.y;
        await d.correct(T.teach.menu);
        audio.tick({ volume: 0.3 });
        bike.rotation.z = 0;
        const after = T.teach.after;
        await d.say(after.slice(0, 2)); // "I saw." / "What's this?"
        ui.notebook.open(5);
        await d.say(after.slice(2)); // "A list." / he writes / "You forgot one."
        await d.gate(ui.notebook.add(N.teach, { hand: 'sami' }));
        d.hope(0.75);
      },
    });
    await d.interact('sami');
    // Back on the bike, off to the bike shop window.
    rideTo([[3.4, Math.max(-44, rig.position.z - 1.5)], [3.4, -33.2]], 2.6).then((r) => {
      if (r === 'arrived') parkAt(3.4, -33.2, Math.PI / 2);
    });
  }

  // ==================================================================== The line
  ui.objective(T.objectives.line);
  hotspots.add({
    id: 'odile',
    pos: [chX, chZ],
    radius: 1.9,
    prompt: T.prompts.odile,
    required: true,
    onInteract: async () => {
      player.face(chX, chZ);
      await d.say(T.line.setup);
    },
  });
  await d.interact('odile');
  dropOptional();

  const line = W.line;
  const steer = makeSteer({ dims: 1, momentum: 0.4, drift: 0.7, driftGrow: 0.03, gain: 1.1, recenter: 0.06 });
  const ines = homes.find((n) => n.id === 'ines')?.char || neighbours[1];
  await fade(1, 0.5);
  {
    // Staging behind the cut: Odile waits at the kebab end, Ines a little further on, the other
    // neighbours step back across the street (behind the side camera).
    sit(odile, false);
    odile.root.position.set(W.wallX + 1.9, 0, LINE_Z1 - 1.6);
    odile.root.rotation.y = 0;
    ines.root.position.set(-2.2, 0, LINE_Z1 - 3.4);
    ines.root.rotation.y = 0;
    homes.forEach((n, i) => {
      if (n.char === ines) return;
      n.char.root.position.set(2.7 + (i % 2) * 0.7, 0, n.pos[1]);
      n.char.root.rotation.y = -Math.PI / 2;
    });
    parkAt(3.4, -33.2, Math.PI / 2); // wherever he'd got to, he's at the bike shop window now
    player.scripted = true;
    player.teleport(W.lineX, LINE_Z0 + TIP_LEAD, Math.PI + 0.3);
    H.play('walk', 0.1);
    cam.follow(player.root, { ...LINE_CAM, snap: true });
    cam.fov(50);
    cam.snap();
    line.tip.position.set(line.x, LINE_Y, LINE_Z0);
    line.chalkAt(LINE_Z0);
    setArm('brush', true);
    lineActive = true;
  }
  await d.wait(0.25);
  await fade(0, 0.6);
  ui.prompt(L.hints.steerLine);
  d.hope(0.84, 16);
  let stepT = 0;
  let stepBad = false;
  let strokeT = 0;
  const panels = W.panels || [];
  const passK = (p, tipZ) => {
    const hi = Math.max(p.z0, p.z1);
    const lo = Math.min(p.z0, p.z1);
    return (hi - tipZ) / Math.max(0.1, hi - lo);
  };
  const res = await d.until((dt) => {
    const root = player.root;
    root.position.z = Math.max(LINE_Z1 + TIP_LEAD, root.position.z - LINE_SPEED * dt);
    const tipZ = root.position.z - TIP_LEAD;
    steer.step(dt, input);
    const y = LINE_Y + steer.offset.y * LINE_AMP;
    line.tip.position.set(line.x, y, tipZ);
    line.paintTo(tipZ, y);
    line.chalkAt(tipZ);
    for (const p of panels) p.set(passK(p, tipZ));
    const prog = THREE.MathUtils.clamp((LINE_Z0 - tipZ) / (LINE_Z0 - LINE_Z1), 0, 1);
    mood.focusOn(line.tip, { slot: 0, offsetY: 0, strength: 1, decay: 0.25, floor: 0.4 + 0.3 * prog, radius: 0.32 });
    ui.gauge(T.line.gauge, {
      value: steer.offset.y,
      min: -1,
      max: 1,
      band: [-LINE_BAND, LINE_BAND],
      color: T.line.color,
      warn: Math.abs(steer.offset.y) > 0.6,
    });
    const a = H.play('walk', 0.3);
    if (a) a.timeScale = 0.95;
    // Boot steps (the Player is scripted, so it doesn't play them) and the brush on the wall.
    stepT -= dt;
    if (stepT <= 0) {
      stepT = stepBad ? 0.52 : 0.44;
      stepBad = !stepBad;
      if (stepBad) {
        audio.footstep('concrete', { volume: 0.45, rate: 0.72 });
        audio.thud({ volume: 0.12 });
      } else audio.footstep('concrete', { volume: 0.3 });
    }
    strokeT -= dt;
    if (strokeT <= 0) {
      strokeT = 0.4 + Math.random() * 0.2;
      audio.scrape({ volume: 0.06 });
    }
    return tipZ <= LINE_Z1 + 1e-3;
  });
  if (res === 'skipped') {
    player.root.position.z = LINE_Z1 + TIP_LEAD;
    line.tip.position.set(line.x, LINE_Y, LINE_Z1);
    line.finish();
    for (const p of panels) p.set(1);
  }
  ui.gauge(null);
  ui.prompt(null);
  ui.objective(null);
  line.hideChalk();
  lineActive = false;
  line.brush.visible = false;
  setArm('brush', false);
  H.play('idle', 0.4);
  player.root.rotation.y = -Math.PI / 2 + 0.25; // looking at it
  mood.focusOn(line.tip, { slot: 0, offsetY: 0, strength: 1, decay: 0.25, floor: 0.7, radius: 0.32 });
  const score = res === 'skipped' ? TIERS.good : steer.stats.mean;
  await d.wait(0.6);
  await d.say(T.line.end);

  // Back to the street camera (a short cut hides the step off the drop cloth).
  await fade(1, 0.3);
  player.scripted = false;
  placePlayer(W.lineX + 0.35, LINE_Z1 + TIP_LEAD, -Math.PI / 2);
  player.face(odile.root.position.x, odile.root.position.z);
  faceTo(odile.root, player.root.position.x, player.root.position.z);
  followDefault(true);
  await fade(0, 0.5);
  const tier = score < TIERS.good ? 'good' : score < TIERS.middle ? 'middle' : 'poor';
  await d.say(T.line.tiers[tier]);
  await d.say(T.line.sign.slice(0, 2));
  W.initials.visible = true;
  audio.scrape({ volume: 0.12 });
  mood.focusOn(W.initials, { slot: 0, offsetY: 0, strength: 1, decay: 0.2, floor: 0.7, radius: 0.3 });
  d.hope(0.9);
  await d.say(T.line.sign.slice(2));

  // Ines's photo.
  {
    const p = player.root.position;
    const spot = clampToBounds(bounds, p.x + 2.4, p.z + 0.3);
    await walkNpc(ines, spot, { speed: 1.4, face: -Math.PI / 2, max: 6 });
    faceTo(ines.root, p.x, p.z);
    player.face(ines.root.position.x, ines.root.position.z);
    await d.say(T.line.photo);
    await d.wait(0.4);
    mood.flash(0.5);
    audio.tick({ volume: 0.45 });
    await d.wait(0.9);
  }
  // Everyone back where they were (the street camera looks the other way).
  homes.forEach((n) => {
    n.char.root.position.set(n.pos[0], 0, n.pos[1]);
    n.char.root.rotation.y = n.rot;
    n.char.play('idle', 0.3);
  });

  // ==================================================================== The run club passes
  {
    const p = player.root.position;
    clubSpot = clampToBounds(bounds, p.x + 1.15, p.z + 0.4);
    const lanes = [-0.6, 0.3, -1.3, 1.0, -0.1];
    runners.forEach((r, i) => {
      r.x = r === bastien ? -0.4 : lanes[i];
      r.z = p.z + 13 + i * 1.3 + (r === bastien ? -1 : 0);
      r.state = 'run';
      r.c.root.visible = true;
      r.c.setOpacity?.(1);
      r.c.root.position.set(r.x, 0, r.z);
    });
    player.frozen = true;
    let t = 0;
    const r1 = await d.until((dt) => {
      t += dt;
      return bastien.state === 'spot' || t > 8;
    });
    if (r1 === 'skipped' || bastien.state !== 'spot') bastien.state = 'spot';
    player.face(clubSpot[0], clubSpot[1]);
    await d.say(T.club.greet);
    player.frozen = true;
    await pressE(T.prompts.wave);
    setArm('wave', true);
    d.after(1.7, () => setArm('wave', false));
    await d.wait(1.1);
    await d.say(T.club.after);
    player.frozen = true;
    bastien.leaving = true;
    bastien.state = 'run';
    bastien.x = Math.max(-1.2, Math.min(1.2, bastien.x + 2));
    t = 0;
    await d.until((dt) => {
      t += dt;
      return bastien.state === 'gone' || t > 7;
    });
    for (const r of runners) {
      r.state = 'gone';
      r.c.root.visible = false;
    }
    player.frozen = false;
    await d.say(T.club.afterThoughts);
  }

  // ==================================================================== The boot
  {
    faceTo(odile.root, player.root.position.x, player.root.position.z);
    player.face(odile.root.position.x, odile.root.position.z);
    await d.say(T.boot.ask);
    walkNpc(odile, [chX, chZ], { speed: 1.0, face: chairFacing, max: 9, gated: false }).then(() => {
      odile.root.position.set(chX, 0, chZ);
      odile.root.rotation.y = chairFacing;
      sit(odile, true);
    });
    ui.objective(T.objectives.boot);
    const [bx, bz] = S.bench;
    // S.bench is where you stand to use it; S.seat is on the planks (Ch2 contract).
    const [sx, sz] = S.seat || [bx - 0.77, bz];
    hotspots.add({
      id: 'bench',
      pos: [bx + 0.5, bz],
      radius: 1.7,
      prompt: T.prompts.bench,
      required: true,
      onInteract: async () => {
        player.frozen = true;
        player.teleport(sx, sz, Math.PI / 2);
        await d.gate(player.setPose('sit', 0.7));
      },
    });
    await d.interact('bench');
    ui.objective(null);
    player.frozen = true;
    // Closer on the leg for the straps.
    await d.gate(cam.tween({ pos: [sx + 2.3, 1.25, sz + 1.9], look: [sx + 0.45, 0.45, sz], fov: 48 }, 1.2));
    await pressE(T.prompts.strap);
    for (let i = 0; i < 3; i++) d.after(i * 0.3, () => audio.rip());
    await d.wait(1);
    player.setBoot(false);
    player.limp = 0.3;
    player.footsteps = 'concrete';
    d.hope(0.95);
    await d.say(T.boot.light);
    await d.gate(player.setPose('stand', 0.8));
    placePlayer(bx + 0.8, bz, Math.PI / 2);
    followDefault(false);
    player.frozen = false;
    player.face(chX, chZ);
    await d.say(T.boot.walk);
  }

  // ==================================================================== Golden hour: the walk home
  await fade(1, 1.4);
  W.setGolden();
  mood.applyPreset('golden');
  d.hope(1.0, 0);
  odile.root.visible = false;
  for (const n of homes) n.char.root.visible = false;
  mood.clearFocus(); // hope 1.0: the whole street holds colour now
  player.teleport(0, 8, Math.PI);
  player.pain = 0;
  player.painCap = 0.9;
  player.showPain = false;
  player.canJog = true;
  player.limp = 0.3;
  player.frozen = false;
  followDefault(true);
  ui.objective(T.objectives.walk);
  const WH = T.walk.watchHud;
  ui.watch(WH.face, { label: WH.label, lap: WH.lap ?? null, tick: false });
  // Sami waits behind the start, back on the bike.
  sc.path = [];
  sc.loop = null;
  rig.position.set(1.7, 0, 15);
  rig.rotation.y = Math.PI;
  mount(true);
  await d.wait(0.3);
  await fade(0, 1.6);

  // Sami rides past; barks in order as he passes.
  let samiBarks = 0;
  d.after(2.2, () => {
    rideTo([[1.7, -30], [2.4, -43.5]], 4.2).then((r) => {
      if (r === 'arrived') parkAt(2.4, -43.8, Math.PI);
    });
  });
  // Per-chapter first jog, the jog-then-stop line, the mural and the race bike.
  let jogged = false;
  let jogT = 0;
  let stoppedSaid = false;
  player.on('jog', () => {
    if (!jogged) {
      jogged = true;
      thoughtSoon(T.walk.firstJog, 3);
    }
  });
  let muralSaid = false;
  let bikeSaid = false;
  let watchObjective = false;
  // The face tells the truth: RUN distance counts only while he jogs (a few metres, if any).
  let runM = 0;
  let watchOn = true;
  let lastFace = WH.face;
  const lastPos = player.root.position.clone();
  world.onUpdate((dt) => {
    const p = player.root.position;
    const step = Math.hypot(p.x - lastPos.x, p.z - lastPos.z);
    lastPos.copy(p);
    if (player.jogging && step < 0.5) runM += step; // a teleport is not a run
    if (watchOn && runM >= 5) {
      const face = `${(runM / 1000).toFixed(2)} km`;
      if (face !== lastFace) {
        lastFace = face;
        ui.watch(face, { tick: false });
      }
    }
    // Sami's barks.
    if (samiBarks === 0 && sc.riding && rig.position.z < p.z + 1.5 && rig.position.z > p.z - 6) {
      samiBarks = 1;
      const B0 = T.walk.sami;
      bark(B0[0].text, B0[0].who, 2.3);
      d.after(2.5, () => bark(B0[1].text, B0[1].who, 2.0));
      d.after(4.7, () => bark(B0[2].text, B0[2].who, 2.0));
    }
    if (player.jogging) jogT += dt;
    else {
      if (!stoppedSaid && jogT >= 1.5 && !player.frozen && !player.locked) {
        stoppedSaid = true;
        thoughtSoon(T.walk.stopped, 3.8);
      }
      jogT = 0;
    }
    if (!muralSaid && p.z < -22) {
      muralSaid = true;
      thoughtSoon(T.walk.mural, 3.8);
    }
    if (!bikeSaid && p.z < -44) {
      bikeSaid = true;
      thoughtSoon(T.walk.bike, 3.8);
    }
    if (!watchObjective && p.z < -43) {
      watchObjective = true;
      ui.objective(T.objectives.watch);
    }
  });

  // The nail above the bench.
  const nailPoint = W.shop.nailPoint;
  hotspots.add({
    id: 'nail',
    pos: S.nail,
    radius: 1.45,
    prompt: T.prompts.watch,
    required: true,
    onInteract: async () => {
      player.frozen = true;
      player.face(nailPoint.x, nailPoint.z);
      await d.gate(
        cam.tween({ pos: [nailPoint.x + 1.05, 1.85, nailPoint.z + 2.05], look: [nailPoint.x - 0.15, 1.45, nailPoint.z], fov: 46 }, 1.3),
      );
      setArm('reach', true, nailPoint);
      await d.wait(0.7);
      await d.say(T.walk.outline);
      W.shop.watch.visible = true;
      audio.tick({ volume: 0.3 });
      watchOn = false;
      ui.watch(null);
      setArm('reach', false);
      await d.wait(0.9);
    },
  });
  await d.interact('nail');
  ui.objective(null);
  W.shop.watch.visible = true;
  watchOn = false;
  ui.watch(null);
  mood.focusOn(W.shop.watch, { slot: 1, offsetY: 0, strength: 1, decay: 0.2, floor: 0.5, radius: 0.3 });

  // The last STRIDE menu: the only one where Rest means rest.
  const menu = T.walk.restMenu;
  const pick = await d.choose(menu);
  const opt = menu.options[typeof pick === 'number' ? pick : 0];
  if (opt?.reply) await d.think(opt.reply);

  // The notebook finale.
  ui.notebook.open(0);
  await d.wait(0.6);
  await d.gate(ui.notebook.strike(N.ride, false));
  await d.gate(ui.notebook.strike(N.run, false));
  await d.wait(0.3);
  await d.gate(ui.notebook.annotate(N.run, L.notebook.someSundays));
  await d.wait(0.4);
  await d.gate(ui.notebook.add(N.rest));
  await d.wait(2.2);
  ui.notebook.dock();

  // Crane up and back over the street, the mural in the low sun.
  input.enabled = false;
  player.frozen = true;
  ui.letterbox(true);
  const crane = cam.tween({ pos: [2.2, 13.5, -40.5], look: [-3.4, 2.2, -15], fov: 52 }, 8);
  await d.say(T.walk.crane);
  await d.gate(crane);
  await d.wait(0.8);
  await fade(1, 2.4, '#ffffff');
  ui.letterbox(false);
}

// =============================================================================================
// Short version (only if the scene build failed and the Director used its fallback ground)
// =============================================================================================

async function shortRun(ctx, d) {
  const { ui, player, mood, audio } = ctx;
  await d.say(T.opening);
  await d.gate(ui.notebook.add(N.teach, { hand: 'sami' }));
  d.hope(0.9);
  await d.say(T.boot.ask);
  for (let i = 0; i < 3; i++) d.after(i * 0.3, () => audio.rip());
  await d.wait(1);
  player.setBoot(false);
  player.limp = 0.3;
  player.footsteps = 'concrete';
  await d.say(T.boot.light);
  mood.applyPreset('golden', { blend: 2 });
  d.hope(1.0);
  await d.say(T.walk.outline);
  ui.watch(null);
  const menu = T.walk.restMenu;
  const pick = await d.choose(menu);
  const opt = menu.options[typeof pick === 'number' ? pick : 0];
  if (opt?.reply) await d.think(opt.reply);
  ui.notebook.open(0);
  await d.gate(ui.notebook.strike(N.ride, false));
  await d.gate(ui.notebook.strike(N.run, false));
  await d.gate(ui.notebook.annotate(N.run, L.notebook.someSundays));
  await d.gate(ui.notebook.add(N.rest));
  await d.wait(2);
  ui.notebook.dock();
  await d.say(T.walk.crane);
  await d.gate(ui.fade(1, 2, '#ffffff'));
}
