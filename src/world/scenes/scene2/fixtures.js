import * as THREE from 'three';
import { cbox, cyl, rod, tubeGeo, cableGeo, compose } from './kit.js';
import { FRONT_X, facadeFrame } from './facades.js';
import { SIDEWALK_Y } from './street.js';

// Street furniture built in code (no suitable CC0 models): wall-console lanterns, the cast-iron
// bench, the dumpster, the overhead cables, No. 14's corrugated awning and Odile's tower scaffold.
// Everything goes into Batches (one draw per material).

const _v = new THREE.Vector3();

/**
 * A lantern on a wrought-iron wall console. Returns the lantern centre (world) for the light.
 * glassKey: batch key of the lantern glass ('lampGlass' or the flickering one); glassColor: its colour.
 */
export function addLamp(batch, { side, z, y = 4.75, reach = 1.2, glassKey = 'lampGlass', glassColor }) {
  const parent = facadeFrame(side, z, y);
  const P = { parent };
  batch.add('iron', cbox(0.22, 0.5, 0.04), { ...P, pos: [0, -0.12, 0.02] });
  batch.add('iron', tubeGeo([[0, 0, 0.03], [0, 0.14, 0.4], [0, 0.2, 0.8], [0, 0.16, reach]], 0.028, 20, 6), P);
  batch.add('iron', rod([0, -0.34, 0.03], [0, 0.1, 0.62], 0.016), P);
  batch.add('iron', new THREE.TorusGeometry(0.1, 0.012, 5, 16).rotateY(Math.PI / 2), { ...P, pos: [0, -0.06, 0.3] });
  batch.add('iron', new THREE.TorusGeometry(0.07, 0.011, 5, 14).rotateY(Math.PI / 2), { ...P, pos: [0, 0.02, 0.55] });
  batch.add('iron', rod([0, 0.17, reach], [0, -0.06, reach], 0.014), P);
  // Lantern: a pyramid roof, tapered glass body, a bottom cap, corner ribs.
  batch.add('iron', new THREE.CylinderGeometry(0.035, 0.27, 0.17, 4).rotateY(Math.PI / 4), { ...P, pos: [0, -0.13, reach] });
  batch.add('iron', new THREE.SphereGeometry(0.035, 6, 4), { ...P, pos: [0, -0.02, reach] });
  batch.add(glassKey, new THREE.CylinderGeometry(0.21, 0.13, 0.34, 4, 1).rotateY(Math.PI / 4), { ...P, pos: [0, -0.39, reach], color: glassColor });
  batch.add('iron', new THREE.CylinderGeometry(0.13, 0.05, 0.07, 4).rotateY(Math.PI / 4), { ...P, pos: [0, -0.595, reach] });
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const top = [Math.cos(a) * 0.21 * 0.71, -0.22, reach + Math.sin(a) * 0.21 * 0.71];
    const bot = [Math.cos(a) * 0.13 * 0.71, -0.56, reach + Math.sin(a) * 0.13 * 0.71];
    batch.add('iron', rod(top, bot, 0.008, 4), P);
  }
  return _v.set(0, -0.39, reach).applyMatrix4(parent).clone();
}

/** The cast-iron bench with wet timber slats, along Z, the sitter facing +X. seat: {x, z}. */
export function addBench(batch, { x, z, len = 1.8 }) {
  const y0 = SIDEWALK_Y;
  const seatY = y0 + 0.43;
  for (let i = 0; i < 4; i++) batch.add('timber', cbox(0.088, 0.034, len), { pos: [x - 0.205 + i * 0.137, seatY, z] });
  for (let i = 0; i < 3; i++) batch.add('timber', cbox(0.028, 0.095, len), { pos: [x - 0.3 - i * 0.03, seatY + 0.18 + i * 0.13, z], rot: [0, 0, 0.22] });
  for (const dz of [-len / 2 + 0.14, len / 2 - 0.14]) {
    const zz = z + dz;
    batch.add('iron', rod([x + 0.2, y0, zz], [x + 0.18, seatY - 0.02, zz], 0.024), {}); // front leg
    batch.add('iron', tubeGeo([[x - 0.22, y0, zz], [x - 0.27, seatY, zz], [x - 0.33, seatY + 0.25, zz], [x - 0.39, seatY + 0.5, zz]], 0.024, 12, 6));
    batch.add('iron', cbox(0.5, 0.045, 0.045), { pos: [x - 0.02, seatY - 0.04, zz] });
    batch.add('iron', tubeGeo([[x - 0.3, seatY + 0.26, zz], [x - 0.05, seatY + 0.24, zz], [x + 0.2, seatY + 0.22, zz], [x + 0.22, seatY + 0.05, zz]], 0.022, 12, 6)); // armrest
    batch.add('iron', new THREE.TorusGeometry(0.06, 0.01, 5, 12), { pos: [x - 0.04, seatY - 0.16, zz] }); // the scroll
    batch.add('iron', cbox(0.12, 0.03, 0.09), { pos: [x + 0.2, y0 + 0.015, zz] }); // feet
    batch.add('iron', cbox(0.12, 0.03, 0.09), { pos: [x - 0.22, y0 + 0.015, zz] });
  }
}

/** A municipal dumpster against a facade (long axis along Z), one lid ajar. */
export function addDumpster(batch, { x, z, side = 1 }) {
  const y0 = SIDEWALK_Y + 0.12;
  const L = 1.8;
  const D = 0.95;
  const H = 1.0;
  batch.add('pipe', new THREE.BoxGeometry(D, H, L).translate(0, H / 2, 0), { pos: [x, y0, z] });
  batch.add('pipe', cbox(D + 0.08, 0.08, L + 0.08), { pos: [x, y0 + H - 0.04, z] }); // rim
  for (const dz of [-L / 4, L / 4]) batch.add('pipe', cbox(0.05, H * 0.7, 0.07), { pos: [x - side * (D / 2 + 0.02), y0 + H * 0.45, z + dz] });
  // Lids (black plastic): one shut, one propped on a bag.
  batch.add('casement', cbox(D + 0.06, 0.05, L / 2 - 0.02), { pos: [x, y0 + H + 0.03, z - L / 4] });
  const hinge = compose({ pos: [x + side * (D / 2), y0 + H + 0.03, z + L / 4], rot: [0, 0, side * -0.32] });
  batch.add('casement', cbox(D + 0.06, 0.05, L / 2 - 0.02), { pos: [-side * (D / 2), 0, 0], parent: hinge });
  for (const [dx, dz] of [[-0.35, -0.75], [0.35, -0.75], [-0.35, 0.75], [0.35, 0.75]]) {
    batch.add('iron', new THREE.CylinderGeometry(0.06, 0.06, 0.04, 10).rotateZ(Math.PI / 2), { pos: [x + dx, SIDEWALK_Y + 0.06, z + dz] });
    batch.add('iron', cbox(0.06, 0.08, 0.08), { pos: [x + dx, y0 - 0.02, z + dz] });
  }
}

/** Overhead cables: spans across the street and droops along the facades. */
export function addCables(batch) {
  const spans = [
    [[-FRONT_X, 7.1, -2.6], [FRONT_X, 6.8, -4.4], 0.55],
    [[-FRONT_X, 6.5, -14.2], [FRONT_X, 7.3, -13.4], 0.7],
    [[-FRONT_X, 7.6, -27.0], [FRONT_X, 6.9, -26.0], 0.6],
    [[-FRONT_X, 6.9, -39.4], [FRONT_X, 7.2, -38.8], 0.5],
    [[-FRONT_X, 6.2, 7.0], [FRONT_X, 6.6, 8.2], 0.45],
  ];
  for (const [a, b, sag] of spans) {
    batch.add('cable', cableGeo(a, b, sag, 0.011));
    batch.add('cable', cableGeo([a[0], a[1] - 0.25, a[2] + 0.1], [b[0], b[1] - 0.2, b[2] + 0.1], sag * 1.15, 0.008));
  }
  // Along the facades just under the first-floor sills, swagging between brackets.
  for (const [side, z0, z1] of [[-1, 13, -5.4], [1, 13, -6.0], [1, -24.7, -31.1], [-1, -36.6, -47.6], [1, -36.9, -47.6]]) {
    const x = side * (FRONT_X - 0.05);
    for (let z = z0; z > z1 + 1; z -= 3.2) batch.add('cable', cableGeo([x, 4.32, z], [x, 4.32, Math.max(z1, z - 3.2)], 0.12, 0.01));
  }
}

/**
 * No. 14's deep lean-to: a corrugated sheet on three steel struts, a gutter along the front (with a
 * gap where it pours), wall plate. At (0, y, doorZ), projecting toward +Z.
 */
export function addAwning(batch, { doorZ, y = 4.3, w = 7.0, d = 3.5, tilt = 0.12 }) {
  const root = compose({ pos: [0, y, doorZ], rot: [tilt, 0, 0] });
  batch.add('corrugated', cbox(w, 0.035, d), { pos: [0, 0, d / 2], parent: root });
  batch.add('iron', cbox(w, 0.08, 0.08), { pos: [0, -0.06, d - 0.05], parent: root }); // front rail
  batch.add('iron', cbox(w, 0.12, 0.1), { pos: [0, 0.0, 0.05], parent: root }); // wall plate
  const frontY = y - Math.sin(tilt) * d;
  const frontZ = doorZ + Math.cos(tilt) * d;
  // Gutter (half pipe) with a gap at x 2.4..2.7 where the water comes through.
  for (const [x0, x1] of [[-w / 2, 2.35], [2.75, w / 2]]) {
    const L = x1 - x0;
    batch.add('pipe', new THREE.CylinderGeometry(0.075, 0.075, L, 8, 1, true, Math.PI / 2, Math.PI).rotateZ(Math.PI / 2), { pos: [(x0 + x1) / 2, frontY - 0.06, frontZ + 0.04] });
  }
  for (const x of [-3.2, 0, 3.2]) batch.add('iron', rod([x, y - 1.1, doorZ + 0.03], [x, frontY - 0.02, frontZ - 0.2], 0.03), {});
  return { gap: [2.55, frontY - 0.08, frontZ + 0.04] };
}

/**
 * Odile's rolling tower: steel tubes, ledgers, side braces, guard rails on three sides (the fascia
 * side is open), a plank deck with toe boards, four casters (one lock gone). Built at the local
 * origin (feet at y 0); returns { deckTop }.
 */
export function buildTowerFrame(batch, { size = 2, lift = 0.12 }) {
  const h = size / 2 - 0.05;
  const top = lift + size;
  const deckTop = top + 0.05;
  const r = 0.024;
  for (const [x, z] of [[-h, -h], [h, -h], [-h, h], [h, h]]) batch.add('steel', rod([x, lift, z], [x, deckTop + 1.02, z], r, 8));
  for (const y of [lift + 0.14, lift + size * 0.52, top - 0.04]) {
    batch.add('steel', rod([-h, y, -h], [h, y, -h], r * 0.85));
    batch.add('steel', rod([-h, y, h], [h, y, h], r * 0.85));
    batch.add('steel', rod([-h, y, -h], [-h, y, h], r * 0.85));
    batch.add('steel', rod([h, y, -h], [h, y, h], r * 0.85));
  }
  for (const x of [-h, h]) {
    batch.add('steel', rod([x, lift + 0.14, -h], [x, lift + size * 0.52, h], r * 0.8));
    batch.add('steel', rod([x, lift + size * 0.52, h], [x, top - 0.04, -h], r * 0.8));
  }
  batch.add('steel', rod([-h, lift + 0.14, h], [h, lift + size * 0.52, h], r * 0.8));
  // Guard rails: back (+Z, toward the street) and both sides.
  for (const dy of [0.5, 1.0]) {
    batch.add('steel', rod([-h, deckTop + dy, h], [h, deckTop + dy, h], r * 0.85));
    batch.add('steel', rod([-h, deckTop + dy, -h], [-h, deckTop + dy, h], r * 0.85));
    batch.add('steel', rod([h, deckTop + dy, -h], [h, deckTop + dy, h], r * 0.85));
  }
  // Ladder rungs up the left side (the way up).
  for (let y = lift + 0.4; y < top - 0.1; y += 0.32) batch.add('steel', rod([-h, y, -0.3], [-h, y, 0.3], r * 0.7));
  batch.add('steel', rod([-h, lift + 0.14, -0.3], [-h, top, -0.3], r * 0.8));
  batch.add('steel', rod([-h, lift + 0.14, 0.3], [-h, top, 0.3], r * 0.8));
  // Deck planks and toe boards.
  for (let i = 0; i < 5; i++) batch.add('timber', cbox(size + 0.04, 0.045, 0.385), { pos: [0, top + 0.022, -0.8 + i * 0.4] });
  batch.add('timber', cbox(size, 0.15, 0.03), { pos: [0, top + 0.12, h + 0.02] });
  for (const x of [-h - 0.02, h + 0.02]) batch.add('timber', cbox(0.03, 0.15, size), { pos: [x, top + 0.12, 0] });
  // Casters: swivel fork, wheel, lock pedal (front-right one hangs loose).
  for (const [x, z] of [[-h, -h], [h, -h], [-h, h], [h, h]]) {
    batch.add('iron', cbox(0.08, 0.08, 0.1), { pos: [x, lift - 0.02, z] });
    batch.add('iron', new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12).rotateZ(Math.PI / 2), { pos: [x, 0.06, z + 0.03] });
    const broken = x > 0 && z > 0;
    batch.add('iron', cbox(0.03, 0.02, 0.09), { pos: [x + 0.05, broken ? 0.03 : 0.1, z + 0.09], rot: [broken ? 0.9 : 0, 0, 0] });
  }
  return { deckTop };
}
