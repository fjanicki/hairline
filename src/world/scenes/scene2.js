import * as THREE from 'three';
import { ground, box, mat, pointLight, sign, canvasTexture, instancedBoxes, grimeTexture, rain as makeRain, rng as seeded } from '../build.js';

// Rue des Tanneurs. Built for Ch2 ("Never Stop": late evening, rain) and Ch5 ("The Wall": day,
// then golden hour) from one STREET CONTRACT (docs/DESIGN.md):
//
//   buildScene2(ctx, { variant: 'evening' | 'wall' })
//
// Layout (metres; the player walks toward -Z; spawn z +8..+3):
//   road + sidewalks     x -6..6, z +14..-48 (Kenney road tiles); facades at |x| = 5.95
//   left  (x < 0)        bakery (Benali) z -5.7..-12 | BLIND WALL z -12..-32, h 8, face +X | Marco's kebab z -32..-36.3
//                        | bench [-5.32, -36.5] | row houses to -48
//   right (x > 0)        row | gable with the MARCHAL & FILLE ghost sign z -6.3..-13.7 (sign at z -10, high)
//                        | row | doorway with the buzzing tube z -20.3..-24.5 | row | CYCLES DURAND z -31.3..-36.7 | row
//   end of the street    No. 14 at z -48 (facade faces +Z): the workshop garage door x -1.6..1.6 (h 2.7) under a deep
//                        awning, the fascia above it, Hugo's lit third-floor window. Interior room x -2.6..2.6, z -48..-53.2.
//   evening only         STRIDE billboard on the blind wall (z -18, high), Odile's scaffold tower at [-1, -46.2],
//                        Odile on it, the five-runner club (hidden until Ch2 needs them), rain.
//   wall only            primed wall + the neighbours' mural panels (z -12..-32, y 1.8..4.3), the pale billboard
//                        rectangle with bolt holes above them, the garage door fully open, no rain, no street lights.
//
// Extras on the returned object (both variants unless noted):
//   seat, shots, interior, wallLine, fascia, lights, setRain(v), signs
//   evening: odile, tower, holdSpot, holdLeg, odileGround, wobble(amp), odileDown(), club[]
//   wall:    panels:[{id, mesh, z0, z1, color, setColor(k)}], setPanels(k), setGolden(), shopCardAt, boltHolesAt, nailPos

const SODIUM = 0xd9a35a;
const NEON = 0xff3d6e;
const TUBE = 0xcfe6d0;
const WARM = 0xffb36b;
const LAMP_INTENSITY = 60;
const FRONT_X = 5.95; // building facades
const LAMP_X = 5.75; // lamp poles, on the sidewalk outside the walkable rect
const WALL = { x: -5.95, z0: -12, z1: -32, h: 8 };
const BILLBOARD = { z: -18, y0: 4.7, w: 7.4, h: 3.0 };
const PANEL = { y0: 1.8, h: 2.5, gap: 0.2 };
const DOOR_Z = -48;
const GARAGE = { x0: -1.6, x1: 1.6, h: 2.7 };
const INTERIOR = { minX: -2.6, maxX: 2.6, minZ: -53.2, maxZ: -48, h: 3.1 };
const FACADE = { w: 28, h: 14 };
const TOWER = { x: -1, z: -46.2, size: 2, lift: 0.12 };
const SEAT = { x: -5.32, z: -36.5, facing: Math.PI / 2, standX: -4.8 };
const HOLD_LEG = [TOWER.x + 0.95, TOWER.z + 0.95]; // the tower's front-right leg
const HOLD_SPOT = [TOWER.x + 1.32, TOWER.z + 1.32];
const ODILE_GROUND = [1.8, -45.55]; // beside Hugo, not hidden behind him from shots.after

// Kenney city kit, native sizes [x (frontage), y, z (depth)]; fronts face -Z natively.
const BUILDINGS = {
  a: { size: [0.88, 1.29, 0.94], h: [9, 11.5] },
  b: { size: [0.98, 1.29, 0.94], h: [9, 11.5] },
  c: { size: [0.88, 0.89, 1.1], h: [8, 9] },
  d: { size: [0.84, 1.29, 0.9], h: [9, 11.5] },
  e: { size: [1.64, 0.89, 1.0], h: [8, 8.8] },
  f: { size: [0.84, 1.69, 1.03], h: [11.5, 14] },
  g: { size: [0.98, 1.69, 0.92], h: [11.5, 14] },
  h: { size: [0.88, 1.29, 1.0], h: [9, 11.5] },
};

// Street lamps (none in front of the blind wall: the Ch5 line runs along it). light: real PointLight.
const LAMPS = [
  { side: -1, z: 2, model: 'square', light: true },
  { side: 1, z: -4, model: 'curved', light: true },
  { side: -1, z: -9, model: 'square', light: true, flicker: true },
  { side: 1, z: -16, model: 'curved', light: true },
  { side: 1, z: -28, model: 'curved', light: true },
  { side: -1, z: -38.6, model: 'square', light: true }, // over the bench
  { side: 1, z: -41.6, model: 'curved', bulb: false }, // dead
  { side: -1, z: -45.6, model: 'square' },
];

const HANDWRITING = '"Bradley Hand", "Segoe Print", "Noteworthy", "Comic Sans MS", cursive';
const SANS = 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** '#rrggbb' + alpha -> 'rgba(...)'. */
function hexA(hex, a) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

/** Pack Kenney buildings along one side, inside [from, to] z segments (from > to). */
function packRow(side, segments, rng) {
  const keys = Object.keys(BUILDINGS);
  const out = [];
  for (const [from, to] of segments) {
    let z = from;
    for (let guard = 0; guard < 24; guard++) {
      const room = z - to;
      const order = [...keys].sort(() => rng() - 0.5);
      let pick = null;
      for (const k of order) {
        const b = BUILDINGS[k];
        for (const H of [b.h[0] + rng() * (b.h[1] - b.h[0]), b.h[0]]) {
          const w = (b.size[0] / b.size[1]) * H;
          if (w <= room) {
            pick = { k, H, w };
            break;
          }
        }
        if (pick) break;
      }
      if (!pick) {
        // Squeeze a shorter building into what is left (no narrow voids in the row).
        const k = 'd';
        const ratio = BUILDINGS[k].size[0] / BUILDINGS[k].size[1];
        const H = (room - 0.1) / ratio;
        if (H >= 4.5) pick = { k, H: Math.min(H, BUILDINGS[k].h[0]), w: Math.min(H, BUILDINGS[k].h[0]) * ratio };
      }
      if (!pick) break;
      out.push({ ...pick, side, z: z - pick.w / 2 });
      z -= pick.w + 0.12;
    }
  }
  return out;
}

/** Rotate a local offset (x, z) by rotation.y = r. */
function rotXZ(x, z, r) {
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [x * c + z * s, -x * s + z * c];
}

/** Desaturate the Kenney city palette (bright awnings) so the street stays drab. One copy per source image. */
function muteBuildingPalette(root, cache, amount = 0.72, darken = 0.86) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      const img = m.map?.image;
      if (!img || !img.width) continue;
      let tex = cache.get(img);
      if (!tex) {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const px = g.getImageData(0, 0, c.width, c.height);
        const d = px.data;
        for (let i = 0; i < d.length; i += 4) {
          const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          for (let k = 0; k < 3; k++) d[i + k] = (d[i + k] + (l - d[i + k]) * amount) * darken + 6;
        }
        g.putImageData(px, 0, 0);
        tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = m.map.flipY;
        tex.wrapS = m.map.wrapS;
        tex.wrapT = m.map.wrapT;
        tex.magFilter = m.map.magFilter;
        tex.minFilter = m.map.minFilter;
        cache.set(img, tex);
      }
      m.map = tex;
      m.needsUpdate = true;
    }
  });
}

// ------------------------------------------------------------------ textures

function radialTexture() {
  return canvasTexture(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.22, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
}

/**
 * Dusk (or overcast) sky as an equirect environment for puddles and dark glass (auto-PMREM'd).
 * golden: the Ch5 late-sun variant (warm horizon, matching the 'golden' preset sky).
 */
function skyEnv(day, golden = false) {
  const tex = canvasTexture(256, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, golden ? '#7a5a4c' : day ? '#9aa2a8' : '#4a5056');
    g.addColorStop(0.42, golden ? '#c98e5e' : day ? '#c3c6c4' : '#6c7176');
    g.addColorStop(0.5, golden ? '#e8b46e' : day ? '#d2cdc2' : '#868079');
    g.addColorStop(0.56, golden ? '#3a2e24' : '#3a3b3e');
    g.addColorStop(1, golden ? '#1e1a16' : '#202124');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    if (!day) {
      for (let i = 0; i < 9; i++) {
        const x = (i / 9) * w + 8;
        const r = c.createRadialGradient(x, h * 0.47, 0, x, h * 0.47, 10);
        r.addColorStop(0, 'rgba(255,190,110,0.85)');
        r.addColorStop(1, 'rgba(255,190,110,0)');
        c.fillStyle = r;
        c.fillRect(x - 12, h * 0.47 - 12, 24, 24);
      }
      const p = c.createRadialGradient(w * 0.3, h * 0.48, 0, w * 0.3, h * 0.48, 14);
      p.addColorStop(0, 'rgba(255,61,110,0.8)');
      p.addColorStop(1, 'rgba(255,61,110,0)');
      c.fillStyle = p;
      c.fillRect(w * 0.3 - 16, h * 0.48 - 16, 32, 32);
    }
  });
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

/** The STRIDE billboard: a runner mid-stride in acid green on black, the brand and the slogan. */
function strideTexture(text) {
  const [brand, tagline] = String(text).split(/\s+—\s+/);
  const R = seeded(77);
  return canvasTexture(2048, 830, (c, w, h) => {
    c.fillStyle = '#0a0c0b';
    c.fillRect(0, 0, w, h);
    const halo = c.createRadialGradient(1480, 420, 60, 1480, 420, 560);
    halo.addColorStop(0, 'rgba(198,244,50,0.26)');
    halo.addColorStop(1, 'rgba(198,244,50,0)');
    c.fillStyle = halo;
    c.fillRect(860, 0, w - 860, h);
    // Speed lines.
    c.strokeStyle = 'rgba(198,244,50,0.32)';
    c.lineWidth = 7;
    for (let i = 0; i < 22; i++) {
      const y = 70 + i * 32 + (i % 3) * 6;
      c.beginPath();
      c.moveTo(930 + (i % 5) * 36, y);
      c.lineTo(1230 - (i % 4) * 54, y);
      c.stroke();
    }
    // The runner, limbs as thick round strokes, leaning into the drive.
    const limb = (pts, width) => {
      c.lineWidth = width;
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) c.lineTo(p[0], p[1]);
      c.stroke();
    };
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = '#c6f432';
    c.fillStyle = '#c6f432';
    const sh = [1530, 240];
    const hip = [1410, 480];
    limb([sh, [1400, 320], [1330, 405]], 60);
    limb([hip, [1290, 615], [1140, 760]], 76);
    limb([sh, hip], 124);
    limb([hip, [1590, 540], [1560, 730], [1620, 742]], 78);
    limb([sh, [1650, 330], [1720, 232]], 60);
    c.beginPath();
    c.arc(1585, 152, 62, 0, Math.PI * 2);
    c.fill();
    // Brand.
    c.fillStyle = '#f1f4e8';
    c.font = `italic 900 270px ${SANS}`;
    c.textBaseline = 'alphabetic';
    c.fillText(brand || 'STRIDE', 100, 330);
    c.fillStyle = '#c6f432';
    c.beginPath();
    c.moveTo(112, 372);
    c.lineTo(900, 372);
    c.lineTo(868, 404);
    c.lineTo(94, 404);
    c.closePath();
    c.fill();
    c.fillStyle = '#c6f432';
    c.font = `italic 800 84px ${SANS}`;
    if ('letterSpacing' in c) c.letterSpacing = '10px';
    c.fillText(tagline || '', 112, 540);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    // Weathering: grime, rust tears from the top bolts, a peeled strip bottom right.
    for (let i = 0; i < 46; i++) {
      c.fillStyle = `rgba(32,26,18,${0.05 + R() * 0.1})`;
      c.beginPath();
      c.arc(R() * w, R() * h, 20 + R() * 120, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = 0; i < 6; i++) {
      const x = 120 + (i * (w - 240)) / 5;
      const g = c.createLinearGradient(0, 0, 0, 260 + R() * 200);
      g.addColorStop(0, 'rgba(122,70,38,0.65)');
      g.addColorStop(1, 'rgba(122,70,38,0)');
      c.fillStyle = g;
      c.fillRect(x - 5, 0, 10 + R() * 6, 460);
    }
    c.fillStyle = '#7d7a72';
    c.beginPath();
    c.moveTo(w, h - 300);
    c.lineTo(w - 230, h);
    c.lineTo(w, h);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.fillRect(0, h - 24, w, 24);
  });
}

/** Faded hand-painted wall sign: cream letters with an ochre shade, eroded by forty-odd winters. */
function ghostTexture(text) {
  const parts = String(text).split(/\s+—\s+/);
  const lines = [parts[0] || '', parts.slice(1).join(' — ')];
  const R = seeded(52);
  return canvasTexture(1600, 720, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const draw = (t, y, size, spacing) => {
      c.font = `700 ${size}px ${SERIF}`;
      if ('letterSpacing' in c) c.letterSpacing = `${spacing}px`;
      c.fillStyle = 'rgba(176,132,60,0.55)'; // the shade (offset drop)
      c.fillText(t, w / 2 + 9, y + 9);
      c.fillStyle = 'rgba(236,226,200,0.78)';
      c.fillText(t, w / 2, y);
    };
    draw(lines[0], h * 0.36, 190, 6);
    draw(lines[1], h * 0.74, 104, 18);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    // A pinstripe border, mostly gone.
    c.strokeStyle = 'rgba(236,226,200,0.4)';
    c.lineWidth = 8;
    c.strokeRect(30, 30, w - 60, h - 60);
    // Erosion: knock holes and streaks out of the paint.
    c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 2600; i++) {
      c.fillStyle = `rgba(0,0,0,${0.3 + R() * 0.7})`;
      const r = 1 + R() * 7;
      c.beginPath();
      c.arc(R() * w, R() * h, r, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = 0; i < 14; i++) {
      const x = R() * w;
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(0,0,0,0.0)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0.2)');
      c.fillStyle = g;
      c.fillRect(x, 0, 6 + R() * 26, h);
    }
    c.globalCompositeOperation = 'source-over';
  });
}

/** Corrugated roller shutter: horizontal slats, grime, a tag or two. */
function shutterTexture(seed, { tags = 2, base = '#8d9093' } = {}) {
  const tex = grimeTexture({ w: 512, h: 320, base, spread: 0.08, stains: 5, drips: 3, tags, posters: 0, seed });
  const c = tex.userData.canvas.getContext('2d');
  for (let y = 0; y < 320; y += 11) {
    c.fillStyle = 'rgba(20,22,24,0.35)';
    c.fillRect(0, y, 512, 2);
    c.fillStyle = 'rgba(255,255,255,0.06)';
    c.fillRect(0, y + 3, 512, 2);
  }
  const g = c.createLinearGradient(0, 230, 0, 320);
  g.addColorStop(0, 'rgba(122,70,38,0)');
  g.addColorStop(1, 'rgba(122,70,38,0.55)');
  c.fillStyle = g;
  c.fillRect(0, 230, 512, 90);
  tex.needsUpdate = true;
  return tex;
}

/** Shop window: warm interior with shelves (bakery loaves / kebab menu boards). */
function windowTexture(kind, lit) {
  return canvasTexture(512, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, lit ? '#e9dcc0' : '#6d6a64');
    g.addColorStop(1, lit ? '#b49b74' : '#45423e');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    if (kind === 'kebab') {
      for (let i = 0; i < 3; i++) {
        c.fillStyle = 'rgba(30,26,22,0.8)';
        c.fillRect(40 + i * 150, 30, 120, 70);
        c.fillStyle = 'rgba(236,226,200,0.7)';
        for (let k = 0; k < 4; k++) c.fillRect(52 + i * 150, 42 + k * 14, 70 + ((k * 13) % 30), 5);
      }
      c.fillStyle = 'rgba(120,70,40,0.85)';
      c.beginPath();
      c.moveTo(370, 120);
      c.lineTo(430, 120);
      c.lineTo(414, 236);
      c.lineTo(386, 236);
      c.closePath();
      c.fill();
    } else {
      c.fillStyle = 'rgba(70,58,44,0.4)';
      for (const y of [110, 190]) c.fillRect(20, y, w - 40, 8);
      c.fillStyle = 'rgba(190,140,80,0.9)';
      for (let i = 0; i < 9; i++) {
        c.beginPath();
        c.ellipse(52 + i * 50, 96 + (i % 2) * 80, 20, 10, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.fillStyle = 'rgba(60,55,50,0.12)';
    for (let i = 0; i < 20; i++) {
      c.beginPath();
      c.arc((i * 97) % w, (i * 53) % h, 18 + (i % 5) * 9, 0, Math.PI * 2);
      c.fill();
    }
  });
}

/** Neon text on a transparent background (soft glow baked in). */
function neonTexture(text) {
  return canvasTexture(640, 200, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.font = `italic 800 112px ${SANS}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = 'rgba(255,61,110,0.95)';
    c.shadowBlur = 28;
    c.strokeStyle = '#ff6d92';
    c.lineWidth = 9;
    c.strokeText(text, w / 2, h / 2 + 4);
    c.shadowBlur = 8;
    c.strokeStyle = '#ffd6e2';
    c.lineWidth = 3;
    c.strokeText(text, w / 2, h / 2 + 4);
  });
}

/** Hugo's lit window: warm lamp glow, a curtain half drawn. */
function litWindowTexture() {
  return canvasTexture(128, 160, (c, w, h) => {
    const g = c.createRadialGradient(w * 0.62, h * 0.6, 4, w * 0.62, h * 0.6, h * 0.8);
    g.addColorStop(0, '#fff0cc');
    g.addColorStop(0.5, '#e8b56e');
    g.addColorStop(1, '#8a5a2e');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(70,46,30,0.75)';
    c.fillRect(0, 0, w * 0.34, h);
    c.fillStyle = 'rgba(40,30,22,0.9)';
    c.fillRect(w / 2 - 2, 0, 4, h);
    c.fillRect(0, h * 0.45, w, 4);
  });
}

/** Faded striped awning canvas. */
function awningTexture() {
  const tex = grimeTexture({ w: 512, h: 256, base: '#8a8478', spread: 0.06, stains: 7, drips: 0, tags: 0, posters: 0, seed: 404 });
  const c = tex.userData.canvas.getContext('2d');
  c.globalCompositeOperation = 'multiply';
  for (let x = 0; x < 512; x += 64) {
    c.fillStyle = '#7a4a40';
    c.fillRect(x, 0, 32, 256);
  }
  c.globalCompositeOperation = 'source-over';
  tex.needsUpdate = true;
  return tex;
}

/**
 * The fascia board above the garage door. Odile letters it: "RÉPARATI" -> "RÉPARATIONS.".
 * The prefix is drawn where it sits in the finished, centred word, so letters never shift.
 */
function fasciaBoard(full, start, w, h) {
  const W = 1024;
  const H = Math.round((W * h) / w);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const base = document.createElement('canvas');
  base.width = W;
  base.height = H;
  {
    const b = base.getContext('2d');
    b.fillStyle = '#2c3530';
    b.fillRect(0, 0, W, H);
    const R = seeded(1414);
    for (let i = 0; i < 60; i++) {
      b.fillStyle = `rgba(${R() < 0.5 ? '15,12,10' : '120,110,90'},${0.04 + R() * 0.08})`;
      b.beginPath();
      b.arc(R() * W, R() * H, 6 + R() * 40, 0, Math.PI * 2);
      b.fill();
    }
    b.strokeStyle = 'rgba(214,196,150,0.75)';
    b.lineWidth = 4;
    b.strokeRect(14, 12, W - 28, H - 24);
  }
  let fs = H * 0.62;
  const setFont = () => (g.font = `700 ${fs}px ${SERIF}`);
  setFont();
  if ('letterSpacing' in g) g.letterSpacing = '6px';
  while (fs > 10 && g.measureText(full).width > W * 0.88) {
    fs *= 0.94;
    setFont();
  }
  const x0 = (W - g.measureText(full).width) / 2;
  const startN = full.startsWith(start) ? start.length : 0;
  let shown = -1;
  const draw = (n) => {
    n = Math.max(0, Math.min(full.length, Math.round(n)));
    if (n === shown) return false;
    shown = n;
    g.clearRect(0, 0, W, H);
    g.drawImage(base, 0, 0);
    setFont();
    if ('letterSpacing' in g) g.letterSpacing = '6px';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    const text = startN || n >= full.length ? full.slice(0, n) : start;
    g.fillStyle = 'rgba(150,110,40,0.9)'; // shade
    g.fillText(text, x0 + 4, H / 2 + 6);
    g.fillStyle = '#ece0bf';
    g.fillText(text, x0, H / 2 + 2);
    tex.needsUpdate = true;
    return true;
  };
  return { tex, draw, startN: startN || start.length, fullN: full.length, get shown() { return shown; } };
}

// ------------------------------------------------------------------ mural panels (wall variant)

const PANEL_FALLBACK = [
  { id: 'benali', color: '#e8c27a' },
  { id: 'ines', color: '#c24a6a' },
  { id: 'sami', color: '#c24a3a' },
  { id: 'odile', color: '#9a7a4e' },
  { id: 'marco', color: '#d98a3a' },
];

/**
 * One neighbour's panel, drawn in light greys on a transparent background so the material colour
 * (grey -> the panel's own colour) tints the motif. A pale primer wash shows the panel's edges.
 */
function panelTexture(id, seed) {
  const W = 576;
  const H = 400;
  const R = seeded(seed);
  return canvasTexture(W, H, (c) => {
    c.clearRect(0, 0, W, H);
    // Wash: a ragged, brushed rectangle.
    c.fillStyle = 'rgba(255,255,255,0.42)';
    c.beginPath();
    c.moveTo(10 + R() * 8, 10 + R() * 8);
    for (let k = 1; k <= 8; k++) c.lineTo((k / 8) * (W - 20) + 10, 6 + R() * 10);
    for (let k = 1; k <= 6; k++) c.lineTo(W - 6 - R() * 10, (k / 6) * (H - 20) + 10);
    for (let k = 7; k >= 0; k--) c.lineTo((k / 8) * (W - 20) + 10, H - 6 - R() * 10);
    for (let k = 5; k >= 1; k--) c.lineTo(6 + R() * 10, (k / 6) * (H - 20) + 10);
    c.closePath();
    c.fill();
    const ink = 'rgba(46,44,42,0.92)';
    const paint = '#f4f2ee';
    const half = '#c9c6c0';
    c.lineJoin = c.lineCap = 'round';
    if (id === 'benali') {
      // The croissant that came out a moon.
      const L = document.createElement('canvas');
      L.width = W;
      L.height = H;
      const m = L.getContext('2d');
      m.fillStyle = paint;
      m.beginPath();
      m.arc(W * 0.46, H * 0.52, 150, 0, Math.PI * 2);
      m.fill();
      m.globalCompositeOperation = 'destination-out';
      m.beginPath();
      m.arc(W * 0.58, H * 0.42, 128, 0, Math.PI * 2);
      m.fill();
      m.globalCompositeOperation = 'source-over';
      m.strokeStyle = 'rgba(46,44,42,0.5)';
      m.lineWidth = 6;
      for (let i = 0; i < 4; i++) {
        m.beginPath();
        m.arc(W * 0.46, H * 0.52, 150, Math.PI * (0.62 + i * 0.12), Math.PI * (0.66 + i * 0.12));
        m.lineTo(W * 0.46 + Math.cos(Math.PI * (0.64 + i * 0.12)) * 110, H * 0.52 + Math.sin(Math.PI * (0.64 + i * 0.12)) * 110);
        m.stroke();
      }
      c.drawImage(L, 0, 0);
      c.fillStyle = half;
      for (const [x, y, r] of [[420, 90, 14], [470, 170, 9], [380, 300, 11], [120, 80, 8]]) {
        c.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          const rr = k % 2 ? r * 0.45 : r;
          c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        c.closePath();
        c.fill();
      }
    } else if (id === 'ines') {
      c.font = `italic 900 150px ${SANS}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 22;
      c.strokeStyle = ink;
      c.save();
      c.translate(W / 2, H * 0.47);
      c.rotate(-0.08);
      c.strokeText('TANNEURS', 0, 0);
      c.fillStyle = paint;
      c.fillText('TANNEURS', 0, 0);
      c.fillStyle = half;
      c.fillRect(-250, 40, 500, 10);
      c.restore();
      c.fillStyle = paint;
      for (let i = 0; i < 7; i++) c.fillRect(70 + i * 66 + R() * 20, H * 0.6, 6, 30 + R() * 60); // drips
    } else if (id === 'sami') {
      c.strokeStyle = ink;
      c.lineWidth = 16;
      const wheel = (x) => {
        c.beginPath();
        c.arc(x, H * 0.62, 88, 0, Math.PI * 2);
        c.stroke();
      };
      wheel(W * 0.27);
      wheel(W * 0.73);
      c.strokeStyle = paint;
      c.lineWidth = 18;
      c.beginPath();
      c.moveTo(W * 0.27, H * 0.62);
      c.lineTo(W * 0.45, H * 0.36);
      c.lineTo(W * 0.66, H * 0.36);
      c.lineTo(W * 0.73, H * 0.62);
      c.moveTo(W * 0.27, H * 0.62);
      c.lineTo(W * 0.5, H * 0.62);
      c.lineTo(W * 0.45, H * 0.36);
      c.moveTo(W * 0.5, H * 0.62);
      c.lineTo(W * 0.66, H * 0.36);
      c.moveTo(W * 0.45, H * 0.36);
      c.lineTo(W * 0.43, H * 0.27);
      c.moveTo(W * 0.66, H * 0.36);
      c.lineTo(W * 0.68, H * 0.22);
      c.stroke();
      c.lineWidth = 14;
      c.beginPath();
      c.moveTo(W * 0.38, H * 0.26);
      c.lineTo(W * 0.48, H * 0.26);
      c.moveTo(W * 0.64, H * 0.22);
      c.lineTo(W * 0.74, H * 0.24);
      c.stroke();
    } else if (id === 'odile') {
      // An open hand holding a long-haired lettering brush.
      c.fillStyle = paint;
      c.strokeStyle = ink;
      c.lineWidth = 8;
      c.beginPath();
      c.ellipse(W * 0.42, H * 0.62, 92, 110, 0.2, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      const fingers = [[-0.62, 112], [-0.25, 140], [0.08, 146], [0.42, 128]];
      for (const [a, len] of fingers) {
        c.save();
        c.translate(W * 0.42 + Math.sin(a) * 70, H * 0.62 - Math.cos(a) * 80);
        c.rotate(a);
        c.beginPath();
        c.roundRect ? c.roundRect(-20, -len, 40, len, 20) : c.rect(-20, -len, 40, len);
        c.fill();
        c.stroke();
        c.restore();
      }
      c.save();
      c.translate(W * 0.42 - 84, H * 0.62 + 10);
      c.rotate(-1.1);
      c.beginPath();
      c.roundRect ? c.roundRect(-18, -60, 36, 90, 18) : c.rect(-18, -60, 36, 90);
      c.fill();
      c.stroke();
      c.restore();
      c.strokeStyle = half;
      c.lineWidth = 10;
      c.beginPath();
      c.moveTo(W * 0.3, H * 0.92);
      c.lineTo(W * 0.86, H * 0.12);
      c.stroke();
      c.fillStyle = ink;
      c.beginPath();
      c.moveTo(W * 0.86, H * 0.12);
      c.lineTo(W * 0.93, H * 0.02);
      c.lineTo(W * 0.89, H * 0.13);
      c.closePath();
      c.fill();
    } else if (id === 'marco') {
      // The great kebab: a doner cone on its spit, and a pitta.
      c.fillStyle = paint;
      c.strokeStyle = ink;
      c.lineWidth = 9;
      c.beginPath();
      c.moveTo(W * 0.24, H * 0.14);
      c.lineTo(W * 0.48, H * 0.14);
      c.lineTo(W * 0.42, H * 0.86);
      c.lineTo(W * 0.3, H * 0.86);
      c.closePath();
      c.fill();
      c.stroke();
      c.strokeStyle = 'rgba(46,44,42,0.45)';
      c.lineWidth = 5;
      for (let i = 1; i < 9; i++) {
        const y = H * (0.14 + i * 0.08);
        const k = (y - H * 0.14) / (H * 0.72);
        c.beginPath();
        c.moveTo(W * (0.24 + 0.06 * k), y);
        c.lineTo(W * (0.48 - 0.06 * k), y + 6);
        c.stroke();
      }
      c.strokeStyle = ink;
      c.lineWidth = 8;
      c.beginPath();
      c.moveTo(W * 0.36, H * 0.04);
      c.lineTo(W * 0.36, H * 0.96);
      c.stroke();
      c.fillStyle = half;
      c.beginPath();
      c.ellipse(W * 0.72, H * 0.58, 110, 70, -0.3, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = paint;
      c.beginPath();
      c.ellipse(W * 0.72, H * 0.5, 86, 30, -0.3, 0, Math.PI * 2);
      c.fill();
    } else {
      c.fillStyle = paint;
      for (let i = 0; i < 6; i++) {
        c.beginPath();
        c.arc(80 + R() * (W - 160), 80 + R() * (H - 160), 30 + R() * 50, 0, Math.PI * 2);
        c.fill();
      }
    }
  });
}

// ------------------------------------------------------------------ lamp cones

/** Soft additive light cones under the lit lamps (one instanced draw). */
function makeCones(heads) {
  const H = 3.9;
  const geo = new THREE.CylinderGeometry(0.14, 1.9, H, 24, 1, true);
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(SODIUM) }, uAlpha: { value: 0.12 }, uH: { value: H } },
    vertexShader: /* glsl */ `
      uniform float uH; varying float vY; varying vec3 vN; varying vec3 vV; varying vec3 vC; varying float vD;
      void main(){
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        vec4 mv = modelViewMatrix * p;
        vY = position.y / uH + 0.5;
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vC = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        vD = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAlpha; varying float vY; varying vec3 vN; varying vec3 vV; varying vec3 vC; varying float vD;
      void main(){
        float e = abs(dot(normalize(vN), normalize(vV)));
        float edge = e * sqrt(e);
        float y = clamp(vY, 0.0, 1.0);
        float fall = smoothstep(0.0, 0.45, y) * y;
        float a = uAlpha * edge * fall * exp(-vD * 0.03);
        gl_FragColor = vec4(uColor * vC, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const im = new THREE.InstancedMesh(geo, material, Math.max(1, heads.length));
  const m = new THREE.Matrix4();
  heads.forEach((h, i) => {
    im.setMatrixAt(i, m.makeTranslation(h.x, h.y - H / 2 + 0.05, h.z));
    im.setColorAt(i, new THREE.Color(1, 1, 1));
  });
  im.count = heads.length;
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = false;
  im.receiveShadow = false;
  im.renderOrder = 3;
  im.frustumCulled = false;
  im.name = 'lamp-cones';
  return im;
}

// ------------------------------------------------------------------ geometry helpers

/** A street-facing building block with its facade at x = side * FRONT_X, painted windows above the ground floor. */
function facadeBlock({ side, z0, z1, h, depth = 8, base = '#8a8276', seed = 1, posters = 1, tags = 2, stains = 9, drips = 6, floors = [], cols = 2 }) {
  const front = z0 - z1;
  const W = 512;
  const H = Math.round((W * h) / front);
  const tex = grimeTexture({ w: W, h: Math.min(2048, H), base, seed, posters, tags, stains, drips });
  const c = tex.userData.canvas.getContext('2d');
  const ch = tex.userData.canvas.height;
  const R = seeded(seed + 9);
  for (const fy of floors) {
    for (let k = 0; k < cols; k++) {
      const u = (k + 0.5) / cols;
      const ww = (1.1 / front) * W;
      const wh = (1.5 / h) * ch;
      const x = u * W - ww / 2;
      const y = (1 - fy / h) * ch - wh / 2;
      c.fillStyle = 'rgba(38,40,44,0.92)';
      c.fillRect(x, y, ww, wh);
      c.fillStyle = R() < 0.4 ? 'rgba(150,140,120,0.55)' : 'rgba(90,96,104,0.5)'; // curtain or sky
      c.fillRect(x + 4, y + 4, ww * (0.3 + R() * 0.4), wh - 8);
      c.fillStyle = 'rgba(200,196,186,0.6)';
      c.fillRect(x - 6, y + wh, ww + 12, 7); // sill
      c.fillStyle = 'rgba(30,26,20,0.25)';
      c.fillRect(x, y + wh + 7, ww, 24); // sill stain
    }
  }
  // A darker plinth.
  const pg = c.createLinearGradient(0, ch * (1 - 0.9 / h), 0, ch);
  pg.addColorStop(0, 'rgba(26,24,20,0.0)');
  pg.addColorStop(1, 'rgba(26,24,20,0.5)');
  c.fillStyle = pg;
  c.fillRect(0, ch * (1 - 0.9 / h), W, ch);
  tex.needsUpdate = true;
  const m = box(depth, h, front, { color: '#ffffff', map: tex, roughness: 0.92, pos: [side * (FRONT_X + depth / 2), 0, (z0 + z1) / 2] });
  m.name = 'facade-block';
  return m;
}

/** A plane facing the street from the side-`side` facade (offset a few cm out). Origin at its centre. */
function onFacade(mesh, side, z, y, out = 0.03) {
  mesh.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  mesh.position.set(side * (FRONT_X - out), y, z);
  return mesh;
}

/** Shape with a U-notch (the garage opening) at the bottom, UVs in 0..1 over the whole face. */
function notchedFacade(W, H, x0, x1, hh) {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0);
  s.lineTo(x0, 0);
  s.lineTo(x0, hh);
  s.lineTo(x1, hh);
  s.lineTo(x1, 0);
  s.lineTo(W / 2, 0);
  s.lineTo(W / 2, H);
  s.lineTo(-W / 2, H);
  s.closePath();
  const geo = new THREE.ShapeGeometry(s);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + W / 2) / W, pos.getY(i) / H);
  uv.needsUpdate = true;
  return geo;
}

// ------------------------------------------------------------------ builder

/**
 * @param ctx  the game ctx
 * @param opts { variant: 'evening' (Ch2) | 'wall' (Ch5) }
 */
export async function buildScene2(ctx, { variant = 'evening' } = {}) {
  const { assets } = ctx;
  const T = ctx.L.ch2;
  const S5 = ctx.L.ch5?.signs || {};
  const evening = variant !== 'wall';
  const group = new THREE.Group();
  group.name = `scene2-${evening ? 'evening' : 'wall'}`;
  const rng = seeded(1414);
  const prop = (path, opts) => assets.prop(path, opts);
  const env = skyEnv(!evening);
  const haloTex = radialTexture();

  // ---------------------------------------------------------------- ground
  // Wet street base (mid-value so the grade can darken it). It stops at No. 14's facade.
  group.add(ground({ size: [70, 64], color: evening ? '#7a7d80' : '#8c8b86', roughness: evening ? 0.86 : 0.95, metalness: evening ? 0.12 : 0.02, pos: [0, -16], y: -0.02, tile: 3, spread: 0.12 }));

  // Road tiles (Kenney): 12 m wide incl. sidewalks. Flattened so the kerb is 3 cm.
  const roadZ = [6, -6, -18, -30, -42];
  const roads = await Promise.all(roadZ.map(() => prop('kenney/roads/road-straight.glb', { width: 12 })));
  roads.forEach((r, i) => {
    r.rotation.y = Math.PI / 2;
    r.scale.y = 0.25;
    r.position.set(0, -0.03, roadZ[i]);
    r.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.color.multiplyScalar(evening ? 1.45 : 1.6);
      o.material.roughness = evening ? 0.86 : 0.95;
      o.material.metalness = evening ? 0.12 : 0.02;
      o.userData.noDispose = false; // our cloned material is disposed (geometry stays shared)
      o.castShadow = false;
    });
    group.add(r);
  });

  // Puddles (drying in the 'wall' variant).
  const PUDDLES = [
    [-3.1, -0.8, 1.6, 0.8, 0.3], [2.4, -6.5, 1.1, 0.6, -0.4], [-1.6, -12.2, 2.0, 0.9, 0.1],
    [3.0, -17.8, 1.5, 0.7, 0.6], [-3.3, -22.6, 1.8, 1.0, -0.2], [0.9, -27.5, 1.2, 0.55, 0.9],
    [2.9, -30.6, 1.7, 0.8, 0.2], [-2.8, -35.5, 1.4, 0.75, -0.5], [1.6, -41.2, 1.9, 0.8, 0.3],
    [-3.4, -44.2, 1.0, 0.6, 0.7], [-0.2, -8.8, 0.7, 0.4, 0.2], [0.4, -38.5, 0.8, 0.45, -0.3],
    [1.2, -45.9, 1.3, 0.55, 0.1],
  ];
  const puddleMat = new THREE.MeshStandardMaterial({
    color: evening ? '#555a60' : '#6a6d70',
    roughness: evening ? 0.06 : 0.22,
    metalness: 0,
    envMap: env,
    envMapIntensity: evening ? 0.85 : 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  {
    const shrink = evening ? 1 : 0.55;
    const puddles = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), puddleMat, PUDDLES.length);
    const dummy = new THREE.Object3D();
    PUDDLES.forEach(([x, z, rx, rz, rot], i) => {
      dummy.position.set(x, 0.004, z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(rx * shrink, 1, rz * shrink);
      dummy.updateMatrix();
      puddles.setMatrixAt(i, dummy.matrix);
    });
    puddles.instanceMatrix.needsUpdate = true;
    puddles.receiveShadow = true;
    puddles.castShadow = false;
    puddles.computeBoundingSphere();
    puddles.name = 'puddles';
    group.add(puddles);
  }

  // ---------------------------------------------------------------- Kenney rows
  const rows = [
    ...packRow(-1, [[14, -5.6], [-36.5, -47.9]], rng),
    ...packRow(1, [[14, -6.2], [-13.8, -20.2], [-24.6, -31.2], [-36.8, -47.9]], rng),
  ];
  const buildingProps = await Promise.all(rows.map((b) => prop(`kenney/city/building-${b.k}.glb`, { height: b.H, tint: 0xffffff })));
  const muted = new Map();
  buildingProps.forEach((g, i) => {
    muteBuildingPalette(g, muted);
    const b = rows[i];
    const depth = g.userData.size?.z ?? (BUILDINGS[b.k].size[2] / BUILDINGS[b.k].size[1]) * b.H;
    g.rotation.y = b.side < 0 ? -Math.PI / 2 : Math.PI / 2; // native front (-Z) faces the street
    g.position.set(b.side * (FRONT_X + depth / 2), 0, b.z);
    group.add(g);
  });

  // Dim skyline behind the rows, mostly swallowed by the fog.
  const skyline = [];
  for (let i = 0; i < 7; i++) {
    for (const side of [-1, 1]) {
      skyline.push({ k: 'abcd'[(i + (side > 0 ? 2 : 0)) % 4], x: side * (20 + rng() * 6), z: 10 - i * 9 - rng() * 4, H: 15 + rng() * 9, r: rng() * Math.PI });
    }
  }
  const skylineProps = await Promise.all(skyline.map((s) => prop(`kenney/city/low-detail-building-${s.k}.glb`, { height: s.H, castShadow: false, tint: 0xa8acb2 })));
  skylineProps.forEach((g, i) => {
    g.position.set(skyline[i].x, 0, skyline[i].z);
    g.rotation.y = skyline[i].r;
    group.add(g);
  });

  // ---------------------------------------------------------------- procedural blocks
  // Left: the bakery (z -5.7..-12) and Marco's kebab (z -32..-36.3).
  group.add(facadeBlock({ side: -1, z0: -5.7, z1: -11.95, h: 9.5, base: '#8e8778', seed: 31, floors: [4.6, 7.6], cols: 3 }));
  group.add(facadeBlock({ side: -1, z0: -32.05, z1: -36.35, h: 10.5, base: '#857f74', seed: 33, posters: 2, floors: [4.6, 7.8], cols: 2 }));
  // Right: the ghost-sign gable (tall, blind brick), the tube doorway, the bike shop.
  group.add(facadeBlock({ side: 1, z0: -6.3, z1: -13.7, h: 12.5, base: '#8a6c5c', seed: 35, posters: 2, tags: 4, stains: 12, drips: 10, floors: [4.4], cols: 2 }));
  group.add(facadeBlock({ side: 1, z0: -20.3, z1: -24.5, h: 9, base: '#878279', seed: 37, posters: 3, tags: 4, floors: [4.4, 7.2], cols: 2 }));
  group.add(facadeBlock({ side: 1, z0: -31.3, z1: -36.7, h: 10, base: '#8b857a', seed: 39, posters: 2, tags: 3, floors: [4.6, 7.6], cols: 3 }));

  // ---------------------------------------------------------------- the blind wall
  const wallLen = WALL.z0 - WALL.z1; // 20
  const WT = { w: 2048, h: Math.round((2048 * WALL.h) / wallLen) };
  const wallTex = evening
    ? grimeTexture({ w: WT.w, h: WT.h, base: '#8f8a7e', seed: 7, posters: 11, tags: 12, stains: 18, drips: 16 })
    : grimeTexture({ w: WT.w, h: WT.h, base: '#c6bfad', spread: 0.06, seed: 21, posters: 0, tags: 0, stains: 7, drips: 6, damp: '#6b6a5a' });
  {
    // Canvas mapping for the +X face: canvas left = +Z end (z -12), top = wall top.
    const c = wallTex.userData.canvas.getContext('2d');
    const U = (z) => ((WALL.z0 - z) / wallLen) * WT.w;
    const V = (y) => (1 - y / WALL.h) * WT.h;
    // Rust streaks under the two downpipe brackets.
    for (const z of [-12.4, -31.6]) {
      const g = c.createLinearGradient(0, 0, 0, WT.h);
      g.addColorStop(0, 'rgba(122,70,38,0.55)');
      g.addColorStop(1, 'rgba(122,70,38,0.08)');
      c.fillStyle = g;
      c.fillRect(U(z) - 26, 0, 52, WT.h);
    }
    if (!evening) {
      // Old tags ghosting through the primer.
      const R = seeded(88);
      c.globalAlpha = 0.12;
      c.strokeStyle = '#3a3a40';
      c.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        c.lineWidth = 10 + R() * 10;
        c.beginPath();
        let x = R() * WT.w;
        let y = V(0.6 + R() * 4);
        c.moveTo(x, y);
        for (let k = 0; k < 6; k++) c.quadraticCurveTo(x + 30, y - 60, (x += 50 + R() * 40), (y += (R() - 0.5) * 70));
        c.stroke();
      }
      c.globalAlpha = 1;
      // Where the billboard was: a paler, cleaner rectangle, bolt holes and their rust tears.
      const bx0 = U(BILLBOARD.z + BILLBOARD.w / 2);
      const bx1 = U(BILLBOARD.z - BILLBOARD.w / 2);
      const by0 = V(BILLBOARD.y0 + BILLBOARD.h);
      const by1 = V(BILLBOARD.y0);
      c.fillStyle = 'rgba(232,226,212,0.75)';
      c.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
      c.strokeStyle = 'rgba(80,70,56,0.25)';
      c.lineWidth = 3;
      c.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
      for (let i = 0; i < 6; i++) {
        for (const yy of [by0 + 18, by1 - 18]) {
          const x = bx0 + 24 + (i * (bx1 - bx0 - 48)) / 5;
          const g = c.createLinearGradient(0, yy, 0, yy + 120);
          g.addColorStop(0, 'rgba(122,70,38,0.6)');
          g.addColorStop(1, 'rgba(122,70,38,0)');
          c.fillStyle = g;
          c.fillRect(x - 3, yy, 6, 120);
          c.fillStyle = '#1e1a16';
          c.beginPath();
          c.arc(x, yy, 6, 0, Math.PI * 2);
          c.fill();
        }
      }
      // Odile's chalk guide: one long faint line at shoulder height, end to end (the brush covers it).
      c.strokeStyle = 'rgba(245,242,232,0.35)';
      c.lineWidth = 3;
      c.setLineDash([22, 10]);
      c.beginPath();
      c.moveTo(0, V(1.55));
      c.lineTo(WT.w, V(1.55));
      c.stroke();
      c.setLineDash([]);
    }
    wallTex.needsUpdate = true;
  }
  {
    const depth = 7;
    const geo = new THREE.BoxGeometry(depth, WALL.h, wallLen).translate(0, WALL.h / 2, 0);
    const side = mat('#7d786e', { map: grimeTexture({ w: 512, h: 256, base: '#8a8478', seed: 8 }), roughness: 0.95 });
    const face = mat('#ffffff', { map: wallTex, roughness: 0.94 });
    const wall = new THREE.Mesh(geo, [face, side, side, side, side, side]); // +X face = the street
    wall.position.set(WALL.x - depth / 2, 0, (WALL.z0 + WALL.z1) / 2);
    wall.castShadow = true;
    wall.receiveShadow = true;
    wall.name = 'blind-wall';
    group.add(wall);
    // Coping along the top and two rusty downpipes.
    group.add(box(0.5, 0.18, wallLen + 0.3, { color: '#6d6a64', pos: [WALL.x - 0.15, WALL.h, (WALL.z0 + WALL.z1) / 2] }));
    const pipeMat = mat('#6e4c38', { roughness: 0.6, metalness: 0.35 });
    for (const z of [-12.4, -31.6]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, WALL.h, 8).translate(0, WALL.h / 2, 0), pipeMat);
      p.position.set(WALL.x + 0.09, 0, z);
      p.castShadow = true;
      group.add(p);
    }
  }

  // ---------------------------------------------------------------- shopfronts
  const signs = {};
  // Bakery: fascia; shutter down at night, up by day.
  {
    const zc = (-5.7 + -11.95) / 2;
    const fascia = sign(T.signs.bakery, 5.4, 0.55, { bg: '#5a4a3c', fg: '#e6d9bc', font: SERIF, weathered: 0.5, letterSpacing: 4 });
    group.add(onFacade(fascia, -1, zc, 3.05));
    signs.bakery = fascia;
    if (evening) {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.6), mat('#ffffff', { map: shutterTexture(61, { tags: 3 }), roughness: 0.6, metalness: 0.35 }));
      group.add(onFacade(sh, -1, zc, 1.3, 0.02));
    } else {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 2.1), new THREE.MeshStandardMaterial({ map: windowTexture('bakery', true), roughness: 0.25, metalness: 0.1, envMap: env, envMapIntensity: 0.4 }));
      group.add(onFacade(win, -1, zc, 1.25, 0.02));
      group.add(box(0.3, 0.32, 5.4, { color: '#7d8084', metalness: 0.4, roughness: 0.5, pos: [-FRONT_X + 0.15, 2.45, zc] })); // rolled shutter box
    }
  }
  // Marco's kebab: lit window, a projecting neon blade sign.
  let neonMat = null;
  let neonLight = null;
  {
    const zc = (-32.05 + -36.35) / 2;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.0), new THREE.MeshBasicMaterial({ map: windowTexture('kebab', true), color: evening ? 0xcfc6b4 : 0x9a958c }));
    group.add(onFacade(win, -1, zc, 1.3, 0.02));
    group.add(box(0.12, 0.08, 3.8, { color: '#5f5c58', pos: [-FRONT_X + 0.06, 2.3, zc] }));
    // Blade sign at the +Z end of the shop, readable from up the street.
    const bladeZ = -32.5;
    group.add(box(1.4, 0.06, 0.06, { color: '#4a4a4c', metalness: 0.5, roughness: 0.5, pos: [-FRONT_X + 0.7, 3.95, bladeZ] }));
    group.add(box(1.36, 0.46, 0.08, { color: '#1a1b1e', roughness: 0.6, pos: [-FRONT_X + 0.72, 3.25, bladeZ] }));
    neonMat = new THREE.MeshBasicMaterial({ map: neonTexture(T.signs.kebab), transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    neonMat.color.setScalar(evening ? 1.6 : 0.55);
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.42), neonMat);
    neon.position.set(-FRONT_X + 0.72, 3.48, bladeZ + 0.05);
    neon.renderOrder = 4;
    group.add(neon);
    const back = neon.clone();
    back.position.z = bladeZ - 0.05;
    back.rotation.y = Math.PI;
    group.add(back);
    neonLight = pointLight(NEON, evening ? 7 : 0, { pos: [-FRONT_X + 1.1, 3.1, bladeZ + 0.4], distance: 8 });
    group.add(neonLight);
    signs.kebab = neon;
  }
  // The tube doorway (right, z -22.4): a recessed door and a fluorescent tube that buzzes and fails.
  let tubeMat = null;
  let tubeLight = null;
  {
    const zc = -22.4;
    group.add(box(0.5, 2.4, 1.4, { color: '#2e2f30', roughness: 0.7, pos: [FRONT_X - 0.2, 0, zc] }));
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), mat('#ffffff', { map: shutterTexture(71, { tags: 2, base: '#6f6a62' }), roughness: 0.7 }));
    door.rotation.y = -Math.PI / 2;
    door.position.set(FRONT_X - 0.46, 1.1, zc);
    group.add(door);
    tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(TUBE).multiplyScalar(evening ? 2.2 : 0.7), toneMapped: false });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 8), tubeMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(FRONT_X - 0.5, 2.55, zc);
    group.add(tube);
    group.add(box(0.12, 0.06, 1.3, { color: '#8a8c8e', pos: [FRONT_X - 0.48, 2.6, zc] }));
    if (evening) {
      tubeLight = pointLight(TUBE, 5, { pos: [FRONT_X - 0.9, 2.4, zc], distance: 6.5 });
      group.add(tubeLight);
    }
  }
  // CYCLES DURAND: shutter down for good, a hand-written thank-you taped to it.
  {
    const zc = (-31.3 + -36.7) / 2;
    const name = String(T.signs.shop).split(/\s+—\s+/);
    const fascia = sign(name[0] || 'CYCLES DURAND', 4.8, 0.55, { bg: '#3d4a52', fg: '#d8d2c4', weathered: 0.75, letterSpacing: 6 });
    group.add(onFacade(fascia, 1, zc, 3.05));
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.6), mat('#ffffff', { map: shutterTexture(81, { tags: 4 }), roughness: 0.6, metalness: 0.35 }));
    group.add(onFacade(sh, 1, zc, 1.3, 0.02));
    const note = sign(name.join('\n'), 0.8, 0.6, { bg: '#e6e0cf', fg: '#2b2a28', font: HANDWRITING, weight: 400, weathered: 0.3, pxPerM: 420, pad: 0.1 });
    note.rotation.z = 0.04;
    group.add(onFacade(note, 1, zc + 0.8, 1.55, 0.04));
    note.rotation.z = 0.04;
    signs.shopNote = note;
  }
  // The ghost sign, high on the gable brick.
  {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.9), new THREE.MeshStandardMaterial({ map: ghostTexture(T.signs.ghost), transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 }));
    group.add(onFacade(g, 1, -10, 8.7, 0.02));
    g.renderOrder = 1;
    signs.ghost = g;
  }

  // ---------------------------------------------------------------- the STRIDE billboard (evening)
  let bbMat = null;
  if (evening) {
    const bb = new THREE.Group();
    bb.name = 'billboard';
    const tex = strideTexture(T.signs.billboard);
    bbMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.6 });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(BILLBOARD.w, BILLBOARD.h), bbMat);
    face.rotation.y = Math.PI / 2;
    face.position.set(WALL.x + 0.2, BILLBOARD.y0 + BILLBOARD.h / 2, BILLBOARD.z);
    const frameMat = mat('#5d6166', { roughness: 0.65, metalness: 0.35 });
    bb.add(face, box(0.18, BILLBOARD.h + 0.24, BILLBOARD.w + 0.24, { material: frameMat, pos: [WALL.x + 0.09, BILLBOARD.y0 - 0.12, BILLBOARD.z] }));
    // Two lamp arms over the top edge.
    for (const dz of [-2, 2]) {
      bb.add(box(0.7, 0.05, 0.05, { material: frameMat, pos: [WALL.x + 0.45, BILLBOARD.y0 + BILLBOARD.h + 0.2, BILLBOARD.z + dz] }));
      bb.add(box(0.14, 0.08, 0.5, { color: '#2a2c2e', pos: [WALL.x + 0.8, BILLBOARD.y0 + BILLBOARD.h + 0.14, BILLBOARD.z + dz] }));
    }
    group.add(bb);
    signs.billboard = face;
  }

  // ---------------------------------------------------------------- the mural panels (wall)
  const panels = [];
  if (!evening) {
    const list = Array.isArray(S5.panels) && S5.panels.length ? S5.panels : PANEL_FALLBACK;
    const slot = wallLen / list.length;
    const GREY = new THREE.Color('#b9b5ad');
    list.forEach((p, i) => {
      const z0 = WALL.z0 - i * slot;
      const z1 = z0 - slot;
      const target = new THREE.Color(p.color || '#d9a441');
      const m = new THREE.MeshStandardMaterial({ map: panelTexture(p.id, 300 + i * 7), color: GREY.clone(), transparent: true, depthWrite: false, roughness: 0.88, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(slot - PANEL.gap, PANEL.h), m);
      mesh.rotation.y = Math.PI / 2;
      mesh.position.set(WALL.x + 0.015, PANEL.y0 + PANEL.h / 2, (z0 + z1) / 2);
      mesh.renderOrder = 1;
      mesh.receiveShadow = true;
      mesh.name = `panel-${p.id}`;
      group.add(mesh);
      panels.push({
        id: p.id,
        mesh,
        z0,
        z1,
        color: p.color,
        k: 0,
        setColor(k) {
          this.k = clamp01(k);
          m.color.copy(GREY).lerp(target, this.k);
        },
      });
    });
  }

  // ---------------------------------------------------------------- No. 14 (closes the street)
  const fasciaW = 3.6;
  const fasciaH = 0.6;
  const fascia = fasciaBoard(T.signs.fascia, evening ? T.signs.fasciaStart : T.signs.fascia, fasciaW, fasciaH);
  let windowMat = null;
  {
    const ftex = grimeTexture({ w: 1024, h: 512, base: '#8c8478', seed: 14, posters: 4, tags: 6, stains: 14, drips: 12 });
    const c = ftex.userData.canvas.getContext('2d');
    const U = (x) => ((x + FACADE.w / 2) / FACADE.w) * 1024;
    const V = (y) => (1 - y / FACADE.h) * 512;
    c.fillStyle = 'rgba(40,36,30,0.3)';
    for (const y of [3.55, 6.65, 9.75, 12.85]) c.fillRect(0, V(y) - 3, 1024, 6); // string courses
    const pg = c.createLinearGradient(0, V(1.0), 0, 512);
    pg.addColorStop(0, 'rgba(26,24,20,0)');
    pg.addColorStop(1, 'rgba(26,24,20,0.55)');
    c.fillStyle = pg;
    c.fillRect(0, V(1.0), 1024, 512 - V(1.0));
    // Damp spreading out under the awning, rust under its brackets.
    const dg = c.createRadialGradient(U(0), V(3.9), 10, U(0), V(3.9), 120);
    dg.addColorStop(0, 'rgba(50,52,40,0.4)');
    dg.addColorStop(1, 'rgba(50,52,40,0)');
    c.fillStyle = dg;
    c.fillRect(U(-6), V(7), U(6) - U(-6), V(0) - V(7));
    ftex.needsUpdate = true;
    const facade = new THREE.Mesh(notchedFacade(FACADE.w, FACADE.h, GARAGE.x0, GARAGE.x1, GARAGE.h), mat('#ffffff', { map: ftex, roughness: 0.93 }));
    facade.position.set(0, 0, DOOR_Z);
    facade.castShadow = true;
    facade.receiveShadow = true;
    facade.name = 'no14';
    group.add(facade);
    // Roof parapet and a chimney stack against the sky.
    group.add(box(FACADE.w, 0.5, 0.6, { color: '#6c6862', pos: [0, FACADE.h, DOOR_Z - 0.3] }));
    group.add(box(1.2, 2.4, 0.9, { color: '#6a5a50', pos: [-7.5, FACADE.h, DOOR_Z - 2] }));
    // Garage door jambs and lintel.
    const jamb = mat('#5b5853', { roughness: 0.8 });
    group.add(box(0.16, GARAGE.h + 0.16, 0.2, { material: jamb, pos: [GARAGE.x0 - 0.08, 0, DOOR_Z + 0.05] }));
    group.add(box(0.16, GARAGE.h + 0.16, 0.2, { material: jamb, pos: [GARAGE.x1 + 0.08, 0, DOOR_Z + 0.05] }));
    group.add(box(GARAGE.x1 - GARAGE.x0 + 0.32, 0.16, 0.2, { material: jamb, pos: [0, GARAGE.h, DOOR_Z + 0.05] }));
    // The fascia board.
    const fm = new THREE.Mesh(new THREE.PlaneGeometry(fasciaW, fasciaH), new THREE.MeshStandardMaterial({ map: fascia.tex, roughness: 0.7 }));
    fm.position.set(0, 3.2, DOOR_Z + 0.04);
    group.add(fm);
    fascia.mesh = fm;
    fascia.draw(evening ? fascia.startN : fascia.fullN);
    // The stairwell door and its enamel number.
    const sdoor = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.25), mat('#ffffff', { map: shutterTexture(91, { tags: 1, base: '#6a5444' }), roughness: 0.75 }));
    sdoor.position.set(3.75, 1.125, DOOR_Z + 0.02);
    group.add(sdoor);
    const num = sign(T.signs.number, 0.42, 0.22, { bg: '#2d4a6e', fg: '#e8e4da', border: '#e8e4da', weathered: 0.3, pxPerM: 400 });
    num.position.set(4.6, 1.85, DOOR_Z + 0.03);
    group.add(num);
    signs.number = num;
    // Windows: three upper floors. Hugo's (third floor, above the workshop) is lit.
    const glass = [];
    const sills = [];
    const cols = [-11.5, -8.3, -5.1, -1.3, 1.3, 5.1, 8.3, 11.5];
    const floorsY = [4.7, 7.8, 10.9];
    const HUGO = { x: 1.3, y: 10.9 };
    for (const y of floorsY) {
      for (const x of cols) {
        sills.push({ pos: [x, y - 0.86, DOOR_Z + 0.08], size: [1.4, 0.08, 0.18], color: '#b8b2a6' });
        if (evening && x === HUGO.x && y === HUGO.y) continue; // his lamp is on (evening only)
        glass.push([x, y]);
      }
    }
    windowMat = new THREE.MeshStandardMaterial({ color: '#4a5056', roughness: 0.18, metalness: 0.55, envMap: env, envMapIntensity: 0.7 });
    const gm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.15, 1.6), windowMat, glass.length);
    const dm = new THREE.Object3D();
    glass.forEach(([x, y], i) => {
      dm.position.set(x, y, DOOR_Z + 0.03);
      dm.updateMatrix();
      gm.setMatrixAt(i, dm.matrix);
    });
    gm.instanceMatrix.needsUpdate = true;
    gm.computeBoundingSphere();
    group.add(gm);
    group.add(instancedBoxes(sills, mat(0xffffff, { roughness: 0.9 })));
    if (evening) {
      const lit = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.6), new THREE.MeshBasicMaterial({ map: litWindowTexture(), fog: false, toneMapped: false }));
      lit.position.set(HUGO.x, HUGO.y, DOOR_Z + 0.03);
      lit.name = 'hugo-window';
      group.add(lit);
      signs.hugoWindow = lit;
    }
  }

  // Interior room behind the garage door (Ch5 dresses it; the evening variant gets clutter here).
  const interiorLight = pointLight(WARM, evening ? 16 : 9, { pos: [0, 2.35, -50.4], distance: 10 });
  group.add(interiorLight);
  {
    const iw = INTERIOR.maxX - INTERIOR.minX;
    const idp = INTERIOR.maxZ - INTERIOR.minZ;
    const zc = (INTERIOR.maxZ + INTERIOR.minZ) / 2;
    const wallM = mat('#ffffff', { map: grimeTexture({ w: 512, h: 256, base: '#a49a88', seed: 141, posters: 2, tags: 0, stains: 8, drips: 4 }), roughness: 0.95 });
    const floorM = mat('#8a8680', { roughness: 0.92 });
    const ceilM = mat('#6e6a64', { roughness: 0.95 });
    const plane = (w, h, m) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    const back = plane(iw, INTERIOR.h, wallM);
    back.position.set(0, INTERIOR.h / 2, INTERIOR.minZ);
    const left = plane(idp, INTERIOR.h, wallM);
    left.rotation.y = Math.PI / 2;
    left.position.set(INTERIOR.minX, INTERIOR.h / 2, zc);
    const right = plane(idp, INTERIOR.h, wallM);
    right.rotation.y = -Math.PI / 2;
    right.position.set(INTERIOR.maxX, INTERIOR.h / 2, zc);
    const floor = plane(iw, idp, floorM);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, zc);
    const ceil = plane(iw, idp, ceilM);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, INTERIOR.h, zc);
    for (const m of [back, left, right, floor, ceil]) m.receiveShadow = true;
    group.add(back, left, right, floor, ceil);
    // Bulb on a flex.
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(WARM).multiplyScalar(3), toneMapped: false }));
    bulb.position.set(0, 2.45, -50.4);
    group.add(bulb, box(0.01, 0.6, 0.01, { color: '#222222', pos: [0, 2.5, -50.4], castShadow: false }));
  }
  // Garage door: half down at night (warm light under it), rolled up by day.
  let doorPanel = null;
  {
    group.add(box(3.4, 0.32, 0.34, { color: '#6f7276', metalness: 0.4, roughness: 0.55, pos: [0, GARAGE.h - 0.02, DOOR_Z - 0.22] }));
    doorPanel = new THREE.Mesh(new THREE.BoxGeometry(3.24, 1.38, 0.05).translate(0, 0.69, 0), mat('#ffffff', { map: shutterTexture(101, { tags: 3, base: '#7f8488' }), roughness: 0.55, metalness: 0.4 }));
    doorPanel.position.set(0, GARAGE.h - 1.38, DOOR_Z - 0.06);
    doorPanel.castShadow = true;
    doorPanel.visible = evening;
    group.add(doorPanel);
  }
  // Warm spill on the wet pavement in front of the door (additive, fog-faded in update).
  const spill = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 3.4).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: haloTex, color: 0xffc58a, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  spill.position.set(0, 0.03, DOOR_Z + 1.6);
  spill.renderOrder = 4;
  group.add(spill);

  // The deep awning over the workshop front.
  {
    const aw = new THREE.Group();
    aw.position.set(0, 4.3, DOOR_Z);
    const canvasM = mat('#ffffff', { map: awningTexture(), roughness: 0.9, side: THREE.DoubleSide });
    const top = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.05, 3.5).translate(0, 0, 1.75), canvasM);
    top.rotation.x = 0.12; // the front edge dips
    top.castShadow = true;
    top.receiveShadow = true;
    aw.add(top);
    const val = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.32, 0.03), canvasM);
    val.position.set(0, -0.58, 3.47);
    aw.add(val);
    const armM = mat('#4a4c4e', { metalness: 0.5, roughness: 0.5 });
    for (const x of [-3.3, 3.3]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 3.6), armM);
      arm.position.set(x, -0.2, 1.75);
      arm.rotation.x = 0.12;
      aw.add(arm);
    }
    group.add(aw);
  }

  // Overhead cables across the street (the retro kit's sagging cable run).
  {
    const cables = await Promise.all([-14, -39].map(() => prop('kenney/retro/detail-cables-type-a.glb', { width: 12, castShadow: false })));
    cables.forEach((cb, i) => {
      cb.position.set(0, 6.2 + i * 0.6, [-14, -39][i]);
      cb.traverse((o) => {
        if (!o.isMesh) return;
        o.material = mat('#222426', { roughness: 0.6 });
        o.userData.noDispose = false;
      });
      group.add(cb);
    });
  }

  // ---------------------------------------------------------------- street lamps
  const lampProps = await Promise.all(LAMPS.map((l) => prop(`kenney/roads/light-${l.model}.glb`, { height: 4.5, center: false })));
  const heads = [];
  const lights = [];
  let flickerLight = null;
  LAMPS.forEach((l, i) => {
    const g = lampProps[i];
    const rot = l.side < 0 ? -Math.PI / 2 : Math.PI / 2; // arm (native -Z) reaches over the road
    g.rotation.y = rot;
    g.position.set(l.side * LAMP_X, 0, l.z);
    group.add(g);
    const reach = Math.max(0.9, (g.userData.size?.z ?? 1.8) * 0.82);
    const [ox, oz] = rotXZ(0, -reach, rot);
    const head = { x: l.side * LAMP_X + ox, y: 4.5 * 0.84, z: l.z + oz, lamp: l };
    if (l.bulb !== false) heads.push(head);
    if (l.light && evening) {
      const pl = pointLight(SODIUM, LAMP_INTENSITY, { pos: [head.x, head.y - 0.25, head.z], distance: 16 });
      pl.userData.base = LAMP_INTENSITY;
      group.add(pl);
      lights.push(pl);
      head.light = pl;
      if (l.flicker) flickerLight = pl;
    }
  });
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), heads.length);
  {
    const hot = new THREE.Color(SODIUM).multiplyScalar(5);
    const dim = new THREE.Color(SODIUM).multiplyScalar(evening ? 1.6 : 0.5);
    const dummy = new THREE.Object3D();
    heads.forEach((h, i) => {
      dummy.position.set(h.x, h.y + 0.02, h.z);
      dummy.scale.set(1.3, 0.55, 1.3);
      dummy.updateMatrix();
      bulbs.setMatrixAt(i, dummy.matrix);
      bulbs.setColorAt(i, h.light ? hot : dim);
    });
    bulbs.instanceMatrix.needsUpdate = true;
    bulbs.castShadow = false;
    bulbs.computeBoundingSphere();
    group.add(bulbs);
  }
  const litHeads = heads.filter((h) => h.light);
  let halos = null;
  let haloGeo = null;
  let haloBase = null;
  let cones = null;
  if (evening && litHeads.length) {
    haloGeo = new THREE.BufferGeometry();
    haloGeo.setAttribute('position', new THREE.Float32BufferAttribute(heads.flatMap((h) => [h.x, h.y - 0.05, h.z]), 3));
    const hc = new THREE.Color(SODIUM);
    haloGeo.setAttribute('color', new THREE.Float32BufferAttribute(heads.flatMap((h) => (h.light ? [hc.r, hc.g, hc.b] : [hc.r * 0.4, hc.g * 0.4, hc.b * 0.4])), 3));
    halos = new THREE.Points(
      haloGeo,
      new THREE.PointsMaterial({ map: haloTex, size: 2.6, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    haloBase = Float32Array.from(haloGeo.getAttribute('color').array);
    halos.renderOrder = 4;
    halos.frustumCulled = false;
    group.add(halos);
    cones = makeCones(litHeads);
    group.add(cones);
  }
  const flickIndex = litHeads.findIndex((h) => h.light === flickerLight);

  // ---------------------------------------------------------------- bench and litter
  const litter = evening
    ? [
        ['kenney/survival/bottle-large.glb', { height: 0.32, castShadow: false }, [5.3, -3.1], 0.4, 'lying'],
        ['kenney/survival/bottle-large.glb', { height: 0.32, castShadow: false }, [-5.25, -27.6], 1.9, 'lying'],
        ['kenney/survival/bottle-large.glb', { height: 0.32, castShadow: false }, [5.45, -38.0], 0],
        ['kenney/survival/bottle-large.glb', { height: 0.32, castShadow: false }, [-5.4, -14.4], 0.8, 'lying'],
        ['kenney/furniture/cardboardBoxOpen.glb', { height: 0.38 }, [5.35, -8.4], 0.5],
        ['kenney/furniture/cardboardBoxOpen.glb', { height: 0.38 }, [-5.4, -40.4], 2.2],
        ['kenney/survival/box-open.glb', { height: 0.5 }, [5.4, -29.6], 0.3],
        ['kenney/retro/pallet-small.glb', { width: 1.0 }, [5.42, -19.4], 0.05],
        ['kenney/retro/pallet-small.glb', { width: 1.0 }, [5.42, -19.4], 0.25, 'stack'],
        ['kenney/retro/detail-dumpster-closed.glb', { height: 1.3, tint: 0x8e9a8a }, [5.4, -38.9], Math.PI / 2],
        ['kenney/survival/barrel.glb', { height: 0.9, tint: 0x9a8a7a }, [5.45, -44.7], 0.3],
        ['kenney/survival/barrel-open.glb', { height: 0.9, tint: 0x8a7a6a }, [-5.45, -43.6], 1.1],
        ['kenney/roads/construction-cone.glb', { height: 0.5, castShadow: false }, [-2.45, -47.35], 0],
        ['kenney/roads/construction-cone.glb', { height: 0.5, castShadow: false }, [-2.85, -47.0], 0.6],
        ['kenney/retro/detail-bricks-type-a.glb', { height: 0.22, castShadow: false }, [-5.5, -29.4], 0.4],
        ['kenney/retro/detail-bricks-type-a.glb', { height: 0.22, castShadow: false }, [5.45, -12.9], 1.2],
      ]
    : [
        ['kenney/retro/detail-dumpster-closed.glb', { height: 1.3, tint: 0x8e9a8a }, [5.4, -38.9], Math.PI / 2],
        ['kenney/survival/barrel.glb', { height: 0.9, tint: 0x9a8a7a }, [5.45, -44.7], 0.3],
        ['kenney/survival/bottle-large.glb', { height: 0.32, castShadow: false }, [5.3, -3.1], 0.4, 'lying'],
        ['kenney/furniture/cardboardBoxOpen.glb', { height: 0.38 }, [5.35, -8.4], 0.5],
      ];
  const [bench, ...litterProps] = await Promise.all([prop('kenney/retro/detail-bench.glb', { height: 0.9 }), ...litter.map(([p, o]) => prop(p, o))]);
  bench.position.set(-5.45, 0, SEAT.z);
  bench.rotation.y = -Math.PI / 2; // backrest against the facade, seat faces the street (+X)
  group.add(bench);
  litterProps.forEach((g, i) => {
    const [, , [x, z], rot, how] = litter[i];
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    if (how === 'lying') {
      g.rotation.set(0, rot, Math.PI / 2);
      g.position.y = (g.userData.size?.x ?? 0.18) / 2;
    } else if (how === 'stack') {
      g.position.y = g.userData.size?.y ?? 0.3;
    }
    group.add(g);
  });
  // Bin bags (one instanced draw).
  {
    const BAGS = evening
      ? [[-5.4, -4.7, 1.0], [-5.55, -4.1, 0.85], [5.5, -37.6, 0.95], [-5.35, -46.6, 0.9], [5.55, -14.8, 0.8], [-5.5, -38.0, 0.7]]
      : [[5.5, -37.6, 0.95], [-5.35, -46.6, 0.9]];
    const bagGeo = new THREE.IcosahedronGeometry(0.34, 1).scale(1, 0.75, 0.9).translate(0, 0.22, 0);
    const bags = new THREE.InstancedMesh(bagGeo, new THREE.MeshStandardMaterial({ color: '#3a3c3f', roughness: 0.32, metalness: 0.1, envMap: env, envMapIntensity: 0.5 }), BAGS.length);
    const dm = new THREE.Object3D();
    BAGS.forEach(([x, z, s], i) => {
      dm.position.set(x, 0, z);
      dm.rotation.set(0, i * 1.7, 0);
      dm.scale.setScalar(s);
      dm.updateMatrix();
      bags.setMatrixAt(i, dm.matrix);
    });
    bags.instanceMatrix.needsUpdate = true;
    bags.castShadow = true;
    bags.computeBoundingSphere();
    group.add(bags);
  }

  // ---------------------------------------------------------------- evening: Odile's tower, Odile, the club
  let tower = null;
  let odile = null;
  const club = [];
  const wob = { amp: 0, t: 0 };
  let clampLight = null;
  if (evening) {
    tower = new THREE.Group();
    tower.name = 'scaffold';
    tower.position.set(TOWER.x, 0, TOWER.z);
    const [frame, deck, pot] = await Promise.all([
      prop('kenney/retro/scaffolding-structure.glb', { height: TOWER.size, tint: '#6f6b62' }),
      prop('kenney/retro/scaffolding-floor.glb', { width: TOWER.size, tint: '#6b604f' }),
      prop('kenney/survival/bucket.glb', { height: 0.26, tint: 0xb0a090 }),
    ]);
    frame.position.y = TOWER.lift;
    deck.position.y = TOWER.lift + TOWER.size - 0.02;
    const deckTop = TOWER.lift + TOWER.size - 0.02 + (deck.userData.size?.y ?? 0.14);
    pot.position.set(-0.55, deckTop, -0.25);
    tower.add(frame, deck, pot);
    // Casters (one of them has given up).
    const casterM = mat('#2a2b2d', { roughness: 0.5 });
    for (const [x, z] of [[-0.93, -0.93], [0.93, -0.93], [-0.93, 0.93], [0.93, 0.93]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12), casterM);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.06, z);
      tower.add(w);
    }
    // Clamp-on work lamp.
    const lampHead = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 12, 1, true), mat('#3c3e40', { side: THREE.DoubleSide, metalness: 0.4, roughness: 0.5 }));
    lampHead.position.set(0.85, deckTop + 1.05, -0.85);
    lampHead.rotation.x = -2.2;
    const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(WARM).multiplyScalar(3), toneMapped: false }));
    lampBulb.position.copy(lampHead.position).add(new THREE.Vector3(0, -0.03, -0.05));
    tower.add(lampHead, lampBulb, box(0.02, 1.05, 0.02, { color: '#3c3e40', pos: [0.88, deckTop, -0.88], castShadow: false }));
    clampLight = pointLight(WARM, 6, { pos: [0.85, deckTop + 0.9, -1.2], distance: 6 });
    tower.add(clampLight);
    // Odile, on the deck, facing the fascia.
    odile = assets.makeCharacter({ tint: 0x9a7a4e, scale: 0.94, name: 'Odile' });
    odile.root.position.set(0.25, deckTop, -0.5);
    odile.root.rotation.y = Math.PI;
    odile.model.rotation.x = 0.08;
    odile.play('idle');
    tower.add(odile.root);
    const hand = odile.bone?.('RightHand');
    if (hand) {
      tower.updateMatrixWorld(true);
      const s = hand.getWorldScale(new THREE.Vector3()).x || 1;
      const brush = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.26, 6), mat('#6b4a2e'));
      brush.scale.setScalar(1 / s);
      brush.position.set(0, 0.1 / s, 0);
      brush.castShadow = false;
      hand.add(brush);
    }
    group.add(tower);

    // The run club: Bastien (hi-vis yellow) + four muted hi-vis runners. Hidden until Ch2 sends them.
    const tints = [0xd6e04a, 0xe0a040, 0x8fb0c8, 0xb8c040, 0xc89a5a];
    for (let i = 0; i < tints.length; i++) {
      const c = assets.makeCharacter({ tint: tints[i], name: i === 0 ? 'Bastien' : `Runner ${i}` });
      c.root.position.set(0, 0, 30);
      c.root.rotation.y = Math.PI;
      c.root.visible = false;
      group.add(c.root);
      club.push(c);
    }
  }

  // ---------------------------------------------------------------- rain
  const rain = evening ? makeRain() : null;
  if (rain) group.add(rain.object);

  // ---------------------------------------------------------------- bounds
  const bounds = evening
    ? [
        { minX: -5.0, maxX: 4.85, minZ: -45.1, maxZ: 9 },
        { minX: -5.0, maxX: TOWER.x - 1.05, minZ: -47.3, maxZ: -45.1 },
        { minX: TOWER.x + 1.05, maxX: 4.85, minZ: -47.3, maxZ: -45.1 },
      ]
    : [
        { minX: -5.0, maxX: 4.85, minZ: -47.3, maxZ: 9 },
        { minX: GARAGE.x0 + 0.25, maxX: GARAGE.x1 - 0.25, minZ: DOOR_Z - 0.4, maxZ: -47.0 },
        { minX: INTERIOR.minX + 0.35, maxX: INTERIOR.maxX - 0.35, minZ: INTERIOR.minZ + 0.45, maxZ: DOOR_Z - 0.2 },
      ];

  // ---------------------------------------------------------------- animation
  const state = { t: 0, rain: rain ? 0.32 : 0, rainTarget: rain ? 0.32 : 0, rainUser: 1, bbFlick: 0, bbNext: 3, lampFlick: 0, lampNext: 2, neonFlick: 0, neonNext: 4, tubeFlick: 0, tubeNext: 1.5, buzzAt: 0 };
  state.neonBase = neonMat ? neonMat.color.r : 1;
  state.neonLightBase = neonLight ? neonLight.intensity : 0;
  const tubeBase = new THREE.Color(TUBE).multiplyScalar(evening ? 2.2 : 0.7);
  const coneColor = new THREE.Color();
  const _hp = new THREE.Vector3();
  /** 1 - FogExp2 factor at world point p (1 = clear, 0 = fully fogged). */
  const fogVis = (p) => {
    const dens = ctx.scene.fog?.density || 0;
    const dd = dens * ctx.camera.position.distanceTo(p);
    return Math.exp(-dd * dd);
  };
  const flick = (key, next, minGap, maxGap, minLen, maxLen, raw) => {
    state[next] -= raw;
    if (state[next] <= 0) {
      state[key] = minLen + Math.random() * (maxLen - minLen);
      state[next] = minGap + Math.random() * (maxGap - minGap);
    }
    if (state[key] > 0) {
      state[key] -= raw;
      return true;
    }
    return false;
  };

  function update(dt, raw) {
    state.t += raw;
    // Rain: on, easing past z -36 and almost gone under the awning.
    if (rain) {
      const pz = ctx.player?.root?.position.z ?? 0;
      const ease = pz > -30 ? 1 : pz > -40 ? 1 - 0.75 * ((-30 - pz) / 10) : pz > -44.5 ? 0.25 : 0.12;
      state.rainTarget = 0.32 * ease * state.rainUser;
      state.rain += (state.rainTarget - state.rain) * (1 - Math.exp(-1.2 * raw));
      rain.opacity = state.rain;
      rain.update(dt, ctx.camera);
    }
    // Additive glows ignore fog (it would grey them); fade them with the same FogExp2 curve.
    if (halos) {
      const hc = haloGeo.getAttribute('color');
      for (let i = 0; i < heads.length; i++) {
        const h = heads[i];
        const vis = fogVis(_hp.set(h.x, h.y, h.z));
        for (let k = 0; k < 3; k++) hc.array[i * 3 + k] = haloBase[i * 3 + k] * vis;
      }
      hc.needsUpdate = true;
    }
    const spillVis = Math.pow(fogVis(spill.position), 0.5);
    spill.material.opacity = (evening ? 0.32 : 0.12) * spillVis;
    const lit = signs.hugoWindow;
    if (lit) lit.material.color.setScalar(0.25 + 0.95 * Math.pow(fogVis(lit.position), 0.3));

    // Billboard: one tube is going.
    if (bbMat) bbMat.emissiveIntensity = flick('bbFlick', 'bbNext', 3, 8, 0.25, 0.75, raw) ? (Math.sin(state.t * 47) > 0.2 ? 0.55 : 0.12) : 0.55;

    // One sodium lamp buzzes.
    if (flickerLight) {
      const f = flick('lampFlick', 'lampNext', 2.5, 6.5, 0.4, 1.2, raw) ? (Math.sin(state.t * 31) > -0.1 ? 0.85 : 0.15) : 1;
      flickerLight.intensity = flickerLight.userData.base * f;
      if (cones && flickIndex >= 0) {
        cones.setColorAt(flickIndex, coneColor.setScalar(f));
        cones.instanceColor.needsUpdate = true;
      }
    }
    // Marco's neon: short dropouts.
    if (neonMat) {
      const off = evening && flick('neonFlick', 'neonNext', 3, 7, 0.05, 0.22, raw) && Math.sin(state.t * 60) > 0;
      neonMat.color.setScalar(off ? state.neonBase * 0.15 : state.neonBase);
      if (neonLight) neonLight.intensity = off ? 0.6 : state.neonLightBase;
    }
    // The doorway tube: stutters, and buzzes when you're near.
    if (tubeMat && evening) {
      const on = flick('tubeFlick', 'tubeNext', 2, 5, 0.3, 1.1, raw);
      const k = on ? (Math.sin(state.t * 53) > 0.3 ? 1 : 0.08) : 1;
      tubeMat.color.copy(tubeBase).multiplyScalar(k);
      if (tubeLight) tubeLight.intensity = 5 * k;
      if (on && state.t > state.buzzAt) {
        state.buzzAt = state.t + 0.45;
        const p = ctx.player?.root?.position;
        const d = p ? Math.hypot(p.x - (FRONT_X - 0.5), p.z + 22.4) : 99;
        if (d < 9) ctx.audio?.tone({ freq: 120, to: 118, dur: 0.3, type: 'sawtooth', volume: 0.028 * (1 - d / 9) });
      }
    }
    // The tower wobbles when Hugo fidgets (and creaks a hair on its own).
    if (tower) {
      wob.t += raw;
      wob.amp *= Math.exp(-2.6 * raw);
      tower.rotation.z = wob.amp * Math.sin(wob.t * 11) + 0.002 * Math.sin(state.t * 0.9);
      tower.rotation.x = wob.amp * 0.6 * Math.sin(wob.t * 9 + 1);
    }
  }

  // ---------------------------------------------------------------- spots, shots, extras
  const spots = {
    ghost: [4.3, -10],
    billboard: [-3.6, -15.2],
    shop: [4.3, -34],
    bench: [-4.55, SEAT.z],
    seat: [SEAT.x, SEAT.z],
    door: [0, -47.0],
    odile: [TOWER.x + 1.4, TOWER.z + 1.6],
    // Ch5 contract
    odileChair: [-4.45, -38.5],
    saunter: [-3.8, -22],
    nail: [0, -52.35],
    boltHoles: [-4.2, BILLBOARD.z],
    shopCard: [4.3, -34],
    benali: [-3.9, -14],
    ines: [-3.9, -20],
    marco: [-3.9, -30.5],
  };
  const shots = {
    ghost: { pos: [-2.2, 1.6, -4.8], look: [5.9, 8.2, -10], fov: 54 },
    billboard: { pos: [2.4, 1.7, -10.6], look: [-5.9, 6.0, -18], fov: 54 },
    shop: { pos: [1.0, 1.6, -31.0], look: [5.9, 1.6, -34.5], fov: 50 },
    bench: { pos: [-1.6, 1.5, -34.4], look: [-5.2, 0.9, -36.7], fov: 52 },
    hold: { pos: [2.9, 1.55, -41.3], look: [-0.55, 2.35, -46.2], fov: 52 },
    after: { pos: [-1.3, 1.65, -41.4], look: [1.05, 1.35, -45.3], fov: 48 },
    wall: { pos: [0.4, 1.7, -22], look: [-5.95, 2.6, -22], fov: 62 },
    door: { pos: [0, 1.7, -42.5], look: [0, 1.6, -49], fov: 52 },
    // Inside the workshop (the follow camera would sit in the doorway, under the lintel).
    nail: { pos: [1.7, 1.75, -49.2], look: [-0.1, 1.4, -53.1], fov: 54 },
  };

  const result = {
    group,
    variant: evening ? 'evening' : 'wall',
    bounds,
    spots,
    shots,
    seat: SEAT,
    interior: INTERIOR,
    wallLine: { x: WALL.x, z0: WALL.z0, z1: WALL.z1, y: 1.55, height: WALL.h },
    fascia,
    signs,
    lights: { lamps: lights, neon: neonLight, tube: tubeLight, interior: interiorLight, clamp: clampLight },
    /** Rain multiplier 0..1 (eased). The z-based easing past -36 still applies. */
    setRain(v) {
      state.rainUser = clamp01(v);
    },
    update,
    dispose() {
      env.dispose();
    },
  };

  if (evening) {
    Object.assign(result, {
      odile,
      tower,
      club,
      holdSpot: HOLD_SPOT,
      holdLeg: HOLD_LEG,
      odileGround: ODILE_GROUND,
      /** Kick the scaffold wobble (radians of sway). */
      wobble(amp = 0.035) {
        wob.amp = Math.min(0.06, wob.amp + amp);
        wob.t = 0;
      },
      /** Odile "climbs down" (call behind a fade): she stands on the pavement facing Hugo. */
      odileDown(face = HOLD_SPOT) {
        if (!odile) return;
        group.attach(odile.root);
        odile.root.position.set(ODILE_GROUND[0], 0, ODILE_GROUND[1]);
        odile.root.rotation.set(0, Math.atan2(face[0] - ODILE_GROUND[0], face[1] - ODILE_GROUND[1]), 0);
        odile.model.rotation.x = 0;
        odile.play('idle');
      },
    });
  } else {
    Object.assign(result, {
      panels,
      /** Set every panel's colour 0 (grey) .. 1 (its own colour). */
      setPanels(k) {
        for (const p of panels) p.setColor(k);
      },
      /** Golden hour: the mural in full colour, Marco's neon on, the workshop glowing. */
      setGolden() {
        for (const p of panels) p.setColor(1);
        state.neonBase = 1.4;
        state.neonLightBase = 3;
        interiorLight.intensity = 12;
        // Puddles reflect the warm sky, not the overcast one (a pale-grey wash under the low sun).
        if (!puddleMat.userData.golden) {
          puddleMat.userData.golden = true;
          puddleMat.envMap = skyEnv(true, true);
          puddleMat.envMapIntensity = 0.32;
          puddleMat.color.set('#3e3d3a');
          puddleMat.roughness = 0.16;
          puddleMat.needsUpdate = true;
        }
      },
      nailPos: [0, 1.6, INTERIOR.minZ + 0.06],
      shopCardAt: [FRONT_X - 0.05, 1.45, (-31.3 + -36.7) / 2 - 0.9, -Math.PI / 2],
      boltHolesAt: [WALL.x + 0.02, BILLBOARD.y0 + BILLBOARD.h / 2, BILLBOARD.z],
    });
  }
  return result;
}
