import { assetUrl } from './Assets.js';

// Recorded / generated SFX runtime (docs/assets/sfx.md, "Integration"). Owned by AudioSys as
// `audio.sfxBank`; chapters call the AudioSys wrappers: audio.sfx(), audio.loopSfx(), audio.updateListener().
//
// Files: public/assets/sfx/<file>.ogg, manifest public/assets/sfx/sfx.json = {name: {files[], loop, ...}}.
// A cue name is a manifest key; its files are the variants. Buffers are cached per file and released
// per chapter (AudioSys.releaseChapter).

/** Single-file loops that audio.ambience(name) can play (registered in Audio.js FILES as sfx/<name>.ogg). */
export const SFX_BEDS = [
  'amb_city_far',
  'amb_dawn_birds',
  'amb_drips',
  'amb_fridge_hum',
  'amb_golden_birds',
  'amb_marathon_crowd',
  'amb_rain_window',
  'amb_stairwell',
  'amb_street_day',
  'amb_street_night',
  'amb_street_wet',
  'amb_workshop',
  'fluoro_hum',
  'neon_buzz',
  'tv_race_bed',
  'radio_static',
  'radio_tune_sweep',
  'radio_talk_fishing',
  'brush_wall_loop',
  'sand_loop',
];

// Variant weights (default 1). hammer_floor_06 is thin on laptops (54 % of its energy under 150 Hz).
const WEIGHTS = { hammer_floor: { 'hammer_floor_06.ogg': 0.5 } };

// Speaker bands (docs/assets/sfx.md Runtime 6): highpass -> lowpass -> light waveshaper.
export const BANDS = { tv: { hp: 250, lp: 4500, k: 2 }, radio: { hp: 300, lp: 3400, k: 2 } };

// The procedural cue each file set replaces, played when the file is missing or not decoded yet
// (a checkout without the fetch still has sound). opts.fallback overrides; opts.fallback === false: none.
const FALLBACK = {
  hammer_floor: (a, o) => a.hammer({ volume: 0.5 * ((o.volume ?? 0.8) / 0.8) }),
  table_tock: (a) => a.tick({ volume: 0.2 }),
  tape_tock: (a) => a.tick({ volume: 0.22 }),
  mug_clink: (a, o) => a.tone({ freq: 2400, dur: 0.05, volume: 0.05, delay: Math.max(0, o.delay || 0) }),
  mug_clink_alt: (a, o) => a.tone({ freq: 2400, dur: 0.05, volume: 0.05, delay: Math.max(0, o.delay || 0) }),
  tv_crt_off: (a) => a.tick({ volume: 0.2 }),
  fluoro_flicker: (a) => a.noise({ type: 'bandpass', freq: 120, q: 9, dur: 0.75, volume: 0.05, tail: 0.1, bus: 'bus' }),
  body_thud: (a, o) => a.thud({ volume: Math.min(0.15, o.volume ?? 0.15) }),
  step_wood: (a, o) => a._footstepSample('concrete', { volume: o.volume ?? 0.3 }),
  boot_step_wood: (a, o) => a._footstepSample('concrete', { volume: 0.5, rate: 0.72 }),
  boot_step_wet: (a, o) => a._footstepSample('concrete', { volume: 0.5, rate: 0.72 }),
  run_step: (a, o) => a._footstepSample('concrete', { volume: o.volume ?? 0.3 }),
  run_step_wet: (a, o) => a._footstepSample('concrete', { volume: o.volume ?? 0.3 }),
  crack_pencil_lead: (a) => a.snap({ volume: 0.3 }),
  velcro_rip: (a) => a.rip(),
  brush_stroke: (a) => a.scrape({ volume: 0.12 }),
  sand_stroke: (a) => a.scrape(),
  scaffold_creak: (a) => a.noise({ type: 'bandpass', freq: 240, q: 6, dur: 0.4, volume: 0.24 }),
  spoke_key: (a) => a.tick({ volume: 0.12 }),
  brake_rub: (a) => a.tick({ volume: 0.22 }),
  camera_shutter: (a) => a.tick({ volume: 0.45 }),
  chain_on: (a) => a.tick({ volume: 0.3 }),
  tool_hook: (a) => a.scrape({ volume: 0.12 }),
  tool_take: (a) => a.scrape({ volume: 0.12 }),
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const xyz = (p) => {
  if (!p) return null;
  if (typeof p === 'function') p = p();
  if (!p) return null;
  if (Array.isArray(p)) return p;
  if (p.isObject3D) {
    p.updateWorldMatrix?.(true, false);
    const e = p.matrixWorld.elements;
    return [e[12], e[13], e[14]];
  }
  return [p.x, p.y, p.z];
};

export class SfxBank {
  constructor(audio) {
    this.a = audio;
    this.manifest = null;
    this._mp = null;
    this.buf = new Map(); // file -> Promise<AudioBuffer|null>
    this.ready = new Map(); // file -> AudioBuffer|null (decoded)
    this.bytes = new Map(); // file -> Promise<ArrayBuffer|null> (prefetched, not decoded: the next chapter's)
    this._last = new Map(); // name -> last file played
    this.loops = new Set(); // live loopSfx handles
    this.positional = new Set(); // {pos, ref, rolloff, width, g, p}
    // Listener: the player's head for distance, the camera for left/right.
    this.listener = { head: null, cam: null, right: [1, 0, 0] };
  }

  loadManifest() {
    if (!this._mp) {
      this._mp = fetch(assetUrl('sfx/sfx.json'))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
        .then((m) => {
          if (!m) console.warn('[audio] sfx manifest unavailable: procedural fallbacks only');
          this.manifest = m || {};
          return this.manifest;
        });
    }
    return this._mp;
  }

  has(name) {
    return !!this.manifest?.[name];
  }

  files(name) {
    return this.manifest?.[name]?.files || null;
  }

  /** Fetch + decode one file (cached). */
  file(file) {
    const a = this.a;
    if (!a.ok) return Promise.resolve(null);
    if (!this.buf.has(file)) {
      const bytes = this.bytes.get(file); // prefetched (the next chapter's), not decoded yet
      this.bytes.delete(file);
      const p = (bytes || this._fetch(file))
        .then((ab) => {
          if (!ab) throw new Error('no data sfx/' + file);
          return a.ctx.decodeAudioData(ab);
        })
        .catch((err) => {
          console.warn('[audio] could not load sfx', file, err?.message || err);
          return null;
        })
        .then((b) => {
          if (this.buf.get(file) === p) this.ready.set(file, b);
          return b;
        });
      this.buf.set(file, p);
    }
    return this.buf.get(file);
  }

  _fetch(file) {
    return fetch(assetUrl('sfx/' + file)).then((r) => {
      if (!r.ok) throw new Error(r.status + ' sfx/' + file);
      return r.arrayBuffer();
    });
  }

  /** Fetch only (no decode) every file of the named sets / beds: the next chapter's (see AudioSys.prefetch). */
  async prefetch(names) {
    const m = await this.loadManifest();
    for (const n of names) {
      for (const f of m[n]?.files || [n + '.ogg']) {
        if (this.buf.has(f) || this.bytes.has(f) || !m[n]) continue;
        const p = this._fetch(f).catch((err) => {
          console.warn('[audio] could not prefetch sfx', f, err?.message || err);
          if (this.bytes.get(f) === p) this.bytes.delete(f);
          return null;
        });
        this.bytes.set(f, p);
      }
    }
  }

  /** Preload every variant of the named sets (non-manifest names are ignored). */
  async preload(names) {
    const m = await this.loadManifest();
    const out = [];
    for (const n of names) for (const f of m[n]?.files || []) out.push(this.file(f));
    return Promise.all(out);
  }

  /** Drop decoded buffers of every set not in `keep` (sources already playing keep their own reference). */
  release(keep = [], keepBytes = []) {
    const keepFiles = new Set();
    for (const n of keep) for (const f of this.files(n) || [n + '.ogg']) keepFiles.add(f);
    for (const h of this.loops) if (h.file) keepFiles.add(h.file);
    let n = 0;
    for (const f of [...this.buf.keys()]) {
      if (keepFiles.has(f)) continue;
      this.buf.delete(f);
      this.ready.delete(f);
      n++;
    }
    const byteFiles = new Set(keepFiles);
    for (const k of keepBytes) for (const f of this.files(k) || [k + '.ogg']) byteFiles.add(f);
    for (const f of [...this.bytes.keys()]) if (!byteFiles.has(f)) this.bytes.delete(f);
    return n;
  }

  /** Stop every loop handle (chapter change). */
  stopLoops(fade = 0.5) {
    for (const h of [...this.loops]) h.stop(fade);
  }

  /** opts.variant: a 0-based index or a file name ('spoke_key_02.ogg'), for a fixed variant. */
  _variant(files, v) {
    if (v == null) return null;
    if (typeof v === 'number') return files[((v % files.length) + files.length) % files.length];
    return files.find((f) => f === v || f === v + '.ogg') ?? null;
  }

  _pick(name, files) {
    if (files.length === 1) return files[0];
    const w = WEIGHTS[name] || {};
    const last = this._last.get(name);
    const pool = files.filter((f) => f !== last);
    let total = 0;
    for (const f of pool) total += w[f] ?? 1;
    let r = Math.random() * total;
    for (const f of pool) {
      r -= w[f] ?? 1;
      if (r <= 0) return f;
    }
    return pool[pool.length - 1];
  }

  /** Source -> [hp] -> [lp] -> [band] -> gain -> [pan / positional] -> out. Returns the nodes. */
  _chain(src, o, out) {
    const ctx = this.a.ctx;
    let node = src;
    const hp = o.highpass ?? (o.band ? BANDS[o.band]?.hp : null);
    const lp = o.lowpass ?? (o.band ? BANDS[o.band]?.lp : null);
    if (hp) {
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = hp;
      f.Q.value = o.q ?? 0.7;
      node = node.connect(f);
    }
    let lpNode = null;
    if (lp) {
      lpNode = ctx.createBiquadFilter();
      lpNode.type = 'lowpass';
      lpNode.frequency.value = lp;
      lpNode.Q.value = o.q ?? 0.7;
      node = node.connect(lpNode);
    }
    if (o.band && BANDS[o.band]) node = node.connect(this._shaper(BANDS[o.band].k));
    const gain = ctx.createGain();
    node = node.connect(gain);
    let posGain = null;
    let panner = null;
    if (o.pos || o.pan != null) {
      panner = ctx.createStereoPanner();
      panner.pan.value = clamp(o.pan ?? 0, -1, 1);
      if (o.pos) {
        posGain = ctx.createGain();
        node = node.connect(posGain);
      }
      node = node.connect(panner);
    }
    node.connect(out);
    let pe = null;
    if (o.pos) {
      pe = { pos: o.pos, ref: o.ref ?? 1.5, rolloff: o.rolloff ?? 1, width: o.panWidth ?? 0.7, g: posGain, p: panner, first: true };
      this.positional.add(pe);
      this._place(pe);
    }
    return { gain, lp: lpNode, pe };
  }

  _shaper(k) {
    if (!this._curves) this._curves = new Map();
    let c = this._curves.get(k);
    if (!c) {
      // Unity small-signal gain, soft knee: f(x) = x / (1 + k|x|) * (1 + k * 0.05) (about 0 dB at bed levels).
      c = new Float32Array(1024);
      for (let i = 0; i < c.length; i++) {
        const x = (i / (c.length - 1)) * 2 - 1;
        c[i] = (x / (1 + k * Math.abs(x))) * (1 + k * 0.05);
      }
      this._curves.set(k, c);
    }
    const ws = this.a.ctx.createWaveShaper();
    ws.curve = c;
    ws.oversample = '2x';
    return ws;
  }

  _fallback(name, o) {
    const fb = o.fallback === undefined ? FALLBACK[name] : o.fallback;
    if (typeof fb !== 'function') return;
    this.a.logEvent?.('fallback', name, { bus: o.bus ?? 'fx' });
    try {
      fb(this.a, o);
    } catch (err) {
      console.warn('[audio] fallback failed', name, err);
    }
  }

  /** One-shot. See AudioSys.sfx(). */
  play(name, o = {}) {
    const a = this.a;
    if (!a.ok) return null;
    if (o.alt && Math.random() < 0.5) name = o.alt;
    if (!this.manifest) this.loadManifest();
    // Nothing can be heard (before the first click, or paused): no queue of stale one-shots.
    if (a.ctx.state !== 'running' || a._paused) {
      a.logEvent?.('skipped', name, { why: a._paused ? 'paused' : a.ctx.state });
      return null;
    }
    const files = this.files(name);
    const file = files ? this._variant(files, o.variant) ?? this._pick(name, files) : null;
    const buf = file ? this.ready.get(file) : null;
    if (!buf) {
      if (file && !this.buf.has(file)) this.file(file); // there next time
      this._fallback(name, o);
      return null;
    }
    this._last.set(name, file);
    const jitter = o.jitter ?? 0.04;
    const rate = (o.rate ?? 1) * (1 + (Math.random() * 2 - 1) * jitter);
    const gj = o.gainJitter ?? 0;
    const volume = (o.volume ?? 0.5) * Math.pow(10, ((Math.random() * 2 - 1) * gj) / 20);
    const bus = o.bus ?? 'fx';
    const ctx = a.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const { gain, pe } = this._chain(src, o, a._out(bus));
    gain.gain.value = volume;
    const t = a.t + Math.max(0, o.delay ?? 0);
    src.start(t, o.offset ?? 0);
    let done;
    const ended = new Promise((r) => (done = r));
    src.onended = () => {
      if (pe) this.positional.delete(pe);
      try {
        src.disconnect();
      } catch {
        /* noop */
      }
      done();
    };
    a.logEvent?.('sfx', name, { file, bus, gain: +volume.toFixed(3), rate: +rate.toFixed(3), delay: o.delay || 0, lowpass: o.lowpass, highpass: o.highpass, band: o.band, pos: pe ? xyz(pe.pos)?.map((v) => +v.toFixed(2)) : undefined });
    return {
      name,
      file,
      src,
      gain,
      dur: buf.duration / rate,
      ended,
      stop: (fade = 0.06) => {
        const n = a.t;
        gain.gain.cancelScheduledValues(n);
        gain.gain.setValueAtTime(gain.gain.value, n);
        gain.gain.linearRampToValueAtTime(0, n + Math.max(0.01, fade));
        try {
          src.stop(n + fade + 0.02);
        } catch {
          /* noop */
        }
      },
    };
  }

  /** Gameplay-driven loop. See AudioSys.loopSfx(). */
  loop(name, o = {}) {
    const a = this.a;
    const bank = this;
    const h = {
      name,
      file: null,
      playing: true,
      volume: o.volume ?? 0.3,
      rate: o.rate ?? 1,
      bus: o.bus ?? 'bus',
      _nodes: null,
      /** Ramp volume (and playbackRate) over `secs`. Cheap to call every frame. */
      set(volume, rate, secs = 0.1) {
        if (volume != null) this.volume = volume;
        if (rate != null) this.rate = rate;
        const n = this._nodes;
        if (!n || !a.ok) return this;
        const tc = Math.max(0.004, secs / 3);
        if (volume != null && Math.abs(volume - n.lastV) > 1e-4) {
          n.lastV = volume;
          n.gain.gain.cancelScheduledValues(a.t);
          n.gain.gain.setTargetAtTime(volume, a.t, tc);
        }
        if (rate != null && Math.abs(rate - n.lastR) > 1e-4) {
          n.lastR = rate;
          n.src.playbackRate.setTargetAtTime(rate, a.t, tc);
        }
        return this;
      },
      /** Move the point source (positional loops). */
      setPos(p) {
        if (this._nodes?.pe) this._nodes.pe.pos = p;
        o.pos = p;
        return this;
      },
      /** Fade out and stop (idempotent). */
      stop(fade = 0.3) {
        if (!this.playing) return;
        this.playing = false;
        bank.loops.delete(this);
        const n = this._nodes;
        if (!n || !a.ok) return;
        const t = a.t;
        n.gain.gain.cancelScheduledValues(t);
        n.gain.gain.setValueAtTime(n.gain.gain.value, t);
        n.gain.gain.linearRampToValueAtTime(0, t + Math.max(0.01, fade));
        try {
          n.src.stop(t + Math.max(0.01, fade) + 0.05);
        } catch {
          /* noop */
        }
        if (n.pe) bank.positional.delete(n.pe);
        a.logEvent?.('loopStop', name, { fade });
      },
    };
    if (!a.ok) {
      h.playing = false;
      return h;
    }
    this.loops.add(h);
    const start = (buf, file) => {
      if (!h.playing || !buf) {
        if (!buf) this.loops.delete(h);
        return;
      }
      const ctx = a.ctx;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.playbackRate.value = h.rate;
      const { gain, pe, lp } = this._chain(src, { ...o, pos: o.pos }, a._out(h.bus));
      const fade = o.fade ?? 0.5;
      gain.gain.setValueAtTime(0, a.t);
      gain.gain.linearRampToValueAtTime(h.volume, a.t + Math.max(0.01, fade));
      const offset = o.offset ?? Math.random() * buf.duration;
      src.start(a.t, offset % buf.duration);
      h.file = file;
      h._nodes = { src, gain, pe, lp, lastV: h.volume, lastR: h.rate };
      h.lowpass = lp ? (hz, secs = 0.3) => lp.frequency.setTargetAtTime(hz, a.t, secs / 3) : () => {};
      a.logEvent?.('loop', name, { file, bus: h.bus, gain: h.volume, rate: h.rate, band: o.band, pos: pe ? xyz(pe.pos)?.map((v) => +v.toFixed(2)) : undefined });
    };
    h.lowpass = () => {};
    const go = () => {
      const files = this.files(name);
      if (!files) {
        console.warn('[audio] unknown sfx loop', name);
        this.loops.delete(h);
        h.playing = false;
        return;
      }
      const file = this._pick(name, files);
      this._last.set(name, file);
      const ready = this.ready.get(file);
      if (ready) start(ready, file);
      else this.file(file).then((b) => start(b, file));
    };
    if (this.manifest) go();
    else this.loadManifest().then(go);
    return h;
  }

  // ------------------------------------------------------------- positional

  /** Per frame (main.js): camera = THREE camera (pan), head = Object3D / [x,y,z] (distance; default camera). */
  updateListener(camera, head) {
    const L = this.listener;
    if (camera?.matrixWorld) {
      const e = camera.matrixWorld.elements;
      L.cam = [e[12], e[13], e[14]];
      const n = Math.hypot(e[0], e[1], e[2]) || 1;
      L.right = [e[0] / n, e[1] / n, e[2] / n];
    }
    if (head) {
      const p = xyz(head);
      if (p) L.head = [p[0], p[1] + (head.isObject3D ? 1.5 : 0), p[2]];
    }
    if (!this.positional.size) return;
    for (const pe of this.positional) this._place(pe);
  }

  _place(pe) {
    const L = this.listener;
    const p = xyz(pe.pos);
    if (!p) return;
    const h = L.head || L.cam;
    let g = 1;
    if (h) {
      const d = Math.hypot(p[0] - h[0], p[1] - h[1], p[2] - h[2]);
      g = d <= pe.ref ? 1 : pe.ref / (pe.ref + pe.rolloff * (d - pe.ref));
    }
    let pan = 0;
    if (L.cam) {
      const dx = p[0] - L.cam[0];
      const dy = p[1] - L.cam[1];
      const dz = p[2] - L.cam[2];
      const n = Math.hypot(dx, dy, dz);
      if (n > 1e-3) pan = clamp((dx * L.right[0] + dy * L.right[1] + dz * L.right[2]) / n, -1, 1) * pe.width;
    }
    const t = this.a.t;
    if (pe.first) {
      pe.first = false;
      pe.g.gain.value = g;
      pe.p.pan.value = pan;
      pe.lastG = g;
      pe.lastP = pan;
      return;
    }
    if (Math.abs(g - pe.lastG) > 0.004) {
      pe.lastG = g;
      pe.g.gain.setTargetAtTime(g, t, 0.06);
    }
    if (Math.abs(pan - pe.lastP) > 0.01) {
      pe.lastP = pan;
      pe.p.pan.setTargetAtTime(pan, t, 0.06);
    }
  }
}
