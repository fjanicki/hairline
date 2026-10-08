// The pigment model for the Day 8 colour toy (docs/DESIGN.md R3.3). Pure functions, no three.js:
// an OKLab average weighted by drops x strength (black and blue are strong, white is weak; blue
// cancels ochre's warmth), shown as the sRGB result, clamped.

/** White, black, ochre, blue, red oxide: keys 1-5. */
export const TINS = [
  { id: 'white', color: '#f2efe8', strength: 1.0 },
  { id: 'black', color: '#1b1a19', strength: 3.0 },
  { id: 'ochre', color: '#b8862c', strength: 1.2 },
  { id: 'blue', color: '#27467f', strength: 2.0 },
  { id: 'red', color: '#8b3a22', strength: 1.5 },
];
export const CANON = '#8d877c'; // Odile's grey (the door's default paint)
export const RECIPE = [5, 1, 2, 1, 0]; // W5 K1 O2 B1

const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function hexToLab(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = toLin(((n >> 16) & 255) / 255);
  const g = toLin(((n >> 8) & 255) / 255);
  const b = toLin((n & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function labToHex([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, toSrgb(Math.max(0, c)))) * 255).toString(16).padStart(2, '0')).join('');
}

const LABS = TINS.map((t) => hexToLab(t.color));

/** counts[5] (drops per tin) -> OKLab [L, a, b]; an empty pot is null. */
export function mixLab(counts) {
  let w = 0;
  const out = [0, 0, 0];
  counts.forEach((n, i) => {
    const k = (n || 0) * TINS[i].strength;
    w += k;
    for (let j = 0; j < 3; j++) out[j] += LABS[i][j] * k;
  });
  return w > 0 ? out.map((v) => v / w) : null;
}

export const mixHex = (counts) => {
  const lab = mixLab(counts);
  return lab ? labToHex(lab) : null;
};

/** OKLab -> {L, C, h (degrees, 0..360)}. */
export function lch([L, a, b]) {
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C: Math.hypot(a, b), h };
}

/** Odile's verdict on a pot: 'target' | 'mud' | 'dark' | 'ochre' | 'light' | 'blue' | 'red' | 'waiting'. */
export function classify(counts) {
  const lab = mixLab(counts);
  if (!lab) return 'waiting';
  const { L, C, h } = lch(lab);
  const warm = h >= 65 && h <= 105;
  const cool = h > 105 && h < 300;
  if (L >= 0.57 && L <= 0.68 && C >= 0.008 && C <= 0.026 && warm) return 'target';
  // Strong colour first: it's what the pot looks like, however dark.
  if (C > 0.06) {
    if (cool) return 'blue';
    if (warm) return L > 0.6 ? 'ochre' : 'mud';
    return h >= 50 && h < 65 ? 'mud' : 'red'; // orange-brown is mud, not pink
  }
  const neutral = L >= 0.55 && L <= 0.75 && C < 0.02;
  if (counts[2] >= 1 && counts[3] >= 1 && counts[4] >= 1 && !neutral) return 'mud';
  if (L < 0.53) return 'dark';
  if (C >= 0.008) {
    if (warm) return C > 0.026 ? (L > 0.6 ? 'ochre' : 'mud') : L > 0.68 ? 'light' : 'dark';
    if (cool) return 'blue';
    if (C < 0.015) return L > 0.68 ? 'light' : 'waiting'; // a grey with a blush: still just grey
    return h >= 50 && h < 65 && C > 0.026 ? 'mud' : 'red';
  }
  return L > 0.68 ? 'light' : 'waiting';
}
