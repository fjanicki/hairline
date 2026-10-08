// Debug-only audio instrumentation (?debug=1), shared by every audio feature (SFX, voices, music).
// AudioSys owns one instance: audio.dbg. Exposed as __game.debug.audioLog / __game.debug.meter().
//
// - log(kind, name, info): one entry per sound started: {t (AudioContext s), at (performance.now ms),
//   kind, name, ...info (file, bus, gain, rate, ...)}. Kinds: 'sfx', 'loop', 'loopStop', 'amb',
//   'music', 'proc' (procedural cue), 'fallback', 'skipped', and 'voice' (the voice runtime).
// - addMeter(name, node): an AnalyserNode tap on `node` (bus, fx, master are built in; the voice runtime
//   adds its voice gain as 'voice'). meter() = current RMS / peak in dBFS per tap (85 ms window);
//   meter(secs) = the history (every 50 ms) over the last `secs`: {t, at, <tap>: rms, <tap>Pk: peak}.

const FLOOR = -120;
const db = (x) => (x > 1e-6 ? Math.max(FLOOR, 20 * Math.log10(x)) : FLOOR);

export class AudioDebug {
  constructor(audio) {
    this.a = audio;
    this.log = []; // the array itself is exposed (__game.debug.audioLog)
    this.meters = new Map(); // name -> { an, buf }
    this.history = []; // [{t, at, <meter>: rmsDb, ...}]
    this._timer = null;
  }

  push(kind, name, info = {}) {
    const a = this.a;
    const e = { t: a.ok ? +a.ctx.currentTime.toFixed(3) : 0, at: Math.round(performance.now()), kind, name };
    for (const k in info) if (info[k] !== undefined) e[k] = info[k];
    this.log.push(e);
    if (this.log.length > 6000) this.log.splice(0, 1000);
    return e;
  }

  addMeter(name, node) {
    const a = this.a;
    if (!a.ok || !node || this.meters.has(name)) return;
    const an = a.ctx.createAnalyser();
    an.fftSize = 4096; // ~85 ms at 48 kHz: sampled every 50 ms, the windows overlap (no transient falls between)
    node.connect(an);
    this.meters.set(name, { an, buf: new Float32Array(an.fftSize) });
    if (!this._timer) this._timer = setInterval(() => this._sample(), 50);
  }

  _read(m) {
    m.an.getFloatTimeDomainData(m.buf);
    let s = 0;
    let pk = 0;
    for (let i = 0; i < m.buf.length; i++) {
      const v = m.buf[i];
      s += v * v;
      const av = v < 0 ? -v : v;
      if (av > pk) pk = av;
    }
    return { rms: Math.sqrt(s / m.buf.length), peak: pk };
  }

  _sample() {
    const a = this.a;
    if (!a.ok || a.ctx.state !== 'running') return; // analysers hold stale data while suspended
    const row = { t: +a.ctx.currentTime.toFixed(3), at: Math.round(performance.now()) };
    for (const [name, m] of this.meters) {
      const r = this._read(m);
      row[name] = +db(r.rms).toFixed(1);
      row[name + 'Pk'] = +db(r.peak).toFixed(1);
    }
    this.history.push(row);
    if (this.history.length > 2400) this.history.splice(0, 400); // ~2 min
  }

  /** meter() -> {state, muted, paused, <tap>: {rms, peak} dBFS}; meter(secs) -> rows {t, at, <tap>, <tap>Pk} of the last secs. */
  meter(secs) {
    const a = this.a;
    if (typeof secs === 'number') {
      const now = performance.now();
      return this.history.filter((r) => now - r.at <= secs * 1000);
    }
    const out = { state: a.ok ? a.ctx.state : 'none', muted: a.muted, paused: !!a._paused, t: a.ok ? +a.ctx.currentTime.toFixed(3) : 0 };
    for (const [name, m] of this.meters) {
      const r = this._read(m);
      // Suspended: the analyser repeats its last block, so report silence (nothing reaches the speakers).
      out[name] = out.state === 'running' ? { rms: +db(r.rms).toFixed(1), peak: +db(r.peak).toFixed(1) } : { rms: FLOOR, peak: FLOOR };
    }
    return out;
  }
}
