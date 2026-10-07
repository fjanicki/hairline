import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { H, IN_X, BACK_Z, D, DOOR, DOOR_X, WIN, TV_POS, TV_TOP, FRIDGE, KITCHEN, LAMP_POS, boxAt, rod, place, hash, clean } from './common.js';

// Procedural furniture and fittings for the flat. Everything static goes into a Batch (merged per
// material); only the pieces that move or glow come back as their own meshes.
// mats: { trim, door, kitchen, teak, worktop, tile, rust, fridge, steel, chrome, dark, rubber,
//         paper, fabric, duvet, sheet, terracotta, leaf, glass, cardboard }

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ trims

/** Skirting with a moulded top, a cornice along the wall tops, the door lining and architrave. */
export function buildTrims(batch, mats) {
  const { trim } = mats;
  const sk = 0.14;
  const Z = BACK_Z;
  const runs = [
    // back wall (cut round the door), side walls
    ['z', -IN_X, DOOR.x0 - 0.08, Z],
    ['z', DOOR.x1 + 0.08, IN_X, Z],
    ['xl', Z, D / 2, -IN_X],
    ['xr', Z, D / 2, IN_X],
  ];
  for (const [kind, a, b, c] of runs) {
    if (kind === 'z') {
      batch.add(trim, boxAt(a, b, 0, sk, c, c + 0.018));
      batch.add(trim, boxAt(a, b, sk, sk + 0.014, c, c + 0.01));
      batch.add(trim, boxAt(a, b, H - 0.09, H, c, c + 0.05)); // cornice
      batch.add(trim, boxAt(a, b, H - 0.12, H - 0.09, c, c + 0.022));
    } else {
      const s = kind === 'xl' ? 1 : -1;
      const x0 = c;
      const x1 = c + s * 0.018;
      batch.add(trim, boxAt(Math.min(x0, x1), Math.max(x0, x1), 0, sk, a, b));
      batch.add(trim, boxAt(Math.min(x0, x0 + s * 0.01), Math.max(x0, x0 + s * 0.01), sk, sk + 0.014, a, b));
      batch.add(trim, boxAt(Math.min(x0, x0 + s * 0.05), Math.max(x0, x0 + s * 0.05), H - 0.09, H, a, b));
      batch.add(trim, boxAt(Math.min(x0, x0 + s * 0.022), Math.max(x0, x0 + s * 0.022), H - 0.12, H - 0.09, a, b));
    }
  }
  // Cornice across the door gap (above the architrave).
  batch.add(trim, boxAt(DOOR.x0 - 0.08, DOOR.x1 + 0.08, H - 0.09, H, Z, Z + 0.05));
  // Door lining (the reveal through the wall) and the architrave on the room side.
  batch.add(trim, boxAt(DOOR.x0, DOOR.x0 + 0.025, 0, DOOR.h, -2.58, Z));
  batch.add(trim, boxAt(DOOR.x1 - 0.025, DOOR.x1, 0, DOOR.h, -2.58, Z));
  batch.add(trim, boxAt(DOOR.x0, DOOR.x1, DOOR.h - 0.025, DOOR.h, -2.58, Z));
  batch.add(trim, boxAt(DOOR.x0 - 0.08, DOOR.x0, 0, DOOR.h + 0.08, Z, Z + 0.024));
  batch.add(trim, boxAt(DOOR.x1, DOOR.x1 + 0.08, 0, DOOR.h + 0.08, Z, Z + 0.024));
  batch.add(trim, boxAt(DOOR.x0 - 0.08, DOOR.x1 + 0.08, DOOR.h, DOOR.h + 0.08, Z, Z + 0.024));
  // plinth blocks at the foot of the architrave
  for (const x of [DOOR.x0 - 0.04, DOOR.x1 + 0.04]) batch.add(trim, boxAt(x - 0.045, x + 0.045, 0, 0.18, Z, Z + 0.032));
  // Threshold strip.
  batch.add(mats.teak, boxAt(DOOR.x0, DOOR.x1, 0, 0.012, -2.6, Z + 0.02), { castShadow: false });
}

/** Wall plates: light switch by the door, sockets, a doorbell box; with cables in the batch. */
export function buildElectrics(batch, mats) {
  const plate = mats.plastic;
  const Z = BACK_Z;
  const plates = [
    ['back', DOOR.x0 - 0.22, 1.2, 0.085, 0.085], // switch
    ['back', -0.4, 0.3, 0.14, 0.085], // double socket under the window corner
    ['back', 1.3, 0.3, 0.085, 0.085], // TV socket
    ['right', 1.32, 1.08, 0.14, 0.085], // kitchen socket over the worktop
    ['left', 0.95, 0.3, 0.085, 0.085],
  ];
  for (const [wall, s, y, w, h] of plates) {
    if (wall === 'back') batch.add(plate, boxAt(s - w / 2, s + w / 2, y - h / 2, y + h / 2, Z, Z + 0.01), { castShadow: false });
    else if (wall === 'left') batch.add(plate, boxAt(-IN_X, -IN_X + 0.01, y - h / 2, y + h / 2, s - w / 2, s + w / 2), { castShadow: false });
    else batch.add(plate, boxAt(IN_X - 0.01, IN_X, y - h / 2, y + h / 2, s - w / 2, s + w / 2), { castShadow: false });
  }
  // switch rocker
  batch.add(mats.dark, boxAt(DOOR.x0 - 0.232, DOOR.x0 - 0.208, 1.18, 1.22, Z + 0.01, Z + 0.018), { castShadow: false });
  // Cables: TV to its socket, the lamp along the skirting to the window socket, an extension lead.
  const tube = (pts, r = 0.0045) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V(...p))), Math.max(16, pts.length * 10), r, 5, false);
  batch.add(
    mats.dark,
    tube([
      [TV_POS[0] + 0.1, TV_TOP + 0.1, -2.36],
      [TV_POS[0] + 0.25, TV_TOP - 0.05, -2.39],
      [TV_POS[0] + 0.45, 0.35, -2.4],
      [1.25, 0.3, -2.405],
      [1.3, 0.3, -2.41],
    ]),
    { castShadow: false },
  );
  batch.add(
    mats.dark,
    tube([
      [LAMP_POS[0] + 0.05, 0.015, LAMP_POS[1] - 0.05],
      [LAMP_POS[0] + 0.25, 0.006, -2.36],
      [-1.0, 0.006, -2.385],
      [-0.6, 0.006, -2.39],
      [-0.47, 0.2, -2.405],
      [-0.44, 0.29, -2.41],
    ]),
    { castShadow: false },
  );
  // Extension lead lying in front of the TV sideboard with a phone charger in it.
  batch.add(mats.plastic, boxAt(-0.02, 0.26, 0.0, 0.035, -1.9, -1.84), { castShadow: false });
  batch.add(
    mats.dark,
    tube([
      [-0.02, 0.018, -1.87],
      [-0.2, 0.006, -1.95],
      [-0.33, 0.006, -2.2],
      [-0.36, 0.2, -2.405],
      [-0.37, 0.28, -2.41],
    ]),
    { castShadow: false },
  );
}

// ------------------------------------------------------------------ sideboard, coffee table

/** A 70s teak sideboard for the TV: legs, sliding doors, an open bay with the VCR and tapes. */
export function buildSideboard(batch, mats) {
  const { teak, dark } = mats;
  const x0 = TV_POS[0] - 0.68;
  const x1 = TV_POS[0] + 0.68;
  const z0 = BACK_Z + 0.03;
  const z1 = z0 + 0.44;
  const legH = 0.12;
  const top = TV_TOP;
  // carcass: top, bottom, sides, back, a divider
  batch.add(teak, boxAt(x0 - 0.01, x1 + 0.01, top - 0.03, top, z0 - 0.01, z1 + 0.015));
  batch.add(teak, boxAt(x0, x1, legH, legH + 0.025, z0, z1));
  batch.add(teak, boxAt(x0, x0 + 0.025, legH, top - 0.03, z0, z1));
  batch.add(teak, boxAt(x1 - 0.025, x1, legH, top - 0.03, z0, z1));
  batch.add(teak, boxAt(x0, x1, legH, top - 0.03, z0, z0 + 0.012));
  const xm = x0 + 0.55;
  batch.add(teak, boxAt(xm - 0.012, xm + 0.012, legH, top - 0.03, z0, z1));
  // sliding doors on the right bay, one a little open
  batch.add(teak, boxAt(xm + 0.02, xm + 0.44, legH + 0.03, top - 0.035, z1 - 0.03, z1 - 0.012));
  batch.add(teak, boxAt(xm + 0.36, x1 - 0.02, legH + 0.03, top - 0.035, z1 - 0.012, z1 + 0.006));
  // finger pulls
  for (const x of [xm + 0.4, xm + 0.42 + 0.3]) batch.add(dark, boxAt(x - 0.015, x + 0.015, 0.33, 0.39, z1 + 0.004, z1 + 0.009), { castShadow: false });
  // tapered legs
  for (const [lx, lz] of [
    [x0 + 0.06, z0 + 0.06],
    [x1 - 0.06, z0 + 0.06],
    [x0 + 0.06, z1 - 0.06],
    [x1 - 0.06, z1 - 0.06],
  ])
    batch.add(teak, rod(V(lx, legH, lz), V(lx + (lx < TV_POS[0] ? -0.02 : 0.02), 0, lz + 0.015), 0.018, 8, 0.012));
  // Open bay: the VCR (clock dead), a stack of tapes, a games pad cable.
  batch.add(dark, boxAt(x0 + 0.06, x0 + 0.5, legH + 0.025, legH + 0.11, z0 + 0.06, z0 + 0.38));
  const tapeMat = mats.dark2;
  for (let i = 0; i < 7; i++) {
    const y = legH + 0.14 + 0.0;
    const x = x0 + 0.08 + i * 0.03;
    batch.add(tapeMat, boxAt(x, x + 0.026, y, y + 0.19, z0 + 0.15, z0 + 0.255 + hash(i) * 0.01), { castShadow: false });
  }
  // a few tapes lying flat on top of the stack
  batch.add(tapeMat, place(new THREE.BoxGeometry(0.19, 0.026, 0.105), [x0 + 0.38, legH + 0.14 + 0.013, z0 + 0.22], [0, 0.2, 0]), { castShadow: false });
  return { x0, x1, z0, z1, vcr: [x0 + 0.28, legH + 0.11, z0 + 0.38] };
}

/** Low coffee table (teak) with a magazine shelf. Top surface at 0.44. */
export function buildCoffeeTable(batch, mats, [cx, cz]) {
  const { teak } = mats;
  const w = 1.04;
  const d = 0.54;
  const top = 0.44;
  batch.add(teak, new RoundedBoxGeometry(w, 0.035, d, 2, 0.012).translate(cx, top - 0.0175, cz));
  batch.add(teak, boxAt(cx - w / 2 + 0.06, cx + w / 2 - 0.06, 0.14, 0.158, cz - d / 2 + 0.06, cz + d / 2 - 0.06));
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = cx + sx * (w / 2 - 0.07);
      const z = cz + sz * (d / 2 - 0.07);
      batch.add(teak, rod(V(x, top - 0.035, z), V(x + sx * 0.03, 0, z + sz * 0.02), 0.022, 8, 0.014));
    }
  // Magazines and the free paper on the shelf.
  for (let i = 0; i < 4; i++) {
    batch.add(
      mats.paper,
      place(new THREE.BoxGeometry(0.3, 0.008, 0.22), [cx - 0.22 + i * 0.03, 0.162 + i * 0.008, cz + 0.02], [0, (hash(i * 3) - 0.5) * 0.5, 0]),
      { castShadow: false },
    );
  }
  return top;
}

// ------------------------------------------------------------------ kitchenette

/** Base units, worktop, sink and tap, a two-ring hob, tiles, a shelf with jars over a strip light. */
export function buildKitchen(batch, mats) {
  const { kitchen, worktop, tile, chrome, steel, dark } = mats;
  const { z0, z1, depth, top } = KITCHEN;
  const xb = IN_X; // wall
  const xf = IN_X - depth; // carcass front 2.32
  // plinth (recessed), carcass sides, door fronts with gaps, a drawer line
  batch.add(dark, boxAt(xf + 0.06, xb, 0, 0.1, z0 + 0.01, z1 - 0.01));
  batch.add(kitchen, boxAt(xf + 0.02, xb, 0.1, top - 0.03, z0, z0 + 0.018));
  batch.add(kitchen, boxAt(xf + 0.02, xb, 0.1, top - 0.03, z1 - 0.018, z1));
  const zm = (z0 + z1) / 2;
  const fronts = [
    [z0 + 0.004, zm - 0.003, 0.1, top - 0.19],
    [zm + 0.003, z1 - 0.004, 0.1, top - 0.19],
    [z0 + 0.004, z1 - 0.004, top - 0.185, top - 0.035],
  ];
  for (const [a, b, y0, y1] of fronts) batch.add(kitchen, boxAt(xf, xf + 0.022, y0, y1, a, b));
  // handles: chrome bars
  for (const [z, y] of [
    [zm - 0.06, top - 0.26],
    [zm + 0.06, top - 0.26],
    [zm, top - 0.11],
  ])
    batch.add(chrome, boxAt(xf - 0.022, xf - 0.006, y - 0.008, y + 0.008, z - 0.06, z + 0.06), { castShadow: false });
  // One door hangs open a crack on a loose hinge (the left one).
  // Worktop, overhanging the front, cut round a sunk steel sink (rim, four walls, a drain).
  const sz0 = z1 - 0.46;
  const sz1 = z1 - 0.05;
  const bx0 = xf + 0.08;
  const bx1 = xb - 0.1;
  const bz0 = sz0 + 0.05;
  const bz1 = sz1 - 0.05;
  const wt = top - 0.035;
  batch.add(worktop, boxAt(xf - 0.035, xb, wt, top, z0 - 0.01, bz0));
  batch.add(worktop, boxAt(xf - 0.035, xb, wt, top, bz1, z1 + 0.01));
  batch.add(worktop, boxAt(xf - 0.035, bx0, wt, top, bz0, bz1));
  batch.add(worktop, boxAt(bx1, xb, wt, top, bz0, bz1));
  batch.add(steel, boxAt(xf - 0.036, xf - 0.03, wt, top, z0 - 0.01, z1 + 0.01), { castShadow: false });
  // Tiled splash-back with grimy grout.
  batch.add(tile, boxAt(xb - 0.012, xb, top, top + 0.62, z0 - 0.01, z1 + 0.01), { castShadow: false });
  const rim = 0.012;
  batch.add(steel, boxAt(xf + 0.03, xb - 0.04, top, top + 0.004, sz0, bz0), { castShadow: false });
  batch.add(steel, boxAt(xf + 0.03, xb - 0.04, top, top + 0.004, bz1, sz1), { castShadow: false });
  batch.add(steel, boxAt(xf + 0.03, bx0, top, top + 0.004, bz0, bz1), { castShadow: false });
  batch.add(steel, boxAt(bx1, xb - 0.04, top, top + 0.004, bz0, bz1), { castShadow: false });
  const depthS = 0.16;
  batch.add(steel, boxAt(bx0, bx1, top - depthS, top - depthS + rim, bz0, bz1), { castShadow: false });
  batch.add(steel, boxAt(bx0, bx0 + rim, top - depthS, top, bz0, bz1), { castShadow: false });
  batch.add(steel, boxAt(bx1 - rim, bx1, top - depthS, top, bz0, bz1), { castShadow: false });
  batch.add(steel, boxAt(bx0, bx1, top - depthS, top, bz0, bz0 + rim), { castShadow: false });
  batch.add(steel, boxAt(bx0, bx1, top - depthS, top, bz1 - rim, bz1), { castShadow: false });
  batch.add(mats.dark2, new THREE.CylinderGeometry(0.025, 0.025, 0.003, 14).translate((bx0 + bx1) / 2, top - depthS + rim + 0.002, (bz0 + bz1) / 2), {
    castShadow: false,
  });
  // dirty plates and a mug in the sink
  for (let i = 0; i < 2; i++)
    batch.add(
      mats.crockery,
      place(
        new THREE.CylinderGeometry(0.095, 0.07, 0.016, 18),
        [(bx0 + bx1) / 2 + 0.015 * i, top - depthS + 0.03 + i * 0.022, (bz0 + bz1) / 2 - 0.04 + 0.03 * i],
        [0.35 - 0.2 * i, 0, 0.15 * i],
      ),
      { castShadow: false },
    );
  const tapB = V(xb - 0.07, top, (sz0 + sz1) / 2);
  const tap = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([tapB, V(tapB.x, top + 0.22, tapB.z), V(tapB.x - 0.05, top + 0.28, tapB.z), V(tapB.x - 0.13, top + 0.22, tapB.z)]),
    20,
    0.011,
    8,
  );
  batch.add(chrome, tap);
  for (const dz of [-0.07, 0.07])
    batch.add(chrome, new THREE.CylinderGeometry(0.014, 0.016, 0.04, 10).translate(tapB.x, top + 0.02, tapB.z + dz), { castShadow: false });
  // Two-ring hob plate with a pan on it.
  const hz = z0 + 0.24;
  batch.add(dark, boxAt(xf + 0.05, xb - 0.05, top, top + 0.012, hz - 0.2, hz + 0.2), { castShadow: false });
  for (const dz of [-0.1, 0.1])
    batch.add(mats.dark2, new THREE.CylinderGeometry(0.075, 0.075, 0.006, 20).translate((xf + xb) / 2, top + 0.015, hz + dz), { castShadow: false });
  batch.add(steel, new THREE.CylinderGeometry(0.11, 0.095, 0.05, 18, 1, true).translate((xf + xb) / 2, top + 0.043, hz + 0.1));
  batch.add(steel, new THREE.CylinderGeometry(0.095, 0.095, 0.004, 18).translate((xf + xb) / 2, top + 0.02, hz + 0.1), { castShadow: false });
  batch.add(dark, rod(V((xf + xb) / 2 - 0.1, top + 0.06, hz + 0.1), V(xf - 0.12, top + 0.075, hz + 0.16), 0.01));
  // Open shelf over the worktop (brackets, a plank) with jars, tins and a cereal box.
  const sy = 1.74;
  batch.add(mats.teak, boxAt(xb - 0.24, xb, sy, sy + 0.025, z0 - 0.02, z1 + 0.06));
  for (const z of [z0 + 0.08, z1 - 0.06]) batch.add(dark, boxAt(xb - 0.2, xb, sy - 0.12, sy, z - 0.01, z + 0.01), { castShadow: false });
  const jar = (z, h, r, m) => batch.add(m, new THREE.CylinderGeometry(r, r, h, 12).translate(xb - 0.12, sy + 0.025 + h / 2, z));
  jar(z0 + 0.02, 0.16, 0.045, mats.glass);
  jar(z0 + 0.13, 0.12, 0.04, mats.glass);
  jar(z0 + 0.24, 0.11, 0.038, steel);
  jar(z0 + 0.33, 0.09, 0.036, steel);
  batch.add(mats.cardboard, place(new THREE.BoxGeometry(0.07, 0.28, 0.19), [xb - 0.11, sy + 0.025 + 0.14, z1 - 0.12], [0, 0.1, 0]));
  return { shelfY: sy, sink: [xf + 0.2, top, (sz0 + sz1) / 2], hob: [(xf + xb) / 2, top, hz] };
}

/** An old rounded fridge (cream enamel going to rust at the foot) with a chrome handle. */
export function buildFridge(batch, mats) {
  const { x, z, w, d, h } = FRIDGE;
  const body = new RoundedBoxGeometry(d, h - 0.04, w, 3, 0.05).translate(x, 0.04 + (h - 0.04) / 2, z);
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(body, mats.fridge);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'fridge';
  g.add(mesh);
  const xf = x - d / 2;
  // feet and kick grille, the door seam, the handle, the badge
  batch.add(mats.dark, boxAt(xf + 0.03, x + d / 2 - 0.04, 0, 0.05, z - w / 2 + 0.03, z + w / 2 - 0.03), { castShadow: false });
  batch.add(mats.dark2, boxAt(xf - 0.002, xf + 0.004, 0.06, 0.14, z - w / 2 + 0.06, z + w / 2 - 0.06), { castShadow: false });
  batch.add(mats.dark2, boxAt(xf - 0.003, xf + 0.01, 0.17, h - 0.06, z + w / 2 - 0.012, z + w / 2 - 0.006), { castShadow: false });
  batch.add(mats.dark2, boxAt(xf - 0.003, xf + 0.01, 1.16, 1.17, z - w / 2 + 0.04, z + w / 2 - 0.02), { castShadow: false });
  batch.add(mats.chrome, rod(V(xf - 0.035, 0.85, z + w / 2 - 0.06), V(xf - 0.035, 1.12, z + w / 2 - 0.06), 0.011, 10));
  for (const y of [0.85, 1.12]) batch.add(mats.chrome, boxAt(xf - 0.04, xf, y - 0.012, y + 0.012, z + w / 2 - 0.07, z + w / 2 - 0.05), { castShadow: false });
  // Magnets, a takeaway menu and a postcard (the X-ray is the scene's own).
  const mag = [
    [1.42, z - 0.2],
    [1.05, z + 0.18],
    [0.7, z - 0.15],
    [1.48, z + 0.1],
  ];
  for (const [y, mz] of mag)
    batch.add(mats.plasticRed, new THREE.CylinderGeometry(0.013, 0.013, 0.008, 10).rotateZ(Math.PI / 2).translate(xf - 0.004, y, mz), { castShadow: false });
  batch.add(mats.paper, place(new THREE.BoxGeometry(0.002, 0.28, 0.2), [xf - 0.002, 0.62, z + 0.12], [0.06, 0, 0]), { castShadow: false });
  batch.add(mats.paper, place(new THREE.BoxGeometry(0.002, 0.1, 0.15), [xf - 0.003, 1.44, z + 0.14], [-0.1, 0, 0]), { castShadow: false });
  // On top: a cereal box, a fan of envelopes, an empty bottle.
  batch.add(mats.cardboard, place(new THREE.BoxGeometry(0.07, 0.3, 0.2), [x + 0.05, h + 0.15, z - 0.12], [0, 0.3, 0]));
  batch.add(mats.paper, place(new THREE.BoxGeometry(0.16, 0.012, 0.24), [x - 0.08, h + 0.006, z + 0.12], [0, -0.3, 0]), { castShadow: false });
  batch.add(mats.glass, new THREE.CylinderGeometry(0.035, 0.038, 0.24, 12).translate(x + 0.12, h + 0.12, z + 0.17));
  return g;
}

// ------------------------------------------------------------------ fittings

/** A cast-iron column radiator under the window, paint gone to rust, a valve and pipe. */
export function buildRadiator(batch, mats) {
  const cx = (WIN.x0 + WIN.x1) / 2;
  const n = 11;
  const w = 0.76;
  const y0 = 0.13;
  const y1 = 0.72;
  const z = BACK_Z + 0.075;
  for (let i = 0; i < n; i++) {
    const x = cx - w / 2 + (i + 0.5) * (w / n);
    for (const dz of [-0.024, 0.024]) {
      batch.add(mats.rust, new THREE.CapsuleGeometry(0.019, y1 - y0 - 0.04, 3, 8).translate(x, (y0 + y1) / 2, z + dz));
    }
  }
  batch.add(mats.rust, boxAt(cx - w / 2, cx + w / 2, y1 - 0.06, y1 - 0.02, z - 0.02, z + 0.02));
  batch.add(mats.rust, boxAt(cx - w / 2, cx + w / 2, y0 + 0.02, y0 + 0.06, z - 0.02, z + 0.02));
  for (const x of [cx - w / 2 + 0.05, cx + w / 2 - 0.05]) batch.add(mats.rust, boxAt(x - 0.025, x + 0.025, 0, y0 + 0.02, z - 0.04, z + 0.04));
  // valve + pipe down into the floor
  batch.add(mats.steel, rod(V(cx + w / 2, y0 + 0.04, z), V(cx + w / 2 + 0.08, y0 + 0.04, z), 0.012));
  batch.add(mats.steel, rod(V(cx + w / 2 + 0.08, y0 + 0.04, z), V(cx + w / 2 + 0.08, 0, z), 0.012));
  batch.add(mats.dark, new THREE.CylinderGeometry(0.022, 0.022, 0.05, 10).translate(cx + w / 2 + 0.08, y0 + 0.09, z));
}

/** Tall floor lamp: weighted base, a slightly bent stem, a stained fabric drum shade. */
export function buildLamp(batch, mats) {
  const [x, z] = LAMP_POS;
  const top = V(x + 0.02, 1.42, z + 0.01);
  batch.add(mats.steel, new THREE.CylinderGeometry(0.13, 0.15, 0.03, 20).translate(x, 0.015, z));
  batch.add(mats.steel, rod(V(x, 0.03, z), top, 0.011, 8));
  batch.add(mats.steel, rod(top, V(top.x, top.y + 0.1, top.z), 0.008, 6));
  // shade (open drum, double-sided), and the bulb inside it
  const shadeGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.27, 28, 1, true).translate(top.x, top.y + 0.12, top.z);
  const shade = new THREE.Mesh(shadeGeo, mats.shade);
  shade.castShadow = false;
  shade.receiveShadow = false;
  shade.name = 'lamp-shade';
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10).translate(top.x, top.y + 0.1, top.z), mats.bulb);
  bulb.name = 'lamp-bulb';
  const light = new THREE.PointLight(0xffa860, 1.6, 3.8, 2);
  light.position.set(top.x, top.y + 0.08, top.z);
  light.name = 'lamp-light';
  return { shade, bulb, light, pos: light.position.clone() };
}

/**
 * The flat door: a four-panel leaf on hinges at x0 (it swings out into the hall), a lever handle,
 * a key in the lock, the chain hanging loose. Returns the pivot group (rotate y to open).
 */
export function buildDoor(mats) {
  const pivot = new THREE.Group();
  pivot.name = 'door';
  pivot.position.set(DOOR.x0 + 0.03, 0, -2.455);
  const w = DOOR.x1 - DOOR.x0 - 0.06;
  const h = DOOR.h - 0.035;
  const t = 0.04;
  const geos = [];
  geos.push(boxAt(0, w, 0.012, h, -t / 2, t / 2 - 0.012));
  // stiles and rails stand proud of the panels on the room side
  const f = t / 2;
  const fr = (x0, x1, y0, y1) => geos.push(boxAt(x0, x1, y0, y1, f - 0.012, f));
  fr(0, 0.11, 0.012, h);
  fr(w - 0.11, w, 0.012, h);
  fr(0.11, w - 0.11, h - 0.11, h);
  fr(0.11, w - 0.11, 0.012, 0.22);
  fr(0.11, w - 0.11, 0.98, 1.14);
  fr(w / 2 - 0.05, w / 2 + 0.05, 0.22, h - 0.11);
  // panel mouldings (thin beads)
  for (const [x0, x1, y0, y1] of [
    [0.11, w / 2 - 0.05, 0.22, 0.98],
    [w / 2 + 0.05, w - 0.11, 0.22, 0.98],
    [0.11, w / 2 - 0.05, 1.14, h - 0.11],
    [w / 2 + 0.05, w - 0.11, 1.14, h - 0.11],
  ]) {
    const b = 0.012;
    geos.push(boxAt(x0, x1, y0, y0 + b, f - 0.012, f - 0.004), boxAt(x0, x1, y1 - b, y1, f - 0.012, f - 0.004));
    geos.push(boxAt(x0, x0 + b, y0, y1, f - 0.012, f - 0.004), boxAt(x1 - b, x1, y0, y1, f - 0.012, f - 0.004));
  }
  const leaf = new THREE.Mesh(mergeAll(geos), mats.door);
  leaf.castShadow = true;
  leaf.receiveShadow = true;
  leaf.name = 'door-leaf';
  pivot.add(leaf);
  // Hardware: backplate, lever, key, the chain hanging from its track.
  const hw = [];
  hw.push(boxAt(w - 0.085, w - 0.045, 0.92, 1.12, f, f + 0.008));
  hw.push(rod(V(w - 0.065, 1.07, f + 0.008), V(w - 0.065, 1.07, f + 0.05), 0.008));
  hw.push(rod(V(w - 0.065, 1.07, f + 0.05), V(w - 0.17, 1.065, f + 0.055), 0.008));
  hw.push(boxAt(w - 0.07, w - 0.06, 0.96, 0.995, f + 0.008, f + 0.03));
  hw.push(boxAt(w - 0.1, w - 0.02, 1.52, 1.54, f, f + 0.012));
  for (let i = 0; i < 9; i++)
    hw.push(new THREE.TorusGeometry(0.008, 0.002, 4, 8).rotateY(i % 2 ? Math.PI / 2 : 0).translate(w - 0.03, 1.52 - i * 0.014, f + 0.016));
  const hardware = new THREE.Mesh(mergeAll(hw), mats.brass);
  hardware.castShadow = true;
  pivot.add(hardware);
  return pivot;
}

function mergeAll(geos) {
  const list = geos.map(clean);
  const g = mergeGeometries(list, false);
  for (const x of list) x.dispose();
  return g;
}

/**
 * The landing behind the door, visible only when it opens: a strip of lino, then the stairwell going
 * down behind a banister (balusters and a newel post), the stairwell wall with a bulkhead light (the
 * landing light's source), and the neighbour's door on the side wall.
 */
export function buildHall(mats) {
  const g = new THREE.Group();
  g.name = 'hall';
  g.visible = false;
  const zf = -2.58;
  const deep = 0.95; // landing depth before the stairs drop away
  const zEdge = zf - deep;
  const zWall = zf - 2.1;
  const add = (m) => {
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  add(new THREE.Mesh(new THREE.PlaneGeometry(2.4, deep).rotateX(-Math.PI / 2).translate(DOOR_X, 0.001, zf - deep / 2), mats.lino));
  // The flight down: treads stepping away from the landing edge into the dark.
  for (let k = 0; k < 6; k++) {
    const y = -0.17 * (k + 1);
    const step = add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.17, 0.28).translate(DOOR_X + 0.25, y + 0.085, zEdge - 0.14 - k * 0.28), k % 2 ? mats.lino : mats.teak));
    step.castShadow = true;
  }
  add(new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.4).translate(DOOR_X, 0.6, zWall), mats.hallWall));
  add(new THREE.Mesh(new THREE.PlaneGeometry(2.1, 4.4).rotateY(Math.PI / 2).translate(DOOR.x0 - 0.3, 0.6, zf - 1.05), mats.hallWall));
  // Banister along the landing edge: rail, balusters, newel post.
  const rail = [rod(V(DOOR.x0 - 0.3, 0.92, zEdge + 0.03), V(DOOR.x1 + 0.6, 0.92, zEdge + 0.03), 0.028)];
  for (let x = DOOR.x0 - 0.2; x < DOOR.x1 + 0.55; x += 0.13) rail.push(rod(V(x, 0, zEdge + 0.03), V(x, 0.9, zEdge + 0.03), 0.011, 6));
  const banister = add(new THREE.Mesh(mergeGeometries(rail.map((x) => (x.index ? x.toNonIndexed() : x)).map((x) => (x.deleteAttribute('uv'), x))), mats.teak));
  banister.castShadow = true;
  add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.05, 0.08).translate(DOOR.x0 - 0.26, 0.525, zEdge + 0.03), mats.teak)).castShadow = true;
  // The neighbour's door (side wall), with its frame and a knob.
  const nd = add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.0, 0.84).translate(DOOR.x0 - 0.28, 1.0, zf - 0.5), mats.door));
  nd.castShadow = true;
  add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8).translate(DOOR.x0 - 0.25, 1.0, zf - 0.85), mats.brass));
  add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.06).translate(DOOR.x0 - 0.27, 1.62, zf - 0.5), mats.brass)); // number plate
  // Bulkhead light on the stairwell wall: the landing light's source (scene1.js puts the light there).
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 20).rotateX(Math.PI / 2).translate(DOOR_X + 0.2, 1.85, zWall + 0.02), mats.steel));
  add(new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 0.45).translate(DOOR_X + 0.2, 1.85, zWall + 0.04), mats.bulb));
  return g;
}

/** A dead plant: terracotta pot, cracked soil, brown leaves drooping over the rim. */
export function buildDeadPlant(batch, mats, [x, z]) {
  const pts = [V(0.0, 0, 0), V(0.095, 0, 0), V(0.13, 0.22, 0), V(0.14, 0.235, 0), V(0.125, 0.235, 0), V(0.12, 0.2, 0)].map((p) => new THREE.Vector2(p.x, p.y));
  batch.add(mats.terracotta, new THREE.LatheGeometry(pts, 18).translate(x, 0, z));
  batch.add(mats.dark2, new THREE.CylinderGeometry(0.118, 0.118, 0.01, 18).translate(x, 0.2, z), { castShadow: false });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + hash(i) * 0.6;
    const len = 0.28 + hash(i * 3) * 0.25;
    const leaf = new THREE.PlaneGeometry(0.045, len, 1, 6);
    const p = leaf.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const t = (p.getY(k) + len / 2) / len;
      p.setX(k, p.getX(k) * (1 - t * 0.85));
      p.setZ(k, -Math.pow(t, 2) * len * 0.75);
      p.setY(k, t * len * (1 - 0.55 * t));
    }
    leaf.computeVertexNormals();
    leaf.rotateY(a);
    leaf.rotateX(0);
    batch.add(mats.leaf, leaf.translate(x + Math.cos(a) * 0.03, 0.2, z + Math.sin(a) * 0.03));
  }
  for (let i = 0; i < 4; i++) {
    const a = hash(i * 7) * 6.28;
    batch.add(mats.leaf, rod(V(x, 0.2, z), V(x + Math.cos(a) * 0.08, 0.5 + hash(i) * 0.25, z + Math.sin(a) * 0.08), 0.004, 4), { castShadow: false });
  }
  // two fallen leaves on the floor
  for (let i = 0; i < 2; i++)
    batch.add(
      mats.leaf,
      new THREE.PlaneGeometry(0.04, 0.12)
        .rotateX(-Math.PI / 2)
        .rotateY(i * 1.3)
        .translate(x + 0.18 + i * 0.07, 0.003, z + 0.1),
      { castShadow: false },
    );
}

/** Pedal bin, crutches against the wall, a foam roller on the rug, a bidon on the table. */
export function buildOddments(batch, mats) {
  // pedal bin by the counter end
  const bx = 2.6;
  const bz = 2.34;
  batch.add(mats.steel, new THREE.CylinderGeometry(0.14, 0.13, 0.4, 18).translate(bx, 0.2, bz));
  batch.add(mats.steel, new THREE.CylinderGeometry(0.145, 0.145, 0.03, 18).translate(bx, 0.415, bz));
  batch.add(mats.dark, boxAt(bx - 0.05, bx + 0.05, 0, 0.03, bz - 0.22, bz - 0.12), { castShadow: false });
  // Crutches leaning on the right wall by the fridge (he was on them for the first days).
  for (const dz of [0, 0.09]) {
    const foot = V(2.68, 0, 0.22 + dz);
    const top = V(IN_X - 0.02, 1.02, 0.3 + dz);
    batch.add(mats.alu, rod(foot, top, 0.011, 8));
    batch.add(mats.rubber, rod(foot, foot.clone().lerp(top, 0.04), 0.017, 8));
    const grip = foot.clone().lerp(top, 0.78);
    batch.add(mats.rubber, rod(grip, grip.clone().add(V(-0.12, 0.02, 0)), 0.014, 8));
    const cuff = foot.clone().lerp(top, 0.98);
    batch.add(mats.rubber, new THREE.TorusGeometry(0.045, 0.01, 6, 14, Math.PI * 1.2).rotateY(Math.PI / 2).translate(cuff.x - 0.03, cuff.y, cuff.z));
  }
  // Foam roller between the table and the sofa.
  batch.add(mats.rubber, place(new THREE.CylinderGeometry(0.075, 0.075, 0.45, 18), [0.0, 0.075, -0.4], [0, 0.5, Math.PI / 2]));
}
