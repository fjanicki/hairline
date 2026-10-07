import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as B from '../build.js';
import { L } from '../../story/script.js';

// Ch3 "The Long Run": a 130 m straight of urban ring road at dawn (flashback).
// The same straight, re-dressed, is all three training blocks and the marathon (it was a loop).
//
// Layout (metres; the runner goes toward -Z):
//   road        x -7..7 (4 lanes), z +30..-130, wet asphalt CanvasTexture
//   sidewalks   |x| 7.2..11.2 at y 0.14, kerbs at |x| 7.1
//   left        graffiti retaining wall at x -11.6 (3.2 m), buildings behind it, the STRIDE billboard
//   right       rusted railing at x 11.1, a verge with bare trees, low buildings, the bakery (z -46)
//   footbridge  scaffold towers at x +-9.2, deck at y 5.4, z -30 (the race banner hangs from it)
//   race        orange barriers along both kerbs, a silhouette crowd + 10 Xbot spectators,
//               STRIDE hoardings, km boards KM 29 / 30 / 31 (25 m apart), 6 NPC runners

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
const ROAD_Z1 = -130;
const ROAD_LEN = ROAD_Z0 - ROAD_Z1;
const ROAD_ZC = (ROAD_Z0 + ROAD_Z1) / 2;
const WALK_Y = 0.14;
const BRIDGE_Z = -30;
const BRIDGE_Y = 5.4;
const BAKERY_Z = -46;
const BILLBOARD_Z = -64;

const STRIDE_GREEN = '#c6f432';
const BARRIER = '#ff6a2a';
const LAMP_COLD = new THREE.Color('#dfe8ff');
const LAMP_INTENSITY = 55;
const BAKERY_WARM = '#ffb36b';

const TEXT_BAKERY = L.ch3.signs.bakery;

const CROWD_COLORS = ['#c94a3f', '#e2c25b', '#3d6fb4', '#e8e4da', '#5e8f5a', '#d9853b', '#7b5aa6', '#9aa3ad', '#2f4f8f', '#c46aa0', '#f0f0f0', '#ff6a2a', '#c6f432'];
const SPECTATOR_TINTS = ['#c94a3f', '#3d6fb4', '#e2c25b', '#d9853b', '#7b5aa6', '#e8e4da', '#5e8f5a', '#c46aa0', '#2f4f8f', '#ff6a2a'];
const RUNNER_KIT = ['#e8e4da', '#d9853b', '#3d6fb4', '#c94a3f', '#5e8f5a', '#9aa3ad'];
// Offsets from Hugo (x absolute lane, z relative). Nobody sits between Hugo and the camera.
const RUNNER_SLOTS = [
  { x: -2.6, z: -3.5 },
  { x: 2.4, z: -6.5 },
  { x: -1.1, z: -10.5 },
  { x: 3.8, z: 0.8 },
  { x: -3.9, z: 1.6 },
  { x: 1.2, z: -15 },
];

const rotXZ = (x, z, r) => [x * Math.cos(r) + z * Math.sin(r), -x * Math.sin(r) + z * Math.cos(r)];

// ------------------------------------------------------------------ helpers

/**
 * Instance every mesh of a loaded prop (from assets.prop) at many transforms: one draw per sub-mesh
 * instead of one per copy. items: [{ pos:[x,y,z], rotY, scale: number | [sx,sy,sz], color }].
 * Geometry stays shared with the asset cache (sharedGeometry), materials are cloned (tint multiplies).
 */
function instancify(src, items, { tint, castShadow = false, receiveShadow = true, name = 'inst' } = {}) {
  const g = new THREE.Group();
  g.name = name;
  if (!src || !items.length) return g;
  src.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(src.matrixWorld).invert();
  const tintC = tint !== undefined ? new THREE.Color(tint) : null;
  const anyColor = items.some((it) => it.color !== undefined);
  const M = new THREE.Matrix4();
  const T = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const col = new THREE.Color();
  const cloneMat = (m) => {
    const c = m.clone();
    if (tintC && c.color) c.color.multiply(tintC);
    return c;
  };
  src.traverse((o) => {
    if (!o.isMesh) return;
    M.multiplyMatrices(inv, o.matrixWorld);
    const material = Array.isArray(o.material) ? o.material.map(cloneMat) : cloneMat(o.material);
    const im = new THREE.InstancedMesh(o.geometry, material, items.length);
    items.forEach((it, i) => {
      p.set(it.pos[0], it.pos[1] ?? 0, it.pos[2]);
      e.set(0, it.rotY || 0, 0);
      q.setFromEuler(e);
      const sc = it.scale ?? 1;
      if (Array.isArray(sc)) s.set(sc[0], sc[1], sc[2]);
      else s.setScalar(sc);
      T.compose(p, q, s).multiply(M);
      im.setMatrixAt(i, T);
      if (anyColor) im.setColorAt(i, col.set(it.color ?? '#ffffff'));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = castShadow;
    im.receiveShadow = receiveShadow;
    im.computeBoundingSphere();
    // Shared with the asset cache: never dispose it (a fallback box has its own geometry).
    im.userData.sharedGeometry = !src.userData.isFallback;
    g.add(im);
  });
  return g;
}

function radialTexture() {
  return B.canvasTexture(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.22, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
}

/** Wet ring-road asphalt: one 14 x 28 m tile (repeats along Z). Lane paint, cracks, patches, oil. */
function roadTexture(rnd) {
  const W = 512;
  const H = 1024;
  const pxm = W / ROAD_W; // px per metre across
  const pzm = H / 28; // px per metre along
  return B.canvasTexture(W, H, (c) => {
    B.paintNoise(c, W, H, '#7a7a7c', 0.13);
    const X = (m) => (m + ROAD_W / 2) * pxm;
    // Darker, wetter wheel tracks in each lane.
    for (const lane of [-5.25, -1.75, 1.75, 5.25]) {
      for (const off of [-0.85, 0.85]) {
        const g = c.createLinearGradient(X(lane + off - 0.45), 0, X(lane + off + 0.45), 0);
        g.addColorStop(0, 'rgba(20,22,26,0)');
        g.addColorStop(0.5, 'rgba(20,22,26,0.22)');
        g.addColorStop(1, 'rgba(20,22,26,0)');
        c.fillStyle = g;
        c.fillRect(X(lane + off - 0.45), 0, 0.9 * pxm, H);
      }
    }
    // Patched trench (lighter rectangle) and tar seams.
    c.fillStyle = 'rgba(140,140,138,0.35)';
    c.fillRect(X(-6.4), 140, 4.2 * pxm, 2.6 * pzm);
    c.strokeStyle = 'rgba(15,15,16,0.55)';
    c.lineWidth = 2;
    c.strokeRect(X(-6.4), 140, 4.2 * pxm, 2.6 * pzm);
    // Lane paint (faded): edge lines, dashed lane lines, the double centre line.
    const paint = (alpha) => `rgba(222,220,208,${alpha})`;
    c.fillStyle = paint(0.62);
    for (const ex of [-6.75, 6.75]) c.fillRect(X(ex) - 0.06 * pxm, 0, 0.12 * pxm, H);
    for (const cx of [-0.11, 0.11]) c.fillRect(X(cx) - 0.05 * pxm, 0, 0.1 * pxm, H);
    for (const lx of [-3.5, 3.5]) {
      for (let z = 0; z < 28; z += 7) {
        c.fillStyle = paint(0.45 + rnd() * 0.25);
        c.fillRect(X(lx) - 0.06 * pxm, z * pzm, 0.12 * pxm, 3.5 * pzm);
      }
    }
    // Worn paint: scuff the lines with asphalt-coloured specks.
    for (let i = 0; i < 1400; i++) {
      c.fillStyle = `rgba(110,110,112,${0.3 + rnd() * 0.5})`;
      c.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1 + rnd() * 3);
    }
    // Cracks.
    c.strokeStyle = 'rgba(18,18,20,0.6)';
    for (let i = 0; i < 16; i++) {
      c.lineWidth = 0.8 + rnd() * 1.4;
      c.beginPath();
      let x = rnd() * W;
      let y = rnd() * H;
      c.moveTo(x, y);
      for (let k = 0; k < 7; k++) c.lineTo((x += (rnd() - 0.5) * 40), (y += (rnd() - 0.2) * 34));
      c.stroke();
    }
    // Oil stains and damp blooms.
    for (let i = 0; i < 12; i++) {
      const x = X((rnd() - 0.5) * 12);
      const y = rnd() * H;
      const r = 8 + rnd() * 30;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(12,12,16,${0.3 + rnd() * 0.25})`);
      g.addColorStop(1, 'rgba(12,12,16,0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(x, y, r, r * (0.6 + rnd() * 0.6), rnd() * 3, 0, Math.PI * 2);
      c.fill();
    }
    // A manhole cover in the right lane.
    const mx = X(4.4);
    const my = 640;
    c.fillStyle = 'rgba(40,40,44,0.85)';
    c.beginPath();
    c.arc(mx, my, 0.34 * pxm, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(120,120,124,0.6)';
    c.lineWidth = 2;
    for (let r = 0.12; r < 0.34; r += 0.08) {
      c.beginPath();
      c.arc(mx, my, r * pxm, 0, Math.PI * 2);
      c.stroke();
    }
  }, { repeat: [1, ROAD_LEN / 28] });
}

/** Concrete paving slabs, stained (4 x 4 m tile). */
function paveTexture(rnd) {
  return B.canvasTexture(256, 256, (c, w, h) => {
    B.paintNoise(c, w, h, '#8f8c86', 0.1);
    const slab = w / 6;
    c.strokeStyle = 'rgba(40,38,34,0.5)';
    c.lineWidth = 1.5;
    for (let i = 0; i <= 6; i++) {
      c.beginPath();
      c.moveTo(i * slab, 0);
      c.lineTo(i * slab, h);
      c.moveTo(0, i * slab);
      c.lineTo(w, i * slab);
      c.stroke();
    }
    for (let i = 0; i < 9; i++) {
      // One slab a slightly different shade (replaced, or sunk and wet).
      c.fillStyle = `rgba(${rnd() < 0.5 ? '40,40,38' : '160,156,150'},${0.12 + rnd() * 0.14})`;
      c.fillRect(((rnd() * 6) | 0) * slab, ((rnd() * 6) | 0) * slab, slab, slab);
    }
    for (let i = 0; i < 10; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const r = 4 + rnd() * 22;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(30,28,22,${0.18 + rnd() * 0.2})`);
      g.addColorStop(1, 'rgba(30,28,22,0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Chewing gum.
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `rgba(60,58,54,${0.4 + rnd() * 0.4})`;
      c.beginPath();
      c.arc(rnd() * w, rnd() * h, 0.8 + rnd() * 1.6, 0, Math.PI * 2);
      c.fill();
    }
  }, { repeat: [1, ROAD_LEN / 4] });
}

/** Bakery shop window: warm light behind fogged glass, shelf silhouettes. */
function bakeryWindowTexture() {
  return B.canvasTexture(256, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffd9a0');
    g.addColorStop(1, '#e89a52');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(70,40,18,0.55)';
    for (const y of [0.38, 0.66]) c.fillRect(0, y * h, w, 4);
    for (let i = 0; i < 18; i++) {
      c.beginPath();
      c.ellipse(10 + i * 14, (i % 2 ? 0.36 : 0.64) * h - 6, 6, 4, 0, 0, Math.PI * 2);
      c.fill();
    }
    // Condensation and grime on the glass.
    for (let i = 0; i < 30; i++) {
      c.fillStyle = `rgba(255,240,220,${Math.random() * 0.12})`;
      c.fillRect(Math.random() * w, Math.random() * h, 2, 6 + Math.random() * 20);
    }
    c.strokeStyle = 'rgba(40,30,20,0.9)';
    c.lineWidth = 6;
    c.strokeRect(3, 3, w - 6, h - 6);
    c.beginPath();
    c.moveTo(w / 2, 0);
    c.lineTo(w / 2, h);
    c.stroke();
  });
}

/** Bobbing silhouette crowd (torso + legs + head), one InstancedMesh. */
function buildCrowd(rnd, uniforms) {
  const legs = new THREE.BoxGeometry(0.3, 0.84, 0.22).translate(0, 0.42, 0);
  const torso = new THREE.BoxGeometry(0.44, 0.62, 0.28).translate(0, 1.15, 0);
  const head = new THREE.SphereGeometry(0.12, 8, 6).translate(0, 1.6, 0);
  const geo = mergeGeometries([legs, torso, head]);
  legs.dispose();
  torso.dispose();
  head.dispose();
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uExcite = uniforms.uExcite;
    shader.vertexShader = 'uniform float uTime;\nuniform float uExcite;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
        float ph = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
        float w = sin(uTime * (1.4 + ph * 2.2) + ph * 6.2831);
        transformed.y += (0.012 * w + step(0.55, ph) * uExcite * 0.12 * max(w, 0.0)) * step(0.5, transformed.y);
      #endif`,
    );
  };
  material.customProgramCacheKey = () => 'ch3-roadside-crowd';

  const spots = [];
  for (const side of [-1, 1]) {
    for (let z = 16; z > -104; z -= 0.62) {
      // Denser near the km boards and the footbridge; thin elsewhere.
      const near = Math.min(...LAYOUT.boards.map((b) => Math.abs(z - b)), Math.abs(z - BRIDGE_Z));
      const rows = near < 8 ? 3 : near < 18 ? 2 : 1;
      for (let r = 0; r < rows; r++) {
        if (rnd() < 0.18) continue;
        const x = side * (8.2 + r * 0.8 + rnd() * 0.25);
        if (Math.abs(z - BRIDGE_Z) < 1.4 && Math.abs(x) > 8.0) continue; // scaffold tower
        if (side > 0 && LAYOUT.boards.some((b) => Math.abs(z - b) < 1.3) && r === 0) continue; // km board post
        spots.push([x, z + (rnd() - 0.5) * 0.3]);
      }
    }
  }
  const mesh = new THREE.InstancedMesh(geo, material, spots.length);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  spots.forEach(([x, z], i) => {
    dummy.position.set(x, WALK_Y, z);
    dummy.rotation.set(0, (x > 0 ? -Math.PI / 2 : Math.PI / 2) + (rnd() - 0.5) * 0.9, 0);
    dummy.scale.setScalar(0.9 + rnd() * 0.18);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, col.set(CROWD_COLORS[(rnd() * CROWD_COLORS.length) | 0]).multiplyScalar(0.8 + rnd() * 0.3));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.computeBoundingSphere();
  mesh.name = 'crowd';
  return mesh;
}

/** One sign() look, instanced at many places (one draw). */
function instancedSign(text, w, h, opts, places) {
  const s = B.sign(text, w, h, opts);
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
  im.receiveShadow = false;
  return im;
}

// ------------------------------------------------------------------ build

export async function buildScene3(ctx) {
  const T = ctx.L.ch3;
  const { assets } = ctx;
  const rnd = B.rng(381);
  const group = new THREE.Group();
  group.name = 'scene3';
  const training = new THREE.Group(); // roadworks clutter (removed for the race)
  training.name = 'training-dressing';
  const race = new THREE.Group();
  race.name = 'race-dressing';
  race.visible = false;
  group.add(training, race);

  // ---------------------------------------------------------------- props (loaded once, instanced)
  const P = (path, opts) => assets.prop(path, opts);
  const [
    bA, bB, bC, bD,
    lamp, treeS, treeT, rock, cone, barrier, banner, signpost,
    scafPoles, scafFloor, dumpster, pallet, bottle, trash,
  ] = await Promise.all([
    P('kenney/city/low-detail-building-a.glb', { height: 1, castShadow: false }),
    P('kenney/city/low-detail-building-b.glb', { height: 1, castShadow: false }),
    P('kenney/city/low-detail-building-c.glb', { height: 1, castShadow: false }),
    P('kenney/city/low-detail-building-d.glb', { height: 1, castShadow: false }),
    P('kenney/roads/light-curved.glb', { height: 7.2, center: false }),
    P('kenney/nature/tree_simple_fall.glb', { height: 1 }),
    P('kenney/nature/tree_thin_fall.glb', { height: 1 }),
    P('kenney/nature/rock_largeA.glb', { height: 0.5 }),
    P('kenney/roads/construction-cone.glb', { height: 0.7 }),
    P('kenney/roads/construction-barrier.glb', { height: 1.0 }),
    P('kenney/arena/banner.glb', { height: 2.7 }),
    P('kenney/survival/signpost.glb', { height: 2.0 }),
    P('kenney/retro/scaffolding-poles.glb', { width: 1 }),
    P('kenney/retro/scaffolding-floor.glb', { width: 1 }),
    P('kenney/retro/detail-dumpster-closed.glb', { height: 1.25 }),
    P('kenney/retro/pallet-small.glb', { width: 0.8 }),
    P('kenney/survival/bottle-large.glb', { height: 0.32 }),
    P('kenney/furniture/trashcan.glb', { height: 0.95 }),
  ]);

  // ---------------------------------------------------------------- ground, road, pavements
  group.add(B.ground({ size: [220, 300], pos: [0, -50], y: -0.03, color: '#6f6b62', spread: 0.14, tile: 6 }));
  group.add(
    B.ground({ size: [ROAD_W, ROAD_LEN], pos: [0, ROAD_ZC], map: roadTexture(rnd), color: '#a4a4a6', roughness: 0.48, metalness: 0.18, noise: false }),
  );
  const pave = paveTexture(rnd);
  for (const side of [-1, 1]) {
    group.add(B.ground({ size: [4, ROAD_LEN], pos: [side * 9.2, ROAD_ZC], y: WALK_Y, map: pave, color: '#b4b0a8', roughness: 0.7, metalness: 0.05, noise: false }));
  }
  // Kerbs (the visible step), the gutter, the rusted railing on the right, the low wall on the left.
  const kerbItems = [];
  for (const side of [-1, 1]) kerbItems.push({ pos: [side * 7.1, 0, ROAD_ZC], size: [0.24, 0.165, ROAD_LEN], color: '#a29e96' });
  group.add(B.instancedBoxes(kerbItems, B.mat(0xffffff, { roughness: 0.8 }), { castShadow: false }));

  const railItems = [];
  for (let z = ROAD_Z0; z > ROAD_Z1; z -= 2.2) {
    if (Math.abs(z - BAKERY_Z) < 5.5) continue; // a gap for the bakery
    railItems.push({ pos: [11.05, WALK_Y, z], size: [0.07, 1.05, 0.07], color: rnd() < 0.3 ? '#6e4a34' : '#5b5550' });
  }
  for (const [z0, z1] of [[ROAD_Z0, BAKERY_Z + 5.5], [BAKERY_Z - 5.5, ROAD_Z1]]) {
    const len = z0 - z1;
    for (const y of [0.55, 1.0]) railItems.push({ pos: [11.05, WALK_Y + y, (z0 + z1) / 2], size: [0.05, 0.06, len], color: '#6a4c3a' });
  }
  group.add(B.instancedBoxes(railItems, B.mat(0xffffff, { roughness: 0.6, metalness: 0.35 }), { castShadow: false }));

  const wallTex = B.grimeTexture({ w: 1024, h: 256, base: '#8f8b83', stains: 12, drips: 10, tags: 8, posters: 5, seed: 31, repeat: [ROAD_LEN / 16, 1] });
  const wall = B.box(0.4, 3.2, ROAD_LEN, { pos: [-11.6, 0, ROAD_ZC], color: '#d6d2ca', map: wallTex, roughness: 0.92, castShadow: false });
  wall.name = 'retaining-wall';
  group.add(wall);
  // A coping strip on top of the wall (breaks the silhouette edge).
  group.add(B.box(0.55, 0.12, ROAD_LEN, { pos: [-11.6, 3.2, ROAD_ZC], color: '#7d7a74', castShadow: false }));

  // Puddles on the road and the pavements (dark mirrors; they pick up the lamp highlights).
  const puddleMat = new THREE.MeshStandardMaterial({
    color: '#3b4048',
    roughness: 0.06,
    metalness: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  group.add(B.scatter(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), puddleMat, 46, (i, dm) => {
    const onWalk = i % 4 === 0;
    const side = rnd() < 0.5 ? -1 : 1;
    const x = onWalk ? side * (7.6 + rnd() * 3.2) : side * (5.6 + rnd() * 1.3) * (rnd() < 0.3 ? 0.25 : 1);
    dm.position.set(x, (onWalk ? WALK_Y : 0) + 0.004, ROAD_Z0 - 4 - rnd() * (ROAD_LEN - 10));
    dm.rotation.y = rnd() * Math.PI;
    dm.scale.set(0.5 + rnd() * 1.4, 1, 0.3 + rnd() * 0.8);
  }, { castShadow: false, receiveShadow: true }));

  // Litter: cans, cups, wet newspaper, leaves in the gutters.
  const litterMat = B.mat(0xffffff, { roughness: 0.7, metalness: 0.2 });
  group.add(B.scatter(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 8).rotateZ(Math.PI / 2).translate(0, 0.033, 0), litterMat, 40, (i, dm, c) => {
    const side = rnd() < 0.5 ? -1 : 1;
    const walk = rnd() < 0.5;
    dm.position.set(side * (walk ? 7.4 + rnd() * 3.5 : 6.6 + rnd() * 0.35), walk ? WALK_Y : 0, ROAD_Z0 - rnd() * ROAD_LEN);
    dm.rotation.y = rnd() * Math.PI * 2;
    c.set(['#b23a2e', '#c8c8c0', '#2f5aa0', '#d8b23a', '#8a8a8a'][(rnd() * 5) | 0]);
  }, { castShadow: false }));
  group.add(B.scatter(new THREE.PlaneGeometry(0.36, 0.28).rotateX(-Math.PI / 2), B.mat(0xffffff, { roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 70, (i, dm, c) => {
    const side = rnd() < 0.5 ? -1 : 1;
    const leaf = i > 30;
    const walk = rnd() < 0.55;
    dm.position.set(side * (walk ? 7.3 + rnd() * 3.8 : 6.55 + rnd() * 0.4), (walk ? WALK_Y : 0) + 0.006 + i * 0.00002, ROAD_Z0 - rnd() * ROAD_LEN);
    dm.rotation.set((rnd() - 0.5) * 0.2, rnd() * Math.PI * 2, 0);
    const k = leaf ? 0.3 + rnd() * 0.25 : 0.8 + rnd() * 0.6;
    dm.scale.set(k, 1, k);
    c.set(leaf ? ['#6b4a2a', '#7a5a2e', '#5a4630'][(rnd() * 3) | 0] : ['#c9c3b2', '#b8b2a2', '#d6d0c0'][(rnd() * 3) | 0]);
  }, { castShadow: false, receiveShadow: true }));

  // ---------------------------------------------------------------- buildings and skyline
  const kinds = [bA, bB, bC, bD];
  const rows = [[], [], [], []];
  for (const side of [-1, 1]) {
    let z = ROAD_Z0 - 2;
    while (z > ROAD_Z1 - 20) {
      const k = (rnd() * 4) | 0;
      const src = kinds[k];
      const sz = src.userData.size || new THREE.Vector3(0.25, 1, 0.25);
      const W = 7 + rnd() * 5; // along Z
      const D = 7 + rnd() * 5;
      const H = side < 0 ? 14 + rnd() * 12 : 9 + rnd() * 10;
      const zc = z - W / 2;
      z -= W + 0.4 + rnd() * 2.5;
      if (side > 0 && Math.abs(zc - BAKERY_Z) < 9) continue; // the bakery block stands here
      if (side < 0 && Math.abs(zc - BILLBOARD_Z) < 9) continue; // the billboard stands here
      const near = side < 0 ? 15.4 : 16.2;
      rows[k].push({
        pos: [side * (near + D / 2 + rnd() * 1.5), 0, zc],
        rotY: rnd() < 0.5 ? 0 : Math.PI, // keep the footprint axes (D across, W along the road)
        scale: [D / sz.x, H, W / sz.z],
        color: new THREE.Color('#e0e2e6').multiplyScalar(0.8 + rnd() * 0.25).getStyle(),
      });
    }
  }
  rows.forEach((items, k) => group.add(instancify(kinds[k], items, { tint: 0xa8acb2, name: `buildings-${'abcd'[k]}` })));
  // Far skyline: plain blocks the fog swallows (so the horizon is never a void).
  const sky = [];
  for (const side of [-1, 1]) {
    for (let z = 40; z > -190; z -= 9 + rnd() * 8) sky.push({ pos: [side * (36 + rnd() * 24), 0, z], size: [10 + rnd() * 10, 18 + rnd() * 26, 8 + rnd() * 8], color: '#646c78' });
  }
  for (let x = -40; x < 40; x += 11 + rnd() * 6) sky.push({ pos: [x, 0, -175 - rnd() * 20], size: [10 + rnd() * 8, 14 + rnd() * 24, 10], color: '#5d6572' });
  group.add(B.instancedBoxes(sky, B.mat(0xffffff, { roughness: 1 }), { castShadow: false, receiveShadow: false }));

  // ---------------------------------------------------------------- the bakery (z -46, right)
  const bakery = new THREE.Group();
  bakery.name = 'bakery';
  const bakeryTex = B.grimeTexture({ w: 512, h: 512, base: '#9a9286', stains: 6, drips: 7, tags: 2, posters: 1, seed: 77 });
  bakery.add(B.box(4, 7, 9, { pos: [16.6, 0, BAKERY_Z], color: '#d8d0c4', map: bakeryTex, castShadow: false }));
  const win = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.7), new THREE.MeshBasicMaterial({ map: bakeryWindowTexture(), color: new THREE.Color(1.5, 1.4, 1.25), toneMapped: false }));
  win.position.set(14.58, 1.35, BAKERY_Z - 0.9);
  win.rotation.y = -Math.PI / 2;
  const door = B.box(0.06, 2.1, 1.1, { pos: [14.6, 0, BAKERY_Z + 2.4], color: '#4a3a2c', castShadow: false });
  const bSign = B.sign(TEXT_BAKERY, 4.6, 0.6, { bg: '#2a1f18', fg: '#f3d9a8', glow: true, weathered: 0.4, pxPerM: 160, letterSpacing: 6 });
  bSign.material.color.setScalar(1.3);
  bSign.position.set(14.57, 2.75, BAKERY_Z);
  bSign.rotation.y = -Math.PI / 2;
  const awning = B.box(1.1, 0.08, 6.0, { pos: [14.05, 3.25, BAKERY_Z], color: '#6b3a2c', castShadow: false });
  awning.rotation.z = 0.28;
  const bakeryLight = B.pointLight(BAKERY_WARM, 14, { pos: [13.4, 1.8, BAKERY_Z - 0.6], distance: 10 });
  // A paved forecourt between the pavement and the shop front.
  const forecourt = B.ground({ size: [3.4, 10], pos: [12.9, BAKERY_Z], y: WALK_Y, color: '#8e8a82', spread: 0.12, tile: 2, roughness: 0.75 });
  bakery.add(win, door, bSign, awning, bakeryLight, forecourt);
  group.add(bakery);

  // ---------------------------------------------------------------- the STRIDE billboard (left)
  const billboard = new THREE.Group();
  billboard.name = 'stride-billboard';
  const bbText = `${T.race.banners[0]}\n${T.race.banners[1]}`;
  const bb = B.sign(bbText, 8, 3, { bg: '#0b0d10', fg: STRIDE_GREEN, glow: true, weathered: 0.5, pxPerM: 120, italic: true, weight: 900 });
  bb.material.color.setScalar(1.35);
  bb.position.set(0, 6.1, 0.12);
  billboard.add(bb);
  billboard.add(B.box(8.4, 3.4, 0.2, { pos: [0, 4.4, 0], color: '#3a3c40', castShadow: false }));
  for (const x of [-2.6, 2.6]) billboard.add(B.box(0.25, 4.5, 0.25, { pos: [x, 0, -0.2], color: '#4c4440', metalness: 0.4, castShadow: false }));
  billboard.position.set(-14.5, 0, BILLBOARD_Z);
  billboard.rotation.y = Math.PI / 2 - 0.5; // faces the road and the oncoming runner
  group.add(billboard);

  // ---------------------------------------------------------------- street lamps
  const lampBox = new THREE.Box3().setFromObject(lamp);
  const reach = Math.max(1.2, -lampBox.min.z * 0.88);
  const headY = Math.max(4.5, lampBox.max.y * 0.86);
  const lampItems = [];
  const heads = [];
  let side = 1;
  for (let z = 18; z > ROAD_Z1 + 6; z -= 22) {
    if (Math.abs(z - BRIDGE_Z) < 3) z -= 3;
    const rot = side < 0 ? -Math.PI / 2 : Math.PI / 2; // arm (native -Z) reaches over the road
    const x = side * 7.85;
    lampItems.push({ pos: [x, WALK_Y, z], rotY: rot, color: '#8d9096' });
    const [ox, oz] = rotXZ(0, -reach, rot);
    heads.push(new THREE.Vector3(x + ox, headY + WALK_Y - 0.12, z + oz));
    side = -side;
  }
  group.add(instancify(lamp, lampItems, { name: 'lamps', castShadow: false }));
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const lenses = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.07, 0.28), lensMat, heads.length);
  {
    const dummy = new THREE.Object3D();
    heads.forEach((h, i) => {
      dummy.position.copy(h);
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.updateMatrix();
      lenses.setMatrixAt(i, dummy.matrix);
      lenses.setColorAt(i, LAMP_COLD);
    });
    lenses.instanceMatrix.needsUpdate = true;
    lenses.computeBoundingSphere();
  }
  group.add(lenses);
  const lampLights = heads.map((h) => {
    const l = B.pointLight(LAMP_COLD, LAMP_INTENSITY, { pos: [h.x, h.y - 0.3, h.z], distance: 20 });
    group.add(l);
    return l;
  });
  const FLICKER = 2; // one tube that never quite catches
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.Float32BufferAttribute(heads.flatMap((h) => [h.x, h.y - 0.08, h.z]), 3));
  const halos = new THREE.Points(
    haloGeo,
    new THREE.PointsMaterial({ map: radialTexture(), color: LAMP_COLD, size: 3.2, sizeAttenuation: true, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  halos.renderOrder = 3;
  group.add(halos);

  // ---------------------------------------------------------------- trees, rocks, roadside junk
  const treeItems = [[], []];
  for (let z = ROAD_Z0 - 3; z > ROAD_Z1; z -= 7 + rnd() * 6) {
    if (Math.abs(z - BAKERY_Z) < 7 || Math.abs(z - BRIDGE_Z) < 3) continue;
    const H = 5.5 + rnd() * 2.5;
    treeItems[rnd() < 0.5 ? 0 : 1].push({ pos: [12.3 + rnd() * 1.8, 0, z], rotY: rnd() * Math.PI * 2, scale: H, color: new THREE.Color('#a59a8a').multiplyScalar(0.8 + rnd() * 0.3).getStyle() });
  }
  for (let z = 10; z > ROAD_Z1; z -= 16 + rnd() * 10) {
    if (Math.abs(z - BILLBOARD_Z) < 6) continue;
    treeItems[1].push({ pos: [-12.6 - rnd() * 1.4, 0, z], rotY: rnd() * Math.PI * 2, scale: 6.5 + rnd() * 2, color: '#9a9284' });
  }
  // Bare: tint the autumn foliage to dead grey-brown.
  group.add(instancify(treeS, treeItems[0], { tint: 0x8f8679, name: 'trees-simple', castShadow: true }));
  group.add(instancify(treeT, treeItems[1], { tint: 0x8f8679, name: 'trees-thin', castShadow: true }));
  const rockItems = [];
  for (let i = 0; i < 9; i++) {
    const z = ROAD_Z0 - 6 - rnd() * (ROAD_LEN - 20);
    if (Math.abs(z - BAKERY_Z) < 7 || Math.abs(z - BRIDGE_Z) < 2.5) continue;
    rockItems.push({ pos: [11.7 + rnd() * 3, 0, z], rotY: rnd() * 6, scale: 0.6 + rnd() * 0.8, color: '#9a968e' });
  }
  group.add(instancify(rock, rockItems, { name: 'rocks' }));

  group.add(instancify(dumpster, [
    { pos: [-10.6, WALK_Y, -8], rotY: Math.PI / 2, color: '#56645a' },
    { pos: [-10.6, WALK_Y, -84], rotY: Math.PI / 2, color: '#6a5a4a' },
  ], { name: 'dumpsters', castShadow: true }));
  group.add(instancify(pallet, [
    { pos: [-10.9, WALK_Y, -10.4], rotY: 0.2, color: '#8a7a62' },
    { pos: [-10.9, WALK_Y + 0.24, -10.4], rotY: 0.35, color: '#7f705a' },
    { pos: [-10.7, WALK_Y, -86.5], rotY: -0.3, color: '#7a6c58' },
  ], { name: 'pallets' }));
  group.add(instancify(trash, [
    { pos: [10.4, WALK_Y, 2], rotY: 0.3, color: '#5f6a62' },
    { pos: [-10.6, WALK_Y, -40], rotY: 1.1, color: '#6a6a66' },
    { pos: [10.4, WALK_Y, -70], rotY: 2.0, color: '#5f6a62' },
  ], { name: 'bins', castShadow: true }));
  const bottles = [];
  for (let i = 0; i < 10; i++) bottles.push({ pos: [-11.15 + rnd() * 0.3, WALK_Y, -6 - rnd() * 90], rotY: rnd() * 6, color: ['#3f6a3a', '#6a4a2a', '#9aa6a0'][(rnd() * 3) | 0] });
  group.add(instancify(bottle, bottles, { name: 'bottles' }));

  // ---------------------------------------------------------------- the footbridge (z -30)
  const scafItems = [];
  for (const sx of [-9.2, 9.2]) {
    for (let k = 0; k < 4; k++) scafItems.push({ pos: [sx, WALK_Y + k * 1.32, BRIDGE_Z], scale: [2.0, 1.32, 2.2], color: '#9aa0a6' });
  }
  group.add(instancify(scafPoles, scafItems, { name: 'bridge-towers', castShadow: true }));
  const deckItems = [];
  for (let x = -10.2; x <= 10.21; x += 2.04) deckItems.push({ pos: [x, BRIDGE_Y, BRIDGE_Z], scale: [2.04, 1.4, 2.2], color: '#a4a8ac' });
  group.add(instancify(scafFloor, deckItems, { name: 'bridge-deck', castShadow: true }));
  const fasciaTex = B.grimeTexture({ w: 1024, h: 64, base: '#8d8a84', stains: 6, drips: 8, tags: 6, posters: 0, seed: 12, repeat: [1, 1] });
  for (const dz of [1.12, -1.12]) {
    group.add(B.box(21.4, 0.5, 0.08, { pos: [0, BRIDGE_Y - 0.48, BRIDGE_Z + dz], color: '#d0ccc4', map: fasciaTex, castShadow: false }));
  }
  const bridgeRail = [];
  for (const dz of [1.05, -1.05]) {
    bridgeRail.push({ pos: [0, BRIDGE_Y + 1.0, BRIDGE_Z + dz], size: [21.2, 0.06, 0.06], color: '#6a6e72' });
    for (let x = -10.4; x <= 10.4; x += 1.3) bridgeRail.push({ pos: [x, BRIDGE_Y + 0.05, BRIDGE_Z + dz], size: [0.05, 0.98, 0.05], color: '#6a6e72' });
  }
  group.add(B.instancedBoxes(bridgeRail, B.mat(0xffffff, { roughness: 0.55, metalness: 0.4 }), { castShadow: false }));

  // ---------------------------------------------------------------- training dressing: roadworks
  const coneItems = [];
  for (let i = 0; i < 9; i++) coneItems.push({ pos: [-6.2 + (i % 3) * 0.08, 0, -8 - i * 1.6], rotY: rnd() * 6, color: '#e06a36' });
  coneItems.push({ pos: [-5.6, 0, -24], rotY: 0.4, color: '#e06a36' });
  coneItems.push({ pos: [6.3, 0, -92], rotY: 1.2, color: '#e06a36' });
  training.add(instancify(cone, coneItems, { name: 'cones' }));
  training.add(instancify(barrier, [
    { pos: [-6.3, 0, -6.6], rotY: Math.PI / 2, color: '#d06030' },
    { pos: [-6.3, 0, -23.5], rotY: Math.PI / 2, color: '#d06030' },
  ], { name: 'roadworks', castShadow: true }));

  // ---------------------------------------------------------------- race dressing
  const barrierItems = [];
  for (const sx of [-6.45, 6.45]) {
    for (let z = ROAD_Z0 - 8; z > LAYOUT.endZ; z -= 1.78) barrierItems.push({ pos: [sx, 0, z], rotY: 0, color: BARRIER });
  }
  race.add(instancify(barrier, barrierItems, { name: 'race-barriers', castShadow: false }));
  // Hoardings zip-tied to the barriers: "STRIDE" / "NEVER STOP", facing the runners.
  const hoardA = [];
  const hoardB = [];
  let flip = false;
  for (let z = 2; z > -100; z -= 9) {
    for (const sx of [-1, 1]) {
      const pl = { pos: [sx * 5.86, 0.62, z + (sx > 0 ? 4.5 : 0)], rotY: sx < 0 ? Math.PI / 2 : -Math.PI / 2 };
      (flip ? hoardB : hoardA).push(pl);
    }
    flip = !flip;
  }
  race.add(instancedSign(T.race.banners[0], 1.6, 0.5, { bg: '#0b0d10', fg: STRIDE_GREEN, pxPerM: 128, italic: true, weight: 900, doubleSide: false }, hoardA));
  race.add(instancedSign(T.race.banners[1], 1.6, 0.5, { bg: STRIDE_GREEN, fg: '#0b0d10', pxPerM: 128, weight: 900 }, hoardB));
  // Flag banners on the far pavement edge.
  const bannerItems = [];
  for (let z = 12; z > -104; z -= 13) for (const sx of [-1, 1]) bannerItems.push({ pos: [sx * 10.7, WALK_Y, z - (sx > 0 ? 6 : 0)], rotY: sx < 0 ? Math.PI / 2 : -Math.PI / 2, color: (z | 0) % 2 ? STRIDE_GREEN : '#f2f2ea' });
  race.add(instancify(banner, bannerItems, { name: 'flag-banners' }));
  // The overhead banner on the footbridge.
  const overhead = B.sign(T.race.banners[2], 11, 1.1, { bg: STRIDE_GREEN, fg: '#0b0d10', pxPerM: 96, italic: true, weight: 900 });
  overhead.position.set(0, BRIDGE_Y - 0.6, BRIDGE_Z + 1.2);
  race.add(overhead);
  // KM boards (signpost + board) on the right pavement.
  race.add(instancify(signpost, LAYOUT.boards.map((z) => ({ pos: [7.7, WALK_Y, z], color: '#8a7a64' })), { name: 'km-posts', castShadow: true }));
  const kmBoards = LAYOUT.boards.map((z, i) => {
    const s = B.sign(T.race.boards[i], 1.7, 1.0, { bg: '#f2efe6', fg: '#14161a', border: STRIDE_GREEN, pxPerM: 160, weight: 900 });
    s.position.set(7.7, WALK_Y + 1.75, z + 0.16);
    race.add(s);
    return s;
  });

  const crowdU = { uTime: { value: 0 }, uExcite: { value: 0.4 } };
  race.add(buildCrowd(rnd, crowdU));

  // Ten real spectators in the front row (Xbot clones, bright tints), facing the oncoming runners.
  const spectZ = [2, -6, -14, -19, -26, -36, -41, -47, -52, -60];
  const spectators = spectZ.map((z, i) => {
    const sx = i % 2 ? -1 : 1;
    const char = assets.makeCharacter({ tint: SPECTATOR_TINTS[i], scale: 0.92 + rnd() * 0.14, name: `spectator-${i}` });
    char.root.position.set(sx * (7.45 + rnd() * 0.2), WALK_Y, z);
    char.root.rotation.y = Math.atan2(-sx, 0.55 + rnd() * 0.3);
    const a = char.play('idle', 0);
    if (a) a.time = rnd() * (a.getClip().duration || 1);
    race.add(char.root);
    return char;
  });

  // Six other runners in race kit. Moved by the chapter's per-frame loop via stepRunners().
  const runners = RUNNER_SLOTS.map((slot, i) => {
    const char = assets.makeCharacter({ tint: RUNNER_KIT[i], scale: 0.95 + rnd() * 0.1, name: `runner-${i}` });
    char.root.rotation.y = Math.PI;
    race.add(char.root);
    return { char, slot, ph: rnd() * Math.PI * 2, x: slot.x, z: 0, v: 4.2, free: false, phased: false };
  });

  // ---------------------------------------------------------------- rain, sun glow
  const rain = B.rain({ count: 1800, opacity: 0.22, speed: 13 });
  group.add(rain.object);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: '#dfeaff', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sunGlow.scale.set(150, 150, 1);
  sunGlow.renderOrder = 1;
  sunGlow.frustumCulled = false;
  sunGlow.userData.sharedGeometry = true; // three's Sprite geometry is global
  group.add(sunGlow);
  const sunDir = new THREE.Vector3(0.12, 0.22, -1).normalize();

  // ---------------------------------------------------------------- runtime
  let lampLevel = 0.6;
  let time = 0;
  const lensCol = new THREE.Color();

  const applyLamps = (flick = 1) => {
    lampLights.forEach((l, i) => (l.intensity = LAMP_INTENSITY * lampLevel * (i === FLICKER ? flick : 1)));
    heads.forEach((h, i) => {
      const k = 0.35 + 3.4 * lampLevel * (i === FLICKER ? flick : 1);
      lenses.setColorAt(i, lensCol.copy(LAMP_COLD).multiplyScalar(k));
    });
    if (lenses.instanceColor) lenses.instanceColor.needsUpdate = true;
    halos.material.opacity = 0.65 * lampLevel;
  };
  applyLamps();

  // Per-block dressing: [training 0..2, race 3].
  const BLOCKS = [
    { lamps: 0.55, rain: 0.2, sun: 0.5 },
    { lamps: 0.8, rain: 0.42, sun: 0.22 },
    { lamps: 1.0, rain: 0.3, sun: 0.0 },
    { lamps: 0.0, rain: 0.13, sun: 0.75 },
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

    /** Re-dress the straight: 0..2 = training weeks 9 / 20 / 31, 3 = the race. */
    setBlock(i) {
      const b = BLOCKS[Math.max(0, Math.min(3, i))];
      lampLevel = b.lamps;
      rain.opacity = b.rain;
      sunGlow.material.opacity = b.sun;
      sunGlow.visible = b.sun > 0.01;
      race.visible = i === 3;
      training.visible = i !== 3;
      applyLamps();
    },

    /** Crowd energy 0..1 (silhouette bob). */
    crowd(excite) {
      crowdU.uExcite.value = excite;
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
          a.timeScale = THREE.MathUtils.clamp(v / 4.2, 0.6, 1.3) * (0.96 + 0.08 * Math.sin(r.ph));
        }
      }
    },

    update(dt, raw) {
      time += raw;
      rain.update(dt, ctx.camera);
      crowdU.uTime.value += dt;
      sunGlow.position.copy(ctx.camera.position).addScaledVector(sunDir, 300);
      // The failing tube: mostly on, with dropouts and a stutter.
      if (lampLevel > 0) {
        const n = Math.sin(time * 23.0) * Math.sin(time * 7.3 + 1.1) + Math.sin(time * 1.7);
        const flick = n > 1.25 ? 0.08 : n > 1.0 ? 0.55 : 1;
        applyLamps(flick);
      }
    },
  };
  result.setBlock(0);
  return result;
}
