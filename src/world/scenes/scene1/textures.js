import * as THREE from 'three';
import { canvasTexture, rng } from '../../build.js';
import { W, D, H, EX, BACK_Z, WIN, DOOR, DOOR_X, TV_POS, KITCHEN, FRIDGE, LAMP_POS } from './common.js';

// Canvas textures for the flat. The walls share ONE 2048 x 2048 atlas (top half: the back wall,
// bottom half: the left and right walls side by side), so every stain sits on the wall it belongs
// to. They are drawn in wall metres through a per-wall canvas transform. The PBR plaster recipe is
// layered over it (relief, roughness), and the floor stains go over the PBR floorboards.

const AT = 2048;

/** UV of a wall point in the atlas. wall: 'back' (s = x) | 'left' | 'right' (s = z). */
export function wallUV(wall, s, y) {
  if (wall === 'back') return [(s + EX) / (2 * EX), 0.5 + (0.5 * y) / H];
  if (wall === 'left') return [(0.5 * (s + D / 2)) / D, (0.5 * y) / H];
  return [0.5 + (0.5 * (D / 2 - s)) / D, (0.5 * y) / H];
}

/** The canvas transform for drawing on a wall in metres (s along the wall, y up). */
function wallFrame(g, wall) {
  if (wall === 'back') {
    const sx = AT / (2 * EX);
    const sy = AT / 2 / H;
    g.setTransform(sx, 0, 0, -sy, EX * sx, AT / 2);
  } else if (wall === 'left') {
    const sx = AT / 2 / D;
    const sy = AT / 2 / H;
    g.setTransform(sx, 0, 0, -sy, (D / 2) * sx, AT);
  } else {
    const sx = AT / 2 / D;
    const sy = AT / 2 / H;
    g.setTransform(-sx, 0, 0, -sy, AT / 2 + (D / 2) * sx, AT);
  }
}

const WALLS = {
  back: { s0: -EX, s1: EX },
  left: { s0: BACK_Z - 0.1, s1: D / 2 },
  right: { s0: BACK_Z - 0.1, s1: D / 2 },
};

/** A ragged blob path (torn paper, damp patches). */
function blob(g, cx, cy, rx, ry, R, n = 18, jag = 0.45) {
  g.beginPath();
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2;
    const j = 1 - jag / 2 + R() * jag;
    g.lineTo(cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j);
  }
  g.closePath();
}

function radial(g, cx, cy, r, color, a) {
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
  gr.addColorStop(0, color.replace('A', a));
  gr.addColorStop(0.55, color.replace('A', a * 0.4));
  gr.addColorStop(1, color.replace('A', 0));
  g.fillStyle = gr;
  g.fillRect(cx - r, cy - r, r * 2, r * 2);
}

/**
 * Nicotine-yellowed floral wallpaper gone bad: roll seams, a faded trellis print, browner toward
 * the ceiling, damp blooms with black mould in the corners, tide-marked ceiling edge, rain streaks
 * under the window, torn and peeled patches showing the plaster, ghost rectangles where frames
 * hung, hand grime round the switch and the door, grease behind the kitchenette.
 */
export function wallpaperTexture(decorate) {
  const R = rng(41);
  const tex = canvasTexture(AT, AT, (g) => {
    g.fillStyle = '#9c917a';
    g.fillRect(0, 0, AT, AT);
    for (const wall of ['back', 'left', 'right']) {
      const { s0, s1 } = WALLS[wall];
      wallFrame(g, wall);
      // Roll widths of 0.53 m, each a hair different in tone (sun-faded unevenly).
      for (let s = s0, i = 0; s < s1; s += 0.53, i++) {
        const l = 52 + (R() - 0.5) * 4;
        g.fillStyle = `hsl(42, 17%, ${l}%)`;
        g.fillRect(s, 0, 0.53, H);
        // The print: a faded trellis of small lozenges and sprigs, 0.265 m repeat.
        g.strokeStyle = 'rgba(92,78,52,0.16)';
        g.fillStyle = 'rgba(92,78,52,0.12)';
        g.lineWidth = 0.004;
        for (let y = 0.07; y < H; y += 0.3) {
          for (let k = 0; k < 2; k++) {
            const cx = s + 0.1325 + k * 0.265 * 0.5 - 0.066;
            const cy = y + (k ? 0.15 : 0);
            g.beginPath();
            g.moveTo(cx, cy - 0.05);
            g.lineTo(cx + 0.035, cy);
            g.lineTo(cx, cy + 0.05);
            g.lineTo(cx - 0.035, cy);
            g.closePath();
            g.stroke();
            g.beginPath();
            g.ellipse(cx, cy, 0.011, 0.016, 0, 0, Math.PI * 2);
            g.fill();
            // sprigs
            g.beginPath();
            g.moveTo(cx + 0.066, cy + 0.075);
            g.quadraticCurveTo(cx + 0.09, cy + 0.11, cx + 0.07, cy + 0.14);
            g.moveTo(cx + 0.066, cy + 0.075);
            g.quadraticCurveTo(cx + 0.04, cy + 0.1, cx + 0.05, cy + 0.13);
            g.stroke();
          }
        }
        // Seam: a darker line where dirt got into the butt joint, one lifting at the top.
        g.fillStyle = 'rgba(50,40,24,0.13)';
        g.fillRect(s - 0.002, 0, 0.004, H);
        if (R() < 0.5) {
          g.fillStyle = 'rgba(225,215,190,0.25)';
          g.fillRect(s + 0.002, H - 0.5 - R() * 0.4, 0.006, 0.5);
        }
      }
      // Nicotine: browner toward the top, where thirty years of smoke sat.
      const nic = g.createLinearGradient(0, H, 0, 0);
      nic.addColorStop(0, 'rgba(105,74,26,0.42)');
      nic.addColorStop(0.4, 'rgba(105,74,26,0.12)');
      nic.addColorStop(1, 'rgba(105,74,26,0.02)');
      g.fillStyle = nic;
      g.fillRect(s0, 0, s1 - s0, H);
      // Tide-marked ceiling edge: a brown band with wavy rings.
      const band = g.createLinearGradient(0, H, 0, H - 0.32);
      band.addColorStop(0, 'rgba(62,46,22,0.6)');
      band.addColorStop(1, 'rgba(62,46,22,0)');
      g.fillStyle = band;
      g.fillRect(s0, H - 0.32, s1 - s0, 0.32);
      g.lineWidth = 0.005;
      for (let k = 0; k < 4; k++) {
        g.strokeStyle = `rgba(70,50,24,${0.32 - k * 0.06})`;
        g.beginPath();
        const y0 = H - 0.05 - k * 0.06;
        for (let s = s0; s <= s1; s += 0.04) g.lineTo(s, y0 - Math.abs(Math.sin(s * 3.1 + k * 2)) * 0.07 - R() * 0.012);
        g.stroke();
      }
      // Splash-back grime along the skirting and scuffs at knee height.
      const low = g.createLinearGradient(0, 0, 0, 0.45);
      low.addColorStop(0, 'rgba(40,32,22,0.45)');
      low.addColorStop(1, 'rgba(40,32,22,0)');
      g.fillStyle = low;
      g.fillRect(s0, 0, s1 - s0, 0.45);
      for (let i = 0; i < 26; i++) {
        g.fillStyle = `rgba(35,28,20,${0.08 + R() * 0.12})`;
        g.save();
        g.translate(s0 + R() * (s1 - s0), 0.15 + R() * 0.55);
        g.rotate((R() - 0.5) * 0.5);
        g.fillRect(0, 0, 0.05 + R() * 0.18, 0.004 + R() * 0.008);
        g.restore();
      }
    }

    // ---- damp: blooms with black mould speckle in the cold corners, low and high
    const damp = (wall, s, y, r, a) => {
      wallFrame(g, wall);
      radial(g, s, y, r, 'rgba(48,52,34,A)', a);
      radial(g, s, y, r * 0.55, 'rgba(70,60,32,A)', a * 0.6);
      g.fillStyle = 'rgba(18,20,14,0.5)';
      for (let i = 0; i < 160; i++) {
        const a2 = R() * Math.PI * 2;
        const d2 = Math.pow(R(), 1.8) * r * 0.8;
        const rr = 0.002 + R() * 0.006;
        g.beginPath();
        g.arc(s + Math.cos(a2) * d2, y + Math.sin(a2) * d2 * 0.8, rr, 0, Math.PI * 2);
        g.fill();
      }
    };
    damp('back', -EX + 0.16, H, 0.75, 0.55);
    damp('back', -EX + 0.16, 0.05, 0.5, 0.45);
    damp('back', EX - 0.16, H, 0.6, 0.45);
    damp('left', BACK_Z, H, 0.7, 0.5);
    damp('left', BACK_Z, 0.05, 0.55, 0.4);
    damp('right', BACK_Z, H, 0.55, 0.45);
    damp('right', D / 2 - 0.2, H, 0.45, 0.3);
    damp('left', D / 2 - 0.3, 0.1, 0.5, 0.35);

    // ---- back wall details
    wallFrame(g, 'back');
    // Rain gets in round the window: streaks running down from the sill corners.
    for (const sx of [WIN.x0 + 0.02, WIN.x1 - 0.04, WIN.x0 + 0.3]) {
      const grd = g.createLinearGradient(0, WIN.y0, 0, 0.15);
      grd.addColorStop(0, 'rgba(46,44,30,0.55)');
      grd.addColorStop(1, 'rgba(46,44,30,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(sx - 0.03, WIN.y0);
      for (let y = WIN.y0; y > 0.15; y -= 0.05) g.lineTo(sx - 0.03 - Math.sin(y * 9) * 0.01 - (WIN.y0 - y) * 0.05, y);
      for (let y = 0.15; y < WIN.y0; y += 0.05) g.lineTo(sx + 0.04 + Math.sin(y * 7) * 0.01 + (WIN.y0 - y) * 0.08, y);
      g.closePath();
      g.fill();
    }
    // Torn paper by the window: plaster shows through, a ragged paper edge round it.
    const tear = (wall, cx, cy, rx, ry) => {
      wallFrame(g, wall);
      blob(g, cx, cy, rx * 1.08, ry * 1.08, R, 22, 0.4);
      g.fillStyle = 'rgba(70,56,34,0.45)';
      g.fill();
      blob(g, cx, cy, rx, ry, R, 22, 0.5);
      g.fillStyle = '#958c78';
      g.fill();
      // plaster blotches and hairline cracks inside the hole
      g.save();
      g.clip();
      for (let i = 0; i < 10; i++) {
        g.fillStyle = `rgba(${120 + R() * 40},${112 + R() * 30},${92 + R() * 20},0.35)`;
        g.beginPath();
        g.arc(cx + (R() - 0.5) * rx * 2, cy + (R() - 0.5) * ry * 2, 0.02 + R() * 0.05, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = 'rgba(60,50,36,0.45)';
      g.lineWidth = 0.003;
      g.beginPath();
      g.moveTo(cx - rx, cy + ry * 0.2);
      for (let k = 0; k < 8; k++) g.lineTo(cx - rx + (k / 7) * rx * 2, cy + ry * 0.2 + (R() - 0.5) * 0.05);
      g.stroke();
      g.restore();
    };
    tear('back', WIN.x1 + 0.24, 2.3, 0.14, 0.2);
    tear('back', WIN.x0 - 0.18, 0.62, 0.1, 0.13);
    tear('back', -2.2, 2.42, 0.22, 0.12);
    tear('left', -0.2, 2.3, 0.18, 0.16);
    tear('right', -0.7, 0.55, 0.12, 0.1);
    // Ghost of a framed team photo above the TV, with the nail still in.
    wallFrame(g, 'back');
    const gx0 = TV_POS[0] - 0.38;
    g.fillStyle = 'rgba(214,202,168,0.4)';
    g.fillRect(gx0, 1.46, 0.76, 0.56);
    g.strokeStyle = 'rgba(60,45,22,0.3)';
    g.lineWidth = 0.006;
    g.strokeRect(gx0, 1.46, 0.76, 0.56);
    // Two smaller ghosts on the left wall between the bibs.
    wallFrame(g, 'left');
    g.fillStyle = 'rgba(214,202,168,0.3)';
    g.fillRect(-0.45, 1.25, 0.32, 0.42);
    // Hand grime round the light switch and the door's latch side.
    wallFrame(g, 'back');
    radial(g, DOOR.x0 - 0.22, 1.2, 0.16, 'rgba(45,36,24,A)', 0.4);
    radial(g, DOOR.x1 + 0.12, 1.05, 0.14, 'rgba(45,36,24,A)', 0.3);
    // Behind the TV: soot-dark where its heat rose for years.
    radial(g, TV_POS[0], 1.05, 0.5, 'rgba(40,34,26,A)', 0.4);
    // Behind the lamp: a scorch-brown bloom above the shade.
    radial(g, LAMP_POS[0], 1.9, 0.35, 'rgba(90,64,30,A)', 0.35);
    // Hairline cracks running off the window corners.
    g.strokeStyle = 'rgba(48,40,28,0.5)';
    g.lineWidth = 0.003;
    for (const [x, y, dx, dy] of [
      [WIN.x1 + 0.06, WIN.y1 + 0.06, 1, 1],
      [WIN.x0 - 0.06, WIN.y0 - 0.04, -1, -1],
      [DOOR.x0 - 0.05, DOOR.h + 0.05, -1, 1],
    ]) {
      g.beginPath();
      let px = x;
      let py = y;
      g.moveTo(px, py);
      for (let k = 0; k < 9; k++) {
        px += dx * (0.03 + R() * 0.04);
        py += dy * (0.03 + R() * 0.05);
        g.lineTo(px + (R() - 0.5) * 0.02, py);
      }
      g.stroke();
    }

    // ---- right wall: grease behind the hob end of the kitchenette, a ghost of a wall cupboard
    wallFrame(g, 'right');
    const grease = g.createLinearGradient(0, KITCHEN.top + 0.9, 0, KITCHEN.top);
    grease.addColorStop(0, 'rgba(70,52,26,0)');
    grease.addColorStop(1, 'rgba(70,52,26,0.4)');
    g.fillStyle = grease;
    g.fillRect(KITCHEN.z0, KITCHEN.top, KITCHEN.z1 - KITCHEN.z0, 0.9);
    g.fillStyle = 'rgba(210,198,166,0.3)';
    g.fillRect(KITCHEN.z0 + 0.05, 1.95, 0.8, 0.55);
    // Fridge exhaust: a grey shadow behind and above it.
    radial(g, FRIDGE.z, FRIDGE.h + 0.1, 0.45, 'rgba(40,38,32,A)', 0.4);
    // Calendar ghost and a long scrape at bike-pedal height on the left wall.
    wallFrame(g, 'left');
    g.strokeStyle = 'rgba(40,32,22,0.35)';
    g.lineWidth = 0.006;
    g.beginPath();
    g.moveTo(0.05, 0.62);
    g.bezierCurveTo(0.3, 0.6, 0.5, 0.66, 0.85, 0.63);
    g.stroke();
    radial(g, 0.42, 0.9, 0.3, 'rgba(60,40,22,A)', 0.25); // rust bloom where the bike drips

    // ---- the scene's own marks (shadows of the bibs, ...)
    decorate?.(g, (wall) => wallFrame(g, wall));

    // ---- fine grain over everything
    g.setTransform(1, 0, 0, 1, 0, 0);
    const img = g.getImageData(0, 0, AT, AT);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (R() - 0.5) * 14;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n * 0.9;
    }
    g.putImageData(img, 0, 0);
  });
  tex.generateMipmaps = true;
  return tex;
}

/** Wallpaper for the peeling strips (front: the print; back: brown paper). */
export function paperTexture() {
  const R = rng(5);
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = 'hsl(42, 18%, 55%)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(92,78,52,0.22)';
    g.lineWidth = 1.5;
    for (let y = 10; y < h; y += 36) {
      g.beginPath();
      g.moveTo(w / 2, y - 7);
      g.lineTo(w / 2 + 5, y);
      g.lineTo(w / 2, y + 7);
      g.lineTo(w / 2 - 5, y);
      g.closePath();
      g.stroke();
    }
    const nic = g.createLinearGradient(0, 0, 0, h);
    nic.addColorStop(0, 'rgba(100,70,24,0.45)');
    nic.addColorStop(1, 'rgba(100,70,24,0.1)');
    g.fillStyle = nic;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) radial(g, R() * w, R() * h, 20 + R() * 30, 'rgba(60,50,30,A)', 0.3);
  });
}

/**
 * Stains for the floorboards, on white (the PBR boards give the wood; this only darkens): rain
 * under the window, a worn grey path from the sofa to the door, threshold grime, dust under the
 * bed, coffee rings, a sticky patch by the sofa, scuffs where the boot drags.
 */
export function floorStainTexture() {
  const R = rng(19);
  return canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    const P = (x, z) => [((x + W / 2) / W) * w, ((z + D / 2) / D) * h];
    const blot = (x, z, r, color, a, sx = 1.3) => {
      const [cx, cy] = P(x, z);
      const gr = g.createRadialGradient(cx, cy, 2, cx, cy, r);
      gr.addColorStop(0, color.replace('A', a));
      gr.addColorStop(0.6, color.replace('A', a * 0.45));
      gr.addColorStop(1, color.replace('A', 0));
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(cx, cy, r * sx, r, R() * 3, 0, Math.PI * 2);
      g.fill();
    };
    // Rain under the window: a grey water stain with a darker tide ring.
    blot(-1.05, -2.3, 150, 'rgba(70,74,68,A)', 0.55, 1.6);
    const [wx, wy] = P(-1.05, -2.28);
    g.strokeStyle = 'rgba(50,46,38,0.35)';
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(wx, wy, 150, 70, 0.05, 0, Math.PI);
    g.stroke();
    // Under the leaking ceiling corner (the tin catches it now).
    blot(-0.32, -2.25, 60, 'rgba(60,62,56,A)', 0.5);
    // Worn path: sofa end -> door, and round the bed foot to the window.
    for (let k = 0; k < 9; k++) blot(-0.9 + k * 0.05, 1.5 - k * 0.42, 85, 'rgba(70,64,54,A)', 0.2);
    for (let k = 0; k < 9; k++) blot(1.85 + k * 0.04, 1.2 - k * 0.38, 75, 'rgba(70,64,54,A)', 0.18);
    blot(DOOR_X, -2.3, 120, 'rgba(40,32,22,A)', 0.5);
    // Dust and fluff under the bed and in the corners.
    blot(-2.4, -1.4, 160, 'rgba(90,86,78,A)', 0.35, 0.6);
    for (const [x, z] of [
      [-2.85, -2.35],
      [2.85, -2.35],
      [2.85, 2.4],
      [-2.85, 2.4],
    ])
      blot(x, z, 90, 'rgba(40,36,30,A)', 0.55);
    // Coffee rings and a sticky patch by the sofa.
    for (const [x, z] of [
      [1.3, 1.25],
      [-0.2, -0.45],
      [1.55, 0.92],
      [0.0, 1.6],
    ]) {
      const [cx, cy] = P(x, z);
      g.strokeStyle = 'rgba(70,40,15,0.4)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(cx, cy, 13 + R() * 4, 0, Math.PI * 1.7);
      g.stroke();
    }
    blot(1.7, 1.9, 60, 'rgba(60,40,18,A)', 0.4);
    // Kitchen: grease and a spill in front of the counter.
    blot(2.2, 1.7, 130, 'rgba(60,50,30,A)', 0.35, 0.7);
    // Boot scuffs: short dark arcs along the path.
    g.strokeStyle = 'rgba(30,26,22,0.3)';
    g.lineWidth = 2;
    for (let i = 0; i < 40; i++) {
      const [cx, cy] = P(-1.6 + R() * 3.8, -1.8 + R() * 3.9);
      g.beginPath();
      g.arc(cx, cy, 6 + R() * 10, R() * 6, R() * 6 + 1.2);
      g.stroke();
    }
    // Tiny debris: crumbs, grit.
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = `rgba(30,26,20,${0.15 + R() * 0.3})`;
      g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2);
    }
  });
}

/** A faded, threadbare rug: a border, a central medallion, worn to the weave in the middle. */
export function rugTexture() {
  const R = rng(23);
  return canvasTexture(512, 384, (g, w, h) => {
    g.fillStyle = '#7d5a48';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#4a3a32';
    g.lineWidth = 18;
    g.strokeRect(22, 22, w - 44, h - 44);
    g.strokeStyle = '#a08a68';
    g.lineWidth = 4;
    g.strokeRect(40, 40, w - 80, h - 80);
    g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = '#4e4a5a';
    g.beginPath();
    g.ellipse(w / 2, h / 2, 110, 70, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#a08a68';
    g.lineWidth = 3;
    g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fillStyle = '#9a6a4a';
      g.beginPath();
      g.ellipse(w / 2 + Math.cos(a) * 75, h / 2 + Math.sin(a) * 46, 12, 8, a, 0, Math.PI * 2);
      g.fill();
    }
    // Worn to the weave where feet go, and a dark spill.
    const wear = g.createRadialGradient(w * 0.55, h * 0.6, 10, w * 0.55, h * 0.6, 200);
    wear.addColorStop(0, 'rgba(170,150,120,0.5)');
    wear.addColorStop(1, 'rgba(170,150,120,0)');
    g.fillStyle = wear;
    g.fillRect(0, 0, w, h);
    radial(g, w * 0.3, h * 0.35, 40, 'rgba(40,24,14,A)', 0.5);
    // Weave grain.
    for (let y = 0; y < h; y += 2) {
      g.fillStyle = `rgba(0,0,0,${0.04 + R() * 0.05})`;
      g.fillRect(0, y, w, 1);
    }
  });
}

/** Soft warm gradient for the light spilling from under the door. */
export function spillTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, 0, 4, w / 2, 0, h);
    grd.addColorStop(0, 'rgba(255,214,160,0.9)');
    grd.addColorStop(0.35, 'rgba(255,190,130,0.35)');
    grd.addColorStop(1, 'rgba(255,190,130,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
}

/** A round soft spot (dust motes, glows). */
export function softDot() {
  const t = canvasTexture(64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
