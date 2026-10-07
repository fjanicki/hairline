import * as THREE from 'three';
import { canvasTexture } from '../../build.js';
import { WIN, BACK_Z, boxAt, hash } from './common.js';

// The window: a painted sash with a deep sill, dirty glass with rain and the street beyond, and
// the sodium streetlight outside as a real light. A SpotLight far outside throws the window (frame,
// mullion and moving rain drops, through an animated light map) across the floorboards, and a
// ray-marched shaft makes the beam visible in the dusty air, with the same panes cut out of it.

export const SODIUM = 0xf0a45c;
// Direction the streetlight's light travels (down into the room, drifting toward +x).
export const SODIUM_DIR = new THREE.Vector3(0.24, -0.72, 1).normalize();
const PANE = {
  w: WIN.x1 - WIN.x0,
  h: WIN.y1 - WIN.y0,
  stile: 0.05,
  mull: [0.5, 0.022], // centre (m from x0), half width
  rail0: 0.07,
  rail1: 0.05,
  tran: [0.61, 0.655],
};

// ------------------------------------------------------------------ glass

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
        // Night over the town: a sodium-brown haze low down, black up high.
        vec3 col = mix(vec3(0.075, 0.05, 0.03), vec3(0.008, 0.01, 0.016), smoothstep(0.0, 0.75, uv.y));
        // The building opposite: a dark block with a few lit windows, out of focus.
        float bld = step(uv.y, 0.62 + 0.04 * step(0.55, uv.x));
        col = mix(col, vec3(0.02, 0.018, 0.016), bld * 0.85);
        for (int i = 0; i < 6; i++) {
          float fi = float(i);
          vec2 c = vec2(0.12 + 0.16 * fi + 0.05 * h1(fi * 3.7), 0.18 + 0.32 * h1(fi * 5.1));
          float d = length((uv - c) * vec2(1.0, 0.8));
          vec3 lc = mix(vec3(0.7, 0.45, 0.2), vec3(0.35, 0.42, 0.5), step(0.6, h1(fi * 2.3)));
          col += lc * 0.12 * fall(0.06, 0.0, d) * step(0.35, h1(fi * 9.1)) * bld;
        }
        // The streetlight itself, up and to the left: a hot sodium core with a wide halo.
        vec2 lp = vec2(0.14, 0.86);
        float ld = length((uv - lp) * vec2(1.0, 0.82));
        col += vec3(1.0, 0.6, 0.28) * (3.0 * fall(0.07, 0.0, ld) + 0.9 * fall(0.22, 0.0, ld) * fall(0.22, 0.0, ld) + 0.3 * fall(0.6, 0.0, ld));
        // Rain falling past the window, lit orange near the lamp.
        float x = uv.x * 64.0;
        float id = floor(x);
        float fx = fract(x) - 0.5;
        float sp = 1.1 + 1.3 * h1(id * 1.7);
        float y = fract(uv.y * 0.9 + uTime * sp * 0.55 + h1(id * 9.1));
        float streak = fall(0.16, 0.0, abs(fx)) * smoothstep(0.0, 0.04, y) * fall(0.22, 0.04, y);
        vec3 rc = mix(vec3(0.22, 0.26, 0.32), vec3(0.9, 0.6, 0.32), fall(0.6, 0.0, ld));
        col += rc * 0.5 * streak * step(0.4, h1(id * 3.3));
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
        col += mix(vec3(0.3, 0.36, 0.46), vec3(0.95, 0.62, 0.34), 0.5) * (drop * 0.45 + trail * 0.1);
        // Dirty glass: a brown film that gathers in the bottom corners and along the sill, and
        // condensation fogging the lower pane.
        float edge = min(min(uv.x, 1.0 - uv.x), uv.y * 0.7);
        float film = (1.0 - smoothstep(0.0, 0.22, edge)) * (0.55 + 0.45 * h2(floor(uv * 40.0)));
        col = mix(col, vec3(0.06, 0.05, 0.034), clamp(film * 0.7, 0.0, 1.0));
        col = mix(col, vec3(0.09, 0.085, 0.075), fall(0.3, 0.0, uv.y) * 0.45);
        gl_FragColor = vec4(max(col, vec3(0.0)) * uBright, 1.0);
      }`,
  });
}

// ------------------------------------------------------------------ the streetlight's rain map

/** An animated light map for the sodium spot: rain drops on the glass become moving dapples. */
function rainLightMap() {
  const S = 128;
  const tex = canvasTexture(S, S, () => {});
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  const g = tex.image.getContext('2d');
  const drops = [];
  for (let i = 0; i < 26; i++)
    drops.push({ x: hash(i * 3.1) * S, y: hash(i * 5.7) * S, v: 3 + hash(i * 1.3) * 9, r: 1.5 + hash(i * 7.7) * 2.5, pause: hash(i) * 3 });
  return {
    tex,
    draw(t, dt) {
      g.fillStyle = '#d8d8d8';
      g.fillRect(0, 0, S, S);
      // grime film at the edges of the glass (the centre of the map is the window)
      const gr = g.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S * 0.62);
      gr.addColorStop(0, 'rgba(255,255,255,0.25)');
      gr.addColorStop(1, 'rgba(60,50,40,0.55)');
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
      for (const d of drops) {
        if (d.pause > 0) d.pause -= dt;
        else d.y += d.v * dt;
        if (d.y > S + 6) {
          d.y = -4;
          d.x = Math.random() * S;
          d.pause = Math.random() * 2.5;
        }
        // trail, dark rim, bright refracted core
        g.fillStyle = 'rgba(120,120,120,0.35)';
        g.fillRect(d.x - 0.6, d.y - 10, 1.2, 10);
        g.fillStyle = 'rgba(70,70,70,0.7)';
        g.beginPath();
        g.arc(d.x, d.y, d.r + 0.8, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.95)';
        g.beginPath();
        g.arc(d.x - 0.3, d.y + 0.3, d.r * 0.55, 0, Math.PI * 2);
        g.fill();
      }
      tex.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------------------ the visible shaft

/**
 * A parallelepiped from the window opening along SODIUM_DIR; each fragment of its front faces
 * ray-marches the camera ray through it and adds light where the march sees through a pane
 * (the mullion, transom and rails cut out), fading with distance and at the floor.
 */
function shaftMesh(length) {
  const O = new THREE.Vector3(WIN.x0, WIN.y0, BACK_Z - 0.06);
  const ex = new THREE.Vector3(1, 0, 0);
  const ey = new THREE.Vector3(0, 1, 0);
  const d = SODIUM_DIR.clone();
  const M = new THREE.Matrix3().set(ex.x, ey.x, d.x, ex.y, ey.y, d.y, ex.z, ey.z, d.z);
  const inv = M.clone().invert();
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0.5);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const w = O.clone()
      .addScaledVector(ex, v.x * PANE.w)
      .addScaledVector(ey, v.y * PANE.h)
      .addScaledVector(d, v.z * length);
    p.setXYZ(i, w.x, w.y, w.z);
  }
  geo.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uO: { value: O },
      uInv: { value: inv },
      uSize: { value: new THREE.Vector3(PANE.w, PANE.h, length) },
      uColor: { value: new THREE.Color(SODIUM) },
      uI: { value: 0.3 },
      uTime: { value: 0 },
      uMull: { value: new THREE.Vector4(PANE.mull[0], PANE.mull[1], PANE.tran[0], PANE.tran[1]) },
      uRails: { value: new THREE.Vector3(PANE.stile, PANE.rail0, PANE.rail1) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uO, uSize, uColor, uRails;
      uniform mat3 uInv;
      uniform float uI, uTime;
      uniform vec4 uMull;
      varying vec3 vW;
      float band(float x, float a, float b, float s) { return smoothstep(a - s, a + s, x) * (1.0 - smoothstep(b - s, b + s, x)); }
      float pane(vec2 q) {
        float s = 0.012;
        float m = band(q.x, uRails.x, uSize.x - uRails.x, s) * band(q.y, uRails.y, uSize.y - uRails.z, s);
        m *= 1.0 - band(q.x, uMull.x - uMull.y, uMull.x + uMull.y, s);
        m *= 1.0 - band(q.y, uMull.z, uMull.w, s);
        return m;
      }
      void main() {
        vec3 ro = cameraPosition;
        vec3 rd = normalize(vW - ro);
        vec3 lo = uInv * (ro - uO);
        vec3 ld = uInv * rd;
        ld = mix(ld, vec3(1e-5), step(abs(ld), vec3(1e-5)));
        vec3 ta = (vec3(0.0) - lo) / ld;
        vec3 tb = (uSize - lo) / ld;
        vec3 tn = min(ta, tb);
        vec3 tf = max(ta, tb);
        float t0 = max(max(max(tn.x, tn.y), tn.z), 0.0);
        float t1 = min(min(tf.x, tf.y), tf.z);
        if (t1 <= t0) discard;
        float n = 18.0;
        float dt = (t1 - t0) / n;
        float j = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        float acc = 0.0;
        for (int i = 0; i < 18; i++) {
          float t = t0 + (float(i) + j) * dt;
          vec3 w = ro + rd * t;
          if (w.y < 0.0 || w.z > 2.5) break;
          vec3 q = lo + ld * t;
          float along = q.z / uSize.z;
          float dens = smoothstep(0.0, 0.03, along) * pow(1.0 - clamp(along, 0.0, 1.0), 1.6);
          // slow drifting murk so the beam is not a clean CG wedge
          float murk = 0.75 + 0.25 * sin(w.x * 3.1 + uTime * 0.21) * sin(w.y * 2.3 - uTime * 0.17 + w.z * 1.7);
          acc += pane(q.xy) * dens * murk * dt;
        }
        // Fade where the floor or the far end is near, so the slab edges never show.
        vec3 c = uColor * acc * uI;
        gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.name = 'window-shaft';
  m.renderOrder = 3;
  m.frustumCulled = false;
  m.userData.noOcclude = true;
  return m;
}

// ------------------------------------------------------------------ builder

/**
 * Builds the window into `batch` (frame pieces in `trim`) and returns its live parts.
 * mats: { trim, fabric, metal }
 */
export function buildWindow(group, batch, mats) {
  const { trim } = mats;
  const Z = BACK_Z;
  const parts = [
    // deep sill with a rounded nose (two boxes), and the apron under it
    boxAt(WIN.x0 - 0.12, WIN.x1 + 0.12, WIN.y0 - 0.035, WIN.y0 + 0.012, Z - 0.2, Z + 0.1),
    boxAt(WIN.x0 - 0.1, WIN.x1 + 0.1, WIN.y0 - 0.11, WIN.y0 - 0.035, Z, Z + 0.025),
    // architrave round the opening on the room side
    boxAt(WIN.x0 - 0.08, WIN.x0, WIN.y0 + 0.012, WIN.y1 + 0.08, Z, Z + 0.025),
    boxAt(WIN.x1, WIN.x1 + 0.08, WIN.y0 + 0.012, WIN.y1 + 0.08, Z, Z + 0.025),
    boxAt(WIN.x0 - 0.08, WIN.x1 + 0.08, WIN.y1, WIN.y1 + 0.08, Z, Z + 0.025),
    // sash: stiles, rails, the mullion and the transom
    boxAt(WIN.x0, WIN.x0 + PANE.stile, WIN.y0 + 0.012, WIN.y1, -2.54, -2.47),
    boxAt(WIN.x1 - PANE.stile, WIN.x1, WIN.y0 + 0.012, WIN.y1, -2.54, -2.47),
    boxAt(WIN.x0 + PANE.stile, WIN.x1 - PANE.stile, WIN.y1 - PANE.rail1, WIN.y1, -2.54, -2.47),
    boxAt(WIN.x0 + PANE.stile, WIN.x1 - PANE.stile, WIN.y0 + 0.012, WIN.y0 + PANE.rail0, -2.54, -2.47),
    boxAt(WIN.x0 + PANE.mull[0] - PANE.mull[1], WIN.x0 + PANE.mull[0] + PANE.mull[1], WIN.y0 + PANE.rail0, WIN.y1 - PANE.rail1, -2.535, -2.475),
    boxAt(WIN.x0 + PANE.stile, WIN.x1 - PANE.stile, WIN.y0 + PANE.tran[0], WIN.y0 + PANE.tran[1], -2.535, -2.48),
  ];
  for (const p of parts) if (p) batch.add(trim, p);
  batch.add(mats.steel, boxAt(-1.09, -1.01, WIN.y0 + PANE.tran[1], WIN.y0 + PANE.tran[1] + 0.02, -2.48, -2.455), { castShadow: false });

  // Curtain: a sagging rod, one heavy curtain bunched at the right edge of the glass.
  batch.add(mats.steel, new THREE.CylinderGeometry(0.011, 0.011, 1.5, 8).rotateZ(Math.PI / 2).translate((WIN.x0 + WIN.x1) / 2 + 0.05, WIN.y1 + 0.16, Z + 0.07));
  for (const x of [WIN.x0 - 0.15, WIN.x1 + 0.25])
    batch.add(mats.steel, boxAt(x - 0.015, x + 0.015, WIN.y1 + 0.13, WIN.y1 + 0.19, Z, Z + 0.08), { castShadow: false });
  const cw = 0.42;
  const ch = WIN.y1 + 0.14;
  const cg = new THREE.PlaneGeometry(cw, ch, 22, 12);
  const cp = cg.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i);
    const y = cp.getY(i) + ch / 2; // 0 at the floor .. ch at the rod
    const u = x / cw + 0.5;
    const pleat = Math.sin(u * Math.PI * 9) * 0.035 * (0.6 + 0.4 * (y / ch));
    // bunched toward the wall at the bottom (tied back), hanging free at the top
    const tie = Math.max(0, 1 - Math.abs(y - 0.9) / 0.9);
    cp.setXYZ(i, x * (1 - 0.45 * tie) + 0.08 * tie, y, pleat + 0.02 * Math.sin(y * 3));
  }
  cg.computeVertexNormals();
  cg.translate(WIN.x1 + 0.08, 0, Z + 0.075);
  const curtain = new THREE.Mesh(cg, mats.fabric);
  curtain.castShadow = true;
  curtain.receiveShadow = true;
  curtain.name = 'curtain';
  group.add(curtain);

  // Dirty glass with the street and the rain.
  const glassMat = rainGlassMaterial();
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(PANE.w, PANE.h), glassMat);
  glass.position.set((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, -2.505);
  glass.name = 'window-glass';
  group.add(glass);

  // The streetlight: far away up and to the left, so its beam is near-parallel.
  const centre = new THREE.Vector3((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, BACK_Z);
  const spot = new THREE.SpotLight(SODIUM, 9, 0, 0.2, 0.35, 0);
  spot.name = 'sodium';
  spot.position.copy(centre).addScaledVector(SODIUM_DIR, -8);
  spot.target.position.copy(centre).addScaledVector(SODIUM_DIR, 3);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.camera.near = 5;
  spot.shadow.camera.far = 15;
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.02;
  spot.shadow.radius = 1.5;
  spot.userData.noCone = true;
  const rain = rainLightMap();
  spot.map = rain.tex;
  group.add(spot, spot.target);

  const shaft = shaftMesh(4.6);
  group.add(shaft);

  // The sill: a tin catching drips (the ceiling corner leaks), a dead fly, flaking paint chips.
  return {
    glassMat,
    spot,
    shaft,
    curtain,
    update(t, dt, level = 1) {
      glassMat.uniforms.uTime.value = t;
      shaft.material.uniforms.uTime.value = t;
      shaft.material.uniforms.uI.value = 0.3 * level;
      spot.intensity = 9 * level;
      rain.draw(t, dt);
    },
  };
}
