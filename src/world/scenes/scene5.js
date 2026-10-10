import * as THREE from 'three';
import * as B from '../build.js';
import { buildScene2 } from './scene2.js';
import { finishStreet } from './scene5/street.js';
import { dressWallside } from './scene5/wallside.js';
import { buildWorkshop } from './scene5/workshop.js';
import { makeCast, makeRider } from './scene5/cast.js';
import { makeMotes } from './scene5/fx.js';
import { makeHugoPanel } from './scene5/hugoPanel.js';
import { paintNo14 } from './scene5/no14paint.js';
import { buildJobs } from './scene5/jobs.js';
import { layoutMural, openShop, makeR4Cast } from './scene5/r4wall.js';
import { mem } from '../../story/memory.js';

// Ch5 "The Wall": Rue des Tanneurs by day (Week 12), then golden hour.
//
// A thin wrapper over the Ch2 street (DESIGN.md STREET CONTRACT): buildScene2(ctx, {variant: 'wall'})
// builds the street, the primed blind wall and the mural panels, and returns
// { panels:[{mesh, z0, z1, color}], spots:{odileChair, saunter, nail, ...}, setGolden() }.
// If scene2 does not deliver that contract (not rewritten yet, or it throws), a local street with the
// same layout is built instead, so Ch5 always runs.
//
// Scene5 adds the Ch5-only pieces on top: the chalk guide, the paint ribbon and the brush (THE LINE),
// and, from src/world/scenes/scene5/:
//   street.js    the cross street and the row of houses that closes the far (+Z) end
//   wallside.js  drop cloths, paint tins, the trestle table, the stepladder, Odile's painted chair
//   workshop.js  the open workshop (bench, pegboard with the painted watch outline, the nail, the
//                3D watch, the bench lamp, the clean race bike on its stand, the OPEN sign)
//   cast.js      Odile, Sami (riding with hands and feet on the bike), the neighbours with their
//                brushes / tin / camera, the run club
//   fx.js        dust in the low sun
//   r4wall.js    Revision 4 (SCRIPT-R4 §8): the seven-panel layout with M. Durand's key and Jo's swallow,
//                CYCLES DURAND open by day, M. Durand (a chair beside Odile's) and Jo
//
// Layout (metres, the street runs along -Z):
//   blind wall face   x = WALL_X (measured by raycast, contract -5.95), z -12 ... -32, h 8
//   the line          y 1.55, z -12 (bakery end) ... -32 (kebab end)
//   bench             [-5.32, -36.5] (faces +X)      Odile's chair  [-4.25, -38.3]
//   No. 14 door       [0, -48], garage door fully open; interior z -48 ... -51.5
//   nail              spots.nail is where Hugo stands; the pegboard is 0.95 m beyond it (-Z)

const CONTRACT_WALL_X = -5.95;
export const LINE_Z0 = -12;
export const LINE_Z1 = -32;
export const LINE_Y = 1.55;
const LINE_COLOR = '#d9a441';

const DEFAULT_SPOTS = {
  bench: [-5.32, -36.5],
  odileChair: [-4.25, -38.3],
  saunter: [-3.25, -22],
  nail: [0, -49.75],
  door: [0, -48],
  shop: [4.55, -34],
  boltHoles: [-4.6, -18],
};

// ---------------------------------------------------------------------------------- small helpers

const arr = (m) => (Array.isArray(m) ? m : m ? [m] : []);

/** Seeded PRNG (build.rng if present). */
const rngOf = (seed) => (B.rng ? B.rng(seed) : Math.random);

/**
 * Add a saturation uniform to a lit/unlit standard material (desaturates map * colour).
 * Returns the uniform ({value: 0..1}) or null for materials that can't be patched.
 */
function addSatControl(material) {
  if (!material) return null;
  if (material.userData.__sat) return material.userData.__sat;
  const ok =
    material.isMeshStandardMaterial || material.isMeshBasicMaterial || material.isMeshLambertMaterial || material.isMeshPhongMaterial;
  if (!ok) return null;
  const u = { value: 1 };
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    shader.uniforms.uPanelSat = u;
    shader.fragmentShader =
      'uniform float uPanelSat;\n' +
      shader.fragmentShader.replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n{ float g5 = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = mix(vec3(g5) * 0.92, diffuseColor.rgb, clamp(uPanelSat, 0.0, 1.0)); }',
      );
  };
  const prevKey = material.customProgramCacheKey;
  material.customProgramCacheKey = function () {
    return `${prevKey.call(this)}|panelSat5`;
  };
  material.userData.__sat = u;
  material.needsUpdate = true;
  return u;
}

/** Colour control over a mural panel: set(k) lerps it from grey (0) to its own colour (1). */
function panelControl(panel) {
  const sats = [];
  const lerps = [];
  const root = panel.mesh;
  root?.traverse?.((o) => {
    if (!o.isMesh) return;
    for (const m of arr(o.material)) {
      const u = addSatControl(m);
      if (u) sats.push(u);
      else if (m.color) {
        const to = m.color.clone();
        const l = to.r * 0.3 + to.g * 0.59 + to.b * 0.11;
        lerps.push({ m, to, from: new THREE.Color(l, l, l) });
      }
    }
  });
  let cur = -1;
  return {
    ...panel,
    k: 0,
    set(k) {
      k = THREE.MathUtils.clamp(k, 0, 1);
      if (Math.abs(k - cur) < 1e-3) return;
      cur = k;
      this.k = k;
      for (const u of sats) u.value = k;
      for (const L of lerps) L.m.color.copy(L.from).lerp(L.to, k);
      panel.setColor?.(k); // Ch2's wall panels tint their own material grey -> colour
    },
  };
}

/** Rotate `bone` so that its first child bone points at `target` (world), blended by `w`. */
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
export function aimBone(bone, target, w = 1) {
  if (!bone || !bone.parent || w <= 0) return;
  const child = bone.children.find((c) => c.isBone);
  if (!child) return;
  bone.updateWorldMatrix(true, true);
  const p = _v1.setFromMatrixPosition(bone.matrixWorld);
  const c = _v2.setFromMatrixPosition(child.matrixWorld);
  const cur = c.sub(p);
  if (cur.lengthSq() < 1e-10) return;
  cur.normalize();
  const want = _v3.copy(target).sub(p);
  if (want.lengthSq() < 1e-10) return;
  want.normalize();
  bone.getWorldQuaternion(_q1);
  _q2.setFromUnitVectors(cur, want).multiply(_q1); // new world rotation
  bone.parent.getWorldQuaternion(_q3).invert().multiply(_q2); // to local
  bone.quaternion.slerp(_q3, Math.min(1, w));
}

/** Highest surface below y=maxY at (x, z) in `root` (for decals on an unknown street). */
function groundY(root, x, z, maxY = 0.4) {
  const rc = new THREE.Raycaster(new THREE.Vector3(x, 3, z), new THREE.Vector3(0, -1, 0), 0, 6);
  const hits = rc.intersectObject(root, true);
  let best = 0;
  let found = false;
  for (const h of hits) {
    if (!h.object.isMesh || h.object.isSkinnedMesh) continue;
    if (h.point.y <= maxY && (!found || h.point.y > best)) {
      best = h.point.y;
      found = true;
    }
  }
  return found ? best : 0;
}

/** Wall face x along the blind wall: front-most +X-facing surface at the line height. */
function measureWallX(root) {
  const rc = new THREE.Raycaster();
  const n = new THREE.Vector3();
  const xs = [];
  for (const z of [-13.5, -17, -22, -27, -30.5]) {
    rc.set(new THREE.Vector3(-1, LINE_Y, z), new THREE.Vector3(-1, 0, 0));
    rc.far = 7;
    let best = null;
    for (const h of rc.intersectObject(root, true)) {
      if (!h.face || !h.object.isMesh || h.object.isSkinnedMesh) continue;
      n.copy(h.face.normal).transformDirection(h.object.matrixWorld);
      if (n.x < 0.7) continue;
      if (h.point.x > -4.6 || h.point.x < -7.5) continue;
      best = h.point.x;
      break; // sorted by distance: the first +X face hit is the front-most one
    }
    if (best !== null) xs.push(best);
  }
  if (!xs.length) return CONTRACT_WALL_X;
  xs.sort((a, b) => a - b);
  return xs[(xs.length / 2) | 0];
}

/** Find a point inside the union of rects near (x, z). */
export function clampToBounds(bounds, x, z) {
  if (!bounds || !bounds.length) return [x, z];
  let best = null;
  let bd = Infinity;
  for (const r of bounds) {
    const cx = THREE.MathUtils.clamp(x, r.minX + 0.05, r.maxX - 0.05);
    const cz = THREE.MathUtils.clamp(z, r.minZ + 0.05, r.maxZ - 0.05);
    const d = (cx - x) ** 2 + (cz - z) ** 2;
    if (d < bd) {
      bd = d;
      best = [cx, cz];
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------- canvas art

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

function texFrom(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Brushy, slightly uneven fill: draw a path several times with jitter. */
function roughStroke(g, R, pathFn, { color, width, passes = 3, jitter = 2 }) {
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < passes; i++) {
    g.lineWidth = width * (0.8 + R() * 0.4);
    g.globalAlpha = 0.55 + R() * 0.4;
    g.save();
    g.translate((R() - 0.5) * jitter, (R() - 0.5) * jitter);
    g.beginPath();
    pathFn(g);
    g.stroke();
    g.restore();
  }
  g.globalAlpha = 1;
}

function speckle(g, w, h, R, n = 900, alpha = 0.08) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = R() < 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha * 0.8})`;
    g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2);
  }
}

/** The five neighbours' panels (local street only; Ch2's variant brings its own). words: Marco's two words. */
function panelArt(id, w, h, seed, words) {
  const R = rngOf(seed);
  return canvas(w, h, (g) => {
    const bg = { benali: '#2f4256', ines: '#e6dccb', sami: '#e9dfc4', odile: '#3a3530', marco: '#d98a3a' }[id] || '#ccc';
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, R, 1400, 0.06);
    if (id === 'benali') {
      // A croissant that came out a moon.
      g.fillStyle = '#e8c27a';
      g.beginPath();
      g.arc(w * 0.5, h * 0.5, h * 0.33, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = bg;
      g.beginPath();
      g.arc(w * 0.6, h * 0.42, h * 0.3, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(160,110,50,0.6)';
      g.lineWidth = 4;
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.arc(w * 0.5, h * 0.5, h * 0.33, Math.PI * (0.55 + i * 0.16), Math.PI * (0.62 + i * 0.16));
        g.stroke();
      }
      g.fillStyle = '#efe6c8';
      for (let i = 0; i < 18; i++) g.fillRect(R() * w, R() * h * 0.9, 3, 3);
    } else if (id === 'ines') {
      g.font = `900 ${Math.round(h * 0.34)}px Impact, "Arial Black", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.lineWidth = 18;
      g.strokeStyle = '#2b2b2e';
      g.save();
      g.translate(w / 2, h * 0.52);
      g.rotate(-0.08);
      g.strokeText('TANNEURS', 0, 0);
      g.fillStyle = '#c24a6a';
      g.fillText('TANNEURS', 0, 0);
      g.lineWidth = 3;
      g.strokeStyle = '#f2e6da';
      g.strokeText('TANNEURS', -4, -4);
      g.restore();
      g.fillStyle = '#2f4f6a';
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.arc(w * (0.1 + R() * 0.8), h * (0.15 + R() * 0.7), 4 + R() * 8, 0, Math.PI * 2);
        g.fill();
      }
    } else if (id === 'sami') {
      // A red bike, drawn by an eleven-year-old (big wheels, very big).
      const c = '#c24a3a';
      const wy = h * 0.66;
      const r = h * 0.21;
      roughStroke(g, R, (p) => p.arc(w * 0.3, wy, r, 0, Math.PI * 2), { color: '#2b2b2e', width: 10 });
      roughStroke(g, R, (p) => p.arc(w * 0.72, wy, r, 0, Math.PI * 2), { color: '#2b2b2e', width: 10 });
      roughStroke(
        g,
        R,
        (p) => {
          p.moveTo(w * 0.3, wy);
          p.lineTo(w * 0.47, wy);
          p.lineTo(w * 0.62, h * 0.38);
          p.lineTo(w * 0.4, h * 0.38);
          p.lineTo(w * 0.3, wy);
          p.moveTo(w * 0.47, wy);
          p.lineTo(w * 0.38, h * 0.3);
          p.moveTo(w * 0.62, h * 0.38);
          p.lineTo(w * 0.72, wy);
          p.moveTo(w * 0.62, h * 0.38);
          p.lineTo(w * 0.6, h * 0.28);
          p.lineTo(w * 0.67, h * 0.27);
        },
        { color: c, width: 12 },
      );
      g.fillStyle = '#2b2b2e';
      g.fillRect(w * 0.33, h * 0.27, w * 0.1, h * 0.03);
      g.font = `600 ${Math.round(h * 0.09)}px "Bradley Hand", "Segoe Print", cursive`;
      g.fillStyle = '#2f4f6a';
      g.fillText('SAMI', w * 0.06, h * 0.16);
    } else if (id === 'odile') {
      // Odile's chalk hand: a hand outline in ochre and chalk, a brush between the fingers.
      g.strokeStyle = '#9a7a4e';
      g.lineWidth = 9;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const cx = w * 0.48;
      const cy = h * 0.62;
      g.beginPath();
      g.moveTo(cx - 70, cy + 120);
      g.lineTo(cx - 80, cy);
      for (let i = 0; i < 4; i++) {
        const fx = cx - 70 + i * 42;
        g.lineTo(fx, cy - 120 - (i === 1 || i === 2 ? 30 : 0));
        g.lineTo(fx + 30, cy - 120 - (i === 1 || i === 2 ? 30 : 0));
        g.lineTo(fx + 32, cy - 20);
      }
      g.lineTo(cx + 110, cy - 40);
      g.lineTo(cx + 150, cy - 70);
      g.lineTo(cx + 120, cy + 10);
      g.lineTo(cx + 90, cy + 120);
      g.stroke();
      g.strokeStyle = 'rgba(236,230,214,0.85)';
      g.lineWidth = 3;
      g.stroke();
      g.strokeStyle = '#e8c27a';
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(cx + 20, cy - 60);
      g.lineTo(cx + 200, cy - 200);
      g.stroke();
      g.fillStyle = 'rgba(236,230,214,0.25)';
      for (let i = 0; i < 400; i++) g.fillRect(R() * w, R() * h, 2, 1);
    } else if (id === 'marco') {
      // A great kebab.
      g.fillStyle = '#6b3a1e';
      g.beginPath();
      g.moveTo(w * 0.42, h * 0.12);
      g.lineTo(w * 0.58, h * 0.12);
      g.lineTo(w * 0.55, h * 0.8);
      g.lineTo(w * 0.45, h * 0.8);
      g.closePath();
      g.fill();
      g.strokeStyle = '#a8622e';
      g.lineWidth = 6;
      for (let i = 0; i < 9; i++) {
        const y = h * (0.16 + i * 0.07);
        g.beginPath();
        g.moveTo(w * 0.43, y);
        g.lineTo(w * 0.57, y + 6);
        g.stroke();
      }
      g.fillStyle = '#b9bcc0';
      g.fillRect(w * 0.494, h * 0.05, w * 0.012, h * 0.85);
      g.font = `900 ${Math.round(h * 0.13)}px Impact, "Arial Black", sans-serif`;
      g.textAlign = 'center';
      g.fillStyle = '#f4ead0';
      const [w1, w2] = words || ['GREAT', 'KEBAB'];
      g.fillText(w1, w * 0.2, h * 0.5);
      g.fillText(w2, w * 0.8, h * 0.5);
    }
    // weather the paint a touch so it sits on a real wall
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = 'rgba(180,170,150,0.25)';
    for (let i = 0; i < 12; i++) {
      g.beginPath();
      g.arc(R() * w, R() * h, 10 + R() * 50, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  });
}

/** Facade: grime plus windows; `shop` draws a shopfront or a shutter on the ground floor. */
function facadeTexture(seed, { base, w = 512, h = 1024, cols = 3, floors = 4, shop = null, lit = -1 } = {}) {
  const tex = B.grimeTexture({ w, h, base, seed, stains: 7, drips: 6, tags: shop ? 3 : 1, posters: shop ? 2 : 0 });
  const c = tex.userData?.canvas || tex.image;
  const g = c.getContext('2d');
  const R = rngOf(seed * 7 + 3);
  const groundH = shop ? h * 0.3 : h * 0.22;
  const fh = (h - groundH) / floors;
  for (let f = 0; f < floors; f++) {
    const y0 = f * fh + fh * 0.22;
    for (let i = 0; i < cols; i++) {
      const cw = w / cols;
      const x0 = i * cw + cw * 0.22;
      const ww = cw * 0.56;
      const wh = fh * 0.58;
      g.fillStyle = '#5c554c';
      g.fillRect(x0 - 5, y0 - 5, ww + 10, wh + 12);
      const isLit = f * cols + i === lit;
      g.fillStyle = isLit ? '#e8b878' : R() < 0.3 ? '#3a3f44' : '#4a5258';
      g.fillRect(x0, y0, ww, wh);
      g.fillStyle = 'rgba(200,210,220,0.12)';
      g.fillRect(x0, y0, ww * 0.45, wh);
      g.fillStyle = '#5c554c';
      g.fillRect(x0 + ww / 2 - 2, y0, 4, wh);
      if (R() < 0.35) {
        g.fillStyle = 'rgba(200,190,170,0.75)'; // a net curtain
        g.fillRect(x0, y0, ww, wh * 0.45);
      }
      g.fillStyle = 'rgba(80,50,30,0.35)'; // rust under the sill
      g.fillRect(x0, y0 + wh + 6, 4, 30 + R() * 50);
    }
  }
  if (shop) {
    const y0 = h - groundH * 0.92;
    if (shop === 'shutter') {
      g.fillStyle = '#8e9296';
      g.fillRect(w * 0.06, y0, w * 0.88, groundH * 0.88);
      for (let y = y0; y < h - 6; y += 9) {
        g.fillStyle = 'rgba(40,40,40,0.35)';
        g.fillRect(w * 0.06, y, w * 0.88, 2);
      }
      g.fillStyle = 'rgba(120,70,40,0.35)';
      g.fillRect(w * 0.06, h - groundH * 0.2, w * 0.88, groundH * 0.12);
    } else {
      g.fillStyle = '#3c4246';
      g.fillRect(w * 0.08, y0 + groundH * 0.18, w * 0.84, groundH * 0.7);
      g.fillStyle = 'rgba(220,200,160,0.18)';
      g.fillRect(w * 0.1, y0 + groundH * 0.2, w * 0.3, groundH * 0.66);
    }
  }
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------------- local street

/**
 * Local stand-in for buildScene2(ctx, {variant:'wall'}) with the same STREET CONTRACT layout.
 * Returns { group, bounds, spots, panels, setGolden, update }.
 */
async function buildLocalStreet(ctx, T2, T5) {
  const { assets } = ctx;
  const group = new THREE.Group();
  group.name = 'street-local';
  const R = rngOf(1205);
  const WX = CONTRACT_WALL_X;

  // Ground: asphalt (lifted mid-grey, wet-ish), sidewalks, faded centre dashes.
  group.add(B.ground({ size: [40, 96], pos: [0, -20], color: '#7a7d7f', roughness: 0.86, metalness: 0.08, tile: 4, spread: 0.12 }));
  const kerbTex = B.noiseTexture ? B.noiseTexture({ base: '#9a978e', spread: 0.14, size: 256, repeat: [1, 30], blotches: 30 }) : null;
  for (const s of [-1, 1]) {
    group.add(B.box(1.2, 0.03, 62, { pos: [s * 5.37, 0, -18], color: kerbTex ? '#ffffff' : '#9a978e', map: kerbTex, roughness: 0.92 }));
  }
  const dashes = [];
  for (let z = 10; z > -46; z -= 4) dashes.push({ pos: [0, 0.003, z], size: [0.12, 0.002, 1.8], color: '#b8b4a6' });
  group.add(B.instancedBoxes(dashes, B.mat('#ffffff', { roughness: 0.9 }), { castShadow: false }));

  // Damp patches where the puddles were (drying).
  const dampMat = new THREE.MeshStandardMaterial({
    color: '#4e5458',
    roughness: 0.25,
    metalness: 0,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const damp = [
    [-2.6, -3, 1.2, 0.6],
    [2.2, -9, 0.8, 0.45],
    [1.1, -27.5, 1.0, 0.5],
    [-1.8, -40.5, 1.3, 0.6],
    [2.8, -44.2, 0.7, 0.4],
  ];
  group.add(
    B.scatter(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), dampMat, damp.length, (i, d) => {
      const [x, z, rx, rz] = damp[i];
      d.position.set(x, 0.005, z);
      d.scale.set(rx, 1, rz);
      d.rotation.y = R() * Math.PI;
    }),
  );

  // Building fronts. Left faces +X at x = -5.95, right faces -X at x = +5.95.
  const DEPTH = 7;
  const fronts = [
    // side, z from, z to, height, base, extras
    [-1, 12, 3, 11, '#8f8170', {}],
    [-1, 3, -6, 9.5, '#9a8c78', {}],
    [-1, -6, -12, 10, '#a39377', { shop: 'front', sign: T2.signs?.bakery ?? 'BOULANGERIE BENALI', signFg: '#e8dcc0' }],
    [-1, -32, -36, 9, '#8c7f72', { shop: 'front', sign: T2.signs?.kebab ?? "MARCO'S", neon: true }],
    [-1, -36, -48, 12, '#857a6c', {}],
    [1, 12, 2, 12, '#8a7e70', {}],
    [1, 2, -8, 10, '#958774', {}],
    [1, -8, -16, 13, '#8c6a58', { ghost: true }],
    [1, -16, -26, 11, '#94897a', { shop: 'front' }],
    [1, -26, -31.5, 9.5, '#8a8072', {}],
    [1, -31.5, -36.5, 10, '#988b76', { shop: 'shutter' }],
    [1, -36.5, -48, 12, '#867b6e', {}],
  ];
  let seed = 31;
  let neonMat = null;
  for (const [side, z0, z1, h, base, ex] of fronts) {
    const len = Math.abs(z0 - z1);
    const tex = facadeTexture(seed++, { base, w: 512, h: Math.min(2048, Math.round((512 * h) / len)), cols: Math.max(2, Math.round(len / 3)), floors: Math.max(2, Math.round(h / 3) - 1), shop: ex.shop || null });
    const m = B.box(DEPTH, h, len, { pos: [side * (5.95 + DEPTH / 2), 0, (z0 + z1) / 2], color: '#ffffff', map: tex, roughness: 0.92 });
    group.add(m);
    const rot = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    const fx = side * (5.95 - 0.02);
    if (ex.sign) {
      const s = B.sign(ex.sign, Math.min(len - 0.6, 4.2), 0.55, {
        bg: ex.neon ? '#1a1416' : '#3b3430',
        fg: ex.neon ? '#ff3d6e' : ex.signFg,
        glow: !!ex.neon,
        weathered: 0.4,
      });
      s.position.set(side * (5.95 - 0.06), 3.25, (z0 + z1) / 2);
      s.rotation.y = rot;
      group.add(s);
      if (ex.neon) {
        neonMat = s.material;
        B.relabel(s, () => T2.signs?.kebab ?? "MARCO'S");
      }
    }
    if (ex.ghost) {
      const gs = B.sign(T2.signs?.ghost ?? 'MARCHAL & FILLE — ENSEIGNES — DORURE', 6.4, 0.8, {
        bg: null,
        fg: '#e2d6bc',
        weathered: 0.75,
        font: 'Georgia, "Times New Roman", serif',
        letterSpacing: 4,
      });
      gs.position.set(fx, 9.2, -10.6);
      gs.rotation.y = rot;
      gs.material.opacity = 0.55;
      group.add(gs);
    }
    // a rusted downpipe at the start of each front
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h, 8), B.mat('#5a4a3e', { roughness: 0.6, metalness: 0.3 }));
    pipe.position.set(side * (5.95 - 0.07), h / 2, z0 - 0.25);
    group.add(pipe);
  }

  // The blind wall (primed for the mural): one plane with the grime texture, a mass box behind it.
  const wallTex = B.grimeTexture({ w: 2048, h: 820, base: '#cbc2aa', seed: 51, stains: 10, drips: 10, tags: 2, posters: 0, spread: 0.08 });
  {
    const c = wallTex.userData?.canvas || wallTex.image;
    const g = c.getContext('2d');
    const W = c.width;
    const H = c.height;
    // The billboard is gone: a paler rectangle and bolt holes at z -18, high up.
    const bx = ((LINE_Z0 - -15.6) / 20) * W;
    const bw = (4.8 / 20) * W;
    const by = H * (1 - 7.7 / 8);
    const bh = H * (2.1 / 8);
    g.fillStyle = 'rgba(236,230,214,0.6)';
    g.fillRect(bx, by, bw, bh);
    g.fillStyle = '#3a2e24';
    for (const [u, v] of [[0.04, 0.1], [0.96, 0.1], [0.04, 0.9], [0.96, 0.9], [0.5, 0.1], [0.5, 0.9]]) {
      g.beginPath();
      g.arc(bx + u * bw, by + v * bh, 4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(110,60,30,0.45)';
      g.fillRect(bx + u * bw - 2, by + v * bh, 4, 26 + Math.random() * 30);
      g.fillStyle = '#3a2e24';
    }
    wallTex.needsUpdate = true;
  }
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(20, 8), new THREE.MeshStandardMaterial({ color: '#ffffff', map: wallTex, roughness: 0.95 }));
  wall.position.set(WX, 4, (LINE_Z0 + LINE_Z1) / 2);
  wall.rotation.y = Math.PI / 2;
  wall.receiveShadow = true;
  group.add(wall);
  group.add(B.box(DEPTH, 7.98, 20, { pos: [WX - 0.05 - DEPTH / 2, 0, (LINE_Z0 + LINE_Z1) / 2], color: '#7e7466' }));

  // Mural panels: five, 3.8 m wide, above the line.
  const P = T5.signs?.panels || [];
  const panels = [];
  for (let i = 0; i < 5; i++) {
    const p = P[i] || { id: `p${i}`, color: '#c0a070' };
    const z0 = LINE_Z0 - i * 4 - 0.1;
    const z1 = z0 - 3.8;
    const art = () => texFrom(panelArt(p.id, 608, 512, 90 + i, T5.signs?.marcoPanel));
    const tex = art();
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 3.2),
      new THREE.MeshStandardMaterial({ color: '#ffffff', map: tex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    );
    if (p.id === 'marco') B.relangTexture(mesh.material, art);
    mesh.position.set(WX + 0.012, 2.15 + 1.6, (z0 + z1) / 2);
    mesh.rotation.y = Math.PI / 2;
    mesh.receiveShadow = true;
    group.add(mesh);
    panels.push({ mesh, z0, z1, color: p.color, id: p.id });
  }

  // No. 14 closes the street: facade with the garage door fully open, a deep awning, and Hugo's
  // building stacked above (his third-floor window lit).
  const DOOR_W = 3.38;
  const DOOR_H = 2.65;
  const endTex = facadeTexture(77, { base: '#7f766a', w: 1024, h: 1200, cols: 4, floors: 4, lit: 2 });
  const sideW = 6 - DOOR_W / 2 - 0.06;
  for (const s of [-1, 1]) {
    group.add(B.box(sideW, 14, 8, { pos: [s * (DOOR_W / 2 + 0.06 + sideW / 2), 0, -52], color: '#ffffff', map: endTex, roughness: 0.92 }));
  }
  group.add(B.box(DOOR_W + 0.12, 14 - DOOR_H, 8, { pos: [0, DOOR_H, -52], color: '#8a8074', map: endTex, roughness: 0.92 }));
  const fascia = B.sign(T2.signs?.fascia ?? 'RÉPARATIONS.', 3.2, 0.5, { bg: '#2a2622', fg: '#e8d6a8', font: 'Georgia, serif', weathered: 0.15 });
  fascia.position.set(0, 3.35, -47.93);
  group.add(fascia);
  const num = B.sign(T2.signs?.number ?? 'No. 14', 0.5, 0.22, { bg: '#d8d0bc', fg: '#2b2b2e' });
  B.relabel(num, () => T2.signs?.number ?? 'No. 14');
  num.position.set(2.3, 2.2, -47.93);
  group.add(num);
  // The deep awning over the workshop door (sign painting in the rain, Ch2).
  const awning = B.box(5.8, 0.08, 1.6, { pos: [0, 2.95, -47.2], color: '#5a3e34', roughness: 0.8 });
  awning.rotation.x = 0.07; // sloping down toward the street
  group.add(awning);

  // Lamp posts (unlit by day).
  const lampZ = [4, -10, -24, -38];
  const lamps = await Promise.all(lampZ.map(() => assets.prop('kenney/roads/light-square.glb', { height: 4.5 })));
  lamps.forEach((l, i) => {
    const side = i % 2 ? 1 : -1;
    l.position.set(side * 5.45, 0, lampZ[i]);
    l.rotation.y = side < 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(l);
  });

  // Litter and dressing.
  const litter = [
    ['kenney/retro/detail-dumpster-closed.glb', { height: 1.3 }, [5.15, -21.5], -Math.PI / 2],
    ['kenney/retro/pallet-small.glb', { height: 0.15 }, [5.0, -24.4], 0.4],
    ['props/cardboard_box.glb', { height: 0.42 }, [4.9, -7.2], 0.3],
    ['kenney/survival/bottle-large.glb', { height: 0.3 }, [4.6, -12.1], 0],
    ['kenney/survival/bottle-large.glb', { height: 0.3 }, [-4.85, -35.2], 0],
    ['props/cardboard_box.glb', { height: 0.4 }, [5.05, -41.5], 0.8],
    ['kenney/retro/detail-bench.glb', { height: 0.82 }, [-5.32, -36.5], Math.PI / 2],
  ];
  const lp = await Promise.all(litter.map(([path, o]) => assets.prop(path, o)));
  lp.forEach((p, i) => {
    const [, , [x, z], ry] = litter[i];
    p.position.set(x, 0, z);
    p.rotation.y = ry;
    group.add(p);
  });
  // bin bags
  const bagMat = B.mat('#2a2c2e', { roughness: 0.45, metalness: 0.1 });
  for (const [x, z, s] of [[5.2, -19.8, 0.5], [5.35, -20.4, 0.42], [-5.1, -46.3, 0.46]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 10), bagMat);
    b.scale.set(1, 0.75, 0.9);
    b.position.set(x, s * 0.7, z);
    b.castShadow = true;
    group.add(b);
  }

  const bounds = [{ minX: -5.1, maxX: 5.1, minZ: -47.4, maxZ: 9 }];
  let t = 0;
  return {
    group,
    bounds,
    spots: { ...DEFAULT_SPOTS },
    panels,
    local: true,
    setGolden() {
      if (neonMat) neonMat.opacity = 1;
    },
    update(_dt, raw) {
      t += raw;
      if (neonMat) {
        // MARCO'S: one letter's tube is going.
        const flick = Math.sin(t * 37) > 0.6 && Math.sin(t * 1.3) > 0.3;
        neonMat.color?.setScalar(flick ? 0.35 : 1);
      }
    },
  };
}

// ---------------------------------------------------------------------------------- the line kit

/** A growing ribbon strip on the wall: n samples between z0 and z1 (2 vertices each). */
function makeStrip(n, material, x) {
  const pos = new Float32Array(n * 2 * 3);
  const idx = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(pos, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', attr);
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return {
    mesh,
    set(i, z, y, half) {
      pos[i * 6 + 0] = x;
      pos[i * 6 + 1] = y - half;
      pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x;
      pos[i * 6 + 4] = y + half;
      pos[i * 6 + 5] = z;
    },
    count(c) {
      geo.setDrawRange(0, Math.max(0, c - 1) * 6);
      attr.needsUpdate = true;
    },
  };
}

function makeLineKit(wallX) {
  const group = new THREE.Group();
  group.name = 'the-line';
  const N = 801;
  const z0 = LINE_Z0;
  const z1 = LINE_Z1;
  const dz = (z1 - z0) / (N - 1);
  const basic = (color, factor) =>
    new THREE.MeshBasicMaterial({
      color,
      toneMapped: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: factor,
      polygonOffsetUnits: factor,
    });
  const edge = makeStrip(N, basic('#8a5a22', -3), wallX + 0.03);
  const main = makeStrip(N, basic(LINE_COLOR, -4), wallX + 0.034);
  group.add(edge.mesh, main.mesh);

  // Chalk guide: a pale streak ahead of the brush, fading out.
  const chalkCanvas = canvas(512, 16, (g, w, h) => {
    const R = rngOf(7);
    for (let x = 0; x < w; x++) {
      const a = (1 - x / w) ** 1.2 * (0.55 + R() * 0.45);
      g.fillStyle = `rgba(240,236,226,${a.toFixed(3)})`;
      g.fillRect(x, 5 + R() * 2, 1, 4 + R() * 3);
    }
  });
  const chalkTex = texFrom(chalkCanvas);
  const CHALK_LEN = 3.2;
  const chalk = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.03),
    new THREE.MeshBasicMaterial({ map: chalkTex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  chalk.rotation.y = Math.PI / 2; // faces +X; local +x runs toward -Z
  chalk.renderOrder = 2;
  group.add(chalk);

  // The brush: a handle that spans from the hand to the tip, and an ochre-loaded bristle.
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 1, 8).translate(0, 0.5, 0), B.mat('#6a4a2e', { roughness: 0.6 }));
  const bristle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.01, 0.05, 8).translate(0, 0.025, 0), B.mat(LINE_COLOR, { roughness: 0.8 }));
  const brush = new THREE.Group();
  brush.add(handle, bristle);
  brush.visible = false;
  group.add(brush);

  // The tip: what mood.focusOn tracks.
  const tip = new THREE.Object3D();
  tip.position.set(wallX + 0.04, LINE_Y, z0);
  group.add(tip);

  let count = 0;
  let lastY = LINE_Y;
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const q = new THREE.Quaternion();

  const kit = {
    group,
    tip,
    brush,
    ribbon: main.mesh.material, // the line's colour (ch5 dries it: wet -> #d9a441)
    z0,
    z1,
    x: wallX + 0.04,
    get painted() {
      return count;
    },
    /** Paint up to tip z at height y (fills every sample in between). */
    paintTo(zTip, y) {
      const target = Math.min(N - 1, Math.floor((zTip - z0) / dz));
      if (target < count) return;
      const from = count;
      for (let i = from; i <= target; i++) {
        const k = target === from ? 1 : (i - from + 1) / (target - from + 1);
        const yy = lastY + (y - lastY) * k;
        const z = z0 + i * dz;
        const wob = 0.0035 * Math.sin(i * 0.37) + 0.0025 * Math.sin(i * 1.13);
        main.set(i, z, yy, 0.016 + wob);
        edge.set(i, z, yy - 0.002, 0.023 + wob);
      }
      count = target + 1;
      lastY = y;
      main.count(count);
      edge.count(count);
    },
    /** Finish the rest at the current height (skip). */
    finish() {
      this.paintTo(z1, lastY + (LINE_Y - lastY) * 0.5);
    },
    /** Chalk visible ahead of zTip only. */
    chalkAt(zTip) {
      const start = zTip - 0.04;
      const len = Math.min(CHALK_LEN, start - z1);
      chalk.visible = len > 0.05;
      if (!chalk.visible) return;
      chalk.scale.set(len, 1, 1);
      chalk.position.set(wallX + 0.026, LINE_Y, start - len / 2);
      chalkTex.repeat.set(len / CHALK_LEN, 1);
      chalkTex.offset.set(0, 0);
    },
    hideChalk() {
      chalk.visible = false;
    },
    /** Place the brush between the hand (world) and the tip (world). */
    placeBrush(tipPos, handPos) {
      brush.visible = true;
      dir.copy(handPos).sub(tipPos);
      let len = dir.length();
      if (len < 1e-4) dir.set(1, 0, 0);
      len = THREE.MathUtils.clamp(len, 0.16, 0.42);
      dir.normalize();
      q.setFromUnitVectors(up, dir);
      brush.position.copy(tipPos);
      brush.quaternion.copy(q);
      handle.position.set(0, 0.04, 0);
      handle.scale.set(1, len - 0.04, 1);
    },
  };
  kit.chalkAt(z0);
  return kit;
}

// ---------------------------------------------------------------------------------- builder

export async function buildScene5(ctx) {
  const T2 = ctx.L?.ch2 || {};
  const T5 = ctx.L?.ch7 || {};
  let base = null;
  try {
    const r = await buildScene2(ctx, { variant: 'wall' });
    if (r && r.group && Array.isArray(r.panels)) base = r;
    else if (r && r.group) {
      console.info('[hairline] scene5: scene2 has no wall variant yet; building the local street');
      try {
        r.dispose?.();
      } catch {
        /* ignore */
      }
      B.disposeGroup(r.group);
    }
  } catch (err) {
    console.info('[hairline] scene5: scene2 wall variant failed; building the local street', err?.message || err);
  }
  if (!base) base = await buildLocalStreet(ctx, T2, T5);
  const local = !!base.local;
  const group = base.group;
  group.updateMatrixWorld(true);

  const spots = { ...DEFAULT_SPOTS, ...(base.spots || {}) };
  if (!base.spots?.boltHoles && base.spots?.billboard) spots.boltHoles = base.spots.billboard;

  const wallX = local ? CONTRACT_WALL_X : measureWallX(group);
  const lineX = wallX + 0.65; // where Hugo walks while painting
  const disposers = [];
  const safe = async (what, fn, fallback = null) => {
    try {
      return await fn();
    } catch (err) {
      console.warn(`[hairline] scene5: ${what} failed; continuing without it`, err?.message || err);
      return fallback;
    }
  };

  // ---- the far (+Z) end of the street, which the crane-up looks back at
  const street = await safe('far end', () => finishStreet(ctx), { groundAt: () => 0 });
  if (street.root) group.add(street.root);
  if (street.dispose) disposers.push(street.dispose);
  // groundAt: where feet go (scene2 keeps them at y 0 on road and pavement alike).
  // surfaceAt: the real top of whatever is there, for props set down on the pavement.
  const groundAt = street.groundAt;
  group.updateMatrixWorld(true);
  const surfaceAt = (x, z) => groundY(group, x, z, 0.3);

  // R4: room on the wall for M. Durand's key and Jo's swallow (scene2 cut it into seven equal slots).
  const mural = local ? null : layoutMural(base.panels || []);
  // Panels -> colour controls (grey until the line passes under them).
  const panels = (base.panels || []).map((p) => panelControl(p));
  for (const p of panels) p.set(0);
  const panelMid = (i, dflt) => {
    const p = panels[i];
    return p && Number.isFinite(p.z0) && Number.isFinite(p.z1) ? (p.z0 + p.z1) / 2 : dflt;
  };

  const extras = new THREE.Group();
  extras.name = 'scene5-extras';
  group.add(extras);

  // ---- along the wall: cloths, tins, the trestle table, the stepladder, Odile's chair
  const ladderZ = panelMid(2, -22) + 0.6;
  const side = await safe('wall dressing', () => dressWallside(ctx, extras, { wallX, groundAt: surfaceAt, spots, panels, lineZ0: LINE_Z0, lineZ1: LINE_Z1, ladderZ }));
  if (side?.dispose) disposers.push(side.dispose);
  const [chX, chZ] = spots.odileChair;
  const chair = side?.chair || {
    seat: new THREE.Vector3(chX, surfaceAt(chX, chZ), chZ),
    facing: Math.atan2(wallX - chX, (LINE_Z0 + LINE_Z1) / 2 - chZ),
  };

  // ---- CYCLES DURAND open by day (R4), then the PUNCTURES card in its window (three lines since R4)
  const shopOpen = local ? null : openShop(extras, { signs: base.signs });
  if (shopOpen) disposers.push(shopOpen.dispose);
  const card = B.sign(T5.signs?.shopCard ?? 'PUNCTURES FIXED — ASK AT No. 14', 0.78, 0.42, {
    bg: '#efe8d6',
    fg: '#2b4f8a',
    italic: true,
    weight: 600,
    font: '"Bradley Hand", "Segoe Print", "Noteworthy", cursive',
  });
  B.relabel(card, () => T5.signs?.shopCard ?? 'PUNCTURES FIXED — ASK AT No. 14');
  card.position.set(5.84, 1.32, spots.shop[1] + 0.4);
  card.rotation.y = -Math.PI / 2;
  card.rotation.z = -0.03;
  extras.add(card);

  // ---- the line kit (ribbon, chalk, brush, tip) and the initials
  const line = makeLineKit(wallX);
  extras.add(line.group);
  const initials = B.sign(T5.signs?.initials ?? 'H.R.', 0.26, 0.11, { bg: null, fg: LINE_COLOR, italic: true, weight: 600, font: 'Georgia, serif' });
  initials.position.set(wallX + 0.036, LINE_Y - 0.13, LINE_Z1 + 0.18);
  initials.rotation.y = Math.PI / 2;
  initials.visible = false;
  extras.add(initials);
  const hugoPanel = makeHugoPanel(ctx, { wallX, doorGrey: mem.doorGrey }); // R3.7: painted before the line
  extras.add(hugoPanel.mesh);
  if (!local) paintNo14(extras, mem.doorGrey); // No. 14 in the grey he mixed in Ch4 (scene2's door layout)
  const jobs = await safe('street jobs', () => buildJobs(ctx, extras, { spots, groundAt, surfaceAt, street: group, signs: base.signs, word: T5.jobs?.board?.word })); // R3.8
  if (jobs) disposers.push(jobs.dispose);

  // ---- the workshop interior
  const shop = await buildWorkshop(ctx, extras, { spots, wallZ: base.interior?.minZ, openSign: ctx.minigames?.memory?.openSign, T5, local, shell: local || !base.interior });
  disposers.push(shop.dispose);

  // ---- cast: Odile, Sami + bike, neighbours, run club
  const cast = makeCast(ctx, extras, { wallX, groundAt: surfaceAt, panelMid, ladderZ, ladderStep: side?.muralLadder ? 0.62 : 0 });
  const samiRig = new THREE.Group();
  samiRig.name = 'sami-rig';
  extras.add(samiRig);
  const samiBike = B.bicycle({ frame: '#8a2b22', rust: 0.05 });
  const BIKE_SCALE = 0.82; // a kid's frame
  samiBike.scale.setScalar(BIKE_SCALE);
  samiBike.userData.kidScale = BIKE_SCALE;
  samiRig.add(samiBike);
  samiRig.add(cast.sami.root); // reparented from extras (still disposed with the group)
  const rider = makeRider(cast.sami, samiBike, aimBone);
  const neighbourHome = cast.homes;
  // R4: M. Durand beside Odile, Jo at her swallow.
  const joMid = mural?.byId?.jo ? (mural.byId.jo.z0 + mural.byId.jo.z1) / 2 : null;
  const r4 = await safe('R4 cast', () =>
    makeR4Cast(ctx, extras, { odileChair: spots.odileChair, chairFacing: chair.facing, surfaceAt, wallX, joPanel: joMid, encreDoor: spots.joDoor }),
  );
  if (r4) Object.assign(spots, r4.spots);
  const panelOf = (id) => panels.find((p) => p.id === id) || null;

  // ---- golden hour: the low sun comes down the street from No. 14's end, so the right-hand roofs
  // shade the wall; a warm, soft bounce off the facades opposite keeps the finished mural in the light.
  const muralBounce = new THREE.SpotLight('#ffbf7a', 0, 30, 0.8, 1, 1.2);
  muralBounce.position.set(5.4, 7.5, -15.5);
  muralBounce.target.position.set(wallX, 2.8, -23.5);
  muralBounce.userData.noCone = true;
  group.add(muralBounce, muralBounce.target);

  // ---- dust in the sun
  const motes = makeMotes();
  motes.opacity = 0.35;
  extras.add(motes.object);

  // Bounds: the street plus the workshop doorway / interior around the nail.
  const bounds = [...(base.bounds || [])];
  const [nx, nz] = spots.nail;
  bounds.push({ minX: nx - 1.35, maxX: nx + 1.35, minZ: nz - 0.15, maxZ: -46.6 });

  // Draw-call budget (300 incl. the shadow pass): small dressing doesn't cast sun shadows.
  {
    const sphere = new THREE.Sphere();
    group.updateMatrixWorld(true);
    group.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh || !o.castShadow || !o.geometry || o.userData.character) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      sphere.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
      if (sphere.radius < 0.45) o.castShadow = false;
    });
  }

  let t = 0;
  let tubeNext = 2;
  let tubeFlick = 0;
  const tubeBase = shop.tubeMat.color.clone();
  const _c = new THREE.Vector3();
  let golden = false;
  return {
    group,
    bounds,
    spots,
    panels,
    wallX,
    lineX,
    line,
    initials,
    hugoPanel,
    jobs,
    shop,
    cast,
    samiRig,
    samiBike,
    rider,
    chair,
    muralLadder: side?.muralLadder || null,
    neighbourHome,
    // R4 (scene5/r4wall.js): null when the cast failed to build
    durand: r4?.durand || null,
    jo: r4?.jo || null,
    durandSeat: r4?.durandSeat || null,
    panelOf,
    shopOpen,
    groundAt,
    surfaceAt,
    motes,
    muralBounce,
    local,
    setGolden() {
      golden = true;
      try {
        base.setGolden?.();
      } catch (err) {
        console.error('[hairline] scene2 setGolden failed', err);
      }
      for (const p of panels) p.set(1);
      // The workshop glows, but the low sun outside is the warm key now: softer, paler bulbs.
      shop.bulb.intensity = 2.2;
      shop.bulb.color.set('#ffd4a8');
      if (base.lights?.interior) {
        base.lights.interior.intensity = 4.5;
        base.lights.interior.color.set('#ffd2a4');
      }
      muralBounce.intensity = 45;
      motes.opacity = 0.7;
      for (const n of neighbourHome) n.char.root.visible = false;
    },
    update(dt, raw) {
      try {
        base.update?.(dt, raw);
      } catch (err) {
        console.error('[hairline] scene2 update failed', err);
      }
      t += raw;
      // The workshop tube stutters now and then.
      tubeNext -= raw;
      if (tubeNext <= 0) {
        tubeFlick = 0.3 + Math.random() * 0.6;
        tubeNext = 3 + Math.random() * 6;
      }
      let k = 1;
      if (tubeFlick > 0) {
        tubeFlick -= raw;
        k = Math.sin(t * 53) > 0.1 ? 1 : 0.12;
      }
      shop.tubeMat.color.copy(tubeBase).multiplyScalar(k);
      shop.update(ctx.camera);
      jobs?.update(dt, raw);
      // Motes ride with the camera's look target (a few metres ahead of the lens).
      const cam = ctx.camera;
      if (cam) {
        cam.getWorldDirection(_c).multiplyScalar(golden ? 5 : 4).add(cam.position);
        _c.y = 0;
        motes.update(raw, _c, ctx.renderer);
      }
    },
    dispose() {
      for (const f of disposers) {
        try {
          f();
        } catch {
          /* ignore */
        }
      }
      try {
        base.dispose?.();
      } catch (err) {
        console.error('[hairline] scene2 dispose failed', err);
      }
    },
  };
}
