import * as THREE from 'three';
import { canvasTexture, rng as seeded } from '../../build.js';

// Canvas art for the street: the lit-window interiors and the fly-poster / tag atlas. Both are one
// texture each, so every window or poster in the street is a quad in one merged mesh.

const CONDENSED = 'Impact, "Haettenschweiler", "Arial Narrow", "Helvetica Neue", sans-serif';
const SANS = 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const HAND = '"Bradley Hand", "Segoe Print", "Noteworthy", "Comic Sans MS", cursive';

/** Cell [u0, v0, u1, v1] of an n x n atlas (row 0 at the top of the canvas). */
export function cellUV(i, n) {
  const col = i % n;
  const row = Math.floor(i / n);
  return [col / n, 1 - (row + 1) / n, (col + 1) / n, 1 - row / n];
}

/**
 * Lit windows at night: 2 x 2 interiors (warm lamp + curtains, a TV's cold glow, net curtains,
 * a bare bulb and a shelf). Drawn mid-bright; the window mesh colour sets how hot each one burns.
 */
export function windowAtlas() {
  const N = 2;
  const S = 256;
  const H = Math.round(S * 1.6);
  return canvasTexture(S * N, H * N, (c) => {
    for (let i = 0; i < 4; i++) {
      const x0 = (i % N) * S;
      const y0 = Math.floor(i / N) * H;
      const R = seeded(900 + i);
      c.save();
      c.beginPath();
      c.rect(x0, y0, S, H);
      c.clip();
      const cold = i === 1;
      const g = c.createRadialGradient(x0 + S * (0.3 + R() * 0.4), y0 + H * 0.45, 8, x0 + S * 0.5, y0 + H * 0.5, H * 0.75);
      g.addColorStop(0, cold ? '#c8d6e6' : '#ffe2b0');
      g.addColorStop(0.45, cold ? '#6d7f96' : '#d8a060');
      g.addColorStop(1, cold ? '#1c232c' : '#4a2e1a');
      c.fillStyle = g;
      c.fillRect(x0, y0, S, H);
      // Ceiling shadow and a back wall line.
      const cg = c.createLinearGradient(0, y0, 0, y0 + H * 0.3);
      cg.addColorStop(0, 'rgba(20,12,6,0.55)');
      cg.addColorStop(1, 'rgba(20,12,6,0)');
      c.fillStyle = cg;
      c.fillRect(x0, y0, S, H * 0.3);
      // Furniture silhouettes.
      c.fillStyle = 'rgba(28,18,12,0.75)';
      if (i === 0) {
        c.fillRect(x0 + S * 0.55, y0 + H * 0.62, S * 0.4, H * 0.4); // sideboard
        c.beginPath();
        c.moveTo(x0 + S * 0.62, y0 + H * 0.5);
        c.lineTo(x0 + S * 0.8, y0 + H * 0.5);
        c.lineTo(x0 + S * 0.76, y0 + H * 0.42);
        c.lineTo(x0 + S * 0.66, y0 + H * 0.42);
        c.fill(); // lamp shade
      } else if (i === 1) {
        c.fillRect(x0 + S * 0.1, y0 + H * 0.7, S * 0.8, H * 0.3); // sofa back
        c.fillStyle = 'rgba(200,220,240,0.25)';
        c.fillRect(x0 + S * 0.3, y0 + H * 0.35, S * 0.4, 6);
      } else if (i === 2) {
        for (let k = 0; k < 3; k++) c.fillRect(x0 + S * 0.08, y0 + H * (0.35 + k * 0.16), S * 0.5, 7); // shelves
        for (let k = 0; k < 12; k++) c.fillRect(x0 + S * 0.1 + k * 9 + R() * 4, y0 + H * (0.35 + ((k % 3) * 0.16)) - 22, 7, 22);
      } else {
        c.fillRect(x0 + S * 0.49, y0, 2, H * 0.28); // flex
        c.fillStyle = 'rgba(255,240,200,0.9)';
        c.beginPath();
        c.arc(x0 + S * 0.5, y0 + H * 0.29, 7, 0, Math.PI * 2);
        c.fill();
      }
      // Curtains (net or drawn), with folds.
      const net = i === 2;
      for (const side of [0, 1]) {
        const w = S * (net ? 0.5 : 0.18 + R() * 0.16);
        const x = side ? x0 + S - w : x0;
        c.fillStyle = net ? 'rgba(235,225,205,0.32)' : `rgba(${cold ? '40,46,60' : '96,52,30'},0.82)`;
        c.fillRect(x, y0, w, H);
        c.strokeStyle = 'rgba(0,0,0,0.18)';
        c.lineWidth = 3;
        for (let k = 1; k < 6; k++) {
          c.beginPath();
          c.moveTo(x + (k / 6) * w, y0);
          c.lineTo(x + (k / 6) * w + (R() - 0.5) * 6, y0 + H);
          c.stroke();
        }
      }
      c.restore();
    }
  });
}

/** A ragged paper outline (torn bottom and corners) inside w x h at (0, 0). */
function tornPath(c, w, h, R, torn) {
  c.beginPath();
  c.moveTo(R() * 6, R() * 6);
  for (let k = 1; k <= 8; k++) c.lineTo((k / 8) * w - R() * 4, R() * 5);
  const cut = h * (1 - torn);
  c.lineTo(w - R() * 5, cut * (0.6 + R() * 0.4));
  for (let k = 8; k >= 0; k--) c.lineTo((k / 8) * w, cut + (R() - 0.4) * h * 0.08 * (k % 2 ? 1 : 0.5) + (R() < 0.2 ? -h * 0.15 * R() : 0));
  c.closePath();
}

const POSTERS = [
  { kind: 'gig', bg: '#d8c9a6', ink: '#1d1b19', accent: '#a23a2e', title: 'LES\nRADIATEURS', sub: 'EN CONCERT · SAM 14', foot: 'SALLE DES FÊTES' },
  { kind: 'gig', bg: '#2a2e36', ink: '#e8e0cc', accent: '#d9a441', title: 'NUIT\nBLANCHE', sub: 'DJ · 23H → 6H', foot: 'ENTRÉE 8€' },
  { kind: 'bold', bg: '#e4dccb', ink: '#b8322a', accent: '#1d1b19', title: 'SOLDES', sub: '-50%', foot: 'TOUT DOIT DISPARAÎTRE' },
  { kind: 'gig', bg: '#c9bda1', ink: '#2c4f6a', accent: '#1d1b19', title: 'CIRQUE\nVALENTI', sub: 'DU 3 AU 12', foot: 'PLACE DU MARCHÉ' },
  { kind: 'lost', bg: '#efeadf', ink: '#2b2a28', accent: '#2b2a28', title: 'PERDU', sub: 'chat gris, très gentil\nrépond à "Moustache"', foot: '06 · · · · · ·' },
  { kind: 'bold', bg: '#e8e2d2', ink: '#1d1b19', accent: '#7a8a3a', title: 'VIDE\nGRENIER', sub: 'DIMANCHE 7H', foot: 'RUE DES TANNEURS' },
  { kind: 'gig', bg: '#8a2f2a', ink: '#efe6d2', accent: '#efe6d2', title: 'LOTO', sub: 'GROS LOTS', foot: 'VENDREDI 20H' },
  { kind: 'rent', bg: '#f0ebe0', ink: '#b8322a', accent: '#2b2a28', title: 'À LOUER', sub: 'local commercial', foot: '03 · · · · · ·' },
  { kind: 'gig', bg: '#3f4a3c', ink: '#d6dcc4', accent: '#c6f432', title: 'SEMI\nNOCTURNE', sub: '10 KM · 5 KM', foot: 'INSCRIPTIONS' },
  { kind: 'bold', bg: '#ddd3bd', ink: '#1d1b19', accent: '#8a2f2a', title: 'BRADERIE', sub: 'SAM · DIM', foot: '' },
];

/**
 * The fly-poster and tag atlas (4 x 4 cells): cells 0-9 posters (torn, faded, wet-stained),
 * cells 10-15 spray tags on transparent. Returns { texture, cells: [{uv, aspect, kind}] }.
 */
export function posterAtlas(seed = 31) {
  const N = 4;
  const S = 512;
  const cells = [];
  const tex = canvasTexture(S * N, S * N, (c) => {
    c.clearRect(0, 0, S * N, S * N);
    POSTERS.forEach((p, i) => {
      const R = seeded(seed + i * 13);
      const x0 = (i % N) * S;
      const y0 = Math.floor(i / N) * S;
      const pw = S * 0.7;
      const ph = S * 0.98;
      const ox = x0 + (S - pw) / 2;
      const oy = y0 + 4;
      c.save();
      c.translate(ox, oy);
      tornPath(c, pw, ph, R, 0.05 + R() * 0.3);
      c.clip();
      c.fillStyle = p.bg;
      c.fillRect(0, 0, pw, ph);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      if (p.kind === 'lost') {
        c.fillStyle = p.ink;
        c.font = `700 72px ${HAND}`;
        c.fillText(p.title, pw / 2, ph * 0.12);
        c.fillStyle = 'rgba(60,60,60,0.85)';
        c.fillRect(pw * 0.2, ph * 0.2, pw * 0.6, ph * 0.36); // photocopied photo
        c.fillStyle = 'rgba(200,200,200,0.5)';
        c.beginPath();
        c.ellipse(pw * 0.5, ph * 0.4, pw * 0.16, ph * 0.1, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = p.ink;
        c.font = `400 26px ${HAND}`;
        p.sub.split('\n').forEach((l, k) => c.fillText(l, pw / 2, ph * 0.64 + k * 32));
        for (let k = 0; k < 7; k++) {
          c.save();
          c.translate(pw * (0.08 + k * 0.13), ph * 0.9);
          c.rotate(-Math.PI / 2);
          c.font = `400 15px ${HAND}`;
          c.fillText(p.foot, 0, 0);
          c.restore();
          c.strokeStyle = 'rgba(0,0,0,0.25)';
          c.beginPath();
          c.moveTo(pw * (0.145 + k * 0.13), ph * 0.8);
          c.lineTo(pw * (0.145 + k * 0.13), ph);
          c.stroke();
        }
      } else {
        // Big condensed title, a band, sub and footer.
        const lines = p.title.split('\n');
        let fs = lines.length > 1 ? 112 : 150;
        c.font = `900 ${fs}px ${CONDENSED}`;
        while (Math.max(...lines.map((l) => c.measureText(l).width)) > pw * 0.9 && fs > 30) {
          fs *= 0.92;
          c.font = `900 ${fs}px ${CONDENSED}`;
        }
        if (p.kind === 'gig') {
          c.fillStyle = p.accent;
          c.globalAlpha = 0.85;
          c.beginPath();
          c.arc(pw * 0.5, ph * 0.62, pw * 0.3, 0, Math.PI * 2);
          c.fill();
          c.globalAlpha = 1;
        }
        c.fillStyle = p.ink;
        lines.forEach((l, k) => c.fillText(l, pw / 2, ph * 0.2 + k * fs * 0.95));
        c.fillStyle = p.accent;
        c.fillRect(pw * 0.08, ph * 0.43, pw * 0.84, 10);
        c.fillStyle = p.kind === 'gig' ? p.ink : p.accent;
        c.font = `700 ${p.kind === 'bold' ? 64 : 36}px ${p.kind === 'rent' ? SANS : CONDENSED}`;
        c.fillText(p.sub, pw / 2, ph * (p.kind === 'gig' ? 0.86 : 0.58));
        c.fillStyle = p.ink;
        c.font = `600 24px ${p.kind === 'rent' ? SANS : SERIF}`;
        c.fillText(p.foot, pw / 2, ph * 0.94);
      }
      // Weathering: grime film, wet tide marks, creases, glue blotches, scuffs.
      c.fillStyle = `rgba(58,50,38,${0.16 + R() * 0.16})`;
      c.fillRect(0, 0, pw, ph);
      for (let k = 0; k < 10; k++) {
        const g = c.createRadialGradient(R() * pw, ph * (0.4 + R() * 0.7), 4, R() * pw, ph * (0.5 + R() * 0.6), 40 + R() * 120);
        g.addColorStop(0, `rgba(70,60,40,${0.12 + R() * 0.2})`);
        g.addColorStop(1, 'rgba(70,60,40,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, pw, ph);
      }
      c.strokeStyle = 'rgba(40,32,24,0.28)';
      c.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        c.beginPath();
        const y = ph * (0.2 + R() * 0.6);
        c.moveTo(0, y);
        c.lineTo(pw, y + (R() - 0.5) * 30);
        c.stroke();
      }
      const wet = c.createLinearGradient(0, ph * 0.55, 0, ph);
      wet.addColorStop(0, 'rgba(50,44,34,0)');
      wet.addColorStop(1, 'rgba(50,44,34,0.45)');
      c.fillStyle = wet;
      c.fillRect(0, 0, pw, ph);
      // A strip of an older poster underneath showing through a tear.
      if (R() < 0.6) {
        c.fillStyle = 'rgba(236,230,214,0.9)';
        c.beginPath();
        const tx = R() * pw * 0.6;
        c.moveTo(tx, ph * 0.3);
        c.lineTo(tx + 60 + R() * 60, ph * 0.28);
        c.lineTo(tx + 40, ph * 0.5);
        c.closePath();
        c.fill();
      }
      c.restore();
      cells.push({ uv: cellUV(i, N), aspect: pw / S, top: 4 / S, kind: 'poster' });
    });
    // Tags: spray letters with an outline, overspray and drips.
    const TAGS = ['ZOKE', 'KRS', 'BENZ', 'MOLE', 'OKAY', 'RUSTY'];
    const tagCols = ['#2b2b2e', '#d8d2c4', '#7d2f3a', '#2f4f6a', '#e0e0d8', '#3a3a3e'];
    for (let t = 0; t < 6; t++) {
      const i = 10 + t;
      const R = seeded(seed + 500 + t);
      const x0 = (i % N) * S;
      const y0 = Math.floor(i / N) * S;
      c.save();
      c.translate(x0 + S / 2, y0 + S * 0.48);
      c.rotate((R() - 0.5) * 0.25);
      const word = TAGS[t];
      c.font = `italic 900 ${150 - word.length * 10}px ${t % 2 ? CONDENSED : HAND}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      const col = tagCols[t];
      c.shadowColor = col;
      c.shadowBlur = 14; // overspray
      c.lineWidth = 26;
      c.strokeStyle = t % 3 === 1 ? '#1a1a1c' : col;
      c.strokeText(word, 0, 0);
      c.shadowBlur = 0;
      c.fillStyle = t % 3 === 1 ? col : '#1a1a1c';
      c.fillText(word, 0, 0);
      // Drips.
      c.strokeStyle = t % 3 === 1 ? '#1a1a1c' : col;
      c.lineWidth = 4;
      c.lineCap = 'round';
      for (let k = 0; k < 7; k++) {
        const x = (R() - 0.5) * S * 0.7;
        const y = 20 + R() * 40;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + (R() - 0.5) * 3, y + 30 + R() * 120);
        c.stroke();
      }
      c.restore();
      cells.push({ uv: cellUV(i, N), aspect: 1, top: 0, kind: 'tag' });
    }
  });
  tex.anisotropy = 8;
  return { texture: tex, cells };
}
