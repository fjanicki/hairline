import * as THREE from 'three';
import { Batch, surf, slab } from './util.js';

// The far (+Z) end of Rue des Tanneurs. Ch2 never looks back up the street, but Ch5's crane-up
// does: a cross street and a closing row of three houses, built from the same look.js facade
// recipes as scene2's buildings (rendered ground floors, brick and render above, window insets with
// sills, a cornice), so the street reads as closed and lived-in in the low sun. It casts no sun
// shadows: the day's sun comes down the street over these roofs.

const Z0 = 14; // where scene2's street ends
const ROW_Z = 21.5; // the closing row's front
const GF = 4.0;
const FLOOR = 3.0;

/**
 * Build the far end into `group`. Returns { groundAt(x, z), dispose() }.
 * groundAt is where feet go: scene2 keeps them at y 0 on both road and pavement.
 */
export function finishStreet(ctx) {
  const batch = new Batch('ch5-far-end');
  const root = new THREE.Group();
  root.name = 'ch5-far-end';

  // Cross street and the pavement in front of the row.
  const asphalt = surf(ctx, 'street.asphalt', {}, '#4a4b4d');
  const pavement = surf(ctx, 'street.pavement', {}, '#7c7b76');
  const kerb = surf(ctx, 'street.kerb', {}, '#74726d');
  const road = new THREE.Mesh(new THREE.PlaneGeometry(60, ROW_Z - Z0 - 2.2).rotateX(-Math.PI / 2), asphalt);
  road.position.set(0, -0.015, Z0 + (ROW_Z - Z0 - 2.2) / 2);
  road.receiveShadow = true;
  batch.add(road);
  batch.add(slab(60, 0.035, 2.2, pavement, [0, 0, ROW_Z - 1.1], { cast: false }));
  batch.add(slab(60, 0.05, 0.15, kerb, [0, -0.015, ROW_Z - 2.2], { cast: false }));

  // Three houses across the end of the street.
  const glass = new THREE.MeshStandardMaterial({ color: '#2e3338', roughness: 0.15, metalness: 0.5 });
  const sillMat = surf(ctx, 'concrete.grimy', {}, '#7d7b76');
  const houses = [
    { x0: -16, x1: -4.2, n: 3, upper: 'facade.brick', ground: 'facade.render' },
    { x0: -4.2, x1: 4.6, n: 4, upper: 'facade.render', ground: 'facade.brickPlaster' },
    { x0: 4.6, x1: 16, n: 2, upper: 'facade.brickPlaster', ground: 'facade.render' },
  ];
  const panes = [];
  const sills = [];
  for (const h of houses) {
    const w = h.x1 - h.x0;
    const cx = (h.x0 + h.x1) / 2;
    const top = GF + h.n * FLOOR;
    const D = 9;
    // No sun shadows from the row: the afternoon sun comes down the street from this end, and the
    // row is only ever seen from far away (the crane).
    batch.add(slab(w, GF, D, surf(ctx, h.ground), [cx, 0, ROW_Z + D / 2], { cast: false }));
    batch.add(slab(w, top - GF, D, surf(ctx, h.upper), [cx, GF, ROW_Z + D / 2], { cast: false }));
    batch.add(slab(w + 0.1, 0.35, 0.4, sillMat, [cx, top, ROW_Z + 0.1], { cast: false })); // cornice
    batch.add(slab(w + 0.06, 0.18, 0.18, sillMat, [cx, GF - 0.1, ROW_Z - 0.04], { cast: false })); // string course
    const cols = Math.max(2, Math.round(w / 2.9));
    for (let f = 0; f < h.n; f++) {
      for (let c = 0; c < cols; c++) {
        const x = h.x0 + (c + 0.5) * (w / cols);
        const y = GF + f * FLOOR + 0.9;
        panes.push([x, y]);
        sills.push([x, y]);
      }
    }
    // ground floor: a door and a shop window or two
    for (let c = 0; c < Math.max(1, Math.round(w / 4.5)); c++) {
      const x = h.x0 + (c + 0.5) * (w / Math.max(1, Math.round(w / 4.5)));
      const door = new THREE.Mesh(new THREE.PlaneGeometry(c % 2 ? 2.6 : 1.2, c % 2 ? 2.2 : 2.3), glass);
      door.position.set(x, c % 2 ? 1.55 : 1.15, ROW_Z - 0.01);
      door.rotation.y = Math.PI;
      batch.add(door);
    }
  }
  const paneGeo = new THREE.PlaneGeometry(1.15, 1.6).rotateY(Math.PI).translate(0, 0.8, 0);
  const pm = new THREE.InstancedMesh(paneGeo, glass, panes.length);
  const sm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.35, 0.08, 0.2), sillMat, sills.length);
  const d = new THREE.Object3D();
  panes.forEach(([x, y], i) => {
    d.position.set(x, y, ROW_Z - 0.01);
    d.updateMatrix();
    pm.setMatrixAt(i, d.matrix);
    d.position.set(x, y - 0.04, ROW_Z - 0.08);
    d.updateMatrix();
    sm.setMatrixAt(i, d.matrix);
  });
  for (const m of [pm, sm]) {
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    m.receiveShadow = true;
    root.add(m);
  }
  batch.build(root);
  return {
    root,
    groundAt: () => 0,
    dispose() {
      batch.dispose();
    },
  };
}
