import * as THREE from 'three';
import * as B from '../../build.js';
import { L } from '../../../story/script.js';
import { IN_X, BACK_Z, WIN, DOORWAY, BENCH, TRESTLE, PEG, SHELF, SIDE, STOOL } from './layout.js';
import { bx, rbox, tube, cable, merged, plain, loadProp } from './geo.js';
import { pegboardTexture, PEG_TOOLS, decalAtlas } from './textures.js';

// Furniture and hero props. The big pieces are procedural (merged per material, world-mapped PBR
// timber and steel); everything the camera gets close to is a Poly Haven scan (CC0, props/*.glb):
// the bench vice, the hung tools, the drill, the toolbox, the stool, Odile's chair, the radio on a
// crate, the steel paint shelf, the pump and oil can, the tape. Repeats (tins, jars, brushes,
// offcuts) are instanced. Every prop load fails soft to a grey box of the right size.

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _e = new THREE.Euler();

/** Clone a prop's materials with a multiplied tint (textures stay shared with the GLB cache). */
function tintProp(obj, color, materials, { grime = 0.3, rough } = {}) {
  const c = new THREE.Color(color);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const swap = (src) => {
      const m = src.clone();
      m.color.multiply(c);
      if (rough !== undefined) m.roughness = rough;
      for (const v of Object.values(m)) if (v?.isTexture) v.userData.shared = true;
      if (materials && grime) materials.weather(m, { grime, desat: 0.08 });
      return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
  return obj;
}

/** The first mesh of a loaded prop and its transform relative to the prop's pivot. */
function meshOf(prop) {
  prop.updateMatrixWorld(true);
  let found = null;
  prop.traverse((o) => {
    if (!found && o.isMesh) found = o;
  });
  if (!found) return null;
  const inv = new THREE.Matrix4().copy(prop.matrixWorld).invert();
  const local = new THREE.Matrix4().multiplyMatrices(inv, found.matrixWorld);
  // The cached GLB geometry / material are shared: never dispose them with the chapter.
  const mats = Array.isArray(found.material) ? found.material : [found.material];
  for (const m of mats) {
    m.userData.shared = true;
    for (const v of Object.values(m)) if (v?.isTexture) v.userData.shared = true;
  }
  return { geometry: found.geometry, material: found.material, local };
}

/** InstancedMesh from a prop's mesh: items [{x, y, z, s, ry}] (prop pivot transforms). */
function instancesOf(prop, items, { castShadow = false, colors, matFn } = {}) {
  const src = meshOf(prop);
  if (!src || !items.length) return null;
  let material = src.material;
  if (matFn) {
    // An owned variant (the GLB textures stay shared with the cache).
    material = src.material.clone();
    for (const v of Object.values(material)) if (v?.isTexture) v.userData.shared = true;
    matFn(material);
  }
  const inst = new THREE.InstancedMesh(src.geometry, material, items.length);
  items.forEach((it, i) => {
    _e.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0);
    _q.setFromEuler(_e);
    _s.setScalar(it.s ?? 1);
    if (it.sy) _s.y *= it.sy;
    _m.compose(_p.set(it.x, it.y, it.z), _q, _s).multiply(src.local);
    inst.setMatrixAt(i, _m);
    if (colors) inst.setColorAt(i, colors[i]);
  });
  inst.userData.sharedGeometry = true;
  inst.castShadow = castShadow;
  inst.receiveShadow = true;
  inst.computeBoundingSphere();
  return inst;
}

export async function dress(ctx, group, surf) {
  const { assets } = ctx;
  const M = ctx.materials;
  const R = B.rng(9);
  const P = (id, opts = {}) => loadProp(assets, id, opts);
  const place = (obj, x, y, z, ry = 0) => {
    obj.position.set(x, y, z);
    obj.rotation.y = ry;
    group.add(obj);
    return obj;
  };

  const [
    vice,
    drill,
    toolbox,
    stool,
    chair,
    crate,
    crate2,
    crate3,
    radio,
    shelf,
    can,
    oilCan,
    pump,
    box1,
    box2,
    box3,
    barrelA,
    barrelB,
    hammer,
    saw,
    pliers,
    driver,
    spanner,
    tapeCase,
  ] = await Promise.all([
    P('bench_vice'),
    P('drill', { castShadow: false }),
    P('toolbox', { height: 0.3 }),
    P('stool', { height: 0.46 }),
    P('chair_painted', { height: 0.94 }),
    P('crate_wood', { height: 0.36 }),
    P('crate_wood', { height: 0.36 }),
    P('crate_wood', { height: 0.36, castShadow: false }),
    P('radio', { height: 0.25, castShadow: false }),
    P('steel_shelves', { height: SHELF.h }),
    P('paint_can'),
    P('oil_can', { height: 0.2, castShadow: false }),
    P('track_pump', { height: 0.6 }),
    P('cardboard_box', { height: 0.34 }),
    P('cardboard_box', { height: 0.3, castShadow: false }),
    P('cardboard_box', { height: 0.42 }),
    P('barrel', { height: 0.9 }),
    P('barrel', { height: 0.88 }),
    P('hammer', { castShadow: false }),
    P('handsaw', { castShadow: false }),
    P('pliers', { castShadow: false }),
    P('screwdriver', { castShadow: false }),
    P('spanner', { castShadow: false }),
    P('tape_measure', { castShadow: false }),
  ]);

  // ------------------------------------------------------------ the main bench (timber, steel corners)
  const top = BENCH.top;
  const benchTop = [bx(BENCH.x0, BENCH.x1, top - 0.075, top, BENCH.z0, BENCH.z1)];
  const benchFrame = [
    bx(BENCH.x0, BENCH.x1, top - 0.16, top - 0.075, BENCH.z1 - 0.035, BENCH.z1), // apron
    bx(BENCH.x0, BENCH.x1, top, top + 0.16, BENCH.z0, BENCH.z0 + 0.024), // splash-back plank
    bx(BENCH.x0 + 0.03, BENCH.x1 - 0.03, 0.12, 0.15, BENCH.z1 - 0.06, BENCH.z1 - 0.03), // stretcher
  ];
  for (const x of [BENCH.x0 + 0.06, BENCH.x1 - 0.06, (BENCH.x0 + BENCH.x1) / 2]) for (const z of [BENCH.z0 + 0.06, BENCH.z1 - 0.07]) benchFrame.push(bx(x - 0.045, x + 0.045, 0, top - 0.075, z - 0.045, z + 0.045));
  const benchPly = [bx(BENCH.x0 + 0.02, BENCH.x1 - 0.02, 0.22, 0.24, BENCH.z0 + 0.02, BENCH.z1 - 0.04)];
  // Two drawers in the apron, with pulls.
  const drawers = [];
  const pulls = [];
  for (const [x0, x1] of [
    [-3.35, -2.75],
    [-2.6, -2.0],
  ]) {
    drawers.push(bx(x0, x1, top - 0.155, top - 0.08, BENCH.z1 - 0.005, BENCH.z1 + 0.012));
    pulls.push(bx((x0 + x1) / 2 - 0.05, (x0 + x1) / 2 + 0.05, top - 0.125, top - 0.11, BENCH.z1 + 0.012, BENCH.z1 + 0.03));
  }

  // ------------------------------------------------------------ the small bench under the window
  const sideTop = [bx(SIDE.x0, SIDE.x1, SIDE.top - 0.05, SIDE.top, SIDE.z0, SIDE.z1)];
  for (const x of [SIDE.x0 + 0.05, SIDE.x1 - 0.05]) for (const z of [SIDE.z0 + 0.05, SIDE.z1 - 0.05]) benchFrame.push(bx(x - 0.035, x + 0.035, 0, SIDE.top - 0.05, z - 0.035, z + 0.035));
  benchPly.push(bx(SIDE.x0 + 0.02, SIDE.x1 - 0.02, 0.18, 0.2, SIDE.z0 + 0.02, SIDE.z1 - 0.02));

  // ------------------------------------------------------------ trestles (two A-frame sawhorses)
  const trestles = [];
  for (const dx of [-0.75, 0.75]) {
    const x = TRESTLE.x + dx;
    trestles.push(bx(x - 0.05, x + 0.05, TRESTLE.top - 0.08, TRESTLE.top, TRESTLE.z - 0.45, TRESTLE.z + 0.45));
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) trestles.push(rbox(0.05, 0.8, 0.05, x + sx * 0.11, 0.36, TRESTLE.z + sz * 0.32, 0, 0, sx * 0.28));
    for (const sz of [-1, 1]) trestles.push(bx(x - 0.2, x + 0.2, 0.3, 0.34, TRESTLE.z + sz * 0.32 - 0.015, TRESTLE.z + sz * 0.32 + 0.015));
  }
  group.add(merged(benchTop.concat(sideTop), surf.benchTop, { name: 'bench-tops' }));
  group.add(merged(benchFrame.concat(trestles, drawers), surf.timber, { name: 'bench-frames' }));
  group.add(merged(benchPly, surf.plywood, { castShadow: false, name: 'bench-shelves' }));
  group.add(merged(pulls, surf.brass, { castShadow: false, name: 'drawer-pulls' }));

  // ------------------------------------------------------------ pegboard over the bench
  const pegTex = pegboardTexture();
  const pegMat = new THREE.MeshStandardMaterial({ map: pegTex.tex, color: '#d4cfc6', roughness: 0.85 });
  ctx.look?.enhance(pegMat, 'workshop.plywood', { albedo: 0.25, normalScale: 0.5, roughnessVar: 0.6 });
  const pz = BACK_Z + 0.03;
  const peg = new THREE.Mesh(new THREE.PlaneGeometry(PEG.w, PEG.h), pegMat);
  peg.position.set(PEG.x, PEG.y, pz);
  peg.receiveShadow = true;
  peg.name = 'pegboard';
  group.add(peg);
  const pegFrame = [
    bx(PEG.x - PEG.w / 2 - 0.03, PEG.x + PEG.w / 2 + 0.03, PEG.y + PEG.h / 2, PEG.y + PEG.h / 2 + 0.04, BACK_Z, pz + 0.008),
    bx(PEG.x - PEG.w / 2 - 0.03, PEG.x + PEG.w / 2 + 0.03, PEG.y - PEG.h / 2 - 0.04, PEG.y - PEG.h / 2, BACK_Z, pz + 0.008),
    bx(PEG.x - PEG.w / 2 - 0.03, PEG.x - PEG.w / 2, PEG.y - PEG.h / 2, PEG.y + PEG.h / 2, BACK_Z, pz + 0.008),
    bx(PEG.x + PEG.w / 2, PEG.x + PEG.w / 2 + 0.03, PEG.y - PEG.h / 2, PEG.y + PEG.h / 2, BACK_Z, pz + 0.008),
  ];
  const at = (u, v) => {
    const [x, y] = pegTex.at(u, v);
    return [PEG.x + x, PEG.y + y];
  };
  // Pegs above every tool, empty outline or not.
  const pegs = [];
  for (const t of PEG_TOOLS) {
    if (t.shape === 'rect' || t.shape === 'watch') continue;
    const [x, y] = at(t.u, t.v - t.size[1] / 2 + 0.01);
    pegs.push(tube([x, y, pz], [x, y + 0.006, pz + 0.05], 0.0035, { seg: 5 }));
  }
  group.add(merged(pegFrame, surf.timberDark, { castShadow: false, name: 'pegboard-frame' }));
  group.add(merged(pegs, surf.chrome, { castShadow: false, name: 'pegs' }));
  // The scanned tools on their outlines.
  const hang = (prop, id, { rx = 0, ry = 0, rz = 0, dz = 0.012, lift = 0 } = {}) => {
    const t = PEG_TOOLS.find((k) => k.id === id);
    const [x, y] = at(t.u, t.v);
    const h = prop.userData.size?.y ?? t.size[1];
    prop.rotation.set(rx, ry, rz);
    prop.position.set(x, rx || rz ? y : y - h / 2 + lift, pz + dz);
    group.add(prop);
    return prop;
  };
  hang(hammer, 'hammer');
  hang(saw, 'saw', { ry: Math.PI / 2, dz: 0.022 });
  hang(pliers, 'pliers', { dz: 0.012 });
  hang(driver, 'driver1', { dz: 0.016 });
  const driver2 = driver.clone();
  hang(driver2, 'driver2', { dz: 0.016 });
  hang(spanner, 'spanner1', { rx: -Math.PI / 2, dz: 0.026 });
  const spanner2 = spanner.clone();
  hang(spanner2, 'spanner2', { rx: -Math.PI / 2, dz: 0.026 });
  const sandpaper = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.17), new THREE.MeshStandardMaterial({ color: '#b49c74', roughness: 1, side: THREE.DoubleSide }));
  {
    const t = PEG_TOOLS.find((k) => k.id === 'sandpaper');
    const [x, y] = at(t.u, t.v);
    sandpaper.position.set(x, y, pz + 0.012);
    sandpaper.rotation.set(-0.05, 0, 0.06);
    sandpaper.name = 'sandpaper';
    group.add(sandpaper);
  }

  // ------------------------------------------------------------ the bench top: vice, drill, a spanner, the board blanks
  place(vice, -0.98, top - 0.086, BENCH.z1 - 0.02, 0);
  tintProp(drill, '#9a9884', M, { grime: 0.2 }); // the lime drill would out-colour the made things
  place(drill, -2.2, top, -2.62, 0.5);
  const benchSpanner = spanner.clone();
  benchSpanner.rotation.set(0, 0, 0);
  place(benchSpanner, -1.32, top + 0.002, -2.34, 1.1);
  place(toolbox, -2.05, 0.24, -2.6, 0.12);
  toolbox.traverse((o) => (o.castShadow = false));
  // Sign blanks leaning on the splash-back (plywood), and an old sign face-down behind them.
  group.add(
    merged(
      [rbox(0.62, 0.42, 0.012, -3.0, top + 0.22, BACK_Z + 0.07, -0.16, 0, 0), rbox(0.5, 0.36, 0.012, -2.84, top + 0.19, BACK_Z + 0.1, -0.2, 0, 0.02)],
      surf.plywood,
      { castShadow: true, name: 'sign-blanks' },
    ),
  );
  // Odile's stool (home position at the left end of the bench).
  place(stool, STOOL.x, 0, STOOL.z, 0.4);

  // ------------------------------------------------------------ the steel paint shelf
  tintProp(shelf, '#8e8a84', M, { grime: 0.5 });
  place(shelf, SHELF.x, 0, SHELF.z, 0);
  const k = SHELF.h / 2.141;
  const decks = [0.11, 0.62, 1.13, 1.63].map((y) => y * k + 0.002);
  const shelfX0 = SHELF.x - 0.47;
  const shelfX1 = SHELF.x + 0.47;

  // ------------------------------------------------------------ paint tins (instanced scan) + paint inside
  const tins = [];
  const tinOn = (x, y, z, s = 1) => tins.push({ x, y, z, s, ry: R() * 6.28, sy: 0.9 + R() * 0.25 });
  for (let d = 0; d < decks.length; d++) {
    let x = shelfX0 + 0.08;
    while (x < shelfX1 - 0.08) {
      if (R() < (d === 0 ? 0.6 : 0.85)) {
        const s = d === 0 ? 1.5 + R() * 0.3 : 0.95 + R() * 0.45;
        tinOn(x, decks[d], SHELF.z + (R() - 0.5) * 0.18, s);
        x += 0.09 * s + 0.05 + R() * 0.04;
      } else x += 0.12;
    }
  }
  for (let i = 0; i < 4; i++) tinOn(SIDE.x0 + 0.12 + i * 0.13, SIDE.top, -2.72 + R() * 0.2, 0.8 + R() * 0.4);
  for (let i = 0; i < 6; i++) tinOn(TRESTLE.x - 0.7 + R() * 1.6, 0, TRESTLE.z + (R() < 0.5 ? -0.62 : 0.5) + R() * 0.1, 1.2 + R() * 0.5);
  for (let i = 0; i < 3; i++) tinOn(-3.4 + i * 0.16, 0.24, -2.55 + R() * 0.1, 1.1 + R() * 0.3);
  tinOn(-1.35, top, -2.78, 1.2);
  tinOn(-3.45, top, -2.45, 1.3);
  tinOn(-1.05, top, -2.62, 0.9);
  // A big bucket of primer and two tins by the stand.
  tinOn(-0.92, 0, -0.42, 2.2);
  tinOn(-1.9, 0, 1.95, 1.4);
  tinOn(3.85, 0, -1.55, 1.6);
  // Rusty, dull tins: the scan is fully metallic, which mirrors the HDRI where GTAO is off (low tier).
  const tinInst = instancesOf(can, tins, {
    castShadow: false,
    matFn: (m) => {
      m.metalness = 0.2;
      m.roughness = 1;
      m.color.set('#cfc6b8');
    },
  });
  if (tinInst) {
    tinInst.name = 'paint-tins';
    group.add(tinInst);
  }
  // The paint inside each tin: a disc just under the rim, one colour per tin (colour hope gives back).
  const paints = ['#a3392b', '#b8893a', '#4a6a8a', '#d9cfb4', '#5f7a4a', '#8d877c', '#c46a3a', '#2f3a4a', '#e0dccf', '#7a4a36', '#3c3a36', '#c9b98e'];
  const discGeo = new THREE.CircleGeometry(0.056, 18).rotateX(-Math.PI / 2).translate(0, 0.138, 0);
  const discs = new THREE.InstancedMesh(discGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.32, metalness: 0 }), tins.length);
  const pc = new THREE.Color();
  tins.forEach((it, i) => {
    _q.setFromEuler(_e.set(0, it.ry, 0));
    _s.set(it.s, it.s * (it.sy ?? 1), it.s);
    _m.compose(_p.set(it.x, it.y, it.z), _q, _s);
    discs.setMatrixAt(i, _m);
    discs.setColorAt(i, pc.set(paints[(R() * paints.length) | 0]).multiplyScalar(0.85));
  });
  discs.name = 'paint';
  discs.receiveShadow = true;
  discs.computeBoundingSphere();
  group.add(discs);

  // ------------------------------------------------------------ jars of brushes (instanced glass + handles)
  const jars = [];
  const jarAt = (x, y, z, s = 1) => jars.push({ x, y, z, s });
  jarAt(-3.32, top, -2.74);
  jarAt(-3.18, top, -2.8, 0.85);
  jarAt(-3.42, top, -2.82, 1.1);
  jarAt(SIDE.x0 + 0.66, SIDE.top, -2.78);
  jarAt(SIDE.x0 + 0.78, SIDE.top, -2.72, 0.8);
  jarAt(WIN.x0 + 0.25, WIN.y0, BACK_Z + 0.05, 0.9);
  jarAt(WIN.x1 - 0.3, WIN.y0, BACK_Z + 0.06, 1.1);
  for (let i = 0; i < 4; i++) jarAt(shelfX0 + 0.12 + i * 0.12, decks[2], SHELF.z + 0.12, 0.9 + R() * 0.2);
  const jarGeo = new THREE.CylinderGeometry(0.042, 0.04, 0.13, 14, 1, true).translate(0, 0.065, 0);
  const jarMat = new THREE.MeshStandardMaterial({ color: '#7c8378', roughness: 0.18, metalness: 0.1, side: THREE.DoubleSide });
  if (M) M.weather(jarMat, { grime: 0.6 });
  const jarInst = new THREE.InstancedMesh(jarGeo, jarMat, jars.length);
  const handles = [];
  jars.forEach((j, i) => {
    _m.compose(_p.set(j.x, j.y, j.z), _q.identity(), _s.setScalar(j.s));
    jarInst.setMatrixAt(i, _m);
    const n = 2 + ((R() * 3) | 0);
    for (let b = 0; b < n; b++) {
      const a = R() * 6.28;
      const lean = 0.12 + R() * 0.2;
      handles.push({ x: j.x + Math.cos(a) * 0.012, y: j.y + 0.02, z: j.z + Math.sin(a) * 0.012, rx: Math.sin(a) * lean, rz: -Math.cos(a) * lean, s: 0.85 + R() * 0.4 });
    }
  });
  jarInst.name = 'jars';
  jarInst.computeBoundingSphere();
  group.add(jarInst);
  // Brush: a handle (painted wood) and a ferrule + bristles (dark), as two instanced meshes.
  const handleGeo = new THREE.CylinderGeometry(0.0045, 0.0065, 0.2, 6).translate(0, 0.1, 0);
  const headGeo = plain(new THREE.CylinderGeometry(0.008, 0.007, 0.05, 6).translate(0, 0.225, 0));
  const hInst = new THREE.InstancedMesh(handleGeo, new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.6 }), handles.length);
  const bInst = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ color: '#5a5048', roughness: 0.8, metalness: 0.3 }), handles.length);
  const hc = ['#8a6a4a', '#a3392b', '#3a4a5a', '#b8893a', '#6a5a4a'];
  handles.forEach((h, i) => {
    _q.setFromEuler(_e.set(h.rx, 0, h.rz));
    _m.compose(_p.set(h.x, h.y, h.z), _q, _s.setScalar(h.s));
    hInst.setMatrixAt(i, _m);
    bInst.setMatrixAt(i, _m);
    hInst.setColorAt(i, pc.set(hc[(R() * hc.length) | 0]));
  });
  for (const m of [hInst, bInst]) {
    m.computeBoundingSphere();
    group.add(m);
  }

  // ------------------------------------------------------------ the small bench: oil can, offcuts, a coffee tin
  place(oilCan, SIDE.x1 - 0.25, SIDE.top, -2.62, -0.6);
  place(box2, SIDE.x0 + 0.3, 0, -2.66, 0.2);

  // ------------------------------------------------------------ timber: leaning planks, a floor stack, offcuts, a pallet
  const planks = [];
  // A low stack of planks on battens along the back wall, between the small bench and the doorway.
  for (const x of [2.5, 2.8]) planks.push(bx(x - 0.03, x + 0.03, 0, 0.05, -2.86, -2.5));
  for (let i = 0; i < 5; i++) planks.push(bx(2.42 + R() * 0.03, 2.88 - R() * 0.04, 0.05 + i * 0.026, 0.05 + i * 0.026 + 0.024, -2.84 + R() * 0.03, -2.56 - R() * 0.04));
  // Offcuts on the floor around the trestles.
  for (let i = 0; i < 9; i++) {
    const a = R() * 6.28;
    const r = 0.6 + R() * 0.7;
    planks.push(rbox(0.12 + R() * 0.25, 0.022, 0.06 + R() * 0.05, TRESTLE.x + Math.cos(a) * r * 1.3, 0.011, TRESTLE.z + Math.sin(a) * r * 0.6, 0, R() * 3, 0));
  }
  // Two pallets stacked flat in the corner right of the doorway.
  for (let p = 0; p < 2; p++) {
    const y0 = p * 0.145;
    for (let i = 0; i < 5; i++) planks.push(bx(3.9, 4.38, y0 + 0.12, y0 + 0.14, -2.86 + i * 0.17, -2.76 + i * 0.17));
    for (const x of [3.93, 4.12, 4.33]) planks.push(bx(x - 0.04, x + 0.04, y0, y0 + 0.12, -2.86, -2.08));
  }
  group.add(merged(planks, surf.timber, { name: 'planks' }));
  // A corrugated sheet and a plywood board leaning on the right wall beside the pallet.
  group.add(merged([rbox(0.02, 1.9, 0.8, IN_X - 0.14, 0.94, -1.5, 0, 0, -0.12)], surf.corrugated, { name: 'corrugated' }));

  // ------------------------------------------------------------ drums by the garage, crates and the pump in the corners
  tintProp(barrelA, '#a59f96', M, { grime: 0.5 });
  tintProp(barrelB, '#9c9890', M, { grime: 0.5 });
  place(barrelA, -4.02, 0, -2.52, 0.4);
  place(barrelB, -3.98, 0, -1.86, 1.9);
  place(crate, -3.98, 0, 2.55, Math.PI / 2 + 0.05);
  place(crate2, -3.95, 0.36, 2.5, Math.PI / 2 - 0.08);
  place(box3, -3.9, 0.72, 2.45, 0.3);
  for (const o of [crate, crate2, box1, box3, pump]) o.traverse((m) => (m.castShadow = false));
  place(pump, -3.85, 0, 1.55, 0.7);
  // Spare wheels hung on the left wall (tyres + rims + spokes: three draws).
  {
    const tiresG = [];
    const rimsG = [];
    const spokes = [];
    for (const [z, y] of [
      [1.55, 2.1],
      [2.3, 2.05],
    ]) {
      const R0 = 0.33;
      const c = new THREE.Vector3(-IN_X + 0.06, y, z);
      tiresG.push(new THREE.TorusGeometry(R0 - 0.013, 0.013, 8, 40).rotateY(Math.PI / 2).translate(c.x, c.y, c.z));
      rimsG.push(new THREE.TorusGeometry(R0 - 0.034, 0.008, 6, 40).rotateY(Math.PI / 2).translate(c.x, c.y, c.z));
      rimsG.push(new THREE.CylinderGeometry(0.016, 0.016, 0.09, 10).rotateZ(Math.PI / 2).translate(c.x, c.y, c.z));
      rimsG.push(tube([-IN_X, y + R0 + 0.02, z], [c.x + 0.03, y + R0 - 0.03, z], 0.005));
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        spokes.push(c.x + (i % 2 ? 0.03 : -0.03), c.y, c.z, c.x, c.y + Math.sin(a) * (R0 - 0.04), c.z + Math.cos(a) * (R0 - 0.04));
      }
    }
    group.add(merged(tiresG, surf.rubber, { castShadow: false, name: 'spare-tyres' }), merged(rimsG, surf.chrome, { castShadow: false, name: 'spare-rims' }));
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(spokes, 3));
    group.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: '#8e9296' })));
  }

  // ------------------------------------------------------------ Odile's corner: chair, crate with the radio, kettle
  place(chair, 3.62, 0, 1.25, -0.95);
  place(crate3, 4.02, 0, 2.0, -Math.PI / 2);
  place(radio, 4.0, 0.355, 1.98, -1.2);
  place(box1, 4.1, 0, 2.66, 0.25);
  const kettle = buildKettle(surf);
  place(kettle, 4.07, 0.42, 2.62, 0.8);
  // Her apron and coat on hooks, a broom against the wall.
  group.add(
    merged(
      [rbox(0.4, 0.75, 0.04, IN_X - 0.04, 1.42, 1.62, 0, Math.PI / 2, 0.04), rbox(0.36, 0.95, 0.06, IN_X - 0.06, 1.36, 2.18, 0, Math.PI / 2, -0.03), rbox(0.2, 0.12, 0.03, IN_X - 0.06, 1.82, 1.62, 0.4, Math.PI / 2, 0)],
      surf.cloth,
      { castShadow: true, name: 'coats' },
    ),
  );
  group.add(merged([tube([0.57, 0.03, -2.62], [0.45, 1.36, BACK_Z + 0.03], 0.012), rbox(0.3, 0.07, 0.05, 0.58, 0.05, -2.64, 0.1, 0, 0)], surf.timberDark, { name: 'broom' }));

  // ------------------------------------------------------------ rags, an extension cable to the trestles
  const rags = [];
  for (const [x, y, z, r] of [
    [-2.4, top, -2.4, 0.3],
    [TRESTLE.x + 0.9, TRESTLE.top - 0.08, TRESTLE.z + 0.36, -0.4],
    [1.9, 0, -1.6, 0.9],
    [-3.0, 0, 0.9, 0.2],
    [SIDE.x0 + 0.5, SIDE.top, -2.5, 0.5],
  ]) {
    rags.push(rbox(0.26, 0.022, 0.2, x, y + 0.011, z, 0.06, r, 0.05), rbox(0.15, 0.03, 0.12, x + 0.05, y + 0.028, z - 0.02, -0.12, r + 0.6, 0.1), rbox(0.1, 0.03, 0.1, x - 0.06, y + 0.024, z + 0.04, 0.1, r - 0.4, -0.1));
  }
  group.add(merged(rags, surf.cloth, { castShadow: false, name: 'rags' }));
  group.add(
    merged(
      [
        cable(
          [
            [-0.75, 0.36, BACK_Z + 0.06],
            [-0.7, 0.05, BACK_Z + 0.12],
            [-0.55, 0.008, -2.2],
            [-0.6, 0.008, -1.5],
            [-0.25, 0.008, -1.0],
            [TRESTLE.x - 0.55, 0.008, -0.62],
            [TRESTLE.x - 0.3, 0.008, -0.5],
            [TRESTLE.x - 0.42, 0.008, -0.38],
          ],
          0.007,
          { seg: 96 },
        ),
      ],
      surf.cord,
      { castShadow: false, name: 'extension-cable' },
    ),
  );

  // ------------------------------------------------------------ wall decals (one atlas, one draw)
  const atlas = decalAtlas();
  const decalGeos = [];
  const decal = (name, w, h, pos, ry = 0, rz = 0) => {
    const [u0, v0, u1, v1] = atlas.items[name];
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, ry, rz)));
    g.translate(...pos);
    decalGeos.push(g);
  };
  const back = BACK_Z + 0.004;
  const right = IN_X - 0.004;
  decal('nosmoking', 0.42, 0.16, [DOORWAY.x0 + 0.42, DOORWAY.h + 0.22, back], 0, 0.01);
  decal('prices', 0.24, 0.33, [-1.42, 1.58, back], 0, -0.03);
  decal('jobsheet', 0.3, 0.22, [-1.05, 1.92, back], 0, 0.05);
  decal('calendar', 0.3, 0.44, [right, 1.62, 0.95], -Math.PI / 2, 0.02);
  decal('photo', 0.24, 0.185, [right, 1.6, 0.42], -Math.PI / 2, -0.04);
  decal('advert', 0.63, 0.45, [-IN_X + 0.004, 2.15, -2.2], Math.PI / 2, 0.02);
  decal('danger', 0.12, 0.084, [-4.07, 1.86, BACK_Z + 0.124], 0, 0);
  const decalMat = new THREE.MeshStandardMaterial({ map: atlas.tex, roughness: 0.9, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const decals = merged(decalGeos, decalMat, { castShadow: false, name: 'decals' });
  decals.userData.noOcclude = true;
  group.add(decals);

  // ------------------------------------------------------------ the tape measure (Day 8 at the frame)
  const tape = new THREE.Group();
  tape.name = 'tape';
  tapeCase.rotation.set(0, Math.PI / 2, 0);
  tapeCase.position.set(DOORWAY.x0 - 0.02, 0.88, BACK_Z + 0.05);
  const blade = new THREE.Mesh(bx(DOORWAY.x0 + 0.02, DOORWAY.x1, 0.925, 0.932, BACK_Z + 0.03, BACK_Z + 0.05), new THREE.MeshStandardMaterial({ color: '#c9a83a', roughness: 0.45, metalness: 0.3 }));
  blade.castShadow = false;
  tape.add(tapeCase, blade);
  tape.visible = false;
  group.add(tape);

  return { sandpaper, stool, tape, toolbox, drill, peg, atLocal: at, tins: tinInst, discs };
}

/** A chipped enamel kettle on a little two-ring hotplate. */
function buildKettle(surf) {
  const g = new THREE.Group();
  const enamel = new THREE.MeshStandardMaterial({ color: '#b8b2a2', roughness: 0.38, metalness: 0.05 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.16, 20).translate(0, 0.1, 0), enamel);
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.18, 0), enamel);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.019, 0.12, 8).rotateZ(-0.9).translate(0.105, 0.13, 0), enamel);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 6, 14, Math.PI).translate(0, 0.21, 0), surf.black);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 18).translate(0, 0.01, 0), surf.steel);
  for (const o of [body, lid, spout, handle, plate]) {
    o.castShadow = o !== plate;
    g.add(o);
  }
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.032, 0.09, 14).translate(0, 0.045, 0), enamel);
  mug.position.set(-0.08, 0, 0.14);
  g.add(mug);
  return g;
}

/** Old signs leaning against the right wall (`sign()` faces on timber backings). */
export function buildOldSigns(group, surf) {
  const oldTexts = L.ch4.signs.old;
  const signStyles = [
    { bg: '#33472f', fg: '#d9c48a', font: 'Georgia, "Times New Roman", serif' },
    { bg: '#5a2a26', fg: '#e8dcc0', font: 'Georgia, "Times New Roman", serif', italic: true },
    { bg: '#d8d0bc', fg: '#2a2622', font: 'Impact, "Arial Narrow", sans-serif' },
  ];
  oldTexts.forEach((text, i) => {
    const sg = new THREE.Group();
    const w = 1.5 - i * 0.18;
    const h = 0.5 - i * 0.04;
    const s = B.sign(text, w, h, { ...signStyles[i % 3], weathered: 0.75, pad: 0.1, border: 'rgba(0,0,0,0.25)' });
    s.material.roughness = 0.75;
    s.position.set(0, h / 2, 0.016);
    s.receiveShadow = true;
    const backing = new THREE.Mesh(bx(-w / 2 - 0.025, w / 2 + 0.025, -0.01, h + 0.025, -0.014, 0.014), surf.timberDark);
    backing.castShadow = true;
    backing.receiveShadow = true;
    sg.add(backing, s);
    sg.rotation.order = 'YXZ';
    sg.rotation.y = -Math.PI / 2 + 0.38;
    sg.rotation.x = -0.16;
    sg.position.set(4.05 - i * 0.07, 0.0, -1.0 + i * 0.18);
    group.add(sg);
  });
}

