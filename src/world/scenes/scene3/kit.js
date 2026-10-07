import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Ch3 geometry kit: a static batcher (one merged mesh per material) and the procedural pieces the
// ring road is built from (lamp posts, bare trees, crowd barriers, cones, stairs). Everything is
// built in metres with its base on y = 0 unless noted. World-mapped look materials need no UVs, so
// merged meshes keep the right texture scale.

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Keep only position / normal / uv so any two geometries merge. */
function clean(geo) {
  for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  return geo;
}

/** Transform a geometry in place: pos [x,y,z], rot [x,y,z] (rad), scale number | [x,y,z]. */
export function place(geo, { pos = [0, 0, 0], rot = [0, 0, 0], scale = 1 } = {}) {
  _e.set(rot[0], rot[1], rot[2]);
  _q.setFromEuler(_e);
  if (Array.isArray(scale)) _s.set(scale[0], scale[1], scale[2]);
  else _s.setScalar(scale);
  _m.compose(_p.set(pos[0], pos[1], pos[2]), _q, _s);
  return geo.applyMatrix4(_m);
}

/** Box with its origin at the bottom centre. */
export const boxGeo = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);

/** A cylinder from point a to point b (radius r0 at a, r1 at b). */
export function strut(a, b, r0, r1 = r0, sides = 6, caps = false) {
  const A = new THREE.Vector3(...a);
  const Bv = new THREE.Vector3(...b);
  const dir = Bv.clone().sub(A);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, sides, 1, !caps).translate(0, len / 2, 0);
  _q.setFromUnitVectors(UP, dir.normalize());
  _m.compose(A, _q, _s.set(1, 1, 1));
  return g.applyMatrix4(_m);
}

export function merge(geos) {
  const list = geos.filter(Boolean).map(clean);
  if (!list.length) return null;
  const anyIndexed = list.some((g) => g.index);
  const allIndexed = list.every((g) => g.index);
  const out = mergeGeometries(anyIndexed && !allIndexed ? list.map((g) => (g.index ? g.toNonIndexed() : g)) : list, false);
  for (const g of list) g.dispose();
  return out;
}

/**
 * Static batcher: collect transformed geometries per material (and shadow flags), then emit one
 * merged Mesh per bucket. add(material, geo, {cast, receive}) / box(material, w,h,d, {pos, rot}).
 */
export class Batcher {
  constructor() {
    this.buckets = new Map();
  }

  add(material, geo, { cast = true, receive = true } = {}) {
    const key = `${material.uuid}|${cast}|${receive}`;
    let b = this.buckets.get(key);
    if (!b) this.buckets.set(key, (b = { material, cast, receive, geos: [] }));
    b.geos.push(geo);
    return this;
  }

  box(material, w, h, d, tr = {}, flags) {
    return this.add(material, place(boxGeo(w, h, d), tr), flags);
  }

  /** Emit the merged meshes into `group`. Returns them. */
  build(group, name = 'batch') {
    const out = [];
    for (const b of this.buckets.values()) {
      const geo = merge(b.geos);
      if (!geo) continue;
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, b.material);
      mesh.name = `${name}:${b.material.name || b.material.type}`;
      mesh.castShadow = b.cast;
      mesh.receiveShadow = b.receive;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      group.add(mesh);
      out.push(mesh);
    }
    this.buckets.clear();
    return out;
  }
}

/**
 * Instance one geometry at many transforms. items: [{pos, rot:[x,y,z] | rotY, scale, color}].
 */
export function instance(geo, material, items, { cast = false, receive = true, name = 'inst' } = {}) {
  const im = new THREE.InstancedMesh(geo, material, Math.max(1, items.length));
  im.count = items.length;
  const col = new THREE.Color();
  items.forEach((it, i) => {
    const r = it.rot || [0, it.rotY || 0, 0];
    _e.set(r[0], r[1], r[2]);
    _q.setFromEuler(_e);
    const sc = it.scale ?? 1;
    if (Array.isArray(sc)) _s.set(sc[0], sc[1], sc[2]);
    else _s.setScalar(sc);
    _m.compose(_p.set(it.pos[0], it.pos[1] ?? 0, it.pos[2]), _q, _s);
    im.setMatrixAt(i, _m);
    if (it.color !== undefined) im.setColorAt(i, col.set(it.color));
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = cast;
  im.receiveShadow = receive;
  im.computeBoundingSphere();
  im.name = name;
  return im;
}

// ------------------------------------------------------------------ procedural pieces

/**
 * A ring-road lamp post at the origin: plinth, tapered pole, a swan-neck arm reaching +X over the
 * road, and the head housing. Returns { geo, head: [x, y, z] (lens centre, local) }.
 */
export function lampPostGeo({ height = 7.4, reach = 1.9 } = {}) {
  const parts = [];
  parts.push(new THREE.CylinderGeometry(0.15, 0.17, 0.55, 10).translate(0, 0.275, 0)); // plinth
  parts.push(new THREE.CylinderGeometry(0.11, 0.135, 0.12, 10).translate(0, 0.61, 0)); // collar
  parts.push(new THREE.CylinderGeometry(0.065, 0.1, height - 0.6, 10, 1, true).translate(0, 0.6 + (height - 0.6) / 2, 0));
  // Swan neck: a quarter curve from the pole top out over the road, then level.
  const top = height;
  const curve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, top - 0.5, 0),
    new THREE.Vector3(0, top + 0.35, 0),
    new THREE.Vector3(reach * 0.35, top + 0.45, 0),
    new THREE.Vector3(reach, top + 0.3, 0),
  );
  parts.push(new THREE.TubeGeometry(curve, 14, 0.045, 7, false));
  // Head: a flat shoebox luminaire with a slight tilt, lens underneath.
  const head = boxGeo(0.78, 0.13, 0.32);
  head.translate(reach + 0.25, top + 0.2, 0);
  parts.push(head);
  parts.push(new THREE.BoxGeometry(0.5, 0.05, 0.24).translate(reach + 0.2, top + 0.34, 0)); // top fin
  return { geo: merge(parts), head: [reach + 0.27, top + 0.19, 0] };
}

/**
 * A bare winter tree (recursive branches, open cylinders). Deterministic per rnd.
 * Returns a merged geometry, base on y = 0, about `height` tall.
 */
export function bareTreeGeo(rnd, { height = 7, trunk = 0.17, levels = 5, spread = 0.62 } = {}) {
  const geos = [];
  const grow = (a, dir, len, r, lvl) => {
    const b = a.clone().addScaledVector(dir, len);
    const sides = lvl === 0 ? 7 : lvl < 3 ? 5 : 3;
    geos.push(strut(a.toArray(), b.toArray(), r, r * 0.68, sides));
    if (lvl >= levels) return;
    const kids = lvl === 0 ? 3 : 2 + (rnd() < 0.45 ? 1 : 0);
    const base = rnd() * Math.PI * 2;
    for (let k = 0; k < kids; k++) {
      const az = base + (k / kids) * Math.PI * 2 + (rnd() - 0.5) * 0.9;
      const tilt = spread * (0.6 + rnd() * 0.6) * (lvl === 0 ? 0.8 : 1);
      // Rotate the parent direction by `tilt` toward azimuth `az`, with an upward bias (bare crowns reach up).
      const side = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
      const d = dir.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(side, Math.sin(tilt));
      d.y += 0.18;
      d.normalize();
      const start = lvl === 0 ? a.clone().lerp(b, 0.75 + rnd() * 0.25) : b;
      grow(start, d, len * (0.62 + rnd() * 0.18), r * 0.62, lvl + 1);
    }
  };
  const lean = new THREE.Vector3((rnd() - 0.5) * 0.12, 1, (rnd() - 0.5) * 0.12).normalize();
  grow(new THREE.Vector3(0, -0.05, 0), lean, height * 0.42, trunk, 0);
  return merge(geos);
}

/**
 * A steel crowd-control barrier (the marathon kind): 2.0 m long along X, 1.1 m high, tube frame,
 * vertical bars, two flat feet along Z. Origin at the bottom centre.
 */
export function crowdBarrierGeo({ len = 2.0, h = 1.1, bars = 14 } = {}) {
  const g = [];
  const x0 = -len / 2;
  const x1 = len / 2;
  const r = 0.02;
  g.push(strut([x0, 0.12, 0], [x0, h, 0], r, r, 6));
  g.push(strut([x1, 0.12, 0], [x1, h, 0], r, r, 6));
  g.push(strut([x0, h, 0], [x1, h, 0], r, r, 6));
  g.push(strut([x0, 0.2, 0], [x1, 0.2, 0], r, r, 6));
  for (let i = 1; i < bars; i++) {
    const x = x0 + (i / bars) * len;
    g.push(strut([x, 0.2, 0], [x, h, 0], 0.008, 0.008, 4));
  }
  for (const x of [x0 + 0.06, x1 - 0.06]) g.push(boxGeo(0.05, 0.035, 0.62).translate(x, 0, 0));
  return merge(g);
}

/** A traffic cone with a base plate (0.7 m). Two groups: [0] orange body, [1] white reflective band. */
export function coneGeo() {
  const body = new THREE.LatheGeometry([new THREE.Vector2(0.001, 0.7), new THREE.Vector2(0.045, 0.7), new THREE.Vector2(0.16, 0.06), new THREE.Vector2(0.17, 0.04)], 14);
  const band = new THREE.CylinderGeometry(0.083, 0.115, 0.14, 14, 1, true).translate(0, 0.42, 0).scale(1.02, 1, 1.02);
  const plate = boxGeo(0.38, 0.04, 0.38);
  return { body: merge([body, plate]), band: clean(band) };
}

/**
 * A straight concrete stair: n steps rising `rise` each over `run`, along -Z from the origin
 * (first step at z 0), width w along X. Returns a merged geometry (steps + side stringers).
 */
export function stairGeo({ n = 30, rise = 0.18, run = 0.28, w = 1.6 } = {}) {
  const g = [];
  for (let i = 0; i < n; i++) g.push(boxGeo(w, rise * (i + 1), run).translate(0, 0, -(i + 0.5) * run));
  return merge(g);
}
