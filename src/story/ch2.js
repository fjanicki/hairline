import * as THREE from 'three';
import { L } from './script.js';
import { parseNum } from './i18n.js';
import { buildScene2 } from '../world/scenes/scene2.js';

// Ch2 "Never Stop": Rue des Tanneurs, late evening, rain (docs/DESIGN.md).
// Beats, in order (auto beats are z-thresholds in one sequential chain, each gated on 'play'):
//   start thought -> z < -6 PAUSE buzz + "No." -> z < -24 the run club and Bastien (+ after-lines once he has gone)
//   -> z < -42 the loop line, Odile on the scaffold -> HOLD STILL -> "Name one thing" -> "How far?" -> watch, cut to white.
// Optional hotspots: the ghost sign, the STRIDE billboard, the closed bike shop, the bench (sit / stand).
// The watch is live the whole walk: face = 0.32 km + metres walked; lap = 38:40 -> 41:10 from progress along z.

const T = L.ch2;
const CAM = { offset: [0, 2.6, 4.2], look: [0, 1.1, 0] };
const SPAWN = [0.8, 6];
const PAUSE_Z = -6;
const CLUB_Z = -24;
const ARRIVE_Z = -42;
const FADE_Z = -46; // the club fades out here
const STILL_SECS = 7; // HOLD STILL: seconds of stillness to fill the gauge
const ASSIST_AFTER = 25;
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const parseLap = (s) => {
  const [m, sec] = String(s).split(':').map(Number);
  return (m || 0) * 60 + (sec || 0);
};
const fmtLap = (t) => {
  const s = Math.floor(t);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
/** Shuffled bag: no repeats until every item has been drawn. Shuffles indices, so a language change applies at once. */
function bag(items) {
  let pool = [];
  let last = null;
  return () => {
    if (!pool.length) {
      pool = items.map((_, i) => i).sort(() => Math.random() - 0.5);
      if (pool.length > 1 && pool[pool.length - 1] === last) pool.unshift(pool.pop());
    }
    last = pool.pop();
    return items[last];
  };
}

export default {
  id: 'street',
  get title() {
    return T.title;
  },
  hope: 0.07,
  preset: 'street',
  get objective() {
    return T.objectives.start;
  },
  music: { name: 'contemplation', volume: 0.3 },
  ambience: ['rain'],
  camera: { offset: CAM.offset, look: CAM.look },
  player: { spawn: SPAWN, facing: Math.PI, boot: true, limp: 0.95, painRate: 1 / 0.9, footsteps: 'boot' },
  build: (ctx) => buildScene2(ctx, { variant: 'evening' }),

  async run(ctx, d) {
    const { ui, player, input, cam, hotspots, audio, world, engine } = ctx;
    const S = world.current || {};
    const spots = world.spots || {};
    const shots = S.shots || {};
    const seat = S.seat || { x: -5.32, z: -36.5, facing: Math.PI / 2, standX: -4.8 };
    const offs = [];
    let lock = false; // optional hotspots off during the club and from the arrival on
    const ready = () => d.state === 'play' && !ui.modal && !lock;
    const follow = () => cam.follow(player.root, { offset: CAM.offset, look: CAM.look });

    // ------------------------------------------------------------ the live watch
    const seed = L.watch?.atChapter?.[1] || {};
    const face0 = parseNum(seed.face) || 0.32;
    const lap0 = parseLap(T.lapStart);
    const lap1 = parseLap(T.lapEnd);
    const z0 = player.position.z;
    const prev = player.position.clone();
    let walked = 0;
    let progress = 0;
    let live = true;
    let shown = '';
    const watchFace = () => `${(face0 + walked / 1000).toFixed(2)} km`;
    offs.push(
      world.onUpdate(() => {
        if (!live) return;
        const p = player.position;
        const step = Math.hypot(p.x - prev.x, p.z - prev.z);
        if (step < 0.5) walked += step; // a teleport is not a walk
        prev.copy(p);
        progress = Math.max(progress, clamp((z0 - p.z) / (z0 - ARRIVE_Z), 0, 1));
        const face = watchFace();
        const lap = fmtLap(lap0 + progress * (lap1 - lap0));
        const key = face + lap;
        if (key !== shown) {
          shown = key;
          ui.watch(face, { lap, tick: false });
        }
      }),
    );

    d.after(0.8, () => d.thought(T.start, 5.5));

    // ------------------------------------------------------------ the bench (sit / stand)
    let seated = false;
    let benchSaid = false;
    const sit = async () => {
      seated = true;
      player.teleport(seat.x, seat.z, seat.facing);
      await d.gate(player.setPose('sit', 0.7));
      if (!benchSaid) {
        benchSaid = true;
        await d.say(T.bench);
      }
    };
    const standUp = async (instant = false) => {
      if (!seated) return;
      seated = false;
      const sp = hotspots.get('bench');
      if (sp) sp.prompt = T.prompts.bench;
      if (instant) player.setPose('stand', 0);
      else await d.gate(player.setPose('stand', 0.6));
      player.teleport(seat.standX, seat.z, Math.PI);
    };
    offs.push(
      world.onUpdate((dt) => {
        if (seated) player.pain = Math.max(0, player.pain - 1.6 * dt); // a sit drains it fast
      }),
    );

    // ------------------------------------------------------------ optional hotspots
    const look = (shot, lines) =>
      d.cinematic(
        async () => {
          if (shot) await d.gate(cam.tween(shot, 1.1));
          await d.say(lines);
          follow();
        },
        { letterbox: false },
      );
    const ghostLook = () => {
      // Hand-painted letters: a breath of their old ochre while he reads them, fading after.
      if (S.signs?.ghost) ctx.mood.focusOn(S.signs.ghost, { slot: 3, strength: 0.6, decay: 0.08, floor: 0, offsetY: 0, radius: 0.3 });
      return look(shots.ghost, T.ghost);
    };
    if (spots.ghost) hotspots.add({ id: 'ghost', pos: spots.ghost, radius: 2.3, prompt: T.prompts.ghost, enabled: () => !lock, onInteract: ghostLook });
    if (spots.billboard) hotspots.add({ id: 'billboard', pos: spots.billboard, radius: 2.5, prompt: T.prompts.billboard, enabled: () => !lock, onInteract: () => look(shots.billboard, T.billboard) });
    if (spots.shop) hotspots.add({ id: 'shop', pos: spots.shop, radius: 2.2, prompt: T.prompts.shop, enabled: () => !lock, onInteract: () => look(shots.shop, T.shop) });
    if (spots.bench) {
      hotspots.add({
        id: 'bench',
        pos: spots.bench,
        radius: 1.4,
        prompt: T.prompts.bench,
        once: false,
        enabled: () => !lock,
        onInteract: async (spot) => {
          if (seated) await standUp();
          else {
            spot.prompt = T.prompts.stand;
            await sit();
          }
        },
      });
    }

    /** After a skipped threshold: put Hugo just past it (standing), so the rest stays consistent. */
    const jumpTo = (z) => {
      if (seated) standUp(true);
      player.setPose('stand', 0);
      player.teleport(clamp(player.position.x, -4.6, 4.6), Math.min(player.position.z, z), Math.PI);
      prev.copy(player.position);
      cam.snap();
    };

    // ------------------------------------------------------------ z < -6: PAUSE ACTIVITY?
    let r = await d.until(() => ready() && player.position.z < PAUSE_Z);
    if (r === 'skipped') jumpTo(PAUSE_Z - 0.3);
    ui.watchBuzz(T.pauseBuzz, 2.6);
    d.after(2.8, () => d.thought(T.pauseReply, 1.6));

    // ------------------------------------------------------------ z < -24: the run club
    r = await d.until(() => ready() && player.position.z < CLUB_Z);
    if (r === 'skipped') jumpTo(CLUB_Z - 0.3);
    lock = true;
    await runClub(ctx, d, S, { follow });
    lock = false;

    // ------------------------------------------------------------ z < -42: back where he started
    r = await d.until(() => ready() && player.position.z < ARRIVE_Z);
    if (r === 'skipped') jumpTo(ARRIVE_Z - 0.3);
    lock = true;
    for (const id of ['ghost', 'billboard', 'shop', 'bench']) hotspots.remove(id);
    if (seated) await standUp();
    live = false;
    ui.watch(watchFace(), { lap: T.lapEnd, tick: false });
    await d.say(T.arrivalLoop);

    const odileTop = new THREE.Vector3(-0.75, 2.9, -46.7);
    await d.cinematic(async () => {
      const p = player.position;
      player.face(odileTop.x, odileTop.z);
      await d.gate(cam.tween({ pos: [clamp(p.x + 1.5, -4.2, 4.4), 1.75, p.z + 2.8], look: [odileTop.x, 2.5, odileTop.z], fov: 50 }, 1.6));
      await d.say(T.arrival);
    });

    // ------------------------------------------------------------ HOLD STILL
    ui.objective(T.objectives.hold);
    await d.gate(ui.fade(1, 0.3));
    const spot = S.holdSpot || [0.32, -44.88];
    const leg = S.holdLeg || [-0.05, -45.25];
    player.setPose('stand', 0);
    player.teleport(spot[0], spot[1]);
    player.face(leg[0], leg[1]);
    player.frozen = true;
    if (shots.hold) cam.set(shots.hold);
    // Staging: one hand round the tower leg (the player stays frozen; the clip is only the pose).
    player.scripted = true;
    player.char.play('hold_can', 0.4);
    await d.gate(ui.fade(0, 0.45));
    await holdStill(ctx, d, S);
    ui.objective(null);
    d.hope(0.09);
    // The finished lettering is the first thing in the street to take colour back.
    if (S.fascia?.mesh) ctx.mood.focusOn(S.fascia.mesh, { slot: 2, strength: 0.85, decay: 0.12, floor: 0.3, offsetY: 0, radius: 0.2 });

    // Odile climbs down behind a short cut.
    await d.wait(0.6);
    await d.gate(ui.fade(1, 0.35));
    player.scripted = false;
    player.char.play('idle', 0.2);
    S.odileDown?.(spot);
    if (S.odileGround) player.face(S.odileGround[0], S.odileGround[1]);
    if (shots.after) cam.set(shots.after);
    await d.wait(0.25);
    await d.gate(ui.fade(0, 0.5));

    // ------------------------------------------------------------ "Name one thing."
    await d.say(T.after);
    await d.correct(T.nameOne);
    d.hope(0.12);

    // ------------------------------------------------------------ "How far?"
    // Hugo turns to go: a slow turn toward the street (+Z).
    {
      const from = player.root.rotation.y;
      const to = 0.25;
      let t = 0;
      await d.until((dt) => {
        t += engine.rawDt;
        const k = Math.min(1, t / 0.6);
        player.root.rotation.y = from + (to - from) * (k * k * (3 - 2 * k));
        return k >= 1;
      });
      player.root.rotation.y = to;
    }
    await d.say(T.leaving);
    // He looks down at his wrist.
    ui.watch(L.watch.zero, { label: L.watch.labels.week, lap: T.howFarLap, tick: true });
    ui.watchFocus(true, { flare: T.flare });
    await d.wait(1.8);
    await d.gate(ui.fade(1, 0.25, '#fff'));
    for (const off of offs) off();
  },
};

// ------------------------------------------------------------------ the run club

/**
 * Five runners come up from behind (+Z) and run past toward -Z (moved by hand). Bastien drops back
 * and jogs on the spot beside Hugo for the exchange, then runs off and fades at z -46; only then
 * the after-lines.
 */
async function runClub(ctx, d, S, { follow }) {
  const { player, ui, cam, audio, world, engine } = ctx;
  const club = S.club || [];
  if (!club.length) {
    await d.say(L.ch2.club);
    await d.say(L.ch2.clubAfter);
    return;
  }
  const px = player.position.x;
  const pz = player.position.z;
  const side = px < 1.2 ? 1 : -1; // pass on the side with more room
  const PACK = [
    [0.95, 0.0],
    [1.65, 1.1],
    [2.4, 0.4],
    [1.3, 2.3],
    [2.2, 3.0],
  ];
  const runners = club.map((char, i) => {
    const lane = clamp(px + side * PACK[i][0], -4.6, 4.6);
    char.root.position.set(lane, 0, pz + 12 + PACK[i][1]);
    char.root.rotation.y = Math.PI;
    char.setOpacity(1);
    char.root.visible = true;
    const v = 3.5 + i * 0.07;
    const a = char.play('run', 0.1);
    if (a) a.timeScale = char.strideRate('run', v); // cadence from ground speed: planted feet
    return { char, lane, v, mode: i === 0 ? 'approach' : 'run', fading: false, gone: false, beside: 0 };
  });
  const B = runners[0];
  let patter = 0;
  const off = world.onUpdate((dt) => {
    const hp = player.position;
    let near = 99;
    for (const r of runners) {
      if (r.gone) continue;
      const p = r.char.root.position;
      if (r.mode === 'beside') {
        // Jogging on the spot so the watch won't pause.
        const tx = clamp(hp.x + side * 0.95, -4.7, 4.7);
        const tz = hp.z - 0.1;
        const k = 1 - Math.exp(-5 * dt);
        p.x += (tx - p.x) * k;
        p.z += (tz - p.z) * k;
        r.char.root.rotation.y = Math.atan2(hp.x - p.x, hp.z - p.z);
        // Jogging on the spot: the run cycle blended half-and-half with idle shortens the stride
        // to a bounce (the run alone at low speed reads as a lunge).
        const a = r.char.play('run', 0.3);
        if (a) {
          a.timeScale = 0.75;
          a.setEffectiveWeight(0.5);
        }
        const idle = r.char.actions?.idle;
        if (idle && !idle.isRunning()) {
          idle.reset();
          idle.enabled = true;
          idle.setEffectiveWeight(0.5);
          idle.play();
        }
        r.beside += dt;
      } else {
        p.z -= r.v * dt;
        p.x += (r.lane - p.x) * (1 - Math.exp(-2 * dt));
        r.char.root.rotation.y = Math.PI;
        const run = r.char.actions?.run;
        if (run) run.timeScale = r.char.strideRate('run', r.v);
        if (r.mode === 'approach' && p.z <= hp.z + 0.4) {
          r.mode = 'beside';
          r.beside = 0;
        }
        if (!r.fading && p.z < FADE_Z) {
          r.fading = true;
          r.char.fade(0, 0.7).then(() => {
            r.gone = true;
            r.char.root.visible = false;
          });
        }
      }
      near = Math.min(near, Math.hypot(p.x - hp.x, p.z - hp.z));
    }
    // Footfalls patter while they're close.
    patter -= dt;
    if (near < 11 && patter <= 0) {
      patter = 0.13 + Math.random() * 0.08;
      audio.footstep('concrete', { volume: 0.16 * (1 - near / 11), rate: 1.05 + Math.random() * 0.15 });
    }
  });

  // Bastien reaches Hugo (forced after 12 s, or on skip).
  let t = 0;
  let r = await d.until(() => {
    t += engine.rawDt;
    return (B.mode === 'beside' && B.beside > 0.5 && d.state === 'play' && !ui.modal) || t > 12;
  });
  if (r === 'skipped' || B.mode !== 'beside') {
    B.mode = 'beside';
    B.char.root.position.set(clamp(player.position.x + side * 0.95, -4.7, 4.7), 0, player.position.z - 0.1);
  }
  const bp = B.char.root.position;
  player.face(bp.x, bp.z);
  const m = new THREE.Vector3().addVectors(player.position, bp).multiplyScalar(0.5);
  await d.cinematic(
    async () => {
      await d.gate(cam.tween({ pos: [m.x - side * 0.5, 1.8, m.z + 3.4], look: [m.x, 1.45, m.z - 0.2], fov: 48 }, 0.9));
      await d.say(L.ch2.club);
    },
    { letterbox: false },
  );
  // He runs off.
  B.mode = 'leave';
  B.lane = clamp(player.position.x + side * 1.2, -4.6, 4.6);
  B.v = 3.7;
  const a = B.char.play('run', 0.25);
  if (a) {
    a.timeScale = B.char.strideRate('run', B.v);
    a.setEffectiveWeight(1);
  }
  if (B.char.actions?.idle?.isRunning()) B.char.actions.idle.fadeOut(0.3);
  player.root.rotation.y = Math.PI;
  follow();

  // Only after he has gone: the after-lines.
  t = 0;
  r = await d.until(() => {
    t += engine.rawDt;
    return (B.gone || t > 14) && d.state === 'play' && !ui.modal;
  });
  if (r === 'skipped') {
    for (const x of runners) {
      x.gone = true;
      x.char.root.visible = false;
    }
  }
  off();
  for (const x of runners) x.char.root.visible = false; // anyone still out there is past the fog
  await d.say(L.ch2.clubAfter);
}

// ------------------------------------------------------------------ HOLD STILL

/**
 * Hold the scaffold. The STILL gauge fills over 7 s while no movement key is held. Any movement
 * input drains 40%, creaks and wobbles the tower, and gets a bark from Odile. At 3.5 s of calm the
 * watch buzzes TIME TO MOVE! (the temptation). After 25 s the gauge fills regardless. The fascia
 * letters appear as the gauge fills ("RÉPARATI" -> "RÉPARATIONS.").
 */
async function holdStill(ctx, d, S) {
  const { ui, input, audio, engine } = ctx;
  const H = L.ch2.hold;
  const nextBark = bag(H.barks.bag);
  const F = S.fascia;
  let still = 0;
  let calm = 0;
  let t = 0;
  let lastBark = -9;
  let lastDrain = -9;
  let buzzed = false;
  let maxK = 0;
  ui.prompt(L.hints.still);
  const res = await d.until(() => {
    const raw = engine.rawDt;
    t += raw;
    const assist = t > ASSIST_AFTER;
    const pressed = MOVE_KEYS.some((k) => input.pressed.has(k));
    const held = MOVE_KEYS.some((k) => input.down.has(k));
    if (!assist && (pressed || (held && t - lastDrain > 0.8))) {
      lastDrain = t;
      still = Math.max(0, still - 0.4 * STILL_SECS);
      calm = 0;
      audio.noise({ type: 'bandpass', freq: 240, q: 6, dur: 0.4, volume: 0.24 });
      S.wobble?.(0.03);
      if (t - lastBark > 1.6) {
        lastBark = t;
        ui.thought(nextBark(), 2.4, { who: H.barks.who });
      }
    } else if (!held || assist) {
      still += raw;
      calm += raw;
    }
    if (!buzzed && calm >= 3.5) {
      buzzed = true;
      ui.watchBuzz(H.buzz);
      d.after(2.6, () => d.thought(H.buzzReply, 1.8));
    }
    const k = Math.min(1, still / STILL_SECS);
    maxK = Math.max(maxK, k);
    if (F && F.draw(F.startN + (F.fullN - F.startN) * Math.min(1, maxK * 1.05))) audio.scrape({ volume: 0.07 });
    ui.gauge(H.gauge, { value: k, band: [0.92, 1], color: '#d9a441' });
    return k >= 1;
  });
  ui.gauge(null);
  ui.prompt(null);
  F?.draw(F.fullN);
  return res;
}
