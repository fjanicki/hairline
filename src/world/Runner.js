import * as THREE from 'three';

const TAU_DEFAULT = 1.2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Sprint profile v(t) = vmax(1 - e^{-t/tau}), solved so that distance D is covered in T seconds. */
export function sprintProfile(T, D = 100, tau = TAU_DEFAULT) {
  const vmax = D / (T - tau * (1 - Math.exp(-T / tau)));
  return {
    vmax,
    tau,
    T,
    D,
    dist: (t) => vmax * (t - tau * (1 - Math.exp(-t / tau))),
    vel: (t) => vmax * (1 - Math.exp(-t / tau)),
  };
}

/**
 * A live sprint. Thenable: `await runner.run(...)` waits for the finish line.
 * Fields: d (metres run), v (m/s), t (s since start), finished, finishTime.
 */
class RunHandle {
  constructor(char, opts) {
    this.char = char;
    this.laneX = opts.laneX;
    this.startZ = opts.startZ;
    this.D = opts.distance;
    this.profile = sprintProfile(opts.T, opts.distance, opts.tau);
    this.t = 0;
    this.d = 0;
    this.v = 0;
    this.finished = false;
    this.finishTime = null;
    this.stopped = false;
    this.runOut = opts.runOut;
    this._constV = null; // set by retime()
    this._splits = opts.onSplit;
    this._nextSplit = opts.splitEvery || 0;
    this._splitEvery = opts.splitEvery || 0;
    this.done = new Promise((resolve) => (this._resolve = resolve));
  }

  then(a, b) {
    return this.done.then(a, b);
  }

  /** From now on, run at constant speed so the finish is reached at total time newT. */
  retime(newT) {
    const remaining = Math.max(0.01, this.D - this.d);
    const left = Math.max(0.05, newT - this.t);
    this._constV = remaining / left;
  }

  stop() {
    this.stopped = true;
    if (!this.finished) this._finish();
  }

  _finish() {
    this.finished = true;
    this.finishTime = this.t;
    this._resolve(this.t);
  }

  update(dt) {
    if (this.stopped) return true;
    this.t += dt;
    let nd;
    if (!this.finished) {
      if (this._constV !== null) {
        this.v = this._constV;
        nd = this.d + this.v * dt;
      } else {
        nd = this.profile.dist(this.t);
        this.v = this.profile.vel(this.t);
      }
      if (this._splitEvery) {
        while (nd >= this._nextSplit && this._nextSplit <= this.D) {
          this._splits?.(this._nextSplit, this.t);
          this._nextSplit += this._splitEvery;
        }
      }
      if (nd >= this.D) {
        nd = this.D;
        this.d = nd;
        this._finish();
      }
      this.d = nd;
    } else {
      // Decelerate through the run-out, then walk/idle.
      this.v = Math.max(0, this.v - dt * 4.5);
      this.d += this.v * dt;
      if (this.d - this.D > this.runOut || this.v <= 0.05) {
        this.char.play('idle', 0.5);
        this.stopped = true;
        return true;
      }
    }
    const r = this.char.root;
    r.position.set(this.laneX, r.position.y, this.startZ - this.d);
    r.rotation.y = Math.PI; // facing -Z down the track
    // Cadence from ground speed and the character's size, so the planted foot stays put.
    if (this.v > 2.2) {
      const a = this.char.play('run', 0.2);
      if (a) a.timeScale = clamp(this.char.strideRate('run', this.v), 0.45, 1.6);
    } else {
      const a = this.char.play(this.v > 0.2 ? 'walk' : 'idle', 0.3);
      if (a && this.v > 0.2) a.timeScale = clamp(this.char.strideRate('walk', this.v), 0.5, 1.6);
    }
    return false;
  }
}

/** Walk to a point, then idle. Thenable. */
class WalkHandle {
  constructor(char, to, { speed = 1.4, face, run = false }) {
    this.char = char;
    this.to = to;
    this.speed = speed;
    this.face = face;
    this.run = run;
    this.stopped = false;
    this.done = new Promise((resolve) => (this._resolve = resolve));
  }

  then(a, b) {
    return this.done.then(a, b);
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.char.play('idle', 0.4);
    this._resolve();
  }

  update(dt) {
    if (this.stopped) return true;
    const p = this.char.root.position;
    const dx = this.to.x - p.x;
    const dz = this.to.z - p.z;
    const dist = Math.hypot(dx, dz);
    const step = this.speed * dt;
    if (dist <= step || dist < 0.01) {
      p.x = this.to.x;
      p.z = this.to.z;
      if (this.face !== undefined) this.char.root.rotation.y = this.face;
      this.stop();
      return true;
    }
    p.x += (dx / dist) * step;
    p.z += (dz / dist) * step;
    const target = Math.atan2(dx, dz);
    let r = this.char.root.rotation.y;
    let diff = ((target - r + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    this.char.root.rotation.y = r + diff * (1 - Math.exp(-8 * dt));
    const a = this.char.play(this.run ? 'run' : 'walk', 0.3);
    if (a) a.timeScale = this.run ? clamp(this.char.strideRate('run', this.speed), 0.45, 1.6) : clamp(this.char.strideRate('walk', this.speed), 0.5, 1.6);
    return false;
  }
}

/** Drives NPC characters along lanes (sprints) and to points (walks). Uses scaled time. */
export class Runner {
  constructor() {
    this.active = new Set();
  }

  /**
   * Sprint `distance` metres down a lane (towards -Z) finishing in T seconds.
   * opts: { laneX, T, startZ=0, distance=100, tau=1.2, runOut=12, splitEvery=0, onSplit:(metres, t)=>{} }
   * Returns a RunHandle (thenable, resolves with the finish time at the line).
   */
  run(char, { laneX, T, startZ = 0, distance = 100, tau = TAU_DEFAULT, runOut = 12, splitEvery = 0, onSplit } = {}) {
    for (const old of this.active) if (old.char === char) old.stop?.();
    const x = laneX ?? char.root.position.x;
    const h = new RunHandle(char, { laneX: x, T, startZ, distance, tau, runOut, splitEvery, onSplit });
    char.root.position.set(x, char.root.position.y, startZ);
    this._add(h);
    return h;
  }

  /**
   * Walk to pos ([x,z] or Vector3). opts: { speed=1.4, face (final rotation.y), run=false }
   * Returns a WalkHandle (thenable).
   */
  walkTo(char, pos, opts = {}) {
    for (const h of this.active) if (h.char === char) h.stop?.();
    const to = Array.isArray(pos) ? new THREE.Vector3(pos[0], 0, pos.length === 3 ? pos[2] : pos[1]) : pos.clone();
    const h = new WalkHandle(char, to, opts);
    this._add(h);
    return h;
  }

  _add(h) {
    this.active.add(h);
  }

  /** Stop and forget every handle (called on chapter unload; resolves pending walks/runs). */
  clear() {
    for (const h of this.active) {
      if (!h.finished && h._resolve) h._resolve('cleared');
      h.stopped = true;
    }
    this.active.clear();
  }

  update(dt) {
    for (const h of this.active) {
      let done = false;
      try {
        done = h.update(dt);
      } catch (err) {
        console.error('[runner]', err);
        done = true;
      }
      if (done) this.active.delete(h);
    }
  }
}
