import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Small helpers for the Ch2 / Ch5 street (scene2.js): a static-geometry batcher that merges every
// piece sharing a material into one mesh (one draw call, one shadow draw), plus a few geometry
// builders. The street materials are world-mapped look recipes, so merged pieces need no UV work.

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/** Matrix from {pos:[x,y,z], rot:[x,y,z] | rotY, scale:[x,y,z] | s}. */
export function compose({ pos = [0, 0, 0], rot, rotY = 0, scale, s } = {}, out = new THREE.Matrix4()) {
  _e.set(rot ? rot[0] : 0, rot ? rot[1] : rotY, rot ? rot[2] : 0);
  _q.setFromEuler(_e);
  if (scale) _s.set(scale[0], scale[1], scale[2]);
  else _s.setScalar(s ?? 1);
  return out.compose(_p.set(pos[0], pos[1], pos[2]), _q, _s);
}

/**
 * Collects geometry per key; build() merges each key into one Mesh.
 *   batch.material(key, material, {castShadow, receiveShadow, name, noOcclude, renderOrder})
 *   batch.add(key, geometry, {pos, rot | rotY, scale, matrix, parent: Matrix4, color})
 * The geometry passed to add() is consumed (transformed in place). `color` adds a vertex colour
 * attribute to that piece (white elsewhere in the same set); give the material vertexColors.
 */
export class Batch {
  constructor() {
    this.sets = new Map();
  }

  material(key, material, opts = {}) {
    const s = this._set(key);
    s.material = material;
    s.opts = { ...s.opts, ...opts };
    return this;
  }

  _set(key) {
    let s = this.sets.get(key);
    if (!s) {
      s = { material: null, geos: [], colored: false, opts: {} };
      this.sets.set(key, s);
    }
    return s;
  }

  add(key, geo, o = {}) {
    const s = this._set(key);
    const m = o.matrix ? _m.copy(o.matrix) : compose(o, _m);
    if (o.parent) m.premultiply(o.parent);
    geo.applyMatrix4(m);
    if (o.color !== undefined) {
      s.colored = true;
      _c.set(o.color); // a Color may carry values > 1 (lit windows); keep them
      geo.userData.rgb = [_c.r, _c.g, _c.b];
    }
    s.geos.push(geo);
    return geo;
  }

  /** Merge everything into meshes under a Group. Keys without a material are skipped (warned). */
  build(name = 'batch') {
    const group = new THREE.Group();
    group.name = name;
    for (const [key, s] of this.sets) {
      if (!s.geos.length) continue;
      if (!s.material) {
        console.warn('[hairline] scene2 batch has no material:', key);
        continue;
      }
      const anyNonIndexed = s.geos.some((g) => !g.index);
      const parts = s.geos.map((g) => {
        let x = anyNonIndexed && g.index ? g.toNonIndexed() : g;
        for (const a of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(a)) x.deleteAttribute(a);
        if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
        if (s.colored) {
          const rgb = g.userData.rgb || [1, 1, 1];
          const n = x.attributes.position.count;
          const arr = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) arr.set(rgb, i * 3);
          x.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
        }
        x.morphAttributes = {};
        return x;
      });
      const merged = mergeGeometries(parts, false);
      for (const g of s.geos) g.dispose();
      if (!merged) {
        console.warn('[hairline] scene2 batch merge failed:', key);
        continue;
      }
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, s.material);
      mesh.name = `${name}:${key}`;
      mesh.castShadow = s.opts.castShadow ?? true;
      mesh.receiveShadow = s.opts.receiveShadow ?? true;
      if (s.opts.noOcclude) mesh.userData.noOcclude = true;
      if (s.opts.renderOrder !== undefined) mesh.renderOrder = s.opts.renderOrder;
      group.add(mesh);
    }
    this.sets.clear();
    return group;
  }
}

// ------------------------------------------------------------------ geometry

/** Box with its origin at the bottom centre. */
export const boxGeo = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);

/** Box centred on its origin. */
export const cbox = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/** Cylinder standing on its base. */
export const cyl = (rTop, rBot, h, seg = 10) => new THREE.CylinderGeometry(rTop, rBot, h, seg, 1).translate(0, h / 2, 0);

/** A tube along a list of points (Catmull-Rom), radius r. */
export function tubeGeo(points, r, segs = 24, radial = 6) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))));
  return new THREE.TubeGeometry(curve, segs, r, radial, false);
}

/** A straight tube (cylinder) from a to b. */
export function rod(a, b, r, seg = 6) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  const dir = B.clone().sub(A).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return g;
}

/** A sagging cable between a and b (sag metres at mid-span). */
export function cableGeo(a, b, sag = 0.6, r = 0.012) {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, r, 4, false);
}

/** Plane facing +Z with its UVs mapped to the atlas cell [u0, v0, u1, v1]. */
export function atlasPlane(w, h, cell) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, cell[0] + uv.getX(i) * (cell[2] - cell[0]), cell[1] + uv.getY(i) * (cell[3] - cell[1]));
  uv.needsUpdate = true;
  return g;
}

/** Flag thin dressing so the camera rig never treats it as an occluder. */
export function noOcclude(obj) {
  obj.traverse((o) => (o.userData.noOcclude = true));
  return obj;
}
