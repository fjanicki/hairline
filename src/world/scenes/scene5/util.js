import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as B from '../../build.js';

// Small helpers shared by the Ch5 dressing modules (canvas art, props, static merging).

/** Seeded PRNG (build.rng if present). */
export const rngOf = (seed) => (B.rng ? B.rng(seed) : Math.random);

export function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

export function texFrom(c, { srgb = true, repeat } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/** A look recipe material, or a flat fallback when ctx.look is missing. */
export function surf(ctx, name, opts = {}, fallback = '#888888') {
  try {
    if (ctx.look?.surface) return ctx.look.surface(name, opts);
  } catch (err) {
    console.warn('[hairline] scene5: look.surface failed', name, err?.message || err);
  }
  return new THREE.MeshStandardMaterial({ color: fallback, roughness: 0.9 });
}

/** Load props in parallel: list of [path, opts]. Never rejects (assets.prop never does). */
export function props(ctx, list) {
  return Promise.all(list.map(([p, o]) => ctx.assets.prop(p, o)));
}

/** Copy of an attribute as Float32 (quantised GLB attributes would clip under applyMatrix4). */
function floatAttr(a) {
  if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute) return a.clone();
  const n = a.count;
  const s = a.itemSize;
  const out = new Float32Array(n * s);
  for (let i = 0; i < n; i++) {
    out[i * s] = a.getX(i);
    if (s > 1) out[i * s + 1] = a.getY(i);
    if (s > 2) out[i * s + 2] = a.getZ(i);
    if (s > 3) out[i * s + 3] = a.getW(i);
  }
  return new THREE.BufferAttribute(out, s);
}

const KEEP_ATTRS = ['position', 'normal', 'uv', 'color'];

/**
 * Static batching: collects meshes (props and procedural pieces placed in `space` coordinates) and
 * merges everything that shares a material into one mesh. Multi-material meshes, skinned meshes and
 * anything with userData.dynamic stay as they are. The merged geometries are owned here (dispose()),
 * the materials are not (they may be the prop cache's).
 */
export class Batch {
  constructor(name = 'batch') {
    this.name = name;
    this.items = [];
    this.owned = [];
  }

  /** Queue an object (already positioned relative to the batch's parent). Returns it. */
  add(obj) {
    this.items.push(obj);
    return obj;
  }

  /** Merge into `parent`. Objects that can't be merged are added to `parent` unchanged. */
  build(parent) {
    const buckets = new Map();
    const loose = [];
    const m = new THREE.Matrix4();
    for (const root of this.items) {
      root.updateMatrixWorld(true);
      const rootInv = root.parent ? new THREE.Matrix4().copy(root.parent.matrixWorld).invert() : null;
      root.traverse((o) => {
        if (!o.isMesh) return;
        if (o.isSkinnedMesh || o.isInstancedMesh || o.userData.dynamic || Array.isArray(o.material) || !o.geometry?.attributes?.position) {
          loose.push(o);
          return;
        }
        m.copy(o.matrixWorld);
        if (rootInv) m.premultiply(rootInv);
        const g0 = o.geometry;
        const attrs = KEEP_ATTRS.filter((k) => g0.attributes[k]);
        const key = `${o.material.uuid}|${attrs.join(',')}|${g0.index ? 1 : 0}`;
        let b = buckets.get(key);
        if (!b) buckets.set(key, (b = { material: o.material, geos: [], cast: false, receive: false }));
        const g = new THREE.BufferGeometry();
        for (const k of attrs) g.setAttribute(k, floatAttr(g0.attributes[k]));
        if (g0.index) g.setIndex(g0.index.clone());
        g.applyMatrix4(m);
        b.geos.push(g);
        b.cast ||= o.castShadow;
        b.receive ||= o.receiveShadow;
      });
    }
    const out = [];
    for (const b of buckets.values()) {
      let geo = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
      if (!geo) {
        // Incompatible attribute layouts: keep them as separate meshes.
        for (const g of b.geos) out.push(this._mesh(g, b));
        continue;
      }
      if (b.geos.length > 1) for (const g of b.geos) g.dispose();
      out.push(this._mesh(geo, b));
    }
    for (const mesh of out) parent.add(mesh);
    // Loose meshes: re-parent with their world transform.
    for (const o of loose) parent.attach(o);
    this.items.length = 0;
    return out;
  }

  _mesh(geo, b) {
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const mesh = new THREE.Mesh(geo, b.material);
    mesh.name = this.name;
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.userData.noDispose = true; // the material may be shared; dispose() frees what the batch owns
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.owned.push(geo);
    if (!b.material.userData?.shared) (this.ownedMats ??= new Set()).add(b.material);
    return mesh;
  }

  /** Free the merged geometry, and the chapter's own (non-shared) materials and their canvases. */
  dispose() {
    for (const g of this.owned) g.dispose();
    this.owned.length = 0;
    for (const m of this.ownedMats || []) {
      for (const v of Object.values(m)) if (v?.isTexture && !v.userData?.shared) v.dispose();
      m.dispose();
    }
    this.ownedMats?.clear();
  }
}

/** A thin box (bottom centre at pos) with a material; castShadow default on. */
export function slab(w, h, d, material, pos, { rotY = 0, cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), material);
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.y = rotY;
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/** A cylinder between two points. */
export function rod(a, b, r, material, seg = 8) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(r, r, len, seg).translate(0, len / 2, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Soft radial alpha texture (for decals, glows, damp patches). */
export function radialTexture(size = 128, inner = 0, color = '255,255,255') {
  return texFrom(
    canvas(size, size, (g) => {
      const r = size / 2;
      const gr = g.createRadialGradient(r, r, inner * r, r, r, r);
      gr.addColorStop(0, `rgba(${color},1)`);
      gr.addColorStop(1, `rgba(${color},0)`);
      g.fillStyle = gr;
      g.fillRect(0, 0, size, size);
    }),
  );
}

/** Attach `obj` to a character bone, compensating the bone's world scale. */
export function attachToBone(char, boneName, obj) {
  const bone = char?.bone?.(boneName);
  if (!bone) return false;
  bone.updateWorldMatrix(true, false);
  const s = new THREE.Vector3().setFromMatrixScale(bone.matrixWorld);
  obj.scale.multiplyScalar(1 / Math.max(1e-4, s.x));
  bone.add(obj);
  return true;
}
