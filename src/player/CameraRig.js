import * as THREE from 'three';
import { LOOK_LIMITS } from './FollowCam.js';

// Mouse look for the third-person FollowCam: pointer lock (click the canvas), a hold-and-drag
// fallback (left or right button), wheel zoom, R / middle click to re-centre, and camera occlusion
// against the current world's static meshes. All look input is ignored outside free-roam play.

const DEG = Math.PI / 180;
const SENSITIVITY = 0.0032; // radians per mouse pixel (both axes; not inverted)
const WHEEL = 0.0011; // zoom factor per wheel pixel (exp)
const MARGIN = 0.22; // metres kept between the camera and an occluder
// The camera has a body: occlusion casts a fan (the centre plus rays that end on rings of FAN and
// FAN / 2 m around the camera), and clearance() keeps it CLEAR m from walls beside and above it.
const FAN = 0.25;
const FAN_RAYS = 12;
const FAN_PER_FRAME = 4;
const FAN_MIN = 0.9; // fan hits nearer the pivot than this are walls beside Hugo: clearance() handles those
const CLEAR = 0.35;
const PROBE_BACK = 0.06; // clearance probes start this far behind the camera, so a face it sits on still counts
const MIN_RADIUS = 0.3; // occluders smaller than this (bounding sphere, metres) are ignored
const MIN_TOP = 0.3; // ...and so are meshes that never rise above this height (floors, puddles, decals)
const REBUILD_EVERY = 2.5; // seconds between occluder-list refreshes (scenes add props mid-chapter)
const LOST_LOCK_ESC_MS = 600; // an Esc keydown this soon after the lock was lost was the same press
const SKIP_NAME = /\b(rain|decals?|splash|puddles?|dust|fx|glow|beam|sky|fog|particles?)\b/i;

/**
 * Per-chapter look limits, keyed by chapter id. `yaw` is [min, max] in degrees relative to the
 * chapter's default view (the cut-away rooms keep the camera on their open side), `zoom` narrows the
 * distance factor, `pitch` (degrees) overrides the 10-55 degree default. `box` ({ minX, maxX, minZ,
 * maxZ }, world metres, any subset) keeps the camera inside the room's side walls even where it hangs
 * out past the cut, so it never sees the walls' outsides or the void beside the set.
 */
export const CHAPTER_LOOK = {
  // Ch1: dollhouse flat, 6 x 5 m, +Z wall left out. Side walls at x = +-3.
  flat: { yaw: [-18, 18], pitch: [18, 40], zoom: [0.75, 1.08], box: { minX: -2.6, maxX: 2.6 } },
  // Ch4: dollhouse workshop, 9 x 6 m, +Z wall left out. Side walls at x = +-4.5.
  workshop: { yaw: [-20, 20], pitch: [18, 40], zoom: [0.75, 1.08], box: { minX: -4.1, maxX: 4.1 } },
};

const _sphere = new THREE.Sphere();
const _box = new THREE.Box3();
const _seg = new THREE.Vector3();
const _rel = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _side = new THREE.Vector3();
const _up = new THREE.Vector3();
const _end = new THREE.Vector3();
const _o = new THREE.Vector3();
const _push = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Opaque, solid material. `seen` relaxes this to "drawn and mostly opaque" (alpha-cut bracing, railings). */
function materialBlocks(m, seen = false) {
  if (!m) return false;
  if (Array.isArray(m)) return m.some((x) => materialBlocks(x, seen));
  if (m.visible === false || m.colorWrite === false) return false;
  if (!seen && m.depthWrite === false) return false;
  if (m.transparent && (m.opacity ?? 1) < (seen ? 0.5 : 0.98)) return false;
  if (m.blending !== undefined && m.blending !== THREE.NormalBlending) return false;
  if (m.polygonOffset) return false; // decals
  if (m.isPointsMaterial || m.isLineBasicMaterial || m.isSpriteMaterial) return false;
  return true;
}

// ------------------------------------------------------------- triangle soups
// Mesh.raycast tests every triangle, and the scenes merge whole facades and rooms into a few big
// meshes, so a ray costs ~0.1 ms. Big static meshes get a cached world-space copy of their triangles
// in ~2 m chunks with bounding boxes; a ray then only tests the chunks it passes through.

const SOUP_MIN_TRIS = 48;
const CHUNK = 2;
const _soups = new WeakMap();
const _ta = new THREE.Vector3();
const _tb = new THREE.Vector3();
const _tc = new THREE.Vector3();
const _hitP = new THREE.Vector3();

function triSoup(o) {
  const g = o.geometry;
  const pos = g?.attributes?.position;
  if (!pos || g.morphAttributes?.position) return null;
  const idx = g.index;
  const tris = (idx ? idx.count : pos.count) / 3;
  if (tris < SOUP_MIN_TRIS) return null;
  const e = o.matrixWorld.elements;
  const key = `${pos.version}|${idx?.version ?? -1}|${e[0]},${e[1]},${e[2]},${e[4]},${e[5]},${e[6]},${e[8]},${e[9]},${e[10]},${e[12]},${e[13]},${e[14]}`;
  const prev = _soups.get(o);
  const now = performance.now();
  if (prev) {
    if (prev.key !== key) {
      // It moved (a door, a bike): plain raycasts until it has been still for half a second.
      _soups.set(o, { key, chunks: null, t: now });
      return null;
    }
    if (prev.chunks) return prev;
    if (now - prev.t < 500) return null;
  }
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  const cells = new Map();
  for (let i = 0; i < tris; i++) {
    const ia = idx ? idx.getX(i * 3) : i * 3;
    const ib = idx ? idx.getX(i * 3 + 1) : i * 3 + 1;
    const ic = idx ? idx.getX(i * 3 + 2) : i * 3 + 2;
    _ta.fromBufferAttribute(pos, ia).applyMatrix4(o.matrixWorld);
    _tb.fromBufferAttribute(pos, ib).applyMatrix4(o.matrixWorld);
    _tc.fromBufferAttribute(pos, ic).applyMatrix4(o.matrixWorld);
    const k =
      (Math.floor((_ta.x + _tb.x + _tc.x) / (3 * CHUNK)) * 73856093) ^
      (Math.floor((_ta.y + _tb.y + _tc.y) / (3 * CHUNK)) * 19349663) ^
      (Math.floor((_ta.z + _tb.z + _tc.z) / (3 * CHUNK)) * 83492791); // cell hash (a collision only merges two cells)
    let c = cells.get(k);
    if (!c) cells.set(k, (c = { v: [], box: new THREE.Box3() }));
    c.v.push(_ta.x, _ta.y, _ta.z, _tb.x, _tb.y, _tb.z, _tc.x, _tc.y, _tc.z);
    c.box.expandByPoint(_ta).expandByPoint(_tb).expandByPoint(_tc);
  }
  const chunks = [...cells.values()].map((c) => ({ v: new Float32Array(c.v), box: c.box }));
  // Front faces only for single-sided materials, as Mesh.raycast does.
  const soup = { key, chunks, cull: m?.side === THREE.FrontSide, t: now };
  _soups.set(o, soup);
  return soup;
}

/** Nearest hit distance of `ray` (THREE.Ray) on a soup within [0, far], or Infinity. */
function soupHit(soup, ray, far) {
  let best = far;
  let hit = false;
  for (const c of soup.chunks) {
    if (!c.box.containsPoint(ray.origin)) {
      if (!ray.intersectBox(c.box, _hitP) || _hitP.distanceToSquared(ray.origin) > best * best) continue;
    }
    const v = c.v;
    for (let i = 0; i < v.length; i += 9) {
      _ta.fromArray(v, i);
      _tb.fromArray(v, i + 3);
      _tc.fromArray(v, i + 6);
      if (!ray.intersectTriangle(_ta, _tb, _tc, soup.cull, _hitP)) continue;
      const d = _hitP.distanceTo(ray.origin);
      if (d <= best) {
        best = d;
        hit = true;
      }
    }
  }
  return hit ? best : Infinity;
}

/** True when o and all of its parents up to `root` are visible. */
function shown(o, root) {
  for (let p = o; p; p = p.parent) {
    if (!p.visible) return false;
    if (p === root) return true;
  }
  return true;
}

export class CameraRig {
  /**
   * deps: { cam (FollowCam), canvas, input, ui, engine, world, player, getDirector: () => Director,
   *         onLockLost: () => void (pause the game when the browser drops the lock, e.g. Esc) }
   */
  constructor({ cam, canvas, input, ui, engine, world, player, getDirector, onLockLost }) {
    Object.assign(this, { cam, canvas, input, ui, engine, world, player, getDirector, onLockLost });
    this.updateWhilePaused = true;
    this.enabled = true;
    this.locked = false;
    this.lockSupported = !!canvas?.requestPointerLock;
    this.stats = { occluders: 0, rays: 0, ms: 0, clearMs: 0, lockRequests: 0, lockErrors: 0, drags: 0 };
    this._drag = null;
    this._expectUnlock = false;
    this._lostAt = -1e9;
    this._chapter = undefined;
    this._group = null;
    this._occluders = [];
    this._near = [];
    this._fan = { t: new Float32Array(FAN_RAYS).fill(Infinity), next: 0, from: new THREE.Vector3(1e9, 0, 0), dir: new THREE.Vector3(), len: 0 };
    this._rebuildIn = 0;
    this._ray = new THREE.Raycaster();
    this._hits = [];
    cam.collide = (from, to) => this.collide(from, to);
    cam.clearance = (p, pivot) => this.clearance(p, pivot);

    // A press that starts while the camera is not free (it advances a dialogue line or a card, see
    // UI's pointerdown) must not also start a drag or a pointer lock once that line closes and the
    // state flips to 'play' before the same press's mousedown arrives. Capture phase: before UI.
    this._pressBlocked = false;
    document.addEventListener('pointerdown', () => (this._pressBlocked = !this.canLook()), true);
    canvas.addEventListener('mousedown', (e) => this._down(e));
    window.addEventListener('mousemove', (e) => this._move(e));
    window.addEventListener('mouseup', (e) => this._up(e));
    window.addEventListener('blur', () => (this._drag = null));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => this._wheel(e), { passive: false });
    document.addEventListener('pointerlockchange', () => this._lockChange());
    document.addEventListener('pointerlockerror', () => {
      this.stats.lockErrors++;
      this._expectUnlock = false;
    });
    input.onKey((code) => {
      if (code === 'KeyR' && this.canLook()) this.cam.recenter();
    });
  }

  // ------------------------------------------------------------- gating

  /** Free-roam play: the only time the camera answers the mouse (and the objective pointer shows). */
  freeRoam() {
    const d = this.getDirector?.();
    const { player, ui, engine, cam } = this;
    if (!this.enabled || !d || d.state !== 'play') return false;
    if (engine.paused || ui.paused || ui.pauseEl) return false;
    if (!player || player.frozen || player.held > 0 || player.scripted || player.inputAllowed?.() === false) return false;
    if (ui.modal || ui._gauge || ui._drive) return false; // dialogue / choices / card, minigame gauge, timing ring
    if ((ui.fadeValue ?? 0) > 0.5) return false;
    if (cam.mode !== 'follow' || cam._tween) return false; // a cinematic owns the camera
    return true;
  }

  canLook() {
    return this.freeRoam();
  }

  /** True (once) if an Esc keydown arrives right after the browser dropped the lock for it. */
  swallowEscape() {
    if (performance.now() - this._lostAt < LOST_LOCK_ESC_MS) {
      this._lostAt = -1e9;
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------- mouse

  _down(e) {
    if (e.target !== this.canvas || this._pressBlocked || !this.canLook()) return;
    if (e.button === 1) {
      e.preventDefault(); // no autoscroll
      this.cam.recenter();
      return;
    }
    if (e.button !== 0 && e.button !== 2) return;
    this._drag = { x: e.clientX, y: e.clientY, button: e.button };
    this.stats.drags++;
    if (e.button === 0 && this.lockSupported && !this.locked) this._requestLock();
  }

  _requestLock() {
    this.stats.lockRequests++;
    try {
      const r = this.canvas.requestPointerLock();
      if (r && typeof r.catch === 'function') r.catch(() => this.stats.lockErrors++);
    } catch {
      this.stats.lockErrors++;
    }
  }

  _move(e) {
    let dx = 0;
    let dy = 0;
    if (this.locked) {
      dx = e.movementX || 0;
      dy = e.movementY || 0;
    } else if (this._drag) {
      const mask = this._drag.button === 2 ? 2 : 1;
      if (!(e.buttons & mask)) {
        this._drag = null;
        return;
      }
      dx = e.clientX - this._drag.x;
      dy = e.clientY - this._drag.y;
      this._drag.x = e.clientX;
      this._drag.y = e.clientY;
    } else return;
    if (!this.canLook()) return;
    // Some browsers report a huge first delta right after the lock engages.
    if (Math.abs(dx) > 400 || Math.abs(dy) > 400) return;
    this.cam.addLook(-dx * SENSITIVITY, dy * SENSITIVITY);
  }

  _up(e) {
    if (this._drag && (e.button === this._drag.button || !e.buttons)) this._drag = null;
  }

  _wheel(e) {
    if (!this.canLook()) return;
    e.preventDefault();
    const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    this.cam.zoomBy(Math.exp(THREE.MathUtils.clamp(px, -240, 240) * WHEEL));
  }

  _lockChange() {
    const was = this.locked;
    this.locked = document.pointerLockElement === this.canvas;
    if (was && !this.locked) {
      const expected = this._expectUnlock;
      this._expectUnlock = false;
      this._drag = null;
      // Esc (or a focus loss) took the lock while the player was walking: pause right away, so one
      // Esc press both frees the mouse and opens the pause menu.
      if (!expected && !this.engine.paused && this.freeRoam()) {
        this._lostAt = performance.now();
        this.onLockLost?.();
      }
    }
  }

  /** Release the pointer lock (no pause). */
  release() {
    this._drag = null;
    if (document.pointerLockElement === this.canvas) {
      this._expectUnlock = true;
      document.exitPointerLock?.();
    }
  }

  // ------------------------------------------------------------- per frame

  update(_dt, raw) {
    const d = this.getDirector?.();
    if (d && d.index !== this._chapter) {
      this._chapter = d.index;
      this._applyChapterLimits(d.chapter?.id);
      this.cam.resetLook();
    }
    if (!this.canLook()) {
      if (this.locked) this.release();
      this._drag = null;
    }
    if (this.world.group !== this._group) {
      this._group = this.world.group;
      this._rebuildIn = 0;
    }
    this._rebuildIn -= raw;
    if (this._rebuildIn <= 0) {
      this._rebuildIn = REBUILD_EVERY;
      this._buildOccluders();
    }
  }

  _applyChapterLimits(id) {
    const c = CHAPTER_LOOK[id] || {};
    const L = this.cam.limits;
    L.yaw = c.yaw ? [c.yaw[0] * DEG, c.yaw[1] * DEG] : null;
    L.zoom = c.zoom ? [...c.zoom] : [...LOOK_LIMITS.zoom];
    L.pitch = c.pitch ? [c.pitch[0] * DEG, c.pitch[1] * DEG] : [...LOOK_LIMITS.pitch];
    L.box = c.box ? { ...c.box } : null;
  }

  /** Static, opaque, solid meshes of the current world (characters, FX, decals, small props excluded). */
  _buildOccluders() {
    const list = [];
    const near = []; // for clearance(): the occluders plus drawn see-through meshes
    const root = this.world.group;
    if (root) {
      root.updateMatrixWorld(true);
      const walk = (o) => {
        if (o.userData?.character || o.userData?.noOcclude || o.isSkinnedMesh) return;
        if (o.name && SKIP_NAME.test(o.name)) return;
        const solid = materialBlocks(o.material);
        if ((o.isMesh || o.isInstancedMesh) && !o.isPoints && !o.isLine && !o.isSprite && (solid || materialBlocks(o.material, true))) {
          const g = o.geometry;
          if (g) {
            if (!g.boundingSphere) g.computeBoundingSphere();
            if (o.isInstancedMesh) _box.setFromObject(o);
            else {
              if (!g.boundingBox) g.computeBoundingBox();
              _box.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
            }
            const r = _box.getSize(_seg).length() / 2;
            if (r >= MIN_RADIUS && _box.max.y >= MIN_TOP) {
              if (solid) list.push(o);
              near.push(o);
            }
          }
        }
        for (const c of o.children) walk(c);
      };
      walk(root);
    }
    this._occluders = list;
    this._near = near;
    this.stats.occluders = list.length;
  }

  /** Distance to the first static occluder along origin + dir * [0, far] (dir unit), or Infinity. */
  _nearest(origin, dir, far, list = this._occluders) {
    const root = this.world.group;
    const ray = this._ray;
    ray.set(origin, dir);
    ray.near = 0;
    ray.far = far;
    let best = Infinity;
    const hits = this._hits;
    for (const o of list) {
      const g = o.geometry;
      if (!g?.boundingSphere) continue;
      if (!o.isInstancedMesh) {
        _sphere.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
        // distance from the sphere centre to the segment
        const t = THREE.MathUtils.clamp(_rel.copy(_sphere.center).sub(origin).dot(dir), 0, far);
        const dist2 = _rel.addScaledVector(dir, -t).lengthSq();
        if (dist2 > _sphere.radius * _sphere.radius) continue;
      }
      if (!shown(o, root)) continue;
      this.stats.rays++;
      const soup = o.isInstancedMesh ? null : triSoup(o);
      if (soup) {
        const d = soupHit(soup, ray.ray, Math.min(far, best));
        if (d < best) best = d;
        continue;
      }
      hits.length = 0;
      o.raycast(ray, hits);
      for (const h of hits) if (h.distance < best) best = h.distance;
    }
    return best;
  }

  /**
   * Free distance from `from` toward `to`: the nearest static occluder hit minus a margin, or
   * Infinity when clear. Casts the centre line plus a fan of rays to two rings (FAN and FAN / 2 m)
   * around `to` (hits projected onto the centre line), so an edge or a post that only grazes the
   * centre line still counts. Fan hits nearer the pivot than FAN_MIN are walls beside Hugo, which
   * clearance() deals with by sliding the camera instead of pulling it into his head.
   */
  collide(from, to) {
    const t0 = performance.now();
    const len = _dir.copy(to).sub(from).length();
    if (!this.world.group || len < 1e-4 || !this._occluders.length) return Infinity;
    _dir.multiplyScalar(1 / len);
    _side.crossVectors(_dir, UP);
    if (_side.lengthSq() < 1e-6) _side.set(1, 0, 0);
    _side.normalize();
    _up.crossVectors(_side, _dir).normalize();
    let best = this._nearest(from, _dir, len + MARGIN);
    // Raycasts are plain JS over merged meshes, so the fan is spread over FAN_RAYS / FAN_PER_FRAME
    // frames (cached per ray); all of it is recast when the line jumps (a cut, a fast flick).
    const fan = this._fan;
    const jumped = from.distanceToSquared(fan.from) > 0.04 || _dir.dot(fan.dir) < 0.995 || Math.abs(len - fan.len) > 0.3;
    fan.from.copy(from);
    fan.dir.copy(_dir);
    fan.len = len;
    for (let k = 0; k < (jumped ? FAN_RAYS : FAN_PER_FRAME); k++) {
      const i = jumped ? k : (fan.next + k * 3) % FAN_RAYS;
      // eight rays on a ring of radius FAN, four on FAN / 2 (thin posts close to the centre line)
      const a = i < 8 ? (i + 0.5) * (Math.PI / 4) : (i - 8) * (Math.PI / 2);
      const r = i < 8 ? FAN : FAN / 2;
      _end.copy(to).addScaledVector(_side, Math.cos(a) * r).addScaledVector(_up, Math.sin(a) * r);
      const l = _seg.copy(_end).sub(from).length();
      _seg.multiplyScalar(1 / l);
      fan.t[i] = this._nearest(from, _seg, l + MARGIN) * _seg.dot(_dir);
    }
    if (!jumped) fan.next = (fan.next + 1) % 3;
    for (let i = 0; i < FAN_RAYS; i++) if (fan.t[i] >= FAN_MIN && fan.t[i] < best) best = fan.t[i];
    this.stats.ms = this.stats.ms * 0.9 + (performance.now() - t0) * 0.1;
    return best === Infinity ? Infinity : Math.max(0, best - MARGIN);
  }

  /**
   * Push camera position `p` (in place) at least CLEAR m away from walls beside and above it: short
   * probes left, right, forward-left, forward-right and up (each starts PROBE_BACK m behind `p`, so a
   * face `p` sits on, or just behind, still counts) against the occluders plus drawn see-through
   * meshes. Opposite pushes cancel, which centres the camera in a narrow gap.
   */
  clearance(p, pivot) {
    const t0 = performance.now();
    if (!this.world.group || !this._occluders.length) return;
    _side.set(pivot.z - p.z, 0, p.x - pivot.x); // horizontal, perpendicular to the view
    if (_side.lengthSq() < 1e-6) _side.set(1, 0, 0);
    _side.normalize();
    _up.set(-_side.z, 0, _side.x); // horizontal, toward the pivot
    _push.set(0, 0, 0);
    const reach = CLEAR + PROBE_BACK;
    for (let i = 0; i < 5; i++) {
      const sgn = i % 2 ? -1 : 1;
      if (i < 2) _seg.copy(_side).multiplyScalar(sgn);
      else if (i < 4) _seg.copy(_up).addScaledVector(_side, sgn).normalize(); // forward-left / forward-right: posts just in front of the camera
      else _seg.copy(UP);
      _o.copy(p).addScaledVector(_seg, -PROBE_BACK);
      const t = this._nearest(_o, _seg, reach, this._near);
      if (t >= reach) continue;
      if (i === 2 || i === 3) _push.addScaledVector(_side, sgn * (t - reach)); // slide sideways only (the fan handles depth)
      else _push.addScaledVector(_seg, t - reach);
    }
    if (_push.lengthSq() > 1e-8) {
      if (_push.length() > CLEAR * 1.5) _push.setLength(CLEAR * 1.5);
      p.add(_push);
    }
    this.stats.clearMs = this.stats.clearMs * 0.9 + (performance.now() - t0) * 0.1;
  }

  // ------------------------------------------------------------- debug

  /** Set the view without a mouse: yaw relative to the chapter default, pitch absolute (degrees). */
  look(yawDeg, pitchDeg, zoom) {
    this.cam.setLook(yawDeg == null ? null : yawDeg * DEG, pitchDeg == null ? null : pitchDeg * DEG);
    if (zoom != null) this.cam.zoomBy(zoom / this.cam.orbit.zoom);
    return this.view();
  }

  view() {
    const c = this.cam;
    const r = (v) => +(v / DEG).toFixed(2);
    return {
      yaw: r(c.orbit.yaw),
      pitch: r(c.orbit.pitch),
      zoom: +c.orbit.zoom.toFixed(3),
      moveYaw: r(c.moveYaw),
      defaultYaw: r(c.defaultLook.yaw),
      defaultPitch: r(c.defaultLook.pitch),
      limits: { yaw: c.limits.yaw?.map(r) ?? null, pitch: c.pitchRange().map(r), zoom: c.limits.zoom },
      locked: this.locked,
      canLook: this.canLook(),
      occluded: Number.isFinite(c._occ) ? +c._occ.toFixed(2) : null,
      stats: { ...this.stats, ms: +this.stats.ms.toFixed(3), clearMs: +this.stats.clearMs.toFixed(3) },
    };
  }
}
