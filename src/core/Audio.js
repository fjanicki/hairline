import { assetUrl } from './Assets.js';
import { SfxBank, SFX_BEDS } from './Sfx.js';
import { AudioDebug } from './AudioDebug.js';

// WebAudio graph:
//   music / ambience / drone / loopSfx on 'beds' -> beds (duck()) -> bus -> master -> limiter -> destination
//   steps / heartbeat / one-shots on 'bus'      -> bus
//   gun / snap / thud / tone / noise / craft sfx  -> fx  -> master   (tone/noise take bus:'bus' too)
//   voice clips (core/Voice.js)                   -> voice -> master
// cut() silences the bus only, so a snap can still play over the silence.
// Every method is safe before the user gesture (the context just stays suspended).
//
// Recorded SFX (src/core/Sfx.js, docs/assets/sfx.md): sfx(name, opts) one-shots, loopSfx(name, opts)
// handles, beds through ambience(name), simple positional sources (updateListener, per frame from main.js).
// Debug instrumentation (?debug=1, src/core/AudioDebug.js) is ONE shared implementation for every audio
// feature: other runtimes (voices) log with audio.logEvent('voice', key, {bus, gain, ...}) and register
// their output gain with audio.addMeter('voice', node). Read via __game.debug.audioLog / meter().

const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === '1';

const FILES = {
  contemplation: 'audio/contemplation.mp3',
  piano: ['audio/piano.ogg', 'audio/piano.wav'], // the WAV only when the fetch had no ffmpeg
  rain: 'audio/rain.ogg',
  crowd: 'audio/crowd.ogg',
};
// Recorded beds (single-file sfx loops) play through ambience(name) like rain / crowd.
for (const name of SFX_BEDS) FILES[name] = `sfx/${name}.ogg`;
const SFX_BED_SET = new Set(SFX_BEDS);
// Public procedural cues logged as kind 'proc' under ?debug=1 (nested calls are not logged twice).
const PROC = ['hammer', 'tick', 'thud', 'tone', 'noise', 'scrape', 'ping', 'rip', 'buzz', 'snap', 'gun', 'heartbeat'];
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
      // Safety limiter after the master (voice peaks reach -1 dBFS with a hammer blow under them):
      // transparent below -3 dBFS, so the mix is unchanged; mute still acts on master.gain.
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -3;
      this.limiter.knee.value = 0;
      this.limiter.ratio.value = 20;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.12;
      // The WebAudio compressor adds automatic makeup gain, (1 / gain at 0 dBFS)^0.6: here
      // 0.6 x 2.85 dB = 1.71 dB. Trim it back so the limiter changes nothing below its threshold.
      this._limTrim = this.ctx.createGain();
      this._limTrim.gain.value = Math.pow(10, -(0.6 * (3 - 3 / 20)) / 20);
      this.master.connect(this.limiter).connect(this._limTrim).connect(this.ctx.destination);
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
    this.sfxBank = new SfxBank(this);
    this.surface = null; // 'wood' (indoor floor) | 'street' (wet street, boot only): the player's steps (set by a chapter, reset per chapter)
    this.dbg = null;
    this.audioLog = null;
    if (DEBUG && this.ok) {
      this.dbg = new AudioDebug(this);
      this.audioLog = this.dbg.log;
      this.dbg.addMeter('bus', this.bus);
      this.dbg.addMeter('fx', this.fx);
      this.dbg.addMeter('master', this.master);
      this.dbg.addMeter('out', this._limTrim); // after the limiter (what reaches the speakers)
      let depth = 0;
      for (const m of PROC) {
        const fn = this[m];
        this[m] = (...args) => {
          const top = depth === 0;
          depth++;
          let r;
          try {
            r = fn.apply(this, args);
          } finally {
            depth--;
          }
          if (top && r !== 'eaten') this.dbg.push('proc', m, { volume: args[0]?.volume, bus: args[0]?.bus });
          return r;
        };
      }
    }
  }

  // ------------------------------------------------------------- debug (shared; see AudioDebug.js)

  /** Log one started sound (no-op without ?debug=1). Voices: logEvent('voice', key, {bus:'voice', gain}). */
  logEvent(kind, name, info) {
    this.dbg?.push(kind, name, info);
  }

  /** Meter a node under `name` (no-op without ?debug=1). Voices: addMeter('voice', voiceGain). */
  addMeter(name, node) {
    this.dbg?.addMeter(name, node);
  }

  /** {state, muted, paused, bus|fx|master|...: {rms, peak} dBFS}; meter(secs): RMS history rows. */
  meter(secs) {
    return this.dbg ? this.dbg.meter(secs) : null;
  }

  // ------------------------------------------------------------- recorded sfx (Sfx.js)

  /**
   * One-shot from public/assets/sfx (a random variant, never the last one; weights from the doc).
   * opts: { volume=0.5, rate=1, jitter=0.04, gainJitter=0 (dB), bus='fx'|'bus', lowpass, highpass, q,
   * band:'tv'|'radio', pan, pos ([x,y,z] | Vector3 | Object3D | () => pos), ref=1.5, rolloff=1,
   * delay=0, offset=0, alt (another set, picked 50/50), fallback (fn(audio, opts) | false) }.
   * Missing / undecoded file: plays the procedural cue it replaces. Returns {dur, ended, stop(fade)} | null.
   */
  sfx(name, opts) {
    return this.sfxBank.play(name, opts);
  }

  /**
   * Gameplay-driven loop: opts as sfx() plus fade=0.5 (fade-in), offset (default random), bus='bus'.
   * Returns { set(volume, rate, secs=0.1), setPos(pos), lowpass(hz, secs), stop(fade=0.3), playing }.
   * Stopped by cut() when on 'bus', and by releaseChapter().
   */
  loopSfx(name, opts) {
    return this.sfxBank.loop(name, opts);
  }

  /** Per frame (main.js): camera for left/right, head (Object3D, +1.5 m) for distance. */
  updateListener(camera, head) {
    this.sfxBank.updateListener(camera, head);
  }

  /**
   * Chapter change (main.js, before the new chapter's preload): stops loopSfx handles and recorded beds
   * left running, resets the step surface, and drops decoded sfx buffers not in `keep` (sound names).
   */
  releaseChapter(keep = [], { prefetch = [] } = {}) {
    if (!this.ok) return 0;
    this.sfxBank.stopLoops(0.4);
    for (const name of [...this._amb.keys()]) if (SFX_BED_SET.has(name) && !keep.includes(name)) this.ambience(name, false, { fade: 0.4 });
    this.surface = null;
    const freed = this.sfxBank.release(keep, prefetch);
    this.logEvent('release', 'chapter', { freed, keep: keep.length, prefetch: prefetch.length });
    return freed;
  }

  /**
   * Fetch (not decode) the compressed files of the named sets / beds in the background: the next
   * chapter's sounds, decoded only once that chapter's build calls preload() (memory: a long stereo
   * bed is ~0.4 MB compressed but ~20 MB decoded).
   */
  prefetch(names = []) {
    if (!this.ok) return;
    for (const n of names) if (FILES[n] && !SFX_BED_SET.has(n)) this._buffer(n); // music / rain / crowd: small, kept decoded as before
    this.sfxBank.prefetch(names.filter((n) => !FILES[n] || SFX_BED_SET.has(n)));
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
    if (!this.ok) return;
    // Before the first gesture the context is normally still suspended (nothing to do). Where autoplay
    // is allowed it already runs (debug autostart): pause must silence it then too, and resume it after.
    if (p) {
      if (this.unlocked || this.ctx.state === 'running') {
        this._pauseSuspended = true;
        this.ctx.suspend().catch(() => {});
      }
    } else if (this.unlocked || this._pauseSuspended) {
      this._pauseSuspended = false;
      this.ctx.resume().catch(() => {});
    }
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
  preload(names = Object.keys(FILES).filter((n) => !SFX_BED_SET.has(n))) {
    for (const name of names) if (FILES[name]) this._buffer(name);
    for (const s of STEP_SURFACES) for (let i = 0; i < 5; i++) this._buffer(`step_${s}_${i}`);
    // Recorded sfx sets named in the list (chapter `sounds`): every variant, once the manifest is in.
    if (this.ok) this.sfxBank.preload(names.filter((n) => !FILES[n]));
  }

  /** The decoded AudioBuffer of a music / ambience file (Promise; null if unavailable), for own graphs. */
  buffer(name) {
    return this._buffer(name);
  }

  _buffer(name) {
    if (!this.ok) return Promise.resolve(null);
    if (SFX_BED_SET.has(name)) return this.sfxBank.file(`${name}.ogg`); // one cache with sfx(), released per chapter
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
    this.logEvent('music', name, { bus: 'bus', gain: volume });
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
    this.logEvent('amb', name, { bus: 'bus', gain: placeholder.volume, lowpass: lowpass ?? undefined });
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
    gain.connect(this._bedBus()); // music + ambience beds: the voice runtime ducks them (duck())
    src.start();
    return { src, gain, filter };
  }

  /** Beds (music, ambience, the drone, bed-like loopSfx on bus 'beds') -> this gain -> bus. Created on first use. */
  _bedBus() {
    if (!this._beds) {
      this._beds = this.ctx.createGain();
      this._beds.connect(this.bus);
    }
    return this._beds;
  }

  /**
   * Voice ducking: dip only the music and ambience beds by `db` (one-shots and loops on fx/bus are not
   * touched) or bring them back. opts: { db=7, secs (attack 0.12 / release 0.45) }.
   */
  duck(on, { db = 7, secs } = {}) {
    if (!this.ok) return;
    const g = this._bedBus().gain;
    const to = on ? Math.pow(10, -Math.abs(db) / 20) : 1;
    g.cancelScheduledValues(this.t);
    g.setTargetAtTime(to, this.t, (secs ?? (on ? 0.12 : 0.45)) / 3);
    this.dbg?.push('duck', on ? 'on' : 'off', { db: on ? -Math.abs(db) : 0 });
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
  footstep(surface = 'concrete', opts = {}) {
    // Indoors (audio.surface = 'wood', Ch1 flat / Ch4 workshop) the Player's concrete steps become the
    // recorded wood steps; the boot's clump (rate < 0.8) is boot_step_wood + body_thud, and the Player's
    // thud() that follows it in the same call stack is absorbed (docs/assets/sfx.md, Global).
    if (this.surface === 'wood' && surface === 'concrete' && this.ok && this.ctx.state === 'running') {
      if ((opts.rate ?? 1) < 0.8) {
        this.sfx('boot_step_wood', { volume: 0.35, bus: 'bus', jitter: 0.04 });
        this.sfx('body_thud', { volume: 0.15, bus: 'bus', lowpass: 900, jitter: 0.04 });
        this._eatThud = true;
        queueMicrotask(() => (this._eatThud = false));
      } else this.sfx('step_wood', { volume: opts.volume ?? 0.3, bus: 'bus', jitter: 0.1 });
      return Promise.resolve();
    }
    // Outdoors on the wet street (audio.surface = 'street', Ch2 / Ch5): only the boot's clump changes,
    // to boot_step_wet + body_thud (the good foot keeps the Kenney concrete step; docs/assets/sfx.md, Global).
    if (this.surface === 'street' && surface === 'concrete' && (opts.rate ?? 1) < 0.8 && this.ok && this.ctx.state === 'running') {
      this.sfx('boot_step_wet', { volume: 0.35, bus: 'bus', jitter: 0.04 });
      this.sfx('body_thud', { volume: 0.12, bus: 'bus', lowpass: 900, jitter: 0.04 });
      this._eatThud = true;
      queueMicrotask(() => (this._eatThud = false));
      return Promise.resolve();
    }
    return this._footstepSample(surface, opts);
  }

  async _footstepSample(surface = 'concrete', { volume = 0.35, rate } = {}) {
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
    if (this._eatThud) {
      this._eatThud = false; // the boot step already played body_thud (footstep())
      return 'eaten';
    }
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

  /** 'bus' | 'beds' (bus, ducked under voices: room tones, hums, a TV) | anything else: fx. */
  _out(bus) {
    return bus === 'bus' ? this.bus : bus === 'beds' ? this._bedBus() : this.fx;
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

  /**
   * Mood drone, called every frame by Mood. Two detuned saws through a lowpass at 300 + 1500*hope.
   * Through the beds gain (ducked under voices like the music). 0.02 (was 0.035, -4.9 dB): at 0.035 the
   * 55 Hz drone sat 8-9 dB over the recorded beds on full-range playback.
   */
  drone(hope = 0, { volume = 0.02 } = {}) {
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
      f.connect(g).connect(this._bedBus());
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
    for (const h of [...this.sfxBank.loops]) if (h.bus === 'bus' || h.bus === 'beds') h.stop(0.05); // fx loops play through
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
