import * as THREE from 'three';
import { craftPointer } from './pointer.js';

// Odile's radio (docs/DESIGN.md R3.8b): a dial over four stations, static between them, talk voices
// made of a sawtooth through two wandering formants and a syllable gate, the Ch4 workshop track as
// the music station, all through one tinny radio band. tuneRadio() is the craft; radioVoice() is
// the sound, alive from the scene build to its dispose (it plays on through the golden walk).

const clamp = THREE.MathUtils.clamp;
const rand = (a, b) => a + Math.random() * (b - a);

/** Station positions on the dial (u 0..1). talk: voice pitch, syllable and gap scales. */
export const STATIONS = [
  { id: 'fishing', u: 0.16, talk: { f: 110, syl: 1.3, gap: 1.6 } },
  { id: 'music', u: 0.41 },
  { id: 'football', u: 0.64, talk: { f: 140, syl: 0.75, gap: 0.55 }, crowd: true },
  { id: 'forecast', u: 0.87, talk: { f: 190, syl: 1, gap: 1 } },
];
// Recorded radio-category files (-26 LUFS) are ~12 dB under the procedural static through the band
// (measured offline: noise -15.2 dBFS, radio_static -27.1 dBFS RMS): REC_STATIC is that difference, so
// the doc's volumes (static 'as now', sweep 0.5 x |du/dt|) sit on the same scale as the old noise.
const REC_STATIC = 4;
const WIDTH = 0.06; // a station's signal falls to 0 this far off it
const CATCH = 0.02; // the needle rests within this of a station to find it
const DWELL = 0.8;

/** Signal 0..1 of station `s` with the needle at u. */
export const signalAt = (u, s) => clamp(1 - Math.abs(u - s.u) / WIDTH, 0, 1);

/**
 * radioVoice(audio) -> {set(u), music(on), level(g, secs), update(), dispose()}
 * Static (white noise, bandpass 2500 Hz), three talk stations, the music station and a crowd under the
 * football, all through a final radio band (highpass 300, lowpass 3400) into audio.bus. set(u) moves
 * the needle; music(true) locks it on the music; level() is the set's own volume (distance, done).
 */
export function radioVoice(audio) {
  const stub = { u: 0.16, set() {}, music() {}, level() {}, update() {}, dispose() {} };
  if (!audio?.ok) return stub;
  const ac = audio.ctx;
  const T = () => ac.currentTime;
  const nodes = [];
  const sources = [];
  const node = (n) => (nodes.push(n), n);
  const biquad = (type, freq, q = 0.7) => {
    const f = node(ac.createBiquadFilter());
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  };
  const gain = (v = 0) => {
    const g = node(ac.createGain());
    g.gain.value = v;
    return g;
  };
  const to = (param, v, tc = 0.06) => param.setTargetAtTime(v, T(), tc);

  // The radio band and the set's volume. Out through the beds (audio._bedBus): a voice clip ducks the
  // set like the music, so Odile's lines by her chair read over it.
  const hp = biquad('highpass', 300);
  const lp = biquad('lowpass', 3400);
  const out = gain(0);
  hp.connect(lp).connect(out).connect(audio._bedBus?.() ?? audio.bus);

  // Static: white noise (bandpass 2500 Hz) until the recorded radio_static loop (docs/assets/sfx.md Ch5)
  // is decoded, then that loop at the same gain (staticGain follows the dial either way).
  const len = Math.floor(ac.sampleRate * 1.5);
  const nb = ac.createBuffer(1, len, ac.sampleRate);
  const ch = nb.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const ns = ac.createBufferSource();
  ns.buffer = nb;
  ns.loop = true;
  const staticGain = gain(0.04);
  const synthStatic = gain(1);
  ns.connect(biquad('bandpass', 2500, 0.6)).connect(synthStatic).connect(staticGain).connect(hp);
  ns.start();
  sources.push(ns);
  const recStatic = gain(0);
  recStatic.connect(staticGain);
  // Tuning across the band while the dial moves: radio_tune_sweep, gain 0.5 x |du/dt| (normalised to
  // the key speed, 0.22/s), through the same band.
  const sweepGain = gain(0);
  sweepGain.connect(hp);
  let lastU = null;
  let lastT = 0;
  let sweep = 0;
  let sweepHeard = false; // debug log: once each time the sweep comes up

  // Talk: sawtooth -> two formants (q 6) -> syllable gate -> station gain.
  const voices = STATIONS.filter((s) => s.talk).map((s) => {
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = s.talk.f;
    const f1 = biquad('bandpass', 650, 6);
    const f2 = biquad('bandpass', 1500, 6);
    const f2g = gain(0.6);
    const gate = gain(0);
    const st = gain(0);
    osc.connect(f1).connect(gate);
    osc.connect(f2).connect(f2g).connect(gate);
    gate.connect(st).connect(hp);
    osc.start();
    sources.push(osc);
    return { s, osc, f1, f2, gate, st, next: 0 };
  });
  const syllables = () => {
    const now = T();
    for (const v of voices) {
      if (v.next > now + 0.15) continue;
      const t = Math.max(v.next, now + 0.02);
      const k = v.s.talk;
      const dur = rand(0.12, 0.28) * k.syl;
      const gap = Math.random() < 0.12 ? rand(0.4, 0.9) * k.gap : rand(0.05, 0.4) * k.gap;
      const f = k.f * rand(0.88, 1.18);
      v.osc.frequency.setTargetAtTime(f, t, 0.04);
      v.f1.frequency.setTargetAtTime(rand(500, 800), t, 0.05);
      v.f2.frequency.setTargetAtTime(rand(1200, 1800), t, 0.07);
      v.gate.gain.setTargetAtTime(3.2, t, 0.015);
      v.gate.gain.setTargetAtTime(0, t + dur, 0.03);
      v.next = t + dur + gap;
    }
  };

  // Music (the Ch4 workshop track, thin) and the crowd under the football: started when decoded.
  const musicGain = gain(0);
  const mhp = biquad('highpass', 380);
  const mlp = biquad('lowpass', 3200);
  mhp.connect(mlp).connect(musicGain).connect(hp);
  const crowdGain = gain(0);
  crowdGain.connect(hp);
  let dead = false;
  const loop = (name, dest) =>
    Promise.resolve(audio.buffer?.(name))
      .then((buf) => {
        if (!buf || dead) return;
        const src = ac.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(dest);
        src.start();
        sources.push(src);
        return src;
      })
      .catch(() => null);
  loop('contemplation', mhp);
  loop('crowd', crowdGain);
  // Recorded static: a crossfade from the white noise once it is decoded (REC_STATIC matches its level
  // through the band to the noise it replaces: the file is normalised to -26 LUFS).
  loop('radio_static', recStatic).then((src) => {
    if (dead || !src) return;
    to(synthStatic.gain, 0, 0.2);
    to(recStatic.gain, REC_STATIC, 0.2);
    audio.logEvent?.('loop', 'radio_static', { bus: 'beds', band: 'radio' });
  });
  loop('radio_tune_sweep', sweepGain).then((src) => {
    if (!dead && src) audio.logEvent?.('loop', 'radio_tune_sweep', { bus: 'beds', band: 'radio', gain: 0 });
  });
  // Talk stations hushed while a voice clip of that station plays (the clip is its voice).
  let hushUntil = 0;

  let locked = false;
  const api = {
    u: 0.16,
    /** Needle at u: each station's signal, static where none comes through. */
    set(u) {
      // Dial speed -> the tuning sweep (a moving needle crosses whistles and fragments).
      const now = T();
      if (lastU != null && now > lastT) {
        const v = Math.abs(u - lastU) / Math.max(1 / 120, now - lastT);
        sweep += (clamp(v / 0.22, 0, 1.5) - sweep) * Math.min(1, (now - lastT) * 10);
      }
      lastU = u;
      lastT = now;
      api.u = u;
      to(sweepGain.gain, locked ? 0 : 0.5 * REC_STATIC * sweep, 0.05);
      if (!sweepHeard && !locked && sweep > 0.3) {
        sweepHeard = true;
        audio.logEvent?.('loopOn', 'radio_tune_sweep', { gain: +(0.5 * sweep).toFixed(2), speed: +(sweep * 0.22).toFixed(3), u: +u.toFixed(3) });
      } else if (sweepHeard && sweep < 0.05) sweepHeard = false;
      if (locked) return;
      let best = 0;
      for (const s of STATIONS) {
        const k = signalAt(u, s);
        best = Math.max(best, k);
        const g = k * k;
        if (s.id === 'music') to(musicGain.gain, 0.9 * g);
        if (s.crowd) to(crowdGain.gain, 0.3 * g);
        const v = voices.find((x) => x.s === s);
        if (v) to(v.st.gain, now < hushUntil ? 0.06 * g : 0.5 * g);
      }
      to(staticGain.gain, 0.25 * (1 - best) + 0.03);
    },
    /** Lock it on the music (true), or hand it back to the needle. */
    music(on) {
      locked = !!on;
      if (!locked) return api.set(api.u);
      for (const v of voices) to(v.st.gain, 0, 0.3);
      to(crowdGain.gain, 0, 0.3);
      to(staticGain.gain, 0.012, 0.3);
      to(musicGain.gain, 0.9, 0.3);
    },
    /** Hold the formant talk low for `secs` (a voice clip of the station is playing). */
    hush(secs) {
      hushUntil = Math.max(hushUntil, T() + secs);
      api.set(api.u);
    },
    /** The station's clip stopped early (tuned away): its formant talk comes back now. */
    unhush() {
      if (!hushUntil) return;
      hushUntil = 0;
      api.set(api.u);
    },
    /** The set's volume (0..1), eased over `secs`. */
    level(g, secs = 0.15) {
      to(out.gain, Math.max(0, g), secs / 3);
    },
    /** Keep the voices talking (call once a frame). */
    update() {
      if (dead || ac.state !== 'running') return;
      syllables();
      // The needle at rest: the sweep dies away (set() is only called while something moves it).
      if (lastU != null && T() - lastT > 0.08 && sweep > 0) {
        sweep = sweep < 0.02 ? 0 : sweep * 0.8;
        if (sweep < 0.05) sweepHeard = false;
        to(sweepGain.gain, 0.5 * REC_STATIC * sweep, 0.05);
      }
      if (hushUntil && T() >= hushUntil) {
        hushUntil = 0;
        api.set(api.u);
      }
    },
    dispose() {
      if (dead) return;
      dead = true;
      try {
        out.gain.cancelScheduledValues(T());
        out.gain.setTargetAtTime(0, T(), 0.05);
      } catch {
        /* closed */
      }
      for (const s of sources) {
        try {
          s.stop(T() + 0.3);
        } catch {
          /* already stopped */
        }
      }
      setTimeout(() => {
        for (const n of nodes) n.disconnect?.();
        out.disconnect();
      }, 400);
    },
  };
  api.set(api.u);
  return api;
}

/**
 * tuneRadio(ctx, d, {radio, voice, text}) -> Promise<{skipped, found}>
 * radio: the prop (scene5/jobs.js: setDial(u), setSignal(k), flare(), mark(u), group). voice: a
 * radioVoice. text: L.ch7.jobs.radio ({hint, stations.{who, fishing, music, football, forecast}}).
 * A / D (arrows) turn the dial at 0.22/s, a drag 0.0012 per px, a scroll notch 0.012. A station is
 * found when the needle rests within 0.02 of it for 0.8 s: a chime, the lamp flares, a chalk tick, its
 * caption. Fishing is found from the start. Idle 6 s: the needle creeps to the nearest unfound one;
 * at 30 s the rest are found, 2 s apart. Ends when all four are found.
 */
export async function tuneRadio(ctx, d, { radio, voice, text, stations = STATIONS } = {}) {
  const { ui, input, audio, engine } = ctx;
  const found = new Set();
  const P = craftPointer(ctx);
  let u = voice?.u ?? stations[0].u;
  let dwell = null;
  let dwellT = 0;
  const s = { t: 0, idle: 0, autoAt: 0, glide: null, lastFind: 0 };
  const find = (st, quiet = false) => {
    if (found.has(st.id)) return;
    found.add(st.id);
    s.lastFind = s.t;
    radio.mark(st.u);
    if (quiet) return;
    audio.tone({ freq: 660, dur: 0.12, volume: 0.06 });
    audio.tone({ freq: 990, dur: 0.12, volume: 0.06, delay: 0.12 });
    radio.flare();
    const line = text?.stations?.[st.id];
    // The new station's caption replaces the one being said (the needle has left it), never queues.
    if (line) ui.thought(line, 2.6, { who: text.stations.who, replace: true });
  };
  // French voices: a station's caption clip is that station's voice. It hushes the set's formant
  // babble from the moment it really plays, and stops when the needle leaves the station.
  const lineOf = new Map(stations.map((st) => [text?.stations?.[st.id], st]).filter(([l]) => l));
  let said = null; // { clip, st, hushed }
  const trackVoice = () => {
    const c = ui._thoughtClip;
    if (c && c !== said?.clip && c.busy && lineOf.has(c.text)) said = { clip: c, st: lineOf.get(c.text), hushed: false };
    if (!said) return;
    const clip = said.clip;
    if (clip.state === 'playing' && !said.hushed) {
      said.hushed = true;
      voice?.hush?.(clip.remaining() + 0.3);
    }
    if (clip.busy && signalAt(u, said.st) < 0.3) clip.stop(0.15); // tuned away: the voice goes with it
    if (!clip.busy) {
      if (said.hushed) voice?.unhush?.();
      said = null;
    }
  };
  const speaking = () => !!said?.clip?.busy;
  find(stations[0], true); // "It still only gets the fishing."
  const fishing = text?.stations?.[stations[0].id];
  if (fishing) ui.thought(fishing, 2.6, { who: text.stations.who, replace: true }); // what it's playing as he kneels
  const unfound = () => stations.filter((st) => !found.has(st.id));
  const nearestUnfound = () => unfound().sort((a, b) => Math.abs(a.u - u) - Math.abs(b.u - u))[0];
  ui.prompt(text?.hint ?? null);
  const KEYS = ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'];

  const r = await d.until((dt) => {
    P.update();
    const raw = engine.rawDt || dt;
    s.t += raw;
    s.idle += raw;
    const dn = input.down;
    const kx = (dn.has('KeyD') || dn.has('ArrowRight') ? 1 : 0) - (dn.has('KeyA') || dn.has('ArrowLeft') ? 1 : 0);
    const touched = kx !== 0 || KEYS.some((k) => input.pressed.has(k)) || (P.down && P.dragX) || P.wheel !== 0;
    if (touched && s.t < 30) {
      s.idle = 0;
      s.glide = null;
    }
    if (s.t >= 30) {
      // The rest find themselves, 2 s apart (and never before the station being said has finished).
      if (!s.glide && s.t >= s.autoAt && !speaking()) {
        const st = nearestUnfound();
        if (st) s.glide = st;
      }
      if (s.glide) {
        u += clamp(s.glide.u - u, -1.2 * raw, 1.2 * raw);
        if (Math.abs(s.glide.u - u) < 1e-3) {
          u = s.glide.u;
          find(s.glide);
          s.glide = null;
          s.autoAt = s.t + 2;
        }
      }
    } else if (touched) {
      u += kx * 0.22 * raw;
      if (P.down) u += P.dragX * 0.0012;
      u += P.wheel * 0.012;
    } else {
      const st = s.idle >= 6 ? nearestUnfound() : null;
      if (st) u += clamp(st.u - u, -0.06 * raw, 0.06 * raw); // the assist creeps the needle over
      else {
        // Let go near a station and the needle settles onto it (the knob's own detent).
        const near = stations.find((x) => Math.abs(x.u - u) < 0.03);
        if (near) u += (near.u - u) * (1 - Math.exp(-6 * raw));
      }
    }
    u = clamp(u, 0, 1);
    voice?.set(u);
    radio.setDial(u);
    let best = 0;
    for (const st of stations) best = Math.max(best, signalAt(u, st));
    radio.setSignal(best);
    // Found: the needle rests on a station.
    const on = stations.find((st) => Math.abs(st.u - u) <= CATCH) || null;
    if (on !== dwell) {
      dwell = on;
      dwellT = 0;
    } else if (on && !found.has(on.id) && (dwellT += raw) >= DWELL) find(on);
    trackVoice();
    // A beat on the last caption, and its voice said to the end (at most 6 s).
    return found.size >= stations.length && s.t - s.lastFind >= 0.7 && (!speaking() || s.t - s.lastFind >= 6);
  });

  P.dispose();
  ui.prompt(null);
  const skipped = r === 'skipped';
  if (skipped) for (const st of stations) find(st, true);
  radio.setSignal(1);
  return { skipped, found: [...found] };
}
