import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { H, FRONT_Z } from './layout.js';

// Geometry helpers for the workshop: extents-based boxes, merged meshes (one draw per material) and
// tubes between two points. Every merged geometry is non-indexed-safe (mergeGeometries needs the
// same attribute set, so helpers that add `color` are only merged with each other).

/**
 * Axis-aligned box from world extents with vertex colours: cut faces (wall tops, front ends) are
 * painted with `cap` so the dollhouse section reads as a dark cut. UVs are metre-based.
 */
export function slab(x0, x1, y0, y1, z0, z1, { cap = null } = {}) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const uv = g.attributes.uv;
  const col = new Float32Array(pos.count * 3);
  const capCol = new THREE.Color(cap ?? 0xffffff);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(nrm.getX(i));
    const ny = Math.abs(nrm.getY(i));
    if (nx > 0.5) uv.setXY(i, z, y);
    else if (ny > 0.5) uv.setXY(i, x, z);
    else uv.setXY(i, x, y);
    const isCut = cap !== null && ((nrm.getY(i) > 0.5 && y > H - 0.01) || (nrm.getZ(i) > 0.5 && z > FRONT_Z - 0.01));
    const c = isCut ? capCol : { r: 1, g: 1, b: 1 };
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** A plain box geometry from extents. */
export function bx(x0, x1, y0, y1, z0, z1) {
  return new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}

/** A box of size (w, h, d) centred at the origin, rotated (XYZ Euler), then moved to (x, y, z). */
export function rbox(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}

const _up = new THREE.Vector3(0, 1, 0);
/** A cylinder from a to b (Vector3 or [x,y,z]) of radius r (r1 at b when given). */
export function tube(a, b, r, { r1 = r, seg = 8 } = {}) {
  const A = Array.isArray(a) ? new THREE.Vector3(...a) : a;
  const Bv = Array.isArray(b) ? new THREE.Vector3(...b) : b;
  const d = new THREE.Vector3().subVectors(Bv, A);
  const len = d.length() || 1e-4;
  const g = new THREE.CylinderGeometry(r1, r, len, seg, 1, false);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_up, d.normalize()));
  g.translate(A.x, A.y, A.z);
  return g;
}

/** A tube along a smooth curve through points (cables, cords). */
export function cable(points, r = 0.008, { seg = 64, radial = 6 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (Array.isArray(p) ? new THREE.Vector3(...p) : p)), false, 'centripetal');
  return new THREE.TubeGeometry(curve, seg, r, radial, false);
}

/** Drop attributes a merge does not share (keeps position / normal / uv). */
export function plain(g) {
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  return g.index ? g.toNonIndexed() : g;
}

/** Merge geometries into one mesh (one draw); disposes the inputs. */
export function merged(geos, material, { castShadow = true, receiveShadow = true, name } = {}) {
  const list = geos.filter(Boolean);
  const anyIndexed = list.some((g) => g.index);
  const norm = anyIndexed ? list.map((g) => (g.index ? g.toNonIndexed() : g)) : list;
  const m = new THREE.Mesh(mergeGeometries(norm, false), material);
  for (const g of list) g.dispose();
  for (const g of norm) g.dispose();
  m.castShadow = castShadow;
  m.receiveShadow = receiveShadow;
  if (name) m.name = name;
  return m;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** sRGB CanvasTexture of a canvas. */
export function canvasTex(canvas, { anisotropy = 8, repeat } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/**
 * assets.prop('props/<id>.glb') (never rejects). A failed load is a grey box that Assets sizes from
 * its native-size table; with center:false it hangs from the origin like the tools on their pegs.
 */
export async function loadProp(assets, id, opts = {}) {
  const prop = await assets.prop(`props/${id}.glb`, opts);
  if (prop.userData.isFallback && opts.center === false) prop.children[0].position.y = -prop.userData.size.y / 2;
  return prop;
}
