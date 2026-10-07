import * as THREE from 'three';

const toV3 = (v, out = new THREE.Vector3()) => (Array.isArray(v) ? out.set(v[0], v[1], v[2]) : out.copy(v));
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2); // easeInOutCubic
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const wrapPi = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Default user-look limits. Pitch is the camera's elevation above the look point. */
export const LOOK_LIMITS = { pitch: [10 * DEG, 55 * DEG], zoom: [0.7, 1.4], yaw: null };

/**
 * Third-person follow camera with an optional user orbit (mouse look, see CameraRig).
 *   mode 'follow': orbits the look point. The chapter's offset/look (follow()) set the default
 *                  yaw, pitch and distance; the user adds `orbit.yaw` (relative), sets `orbit.pitch`
 *                  (absolute elevation) and `orbit.zoom` (distance factor). With no user input the
 *                  position is exactly target + offset, as before. Lerped with 1-exp(-lerp*dt).
 *   mode 'fixed' : stays where the last tween left it (call follow() to return). User look is ignored.
 * `offset` / `look` are the live, orbit-rotated vectors (read them to tween back to the follow shot).
 * Uses unscaled time, so tweens run at real speed during slow motion.
 */
export class FollowCam {
  constructor(camera) {
    this.camera = camera;
    this.target = null;
    this.offset = new THREE.Vector3(0, 2.6, 4.2); // effective (orbit-rotated) world offset from the target
    this.look = new THREE.Vector3(0, 1.1, 0); // effective look point, relative to target
    this._baseOffset = this.offset.clone(); // the chapter's offset/look, as passed to follow()
    this._baseLook = this.look.clone();
    this._def = { yaw: 0, pitch: 0, dist: 1 };
    this.orbit = { yaw: 0, pitch: 0, zoom: 1 };
    // yaw: [min, max] rad relative to the default, or null; box: { minX, maxX, minZ, maxZ } world bounds for the camera, or null
    this.limits = { pitch: [...LOOK_LIMITS.pitch], zoom: [...LOOK_LIMITS.zoom], yaw: null, box: null };
    this.collide = null; // (from: Vector3, to: Vector3) => free distance from `from` toward `to` (Infinity = clear)
    this.clearance = null; // (p: Vector3, pivot: Vector3) => void: push p (in place) away from nearby walls
    this._want = new THREE.Vector3();
    this._recenter = null;
    this._occ = Infinity;
    this._free = new THREE.Vector3(); // unoccluded follow position (smoothed)
    this._pivot = new THREE.Vector3();
    this._lastMoveYaw = 0;
    this._tmp3 = new THREE.Vector3();
    this._anchor = new THREE.Vector3();
    this._anchorSet = false;
    this._ePos = new THREE.Vector3();
    this._eLook = new THREE.Vector3();
    this._setBase(this._baseOffset, this._baseLook);
    this.orbit.pitch = this._def.pitch;
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
    const newTarget = !!target && target !== this.target;
    if (target) this.target = target;
    // New offsets re-centre the user look behind the target; the same offsets (or none) keep it
    // (an eased return after a cinematic). snap: true is a cut and always re-centres (see snap()).
    const o = offset ? toV3(offset, this._tmp) : this._baseOffset;
    const l = look ? toV3(look, this._tmp2) : this._baseLook;
    if (!o.equals(this._baseOffset) || !l.equals(this._baseLook)) {
      this._setBase(o, l);
      this.resetLook();
    }
    if (lerp) this.lerp = lerp;
    this._cancelTween();
    const wasFollowing = this.mode === 'follow' && this._anchorSet;
    this.mode = 'follow';
    if (!this.target) return;
    // The anchor is the smoothed target position; ePos / eLook carry the gap from the current shot
    // and decay at `lerp`, so the camera eases from wherever it is (as the plain lerp used to).
    if (newTarget || !this._anchorSet) this.target.getWorldPosition(this._anchor);
    this._anchorSet = true;
    this._orbitOffsets();
    const from = wasFollowing ? this._free : this.pos;
    this._ePos.copy(from).sub(this._anchor).sub(this.offset);
    this._eLook.copy(this.lookAt).sub(this._anchor).sub(this.look);
    if (!wasFollowing) this._occ = Infinity;
    if (snap) this.snap();
  }

  /**
   * Jump straight to the follow position. A snap is a hard cut (chapter start, teleport after a
   * fade), so it also re-centres the user look: the staging behind the player stays off camera.
   */
  snap() {
    if (!this.target) return;
    this.resetLook();
    this.target.getWorldPosition(this._anchor);
    this._anchorSet = true;
    this._ePos.set(0, 0, 0);
    this._eLook.set(0, 0, 0);
    this._free.copy(this._anchor).add(this.offset);
    this.lookAt.copy(this._anchor).add(this.look);
    this._resolve(this._anchor, 0, true);
    this._apply();
  }

  // ------------------------------------------------------------- user look (orbit)

  _setBase(offset, look) {
    this._baseOffset.copy(offset);
    this._baseLook.copy(look);
    const v = this._tmp3.copy(offset).sub(look);
    const h = Math.hypot(v.x, v.z);
    this._def.yaw = h > 1e-6 ? Math.atan2(v.x, v.z) : 0;
    this._def.pitch = Math.atan2(v.y, h);
    this._def.dist = Math.max(0.05, v.length());
  }

  /** Back to the chapter's default view at once (no animation). */
  resetLook() {
    this._recenter = null;
    this.orbit.yaw = 0;
    this.orbit.pitch = this._def.pitch;
    this.orbit.zoom = 1;
    this._orbitOffsets();
  }

  /** Ease back to the chapter's default view (R / middle click). */
  recenter(dur = 0.45) {
    this.orbit.yaw = wrapPi(this.orbit.yaw);
    this._recenter = { t: 0, dur, from: { ...this.orbit } };
  }

  /** Add user look input (radians). dyaw > 0 orbits counter-clockwise seen from above. */
  addLook(dyaw, dpitch = 0) {
    this._recenter = null;
    const o = this.orbit;
    const y = this.limits.yaw;
    o.yaw = y ? clamp(o.yaw + dyaw, y[0], y[1]) : wrapPi(o.yaw + dyaw);
    const [p0, p1] = this.pitchRange();
    o.pitch = clamp(o.pitch + dpitch, p0, p1);
  }

  /** Multiply the follow distance (wheel zoom), within limits.zoom. */
  zoomBy(f) {
    this._recenter = null;
    const [z0, z1] = this.limits.zoom;
    this.orbit.zoom = clamp(this.orbit.zoom * f, z0, z1);
  }

  /** Set the user look directly: yaw relative to the default, pitch absolute (radians); clamped. */
  setLook(yaw, pitch) {
    this._recenter = null;
    if (yaw !== undefined && yaw !== null) {
      this.orbit.yaw = 0;
      this.addLook(yaw, 0);
    }
    if (pitch !== undefined && pitch !== null) {
      const [p0, p1] = this.pitchRange();
      this.orbit.pitch = clamp(pitch, p0, p1);
    }
  }

  /** Pitch clamp, widened to include the chapter's default pitch (so the default is never clamped). */
  pitchRange() {
    const p = this._def.pitch;
    return [Math.min(this.limits.pitch[0], p), Math.max(this.limits.pitch[1], p)];
  }

  /** Default view of the current follow setup: { yaw, pitch, dist } (yaw absolute, radians). */
  get defaultLook() {
    return { ...this._def };
  }

  /** True when the user look differs from the chapter default. */
  get looking() {
    const o = this.orbit;
    return Math.abs(wrapPi(o.yaw)) > 1e-3 || Math.abs(o.pitch - this._def.pitch) > 1e-3 || Math.abs(o.zoom - 1) > 1e-3;
  }

  /**
   * Yaw for camera-relative movement (radians; rotate the world-relative input by it around +Y).
   * 0 = the camera looks down -Z. In follow mode it is the orbit yaw; in a fixed shot or tween it is
   * the shot's own ground direction.
   */
  get moveYaw() {
    if (this.mode === 'follow' && !this._tween) return this._def.yaw + this.orbit.yaw;
    const dx = this.lookAt.x - this.pos.x;
    const dz = this.lookAt.z - this.pos.z;
    if (dx * dx + dz * dz > 1e-4) this._lastMoveYaw = Math.atan2(-dx, -dz);
    return this._lastMoveYaw;
  }

  _stepRecenter(dt) {
    const r = this._recenter;
    if (!r) return;
    r.t += dt;
    const k = ease(Math.min(1, r.t / r.dur));
    const o = this.orbit;
    o.yaw = r.from.yaw * (1 - k);
    o.pitch = r.from.pitch + (this._def.pitch - r.from.pitch) * k;
    o.zoom = r.from.zoom + (1 - r.from.zoom) * k;
    if (r.t >= r.dur) this._recenter = null;
  }

  /** offset / look from the base offsets plus the user orbit. */
  _orbitOffsets() {
    const o = this.orbit;
    const bl = this._baseLook;
    if (!this.looking) {
      this.offset.copy(this._baseOffset);
      this.look.copy(bl);
      return;
    }
    const c = Math.cos(o.yaw);
    const s = Math.sin(o.yaw);
    this.look.set(bl.x * c + bl.z * s, bl.y, -bl.x * s + bl.z * c);
    const yaw = this._def.yaw + o.yaw;
    const r = this._def.dist * o.zoom;
    const cp = Math.cos(o.pitch);
    this.offset.set(r * cp * Math.sin(yaw), r * Math.sin(o.pitch), r * cp * Math.cos(yaw)).add(this.look);
  }

  /**
   * this.pos from this._free: kept inside limits.box and clear of walls beside / above it
   * (clearance), then pulled in front of the first occluder (fast in, slow out) and kept above the
   * floor. `base` is the target's world position.
   */
  _resolve(base, dt, instant = false) {
    const want = this.pos.copy(this._free);
    const piv = this._pivot.set(base.x, base.y + this.look.y, base.z);
    const box = this.limits.box;
    const inBox = () => {
      if (!box) return;
      want.x = clamp(want.x, box.minX ?? -Infinity, box.maxX ?? Infinity);
      want.z = clamp(want.z, box.minZ ?? -Infinity, box.maxZ ?? Infinity);
    };
    const clear = () => {
      if (!this.clearance) return;
      try {
        this.clearance(this.pos, piv);
      } catch (err) {
        console.warn('[cam] clearance failed', err);
        this.clearance = null;
      }
      inBox();
    };
    inBox();
    clear();
    if (this.collide) {
      const to = this._want.copy(want);
      const dir = this._tmp3.copy(to).sub(piv);
      const len = dir.length();
      if (len > 1e-4) {
        dir.multiplyScalar(1 / len);
        let free = len;
        try {
          free = Math.min(len, this.collide(piv, to));
        } catch (err) {
          console.warn('[cam] collide failed', err);
          this.collide = null;
        }
        this._occ = Math.min(this._occ, len);
        if (instant) this._occ = free;
        else if (free < this._occ) this._occ = Math.min(this._occ + (free - this._occ) * (1 - Math.exp(-30 * dt)), free + 0.1); // in: fast
        else this._occ += (free - this._occ) * (1 - Math.exp(-3.5 * dt)); // out: eased
        if (this._occ < len - 1e-3) {
          this.pos.copy(piv).addScaledVector(dir, Math.max(0.25, this._occ));
          clear(); // pulled in among other geometry (under a scaffold, through a doorway): clear it again
        }
      }
    }
    const floor = base.y + 0.3;
    if (this.pos.y < floor) this.pos.y = floor;
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
      if (!this._anchorSet) this.follow(null);
      this.target.getWorldPosition(this._tmp);
      const a = 1 - Math.exp(-this.lerp * dt);
      this._anchor.lerp(this._tmp, a);
      this._ePos.multiplyScalar(1 - a);
      this._eLook.multiplyScalar(1 - a);
      this._stepRecenter(dt);
      this._orbitOffsets(); // user look applies at once (no follow lag), the anchor carries the smoothing
      this._free.copy(this._anchor).add(this.offset).add(this._ePos);
      this.lookAt.copy(this._anchor).add(this.look).add(this._eLook);
      this._resolve(this._anchor, dt);
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
