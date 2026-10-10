import * as THREE from 'three';
import { L } from './script.js';
import { makeSteer } from './minigames.js';
import { PRESETS } from '../render/Mood.js';
import { buildScene5, aimBone, clampToBounds, LINE_Z0, LINE_Z1, LINE_Y } from '../world/scenes/scene5.js';
import { remember, joWarmth, WARMTH_KEYS } from './memory.js';
import { hugoPanelBeat, linePreroll, wetRibbon, wetPanels } from './ch7panel.js';
import { setupJobs } from './ch7jobs.js';
import { duckUnderVoice, speaking } from './crafts/sound.js';

// Ch7 « Le Mur » (Ch5 before Revision 4; text keys ch7.*): Rue des Tanneurs, Week 12. Day, then golden hour.
// See docs/DESIGN.md (Ch5) and docs/SCRIPT-R4.md §8.
//
// Beats: opening (Find Odile) -> Teach (Sami's chain, "Teech.") -> THE LINE (20 m in 16 s, W/S
// steady the brush) -> tier + sign + Ines's photo -> the run club passes ([E] Wave, Bastien's shin)
// -> the boot comes off on the bench ([E] Strap) -> golden-hour walk home (Sami rides past, jog/stop
// line, mural and bike thoughts) -> the watch on its nail -> the last STRIDE menu -> the notebook
// finale -> crane-up -> white.
//
// Revision 4 (docs/SCRIPT-R4.md §8): the « Semaines 10 et 11. » card and thought before « Semaine 12. »; M. Durand
// in a chair beside Odile's (`durand.meet` after the opening: Odile knew); two new optional hotspots (M. Durand,
// Jo at her swallow); M. Durand's bark after Teach; Jo's supper after Lou's photo (kiss or tap by joWarmth());
// Jo at ENCRE FINE's door and M. Durand with Sami at CYCLES DURAND, open now, on the walk home. The ending's nine
// cards are story/ending.js. Debug: ?debug=1&warmth=N sets the first N of Jo's flags (warm is >= 3).
//
// Every await goes through the Director (say / until / wait / interact / gate), so debug.skip()
// always progresses. Prompts ([E] Wave, [E] Strap) and the line auto-complete with no input.

const T = L.ch7;
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

// Sound (docs/assets/sfx.md, Ch5 Integration list). Beds: the street by day with the neighbours (0.3)
// and the drying puddles (0.1) until the line; golden-hour birds for the walk home. Sami's freewheel
// follows his bike's speed; the line's brush is a loop that follows the tip; the jobs (ch7jobs.js,
// crafts/*) and the panel (ch7panel.js) play their own recorded cues.
const SOUNDS = [
  'amb_street_day', 'amb_drips', 'amb_golden_birds', 'chain_drop', 'chain_on', 'brush_stroke', 'creak_wood', 'creak_wood_alt', 'brush_wall_loop',
  'boot_step_wet', 'body_thud', 'camera_shutter', 'club_pass', 'run_step', 'velcro_rip', 'bike_bell', 'freewheel_tick',
  'freewheel_coastdown', 'breath_tired', 'spoke_key', 'brake_rub', 'radio_static', 'radio_tune_sweep',
  'shutter_runner_scrape', 'shutter_roll_up',
  // R4 (.cache/r4/sfx-names.md): M. Durand's bike at the open shop, a wheel turned by hand; Jo's tap on the shoulder
  'pawl_click', 'cloth_rustle',
  // the notebook (UI.js): docs/assets/sfx.md, Global
  'notebook_open', 'page_flip', 'notebook_close', 'pencil_write', 'pencil_erase', 'pencil_erase_alt',
];
const STREET = { name: 'amb_street_day', volume: 0.3 };
const DRIPS = { name: 'amb_drips', volume: 0.1 };
const BIRDS = { name: 'amb_golden_birds', volume: 0.3 };

// Light. The day part is late afternoon after the rain: the sky clearing, a warm sun low over the
// right-hand roofs (behind the camera), long shadows across the street and the mural wall in
// raking light. The final walk is golden hour proper: the sun at the far end of the street, the
// walk home straight into it. Both spread the art-bible presets (look.js LIGHTING via Mood).
const DAY_LIGHT = {
  ...PRESETS.wall,
  env: 'golden_street',
  envAlign: true,
  envIntensity: 0.25,
  envIntensityHope: 0.3,
  skyTop: '#71889e',
  skyBottom: '#cfc2a8',
  skyTopHope: '#5f87b2',
  skyBottomHope: '#e9c991',
  fogColor: '#bdb6a6',
  fogColorHope: '#dcc39a',
  fogDensity: 0.007,
  fogDensityHope: 0.004,
  heightFog: 0.008,
  hemiSky: '#9fb0c4',
  hemiGround: '#54463a',
  hemiIntensity: 0.6,
  sunColor: '#ffcf94',
  sunIntensity: 5.5,
  sunDir: [0.5, 0.42, 0.76],
  fillIntensity: 1.4,
  exposure: 1.1,
  contrast: 1.06,
  splitShadow: '#53627a',
  splitHigh: '#f3d29e',
  split: 0.24,
};
const GOLDEN_LIGHT = {
  sunColor: '#ffb060',
  sunIntensity: 5.5,
  sunDir: [0.3, 0.2, -0.93],
  hemiIntensity: 0.42,
  hemiSky: '#c9b496',
  hemiGround: '#4a3628',
  fogDensity: 0.004,
  heightFog: 0.01,
  contrast: 1.08,
  envIntensity: 0.18,
  exposure: 1.05,
};

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

// The neighbours' hotspot ids (old R3 ids) -> the item system's people (refusal and gift lines, L.items).
const PERSON = { benali: 'benali', ines: 'lou', marco: 'gerard' };

const faceTo = (obj, x, z) => {
  obj.rotation.y = Math.atan2(x - obj.position.x, z - obj.position.z);
};

export default {
  id: 'wall',
  get title() {
    return T.title;
  },
  hope: 0.68, // the end of Ch6 (SCRIPT-R4 §8)
  preset: DAY_LIGHT,
  // No chapter objective: « Trouver Odile. » showed over the week cards (PT57 #16). run() sets it after them.
  music: { name: 'piano', volume: 0.36, fade: 3 },
  ambience: [],
  sounds: SOUNDS,
  camera: { offset: DEFAULT_CAM.offset, look: DEFAULT_CAM.look, fov: 55, lerp: 6 },
  player: { spawn: [0, -16], facing: Math.PI, boot: true, limp: 0.7, painRate: 1 / 1.5, footsteps: 'boot' },
  build: (ctx) => buildScene5(ctx),

  async run(ctx, d) {
    ctx.player.firstStumbleDone = true;
    debugWarmth();
    // Weeks 10 and 11 (SCRIPT-R4 §8): the card, then one thought over black; then « Semaine 12. » (moved from Ch4).
    {
      const card = d.card(T.cards.weeks10, { big: true });
      ctx.ui.fade(1, 0); // under the card: the thought stays on black
      await card;
      await d.say(T.weeks10);
      await d.card(T.cards.week12, { big: true });
      await d.gate(ctx.ui.fade(0, 0.8), () => {
        ctx.ui.fade(0, 0);
        return false;
      });
      ctx.ui.objective(T.objectives.start);
    }
    // The boot's clump on the street is boot_step_wet + body_thud (docs/assets/sfx.md, Global), as in Ch2.
    ctx.audio.surface = 'street';
    const W = ctx.world.current;
    if (!W?.cast || !W?.line) {
      console.warn('[hairline] ch7: scene extras missing (build fallback); running the short version');
      await shortRun(ctx, d);
      return;
    }
    await fullRun(ctx, d, W);
  },
};

/** Debug only: ?debug=1&warmth=N sets the first N warmth flags (SCRIPT-R4 §8.9: ?warmth=5 forces warm). */
function debugWarmth() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('debug') !== '1' || !q.has('warmth')) return;
    const n = Math.max(0, Math.min(WARMTH_KEYS.length, Number(q.get('warmth')) | 0));
    WARMTH_KEYS.forEach((k, i) => remember(k, i < n));
  } catch {
    /* no location (tests) */
  }
}

// =============================================================================================
// The chapter
// =============================================================================================

async function fullRun(ctx, d, W) {
  const { ui, player, hotspots, mood, audio, cam, input, runner, world, engine } = ctx;
  const S = W.spots;
  const { odile, sami, neighbours, club } = W.cast;
  const bounds = W.bounds;
  // R4 (scene5/r4wall.js): null if the cast failed to build; every beat below still plays its lines.
  const durand = W.durand;
  const jo = W.jo;
  const joHome = S.joPanel ? [...S.joPanel] : null;
  const joHomeRot = jo ? jo.root.rotation.y : 0;
  let golden = false;
  let joWalk = null; // Jo's walk back to her shop after the supper (stopped at golden hour)

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
    char.play(on ? 'sit_idle' : 'idle', 0.3);
    char.model.position.y = 0;
  };
  // Odile's chair (scene5/wallside): the seat point and the way it faces (the mural).
  const chair = W.chair || { seat: new THREE.Vector3(S.odileChair[0], 0, S.odileChair[1]), facing: 0 };
  const seatOdile = () => {
    odile.root.position.copy(chair.seat);
    odile.root.rotation.y = chair.facing;
    sit(odile, true);
  };
  // Kerbs: everyone on foot follows the sidewalk height (scene5/street; 0 when scene2 has its own).
  const groundAt = W.groundAt || (() => 0);
  audio.ambience(STREET.name, true, { volume: STREET.volume, fade: 3 });
  audio.ambience(DRIPS.name, true, { volume: DRIPS.volume, fade: 3 });
  const walkers = [player.root, ...club.map((c) => c.root)];
  world.onUpdate((_dt, raw) => {
    const k = Math.min(1, raw * 14);
    for (const r of walkers) r.position.y += (groundAt(r.position.x, r.position.z) - r.position.y) * k;
  });
  const surfaceAt = W.surfaceAt || groundAt;
  /** A neighbour back in their home pose (clip, hand prop). */
  const homePose = (n) => {
    n.char.root.position.set(n.pos[0], n.y ?? surfaceAt(n.pos[0], n.pos[1]), n.pos[1]);
    n.char.root.rotation.y = n.rot;
    n.char.play(n.clip || 'idle', 0.3);
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
  const thoughtSoon = (text, secs = 3.6, who = null) => queue.push({ text, secs, who });
  /** A bark ({who, text}) that waits its turn behind the queued thoughts. */
  const barkSoon = (line, secs = 3.2) => thoughtSoon(line.text, secs, line.who);
  world.onUpdate(() => {
    if (queue.length && engine.now > busyUntil && !ui.modal) {
      const q = queue.shift();
      bark(q.text, q.who, q.secs);
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
  let freewheel = null;
  let fwHeard = false;
  // The 'ride' seat sits a full-size saddle at model y 0.43; Sami's frame is scaled down to a kid's.
  const bikeK = bike.userData?.kidScale ?? 1;
  const mount = (on) => {
    sc.riding = on;
    if (on) {
      sami.play('ride', 0.2);
      sami.root.position.set(0, 0, -0.14 * bikeK);
      sami.root.rotation.y = 0;
      sami.model.position.y = 0.43 - (1 - bikeK) * 0.93;
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
    if (sc.v > 0.01) for (const wh of wheels) wh.rotation.x += (sc.v * dt) / (R * bikeK);
    // Hands on the bars, feet on the pedals (after the mixers).
    if (sc.riding) W.rider?.update(dt, sc.v / bikeK, 1);
    // His freewheel, a point source on the bike: gain and rate from his speed.
    if (!freewheel && sc.v > 0.2 && audio.loopSfx) freewheel = audio.loopSfx('freewheel_tick', { volume: 0, bus: 'fx', pos: rig, ref: 1.5, fade: 0.1 });
    const fv = 0.2 * THREE.MathUtils.clamp(sc.v / 3, 0, 1) * (speaking(ctx) ? 0.6 : 1);
    freewheel?.set(fv, THREE.MathUtils.clamp(0.5 + sc.v * 0.25, 0.5, 1.5), 0.15);
    if (freewheel && !fwHeard && fv > 0.1) {
      fwHeard = true; // debug log: each time his ticking comes up
      audio.logEvent?.('loopOn', 'freewheel_tick', { gain: +fv.toFixed(3), speed: +sc.v.toFixed(2), who: 'sami' });
    } else if (fwHeard && fv < 0.03) fwHeard = false;
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
        if (a) a.timeScale = r.c.strideRate('run', r.v); // cadence from ground speed: planted feet
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
  const chairFacing = chair.facing;
  seatOdile();
  // The things he and Sami made hold a little colour of their own from the start: the trued bike
  // (slot 2) and the OPEN sign over the workshop (slot 3). Slots 0 and 1 are the line and the watch.
  mood.focusOn(bike, { slot: 2, strength: 0.7, decay: 0.3, floor: 0.45, offsetY: 0.55, radius: 0.16 });
  if (W.shop?.openSign) mood.focusOn(W.shop.openSign, { slot: 3, strength: 0.7, decay: 0.3, floor: 0.45, offsetY: 0, radius: 0.12 });
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
    c.play('talk', 0.3);
    await d.say(lines);
    c.root.rotation.y = rot;
    c.play(n.clip || 'idle', 0.3);
  };
  const optional = [];
  const addOptional = (o) => {
    hotspots.add({ radius: 1.5, ...o, enabled: () => roam });
    optional.push(o.id);
  };
  for (const n of homes) {
    if (!n.id || !T[n.id]) continue;
    addOptional({ id: n.id, pos: n.pos, prompt: T.prompts[n.id] ?? T.prompts.talk ?? null, person: PERSON[n.id], onInteract: talk(n, T[n.id]) });
  }
  addOptional({ id: 'shopCard', pos: S.shop, prompt: T.prompts.shopCard, onInteract: () => d.say(T.shopCard) });
  // R4: M. Durand in his chair, Jo at her swallow (SCRIPT-R4 §8, optional; prompts « Parler »).
  if (S.durandChair) {
    addOptional({
      id: 'durandPanel',
      pos: S.durandChair,
      radius: 1.2,
      prompt: T.prompts.durandPanel,
      person: 'durand',
      onInteract: async () => {
        if (durand) player.face(durand.root.position.x, durand.root.position.z);
        durand?.play('sit_talk', 0.3);
        await d.say(T.durand.panel);
        durand?.play('sit_idle', 0.4);
      },
    });
  }
  if (joHome) {
    addOptional({
      id: 'joPanel',
      pos: joHome,
      radius: 1.4,
      prompt: T.prompts.joPanel,
      person: 'jo',
      onInteract: async () => {
        if (!jo) return d.say(T.jo.panel);
        const p = player.root.position;
        faceTo(jo.root, p.x, p.z);
        player.face(jo.root.position.x, jo.root.position.z);
        jo.play('talk', 0.3);
        await d.say(T.jo.panel.slice(0, 3));
        jo.play('idle', 0.3); // arms crossed while he answers
        await d.say(T.jo.panel.slice(3));
        jo.root.rotation.y = joHomeRot;
      },
    });
  }
  addOptional({
    id: 'boltHoles',
    pos: [W.wallX + 1.3, S.boltHoles[1]],
    prompt: T.prompts.boltHoles,
    onInteract: () => d.say(T.boltHoles),
  });
  let jobs = null; // R3.8: the street jobs, open from 'meet' to the line
  const dropOptional = () => {
    roam = false;
    for (const id of optional) hotspots.remove(id);
    jobs?.close();
  };

  // R4: Jo's supper (SCRIPT-R4 §8, §11.2 beat 9), after Lou's photo. She comes in from behind the camera to his
  // elbow, writes « Cuisiner. (en cours) » in his notebook, then the kiss on the cheek (warm) or a tap on the
  // shoulder (cool), and « Samedi, sept heures. »
  const joSupper = async () => {
    const SUP = T.jo.supper;
    const p = player.root.position;
    player.frozen = true;
    if (jo) {
      const at = clampToBounds(bounds, p.x + 0.85, p.z - 0.55);
      jo.root.visible = true;
      jo.root.position.set(THREE.MathUtils.clamp(p.x + 2.2, -3.2, 3.2), 0, p.z + 3.2);
      await walkNpc(jo, at, { speed: 1.35, max: 3.5 });
      faceTo(jo.root, p.x, p.z);
      jo.play('talk', 0.3);
    }
    player.face(jo ? jo.root.position.x : p.x + 1, jo ? jo.root.position.z : p.z);
    await d.say(SUP.ask);
    // She writes the whole line in his notebook, in her hand.
    jo?.play('idle', 0.3);
    ui.notebook.open(4);
    await d.gate(ui.notebook.add(N.cook, { hand: 'jo', note: L.notebook.notes.learning }));
    await d.wait(0.5);
    if (joWarmth() >= 3) {
      jo?.play('reach', 0.2, { once: true });
      await d.wait(0.35);
      await d.say(SUP.warm);
    } else {
      jo?.play('reach', 0.2, { once: true });
      d.after(0.3, () => audio.sfx('cloth_rustle', { volume: 0.3, rate: 0.9, pos: player.root, ref: 2 }));
      await d.wait(0.35);
      await d.say(SUP.cool);
    }
    jo?.play('talk', 0.3);
    await d.say(SUP.bye);
    if (jo) {
      // Back toward her shop, round Odile (waiting at the kebab end), out of the run club's way.
      const door = S.joDoor || [-4.8, -40.6];
      // Her own walker (not walkNpc): the golden-hour staging cancels it, so no late snap moves her off her door.
      const hop = async (to, max) => {
        if (golden) return;
        const h = runner.walkTo(jo, to, { speed: 1.25 });
        joWalk = h;
        await Promise.race([Promise.resolve(h), engine.wait(max)]);
        h.stop?.();
        if (!golden) jo.root.position.set(to[0], 0, to[1]);
      };
      hop([-2.4, -33.2], 5)
        .then(() => hop([-2.9, door[1]], 7))
        .then(() => hop([door[0] + 0.2, door[1]], 4))
        .then(() => {
          if (!golden) jo.root.visible = false; // in her shop until the walk home
        });
    }
    player.frozen = false;
  };

  // ==================================================================== opening: Find Odile
  // R4: M. Durand, then « Tu savais ? » (SCRIPT-R4 §8 `durand.meet`, §0.4.7). On the stage line Odile points her
  // chin at his panel: the camera looks up the wall at it, then back.
  const durandMeet = async () => {
    const M = T.durand.meet;
    const stageAt = M.findIndex((l) => l.who == null);
    player.frozen = true; // between the lines too (the cut up the wall)
    durand?.play('sit_talk', 0.3);
    await d.say(M.slice(0, stageAt));
    const panel = W.panelOf?.('durand');
    if (panel?.mesh) {
      // Across the pavement and up the wall at it; the key shows its colours for the shot (the line greys the
      // mural again until it passes under: p.set() runs every frame during the line).
      const pz = (panel.z0 + panel.z1) / 2;
      await d.gate(cam.tween({ pos: [-1.2, 1.9, pz - 6.8], look: [W.wallX, panel.mesh.position.y - 0.05, pz], fov: 22 }, 1.1));
      panel.set(0.8);
    }
    durand?.play('sit_idle', 0.4);
    await d.say(M.slice(stageAt, stageAt + 4)); // the stage line, « Albert. Ma clé. », his answer, « …en 1971. »
    if (panel?.mesh) {
      panel.set(0);
      followDefault(false);
    }
    player.face(odile.root.position.x, odile.root.position.z);
    odile.play('sit_talk', 0.3);
    await d.say(M.slice(stageAt + 4));
    odile.play('sit_idle', 0.5);
    player.frozen = false;
  };
  hotspots.add({
    id: 'meet',
    pos: [chX, chZ + 0.4],
    radius: 2.6,
    auto: true,
    marker: true,
    required: true,
    onInteract: async () => {
      player.face(odile.root.position.x, odile.root.position.z);
      odile.play('sit_talk', 0.4);
      await d.say(T.opening);
      odile.play('sit_idle', 0.5);
      await durandMeet();
    },
  });
  await d.interact('meet');
  let taught = false;
  jobs = setupJobs(ctx, d, W, { bark, followDefault, isRoaming: () => roam, taught: () => taught });

  // ==================================================================== Teach
  {
    const p = player.root.position;
    // In the road, clear of Odile's radio crate (x -3.45): their rings must not overlap.
    const stop = [THREE.MathUtils.clamp(p.x + 2.1, -1.5, 3.6), THREE.MathUtils.clamp(p.z - 3.4, -45, -12)];
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
    while (jobs.busy()) await engine.frame(); // his call waits for a job to finish (not gated: skip is the job's)
    // The chain drops, then he calls (the clatter clears before his line).
    audio.sfx('chain_drop', {
      volume: 0.45,
      pos: rig,
      ref: 2,
      fallback: (a) => {
        a.noise({ type: 'highpass', freq: 2600, q: 0.7, dur: 0.08, volume: 0.22 });
        a.tick({ volume: 0.35 });
      },
    });
    await d.wait(0.6);
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
        const { tries } = await d.correct(T.teach.menu);
        remember('teachFirst', tries === 1);
        audio.sfx('chain_on', { volume: 0.45, pos: rig, ref: 2, fallback: (a) => a.tick({ volume: 0.3 }) });
        bike.rotation.z = 0;
        await d.wait(0.9); // the clicks and the clunk as it seats, before "I saw."
        const after = T.teach.after;
        await d.say(after.slice(0, 2)); // "I saw." / "What's this?"
        ui.notebook.open(5);
        await d.say(after.slice(2)); // "A list." / he writes / "You forgot one."
        await d.gate(ui.notebook.add(N.teach, { hand: 'sami' }));
        d.hope(0.75);
      },
    });
    await d.interact('sami');
    taught = true; // the radio and Ines's wheel open now
    // R4: M. Durand approves, if he's close enough to have seen it (6 m).
    let shutterCall = 2.5;
    if (durand && durand.root.position.distanceTo(player.root.position) < 6) {
      d.after(0.5, () => bark(T.teach.durand.text, T.teach.durand.who, 3));
      shutterCall = 4;
    }
    d.after(shutterCall, () => jobs.callShutter());
    // Back on the bike, off to the bike shop window.
    rideTo([[3.4, Math.max(-44, rig.position.z - 1.5)], [3.4, -33.2]], 2.6).then((r) => {
      if (r === 'arrived') parkAt(3.4, -33.2, Math.PI / 2);
    });
  }

  // ==================================================================== The line
  ui.objective(T.objectives.line);
  let ready = false;
  let askedReady = false;
  hotspots.add({
    id: 'odile',
    pos: [chX, chZ],
    radius: 1.9,
    prompt: T.prompts.odile,
    required: true,
    once: false, // "Not yet" leaves it up
    onInteract: async () => {
      player.face(chX, chZ);
      // Once, if a street job is still open: Ready closes them all.
      if (!askedReady && jobs.pending()) {
        askedReady = true;
        if ((await d.choose(T.readyCheck)) === 1) return;
      }
      ready = true;
      await hugoPanelBeat(ctx, d, W, { fade, followDefault }); // R3.7: his own panel first
      player.face(chX, chZ);
      await d.say(T.line.setup);
    },
  });
  while (!ready) await d.interact('odile');
  hotspots.remove('odile');
  dropOptional();

  const line = W.line;
  const steer = makeSteer({ dims: 1, momentum: 0.4, drift: 0.7, driftGrow: 0.03, gain: 1.1, recenter: 0.06 });
  const ines = homes.find((n) => n.id === 'ines')?.char || neighbours[1];
  let preroll = null;
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
      n.char.play(i % 2 ? 'arms_crossed' : 'idle', 0);
    });
    if (W.muralLadder) W.muralLadder.visible = false; // out of the way of the line
    if (jo && joHome) {
      jo.root.position.set(2.9, 0, joHome[1] + 1.2); // across the street with the others (behind the side camera)
      jo.root.rotation.y = -Math.PI / 2;
      jo.play('idle', 0);
    }

    parkAt(3.4, -33.2, Math.PI / 2); // wherever he'd got to, he's at the bike shop window now
    player.scripted = true;
    player.teleport(W.lineX, LINE_Z0 + TIP_LEAD, Math.PI + 0.3);
    H.play('walk', 0.1);
    cam.follow(player.root, { ...LINE_CAM, snap: true });
    cam.fov(50);
    cam.snap();
    preroll = linePreroll(ctx, W); // opens on his panel, then down to the line camera
    line.tip.position.set(line.x, LINE_Y, LINE_Z0);
    line.chalkAt(LINE_Z0);
    setArm('brush', true);
    lineActive = true;
  }
  const ribbon = wetRibbon(ctx, line.ribbon);
  wetPanels(ctx, W.panels || []);
  audio.ambience(DRIPS.name, false, { fade: 2 }); // the puddles have dried
  await d.wait(0.25);
  await fade(0, 0.6);
  if (preroll) {
    H.play('idle', 0.2);
    await preroll(d, () => cam.follow(player.root, { ...LINE_CAM }));
  }
  ui.prompt(L.hints.steerLine);
  d.hope(0.84, 16);
  let stepT = 0;
  let stepBad = false;
  // The brush on the wall: one continuous loop following the tip (gain 0.25 x tip speed, rate
  // 0.9-1.1 with it). Without the file: the procedural scrape every 0.4-0.6 s.
  let strokeT = 0;
  let lastTipY = null;
  let tipK = 1;
  const brush = audio.sfxBank?.has('brush_wall_loop') ? audio.loopSfx('brush_wall_loop', { volume: 0, bus: 'fx', fade: 0.3 }) : null;
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
    if (a) a.timeScale = H.strideRate('walk', LINE_SPEED);
    // Boot steps (the Player is scripted, so it doesn't play them) and the brush on the wall.
    stepT -= dt;
    if (stepT <= 0) {
      stepT = stepBad ? 0.52 : 0.44;
      stepBad = !stepBad;
      if (stepBad) {
        audio.sfx('boot_step_wet', { volume: 0.45, bus: 'bus', jitter: 0.04 }); // fallback: the slowed concrete step
        audio.sfx('body_thud', { volume: 0.12, bus: 'bus', lowpass: 900, jitter: 0.04 });
      } else audio.footstep('concrete', { volume: 0.3 });
    }
    if (dt > 0) {
      const vy = lastTipY == null ? 0 : Math.abs(y - lastTipY) / dt;
      lastTipY = y;
      tipK += (Math.hypot(LINE_SPEED, vy * 4) / LINE_SPEED - tipK) * (1 - Math.exp(-10 * dt));
    }
    if (brush) {
      brush.set(0.25 * Math.min(1.2, tipK) * (speaking(ctx) ? 0.6 : 1), THREE.MathUtils.clamp(0.9 + (tipK - 1) * 0.5 + 0.05, 0.9, 1.1), 0.08);
    } else if ((strokeT -= dt) <= 0) {
      strokeT = 0.4 + Math.random() * 0.2;
      audio.scrape({ volume: 0.06 });
    }
    return tipZ <= LINE_Z1 + 1e-3;
  });
  brush?.stop(0.35);
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
  ribbon.dry();
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
  audio.sfx('brush_stroke', { volume: 0.35, fallback: (a) => a.scrape({ volume: 0.12 }) });
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
    ines.play('hold_can', 0.3);
    await d.say(T.line.photo);
    ines.play('reach', 0.25, { once: true });
    await d.wait(0.7);
    audio.sfx('camera_shutter', { volume: 0.5, pos: ines.root, ref: 2 }); // 50 ms ahead of the flash (fallback: tick)
    await d.wait(0.05);
    mood.flash(0.5);
    await d.wait(0.9);
  }
  // Everyone back where they were (the street camera looks the other way).
  homes.forEach((n) => homePose(n));
  if (W.muralLadder) W.muralLadder.visible = true;

  // ==================================================================== R4: Jo's supper (SCRIPT-R4 §8 `jo.supper`)
  await joSupper();

  // ==================================================================== The run club passes
  {

    const p = player.root.position;
    clubSpot = clampToBounds(bounds, p.x + 1.15, p.z + 0.4);
    // Anyone standing where Bastien will jog on the spot steps out of the way (down the street, out
    // of the camera's way).
    for (const n of homes) {
      const r = n.char.root.position;
      if (!n.char.root.visible || Math.hypot(r.x - clubSpot[0], r.z - clubSpot[1]) > 1.3) continue;
      r.set(clubSpot[0] + 1.3, 0, clubSpot[1] - 1.9);
      faceTo(n.char.root, p.x, p.z);
    }
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
    // The pass: the recorded group (approach peak ~10 s into the file) lined up so its loudest moment is
    // the group going by Hugo (~3.8 s); panned with the pack, dipped under the voices. Bastien's own
    // steps on the spot are run_step at 0.2.
    const pack = new THREE.Vector3();
    const packPos = () => {
      let n = 0;
      pack.set(0, 0, 0);
      for (const r of runners) {
        if (r === bastien || r.state === 'off' || r.state === 'gone') continue;
        pack.x += r.x;
        pack.z += r.z;
        n++;
      }
      if (!n) return null;
      pack.multiplyScalar(1 / n);
      pack.y = 1;
      return pack;
    };
    const passing = audio.sfx('club_pass', { volume: 0.5, bus: 'bus', offset: 6.2, jitter: 0, pos: packPos, ref: 60, panWidth: 0.8, fallback: false });
    if (passing) duckUnderVoice(ctx, passing, { db: 6 });
    let jogStep = 0;
    const offJog = world.onUpdate((dt) => {
      if (bastien.state !== 'spot') return;
      if ((jogStep -= dt) > 0) return;
      jogStep = 0.6;
      audio.sfx('run_step', { volume: 0.2, bus: 'bus', jitter: 0.06, pos: bastien.c.root, ref: 1.5 });
    });
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
    offJog();
    passing?.stop(1.2);
    player.frozen = false;
    await d.say(T.club.afterThoughts);
  }

  // ==================================================================== The boot
  {
    faceTo(odile.root, player.root.position.x, player.root.position.z);
    player.face(odile.root.position.x, odile.root.position.z);
    await d.say(T.boot.ask);
    walkNpc(odile, [chair.seat.x, chair.seat.z], { speed: 1.0, face: chairFacing, max: 9, gated: false }).then(() => seatOdile());
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
        runner.clear?.();
        seatOdile();
        player.teleport(sx, sz, Math.PI / 2, groundAt(sx, sz));
        await d.gate(player.setPose('sit', 0.7));
      },
    });
    await d.interact('bench');
    ui.objective(null);
    player.frozen = true;
    // Closer on the leg for the straps.
    await d.gate(cam.tween({ pos: [sx + 2.3, 1.25, sz + 1.9], look: [sx + 0.45, 0.45, sz], fov: 48 }, 1.2));
    await pressE(T.prompts.strap);
    // Three straps, 0.3 s apart, one recorded variant each (fallback: rip()); the last rip clears before
    // the line.
    for (let i = 0; i < 3; i++) d.after(i * 0.3, () => audio.sfx('velcro_rip', { volume: 0.5, variant: i }));
    await d.wait(1.45);
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
  audio.ambience(STREET.name, false, { fade: 4 });
  audio.ambience(BIRDS.name, true, { volume: BIRDS.volume, fade: 4 });
  golden = true;
  W.setGolden();
  mood.applyPreset('golden', GOLDEN_LIGHT);
  d.hope(1.0, 0);
  odile.root.visible = false;
  for (const n of homes) n.char.root.visible = false;
  // R4: Jo at ENCRE FINE's door; M. Durand at CYCLES DURAND, open now, where Sami will park.
  if (jo && S.joDoor) {
    joWalk?.stop?.();
    jo.root.position.set(S.joDoor[0], 0, S.joDoor[1]);
    jo.root.rotation.y = Math.PI / 2 - 0.35; // looking up the street, the way he comes
    jo.root.visible = true;
    jo.play('idle', 0);
  }
  if (durand && S.durandShop) {
    durand.model.position.y = 0;
    durand.root.position.set(S.durandShop[0], 0, S.durandShop[1]);
    durand.root.rotation.y = -Math.PI / 2 - 0.5;
    durand.play('idle', 0);
  }
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
  let samiBell = false;
  let breathed = false;
  // R4: he parks at CYCLES DURAND, beside M. Durand (SCRIPT-R4 §8: « Durand and Sami at the open shop »).
  const samiPark = S.samiShop || [2.4, -43.8];
  d.after(2.2, () => {
    rideTo([[1.7, -26], [samiPark[0] - 0.6, samiPark[1] + 3], samiPark], 4.2).then((r) => {
      if (r === 'arrived') parkAt(samiPark[0], samiPark[1], S.samiShop ? Math.PI / 2 : Math.PI);
    });
  });
  // Per-chapter first jog, the jog-then-stop line, the mural and the race bike.
  let jogged = false;
  let jogT = 0;
  let stoppedSaid = false;
  const firstJog = () => {
    if (!jogged) {
      jogged = true;
      thoughtSoon(T.walk.firstJog, 3);
    }
  };
  player.on('jog', firstJog);
  if (player.jogging) firstJog(); // Shift+W held through the fade-in: 'jog' already fired
  let muralSaid = false;
  let bikeSaid = false;
  let shopHeard = false;
  let durandSaid = false;
  let joSaid = false;
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
    // Sami's bell as he comes up behind, then his barks as he passes.
    // (Held a moment while a line is being said, but never past 4 m behind him.)
    if (!samiBell && sc.riding && sc.v > 1 && rig.position.z < p.z + 7 && (!speaking(ctx) || rig.position.z < p.z + 4)) {
      samiBell = true;
      audio.sfx('bike_bell', { volume: 0.35, pos: rig, ref: 2 });
    }
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
      if (!breathed && jogT >= 1.5) {
        breathed = true; // his breath back after the first jog, low
        audio.sfx('breath_tired', { volume: 0.2, bus: 'bus', fallback: false });
      }
      jogT = 0;
    }
    if (!muralSaid && p.z < -22) {
      muralSaid = true;
      thoughtSoon(T.walk.mural, 3.8);
    }
    // R4: the open shop (a wheel turned by hand: the pawl, then the spoke key), M. Durand, then Jo at her door.
    if (!shopHeard && durand && p.z < -27.5) {
      shopHeard = true;
      const at = durand.root;
      for (let i = 0; i < 4; i++) d.after(i * 0.4, () => audio.sfx('pawl_click', { volume: 0.3, jitter: 0.03, pos: at, ref: 3 }));
      d.after(2.2, () => audio.sfx('spoke_key', { volume: 0.25, pos: at, ref: 2.5 }));
    }
    if (!durandSaid && p.z < -32.5) {
      durandSaid = true;
      if (durand) faceTo(durand.root, p.x, p.z);
      barkSoon(T.walk.durand, 3.4);
    }
    if (!joSaid && p.z < -37.2) {
      joSaid = true;
      if (jo) {
        faceTo(jo.root, p.x, p.z);
        jo.play('call_out', 0.3);
        d.after(2.6, () => jo.play('idle', 0.4));
      }
      barkSoon(joWarmth() >= 3 ? T.walk.jo.warm : T.walk.jo.cool, 3);
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
      // The strap and buckle on the nail: the recorded metal latch (watch_hang_nail is too weak a take).
      audio.sfx('spoke_key', { volume: 0.4, variant: 'spoke_key_02', fallback: (a) => a.tick({ volume: 0.3 }) });
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
  // Up and back out of the workshop door, over the street: the mural in the low sun on the left,
  // the line under every panel, No. 14 at the end.
  const crane = cam.tween({ pos: [3.8, 11, -10.5], look: [-5.2, 2.0, -26], fov: 55 }, 8);
  await d.say(T.walk.crane);
  await d.gate(crane);
  await d.wait(0.8);
  audio.ambience(BIRDS.name, false, { fade: 2.6 });
  freewheel?.stop(0.5);
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
  for (let i = 0; i < 3; i++) d.after(i * 0.3, () => audio.sfx('velcro_rip', { volume: 0.5, variant: i }));
  await d.wait(1.45);
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
