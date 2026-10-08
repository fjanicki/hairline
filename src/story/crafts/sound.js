// Recorded-SFX helpers for the Ch4 / Ch5 crafts and beats (docs/assets/sfx.md, Ch4 and Ch5 Integration
// lists). Everything goes through audio.sfx() / audio.loopSfx() (src/core/Sfx.js), so a missing file
// falls back to the procedural cue it replaces, pause and mute silence it, and ?debug=1 logs it.
//
// - speaking(ctx): a voice clip (core/Voice.js, French) is playing right now.
// - duckUnderVoice(ctx, h, {db}): dips a long one-shot (audio.sfx handle) while a clip plays.
// - wheelSound(ctx, rig, {pos}): the freewheel ticking that follows a bikeRig's rear wheel speed, and
//   the coast-down when a free spin is let go.
// - stirSlice(audio, opts): a 0.4 s slice of the paint-stir loop (60 ms fades) for the swirl after a drop.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = Math.PI * 2;

/** A voice clip is playing (never true in English or with voices off). */
export function speaking(ctx) {
  const c = ctx?.voice?.cur;
  return !!c && c.state === 'playing';
}

/**
 * Dip a playing one-shot (the handle audio.sfx() returns) by `db` while a voice clip plays, and bring
 * it back after. Returns off(); it also ends with the sound.
 */
export function duckUnderVoice(ctx, h, { db = 6 } = {}) {
  const world = ctx?.world;
  const a = ctx?.audio;
  if (!h?.gain || !world?.onUpdate || !a?.ok) return () => {};
  const base = h.gain.gain.value;
  const low = base * Math.pow(10, -Math.abs(db) / 20);
  let on = false;
  let off = world.onUpdate(() => {
    const s = speaking(ctx);
    if (s === on) return;
    on = s;
    h.gain.gain.cancelScheduledValues(a.t);
    h.gain.gain.setTargetAtTime(on ? low : base, a.t, on ? 0.04 : 0.15);
  });
  const stop = () => {
    off?.();
    off = null;
  };
  h.ended?.then(stop);
  return stop;
}

/**
 * Freewheel ticking that follows a bikeRig (src/world/bikeRig.js) rear wheel: the loop's gain and
 * playbackRate come from the measured wheel speed (rev/s), so a hand turn, a spin on the stand and a
 * walk beside its rider all tick at their own pace. When a free spin is let go (setSpin(0) from a spin
 * over 0.3 rev/s) the recorded coast-down plays instead and fades out as the wheel stops.
 * opts: { volume = 0.25, pos (Object3D | [x,y,z]; default the rear wheel), ref = 1.5, coast = 0.3 }.
 * Returns { dispose() }.
 */
export function wheelSound(ctx, rig, { volume = 0.25, pos, ref = 1.5, coast: coastVol = 0.3 } = {}) {
  const audio = ctx?.audio;
  const st = rig?.st;
  if (!audio?.loopSfx || !st || !ctx.world?.onUpdate) return { dispose() {} };
  const where = pos ?? rig.rear ?? rig.group;
  let loop = null;
  let last = st.angle;
  let speed = 0;
  let prevTarget = st.manual ? 0 : st.spinTarget;
  let coast = null; // the coast-down one-shot while it plays
  let heard = false;
  const off = ctx.world.onUpdate((dt, raw) => {
    const step = raw || dt;
    if (!(step > 0)) return;
    const w = Math.abs(st.angle - last) / step / TAU;
    last = st.angle;
    speed += (Math.min(w, 4) - speed) * (1 - Math.exp(-12 * step));
    const target = st.manual ? 0 : st.spinTarget;
    if (!coast && !st.manual && prevTarget > 0.3 && target === 0 && speed > 0.3) {
      coast = audio.sfx('freewheel_coastdown', { volume: coastVol, pos: where, ref, fallback: false });
      if (coast) {
        duckUnderVoice(ctx, coast, { db: 6 });
        coast.ended.then(() => (coast = null));
      }
    }
    prevTarget = target;
    if (coast && speed < 0.04) {
      coast.stop(0.6);
      coast = null;
    }
    const k = coast ? 0 : clamp(speed / 0.5, 0, 1);
    if (!loop && k > 0.02) loop = audio.loopSfx('freewheel_tick', { volume: 0, bus: 'fx', fade: 0.05, pos: where, ref });
    if (!loop) return;
    const v = volume * k * (speaking(ctx) ? 0.6 : 1);
    loop.set(v, clamp(0.5 + speed * 0.9, 0.5, 1.5), 0.08);
    // Debug log: once each time the ticking becomes audible (hysteresis 0.05 / 0.02).
    if (!heard && v > 0.05) {
      heard = true;
      audio.logEvent?.('loopOn', 'freewheel_tick', { gain: +v.toFixed(3), rate: +clamp(0.5 + speed * 0.9, 0.5, 1.5).toFixed(2), spin: +speed.toFixed(2) });
    } else if (heard && v < 0.02) heard = false;
  });
  return {
    get speed() {
      return speed;
    },
    dispose() {
      off();
      loop?.stop(0.25);
      loop = null;
      coast?.stop(0.4);
      coast = null;
    },
  };
}

/** The swirl after a paint drop: a 0.4 s slice of paint_stir_loop from a random offset, 60 ms fades. */
export function stirSlice(audio, { volume = 0.3, delay = 0, secs = 0.4 } = {}) {
  if (!audio?.sfx) return null;
  const h = audio.sfx('paint_stir_loop', { volume, delay, offset: Math.random() * 5.4, jitter: 0.05, fallback: false });
  if (!h || !audio.ok) return h;
  const g = h.gain.gain;
  const t = audio.t + Math.max(0, delay);
  g.cancelScheduledValues(0);
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(volume, t + 0.06);
  g.setValueAtTime(volume, t + secs - 0.06);
  g.linearRampToValueAtTime(0, t + secs);
  try {
    h.src.stop(t + secs + 0.02);
  } catch {
    /* already stopped */
  }
  return h;
}
