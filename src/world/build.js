import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { look } from './look.js';
import { onLangChange } from '../story/i18n.js';

// Shared, chapter-agnostic world helpers. Chapter scenes live in world/scenes/sceneN.js.
// Conventions: metres; y up.
//
// Surfaces (src/world/look.js): ground(), box() and mat() take `surface: '<look name>'` (e.g.
// 'street.asphalt', 'facade.brick') for a PBR recipe, or `surface: false` to stay flat. Untagged
// BIG surfaces get the active chapter's recipe layered over their own colour / canvas (a "first
// pass" so every chapter starts from real materials): large ground planes, tall wide boxes (facades),
// thin large boxes (sidewalks, slabs), and mat() calls whose map is a grimeTexture (walls).

// ------------------------------------------------------------------ basics

function plainMat(color, opts) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...opts });
}

/**
 * New MeshStandardMaterial. opts are passed through (roughness defaults to 0.85).
 * opts.surface: a look surface name to layer onto it (keeps color/map/roughness; see look.enhance),
 * or false. Untagged, a material whose map is a grimeTexture gets the chapter's wall recipe.
 */
export function mat(color = 0x888888, opts = {}) {
  const { surface, ...o } = opts;
  const m = plainMat(color, o);
  const name = surface === false ? null : surface || (o.map?.userData?.grime ? look.chapter?.walls : null);
  if (name) look.enhance(m, name, { albedo: o.map ? 0.55 : 0.9 });
  return m;
}

/**
 * A box mesh whose origin is its bottom centre.
 * opts: { color, material, pos:[x,y,z], rotY, castShadow=true, receiveShadow=true, surface, ...materialOpts }
 * surface: a look name ('facade.brick'...) layered over the colour / map, or false. Untagged boxes
 * at least 2.4 m tall and 2.5 m wide get the chapter's facade recipe; thin (<= 0.35 m) boxes of 4 m2
 * or more get its slab recipe (sidewalks, floors). An explicit `material` is never touched.
 */
export function box(w, h, d, opts = {}) {
  const { color = 0x888888, material, pos, rotY = 0, castShadow = true, receiveShadow = true, surface, ...mopts } = opts;
  const geo = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  let m = material;
  if (!m) {
    m = plainMat(color, mopts);
    let name = surface;
    if (surface === undefined && look.chapter) {
      if (h >= 2.4 && Math.max(w, d) >= 2.5) name = look.chapter.facade;
      else if (h <= 0.35 && w * d >= 4 && Math.min(w, d) >= 0.8) name = look.chapter.slab;
    }
    if (name) look.enhance(m, name, { albedo: mopts.map ? 0.6 : 0.9, groundY: pos ? pos[1] : 0 });
  }
  const mesh = new THREE.Mesh(geo, m);
  if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.rotation.y = rotY;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

/** PointLight helper. opts: { pos:[x,y,z], distance=12, decay=2, shadow=false } */
export function pointLight(color, intensity, { pos = [0, 2, 0], distance = 12, decay = 2, shadow = false } = {}) {
  const l = new THREE.PointLight(color, intensity, distance, decay);
  l.position.set(pos[0], pos[1], pos[2]);
  if (shadow) {
    l.castShadow = true;
    l.shadow.mapSize.set(512, 512);
    l.shadow.bias = -0.002;
  }
  return l;
}

/** CanvasTexture drawn by draw(ctx, w, h). sRGB, mipmapped. opts: { repeat:[u,v] } */
export function canvasTexture(w, h, draw, { repeat } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

/** Fill a canvas region with base colour + per-pixel noise (spread 0..1). */
export function paintNoise(ctx, w, h, base, spread = 0.12, { blotches = 0 } = {}) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 2 * spread * 255;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < blotches; i++) {
    const r = 6 + Math.random() * (w / 6);
    ctx.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.04})`;
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Repeating noise texture. opts: { base='#777', spread=0.12, size=256, repeat:[u,v], blotches=0 } */
export function noiseTexture({ base = '#777777', spread = 0.12, size = 256, repeat = [1, 1], blotches = 0 } = {}) {
  return canvasTexture(size, size, (ctx, w, h) => paintNoise(ctx, w, h, base, spread, { blotches }), { repeat });
}

/**
 * Flat ground plane at y (default 0), receiving shadows.
 * opts: { size=200 | [w,d], color='#3b3f38', roughness=0.95, metalness=0, noise=true, spread=0.1,
 *         tile=4 (metres per noise tile), pos:[x,z], y=0, map (Texture), surface }
 * surface: a look name layered over the colour / map ('street.asphalt'...), or false. Untagged
 * planes of 16 m2 or more get the chapter's ground recipe (the noise canvas is then dropped: the
 * PBR detail replaces it).
 */
export function ground(opts = {}) {
  const {
    size = 200,
    color = '#3b3f38',
    roughness = 0.95,
    metalness = 0,
    noise = true,
    spread = 0.1,
    tile = 4,
    pos = [0, 0],
    y = 0,
    map,
    surface,
  } = opts;
  const [w, d] = Array.isArray(size) ? size : [size, size];
  let name = surface === false ? null : surface;
  if (surface === undefined && look.chapter && w * d >= 16) name = look.chapter.ground;
  const useLook = !!(name && look.materials);
  let tex = map || null;
  if (!tex && noise && !useLook) tex = noiseTexture({ base: '#ffffff', spread, blotches: 0, repeat: [w / tile, d / tile] });
  const material = new THREE.MeshStandardMaterial({ color, map: tex, roughness, metalness });
  if (useLook) look.enhance(material, name, { albedo: map ? 0.6 : 1, groundY: y });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), material);
  m.position.set(pos[0], y, pos[1]);
  m.receiveShadow = true;
  m.name = 'ground';
  return m;
}

// ------------------------------------------------------------------ signs

/**
 * A plane with text on a CanvasTexture, facing +Z, origin at its centre.
 * text may contain '\n'. opts: { bg='#14161a', fg='#e8e4da', font='system-ui, sans-serif', weight=700,
 *   size (px; auto-fit when omitted), align='center', pad=0.08 (fraction), border (css colour),
 *   glow=false (unlit, self-illuminated), weathered=0 (0..1 grime), pxPerM=256, doubleSide=false,
 *   italic=false, letterSpacing=0 (px) }
 * The mesh has userData.redraw(newText).
 */
export function sign(text, w = 2, h = 1, opts = {}) {
  const {
    bg = '#14161a',
    fg = '#e8e4da',
    font = 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
    weight = 700,
    size,
    align = 'center',
    pad = 0.08,
    border,
    glow = false,
    weathered = 0,
    pxPerM = 256,
    doubleSide = false,
    italic = false,
    letterSpacing = 0,
  } = opts;
  const cw = Math.min(2048, Math.max(64, Math.round(w * pxPerM)));
  const ch = Math.min(2048, Math.max(32, Math.round(h * pxPerM)));
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const draw = (t) => {
    ctx.clearRect(0, 0, cw, ch);
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cw, ch);
    }
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = Math.max(2, ch * 0.04);
      ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, cw - ctx.lineWidth, ch - ctx.lineWidth);
    }
    const lines = String(t).split('\n');
    const px = pad * Math.min(cw, ch);
    let fs = size || (ch - px * 2) / lines.length / 1.2;
    const setFont = () => (ctx.font = `${italic ? 'italic ' : ''}${weight} ${fs}px ${font}`);
    setFont();
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${letterSpacing}px`;
    const widest = () => Math.max(...lines.map((l) => ctx.measureText(l).width));
    while (fs > 8 && widest() > cw - px * 2) {
      fs *= 0.92;
      setFont();
    }
    ctx.fillStyle = fg;
    ctx.textBaseline = 'middle';
    ctx.textAlign = align;
    const x = align === 'left' ? px : align === 'right' ? cw - px : cw / 2;
    const lh = fs * 1.2;
    const y0 = ch / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, x, y0 + i * lh));
    if (weathered > 0) {
      for (let i = 0; i < 40 * weathered; i++) {
        ctx.fillStyle = `rgba(30,20,10,${Math.random() * 0.25 * weathered})`;
        const r = Math.random() * ch * 0.4;
        ctx.beginPath();
        ctx.arc(Math.random() * cw, Math.random() * ch, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = `rgba(0,0,0,${0.35 * weathered})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 6 * weathered; i++) {
        ctx.beginPath();
        let px2 = Math.random() * cw;
        let py = Math.random() * ch;
        ctx.moveTo(px2, py);
        for (let k = 0; k < 5; k++) ctx.lineTo((px2 += (Math.random() - 0.5) * cw * 0.15), (py += (Math.random() - 0.3) * ch * 0.2));
        ctx.stroke();
      }
    }
    tex.needsUpdate = true;
  };
  draw(text);

  const side = doubleSide ? THREE.DoubleSide : THREE.FrontSide;
  // glow: unlit (MeshBasicMaterial). Note: toneMapped:false has no effect here, because every pass
  // renders into a composer target and OutputPass tone-maps the whole frame (ACES). Pick glow colours
  // and multipliers for how they look after ACES and the Mood grade.
  const material = glow
    ? new THREE.MeshBasicMaterial({ map: tex, transparent: !bg, side, toneMapped: false })
    : new THREE.MeshStandardMaterial({ map: tex, transparent: !bg, side, roughness: 0.8 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.name = 'sign';
  mesh.userData.redraw = draw;
  mesh.userData.canvas = c;
  return mesh;
}

// ------------------------------------------------------------------ text that follows the language

/**
 * Keep a sign() (or anything with userData.redraw) in the current language: text() is read again
 * whenever i18n.js re-resolves L. Chapter-scoped: the Director drops it between chapters. Returns obj.
 */
export function relabel(obj, text) {
  onLangChange(() => obj.userData.redraw?.(text()), { chapter: true });
  return obj;
}

/**
 * Same for a canvas texture: after a language change make() builds it again and it replaces
 * material[keys] (the old one is disposed). Returns the material.
 */
export function relangTexture(material, make, keys = ['map']) {
  onLangChange(
    () => {
      const old = material[keys[0]];
      const tex = make();
      for (const k of keys) material[k] = tex;
      if (old && old !== tex) old.dispose();
    },
    { chapter: true },
  );
  return material;
}

// ------------------------------------------------------------------ seeded random

/** Small seeded PRNG (mulberry32). Returns () => [0, 1). */
export function rng(seed = 1) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ grime

/**
 * A dirty-wall CanvasTexture: base colour + noise, damp blooms, rust drips from the top edge,
 * graffiti scribbles and torn poster rectangles. Deterministic per `seed`.
 * opts: { w=512, h=512, base='#8a8478', spread=0.1, stains=8, drips=6, tags=3, posters=2, seed=1,
 *         repeat:[u,v], rust='#7a4626', damp='#3c4030', tagColors:[css...], posterColors:[css...] }
 * Counts may be 0. Use it as `map` on a mid-value material (the grade does the darkness).
 * texture.userData.canvas is the canvas (draw more on it, then set texture.needsUpdate = true).
 */
export function grimeTexture({
  w = 512,
  h = 512,
  base = '#8a8478',
  spread = 0.1,
  stains = 8,
  drips = 6,
  tags = 3,
  posters = 2,
  seed = 1,
  repeat,
  rust = '#7a4626',
  damp = '#3c4030',
  tagColors = ['#2b2b2e', '#7d2f3a', '#2f4f6a', '#5b6a2f', '#d8d2c4'],
  posterColors = ['#d9d2c0', '#c9b98f', '#b8c4c8', '#c48a6a'],
} = {}) {
  const R = rng(seed);
  const tex = canvasTexture(
    w,
    h,
    (ctx) => {
      // Base + per-pixel noise (seeded).
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = (R() - 0.5) * 2 * spread * 255;
        d[i] = Math.max(0, Math.min(255, d[i] + n));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
      }
      ctx.putImageData(img, 0, 0);
      const S = Math.min(w, h);
      // Posters first (they get dirty too): torn rectangles with ragged edges and text bars.
      for (let i = 0; i < posters; i++) {
        const pw = S * (0.12 + R() * 0.16);
        const ph = pw * (1.25 + R() * 0.3);
        const px = R() * (w - pw);
        const py = h * 0.25 + R() * (h * 0.6 - ph);
        ctx.save();
        ctx.translate(px + pw / 2, py + ph / 2);
        ctx.rotate((R() - 0.5) * 0.12);
        ctx.fillStyle = posterColors[(R() * posterColors.length) | 0];
        ctx.beginPath();
        const torn = 0.25 + R() * 0.5; // how much of the bottom is torn away
        ctx.moveTo(-pw / 2, -ph / 2);
        ctx.lineTo(pw / 2, -ph / 2);
        let y = ph / 2 - torn * ph;
        ctx.lineTo(pw / 2, y);
        for (let k = 0; k <= 10; k++) ctx.lineTo(pw / 2 - (k / 10) * pw, y + (R() - 0.3) * ph * 0.18 * (k % 2 ? 1 : 0.4) + (k / 10) * torn * ph * R());
        ctx.closePath();
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#2a2622';
        for (let k = 0; k < 4; k++) ctx.fillRect(-pw * 0.38, -ph * 0.4 + k * ph * 0.11, pw * (0.3 + R() * 0.46), ph * 0.05);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      // Damp blooms: soft dark radial stains, heavier near the bottom.
      for (let i = 0; i < stains; i++) {
        const x = R() * w;
        const y = h * (0.35 + 0.65 * Math.sqrt(R()));
        const r = S * (0.08 + R() * 0.22);
        const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
        g.addColorStop(0, hexA(damp, 0.28 + R() * 0.18));
        g.addColorStop(0.6, hexA(damp, 0.12));
        g.addColorStop(1, hexA(damp, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, r * (1 + R() * 0.6), r, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Rust drips from the top edge (downpipes, bolts).
      for (let i = 0; i < drips; i++) {
        const x = R() * w;
        const len = h * (0.15 + R() * 0.55);
        const y0 = R() < 0.6 ? 0 : R() * h * 0.4;
        const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
        g.addColorStop(0, hexA(rust, 0.55));
        g.addColorStop(1, hexA(rust, 0));
        ctx.strokeStyle = g;
        ctx.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
          ctx.lineWidth = S * (0.004 + R() * 0.01);
          ctx.beginPath();
          const xx = x + (R() - 0.5) * S * 0.02;
          ctx.moveTo(xx, y0);
          ctx.quadraticCurveTo(xx + (R() - 0.5) * 6, y0 + len * 0.5, xx + (R() - 0.5) * 8, y0 + len * (0.6 + R() * 0.4));
          ctx.stroke();
        }
      }
      // Graffiti: loopy scribbled tags with an outline.
      for (let i = 0; i < tags; i++) {
        const cx = R() * w;
        const cy = h * (0.45 + R() * 0.45);
        const tw = S * (0.12 + R() * 0.2);
        const col = tagColors[(R() * tagColors.length) | 0];
        const pts = [];
        for (let k = 0; k < 7 + ((R() * 6) | 0); k++) pts.push([cx - tw / 2 + (k / 10) * tw + (R() - 0.5) * tw * 0.12, cy + (R() - 0.5) * tw * 0.45]);
        for (const [lw, c, a] of [[S * 0.016, '#111111', 0.35], [S * 0.009, col, 0.8]]) {
          ctx.strokeStyle = hexA(c, a);
          ctx.lineWidth = lw;
          ctx.lineJoin = ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let k = 1; k < pts.length - 1; k++) {
            const mx = (pts[k][0] + pts[k + 1][0]) / 2;
            const my = (pts[k][1] + pts[k + 1][1]) / 2;
            ctx.quadraticCurveTo(pts[k][0], pts[k][1] - tw * 0.2, mx, my);
          }
          ctx.stroke();
        }
      }
      // Grime along the bottom (splash-back) and a few scuffs.
      const gb = ctx.createLinearGradient(0, h * 0.82, 0, h);
      gb.addColorStop(0, 'rgba(30,26,20,0)');
      gb.addColorStop(1, 'rgba(30,26,20,0.45)');
      ctx.fillStyle = gb;
      ctx.fillRect(0, h * 0.82, w, h * 0.18);
    },
    { repeat },
  );
  tex.userData.canvas = tex.image;
  tex.userData.grime = true; // mat() / box() layer the chapter's wall recipe under it
  return tex;
}

/** '#rrggbb' + alpha -> 'rgba(...)'. */
function hexA(hex, a) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

// ------------------------------------------------------------------ bicycle

const _up = new THREE.Vector3(0, 1, 0);

/** Cylinder geometry spanning a -> b (Vector3s). */
function tube(a, b, r) {
  const d = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r, r, d.length(), 8, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_up, d.clone().normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/**
 * A road saddle in metres (nose toward +Z, centred, top at about y = 0.02): a narrow nose, a wide
 * rear that kicks up a little, a dipped middle, and two rails underneath. Non-indexed-safe for merging.
 */
export function saddleGeometry() {
  const sg = new RoundedBoxGeometry(0.14, 0.036, 0.27, 4, 0.016);
  const p = sg.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = THREE.MathUtils.clamp((p.getZ(i) + 0.135) / 0.27, 0, 1); // 0 = rear, 1 = nose
    const w = 1 - 0.72 * THREE.MathUtils.smoothstep(t, 0.22, 0.95);
    p.setX(i, p.getX(i) * w);
    const top = p.getY(i) > 0 ? 1 : 0;
    p.setY(i, p.getY(i) * (top ? 1 : 0.6) + 0.014 * (1 - t) * (1 - t) - 0.006 * Math.sin(t * Math.PI) * top);
  }
  sg.computeVertexNormals();
  const rails = [-1, 1].map((sx) => tube(new THREE.Vector3(sx * 0.025, -0.022, -0.09), new THREE.Vector3(sx * 0.012, -0.018, 0.1), 0.0035));
  for (const r of rails) r.deleteAttribute('uv');
  sg.deleteAttribute('uv');
  const flat = (x) => (x.index ? x.toNonIndexed() : x);
  return mergeGeometries([flat(sg), ...rails.map(flat)]);
}

/** Closed chain path (metres, in the x = cx plane) round a chainring and a rear cog. */
function chainCurve(cx, ring, rr, cog, cr) {
  const pts = [];
  const d = new THREE.Vector2(cog.z - ring.z, cog.y - ring.y);
  const L = d.length();
  const base = Math.atan2(d.y, d.x);
  const off = Math.acos(THREE.MathUtils.clamp((rr - cr) / L, -1, 1)); // external tangents
  const arc = (c, r, a0, a1, n) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push(new THREE.Vector3(cx, c.y + Math.sin(a) * r, c.z + Math.cos(a) * r));
    }
  };
  // Round the cog from the top tangent to the bottom one, then round the ring back.
  arc(cog, cr, base + off, base - off, 10);
  arc(ring, rr, base - off, base + off - Math.PI * 2, 24);
  return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.2);
}

/**
 * A procedural road bike, ~1.0 m wheelbase, 0.68 m wheels, standing on y = 0. Its long axis is Z:
 * the front wheel is toward +Z (so rotation.y works like a character's facing), centred on x = 0.
 * opts: { frame='#8a2b22', rust=0 (0..1: orange frame, dull rims, brown chain), scale=1,
 *         saddle=true (false: leave the box saddle off, for a caller that fits its own at userData.seat) }
 * Returns a Group with userData:
 *   wheels: [front, rear]  Groups at the axles; spin with wheel.rotation.x -= speed * dt / 0.34
 *   rims:   [front, rear]  rim meshes (wobble a rim with rim.rotation.z / position.x, recolour it)
 *   tires, spokes          per wheel, same order
 *   frameMaterial          the frame's MeshStandardMaterial
 *   seat: Vector3, bars: Vector3   local seat / handlebar points (for posing a rider)
 * About 10 draw calls (+ shadows).
 */
export function bicycle({ frame = '#8a2b22', rust = 0, scale = 1, saddle = true } = {}) {
  const k = THREE.MathUtils.clamp(rust, 0, 1);
  const g = new THREE.Group();
  g.name = 'bicycle';
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const R = 0.34; // wheel radius (tyre outer)
  const rearAxle = V(0, R, -0.5);
  const frontAxle = V(0, R, 0.5);
  const bb = V(0, 0.27, -0.08);
  const seatTop = V(0, 0.8, -0.24);
  const seatStayTop = V(0, 0.76, -0.23);
  const headTop = V(0, 0.82, 0.37);
  const headBot = V(0, 0.68, 0.41);

  const frameCol = new THREE.Color(frame).lerp(new THREE.Color('#6e4630'), k * 0.75);
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: frameCol,
    roughness: 0.35 + 0.55 * k,
    metalness: 0.35 * (1 - k),
  });
  const metal = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#b9bcc0').lerp(new THREE.Color('#7a5a40'), k * 0.8),
    roughness: 0.35 + 0.5 * k,
    metalness: 0.7 * (1 - k * 0.7),
  });
  const black = new THREE.MeshStandardMaterial({ color: '#202124', roughness: 0.9 });

  const tr = 0.017;
  const frameGeo = mergeGeometries([
    tube(bb, seatTop, tr),
    tube(seatTop, headTop, tr * 0.9),
    tube(bb, headBot, tr * 1.15),
    tube(headBot, headTop, tr * 1.2),
    ...[-1, 1].map((s) => tube(V(s * 0.012, bb.y, bb.z), V(s * 0.055, R, rearAxle.z), tr * 0.6)),
    ...[-1, 1].map((s) => tube(V(s * 0.012, seatStayTop.y, seatStayTop.z), V(s * 0.055, R, rearAxle.z), tr * 0.55)),
    ...[-1, 1].map((s) => tube(V(s * 0.02, headBot.y, headBot.z), V(s * 0.05, R, frontAxle.z + 0.03), tr * 0.6)),
  ]);
  const frameMesh = new THREE.Mesh(frameGeo, frameMaterial);
  frameMesh.name = 'bike-frame';

  // Seatpost, stem, bars, cranks, chainring, cassette, mech (metal) and saddle / bar tape (black).
  const seatPostTop = V(0, 0.93, -0.28);
  const stemEnd = V(0, 0.88, 0.47);
  const barsC = V(0, 0.88, 0.49);
  const cog = V(-0.06, R, rearAxle.z);
  const ring = V(-0.06, bb.y, bb.z);
  const metalGeo = mergeGeometries(
    [
      tube(seatTop, seatPostTop, 0.012),
      tube(headTop, V(0, 0.87, 0.39), 0.014),
      tube(V(0, 0.87, 0.39), stemEnd, 0.012),
      new THREE.CylinderGeometry(0.1, 0.1, 0.004, 32).rotateZ(Math.PI / 2).translate(ring.x, ring.y, ring.z), // chainring
      new THREE.CylinderGeometry(0.084, 0.084, 0.004, 28).rotateZ(Math.PI / 2).translate(ring.x + 0.008, ring.y, ring.z),
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => new THREE.CylinderGeometry(0.03 + i * 0.006, 0.03 + i * 0.006, 0.0025, 20).rotateZ(Math.PI / 2).translate(cog.x + 0.012 - i * 0.004, cog.y, cog.z)), // cassette
      tube(V(-0.07, bb.y, bb.z), V(-0.07, bb.y - 0.16, bb.z + 0.03), 0.01),
      tube(V(0.07, bb.y, bb.z), V(0.07, bb.y + 0.16, bb.z - 0.03), 0.01),
      tube(V(-0.08, bb.y, bb.z), V(0.08, bb.y, bb.z), 0.014),
      // Rear mech: a hanger and the cage with its two jockey wheels below the cassette.
      tube(V(-0.055, R - 0.02, rearAxle.z + 0.01), V(-0.065, R - 0.07, rearAxle.z + 0.02), 0.008),
      new THREE.BoxGeometry(0.008, 0.075, 0.03).translate(-0.066, R - 0.105, rearAxle.z + 0.025),
      ...[0.075, 0.135].map((dy) => new THREE.CylinderGeometry(0.014, 0.014, 0.008, 12).rotateZ(Math.PI / 2).translate(-0.06, R - dy, rearAxle.z + 0.025)),
      // Brake calipers.
      new THREE.BoxGeometry(0.06, 0.03, 0.025).translate(0, R + 0.32, frontAxle.z - 0.02),
      new THREE.BoxGeometry(0.06, 0.03, 0.025).translate(0, seatStayTop.y - 0.07, seatStayTop.z - 0.03),
    ].map((g) => (g.index ? g.toNonIndexed() : g)),
  );
  for (const k of ['uv']) if (metalGeo.attributes[k]) metalGeo.deleteAttribute(k);
  const metalMesh = new THREE.Mesh(metalGeo, metal);
  const chainCol = new THREE.Color('#5a5c60').lerp(new THREE.Color('#7a4022'), k);
  const chainMat = new THREE.MeshStandardMaterial({ color: chainCol, roughness: 0.6 + 0.3 * k, metalness: 0.5 * (1 - k) });
  // The chain: one closed loop round the chainring and the middle cog.
  const chainGeo = new THREE.TubeGeometry(chainCurve(-0.06, ring, 0.1, cog, 0.045), 120, 0.0042, 4, true);
  const chainMesh = new THREE.Mesh(chainGeo, chainMat);
  // Drop bars: a straight top, then a smooth forward-and-down drop on each side (bar tape), with hoods.
  const drop = (sx) =>
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        V(sx * 0.06, barsC.y, barsC.z),
        V(sx * 0.17, barsC.y, barsC.z),
        V(sx * 0.205, barsC.y + 0.005, barsC.z + 0.05),
        V(sx * 0.21, barsC.y - 0.02, barsC.z + 0.1),
        V(sx * 0.21, barsC.y - 0.09, barsC.z + 0.105),
        V(sx * 0.21, barsC.y - 0.135, barsC.z + 0.06),
        V(sx * 0.21, barsC.y - 0.14, barsC.z - 0.03),
      ]),
      28,
      0.012,
      8,
    );
  const hood = (sx) => new THREE.BoxGeometry(0.03, 0.05, 0.045).rotateX(-0.5).translate(sx * 0.208, barsC.y + 0.01, barsC.z + 0.105);
  const parts = [
    ...(saddle ? [saddleGeometry().translate(seatPostTop.x, seatPostTop.y + 0.024, seatPostTop.z + 0.02)] : []),
    tube(V(-0.07, barsC.y, barsC.z), V(0.07, barsC.y, barsC.z), 0.014),
    drop(-1),
    drop(1),
    hood(-1),
    hood(1),
    new THREE.BoxGeometry(0.09, 0.02, 0.05).translate(-0.12, bb.y - 0.16, bb.z + 0.03),
    new THREE.BoxGeometry(0.09, 0.02, 0.05).translate(0.12, bb.y + 0.16, bb.z - 0.03),
  ].map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    if (n.attributes.uv) n.deleteAttribute('uv');
    return n;
  });
  const blackGeo = mergeGeometries(parts);
  const blackMesh = new THREE.Mesh(blackGeo, black);
  g.add(frameMesh, metalMesh, chainMesh, blackMesh);

  // Wheels: tyre (torus), rim + hub (one mesh), 16 spokes as LineSegments.
  const tireMat = new THREE.MeshStandardMaterial({ color: '#1c1c1e', roughness: 0.95 });
  const rimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c4c7cb').lerp(new THREE.Color('#6e5a48'), k * 0.85),
    roughness: 0.3 + 0.55 * k,
    metalness: 0.8 * (1 - k * 0.6),
  });
  const spokeMat = new THREE.LineBasicMaterial({ color: new THREE.Color('#a9adb2').lerp(new THREE.Color('#6a5a4a'), k) });
  const wheels = [];
  const rims = [];
  const tires = [];
  const spokes = [];
  for (const axle of [frontAxle, rearAxle]) {
    const w = new THREE.Group();
    w.name = axle === frontAxle ? 'wheel-front' : 'wheel-rear';
    w.position.copy(axle);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(R - 0.014, 0.014, 8, 40).rotateY(Math.PI / 2), tireMat);
    const rimGeo = mergeGeometries([
      new THREE.TorusGeometry(R - 0.036, 0.009, 6, 40).rotateY(Math.PI / 2),
      new THREE.CylinderGeometry(0.018, 0.018, 0.1, 10).rotateZ(Math.PI / 2),
    ]);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    const pos = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const hubA = a + (i % 2 ? 0.25 : -0.25); // crossed lacing
      const side = i % 2 ? 0.035 : -0.035;
      pos.push(side, Math.sin(hubA) * 0.02, Math.cos(hubA) * 0.02, 0, Math.sin(a) * (R - 0.044), Math.cos(a) * (R - 0.044));
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const sp = new THREE.LineSegments(sg, spokeMat);
    for (const m of [tire, rim]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    w.add(tire, rim, sp);
    g.add(w);
    wheels.push(w);
    rims.push(rim);
    tires.push(tire);
    spokes.push(sp);
  }
  for (const m of [frameMesh, metalMesh, chainMesh, blackMesh]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  g.scale.setScalar(scale);
  Object.assign(g.userData, { wheels, rims, tires, spokes, frameMaterial, seat: seatPostTop.clone(), bars: barsC.clone(), wheelRadius: R });
  return g;
}

// ------------------------------------------------------------------ rain

/**
 * Rain streaks that wrap around the camera (one draw call, a LineSegments with a small shader).
 * opts: { count=1600, size=[34,16,34] (box around the camera), color='#b9bec6', opacity=0.32,
 *         speed=12 (m/s), length=0.5 (m) }
 * Returns { object, material, update(dt, camera), opacity (get/set; 0 hides it) }.
 * Add `object` to your group and call update(dt, ctx.camera) from your scene's update().
 */
export function rain({ count = 1600, size = [34, 16, 34], color = '#b9bec6', opacity = 0.32, speed = 12, length = 0.5 } = {}) {
  const pos = new Float32Array(count * 6);
  const end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size[0];
    const y = Math.random() * size[1];
    const z = Math.random() * size[2];
    pos.set([x, y, z, x, y, z], i * 6);
    end[i * 2 + 1] = 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uBox: { value: new THREE.Vector3(...size) },
      uSpeed: { value: speed },
      uLen: { value: length },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */ `
      uniform float uTime, uSpeed, uLen; uniform vec3 uCam, uBox;
      attribute float aEnd; varying float vA;
      void main(){
        float r = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453);
        vec3 p = position;
        p.y -= uTime * uSpeed * (0.8 + 0.4 * r);
        p.x -= uTime * uSpeed * 0.1;
        vec3 w = uCam + mod(p - uCam, uBox) - 0.5 * uBox;
        w.y -= aEnd * uLen; w.x += aEnd * uLen * 0.1;
        vec4 mv = viewMatrix * vec4(w, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = length(mv.xyz);
        vA = (1.0 - smoothstep(7.0, 16.0, d)) * smoothstep(0.8, 2.0, d) * (1.0 - 0.75 * aEnd);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; varying float vA;
      void main(){ gl_FragColor = vec4(uColor, uOpacity * vA); }`,
    transparent: true,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geo, material);
  lines.frustumCulled = false;
  lines.renderOrder = 2;
  lines.castShadow = false;
  lines.name = 'rain';
  const u = material.uniforms;
  return {
    object: lines,
    material,
    update(dt, camera) {
      u.uTime.value += dt;
      if (camera) u.uCam.value.copy(camera.position);
      lines.visible = u.uOpacity.value > 0.005;
    },
    get opacity() {
      return u.uOpacity.value;
    },
    set opacity(v) {
      u.uOpacity.value = Math.max(0, v);
      lines.visible = u.uOpacity.value > 0.005;
    },
  };
}

// ------------------------------------------------------------------ instancing

/**
 * One InstancedMesh of boxes. items: [{ pos:[x,y,z] (bottom centre), size:[w,h,d], rotY=0, color }].
 * material defaults to a white MeshStandardMaterial (instance colours tint it).
 */
export function instancedBoxes(items, material = mat(0xffffff), { castShadow = true, receiveShadow = true } = {}) {
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const im = new THREE.InstancedMesh(geo, material, items.length);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  items.forEach((it, i) => {
    dummy.position.set(it.pos[0], it.pos[1], it.pos[2]);
    dummy.rotation.set(0, it.rotY || 0, 0);
    dummy.scale.set(it.size[0], it.size[1], it.size[2]);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
    if (it.color !== undefined) im.setColorAt(i, col.set(it.color));
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = castShadow;
  im.receiveShadow = receiveShadow;
  im.computeBoundingSphere();
  return im;
}

/**
 * Generic scatter: place(i, dummy, color) sets dummy.position/rotation/scale (and optionally color.set()).
 * Returns the InstancedMesh.
 */
export function scatter(geometry, material, count, place, { castShadow = true, receiveShadow = false } = {}) {
  const im = new THREE.InstancedMesh(geometry, material, count);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color(1, 1, 1);
  let colored = false;
  for (let i = 0; i < count; i++) {
    dummy.position.set(0, 0, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    col.setRGB(1, 1, 1);
    const r = place(i, dummy, col);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
    if (r !== false && (col.r !== 1 || col.g !== 1 || col.b !== 1 || colored)) {
      colored = true;
      im.setColorAt(i, col);
    }
  }
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = castShadow;
  im.receiveShadow = receiveShadow;
  im.computeBoundingSphere();
  return im;
}

// ------------------------------------------------------------------ atmosphere

const _cv = new THREE.Vector3();
const _cw = new THREE.Vector3();
const _cq = new THREE.Quaternion();
const _down = new THREE.Vector3(0, -1, 0);

/**
 * A soft, additive light cone (fake volumetric shaft) under a lamp. One draw call, no lighting, no
 * depth write; it fades at its rim (view angle), towards its foot and near the camera, and takes
 * the scene fog. The apex sits at the mesh origin and the cone points down -Y (rotate it to aim).
 * opts: { length=4, radius=1.4 (foot), apex=0.06 (top radius), color='#ffd9a0', opacity=0.25,
 *         softness=1.2 (rim falloff power), pos:[x,y,z], dir:Vector3|[x,y,z] (aim; default down) }
 * Returns the Mesh; mesh.material.uniforms.uOpacity drives it (0 hides; flicker it with the lamp).
 */
export function lightCone({ length = 4, radius = 1.4, apex = 0.06, color = '#ffd9a0', opacity = 0.25, softness = 1.2, pos, dir } = {}) {
  const geo = new THREE.CylinderGeometry(apex, radius, length, 28, 1, true).translate(0, -length / 2, 0);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uSoft: { value: softness },
      uLen: { value: length },
      fogColor: { value: new THREE.Color() },
      fogDensity: { value: 0 },
      fogNear: { value: 1 },
      fogFar: { value: 1000 },
    },
    vertexShader: /* glsl */ `
      uniform float uLen;
      varying float vAlong;
      varying vec3 vN, vV;
      varying float vFogDepth;
      void main() {
        vAlong = clamp(-position.y / uLen, 0.0, 1.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor, fogColor;
      uniform float uOpacity, uSoft, fogDensity;
      varying float vAlong;
      varying vec3 vN, vV;
      varying float vFogDepth;
      void main() {
        float rim = pow(abs(dot(normalize(vN), normalize(vV))), uSoft);
        float foot = (1.0 - vAlong) * (1.0 - vAlong);
        float top = smoothstep(0.0, 0.08, vAlong);
        float near = smoothstep(0.6, 2.5, vFogDepth);
        float fog = exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
        float a = uOpacity * rim * foot * top * near * mix(0.35, 1.0, fog);
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: true,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'light-cone';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 3;
  if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
  if (dir) {
    const v = Array.isArray(dir) ? _cv.set(dir[0], dir[1], dir[2]) : _cv.copy(dir);
    mesh.quaternion.setFromUnitVectors(_down, v.normalize());
  }
  return mesh;
}

/**
 * Add soft cones under the practical lights of a built scene (first-pass atmosphere, main.js runs
 * it after each build when the chapter look has `cones`): every SpotLight gets a cone along its
 * aim, and every PointLight hung at 3 m or higher with a reach of 14 m or more (street lamps) gets
 * one straight down to the ground. Skips lights with userData.noCone. Returns the cones added.
 * opts: { opacity=0.28, spotOpacity=0.16 }
 */
export function addLightCones(group, { opacity = 0.28, spotOpacity = 0.16 } = {}) {
  if (!group) return [];
  group.updateMatrixWorld(true);
  const lights = [];
  group.traverse((o) => {
    if (o.isLight && !o.userData.noCone && (o.isSpotLight || o.isPointLight)) lights.push(o);
  });
  const out = [];
  for (const l of lights) {
    l.getWorldPosition(_cw);
    const col = '#' + l.color.getHexString();
    let cone = null;
    if (l.isSpotLight) {
      l.target.updateMatrixWorld();
      const aim = l.target.getWorldPosition(new THREE.Vector3()).sub(_cw).normalize();
      const len = Math.min(l.distance || 6, _cw.y > 0.5 ? _cw.y / Math.max(0.3, -aim.y) : 6, 6);
      cone = lightCone({ length: len, radius: Math.tan(Math.min(l.angle, 1.0)) * len * 0.75, color: col, opacity: spotOpacity, dir: aim });
    } else if (_cw.y >= 3 && (l.distance === 0 || l.distance >= 14)) {
      cone = lightCone({ length: _cw.y, radius: _cw.y * 0.42, color: col, opacity });
    }
    if (!cone) continue;
    // Place in the group's space at the light's world position (the group may be offset).
    cone.position.copy(group.worldToLocal(_cw.clone()));
    group.getWorldQuaternion(_cq);
    cone.quaternion.premultiply(_cq.invert());
    cone.userData.light = l;
    group.add(cone);
    out.push(cone);
  }
  return out;
}

// ------------------------------------------------------------------ disposal

/**
 * Dispose geometries, materials, textures and light shadow maps under group (skips objects with userData.noDispose,
 * and materials / textures marked userData.shared) and remove it from its parent.
 */
export function disposeGroup(group) {
  if (!group) return;
  const textures = new Set();
  group.traverse((o) => {
    if (o.userData.noDispose) return;
    if (o.geometry && !o.userData.sharedGeometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (m.userData.shared) continue; // ctx.materials / look.surface cache: lives across chapters
      for (const v of Object.values(m)) if (v && v.isTexture) textures.add(v);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value?.isTexture) textures.add(u.value);
      m.dispose();
    }
    if (o.isInstancedMesh) o.dispose();
    if (o.isLight) {
      if (o.map?.isTexture) textures.add(o.map); // a SpotLight's projected map (Ch1's rain on the wall)
      o.dispose?.(); // frees shadow maps (Ch1's TV cube shadow)
    }
  });
  for (const t of textures) if (!t.userData.shared) t.dispose();
  group.removeFromParent();
}
