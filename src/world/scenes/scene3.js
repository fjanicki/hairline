import * as THREE from 'three';
import * as B from '../build.js';
import { L } from '../../story/script.js';
import { Batcher, boxGeo, place, merge, strut, instance, lampPostGeo, bareTreeGeo, crowdBarrierGeo, coneGeo, stairGeo } from './scene3/kit.js';
import { radialTexture, lanePaintTexture, vergeTexture, windowAtlas, bakeryInteriorTexture, awningTexture, flagTexture } from './scene3/textures.js';
import { windowMaterial, skylineMaterial, coneField, cloudDome, rainSplashes } from './scene3/fx.js';
import { bakeCrowdAtlas, crowdMesh, crowdShadows } from './scene3/crowd.js';

// Ch3 "The Long Run": a straight of urban ring road at dawn (flashback).
// The same straight, re-dressed, is all three training blocks and the marathon (it was a loop).
//
// Layout (metres; the runner goes toward -Z):
//   road        x -7..7 (4 lanes), z +30..-210, PBR wet asphalt + a lane-paint overlay
//   sidewalks   |x| 7.2..11.2 at y 0.14, kerbs at |x| 7.1, cobbled gutters
//   left        concrete retaining wall at x -11.6 (3.2 m) with a palisade on top, brick and render
//               blocks behind it on the upper level, the STRIDE billboard (z -64), a bus shelter
//   right       green steel railing at x 11.05, a muddy verge with bare trees, lower blocks with
//               shuttered shops, the bakery (z -46: the only other light on at this hour)
//   footbridge  concrete deck at y 5.4 on piers at x +-10.6, z -30, stair down the right verge
//   training    a lane closure (concrete barriers, cones, an amber beacon)
//   race        steel crowd barriers with STRIDE banners along both kerbs, a baked impostor crowd
//               (one draw) + 6 real spectators in front, feather flags, km gantries KM 29 / 30 / 31
//               (25 m apart), a drinks table and dropped cups, 6 NPC runners

export const LAYOUT = {
  trainX: 3.6, // right lane, near the kerb: the loop at 5 AM
  trainZ: 6,
  raceX: 0.6,
  raceZ: 7, // 2 m before the KM 29 board, so the watch reads 29.0 at the start
  boards: [5, -20, -45], // KM 29, KM 30, KM 31
  boardEvery: 25,
  endZ: -118, // nobody runs past this (the road goes on into the fog)
};

const ROAD_W = 14;
const ROAD_Z0 = 30;
const ROAD_Z1 = -210;
const ROAD_LEN = ROAD_Z0 - ROAD_Z1;
const ROAD_ZC = (ROAD_Z0 + ROAD_Z1) / 2;
const WALK_Y = 0.14;
const WALL_X = -11.6;
const WALL_H = 3.2;
const BRIDGE_Z = -30;
const BRIDGE_Y = 5.4;
const BAKERY_Z = -46;
const BILLBOARD_Z = -64;
const SHELTER_Z = -12;
// Fine detail is chunked along Z and drawn only within DETAIL_AHEAD metres ahead of the camera.
const CHUNK = 40;
const DETAIL_AHEAD = 95;
const TREES_Z = -125; // no bare trees past this (they are fog by then)
const DRINKS_Z = -8.5;

const STRIDE_GREEN = '#c6f432';
const LAMP_COLD = new THREE.Color('#dfe8ff');
const LAMP_INTENSITY = 36;
const BAKERY_WARM = '#ffb36b';

// TEXT: street dressing (direction sign over the ring road, roadworks).
const TEXT_DIRECTIONS = ['CENTRE', 'STADE  ·  GARE'];
const TEXT_ROADWORKS = 'TRAVAUX';

const RUNNER_KIT = ['#24324f', '#1d6a72', '#3d6fb4', '#a3262f', '#3f6b3c', '#5b3f86']; // no pale / tan / orange tops (they read as skin)
// Offsets from Hugo (x absolute lane, z relative). Nobody sits between Hugo and the camera.
const RUNNER_SLOTS = [
  { x: -2.6, z: -3.5 },
  { x: 2.4, z: -6.5 },
  { x: -1.1, z: -10.5 },
  { x: 3.8, z: 0.8 },
  { x: -3.9, z: 1.6 },
  { x: 1.2, z: -15 },
];
// The crowd's eight archetypes (baked into the impostor atlas): bright race-morning jackets.
const CROWD_TYPES = [
  { variant: 'm', seed: 'crowd-a', tint: '#c94a3f', calm: 'arms_crossed', cheer: 'call_out' },
  { variant: 'f', seed: 'crowd-b', tint: '#e2c25b', calm: 'idle', cheer: 'call_out' },
  { variant: 'm', seed: 'crowd-c', tint: '#3d6fb4', calm: 'phone', cheer: 'agree' },
  { variant: 'f rain', seed: 'crowd-d', tint: '#5e8f5a', calm: 'idle', cheer: 'call_out' },
  { variant: 'm', seed: 'crowd-e', tint: '#d9853b', calm: 'talk', cheer: 'call_out' },
  { variant: 'f', seed: 'crowd-f', tint: '#7b5aa6', calm: 'arms_crossed', cheer: 'agree' },
  { variant: 'm rain', seed: 'crowd-g', tint: '#2f4f8f', calm: 'idle', cheer: 'call_out' },
  { variant: 'f', seed: 'crowd-h', tint: '#e8e4da', calm: 'phone', cheer: 'call_out' },
];
// The real front row: [side, z, tint, clip].
const FRONT_ROW = [
  [1, 1.2, '#c94a3f', 'call_out'],
  [-1, -15.5, '#e2c25b', 'agree'],
  [1, -23.5, '#3d6fb4', 'call_out'],
  [-1, -36, '#d9853b', 'phone'],
  [1, -41.5, '#5e8f5a', 'call_out'],
  [-1, -51.5, '#c46aa0', 'call_out'],
];

/** Instance every mesh of a loaded GLB prop at many transforms, sharing its cached geometry/material. */
function instanceProp(src, items, { cast = true, name = 'prop' } = {}) {
  const g = new THREE.Group();
  g.name = name;
  if (!src || !items.length) return g;
  src.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(src.matrixWorld).invert();
  const M = new THREE.Matrix4();
  const T = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  src.traverse((o) => {
    if (!o.isMesh) return;
    M.multiplyMatrices(inv, o.matrixWorld);
    const im = new THREE.InstancedMesh(o.geometry, o.material, items.length);
    items.forEach((it, i) => {
      e.set(it.rotX || 0, it.rotY || 0, it.rotZ || 0);
      q.setFromEuler(e);
      s.setScalar(it.scale ?? 1);
      T.compose(p.set(it.pos[0], it.pos[1] ?? 0, it.pos[2]), q, s).multiply(M);
      im.setMatrixAt(i, T);
    });
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = cast;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    // The prop cache owns geometry and material; the scene's dispose() frees the instance buffers.
    im.userData.noDispose = true;
    g.add(im);
  });
  return g;
}

/** One sign() look, instanced at many places (one draw). text: a string, or () => string to follow the language. */
function instancedSign(text, w, h, opts, places) {
  const s = B.sign(typeof text === 'function' ? text() : text, w, h, opts);
  if (typeof text === 'function') B.relabel(s, text); // the instances share its texture
  const im = new THREE.InstancedMesh(s.geometry, s.material, places.length);
  const dummy = new THREE.Object3D();
  places.forEach((pl, i) => {
    dummy.position.set(pl.pos[0], pl.pos[1], pl.pos[2]);
    dummy.rotation.set(0, pl.rotY || 0, 0);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  });
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.castShadow = false;
  im.receiveShadow = true;
  return im;
}

// ------------------------------------------------------------------ build

export async function buildScene3(ctx) {
  const T = ctx.L.ch3;
  const { assets, materials } = ctx;
  const look = ctx.look;
  const rnd = B.rng(381);
  const group = new THREE.Group();
  group.name = 'scene3';
  const training = new THREE.Group(); // roadworks clutter (removed for the race)
  training.name = 'training-dressing';
  const race = new THREE.Group();
  race.name = 'race-dressing';
  race.visible = false;
  group.add(training, race);
  const disposers = [];

  // The surfaces this scene uses beyond the chapter's first-pass set (main.js preloads that one).
  await materials?.preload?.(['street_asphalt_wet', 'street_pavement', 'street_cobbles', 'concrete_grimy', 'facade_brick_dark', 'facade_render', 'facade_brick_plaster', 'facade_brick_painted', 'metal_painted_green', 'metal_painted_rusty', 'shutter_rusty'], { timeout: 6000 });

  const S = (name, o) => look.surface(name, o);
  const mPave = S('street.pavement');
  const mKerb = S('street.kerb');
  const mCobble = S('street.cobbles', { scale: 0.8 });
  const mConcrete = S('concrete.grimy');
  const mConcreteUp = S('concrete.grimy', { groundY: WALL_H });
  const mBrickUp = S('facade.brick', { groundY: WALL_H });
  const mRenderUp = S('facade.render', { groundY: WALL_H });
  const mPlasterUp = S('facade.brickPlaster', { groundY: WALL_H });
  const mBrick = S('facade.brick');
  const mRender = S('facade.render');
  const mPainted = S('facade.brickPainted');
  const mShutter = S('shutter.rust');
  const mGreen = S('metal.green');
  const mPost = S('metal.rust', { tint: '#a2a6ab', grime: 0.3 });
  const mDark = new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.55, metalness: 0.6 });
  materials?.weather?.(mDark, { grime: 0.4, wet: 0.4 });
  const mSteel = new THREE.MeshStandardMaterial({ color: '#b4b8bc', roughness: 0.38, metalness: 0.9 });
  materials?.weather?.(mSteel, { grime: 0.35, wet: 0.3 });

  const batch = new Batcher();

  // ---------------------------------------------------------------- props (loaded once)
  const P = (path, opts) => assets.prop(path, opts);
  const [jersey, binMetal, trashBag, crate, dumpster, pallet] = await Promise.all([
    P('props/road_barrier.glb', { width: 1.56 }),
    P('props/bin_metal.glb', { height: 0.9 }),
    P('props/trash_bag.glb', { height: 0.55 }),
    P('props/milk_crate.glb', { height: 0.26 }),
    P('kenney/retro/detail-dumpster-closed.glb', { height: 1.25 }),
    P('kenney/retro/pallet-small.glb', { width: 0.8 }),
  ]);

  // ---------------------------------------------------------------- ground, road, pavements
  group.add(B.ground({ size: [260, 340], pos: [0, -60], y: -0.03, color: '#4a4a46', surface: 'concrete.grimy' }));
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, ROAD_LEN).rotateX(-Math.PI / 2), S('street.asphalt'));
  road.position.set(0, 0, ROAD_ZC);
  road.receiveShadow = true;
  road.name = 'road';
  group.add(road);
  // Lane paint, tracks, cracks and oil as an alpha overlay (so the asphalt stays PBR underneath).
  const paintMat = new THREE.MeshStandardMaterial({ map: lanePaintTexture(rnd, ROAD_W, 28, ROAD_LEN / 28), color: '#d0cec4', roughness: 0.7, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  materials?.weather?.(paintMat, { wet: 0.7, grime: 0.4 });
  const paint = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, ROAD_LEN).rotateX(-Math.PI / 2), paintMat);
  paint.position.set(0, 0.003, ROAD_ZC);
  paint.receiveShadow = true;
  paint.renderOrder = 1;
  paint.name = 'lane-paint';
  group.add(paint);
  // Cobbled gutters, kerbs, pavements.
  for (const side of [-1, 1]) {
    const gut = new THREE.Mesh(new THREE.PlaneGeometry(0.42, ROAD_LEN).rotateX(-Math.PI / 2), mCobble);
    gut.position.set(side * 6.77, 0.004, ROAD_ZC);
    gut.receiveShadow = true;
    group.add(gut);
    batch.box(mKerb, 0.24, 0.165, ROAD_LEN, { pos: [side * 7.1, 0, ROAD_ZC] }, { cast: false });
    batch.box(mPave, 3.98, WALK_Y, ROAD_LEN, { pos: [side * 9.21, 0, ROAD_ZC] }, { cast: false });
  }
  // Gutter drains every ~14 m.
  const drains = [];
  for (let z = ROAD_Z0 - 4; z > -110; z -= 12 + rnd() * 5) for (const side of [-1, 1]) if (rnd() < 0.7) drains.push({ pos: [side * 6.74, 0.006, z], scale: 1 });
  group.add(instance(new THREE.BoxGeometry(0.36, 0.012, 0.62), mDark, drains, { name: 'drains' }));

  // ---------------------------------------------------------------- left: retaining wall, upper level
  const wallTex = B.grimeTexture({ w: 1024, h: 256, base: '#a6a29a', stains: 12, drips: 14, tags: 9, posters: 5, seed: 31, repeat: [ROAD_LEN / 16, 1] });
  {
    // Formwork panel joints and tie holes, every 4 m.
    const c = wallTex.userData.canvas || wallTex.image;
    const g = c.getContext('2d');
    const pxm = c.width / 16;
    for (let x = 0; x < c.width; x += 4 * pxm) {
      g.fillStyle = 'rgba(30,28,24,0.55)';
      g.fillRect(x, 0, 2, c.height);
      g.fillStyle = 'rgba(30,28,24,0.4)';
      for (const fx of [0.25, 0.75]) for (const fy of [0.25, 0.55, 0.85]) g.fillRect(x + fx * 4 * pxm, fy * c.height, 3, 3);
    }
    wallTex.needsUpdate = true;
  }
  const wallMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: wallTex, roughness: 0.92 });
  look.enhance(wallMat, 'concrete.grimy', { albedo: 0.55 });
  const wall = new THREE.Mesh(boxGeo(0.5, WALL_H, ROAD_LEN), wallMat);
  wall.position.set(WALL_X, 0, ROAD_ZC);
  wall.receiveShadow = true;
  wall.castShadow = false;
  wall.name = 'retaining-wall';
  group.add(wall);
  batch.box(mConcreteUp, 0.7, 0.16, ROAD_LEN, { pos: [WALL_X, WALL_H, ROAD_ZC] }, { cast: false });
  // The upper level behind the wall.
  const upper = new THREE.Mesh(new THREE.PlaneGeometry(60, ROAD_LEN + 40).rotateX(-Math.PI / 2), S('street.pavement', { groundY: WALL_H }));
  upper.position.set(WALL_X - 30.25, WALL_H, ROAD_ZC);
  upper.receiveShadow = true;
  group.add(upper);
  // ---------------------------------------------------------------- detail chunks
  // Small detail (sills, pales, posts, windows, roof clutter) is batched per 40 m of street and
  // only drawn within DETAIL_AHEAD of the camera (update()): far away, hundreds of tiny triangles
  // converge on the vanishing point and cost more than the whole near street.
  const chunks = [];
  const chunk = (z) => {
    const k = Math.max(0, Math.floor((ROAD_Z0 + 10 - z) / CHUNK));
    if (!chunks[k]) chunks[k] = { batch: new Batcher(), wins: [], pales: [], posts: [], z1: ROAD_Z0 + 10 - k * CHUNK, z0: ROAD_Z0 + 10 - (k + 1) * CHUNK };
    return chunks[k];
  };
  // Palisade fence on the coping: instanced bars per chunk + two long rails.
  for (let z = ROAD_Z0; z > ROAD_Z1 + 30; z -= 0.16) chunk(z).pales.push({ pos: [WALL_X - 0.12, WALL_H + 0.16, z] });
  for (const y of [0.35, 1.3]) batch.box(mGreen, 0.03, 0.05, ROAD_LEN - 30, { pos: [WALL_X - 0.12, WALL_H + 0.16 + y, ROAD_ZC + 15] }, { cast: false });

  // ---------------------------------------------------------------- facades
  const roofLines = [];
  const facadeMats = [[mBrickUp, mRenderUp, mPlasterUp], [mBrick, mRender, mBrick]];
  const buildRow = (side) => {
    let z = ROAD_Z0 + 6;
    const left = side < 0;
    while (z > ROAD_Z1 - 10) {
      const W = 8 + rnd() * 7;
      const zc = z - W / 2;
      z -= W + (rnd() < 0.3 ? 2.5 + rnd() * 2 : 0.15);
      if (!left && Math.abs(zc - BAKERY_Z) < 9.5) continue; // the bakery block stands here
      if (left && Math.abs(zc - BILLBOARD_Z) < 7.5) continue; // the billboard stands here
      const y0 = left ? WALL_H : 0;
      const H = left ? 13 + rnd() * 13 : 9.6 + rnd() * 9.6;
      const storeys = Math.floor(H / 3.2);
      const Hs = storeys * 3.2 + 0.8;
      const D = 11 + rnd() * 6;
      const face = left ? -16 - rnd() * 2.5 : 16.4 + rnd() * 2;
      const xc = face + side * (D / 2);
      const kind = (rnd() * 3) | 0;
      batch.box(facadeMats[left ? 0 : 1][kind], D, Hs, W, { pos: [xc, y0, zc] }, { cast: Math.abs(zc) < 60 });
      // The cornice carries the roofline at any distance; the rest is chunked detail.
      roofLines.push({ pos: [face - side * 0.15, y0 + Hs - 0.5, zc], size: [0.5, 0.28, W + 0.3] });
      const C = chunk(zc);
      const cb = C.batch;
      const fx = face - side * 0.04; // just proud of the face, toward the road
      for (let s = 1; s < storeys; s++) if (kind !== 1 || s === 1) cb.box(mConcrete, 0.16, 0.12, W, { pos: [face - side * 0.06, y0 + s * 3.2 - 0.05, zc] }, { cast: false });
      // Windows: columns every ~2.6 m.
      const cols = Math.max(2, Math.floor((W - 1.4) / 2.6));
      const span = (cols - 1) * 2.6;
      const firstStorey = left ? 0 : 1; // right side: shops on the ground floor
      for (let s = firstStorey; s < storeys; s++) {
        for (let c = 0; c < cols; c++) {
          const wz = zc - span / 2 + c * 2.6;
          const wy = y0 + s * 3.2 + 1.55;
          const lit = rnd() < 0.13 ? 0.6 + rnd() * 0.8 : 0;
          const v = lit ? ((rnd() * 4) | 0) : rnd() < 0.55 ? 0 : 1 + ((rnd() * 3) | 0);
          C.wins.push({ pos: [fx - side * 0.01, wy, wz], rotY: left ? Math.PI / 2 : -Math.PI / 2, v, lit });
          cb.box(mConcrete, 0.18, 0.08, 1.4, { pos: [fx - side * 0.05, wy - 0.92, wz] }, { cast: false }); // sill
          if (kind === 0) cb.box(mConcrete, 0.1, 0.18, 1.3, { pos: [fx - side * 0.02, wy + 0.86, wz] }, { cast: false }); // lintel
        }
      }
      if (!left) {
        // Ground-floor shops: rusted shutters between pilasters, a dark fascia.
        const nShops = Math.max(1, Math.round(W / 5));
        const sw = W / nShops;
        for (let k = 0; k < nShops; k++) {
          const sz = zc - W / 2 + sw * (k + 0.5);
          cb.box(mShutter, 0.08, 2.5, sw - 0.6, { pos: [fx - side * 0.05, 0, sz] }, { cast: false });
          cb.box(mDark, 0.12, 0.55, sw - 0.3, { pos: [fx - side * 0.07, 2.6, sz] }, { cast: false });
          cb.box(mConcrete, 0.22, 3.2, 0.32, { pos: [fx - side * 0.08, 0, zc - W / 2 + sw * k + 0.16] }, { cast: false });
        }
      }
      // Rooftop clutter: a lift housing, plant boxes, a chimney stack, an aerial.
      const top = y0 + Hs;
      if (rnd() < 0.8) cb.box(mConcrete, 2 + rnd() * 2.5, 1.6 + rnd() * 1.6, 2 + rnd() * 2, { pos: [xc + side * (rnd() - 0.2) * 3, top, zc + (rnd() - 0.5) * W * 0.5] }, { cast: false });
      for (let k = 0; k < 2; k++) if (rnd() < 0.6) cb.box(mConcrete, 0.9 + rnd(), 0.7 + rnd() * 0.6, 0.9 + rnd(), { pos: [face + side * (1.5 + rnd() * 3), top, zc + (rnd() - 0.5) * W * 0.7] }, { cast: false });
      if (rnd() < 0.5) cb.box(mConcrete, 0.6, 1.8 + rnd(), 0.9, { pos: [face + side * (2 + rnd() * 4), top, zc + (rnd() - 0.5) * W * 0.6] }, { cast: false });
      if (rnd() < 0.7) cb.add(mDark, strut([face + side * 2.5, top, zc + (rnd() - 0.5) * 3], [face + side * 2.5, top + 2.5 + rnd() * 2.5, zc], 0.025, 0.012, 4), { cast: false });
    }
  };
  buildRow(-1);
  buildRow(1);
  for (const r of roofLines) batch.box(mConcrete, r.size[0], r.size[1], r.size[2], { pos: r.pos }, { cast: false });
  const winMat = windowMaterial(windowAtlas(rnd)); // the window quads are instanced per chunk at the end
  // Far skyline: fogged masses with a window grid.
  const sky = [];
  for (const side of [-1, 1]) {
    for (let z = 50; z > -260; z -= 10 + rnd() * 9) sky.push({ pos: [side * (40 + rnd() * 30), 0, z], size: [12 + rnd() * 12, 20 + rnd() * 34, 10 + rnd() * 10], color: '#59606a' });
  }
  for (let x = -60; x < 60; x += 12 + rnd() * 8) sky.push({ pos: [x, 0, -250 - rnd() * 30], size: [12 + rnd() * 10, 18 + rnd() * 40, 12], color: '#59606a' });
  sky.push({ pos: [22, 0, -235], size: [14, 78, 14], color: '#59606a' }, { pos: [-30, 0, -280], size: [16, 64, 16], color: '#59606a' }); // two towers in the haze
  const skyMat = skylineMaterial();
  group.add(B.instancedBoxes(sky, skyMat, { castShadow: false, receiveShadow: false }));

  // ---------------------------------------------------------------- right: railing, verge, trees
  const vergeTex = vergeTexture(rnd);
  vergeTex.repeat.set(5 / 4, ROAD_LEN / 4);
  const vergeMat = new THREE.MeshStandardMaterial({ map: vergeTex, roughness: 0.95 });
  materials?.weather?.(vergeMat, { wet: 0.5, grime: 0.5 });
  const verge = new THREE.Mesh(new THREE.PlaneGeometry(5.6, ROAD_LEN).rotateX(-Math.PI / 2), vergeMat);
  verge.position.set(14, 0.02, ROAD_ZC);
  verge.receiveShadow = true;
  group.add(verge);
  // Railing: posts every 2 m, a top rail and a mid rail (gap at the bakery).
  for (let z = ROAD_Z0; z > ROAD_Z1 + 30; z -= 2) if (Math.abs(z - BAKERY_Z) > 5.6) chunk(z).posts.push({ pos: [11.05, WALK_Y, z] });
  for (const [z0, z1] of [[ROAD_Z0, BAKERY_Z + 5.6], [BAKERY_Z - 5.6, ROAD_Z1 + 30]]) {
    for (const y of [0.52, 1.04]) batch.add(mGreen, strut([11.05, WALK_Y + y, z0], [11.05, WALK_Y + y, z1], 0.025, 0.025, 6), { cast: false });
  }
  // Bare trees: two procedural variants, instanced; they cast the long dawn shadows.
  const treeMat = new THREE.MeshStandardMaterial({ color: '#4d463e', roughness: 0.92 });
  materials?.weather?.(treeMat, { wet: 0.4, grime: 0.3 });
  const treeGeos = [bareTreeGeo(B.rng(11), { height: 8, trunk: 0.19 }), bareTreeGeo(B.rng(29), { height: 6.5, trunk: 0.15, levels: 5, spread: 0.7 })];
  const treeItems = [[], []];
  for (let z = ROAD_Z0 - 3; z > TREES_Z; z -= 7 + rnd() * 5) {
    if (Math.abs(z - BAKERY_Z) < 7 || (z < -11 && z > -35)) continue; // bakery, bridge stair
    treeItems[rnd() < 0.5 ? 0 : 1].push({ pos: [12.6 + rnd() * 2, 0, z], rot: [0, rnd() * 6.28, 0], scale: 0.85 + rnd() * 0.35 });
  }
  for (let z = 14; z > TREES_Z; z -= 15 + rnd() * 10) {
    if (Math.abs(z - BILLBOARD_Z) < 6 || Math.abs(z - BRIDGE_Z) < 4) continue;
    treeItems[1].push({ pos: [-13 - rnd() * 1.6, WALL_H, z], rot: [0, rnd() * 6.28, 0], scale: 1 + rnd() * 0.3 });
  }
  treeGeos.forEach((g, k) => group.add(instance(g, treeMat, treeItems[k], { name: `trees-${k}`, cast: true })));

  // ---------------------------------------------------------------- street lamps (+ a light pool)
  const lampDef = lampPostGeo({ height: 7.4, reach: 1.9 });
  const lampItems = [];
  const heads = [];
  let lside = 1;
  for (let z = 18; z > -190; z -= 22) {
    const x = lside * 7.75;
    const rotY = lside > 0 ? Math.PI : 0; // the arm (local +X) reaches over the road
    lampItems.push({ pos: [x, WALK_Y, z], rotY });
    heads.push(new THREE.Vector3(x - lside * lampDef.head[0], WALK_Y + lampDef.head[1], z));
    lside = -lside;
  }
  group.add(instance(lampDef.geo, mPost, lampItems, { name: 'lamp-posts', cast: true }));
  const lensCol = new THREE.Color();
  const lenses = instance(new THREE.BoxGeometry(0.6, 0.03, 0.22), new THREE.MeshBasicMaterial({ color: 0xffffff }), heads.map((h) => ({ pos: [h.x, h.y - 0.075, h.z], color: '#ffffff' })), { name: 'lamp-lenses' });
  lenses.userData.noOcclude = true;
  group.add(lenses);
  const halos = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(heads.flatMap((h) => [h.x, h.y - 0.12, h.z]), 3)),
    new THREE.PointsMaterial({ map: radialTexture(), color: LAMP_COLD, size: 2.6, sizeAttenuation: true, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }),
  );
  halos.renderOrder = 3;
  halos.name = 'lamp-halos';
  group.add(halos);
  const cones = coneField(heads.map((h) => new THREE.Vector3(h.x, h.y - 0.1, h.z)), { length: 7.2, radius: 2.4 });
  group.add(cones.mesh);
  // Four real lights follow the lamps nearest the camera (the rest are emissive + cone only).
  const pool = Array.from({ length: 4 }, () => {
    const l = new THREE.PointLight(LAMP_COLD, 0, 22, 2);
    l.userData.noCone = true;
    l.userData.head = -1;
    group.add(l);
    return l;
  });

  // ---------------------------------------------------------------- the footbridge (z -30)
  let bridgeTubes = null;
  {
    const dz = BRIDGE_Z;
    batch.box(mConcrete, 30, 0.75, 2.8, { pos: [0, BRIDGE_Y - 0.75, dz] }); // deck
    batch.box(mConcrete, 30, 0.32, 0.2, { pos: [0, BRIDGE_Y, dz + 1.3] }); // upstands
    batch.box(mConcrete, 30, 0.32, 0.2, { pos: [0, BRIDGE_Y, dz - 1.3] });
    batch.box(mConcreteUp, 3.2, BRIDGE_Y - 0.75 - WALL_H, 3.0, { pos: [-13.6, WALL_H, dz] }); // left abutment
    for (const x of [-10.6, 10.6]) {
      batch.box(mConcrete, 0.7, BRIDGE_Y - 0.75, 0.7, { pos: [x, 0, dz] });
      batch.box(mConcrete, 1.6, 0.4, 1.2, { pos: [x, BRIDGE_Y - 1.15, dz] }); // bearing shelf
    }
    // Parapet: steel posts, two rails and a mesh band.
    for (const side of [-1, 1]) {
      const zz = dz + side * 1.3;
      for (let x = -14.5; x <= 14.51; x += 1.45) batch.box(mGreen, 0.06, 1.05, 0.06, { pos: [x, BRIDGE_Y + 0.32, zz] }, { cast: false });
      batch.add(mGreen, strut([-15, BRIDGE_Y + 1.37, zz], [15, BRIDGE_Y + 1.37, zz], 0.035, 0.035, 6), { cast: false });
      batch.add(mGreen, strut([-15, BRIDGE_Y + 0.85, zz], [15, BRIDGE_Y + 0.85, zz], 0.02, 0.02, 6), { cast: false });
    }
    // The stair down the right verge (rising toward the deck).
    const stair = stairGeo({ n: 28, rise: (BRIDGE_Y - 0.1) / 28, run: 0.3, w: 1.5 });
    place(stair, { pos: [13.1, 0, dz + 1.3 + 28 * 0.3], rot: [0, 0, 0] });
    batch.add(mConcrete, stair, { cast: true });
    batch.box(mConcrete, 2.2, 0.7, 2.6, { pos: [13.1, BRIDGE_Y - 0.7, dz] }); // landing
    batch.add(mGreen, strut([12.3, 1.0, dz + 9.7], [12.3, BRIDGE_Y + 1.0, dz + 1.3], 0.025, 0.025, 6), { cast: false });
    // Two strip lights under the deck (practicals over the road).
    const tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#e8f0ff').multiplyScalar(3.2) });
    tubeMat.userData.base = 3.2;
    for (const x of [-3.5, 3.5]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.12), tubeMat);
      t.position.set(x, BRIDGE_Y - 0.78, dz);
      t.userData.noOcclude = true;
      group.add(t);
    }
    bridgeTubes = tubeMat;
  }

  // ---------------------------------------------------------------- the bakery (z -46, right)
  const bakery = new THREE.Group();
  bakery.name = 'bakery';
  const BX = 14.6; // shop front plane
  batch.box(mPainted, 5, 10.4, 10, { pos: [BX + 2.5, 0, BAKERY_Z] });
  batch.box(mConcrete, 0.5, 0.28, 10.3, { pos: [BX - 0.1, 10.2, BAKERY_Z] }, { cast: false });
  batch.box(mDark, 0.25, 0.9, 9.6, { pos: [BX - 0.1, 2.75, BAKERY_Z] }, { cast: false }); // fascia
  batch.box(mDark, 0.18, 2.75, 0.3, { pos: [BX - 0.08, 0, BAKERY_Z - 4.6] }, { cast: false });
  batch.box(mDark, 0.18, 2.75, 0.3, { pos: [BX - 0.08, 0, BAKERY_Z + 4.6] }, { cast: false });
  batch.box(mDark, 0.18, 2.75, 0.18, { pos: [BX - 0.08, 0, BAKERY_Z + 1.55] }, { cast: false });
  batch.box(mConcrete, 0.3, 0.6, 6.0, { pos: [BX - 0.12, 0, BAKERY_Z - 1.45] }, { cast: false }); // stall riser
  for (let s = 1; s < 3; s++) {
    for (const wz of [-2.8, 0, 2.8]) {
      const lit = s === 1 && wz === 0 ? 1.4 : 0; // the baker's flat upstairs
      chunk(BAKERY_Z + wz).wins.push({ pos: [BX - 0.05, s * 3.2 + 1.9, BAKERY_Z + wz], rotY: -Math.PI / 2, v: lit ? 0 : 1, lit });
      batch.box(mConcrete, 0.18, 0.08, 1.4, { pos: [BX - 0.08, s * 3.2 + 0.98, BAKERY_Z + wz] }, { cast: false });
    }
  }
  const bakeryWinMat = new THREE.MeshBasicMaterial({ map: bakeryInteriorTexture(rnd), color: new THREE.Color(1.6, 1.45, 1.25) });
  const shopWin = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 2.0), bakeryWinMat);
  shopWin.position.set(BX - 0.02, 1.6, BAKERY_Z - 1.45);
  shopWin.rotation.y = -Math.PI / 2;
  const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.3), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc890').multiplyScalar(1.4) }));
  doorGlow.position.set(BX - 0.02, 1.15, BAKERY_Z + 3.1);
  doorGlow.rotation.y = -Math.PI / 2;
  const bSign = B.sign(L.ch3.signs.bakery, 5.4, 0.62, { bg: null, fg: '#ffe0a8', glow: true, weathered: 0.25, pxPerM: 180, letterSpacing: 8, weight: 600 });
  bSign.material.color.setScalar(2.2);
  bSign.position.set(BX - 0.24, 3.2, BAKERY_Z);
  bSign.rotation.y = -Math.PI / 2;
  const awn = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 1.5), new THREE.MeshStandardMaterial({ map: awningTexture(), roughness: 0.85, side: THREE.DoubleSide }));
  awn.position.set(BX - 0.62, 2.35, BAKERY_Z - 1.45);
  awn.rotation.set(0, -Math.PI / 2, 0);
  awn.rotateX(-0.95);
  awn.castShadow = true;
  const bakeryLight = B.pointLight(BAKERY_WARM, 18, { pos: [BX - 1.2, 1.9, BAKERY_Z - 0.5], distance: 11 });
  bakeryLight.userData.noCone = true;
  const forecourt = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 10.8).rotateX(-Math.PI / 2), mPave);
  forecourt.position.set(12.9, WALK_Y, BAKERY_Z);
  forecourt.receiveShadow = true;
  // A warm spill on the wet pavement in front of the window.
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: radialTexture([[0, 0.55], [0.5, 0.18], [1, 0]]), color: '#ffb36b', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 }));
  spill.position.set(12.4, WALK_Y + 0.01, BAKERY_Z - 1);
  spill.userData.noOcclude = true;
  bakery.add(shopWin, doorGlow, bSign, awn, bakeryLight, forecourt, spill);
  group.add(bakery);
  // Bread crates stacked by the door, a bin.
  group.add(instanceProp(crate, [
    { pos: [13.9, WALK_Y, BAKERY_Z + 4.0], rotY: 0.1 },
    { pos: [13.9, WALK_Y + 0.26, BAKERY_Z + 4.0], rotY: -0.08 },
  ], { name: 'bakery-crates', cast: false }));

  // ---------------------------------------------------------------- the STRIDE billboard (left, upper level)
  const billboard = new THREE.Group();
  billboard.name = 'stride-billboard';
  const bbText = () => `${T.race.banners[0]}\n${T.race.banners[1]}`;
  const bb = B.sign(bbText(), 8, 3, { bg: '#0b0d10', fg: STRIDE_GREEN, glow: true, weathered: 0.45, pxPerM: 128, italic: true, weight: 900 });
  bb.material.color.setScalar(1.25);
  B.relabel(bb, bbText);
  bb.position.set(0, 7.0, 0.16);
  billboard.add(bb);
  const bbb = new Batcher();
  bbb.box(mDark, 8.5, 3.4, 0.22, { pos: [0, 5.3, 0] });
  bbb.box(mDark, 8.6, 0.12, 0.6, { pos: [0, 5.2, 0.3] }); // walkway
  for (const x of [-2.8, 2.8]) bbb.box(mPost, 0.32, 5.3, 0.32, { pos: [x, 0, -0.1] });
  for (const x of [-2.6, 0, 2.6]) {
    bbb.add(mDark, strut([x, 5.3, 0.3], [x, 5.0, 1.3], 0.025, 0.025, 5), { cast: false });
    bbb.box(mDark, 0.4, 0.12, 0.2, { pos: [x, 4.95, 1.35] }, { cast: false });
  }
  bbb.build(billboard, 'billboard');
  billboard.position.set(-15.5, WALL_H, BILLBOARD_Z);
  billboard.rotation.y = Math.PI / 2 - 0.45; // faces the road and the oncoming runner
  group.add(billboard);

  // ---------------------------------------------------------------- bus shelter (left pavement)
  const shelter = new THREE.Group();
  shelter.name = 'bus-shelter';
  {
    // A steel frame, a glazed back and one glazed end, a perch bench, and a backlit ad panel.
    const sb = new Batcher();
    const x0 = -10.95;
    for (const dz of [-2.0, 0, 2.0]) for (const dx of [-0.5, 0.5]) sb.box(mDark, 0.07, 2.45, 0.07, { pos: [x0 + dx, WALK_Y, SHELTER_Z + dz] });
    sb.box(mDark, 1.55, 0.14, 4.3, { pos: [x0, WALK_Y + 2.45, SHELTER_Z] });
    sb.box(mSteel, 1.45, 0.04, 4.2, { pos: [x0, WALK_Y + 2.59, SHELTER_Z] }, { cast: false });
    sb.box(mDark, 0.42, 0.05, 2.6, { pos: [x0 - 0.22, WALK_Y + 0.5, SHELTER_Z + 0.5] }); // perch bench
    for (const dz of [-0.6, 1.6]) sb.box(mDark, 0.05, 0.5, 0.05, { pos: [x0 - 0.3, WALK_Y, SHELTER_Z + dz] }, { cast: false });
    sb.box(mDark, 0.05, 0.05, 4.0, { pos: [x0 - 0.5, WALK_Y + 0.12, SHELTER_Z] }, { cast: false }); // glazing rail
    sb.build(shelter, 'shelter');
    const glass = new THREE.MeshStandardMaterial({ color: '#a8b8c8', roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 2.2), glass);
    back.position.set(x0 - 0.5, WALK_Y + 1.32, SHELTER_Z);
    back.rotation.y = Math.PI / 2;
    const end = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.2), glass);
    end.position.set(x0, WALK_Y + 1.32, SHELTER_Z + 2.0);
    shelter.add(back, end);
    // The lit ad panel at the far end: STRIDE again (the only colour at 5 AM besides the bakery).
    const ad = B.sign(bbText(), 1.15, 1.7, { bg: '#0b0d10', fg: STRIDE_GREEN, glow: true, italic: true, weight: 900, pxPerM: 220 });
    ad.material.color.setScalar(2.8);
    B.relabel(ad, bbText); // adBack shares the material
    ad.position.set(x0 + 0.02, WALK_Y + 1.3, SHELTER_Z - 2.0);
    ad.rotation.y = Math.PI / 2;
    const adBack = ad.clone();
    adBack.position.x = x0 - 0.16;
    adBack.rotation.y = -Math.PI / 2;
    const adBox = new THREE.Mesh(boxGeo(0.16, 2.15, 1.35), mDark);
    adBox.position.set(x0 - 0.07, WALK_Y + 0.2, SHELTER_Z - 2.0);
    shelter.add(ad, adBack, adBox);
    const adLight = B.pointLight('#d8ff9a', 4, { pos: [x0 + 0.9, WALK_Y + 1.3, SHELTER_Z - 2.0], distance: 5.5 });
    adLight.userData.noCone = true;
    shelter.add(adLight);
  }
  group.add(shelter);

  // ---------------------------------------------------------------- overhead direction sign (z -102)
  {
    const zz = -102;
    const gb = new Batcher();
    for (const x of [-8.2, 8.2]) gb.box(mPost, 0.3, 6.8, 0.3, { pos: [x, WALK_Y, zz] });
    gb.box(mPost, 16.8, 0.35, 0.35, { pos: [0, 6.6, zz] });
    gb.build(group, 'gantry');
    TEXT_DIRECTIONS.forEach((t, i) => {
      const s = B.sign(`${t}  ↑`, 4.6, 1.5, { bg: '#1f4f8a', fg: '#f2f2ea', border: '#f2f2ea', pxPerM: 96, weight: 700, weathered: 0.3 });
      s.position.set(i ? 3.2 : -3.2, 5.7, zz + 0.2);
      group.add(s);
    });
  }

  // ---------------------------------------------------------------- street clutter
  group.add(instanceProp(binMetal, [
    { pos: [10.5, WALK_Y, 3], rotY: 0.4 },
    { pos: [-10.8, WALK_Y, -41], rotY: 2.1 },
    { pos: [10.6, WALK_Y, -74], rotY: -0.6 },
  ], { name: 'bins' }));
  group.add(instanceProp(trashBag, [
    { pos: [-10.7, WALK_Y, -38.8], rotY: 0.3 },
    { pos: [-10.3, WALK_Y, -38.4], rotY: 2.2, scale: 0.85 },
    { pos: [-10.9, WALK_Y, -43.4], rotY: 1.1 },
    { pos: [10.4, WALK_Y, 4.0], rotY: 0.6, scale: 0.9 },
  ], { name: 'trash-bags' }));
  dumpster.position.set(-10.6, WALK_Y, -36.5);
  dumpster.rotation.y = Math.PI / 2;
  pallet.position.set(-10.95, WALK_Y + 0.1, -34.2);
  pallet.rotation.set(0, 0.2, 1.25);
  group.add(dumpster, pallet);

  // ---------------------------------------------------------------- training dressing: a lane closure
  training.add(instanceProp(jersey, [
    { pos: [-5.7, 0, -7.0], rotY: Math.PI / 2 + 0.02 },
    { pos: [-5.7, 0, -8.6], rotY: Math.PI / 2 },
    { pos: [-5.72, 0, -10.2], rotY: Math.PI / 2 - 0.03 },
    { pos: [-5.68, 0, -11.8], rotY: Math.PI / 2 + 0.04 },
    { pos: [-5.7, 0, -22.6], rotY: Math.PI / 2 - 0.02 },
  ], { name: 'jersey-barriers' }));
  {
    const cg = coneGeo();
    const conesAt = [];
    for (let i = 0; i < 7; i++) conesAt.push({ pos: [-6.4 + i * 0.12, 0, 0.5 - i * 1.1], rotY: rnd() * 6 });
    for (let i = 0; i < 4; i++) conesAt.push({ pos: [-5.0, 0, -14.6 - i * 1.6], rotY: rnd() * 6 });
    conesAt.push({ pos: [-4.4, 0, -25.5], rot: [Math.PI / 2, 0.6, 0] }); // one knocked over
    const coneMat = new THREE.MeshStandardMaterial({ color: '#e0581f', roughness: 0.55 });
    const bandMat = new THREE.MeshStandardMaterial({ color: '#e8e8e2', roughness: 0.3, metalness: 0.2 });
    materials?.weather?.(coneMat, { grime: 0.5, wet: 0.5 });
    conesAt[conesAt.length - 1].pos[1] = 0.15;
    training.add(instance(cg.body, coneMat, conesAt, { name: 'cones', cast: true }));
    training.add(instance(cg.band, bandMat, conesAt, { name: 'cone-bands' }));
  }
  const works = B.sign(TEXT_ROADWORKS, 0.9, 0.9, { bg: '#f2d64a', fg: '#14161a', border: '#14161a', pxPerM: 160, weight: 900, weathered: 0.35 });
  works.position.set(-4.9, 1.05, 2.4);
  works.rotation.y = 0.15;
  const worksLegs = new THREE.Mesh(merge([strut([-0.3, 0, 0.12], [0, 0.62, 0], 0.012), strut([0.3, 0, 0.12], [0, 0.62, 0], 0.012), strut([0, 0, -0.3], [0, 0.62, 0], 0.012)]), mDark);
  worksLegs.position.set(-4.9, 0, 2.38);
  training.add(works, worksLegs);
  // An amber beacon blinking on the first barrier (a practical: it bloomed in every puddle).
  const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffae2a').multiplyScalar(4) });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.05, 0), beaconMat);
  beacon.position.set(-5.7, 1.11, -7.0);
  const beaconBase = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.05, 12).translate(0, 0.025, 0), mDark);
  beaconBase.position.copy(beacon.position);
  beacon.userData.noOcclude = true;
  const beaconHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: '#ffae2a', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  beaconHalo.scale.set(1.3, 1.3, 1);
  beaconHalo.position.set(-5.7, 1.18, -7.0);
  training.add(beaconBase, beacon, beaconHalo);

  // ---------------------------------------------------------------- race dressing
  // Steel crowd barriers along both kerbs (in the gutter), STRIDE banners zip-tied to them.
  const barrierItems = [];
  const bannerSets = [[], [], []];
  for (const side of [-1, 1]) {
    let k = 0;
    for (let z = ROAD_Z0 - 8; z > LAYOUT.endZ - 6; z -= 2.04) {
      barrierItems.push({ pos: [side * 6.92, 0, z - 1.02], rotY: Math.PI / 2 + (rnd() - 0.5) * 0.02 });
      const pick = (k + (side > 0 ? 1 : 0)) % 5;
      if (pick < 3) bannerSets[pick].push({ pos: [side * 6.86, 0.68, z - 1.02], rotY: side < 0 ? Math.PI / 2 : -Math.PI / 2 });
      k++;
    }
  }
  // Near barriers in full; past z -62 a 4-bar version (it is 70 m+ away from every camera).
  race.add(instance(crowdBarrierGeo(), mSteel, barrierItems.filter((b) => b.pos[2] > -62), { name: 'crowd-barriers', cast: true }));
  race.add(instance(crowdBarrierGeo({ bars: 4 }), mSteel, barrierItems.filter((b) => b.pos[2] <= -62), { name: 'crowd-barriers-far', cast: false }));
  const bopts = { pxPerM: 128, weight: 900, weathered: 0.15 };
  race.add(instancedSign(T.race.banners[0], 1.92, 0.72, { ...bopts, bg: '#0b0d10', fg: STRIDE_GREEN, italic: true }, bannerSets[0]));
  race.add(instancedSign(() => T.race.banners[1], 1.92, 0.72, { ...bopts, bg: STRIDE_GREEN, fg: '#0b0d10' }, bannerSets[1]));
  race.add(instancedSign(() => T.race.banners[2], 1.92, 0.72, { ...bopts, bg: '#f2f2ea', fg: '#0b0d10', italic: true, size: 0.17 }, bannerSets[2]));
  // Feather flags at the back of the pavements (they wave in the shader).
  const flagTex = flagTexture(T.race.banners[0], STRIDE_GREEN);
  const flagU = { uTime: { value: 0 } };
  const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, roughness: 0.8, side: THREE.DoubleSide });
  flagMat.onBeforeCompile = (s) => {
    s.uniforms.uTime = flagU.uTime;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      {
        float ph = 0.0;
        #ifdef USE_INSTANCING
          ph = instanceMatrix[3].z * 0.37 + instanceMatrix[3].x;
        #endif
        float k = clamp(position.x / 0.7, 0.0, 1.0);
        transformed.z += k * (0.12 * sin(uTime * 3.1 + position.y * 1.7 + ph) + 0.05 * sin(uTime * 7.3 + position.x * 9.0));
      }`,
    );
  };
  flagMat.customProgramCacheKey = () => 'ch3-flag';
  const flagPatch = flagMat.onBeforeCompile;
  flagMat.onBeforeCompile = (s) => {
    flagPatch(s);
    // Printed both sides: the back face reads the right way round too.
    s.fragmentShader = s.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
        vec2 fuv = vMapUv;
        if (!gl_FrontFacing) fuv.x = (floor(fuv.x * 2.0) + 1.0 - fract(fuv.x * 2.0)) * 0.5;
        diffuseColor *= texture2D(map, fuv);
      #endif`,
    );
  };
  {
    // A teardrop flag shape: straight hoist on x 0, a rounded top, tapering to the foot.
    const shp = new THREE.Shape();
    shp.moveTo(0, 0);
    shp.lineTo(0, 2.9);
    shp.bezierCurveTo(0.35, 3.2, 0.75, 2.9, 0.72, 2.2);
    shp.lineTo(0.42, 0.2);
    shp.lineTo(0, 0);
    const fg = new THREE.ShapeGeometry(shp, 10);
    const pos = fg.attributes.position;
    const uv = fg.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) / 0.75) * 0.5, pos.getY(i) / 3.2);
    const fg2 = fg.clone();
    for (let i = 0; i < pos.count; i++) fg2.attributes.uv.setX(i, 0.5 + (pos.getX(i) / 0.75) * 0.5);
    fg.translate(0, 0.5, 0);
    fg2.translate(0, 0.5, 0);
    const flagsA = [];
    const flagsB = [];
    const poles = [];
    let k = 0;
    for (let z = 12; z > -104; z -= 11) {
      for (const side of [-1, 1]) {
        const fz = z - (side > 0 ? 5.5 : 0);
        const fx = side * 10.85;
        if (side < 0 && Math.abs(fz - SHELTER_Z) < 3) continue; // the bus shelter
        (k++ % 2 ? flagsB : flagsA).push({ pos: [fx, WALK_Y, fz], rotY: side < 0 ? 0.35 : Math.PI - 0.35 });
        poles.push({ pos: [fx, WALK_Y, fz] });
      }
    }
    race.add(instance(fg, flagMat, flagsA, { name: 'flags-a', cast: true }));
    race.add(instance(fg2, flagMat, flagsB, { name: 'flags-b', cast: true }));
    race.add(instance(merge([new THREE.CylinderGeometry(0.018, 0.022, 3.75, 6).translate(0, 1.875, 0), boxGeo(0.4, 0.05, 0.4)]), mDark, poles, { name: 'flag-poles' }));
  }
  // The overhead banner on the footbridge.
  const overhead = B.sign(T.race.banners[2], 12, 1.15, { bg: STRIDE_GREEN, fg: '#0b0d10', pxPerM: 100, italic: true, weight: 900, weathered: 0.1 });
  overhead.position.set(0, BRIDGE_Y - 0.62, BRIDGE_Z + 1.43);
  B.relabel(overhead, () => T.race.banners[2]); // overheadBack shares the material
  race.add(overhead);
  const overheadBack = overhead.clone();
  overheadBack.position.z = BRIDGE_Z - 1.43;
  overheadBack.rotation.y = Math.PI;
  race.add(overheadBack);
  // KM gantries on the right pavement, and timing mats across the road.
  const kmBoards = LAYOUT.boards.map((z, i) => {
    const s = B.sign(T.race.boards[i], 1.7, 0.95, { bg: '#f2efe6', fg: '#14161a', border: STRIDE_GREEN, pxPerM: 160, weight: 900 });
    s.position.set(8.3, WALK_Y + 2.25, z + 0.04);
    B.relabel(s, () => T.race.boards[i]);
    race.add(s);
    return s;
  });
  const kmb = new Batcher();
  for (const z of LAYOUT.boards) {
    for (const x of [7.38, 9.22]) kmb.box(mDark, 0.08, 2.85, 0.08, { pos: [x, WALK_Y, z] });
    kmb.box(mDark, 1.92, 1.05, 0.04, { pos: [8.3, WALK_Y + 1.73, z - 0.02] }, { cast: true });
  }
  kmb.build(race, 'km-gantries');
  const mats = LAYOUT.boards.map((z) => ({ pos: [0, 0.004, z], scale: 1 }));
  race.add(instance(new THREE.BoxGeometry(13.6, 0.014, 0.9), new THREE.MeshStandardMaterial({ color: '#1c1d20', roughness: 0.75 }), mats, { name: 'timing-mats' }));
  // The drinks table (left, between KM 29 and 30) and the cups dropped after it.
  {
    const tb = new Batcher();
    const clothMat = new THREE.MeshStandardMaterial({ color: '#e6e4dc', roughness: 0.9 });
    tb.box(clothMat, 0.75, 0.06, 3.6, { pos: [-7.75, WALK_Y + 0.74, DRINKS_Z] });
    tb.box(clothMat, 0.02, 0.5, 3.6, { pos: [-7.39, WALK_Y + 0.28, DRINKS_Z] }, { cast: false });
    for (const dz of [-1.6, 1.6]) for (const dx of [-0.3, 0.3]) tb.box(mDark, 0.04, 0.74, 0.04, { pos: [-7.75 + dx, WALK_Y, DRINKS_Z + dz] }, { cast: false });
    tb.build(race, 'drinks-table');
    const cupGeo = new THREE.CylinderGeometry(0.038, 0.028, 0.1, 8, 1, true).translate(0, 0.05, 0);
    const cupMat = new THREE.MeshStandardMaterial({ color: '#f2f0ea', roughness: 0.6, side: THREE.DoubleSide });
    const cups = [];
    for (let i = 0; i < 26; i++) cups.push({ pos: [-7.62 - rnd() * 0.25, WALK_Y + 0.77, DRINKS_Z - 1.6 + rnd() * 3.2], rotY: 0 });
    for (let i = 0; i < 70; i++) {
      const z = DRINKS_Z - 1 - Math.pow(rnd(), 0.7) * 26;
      cups.push({ pos: [-6.4 + rnd() * rnd() * 7, 0.035, z], rot: [Math.PI / 2, rnd() * 6.28, 0], scale: [1, 1, 0.6 + rnd() * 0.4] });
    }
    race.add(instance(cupGeo, cupMat, cups, { name: 'cups', cast: false }));
  }

  // ---------------------------------------------------------------- the crowd
  // Spots along both pavements, denser at the km boards and the bridge.
  const lampZ = lampItems.map((l) => [Math.sign(l.pos[0]), l.pos[2]]);
  const frontReal = FRONT_ROW.map(([side, z]) => [side * 7.62, z]);
  const crowdSpots = [];
  for (const side of [-1, 1]) {
    for (let z = 18; z > -106; z -= 0.56) {
      const near = Math.min(...LAYOUT.boards.map((b) => Math.abs(z - b)), Math.abs(z - BRIDGE_Z), Math.abs(z - DRINKS_Z) + 4);
      const rows = near < 10 ? 4 : near < 24 ? 3 : 2;
      for (let r = 0; r < rows; r++) {
        if (rnd() < 0.14 + r * 0.06) continue;
        const x = side * (7.6 + r * 0.66 + rnd() * 0.22);
        const zz = z + (rnd() - 0.5) * 0.32;
        if (lampZ.some(([s, lz]) => s === side && Math.abs(zz - lz) < 0.6) && Math.abs(x) < 8.4) continue;
        if (side > 0 && LAYOUT.boards.some((b) => Math.abs(zz - b) < 0.6) && Math.abs(x) < 9.6) continue; // gantry
        if (side < 0 && zz < SHELTER_Z + 2.3 && zz > SHELTER_Z - 2.3 && Math.abs(x) > 9.9) continue;
        if (side < 0 && Math.abs(zz - DRINKS_Z) < 2.1 && Math.abs(x) < 8.5) continue; // the table
        if (Math.abs(zz + 102) < 0.6 && Math.abs(x) < 8.8) continue; // direction gantry
        if (frontReal.some(([fx, fz]) => Math.abs(fx - x) < 0.5 && Math.abs(fz - zz) < 0.6)) continue;
        crowdSpots.push({ x, y: WALK_Y, z: zz, row: 0, scale: 0.93 + rnd() * 0.14, flip: rnd() < 0.5, phase: rnd(), excite: r === 0 ? rnd() * 0.75 : rnd(), shade: 0.82 + rnd() * 0.3 });
      }
    }
  }
  let crowd = null;
  const maxTex = ctx.renderer?.capabilities?.maxTextureSize || 4096;
  const nTypes = Math.max(1, Math.min(CROWD_TYPES.length, Math.floor(maxTex / 512)));
  const atlas = bakeCrowdAtlas(ctx, CROWD_TYPES.slice(0, nTypes).map((a, i) => ({ ...a, preset: 'spectator', turn: ((i % 3) - 1) * 0.3 })));
  if (atlas) {
    for (const s of crowdSpots) s.row = Math.floor(rnd() * nTypes);
    atlas.texture.userData.shared = true; // freed with its render target (dispose below)
    crowd = crowdMesh(atlas, crowdSpots);
    crowd.material.color.set('#d4d8de');
    race.add(crowd.mesh);
    disposers.push(() => atlas.dispose());
  } else {
    // No characters: plain standing silhouettes so the barriers are not empty.
    const geo = merge([boxGeo(0.3, 0.84, 0.22), boxGeo(0.44, 0.62, 0.28).translate(0, 0.84, 0), new THREE.SphereGeometry(0.12, 8, 6).translate(0, 1.6, 0)]);
    race.add(instance(geo, new THREE.MeshStandardMaterial({ color: '#7a7f88', roughness: 0.95 }), crowdSpots.map((s) => ({ pos: [s.x, s.y, s.z], rotY: s.x > 0 ? -Math.PI / 2 : Math.PI / 2, scale: s.scale })), { name: 'crowd-fallback' }));
  }
  const blob = B.canvasTexture(64, 64, (c, w, h) => {
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.5, '#888');
    g.addColorStop(1, '#000');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  race.add(crowdShadows(crowdSpots, blob));

  // The real front row (cheering clips), facing the oncoming runners.
  const spectators = FRONT_ROW.map(([side, z, tint, clip], i) => {
    const char = assets.makeCharacter({ preset: 'spectator', tint, seed: `front-${i}`, name: `spectator-${i}` });
    char.root.position.set(side * 7.62, WALK_Y, z);
    char.root.rotation.y = Math.atan2(-side, 0.7);
    const a = char.play(clip, 0);
    if (a) {
      a.time = rnd() * (a.getClip().duration || 1);
      a.timeScale = 0.9 + rnd() * 0.25;
    }
    race.add(char.root);
    return char;
  });

  // Six other runners in race kit. Moved by the chapter's per-frame loop via stepRunners().
  const runners = RUNNER_SLOTS.map((slot, i) => {
    const char = assets.makeCharacter({ preset: 'runner', variant: i % 3 === 1 ? 'long' : undefined, tint: RUNNER_KIT[i], seed: `racer-${i}`, name: `runner-${i}` });
    char.root.rotation.y = Math.PI;
    race.add(char.root);
    return { char, slot, ph: rnd() * Math.PI * 2, x: slot.x, z: 0, v: 4.2, free: false, phased: false };
  });

  // ---------------------------------------------------------------- statics, windows, rain, glow
  batch.build(group, 'scene3');
  // The detail chunks: one group each (batched boxes, window quads, pales, railing posts).
  const paleGeo = boxGeo(0.035, 1.5, 0.05);
  const postGeo = boxGeo(0.06, 1.08, 0.06);
  const detail = chunks.filter(Boolean).map((C, k) => {
    const g = new THREE.Group();
    g.name = `detail-${k}`;
    g.userData.z0 = C.z0;
    g.userData.z1 = C.z1;
    C.batch.build(g, `detail-${k}`);
    if (C.wins.length) {
      const geo = new THREE.PlaneGeometry(1.15, 1.7);
      const aWin = new THREE.InstancedBufferAttribute(new Float32Array(C.wins.length * 3), 3);
      C.wins.forEach((w, i) => aWin.setXYZ(i, w.v, w.lit ? 0 : 1, w.lit));
      geo.setAttribute('aWin', aWin);
      g.add(instance(geo, winMat, C.wins, { name: `windows-${k}` }));
    }
    if (C.pales.length) g.add(instance(paleGeo, mGreen, C.pales, { name: `palisade-${k}` }));
    if (C.posts.length) g.add(instance(postGeo, mGreen, C.posts, { name: `railing-posts-${k}`, cast: true }));
    group.add(g);
    return g;
  });

  const rain = B.rain({ count: 1500, opacity: 0.24, speed: 13, length: 0.55 });
  group.add(rain.object);
  const splashes = rainSplashes();
  group.add(splashes.object);
  // Horizon glow: the low sun / dawn behind the haze at the end of the road.
  const glowMat = new THREE.SpriteMaterial({ map: radialTexture([[0, 1], [0.15, 0.55], [0.45, 0.14], [1, 0]]), color: '#dfeaff', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const sunGlow = new THREE.Sprite(glowMat);
  sunGlow.scale.set(170, 120, 1);
  sunGlow.renderOrder = 1;
  sunGlow.frustumCulled = false;
  sunGlow.userData.sharedGeometry = true; // three's Sprite geometry is global
  sunGlow.userData.noOcclude = true;
  group.add(sunGlow);
  const sunDir = new THREE.Vector3(0.12, 0.12, -1).normalize();
  const clouds = cloudDome(rnd);
  group.add(clouds.mesh);

  // ---------------------------------------------------------------- runtime
  let lampLevel = 0.6;
  let time = 0;
  let block = 0;
  let beaconOn = true;
  const glowCol = new THREE.Color();
  const tmp = new THREE.Vector3();
  const lampFlick = new Float32Array(heads.length).fill(1);
  const FLICKER = 2; // one tube that never quite catches

  const applyLamps = () => {
    heads.forEach((h, i) => {
      const k = lampLevel * lampFlick[i];
      lenses.setColorAt(i, lensCol.copy(LAMP_COLD).multiplyScalar(0.25 + 4.2 * k));
      cones.op.setX(i, k);
    });
    if (lenses.instanceColor) lenses.instanceColor.needsUpdate = true;
    cones.op.needsUpdate = true;
    halos.material.opacity = 0.55 * lampLevel;
    halos.visible = lampLevel > 0.02;
    cones.mesh.visible = lampLevel > 0.02;
    bridgeTubes.color.set('#e8f0ff').multiplyScalar(0.3 + 3 * Math.max(lampLevel, block === 3 ? 0.25 : 0));
  };
  /** The pool: the lamps nearest the camera's view get a real light, faded by distance. */
  const updatePool = () => {
    const cam = ctx.camera.position;
    const fz = cam.z - 12;
    const order = heads.map((h, i) => [Math.abs(h.z - fz) + Math.abs(h.x - cam.x) * 0.2, i]).sort((a, b) => a[0] - b[0]).slice(0, pool.length).map((e) => e[1]);
    const free = pool.filter((l) => !order.includes(l.userData.head));
    for (const i of order) {
      if (pool.some((l) => l.userData.head === i)) continue;
      const l = free.shift();
      if (!l) break;
      l.userData.head = i;
      l.position.copy(heads[i]).y -= 0.35;
    }
    for (const l of pool) {
      const i = l.userData.head;
      if (i < 0) continue;
      const d = tmp.copy(heads[i]).distanceTo(cam);
      const fade = 1 - THREE.MathUtils.smoothstep(d, 30, 46);
      l.intensity = LAMP_INTENSITY * lampLevel * lampFlick[i] * fade;
    }
  };

  // Per-block dressing: [training 0..2, race 3].
  const BLOCKS = [
    { lamps: 0.6, rain: 0.2, splash: 0.25, glow: 0.42, glowCol: '#cfdcf0', lit: 0.8, bakery: 1, crowd: '#d4d8de', cloud: ['#4c6382', '#b9c9df', 0.8] },
    { lamps: 0.85, rain: 0.42, splash: 0.5, glow: 0.22, glowCol: '#b8c8e0', lit: 0.9, bakery: 1, crowd: '#d4d8de', cloud: ['#33455f', '#7d8ea8', 0.95] },
    { lamps: 1.0, rain: 0.3, splash: 0.38, glow: 0.06, glowCol: '#8aa0c8', lit: 1.0, bakery: 1, crowd: '#d4d8de', cloud: ['#18233a', '#34445e', 0.7] },
    { lamps: 0.0, rain: 0.1, splash: 0.12, glow: 0.62, glowCol: '#ffe6c2', lit: 0.0, bakery: 0.5, crowd: '#e2e2e0', cloud: ['#9fb0c4', '#fff4e4', 0.75] },
  ];

  const result = {
    group,
    bounds: [{ minX: -6.8, maxX: 6.8, minZ: LAYOUT.endZ - 4, maxZ: ROAD_Z0 - 2 }],
    spots: { train: [LAYOUT.trainX, LAYOUT.trainZ], race: [LAYOUT.raceX, LAYOUT.raceZ] },
    layout: LAYOUT,
    runners,
    spectators,
    kmBoards,
    rain,
    crowdAtlas: atlas, // debug: __game.world.current.crowdAtlas.target

    /** Re-dress the straight: 0..2 = training weeks 9 / 20 / 31, 3 = the race. */
    setBlock(i) {
      block = Math.max(0, Math.min(3, i));
      const b = BLOCKS[block];
      lampLevel = b.lamps;
      rain.material.uniforms.uOpacity.value = b.rain;
      splashes.uniforms.uOpacity.value = b.splash;
      glowMat.opacity = b.glow;
      glowMat.color.copy(glowCol.set(b.glowCol));
      sunGlow.visible = b.glow > 0.01;
      winMat.userData.uLit.value = b.lit;
      skyMat.userData.uLit.value = b.lit;
      bakeryLight.intensity = 18 * b.bakery;
      bakeryWinMat.color.setRGB(1.6, 1.45, 1.25).multiplyScalar(0.4 + 0.6 * b.bakery);
      race.visible = block === 3;
      training.visible = block !== 3;
      beaconOn = block !== 3;
      if (crowd) crowd.material.color.set(b.crowd);
      clouds.uniforms.uColor.value.set(b.cloud[0]);
      clouds.uniforms.uLit.value.set(b.cloud[1]);
      clouds.uniforms.uOpacity.value = b.cloud[2];
      applyLamps();
    },

    /** Crowd energy 0..1 (how many cheer, and how fast). */
    crowd(excite) {
      if (crowd) crowd.uniforms.uExcite.value = excite;
      const calm = excite < 0.3;
      spectators.forEach((c, i) => {
        const a = c.play(calm ? (i % 2 ? 'idle' : 'arms_crossed') : FRONT_ROW[i][3], 0.8);
        if (a) a.timeScale = calm ? 0.8 : 1;
      });
    },

    /** Place the pack around Hugo at the start of the race. */
    placeRunners(hz) {
      for (const r of runners) {
        r.free = false;
        r.x = r.slot.x;
        r.z = hz + r.slot.z;
        r.char.root.position.set(r.x, 0, r.z);
        r.char.root.visible = true;
      }
    },

    /** Let the pack go on at its own pace (after the crack, they leave him). */
    releaseRunners(v = 4.2) {
      for (const r of runners) {
        r.free = true;
        r.v = v * (0.97 + 0.06 * Math.sin(r.ph));
      }
    },

    /**
     * Same per-frame loop as Hugo: the pack holds a slowly drifting offset from his z
     * (or runs free after releaseRunners). hz = Hugo's z, t = seconds into the race.
     */
    stepRunners(dt, hz, hv, t) {
      for (const r of runners) {
        if (r.free) r.z -= r.v * dt;
        else {
          const want = hz + r.slot.z + 1.4 * Math.sin(t * 0.11 + r.ph);
          r.z += (want - r.z) * (1 - Math.exp(-1.5 * dt));
        }
        r.x = r.slot.x + 0.35 * Math.sin(t * 0.07 + r.ph * 1.7);
        r.char.root.position.set(r.x, 0, r.z);
        r.char.root.visible = r.z > LAYOUT.endZ - 8;
        const v = r.free ? r.v : hv;
        const a = r.char.play(v > 0.3 ? 'run' : 'idle', 0.25);
        if (a) {
          if (!r.phased) {
            a.time = (r.ph / (Math.PI * 2)) * (a.getClip().duration || 1);
            r.phased = true;
          }
          a.timeScale = THREE.MathUtils.clamp(r.char.strideRate('run', v), 0.45, 1.45); // planted feet: cadence from ground speed
        }
      }
    },

    update(dt, raw) {
      time += raw;
      rain.update(dt, ctx.camera);
      splashes.uniforms.uTime.value += dt;
      splashes.uniforms.uCam.value.copy(ctx.camera.position);
      splashes.uniforms.uPx.value = (ctx.renderer?.domElement?.height || 800) * 0.9;
      flagU.uTime.value += dt;
      if (crowd) crowd.uniforms.uTime.value += dt;
      sunGlow.position.copy(ctx.camera.position).addScaledVector(sunDir, 300);
      clouds.mesh.position.copy(ctx.camera.position);
      clouds.uniforms.uDrift.value += raw * 0.0012;
      // The failing tube: mostly on, with dropouts and a stutter.
      if (lampLevel > 0) {
        const n = Math.sin(time * 23.0) * Math.sin(time * 7.3 + 1.1) + Math.sin(time * 1.7);
        lampFlick[FLICKER] = n > 1.25 ? 0.08 : n > 1.0 ? 0.55 : 1;
        applyLamps();
      }
      updatePool();
      const cz = ctx.camera.position.z;
      for (const g of detail) g.visible = g.userData.z1 > cz - DETAIL_AHEAD && g.userData.z0 < cz + 25;
      if (training.visible) {
        const on = beaconOn && time % 1.1 < 0.45;
        beaconMat.color.set('#ffae2a').multiplyScalar(on ? 4 : 0.12);
        beaconHalo.material.opacity = on ? 0.85 : 0;
      }
    },

    dispose() {
      for (const f of disposers) f();
      // Instanced GLB props share the prop cache's geometry/material: free only their buffers.
      group.traverse((o) => o.isInstancedMesh && o.userData.noDispose && o.dispose());
    },
  };
  result.setBlock(0);
  return result;
}
