import * as THREE from 'three';

// Small rigid accessories for the Revision 4 cast, built like Odile's apron (CharacterKit._apron):
// geometry in bind-pose metres (T-pose, feet at y = 0, facing +z), skinned 100% to one bone each and
// bound at build time, so they follow every clip, the stoop and the character's scale. Geometry is
// cached on the kit (`kit._geo`); materials are per character (fades, disposal).
//   rings   Jo: silver bands on finger bones, sized to the finger they sit on
//   pencil  Jo: a pencil behind her right ear
//   cap     M. Durand: a tweed flat cap, fitted over the head and hair

const BODY_SPHERE = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.5);
const _v = new THREE.Vector3();

/** Bind-space vertices of a recipe's parts (filtered), as a flat Float32Array [x, y, z, ...]. */
function partPoints(kit, parts, keep) {
  const out = [];
  for (const part of parts) {
    for (const p of kit.parts.get(part) || []) {
      const P = p.mesh.geometry.attributes.position;
      for (let i = 0; i < P.count; i++) {
        _v.fromBufferAttribute(P, i).applyMatrix4(p.bindQ);
        if (keep(_v)) out.push(_v.x, _v.y, _v.z);
      }
    }
  }
  return out;
}

/**
 * One SkinnedMesh from geometry pieces, piece i skinned to bones[i] (bind-space positions).
 * `pieces`: [{ geometry, bone }]; every piece must have position / normal / uv.
 */
function rigidMesh(pieces, bones, material, name) {
  const geos = [];
  const names = [];
  for (const { geometry, bone } of pieces) {
    const bi = names.indexOf(bone) >= 0 ? names.indexOf(bone) : names.push(bone) - 1;
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    const n = g.attributes.position.count;
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, j) => (j % 4 === 0 ? bi : 0)), 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, j) => (j % 4 === 0 ? 1 : 0)), 4));
    geos.push(g);
  }
  return { geometry: merge(geos), boneNames: names, name };
}

/** Minimal non-indexed merge (position, normal, uv, skinIndex, skinWeight; color when every piece has it). */
function merge(geos) {
  const keys = ['position', 'normal', 'uv', 'color', 'skinIndex', 'skinWeight'].filter((k) => geos.every((g) => g.attributes[k]));
  const out = new THREE.BufferGeometry();
  for (const k of keys) {
    const first = geos[0].attributes[k];
    const n = geos.reduce((a, g) => a + g.attributes[k].array.length, 0);
    const arr = new first.array.constructor(n);
    let o = 0;
    for (const g of geos) {
      arr.set(g.attributes[k].array, o);
      o += g.attributes[k].array.length;
    }
    out.setAttribute(k, new THREE.BufferAttribute(arr, first.itemSize));
  }
  for (const g of geos) g.dispose();
  return out;
}

/** Bind a cached { geometry, boneNames } to this character's bones (their current, rest-pose world). */
function bindMesh(entry, bones, material) {
  const list = entry.boneNames.map((n) => bones.get(n));
  if (list.some((b) => !b)) return null;
  const mesh = new THREE.SkinnedMesh(entry.geometry, material);
  mesh.name = entry.name;
  mesh.bind(new THREE.Skeleton(list, list.map((b) => b.matrixWorld.clone().invert())), new THREE.Matrix4());
  mesh.boundingSphere = BODY_SPHERE.clone();
  mesh.receiveShadow = true;
  mesh.userData.sharedGeometry = true;
  return mesh;
}

const _wp = (bones, n) => bones.get(n)?.getWorldPosition(new THREE.Vector3());

/** The next bone along a finger: index_01_l -> index_02_l; thumb_02_r -> thumb_03_r. */
const nextBone = (n) => n.replace(/_0(\d)_/, (_, d) => `_0${+d + 1}_`);

// ------------------------------------------------------------------ rings

/**
 * Jo's rings: a thin silver band on each finger bone in `recipe.rings`, at the middle of that
 * phalanx, its bore fitted to the finger (the skin vertices round that point) plus 0.4 mm.
 */
export function rings(kit, recipe, bones) {
  if (!recipe.rings?.length) return null;
  const key = 'rings|' + recipe.rig + '|' + recipe.rings.join(',');
  let entry = kit._geo.get(key);
  if (!entry) {
    const skin = partPoints(kit, recipe.parts.filter((p) => /hands|body/.test(p)), (v) => Math.abs(v.x) > 0.6 && v.y > 1.3);
    const pieces = [];
    recipe.rings.forEach((bone, i) => {
      const a = _wp(bones, bone);
      const b = _wp(bones, nextBone(bone));
      if (!a || !b) return;
      const dir = b.clone().sub(a);
      const len = dir.length();
      dir.normalize();
      const mid = a.clone().addScaledVector(dir, len * 0.55);
      // Finger radius: the farthest skin vertex from the bone axis within 3 mm of the ring's plane.
      let r = 0;
      for (let j = 0; j < skin.length; j += 3) {
        _v.set(skin[j], skin[j + 1], skin[j + 2]).sub(mid);
        const along = _v.dot(dir);
        if (Math.abs(along) > 0.003) continue;
        const rad = _v.addScaledVector(dir, -along).length();
        if (rad < 0.014) r = Math.max(r, rad);
      }
      if (r === 0) r = 0.008;
      const tube = i % 3 === 1 ? 0.0016 : 0.0011; // one chunkier band in three
      const g = new THREE.TorusGeometry(r + tube + 0.0004, tube, 6, 24);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir));
      g.translate(mid.x, mid.y, mid.z);
      pieces.push({ geometry: g, bone });
    });
    if (!pieces.length) return null;
    entry = rigidMesh(pieces, bones, null, 'rings');
    entry.geometry.name = 'char:rings';
    kit._geo.set(key, entry);
  }
  const mat = new THREE.MeshStandardMaterial({ color: '#d4d2cc', metalness: 1, roughness: 0.28, envMapIntensity: 1.2 });
  mat.name = 'rings';
  mat.userData.part = 'metal';
  mat.userData.hl = {};
  const mesh = bindMesh(entry, bones, mat);
  if (mesh) mesh.castShadow = false;
  return mesh;
}

// ------------------------------------------------------------------ pencil

/** A yellow hexagonal pencil resting on the right ear, point forward and down, skinned to the head. */
export function pencil(kit, recipe, bones) {
  if (!recipe.pencil) return null;
  const key = 'pencil|' + recipe.rig + '|' + recipe.parts.join(',');
  let entry = kit._geo.get(key);
  if (!entry) {
    // The side of the head at ear height (right side, x < 0): the widest skin or hair point there.
    // (the head skin only: hair strands hang well clear of the ear)
    const pts = partPoints(kit, recipe.parts.filter((p) => /_head$/.test(p)), (v) => v.x < 0 && v.y > 1.6 && v.y < 1.7 && v.z > -0.06 && v.z < 0.03);
    let side = -0.075;
    for (let j = 0; j < pts.length; j += 3) side = Math.min(side, pts[j]);
    const L = 0.15;
    const R = 0.0036;
    const a = new THREE.Vector3(side - 0.006, 1.652, 0.028); // the point, by the temple
    const b = new THREE.Vector3(side + 0.002, 1.676, -0.112); // the end, over the back of the ear
    const dir = b.clone().sub(a).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const body = new THREE.CylinderGeometry(R, R, L * 0.82, 6, 1);
    body.translate(0, L * 0.09 + (L * 0.82) / 2 - L / 2, 0);
    const cone = new THREE.CylinderGeometry(R, 0.0006, L * 0.09, 6, 1).rotateX(Math.PI).translate(0, -L / 2 + L * 0.045, 0);
    const ferrule = new THREE.CylinderGeometry(R * 1.05, R * 1.05, L * 0.04, 8, 1).translate(0, L / 2 - L * 0.07, 0);
    const eraser = new THREE.CylinderGeometry(R * 0.95, R * 0.95, L * 0.05, 8, 1).translate(0, L / 2 - L * 0.025, 0);
    // Vertex colours per piece (one material): yellow lacquer, bare wood, brass, pink rubber.
    const tint = (g, hex) => {
      const c = new THREE.Color(hex);
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    };
    const geos = [tint(body, '#e0a400'), tint(cone, '#d9b98a'), tint(ferrule, '#9c8a52'), tint(eraser, '#c0706a')];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const pieces = geos.map((g) => {
      g.applyQuaternion(q);
      g.translate(mid.x, mid.y, mid.z);
      return { geometry: g, bone: 'Head' };
    });
    entry = rigidMesh(pieces, bones, null, 'pencil');
    entry.geometry.name = 'char:pencil';
    kit._geo.set(key, entry);
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, flatShading: true });
  mat.name = 'pencil';
  mat.userData.part = 'cloth';
  mat.userData.hl = {};
  const mesh = bindMesh(entry, bones, mat);
  if (mesh) mesh.castShadow = false;
  return mesh;
}

// ------------------------------------------------------------------ flat cap

/**
 * A flat cap, fitted to the head and hair parts (bind-pose points above the band): a panel over the
 * head (top view: an ellipse-ish outline that reaches forward over the peak), low and soft, which
 * comes down to the band at the back, overhangs a little at the sides and is sewn to the peak's edge
 * at the front; a skirt from the panel's edge in to the band, which at the front is the peak's
 * underside. Every panel point is kept 6 mm above the head. Herringbone tweed.
 */
export function cap(kit, recipe, bones) {
  if (!recipe.cap) return null;
  const key = 'cap|' + recipe.rig + '|' + recipe.parts.join(',');
  let entry = kit._geo.get(key);
  if (!entry) {
    const pts = partPoints(kit, recipe.parts.filter((p) => /head|hair/.test(p)), (v) => v.y > 1.68);
    // The crown: its top, and the mean z of the top 3 cm (the panel's centre line).
    let top = 0;
    for (let j = 0; j < pts.length; j += 3) top = Math.max(top, pts[j + 1]);
    let cz = 0;
    for (let j = 0, m = 0, z = 0; j < pts.length; j += 3) if (pts[j + 1] > top - 0.03) (z += pts[j + 2]), m++, (cz = z / m);
    const bandY = (c) => 1.73 + 0.022 * c; // c = cos(phi), +1 at the front: above the brow, low at the back
    const SEG = 40;
    const reach = new Float32Array(SEG); // the head's horizontal reach per direction, above the band
    const dirOf = (phi) => ((Math.round((phi / (Math.PI * 2)) * SEG) % SEG) + SEG) % SEG;
    for (let j = 0; j < pts.length; j += 3) {
      const phi = Math.atan2(pts[j], pts[j + 2] - cz);
      if (pts[j + 1] < bandY(Math.cos(phi)) - 0.004) continue;
      const k = dirOf(phi);
      reach[k] = Math.max(reach[k], Math.hypot(pts[j], pts[j + 2] - cz));
    }
    const rb = Array.from(reach, (r, i) => Math.max(r, reach[(i + 1) % SEG], reach[(i + SEG - 1) % SEG]) + 0.006);
    // Head height under a point (for the 6 mm clearance), from a coarse 1 cm height map.
    const hm = new Map();
    for (let j = 0; j < pts.length; j += 3) {
      const k = Math.round(pts[j] * 100) + ':' + Math.round(pts[j + 2] * 100);
      hm.set(k, Math.max(hm.get(k) ?? 0, pts[j + 1]));
    }
    const headAt = (x, z) => {
      let h = 0;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) h = Math.max(h, hm.get(Math.round(x * 100) + dx + ':' + (Math.round(z * 100) + dz)) ?? 0);
      return h;
    };
    const peak = top + 0.014;
    const pos = [];
    const uv = [];
    const idx = [];
    const vtx = (x, y, z) => (pos.push(x, y, z + cz), uv.push(x * 14, z * 14 + y * 7), pos.length / 3 - 1);
    const RINGS = 8; // panel: centre (0) -> edge (RINGS); skirt: edge -> band (RINGS + 2)
    const grid = [];
    for (let r = 0; r <= RINGS + 2; r++) {
      const row = [];
      for (let i = 0; i <= SEG; i++) {
        const phi = (i / SEG) * Math.PI * 2;
        const s = Math.sin(phi);
        const c = Math.cos(phi);
        const front = Math.max(0, c);
        const b = rb[i % SEG];
        const yb = bandY(c);
        const R = b + 0.004 + 0.012 * s * s + 0.058 * front * front; // the panel's edge
        const e = yb + 0.02 * s * s - 0.004 * front; // its height
        let x, y, z;
        if (r <= RINGS) {
          const t = r / RINGS;
          // Off-centre: the panel's middle sits a little behind the reach's centre, the front is long and flat.
          x = s * R * t;
          z = c * R * t - 0.012 * (1 - t);
          y = e + (peak - e) * (1 - Math.pow(t, c > 0 ? 1.6 : 2.6));
          y = Math.max(y, headAt(x, z + cz) + 0.006);
        } else {
          const t = (r - RINGS) / 2;
          const rr = THREE.MathUtils.lerp(R, b, t) + (t === 0.5 ? 0.004 * (1 - front) : 0);
          x = s * rr;
          z = c * rr;
          y = THREE.MathUtils.lerp(e, yb, t) - (t === 0.5 ? 0.004 * front : 0);
        }
        row.push(vtx(x, y, z));
      }
      grid.push(row);
    }
    for (let r = 0; r < RINGS + 2; r++) {
      for (let i = 0; i < SEG; i++) {
        const a = grid[r][i], b = grid[r][i + 1], d = grid[r + 1][i], e = grid[r + 1][i + 1];
        idx.push(a, d, b, b, d, e);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // The seam column (phi 0 and 2π) and the crown's centre share normals, so there is no crease.
    const N = geo.attributes.normal;
    const weld = (list) => {
      const v = new THREE.Vector3();
      for (const i of list) v.add(_v.fromBufferAttribute(N, i));
      v.normalize();
      for (const i of list) N.setXYZ(i, v.x, v.y, v.z);
    };
    for (const row of grid) weld([row[0], row[SEG]]);
    weld(grid[0]);
    entry = rigidMesh([{ geometry: geo, bone: 'Head' }], bones, null, 'cap');
    entry.geometry.name = 'char:cap';
    kit._geo.set(key, entry);
  }
  const mat = new THREE.MeshStandardMaterial({ color: recipe.cap, map: tweedTexture(), roughness: 0.95, side: THREE.DoubleSide });
  mat.name = 'cap';
  mat.userData.part = 'cloth';
  mat.userData.hl = {};
  return bindMesh(entry, bones, mat);
}

let _tweed = null;
/** Herringbone tweed (shared): light flecks on a mid grey, multiplied by the cap colour. */
function tweedTexture() {
  if (_tweed) return _tweed;
  const N = 128;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#d8d2c8';
  g.fillRect(0, 0, N, N);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let x = 0; x < N; x += 8) {
    const dir = (x / 8) % 2 ? 1 : -1;
    for (let y = -8; y < N + 8; y += 3) {
      g.strokeStyle = `rgba(60,52,44,${0.12 + rnd() * 0.12})`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 8, y + dir * 4);
      g.stroke();
    }
  }
  for (let i = 0; i < 260; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(240,232,220,0.35)' : 'rgba(40,34,30,0.3)';
    g.fillRect(rnd() * N, rnd() * N, 1, 1);
  }
  _tweed = new THREE.CanvasTexture(c);
  _tweed.wrapS = _tweed.wrapT = THREE.RepeatWrapping;
  _tweed.colorSpace = THREE.SRGBColorSpace;
  _tweed.anisotropy = 4;
  _tweed.userData.shared = true;
  return _tweed;
}
