import { assetUrl } from './Assets.js';

// WebAudio graph:
//   music / ambience / drone / steps / heartbeat -> bus -> master -> destination
//   gun / snap / thud / tone / noise / craft sfx  -> fx  -> master   (tone/noise take bus:'bus' too)
// cut() silences the bus only, so a snap can still play over the silence.
// Every method is safe before the user gesture (the context just stays suspended).

const FILES = {
  contemplation: 'audio/contemplation.mp3',
  piano: ['audio/piano.ogg', 'audio/piano.wav'], // the WAV only when the fetch had no ffmpeg
  rain: 'audio/rain.ogg',
  crowd: 'audio/crowd.ogg',
};
const STEP_SURFACES = ['concrete']; // the boot's clump is procedural

export class AudioSys {
  constructor() {
    this.ok = false;
    this.muted = false;
    this.unlocked = false;
    this._buffers = new Map(); // name -> Promise<AudioBuffer|null>
    this._music = null; // { name, src, gain }
    this._amb = new Map(); // name -> { src, gain, filter }
    this._drone = null;
    this._paused = false;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.bus = this.ctx.createGain();
      this.bus.connect(this.master);
      this.fx = this.ctx.createGain();
      this.fx.connect(this.master);
      this._noise = this._makeNoise(2, 'white');
      this._brown = this._makeNoise(4, 'brown');
      this.ok = true;
    } catch (err) {
      console.warn('[audio] WebAudio unavailable', err);
    }
  }

  get t() {
    return this.ok ? this.ctx.currentTime : 0;
  }

  /** Call from a real user gesture (title click). */
  resume() {
    if (!this.ok) return;
    this.unlocked = true;
    if (!this._paused && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  setPaused(p) {
    this._paused = p;
    if (!this.ok || !this.unlocked) return;
    if (p) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(m) {
    this.muted = !!m;
    if (!this.ok) return;
    this.master.gain.cancelScheduledValues(this.t);
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.t, 0.03);
  }

  /**
   * Start fetching music/ambience files in the background (default: all of them), plus the footstep
   * samples. Each file is fetched once; music() and ambience() load anything not preloaded on demand.
   */
  preload(names = Object.keys(FILES)) {
    for (const name of names) if (FILES[name]) this._buffer(name);
    for (const s of STEP_SURFACES) for (let i = 0; i < 5; i++) this._buffer(`step_${s}_${i}`);
  }

  _buffer(name) {
    if (!this.ok) return Promise.resolve(null);
    if (!this._buffers.has(name)) {
      let paths = [FILES[name]].flat();
      const m = name.match(/^step_(\w+)_(\d)$/);
      if (m) paths = [`audio/footstep_${m[1]}_00${m[2]}.ogg`];
      // Each candidate in turn (a missing or undecodable file falls through to the next).
      const load = (i) =>
        fetch(assetUrl(paths[i]))
          .then((r) => {
            if (!r.ok) throw new Error(r.status + ' ' + paths[i]);
            return r.arrayBuffer();
          })
          .then((ab) => this.ctx.decodeAudioData(ab))
          .catch((err) => {
            if (i + 1 < paths.length) return load(i + 1);
            console.warn('[audio] could not load', paths[i], err?.message || err);
            return null;
          });
      const p = load(0);
      this._buffers.set(name, p);
    }
    return this._buffers.get(name);
  }

  // ------------------------------------------------------------- music / ambience

  /**
   * Cross-fade to a music bed. name: 'contemplation' | 'piano' | null (fade out).
   * opts: { volume=0.45, fade=2.5, loop=true }
   */
  async music(name, { volume = 0.45, fade = 2.5, loop = true } = {}) {
    if (!this.ok) return;
    if (this._music && this._music.name === name) {
      this._ramp(this._music.gain.gain, volume, fade);
      return;
    }
    const old = this._music;
    this._music = null;
    if (old) this._stopVoice(old, fade);
    if (!name) return;
    const token = {};
    this._musicToken = token;
    const buf = await this._buffer(name);
    if (!buf || this._musicToken !== token) return;
    const voice = this._loop(buf, { loop });
    voice.name = name;
    voice.gain.gain.value = 0;
    this._ramp(voice.gain.gain, volume, fade);
    this._music = voice;
  }

  /**
   * Looped ambience on/off. name: 'rain' | 'crowd'.
   * opts: { volume (rain 0.35, crowd 0.5), fade=2, lowpass (Hz; crowd defaults to 900) }
   */
  async ambience(name, on = true, opts = {}) {
    if (!this.ok) return;
    const fade = opts.fade ?? 2;
    const cur = this._amb.get(name);
    if (!on) {
      if (cur) {
        this._amb.delete(name);
        this._stopVoice(cur, fade);
      }
      return;
    }
    const volume = opts.volume ?? (name === 'crowd' ? 0.5 : 0.35);
    if (cur?.pending) {
      // Still loading: remember the latest request; it is applied once the buffer arrives.
      Object.assign(cur, { volume, fade, lowpass: opts.lowpass ?? cur.lowpass });
      return;
    }
    if (cur) {
      this._ramp(cur.gain.gain, volume, fade);
      if (opts.lowpass && cur.filter) cur.filter.frequency.setTargetAtTime(opts.lowpass, this.t, 0.3);
      return;
    }
    const placeholder = { pending: true, volume, fade, lowpass: opts.lowpass };
    this._amb.set(name, placeholder);
    const buf = await this._buffer(name);
    if (this._amb.get(name) !== placeholder) return; // turned off (or cut) while loading
    if (!buf) {
      this._amb.delete(name); // load failed: allow a later retry instead of a stuck placeholder
      return;
    }
    const lowpass = placeholder.lowpass ?? (name === 'crowd' ? 900 : null);
    const voice = this._loop(buf, { lowpass });
    voice.gain.gain.value = 0;
    this._ramp(voice.gain.gain, placeholder.volume, placeholder.fade);
    this._amb.set(name, voice);
  }

  /** Turn every ambience off (and optionally the music). */
  stopAll({ fade = 1.5, music = true } = {}) {
    for (const name of [...this._amb.keys()]) this.ambience(name, false, { fade });
    if (music) this.music(null, { fade });
  }

  _loop(buf, { loop = true, lowpass = null } = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    const gain = this.ctx.createGain();
    let filter = null;
    if (lowpass) {
      filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      src.connect(filter).connect(gain);
    } else src.connect(gain);
    gain.connect(this.bus);
    src.start();
    return { src, gain, filter };
  }

  _stopVoice(v, fade) {
    if (!v || v.pending || !v.gain) return;
    this._ramp(v.gain.gain, 0, fade);
    try {
      v.src.stop(this.t + fade + 0.1);
    } catch {
      /* already stopped */
    }
  }

  _ramp(param, to, secs) {
    const t = this.t;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(to, t + Math.max(0.01, secs));
  }

  // ------------------------------------------------------------- one-shots

  /** Footstep sample. surface: 'concrete' (anything else falls back to it). opts: { volume=0.35, rate } */
  async footstep(surface = 'concrete', { volume = 0.35, rate } = {}) {
    if (!this.ok || this.ctx.state !== 'running') return;
    if (!STEP_SURFACES.includes(surface)) surface = 'concrete';
    const buf = await this._buffer(`step_${surface}_${(Math.random() * 5) | 0}`);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate ?? 0.9 + Math.random() * 0.2;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.bus);
    src.start();
  }

  /** Two decaying 55 Hz thumps. */
  heartbeat({ volume = 0.9 } = {}) {
    if (!this.ok) return;
    const t = this.t;
    for (const [dt, v] of [[0, 1], [0.24, 0.7]]) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(62, t + dt);
      o.frequency.exponentialRampToValueAtTime(42, t + dt + 0.25);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(volume * v, t + dt + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.32);
      o.connect(g).connect(this.bus);
      o.start(t + dt);
      o.stop(t + dt + 0.4);
    }
  }

  /** Starting gun: highpassed noise crack, ~80 ms, plus a short tail. */
  gun({ volume = 1 } = {}) {
    if (!this.ok) return;
    this._noiseBurst({ type: 'highpass', freq: 1200, q: 0.7, dur: 0.08, volume, tail: 0.35 });
  }

  /** The tendon: a dull bandpassed click at 1.8 kHz, 40 ms. */
  snap({ volume = 0.9 } = {}) {
    if (!this.ok) return;
    this._noiseBurst({ type: 'bandpass', freq: 1800, q: 4, dur: 0.04, volume, tail: 0.06 });
  }

  /** A low body thud (a fall), ~0.5 s. On the fx bus, so it plays through cut(). */
  thud({ volume = 0.45 } = {}) {
    if (!this.ok) return;
    const t = this.t;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(72, t);
    o.frequency.exponentialRampToValueAtTime(36, t + 0.32);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(this.fx);
    o.start(t);
    o.stop(t + 0.55);
  }

  // ------------------------------------------------------------- procedural one-shots (HAIRLINE)

  _out(bus) {
    return bus === 'bus' ? this.bus : this.fx;
  }

  /**
   * Pitch-ramped oscillator. opts: { freq, to (end freq, default freq), dur, type='sine', volume=0.3,
   * bus='fx' | 'bus', attack=0.01, delay=0 } — 'fx' plays through cut(), 'bus' is silenced by it.
   */
  tone({ freq = 440, to, dur = 0.3, type = 'sine', volume = 0.3, bus = 'fx', attack = 0.01, delay = 0 } = {}) {
    if (!this.ok) return;
    const t = this.t + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, freq), t);
    if (to !== undefined && to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + Math.min(attack, dur * 0.5));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this._out(bus));
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /**
   * Filtered white-noise burst. opts: { type='bandpass', freq=1000, q=1, dur=0.2, volume=0.3,
   * tail=0.05, bus='fx' | 'bus', delay=0, attack=0, brown=false (low rumble source) }
   */
  noise({ type = 'bandpass', freq = 1000, q = 1, dur = 0.2, volume = 0.3, tail = 0.05, bus = 'fx', delay = 0, attack = 0, brown = false } = {}) {
    if (!this.ok) return;
    this._noiseBurst({ type, freq, q, dur, volume, tail, bus, delay, brown, attack });
  }

  /** A blow through the floor: low-passed thump + a dull knock. */
  hammer({ volume = 0.5 } = {}) {
    if (!this.ok) return;
    this.tone({ freq: 95, to: 48, dur: 0.22, volume: volume * 0.9, attack: 0.004, bus: 'bus' });
    this.noise({ type: 'lowpass', freq: 420, q: 0.7, dur: 0.03, volume: volume * 0.8, tail: 0.12, bus: 'bus', brown: true });
  }

  /** Sandpaper / brush stroke: a short band-passed hiss with a soft attack. */
  scrape({ volume = 0.22, freq } = {}) {
    if (!this.ok) return;
    const f = freq ?? 2400 + Math.random() * 900;
    this.noise({ type: 'bandpass', freq: f, q: 1.4, dur: 0.16, volume, tail: 0.1, attack: 0.05 });
  }

  /** Rim rub on a brake pad / a camera shutter: a tiny dry click. */
  tick({ volume = 0.25 } = {}) {
    if (!this.ok) return;
    this.noise({ type: 'highpass', freq: 3200, q: 0.8, dur: 0.012, volume, tail: 0.02 });
  }

  /** Spoke key on a tight spoke: a short metallic ping. */
  ping({ volume = 0.18, freq = 1320 } = {}) {
    if (!this.ok) return;
    this.tone({ freq, to: freq * 0.985, dur: 0.45, type: 'triangle', volume, attack: 0.002 });
    this.tone({ freq: freq * 2.76, dur: 0.18, type: 'sine', volume: volume * 0.35, attack: 0.002 });
  }

  /** Velcro strap: a rough tearing noise (~0.35 s) with a crackle. */
  rip({ volume = 0.3 } = {}) {
    if (!this.ok) return;
    for (let i = 0; i < 7; i++) {
      this.noise({ type: 'bandpass', freq: 1400 + Math.random() * 1800, q: 2.5, dur: 0.03, volume: volume * (0.6 + Math.random() * 0.4), tail: 0.02, delay: i * 0.045 });
    }
    this.noise({ type: 'highpass', freq: 900, q: 0.5, dur: 0.3, volume: volume * 0.35, tail: 0.06 });
  }

  /** The watch buzzing on a wrist: two 180 Hz square pulses, low-passed. */
  buzz({ volume = 0.18 } = {}) {
    if (!this.ok) return;
    const t = this.t;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    f.connect(this.fx);
    for (const dt of [0, 0.22]) {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 180;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(volume, t + dt + 0.01);
      g.gain.setValueAtTime(volume, t + dt + 0.13);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.16);
      o.connect(g).connect(f);
      o.start(t + dt);
      o.stop(t + dt + 0.2);
    }
  }

  _noiseBurst({ type, freq, q, dur, volume, tail, bus = 'fx', delay = 0, brown = false, attack = 0 }) {
    const t = this.t + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = brown ? this._brown : this._noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    const v = Math.max(0.0002, volume);
    if (attack > 0) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + Math.min(attack, dur * 0.8));
    } else g.gain.setValueAtTime(v, t);
    g.gain.setValueAtTime(v, t + Math.max(dur * 0.5, attack));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + tail);
    src.connect(f).connect(g).connect(this._out(bus));
    src.start(t, Math.random());
    src.stop(t + dur + tail + 0.05);
  }

  /** Mood drone, called every frame by Mood. Two detuned saws through a lowpass at 300 + 1500*hope. */
  drone(hope = 0, { volume = 0.035 } = {}) {
    if (!this.ok) return;
    if (!this._drone) {
      const g = this.ctx.createGain();
      g.gain.value = 0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 0.6;
      const oscs = [55, 55 * 1.007, 82.5].map((hz, i) => {
        const o = this.ctx.createOscillator();
        o.type = i === 2 ? 'triangle' : 'sawtooth';
        o.frequency.value = hz;
        o.connect(f);
        o.start();
        return o;
      });
      f.connect(g).connect(this.bus);
      this._drone = { g, f, oscs, vol: volume, lastHope: -1 };
      g.gain.setTargetAtTime(volume, this.t, 2);
    }
    const d = this._drone;
    const h = Math.max(0, Math.min(1.5, hope));
    if (Math.abs(h - d.lastHope) > 0.002) {
      d.lastHope = h;
      d.f.frequency.setTargetAtTime(300 + 1500 * h, this.t, 0.4);
    }
    if (volume !== d.vol) {
      d.vol = volume;
      d.g.gain.setTargetAtTime(volume, this.t, 0.5);
    }
  }

  /** Hard cut: ramps the music/ambience bus to 0 in 50 ms and stops beds. One-shots on fx still play. */
  cut() {
    if (!this.ok) return;
    const t = this.t;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.linearRampToValueAtTime(0, t + 0.05);
    for (const name of [...this._amb.keys()]) {
      const v = this._amb.get(name);
      this._amb.delete(name);
      try {
        v.src?.stop(t + 0.06);
      } catch {
        /* noop */
      }
    }
    if (this._music) {
      try {
        this._music.src.stop(t + 0.06);
      } catch {
        /* noop */
      }
      this._music = null;
    }
    this._musicToken = null;
    this.isCut = true;
  }

  /** Undo cut(): fade the bus back in. Called by the Director on every chapter start. */
  restore(fade = 0.8) {
    if (!this.ok) return;
    this.isCut = false;
    this._ramp(this.bus.gain, 1, fade);
  }

  _makeNoise(secs, kind) {
    const len = Math.floor(this.ctx.sampleRate * secs);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }
}
