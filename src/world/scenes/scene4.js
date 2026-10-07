import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { L } from '../../story/script.js';
import * as B from '../build.js';

// Ch4 "Measure Twice": Odile's repair workshop, ground floor of No. 14 Rue des Tanneurs.
// A 9 x 6 m dollhouse room (the +Z wall is omitted so the follow camera sits outside it; an
// invisible ceiling and fourth wall cast shadow so daylight only gets in under the garage door).
//
// Layout (top view, camera at +Z looking toward -Z):
//   back wall z = -3:  drums | main bench + vice, pegboard above, fluorescent tube | paint shelf |
//                      high grimy window, small bench + grinder, planks | internal doorway (x 3.4)
//   left wall (street): roll-up garage door, half open, grey daylight under it
//   right wall:         leaning old signs (back), Odile's corner: chair, lamp, radio, kettle (front)
//   centre:             the old door on two trestles under the bare bulb (the sanding station)
//   front-left:         the bike work stand; crates and the anvil in the corner

const W = 9;
const D = 6;
const H = 3.3;
const T = 0.18;
const IN_X = W / 2 - T / 2; // 4.41, inner face of the side walls
const BACK_Z = -D / 2 + T / 2; // -2.91, inner face of the back wall
const OUT_X = W / 2 + T / 2; // 4.59
const FRONT_Z = D / 2; // 3.0, the dollhouse cut

const DOORWAY = { x0: 2.98, x1: 3.82, h: 2.06 };
const DOOR_X = (DOORWAY.x0 + DOORWAY.x1) / 2; // 3.4
const WIN = { x0: 0.3, x1: 1.7, y0: 2.25, y1: 2.95 };
const GARAGE = { z0: -1.3, z1: 1.1, h: 2.5, open: 1.35 }; // opening on the left wall; door bottom at `open`
const BENCH = { x0: -3.6, x1: -0.7, z0: BACK_Z, z1: -2.16, top: 0.92 };
const TRESTLE = { x: 0.3, z: -0.2, top: 0.75 };
const DOOR_LEN = 2.0;
const DOOR_WID = 0.82;
const DOOR_THK = 0.04;
const STAND = { x: -2.5, z: 1.5, lift: 0.25 };
const EASEL = { x: -1.55, z: -2.55 };
const BOARD_W = 0.72;
const BOARD_H = 0.36;
const BOARD_PX = [1024, 512];

const BULB = { x: TRESTLE.x, y: 2.45, z: TRESTLE.z };
const TUBE = { x: -2.15, y: 2.78, z: -2.5 };

const WOOD_GREY = '#8d877c';
const SIGN_RED = '#a3392b';

const clamp = THREE.MathUtils.clamp;
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));

// ------------------------------------------------------------------ geometry helpers

/**
 * Axis-aligned box from world extents with scaled planar UVs (u, v per metre given by `uv`) and
 * vertex colours: cut faces (wall tops, front ends) are painted with `cap`.
 */
function slab(x0, x1, y0, y1, z0, z1, { cap = null, uv: uvs = [1, 1] } = {}) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const uv = g.attributes.uv;
  const col = new Float32Array(pos.count * 3);
  const capCol = new THREE.Color(cap ?? 0xffffff);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(nrm.getX(i));
    const ny = Math.abs(nrm.getY(i));
    if (nx > 0.5) uv.setXY(i, z * uvs[0], y * uvs[1]);
    else if (ny > 0.5) uv.setXY(i, x * uvs[0], z * uvs[1]);
    else uv.setXY(i, x * uvs[0], y * uvs[1]);
    const isCut = cap !== null && ((nrm.getY(i) > 0.5 && y > H - 0.01) || (nrm.getZ(i) > 0.5 && z > FRONT_Z - 0.01));
    const c = isCut ? capCol : { r: 1, g: 1, b: 1 };
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** A plain box geometry from extents (no UV fiddling). */
function bx(x0, x1, y0, y1, z0, z1) {
  return new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}

/** A box of size (w, h, d) centred at the origin, rotated, then moved to (x, y, z). */
function rbox(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}

function merged(geos, material, { castShadow = true, receiveShadow = true, name } = {}) {
  const m = new THREE.Mesh(mergeGeometries(geos, false), material);
  for (const g of geos) g.dispose();
  m.castShadow = castShadow;
  m.receiveShadow = receiveShadow;
  if (name) m.name = name;
  return m;
}

/** Make a texture repeat with the given tiling (keeps colour space etc). */
function tiled(tex, u = 1, v = 1) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(u, v);
  return tex;
}

// ------------------------------------------------------------------ textures

/** Grimy plaster walls with an old oil-paint dado up to 1.1 m. Tiles every 4.5 m x full height. */
function wallTexture() {
  const tex = B.grimeTexture({
    w: 1024,
    h: 768,
    base: '#958d7e',
    spread: 0.09,
    stains: 16,
    drips: 12,
    tags: 0,
    posters: 1,
    seed: 41,
    posterColors: ['#cfc4a8', '#b9b29a'],
  });
  const c = tex.userData.canvas;
  const g = c.getContext('2d');
  const R = B.rng(77);
  const w = c.width;
  const h = c.height;
  const dadoY = h * (1 - 1.1 / H);
  // Dado: dull green-grey gloss, scuffed and chipped.
  g.fillStyle = 'rgba(88,98,86,0.82)';
  g.fillRect(0, dadoY, w, h - dadoY);
  g.fillStyle = 'rgba(40,36,30,0.55)';
  g.fillRect(0, dadoY - 3, w, 5);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = R() < 0.5 ? `rgba(180,170,150,${0.15 + R() * 0.3})` : `rgba(30,26,20,${0.08 + R() * 0.2})`;
    const x = R() * w;
    const y = dadoY + R() * (h - dadoY);
    g.fillRect(x, y, 2 + R() * 14, 1 + R() * 4);
  }
  // Splash-back grime along the floor and hand marks at shoulder height.
  const grd = g.createLinearGradient(0, h - 90, 0, h);
  grd.addColorStop(0, 'rgba(30,24,18,0)');
  grd.addColorStop(1, 'rgba(30,24,18,0.55)');
  g.fillStyle = grd;
  g.fillRect(0, h - 90, w, 90);
  for (let i = 0; i < 9; i++) {
    g.fillStyle = `rgba(40,32,24,${0.06 + R() * 0.08})`;
    g.beginPath();
    g.ellipse(R() * w, h * (0.42 + R() * 0.12), 10 + R() * 18, 6 + R() * 10, R(), 0, Math.PI * 2);
    g.fill();
  }
  tex.needsUpdate = true;
  return tiled(tex, 1, 1);
}

/** Stained concrete floor covering the whole 9 x 6 m room: oil, paint drips, sawdust, joints. */
function floorTexture() {
  return B.canvasTexture(1536, 1024, (g, w, h) => {
    const R = B.rng(5);
    B.paintNoise(g, w, h, '#857f74', 0.07);
    const toPx = (x, z) => [((x + W / 2) / W) * w, ((z + D / 2) / D) * h];
    // Large damp clouds.
    for (let i = 0; i < 26; i++) {
      const r = 40 + R() * 160;
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
      const dark = R() < 0.7;
      grd.addColorStop(0, dark ? 'rgba(40,34,26,0.16)' : 'rgba(200,190,170,0.08)');
      grd.addColorStop(1, 'rgba(40,34,26,0)');
      g.save();
      g.translate(R() * w, R() * h);
      g.scale(1, 0.6 + R() * 0.6);
      g.fillStyle = grd;
      g.fillRect(-r, -r, r * 2, r * 2);
      g.restore();
    }
    // Expansion joints every 3 m and hairline cracks.
    g.strokeStyle = 'rgba(30,26,20,0.5)';
    g.lineWidth = 2;
    for (const x of [-1.5, 1.5]) {
      const [px] = toPx(x, 0);
      g.beginPath();
      g.moveTo(px, 0);
      g.lineTo(px, h);
      g.stroke();
    }
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(25,20,15,0.45)';
    for (let i = 0; i < 9; i++) {
      let x = R() * w;
      let y = R() * h;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 14; k++) g.lineTo((x += (R() - 0.5) * 40), (y += (R() - 0.5) * 40));
      g.stroke();
    }
    // Oil under the bike stand and in front of the bench.
    const oil = (x, z, r) => {
      const [px, py] = toPx(x, z);
      for (let k = 0; k < 4; k++) {
        g.fillStyle = `rgba(22,20,18,${0.12 + R() * 0.12})`;
        g.beginPath();
        g.ellipse(px + (R() - 0.5) * r, py + (R() - 0.5) * r * 0.6, r * (0.4 + R() * 0.6), r * (0.25 + R() * 0.4), R() * 3, 0, Math.PI * 2);
        g.fill();
      }
    };
    oil(STAND.x, STAND.z, 60);
    oil(-2.6, -1.9, 50);
    oil(-3.9, 0.2, 70);
    // Decades of paint drips: colours the grade will only give back with hope.
    const paints = ['#a3392b', '#b8893a', '#4a6a8a', '#d9cfb4', '#5f7a4a', '#c46a3a', '#2f3a4a'];
    for (let i = 0; i < 340; i++) {
      const near = R() < 0.6;
      const cx = near ? TRESTLE.x + (R() - 0.5) * 3.4 : (R() - 0.5) * W;
      const cz = near ? TRESTLE.z + (R() - 0.5) * 2.2 : (R() - 0.5) * D;
      const [px, py] = toPx(cx, cz);
      g.fillStyle = paints[(R() * paints.length) | 0];
      g.globalAlpha = 0.25 + R() * 0.45;
      g.beginPath();
      g.arc(px, py, 1 + R() * (R() < 0.1 ? 9 : 3.5), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // Sawdust drifts under the trestles.
    const [tx, ty] = toPx(TRESTLE.x, TRESTLE.z);
    for (let i = 0; i < 1400; i++) {
      const a = R() * Math.PI * 2;
      const r = Math.pow(R(), 0.6) * 210;
      g.fillStyle = `rgba(214,190,150,${0.1 + R() * 0.25})`;
      g.fillRect(tx + Math.cos(a) * r * 1.3, ty + Math.sin(a) * r * 0.7, 1.5, 1.5);
    }
    // Scuffed walking paths (lighter, polished).
    g.strokeStyle = 'rgba(170,160,140,0.07)';
    g.lineWidth = 90;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(...toPx(DOOR_X, -2.6));
    g.quadraticCurveTo(...toPx(1.8, 1.4), ...toPx(-2.8, -1.4));
    g.stroke();
    // Light under the garage door.
    const [gx, gy] = toPx(-4.5, -0.1);
    const lg = g.createLinearGradient(gx, 0, gx + 260, 0);
    lg.addColorStop(0, 'rgba(160,165,170,0.12)');
    lg.addColorStop(1, 'rgba(160,165,170,0)');
    g.fillStyle = lg;
    g.fillRect(gx, gy - 180, 260, 360);
  });
}

/** Wet pavement and cobbles for the street seen under the garage door. */
function streetTexture() {
  return B.canvasTexture(
    512,
    512,
    (g, w, h) => {
      B.paintNoise(g, w, h, '#6d6e6c', 0.08);
      const R = B.rng(19);
      g.strokeStyle = 'rgba(20,22,24,0.45)';
      g.lineWidth = 2;
      for (let y = 0; y < h; y += 32) {
        const off = (y / 32) % 2 ? 16 : 0;
        for (let x = -off; x < w; x += 32) g.strokeRect(x + 1, y + 1, 30 + (R() - 0.5) * 3, 30);
      }
      for (let i = 0; i < 14; i++) {
        g.fillStyle = 'rgba(30,34,40,0.22)';
        g.beginPath();
        g.ellipse(R() * w, R() * h, 20 + R() * 60, 10 + R() * 30, R(), 0, Math.PI * 2);
        g.fill();
      }
    },
    { repeat: [3, 3] },
  );
}

/** Corrugated, rust-streaked roll-up door. */
function garageTexture() {
  return B.canvasTexture(512, 512, (g, w, h) => {
    const R = B.rng(23);
    B.paintNoise(g, w, h, '#7d8079', 0.07);
    for (let y = 0; y < h; y += 16) {
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(0, y, w, 4);
      g.fillStyle = 'rgba(0,0,0,0.16)';
      g.fillRect(0, y + 11, w, 4);
    }
    for (let i = 0; i < 22; i++) {
      const x = R() * w;
      const y0 = R() * h * 0.5;
      const len = 40 + R() * 260;
      const grd = g.createLinearGradient(0, y0, 0, y0 + len);
      grd.addColorStop(0, 'rgba(122,70,38,0.55)');
      grd.addColorStop(1, 'rgba(122,70,38,0)');
      g.fillStyle = grd;
      g.fillRect(x, y0, 2 + R() * 6, len);
    }
    // Old painted lettering, mostly gone: "MARCHAL".
    g.save();
    g.globalAlpha = 0.18;
    g.fillStyle = '#e8dcc0';
    g.font = '700 70px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('MARCHAL', w / 2, h * 0.62);
    g.restore();
    g.fillStyle = 'rgba(30,24,18,0.35)';
    g.fillRect(0, h - 40, w, 40);
  });
}

/** Pegboard: holes, painted tool outlines (some empty, one small wristwatch in the corner). */
function pegboardTexture() {
  return B.canvasTexture(768, 512, (g, w, h) => {
    const R = B.rng(31);
    B.paintNoise(g, w, h, '#a48e6c', 0.06);
    g.fillStyle = 'rgba(40,30,20,0.55)';
    for (let y = 12; y < h; y += 24) for (let x = 12; x < w; x += 24) {
      g.beginPath();
      g.arc(x, y, 3, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(232,224,204,0.82)';
    g.strokeStyle = 'rgba(232,224,204,0.82)';
    g.lineWidth = 3;
    const rect = (x, y, rw, rh) => g.fillRect(x, y, rw, rh);
    // Saw (empty), square, spanners (one empty), screwdrivers, pliers, brushes, the outline under
    // the hammer/axe/shovel props, sandpaper hook.
    g.beginPath();
    g.moveTo(330, 60);
    g.lineTo(470, 60);
    g.lineTo(470, 120);
    g.lineTo(330, 90);
    g.closePath();
    g.fill();
    rect(470, 52, 34, 76);
    rect(540, 60, 12, 150);
    rect(540, 60, 90, 12);
    for (let i = 0; i < 4; i++) {
      rect(650 + i * 24, 70, 8, 90 + i * 14);
      g.beginPath();
      g.arc(654 + i * 24, 66, 10, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 3; i++) {
      rect(330 + i * 30, 300, 7, 80);
      rect(326 + i * 30, 260, 15, 40);
    }
    g.beginPath();
    g.moveTo(450, 280);
    g.lineTo(470, 380);
    g.lineTo(480, 380);
    g.lineTo(462, 280);
    g.moveTo(490, 280);
    g.lineTo(470, 380);
    g.lineTo(480, 380);
    g.lineTo(500, 280);
    g.fill();
    for (let i = 0; i < 3; i++) {
      rect(540 + i * 34, 300, 9, 70);
      rect(534 + i * 34, 260, 21, 40);
    }
    // Under the props (left third): hammer, axe, shovel shapes, painted a little larger.
    rect(60, 120, 16, 150);
    rect(40, 112, 56, 30);
    rect(150, 60, 14, 260);
    g.beginPath();
    g.moveTo(140, 70);
    g.lineTo(212, 52);
    g.lineTo(212, 132);
    g.closePath();
    g.fill();
    rect(252, 40, 12, 300);
    g.beginPath();
    g.ellipse(258, 380, 36, 56, 0, 0, Math.PI * 2);
    g.fill();
    // The small wristwatch, painted in the corner. (Odile was ready before he was.)
    g.beginPath();
    g.arc(712, 440, 20, 0, Math.PI * 2);
    g.fill();
    rect(704, 396, 16, 26);
    rect(704, 458, 16, 30);
    // Sandpaper hook outline.
    rect(600, 400, 70, 80);
    // Grime: hand smudges and stains.
    for (let i = 0; i < 30; i++) {
      g.fillStyle = `rgba(40,30,20,${0.04 + R() * 0.1})`;
      g.beginPath();
      g.arc(R() * w, R() * h, 6 + R() * 40, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** One gradient blob shadow (shared). */
function blobTexture() {
  return B.canvasTexture(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)');
    grd.addColorStop(0.6, 'rgba(0,0,0,0.25)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
}

/** Paint-tin label + drips (white base, so instance colour tints it). */
function tinTexture() {
  return B.canvasTexture(256, 64, (g, w, h) => {
    const R = B.rng(13);
    g.fillStyle = '#f2f0ea';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fillRect(40, 20, 90, 26);
    g.fillStyle = 'rgba(60,50,40,0.35)';
    g.fillRect(48, 28, 60, 4);
    g.fillRect(48, 36, 40, 3);
    for (let i = 0; i < 18; i++) {
      const x = R() * w;
      const len = 6 + R() * 40;
      g.fillStyle = 'rgba(90,80,70,0.5)';
      g.fillRect(x, 0, 3 + R() * 4, len);
      g.beginPath();
      g.arc(x + 3, len, 3, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(100,70,40,0.35)';
    g.fillRect(0, h - 8, w, 8);
  });
}

// ------------------------------------------------------------------ the door (sand / paint mask)

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * The old door: nine coats of chipped paint, raw wood under them, and the warm grey on top.
 * Canvas u runs along the door's length, v across its width. setSand(p) reveals wood in streaks
 * along the grain (back edge first); setPaint(p) lays the grey in 6 bands.
 */
function buildDoor() {
  const CW = 1024;
  const CH = 420;
  const R = B.rng(101);
  const panels = [
    [60, 50, 420, 140],
    [544, 50, 420, 140],
    [60, 230, 420, 140],
    [544, 230, 420, 140],
  ];
  const mould = (g, light, dark) => {
    for (const [x, y, w, h] of panels) {
      g.strokeStyle = dark;
      g.lineWidth = 4;
      g.strokeRect(x, y, w, h);
      g.strokeStyle = light;
      g.lineWidth = 2;
      g.strokeRect(x + 4, y + 4, w - 8, h - 8);
    }
  };

  // Layer 1: nine coats, the top one a tired green, chipped through to cream and red oxide.
  const old = makeCanvas(CW, CH);
  {
    const g = old.getContext('2d');
    B.paintNoise(g, CW, CH, '#5a6650', 0.06);
    for (let i = 0; i < 90; i++) {
      const x = R() * CW;
      const y = R() * CH;
      const r = 6 + R() * 34;
      g.fillStyle = R() < 0.6 ? '#c9bfa4' : '#7a4a36';
      g.beginPath();
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        const rr = r * (0.5 + R() * 0.6);
        g.lineTo(x + Math.cos(a) * rr * 1.6, y + Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(30,26,20,0.35)';
      g.lineWidth = 1;
      g.stroke();
    }
    mould(g, 'rgba(210,214,190,0.25)', 'rgba(20,24,18,0.45)');
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(20,18,14,${0.15 + R() * 0.2})`;
      g.lineWidth = 1;
      g.beginPath();
      const x = R() * CW;
      const y = R() * CH;
      g.moveTo(x, y);
      g.lineTo(x + (R() - 0.5) * 120, y + (R() - 0.5) * 16);
      g.stroke();
    }
    // Hand grime around the handle (middle of the length, one edge) and the old keyhole.
    const grd = g.createRadialGradient(CW / 2, CH * 0.88, 4, CW / 2, CH * 0.88, 140);
    grd.addColorStop(0, 'rgba(30,24,16,0.6)');
    grd.addColorStop(1, 'rgba(30,24,16,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, CW, CH);
    g.fillStyle = '#2a2622';
    g.fillRect(CW / 2 - 20, CH - 60, 40, 30);
    g.fillStyle = '#0e0c0a';
    g.beginPath();
    g.arc(CW / 2, CH - 46, 6, 0, Math.PI * 2);
    g.fill();
  }

  // Layer 2: raw pale wood with the grain along u.
  const wood = makeCanvas(CW, CH);
  {
    const g = wood.getContext('2d');
    B.paintNoise(g, CW, CH, '#bf9f74', 0.05);
    for (let i = 0; i < 160; i++) {
      const y = R() * CH;
      g.strokeStyle = `rgba(110,74,40,${0.08 + R() * 0.18})`;
      g.lineWidth = 0.6 + R() * 1.4;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= CW; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + i) * (2 + R() * 3));
      g.stroke();
    }
    for (let i = 0; i < 4; i++) {
      g.fillStyle = 'rgba(100,64,34,0.45)';
      g.beginPath();
      g.ellipse(R() * CW, R() * CH, 10 + R() * 8, 4 + R() * 3, 0, 0, Math.PI * 2);
      g.fill();
    }
    mould(g, 'rgba(240,220,190,0.2)', 'rgba(90,60,30,0.45)');
    g.fillStyle = 'rgba(70,50,30,0.4)';
    g.fillRect(CW / 2 - 20, CH - 60, 40, 30);
  }

  // Layer 3: the warm grey, laid with a wide brush.
  const grey = makeCanvas(CW, CH);
  {
    const g = grey.getContext('2d');
    B.paintNoise(g, CW, CH, L.ch4.day8.paintColor || WOOD_GREY, 0.035);
    for (let i = 0; i < 260; i++) {
      const y = R() * CH;
      g.strokeStyle = R() < 0.5 ? 'rgba(255,250,240,0.06)' : 'rgba(40,36,30,0.06)';
      g.lineWidth = 1 + R() * 3;
      g.beginPath();
      g.moveTo(R() * 100, y);
      g.lineTo(CW - R() * 100, y + (R() - 0.5) * 6);
      g.stroke();
    }
    mould(g, 'rgba(255,248,236,0.18)', 'rgba(40,36,30,0.35)');
    g.fillStyle = '#5a554c';
    g.fillRect(CW / 2 - 20, CH - 60, 40, 30);
  }

  // Sanding streaks (back edge first) and paint bands.
  const streaks = [];
  for (let i = 0; i < 70; i++) {
    const v = R() * CH;
    streaks.push({
      v,
      h: 6 + R() * 22,
      u0: R() * 120,
      u1: CW - R() * 120,
      t: 0.82 * (0.7 * (v / CH) + 0.3 * R()),
    });
  }
  const mask = makeCanvas(CW, CH);
  const mg = mask.getContext('2d');
  const out = makeCanvas(CW, CH);
  const og = out.getContext('2d');
  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  let sand = 0;
  let paint = 0;
  const compose = () => {
    og.globalCompositeOperation = 'source-over';
    og.drawImage(old, 0, 0);
    if (sand > 0) {
      mg.globalCompositeOperation = 'source-over';
      mg.clearRect(0, 0, CW, CH);
      mg.fillStyle = '#fff';
      for (const s of streaks) {
        const a = clamp((sand - s.t) / 0.12, 0, 1);
        if (a <= 0) continue;
        mg.globalAlpha = a;
        mg.fillRect(s.u0, s.v - s.h / 2, s.u1 - s.u0, s.h);
        mg.fillRect(s.u0 * 0.3, s.v - s.h / 4, s.u1 - s.u0 * 0.3, s.h / 2);
      }
      const all = clamp((sand - 0.86) / 0.14, 0, 1);
      if (all > 0) {
        mg.globalAlpha = all;
        mg.fillRect(0, 0, CW, CH);
      }
      mg.globalAlpha = 1;
      mg.globalCompositeOperation = 'source-in';
      mg.drawImage(wood, 0, 0);
      og.drawImage(mask, 0, 0);
    }
    if (paint > 0) {
      mg.globalCompositeOperation = 'source-over';
      mg.clearRect(0, 0, CW, CH);
      const bandH = CH / 6;
      for (let k = 0; k < 6; k++) {
        const q = clamp(paint * 6 - k, 0, 1);
        if (q <= 0) continue;
        const x1 = q * CW;
        const grd = mg.createLinearGradient(Math.max(0, x1 - 60), 0, x1, 0);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        mg.fillStyle = '#fff';
        mg.fillRect(0, k * bandH - 2, Math.max(0, x1 - 60), bandH + 4);
        mg.fillStyle = grd;
        mg.fillRect(Math.max(0, x1 - 60), k * bandH - 2, Math.min(60, x1), bandH + 4);
      }
      mg.globalCompositeOperation = 'source-in';
      mg.drawImage(grey, 0, 0);
      og.drawImage(mask, 0, 0);
    }
    tex.needsUpdate = true;
  };
  compose();

  // One material (one draw): the canvas is laid out for the +y face; the 4 cm edges just pick up
  // a squeezed copy of it, which reads as painted edges.
  const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(DOOR_LEN, DOOR_THK, DOOR_WID), faceMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'old-door';
  const group = new THREE.Group();
  group.name = 'door';
  group.add(mesh);

  const lie = () => {
    group.position.set(TRESTLE.x, 0, TRESTLE.z);
    group.rotation.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.position.set(0, TRESTLE.top + DOOR_THK / 2 + 0.002, 0);
  };
  lie();

  // Sanding block / wide brush that rides on the face while Hugo works.
  const block = new THREE.Group();
  block.add(
    merged([bx(-0.065, 0.065, 0, 0.035, -0.04, 0.04)], B.mat('#b58a5a', { roughness: 0.9 }), { castShadow: true }),
    merged([bx(-0.07, 0.07, -0.004, 0.002, -0.045, 0.045)], B.mat('#c9b48a', { roughness: 1 }), { castShadow: false }),
  );
  block.visible = false;
  group.add(block);
  const brush = new THREE.Group();
  brush.add(
    merged([bx(-0.05, 0.05, 0.0, 0.03, -0.012, 0.012)], B.mat('#3a3630', { roughness: 0.95 })),
    merged([bx(-0.05, 0.05, 0.03, 0.06, -0.014, 0.014)], B.mat('#9a9890', { roughness: 0.4, metalness: 0.6 })),
    merged([rbox(0.03, 0.18, 0.02, 0, 0.15, 0)], B.mat('#7a4a2c', { roughness: 0.7 })),
  );
  brush.visible = false;
  group.add(brush);
  const faceY = TRESTLE.top + DOOR_THK + 0.002;

  return {
    group,
    mesh,
    block,
    brush,
    get sand() {
      return sand;
    },
    get paint() {
      return paint;
    },
    setSand(p) {
      p = clamp(p, 0, 1);
      if (Math.abs(p - sand) < 0.004 && p < 1) return;
      sand = p;
      compose();
    },
    setPaint(p) {
      p = clamp(p, 0, 1);
      if (Math.abs(p - paint) < 0.004 && p < 1) return;
      paint = p;
      compose();
    },
    /** Sanding block on the face: x along the length (-1..1 of half-length), f across (0 back .. 1 front). */
    setBlock(on, x = 0, f = 0) {
      block.visible = on;
      block.position.set(x * (DOOR_LEN / 2 - 0.1), faceY, -DOOR_WID / 2 + 0.06 + f * (DOOR_WID - 0.12));
    },
    /** Wide brush at band k (0..5), q along the length (0..1). */
    setBrush(on, k = 0, q = 0) {
      brush.visible = on;
      brush.position.set(-DOOR_LEN / 2 + 0.05 + q * (DOOR_LEN - 0.1), faceY, -DOOR_WID / 2 + ((k + 0.5) / 6) * DOOR_WID);
      brush.rotation.set(0, 0, -0.5);
    },
    lie,
    /** Stand the door up in the internal doorway, painted face toward the room (+Z). */
    hang() {
      block.visible = false;
      brush.visible = false;
      group.position.set(DOOR_X, 0, -D / 2 - 0.0);
      group.rotation.set(0, 0, 0);
      // local x (length) -> world up, local y (face normal) -> world +Z, local z -> world x.
      const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
      mesh.quaternion.setFromRotationMatrix(m);
      mesh.position.set(0, DOOR_LEN / 2 + 0.02, 0.025);
    },
    /** World point at the centre of the painted face. */
    faceCenter() {
      return mesh.getWorldPosition(new THREE.Vector3());
    },
  };
}

// ------------------------------------------------------------------ the bicycle on the work stand

/**
 * Wraps build.bicycle() for the workshop: wheel spin, a rear wheel that wobbles out of true once per
 * turn (a yaw pivot around the axle), brake pads that flash on the rub, and "pushed by" follow.
 */
function rigBike(bike) {
  const [front, rear] = bike.userData.wheels;
  // Insert a yaw pivot between the bike and the rear wheel so the whole wheel can wander sideways.
  const yaw = new THREE.Group();
  yaw.position.copy(rear.position);
  bike.add(yaw);
  bike.remove(rear);
  rear.position.set(0, 0, 0);
  yaw.add(rear);
  // Rear brake pads, where the seat stays bridge over the rim.
  const padMat = new THREE.MeshStandardMaterial({ color: '#1e1e20', roughness: 0.9, emissive: '#000000' });
  const padGeo = mergeGeometries([bx(-0.034, -0.018, -0.012, 0.012, -0.022, 0.022), bx(0.018, 0.034, -0.012, 0.012, -0.022, 0.022)]);
  const pads = new THREE.Mesh(padGeo, padMat);
  const R = bike.userData.wheelRadius;
  const ang = Math.atan2(0.27, 0.42); // toward the seat-stay bridge
  pads.position.set(0, yaw.position.y + Math.cos(ang) * (R - 0.03), yaw.position.z + Math.sin(ang) * (R - 0.03));
  bike.add(pads);
  const bridge = new THREE.Mesh(bx(-0.05, 0.05, -0.006, 0.006, -0.008, 0.008), B.mat('#9a9c9e', { roughness: 0.4, metalness: 0.6 }));
  bridge.position.copy(pads.position);
  bridge.position.y += 0.02;
  bike.add(bridge);

  const st = {
    spin: 0, // rev/s of the rear wheel
    spinTarget: 0,
    angle: 0,
    amp: 0, // wobble amplitude (rad of yaw)
    rubAngle: 0,
    flash: 0,
    follow: null,
    lastPos: new THREE.Vector3(),
  };
  const TAU = Math.PI * 2;
  const api = {
    group: bike,
    rear,
    front,
    yaw,
    pads,
    st,
    /** Called each time the rim's worst point passes the pads while the wheel is out of true. */
    onRub: null,
    setSpin(revPerSec, { snap = false } = {}) {
      st.spinTarget = revPerSec;
      if (snap) st.spin = revPerSec;
    },
    setWobble(a) {
      st.amp = a;
    },
    /** The rim's worst point reaches the pad `secs` from now (at the current spin). */
    syncRub(secs) {
      st.rubAngle = st.angle + Math.PI * 2 * st.spin * secs;
    },
    rub() {
      st.flash = 1;
    },
    /** Walk the bike beside `char` (on the side away from the camera). null stops. */
    follow(char) {
      st.follow = char;
      if (char) st.lastPos.copy(char.root.position);
    },
    update(dt) {
      const before = Math.floor((st.angle - st.rubAngle) / TAU);
      st.spin = damp(st.spin, st.spinTarget, 2.5, dt);
      st.angle += TAU * st.spin * dt;
      rear.rotation.x = -st.angle;
      const target = st.amp * Math.cos(st.angle - st.rubAngle);
      yaw.rotation.y = damp(yaw.rotation.y, target, 14, dt);
      st.flash = Math.max(0, st.flash - dt * 4);
      padMat.emissive.setRGB(0.5 * st.flash, 0.32 * st.flash, 0.18 * st.flash);
      if (st.follow) {
        const r = st.follow.root;
        const a = r.rotation.y;
        const fwd = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
        const left = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
        if (left.z > 0) left.negate(); // keep the bike on the far side of the kid
        bike.position.copy(r.position).addScaledVector(left, 0.42).addScaledVector(fwd, 0.12);
        bike.position.y = 0;
        bike.rotation.set(0, a, 0);
        const moved = r.position.distanceTo(st.lastPos);
        st.lastPos.copy(r.position);
        front.rotation.x -= moved / R;
        st.angle += moved / R;
      }
      const after = Math.floor((st.angle - st.rubAngle) / TAU);
      if (after > before && st.amp > 0.015) {
        st.flash = 1;
        try {
          api.onRub?.();
        } catch (err) {
          console.error('[scene4] onRub failed', err);
        }
      }
    },
  };
  return api;
}

// ------------------------------------------------------------------ the OPEN sign board

/**
 * The cream-primed sign board on its little easel. The paint canvas holds primer + paint; the
 * display canvas adds the chalk guides on top. Lettering is drawn in 3D on the board itself.
 */
function buildBoard() {
  const [CW, CH] = BOARD_PX;
  const R = B.rng(211);
  const paintC = makeCanvas(CW, CH);
  const pg = paintC.getContext('2d');
  B.paintNoise(pg, CW, CH, '#e4d9bf', 0.035);
  for (let i = 0; i < 120; i++) {
    pg.strokeStyle = R() < 0.5 ? 'rgba(255,252,240,0.08)' : 'rgba(120,100,70,0.05)';
    pg.lineWidth = 1 + R() * 3;
    const y = R() * CH;
    pg.beginPath();
    pg.moveTo(0, y);
    pg.lineTo(CW, y + (R() - 0.5) * 8);
    pg.stroke();
  }
  const edge = pg.createLinearGradient(0, 0, 0, CH);
  edge.addColorStop(0, 'rgba(90,70,40,0.12)');
  edge.addColorStop(0.15, 'rgba(90,70,40,0)');
  edge.addColorStop(0.85, 'rgba(90,70,40,0)');
  edge.addColorStop(1, 'rgba(90,70,40,0.16)');
  pg.fillStyle = edge;
  pg.fillRect(0, 0, CW, CH);

  // Stroke paths (px) for O-P-E-N: O (one loop), P (stem, bowl), E (stem, comb), N (zigzag).
  const TOP = 120;
  const BOT = 380;
  const MID = (TOP + BOT) / 2;
  const sx = -14; // centre the word
  const ellipse = (cx, cy, rx, ry, a0, a1, n = 40) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return pts;
  };
  const shift = (pts) => pts.map(([u, v]) => [u + sx, v]);
  const strokes = [
    shift(ellipse(215, MID, 86, (BOT - TOP) / 2, -Math.PI / 2, -Math.PI / 2 - Math.PI * 2, 56)), // O, anticlockwise
    shift([
      [372, TOP],
      [372, BOT],
    ]), // P stem
    shift([[372, TOP], [430, TOP], ...ellipse(430, TOP + 68, 66, 68, -Math.PI / 2, Math.PI / 2, 24), [372, TOP + 136]]), // P bowl
    shift([
      [560, TOP],
      [560, BOT],
    ]), // E stem
    shift([
      [700, TOP],
      [566, TOP],
      [566, MID],
      [672, MID],
      [566, MID],
      [566, BOT],
      [710, BOT],
    ]), // E comb
    shift([
      [790, BOT],
      [790, TOP],
      [935, BOT],
      [935, TOP],
    ]), // N
  ];
  // Arc-length tables.
  const paths = strokes.map((pts) => {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, cum, length: cum[cum.length - 1] };
  });
  const pointAt = (path, s) => {
    const { pts, cum, length } = path;
    s = clamp(s, 0, length);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const k = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
  };

  // Chalk guides.
  const guideC = makeCanvas(CW, CH);
  {
    const g = guideC.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 1.5;
    g.setLineDash([10, 8]);
    for (const y of [TOP, BOT]) {
      g.beginPath();
      g.moveTo(60, y);
      g.lineTo(CW - 60, y);
      g.stroke();
    }
    g.strokeStyle = 'rgba(250,250,250,0.6)';
    g.lineWidth = 3;
    g.setLineDash([7, 6]);
    for (const p of paths) {
      g.beginPath();
      p.pts.forEach(([u, v], i) => (i ? g.lineTo(u, v) : g.moveTo(u, v)));
      g.stroke();
    }
  }

  const display = makeCanvas(CW, CH);
  const dg = display.getContext('2d');
  const tex = new THREE.CanvasTexture(display);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  let guides = true;
  let dirty = true;
  const redraw = () => {
    dg.drawImage(paintC, 0, 0);
    if (guides) {
      dg.globalAlpha = 0.55;
      dg.drawImage(guideC, 0, 0);
      dg.globalAlpha = 1;
    }
    tex.needsUpdate = true;
    dirty = false;
  };
  redraw();

  const color = L.ch4.week7.lettering.paint || SIGN_RED;
  let last = null;
  const seg = (a, b) => {
    // Main body + two thin bristle tracks, slightly offset.
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    pg.lineCap = 'round';
    pg.strokeStyle = color;
    pg.globalAlpha = 0.93;
    pg.lineWidth = 9;
    pg.beginPath();
    pg.moveTo(a[0], a[1]);
    pg.lineTo(b[0], b[1]);
    pg.stroke();
    pg.globalAlpha = 0.35;
    pg.lineWidth = 1.6;
    pg.strokeStyle = '#6e2018';
    for (const o of [-3, 2.6]) {
      pg.beginPath();
      pg.moveTo(a[0] + nx * o, a[1] + ny * o);
      pg.lineTo(b[0] + nx * o, b[1] + ny * o);
      pg.stroke();
    }
    pg.globalAlpha = 1;
    dirty = true;
  };

  // Mesh: backing + face, easel legs behind.
  const group = new THREE.Group();
  group.name = 'open-sign';
  const face = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, BOARD_H), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.72 }));
  face.position.set(0, BOARD_H / 2 + 0.02, 0.012);
  face.receiveShadow = true;
  face.name = 'open-sign-face';
  const back = new THREE.Mesh(bx(-BOARD_W / 2 - 0.01, BOARD_W / 2 + 0.01, 0.01, BOARD_H + 0.03, -0.01, 0.01), B.mat('#5a4632', { roughness: 0.85 }));
  back.castShadow = true;
  group.add(face, back);
  const easel = merged(
    [rbox(0.025, 0.5, 0.02, -0.2, 0.24, -0.08, -0.3, 0, 0.06), rbox(0.025, 0.5, 0.02, 0.2, 0.24, -0.08, -0.3, 0, -0.06), rbox(0.5, 0.02, 0.05, 0, 0.012, 0.025)],
    B.mat('#6a5038', { roughness: 0.85 }),
  );
  group.add(easel);
  // The liner brush: tip at the origin, handle up and toward the camera.
  const brush = new THREE.Group();
  brush.add(
    merged([new THREE.ConeGeometry(0.004, 0.018, 8).rotateX(Math.PI).translate(0, 0.009, 0)], B.mat('#5a2a20', { roughness: 0.8 }), { castShadow: false }),
    merged([new THREE.CylinderGeometry(0.0045, 0.0045, 0.018, 8).translate(0, 0.027, 0)], B.mat('#b9b8b0', { roughness: 0.3, metalness: 0.8 }), { castShadow: false }),
    merged([new THREE.CylinderGeometry(0.0032, 0.005, 0.2, 8).translate(0, 0.136, 0)], B.mat('#2c2a28', { roughness: 0.5 }), { castShadow: false }),
  );
  brush.rotation.set(0.95, 0, -0.55); // handle leans back toward the camera and to the right
  brush.visible = false;
  face.add(brush);

  const toLocal = (u, v, lift = 0) => new THREE.Vector3((u / CW - 0.5) * BOARD_W, (0.5 - v / CH) * BOARD_H, 0.002 + lift);

  return {
    group,
    face,
    easel,
    brush,
    canvas: paintC,
    paths,
    pointAt,
    size: [CW, CH],
    /** Paint from the last point to (u, v) in canvas px. */
    paintTo(u, v) {
      const p = [u, v];
      if (last) seg(last, p);
      last = p;
    },
    lift() {
      last = null;
    },
    setBrush(on, u = CW / 2, v = CH / 2, lift = 0) {
      brush.visible = on;
      brush.position.copy(toLocal(u, v, lift));
    },
    guides(on) {
      guides = on;
      dirty = true;
    },
    /** Paint a whole stroke perfectly (skip / fallback). */
    perfect(i) {
      const p = paths[i];
      last = null;
      for (let s = 0; s <= p.length; s += 6) {
        const q = pointAt(p, s);
        if (last) seg(last, q);
        last = q;
      }
      last = null;
    },
    /** Hugo's tiny "H.R." in the bottom-right corner, revealed left to right (k 0..1). */
    initials(k) {
      const text = L.ch4.signs.initials;
      pg.save();
      pg.font = 'italic 600 30px Georgia, "Times New Roman", serif';
      pg.textAlign = 'right';
      pg.textBaseline = 'alphabetic';
      const w = pg.measureText(text).width;
      const x1 = CW - 64;
      pg.beginPath();
      pg.rect(x1 - w - 2, CH - 90, (w + 4) * clamp(k, 0, 1), 60);
      pg.clip();
      pg.fillStyle = color;
      pg.fillText(text, x1, CH - 46);
      pg.restore();
      dirty = true;
    },
    /** A copy of the finished sign (primer + paint, no guides) for Ch5. */
    snapshot() {
      const c = makeCanvas(CW, CH);
      c.getContext('2d').drawImage(paintC, 0, 0);
      return c;
    },
    update() {
      if (dirty) redraw();
    },
    /** World position of a canvas point on the board face. */
    worldAt(u, v) {
      return face.localToWorld(toLocal(u, v));
    },
  };
}

// ------------------------------------------------------------------ small hand-made props

function buildRadio() {
  const g = new THREE.Group();
  const tex = B.canvasTexture(128, 64, (c, w, h) => {
    c.fillStyle = '#6a4a30';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#c8b894';
    c.fillRect(8, 8, 70, 48);
    c.strokeStyle = 'rgba(60,40,20,0.7)';
    for (let x = 12; x < 76; x += 5) {
      c.beginPath();
      c.moveTo(x, 10);
      c.lineTo(x, 54);
      c.stroke();
    }
    c.fillStyle = '#e8dcb8';
    c.fillRect(86, 12, 34, 14);
    c.fillStyle = '#a3392b';
    c.fillRect(100, 12, 2, 14);
    c.fillStyle = '#2a2018';
    c.beginPath();
    c.arc(94, 44, 7, 0, Math.PI * 2);
    c.arc(112, 44, 7, 0, Math.PI * 2);
    c.fill();
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.17, 0.12).translate(0, 0.085, 0), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
  body.castShadow = true;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.006, 6, 16, Math.PI), B.mat('#2a2622', { roughness: 0.5 }));
  handle.position.y = 0.17;
  g.add(body, handle);
  return g;
}

function buildKettle() {
  const g = new THREE.Group();
  const m = B.mat('#9a9a94', { roughness: 0.35, metalness: 0.7 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.17, 18).translate(0, 0.085, 0), m);
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.17, 0), m);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.12, 8).rotateZ(-0.9).translate(0.11, 0.12, 0), m);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 14, Math.PI).translate(0, 0.2, 0), B.mat('#1f1d1a'));
  for (const o of [body, lid, spout, handle]) {
    o.castShadow = true;
    g.add(o);
  }
  return g;
}

/** Glass for the high window: weak grey daylight, grime and slow rain streaks (no NaN paths). */
function windowGlassMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uRain: { value: 1 }, uBright: { value: 1 } },
    fog: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uRain, uBright;
      varying vec2 vUv;
      float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        vec2 uv = vUv;
        vec3 sky = mix(vec3(0.30, 0.33, 0.35), vec3(0.42, 0.44, 0.45), uv.y);
        // The building opposite, a dark band across the bottom.
        sky = mix(vec3(0.12, 0.12, 0.12), sky, smoothstep(0.18, 0.32, uv.y + 0.03 * sin(uv.x * 9.0)));
        float grime = vn(uv * vec2(9.0, 5.0)) * 0.6 + vn(uv * vec2(23.0, 13.0)) * 0.4;
        float edge = smoothstep(0.35, 0.0, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
        vec3 col = sky * (1.0 - 0.45 * grime - 0.35 * edge);
        col = mix(col, vec3(0.22, 0.18, 0.12), 0.25 * edge);
        // Rain trails sliding down the glass.
        float x = uv.x * 34.0;
        float id = floor(x);
        float fx = fract(x) - 0.5;
        float sp = 0.05 + 0.08 * h1(id * 1.7);
        float y = fract(uv.y + uTime * sp + h1(id * 9.1));
        float trail = (1.0 - smoothstep(0.0, 0.08, abs(fx))) * smoothstep(0.0, 0.25, y) * (1.0 - smoothstep(0.25, 0.9, y));
        col += vec3(0.10, 0.11, 0.12) * trail * step(0.55, h1(id * 3.3)) * uRain;
        gl_FragColor = vec4(max(col, vec3(0.0)) * uBright, 1.0);
      }`,
  });
}

// ------------------------------------------------------------------ builder

export async function buildScene4(ctx) {
  const { assets } = ctx;
  const group = new THREE.Group();
  group.name = 'scene4';
  const capColor = 0x2a2622;

  // ---- floor, under-slab (the dollhouse cut), invisible shadow casters
  group.add(B.ground({ size: [W, D], map: floorTexture(), color: '#ffffff', roughness: 0.86, metalness: 0.04, noise: false }));
  group.add(merged([bx(-OUT_X, OUT_X, -2.6, -0.01, -D / 2 - T / 2, FRONT_Z + 0.02)], B.mat('#2c2824', { roughness: 1 }), { castShadow: false, name: 'under-slab' }));
  const shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const ceiling = new THREE.Mesh(bx(-OUT_X - 0.2, OUT_X + 0.2, H, H + 0.14, -D / 2 - 0.3, FRONT_Z + 0.05), shadowOnly);
  ceiling.castShadow = true;
  ceiling.name = 'ceiling-shadow-caster';
  const fourth = new THREE.Mesh(bx(-OUT_X, OUT_X, 0.0, H, FRONT_Z + 0.02, FRONT_Z + 0.12), shadowOnly);
  fourth.castShadow = true;
  fourth.name = 'fourth-wall-shadow-caster';
  group.add(ceiling, fourth);

  // ---- walls (one merged grimy mesh) with the doorway, the high window and the garage opening
  const uvs = [1 / 4.5, 1 / H];
  const o = { cap: capColor, uv: uvs };
  const zb0 = -D / 2 - T / 2;
  const walls = [
    // back
    slab(-OUT_X, WIN.x0, 0, H, zb0, BACK_Z, o),
    slab(WIN.x0, WIN.x1, 0, WIN.y0, zb0, BACK_Z, o),
    slab(WIN.x0, WIN.x1, WIN.y1, H, zb0, BACK_Z, o),
    slab(WIN.x1, DOORWAY.x0, 0, H, zb0, BACK_Z, o),
    slab(DOORWAY.x0, DOORWAY.x1, DOORWAY.h, H, zb0, BACK_Z, o),
    slab(DOORWAY.x1, OUT_X, 0, H, zb0, BACK_Z, o),
    // left (street side)
    slab(-OUT_X, -IN_X, 0, H, BACK_Z, GARAGE.z0, o),
    slab(-OUT_X, -IN_X, GARAGE.h, H, GARAGE.z0, GARAGE.z1, o),
    slab(-OUT_X, -IN_X, 0, H, GARAGE.z1, FRONT_Z, o),
    // right
    slab(IN_X, OUT_X, 0, H, BACK_Z, FRONT_Z, o),
  ];
  const wallTex = wallTexture();
  group.add(merged(walls, B.mat('#ffffff', { map: wallTex, vertexColors: true, roughness: 0.93 }), { name: 'walls' }));

  // Skirting + door frame trim + window frame (one mesh).
  const trim = [
    slab(-IN_X, DOORWAY.x0 - 0.06, 0, 0.12, BACK_Z, BACK_Z + 0.02),
    slab(DOORWAY.x1 + 0.06, IN_X, 0, 0.12, BACK_Z, BACK_Z + 0.02),
    slab(IN_X - 0.02, IN_X, 0, 0.12, BACK_Z + 0.02, FRONT_Z - 0.01),
    slab(DOORWAY.x0 - 0.07, DOORWAY.x0, 0, DOORWAY.h + 0.07, BACK_Z, BACK_Z + 0.035),
    slab(DOORWAY.x1, DOORWAY.x1 + 0.07, 0, DOORWAY.h + 0.07, BACK_Z, BACK_Z + 0.035),
    slab(DOORWAY.x0, DOORWAY.x1, DOORWAY.h, DOORWAY.h + 0.07, BACK_Z, BACK_Z + 0.035),
    slab(WIN.x0 - 0.06, WIN.x1 + 0.06, WIN.y0 - 0.05, WIN.y0, BACK_Z, BACK_Z + 0.06),
    slab(WIN.x0 - 0.06, WIN.x1 + 0.06, WIN.y1, WIN.y1 + 0.05, BACK_Z, BACK_Z + 0.03),
    ...[0.25, 0.5, 0.75].map((k) => slab(WIN.x0 + (WIN.x1 - WIN.x0) * k - 0.012, WIN.x0 + (WIN.x1 - WIN.x0) * k + 0.012, WIN.y0, WIN.y1, -3.0, -2.97)),
    slab(WIN.x0, WIN.x1, (WIN.y0 + WIN.y1) / 2 - 0.012, (WIN.y0 + WIN.y1) / 2 + 0.012, -3.0, -2.97),
  ];
  group.add(merged(trim, B.mat('#6e675a', { roughness: 0.75 }), { castShadow: false, name: 'trim' }));

  const glassMat = windowGlassMaterial();
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0), glassMat);
  glass.position.set((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, -3.01);
  glass.name = 'high-window';
  group.add(glass);

  // Behind the internal doorway: the dim stairwell up to Hugo's flat.
  const stairMat = B.mat('#6a6156', { roughness: 0.95, side: THREE.BackSide, emissive: '#0f0b08' });
  const well = new THREE.Mesh(bx(DOORWAY.x0 - 0.3, DOORWAY.x1 + 0.6, 0, 2.7, -4.4, zb0 - 0.001), stairMat);
  well.receiveShadow = true;
  group.add(well);
  const steps = [];
  for (let i = 0; i < 6; i++) steps.push(bx(DOORWAY.x0 - 0.3, DOORWAY.x1 - 0.1, 0, 0.17 * (i + 1), -4.4, -4.4 + 0.2 * (6 - i)));
  group.add(merged(steps, B.mat('#5a5148', { roughness: 0.9, emissive: '#0c0906' }), { castShadow: false, name: 'stairs' }));

  // ---- outside: the street under the garage door, and the rest of the building on the right
  const street = B.ground({ size: [8, 11], pos: [-OUT_X - 4, -2.5], map: streetTexture(), color: '#ffffff', roughness: 0.55, metalness: 0.12, noise: false, y: -0.004 });
  group.add(street);
  const facadeTex = B.grimeTexture({ w: 1024, h: 512, base: '#7a756c', seed: 88, tags: 5, posters: 4, stains: 10, drips: 10 });
  const facade = B.box(0.3, 7, 11, { pos: [-OUT_X - 6.2, 0, -2.5], color: '#ffffff', map: facadeTex, roughness: 0.95 });
  facade.castShadow = false;
  group.add(facade);
  group.add(B.box(0.25, 0.14, 11, { pos: [-OUT_X - 1.4, 0, -2.5], color: '#7a7670', roughness: 0.9, castShadow: false })); // kerb
  const shutter = B.box(0.06, 2.6, 3.2, { pos: [-OUT_X - 6.0, 0, 0.4], color: '#ffffff', map: garageTexture(), roughness: 0.6, metalness: 0.3, castShadow: false });
  group.add(shutter);
  const mass = merged([slab(OUT_X, OUT_X + 7, -2.6, H + 0.4, -D / 2 - 3, FRONT_Z, { cap: capColor, uv: uvs })], B.mat('#6a645a', { map: wallTex, vertexColors: true, roughness: 0.95 }), {
    castShadow: false,
    name: 'building-mass',
  });
  group.add(mass);

  // ---- the roll-up garage door, half open, and its drum
  const garageMat = B.mat('#ffffff', { map: garageTexture(), roughness: 0.6, metalness: 0.25, side: THREE.DoubleSide });
  const gdoor = new THREE.Mesh(bx(-IN_X + 0.02, -IN_X + 0.06, GARAGE.open, GARAGE.h + 0.02, GARAGE.z0 - 0.02, GARAGE.z1 + 0.02), garageMat);
  gdoor.castShadow = true;
  gdoor.receiveShadow = true;
  group.add(gdoor);
  group.add(merged([new THREE.CylinderGeometry(0.16, 0.16, GARAGE.z1 - GARAGE.z0 + 0.1, 16).rotateX(Math.PI / 2).translate(-IN_X + 0.2, GARAGE.h + 0.18, (GARAGE.z0 + GARAGE.z1) / 2)], B.mat('#4a4c4a', { roughness: 0.6, metalness: 0.4 })));
  group.add(merged([bx(-IN_X + 0.02, -IN_X + 0.09, GARAGE.open - 0.05, GARAGE.open, GARAGE.z0, GARAGE.z1)], B.mat('#3a3c3a', { roughness: 0.5, metalness: 0.5 }), { castShadow: false })); // bottom rail

  // ---- the main bench + vice, shelf, trestles, work stand (procedural, merged per material)
  const woodTex = tiled(B.noiseTexture({ base: '#ffffff', spread: 0.1, size: 256, blotches: 6 }), 2, 2);
  const benchWood = B.mat('#80684c', { map: woodTex, roughness: 0.9 });
  const darkMetal = B.mat('#4a4d50', { roughness: 0.55, metalness: 0.55 });
  const benchParts = [
    bx(BENCH.x0, BENCH.x1, BENCH.top - 0.08, BENCH.top, BENCH.z0, BENCH.z1), // top
    bx(BENCH.x0, BENCH.x1, 0.22, 0.26, BENCH.z0 + 0.04, BENCH.z1 - 0.05), // low shelf
    bx(BENCH.x0, BENCH.x1, BENCH.top, BENCH.top + 0.16, BENCH.z0, BENCH.z0 + 0.025), // splash-back
  ];
  for (const x of [BENCH.x0 + 0.06, BENCH.x1 - 0.06, (BENCH.x0 + BENCH.x1) / 2]) for (const z of [BENCH.z0 + 0.06, BENCH.z1 - 0.06]) benchParts.push(bx(x - 0.04, x + 0.04, 0, BENCH.top - 0.08, z - 0.04, z + 0.04));
  // Paint shelf against the back wall (x -0.55 .. 0.35).
  const SH = { x0: -0.55, x1: 0.35, z0: BACK_Z, z1: BACK_Z + 0.36 };
  for (const y of [0.05, 0.55, 1.05, 1.55, 2.0]) benchParts.push(bx(SH.x0, SH.x1, y, y + 0.03, SH.z0, SH.z1));
  for (const x of [SH.x0, SH.x1 - 0.03]) benchParts.push(bx(x, x + 0.03, 0, 2.03, SH.z0, SH.z1));
  // Trestles: two A-frame sawhorses.
  for (const dx of [-0.75, 0.75]) {
    const x = TRESTLE.x + dx;
    benchParts.push(bx(x - 0.05, x + 0.05, TRESTLE.top - 0.07, TRESTLE.top, TRESTLE.z - 0.42, TRESTLE.z + 0.42));
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) benchParts.push(rbox(0.045, 0.78, 0.045, x + sx * 0.11, 0.36, TRESTLE.z + sz * 0.3, 0, 0, sx * 0.28));
  }
  group.add(merged(benchParts, benchWood, { name: 'benches' }));
  const metalParts = [
    // Vice on the right end of the bench.
    bx(-1.05, -0.85, BENCH.top, BENCH.top + 0.12, -2.22, -2.06),
    bx(-1.05, -0.85, BENCH.top + 0.02, BENCH.top + 0.1, -2.04, -1.98),
    bx(-0.97, -0.93, BENCH.top + 0.05, BENCH.top + 0.07, -1.98, -1.84),
    // Work stand: tripod, post, arm, clamp.
    bx(STAND.x - 0.28 - 0.02, STAND.x - 0.28 + 0.02, 0, 1.08, STAND.z - 0.24, STAND.z - 0.2),
    bx(STAND.x - 0.28 - 0.02, STAND.x - 0.28 + 0.02, 1.04, 1.08, STAND.z - 0.24, STAND.z),
    bx(STAND.x - 0.31, STAND.x - 0.25, 1.0, 1.12, STAND.z - 0.035, STAND.z + 0.035),
    rbox(0.03, 0.03, 0.6, STAND.x - 0.28, 0.03, STAND.z - 0.22, 0, 0, 0),
    rbox(0.6, 0.03, 0.03, STAND.x - 0.28, 0.03, STAND.z - 0.22, 0, 0, 0),
    // Fluorescent fixture housing.
    bx(TUBE.x - 0.66, TUBE.x + 0.66, TUBE.y, TUBE.y + 0.06, TUBE.z - 0.07, TUBE.z + 0.07),
    bx(TUBE.x - 0.01, TUBE.x + 0.01, TUBE.y + 0.06, H, TUBE.z - 0.01, TUBE.z + 0.01),
  ];
  group.add(merged(metalParts, darkMetal, { name: 'metalwork' }));

  // Pegboard above the bench.
  const peg = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.15), new THREE.MeshStandardMaterial({ map: pegboardTexture(), roughness: 0.9 }));
  peg.position.set(-2.62, 1.75, BACK_Z + 0.012);
  peg.receiveShadow = true;
  group.add(peg);
  group.add(merged([bx(-3.52, -1.72, 1.15, 2.35, BACK_Z, BACK_Z + 0.01)], B.mat('#4a3c2c'), { castShadow: false })); // board edge
  const sandpaper = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.12), B.mat('#c8b48a', { roughness: 1 }));
  // Pegboard canvas px -> world: x = peg.x + (u/768 - .5) * 1.75, y = peg.y + (.5 - v/512) * 1.15
  const pegAt = (u, v) => [peg.position.x + (u / 768 - 0.5) * 1.75, peg.position.y + (0.5 - v / 512) * 1.15];
  {
    const [x, y] = pegAt(635, 440);
    sandpaper.position.set(x, y, BACK_Z + 0.022);
    sandpaper.rotation.z = 0.06;
  }
  group.add(sandpaper);

  // Fluorescent tube (emissive) and the bare bulb with its cord.
  const tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#cfe6d0'), toneMapped: true, fog: false });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.2, 10).rotateZ(Math.PI / 2), tubeMat);
  tube.position.set(TUBE.x, TUBE.y - 0.02, TUBE.z);
  group.add(tube);
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd7a0').multiplyScalar(2.2), fog: false });
  const bulbRig = new THREE.Group();
  bulbRig.position.set(BULB.x, H, BULB.z);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, H - BULB.y, 6).translate(0, -(H - BULB.y) / 2, 0), B.mat('#1a1816'));
  const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.05, 10).translate(0, -(H - BULB.y) - 0.01, 0), B.mat('#2a2826'));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12).translate(0, -(H - BULB.y) - 0.06, 0), bulbMat);
  bulbRig.add(cord, holder, bulb);
  group.add(bulbRig);

  // ---- lights (the Mood preset supplies the hemi ambient, grey daylight and the camera fill)
  const bulbSpot = new THREE.SpotLight(0xffb36b, 30, 13, 1.2, 0.85, 2);
  bulbSpot.position.set(BULB.x, BULB.y - 0.08, BULB.z);
  bulbSpot.target.position.set(BULB.x - 0.2, 0, BULB.z + 0.3);
  bulbSpot.castShadow = true;
  bulbSpot.shadow.mapSize.set(1024, 1024);
  bulbSpot.shadow.bias = -0.0008;
  bulbSpot.shadow.normalBias = 0.02;
  bulbSpot.shadow.camera.near = 0.2;
  bulbSpot.shadow.camera.far = 12;
  const bulbGlow = B.pointLight(0xffb36b, 4.5, { pos: [BULB.x, BULB.y - 0.06, BULB.z], distance: 7 });
  const tubeLight = B.pointLight(0xcfe6d0, 5.5, { pos: [TUBE.x, TUBE.y - 0.2, TUBE.z + 0.2], distance: 6 });
  const windowLight = B.pointLight(0x9aa6b0, 2.2, { pos: [(WIN.x0 + WIN.x1) / 2, 2.4, -2.5], distance: 4.5 });
  const streetLight = B.pointLight(0x9fb0c0, 6, { pos: [-OUT_X - 1.6, 1.4, -0.1], distance: 9 });
  group.add(bulbSpot, bulbSpot.target, bulbGlow, tubeLight, windowLight, streetLight);

  // ---- paint tins (one instanced mesh, drips on a white label so colour tints them)
  const tinColors = ['#a3392b', '#b8893a', '#4a6a8a', '#d9cfb4', '#5f7a4a', '#8d877c', '#c46a3a', '#2f3a4a', '#e0dccf', '#7a4a36'];
  const tinItems = [];
  const R = B.rng(9);
  for (const y of [0.08, 0.58, 1.08, 1.58]) {
    let x = SH.x0 + 0.1;
    while (x < SH.x1 - 0.1) {
      if (R() < 0.82) tinItems.push({ x, y, z: SH.z0 + 0.12 + R() * 0.14, s: 0.8 + R() * 0.5 });
      x += 0.15 + R() * 0.05;
    }
  }
  for (let i = 0; i < 4; i++) tinItems.push({ x: 1.02 + i * 0.09, y: 0.8, z: -2.68 + R() * 0.25, s: 0.6 + R() * 0.3 });
  for (let i = 0; i < 5; i++) tinItems.push({ x: TRESTLE.x - 0.6 + R() * 1.6, y: 0, z: TRESTLE.z + (R() < 0.5 ? -0.58 : 0.12) + R() * 0.1, s: 1 + R() * 0.4 });
  tinItems.push({ x: -1.35, y: BENCH.top, z: -2.75, s: 1.1 }, { x: -3.3, y: BENCH.top, z: -2.6, s: 1.2 });
  const tinGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.13, 14).translate(0, 0.065, 0);
  const tins = B.scatter(
    tinGeo,
    new THREE.MeshStandardMaterial({ map: tinTexture(), roughness: 0.55, metalness: 0.2 }),
    tinItems.length,
    (i, dummy, color) => {
      const t = tinItems[i];
      dummy.position.set(t.x, t.y + 0.001, t.z);
      dummy.rotation.y = R() * 6.28;
      dummy.scale.set(t.s, t.s * (0.9 + R() * 0.4), t.s);
      color.set(tinColors[(R() * tinColors.length) | 0]);
    },
    { castShadow: false, receiveShadow: true },
  );
  group.add(tins);
  // Rags: crumpled cloth on the bench, the trestle and the floor.
  const rags = [];
  for (const [x, y, z, r] of [
    [-2.1, BENCH.top, -2.45, 0.3],
    [TRESTLE.x + 0.9, TRESTLE.top - 0.07, TRESTLE.z + 0.32, -0.4],
    [1.9, 0, -1.6, 0.9],
    [-3.0, 0, 0.9, 0.2],
  ]) {
    rags.push(rbox(0.26, 0.025, 0.2, x, y + 0.012, z, 0.08, r, 0.05), rbox(0.14, 0.03, 0.12, x + 0.05, y + 0.03, z - 0.02, -0.1, r + 0.6, 0.1));
  }
  group.add(merged(rags, B.mat('#a89c86', { roughness: 1 }), { castShadow: false, name: 'rags' }));

  // ---- Kenney props (every load fails soft to a grey box of the right size)
  const P = (path, opts) => assets.prop(`kenney/${path}.glb`, opts);
  const [
    drum,
    drumOpen,
    crateL,
    crate,
    crateOpen,
    chest,
    smallBench,
    grinder,
    anvil,
    hammer,
    axe,
    shovel,
    planks,
    wood,
    panel,
    panelScrews,
    bottleA,
    bottleB,
    bottleC,
    bucket,
    pallet,
    cables,
    chair,
    lamp,
    sideTable,
    kettleBox,
  ] = await Promise.all([
    P('survival/barrel', { height: 0.9, tint: '#8a7a6a' }),
    P('survival/barrel-open', { height: 0.86, tint: '#7a6a5e' }),
    P('survival/box-large', { height: 0.5 }),
    P('survival/box', { height: 0.42, castShadow: false }),
    P('survival/box-open', { height: 0.5, castShadow: false }),
    P('survival/chest', { height: 0.36, castShadow: false }),
    P('survival/workbench', { height: 0.8, castShadow: false }),
    P('survival/workbench-grind', { height: 0.4, castShadow: false }),
    P('survival/workbench-anvil', { height: 0.62 }),
    P('survival/tool-hammer', { height: 0.34, castShadow: false }),
    P('survival/tool-axe', { height: 0.62, castShadow: false }),
    P('survival/tool-shovel', { height: 1.0, castShadow: false }),
    P('survival/resource-planks', { height: 0.16, castShadow: false }),
    P('survival/resource-wood', { height: 0.12, castShadow: false }),
    P('survival/metal-panel', { height: 1.1, castShadow: false }),
    P('survival/metal-panel-screws', { height: 1.0, castShadow: false }),
    P('survival/bottle-large', { height: 0.3, castShadow: false }),
    P('survival/bottle-large', { height: 0.26, castShadow: false }),
    P('survival/bottle-large', { height: 0.3, castShadow: false }),
    P('survival/bucket', { height: 0.32, castShadow: false }),
    P('retro/pallet-small', { height: 0.14, castShadow: false }),
    P('retro/detail-cables-type-a', { width: 1.1, castShadow: false }),
    P('furniture/chair', { height: 0.95 }),
    P('furniture/lampRoundFloor', { height: 1.55, castShadow: false }),
    P('furniture/sideTable', { height: 0.52, castShadow: false }),
    P('survival/box', { height: 0.45, castShadow: false }),
  ]);
  const place = (obj, x, y, z, rotY = 0) => {
    obj.position.set(x, y, z);
    obj.rotation.y = rotY;
    group.add(obj);
    return obj;
  };
  place(drum, -4.08, 0, -2.58, 0.4);
  place(drumOpen, -4.1, 0, -1.92, 1.2);
  place(crateL, -4.08, 0, 2.5, 0.1);
  place(crate, -4.05, 0.5, 2.5, -0.3);
  place(crateOpen, -3.6, 0, 2.62, 0.5);
  place(chest, -2.6, 0, -2.56, 0);
  place(smallBench, 1.35, 0, -2.5, 0);
  place(grinder, 1.5, 0.8, -2.5, Math.PI);
  place(anvil, -3.95, 0, 1.58, 0.6);
  // Hung on the pegboard over their painted outlines.
  {
    const [hx, hy] = pegAt(68, 290);
    place(hammer, hx, hy - 0.2, BACK_Z + 0.055, 0);
    const [ax, ay] = pegAt(170, 340);
    place(axe, ax, ay - 0.15, BACK_Z + 0.06, 0);
    const [sx, sy] = pegAt(258, 440);
    place(shovel, sx, sy - 0.2, BACK_Z + 0.08, 0);
  }
  place(planks, 2.38, 0, -2.56, Math.PI / 2);
  place(wood, 2.2, 0.16, -2.55, 0.3);
  // Panels leaning on the right wall by the doorway.
  for (const [pn, x, z, yaw, lean] of [
    [panel, 4.3, -2.3, -Math.PI / 2, -0.12],
    [panelScrews, 4.2, -2.22, -Math.PI / 2 + 0.12, -0.1],
  ]) {
    place(pn, x, 0, z, yaw);
    pn.rotation.order = 'YXZ';
    pn.rotation.x = lean; // top rests on the wall
  }
  place(bottleA, -3.32, BENCH.top, -2.74, 0);
  place(bottleB, -3.18, BENCH.top, -2.66, 0.4);
  place(bottleC, 1.7, 0.8, -2.68, 0);
  place(bucket, -0.85, 0, -0.45, 0.2);
  place(pallet, 4.1, 0, -1.05, -Math.PI / 2 + 0.1);
  place(cables, 0.75, 0.004, -1.55, 0.35);
  // Odile's corner: chair facing into the room, lamp, side table with the radio, kettle on a box.
  place(chair, 3.62, 0, 1.25, -0.95);
  place(lamp, 4.12, 0, 0.62, -0.6);
  place(sideTable, 4.02, 0, 2.0, -Math.PI / 2);
  place(kettleBox, 4.12, 0, 2.65, 0.2);
  const radio = buildRadio();
  place(radio, 4.0, sideTable.userData.size.y, 1.98, -1.2);
  const kettle = buildKettle();
  place(kettle, 4.08, kettleBox.userData.size.y, 2.62, 0.8);

  // ---- the old signs leaning against the right wall
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
    const s = B.sign(text, w, h, { ...signStyles[i % 3], weathered: 0.7, pad: 0.1, border: 'rgba(0,0,0,0.25)' });
    s.position.set(0, h / 2, 0.016);
    const backing = new THREE.Mesh(bx(-w / 2 - 0.02, w / 2 + 0.02, -0.01, h + 0.02, -0.012, 0.012), B.mat('#4a3a2a', { roughness: 0.9 }));
    backing.castShadow = true;
    sg.add(backing, s);
    sg.rotation.order = 'YXZ';
    sg.rotation.y = -Math.PI / 2 + 0.38;
    sg.rotation.x = -0.16;
    sg.position.set(4.05 - i * 0.07, 0.0, -1.0 + i * 0.18);
    group.add(sg);
  });

  // ---- story objects
  const door = buildDoor();
  group.add(door.group);
  const tapeMat = B.mat('#d6b23a', { roughness: 0.5 });
  const tape = new THREE.Group();
  tape.add(new THREE.Mesh(bx(DOORWAY.x0, DOORWAY.x1, 0.92, 0.94, BACK_Z + 0.02, BACK_Z + 0.025), tapeMat), new THREE.Mesh(bx(DOORWAY.x0 - 0.04, DOORWAY.x0 + 0.05, 0.88, 0.97, BACK_Z + 0.02, BACK_Z + 0.06), B.mat('#2a2a2c')));
  tape.visible = false;
  group.add(tape);

  const sbike = rigBike(B.bicycle({ frame: '#8a2b22', rust: 0.2 }));
  sbike.group.visible = false;
  group.add(sbike.group);
  const raceBike = B.bicycle({ rust: 0.3 });
  raceBike.visible = false;
  raceBike.rotation.y = Math.PI / 2;
  raceBike.position.set(STAND.x, STAND.lift, STAND.z);
  group.add(raceBike);

  const board = buildBoard();
  board.group.position.set(EASEL.x, BENCH.top, EASEL.z);
  board.group.visible = false;
  group.add(board.group);

  // ---- characters (released automatically at chapter end)
  const odile = assets.makeCharacter({ tint: '#9a7a4e', scale: 0.94, name: 'Odile' });
  const sami = assets.makeCharacter({ tint: '#c24a3a', scale: 0.72, name: 'Sami' });
  odile.root.position.set(1.7, 0, -1.25);
  sami.root.visible = false;
  sami.root.position.set(-OUT_X - 3, 0, 0);
  group.add(odile.root, sami.root);
  odile.play('idle');
  sami.play('idle');

  // Soft blob shadows so the figures sit on the floor where the bulb's shadow doesn't reach.
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: false });
  const blobGeo = new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2);
  const blobs = [ctx.player?.root, odile.root, sami.root].map((target) => {
    const m = new THREE.Mesh(blobGeo, blobMat);
    m.renderOrder = 1;
    m.userData.target = target;
    group.add(m);
    return m;
  });

  // Dust in the bulb's cone.
  const DUST = 70;
  const dustBase = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    const a = R() * Math.PI * 2;
    const r = Math.sqrt(R()) * 1.6;
    dustBase[i * 3] = BULB.x + Math.cos(a) * r;
    dustBase[i * 3 + 1] = 0.5 + R() * 1.9;
    dustBase[i * 3 + 2] = BULB.z + Math.sin(a) * r * 0.8;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustBase.slice(), 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ color: 0xffd9b0, size: 0.014, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  dust.frustumCulled = false;
  group.add(dust);

  // The camera rig: a softened, clamped stand-in for the player so the frame never swings into
  // the void beside the room.
  const camRig = new THREE.Object3D();
  camRig.name = 'cam-rig';
  group.add(camRig);

  // ------------------------------------------------------------------ live state
  const tubeState = { mode: 'flicker', level: 1, t: 0, off: 0, next: 1.5 };
  let rainLevel = 1;
  let t = 0;
  const player = ctx.player;
  const audio = ctx.audio;
  const v = new THREE.Vector3();
  const TUBE_COLOR = new THREE.Color('#cfe6d0'); // parsed once, not every frame

  function updateTube(raw) {
    const s = tubeState;
    let target = 1;
    if (s.mode === 'off') target = 0;
    else if (s.mode === 'flicker') {
      s.next -= raw;
      if (s.next <= 0 && s.off <= 0) {
        s.off = 0.05 + R() * (R() < 0.3 ? 0.6 : 0.15);
        s.next = 0.6 + R() * 3.5;
        if (R() < 0.6) audio?.tone?.({ freq: 120, to: 100, dur: 0.06, type: 'square', volume: 0.025 });
      }
      if (s.off > 0) {
        s.off -= raw;
        target = R() < 0.5 ? 0.05 : 0.35;
      } else target = 0.92 + 0.05 * Math.sin(t * 50);
    }
    s.level = s.mode === 'flicker' ? target : damp(s.level, target, 10, raw);
    tubeLight.intensity = 5.5 * s.level;
    tubeMat.color.copy(TUBE_COLOR).multiplyScalar(0.25 + 1.6 * s.level);
  }

  function update(dt, raw) {
    t += raw;
    // Camera rig: clamped and softened player position.
    if (player?.root) {
      const p = player.root.position;
      camRig.position.x = damp(camRig.position.x, clamp(p.x * 0.7, -1.1, 1.1), 5, raw);
      camRig.position.z = damp(camRig.position.z, clamp(p.z, -1.4, 1.9), 5, raw);
    }
    updateTube(raw);
    // The bulb sways a hair on its cord; light and shadow follow.
    bulbRig.rotation.z = 0.025 * Math.sin(t * 0.7);
    bulbRig.rotation.x = 0.018 * Math.sin(t * 0.53 + 1);
    bulb.getWorldPosition(v);
    bulbSpot.position.copy(v);
    bulbGlow.position.copy(v);
    const flick = 0.97 + 0.03 * Math.sin(t * 13.1) * Math.sin(t * 3.7);
    bulbSpot.intensity = 30 * flick;
    glassMat.uniforms.uTime.value = t;
    glassMat.uniforms.uRain.value = rainLevel;
    sbike.update(dt);
    board.update();
    for (const b of blobs) {
      const tg = b.userData.target;
      b.visible = !!tg && tg.visible;
      if (b.visible) b.position.set(tg.position.x, 0.006, tg.position.z);
    }
    const pa = dustGeo.attributes.position.array;
    for (let i = 0; i < DUST; i++) {
      const ph = i * 1.7;
      pa[i * 3] = dustBase[i * 3] + 0.08 * Math.sin(t * 0.12 + ph);
      pa[i * 3 + 1] = dustBase[i * 3 + 1] + 0.12 * Math.sin(t * 0.08 + ph * 1.3);
      pa[i * 3 + 2] = dustBase[i * 3 + 2] + 0.06 * Math.cos(t * 0.1 + ph);
    }
    dustGeo.attributes.position.needsUpdate = true;
  }

  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const boardCenter = () => board.face.getWorldPosition(new THREE.Vector3());
  return {
    group,
    // Walkable rectangles (union), carved around the bench, trestles, stand, signs and Odile's corner.
    bounds: [
      { minX: -3.6, maxX: -1.0, minZ: -1.85, maxZ: 1.15 }, // in front of the bench, the left middle
      { minX: -4.1, maxX: -3.5, minZ: -1.45, maxZ: 1.15 }, // by the garage door (past the drums)
      { minX: -1.2, maxX: -0.55, minZ: -1.85, maxZ: -0.9 }, // by the vice
      { minX: -0.65, maxX: 3.75, minZ: -1.9, maxZ: -0.9 }, // behind the trestles
      { minX: 3.0, maxX: 3.8, minZ: -2.65, maxZ: -1.8 }, // the internal doorway threshold
      { minX: 1.6, maxX: 3.75, minZ: -0.95, maxZ: 0.6 }, // right of the trestles
      { minX: -1.5, maxX: 3.05, minZ: 0.5, maxZ: 2.6 }, // front middle
      { minX: -3.55, maxX: -1.4, minZ: 1.85, maxZ: 2.6 }, // in front of the bike stand
    ],
    spots: {
      spawn: [DOOR_X, -2.4],
      pegboard: [-2.6, -1.62],
      door: [TRESTLE.x, 0.72],
      frame: [DOOR_X, -2.05],
      bike: [-2.15, 0.45],
      bench: [-0.92, -1.42],
      oldSigns: [3.45, -0.75],
      radio: [2.8, 1.85],
      // Where people stand for the beats.
      hugoSand: [TRESTLE.x - 0.15, 0.62],
      hugoFrame: [DOOR_X, -2.32],
      hugoBench: [EASEL.x, -1.75],
      hugoBikeStand: [STAND.x - 0.55, STAND.z - 0.55],
      hugoSign: [2.45, -2.0],
      odileSign: [1.6, -1.35],
      odileTrestle: [1.75, -1.2],
      odileBench: [EASEL.x, -1.78],
      odileAside: [-2.42, -1.62],
      odileChair: [3.45, 1.05],
      samiParked: [-3.35, 0.6],
      samiHold: [STAND.x + 0.65, STAND.z - 0.45],
      samiOutside: [-OUT_X - 3.2, 0.1],
    },
    // Fixed camera shots for the craft beats ({pos, look, fov}).
    shots: {
      sand: { pos: [1.75, 1.85, 1.2], look: [TRESTLE.x, 0.76, TRESTLE.z], fov: 42 },
      paint: { pos: [1.4, 1.62, 0.95], look: [TRESTLE.x - 0.1, 0.77, TRESTLE.z], fov: 40 },
      frame: { pos: [1.85, 1.35, -1.25], look: [DOOR_X, 0.95, BACK_Z - 0.05], fov: 46 },
      // From behind and beside the rear wheel, so its sideways wander reads; wheel left of the ring.
      truing: { pos: [STAND.x - 1.4, 0.95, STAND.z + 0.55], look: [STAND.x - 0.4, STAND.lift + 0.37, STAND.z + 0.28], fov: 42 },
      samiIn: { pos: [-0.9, 1.95, 2.6], look: [-3.9, 0.95, 0.1], fov: 50 },
      threeShot: { pos: [0.9, 2.1, 2.9], look: [-2.0, 1.0, -0.4], fov: 52 },
      bikeTalk: { pos: [-0.9, 1.75, 2.9], look: [-2.6, 0.95, 1.0], fov: 48 },
      bench: { pos: [0.45, 1.7, -0.35], look: [EASEL.x + 0.2, 1.05, -2.35], fov: 46 },
      hungDoor: { pos: [1.9, 1.7, 0.2], look: [DOOR_X - 0.1, 1.3, BACK_Z], fov: 44 },
      lettering() {
        const c = boardCenter();
        return { pos: [c.x, c.y + 0.03, c.z + 0.88], look: [c.x, c.y, c.z], fov: 30 };
      },
    },
    update,
    door,
    bike: sbike,
    raceBike,
    board,
    tape,
    odile,
    sami,
    camRig,
    stand: STAND,
    doorX: DOOR_X,
    /** Fluorescent tube: 'flicker' | 'on' | 'off'. */
    fluoro(mode) {
      tubeState.mode = mode === true ? 'on' : mode === false ? 'off' : mode;
    },
    /** Rain on the high window, 0..1. */
    rain(level) {
      rainLevel = level;
    },
    takeSandpaper() {
      sandpaper.visible = false;
    },
    /** Put Sami's bike on the work stand (side-on to the camera, front wheel toward +X). */
    bikeOnStand() {
      sbike.follow(null);
      const g = sbike.group;
      g.visible = true;
      g.rotation.set(0, Math.PI / 2, 0);
      g.position.set(STAND.x, STAND.lift, STAND.z);
    },
    /** Park Sami's bike on the floor at (x, z) facing rotY. */
    parkBike(x, z, rotY = Math.PI / 2) {
      sbike.follow(null);
      const g = sbike.group;
      g.visible = true;
      g.rotation.set(0, rotY, 0);
      g.position.set(x, 0, z);
    },
    /** The door goes back into its frame. */
    hangDoor() {
      door.hang();
    },
    /** The OPEN sign goes on the door he painted, facing +Z. */
    hangSign() {
      board.easel.visible = false;
      board.setBrush(false);
      board.group.visible = true;
      board.group.position.set(DOOR_X, 1.3, -D / 2 + 0.06);
      board.group.rotation.set(0, 0, 0);
    },
    showBoard(on) {
      board.group.visible = on;
    },
    /** World point on the rear wheel axle of the bike on the stand. */
    rearWheel: () => V3(STAND.x - 0.5, STAND.lift + 0.34, STAND.z),
  };
}
