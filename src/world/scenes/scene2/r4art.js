import { canvasTexture, rng as seeded } from '../../build.js';

// Canvas art for the Revision 4 sets on Rue des Tanneurs (docs/DESIGN.md, STREET CONTRACT, R4):
// ENCRE FINE's flash wall and hand-lettered blade sign, CYCLES DURAND's back wall (painted outlines
// of the bikes that are gone), its photo wall, the 1974 photo, the night calendar, the jig's rule and
// the tin of Bleu Durand, plus the sawdust slipper print on No. 14's doorstep. Text on them is shop
// dressing passed in by scene2.js (French, from the text tree when it has a key).

export const HAND = '"Bradley Hand", "Segoe Print", "Noteworthy", "Comic Sans MS", cursive';
const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';

/** Thin black linework helpers on a canvas context (fine-line tattoo flash). */
function ink(c, w = 2) {
  c.strokeStyle = '#151312';
  c.fillStyle = '#151312';
  c.lineWidth = w;
  c.lineCap = 'round';
  c.lineJoin = 'round';
}

// One motif per function, drawn in a unit box around (x, y) of size s. Every one is something Jo
// learned (DESIGN-R4: a swallow, a fern, a tape measure, a whisk, a gear, a tiny ruler...).
const MOTIFS = {
  swallow(c, x, y, s) {
    c.beginPath();
    c.moveTo(x - s * 0.45, y - s * 0.05);
    c.quadraticCurveTo(x - s * 0.15, y - s * 0.2, x, y);
    c.quadraticCurveTo(x + s * 0.2, y - s * 0.35, x + s * 0.45, y - s * 0.3);
    c.moveTo(x, y);
    c.quadraticCurveTo(x + s * 0.05, y + s * 0.18, x - s * 0.1, y + s * 0.35);
    c.moveTo(x, y);
    c.quadraticCurveTo(x + s * 0.15, y + s * 0.15, x + s * 0.05, y + s * 0.38);
    c.moveTo(x - s * 0.08, y - s * 0.06);
    c.arc(x - s * 0.1, y - s * 0.08, s * 0.05, 0, Math.PI * 2);
    c.stroke();
  },
  fern(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y + s * 0.45);
    c.quadraticCurveTo(x + s * 0.1, y, x - s * 0.05, y - s * 0.45);
    for (let i = 0; i < 7; i++) {
      const t = i / 7;
      const px = x + s * 0.06 * Math.sin(t * 3) - s * 0.02;
      const py = y + s * 0.4 - t * s * 0.8;
      const l = s * (0.28 - t * 0.2);
      c.moveTo(px, py);
      c.quadraticCurveTo(px - l * 0.6, py - l * 0.5, px - l, py - l * 0.2);
      c.moveTo(px, py);
      c.quadraticCurveTo(px + l * 0.6, py - l * 0.5, px + l, py - l * 0.2);
    }
    c.stroke();
  },
  tape(c, x, y, s) {
    c.beginPath();
    c.ellipse(x, y, s * 0.42, s * 0.16, 0, 0, Math.PI * 2);
    c.ellipse(x, y + s * 0.08, s * 0.42, s * 0.16, 0, 0, Math.PI);
    c.stroke();
    for (let i = -6; i <= 6; i++) {
      const a = Math.PI * (0.5 + i / 14);
      c.beginPath();
      c.moveTo(x + Math.cos(a) * s * 0.42, y + Math.sin(a) * s * 0.16);
      c.lineTo(x + Math.cos(a) * s * 0.42, y + Math.sin(a) * s * 0.16 + (i % 2 ? s * 0.03 : s * 0.06));
      c.stroke();
    }
  },
  whisk(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y + s * 0.45);
    c.lineTo(x, y + s * 0.1);
    for (const k of [-1, -0.5, 0, 0.5, 1]) {
      c.moveTo(x, y + s * 0.1);
      c.bezierCurveTo(x + k * s * 0.3, y - s * 0.05, x + k * s * 0.25, y - s * 0.45, x, y - s * 0.45);
    }
    c.stroke();
  },
  gear(c, x, y, s) {
    c.beginPath();
    const n = 10;
    for (let i = 0; i <= n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const r = i % 2 ? s * 0.3 : s * 0.38;
      c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    c.closePath();
    c.moveTo(x + s * 0.12, y);
    c.arc(x, y, s * 0.12, 0, Math.PI * 2);
    c.stroke();
  },
  ruler(c, x, y, s) {
    c.save();
    c.translate(x, y);
    c.rotate(-0.5);
    c.strokeRect(-s * 0.45, -s * 0.08, s * 0.9, s * 0.16);
    c.beginPath();
    for (let i = 0; i <= 12; i++) {
      const px = -s * 0.42 + (i / 12) * s * 0.84;
      c.moveTo(px, -s * 0.08);
      c.lineTo(px, -s * 0.08 + (i % 4 ? s * 0.04 : s * 0.08));
    }
    c.stroke();
    c.restore();
  },
  moon(c, x, y, s) {
    c.beginPath();
    c.arc(x, y, s * 0.32, Math.PI * 0.35, Math.PI * 1.65);
    c.quadraticCurveTo(x - s * 0.05, y, x + s * 0.18, y + s * 0.26);
    c.stroke();
    for (const [dx, dy] of [[0.3, -0.3], [0.38, 0.05], [0.25, 0.32]]) {
      c.beginPath();
      c.arc(x + dx * s, y + dy * s, 1.6, 0, Math.PI * 2);
      c.fill();
    }
  },
  rose(c, x, y, s) {
    c.beginPath();
    for (let i = 0; i < 40; i++) {
      const a = i * 0.45;
      const r = s * 0.02 + i * s * 0.006;
      c.lineTo(x + Math.cos(a) * r, y - s * 0.1 + Math.sin(a) * r * 0.85);
    }
    c.moveTo(x, y + s * 0.15);
    c.quadraticCurveTo(x + s * 0.05, y + s * 0.3, x - s * 0.02, y + s * 0.45);
    c.moveTo(x + s * 0.02, y + s * 0.3);
    c.quadraticCurveTo(x + s * 0.2, y + s * 0.22, x + s * 0.24, y + s * 0.3);
    c.stroke();
  },
  heart(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y + s * 0.3);
    c.bezierCurveTo(x - s * 0.45, y, x - s * 0.25, y - s * 0.35, x, y - s * 0.12);
    c.bezierCurveTo(x + s * 0.25, y - s * 0.35, x + s * 0.45, y, x, y + s * 0.3);
    c.stroke();
  },
  key(c, x, y, s) {
    c.beginPath();
    c.arc(x - s * 0.25, y, s * 0.12, 0, Math.PI * 2);
    c.moveTo(x - s * 0.13, y);
    c.lineTo(x + s * 0.4, y);
    c.moveTo(x + s * 0.3, y);
    c.lineTo(x + s * 0.3, y + s * 0.1);
    c.moveTo(x + s * 0.2, y);
    c.lineTo(x + s * 0.2, y + s * 0.07);
    c.stroke();
  },
  date(c, x, y, s, R) {
    c.font = `300 ${Math.round(s * 0.2)}px ${SERIF}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(['1989', '2011', '06.14', 'XIV', '2019'][(R() * 5) | 0], x, y);
  },
};
const MOTIF_KEYS = Object.keys(MOTIFS);

/**
 * ENCRE FINE's back wall: deep bottle green, a grid of cream flash sheets of fine-line work pinned
 * up with brass tacks, a round mirror, a shelf of ink bottles. W x H metres at `ppm` px per metre.
 */
export function flashWallTexture(W, H, { ppm = 220, seed = 64 } = {}) {
  const R = seeded(seed);
  return canvasTexture(Math.round(W * ppm), Math.round(H * ppm), (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1d2f2a');
    g.addColorStop(1, '#16231f');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // Brushed paint texture.
    for (let i = 0; i < 260; i++) {
      c.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},${0.015 + R() * 0.03})`;
      c.fillRect(R() * w, R() * h, 30 + R() * 140, 2 + R() * 4);
    }
    const m = (v) => v * ppm; // metres -> px
    // The flash: three rows of sheets from 0.95 m to 2.55 m, leaving room for the mirror on the right.
    const sheetW = m(0.42);
    const sheetH = m(0.52);
    const cols = Math.max(2, Math.floor((W - 1.1) / 0.47));
    for (let r = 0; r < 3; r++) {
      for (let k = 0; k < cols; k++) {
        const x = m(0.25) + k * m(0.47) + (R() - 0.5) * m(0.03);
        const y = h - m(2.6) + r * m(0.56) + (R() - 0.5) * m(0.02);
        c.save();
        c.translate(x + sheetW / 2, y + sheetH / 2);
        c.rotate((R() - 0.5) * 0.03);
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.fillRect(-sheetW / 2 + 4, -sheetH / 2 + 5, sheetW, sheetH);
        c.fillStyle = ['#efe6d2', '#f2ead9', '#e9dfc8'][(R() * 3) | 0];
        c.fillRect(-sheetW / 2, -sheetH / 2, sheetW, sheetH);
        ink(c, Math.max(1.4, ppm / 130));
        // 2 x 2 motifs per sheet, each from a shuffled pick.
        for (let q = 0; q < 4; q++) {
          const name = MOTIF_KEYS[(R() * MOTIF_KEYS.length) | 0];
          const s = sheetW * 0.42;
          MOTIFS[name](c, (q % 2 ? 0.25 : -0.25) * sheetW, (q < 2 ? -0.24 : 0.22) * sheetH, s, R);
        }
        c.fillStyle = '#b8964a';
        for (const [px, py] of [[-1, -1], [1, -1]]) {
          c.beginPath();
          c.arc(px * (sheetW / 2 - 8), py * (sheetH / 2 - 8), 4, 0, Math.PI * 2);
          c.fill();
        }
        c.restore();
      }
    }
    // A round mirror in a brass ring, the room's lamp caught in it.
    const mx = w - m(0.55);
    const my = h - m(1.75);
    c.fillStyle = '#9a8a5a';
    c.beginPath();
    c.arc(mx, my, m(0.34), 0, Math.PI * 2);
    c.fill();
    const mg = c.createLinearGradient(mx - m(0.3), my - m(0.3), mx + m(0.3), my + m(0.3));
    mg.addColorStop(0, '#c9d2d0');
    mg.addColorStop(0.5, '#6e7a78');
    mg.addColorStop(1, '#3c4644');
    c.fillStyle = mg;
    c.beginPath();
    c.arc(mx, my, m(0.31), 0, Math.PI * 2);
    c.fill();
    // A shelf of ink bottles under the flash.
    const sy = h - m(0.85);
    c.fillStyle = '#5a4030';
    c.fillRect(m(0.2), sy, w - m(1.2), m(0.04));
    for (let i = 0; i < 26; i++) {
      const bx = m(0.26) + i * ((w - m(1.35)) / 26);
      const bh = m(0.1 + R() * 0.05);
      c.fillStyle = ['#151312', '#151312', '#1d1b1a', '#6b2430', '#2f4f6a', '#c9a23a'][(R() * 6) | 0];
      c.fillRect(bx, sy - bh, m(0.045), bh);
      c.fillStyle = 'rgba(255,255,255,0.18)';
      c.fillRect(bx + 2, sy - bh + 3, 2, bh - 6);
    }
  });
}

/** The blade sign: cream board, oxblood border, hand-lettered name and a fine-line swallow. */
export function encreSignTexture(name, trade) {
  return canvasTexture(900, 600, (c, w, h) => {
    c.fillStyle = '#ebe2cf';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#6b2430';
    c.lineWidth = 22;
    c.strokeRect(11, 11, w - 22, h - 22);
    c.lineWidth = 3;
    c.strokeRect(40, 40, w - 80, h - 80);
    ink(c, 3.5);
    MOTIFS.swallow(c, w / 2, h * 0.26, 230);
    c.fillStyle = '#151312';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    let fs = 132;
    c.font = `400 ${fs}px ${HAND}`;
    while (c.measureText(name).width > w * 0.8 && fs > 40) c.font = `400 ${(fs -= 4)}px ${HAND}`;
    c.fillText(name, w / 2, h * 0.58);
    c.fillStyle = '#6b2430';
    c.font = `italic 400 46px ${SERIF}`;
    if ('letterSpacing' in c) c.letterSpacing = '8px';
    c.fillText(trade, w / 2, h * 0.82);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
  });
}

/** Fine gilded letters on a transparent background (ENCRE FINE's fascia). */
export function giltTexture(text) {
  return canvasTexture(1400, 180, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    let fs = 120;
    c.font = `400 ${fs}px ${SERIF}`;
    if ('letterSpacing' in c) c.letterSpacing = '22px';
    while (c.measureText(text).width > w * 0.92 && fs > 30) c.font = `400 ${(fs -= 4)}px ${SERIF}`;
    const g = c.createLinearGradient(0, h * 0.2, 0, h * 0.8);
    g.addColorStop(0, '#f3dc9a');
    g.addColorStop(0.5, '#b88a3a');
    g.addColorStop(1, '#e8c87a');
    c.fillStyle = 'rgba(30,10,10,0.6)';
    c.fillText(text, w / 2 + 3, h / 2 + 4);
    c.fillStyle = g;
    c.fillText(text, w / 2, h / 2);
  });
}

/** A bicycle in side view as a list of strokes, wheelbase ~1 m, at (x, y) = rear hub, px per metre s. */
function bikeStrokes(c, x, y, s, kind = 0) {
  const r = 0.34 * s;
  const fx = x + (kind === 2 ? 1.1 : 1.02) * s;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.moveTo(fx + r, y);
  c.arc(fx, y, r, 0, Math.PI * 2);
  const bb = [x + 0.42 * s, y + 0.02 * s];
  const st = [x + 0.32 * s, y - 0.52 * s];
  const ht = [x + 0.94 * s, y - 0.48 * s];
  c.moveTo(x, y);
  c.lineTo(...bb);
  c.lineTo(...st);
  c.lineTo(x, y);
  c.moveTo(...st);
  c.lineTo(...ht);
  c.lineTo(...bb);
  c.moveTo(...ht);
  c.lineTo(fx, y);
  c.moveTo(st[0] - 0.03 * s, st[1] - 0.08 * s);
  c.lineTo(st[0] + 0.1 * s, st[1] - 0.08 * s);
  if (kind === 1) {
    // drop bars
    c.moveTo(ht[0], ht[1] - 0.06 * s);
    c.quadraticCurveTo(ht[0] + 0.2 * s, ht[1] - 0.04 * s, ht[0] + 0.12 * s, ht[1] + 0.12 * s);
  } else {
    c.moveTo(ht[0] - 0.08 * s, ht[1] - 0.12 * s);
    c.lineTo(ht[0] + 0.1 * s, ht[1] - 0.1 * s);
  }
  c.stroke();
}

/**
 * CYCLES DURAND's back wall: dusty pale green plaster, the outline of a bike painted in white under
 * each pair of hooks (all empty), a stock number beside it, a paler rectangle where a poster hung.
 * slots: [{x (m from the left edge to the rear wheel's left), y (the top tube's height, m)}].
 */
export function outlineWallTexture(W, H, slots, { ppm = 200, seed = 74 } = {}) {
  const R = seeded(seed);
  return canvasTexture(Math.round(W * ppm), Math.round(H * ppm), (c, w, h) => {
    c.fillStyle = '#9fa894';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      c.fillStyle = `rgba(${R() < 0.5 ? '70,66,52' : '220,220,200'},${0.03 + R() * 0.05})`;
      c.beginPath();
      c.arc(R() * w, R() * h, 2 + R() * 22, 0, Math.PI * 2);
      c.fill();
    }
    // Dado: darker below 0.9 m, scuffed by fifty years of pedals.
    c.fillStyle = 'rgba(60,70,58,0.35)';
    c.fillRect(0, h - 0.9 * ppm, w, 0.9 * ppm);
    c.fillStyle = 'rgba(40,36,30,0.5)';
    c.fillRect(0, h - 0.9 * ppm - 6, w, 6);
    // The outlines: white house paint, a little uneven. The rear hub sits 0.44 m below the top tube.
    slots.forEach((sl, i) => {
      c.strokeStyle = 'rgba(244,240,226,0.9)';
      c.lineWidth = 0.024 * ppm;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.save();
      c.translate(sl.x * ppm + 0.36 * ppm, h - (sl.y - 0.44) * ppm);
      c.rotate((R() - 0.5) * 0.03);
      bikeStrokes(c, 0, 0, 0.85 * ppm, i % 3);
      c.restore();
      c.fillStyle = 'rgba(244,240,226,0.75)';
      c.font = `700 ${0.1 * ppm}px ${SANS}`;
      c.fillText(String(i + 1), sl.x * ppm + 0.02 * ppm, h - (sl.y - 0.05) * ppm);
    });
    // Dust: a grey veil, thicker toward the top.
    const d = c.createLinearGradient(0, 0, 0, h);
    d.addColorStop(0, 'rgba(120,118,104,0.35)');
    d.addColorStop(1, 'rgba(120,118,104,0.08)');
    c.fillStyle = d;
    c.fillRect(0, 0, w, h);
  });
}

/** A wall of framed photos: 52 years, sepia at one end, faded colour at the other. */
export function photoWallTexture(W, H, { ppm = 220, seed = 1974 } = {}) {
  const R = seeded(seed);
  return canvasTexture(Math.round(W * ppm), Math.round(H * ppm), (c, w, h) => {
    c.clearRect(0, 0, w, h);
    let x = 10;
    let row = 0;
    const rows = 3;
    const rh = h / rows;
    let i = 0;
    while (row < rows) {
      const fw = (0.22 + R() * 0.18) * ppm;
      const fh = (0.18 + R() * 0.12) * ppm;
      if (x + fw > w - 10) {
        x = 10 + R() * 20;
        row++;
        continue;
      }
      const y = row * rh + (rh - fh) / 2 + (R() - 0.5) * 10;
      const age = Math.min(1, (row * 6 + i * 0.4) / 22); // 0 = 1974 (sepia), 1 = recent (colour)
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(x + 3, y + 4, fw, fh);
      c.fillStyle = ['#2a221a', '#5a4a36', '#1e1e1e', '#8a7a5a'][(R() * 4) | 0];
      c.fillRect(x, y, fw, fh);
      const p = 0.06 * ppm;
      const ix = x + p;
      const iy = y + p;
      const iw = fw - 2 * p;
      const ih = fh - 2 * p;
      c.fillStyle = '#e8e2d2';
      c.fillRect(x + p * 0.5, y + p * 0.5, fw - p, fh - p);
      const sep = [176, 150, 112];
      const col = [130 + R() * 80, 140 + R() * 60, 120 + R() * 80];
      const mix = (k) => `rgb(${sep.map((s, j) => Math.round(s * (1 - age) + col[j] * age) * k).join(',')})`;
      const sky = c.createLinearGradient(0, iy, 0, iy + ih);
      sky.addColorStop(0, mix(1));
      sky.addColorStop(1, mix(0.6));
      c.fillStyle = sky;
      c.fillRect(ix, iy, iw, ih);
      // A figure or two, sometimes a bike, sometimes the shopfront.
      c.fillStyle = mix(0.35);
      if (R() < 0.4) c.fillRect(ix, iy + ih * 0.55, iw, ih * 0.45);
      const n = 1 + ((R() * 3) | 0);
      for (let k = 0; k < n; k++) {
        const fx = ix + iw * (0.2 + 0.6 * R());
        c.beginPath();
        c.arc(fx, iy + ih * 0.35, ih * 0.09, 0, Math.PI * 2);
        c.fill();
        c.fillRect(fx - ih * 0.08, iy + ih * 0.44, ih * 0.16, ih * 0.5);
      }
      if (R() < 0.6) {
        c.strokeStyle = mix(0.3);
        c.lineWidth = 2;
        bikeStrokes(c, ix + iw * 0.15, iy + ih * 0.82, ih * 0.38, (R() * 3) | 0);
      }
      // Fading and a little glare on the glass.
      c.fillStyle = `rgba(240,230,210,${0.1 + (1 - age) * 0.15})`;
      c.fillRect(ix, iy, iw, ih);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.beginPath();
      c.moveTo(x + fw * 0.6, y);
      c.lineTo(x + fw, y);
      c.lineTo(x + fw, y + fh * 0.4);
      c.closePath();
      c.fill();
      x += fw + 12 + R() * 16;
      i++;
    }
  });
}

/**
 * The 1974 photo, framed: a young man in a flat cap in front of the new shop, a black bike, and the
 * pencilled caption on the mount. caption: e.g. « Albert Durand, 1974 ».
 */
export function photo1974Texture(caption, shopName = 'CYCLES DURAND') {
  return canvasTexture(640, 520, (c, w, h) => {
    c.fillStyle = '#3a2a1c';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#e9e2cf';
    c.fillRect(26, 26, w - 52, h - 52);
    const x0 = 70;
    const y0 = 60;
    const pw = w - 140;
    const ph = h - 190;
    const g = c.createLinearGradient(0, y0, 0, y0 + ph);
    g.addColorStop(0, '#d8c8a4');
    g.addColorStop(1, '#8a7656');
    c.fillStyle = g;
    c.fillRect(x0, y0, pw, ph);
    // The shopfront: fascia with the name, a dark window.
    c.fillStyle = '#5a4a36';
    c.fillRect(x0, y0 + ph * 0.12, pw, ph * 0.16);
    c.fillStyle = '#efe4c8';
    c.font = `700 ${Math.round(ph * 0.1)}px ${SERIF}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(shopName, x0 + pw / 2, y0 + ph * 0.2);
    c.fillStyle = '#3e3226';
    c.fillRect(x0 + pw * 0.05, y0 + ph * 0.32, pw * 0.6, ph * 0.5);
    c.fillStyle = '#6a5a44';
    c.fillRect(x0 + pw * 0.72, y0 + ph * 0.32, pw * 0.2, ph * 0.6);
    c.fillStyle = '#a8946e';
    c.fillRect(x0, y0 + ph * 0.86, pw, ph * 0.14);
    // The young man: flat cap, a hand on the saddle of a black bike.
    c.fillStyle = '#2e241a';
    const mx = x0 + pw * 0.62;
    c.beginPath();
    c.arc(mx, y0 + ph * 0.4, ph * 0.055, 0, Math.PI * 2);
    c.fill();
    c.fillRect(mx - ph * 0.07, y0 + ph * 0.34, ph * 0.14, ph * 0.03); // cap peak
    c.fillRect(mx - ph * 0.06, y0 + ph * 0.46, ph * 0.12, ph * 0.26);
    c.fillRect(mx - ph * 0.05, y0 + ph * 0.72, ph * 0.04, ph * 0.18);
    c.fillRect(mx + ph * 0.01, y0 + ph * 0.72, ph * 0.04, ph * 0.18);
    c.strokeStyle = '#1e1810';
    c.lineWidth = 4;
    bikeStrokes(c, x0 + pw * 0.12, y0 + ph * 0.86, ph * 0.38, 1);
    // Age: grain and a corner gone.
    const R = seeded(1974);
    for (let i = 0; i < 1400; i++) {
      c.fillStyle = `rgba(${R() < 0.5 ? '255,250,230' : '40,30,20'},${R() * 0.12})`;
      c.fillRect(x0 + R() * pw, y0 + R() * ph, 2, 2);
    }
    c.fillStyle = 'rgba(233,226,207,0.9)';
    c.beginPath();
    c.moveTo(x0 + pw, y0 + ph);
    c.lineTo(x0 + pw - 40, y0 + ph);
    c.lineTo(x0 + pw, y0 + ph - 30);
    c.fill();
    // The pencilled caption on the mount.
    c.fillStyle = 'rgba(70,64,56,0.9)';
    c.font = `400 34px ${HAND}`;
    c.fillText(caption, w / 2, h - 72);
  });
}

/**
 * The shop calendar: a faded racing picture on top, the month's grid below with every night ticked
 * in pencil and timed (« 3 h 12 »). The times are Durand's (docs/SCRIPT-R4.md: 3 h 12, 3 h 09, 3 h 15).
 */
export function calendarTexture({ seed = 312, days = 30, from = 1 } = {}) {
  const R = seeded(seed);
  return canvasTexture(420, 600, (c, w, h) => {
    c.fillStyle = '#ece6d6';
    c.fillRect(0, 0, w, h);
    // Picture: a rider on a climb, gone blue-grey.
    const g = c.createLinearGradient(0, 0, 0, 250);
    g.addColorStop(0, '#9fb0b8');
    g.addColorStop(1, '#c8bfa4');
    c.fillStyle = g;
    c.fillRect(20, 20, w - 40, 230);
    c.fillStyle = '#7a7a62';
    c.beginPath();
    c.moveTo(20, 250);
    c.lineTo(w - 20, 120);
    c.lineTo(w - 20, 250);
    c.fill();
    c.strokeStyle = '#2e3236';
    c.lineWidth = 5;
    bikeStrokes(c, 150, 190, 90, 1);
    c.fillStyle = '#2e3236';
    c.beginPath();
    c.arc(225, 120, 12, 0, Math.PI * 2);
    c.fill();
    c.fillRect(196, 128, 40, 14);
    // Grid.
    const top = 280;
    const cw = (w - 40) / 7;
    const rh = (h - top - 20) / 5;
    c.strokeStyle = 'rgba(80,70,60,0.5)';
    c.lineWidth = 1.5;
    for (let r = 0; r <= 5; r++) {
      c.beginPath();
      c.moveTo(20, top + r * rh);
      c.lineTo(w - 20, top + r * rh);
      c.stroke();
    }
    for (let k = 0; k <= 7; k++) {
      c.beginPath();
      c.moveTo(20 + k * cw, top);
      c.lineTo(20 + k * cw, top + 5 * rh);
      c.stroke();
    }
    const fixed = ['3 h 12', '3 h 09', '3 h 15'];
    for (let d = 0; d < days; d++) {
      const cell = d + from;
      const r = Math.floor(cell / 7);
      const k = cell % 7;
      if (r > 4) break;
      const cx = 20 + k * cw;
      const cy = top + r * rh;
      c.fillStyle = '#4a4038';
      c.font = `600 16px ${SANS}`;
      c.textAlign = 'left';
      c.textBaseline = 'top';
      c.fillText(String(d + 1), cx + 4, cy + 3);
      // Pencil: a tick and the time.
      c.strokeStyle = 'rgba(70,70,74,0.85)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(cx + cw * 0.55, cy + rh * 0.22);
      c.lineTo(cx + cw * 0.68, cy + rh * 0.36);
      c.lineTo(cx + cw * 0.9, cy + rh * 0.08);
      c.stroke();
      c.fillStyle = 'rgba(70,70,74,0.9)';
      c.font = `400 15px ${HAND}`;
      c.textAlign = 'center';
      const t = d < fixed.length ? fixed[fixed.length - 1 - d] : `3 h ${String(4 + ((R() * 13) | 0)).padStart(2, '0')}`;
      c.fillText(t, cx + cw / 2, cy + rh * 0.55);
    }
    c.fillStyle = 'rgba(120,110,90,0.12)';
    c.fillRect(0, 0, w, h);
  });
}

/** The jig's steel rule with its stop block set at 52 (cm), seen from above. */
export function jigRuleTexture() {
  return canvasTexture(1024, 64, (c, w, h) => {
    c.fillStyle = '#c9c7c0';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#1e1e1e';
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.font = `600 16px ${SANS}`;
    const pxcm = w / 70; // 0..70 cm
    for (let cm = 0; cm <= 70; cm++) {
      const x = cm * pxcm;
      c.fillRect(x, 0, 2, cm % 10 === 0 ? 30 : cm % 5 === 0 ? 22 : 14);
      if (cm % 10 === 0) c.fillText(String(cm), x, 34);
    }
    c.fillStyle = '#b8322a';
    c.fillRect(52 * pxcm - 3, 0, 6, h);
    c.font = `800 20px ${SANS}`;
    c.fillText('52', 52 * pxcm + 18, 34);
  });
}

/** The label on the open tin: Odile's hand, « Bleu Durand, 1979, O. M. ». */
export function tinLabelTexture(text) {
  return canvasTexture(512, 128, (c, w, h) => {
    c.fillStyle = '#e4dcc6';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#5f86a8';
    c.fillRect(0, 0, w, 18);
    c.fillRect(0, h - 18, w, 18);
    c.fillStyle = '#2b2a28';
    c.font = `400 40px ${HAND}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, w / 2, h / 2);
  });
}

/** Sawdust on No. 14's doorstep with one print in it: a smooth sole with small checks (a slipper). print: false = sawdust only. */
export function slipperPrintTexture({ print = true } = {}) {
  const R = seeded(44);
  return canvasTexture(512, 512, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) {
      const a = R() * Math.PI * 2;
      const r = Math.pow(R(), 0.6) * w * 0.46;
      c.fillStyle = `rgba(${215 + R() * 35},${180 + R() * 40},${120 + R() * 30},${0.45 + R() * 0.5})`;
      c.fillRect(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r * 0.8, 1 + R() * 3, 1 + R() * 2);
    }
    if (!print) return;
    // The print: an elongated sole, the sawdust pressed out of it, a fine check pattern left behind.
    c.save();
    c.translate(w * 0.5, h * 0.52);
    c.rotate(-0.35);
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    c.ellipse(0, -60, 62, 110, 0, 0, Math.PI * 2);
    c.ellipse(0, 90, 50, 70, 0, 0, Math.PI * 2);
    c.fill();
    c.globalCompositeOperation = 'source-over';
    c.beginPath();
    c.ellipse(0, -60, 62, 110, 0, 0, Math.PI * 2);
    c.ellipse(0, 90, 50, 70, 0, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = 'rgba(210,170,110,0.55)';
    for (let j = 0; j < 30; j++) for (let i = 0; i < 12; i++) if ((i + j) % 2 === 0) c.fillRect(-70 + i * 12, -180 + j * 12, 5, 5);
    c.restore();
  });
}
