import * as B from '../../build.js';
import { W, D, TRESTLE, STAND, DOOR_X, PEG } from './layout.js';
import { makeCanvas, canvasTex } from './geo.js';

// Canvas layers for the workshop. They sit on top of the PBR surfaces (the concrete and plywood
// detail comes from the material library), so they only carry the story's marks: oil, sawdust,
// decades of paint drips, the painted tool outlines, the calendar and the old notices.

/**
 * Floor overlay for the 9 x 6 m room: a light neutral base (the PBR concrete supplies the texture)
 * with saw-cut joints, cracks, oil, paint drips, sawdust under the trestles and chalk layout marks.
 */
export function floorTexture() {
  return B.canvasTexture(2048, 1366, (g, w, h) => {
    const R = B.rng(5);
    B.paintNoise(g, w, h, '#c4bdb2', 0.035);
    const toPx = (x, z) => [((x + W / 2) / W) * w, ((z + D / 2) / D) * h];
    const ppm = w / W;
    // Large damp and wear clouds.
    for (let i = 0; i < 34; i++) {
      const r = 60 + R() * 240;
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
      const dark = R() < 0.72;
      grd.addColorStop(0, dark ? 'rgba(52,44,34,0.18)' : 'rgba(235,228,214,0.12)');
      grd.addColorStop(1, 'rgba(52,44,34,0)');
      g.save();
      g.translate(R() * w, R() * h);
      g.scale(1, 0.5 + R() * 0.7);
      g.fillStyle = grd;
      g.fillRect(-r, -r, r * 2, r * 2);
      g.restore();
    }
    // Darker band along the walls (dust that never gets swept).
    const edge = (x0, y0, x1, y1, gx0, gy0, gx1, gy1) => {
      const grd = g.createLinearGradient(gx0, gy0, gx1, gy1);
      grd.addColorStop(0, 'rgba(40,32,24,0.42)');
      grd.addColorStop(1, 'rgba(40,32,24,0)');
      g.fillStyle = grd;
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
    };
    edge(0, 0, w, 90, 0, 0, 0, 90);
    edge(0, 0, 90, h, 0, 0, 90, 0);
    edge(w - 90, 0, w, h, w, 0, w - 90, 0);
    // Saw-cut joints every 1.5 m and hairline cracks.
    g.lineWidth = 2.2;
    for (let x = -3; x <= 3; x += 1.5) {
      const [px] = toPx(x, 0);
      g.strokeStyle = 'rgba(28,24,20,0.55)';
      g.beginPath();
      g.moveTo(px, 0);
      g.lineTo(px, h);
      g.stroke();
      g.strokeStyle = 'rgba(230,222,206,0.18)';
      g.beginPath();
      g.moveTo(px + 2, 0);
      g.lineTo(px + 2, h);
      g.stroke();
    }
    for (const z of [-1.5, 0, 1.5]) {
      const [, py] = toPx(0, z);
      g.strokeStyle = 'rgba(28,24,20,0.5)';
      g.beginPath();
      g.moveTo(0, py);
      g.lineTo(w, py);
      g.stroke();
    }
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(25,20,15,0.5)';
    for (let i = 0; i < 14; i++) {
      let x = R() * w;
      let y = R() * h;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 18; k++) g.lineTo((x += (R() - 0.5) * 46), (y += (R() - 0.5) * 46));
      g.stroke();
    }
    // Oil under the bike stand, in front of the bench, by the garage and the drums.
    const oil = (x, z, r, n = 5) => {
      const [px, py] = toPx(x, z);
      for (let k = 0; k < n; k++) {
        g.fillStyle = `rgba(20,18,16,${0.1 + R() * 0.16})`;
        g.beginPath();
        g.ellipse(px + (R() - 0.5) * r, py + (R() - 0.5) * r * 0.6, r * (0.3 + R() * 0.6), r * (0.2 + R() * 0.4), R() * 3, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = 'rgba(20,18,16,0.18)';
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(px, py, r * 0.9, r * 0.55, R(), 0, Math.PI * 2);
      g.stroke();
    };
    oil(STAND.x, STAND.z, 90);
    oil(STAND.x - 0.6, STAND.z - 0.3, 40, 3);
    oil(-2.6, -2.0, 70);
    oil(-4.0, 0.0, 110, 7);
    oil(-4.0, -2.2, 80);
    // Tyre tracks from the street to the stand.
    g.strokeStyle = 'rgba(30,28,26,0.16)';
    g.lineWidth = 7;
    for (const o of [0, 26]) {
      g.beginPath();
      g.moveTo(...toPx(-4.5, -0.1 + o / ppm));
      g.bezierCurveTo(...toPx(-3.6, 0.2 + o / ppm), ...toPx(-3.0, 0.9 + o / ppm), ...toPx(STAND.x - 0.2, STAND.z - 0.1 + o / ppm));
      g.stroke();
    }
    // Decades of paint drips: colours only hope gives back.
    const paints = ['#a3392b', '#b8893a', '#4a6a8a', '#d9cfb4', '#5f7a4a', '#c46a3a', '#2f3a4a', '#e8e0cc'];
    for (let i = 0; i < 520; i++) {
      const near = R() < 0.6;
      const cx = near ? TRESTLE.x + (R() - 0.5) * 3.6 : (R() - 0.5) * W;
      const cz = near ? TRESTLE.z + (R() - 0.5) * 2.4 : (R() - 0.5) * D;
      const [px, py] = toPx(cx, cz);
      g.fillStyle = paints[(R() * paints.length) | 0];
      g.globalAlpha = 0.3 + R() * 0.5;
      g.beginPath();
      const r = 1.2 + R() * (R() < 0.08 ? 12 : 4);
      g.ellipse(px, py, r, r * (0.6 + R() * 0.5), R() * 3, 0, Math.PI * 2);
      g.fill();
    }
    // A few spilled tins: a puddle with a tide ring.
    for (const [x, z, c] of [
      [TRESTLE.x + 1.2, TRESTLE.z + 0.55, '#d9cfb4'],
      [-0.6, -1.7, '#4a6a8a'],
      [TRESTLE.x - 1.1, TRESTLE.z - 0.65, '#a3392b'],
    ]) {
      const [px, py] = toPx(x, z);
      g.globalAlpha = 0.6;
      g.fillStyle = c;
      g.beginPath();
      for (let k = 0; k <= 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        const rr = 22 + R() * 16;
        g.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.7);
      }
      g.fill();
    }
    g.globalAlpha = 1;
    // Sawdust drifts under the trestles.
    const [tx, ty] = toPx(TRESTLE.x, TRESTLE.z);
    for (let i = 0; i < 3200; i++) {
      const a = R() * Math.PI * 2;
      const r = Math.pow(R(), 0.65) * 300;
      g.fillStyle = `rgba(226,204,160,${0.12 + R() * 0.3})`;
      g.fillRect(tx + Math.cos(a) * r * 1.35, ty + Math.sin(a) * r * 0.65, 1.5 + R() * 2, 1.5 + R());
    }
    // Chalk layout lines from an old job (Odile spaced a fascia on the floor).
    g.strokeStyle = 'rgba(240,236,226,0.22)';
    g.lineWidth = 3;
    const [cx0, cy0] = toPx(-0.9, 1.25);
    const [cx1] = toPx(2.6, 1.25);
    for (const dy of [0, 70]) {
      g.beginPath();
      g.moveTo(cx0, cy0 + dy);
      g.lineTo(cx1, cy0 + dy);
      g.stroke();
    }
    for (let x = cx0; x < cx1; x += 64 + R() * 30) {
      g.beginPath();
      g.moveTo(x, cy0 - 8);
      g.lineTo(x, cy0 + 78);
      g.stroke();
    }
    // Scuffed walking paths (lighter, polished).
    g.strokeStyle = 'rgba(235,228,212,0.08)';
    g.lineWidth = 130;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(...toPx(DOOR_X, -2.6));
    g.quadraticCurveTo(...toPx(1.8, 1.4), ...toPx(-2.8, -1.4));
    g.stroke();
    g.beginPath();
    g.moveTo(...toPx(-4.4, 0));
    g.quadraticCurveTo(...toPx(-2.0, 0.4), ...toPx(0.4, 1.4));
    g.stroke();
  });
}

/**
 * Pegboard: holes, cream painted outlines (some empty), a soft drop shadow under every hung tool
 * and the small wristwatch outline in the corner (Odile was ready before he was). Tools are given
 * in board metres (u from the left edge, v down from the top) so the props hang on their outlines.
 */
export const PEG_TOOLS = [
  // id, u, v (centre, m), [w, h] outline size (m), shape
  { id: 'hammer', u: 0.17, v: 0.36, size: [0.11, 0.31], shape: 'hammer' },
  { id: 'saw', u: 0.66, v: 0.16, size: [0.64, 0.17], shape: 'saw' },
  { id: 'pliers', u: 0.36, v: 0.5, size: [0.06, 0.19], shape: 'pliers' },
  { id: 'driver1', u: 0.47, v: 0.5, size: [0.03, 0.21], shape: 'driver' },
  { id: 'driver2', u: 0.53, v: 0.5, size: [0.03, 0.21], shape: 'driver' },
  { id: 'spanner1', u: 0.66, v: 0.55, size: [0.06, 0.34], shape: 'spanner' },
  { id: 'spanner2', u: 0.74, v: 0.55, size: [0.06, 0.34], shape: 'spanner' },
  { id: null, u: 0.82, v: 0.55, size: [0.06, 0.3], shape: 'spanner' }, // the missing one
  { id: null, u: 1.06, v: 0.47, size: [0.3, 0.36], shape: 'square' },
  { id: null, u: 1.29, v: 0.42, size: [0.12, 0.3], shape: 'mallet' },
  { id: null, u: 1.47, v: 0.42, size: [0.03, 0.26], shape: 'chisel' },
  { id: null, u: 1.53, v: 0.42, size: [0.03, 0.24], shape: 'chisel' },
  { id: null, u: 1.59, v: 0.42, size: [0.03, 0.22], shape: 'chisel' },
  { id: null, u: 0.27, v: 0.86, size: [0.05, 0.26], shape: 'brush' },
  { id: null, u: 0.35, v: 0.86, size: [0.05, 0.24], shape: 'brush' },
  { id: null, u: 0.43, v: 0.86, size: [0.04, 0.22], shape: 'brush' },
  { id: 'sandpaper', u: 1.22, v: 0.86, size: [0.15, 0.18], shape: 'rect' },
  { id: 'watch', u: 1.63, v: 1.0, size: [0.045, 0.15], shape: 'watch' },
];

export function pegboardTexture() {
  const [CW, CH] = PEG.px;
  const k = CW / PEG.w; // px per metre
  const c = makeCanvas(CW, CH);
  const g = c.getContext('2d');
  const R = B.rng(31);
  B.paintNoise(g, CW, CH, '#a2876a', 0.05);
  // Fibre streaks of the hardboard.
  for (let i = 0; i < 260; i++) {
    g.fillStyle = R() < 0.5 ? 'rgba(255,240,215,0.05)' : 'rgba(60,40,22,0.06)';
    g.fillRect(R() * CW, R() * CH, 30 + R() * 140, 1 + R() * 2);
  }
  // Painted outlines (cream), drawn first; holes are punched through them afterwards.
  g.fillStyle = 'rgba(226,216,192,0.86)';
  const P = (u, v) => [u * k, v * k];
  for (const t of PEG_TOOLS) {
    const [x, y] = P(t.u, t.v);
    const w = t.size[0] * k;
    const h = t.size[1] * k;
    g.save();
    g.translate(x, y);
    g.beginPath();
    if (t.shape === 'hammer') {
      g.rect(-w * 0.18, -h * 0.35, w * 0.36, h * 0.85);
      g.rect(-w * 0.55, -h * 0.5, w * 1.1, h * 0.2);
    } else if (t.shape === 'saw') {
      g.moveTo(-w * 0.5, -h * 0.05);
      g.lineTo(w * 0.28, -h * 0.45);
      g.lineTo(w * 0.28, h * 0.45);
      g.lineTo(-w * 0.5, h * 0.12);
      g.closePath();
      g.rect(w * 0.26, -h * 0.5, w * 0.24, h);
    } else if (t.shape === 'pliers') {
      g.moveTo(-w * 0.15, -h * 0.5);
      g.lineTo(w * 0.15, -h * 0.5);
      g.lineTo(w * 0.5, h * 0.5);
      g.lineTo(w * 0.15, h * 0.5);
      g.lineTo(0, -h * 0.1);
      g.lineTo(-w * 0.15, h * 0.5);
      g.lineTo(-w * 0.5, h * 0.5);
      g.closePath();
    } else if (t.shape === 'driver' || t.shape === 'chisel') {
      g.rect(-w * 0.18, -h * 0.5, w * 0.36, h * 0.55);
      g.rect(-w * 0.5, h * 0.05, w, h * 0.45);
    } else if (t.shape === 'spanner') {
      g.rect(-w * 0.2, -h * 0.4, w * 0.4, h * 0.8);
      g.ellipse(0, -h * 0.42, w * 0.5, w * 0.45, 0, 0, Math.PI * 2);
      g.ellipse(0, h * 0.42, w * 0.45, w * 0.42, 0, 0, Math.PI * 2);
    } else if (t.shape === 'square') {
      g.rect(-w * 0.5, -h * 0.5, w * 0.16, h);
      g.rect(-w * 0.5, h * 0.5 - h * 0.12, w, h * 0.12);
    } else if (t.shape === 'mallet') {
      g.rect(-w * 0.5, -h * 0.5, w, h * 0.3);
      g.rect(-w * 0.12, -h * 0.2, w * 0.24, h * 0.7);
    } else if (t.shape === 'brush') {
      g.rect(-w * 0.16, -h * 0.5, w * 0.32, h * 0.55);
      g.moveTo(-w * 0.5, h * 0.5);
      g.lineTo(-w * 0.3, h * 0.05);
      g.lineTo(w * 0.3, h * 0.05);
      g.lineTo(w * 0.5, h * 0.5);
      g.closePath();
    } else if (t.shape === 'watch') {
      g.ellipse(0, 0, w * 0.5, w * 0.5, 0, 0, Math.PI * 2);
      g.rect(-w * 0.32, -h * 0.5, w * 0.64, h * 0.4);
      g.rect(-w * 0.32, h * 0.1, w * 0.64, h * 0.4);
    } else g.rect(-w * 0.5, -h * 0.5, w, h);
    g.fill();
    g.restore();
  }
  // Holes: 25 mm pitch, with a darker rim.
  const pitch = 0.025 * k;
  for (let y = pitch / 2; y < CH; y += pitch) {
    for (let x = pitch / 2; x < CW; x += pitch) {
      g.fillStyle = 'rgba(24,16,10,0.85)';
      g.beginPath();
      g.arc(x, y, 2.6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,240,220,0.12)';
      g.fillRect(x - 2.4, y + 2.2, 4.8, 1);
    }
  }
  // Grime: hand smudges around the outlines, drips, and the top edge darkened by the tube's heat.
  for (let i = 0; i < 46; i++) {
    g.fillStyle = `rgba(40,28,18,${0.04 + R() * 0.1})`;
    g.beginPath();
    g.ellipse(R() * CW, R() * CH, 6 + R() * 50, 5 + R() * 30, R() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const top = g.createLinearGradient(0, 0, 0, 120);
  top.addColorStop(0, 'rgba(30,22,14,0.4)');
  top.addColorStop(1, 'rgba(30,22,14,0)');
  g.fillStyle = top;
  g.fillRect(0, 0, CW, 120);
  // Soft drop shadows where the tools hang (the tube light has no shadow map).
  for (const t of PEG_TOOLS) {
    if (!t.id || t.id === 'watch') continue;
    const [x, y] = P(t.u, t.v);
    const w = t.size[0] * k;
    const h = t.size[1] * k;
    const grd = g.createRadialGradient(x + 3, y + 10, 2, x + 3, y + 10, Math.max(w, h) * 0.65);
    grd.addColorStop(0, 'rgba(18,12,8,0.45)');
    grd.addColorStop(1, 'rgba(18,12,8,0)');
    g.fillStyle = grd;
    g.save();
    g.translate(x + 3, y + 10);
    g.scale(w / Math.max(w, h) + 0.25, h / Math.max(w, h) + 0.1);
    g.translate(-x - 3, -y - 10);
    g.fillRect(x - w, y - h, w * 2 + 6, h * 2 + 20);
    g.restore();
  }
  const tex = canvasTex(c);
  /** Board metres (u from left, v from top) -> local offset from the board centre [x, y]. */
  const at = (u, v) => [u - PEG.w / 2, PEG.h / 2 - v];
  return { tex, at };
}

/**
 * One atlas for the wall decals (a single draw): the garage calendar, a faded paint advert, a
 * no-smoking plate, the price list, the photo of father and daughter and a torn job sheet.
 * Returns { tex, items: { name: [u0, v0, u1, v1] } } in UV space (v up).
 */
export function decalAtlas() {
  const S = 1024;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const R = B.rng(61);
  const items = {};
  const region = (name, x, y, w, h) => (items[name] = [x / S, 1 - (y + h) / S, (x + w) / S, 1 - y / S]);
  // Base colour + paper fibre speckles (drawn, not putImageData, so the torn-edge clip holds).
  const speckle = (x, y, w, h, base) => {
    g.fillStyle = base;
    g.fillRect(x, y, w, h);
    const n = Math.round((w * h) / 30);
    for (let i = 0; i < n; i++) {
      g.fillStyle = R() < 0.5 ? 'rgba(255,250,235,0.07)' : 'rgba(60,44,24,0.07)';
      g.fillRect(x + R() * w, y + R() * h, 1 + R() * 2, 1 + R() * 2);
    }
  };
  const aged = (x, y, w, h, base, { torn = 0, stains = 6 } = {}) => {
    g.save();
    g.beginPath();
    if (torn) {
      const n = 22;
      for (let i = 0; i <= n; i++) g.lineTo(x + (w * i) / n, y + R() * torn);
      for (let i = 0; i <= n; i++) g.lineTo(x + w - R() * torn, y + (h * i) / n);
      for (let i = 0; i <= n; i++) g.lineTo(x + w - (w * i) / n, y + h - R() * torn);
      for (let i = 0; i <= n; i++) g.lineTo(x + R() * torn, y + h - (h * i) / n);
    } else g.rect(x, y, w, h);
    g.closePath();
    g.clip();
    speckle(x, y, w, h, base);
    for (let i = 0; i < stains; i++) {
      const r = 10 + R() * w * 0.3;
      const grd = g.createRadialGradient(0, 0, r * 0.6, 0, 0, r);
      grd.addColorStop(0, 'rgba(120,90,50,0.08)');
      grd.addColorStop(0.9, 'rgba(110,80,40,0.22)');
      grd.addColorStop(1, 'rgba(110,80,40,0)');
      g.save();
      g.translate(x + R() * w, y + R() * h);
      g.fillStyle = grd;
      g.fillRect(-r, -r, 2 * r, 2 * r);
      g.restore();
    }
    const e = g.createLinearGradient(x, y, x, y + h);
    e.addColorStop(0, 'rgba(90,64,34,0.25)');
    e.addColorStop(0.2, 'rgba(90,64,34,0)');
    e.addColorStop(0.8, 'rgba(90,64,34,0)');
    e.addColorStop(1, 'rgba(90,64,34,0.3)');
    g.fillStyle = e;
    g.fillRect(x, y, w, h);
    return () => g.restore();
  };
  g.clearRect(0, 0, S, S);

  // 1. Calendar (0, 0, 300 x 440): a picture of a coastline on top, a month grid below.
  {
    const done = aged(0, 0, 300, 440, '#e6dcc4', { torn: 3 });
    g.fillStyle = '#7f8c86';
    g.fillRect(16, 16, 268, 170);
    g.fillStyle = '#a7a28c';
    g.fillRect(16, 120, 268, 66);
    g.fillStyle = '#5a6a6e';
    g.beginPath();
    g.moveTo(16, 130);
    g.lineTo(120, 92);
    g.lineTo(200, 118);
    g.lineTo(284, 100);
    g.lineTo(284, 130);
    g.fill();
    g.fillStyle = '#3a3026';
    g.font = '700 26px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('OCTOBRE', 150, 222);
    g.font = '15px Georgia, serif';
    g.fillStyle = '#5a4c3a';
    for (let r = 0; r < 5; r++)
      for (let d = 0; d < 7; d++) {
        const n = r * 7 + d - 1;
        if (n < 1 || n > 31) continue;
        g.fillText(String(n), 36 + d * 38, 262 + r * 34);
      }
    g.strokeStyle = 'rgba(163,57,43,0.8)';
    g.lineWidth = 2.5;
    g.beginPath();
    g.ellipse(36 + 3 * 38, 256 + 2 * 34, 15, 13, 0, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#3a3026';
    g.font = '600 13px Georgia, serif';
    g.fillText('QUINCAILLERIE DU NORD', 150, 428);
    done();
    region('calendar', 0, 0, 300, 440);
  }
  // 2. Faded paint advert (310, 0, 420 x 300).
  {
    const done = aged(310, 0, 420, 300, '#c9b78e', { torn: 6, stains: 9 });
    g.fillStyle = '#2f4a5a';
    g.fillRect(330, 20, 380, 90);
    g.fillStyle = '#e8dcc0';
    g.font = '700 54px Impact, "Arial Narrow", sans-serif';
    g.textAlign = 'center';
    g.fillText('PEINTURES', 520, 86);
    g.fillStyle = '#8a3a2a';
    g.font = 'italic 700 34px Georgia, serif';
    g.fillText('Vernis · Laques · Émail', 520, 160);
    g.fillStyle = '#3a3026';
    g.font = '22px Georgia, serif';
    g.fillText('pour le bois, le fer et la pierre', 520, 200);
    for (let i = 0; i < 5; i++) {
      g.fillStyle = ['#a3392b', '#b8893a', '#4a6a8a', '#5f7a4a', '#e8e0cc'][i];
      g.fillRect(350 + i * 72, 228, 56, 46);
    }
    g.fillStyle = 'rgba(230,220,196,0.35)';
    g.fillRect(310, 0, 420, 300);
    done();
    region('advert', 310, 0, 420, 300);
  }
  // 3. Enamel plate "DÉFENSE DE FUMER" (740, 0, 284 x 110).
  {
    g.save();
    g.fillStyle = '#e8e2d2';
    g.beginPath();
    g.roundRect(742, 2, 280, 106, 12);
    g.fill();
    g.strokeStyle = '#8a2a22';
    g.lineWidth = 7;
    g.beginPath();
    g.roundRect(752, 12, 260, 86, 8);
    g.stroke();
    g.fillStyle = '#8a2a22';
    g.font = '700 30px Impact, "Arial Narrow", sans-serif';
    g.textAlign = 'center';
    g.fillText('DÉFENSE DE FUMER', 882, 66);
    for (let i = 0; i < 12; i++) {
      // Enamel chips, mostly along the rim where the plate was knocked.
      const t = R() * Math.PI * 2;
      g.fillStyle = 'rgba(26,22,20,0.85)';
      g.beginPath();
      g.ellipse(882 + Math.cos(t) * (130 + R() * 8), 55 + Math.sin(t) * (46 + R() * 6), 2 + R() * 6, 2 + R() * 4, R() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(120,70,30,0.35)';
    g.fillRect(742, 92, 280, 14);
    g.restore();
    region('nosmoking', 742, 2, 280, 106);
  }
  // 4. Price list on lined paper (740, 120, 240 x 330): illegible pencil lines.
  {
    const done = aged(740, 120, 240, 330, '#ddd6c2', { torn: 2 });
    g.strokeStyle = 'rgba(80,110,140,0.3)';
    g.lineWidth = 1;
    for (let y = 160; y < 440; y += 18) {
      g.beginPath();
      g.moveTo(744, y);
      g.lineTo(976, y);
      g.stroke();
    }
    g.fillStyle = '#3a3430';
    g.font = '700 22px Georgia, serif';
    g.textAlign = 'left';
    g.fillText('TARIFS', 756, 150);
    g.strokeStyle = 'rgba(50,46,42,0.7)';
    g.lineWidth = 1.6;
    for (let y = 174; y < 430; y += 18) {
      let x = 756;
      g.beginPath();
      g.moveTo(x, y - 4);
      while (x < 900) g.lineTo((x += 3 + R() * 5), y - 4 - R() * 6);
      g.stroke();
      g.beginPath();
      g.moveTo(930, y - 4);
      g.lineTo(962, y - 6);
      g.stroke();
    }
    done();
    region('prices', 740, 120, 240, 330);
  }
  // 5. Photo of father and daughter in front of the shop (0, 460, 260 x 200), sepia.
  {
    const done = aged(0, 460, 260, 200, '#e8e0d0', { stains: 3 });
    g.fillStyle = '#6e5a44';
    g.fillRect(14, 474, 232, 172);
    const grd = g.createLinearGradient(0, 474, 0, 646);
    grd.addColorStop(0, '#9a8466');
    grd.addColorStop(1, '#4a3a2a');
    g.fillStyle = grd;
    g.fillRect(18, 478, 224, 164);
    g.fillStyle = '#3a2c20';
    g.fillRect(18, 478, 224, 40);
    g.fillStyle = '#c8b48e';
    g.font = '700 18px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('MARCHAL & FILLE', 130, 504);
    g.fillStyle = '#2a2018';
    for (const [x, hh, ww] of [
      [96, 96, 30],
      [150, 70, 22],
    ]) {
      g.beginPath();
      g.ellipse(x, 638 - hh - 10, ww * 0.32, ww * 0.4, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(x - ww / 2, 638 - hh, ww, hh);
    }
    g.fillStyle = 'rgba(240,226,200,0.18)';
    g.fillRect(18, 478, 224, 164);
    done();
    region('photo', 0, 460, 260, 200);
  }
  // 6. Torn job sheet with a sketch of a fascia (280, 460, 300 x 220).
  {
    const done = aged(280, 460, 300, 220, '#d8d2c0', { torn: 5 });
    g.strokeStyle = 'rgba(40,36,32,0.75)';
    g.lineWidth = 2;
    g.strokeRect(300, 520, 260, 60);
    g.font = '700 30px Georgia, serif';
    g.fillStyle = 'rgba(40,36,32,0.7)';
    g.textAlign = 'center';
    g.fillText('BOULANGERIE', 430, 562);
    g.font = '16px Georgia, serif';
    g.fillText('3,20 m × 0,60 — or / noir', 430, 610);
    g.strokeStyle = 'rgba(163,57,43,0.7)';
    g.beginPath();
    g.moveTo(300, 500);
    g.lineTo(560, 500);
    g.stroke();
    done();
    region('jobsheet', 280, 460, 300, 220);
  }
  // 7. Tape strips (600, 460, 80 x 24) for corners.
  g.fillStyle = 'rgba(220,206,170,0.85)';
  g.fillRect(600, 460, 80, 24);
  region('tape', 600, 460, 80, 24);
  // 8. Fuse box label + switch plate (700, 470, 200 x 140).
  {
    g.fillStyle = '#c9c3b4';
    g.fillRect(700, 470, 200, 140);
    g.fillStyle = '#2a2826';
    g.font = '700 16px "Arial Narrow", sans-serif';
    g.textAlign = 'center';
    g.fillText('DANGER', 800, 496);
    g.beginPath();
    g.moveTo(800, 510);
    g.lineTo(780, 560);
    g.lineTo(800, 556);
    g.lineTo(784, 600);
    g.lineTo(820, 540);
    g.lineTo(802, 544);
    g.lineTo(818, 510);
    g.fill();
    region('danger', 700, 470, 200, 140);
  }
  const tex = canvasTex(c);
  return { tex, items };
}
