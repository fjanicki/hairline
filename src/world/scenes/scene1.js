import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { L } from '../../story/script.js';
import { ground, mat, pointLight, canvasTexture, grimeTexture, bicycle, rng } from '../build.js';

// Ch1 "No Impact": Hugo's third-floor flat, night, boot day 4. A 6 x 5 m dollhouse room (the +Z
// wall is omitted so the follow camera sits outside it). The flickering TV (a cycling broadcast)
// is the key light; cold moonlight comes in only through the window (an invisible ceiling shadows
// the rest), and a failing fluorescent strip over the kitchenette buzzes and blinks.
//
// Layout (top view, camera at +Z looking toward -Z):
//   back wall z = -2.5:  bed + bibs (left) | window, watch on its charger on the sill | TV | plant, door, bin bag
//   left wall:           bibs above the bed; the rusting race bike on two hooks
//   middle:              rug, coffee table (phone, takeaway), sofa facing the TV
//   right wall:          fridge (X-ray), kitchenette under the fluorescent strip, pedal bin
//   front-left corner:   a few cardboard boxes

const W = 6; // room width (x)
const D = 5; // room depth (z)
const H = 2.7; // wall height
const T = 0.16; // wall thickness
const IN_X = W / 2 - T / 2; // 2.92, inner face of the side walls
const BACK_Z = -D / 2 + T / 2; // -2.42, inner face of the back wall
const WIN = { x0: -1.55, x1: -0.55, y0: 0.95, y1: 2.15 };
const DOOR = { x0: 1.72, x1: 2.74, h: 2.11 };
const DOOR_X = (DOOR.x0 + DOOR.x1) / 2;
const WALL_U = W + T; // metres covered by the wall texture's u (outer extents, -3.08..3.08)

const TV_COLOR = 0x9fb7d6;
const TV_INTENSITY = 18; // candela at full brightness
const TV_POS = [0.55, -2.16]; // TV footprint centre (on the cabinet)
const SHOT_LEVELS = [1.0, 0.8, 0.62]; // relative screen brightness per broadcast shot

const FLUORO_COLOR = 0xcfe6d0;
const FLUORO_INTENSITY = 3.2;
const FLUORO_Z = 1.75; // centre of the kitchenette (right wall)

const BIKE_POS = [-IN_X + 0.24, 1.02, 0.4];

// Tiny on-screen dressing (text lives in script).
const TV_LIVE = L.ch1.signs.tvLive;
const XRAY_MARK = L.ch1.signs.xrayMark;

const clamp = THREE.MathUtils.clamp;
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
// Small deterministic hash (stable "random" per index).
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ------------------------------------------------------------------ geometry helpers

/**
 * Axis-aligned box from world extents, with metre-based UVs (side walls use (z, y), the back wall
 * (x, y)) and vertex colours: cut faces (wall tops, front ends) are painted dark.
 */
function slab(x0, x1, y0, y1, z0, z1, { cap = null } = {}) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const uv = g.attributes.uv;
  const col = new Float32Array(pos.count * 3);
  const capCol = new THREE.Color(cap ?? 0xffffff);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(nrm.getX(i));
    const ny = Math.abs(nrm.getY(i));
    if (nx > 0.5) uv.setXY(i, z, y);
    else if (ny > 0.5) uv.setXY(i, x, z);
    else uv.setXY(i, x, y);
    const isCut = cap !== null && ((nrm.getY(i) > 0.5 && y > H - 0.01) || (nrm.getZ(i) > 0.5 && z > D / 2 - 0.01));
    const c = isCut ? capCol : { r: 1, g: 1, b: 1 };
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function mergedMesh(geos, material, { castShadow = true, receiveShadow = true, name } = {}) {
  const m = new THREE.Mesh(mergeGeometries(geos, false), material);
  for (const g of geos) g.dispose();
  m.castShadow = castShadow;
  m.receiveShadow = receiveShadow;
  if (name) m.name = name;
  return m;
}

/** Cylinder geometry spanning a -> b. */
function rod(a, b, r, seg = 8) {
  const d = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r, r, d.length(), seg, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

// ------------------------------------------------------------------ textures

/**
 * Nicotine-brown striped wallpaper gone bad, one non-repeating texture over every wall: damp blooms
 * in the corners, water drips and a tide-marked stain along the ceiling edge, a cleaner rectangle
 * above the TV where something used to hang, and torn paper around the window.
 */
function wallTexture() {
  const tex = grimeTexture({
    w: 1024,
    h: 512,
    base: '#a89c80',
    spread: 0.05,
    stains: 10,
    drips: 9,
    tags: 0,
    posters: 0,
    seed: 41,
    rust: '#6b5434',
    damp: '#3f402c',
  });
  const c = tex.userData.canvas;
  const g = c.getContext('2d');
  const w = c.width;
  const h = c.height;
  const X = (x) => (x / WALL_U + 0.5) * w; // back-wall metres -> px (side walls: z)
  const Y = (y) => (1 - y / H) * h;
  const R = rng(7);

  // Faded wallpaper stripes, 4 per metre (multiplied over the grime so the stains show through).
  const per = w / WALL_U / 4;
  for (let x = 0, i = 0; x < w; x += per, i++) {
    g.fillStyle = i % 2 ? 'rgba(255,240,200,0.045)' : 'rgba(40,30,10,0.05)';
    g.fillRect(x, 0, per / 2, h);
    g.fillStyle = 'rgba(40,30,10,0.07)';
    g.fillRect(x + per / 2 - 1, 0, 2, h);
  }
  // Nicotine: browner toward the top, where the smoke sat for thirty years.
  const nic = g.createLinearGradient(0, 0, 0, h);
  nic.addColorStop(0, 'rgba(110,80,30,0.32)');
  nic.addColorStop(0.45, 'rgba(110,80,30,0.08)');
  nic.addColorStop(1, 'rgba(110,80,30,0)');
  g.fillStyle = nic;
  g.fillRect(0, 0, w, h);
  // The stained ceiling edge: a brown band with wavy tide marks.
  const band = g.createLinearGradient(0, 0, 0, h * 0.12);
  band.addColorStop(0, 'rgba(70,52,26,0.55)');
  band.addColorStop(1, 'rgba(70,52,26,0)');
  g.fillStyle = band;
  g.fillRect(0, 0, w, h * 0.12);
  g.lineWidth = 1.5;
  for (let k = 0; k < 3; k++) {
    g.strokeStyle = `rgba(80,58,28,${0.28 - k * 0.07})`;
    g.beginPath();
    const y0 = h * (0.03 + k * 0.025);
    g.moveTo(0, y0);
    for (let x = 0; x <= w; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.013 + k * 2) * 5 + (R() - 0.5) * 4);
    g.stroke();
  }
  // Damp blooms in the corners (back-wall corners at u ~ 0.02 / 0.98, side-wall back corners ~0.1).
  for (const u of [0.02, 0.1, 0.9, 0.98]) {
    for (const [yy, r, a] of [
      [h, h * 0.55, 0.5],
      [0, h * 0.35, 0.42],
    ]) {
      const gr = g.createRadialGradient(u * w, yy, 4, u * w, yy, r);
      gr.addColorStop(0, `rgba(52,56,36,${a})`);
      gr.addColorStop(0.55, `rgba(52,56,36,${a * 0.35})`);
      gr.addColorStop(1, 'rgba(52,56,36,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }
  }
  // Above the TV: a cleaner rectangle where a framed team photo hung, with the nail still in.
  const gx0 = X(TV_POS[0] - 0.36);
  const gx1 = X(TV_POS[0] + 0.36);
  const gy0 = Y(2.1);
  const gy1 = Y(1.52);
  g.fillStyle = 'rgba(205,195,165,0.42)';
  g.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
  g.strokeStyle = 'rgba(60,45,22,0.25)';
  g.lineWidth = 2;
  g.strokeRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
  g.fillStyle = '#2a2622';
  g.beginPath();
  g.arc((gx0 + gx1) / 2, gy0 - 6, 2.2, 0, Math.PI * 2);
  g.fill();
  // Torn wallpaper around the window: pale plaster patches with ragged edges.
  const tear = (cx, cy, rw, rh) => {
    g.fillStyle = 'rgba(196,186,160,0.9)';
    g.beginPath();
    for (let k = 0; k <= 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const j = 0.65 + R() * 0.5;
      g.lineTo(cx + Math.cos(a) * rw * j, cy + Math.sin(a) * rh * j);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(60,45,25,0.35)';
    g.lineWidth = 1.2;
    g.stroke();
  };
  tear(X(WIN.x1 + 0.2), Y(2.2), 18, 26);
  tear(X(WIN.x0 - 0.12), Y(0.8), 14, 18);
  // Splash-back grime behind the kitchenette is on the right wall (u by z).
  const kx0 = X(FLUORO_Z - 0.5);
  const kx1 = X(FLUORO_Z + 0.5);
  const sp = g.createLinearGradient(0, Y(1.5), 0, Y(0.9));
  sp.addColorStop(0, 'rgba(60,48,30,0)');
  sp.addColorStop(1, 'rgba(60,48,30,0.3)');
  g.fillStyle = sp;
  g.fillRect(kx0, Y(1.5), kx1 - kx0, Y(0.9) - Y(1.5));
  tex.needsUpdate = true;
  tex.repeat.set(1 / WALL_U, 1 / H);
  tex.offset.set(0.5, 0);
  return tex;
}

/** Worn floorboards over the whole room (one non-repeating texture), with stains and wear. */
function floorTexture() {
  const R = rng(19);
  return canvasTexture(1024, 1024, (g, w, h) => {
    const planks = 30;
    const pw = w / planks;
    for (let i = 0; i < planks; i++) {
      let y = -R() * h * 0.4;
      while (y < h) {
        const len = h * (0.18 + R() * 0.22);
        const l = 36 + R() * 9;
        g.fillStyle = `hsl(30, ${10 + R() * 8}%, ${l}%)`;
        g.fillRect(i * pw, y, pw, len);
        g.strokeStyle = 'rgba(40,25,15,0.09)';
        g.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          const gx = i * pw + 3 + R() * (pw - 6);
          g.beginPath();
          g.moveTo(gx, y);
          g.bezierCurveTo(gx + 2, y + len * 0.3, gx - 2, y + len * 0.6, gx + 1, y + len);
          g.stroke();
        }
        g.fillStyle = 'rgba(20,12,6,0.4)';
        g.fillRect(i * pw, y + len - 1.5, pw, 1.5); // butt joint
        y += len;
      }
      g.fillStyle = 'rgba(15,9,4,0.5)';
      g.fillRect(i * pw, 0, 1.5, h); // seam (dirt in the gaps)
    }
    const P = (x, z) => [((x + W / 2) / W) * w, ((z + D / 2) / D) * h];
    const blot = (x, z, r, color, a) => {
      const [cx, cy] = P(x, z);
      const gr = g.createRadialGradient(cx, cy, 2, cx, cy, r);
      gr.addColorStop(0, color.replace('A', a));
      gr.addColorStop(1, color.replace('A', 0));
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(cx, cy, r * 1.3, r, R() * 3, 0, Math.PI * 2);
      g.fill();
    };
    // Rain gets in under the window: a grey water stain on the boards.
    blot(-1.05, -2.25, 120, 'rgba(40,44,40,A)', 0.45);
    // Worn grey path from the sofa to the door, and grime at the threshold.
    for (let k = 0; k < 8; k++) blot(0.4 + k * 0.25, 1.4 - k * 0.42, 70, 'rgba(30,26,20,A)', 0.18);
    blot(DOOR_X, -2.35, 110, 'rgba(25,20,14,A)', 0.4);
    // Coffee rings and a sticky patch by the sofa.
    for (const [x, z] of [
      [1.3, 1.25],
      [-0.2, -0.55],
      [1.55, 0.55],
    ]) {
      const [cx, cy] = P(x, z);
      g.strokeStyle = 'rgba(60,35,15,0.35)';
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(cx, cy, 11 + R() * 4, 0, Math.PI * 2);
      g.stroke();
    }
    blot(1.6, 1.9, 60, 'rgba(50,34,16,A)', 0.3);
    // Fine grain.
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (R() - 0.5) * 12;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
  });
}

/** Soft warm gradient for the light spilling from under the door. */
function spillTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, 0, 4, w / 2, 0, h);
    grd.addColorStop(0, 'rgba(255,214,160,0.9)');
    grd.addColorStop(0.35, 'rgba(255,190,130,0.35)');
    grd.addColorStop(1, 'rgba(255,190,130,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
}

// ------------------------------------------------------------------ the window (rain on dirty glass)

function rainGlassMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBright: { value: 1 } },
    fog: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uBright;
      varying vec2 vUv;
      float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      // 1 at x <= b, 0 at x >= a (a > b): a reversed smoothstep without undefined edge order.
      float fall(float a, float b, float x) { return 1.0 - smoothstep(b, a, x); }
      void main() {
        vec2 uv = vUv;
        // Night sky over the town, with the orange sodium glow of the street below.
        vec3 col = mix(vec3(0.05, 0.04, 0.035), vec3(0.008, 0.01, 0.016), smoothstep(0.0, 0.7, uv.y));
        // Out-of-focus street and window lights below the sill line.
        for (int i = 0; i < 10; i++) {
          float fi = float(i);
          vec2 c = vec2(h1(fi * 3.1 + 0.4), 0.05 + 0.38 * h1(fi * 7.7 + 1.3));
          float r = 0.05 + 0.08 * h1(fi * 1.9 + 2.1);
          float d = length((uv - c) * vec2(1.0, 0.85));
          float tw = 0.8 + 0.2 * sin(uTime * (0.3 + h1(fi)) + fi * 2.0);
          vec3 lc = mix(vec3(0.75, 0.42, 0.16), vec3(0.32, 0.4, 0.55), step(0.6, h1(fi * 5.3)));
          col += lc * 0.16 * tw * fall(r, 0.0, d);
        }
        // Rain falling past the window.
        float x = uv.x * 64.0;
        float id = floor(x);
        float fx = fract(x) - 0.5;
        float sp = 1.1 + 1.3 * h1(id * 1.7);
        float y = fract(uv.y * 0.9 + uTime * sp * 0.55 + h1(id * 9.1));
        float streak = fall(0.16, 0.0, abs(fx)) * smoothstep(0.0, 0.04, y) * fall(0.22, 0.04, y);
        col += vec3(0.22, 0.26, 0.32) * 0.5 * streak * step(0.4, h1(id * 3.3));
        // Drops on the glass sliding slowly down, with a faint wet trail above each.
        vec2 g = uv * vec2(11.0, 8.0);
        vec2 gi = floor(g);
        vec2 gf = fract(g) - 0.5;
        float rnd = h2(gi);
        float slide = fract(uTime * 0.04 * (0.4 + rnd) + rnd);
        vec2 dp = vec2((h2(gi + 3.1) - 0.5) * 0.5, 0.42 - slide * 0.84);
        float on = step(0.5, rnd);
        float drop = fall(0.13, 0.04, length((gf - dp) * vec2(1.0, 0.8))) * on;
        float trail = fall(0.035, 0.0, abs(gf.x - dp.x)) * step(dp.y, gf.y) * fall(0.5, 0.0, gf.y - dp.y) * on;
        col += vec3(0.32, 0.38, 0.48) * (drop * 0.45 + trail * 0.1);
        // Dirty glass: a brown film that gathers in the bottom corners and along the sill.
        float edge = min(min(uv.x, 1.0 - uv.x), uv.y * 0.7);
        float film = (1.0 - smoothstep(0.0, 0.22, edge)) * (0.55 + 0.45 * h2(floor(uv * 40.0)));
        col = mix(col, vec3(0.055, 0.047, 0.032), clamp(film * 0.7, 0.0, 1.0));
        gl_FragColor = vec4(max(col, vec3(0.0)) * uBright, 1.0);
      }`,
  });
}

function buildWindow(group) {
  const frameMat = mat('#a9a497', { roughness: 0.75 });
  const parts = [
    // sill (top a little above the wall piece below it, so the faces never coincide)
    slab(WIN.x0 - 0.1, WIN.x1 + 0.1, WIN.y0 - 0.03, WIN.y0 + 0.02, BACK_Z - 0.2, BACK_Z + 0.11),
    // trim around the opening on the room side
    slab(WIN.x0 - 0.07, WIN.x0, WIN.y0 + 0.02, WIN.y1 + 0.07, BACK_Z, BACK_Z + 0.03),
    slab(WIN.x1, WIN.x1 + 0.07, WIN.y0 + 0.02, WIN.y1 + 0.07, BACK_Z, BACK_Z + 0.03),
    slab(WIN.x0, WIN.x1, WIN.y1, WIN.y1 + 0.07, BACK_Z, BACK_Z + 0.03),
    // sash: full-height stiles, rails between them, a mullion and (slightly recessed) transom
    slab(WIN.x0, WIN.x0 + 0.05, WIN.y0 + 0.02, WIN.y1, -2.53, -2.47),
    slab(WIN.x1 - 0.05, WIN.x1, WIN.y0 + 0.02, WIN.y1, -2.53, -2.47),
    slab(WIN.x0 + 0.05, WIN.x1 - 0.05, WIN.y1 - 0.05, WIN.y1, -2.53, -2.47),
    slab(WIN.x0 + 0.05, WIN.x1 - 0.05, WIN.y0 + 0.02, WIN.y0 + 0.07, -2.53, -2.47),
    slab(-1.07, -1.03, WIN.y0 + 0.07, WIN.y1 - 0.05, -2.53, -2.47),
    slab(WIN.x0 + 0.05, WIN.x1 - 0.05, 1.56, 1.6, -2.53, -2.475),
  ];
  group.add(mergedMesh(parts, frameMat, { name: 'window-frame' }));

  const glassMat = rainGlassMaterial();
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0), glassMat);
  glass.position.set((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, -2.505);
  glass.name = 'window-glass';
  group.add(glass);
  return glassMat;
}

// ------------------------------------------------------------------ small hand-made props

/** GPS watch on its clip charger, cable running off the sill to a socket below the window. */
function buildWatch() {
  const g = new THREE.Group();
  g.name = 'gps-watch';
  const watch = new THREE.Group();
  const caseMat = mat('#2c2f33', { roughness: 0.4, metalness: 0.35 });
  const strapMat = mat('#24262a', { roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.012, 28), caseMat);
  body.position.y = 0.006;
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.0225, 0.0022, 6, 28).rotateX(Math.PI / 2), mat('#6b6f74', { roughness: 0.3, metalness: 0.6 }));
  bezel.position.y = 0.012;
  const faceTex = canvasTexture(64, 64, (c, w, h) => {
    c.fillStyle = '#0c0e0d';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#c8d0c6';
    c.font = '700 20px ui-monospace, Menlo, monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText((L.watch?.zero || '0.0 km').replace(/\s*km$/, ''), w / 2, h / 2 - 2);
    c.font = '700 9px ui-monospace, Menlo, monospace';
    c.fillText('km', w / 2, h / 2 + 14);
    c.fillStyle = '#3b7a3b';
    c.fillRect(w / 2 - 10, 9, 20, 3); // battery bar (charging)
  });
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.019, 28).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.2, emissive: '#ffffff', emissiveMap: faceTex, emissiveIntensity: 0.55 }),
  );
  face.position.y = 0.0125;
  const strapGeo = mergeGeometries([
    new THREE.BoxGeometry(0.022, 0.004, 0.075).translate(0, 0.002, 0.058),
    new THREE.BoxGeometry(0.022, 0.004, 0.085).translate(0, 0.002, -0.062),
  ]);
  const strap = new THREE.Mesh(strapGeo, strapMat);
  watch.add(body, bezel, face, strap);
  watch.rotation.y = 1.2; // strap lies along the sill
  g.add(watch);
  // Charger clip under the watch's back, and its cable off the front edge and down the wall.
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.03), mat('#1d1f22', { roughness: 0.6 }));
  clip.position.set(0.026, 0.003, 0);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.003, 0.004), new THREE.MeshBasicMaterial({ color: '#57d46a' }));
  led.position.set(0.036, 0.0065, 0.008);
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.04, 0.003, 0),
        new THREE.Vector3(0.07, 0.003, 0.05),
        new THREE.Vector3(0.08, 0.002, 0.1),
        new THREE.Vector3(0.085, -0.02, 0.126),
        new THREE.Vector3(0.09, -0.12, 0.126),
        new THREE.Vector3(0.1, -0.45, 0.06),
        new THREE.Vector3(0.12, -0.62, 0.0),
      ]),
      48,
      0.0022,
      5,
      false,
    ),
    mat('#202225', { roughness: 0.7 }),
  );
  const socket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.012), mat('#8f8a7c', { roughness: 0.7 }));
  socket.position.set(0.12, -0.64, -0.012);
  g.add(clip, led, cable, socket);
  return { group: g, watch, led };
}

function buildPhone() {
  const g = new THREE.Group();
  g.name = 'phone';
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.009, 0.158), mat('#1c1e22', { roughness: 0.35 }));
  body.position.y = 0.0045;
  body.castShadow = true;
  const tex = canvasTexture(64, 128, (c, w, h) => {
    const grd = c.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#3a4c66');
    grd.addColorStop(1, '#1a2230');
    c.fillStyle = grd;
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.fillRect(16, 14, 32, 7); // clock
    for (let i = 0; i < 5; i++) {
      c.fillStyle = 'rgba(230,236,245,0.55)';
      c.fillRect(6, 34 + i * 17, w - 12, 13); // notification rows
      c.fillStyle = 'rgba(20,28,40,0.6)';
      c.fillRect(10, 38 + i * 17, 30, 2);
      c.fillRect(10, 42 + i * 17, 40, 2);
    }
  });
  const screenMat = new THREE.MeshBasicMaterial({ map: tex });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.148).rotateX(-Math.PI / 2), screenMat);
  screen.position.y = 0.0095;
  g.add(body, screen);
  return { group: g, screenMat };
}

/** The X-ray film taped to the fridge: blue-black, white tibia, a biro circle round the line. */
function buildXray() {
  const tex = canvasTexture(256, 320, (c, w, h) => {
    const bg = c.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, h * 0.7);
    bg.addColorStop(0, '#1b2838');
    bg.addColorStop(1, '#070b12');
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    // Soft tissue: the calf's silhouette, faintly.
    c.fillStyle = 'rgba(150,170,190,0.12)';
    c.beginPath();
    c.moveTo(w * 0.22, 0);
    c.bezierCurveTo(w * 0.12, h * 0.3, w * 0.24, h * 0.7, w * 0.34, h);
    c.lineTo(w * 0.72, h);
    c.bezierCurveTo(w * 0.8, h * 0.7, w * 0.9, h * 0.3, w * 0.8, 0);
    c.closePath();
    c.fill();
    const bone = (pts, width, alpha) => {
      c.strokeStyle = `rgba(232,238,244,${alpha})`;
      c.lineCap = 'round';
      c.lineWidth = width;
      c.beginPath();
      c.moveTo(pts[0][0] * w, pts[0][1] * h);
      c.bezierCurveTo(pts[1][0] * w, pts[1][1] * h, pts[2][0] * w, pts[2][1] * h, pts[3][0] * w, pts[3][1] * h);
      c.stroke();
    };
    // Tibia (thick, cortex bright, marrow darker), fibula (thin, to the side).
    bone([[0.45, -0.05], [0.44, 0.35], [0.47, 0.7], [0.48, 1.02]], 34, 0.7);
    bone([[0.45, -0.05], [0.44, 0.35], [0.47, 0.7], [0.48, 1.02]], 16, 0.35);
    bone([[0.66, -0.02], [0.67, 0.35], [0.65, 0.7], [0.63, 1.0]], 10, 0.55);
    // Knee condyles and the ankle, cropped by the film edges.
    c.fillStyle = 'rgba(232,238,244,0.62)';
    c.beginPath();
    c.ellipse(w * 0.47, h * 0.02, 52, 22, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(w * 0.5, h * 0.99, 40, 16, 0, 0, Math.PI * 2);
    c.fill();
    // The dreaded black line: barely there, across the shaft.
    const fy = h * 0.56;
    c.strokeStyle = 'rgba(8,14,22,0.85)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(w * 0.385, fy - 3);
    c.lineTo(w * 0.455, fy + 1);
    c.lineTo(w * 0.53, fy + 4);
    c.stroke();
    // Dr Okafor's biro circle: two loose loops, not quite closed.
    c.strokeStyle = 'rgba(40,80,190,0.9)';
    c.lineWidth = 2;
    for (let k = 0; k < 2; k++) {
      c.beginPath();
      for (let a = 0.3 + k * 0.4; a < Math.PI * 2 + 0.6 + k * 0.4; a += 0.12) {
        const r = 1 + 0.06 * Math.sin(a * 3 + k);
        c.lineTo(w * 0.46 + Math.cos(a) * 34 * r + k * 3, fy + Math.sin(a) * 22 * r - k * 2);
      }
      c.stroke();
    }
    // Lead marker and the film's name strip.
    c.fillStyle = 'rgba(235,240,245,0.85)';
    c.font = '700 22px system-ui, sans-serif';
    c.fillText(XRAY_MARK, w * 0.08, h * 0.1);
    c.fillStyle = 'rgba(220,226,232,0.35)';
    c.fillRect(w * 0.62, h * 0.9, w * 0.32, 12);
    // Yellowed tape over the top corners.
    c.fillStyle = 'rgba(214,200,150,0.55)';
    c.save();
    c.translate(w * 0.1, 10);
    c.rotate(-0.5);
    c.fillRect(-26, -9, 52, 18);
    c.restore();
    c.save();
    c.translate(w * 0.9, 10);
    c.rotate(0.45);
    c.fillRect(-26, -9, 52, 18);
    c.restore();
  });
  const film = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.375),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.1, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.14 }),
  );
  film.name = 'xray';
  return film;
}

/**
 * 38 race bibs pinned in rows above the bed: one atlas canvas, three planes (one on the back wall
 * above the headboard, two on the left wall), merged into a single mesh.
 */
function buildBibs() {
  const CELL = [0.235, 0.195];
  const PX = 400; // px per metre on the atlas
  const panels = [
    { cols: 4, rows: 3, count: 12, wall: 'back', c: [-2.42, 1.42] }, // x, y centre
    { cols: 4, rows: 4, count: 16, wall: 'left', c: [-1.88, 1.45] }, // z, y centre
    { cols: 3, rows: 4, count: 10, wall: 'left', c: [-1.0, 1.45] },
  ];
  for (const p of panels) {
    p.w = p.cols * CELL[0] + 0.04;
    p.h = p.rows * CELL[1] + 0.04;
    p.pw = Math.ceil(p.w * PX);
    p.ph = Math.ceil(p.h * PX);
  }
  const AW = 1024;
  const AH = 1024;
  // Atlas placement: panel 0 top-left, panels 1 and 2 side by side below it.
  panels[0].ax = 0;
  panels[0].ay = 0;
  panels[1].ax = 0;
  panels[1].ay = panels[0].ph + 8;
  panels[2].ax = panels[1].pw + 8;
  panels[2].ay = panels[0].ph + 8;
  const R = rng(38);
  const bands = ['#c23b2e', '#2f5f9a', '#e0b030', '#3a8a5a', '#d26a2a', '#6a4a9a', '#20252c'];
  const tex = canvasTexture(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    let n = 0;
    for (const p of panels) {
      for (let i = 0; i < p.count; i++) {
        const col = i % p.cols;
        const row = (i / p.cols) | 0;
        const bw = 0.21 * PX * (0.94 + R() * 0.08);
        const bh = 0.165 * PX * (0.94 + R() * 0.08);
        const cx = p.ax + (0.02 + (col + 0.5) * CELL[0]) * PX + (R() - 0.5) * 6;
        const cy = p.ay + (0.02 + (row + 0.5) * CELL[1]) * PX + (R() - 0.5) * 6;
        g.save();
        g.translate(cx, cy);
        g.rotate((R() - 0.5) * 0.09);
        // drop shadow on the wall
        g.fillStyle = 'rgba(20,16,10,0.28)';
        g.fillRect(-bw / 2 + 3, -bh / 2 + 4, bw, bh);
        // the paper, yellowed by age (older ones further down)
        const age = 0.3 + 0.7 * R();
        g.fillStyle = `hsl(45, ${10 + age * 25}%, ${86 - age * 12}%)`;
        g.fillRect(-bw / 2, -bh / 2, bw, bh);
        g.fillStyle = bands[(R() * bands.length) | 0];
        g.globalAlpha = 0.85 - age * 0.25;
        g.fillRect(-bw / 2, -bh / 2, bw, bh * 0.2);
        g.fillRect(-bw / 2, bh / 2 - bh * 0.1, bw, bh * 0.1);
        g.globalAlpha = 1;
        // race number
        const num = String(100 + ((R() * 8900) | 0));
        g.fillStyle = '#16171a';
        g.font = `800 ${Math.round(bh * 0.4)}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(num, 0, bh * 0.05, bw * 0.86);
        // his split, written on in biro
        if (R() < 0.6) {
          const hh = 2 + ((R() * 2) | 0);
          const mm = String((R() * 60) | 0).padStart(2, '0');
          const ss = String((R() * 60) | 0).padStart(2, '0');
          g.fillStyle = 'rgba(40,60,150,0.8)';
          g.font = `italic 600 ${Math.round(bh * 0.15)}px "Bradley Hand", "Segoe Print", cursive`;
          g.fillText(`${hh}:${mm}:${ss}`, bw * 0.12, bh * 0.32);
        }
        // safety pins
        g.fillStyle = '#9a9c9e';
        for (const [sx, sy] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ])
          g.fillRect(sx * (bw / 2 - 5) - 2, sy * (bh / 2 - 5) - 1, 4, 2);
        g.restore();
        n++;
      }
    }
    return n;
  });
  tex.generateMipmaps = true;
  // Geometry: one plane per panel with its UVs mapped to its atlas rect.
  const geos = panels.map((p) => {
    const geo = new THREE.PlaneGeometry(p.w, p.h);
    const uv = geo.attributes.uv;
    const u0 = p.ax / AW;
    const u1 = (p.ax + p.w * PX) / AW;
    const v1 = 1 - p.ay / AH;
    const v0 = 1 - (p.ay + p.h * PX) / AH;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
    if (p.wall === 'back') {
      geo.translate(p.c[0], p.c[1], BACK_Z + 0.006);
    } else {
      geo.rotateY(Math.PI / 2); // faces +X, into the room
      geo.translate(-IN_X + 0.006, p.c[1], p.c[0]);
    }
    return geo;
  });
  const mesh = new THREE.Mesh(
    mergeGeometries(geos, false),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  for (const g of geos) g.dispose();
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  mesh.name = 'race-bibs';
  return mesh;
}

/** A strip of wallpaper peeling off the wall, curling toward the room. */
function peel(w, h, curl, color) {
  const geo = new THREE.PlaneGeometry(w, h, 1, 8);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + h / 2) / h; // 0 bottom (still stuck) .. 1 top (curled)
    p.setZ(i, curl * t * t);
    p.setY(i, p.getY(i) - curl * 0.35 * t * t * t);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat(color, { roughness: 0.95, side: THREE.DoubleSide }));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A knotted black bin bag, lumpy and a little shiny. */
function binBag(seed) {
  const R = rng(seed);
  const geo = new THREE.IcosahedronGeometry(0.24, 3);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + 0.08 * Math.sin(v.x * 23 + seed) * Math.sin(v.z * 19) + 0.05 * Math.sin(v.y * 31 + v.x * 11);
    v.multiplyScalar(n);
    v.y = v.y < 0 ? v.y * 0.55 : v.y * 1.05; // sits heavy on the floor
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.translate(0, 0.13, 0);
  geo.computeVertexNormals();
  const plastic = mat('#2a2c2f', { roughness: 0.32, metalness: 0.15 });
  const g = new THREE.Group();
  const body = new THREE.Mesh(geo, plastic);
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 7).translate(0, 0.41, 0), plastic);
  knot.rotation.z = (R() - 0.5) * 0.4;
  for (const m of [body, knot]) {
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

/** Noodle cartons and a pizza box. */
function takeaway() {
  const carton = mat('#d6cfbd', { roughness: 0.85 });
  const cartonGeo = new THREE.CylinderGeometry(0.06, 0.042, 0.09, 4, 1).rotateY(Math.PI / 4).translate(0, 0.045, 0);
  const pizzaTex = canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#a8865a';
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(70,40,15,0.35)';
    c.beginPath();
    c.ellipse(w * 0.62, h * 0.55, 30, 22, 0.4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(140,40,30,0.5)';
    c.fillRect(w * 0.15, h * 0.15, w * 0.3, 10);
  });
  const pizza = mat('#ffffff', { map: pizzaTex, roughness: 0.9 });
  return {
    /** All the noodle cartons as one mesh: items [x, z, rotY, y]. */
    cartons: (items) => {
      const geos = items.map(([x, z, r, y]) => cartonGeo.clone().rotateY(r).translate(x, y, z));
      const m = new THREE.Mesh(mergeGeometries(geos, false), carton);
      for (const g of geos) g.dispose();
      cartonGeo.dispose();
      m.castShadow = true;
      return m;
    },
    pizza: () => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.34), pizza);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    },
  };
}

/** The fluorescent strip over the kitchenette: housing, tube and its (failing) light. */
function buildFluoro() {
  const g = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.92), mat('#b8b5aa', { roughness: 0.7 }));
  const tubeMat = new THREE.MeshStandardMaterial({ color: '#dfe9de', emissive: new THREE.Color(FLUORO_COLOR), emissiveIntensity: 1.6, roughness: 0.4 });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.84, 10).rotateX(Math.PI / 2), tubeMat);
  tube.position.set(-0.03, -0.035, 0);
  // Dead insects in the diffuser lip.
  const flies = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.002, 0.5), new THREE.MeshBasicMaterial({ color: '#1a1714' }));
  flies.position.set(-0.036, -0.026, 0.1);
  g.add(housing, tube, flies);
  g.position.set(IN_X - 0.03, 2.32, FLUORO_Z);
  const light = pointLight(FLUORO_COLOR, FLUORO_INTENSITY, { pos: [IN_X - 0.32, 2.12, FLUORO_Z], distance: 4.5 });
  return { group: g, tubeMat, light };
}

/** Two L-hooks screwed into the left wall, rubber-coated. */
function bikeHooks() {
  const geos = [];
  for (const z of [0.24, 0.68]) {
    const y = 1.79;
    geos.push(rod(new THREE.Vector3(-IN_X, y, z), new THREE.Vector3(-2.6, y, z), 0.008));
    geos.push(rod(new THREE.Vector3(-2.6, y - 0.008, z), new THREE.Vector3(-2.6, y + 0.05, z), 0.008));
    geos.push(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 10).rotateZ(Math.PI / 2).translate(-IN_X + 0.005, y, z));
  }
  const m = new THREE.Mesh(mergeGeometries(geos, false), mat('#3a3a3a', { roughness: 0.6 }));
  for (const gg of geos) gg.dispose();
  m.castShadow = true;
  return m;
}

/** Old race bike: rusted, faded team stickers on the down tube, hung on the hooks. */
function hangingBike() {
  const bike = bicycle({ rust: 0.8 });
  // The down tube runs from the bottom bracket to the head tube (bike-local, see build.bicycle).
  const a = new THREE.Vector3(0, 0.27, -0.08);
  const b = new THREE.Vector3(0, 0.68, 0.41);
  const sleeve = (t0, t1, color) => {
    const m = new THREE.Mesh(rod(a.clone().lerp(b, t0), a.clone().lerp(b, t1), 0.0205, 10), mat(color, { roughness: 0.8 }));
    m.castShadow = true;
    bike.add(m);
  };
  sleeve(0.32, 0.5, '#7d8fa6'); // what's left of the team blue
  sleeve(0.56, 0.66, '#c4bca6');
  bike.position.set(BIKE_POS[0], BIKE_POS[1], BIKE_POS[2]);
  return bike;
}

/** Running shoes by the door, the loudest colour in the flat. */
function runningShoes() {
  const g = new THREE.Group();
  const uppers = [];
  const soles = [];
  for (const s of [-1, 1]) {
    const place = (geo) => geo.rotateY(s * 0.12).translate(s * 0.07, 0, s * 0.03);
    uppers.push(place(new THREE.CapsuleGeometry(0.045, 0.16, 4, 10).rotateX(Math.PI / 2).scale(1, 0.75, 1).translate(0, 0.05, 0)));
    soles.push(place(new THREE.BoxGeometry(0.09, 0.025, 0.27).translate(0, 0.0125, 0)));
  }
  g.add(mergedMesh(uppers, mat('#b7d63a', { roughness: 0.6 }), { name: 'shoe-uppers' }));
  g.add(mergedMesh(soles, mat('#e6e3da', { roughness: 0.8 }), { name: 'shoe-soles' }));
  return g;
}

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
function drawBroadcast(g, w, h, t, shot, shotT, ticker) {
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
      const x = (((hash(i) * w - t * 160) % (w + 80)) + w + 80) % (w + 80) - 40;
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
  g.fillStyle = '#c8281e';
  g.fillRect(8, 8, 26, 12);
  g.fillStyle = '#fff';
  g.font = '700 9px system-ui, sans-serif';
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText(TV_LIVE, 11, 14.5);
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

// ------------------------------------------------------------------ builder

export async function buildScene1(ctx) {
  const { assets } = ctx;
  const group = new THREE.Group();
  group.name = 'scene1';

  // ---- floor, under-slab (the dollhouse cut) and shadow-only ceiling
  group.add(ground({ size: [W, D], map: floorTexture(), color: '#ffffff', roughness: 0.8, noise: false }));
  const under = new THREE.Mesh(new THREE.BoxGeometry(W + T, 0.3, D + 0.08).translate(0, -0.155, -0.04), mat('#2a2c30', { roughness: 1 }));
  group.add(under);
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.4, 0.12, D + 0.4).translate(0, H + 0.06, 0),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  ceiling.name = 'ceiling-shadow-caster';
  ceiling.castShadow = true; // invisible, but keeps the moon out of everywhere except the window
  group.add(ceiling);

  // ---- walls (one merged mesh, one grimy texture), skirting, window, door opening
  const zb0 = -D / 2 - T / 2;
  const zb1 = BACK_Z;
  const ex = W / 2 + T / 2; // 3.08
  const capColor = 0x2e3034;
  const walls = [
    slab(-ex, WIN.x0, 0, H, zb0, zb1, { cap: capColor }),
    slab(WIN.x0, WIN.x1, 0, WIN.y0, zb0, zb1, { cap: capColor }),
    slab(WIN.x0, WIN.x1, WIN.y1, H, zb0, zb1, { cap: capColor }),
    slab(WIN.x1, DOOR.x0, 0, H, zb0, zb1, { cap: capColor }),
    slab(DOOR.x0, DOOR.x1, DOOR.h, H, zb0, zb1, { cap: capColor }),
    slab(DOOR.x1, ex, 0, H, zb0, zb1, { cap: capColor }),
    slab(-ex, -IN_X, 0, H, BACK_Z, D / 2, { cap: capColor }),
    slab(IN_X, ex, 0, H, BACK_Z, D / 2, { cap: capColor }),
  ];
  group.add(mergedMesh(walls, mat('#ffffff', { map: wallTexture(), vertexColors: true, roughness: 0.93 }), { name: 'walls' }));

  const sk = 0.1; // skirting height
  const skirting = [
    slab(-IN_X, DOOR.x0, 0, sk, BACK_Z, BACK_Z + 0.02),
    slab(DOOR.x1, IN_X, 0, sk, BACK_Z, BACK_Z + 0.02),
    slab(-IN_X, -IN_X + 0.02, 0, sk, BACK_Z + 0.02, D / 2),
    slab(IN_X - 0.02, IN_X, 0, sk, BACK_Z + 0.02, D / 2),
  ];
  group.add(mergedMesh(skirting, mat('#6a655b', { roughness: 0.85 }), { castShadow: false, name: 'skirting' }));

  const glassMat = buildWindow(group);

  // Wallpaper peeling by the window, curling into the room.
  const p1 = peel(0.22, 0.36, 0.09, '#b4a888');
  p1.position.set(WIN.x1 + 0.2, 2.25, BACK_Z + 0.003);
  p1.rotation.z = 0.08;
  const p2 = peel(0.16, 0.24, 0.06, '#ab9f80');
  p2.position.set(WIN.x0 - 0.16, 0.72, BACK_Z + 0.003);
  p2.rotation.set(0, 0, Math.PI - 0.15); // curls down from the sill
  group.add(p1, p2);

  // ---- Kenney furniture (every load fails soft to a grey box of the same size)
  const F = (name, opts) => assets.prop(`kenney/furniture/${name}.glb`, opts);
  const [sofa, tvCab, tv, table, bed, rug, fridge, lamp, plant, bin, doorway, cabinet, boxA, boxB, boxD, bottleA, bottleB] = await Promise.all([
    F('loungeSofa', { height: 0.85, tint: '#8f897c' }),
    F('cabinetTelevision', { height: 0.6, tint: '#9e9688' }),
    F('televisionVintage', { height: 0.5 }),
    F('tableCoffee', { height: 0.45, tint: '#a0978a' }),
    F('bedSingle', { height: 0.667, tint: '#b3ab98' }),
    F('rugRectangle', { width: 2.0, castShadow: false, tint: '#8c8270' }),
    F('kitchenFridge', { height: 1.8, tint: '#d8d2c2' }),
    F('lampRoundFloor', { height: 1.6 }),
    F('pottedPlant', { height: 0.75, tint: '#6b6450' }),
    F('trashcan', { height: 0.55, tint: '#9a968c' }),
    F('doorway', { height: DOOR.h, tint: '#a39a86' }),
    F('kitchenCabinet', { height: 0.9, tint: '#c9c2b0' }),
    F('cardboardBoxClosed', { height: 0.5 }),
    F('cardboardBoxClosed', { height: 0.46 }),
    F('cardboardBoxOpen', { height: 0.5 }),
    assets.prop('kenney/survival/bottle-large.glb', { height: 0.3, tint: '#6f7f6a' }),
    assets.prop('kenney/survival/bottle-large.glb', { height: 0.26, tint: '#8a7a5a' }),
  ]);
  const place = (o, x, z, rotY = 0, y = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = rotY;
    group.add(o);
    return o;
  };
  place(bed, -IN_X + 0.51, BACK_Z + 1.01);
  place(lamp, -1.7, -2.2, 0.3);
  place(tvCab, TV_POS[0], BACK_Z + 0.255);
  place(tv, TV_POS[0], TV_POS[1], 0, 0.601);
  place(rug, 0.55, -0.75, 0, 0.002);
  place(table, 0.55, -1.0);
  place(sofa, 0.55, 0.42, Math.PI);
  place(fridge, IN_X - 0.315, 0.9, -Math.PI / 2);
  // Kitchenette: one cabinet run along the right wall, made shallower (0.62 m deep).
  cabinet.scale.z *= 0.62 / Math.max(0.2, cabinet.userData.size?.z || 0.96);
  place(cabinet, IN_X - 0.31, FLUORO_Z + 0.01, -Math.PI / 2);
  place(bin, 2.45, 2.33, -0.4);
  place(plant, 1.52, -2.2, 0.6);
  place(doorway, DOOR_X, -D / 2);
  place(boxA, -2.62, 1.45, 0.1);
  place(boxB, -2.2, 1.5, -0.05);
  place(boxD, -2.5, 2.12, 0.3);
  // Counter clutter: bottles, a kettle, a carton.
  const counterY = cabinet.userData.size?.y ?? 0.9;
  place(bottleA, IN_X - 0.2, 1.5, 0, counterY);
  place(bottleB, IN_X - 0.28, 1.6, 0.4, counterY);
  const kettle = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.2, 14).translate(0, 0.1, 0), mat('#8c8f92', { roughness: 0.35, metalness: 0.5 }));
  kettle.position.set(IN_X - 0.25, counterY, 2.0);
  kettle.castShadow = true;
  group.add(kettle);

  // ---- the TV: dark glass + live broadcast screen sitting just inside the bezel
  const tvScale = tv.userData.isFallback ? null : 0.5 / 0.27;
  // Native screen rect (x 0.035..0.383, y 0.027..0.236) sits just behind the bezel at z = 0; the
  // glowing plane goes a hair in front of the bezel so it can never be hidden by it.
  const screenZ = tv.userData.isFallback ? tv.userData.size.z / 2 + 0.004 : 0.135 * tvScale + 0.0035;
  const screenY = tv.userData.isFallback ? tv.userData.size.y * 0.55 : 0.1315 * tvScale;
  const screenW = tv.userData.isFallback ? tv.userData.size.x * 0.75 : 0.348 * tvScale;
  const screenH = tv.userData.isFallback ? tv.userData.size.y * 0.7 : 0.209 * tvScale;
  const darkGlass = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), mat('#1a1d22', { roughness: 0.25, metalness: 0.2 }));
  darkGlass.position.set(0.004 * (tvScale || 0), screenY, screenZ - 0.002);
  tv.add(darkGlass);
  const tvTex = canvasTexture(256, 192, () => {});
  tvTex.generateMipmaps = false;
  tvTex.minFilter = THREE.LinearFilter;
  const tvCtx = tvTex.image.getContext('2d');
  const screenMat = new THREE.MeshBasicMaterial({ map: tvTex, fog: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), screenMat);
  screen.position.set(darkGlass.position.x, screenY, screenZ);
  tv.add(screen);
  const ticker = `${L.ch1.tvTicker}     ·     ${L.ch1.tvTicker}     `;

  // ---- hand-made story props
  const watch = buildWatch();
  watch.group.position.set(-0.9, WIN.y0 + 0.021, BACK_Z + 0.02);
  group.add(watch.group);

  const phone = buildPhone();
  phone.group.position.set(1.0, 0.451, -0.92);
  phone.group.rotation.y = 0.35;
  group.add(phone.group);

  const xray = buildXray();
  const fridgeFront = fridge.userData.isFallback ? IN_X - 0.63 : IN_X - 0.315 - (0.025 + 0.1235) * (1.8 / 0.92);
  xray.position.set(fridgeFront - 0.008, 1.18, 0.78);
  xray.rotation.set(0, -Math.PI / 2, 0.035);
  group.add(xray);

  group.add(buildBibs());
  group.add(bikeHooks());
  const bike = hangingBike();
  group.add(bike);

  // Litter: takeaway on the table and the floor, a bin bag and pizza boxes by the door, the post.
  const TA = takeaway();
  group.add(
    TA.cartons([
      [0.2, -1.08, 0.3, 0.451],
      [0.42, -0.86, -0.5, 0.451],
      [1.58, 0.62, 0.9, 0],
    ]),
  );
  const bag = binBag(3);
  bag.position.set(2.68, 0, -2.12);
  group.add(bag);
  for (const [z, rz, x] of [
    [-1.55, -1.38, IN_X - 0.05],
    [-1.25, -1.32, IN_X - 0.07],
  ]) {
    const pz = TA.pizza();
    pz.position.set(x, 0.17, z);
    pz.rotation.set(0, 0, rz);
    group.add(pz);
  }
  const R = rng(12);
  const postGeos = [];
  for (let i = 0; i < 5; i++) {
    postGeos.push(
      new THREE.BoxGeometry(0.22, 0.003, 0.11)
        .rotateY((R() - 0.5) * 1.6)
        .translate(DOOR_X - 0.3 + R() * 0.55, 0.0016 + i * 0.0032, -2.25 + R() * 0.32),
    );
  }
  group.add(mergedMesh(postGeos, mat('#d8d4c8', { roughness: 0.9 }), { castShadow: false, name: 'post' }));
  const shoes = runningShoes();
  shoes.position.set(1.95, 0, -2.25);
  shoes.rotation.y = 0.2;
  group.add(shoes);
  // Crumpled paper near the bag.
  const paperGeos = [];
  for (let i = 0; i < 4; i++) {
    const r = 0.035 + R() * 0.015;
    paperGeos.push(
      new THREE.IcosahedronGeometry(r, 0)
        .rotateX(R() * 3)
        .rotateY(R() * 3)
        .translate(2.45 + R() * 0.35, r * 0.8, -1.8 + R() * 0.25),
    );
  }
  group.add(mergedMesh(paperGeos, mat('#cfcabe', { roughness: 1, flatShading: true }), { castShadow: false, name: 'paper' }));

  // ---- the failing fluorescent strip over the kitchenette
  const fluoro = buildFluoro();
  group.add(fluoro.group, fluoro.light);

  // ---- door: light spill on the floor, a warm hallway behind
  const door = doorway.getObjectByName('door');
  const spillMat = new THREE.MeshBasicMaterial({
    map: spillTexture(),
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.0).rotateX(-Math.PI / 2), spillMat);
  spill.position.set(DOOR_X, 0.006, BACK_Z + 0.5);
  spill.renderOrder = 2;
  group.add(spill);
  const hall = new THREE.Group();
  hall.visible = false;
  hall.add(
    new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.3).translate(0, 1.15, 0), new THREE.MeshBasicMaterial({ color: '#7a6448', fog: false })),
  );
  const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#5b4836' }));
  hallFloor.position.set(0, 0.001, 0.35);
  hall.add(hallFloor);
  hall.position.set(DOOR_X, 0, -D / 2 - T / 2 - 0.7);
  group.add(hall);

  // ---- lights (the Mood preset supplies the nicotine ambient and the moon through the window)
  const tvLight = pointLight(TV_COLOR, TV_INTENSITY, { pos: [TV_POS[0], 0.92, -1.58], distance: 8, decay: 2, shadow: true });
  tvLight.shadow.mapSize.set(1024, 1024);
  tvLight.shadow.camera.near = 0.15;
  tvLight.shadow.camera.far = 8;
  tvLight.shadow.autoUpdate = false; // furniture is static: render the cube map once (see update)
  tvLight.shadow.needsUpdate = true;
  const windowLight = pointLight(0x8ea6c8, 2.2, { pos: [-1.05, 1.75, -2.05], distance: 3.6 });
  const hallLight = pointLight(0xffc98a, 0, { pos: [DOOR_X, 1.7, -2.8], distance: 6 });
  group.add(tvLight, windowLight, hallLight);

  // ---- dust drifting through the light
  const DUST = 90;
  const dustBase = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dustBase[i * 3] = -1.7 + hash(i * 1.1) * 3.2;
    dustBase[i * 3 + 1] = 0.3 + hash(i * 2.3) * 2.1;
    dustBase[i * 3 + 2] = -2.3 + hash(i * 3.7) * 3.0;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustBase.slice(), 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ color: 0xc9d4e4, size: 0.016, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  dust.frustumCulled = false;
  group.add(dust);

  // ------------------------------------------------------------------ live state
  const tvState = { on: true, offT: 0, shot: 0, shotT: 0, nextCut: 4.5, level: 1, dip: 0, power: 1, redraw: 0 };
  const phoneState = { mode: 'idle', glow: 0.1 }; // idle | awake | read
  const doorState = { spill: 0.35, level: 0.18, open: 0, openTarget: 0 };
  // Fluorescent flicker: a stutter sequence of [on (0..1), seconds] every ~7 s.
  const FLICKER = [
    [0, 0.07],
    [1, 0.05],
    [0, 0.16],
    [0.55, 0.06],
    [0, 0.32],
    [1, 0.04],
    [0, 0.06],
  ];
  const fl = { next: 5.5, seq: null, i: 0, tt: 0, on: 1, prev: 1 };
  let knock = 0; // decays after each hammer blow from downstairs
  let t = 0;
  let frame = 0;
  let hugoWasVisible = true;
  const player = ctx.player;
  const audio = ctx.audio;

  function update(_dt, raw) {
    t += raw;
    // Bake the TV's furniture shadows once, on the first frame (still under the fade), without
    // Hugo in them: he moves, the cube map does not.
    if (frame === 0 && player?.root) {
      hugoWasVisible = player.root.visible;
      player.root.visible = false;
      tvLight.shadow.needsUpdate = true;
    } else if (frame === 1 && player?.root) {
      player.root.visible = hugoWasVisible;
    }
    frame++;

    // TV: broadcast shots cut every few seconds; light follows the picture, plus CRT flicker.
    if (tvState.on) {
      tvState.shotT += raw;
      if (t > tvState.nextCut) {
        tvState.shot = (tvState.shot + 1) % 3;
        tvState.shotT = 0;
        tvState.nextCut = t + 3.5 + Math.random() * 2.5;
        tvState.dip = 0.5; // the cut itself blinks
      }
      tvState.redraw -= raw;
      if (tvState.redraw <= 0) {
        tvState.redraw = 1 / 12;
        drawBroadcast(tvCtx, 256, 192, t, tvState.shot, tvState.shotT, ticker);
        tvTex.needsUpdate = true;
      }
      if (Math.random() < raw * 0.7) tvState.dip = Math.max(tvState.dip, 0.2 + Math.random() * 0.25);
    } else if (screen.visible) {
      // CRT switch-off: collapse to a bright line, then to nothing.
      tvState.offT += raw;
      const a = clamp(tvState.offT / 0.09, 0, 1);
      const b = clamp((tvState.offT - 0.09) / 0.22, 0, 1);
      screen.scale.set(Math.max(0.01, 1 - b), Math.max(0.02, 1 - a * 0.98), 1);
      tvState.power = (1 + 0.6 * a) * (1 - b);
      if (b >= 1) screen.visible = false;
    } else tvState.power = 0;
    tvState.level = damp(tvState.level, SHOT_LEVELS[tvState.shot], 14, raw);
    tvState.dip = Math.max(0, tvState.dip - raw * 5);
    const flick = 0.93 + 0.045 * Math.sin(t * 23.7) + 0.025 * Math.sin(t * 61.3 + 1.7);
    const k = tvState.level * flick * (1 - tvState.dip);
    const lightK = tvState.on ? k : tvState.power * (screen.scale.y > 0.5 ? 1 : 0.15);
    tvLight.intensity = TV_INTENSITY * lightK;
    screenMat.color.setScalar(1.3 * k * (tvState.on ? 1 : tvState.power) + 0.04);

    // Fluorescent: steady, then a stutter (with a buzz as it strikes back) every 6-9 s.
    if (!fl.seq && t > fl.next) {
      fl.seq = FLICKER;
      fl.i = 0;
      fl.tt = 0;
      audio?.noise?.({ type: 'bandpass', freq: 120, q: 9, dur: 0.75, volume: 0.05, tail: 0.1 });
    }
    if (fl.seq) {
      fl.tt += raw;
      while (fl.seq && fl.tt >= fl.seq[fl.i][1]) {
        fl.tt -= fl.seq[fl.i][1];
        fl.i++;
        if (fl.i >= fl.seq.length) {
          fl.seq = null;
          fl.next = t + 6 + Math.random() * 3;
        }
      }
      fl.on = fl.seq ? fl.seq[fl.i][0] : 1;
    } else fl.on = 1;
    if (fl.on > fl.prev + 0.4) audio?.tick?.({ volume: 0.05 });
    fl.prev = fl.on;
    knock = Math.max(0, knock - raw * 5);
    const fk = fl.on * (1 - 0.35 * knock);
    fluoro.light.intensity = FLUORO_INTENSITY * fk;
    fluoro.tubeMat.emissiveIntensity = 0.08 + 1.6 * fk;

    // Phone: lights up now and then (12 unread), bright while read, then dark.
    let pTarget = 0.06;
    if (phoneState.mode === 'idle') pTarget = t % 7 < 1.8 ? 0.9 : 0.06;
    else if (phoneState.mode === 'awake') pTarget = 1.2;
    else pTarget = 0;
    phoneState.glow = damp(phoneState.glow, pTarget, 6, raw);
    phone.screenMat.color.setScalar(0.02 + phoneState.glow);

    // Charger LED: slow green pulse while the watch sits on it.
    if (watch.watch.visible) watch.led.material.color.setRGB(0.2, 0.55 + 0.35 * Math.sin(t * 2), 0.25);
    else watch.led.material.color.setRGB(0.08, 0.1, 0.08);

    // Door: spill brightens when the door is the way out; the hallway pours in when opened.
    doorState.open = damp(doorState.open, doorState.openTarget, 3, raw);
    if (door) door.rotation.y = doorState.open * 1.25;
    hall.visible = doorState.open > 0.01;
    hallLight.intensity = 9 * doorState.open;
    doorState.level = damp(doorState.level, doorState.spill * 0.5 + doorState.open * 0.5, 2, raw);
    spillMat.opacity = doorState.level * (0.94 + 0.06 * Math.sin(t * 2.3));

    // Rain and dust (the dust jumps a little with every blow from downstairs).
    glassMat.uniforms.uTime.value = t;
    const p = dustGeo.attributes.position.array;
    for (let i = 0; i < DUST; i++) {
      const ph = i * 1.7;
      p[i * 3] = dustBase[i * 3] + 0.06 * Math.sin(t * 0.13 + ph);
      p[i * 3 + 1] = dustBase[i * 3 + 1] + 0.1 * Math.sin(t * 0.09 + ph * 1.3) + knock * 0.015 * Math.sin(ph * 5 + t * 40);
      p[i * 3 + 2] = dustBase[i * 3 + 2] + 0.05 * Math.cos(t * 0.11 + ph);
    }
    dustGeo.attributes.position.needsUpdate = true;
  }

  return {
    group,
    // Walkable rectangles (union) carved around the furniture.
    bounds: [
      { minX: -1.72, maxX: -0.56, minZ: -1.85, maxZ: 1.1 }, // between bed and TV/table/sofa
      { minX: -1.4, maxX: -0.56, minZ: -2.2, maxZ: -1.85 }, // under the window (past the lamp)
      { minX: -2.65, maxX: -0.56, minZ: -0.22, maxZ: 0.88 }, // foot of the bed, under the bike
      { minX: -1.72, maxX: 2.1, minZ: 1.0, maxZ: 2.3 }, // front strip behind the sofa
      { minX: 1.66, maxX: 2.65, minZ: -1.7, maxZ: 0.28 }, // right: phone side
      { minX: 1.78, maxX: 2.4, minZ: -2.2, maxZ: -1.7 }, // the doorway (plant left, bin bag right)
      { minX: 1.66, maxX: 2.1, minZ: 0.2, maxZ: 1.1 }, // in front of the fridge
    ],
    // Hotspot positions on the floor ([x, z]).
    spots: {
      tv: [0.55, 1.3],
      phone: [1.75, -0.95],
      watch: [-0.95, -1.9],
      xray: [1.95, 0.85],
      bike: [-2.4, 0.4],
      bibs: [-1.4, -1.3],
      door: [DOOR_X, -1.85],
    },
    // Where Hugo stands for each close-up ([x, z]), and what he looks at (Vector3).
    stand: {
      tv: [0.55, 1.45],
      phone: [1.8, -0.95],
      watch: [-0.95, -1.95],
      xray: [1.85, 0.62],
      bike: [-2.1, 0.0],
      bibs: [-1.35, -1.25],
      door: [DOOR_X, -1.78],
    },
    focus: {
      tv: new THREE.Vector3(TV_POS[0], 0.85, -1.92),
      phone: new THREE.Vector3(1.0, 0.46, -0.92),
      watch: new THREE.Vector3(-0.9, 1.0, BACK_Z + 0.02),
      xray: new THREE.Vector3(fridgeFront, 1.18, 0.78),
      bike: new THREE.Vector3(BIKE_POS[0], 1.45, BIKE_POS[2]),
      bibs: new THREE.Vector3(-IN_X, 1.45, -1.5),
      door: new THREE.Vector3(DOOR_X, 1.2, -D / 2),
    },
    // Close-up camera shots in world coordinates, composed for the stand points above.
    shots: {
      tv: { pos: [1.3, 1.65, 2.42], look: [0.5, 0.95, -2.0], fov: 40 },
      phone: { pos: [1.3, 1.75, 0.45], look: [1.02, 0.5, -0.95], fov: 40 },
      watch: { pos: [0.45, 1.6, -1.15], look: [-1.0, 1.05, -2.3], fov: 46 },
      xray: { pos: [1.15, 1.6, 1.55], look: [fridgeFront - 0.01, 1.14, 0.76], fov: 36 },
      bike: { pos: [-0.7, 1.55, 1.75], look: [BIKE_POS[0] - 0.04, 1.45, BIKE_POS[2] - 0.05], fov: 42 },
      bibs: { pos: [-0.6, 1.7, -0.25], look: [-2.75, 1.5, -1.6], fov: 46 },
      door: { pos: [DOOR_X - 0.95, 1.6, -0.35], look: [DOOR_X, 1.15, -2.5], fov: 46 },
    },
    update,
    dispose() {
      if (player?.root && frame === 1) player.root.visible = hugoWasVisible;
    },
    /** Switch the TV off: the picture collapses and the key light dies. */
    tvOff() {
      if (!tvState.on) return;
      tvState.on = false;
      tvState.offT = 0;
    },
    get tvIsOn() {
      return tvState.on;
    },
    /** Phone screen: 'idle' (wakes now and then), 'awake' (being read) or 'read' (dark). */
    phoneMode(mode) {
      phoneState.mode = mode;
    },
    /** Hugo takes the watch off its charger (the clip and cable stay). */
    takeWatch() {
      watch.watch.visible = false;
    },
    /** The door becomes the way out: its light spill brightens. */
    doorReady() {
      doorState.spill = 1;
    },
    openDoor() {
      doorState.openTarget = 1;
    },
    /** A blow from the workshop downstairs: dust jumps, the tube dips. */
    knock() {
      knock = 1;
    },
    tvLight,
    bike,
  };
}
