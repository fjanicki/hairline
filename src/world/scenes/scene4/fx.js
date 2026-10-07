import * as THREE from 'three';
import * as B from '../../build.js';

// Particles for the workshop, animated on the GPU (no per-frame buffer uploads):
//   dust  - motes hanging in the bulb's cone and the window shaft; each one is lit by how close it
//           sits to a beam's axis, and twinkles as it turns (a flake catching the light)
//   rain  - streaks falling past the gap under the garage door (Day 5), faded by a level 0..1

/**
 * beams: [{ apex: [x,y,z], dir: [x,y,z], length, radius, count, color }]
 * Particles fill each beam's cone (more toward the axis) plus a sparse room-wide haze.
 */
export function dustMotes(beams, { haze = 60, bounds = [-4.2, 4.2, 0.2, 2.9, -2.8, 2.6], seed = 3 } = {}) {
  const R = B.rng(seed);
  const pos = [];
  const att = []; // phase, size, light
  const col = [];
  const tmp = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3();
  for (const b of beams) {
    const apex = new THREE.Vector3(...b.apex);
    const dir = new THREE.Vector3(...b.dir).normalize();
    side.set(0, 1, 0).cross(dir);
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize();
    up.crossVectors(dir, side).normalize();
    const c = new THREE.Color(b.color);
    for (let i = 0; i < b.count; i++) {
      const along = 0.12 + Math.pow(R(), 0.8) * 0.88;
      const rmax = b.radius * along;
      const r = Math.pow(R(), 0.7) * rmax * 1.15;
      const a = R() * Math.PI * 2;
      tmp.copy(apex).addScaledVector(dir, along * b.length).addScaledVector(side, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r);
      if (tmp.y < 0.12) continue;
      pos.push(tmp.x, tmp.y, tmp.z);
      const lit = Math.pow(1 - Math.min(1, r / Math.max(1e-3, rmax)), 1.4) * (1 - 0.55 * along);
      att.push(R() * 100, 0.6 + R() * 1.1, 0.3 + lit * 1.6);
      col.push(c.r, c.g, c.b);
    }
  }
  const hc = new THREE.Color('#d8c8b0');
  for (let i = 0; i < haze; i++) {
    pos.push(bounds[0] + R() * (bounds[1] - bounds[0]), bounds[2] + R() * (bounds[3] - bounds[2]), bounds[4] + R() * (bounds[5] - bounds[4]));
    att.push(R() * 100, 0.5 + R() * 0.6, 0.08 + R() * 0.1);
    col.push(hc.r, hc.g, hc.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aAtt', new THREE.Float32BufferAttribute(att, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 800 }, uSize: { value: 0.0085 }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aAtt;
      attribute vec3 color;
      uniform float uTime, uScale, uSize;
      varying vec3 vCol;
      varying float vA;
      void main() {
        float ph = aAtt.x;
        vec3 p = position;
        // Slow brownian-ish drift and a lazy settle.
        p.x += 0.09 * sin(uTime * 0.11 + ph) + 0.03 * sin(uTime * 0.37 + ph * 2.1);
        p.y += 0.12 * sin(uTime * 0.07 + ph * 1.3) - 0.02 * sin(uTime * 0.05 + ph);
        p.z += 0.07 * cos(uTime * 0.09 + ph * 0.7);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = max(0.2, -mv.z);
        gl_PointSize = clamp(uSize * aAtt.y * uScale / d, 1.0, 5.0);
        // Flakes turning in the light.
        float tw = 0.55 + 0.45 * sin(uTime * (0.8 + fract(ph) * 1.6) + ph * 5.0);
        vA = aAtt.z * tw * smoothstep(0.6, 1.8, d);
        vCol = color;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vCol;
      varying float vA;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float r = dot(q, q) * 4.0;
        float a = max(0.0, 1.0 - r);
        a *= a * vA * uOpacity;
        gl_FragColor = vec4(vCol * a, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const points = new THREE.Points(geo, material);
  points.name = 'dust';
  points.frustumCulled = false;
  points.renderOrder = 4;
  return {
    object: points,
    material,
    update(t, renderer, camera) {
      material.uniforms.uTime.value = t;
      // World size -> pixels at 1 m: half the drawing-buffer height over tan(fov / 2).
      const h = renderer?.domElement?.height || 800;
      material.uniforms.uScale.value = (h * 0.5) / Math.tan(THREE.MathUtils.degToRad((camera?.fov || 55) * 0.5));
    },
  };
}

/** Rain streaks in a box (min, max), falling at `speed` m/s. level 0..1 fades them. */
export function rainBox(min, max, { count = 240, speed = 7, length = 0.28, color = '#b9c0c8', opacity = 0.5, seed = 5 } = {}) {
  const R = B.rng(seed);
  const seeds = [];
  const ends = [];
  for (let i = 0; i < count; i++) {
    const s = [R(), R(), R()];
    seeds.push(...s, ...s);
    ends.push(0, 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Array(count * 6).fill(0), 3));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 3));
  geo.setAttribute('aEnd', new THREE.Float32BufferAttribute(ends, 1));
  const size = new THREE.Vector3(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMin: { value: new THREE.Vector3(...min) },
      uSize: { value: size },
      uSpeed: { value: speed },
      uLen: { value: length },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aSeed;
      attribute float aEnd;
      uniform float uTime, uSpeed, uLen;
      uniform vec3 uMin, uSize;
      varying float vEnd;
      void main() {
        float h = uSize.y + uLen;
        float y = fract(aSeed.y - uTime * uSpeed * (0.85 + 0.3 * aSeed.z) / h) * h;
        vec3 p = uMin + vec3(aSeed.x * uSize.x, y + aEnd * uLen - uLen, aSeed.z * uSize.z);
        p.x += aEnd * 0.03; // a little wind from the street
        vEnd = aEnd;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vEnd;
      void main() {
        gl_FragColor = vec4(uColor * uOpacity * (0.25 + 0.75 * vEnd), 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const lines = new THREE.LineSegments(geo, material);
  lines.name = 'rain-outside';
  lines.frustumCulled = false;
  return {
    object: lines,
    material,
    set level(v) {
      material.uniforms.uOpacity.value = opacity * v;
      lines.visible = v > 0.01;
    },
    update(t) {
      material.uniforms.uTime.value = t;
    },
  };
}
