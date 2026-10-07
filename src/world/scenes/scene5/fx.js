import * as THREE from 'three';
import { radialTexture, rngOf } from './util.js';

// Dust and pollen hanging in the low sun: one Points draw that wraps around the camera's look
// target, drifts and twinkles. Its strength follows the light (stronger at golden hour).

export function makeMotes({ count = 520, size = [16, 7, 16], color = '#ffd9a0' } = {}) {
  const R = rngOf(4242);
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (R() - 0.5) * size[0];
    pos[i * 3 + 1] = R() * size[1];
    pos[i * 3 + 2] = (R() - 0.5) * size[2];
    seed[i] = R();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const uniforms = {
    uTime: { value: 0 },
    uCentre: { value: new THREE.Vector3() },
    uBox: { value: new THREE.Vector3(...size) },
    uColor: { value: new THREE.Color(color) },
    uOpacity: { value: 0.5 },
    uSize: { value: 0.045 },
    uMap: { value: radialTexture(64, 0.0) },
    uScale: { value: 400 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uTime, uSize, uScale;
      uniform vec3 uCentre, uBox;
      varying float vA;
      void main() {
        vec3 p = position;
        float t = uTime * (0.05 + 0.08 * seed);
        p += vec3(sin(t * 3.1 + seed * 40.0) * 0.6 + uTime * 0.12, sin(t * 2.3 + seed * 17.0) * 0.4 - uTime * 0.02, cos(t * 2.7 + seed * 23.0) * 0.6);
        // wrap into the box around the centre
        vec3 rel = p - uCentre;
        rel.xz = mod(rel.xz + uBox.xz * 0.5, uBox.xz) - uBox.xz * 0.5;
        rel.y = mod(rel.y, uBox.y);
        vec3 w = vec3(uCentre.x, 0.0, uCentre.z) + rel;
        vec4 mv = modelViewMatrix * vec4(w, 1.0);
        gl_Position = projectionMatrix * mv;
        float depth = max(0.2, -mv.z);
        gl_PointSize = clamp(uSize * (0.6 + seed) * uScale / depth, 0.0, 7.0);
        // fade at the box edges, very near the lens and with distance; twinkle
        vec2 e = abs(rel.xz) / (uBox.xz * 0.5);
        float edge = 1.0 - smoothstep(0.7, 1.0, max(e.x, e.y));
        float tw = 0.55 + 0.45 * sin(uTime * (1.0 + seed * 2.0) + seed * 30.0);
        vA = edge * tw * smoothstep(0.4, 1.4, depth) * (1.0 - smoothstep(9.0, 14.0, depth));
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vA;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a * vA * uOpacity;
        if (a < 0.004) discard;
        gl_FragColor = vec4(uColor * a * 2.2, a);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  points.name = 'ch5-motes';
  return {
    object: points,
    uniforms,
    set opacity(v) {
      uniforms.uOpacity.value = v;
    },
    get opacity() {
      return uniforms.uOpacity.value;
    },
    update(raw, centre, renderer) {
      uniforms.uTime.value += raw;
      if (centre) uniforms.uCentre.value.copy(centre);
      if (renderer) uniforms.uScale.value = renderer.domElement.height * 0.5;
    },
  };
}
