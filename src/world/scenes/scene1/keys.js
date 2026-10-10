import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { IN_X, boxAt } from './common.js';

// R4 Ch1 (docs/SCRIPT-R4.md §2): the keys by the door. A small pine shelf on the right wall, just inside
// the doorway corner, with a chipped ceramic bowl on it and three keys on a ring in the bowl (the flat, the
// letterbox, and the third one nobody remembers). `takeKeys()` on the scene hides the bunch.

/** Where the bowl sits (world), and the stand point / shot for the close-up. */
export const KEYS = { x: IN_X - 0.09, y: 1.12, z: -1.24 };

/**
 * Build the shelf (into the static batch) and the bowl and keys (own meshes, so the keys can go).
 * mats: scene1's material set (trim, crockery, brass, chrome, dark). Returns { group, keys, focus }.
 */
export function buildKeysShelf(batch, mats) {
  const group = new THREE.Group();
  group.name = 'keys-shelf';
  const { x, y, z } = KEYS;
  // The shelf: a painted board on two steel brackets, screwed through the wallpaper.
  batch.add(mats.trim, boxAt(IN_X - 0.17, IN_X, y - 0.022, y, z - 0.2, z + 0.2), { castShadow: false });
  for (const dz of [-0.15, 0.15]) {
    batch.add(mats.dark, boxAt(IN_X - 0.13, IN_X, y - 0.032, y - 0.022, z + dz - 0.008, z + dz + 0.008), { castShadow: false });
    batch.add(mats.dark, boxAt(IN_X - 0.01, IN_X, y - 0.16, y - 0.022, z + dz - 0.008, z + dz + 0.008), { castShadow: false });
  }

  // The bowl: a lathe profile, glazed inside, a chip on the rim.
  const prof = [
    [0.0, 0.0],
    [0.035, 0.0],
    [0.045, 0.006],
    [0.062, 0.03],
    [0.07, 0.045],
    [0.066, 0.046],
    [0.058, 0.033],
    [0.04, 0.012],
    [0.0, 0.01],
  ].map(([r, h]) => new THREE.Vector2(r, h));
  const bowlMat = new THREE.MeshStandardMaterial({ color: '#7f8d86', roughness: 0.32, metalness: 0 });
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 22), bowlMat);
  bowl.position.set(x - 0.01, y, z);
  bowl.castShadow = false;
  bowl.name = 'keys-bowl';
  group.add(bowl);

  // Three keys on a split ring, lying in the bowl.
  const keys = new THREE.Group();
  keys.name = 'keys-bunch';
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0016, 5, 18).rotateX(Math.PI / 2), mats.chrome);
  keys.add(ring);
  const key = (mat, len, bow, rot, lift) => {
    const k = new THREE.Group();
    const head = new THREE.Mesh(new THREE.CylinderGeometry(bow, bow, 0.0025, 14), mat);
    head.position.set(bow + 0.008, 0, 0);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(len, 0.0022, 0.0075), mat);
    blade.position.set(bow * 2 + 0.006 + len / 2, 0, 0);
    // A few bits cut into the blade.
    for (let i = 0; i < 3; i++) {
      const bit = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.0022, 0.004), mat);
      bit.position.set(bow * 2 + 0.012 + i * (len / 3.4), 0, 0.0055);
      k.add(bit);
    }
    k.add(head, blade);
    k.rotation.y = rot;
    k.position.y = lift;
    return k;
  };
  keys.add(key(mats.brass, 0.034, 0.011, 0.3, 0.002)); // the flat
  keys.add(key(mats.chrome, 0.026, 0.009, 2.2, 0.004)); // the letterbox
  keys.add(key(mats.brass, 0.04, 0.012, -1.9, 0.006)); // the third one
  // One mesh per metal (the bunch is 16 small parts: 2 draws instead of 16).
  keys.updateMatrixWorld(true);
  const byMat = new Map();
  keys.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const list = byMat.get(o.material) || [];
    list.push(g.index ? g.toNonIndexed() : g);
    byMat.set(o.material, list);
  });
  keys.traverse((o) => o.isMesh && o.geometry.dispose());
  const bunch = new THREE.Group();
  bunch.name = 'keys-bunch';
  for (const [mat, list] of byMat) {
    const m = new THREE.Mesh(mergeGeometries(list), mat);
    m.castShadow = false;
    bunch.add(m);
  }
  bunch.position.set(x - 0.012, y + 0.014, z + 0.005);
  bunch.rotation.z = 0.08;
  group.add(bunch);
  return { group, keys: bunch, focus: new THREE.Vector3(x - 0.01, y + 0.03, z) };
}
