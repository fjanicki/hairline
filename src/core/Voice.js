// HAIRLINE voice-over runtime (French only; docs/voice.md).
//
// A displayed line -> voiceKey(text) -> public/assets/voice/fr/manifest.json -> one Ogg Opus clip,
// played on its own 'voice' gain straight into audio.master (so mute and the paused AudioContext
// silence it, and audio.cut() on the music bus does not). One clip at a time:
//   - kind 'dialogue' (dialogue lines, menu replies, voiced card lines) stops whatever is playing;
//   - kind 'thought' (barks, Hugo's thoughts) never interrupts a dialogue clip: it is skipped.
// While a clip plays, the music and ambience beds are ducked (audio.duck). With the option off or in
// English nothing is fetched, decoded or played. Missing clips or decode failures are silent (a
// warning under ?debug=1 only).
//
// Memory: the compressed bytes of the current chapter's clips are prefetched in the background once the
// chapter starts (keys found by walking L.chN in French) and released on the next chapter; decoded
// PCM is kept in a small LRU (DECODED_CAP seconds), decoded on demand with a two-line lookahead.

import { voiceKey } from '../../scripts/voice/voiceKey.mjs'; // the one key implementation (shared with the generator)
import { assetUrl } from './Assets.js';
import { getLang, onLangChange } from '../story/i18n.js';

const STORE = 'hairline.voice';
const DIR = 'voice/fr/';
const DECODED_CAP = 90; // seconds of decoded audio kept (about 17 MB at 48 kHz)
const FETCH_PARALLEL = 3;
const DUCK_DB = 7;
// ms after the last clip before the beds come back (and the dialogue box closed: hold()). 700 ms covers
// the usual 0.5-0.6 s gap between two lines, so the beds do not swell 6 dB between every line.
const DUCK_RELEASE_DELAY = 700;

function readPref() {
  try {
    return localStorage.getItem(STORE) !== '0';
  } catch {
    return true;
  }
}

class Clip {
  constructor(voice, entry, { kind, text, who, key }) {
    this.v = voice;
    this.file = entry.file;
    this.dur = entry.dur || 0;
    this.kind = kind;
    this.text = text;
    this.who = who;
    this.key = key;
    this.state = 'loading'; // loading | playing | ended | stopped | error
    this.src = null;
    this.gain = null;
    this.startAt = 0;
    this.ended = new Promise((r) => (this._done = r));
  }

  /** True while the clip is loading or playing. */
  get busy() {
    return this.state === 'loading' || this.state === 'playing';
  }

  /** Seconds left to say (the full length while it loads). */
  remaining() {
    if (this.state === 'loading') return this.dur;
    if (this.state !== 'playing') return 0;
    return Math.max(0, this.dur - (this.v.audio.ctx.currentTime - this.startAt));
  }

  async _begin() {
    const buf = await this.v._buffer(this.file);
    if (this.state !== 'loading') return;
    if (!buf) return this._finish('error');
    const a = this.v.audio;
    const ctx = a.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    src.connect(g).connect(this.v._out());
    src.onended = () => this._finish('ended');
    this.src = src;
    this.gain = g;
    this.dur = buf.duration;
    this.startAt = ctx.currentTime;
    src.start();
    this.state = 'playing';
    this.v._duck(true);
    a.logEvent?.('voice', this.key, { file: this.file, bus: 'voice', gain: +g.gain.value.toFixed(3), dur: +buf.duration.toFixed(2), line: this.kind, who: this.who, text: this.text.slice(0, 60) });
    this.v._rec('start', this, { bus: 'voice', gain: +(this.v._out().gain.value * g.gain.value).toFixed(3), dur: +buf.duration.toFixed(2), waitMs: Math.round(performance.now() - this._t0) });
  }

  /** Stop now, with a short fade (seconds) so it does not click. */
  stop(fade = 0.04) {
    if (!this.busy) return;
    if (this.src) {
      const t = this.v.audio.ctx.currentTime;
      try {
        this.src.onended = null;
        this.gain.gain.cancelScheduledValues(t);
        this.gain.gain.setValueAtTime(this.gain.gain.value, t);
        this.gain.gain.linearRampToValueAtTime(0, t + fade);
        this.src.stop(t + fade + 0.01);
      } catch {
        /* already stopped */
      }
    }
    this._finish('stopped');
  }

  _finish(how) {
    if (!this.busy) return;
    const was = this.state;
    this.state = how;
    this.v._rec(how === 'ended' ? 'end' : how === 'stopped' ? 'stop' : 'error', this, { was, at: was === 'playing' ? +(this.v.audio.ctx.currentTime - this.startAt).toFixed(2) : 0 });
    this._done(how);
    if (this.v.cur === this) {
      this.v.cur = null;
      this.v._duck(false);
    }
  }
}

export class Voice {
  /** { audio: AudioSys, L: live text tree, debug } */
  constructor({ audio, L, debug = false }) {
    this.audio = audio;
    this.L = L;
    this.debug = debug;
    this._on = readPref();
    this.manifest = null;
    this._manifestP = null;
    this._keys = new Map(); // text -> key
    this._bytes = new Map(); // file -> Promise<ArrayBuffer|null>
    this._decoded = new Map(); // file -> { buf, used }
    this._decoding = new Map(); // file -> Promise<AudioBuffer|null>
    this._gain = null;
    this._chapter = -1;
    this._pf = null;
    this._ducked = false;
    this._duckTimer = 0;
    this.cur = null; // the clip playing (or loading)
    this.log = debug ? [] : null; // __game.debug.voiceLog
    this.listeners = new Set();
    onLangChange(() => {
      if (!this.active) this.stopAll();
      else this._activate();
    });
    if (this.active) this._ensure();
    if (debug && audio?.ok) this._out(); // meters from the start (debug only)
  }

  /** The option (saved), whatever the language. */
  get enabled() {
    return this._on;
  }

  /** Voices exist in this language (French only). */
  get supported() {
    return getLang() === 'fr';
  }

  /** Clips play: French, option on, WebAudio up. */
  get active() {
    return this._on && this.supported && !!this.audio?.ok;
  }

  setEnabled(on) {
    this._on = !!on;
    try {
      localStorage.setItem(STORE, this._on ? '1' : '0');
    } catch {
      /* storage blocked: this session only */
    }
    this._rec('option', null, { on: this._on });
    if (!this.active) this.stopAll();
    else this._activate();
    for (const fn of this.listeners) fn(this._on);
  }

  key(text) {
    let k = this._keys.get(text);
    if (k === undefined) {
      k = voiceKey(text);
      this._keys.set(text, k);
    }
    return k;
  }

  /** Manifest entry for a displayed line (per-speaker variant by the displayed `who`), or null. */
  lookup(text, who) {
    const m = this.manifest;
    if (!m || typeof text !== 'string' || !text) return null;
    const e = m.lines[this.key(text)];
    if (!e) return null;
    if (e.variants) return e.variants[who] ?? null;
    return e;
  }

  /**
   * Say a displayed line. kind: 'dialogue' (blocking: interrupts anything) | 'thought' (never over a
   * dialogue clip). Returns the clip { dur, busy, remaining(), ended, stop(fade) } or null (no clip).
   */
  play(text, who, { kind = 'dialogue' } = {}) {
    if (!this.active || typeof text !== 'string' || !text) return null;
    if (!this.manifest) {
      this._ensure();
      return null;
    }
    const key = this.key(text);
    const entry = this.lookup(text, who);
    if (!entry) {
      this._rec('miss', null, { kind, who, key, text: text.slice(0, 80) });
      return null;
    }
    const a = this.audio;
    if (a.ctx.state !== 'running' && !a._paused) {
      this._rec('locked', null, { kind, who, key, text: text.slice(0, 80) }); // no gesture yet: stay silent
      return null;
    }
    const cur = this.cur;
    if (kind === 'thought' && cur?.busy && cur.kind !== 'thought') {
      this._rec('skip', null, { kind, who, key, text: text.slice(0, 80), over: cur.key });
      return null;
    }
    if (cur) cur.stop(0.04);
    const clip = new Clip(this, entry, { kind, text, who, key });
    clip._t0 = performance.now();
    this.cur = clip;
    this._rec('request', clip, { file: entry.file, dur: entry.dur });
    clip._begin();
    return clip;
  }

  /** Decode the next lines of a dialogue ahead: [{ text, who }]. */
  ahead(lines) {
    if (!this.active || !this.manifest) return;
    for (const l of lines || []) {
      const e = l && this.lookup(l.text, l.who);
      if (e) this._buffer(e.file);
    }
  }

  /** Stop the current clip, or only if it is of `kind`. */
  stop(kind, fade = 0.04) {
    const c = this.cur;
    if (c && (!kind || c.kind === kind)) c.stop(fade);
  }

  stopAll(fade = 0.04) {
    this.cur?.stop(fade);
  }

  /** Director: chapter i starts (-1 = none). Stops speech, releases the old clips, prefetches the new. */
  chapter(i) {
    this.stopAll();
    this._chapter = i;
    if (i < 0) {
      this._bytes.clear();
      this._decoded.clear();
      this._pf = null;
      return;
    }
    this._prefetchChapter(i);
  }

  /**
   * UI: a dialogue box is open (true) or closed. While it is open the beds stay ducked between its
   * lines (no 6 dB swell in every 0.5 s gap); they come back once it closes and nothing is speaking.
   */
  hold(on) {
    this._hold = !!on;
    if (!on && this._ducked) this._duck(false);
  }

  // ------------------------------------------------------------- internals

  /** Voices just became active (French and the option on): the manifest now, the chapter's clips. */
  _activate() {
    this._ensure();
    this._prefetchChapter(this._chapter);
  }

  _ensure() {
    if (!this._manifestP && this.audio?.ok) {
      this._manifestP = fetch(assetUrl(DIR + 'manifest.json'))
        .then((r) => {
          if (!r.ok) throw new Error(r.status);
          return r.json();
        })
        .then((m) => {
          this.manifest = m && m.lines ? m : { lines: {} };
          this._rec('manifest', null, { lines: Object.keys(this.manifest.lines).length });
          return this.manifest;
        })
        .catch((err) => {
          this._warn('manifest unavailable', err?.message || err);
          this.manifest = { lines: {} };
          return this.manifest;
        });
    }
    return this._manifestP || Promise.resolve(null);
  }

  /** The voice gain -> master (created on first use). */
  _out() {
    if (!this._gain) {
      const a = this.audio;
      this._gain = a.ctx.createGain();
      this._gain.gain.value = 1;
      this._gain.connect(a.master);
      a.addMeter?.('voice', this._gain); // debug taps (no-op without ?debug=1)
      a.addMeter?.('beds', a._bedBus?.());
    }
    return this._gain;
  }

  _duck(on) {
    const a = this.audio;
    clearTimeout(this._duckTimer);
    if (on) {
      if (!this._ducked) {
        this._ducked = true;
        a.duck?.(true, { db: DUCK_DB });
      }
      return;
    }
    this._duckTimer = setTimeout(() => {
      if (this.cur?.state === 'playing' || this._hold || !this._ducked) return;
      this._ducked = false;
      a.duck?.(false);
    }, DUCK_RELEASE_DELAY);
  }

  _fetchBytes(file) {
    let p = this._bytes.get(file);
    if (!p) {
      p = fetch(assetUrl(DIR + file))
        .then((r) => {
          if (!r.ok) throw new Error(r.status + ' ' + file);
          return r.arrayBuffer();
        })
        .catch((err) => {
          this._warn('clip unavailable', file, err?.message || err);
          return null;
        });
      this._bytes.set(file, p);
    }
    return p;
  }

  _buffer(file) {
    const d = this._decoded.get(file);
    if (d) {
      d.used = performance.now();
      return Promise.resolve(d.buf);
    }
    let p = this._decoding.get(file);
    if (p) return p;
    p = this._fetchBytes(file)
      .then((ab) => (ab ? this.audio.ctx.decodeAudioData(ab.slice(0)) : null))
      .then((buf) => {
        if (buf) {
          this._decoded.set(file, { buf, used: performance.now() });
          this._trim();
        }
        return buf;
      })
      .catch((err) => {
        this._warn('clip decode failed', file, err?.message || err);
        return null;
      })
      .finally(() => this._decoding.delete(file));
    this._decoding.set(file, p);
    return p;
  }

  /** Keep the decoded LRU under DECODED_CAP seconds (never the clip playing). */
  _trim() {
    let total = 0;
    for (const d of this._decoded.values()) total += d.buf.duration;
    if (total <= DECODED_CAP) return;
    const order = [...this._decoded.entries()].sort((x, y) => x[1].used - y[1].used);
    for (const [file, d] of order) {
      if (total <= DECODED_CAP) break;
      if (file === this.cur?.file) continue;
      this._decoded.delete(file);
      total -= d.buf.duration;
    }
  }

  /** Fetch (not decode) the compressed clips of chapter i + the stumble lines; release the rest. */
  async _prefetchChapter(i) {
    if (i < 0 || !this.active) return;
    const token = (this._pf = {});
    await this._ensure();
    if (token !== this._pf || !this.manifest) return;
    const lines = this.manifest.lines;
    const files = new Set();
    const stack = [this.L?.[`ch${i + 1}`], this.L?.stumble];
    let n = 0;
    while (stack.length) {
      const v = stack.pop();
      if (typeof v === 'string') {
        if (v.length < 2) continue;
        const e = lines[this.key(v)];
        if (e?.file) files.add(e.file);
        else if (e?.variants) for (const x of Object.values(e.variants)) files.add(x.file);
        if (++n % 150 === 0) {
          await new Promise((r) => setTimeout(r, 0)); // keep frames smooth while hashing
          if (token !== this._pf) return;
        }
      } else if (v && typeof v === 'object') for (const x of Object.values(v)) stack.push(x);
    }
    for (const f of [...this._bytes.keys()]) if (!files.has(f)) this._bytes.delete(f);
    for (const f of [...this._decoded.keys()]) if (!files.has(f) && f !== this.cur?.file) this._decoded.delete(f);
    const todo = [...files].filter((f) => !this._bytes.has(f));
    let k = 0;
    const worker = async () => {
      while (k < todo.length && token === this._pf && this.active) await this._fetchBytes(todo[k++]);
    };
    await Promise.all(Array.from({ length: FETCH_PARALLEL }, worker));
    if (token === this._pf) this._rec('prefetch', null, { chapter: i, files: files.size, fetched: todo.length });
  }

  _warn(...a) {
    if (this.debug) console.warn('[voice]', ...a);
  }

  _rec(ev, clip, extra) {
    const log = this.log;
    if (!log) return;
    const e = { t: +(performance.now() / 1000).toFixed(3), ev };
    if (clip) Object.assign(e, { kind: clip.kind, who: clip.who, key: clip.key, file: clip.file, text: clip.text.slice(0, 80) });
    log.push(Object.assign(e, extra));
    if (log.length > 6000) log.splice(0, log.length - 6000);
  }

  // ------------------------------------------------------------- debug

  /** Debug: audio.meter() (shared taps: voice, beds, bus, fx, master) plus the bed duck gain. */
  meter(secs) {
    const a = this.audio;
    const m = a?.meter?.(secs);
    if (!m || typeof secs === 'number') return m;
    return Object.assign(m, { duck: a._beds ? +a._beds.gain.value.toFixed(3) : 1, speaking: this.cur?.state === 'playing', clip: this.cur?.key ?? null });
  }
}
