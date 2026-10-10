import * as THREE from 'three';

// Jo's sleeves (Revision 4): fine black linework on both forearms and the backs of her hands, drawn
// procedurally into one single-channel ink map. CharacterKit's skin shader reads it through a
// cylinder around each forearm in bind-pose metres (T-pose, arms along x, palms down), so the
// mapping needs no UV work and follows every clip.
//
// Map layout (INK.size² texels, one band of size/2 rows per arm, left arm first):
//   u = (|x| - INK.x0) / INK.len           0 just above the elbow -> 1 the fingertips
//   s = angle round the arm x INK.r        0 on the thumb side (+z); +INK.r·π/2 on the back of the
//                                          forearm (+y); ±INK.circ/2 the seam on the little-finger side
//   past the wrist the hand is flat, so s comes from z instead (planar, back of the hand on top).
//   The right arm's s is negated so both bands keep the same handedness (text reads the right way).
// In a band, row = size/4 - s · PX (PX texels per metre, the same along and round the arm).
// Every tattoo is something Jo learned (DESIGN-R4): the whisk is her grandmother's tourtière, the
// gear a manual car, the little ruler the first stencil she didn't redo; plus a swallow, a fern, a
// tape measure round the left wrist and small dates.

export const INK = {
  size: 2048,
  x0: 0.38, // |x| at u = 0 (inside the rolled sleeve)
  len: 0.46, // to the fingertips (0.84)
  y: 1.417, // forearm axis (f_regular rest: lowerarm -> hand bones)
  z: -0.05,
  circ: 0.23, // band height in metres: 2π·r for the forearm's mean radius
};
INK.r = INK.circ / (2 * Math.PI);
const PX = INK.size / INK.len; // ≈ 4452 texels per metre (4.5 per mm)
const BAND = INK.size / 2;

/** Ink map for a design ('jo'). Cached and shared: R8 with mipmaps, never disposed with a chapter. */
const _cache = new Map();
export function inkTexture(design = 'jo') {
  if (_cache.has(design)) return _cache.get(design);
  const src = drawInk(design).getContext('2d').getImageData(0, 0, INK.size, INK.size).data;
  const data = new Uint8Array(INK.size * INK.size);
  for (let i = 0; i < data.length; i++) data[i] = src[i * 4 + 3];
  const tex = new THREE.DataTexture(data, INK.size, INK.size, THREE.RedFormat, THREE.UnsignedByteType);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  tex.userData.shared = true;
  tex.name = 'ink:' + design;
  _cache.set(design, tex);
  return tex;
}

/** The design on a canvas (black on transparent; the map keeps its alpha). Also for inspection. */
export function drawInk(design = 'jo') {
  const c = document.createElement('canvas');
  c.width = INK.size;
  c.height = INK.size;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.strokeStyle = g.fillStyle = '#000';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  (DESIGNS[design] || DESIGNS.jo)(g);
  return c;
}

// ------------------------------------------------------------------ placing

// Arm-relative places, in metres. `along`: |x| (elbow 0.395, wrist 0.645, knuckles 0.72); `round`:
// s measured from the thumb-side line towards the back of the arm (OUT = the back of the forearm and
// hand, IN = the inner forearm, on either arm).
const OUT = INK.r * Math.PI / 2;
const IN = -OUT;

/**
 * Draw `fn(g, k)` on one arm at (along, round), rotated by `rot` (0: the motif's up points to the
 * elbow), `size` metres across (k = texels per unit of the motif's [-1, 1] box). Motifs near the
 * seam are drawn twice so they wrap.
 */
function put(g, arm, along, round, size, fn, { rot = 0, width = 1.7 } = {}) {
  const sgn = arm === 'L' ? 1 : -1;
  const x = (along - INK.x0) * PX;
  const y0 = (arm === 'L' ? 0 : BAND) + BAND / 2;
  g.save();
  g.beginPath();
  g.rect(0, arm === 'L' ? 0 : BAND, INK.size, BAND);
  g.clip();
  for (const wrap of [0, -BAND, BAND]) {
    const y = y0 - round * sgn * PX + wrap;
    if (y < (arm === 'L' ? 0 : BAND) - size * PX || y > (arm === 'L' ? BAND : INK.size) + size * PX) continue;
    g.save();
    g.translate(x, y);
    // The motif's up (-y) to the elbow (-x); the right band is mirrored by the shader, so flip it back.
    g.rotate(-Math.PI / 2 + rot);
    if (sgn < 0) g.scale(-1, 1);
    const k = (size * PX) / 2;
    g.lineWidth = width;
    fn(g, k);
    g.restore();
  }
  g.restore();
}

// A tiny seeded RNG so the design is the same every run.
function rand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const line = (g, pts) => {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
};
const dot = (g, x, y, r) => {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
};

// ------------------------------------------------------------------ motifs ([-1, 1] boxes, up = -y)

function swallow(g, k) {
  const P = (x, y) => [x * k, y * k];
  g.beginPath();
  // Body: head up and right, a forked tail down and left.
  g.moveTo(...P(0.55, -0.62));
  g.bezierCurveTo(...P(0.75, -0.6), ...P(0.8, -0.45), ...P(0.62, -0.34)); // head and throat
  g.bezierCurveTo(...P(0.4, -0.12), ...P(0.1, 0.1), ...P(-0.2, 0.32)); // belly
  g.lineTo(...P(-0.72, 0.92)); // outer tail feather
  g.lineTo(...P(-0.36, 0.38));
  g.lineTo(...P(-0.44, 0.98)); // inner tail feather
  g.lineTo(...P(-0.08, 0.2));
  g.bezierCurveTo(...P(0.05, -0.2), ...P(0.25, -0.5), ...P(0.55, -0.62)); // back
  g.stroke();
  // Beak and eye.
  line(g, [...P(0.74, -0.52), ...P(0.92, -0.5), ...P(0.76, -0.45)]);
  dot(g, ...P(0.63, -0.53), 2.2);
  // Wings: the near one raised, the far one swept back, each with a few long feather lines.
  g.beginPath();
  g.moveTo(...P(0.3, -0.3));
  g.bezierCurveTo(...P(0.1, -0.8), ...P(-0.4, -1.0), ...P(-0.95, -0.92));
  g.bezierCurveTo(...P(-0.6, -0.7), ...P(-0.3, -0.42), ...P(0.05, -0.12));
  g.stroke();
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    line(g, [...P(0.28 - t * 0.35, -0.3 + t * 0.12), ...P(-0.15 - t * 0.7, -0.88 + t * 0.12)]);
  }
  g.beginPath();
  g.moveTo(...P(0.2, -0.1));
  g.bezierCurveTo(...P(0.4, 0.2), ...P(0.7, 0.35), ...P(0.98, 0.32));
  g.bezierCurveTo(...P(0.7, 0.1), ...P(0.5, -0.05), ...P(0.42, -0.2));
  g.stroke();
  for (let i = 1; i <= 3; i++) line(g, [...P(0.3 + i * 0.08, -0.1 + i * 0.04), ...P(0.5 + i * 0.13, 0.3 - i * 0.02)]);
  // A little stippled shading under the wing.
  const r = rand(11);
  for (let i = 0; i < 60; i++) {
    const t = r();
    dot(g, ...P(-0.1 + t * 0.6 + (r() - 0.5) * 0.12, -0.05 + t * -0.25 + r() * 0.18), 0.9);
  }
}

function fern(g, k) {
  // A frond up the arm: a curved stem, alternating leaflets that shrink to the tip.
  const n = 22;
  const stem = (t) => [Math.sin(t * 2.2) * 0.16 * k, (1 - 2 * t) * k];
  g.beginPath();
  g.moveTo(...stem(0));
  for (let i = 1; i <= 40; i++) g.lineTo(...stem(i / 40));
  g.stroke();
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const [x, y] = stem(t);
    const len = (0.42 * (1 - t) + 0.06) * k;
    for (const side of [-1, 1]) {
      const a = side * (1.1 - t * 0.3) - Math.PI / 2;
      const ex = x + Math.cos(a) * len * side * side;
      const ey = y + Math.sin(a) * len * 0.55 - len * 0.35;
      const mx = (x + ex) / 2;
      const my = (y + ey) / 2;
      // A leaflet: two arcs, and its midrib.
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(mx - (ey - y) * 0.22, my + (ex - x) * 0.22, ex, ey);
      g.quadraticCurveTo(mx + (ey - y) * 0.22, my - (ex - x) * 0.22, x, y);
      g.stroke();
      if (len > 0.12 * k) line(g, [x, y, x + (ex - x) * 0.8, y + (ey - y) * 0.8]);
    }
  }
}

function whisk(g, k) {
  // Handle down, wire loops up.
  g.beginPath();
  g.roundRect(-0.09 * k, 0.25 * k, 0.18 * k, 0.75 * k, 0.07 * k);
  g.stroke();
  line(g, [-0.09 * k, 0.4 * k, 0.09 * k, 0.4 * k]);
  dot(g, 0, 0.9 * k, 2.5);
  for (const w of [0.5, 0.36, 0.2, 0.06]) {
    g.beginPath();
    g.moveTo(-0.07 * k, 0.26 * k);
    g.bezierCurveTo(-w * 1.25 * k, -0.25 * k, -w * 0.9 * k, -0.98 * k, 0, -0.98 * k);
    g.bezierCurveTo(w * 0.9 * k, -0.98 * k, w * 1.25 * k, -0.25 * k, 0.07 * k, 0.26 * k);
    g.stroke();
  }
}

function gear(g, k) {
  const teeth = 10;
  g.beginPath();
  for (let i = 0; i <= teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const r = (i % 4 < 2 ? 0.95 : 0.74) * k;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.stroke();
  g.beginPath();
  g.arc(0, 0, 0.42 * k, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(0, 0, 0.14 * k, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    line(g, [Math.cos(a) * 0.16 * k, Math.sin(a) * 0.16 * k, Math.cos(a) * 0.4 * k, Math.sin(a) * 0.4 * k]);
  }
}

function ruler(g, k) {
  g.strokeRect(-0.22 * k, -1 * k, 0.44 * k, 2 * k);
  for (let i = 1; i < 20; i++) {
    const y = (-1 + i / 10) * k;
    line(g, [-0.22 * k, y, (-0.22 + (i % 5 === 0 ? 0.24 : 0.12)) * k, y]);
  }
}

function moon(g, k, fill = false) {
  // A crescent: the outer arc, and an inner arc offset towards the open side.
  g.beginPath();
  g.arc(0, 0, k, Math.PI * 0.5, Math.PI * 1.5);
  g.bezierCurveTo(-0.62 * k, -0.62 * k, -0.62 * k, 0.62 * k, 0, k);
  g.closePath();
  if (fill) g.fill();
  g.stroke();
}

function star(g, k, points = 4) {
  // A fine-line sparkle (a 4-point star) or a 5-point outline.
  g.beginPath();
  for (let i = 0; i <= points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = (i % 2 ? (points === 4 ? 0.22 : 0.42) : 1) * k;
    if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.stroke();
}

function sun(g, k) {
  g.beginPath();
  g.arc(0, 0, 0.42 * k, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r1 = 0.56 * k;
    const r2 = (i % 2 ? 0.78 : 0.98) * k;
    line(g, [Math.cos(a) * r1, Math.sin(a) * r1, Math.cos(a) * r2, Math.sin(a) * r2]);
  }
}

function fleur(g, k) {
  // Fleur-de-lys (Québec), in outline.
  const P = (x, y) => [x * k, y * k];
  g.beginPath();
  g.moveTo(...P(0, -1));
  g.bezierCurveTo(...P(0.3, -0.7), ...P(0.3, -0.2), ...P(0, 0.15));
  g.bezierCurveTo(...P(-0.3, -0.2), ...P(-0.3, -0.7), ...P(0, -1));
  g.stroke();
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(...P(s * 0.08, 0.1));
    g.bezierCurveTo(...P(s * 0.3, -0.5), ...P(s * 0.95, -0.45), ...P(s * 0.75, 0.05));
    g.bezierCurveTo(...P(s * 0.65, 0.25), ...P(s * 0.4, 0.2), ...P(s * 0.45, 0.05));
    g.stroke();
    g.beginPath();
    g.moveTo(...P(s * 0.05, 0.42));
    g.quadraticCurveTo(...P(s * 0.3, 0.6), ...P(s * 0.22, 0.95));
    g.stroke();
  }
  g.strokeRect(-0.42 * k, 0.16 * k, 0.84 * k, 0.2 * k);
}

function needle(g, k) {
  line(g, [0, -1 * k, 0, 0.95 * k]);
  g.beginPath();
  g.ellipse(0, -0.8 * k, 0.04 * k, 0.12 * k, 0, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(0, -0.8 * k);
  g.bezierCurveTo(0.7 * k, -1.0 * k, 0.8 * k, -0.2 * k, 0.2 * k, 0);
  g.bezierCurveTo(-0.4 * k, 0.2 * k, -0.6 * k, 0.6 * k, -0.1 * k, 0.75 * k);
  g.stroke();
}

function key(g, k) {
  g.beginPath();
  g.arc(0, -0.65 * k, 0.32 * k, 0, Math.PI * 2);
  g.stroke();
  dot(g, 0, -0.65 * k, 2);
  line(g, [0, -0.33 * k, 0, 1 * k]);
  line(g, [0, 0.62 * k, 0.26 * k, 0.62 * k, 0.26 * k, 0.75 * k]);
  line(g, [0, 0.86 * k, 0.2 * k, 0.86 * k]);
}

function cup(g, k) {
  g.beginPath();
  g.moveTo(-0.6 * k, -0.2 * k);
  g.lineTo(-0.48 * k, 0.6 * k);
  g.quadraticCurveTo(0, 0.78 * k, 0.48 * k, 0.6 * k);
  g.lineTo(0.6 * k, -0.2 * k);
  g.closePath();
  g.stroke();
  g.beginPath();
  g.arc(0.68 * k, 0.15 * k, 0.2 * k, -Math.PI / 2, Math.PI / 2);
  g.stroke();
  for (const x of [-0.25, 0.05, 0.3]) {
    g.beginPath();
    g.moveTo(x * k, -0.35 * k);
    g.bezierCurveTo((x - 0.15) * k, -0.55 * k, (x + 0.15) * k, -0.7 * k, x * k, -0.95 * k);
    g.stroke();
  }
}

function heart(g, k, fill = false) {
  g.beginPath();
  g.moveTo(0, 0.85 * k);
  g.bezierCurveTo(-0.55 * k, 0.4 * k, -1.05 * k, 0.05 * k, -0.95 * k, -0.4 * k);
  g.bezierCurveTo(-0.85 * k, -0.95 * k, -0.15 * k, -1.0 * k, 0, -0.5 * k);
  g.bezierCurveTo(0.15 * k, -1.0 * k, 0.85 * k, -0.95 * k, 0.95 * k, -0.4 * k);
  g.bezierCurveTo(1.05 * k, 0.05 * k, 0.55 * k, 0.4 * k, 0, 0.85 * k);
  if (fill) g.fill();
  g.stroke();
}

function snowflake(g, k) {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    line(g, [0, 0, c * k, sn * k]);
    for (const t of [0.45, 0.72]) {
      const b = (1 - t) * 0.35 * k;
      for (const d of [-1, 1]) line(g, [c * t * k, sn * t * k, c * t * k + Math.cos(a + d * 0.8) * b, sn * t * k + Math.sin(a + d * 0.8) * b]);
    }
  }
}

function scissors(g, k) {
  for (const d of [-1, 1]) {
    g.beginPath();
    g.ellipse(d * 0.32 * k, 0.62 * k, 0.2 * k, 0.28 * k, d * 0.3, 0, Math.PI * 2);
    g.stroke();
    line(g, [d * 0.22 * k, 0.36 * k, -d * 0.18 * k, -1 * k]);
  }
  dot(g, 0, 0.05 * k, 2.2);
}

function bolt(g, k) {
  g.beginPath();
  g.moveTo(0.25 * k, -1 * k);
  g.lineTo(-0.45 * k, 0.1 * k);
  g.lineTo(0.02 * k, 0.1 * k);
  g.lineTo(-0.25 * k, 1 * k);
  g.lineTo(0.45 * k, -0.15 * k);
  g.lineTo(-0.02 * k, -0.15 * k);
  g.closePath();
  g.stroke();
}

function eye(g, k) {
  g.beginPath();
  g.moveTo(-k, 0);
  g.quadraticCurveTo(0, -0.75 * k, k, 0);
  g.quadraticCurveTo(0, 0.75 * k, -k, 0);
  g.stroke();
  g.beginPath();
  g.arc(0, 0, 0.3 * k, 0, Math.PI * 2);
  g.stroke();
  dot(g, 0, 0, 0.13 * k);
  for (let i = -2; i <= 2; i++) line(g, [i * 0.3 * k, -0.42 * k, i * 0.38 * k, -0.62 * k]);
}

function wave(g, k) {
  for (let r = 0; r < 3; r++) {
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const x = (-1 + i / 20) * k;
      const y = (r * 0.32 - 0.3) * k + Math.sin((i / 40) * Math.PI * 3 + r) * 0.12 * k;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
}

function plane(g, k) {
  line(g, [-0.9 * k, 0.5 * k, 0.95 * k, -0.6 * k, -0.2 * k, 0.75 * k, -0.9 * k, 0.5 * k]);
  line(g, [0.95 * k, -0.6 * k, -0.35 * k, 0.3 * k, -0.2 * k, 0.75 * k]);
  g.setLineDash([5, 7]);
  g.beginPath();
  g.moveTo(-0.95 * k, 0.65 * k);
  g.bezierCurveTo(-1.3 * k, 0.9 * k, -0.6 * k, 1.3 * k, -1.2 * k, 1.6 * k);
  g.stroke();
  g.setLineDash([]);
}

function text(str, { font = '500 30px Georgia, serif', spacing = 2 } = {}) {
  return (g, k) => {
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = spacing + 'px';
    g.fillText(str, 0, 0);
    void k;
  };
}

/** The tape measure round the left wrist: a band right round the arm, mm / cm ticks and figures. */
function tapeBand(g, along0, along1) {
  const x0 = (along0 - INK.x0) * PX;
  const x1 = (along1 - INK.x0) * PX;
  g.lineWidth = 1.6;
  line(g, [x0, 0, x0, BAND]);
  line(g, [x1, 0, x1, BAND]);
  const mm = PX / 1000;
  g.font = '600 15px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0, y = 2; y < BAND - 2; i++, y += mm * 2) {
    const len = i % 5 === 0 ? 0.42 : 0.2;
    line(g, [x1, y, x1 - (x1 - x0) * len, y]);
    if (i % 5 === 0 && i > 0) {
      g.save();
      g.translate(x0 + (x1 - x0) * 0.32, y);
      g.rotate(-Math.PI / 2);
      g.fillText(String(i / 5), 0, 0);
      g.restore();
    }
  }
}

// ------------------------------------------------------------------ Jo

const DESIGNS = {
  jo(g) {
    const W = 2.3; // line width in texels (≈ 0.5 mm): fine line, but it has to survive the mipmaps
    const filled = (fn) => (gg, k) => fn(gg, k, true);
    // Left arm: the swallow on the back of the forearm, the whisk on the inside, the tape measure round
    // the wrist, a sun on the back of the hand, one dot per knuckle.
    put(g, 'L', 0.535, OUT + 0.004, 0.085, swallow, { rot: 0.35, width: W });
    put(g, 'L', 0.515, IN + 0.004, 0.075, whisk, { rot: 0.12, width: W });
    put(g, 'L', 0.598, IN - 0.004, 0.013, text('1994', { font: '500 40px Georgia, serif' }), { rot: Math.PI / 2 });
    put(g, 'L', 0.475, 0.002, 0.042, fleur, { rot: -0.1, width: W });
    put(g, 'L', 0.572, 0.004, 0.036, cup, { rot: 0.1, width: W });
    put(g, 'L', 0.465, IN - 0.038, 0.034, needle, { rot: -0.6, width: W });
    put(g, 'L', 0.6, IN + 0.03, 0.013, filled(heart), { rot: 0.2, width: W });
    put(g, 'L', 0.458, OUT + 0.03, 0.03, key, { rot: -0.5, width: W });
    put(g, 'L', 0.6, OUT + 0.034, 0.016, star, { rot: 0.4, width: W });
    put(g, 'L', 0.485, -0.103, 0.026, filled(moon), { rot: 0.4, width: W });
    put(g, 'L', 0.6, 0.092, 0.02, (gg, k) => star(gg, k, 5), { width: W });
    put(g, 'L', 0.53, -0.083, 0.026, snowflake, { width: W });
    put(g, 'L', 0.592, -0.108, 0.026, scissors, { rot: 0.3, width: W });
    {
      // the band is drawn straight on the canvas (it goes right round the arm)
      g.save();
      g.beginPath();
      g.rect(0, 0, INK.size, BAND);
      g.clip();
      tapeBand(g, 0.616, 0.634);
      g.restore();
    }
    put(g, 'L', 0.692, 0.052, 0.03, sun, { width: 2 });
    for (const [z, a] of [[-0.009, 0.735], [-0.035, 0.735], [-0.059, 0.73], [-0.079, 0.722]]) put(g, 'L', a, OUT - (z - INK.z), 0.0008, (gg) => dot(gg, 0, 0, 3.2));

    // Right arm: the fern up the back of the forearm, the gear and the little ruler inside, the dates,
    // a crescent and sparkles on the back of the hand, a line across the ring finger.
    put(g, 'R', 0.525, OUT + 0.002, 0.1, fern, { rot: 0.05, width: 2.1 });
    put(g, 'R', 0.508, IN, 0.052, gear, { width: W });
    put(g, 'R', 0.588, IN + 0.016, 0.04, ruler, { rot: 0.05, width: 2 });
    put(g, 'R', 0.6, IN - 0.026, 0.012, text('12·03·19', { font: '500 30px Georgia, serif' }), { rot: Math.PI / 2 });
    put(g, 'R', 0.462, IN + 0.036, 0.018, text('II·VII', { font: 'italic 500 30px Georgia, serif' }), { rot: Math.PI / 2 });
    put(g, 'R', 0.565, 0.0, 0.042, plane, { rot: -0.3, width: W });
    put(g, 'R', 0.47, -0.002, 0.028, bolt, { rot: 0.3, width: W });
    put(g, 'R', 0.6, OUT + 0.036, 0.015, filled(heart), { rot: -0.3, width: W });
    put(g, 'R', 0.475, 0.098, 0.034, eye, { width: W });
    put(g, 'R', 0.58, -0.098, 0.034, wave, { width: W });
    put(g, 'R', 0.6, 0.072, 0.016, star, { rot: 0.1, width: W });
    put(g, 'R', 0.686, 0.058, 0.022, filled(moon), { rot: 0.4, width: 2 });
    put(g, 'R', 0.702, 0.03, 0.009, star, { width: 1.8 });
    put(g, 'R', 0.672, 0.08, 0.007, star, { width: 1.8 });
    put(g, 'R', 0.745, OUT - (-0.059 - INK.z), 0.012, (gg, k) => line(gg, [0, -k, 0, k]), { rot: Math.PI / 2, width: 2.4 });

    // Fine dots and sparkles between the pieces (a patchwork sleeve, not bare gaps), only where the skin is clear.
    for (const arm of ['L', 'R']) {
      const r = rand(arm === 'L' ? 3 : 5);
      for (let i = 0, n = 0; i < 400 && n < 46; i++) {
        const along = 0.44 + r() * 0.2;
        const round = (r() - 0.5) * INK.circ;
        const x = Math.round((along - INK.x0) * PX);
        const y = Math.round((arm === 'L' ? 0 : BAND) + BAND / 2 - round * (arm === 'L' ? 1 : -1) * PX);
        if (y < 24 || y > INK.size - 24) continue;
        const px = g.getImageData(x - 22, y - 22, 44, 44).data;
        let clear = true;
        for (let j = 3; j < px.length; j += 4) if (px[j] > 0) (clear = false), (j = px.length);
        if (!clear) continue;
        n++;
        if (n % 6 === 0) put(g, arm, along, round, 0.007, star, { rot: r(), width: 1.8 });
        else put(g, arm, along, round, 0.001, (gg) => dot(gg, 0, 0, 1.6 + r() * 0.8));
      }
    }
  },
};

/**
 * The motif drawers, for other fine-line art (r4.js: ENCRE FINE's flash sheets and sign). Each draws
 * centred on the canvas origin in a [-1, 1] box scaled by k (up = -y), with the context's current
 * stroke / fill style and line width; some take a third argument (`fill` / star points).
 */
export const MOTIFS = { swallow, fern, whisk, gear, ruler, moon, star, sun, fleur, needle, key, cup, heart, plane, snowflake, scissors, bolt, eye, wave };
