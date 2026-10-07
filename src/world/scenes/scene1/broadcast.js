import { L } from '../../../story/script.js';
import { clamp, hash } from './common.js';

// The stage broadcast on the CRT: three cut shots of a cycling stage drawn on a small canvas
// (helicopter wide on the switchbacks, the moto shot of a domestique blowing, the lone rider
// riding down to the bus), with a LIVE bug, the scrolling ticker, scanlines and a rolling band.

// ------------------------------------------------------------------ the TV broadcast (cycling)

const TEAM = ['#d23a2a', '#2c5ea8', '#e8c020', '#1f1f24', '#f2f2ee', '#3a8a4a', '#e06a1a'];

/** A side-view rider (bike + body), facing +x, `pedal` = crank angle. Origin at the ground. */
function drawRider(g, x, y, s, jersey, pedal) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.strokeStyle = '#121316';
  g.lineWidth = 1.6;
  for (const wx of [-11, 11]) {
    g.beginPath();
    g.arc(wx, -8, 7.5, 0, Math.PI * 2);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(-11, -8);
  g.lineTo(-2, -8);
  g.lineTo(-5, -20);
  g.lineTo(8, -20);
  g.lineTo(11, -8);
  g.moveTo(-2, -8);
  g.lineTo(8, -20);
  g.stroke();
  // legs to the crank
  const px = -2 + Math.cos(pedal) * 4;
  const py = -8 + Math.sin(pedal) * 4;
  g.strokeStyle = '#1b1c20';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-4, -22);
  g.lineTo(-1 + Math.cos(pedal) * 2, -15);
  g.lineTo(px, py);
  g.stroke();
  // torso, flat over the bars
  g.strokeStyle = jersey;
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(-4, -23);
  g.lineTo(7, -28);
  g.stroke();
  g.fillStyle = jersey;
  g.beginPath();
  g.arc(10, -30, 3.4, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Draws one frame of the stage broadcast onto the TV canvas. */
export function drawBroadcast(g, w, h, t, shot, shotT, ticker) {
  if (shot === 0) {
    // Helicopter wide: the switchbacks up the col, the peloton strung out in a line.
    const sky = g.createLinearGradient(0, 0, 0, h * 0.4);
    sky.addColorStop(0, '#6f8fb8');
    sky.addColorStop(1, '#c4d0da');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#7d8a9a';
    g.beginPath();
    g.moveTo(0, h * 0.34);
    for (let x = 0; x <= w; x += 16) g.lineTo(x, h * (0.18 + 0.12 * Math.abs(Math.sin(x * 0.021 + 1.2)) + 0.05 * Math.sin(x * 0.07)));
    g.lineTo(w, h * 0.4);
    g.lineTo(0, h * 0.4);
    g.fill();
    g.fillStyle = '#5d6e4a';
    g.fillRect(0, h * 0.36, w, h);
    g.fillStyle = 'rgba(0,0,0,0.1)';
    for (let i = 0; i < 40; i++) g.fillRect(hash(i * 3.3) * w, h * 0.4 + hash(i * 1.7) * h * 0.5, 6, 3);
    // the road: five hairpins
    const pts = [];
    for (let k = 0; k <= 5; k++) {
      const y = h * (0.86 - k * 0.09);
      pts.push([k % 2 ? w * 0.86 : w * 0.14, y]);
    }
    g.strokeStyle = '#c9c4b6';
    g.lineWidth = 5;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
    g.stroke();
    // riders along the road: a polyline parameter
    const segs = pts.length - 1;
    const at = (u) => {
      const f = clamp(u, 0, 0.999) * segs;
      const i = Math.floor(f);
      const k = f - i;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
    };
    const head = 0.42 + shotT * 0.018;
    for (let k = 0; k < 22; k++) {
      // the front few are domestiques; one (k = 2) is sliding back through the line
      const u = k === 2 ? head - 0.01 - shotT * 0.012 : head - k * 0.012 - (k > 6 ? 0.03 : 0);
      if (u < 0) continue;
      const [x, y] = at(u);
      g.fillStyle = TEAM[k % TEAM.length];
      g.fillRect(x - 1.5, y - 3, 3, 3);
    }
    const [mx, my] = at(head + 0.02);
    g.fillStyle = '#e8e8e8';
    g.fillRect(mx - 2, my - 3, 4, 3); // the lead motorbike
  } else if (shot === 1) {
    // Moto shot, side on: the group rides past a domestique who has just blown, empty.
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#8aa0b4');
    bg.addColorStop(0.5, '#6d7d62');
    bg.addColorStop(1, '#4e5a44');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    // motion-blurred hillside streaks
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 18; i++) {
      const y = hash(i * 2.7) * h * 0.6;
      const x = ((((hash(i) * w - t * 160) % (w + 80)) + w + 80) % (w + 80)) - 40;
      g.fillRect(x, y, 40 + hash(i * 5) * 40, 2);
    }
    g.fillStyle = '#4b4b4e';
    g.fillRect(0, h * 0.72, w, h * 0.28);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    for (let x = ((-t * 160) % 40) - 40; x < w; x += 40) g.fillRect(x, h * 0.86, 18, 2);
    const groundY = h * 0.8;
    const pedal = t * 9;
    for (let k = 0; k < 4; k++) drawRider(g, w * (0.35 + k * 0.17), groundY + (k % 2) * 4, 1.25, TEAM[(k * 3 + 1) % TEAM.length], pedal + k);
    // the domestique, our colours, drifting back out of the frame: job finished
    const dx = w * 0.62 - shotT * w * 0.12;
    drawRider(g, dx, groundY + 10, 1.35, '#2c5ea8', t * 5.5);
  } else {
    // Rear shot from the team car: one rider alone, sitting up, riding down to the bus.
    const sky = g.createLinearGradient(0, 0, 0, h * 0.45);
    sky.addColorStop(0, '#7f97b0');
    sky.addColorStop(1, '#b9c4cc');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#56663f';
    g.fillRect(0, h * 0.42, w, h);
    g.fillStyle = '#4a4a4c';
    g.beginPath();
    g.moveTo(w * 0.47, h * 0.42);
    g.lineTo(w * 0.53, h * 0.42);
    g.lineTo(w * 0.95, h);
    g.lineTo(w * 0.05, h);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (let k = 0; k < 6; k++) {
      const q = (k / 6 + t * 0.4) % 1;
      const y = h * (0.42 + 0.58 * q * q);
      g.fillRect(w / 2 - 1 - q * 2, y, 2 + q * 4, 3 + q * 10);
    }
    // the lone rider, swaying a little
    const sway = Math.sin(t * 2.2) * 3;
    g.save();
    g.translate(w / 2 + sway, h * 0.66);
    g.fillStyle = '#121316';
    g.fillRect(-1.5, 0, 3, 16);
    g.fillStyle = '#2c5ea8';
    g.fillRect(-9, -26, 18, 26);
    g.fillStyle = '#1b1c20';
    g.fillRect(-7, 0, 5, 12);
    g.fillRect(2, 0, 5, 12);
    g.fillStyle = '#d8d2c4';
    g.beginPath();
    g.arc(0, -31, 5.5, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // a team car ahead, roof bikes, pulling away
    g.fillStyle = '#d8dadc';
    const cx = w * 0.62;
    const cy = h * 0.5;
    g.fillRect(cx - 10, cy - 6, 20, 7);
    g.strokeStyle = '#1a1a1a';
    g.lineWidth = 1;
    g.strokeRect(cx - 9, cy - 12, 18, 5);
  }
  // LIVE bug and the scrolling ticker.
  g.font = '700 9px system-ui, sans-serif';
  g.fillStyle = '#c8281e';
  g.fillRect(8, 8, Math.max(26, Math.ceil(g.measureText(L.ch1.signs.tvLive).width) + 6), 12); // 'DIRECT' is wider
  g.fillStyle = '#fff';
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText(L.ch1.signs.tvLive, 11, 14.5); // drawn every frame: follows the language
  g.fillStyle = 'rgba(8,12,20,0.88)';
  g.fillRect(0, h - 22, w, 22);
  g.fillStyle = '#e8c020';
  g.fillRect(0, h - 22, 4, 22);
  g.fillStyle = '#ece8de';
  g.font = '700 11px system-ui, sans-serif';
  const tw = g.measureText(ticker).width;
  const x = w - ((t * 34) % (tw + w));
  g.fillText(ticker, x, h - 11);
  // CRT scanlines and a slow rolling band.
  g.fillStyle = 'rgba(0,0,0,0.2)';
  for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  const by = ((t * 0.21) % 1) * h * 1.4 - h * 0.2;
  g.fillStyle = 'rgba(255,255,255,0.05)';
  g.fillRect(0, by, w, 22);
}
