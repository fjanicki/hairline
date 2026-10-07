import * as THREE from 'three';
import { L } from './script.js';
import { retext } from './i18n.js';

// Shared craft / running minigames (core-owned). Every helper:
//   - finishes on its own with no input (idle assists), so nothing soft-locks;
//   - is skippable with __game.debug.skip() (it runs inside d.until / d.gate);
//   - cleans up the UI it used (gauge, prompt) when it ends.
// One-off minigames (HOLD STILL, TRUING, LETTERING, THE LINE) live in their chapter files and can
// build on rhythm(), timing() and makeSteer().

/** Cross-chapter hand-offs, e.g. memory.openSign = the OPEN sign canvas from Ch4 (shown in Ch5). */
export const memory = {};

// The OPEN sign survives Pause > Restart chapter (a page reload) via sessionStorage.
const SIGN_KEY = 'hairline.openSign';

/** Keep Hugo's lettered OPEN sign (a canvas) for Ch5, in memory and in sessionStorage. */
export function rememberOpenSign(canvas) {
  memory.openSign = canvas;
  try {
    sessionStorage.setItem(SIGN_KEY, canvas.toDataURL('image/png'));
  } catch {
    // Private window / storage blocked / quota: the in-memory copy still works this session.
  }
}

/** At boot: restore memory.openSign from sessionStorage (an Image), if there is one. Never throws. */
export async function restoreMemory() {
  if (memory.openSign) return;
  let url = null;
  try {
    url = sessionStorage.getItem(SIGN_KEY);
  } catch {
    return;
  }
  if (!url) return;
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    memory.openSign = img;
  } catch {
    // Corrupt entry: fall back to the plain sign.
  }
}

const now = (ctx) => ctx.engine.now;

/**
 * Steady alternating rhythm (Ch3 pacing, Ch4 sanding). A stroke is a press of a key different from
 * the previous stroke's key (A, D, A, D...); repeating the same key does nothing.
 *
 * opts:
 *   keys = ['KeyA', 'KeyD']        keys to alternate between (raw input: works while the player is scripted)
 *   band = [2.3, 3.3]              target rate in strokes/s
 *   mashAt                         rate above which onMash fires (default band[1] * 1.1)
 *   window = 6                     number of recent intervals used for rate and spread
 *   idleAuto = { after = 5, rate } after `after` s with no stroke, auto-strokes at `rate`/s (default mid-band)
 *                                  until the player presses again. Pass null to disable.
 *   gauge = { label, scale = 1, unit, max } draws ui.gauge each frame: value rate*scale, band*scale,
 *                                  readout `${round(rate*scale)} ${unit}`. Omit or null for no gauge.
 *   prompt                         prompt text while it runs (default L.ch3.keys.both + ' ' + L.hints.rhythm); null = none
 *   freeze = true                  sets player.frozen while it runs (A/D won't walk him); restored after
 *   steadyAfter = 4                seconds in band before onSteady fires
 *   cooldown = 6                   minimum seconds between two onMash / onLow / onSteady calls
 *   done(s) => bool                checked every frame; the minigame ends when it returns true (required)
 *   onFrame(dt, s)                 every frame (move the runner, reveal the wood...)
 *   onStroke(s, inBand)            every stroke (s.auto is true for assisted strokes)
 *   onMash(s), onLow(s), onSteady(s) feedback hooks (throttled by cooldown)
 *
 * State s: { rate, spread (coefficient of variation of the recent intervals, 0 = metronome),
 *            inBand, strokes, t (seconds running), idle (seconds since the last real stroke),
 *            auto (assist active), steadyFor (seconds continuously in band), lastKey, mashing }
 *
 * Returns Promise<{ skipped, state }>.
 */
export async function rhythm(ctx, d, opts = {}) {
  const {
    keys = ['KeyA', 'KeyD'],
    band = [2.3, 3.3],
    window = 6,
    gauge = null,
    freeze = true,
    steadyAfter = 4,
    cooldown = 6,
    done = () => false,
    onFrame,
    onStroke,
    onMash,
    onLow,
    onSteady,
  } = opts;
  const mashAt = opts.mashAt ?? band[1] * 1.1;
  const idle = opts.idleAuto === null ? null : { after: 5, rate: (band[0] + band[1]) / 2, ...(opts.idleAuto || {}) };
  const prompt = opts.prompt === undefined ? `${L.ch3.keys.both} ${L.hints.rhythm}` : opts.prompt;
  const { input, ui, player } = ctx;

  const s = { rate: 0, spread: 0, inBand: false, strokes: 0, t: 0, idle: 0, auto: false, steadyFor: 0, lastKey: null, mashing: false };
  const times = []; // stroke timestamps (engine.now)
  let autoAcc = 0;
  let autoKey = 0;
  let wasInBand = false;
  let steadyFired = false;
  const last = { mash: -1e9, low: -1e9, steady: -1e9 };
  const wasFrozen = player.frozen;
  if (freeze) player.frozen = true;
  if (prompt) ui.prompt(prompt);

  const stroke = (key, auto) => {
    const t = now(ctx);
    times.push(t);
    if (times.length > window + 1) times.shift();
    s.lastKey = key;
    s.strokes++;
    s.auto = auto;
    computeRate(t);
    try {
      onStroke?.(s, s.inBand);
    } catch (err) {
      console.error('[minigames] onStroke failed', err);
    }
  };

  const computeRate = (t) => {
    if (times.length >= 2) {
      const iv = [];
      for (let i = 1; i < times.length; i++) iv.push(times[i] - times[i - 1]);
      const mean = iv.reduce((a, b) => a + b, 0) / iv.length;
      const sd = Math.sqrt(iv.reduce((a, b) => a + (b - mean) * (b - mean), 0) / iv.length);
      let rate = 1 / Math.max(1e-3, mean);
      // No stroke for longer than the usual interval: the rate is falling.
      const since = t - times[times.length - 1];
      if (since > mean) rate = Math.min(rate, 1 / since);
      s.rate = rate;
      s.spread = sd / Math.max(1e-3, mean);
    } else s.rate = 0;
    s.inBand = s.rate >= band[0] && s.rate <= band[1];
    s.mashing = s.rate > mashAt;
  };

  const call = (fn, key) => {
    if (!fn || s.t - last[key] < cooldown) return;
    last[key] = s.t;
    try {
      fn(s);
    } catch (err) {
      console.error('[minigames] callback failed', err);
    }
  };

  const r = await d.until((dt) => {
    const raw = ctx.engine.rawDt;
    s.t += raw;
    s.idle += raw;
    // Real strokes.
    let pressedKey = null;
    for (const k of keys) if (input.pressed.has(k) && k !== s.lastKey) pressedKey = k;
    if (pressedKey) {
      s.idle = 0;
      autoAcc = 0;
      stroke(pressedKey, false);
    } else if (idle && s.idle >= idle.after) {
      // Assist: the body does it anyway.
      autoAcc += raw * idle.rate;
      while (autoAcc >= 1) {
        autoAcc -= 1;
        autoKey = 1 - autoKey;
        stroke(keys[autoKey % keys.length], true);
      }
    } else computeRate(now(ctx));
    if (!pressedKey && !(idle && s.idle >= idle.after)) s.auto = false;

    // Feedback.
    s.steadyFor = s.inBand ? s.steadyFor + raw : 0;
    if (s.mashing && !s.auto) call(onMash, 'mash');
    if (s.inBand) wasInBand = true;
    else if (wasInBand && s.rate < band[0] && !s.auto) {
      wasInBand = false;
      call(onLow, 'low');
    }
    if (s.steadyFor >= steadyAfter && !steadyFired && !s.auto) {
      steadyFired = true;
      call(onSteady, 'steady');
    }
    if (!s.inBand) steadyFired = false;

    if (gauge) {
      const k = gauge.scale ?? 1;
      const max = gauge.max ?? Math.max(band[1] * 1.45, mashAt * 1.15) * k;
      ui.gauge(retext(gauge.label), { // retext: a label string captured before a language change
        value: s.rate * k,
        band: [band[0] * k, band[1] * k],
        max,
        color: gauge.color,
        text: gauge.unit !== undefined ? `${Math.round(s.rate * k)} ${gauge.unit}`.trim() : undefined,
        warn: gauge.warn ? gauge.warn(s) : s.mashing,
      });
    }
    try {
      onFrame?.(dt, s);
    } catch (err) {
      console.error('[minigames] onFrame failed', err);
    }
    return done(s) ? true : false;
  });

  if (gauge) ui.gauge(null);
  if (prompt) ui.prompt(null);
  if (freeze) player.frozen = wasFrozen;
  return { skipped: r === 'skipped', state: s };
}

/**
 * Repeated timing rings (Ch4 truing): press Space when the ring meets its target, N hits to finish.
 * Built on ui.driveRing (real time; the perfect moment is at 0.75 * duration).
 *
 * opts:
 *   hits = 4, rings = 8           ends at `hits` hits or `rings` rings, whichever comes first
 *   duration = 2.4, window = 0.18 ring travel (s) and hit window (± s)
 *   cue = '[' + L.hints.space + ']', shout = null, missText = null   passed to driveRing
 *   widenAfter = 3, widen = 1.6   after `widenAfter` misses the window is multiplied by `widen`
 *   autoHitFrom = 5               from this miss on, a miss counts as a (assisted) hit; 0 disables
 *   gap = 0.35                    pause between rings (s)
 *   onRing(i)                     before each ring (sync a sound / animation to it: the perfect moment
 *                                 is duration * 0.75 s later)
 *   onHit(res, n), onMiss(res, n) after each ring (n = hits / misses so far; res.assisted for auto hits)
 *
 * Returns Promise<{ skipped, hits, misses, assisted, rings }>.
 */
export async function timing(ctx, d, opts = {}) {
  const {
    hits: need = 4,
    rings: maxRings = 8,
    duration = 2.4,
    window = 0.18,
    cue = `[${L.hints.space}]`,
    shout = null,
    missText = null,
    widenAfter = 3,
    widen = 1.6,
    autoHitFrom = 5,
    gap = 0.35,
    onRing,
    onHit,
    onMiss,
  } = opts;
  const { ui } = ctx;
  let hits = 0;
  let misses = 0;
  let assisted = 0;
  let rings = 0;
  let skipped = false;
  const safe = (fn, ...a) => {
    try {
      fn?.(...a);
    } catch (err) {
      console.error('[minigames] timing callback failed', err);
    }
  };
  while (hits < need && rings < maxRings) {
    rings++;
    safe(onRing, rings - 1);
    const w = misses >= widenAfter ? window * widen : window;
    const res = await d.gate(ui.driveRing({ duration, window: w, cue, shout, missText }), () => {
      ui.cancelDrive();
      return true;
    });
    if (res === 'skipped' || res?.cancelled) {
      skipped = true;
      break;
    }
    if (res.hit) {
      hits++;
      safe(onHit, res, hits);
    } else {
      misses++;
      if (autoHitFrom > 0 && misses >= autoHitFrom) {
        hits++;
        assisted++;
        safe(onHit, { ...res, assisted: true }, hits);
      } else safe(onMiss, res, misses);
    }
    if (hits < need && rings < maxRings && gap > 0) {
      if ((await d.wait(gap)) === 'skipped') {
        skipped = true;
        break;
      }
    }
  }
  if (skipped) hits = Math.max(hits, need);
  return { skipped, hits, misses, assisted, rings };
}

/** Smooth 1D noise in [-1, 1] from a few incommensurate sines with random phases. */
function smoothNoise(seed) {
  const R = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const f = [0.31, 0.53, 0.89, 1.37].map((k) => k * (0.85 + R() * 0.3));
  const p = f.map(() => R() * Math.PI * 2);
  const a = [0.45, 0.3, 0.17, 0.08];
  return (t) => f.reduce((sum, fk, i) => sum + a[i] * Math.sin(t * fk * Math.PI * 2 * 0.5 + p[i]), 0);
}

/**
 * A steerable tip with smooth-noise drift (Ch4 lettering, Ch5 the line). Small, calm corrections
 * are the skill. The offset is bounded, so leaving it alone still produces a (wobbly) result.
 *
 * opts:
 *   dims = 1               1: only offset.y moves (W/S); 2: x (A/D) and y (W/S)
 *   drift = 0.35           drift speed (units/s at the noise peak)
 *   driftGrow = 0          drift added per second elapsed (a stroke gets harder the longer it runs)
 *   gain = 0.9             correction speed per unit input (units/s)
 *   momentum = 0           0 = direct (no inertia); 0..1 = heavier brush (velocity eases to target)
 *   damping = 6            how fast velocity reaches its target when momentum > 0
 *   bound = 1              |offset| never exceeds this; recenter pulls it back softly
 *   recenter = 0.25        soft spring toward 0 (per second), keeps idle play bounded
 *   seed                   noise seed (default random)
 *
 * Returns { offset: Vector2, velocity: Vector2, t, stats: { mean, max, n }, step(dt, input), reset() }.
 * step(dt, input): input is ctx.input (reads WASD / arrows; W = up = +y, D = +x) or { x, y } in -1..1.
 * stats.mean is the running mean |offset| (the usual score).
 */
export function makeSteer({
  dims = 1,
  drift = 0.35,
  driftGrow = 0,
  gain = 0.9,
  momentum = 0,
  damping = 6,
  bound = 1,
  recenter = 0.25,
  seed = (Math.random() * 1e6) | 0 || 1,
} = {}) {
  const nx = smoothNoise(seed + 11);
  const ny = smoothNoise(seed + 97);
  const target = new THREE.Vector2();
  const st = {
    offset: new THREE.Vector2(),
    velocity: new THREE.Vector2(),
    t: 0,
    stats: { mean: 0, max: 0, n: 0, sum: 0 },
    step(dt, input) {
      if (!(dt > 0)) return st.offset;
      st.t += dt;
      let ix = 0;
      let iy = 0;
      if (input && input.down instanceof Set) {
        const dn = input.down;
        ix = (dn.has('KeyD') || dn.has('ArrowRight') ? 1 : 0) - (dn.has('KeyA') || dn.has('ArrowLeft') ? 1 : 0);
        iy = (dn.has('KeyW') || dn.has('ArrowUp') ? 1 : 0) - (dn.has('KeyS') || dn.has('ArrowDown') ? 1 : 0);
      } else if (input) {
        ix = input.x || 0;
        iy = input.y || 0;
      }
      const dr = drift + driftGrow * st.t;
      const o = st.offset;
      target.set(
        dims >= 2 ? dr * nx(st.t) + gain * ix - recenter * o.x : 0,
        dr * ny(st.t) + gain * iy - recenter * o.y,
      );
      if (momentum > 0) st.velocity.lerp(target, 1 - Math.exp(-damping * (1 - Math.min(0.95, momentum)) * dt));
      else st.velocity.copy(target);
      o.addScaledVector(st.velocity, dt);
      if (o.length() > bound) o.setLength(bound);
      const m = dims >= 2 ? o.length() : Math.abs(o.y);
      const s = st.stats;
      s.n++;
      s.sum += m;
      s.mean = s.sum / s.n;
      s.max = Math.max(s.max, m);
      return o;
    },
    reset() {
      st.offset.set(0, 0);
      st.velocity.set(0, 0);
      st.t = 0;
      Object.assign(st.stats, { mean: 0, max: 0, n: 0, sum: 0 });
    },
  };
  return st;
}
