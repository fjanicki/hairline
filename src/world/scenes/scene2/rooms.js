import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boxGeo, cbox } from './kit.js';
import { GF, facadeFrame } from './facades.js';

// Walk-in ground floors for Rue des Tanneurs (R4): a building's ground-floor mass (facades.js
// addBuilding, `hollow`) is replaced by a shell around a real room, so a shop can be seen into through
// its glass (ENCRE FINE) or entered (CYCLES DURAND, Ch6). Everything is built in the facade-local frame
// of facades.js: x along the facade, y up, +z out of the wall into the street, so the room is at z < 0.
// The shell goes into the street Batch (a few more pieces in the masses' draw calls); the inside faces
// are their own keys (roomPlaster, roomBoards, roomConcrete, roomCeil) so both rooms share their draws.

const DEPTH = 8; // building depth behind the facade (facades.js addBuilding)
const SIDE = 0.15; // party walls

/**
 * b: a BUILDINGS record. o: { depth, h, wall (front wall thickness), openings: [{x0, x1, h}] (local x),
 * massKey (default the building's ground-floor recipe), wallKey, floorKey, ceilKey, back = true (plaster back wall) }.
 * Returns { P (Matrix4), W, depth, h, wall, toWorld(x, y, z) -> Vector3, rect(x0, x1, z0, z1) -> bounds rect,
 *           walk (the room floor as a bounds rect, 0.35 m in from the walls) }.
 */
export function addRoom(batch, b, { depth = 4.6, h = 3.1, wall = 0.3, openings = [], massKey, wallKey = 'roomPlaster', floorKey = 'roomBoards', ceilKey = 'roomCeil', back = true } = {}) {
  const W = b.z0 - b.z1;
  const zc = (b.z0 + b.z1) / 2;
  const P = facadeFrame(b.side, zc, 0);
  const key = massKey || b.gfRecipe || b.recipe;
  const add = (k, g, pos) => batch.add(k, g, { parent: P, pos });
  const x0 = -W / 2;
  const x1 = W / 2;
  // Front wall, with its openings cut out (each from the ground up to o.h).
  let x = x0;
  for (const o of [...openings].sort((a, c) => a.x0 - c.x0)) {
    if (o.x0 > x) add(key, boxGeo(o.x0 - x, GF, wall), [(x + o.x0) / 2, 0, -wall / 2]);
    add(key, boxGeo(o.x1 - o.x0, GF - o.h, wall), [(o.x0 + o.x1) / 2, o.h, -wall / 2]);
    x = o.x1;
  }
  if (x < x1) add(key, boxGeo(x1 - x, GF, wall), [(x + x1) / 2, 0, -wall / 2]);
  // Behind and above the room, and the party walls either side.
  const inD = depth - wall;
  const midZ = -(wall + inD / 2);
  add(key, boxGeo(W, GF, DEPTH - depth), [0, 0, -(depth + (DEPTH - depth) / 2)]);
  add(key, boxGeo(W, GF - h, inD), [0, h, midZ]);
  for (const sx of [x0 + SIDE / 2, x1 - SIDE / 2]) add(key, boxGeo(SIDE, h, inD), [sx, 0, midZ]);
  // The inside faces (1 cm proud of the shell, facing in).
  const iw = W - SIDE * 2;
  const floor = new THREE.PlaneGeometry(iw, inD).rotateX(-Math.PI / 2);
  add(floorKey, floor, [0, 0.04, midZ]);
  add(ceilKey, new THREE.PlaneGeometry(iw, inD).rotateX(Math.PI / 2), [0, h - 0.01, midZ]);
  if (back) add(wallKey, new THREE.PlaneGeometry(iw, h), [0, h / 2, -depth + 0.01]);
  add(wallKey, new THREE.PlaneGeometry(inD, h).rotateY(Math.PI / 2), [x0 + SIDE + 0.01, h / 2, midZ]);
  add(wallKey, new THREE.PlaneGeometry(inD, h).rotateY(-Math.PI / 2), [x1 - SIDE - 0.01, h / 2, midZ]);
  // The inner face of the front wall (plaster, around the openings).
  x = x0 + SIDE;
  const inner = (a, c, y0, y1) => add(wallKey, new THREE.PlaneGeometry(c - a, y1 - y0).rotateY(Math.PI), [(a + c) / 2, (y0 + y1) / 2, -wall - 0.01]);
  for (const o of [...openings].sort((a, c) => a.x0 - c.x0)) {
    if (o.x0 > x) inner(x, o.x0, 0, h);
    inner(o.x0, o.x1, o.h, h);
    x = o.x1;
  }
  if (x < x1 - SIDE) inner(x, x1 - SIDE, 0, h);

  const toWorld = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(P);
  /** World-space bounds rectangle covering local x0..x1, z0..z1 (z negative = inside). */
  const rect = (ax, bx, az, bz) => {
    const a = toWorld(ax, 0, az);
    const c = toWorld(bx, 0, bz);
    return { minX: Math.min(a.x, c.x), maxX: Math.max(a.x, c.x), minZ: Math.min(a.z, c.z), maxZ: Math.max(a.z, c.z) };
  };
  const pad = 0.35;
  return { P, W, depth, h, wall, toWorld, rect, walk: rect(x0 + SIDE + pad, x1 - SIDE - pad, -wall - 0.2, -depth + pad) };
}

/**
 * A door leaf on a hinge, opening into the room. Built in a facade-local frame: add `pivot` to a group
 * carrying that frame. hinge: local x of the hinge edge; dir +1 = the leaf runs toward +x from it.
 * o: { w, h, material, glass (material or null), plate (material for the lock plate), y0 }. Three draws at
 * most: the frame (merged), the glass, the plate. set(k): 0 = shut, 1 = open (about 80 degrees).
 */
export function doorLeaf({ hinge, dir = 1, w = 0.92, h = 2.2, y0 = 0.04, material, glass = null, plate = null }) {
  const pivot = new THREE.Group();
  pivot.position.set(hinge, y0, -0.06);
  const t = 0.045;
  const stile = 0.11;
  const parts = [];
  const piece = (bw, bh, bd, x, y, z) => parts.push(cbox(bw, bh, bd).translate(dir * x, y, z));
  if (glass) {
    // Stiles and rails round a glazed upper half, a solid lower panel.
    piece(stile, h, t, stile / 2, h / 2, 0);
    piece(stile, h, t, w - stile / 2, h / 2, 0);
    piece(w - 2 * stile, 0.16, t, w / 2, h - 0.08, 0);
    piece(w - 2 * stile, h * 0.45, t, w / 2, h * 0.225, 0);
    piece(w - 2 * stile, 0.05, t * 0.8, w / 2, h * 0.45 + 0.025, 0);
    const gh = h * 0.55 - 0.21;
    const pane = new THREE.Mesh(cbox(w - 2 * stile, gh, 0.01).translate(dir * (w / 2), h * 0.45 + 0.05 + gh / 2, 0), glass);
    pane.renderOrder = 2;
    pivot.add(pane);
  } else piece(w, h, t, w / 2, h / 2, 0);
  const leaf = new THREE.Mesh(mergeGeometries(parts, false), material);
  leaf.castShadow = true;
  for (const g of parts) g.dispose();
  pivot.add(leaf);
  if (plate) pivot.add(new THREE.Mesh(cbox(0.05, 0.2, 0.02).translate(dir * (w - 0.09), 1.0, t / 2 + 0.01), plate));
  let k = 0;
  return {
    pivot,
    get open() {
      return k;
    },
    set(v) {
      k = Math.max(0, Math.min(1, v));
      pivot.rotation.y = dir * k * 1.4;
    },
  };
}
