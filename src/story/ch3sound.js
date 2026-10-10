// Ch3 "The Long Run": recorded sound (docs/assets/sfx.md, Integration "Ch3"). ch3.js drives it.
//
//   steps          one run_step per A/D press (0.3, 0.24 when the body does it), run_step_wet in the rain
//                  weeks (Week 20 0.32 at rate 0.92, Week 31 0.3); after the crack the bad step is
//                  run_step at rate 0.8 (0.4) + body_thud (0.15).
//   breath         breath_run_loop (loopSfx on 'bus'): 0.15-0.35 and rate 0.95-1.1 from the cadence;
//                  after the crack rate 1.1, +3 dB. Silent over the black cuts. cut() stops it (it is on
//                  the bus), so afterCrack() starts a new one.
//   weeks          amb_dawn_birds (Week 9 0.25, Week 20 0.12, Week 31 off) + amb_city_far 0.2 (the ring road);
//                  rain stays the Director's rain.ogg (ch3.js sets its level per block).
//   race           amb_marathon_crowd 0.55 low-passed 1400 Hz (replaces crowd.ogg in Ch3); 0.14 at 900 Hz
//                  after the crack. crowd_cheer_pass 0.35 at each KM board (out over 2 s after 6 s).
//   crack          crack_pencil_lead on fx (survives cut()) at 0.5, low-passed 3 kHz; ch3.js keeps the whine.
//   finish         breath_tired 0.35 over black.
//
// Voices (docs/voice.md): while a clip is being said, the breath steps back 4 dB, the steps 3 dB and a
// cheer 5 dB (the beds are ducked by the voice runtime itself).

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BIRDS = [0.25, 0.12, 0];
const CITY_FAR = 0.2;
const CROWD = 'amb_marathon_crowd';
const CHEER_VOL = 0.35;

/** Recorded sets Ch3 plays (the chapter's `sounds`). */
export const CH3_SOUNDS = [
  'run_step',
  'run_step_wet',
  'body_thud',
  'breath_run_loop',
  'amb_dawn_birds',
  'amb_city_far',
  CROWD,
  'crowd_cheer_pass',
  'crack_pencil_lead',
  'breath_tired',
  'pawl_click', // R4: the old man's freewheel on the far kerb, Week 31 (scene3/oldman.js)
];

export function runSound(ctx) {
  const audio = ctx.audio;
  const speaking = () => ctx.voice?.cur?.state === 'playing';
  let surface = { name: 'run_step', volume: 0.3, rate: 1 };
  let breath = null;
  let quiet = false; // over a black cut
  let limp = false;
  let rateS = 0; // smoothed cadence (alternations/s)
  const cheers = new Set();
  const cheerOffsets = []; // shuffled start points in crowd_cheer_pass (s)
  let cheerN = 0;

  const startBreath = (rate = 1) => {
    breath?.stop(0.2);
    breath = audio.loopSfx('breath_run_loop', { volume: 0, rate, bus: 'bus', fade: 0.6 });
  };

  return {
    /** One footfall (rhythm onStroke). bad: the left stride after the crack. */
    step(s, { bad = false } = {}) {
      if (limp) {
        if (bad) {
          audio.sfx('run_step', { volume: 0.4, rate: 0.8, bus: 'bus', jitter: 0.04, fallback: (a) => a.footstep('concrete', { volume: 0.4, rate: 0.8 }) });
          audio.sfx('body_thud', { volume: 0.15, bus: 'bus', lowpass: 900, fallback: (a) => a.thud({ volume: 0.08 }) });
        } else audio.sfx('run_step', { volume: 0.3, bus: 'bus', jitter: 0.06 });
        return;
      }
      // Under a line being said the feet step back 3 dB (they stay the cadence feedback).
      const v = (s.auto ? surface.volume * 0.8 : surface.volume) * (speaking() ? 0.7 : 1);
      audio.sfx(surface.name, { volume: v, rate: surface.rate, bus: 'bus', jitter: 0.06, fallback: (a) => a.footstep('concrete', { volume: v, rate: 0.95 + Math.random() * 0.12 }) });
    },

    /** Per frame. rate: the cadence (0 while a STRIDE menu is up: he keeps running at the floor). */
    update(dt, { rate = 0, running = true } = {}) {
      if (!breath?.playing) return;
      rateS += (rate - rateS) * (1 - Math.exp(-2 * dt));
      const k = clamp((rateS - 1.6) / 2, 0, 1); // 1.6/s -> 0, 3.6/s (mashing) -> 1
      let vol = limp ? 0.3 * 1.41 : 0.15 + 0.2 * k;
      if (quiet || !running) vol = 0;
      else if (speaking()) vol *= 0.63;
      breath.set(+vol.toFixed(3), limp ? 1.1 : +(0.95 + 0.15 * k).toFixed(3), 0.5);
      if (cheers.size) {
        const g = speaking() ? 0.56 : 1;
        for (const c of cheers) {
          if (c.g === g || c.out) continue;
          c.g = g;
          c.h.gain.gain.setTargetAtTime(CHEER_VOL * g, audio.t, 0.15);
        }
      }
    },

    /** Training block i (0..2): beds and the road surface. */
    week(i, fade = 1.2) {
      surface = i === 0 ? { name: 'run_step', volume: 0.3, rate: 1 } : i === 1 ? { name: 'run_step_wet', volume: 0.32, rate: 0.92 } : { name: 'run_step_wet', volume: 0.3, rate: 1 };
      audio.ambience('amb_dawn_birds', BIRDS[i] > 0, { volume: BIRDS[i], fade });
      audio.ambience('amb_city_far', true, { volume: CITY_FAR, fade });
      if (!breath?.playing) startBreath();
    },

    /** A black cut between blocks: the breath goes under with the picture. */
    hush(on) {
      quiet = on;
    },

    /** Sunday (behind the black): weeks' beds out, the marathon crowd in. */
    race() {
      surface = { name: 'run_step', volume: 0.3, rate: 1 };
      audio.ambience('amb_dawn_birds', false, { fade: 0.6 });
      audio.ambience('amb_city_far', false, { fade: 0.6 });
      audio.ambience(CROWD, true, { volume: 0.55, fade: 1.5, lowpass: 1400 });
    },

    /** Spectators clapping at a KM board (start it ~6 m before the board: the file swells for ~2 s). */
    cheer() {
      // One 20 s take for three boards: each starts at a different place in it (the first swell, or
      // mid-applause eased in over 1.2 s), a slightly different speed, the clapping on alternate sides.
      if (!cheerOffsets.length) cheerOffsets.push(...[1.5, 6.5, 11.5].sort(() => Math.random() - 0.5));
      const offset = cheerOffsets.pop();
      const pan = (cheerN++ % 2 ? 1 : -1) * (0.2 + Math.random() * 0.15);
      const h = audio.sfx('crowd_cheer_pass', { volume: CHEER_VOL, bus: 'bus', offset, pan, jitter: 0.04, fallback: false });
      if (!h) return;
      if (offset > 2) {
        h.gain.gain.setValueAtTime(0.0001, audio.t);
        h.gain.gain.linearRampToValueAtTime(CHEER_VOL, audio.t + 1.2);
      }
      const c = { h, g: 1, out: false };
      cheers.add(c);
      h.ended.then(() => cheers.delete(c));
      ctx.engine.after(6, () => {
        c.out = true;
        h.stop(2);
      });
    },

    /** KM 31 (right after audio.cut()): the snap on fx; the bus one-shots and the breath are gone. */
    crack() {
      for (const c of cheers) c.h.stop(0.05); // or restore() would bring the clapping back
      cheers.clear();
      breath?.stop(0.05);
      breath = null;
      audio.sfx('crack_pencil_lead', { volume: 0.5, lowpass: 3000, bus: 'fx' });
    },

    /** After restore(): the crowd comes back thin, the breathing ragged. */
    afterCrack() {
      limp = true;
      audio.ambience(CROWD, true, { volume: 0.14, fade: 2.5, lowpass: 900 });
      startBreath(1.1);
    },

    /** The fade to black at the end of the limp. */
    finish(fade = 1.4) {
      audio.ambience(CROWD, false, { fade });
      breath?.stop(fade * 0.8);
      breath = null;
      audio.sfx('breath_tired', { volume: 0.35, bus: 'bus', delay: 0.3, fallback: false });
    },

    /** Chapter end / safety: nothing of the run outlives it. */
    stop(fade = 0.5) {
      breath?.stop(fade);
      breath = null;
      for (const c of cheers) c.h.stop(fade);
      cheers.clear();
      for (const n of ['amb_dawn_birds', 'amb_city_far', CROWD]) audio.ambience(n, false, { fade });
    },
  };
}
