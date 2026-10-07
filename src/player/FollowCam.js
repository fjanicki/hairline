import * as THREE from 'three';

const toV3 = (v, out = new THREE.Vector3()) => (Array.isArray(v) ? out.set(v[0], v[1], v[2]) : out.copy(v));
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2); // easeInOutCubic

/**
 * Fixed world-offset follow camera (never orbits).
 *   mode 'follow': position = target + offset, looks at target + look; lerped with 1-exp(-lerp*dt)
 *   mode 'fixed' : stays where the last tween left it (call follow() to return)
 * Uses unscaled time, so tweens run at real speed during slow motion.
 */
export class FollowCam {
  constructor(camera) {
    this.camera = camera;
    this.target = null;
    this.offset = new THREE.Vector3(0, 2.6, 4.2);
    this.look = new THREE.Vector3(0, 1.1, 0); // relative to target
    this.lerp = 6;
    this.mode = 'follow';
    this.roll = 0;
    this.fovValue = camera.fov;
    this.pos = camera.position.clone();
    this.lookAt = new THREE.Vector3();
    this._tween = null;
    this._dip = 0;
    this._shake = { t: 0, dur: 0, amp: 0 };
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
  }

  /**
   * Follow an Object3D. opts: { offset:[x,y,z], look:[x,y,z] (relative to target), lerp=6, snap=false }
   * Outdoors default offset (0, 2.6, 4.2); the apartment uses (0, 3.4, 3.6).
   */
  follow(target, { offset, look, lerp, snap = false } = {}) {
    if (target) this.target = target;
    if (offset) toV3(offset, this.offset);
    if (look) toV3(look, this.look);
    if (lerp) this.lerp = lerp;
    this._cancelTween();
    this.mode = 'follow';
    if (snap) this.snap();
  }

  /** Jump straight to the follow position. */
  snap() {
    if (!this.target) return;
    this.target.getWorldPosition(this._tmp);
    this.pos.copy(this._tmp).add(this.offset);
    this.lookAt.copy(this._tmp).add(this.look);
    this._apply();
  }

  /**
   * Cinematic move. to: { pos:[x,y,z], look:[x,y,z] (world), fov, roll (rad) }; any subset.
   * Leaves the camera in 'fixed' mode at the end. Returns a Promise.
   * opts: { ease: fn(k) } (default easeInOutCubic)
   */
  tween(to, dur = 1.5, { ease: easeFn = ease } = {}) {
    this._cancelTween();
    this.mode = 'fixed';
    return new Promise((resolve) => {
      this._tween = {
        t: 0,
        dur: Math.max(0.0001, dur),
        ease: easeFn,
        fromPos: this.pos.clone(),
        fromLook: this.lookAt.clone(),
        fromFov: this.fovValue,
        fromRoll: this.roll,
        toPos: to.pos ? toV3(to.pos) : null,
        toLook: to.look ? toV3(to.look) : null,
        toFov: to.fov ?? null,
        toRoll: to.roll ?? null,
        resolve,
      };
    });
  }

  /** Hard-set a fixed shot. { pos, look, fov, roll } */
  set({ pos, look, fov, roll } = {}) {
    this._cancelTween();
    this.mode = 'fixed';
    if (pos) toV3(pos, this.pos);
    if (look) toV3(look, this.lookAt);
    if (fov !== undefined) this.fov(fov);
    if (roll !== undefined) this.roll = roll;
    this._apply();
  }

  _cancelTween() {
    if (this._tween) {
      const r = this._tween.resolve;
      this._tween = null;
      r();
    }
  }

  /** Set the field of view immediately (degrees). */
  fov(v) {
    this.fovValue = v;
  }

  setRoll(r) {
    this.roll = r;
  }

  /** Stumble dip: the camera drops briefly. */
  dip(amount = 0.35) {
    this._dip = Math.max(this._dip, amount);
  }

  shake(amp = 0.15, dur = 0.4) {
    this._shake = { t: 0, dur, amp };
  }

  update(_dt, raw) {
    const dt = raw;
    const tw = this._tween;
    if (tw) {
      tw.t += dt;
      const k = tw.ease(Math.min(1, tw.t / tw.dur));
      if (tw.toPos) this.pos.lerpVectors(tw.fromPos, tw.toPos, k);
      if (tw.toLook) this.lookAt.lerpVectors(tw.fromLook, tw.toLook, k);
      if (tw.toFov !== null) this.fovValue = tw.fromFov + (tw.toFov - tw.fromFov) * k;
      if (tw.toRoll !== null) this.roll = tw.fromRoll + (tw.toRoll - tw.fromRoll) * k;
      if (tw.t >= tw.dur) {
        this._tween = null;
        tw.resolve();
      }
    } else if (this.mode === 'follow' && this.target) {
      this.target.getWorldPosition(this._tmp);
      const a = 1 - Math.exp(-this.lerp * dt);
      this._tmp2.copy(this._tmp).add(this.offset);
      this.pos.lerp(this._tmp2, a);
      this._tmp2.copy(this._tmp).add(this.look);
      this.lookAt.lerp(this._tmp2, a);
    }
    this._dip = Math.max(0, this._dip - dt * 0.9);
    this._apply(dt);
  }

  _apply(dt = 0) {
    const cam = this.camera;
    cam.position.copy(this.pos);
    const d = this._dip;
    cam.position.y -= Math.sin(Math.min(1, d / 0.35) * Math.PI * 0.5) * d;
    const s = this._shake;
    if (s.t < s.dur) {
      s.t += dt;
      const a = s.amp * (1 - s.t / s.dur);
      cam.position.x += (Math.random() - 0.5) * a;
      cam.position.y += (Math.random() - 0.5) * a;
    }
    cam.lookAt(this.lookAt);
    if (this.roll) cam.rotateZ(this.roll);
    if (Math.abs(cam.fov - this.fovValue) > 1e-3) {
      cam.fov = this.fovValue;
      cam.updateProjectionMatrix();
    }
  }
}
