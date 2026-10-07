// Quality tiers. ?quality=low|medium|high forces a tier; otherwise it is picked from the GPU string
// and the screen size. The pause menu can switch it at runtime (Engine.setQuality), and the choice is
// remembered per browser (localStorage, best effort).
//
//   low:    pixel ratio 1, no MSAA, no AO, no bloom, 1024 shadows (small soft radius)
//   medium: pixel ratio <= 1.25, 4x MSAA, half-res GTAO (8 samples), bloom, 2048 shadows
//   high:   pixel ratio <= 1.5, 4x MSAA, full-res GTAO (16 samples + denoise), bloom, 2048 soft shadows,
//           edge chromatic aberration, anisotropy 16

export const TIERS = {
  low: { name: 'low', pixelRatio: 1, msaa: 0, ao: false, aoSamples: 0, aoScale: 0.5, bloom: false, shadowSize: 1024, shadowRadius: 2, ca: false, anisotropy: 4 },
  medium: { name: 'medium', pixelRatio: 1.25, msaa: 4, ao: true, aoSamples: 8, aoScale: 0.5, bloom: true, shadowSize: 2048, shadowRadius: 3, ca: false, anisotropy: 8 },
  high: { name: 'high', pixelRatio: 1.5, msaa: 4, ao: true, aoSamples: 16, aoScale: 1, bloom: true, shadowSize: 2048, shadowRadius: 4, ca: true, anisotropy: 16 },
};
export const TIER_NAMES = ['low', 'medium', 'high'];

const STORE_KEY = 'hairline.quality';

/** GPU renderer string (unmasked when the browser allows it). */
export function gpuName(gl) {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch {
    return '';
  }
}

/**
 * Pick a tier: the URL wins, then a remembered pause-menu choice, then a guess from the GPU and the
 * pixel count. Returns { tier, source: 'url' | 'saved' | 'auto', gpu }.
 */
export function pickTier(gl) {
  const gpu = gpuName(gl);
  const q = new URLSearchParams(location.search).get('quality');
  if (q && TIERS[q]) return { tier: q, source: 'url', gpu };
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved && TIERS[saved]) return { tier: saved, source: 'saved', gpu };
  } catch {
    /* storage blocked */
  }
  let i = 1; // medium
  if (/apple m\d|rtx|radeon rx|radeon pro|geforce gtx 1[06-9]|geforce gtx [2-9]\d|arc a\d|quadro/i.test(gpu)) i = 2;
  if (/intel|mali|adreno|powervr|swiftshader|llvmpipe|software|apple gpu|microsoft basic/i.test(gpu)) i = 0;
  if (/intel.*(iris xe|arc)/i.test(gpu)) i = 1;
  const coarse = window.matchMedia?.('(pointer:coarse)').matches;
  if (coarse) i = 0;
  // Very large backbuffers (4K at dpr 2) cost more than the tier saves: step down once.
  const px = window.innerWidth * window.innerHeight * Math.min(window.devicePixelRatio || 1, 1.5) ** 2;
  if (px > 6e6 && i > 0) i--;
  return { tier: TIER_NAMES[i], source: 'auto', gpu };
}

export function saveTier(name) {
  try {
    localStorage.setItem(STORE_KEY, name);
  } catch {
    /* storage blocked */
  }
}
