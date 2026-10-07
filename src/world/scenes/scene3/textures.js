import * as THREE from 'three';
import * as B from '../../build.js';

// Ch3 canvas textures: lane paint (an alpha overlay over the PBR asphalt), the verge, a window
// atlas for the facades, the bakery's lit interior, feather-flag and barrier-banner prints, and
// soft blobs (halos, contact shadows). All deterministic per rnd.

/** Soft radial blob, white with alpha (halos, glows). */
export function radialTexture(stops = [[0, 1], [0.22, 0.5], [0.6, 0.12], [1, 0]]) {
  return B.canvasTexture(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    for (const [t, a] of stops) g.addColorStop(t, `rgba(255,255,255,${a})`);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
}

/**
 * Lane paint and road marks as an alpha overlay (one 14 x 28 m tile repeating along Z): faded edge
 * and lane lines, the double centre line, tar seams, darker wheel tracks, oil, a patched trench.
 * White = paint; dark marks are drawn with alpha in a near-black. Used with the asphalt below.
 */
export function lanePaintTexture(rnd, roadW, tileLen, repeatZ) {
  const W = 512;
  const H = 1024;
  const pxm = W / roadW;
  const pzm = H / tileLen;
  const X = (m) => (m + roadW / 2) * pxm;
  const tex = B.canvasTexture(W, H, (c) => {
    c.clearRect(0, 0, W, H);
    // Wheel tracks: polished, darker bands in each lane.
    for (const lane of [-5.25, -1.75, 1.75, 5.25]) {
      for (const off of [-0.85, 0.85]) {
        const g = c.createLinearGradient(X(lane + off - 0.5), 0, X(lane + off + 0.5), 0);
        g.addColorStop(0, 'rgba(8,9,10,0)');
        g.addColorStop(0.5, 'rgba(8,9,10,0.32)');
        g.addColorStop(1, 'rgba(8,9,10,0)');
        c.fillStyle = g;
        c.fillRect(X(lane + off - 0.5), 0, 1.0 * pxm, H);
      }
    }
    // A patched trench (fresher, darker tar) and a long longitudinal seam.
    c.fillStyle = 'rgba(10,10,12,0.42)';
    c.fillRect(X(-6.4), 140, 4.2 * pxm, 2.6 * pzm);
    c.strokeStyle = 'rgba(4,4,5,0.6)';
    c.lineWidth = 2;
    c.strokeRect(X(-6.4), 140, 4.2 * pxm, 2.6 * pzm);
    c.beginPath();
    c.moveTo(X(1.2), 0);
    for (let y = 0; y <= H; y += 32) c.lineTo(X(1.2) + (rnd() - 0.5) * 3, y);
    c.lineWidth = 1.6;
    c.stroke();
    // Lane paint (faded): edge lines, dashed lane lines, the double centre line.
    const paint = (a) => `rgba(236,234,224,${a})`;
    c.fillStyle = paint(0.85);
    for (const ex of [-6.75, 6.75]) c.fillRect(X(ex) - 0.07 * pxm, 0, 0.14 * pxm, H);
    for (const cx of [-0.11, 0.11]) c.fillRect(X(cx) - 0.055 * pxm, 0, 0.11 * pxm, H);
    for (const lx of [-3.5, 3.5]) {
      for (let z = 0; z < tileLen; z += 7) {
        c.fillStyle = paint(0.6 + rnd() * 0.3);
        c.fillRect(X(lx) - 0.07 * pxm, z * pzm, 0.14 * pxm, 3.5 * pzm);
      }
    }
    // Worn paint: punch holes through the lines.
    c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 2600; i++) {
      c.fillStyle = `rgba(0,0,0,${0.35 + rnd() * 0.6})`;
      c.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1 + rnd() * 4);
    }
    c.globalCompositeOperation = 'source-over';
    // Cracks (thin, dark) and oil blooms.
    c.strokeStyle = 'rgba(4,4,5,0.55)';
    for (let i = 0; i < 18; i++) {
      c.lineWidth = 0.7 + rnd() * 1.2;
      c.beginPath();
      let x = rnd() * W;
      let y = rnd() * H;
      c.moveTo(x, y);
      for (let k = 0; k < 8; k++) c.lineTo((x += (rnd() - 0.5) * 36), (y += (rnd() - 0.2) * 30));
      c.stroke();
    }
    for (let i = 0; i < 14; i++) {
      const x = X((rnd() - 0.5) * 12);
      const y = rnd() * H;
      const r = 8 + rnd() * 28;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(4,4,6,${0.25 + rnd() * 0.25})`);
      g.addColorStop(1, 'rgba(4,4,6,0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(x, y, r, r * (0.6 + rnd() * 0.6), rnd() * 3, 0, Math.PI * 2);
      c.fill();
    }
    // A manhole cover in the right lane, a drain in the left gutter.
    const mx = X(4.4);
    const my = 640;
    c.fillStyle = 'rgba(14,14,16,0.9)';
    c.beginPath();
    c.arc(mx, my, 0.34 * pxm, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(120,118,112,0.55)';
    c.lineWidth = 1.5;
    for (let r = 0.1; r < 0.34; r += 0.06) {
      c.beginPath();
      c.arc(mx, my, r * pxm, 0, Math.PI * 2);
      c.stroke();
    }
  }, { repeat: [1, repeatZ] });
  tex.anisotropy = 16;
  return tex;
}

/** The verge: wet winter grass worn to mud, leaf litter. 4 m tile. */
export function vergeTexture(rnd) {
  return B.canvasTexture(256, 256, (c, w, h) => {
    B.paintNoise(c, w, h, '#5b5a44', 0.16);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const r = 6 + rnd() * 26;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      const mud = rnd() < 0.55;
      g.addColorStop(0, mud ? `rgba(58,48,36,${0.35 + rnd() * 0.3})` : `rgba(96,104,70,${0.2 + rnd() * 0.25})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 900; i++) {
      c.fillStyle = ['rgba(122,92,52,0.55)', 'rgba(92,70,40,0.5)', 'rgba(140,132,96,0.35)', 'rgba(40,44,30,0.4)'][(rnd() * 4) | 0];
      c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2.5, 1 + rnd() * 2);
    }
  }, { repeat: [1, 1] });
}

/**
 * Window atlas: 4 x 2 cells of 64 x 128 px. Row 0 (top): dark glass, net curtain, blind, a boarded
 * pane. Row 1: the same four lit from inside (warm, cold, warm with a figure, TV blue). Each cell
 * has a pale frame and a mullion. Instances pick a cell via an attribute.
 */
export function windowAtlas(rnd) {
  const CW = 64;
  const CH = 128;
  const tex = B.canvasTexture(CW * 4, CH * 2, (c) => {
    const frame = (x, y) => {
      c.strokeStyle = '#8e8a82';
      c.lineWidth = 5;
      c.strokeRect(x + 2.5, y + 2.5, CW - 5, CH - 5);
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(x + CW / 2, y + 4);
      c.lineTo(x + CW / 2, y + CH - 4);
      c.moveTo(x + 4, y + CH * 0.36);
      c.lineTo(x + CW - 4, y + CH * 0.36);
      c.stroke();
      // Sill grime.
      const g = c.createLinearGradient(0, y + CH - 18, 0, y + CH);
      g.addColorStop(0, 'rgba(40,36,30,0)');
      g.addColorStop(1, 'rgba(40,36,30,0.6)');
      c.fillStyle = g;
      c.fillRect(x + 3, y + CH - 18, CW - 6, 15);
    };
    const glass = (x, y, top, bot) => {
      const g = c.createLinearGradient(0, y, 0, y + CH);
      g.addColorStop(0, top);
      g.addColorStop(1, bot);
      c.fillStyle = g;
      c.fillRect(x, y, CW, CH);
      // Reflection streak.
      c.fillStyle = 'rgba(200,215,235,0.07)';
      c.beginPath();
      c.moveTo(x + 8, y + CH);
      c.lineTo(x + 30, y);
      c.lineTo(x + 42, y);
      c.lineTo(x + 20, y + CH);
      c.fill();
    };
    for (let lit = 0; lit < 2; lit++) {
      const y = lit * CH;
      for (let k = 0; k < 4; k++) {
        const x = k * CW;
        if (!lit) glass(x, y, '#232934', '#0d1015');
        else glass(x, y, ['#ffd49a', '#d8e4ff', '#ffc98a', '#7fa8ff'][k], ['#c88a4a', '#8a9ab8', '#b8763a', '#2a3a6a'][k]);
        if (k === 1) {
          // Net curtain: pale, folds.
          c.fillStyle = lit ? 'rgba(255,240,215,0.55)' : 'rgba(120,122,120,0.5)';
          c.fillRect(x + 4, y + 6, CW - 8, CH * 0.7);
          c.fillStyle = 'rgba(0,0,0,0.12)';
          for (let f = 0; f < 7; f++) c.fillRect(x + 6 + f * 8, y + 6, 2, CH * 0.7);
        } else if (k === 2) {
          // Blind half down / a figure silhouette when lit.
          c.fillStyle = lit ? 'rgba(60,36,20,0.75)' : 'rgba(104,98,86,0.85)';
          if (lit) {
            c.beginPath();
            c.ellipse(x + 40, y + 52, 7, 8, 0, 0, Math.PI * 2);
            c.fill();
            c.fillRect(x + 30, y + 60, 20, 60);
          } else {
            c.fillRect(x + 4, y + 4, CW - 8, CH * 0.45);
            for (let f = 0; f < 10; f++) {
              c.fillStyle = 'rgba(0,0,0,0.15)';
              c.fillRect(x + 4, y + 6 + f * 5.5, CW - 8, 1);
            }
          }
        } else if (k === 3 && !lit) {
          // Boarded / painted-over pane.
          c.fillStyle = '#3e3a34';
          c.fillRect(x + 4, y + 4, CW - 8, CH - 8);
          c.fillStyle = 'rgba(0,0,0,0.25)';
          for (let f = 0; f < 6; f++) c.fillRect(x + 4, y + 8 + f * 20, CW - 8, 2);
        }
        frame(x, y);
      }
    }
    // Speckle grime over everything.
    for (let i = 0; i < 600; i++) {
      c.fillStyle = `rgba(30,26,20,${rnd() * 0.25})`;
      c.fillRect(rnd() * CW * 4, rnd() * CH * 2, 1 + rnd() * 2, 1 + rnd() * 3);
    }
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Bakery interior behind the glass: warm light, shelves of loaves, a counter; condensation. */
export function bakeryInteriorTexture(rnd) {
  return B.canvasTexture(512, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffe2b0');
    g.addColorStop(0.55, '#f2b46a');
    g.addColorStop(1, '#8a5a30');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // Back shelves with loaves and baskets.
    for (const y of [0.22, 0.42, 0.62]) {
      c.fillStyle = 'rgba(90,52,24,0.8)';
      c.fillRect(0, y * h, w, 5);
      for (let x = 6; x < w - 10; x += 10 + rnd() * 8) {
        const lw = 8 + rnd() * 14;
        c.fillStyle = ['#b06a2a', '#c8823a', '#9a5a22', '#d89a4a'][(rnd() * 4) | 0];
        c.beginPath();
        c.ellipse(x + lw / 2, y * h - 5, lw / 2, 4 + rnd() * 2, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
    // Counter with a glass display and a till.
    c.fillStyle = 'rgba(70,40,20,0.9)';
    c.fillRect(0, h * 0.74, w, h * 0.26);
    c.fillStyle = 'rgba(255,236,200,0.45)';
    c.fillRect(20, h * 0.7, w * 0.6, h * 0.06);
    c.fillStyle = 'rgba(40,30,24,0.9)';
    c.fillRect(w * 0.78, h * 0.62, 34, 24);
    // Baker's silhouette behind the counter.
    c.fillStyle = 'rgba(60,34,18,0.75)';
    c.beginPath();
    c.ellipse(w * 0.66, h * 0.44, 11, 13, 0, 0, Math.PI * 2);
    c.fill();
    c.fillRect(w * 0.66 - 18, h * 0.5, 36, h * 0.26);
    // Condensation on the glass, gold leaf letters edge.
    for (let i = 0; i < 160; i++) {
      c.fillStyle = `rgba(255,246,230,${rnd() * 0.16})`;
      c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 4 + rnd() * 22);
    }
    const fog = c.createLinearGradient(0, h * 0.6, 0, h);
    fog.addColorStop(0, 'rgba(255,240,220,0)');
    fog.addColorStop(1, 'rgba(255,240,220,0.35)');
    c.fillStyle = fog;
    c.fillRect(0, 0, w, h);
  });
}

/** Striped awning canvas (bakery). */
export function awningTexture() {
  return B.canvasTexture(256, 64, (c, w, h) => {
    for (let i = 0; i < 16; i++) {
      c.fillStyle = i % 2 ? '#e8dcc4' : '#7a2e24';
      c.fillRect((i * w) / 16, 0, w / 16 + 1, h);
    }
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(30,20,10,0.45)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
}

/** A feather flag print (vertical STRIDE), two colourways side by side (u 0..0.5 / 0.5..1). */
export function flagTexture(text, green) {
  return B.canvasTexture(256, 512, (c, w, h) => {
    for (let k = 0; k < 2; k++) {
      const x0 = (k * w) / 2;
      c.fillStyle = k ? '#f2f2ea' : green;
      c.fillRect(x0, 0, w / 2, h);
      c.fillStyle = k ? '#0b0d10' : '#0b0d10';
      c.save();
      c.translate(x0 + w / 4 + 14, h * 0.9);
      c.rotate(-Math.PI / 2);
      c.font = 'italic 900 64px system-ui, -apple-system, Helvetica, Arial, sans-serif';
      c.fillText(text, 0, 0);
      c.restore();
      c.fillStyle = k ? green : '#0b0d10';
      c.fillRect(x0 + 6, 0, 10, h);
    }
  });
}

/**
 * Cloud band for the sky dome: azimuth along u (wraps), elevation 0..~40 deg along v. Soft stratus
 * streaks; alpha = cover, red = how lit the top of each cloud is (the shader tints with it).
 */
export function cloudTexture(rnd) {
  const tex = B.canvasTexture(1024, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const blob = (x, y, rx, ry, a, lit) => {
      for (const ox of [-w, 0, w]) {
        const g = c.createRadialGradient(x + ox, y, 0, x + ox, y, rx);
        g.addColorStop(0, `rgba(${lit},${lit},${lit},${a})`);
        g.addColorStop(0.6, `rgba(${lit},${lit},${lit},${a * 0.45})`);
        g.addColorStop(1, `rgba(${lit},${lit},${lit},0)`);
        c.save();
        c.translate(x + ox, y);
        c.scale(1, ry / rx);
        c.translate(-(x + ox), -y);
        c.fillStyle = g;
        c.fillRect(x + ox - rx, y - rx, rx * 2, rx * 2);
        c.restore();
      }
    };
    // Low, long stratus near the horizon (bottom of the canvas = horizon), smaller puffs higher up.
    for (let i = 0; i < 70; i++) {
      const y = h * (0.55 + rnd() * 0.42);
      blob(rnd() * w, y, 60 + rnd() * 160, 6 + rnd() * 14, 0.25 + rnd() * 0.35, (90 + rnd() * 120) | 0);
    }
    for (let i = 0; i < 90; i++) {
      const y = h * (0.12 + rnd() * 0.5);
      blob(rnd() * w, y, 30 + rnd() * 90, 8 + rnd() * 18, 0.15 + rnd() * 0.3, (140 + rnd() * 115) | 0);
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}
