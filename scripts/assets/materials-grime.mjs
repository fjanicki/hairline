// Generates the procedural grime masks used over the PBR materials (no dependencies: Node + zlib).
// Called by scripts/assets/materials.sh. Usage: node materials-grime.mjs <out-dir> [mask ...]
// (no mask names = all four; the game ships only puddles and macro).
// Every mask is an 8-bit greyscale PNG that tiles seamlessly, and the output is deterministic
// (seeded PRNG), so a re-run rebuilds byte-identical files.
//   puddles.png    1024  255 = standing water, ~90 = damp rim, 0 = dry        (roughness / darken)
//   oil_stains.png 1024  dark blotches with a faint tide ring, 0 = clean      (albedo / roughness)
//   peeling.png    1024  255 = paint gone (substrate shows), thin lifted edges (albedo / normal hint)
//   macro.png       512  low-frequency breakup around 128, kills visible tiling (albedo multiply)
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2];
const only = new Set(process.argv.slice(3));
const want = (name) => only.size === 0 || only.has(name);
if (!out) {
  console.error('[hairline] usage: node materials-grime.mjs <out-dir>');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

// ---------------------------------------------------------------- PNG (greyscale, 8-bit)
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePng(file, size, px) {
  const raw = Buffer.alloc((size + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) raw[y * (size + 1) + 1 + x] = Math.max(0, Math.min(255, Math.round(px[y * size + x] * 255)));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(join(out, file), png);
  console.log(`  [hairline] grime ${file} ${size}px ${(png.length / 1024).toFixed(0)} KB`);
}

// ---------------------------------------------------------------- tileable noise
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Periodic value noise: a lattice of `period` cells that wraps, sampled at (u, v) in 0..1. */
function lattice(period, seed) {
  const r = rng(seed);
  const g = new Float32Array(period * period).map(() => r());
  const at = (i, j) => g[((j % period) + period) % period * period + ((i % period) + period) % period];
  return (u, v) => {
    const x = u * period, y = v * period;
    const i = Math.floor(x), j = Math.floor(y);
    let fx = x - i, fy = y - j;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
/** Tileable fBm in 0..1: octave k has period base * 2^k, so every octave wraps at u, v = 1. */
function fbm(base, octaves, seed, gain = 0.5) {
  const layers = Array.from({ length: octaves }, (_, k) => lattice(base << k, seed + k * 101));
  let norm = 0;
  for (let k = 0, a = 1; k < octaves; k++, a *= gain) norm += a;
  return (u, v) => {
    let s = 0;
    for (let k = 0, a = 1; k < octaves; k++, a *= gain) s += a * layers[k](u, v);
    return s / norm;
  };
}
const smooth = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const wrapD = (d) => d - Math.round(d); // shortest wrapped distance in 0..1 space

function render(size, f) {
  const px = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) px[y * size + x] = f((x + 0.5) / size, (y + 0.5) / size);
  return px;
}

// ---------------------------------------------------------------- puddles
if (want('puddles')) {
  const n = fbm(5, 6, 11);
  const warp = fbm(4, 3, 29);
  writePng('puddles.png', 1024, render(1024, (u, v) => {
    const w = (warp(u, v) - 0.5) * 0.08;
    const h = n(u + w, v - w); // low spots of a lumpy surface collect water
    const water = 1 - smooth(0.375, 0.39, h);
    const damp = 1 - smooth(0.375, 0.46, h);
    return Math.max(water, damp * 0.36);
  }));
}

// ---------------------------------------------------------------- oil stains
if (want('oil_stains')) {
  const r = rng(73);
  const edge = fbm(8, 4, 5);
  const fine = fbm(32, 3, 9);
  const blobs = [];
  for (let i = 0; i < 15; i++) { // a stain is a cluster of lobes (drips that ran together)
    const cx = r(), cy = r(), rad = 0.035 + r() * r() * 0.09, k = 0.45 + r() * 0.55;
    for (let j = 0, n = 1 + Math.floor(r() * 4); j < n; j++) {
      blobs.push({ x: cx + (r() - 0.5) * rad * 2.2, y: cy + (r() - 0.5) * rad * 2.2, rad: rad * (0.45 + r() * 0.6), k, sx: 0.7 + r() * 0.6 });
    }
  }
  writePng('oil_stains.png', 1024, render(1024, (u, v) => {
    let s = 0;
    const e = (edge(u, v) - 0.5) * 1.1;
    for (const b of blobs) {
      const dx = wrapD(u - b.x) * b.sx, dy = wrapD(v - b.y) / b.sx;
      const d = Math.hypot(dx, dy) / b.rad + e;
      if (d > 1.4) continue;
      const core = 1 - smooth(0.2, 1.0, d);
      const ring = Math.exp(-(((d - 1.0) / 0.08) ** 2)) * 0.22; // tide mark where the oil stopped spreading
      s = Math.max(s, (core * 0.8 + ring) * b.k);
    }
    return Math.min(1, s * (0.8 + 0.4 * fine(u, v)));
  }));
}

// ---------------------------------------------------------------- peeling paint
if (want('peeling')) {
  const big = fbm(6, 5, 41);
  const crack = fbm(16, 3, 43);
  writePng('peeling.png', 1024, render(1024, (u, v) => {
    const h = big(u, v);
    const gone = smooth(0.625, 0.632, h); // crisp flake edges
    const lifted = Math.exp(-(((h - 0.618) / 0.005) ** 2)) * 0.4; // curled edge just outside each flake
    const c = Math.abs(crack(u, v) - 0.5);
    const cracks = (1 - smooth(0.004, 0.014, c)) * smooth(0.55, 0.6, h) * 0.5; // hairline cracks near the flakes
    return Math.min(1, Math.max(gone, lifted, cracks));
  }));
}

// ---------------------------------------------------------------- macro variation
if (want('macro')) {
  const n = fbm(2, 5, 97, 0.55);
  writePng('macro.png', 512, render(512, (u, v) => 0.5 + (n(u, v) - 0.5) * 1.6));
}
