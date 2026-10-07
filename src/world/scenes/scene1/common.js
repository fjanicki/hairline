import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Shared layout constants and geometry helpers for the Ch1 flat (scene1.js and its modules).
// The room is a 6 x 5 m dollhouse box (the +Z wall is omitted so the follow camera sits outside it).

export const W = 6; // room width (x)
export const D = 5; // room depth (z)
export const H = 2.7; // wall height
export const T = 0.16; // wall thickness
export const IN_X = W / 2 - T / 2; // 2.92, inner face of the side walls
export const BACK_Z = -D / 2 + T / 2; // -2.42, inner face of the back wall
export const EX = W / 2 + T / 2; // 3.08, outer extent of the side walls
export const WIN = { x0: -1.55, x1: -0.55, y0: 0.95, y1: 2.15 };
export const DOOR = { x0: 1.72, x1: 2.74, h: 2.11 };
export const DOOR_X = (DOOR.x0 + DOOR.x1) / 2;

export const TV_POS = [0.55, -2.17]; // CRT footprint centre (on the sideboard)
export const TV_TOP = 0.6; // sideboard top
export const FLUORO_Z = 1.75; // centre of the kitchenette (right wall)
export const FRIDGE = { x: IN_X - 0.31, z: 0.9, w: 0.62, d: 0.6, h: 1.58 }; // front face at x 2.31
export const FRIDGE_FRONT = FRIDGE.x - FRIDGE.d / 2; // 2.31
export const KITCHEN = { z0: 1.24, z1: 2.16, depth: 0.6, top: 0.9 };
export const BIKE_POS = [-IN_X + 0.24, 1.02, 0.4];
export const LAMP_POS = [-1.72, -2.18];

export const clamp = THREE.MathUtils.clamp;
export const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
/** Small deterministic hash (stable "random" per index). */
export const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Axis-aligned box geometry from world extents (no UV work; the PBR materials are world-mapped). */
export function boxAt(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

/** Cylinder geometry spanning a -> b. */
export function rod(a, b, r, seg = 8, r2 = r) {
  const d = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r2, r, d.length(), seg, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/** Strip every attribute but position / normal / uv (so geometries from different sources merge). */
export function clean(g) {
  const geo = g.index ? g.toNonIndexed() : g;
  if (geo !== g) g.dispose();
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) geo.deleteAttribute(k);
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  geo.morphAttributes = {};
  return geo;
}

/** One mesh from many geometries sharing a material (disposes the inputs). */
export function merged(geos, material, { castShadow = true, receiveShadow = true, name } = {}) {
  const list = geos.filter(Boolean).map(clean);
  const m = new THREE.Mesh(mergeGeometries(list, false), material);
  for (const g of list) g.dispose();
  m.castShadow = castShadow;
  m.receiveShadow = receiveShadow;
  if (name) m.name = name;
  return m;
}

/**
 * A bag of geometries per material key, flushed into one merged mesh per material: the static
 * dressing of the whole flat costs one draw call per material instead of one per piece.
 */
export class Batch {
  constructor() {
    this.sets = new Map();
  }
  add(material, geo, { castShadow = true } = {}) {
    const key = material.uuid + (castShadow ? ':c' : ':n');
    let s = this.sets.get(key);
    if (!s) this.sets.set(key, (s = { material, castShadow, geos: [] }));
    s.geos.push(geo);
    return geo;
  }
  flush(group, name = 'batch') {
    let i = 0;
    for (const s of this.sets.values()) {
      if (!s.geos.length) continue;
      group.add(merged(s.geos, s.material, { castShadow: s.castShadow, name: `${name}-${i++}` }));
    }
    this.sets.clear();
  }
}

/** Apply a transform to a geometry (position, Euler rotation, uniform or vector scale). */
export function place(g, [x, y, z], rot = [0, 0, 0], scale = 1) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])),
    typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(...scale),
  );
  g.applyMatrix4(m);
  return g;
}

/**
 * Crumpled cloth: a w x d sheet with noisy folds that sags `drop` metres over its edges (a duvet
 * off the side of a bed, a blanket on a cushion). Lies on y = 0, centred.
 */
export function cloth(w, d, { seg = 18, lumps = 0.035, drop = 0, dropSides = [1, 1, 1, 1], seed = 1, thick = 0.02 } = {}) {
  const g = new THREE.BoxGeometry(w, thick, d, seg, 1, seg);
  const p = g.attributes.position;
  const s = seed * 1.37;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const u = x / (w / 2);
    const v = z / (d / 2);
    let y = p.getY(i);
    y += lumps * (Math.sin(x * 9.1 + s) * Math.sin(z * 7.3 - s) + 0.6 * Math.sin(x * 17 + z * 13 + s * 2) * 0.5);
    // Edges fall over the sides (only the flagged sides: -x, +x, -z, +z).
    const ex = Math.max(0, Math.abs(u) - 0.82) / 0.18;
    const ez = Math.max(0, Math.abs(v) - 0.82) / 0.18;
    const fx = (u < 0 ? dropSides[0] : dropSides[1]) * ex;
    const fz = (v < 0 ? dropSides[2] : dropSides[3]) * ez;
    const f = Math.min(1, Math.max(fx, fz));
    y -= drop * f * f;
    p.setY(i, y);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Soft furnishings (mattress, pillow, cushion): a superellipsoid w x h x d (exponent `e`: 1 = an
 * ellipsoid, 0.2 = a box with soft edges) with a little lumpiness. Centred on the origin.
 */
export function softBox(w, h, d, { e = 0.3, detail = 4, lumps = 0.006, seed = 1, sag = 0 } = {}) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const f = (x) => Math.sign(x) * Math.pow(Math.abs(x), e);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const x = f(v.x) * (w / 2);
    const z = f(v.z) * (d / 2);
    let y = f(v.y) * (h / 2);
    // the top dips in the middle (a head-shaped hollow / where he lies), lumps everywhere
    if (y > 0) y -= sag * h * (1 - Math.abs(v.x)) * (1 - Math.abs(v.z));
    const n = lumps * Math.sin(x * 23 + seed) * Math.sin(z * 19 - seed) + lumps * 0.6 * Math.sin(x * 41 + z * 37 + seed * 2);
    p.setXYZ(i, x, y + n, z);
  }
  g.computeVertexNormals();
  return g;
}
