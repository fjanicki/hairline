import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// No. 14 in the grey Hugo mixed in Ch4 (DESIGN R3.7, mem.doorGrey): a painted leaf over the street
// door, and painted strips over the garage door's iron jambs and lintel. Positions follow scene2's
// No. 14 (DOOR_Z -48, stairwell door at x 3.75, garage x -1.6 .. 1.6, h 2.7). One draw, no shadows.

const DOOR_Z = -48;
const STREET_DOOR = { x: 3.75, w: 1.1, h: 2.2 };
const GARAGE = { x0: -1.6, x1: 1.6, h: 2.7 };

const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

/** paintNo14(group, hex) -> the painted mesh (already added to `group`). */
export function paintNo14(group, hex = '#8d877c') {
  const { x, w, h } = STREET_DOOR;
  const z = DOOR_Z;
  const parts = [
    // The leaf, proud of the old door, then its four raised panels again on top.
    box(w - 0.04, h - 0.04, 0.012, x, h / 2, z + 0.091),
  ];
  for (const sx of [-1, 1]) {
    parts.push(box(w / 2 - 0.16, h * 0.42, 0.01, x + sx * (w / 4), h * 0.7, z + 0.102));
    parts.push(box(w / 2 - 0.16, h * 0.3, 0.01, x + sx * (w / 4), h * 0.24, z + 0.102));
  }
  // Garage jambs and lintel: scene2's iron boxes, 2 mm bigger all round.
  const jh = GARAGE.h + 0.16 + 0.004;
  parts.push(box(0.164, jh, 0.204, GARAGE.x0 - 0.08, jh / 2 - 0.002, z + 0.05));
  parts.push(box(0.164, jh, 0.204, GARAGE.x1 + 0.08, jh / 2 - 0.002, z + 0.05));
  parts.push(box(GARAGE.x1 - GARAGE.x0 + 0.324, 0.164, 0.204, 0, GARAGE.h + 0.08, z + 0.05));
  const geo = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  // A touch warm against the street's cool daylight grade, so his grey doesn't read blue-grey.
  const color = new THREE.Color(hex).multiply(new THREE.Color(1.08, 1, 0.88));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  mesh.name = 'no14-paint';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
