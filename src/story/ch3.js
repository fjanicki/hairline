import * as THREE from 'three';
import { L } from './script.js';
import { rhythm } from './minigames.js';
import { PRESETS } from '../render/Mood.js';
import { buildScene3, LAYOUT } from '../world/scenes/scene3.js';

// Ch3 "The Long Run" (flashback): three training blocks on the same dawn ring-road straight,
// each a steady A/D cadence run with the weekly km climbing on the watch and a STRIDE "Rest"
// that is never real; then Sunday, the marathon, the quiet crack at KM 31, the 25 m he keeps
// going, and over black: GREAT EFFORT, 170.2 -> 212.4, the doctor, and Odile in the present.

const T = L.ch3;
const KIT_GREEN = '#c6f432';
const G = T.gauge;

const BAND = [2.3, 3.3]; // alternations/s (x60 = 138-198 spm)
const MASH_AT = 3.6;
const V_FLOOR = 3.2; // m/s with no / low input: no fail state
const V_BAND = 4.2; // m/s in band (and while mashing)
const V_LIMP = 2.4;
const LIMP_M = 25;
const HOPE = [1.15, 1.0, 0.85];
const PAIN = [0, 0.2, 0.4];
const RACE_HOPE = 0.75;
const RACE_PAIN = 0.5;
// The red pain vignette is linear in painOverride (the player's own pain is squared): scale the
// DESIGN values (0 / 0.2 / 0.4 / 0.5, crack 0.6) so the memory keeps its colour and the red reads as
// a creeping edge, not a wash.
const PAIN_VIS = 0.34;
const painVis = (v) => clamp(v * PAIN_VIS, 0, 1);
const STORY_QUIET = 4.2; // s after a story thought during which cadence feedback stays quiet
const CAPTION_SECS = 4.2; // the caption shares the lower third with the gauge: one at a time
const RACE_PACE = 245; // s/km up to KM 31 (the lap readout; 3:04:51 at the finish)
const LIMP_PACE = 312; // s/km on the crack (the watch counts those kilometres the same)

const CAM_RUN = { offset: [1.1, 1.85, 4.6], look: [-0.25, 1.2, -4], lerp: 6 };
const CAM_LIMP = { offset: [1.55, 1.2, 3.3], look: [-0.3, 0.8, -2.6], lerp: 2.2 };

// Each block darker than the last (the old life quietly going out). Overrides on 'dawnrun'.
const BLOCK_MOOD = [
  { skyTop: '#16253f', skyBottom: '#5a7898', fogColor: '#55718f', fogDensity: 0.022, heightFog: 0.03, sunColor: '#d6e6ff', sunIntensity: 1.6, hemiIntensity: 1.0, envIntensity: 0.16, fillIntensity: 2.2 },
  { skyTop: '#121d32', skyBottom: '#3c5574', fogColor: '#3d5573', fogDensity: 0.027, heightFog: 0.035, sunIntensity: 1.1, hemiIntensity: 0.82, envIntensity: 0.12, fillIntensity: 2.2, exposure: 0.97 },
  { skyTop: '#0a1120', skyBottom: '#243349', fogColor: '#243349', fogDensity: 0.03, heightFog: 0.03, sunColor: '#9db4d6', sunIntensity: 0.4, hemiSky: '#7f93b0', hemiIntensity: 0.6, envIntensity: 0.08, fillIntensity: 2.0, exposure: 0.95 },
];
const BLOCK_RAIN = [0.35, 0.5, 0.4];
// Sunday: the haze has burnt off, a low sun straight down the course; vivid, a little too bright.
const RACE_MOOD = {
  skyTop: '#2f5f9a', skyBottom: '#a6bfd4', fogColor: '#a3b8ca', fogDensity: 0.009, heightFog: 0.012,
  sunColor: '#fff0dc', sunIntensity: 2.7, sunDir: [0.22, 0.32, -1], hemiSky: '#b8cce4', hemiIntensity: 1.2,
  envIntensity: 0.28, fillIntensity: 2.2, exposure: 1.06, contrast: 1.16, splitHigh: '#fff1dc', split: 0.16, vignette: 0.36,
};
const CRACK_MOOD = { contrast: 1.08, fogDensity: 0.012, heightFog: 0.02, sunIntensity: 1.6, exposure: 0.98 }; // the light goes flat

const clamp = THREE.MathUtils.clamp;
const fmtKm = (km) => `${km.toFixed(1)} km`;
const fmtLap = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
/** Fire-and-forget audio calls must never surface as unhandled rejections. */
const quiet = (p) => p?.catch?.(() => {});
/** STRIDE prompt text for the watch notification (the menu shows the full prompt). */
const notif = (prompt) => String(prompt).replace(/^STRIDE\s*:\s*/, ''); // 'STRIDE : ' in French

async function run(ctx, d) {
  const { engine, audio, mood, ui, cam, player, world } = ctx;
  const S = world.current || {};
  const hugo = player.char;
  const p = player.root.position;

  player.scripted = true;
  player.showPain = false;
  cam.follow(player.root, CAM_RUN);

  // ------------------------------------------------------------ the motor (one per-frame loop)
  // Moves Hugo and the race pack every frame; the minigame only sets the target speed and rate.
  const M = {
    on: true,
    v: S.preroll?.v ?? V_FLOOR,
    target: V_FLOOR,
    dist: 0,
    rate: 0,
    x: p.x,
    limp: false,
    hitch: 0,
    race: false,
    raceT: 0,
  };
  if (S.preroll) S.preroll = null; // hand-over from the fade-in pre-roll
  world.onUpdate((dt) => {
    if (!M.on) return;
    const tgt = p.z <= LAYOUT.endZ ? 0 : M.target;
    M.v += (tgt - M.v) * (1 - Math.exp(-(tgt < M.v ? 2.6 : 2) * dt));
    const step = Math.max(0, M.v) * dt;
    p.z -= step;
    M.dist += step;
    p.x += (M.x - p.x) * (1 - Math.exp(-1.2 * dt));
    player.root.rotation.y = Math.PI;
    let a = null;
    if (M.v > 0.35) {
      a = hugo.play('run', 0.25);
      // Cadence from ground speed (Character.strideRate), so the planted foot stays put; the A/D
      // rate sets the target speed. The limp keeps a slower, laboured cycle the pitch bumps ride on.
      if (a) a.timeScale = clamp(hugo.strideRate('run', M.v), 0.45, 1.45);
    } else hugo.play('idle', 0.4);
    let pitch = 0;
    let y = 0;
    if (M.limp && a) {
      // The left stride lands short: a pitch and a dip once per cycle.
      const ph = (a.time / (a.getClip().duration || 1)) % 1;
      const bump = Math.max(0, Math.sin(ph * Math.PI * 2));
      pitch += 0.1 * bump * bump;
      y -= 0.05 * bump;
    }
    if (M.hitch > 0) {
      pitch += 0.22 * M.hitch;
      y -= 0.09 * M.hitch;
      M.hitch = Math.max(0, M.hitch - dt * 2.2);
    }
    player.poseOffset.pitch = pitch;
    player.poseOffset.y = y;
    if (M.race) {
      M.raceT += dt;
      S.stepRunners?.(dt, p.z, M.v, M.raceT);
    }
  });

  // ------------------------------------------------------------ shared minigame plumbing
  let basePain = PAIN[0];
  let painExtra = 0;
  let lastStory = -1e9;
  let gaugeFrom = 0;
  const story = (text, secs = 4.4) => {
    lastStory = engine.now;
    d.thought(text, secs);
  };
  const feedback = (text) => {
    if (engine.now - lastStory < STORY_QUIET) return;
    d.thought(text, 2.4);
  };
  const drawGauge = (s, { warn = false, ragged = false } = {}) => {
    if (engine.now < gaugeFrom) return;
    const k = G.scale;
    let val = s.rate * k;
    if (ragged) val *= 1 + 0.28 * Math.sin(engine.now * 9.1) * Math.sin(engine.now * 3.3 + 1);
    ui.gauge(G.label, {
      value: val,
      band: [BAND[0] * k, BAND[1] * k],
      max: Math.max(BAND[1] * 1.45, MASH_AT * 1.15) * k,
      text: `${Math.round(val)} ${G.unit}`,
      warn: warn || s.mashing,
    });
  };
  const step = (s, { limp = false } = {}) => {
    if (limp) {
      const bad = s.lastKey === 'KeyA';
      quiet(audio.footstep('concrete', { volume: bad ? 0.4 : 0.3, rate: bad ? 0.8 : 1 }));
      if (bad) audio.thud?.({ volume: 0.08 });
    } else quiet(audio.footstep('concrete', { volume: s.auto ? 0.24 : 0.32, rate: 0.95 + Math.random() * 0.12 }));
  };
  /** The steady run. extra.onFrame(dt, s) runs after the shared work; extra.done(s) ends it. */
  const cadenceRun = (extra) =>
    rhythm(ctx, d, {
      band: BAND,
      mashAt: MASH_AT,
      idleAuto: { after: 5, rate: 2.8 }, // the body does it anyway
      onStroke: (s) => step(s),
      onMash: () => feedback(T.cadence.mash),
      onLow: () => feedback(T.cadence.low),
      onSteady: () => feedback(T.cadence.steady),
      onFrame: (dt, s) => {
        M.rate = s.rate;
        M.target = s.inBand || s.mashing ? V_BAND : V_FLOOR;
        // Mashing is fast but costs (cosmetic): the pain vignette creeps up, then settles.
        if (s.mashing && !s.auto) painExtra = Math.min(0.35, painExtra + 0.15 * dt);
        else painExtra = Math.max(0, painExtra - 0.08 * dt);
        mood.painOverride = painVis(basePain + painExtra);
        drawGauge(s);
        extra.onFrame?.(dt, s);
      },
      done: extra.done,
    });

  // ------------------------------------------------------------ training blocks
  const setBlock = (i) => {
    S.setBlock?.(i);
    mood.applyPreset('dawnrun', BLOCK_MOOD[i]);
    d.hope(HOPE[i], 0);
    basePain = PAIN[i];
    painExtra = 0;
    mood.painOverride = painVis(basePain);
    quiet(audio.ambience('rain', true, { volume: BLOCK_RAIN[i], fade: 1.2 }));
  };

  const block = async (i) => {
    const wk = T.weeks[i];
    const z0 = p.z;
    M.dist = 0;
    ui.caption(wk.caption, { secs: CAPTION_SECS });
    gaugeFrom = engine.now + CAPTION_SECS;
    ui.watch(fmtKm(0), { label: T.weekLabel, lap: null, tick: false });
    const marks = Object.keys(wk.thoughts).map(Number).sort((a, b) => a - b);
    const said = new Set();
    await cadenceRun({
      onFrame: () => {
        const k = clamp(M.dist / wk.length, 0, 1);
        ui.watch(fmtKm(wk.total * k), { tick: false });
        for (const m of marks) {
          if (M.dist >= m && !said.has(m)) {
            said.add(m);
            story(wk.thoughts[m]);
          }
        }
      },
      done: () => M.dist >= wk.length,
    });
    if (p.z > z0 - wk.length) M.dist = wk.length; // skipped: the week still adds up
    ui.caption(null);
    ui.gauge(null);
    ui.watch(fmtKm(wk.total), { tick: true });
    mood.painOverride = painVis(basePain);

    // STRIDE. He doesn't stop to answer it: every option is more running.
    M.rate = 0;
    M.target = V_FLOOR;
    ui.watchBuzz(notif(wk.stride.prompt), 2.0);
    await d.wait(1.0);
    const pick = await d.choose(wk.stride);
    const opt = wk.stride.options[typeof pick === 'number' ? pick : 0] || wk.stride.options[0];
    if (opt?.reply) await d.think(opt.reply);
  };

  const cutTo = async (setup, { card } = {}) => {
    await d.gate(ui.fade(1, 0.7, '#000'));
    ui.caption(null);
    ui.gauge(null);
    setup();
    cam.snap();
    if (card) {
      M.on = false; // nobody moves while the card holds
      await d.card(card.lines, card.opts);
      M.on = true;
    } else await d.wait(0.35);
    await d.gate(ui.fade(0, 0.9));
  };

  const toTrainingStart = () => {
    player.teleport(LAYOUT.trainX, LAYOUT.trainZ, Math.PI);
    M.x = LAYOUT.trainX;
    M.v = V_FLOOR;
    M.dist = 0;
  };

  // Week 9 (the chapter preset and hope are already Week 9's).
  S.setBlock?.(0);
  mood.painOverride = painVis(basePain);
  await block(0);
  // Week 20, Week 31.
  for (let i = 1; i < 3; i++) {
    await cutTo(() => {
      setBlock(i);
      toTrainingStart();
    });
    await block(i);
  }

  // ------------------------------------------------------------ Sunday: the race
  const [B29, B30, B31] = LAYOUT.boards;
  const kmAt = (z) => 29 + Math.max(0, B29 - z) / LAYOUT.boardEvery;
  await cutTo(
    () => {
      S.setBlock?.(3);
      mood.applyPreset('dawnrun', RACE_MOOD);
      d.hope(RACE_HOPE, 0);
      basePain = RACE_PAIN;
      painExtra = 0;
      mood.painOverride = painVis(basePain);
      // Race morning: the short-sleeved kit (the dawn blocks were in long sleeves and tights).
      hugo.setOutfit?.('runner');
      hugo.setTint?.(KIT_GREEN);
      player.teleport(LAYOUT.raceX, LAYOUT.raceZ, Math.PI);
      M.x = LAYOUT.raceX;
      M.v = V_FLOOR;
      M.dist = 0;
      M.race = true;
      M.raceT = 0;
      S.placeRunners?.(p.z);
      S.crowd?.(0.6);
      ui.watch(fmtKm(29), { label: T.race.label, lap: fmtLap(29 * RACE_PACE), tick: false });
      quiet(audio.ambience('rain', true, { volume: 0.22, fade: 1.5 }));
      quiet(audio.ambience('crowd', true, { volume: 0.55, fade: 1.5, lowpass: 1400 }));
    },
    { card: { lines: T.sunday, opts: { big: true } } },
  );
  ui.caption(T.race.caption, { secs: CAPTION_SECS });
  gaugeFrom = engine.now + CAPTION_SECS;
  let said30 = false;
  let said30b = false;
  await cadenceRun({
    onFrame: () => {
      const km = kmAt(p.z);
      ui.watch(fmtKm(km), { lap: fmtLap(km * RACE_PACE), tick: false });
      if (!said30 && p.z <= B30) {
        said30 = true;
        story(T.race.thoughts.km30);
      }
      if (!said30b && p.z <= B30 - 12) {
        said30b = true;
        story(T.race.thoughts.km30plus);
      }
    },
    done: () => p.z <= B31,
  });
  if (p.z > B31) p.z = B31; // skipped: the crack happens at KM 31 regardless
  ui.caption(null);
  ui.gauge(null);
  ui.watch(fmtKm(31), { lap: fmtLap(31 * RACE_PACE), tick: false });

  // ------------------------------------------------------------ KM 31: the crack (quiet)
  const crackDist = M.dist;
  const kmLimp = () => 31 + (M.dist - crackDist) / LAYOUT.boardEvery;
  audio.cut();
  audio.tone({ freq: 6200, to: 5600, dur: 3.4, volume: 0.03, attack: 0.4 }); // a faint high whine (fx bus)
  audio.snap({ volume: 0.3 }); // a pencil lead, inside a drawer
  M.hitch = 1;
  cam.dip(0.18);
  engine.timeScale = 0.6;
  d.after(1.2, () => {
    engine.timeScale = 1;
  });
  mood.drain(0, 3);
  mood.tweak({ grain: 0.12, ...CRACK_MOOD }, 1);
  mood.painOverride = painVis(0.6);
  S.crowd?.(0.1);
  S.releaseRunners?.(V_BAND);
  M.limp = true;
  M.rate = 0;
  M.target = 1.7;
  cam.follow(null, CAM_LIMP);
  ui.objective(null);
  await d.wait(0.9);
  await d.card(T.crack, { bg: 'clear', italic: true });

  // ------------------------------------------------------------ he keeps going
  audio.restore();
  quiet(audio.ambience('crowd', true, { volume: 0.14, fade: 2.5, lowpass: 900 }));
  quiet(audio.ambience('rain', true, { volume: 0.3, fade: 2.5 }));
  ui.objective(T.objectives.finish);
  M.target = V_LIMP;
  const limp0 = M.dist;
  let limping = true;
  d.after(3, () => {
    if (limping) story(T.keepGoing, 6.5); // guaranteed at 3 s into the limp
  });
  // Input still counts (footsteps, the needle), but it changes nothing.
  await rhythm(ctx, d, {
    band: BAND,
    mashAt: 99,
    idleAuto: { after: 1.2, rate: 1.8 },
    onStroke: (s) => step(s, { limp: true }),
    onFrame: (dt, s) => {
      M.target = V_LIMP;
      M.rate = 0;
      drawGauge(s, { warn: true, ragged: true });
      const km = kmLimp();
      ui.watch(fmtKm(km), { lap: fmtLap(31 * RACE_PACE + (km - 31) * LIMP_PACE), tick: false });
    },
    done: () => M.dist - limp0 >= LIMP_M,
  });
  limping = false;
  ui.gauge(null);
  quiet(audio.ambience('crowd', false, { fade: 1.4 }));
  quiet(audio.ambience('rain', false, { fade: 1.4 }));
  await d.gate(ui.fade(1, 1.3, '#000'));

  // ------------------------------------------------------------ over black
  M.on = false;
  M.race = false;
  engine.timeScale = 1;
  ui.objective(null);
  ui.caption(null);
  mood.painOverride = 0;
  hugo.play('idle', 0.3);
  player.poseOffset.pitch = 0;
  player.poseOffset.y = 0;
  const F = T.finish;
  ui.watch(F.face, { label: T.race.label, lap: F.lap, over: true, tick: true });
  await d.wait(0.7);
  ui.watchBuzz(F.buzz);
  await d.wait(1.5);
  const count = ui.watchCount(F.weekFrom, F.weekTo, 1.5, { label: F.weekLabel, lap: null, over: true });
  await d.gate(count, () => {
    count.finish();
    return true;
  });
  await d.wait(1.5);
  await d.say(T.doctor);
  quiet(audio.ambience('rain', true, { volume: 0.3, fade: 3 })); // the present fades in under it
  await d.wait(0.8);
  await d.say(T.present);
  await d.wait(0.8);
  // The chapter ends on black; Ch4 fades in from it.
}

export default {
  id: 'longrun',
  get title() {
    return T.title;
  },
  hope: HOPE[0],
  preset: { ...PRESETS.dawnrun, ...BLOCK_MOOD[0] }, // Week 9's dawn (setBlock re-applies 'dawnrun' + overrides)
  get objective() {
    return T.objectives.run;
  },
  music: null,
  ambience: ['rain'],
  sounds: ['crowd'], // the race (preloaded with the chapter)
  camera: { offset: CAM_RUN.offset, look: CAM_RUN.look, fov: 55, lerp: CAM_RUN.lerp },
  player: {
    spawn: [LAYOUT.trainX, LAYOUT.trainZ],
    facing: Math.PI,
    boot: false,
    tint: KIT_GREEN, outfit: 'runner_dawn', // STRIDE green: the old kit (long sleeves for the dawn blocks)
    limp: 0,
    painRate: 0,
    canJog: false,
    showPain: false,
    footsteps: null, // one footstep per A/D press instead (chapter-driven)
  },
  // Pre-roll: he is already running as the white fades (state 'transition', before run()).
  build: async (ctx) => {
    const S = await buildScene3(ctx);
    const base = S.update;
    S.preroll = { v: 0 };
    S.update = (dt, raw) => {
      base?.(dt, raw);
      const pr = S.preroll;
      if (!pr || ctx.director.state !== 'transition') return;
      const pl = ctx.player;
      pl.scripted = true; // configure() ran after build: take over for the fade
      pr.v += (V_FLOOR - pr.v) * (1 - Math.exp(-3 * dt));
      pl.root.position.z -= pr.v * dt;
      pl.root.rotation.y = Math.PI;
      const a = pl.char.play('run', 0.3);
      if (a) a.timeScale = clamp(pl.char.strideRate('run', pr.v), 0.45, 1.2);
    };
    return S;
  },
  run,
};
