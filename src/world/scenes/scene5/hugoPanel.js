import * as THREE from 'three';

// Hugo's own panel (DESIGN R3.7): 2.4 x 1.6 m in the pale rectangle where the billboard was
// (z -18, y 5.0 .. 6.6). The motif is painted on a canvas (no text): 'wheel' | 'door' | 'hand'.
// paint(motif, p) reveals it in 6 bands, top first, like the Ch4 door; setColor(k) lerps the paint
// from grey (0) to its own colour (1). Hidden until paint() is first called.

export const HUGO_PANEL = { z: -18, y0: 5.0, w: 2.4, h: 1.6 };
const CW = 768;
const CH = 512;
const INK = 'rgba(46,44,42,0.88)';

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const makeCanvas = () => {
  const c = document.createElement('canvas');
  c.width = CW;
  c.height = CH;
  return c;
};

/** A brushy stroke: the path drawn a few times with a little jitter and falling alpha. */
function brushy(g, R, path, { color, width, passes = 3, jitter = 1.6 }) {
  g.strokeStyle = color;
  g.lineCap = g.lineJoin = 'round';
  for (let i = 0; i < passes; i++) {
    g.globalAlpha = i === 0 ? 1 : 0.35;
    g.lineWidth = width * (1 - i * 0.12);
    g.save();
    g.translate((R() - 0.5) * jitter * i, (R() - 0.5) * jitter * i);
    g.beginPath();
    path(g);
    g.stroke();
    g.restore();
  }
  g.globalAlpha = 1;
}

/** The ground: a ragged, brushed rectangle of warm off-white (the primed wall shows at the edges). */
function wash(g, R, tint = 'rgba(236,229,212,0.92)') {
  g.fillStyle = tint;
  g.beginPath();
  g.moveTo(12 + R() * 8, 12 + R() * 8);
  for (let k = 1; k <= 10; k++) g.lineTo((k / 10) * (CW - 24) + 12, 6 + R() * 12);
  for (let k = 1; k <= 7; k++) g.lineTo(CW - 6 - R() * 12, (k / 7) * (CH - 24) + 12);
  for (let k = 9; k >= 0; k--) g.lineTo((k / 10) * (CW - 24) + 12, CH - 6 - R() * 12);
  for (let k = 6; k >= 1; k--) g.lineTo(6 + R() * 12, (k / 7) * (CH - 24) + 12);
  g.closePath();
  g.fill();
  // Brush drag in the wash.
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(${R() < 0.5 ? '255,252,244' : '200,190,170'},${(0.05 + R() * 0.08).toFixed(3)})`;
    g.fillRect(20 + R() * (CW - 60), 20 + R() * (CH - 40), 30 + R() * 140, 2 + R() * 3);
  }
}

function drawWheel(g, R) {
  wash(g, R, 'rgba(226,230,228,0.92)');
  const cx = CW / 2;
  const cy = CH / 2 + 4;
  const rTyre = 214;
  const rRim = 192;
  // Shadow on the ground under it.
  g.fillStyle = 'rgba(60,56,50,0.18)';
  g.beginPath();
  g.ellipse(cx, cy + rTyre + 8, rTyre * 0.9, 12, 0, 0, Math.PI * 2);
  g.fill();
  // Tyre (blue-grey) and rim (ochre).
  brushy(g, R, (c) => c.arc(cx, cy, rTyre - 12, 0, Math.PI * 2), { color: '#5d6b7a', width: 26 });
  brushy(g, R, (c) => c.arc(cx, cy, rRim, 0, Math.PI * 2), { color: '#d9a441', width: 15 });
  brushy(g, R, (c) => c.arc(cx, cy, rRim - 9, 0, Math.PI * 2), { color: '#9a6f24', width: 3, passes: 1 });
  // 16 spokes, laced tangentially (alternate sides of the hub), all true.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const h = a + (i % 2 ? 0.55 : -0.55);
    const x0 = cx + Math.cos(h) * 20;
    const y0 = cy + Math.sin(h) * 20;
    const x1 = cx + Math.cos(a) * (rRim - 10);
    const y1 = cy + Math.sin(a) * (rRim - 10);
    brushy(g, R, (c) => (c.moveTo(x0, y0), c.lineTo(x1, y1)), { color: '#3b3d40', width: 3.2, passes: 2, jitter: 0.8 });
    // Nipple at the rim.
    g.fillStyle = '#8a8780';
    g.beginPath();
    g.arc(x1, y1, 3.2, 0, Math.PI * 2);
    g.fill();
  }
  // Hub.
  g.fillStyle = '#9a978f';
  g.beginPath();
  g.arc(cx, cy, 24, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = '#4a4a48';
  g.beginPath();
  g.arc(cx, cy, 8, 0, Math.PI * 2);
  g.fill();
  // Valve.
  const va = Math.PI * 0.62;
  brushy(g, R, (c) => (c.moveTo(cx + Math.cos(va) * (rRim - 4), cy + Math.sin(va) * (rRim - 4)), c.lineTo(cx + Math.cos(va) * (rRim - 30), cy + Math.sin(va) * (rRim - 30))), {
    color: '#7a7670',
    width: 6,
    passes: 1,
  });
}

function drawDoor(g, R, grey) {
  wash(g, R, 'rgba(224,226,222,0.92)');
  const c = new THREE.Color(grey);
  const dark = `#${c.clone().multiplyScalar(0.62).getHexString()}`;
  const lite = `#${c.clone().lerp(new THREE.Color('#ffffff'), 0.25).getHexString()}`;
  const x0 = 274;
  const x1 = 494;
  const y0 = 36;
  const y1 = 470;
  // Frame and step.
  g.fillStyle = '#55524d';
  g.fillRect(x0 - 18, y0 - 16, x1 - x0 + 36, y1 - y0 + 16);
  g.fillStyle = '#7a7770';
  g.fillRect(x0 - 40, y1, x1 - x0 + 80, 16);
  // The leaf, in the grey he mixed.
  g.fillStyle = grey;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Four panels: shadow on the top/left edges, light on the bottom/right.
  const pw = (x1 - x0 - 3 * 22) / 2;
  const rows = [
    [y0 + 24, 200],
    [y0 + 24 + 200 + 26, y1 - y0 - 24 - 200 - 26 - 24],
  ];
  for (const [py, ph] of rows) {
    for (let k = 0; k < 2; k++) {
      const px = x0 + 22 + k * (pw + 22);
      g.fillStyle = dark;
      g.fillRect(px, py, pw, ph);
      g.fillStyle = lite;
      g.fillRect(px + 5, py + 5, pw - 5, ph - 5);
      g.fillStyle = grey;
      g.fillRect(px + 6, py + 6, pw - 12, ph - 12);
    }
  }
  brushy(g, R, (q) => q.rect(x0, y0, x1 - x0, y1 - y0), { color: dark, width: 4, passes: 2 });
  // A small brass knob.
  const kx = x1 - 30;
  const ky = y0 + 236;
  g.fillStyle = '#7a5a1e';
  g.beginPath();
  g.arc(kx + 2, ky + 2, 12, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#c9a24a';
  g.beginPath();
  g.arc(kx, ky, 11, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,240,200,0.8)';
  g.beginPath();
  g.arc(kx - 3, ky - 4, 3.5, 0, Math.PI * 2);
  g.fill();
}

function drawHand(g, R) {
  wash(g, R, 'rgba(232,226,214,0.92)');
  // The hairline it has just painted: one fine red line, dead level.
  const lineY = 392;
  const tipX = 318;
  brushy(g, R, (c) => (c.moveTo(78, lineY), c.lineTo(tipX, lineY)), { color: '#a3392b', width: 3.2, passes: 2, jitter: 0.4 });
  // The liner brush: long handle up to the right, ferrule, a fine loaded tip touching the line's end.
  const ang = Math.atan2(-(lineY - 70), 648 - tipX);
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const at = (d) => [tipX + ux * d, lineY + uy * d];
  const [fx0, fy0] = at(34);
  const [fx1, fy1] = at(70);
  const [hx1, hy1] = at(430);
  brushy(g, R, (c) => (c.moveTo(fx1, fy1), c.lineTo(hx1, hy1)), { color: '#7a4e2c', width: 13, passes: 2, jitter: 0.6 });
  brushy(g, R, (c) => (c.moveTo(fx0, fy0), c.lineTo(fx1, fy1)), { color: '#b9b6ae', width: 11, passes: 1 });
  g.fillStyle = '#8a3024';
  g.beginPath();
  g.moveTo(tipX, lineY);
  g.lineTo(fx0 - uy * 5, fy0 + ux * 5);
  g.lineTo(fx0 + uy * 5, fy0 - ux * 5);
  g.closePath();
  g.fill();
  // The hand round the handle: palm, three curled fingers under, the thumb along the top.
  const [gx, gy] = at(150);
  g.save();
  g.translate(gx, gy);
  g.rotate(ang);
  const skin = '#c79a78';
  const skinDark = '#a5775a';
  g.lineJoin = g.lineCap = 'round';
  // Back of the hand and wrist, trailing up the handle.
  g.fillStyle = skin;
  g.beginPath();
  g.moveTo(-10, -26);
  g.bezierCurveTo(40, -70, 140, -78, 230, -58);
  g.lineTo(250, 18);
  g.bezierCurveTo(170, 34, 90, 40, 30, 30);
  g.bezierCurveTo(5, 26, -14, 6, -10, -26);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.stroke();
  // Curled fingers under the handle.
  for (let i = 0; i < 3; i++) {
    const x = 24 + i * 34;
    g.fillStyle = i % 2 ? skin : skinDark;
    g.beginPath();
    g.ellipse(x, 30, 19, 15, 0.2, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  // Thumb, pressed along the handle toward the tip.
  g.fillStyle = skin;
  g.beginPath();
  g.moveTo(70, -34);
  g.bezierCurveTo(30, -38, -8, -18, -16, -6);
  g.bezierCurveTo(-10, 4, 20, 2, 70, -10);
  g.closePath();
  g.fill();
  g.stroke();
  // Knuckle creases.
  g.strokeStyle = 'rgba(90,60,44,0.6)';
  g.lineWidth = 2;
  for (const x of [70, 105, 140]) {
    g.beginPath();
    g.moveTo(x, -48);
    g.quadraticCurveTo(x + 8, -40, x + 4, -30);
    g.stroke();
  }
  // Cuff.
  g.fillStyle = '#4e5a66';
  g.beginPath();
  g.moveTo(230, -60);
  g.lineTo(300, -66);
  g.lineTo(312, 26);
  g.lineTo(248, 20);
  g.closePath();
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.stroke();
  g.restore();
}

/** Grey copy of a canvas (luma), for setColor(). */
function greyOf(src, dst) {
  const g = dst.getContext('2d', { willReadFrequently: true });
  g.clearRect(0, 0, CW, CH);
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, CW, CH);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    d[i] = d[i + 1] = d[i + 2] = l * 0.95;
  }
  g.putImageData(img, 0, 0);
}

/**
 * makeHugoPanel(ctx, {wallX, doorGrey}) -> {mesh, paint(motif, p), setColor(k), material}.
 * Add `mesh` to the scene; it stays hidden until the first paint().
 */
export function makeHugoPanel(ctx, { wallX = -5.95, doorGrey = '#8d877c' } = {}) {
  const art = makeCanvas();
  const grey = makeCanvas();
  const mask = makeCanvas();
  const out = makeCanvas();
  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const material = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    roughness: 0.88,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  // Paint on render, like the neighbours' panels: the wall's relief comes through.
  // Less wall albedo than theirs: his colours (the door's grey) must read true.
  ctx?.materials?.enhance?.(material, 'wall_mural_render', { albedo: 0.3, normalScale: 1.1, roughnessVar: 0.5 });
  const P = HUGO_PANEL;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(P.w, P.h), material);
  mesh.rotation.y = Math.PI / 2;
  mesh.position.set(wallX + 0.016, P.y0 + P.h / 2, P.z);
  mesh.renderOrder = 1;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'hugo-panel';
  mesh.visible = false;

  let motif = null;
  let prog = 0;
  let col = 1;
  const draw = (m) => {
    motif = m;
    const g = art.getContext('2d');
    g.clearRect(0, 0, CW, CH);
    const R = seeded(1412);
    if (m === 'wheel') drawWheel(g, R);
    else if (m === 'hand') drawHand(g, R);
    else drawDoor(g, R, doorGrey);
    greyOf(art, grey);
  };
  const compose = () => {
    const mg = mask.getContext('2d');
    mg.clearRect(0, 0, CW, CH);
    const bandH = CH / 6;
    for (let k = 0; k < 6; k++) {
      const q = THREE.MathUtils.clamp(prog * 6 - k, 0, 1);
      if (q <= 0) continue;
      const x1 = q * (CW + 50);
      const soft = Math.min(50, x1);
      mg.fillStyle = '#fff';
      mg.fillRect(0, k * bandH - 2, Math.max(0, x1 - soft), bandH + 4);
      const grd = mg.createLinearGradient(x1 - soft, 0, x1, 0);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      mg.fillStyle = grd;
      mg.fillRect(x1 - soft, k * bandH - 2, soft, bandH + 4);
    }
    const o = out.getContext('2d');
    o.globalCompositeOperation = 'source-over';
    o.clearRect(0, 0, CW, CH);
    if (col < 1) o.drawImage(grey, 0, 0);
    if (col > 0) {
      o.globalAlpha = col;
      o.drawImage(art, 0, 0);
      o.globalAlpha = 1;
    }
    o.globalCompositeOperation = 'destination-in';
    o.drawImage(mask, 0, 0);
    o.globalCompositeOperation = 'source-over';
    tex.needsUpdate = true;
  };

  return {
    mesh,
    material,
    get motif() {
      return motif;
    },
    /** Reveal `m` up to p (0..1) in 6 bands, top first. */
    paint(m, p) {
      if (m !== motif) draw(m);
      prog = THREE.MathUtils.clamp(p, 0, 1);
      mesh.visible = true;
      compose();
    },
    /** 0: the paint reads grey; 1: its own colours. */
    setColor(k) {
      col = THREE.MathUtils.clamp(k, 0, 1);
      if (motif) compose();
    },
  };
}
