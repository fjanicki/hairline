import * as THREE from 'three';

// Rain details for the evening street: splash rings on the ground around the camera, a stream
// pouring through the gap in No. 14's gutter, and the kebab shop's extractor steam. Each is one
// draw call; update(dt, camera) drives them and `opacity` fades them with the rain.

/** Ring splashes on the ground in a box that wraps around the camera (like build.rain). */
export function splashes({ count = 420, box = [12, 26], y = 0.03, color = '#c9d0d8' } = {}) {
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos.set([Math.random() * box[0], y, Math.random() * box[1]], i * 3);
    phase[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uBox: { value: new THREE.Vector2(box[0], box[1]) },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0.5 },
      uScale: { value: 400 },
      uMinZ: { value: -45.2 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime, uScale, uMinZ; uniform vec3 uCam; uniform vec2 uBox;
      attribute float aPhase; varying float vT; varying float vA;
      void main() {
        float rate = 1.6 + aPhase * 1.4;
        float cyc = uTime * rate + aPhase * 17.0;
        vT = fract(cyc);
        vec3 p = position;
        // Re-seed the spot every cycle so the rings don't repeat in place.
        float k = floor(cyc);
        p.x += fract(sin(k * 12.9898 + aPhase * 78.233) * 43758.5453) * uBox.x;
        p.z += fract(sin(k * 39.346 + aPhase * 11.135) * 24634.6345) * uBox.y;
        vec3 w = vec3(uCam.x + mod(p.x - uCam.x, uBox.x) - 0.5 * uBox.x, p.y, uCam.z - 4.0 + mod(p.z - uCam.z, uBox.y) - 0.5 * uBox.y);
        vec4 mv = viewMatrix * vec4(w, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        gl_PointSize = uScale * (0.05 + 0.12 * vT) / max(d, 0.5);
        vA = (1.0 - smoothstep(9.0, 18.0, d)) * smoothstep(0.8, 2.0, d) * step(uMinZ, w.z) * step(abs(w.x), 5.9);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; varying float vT; varying float vA;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        q.y *= 2.6; // flattened: rings lie on the ground
        float r = length(q) * 2.0;
        float ring = smoothstep(0.62, 0.8, r) * (1.0 - smoothstep(0.85, 1.0, r));
        float dot0 = (1.0 - smoothstep(0.0, 0.25, r)) * (1.0 - smoothstep(0.0, 0.25, vT)) * 1.5;
        float a = (ring + dot0) * (1.0 - vT) * vA * uOpacity;
        if (a < 0.003) discard;
        gl_FragColor = vec4(uColor, a);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 2;
  points.name = 'rain-splashes';
  const u = material.uniforms;
  return {
    object: points,
    update(dt, camera) {
      u.uTime.value += dt;
      if (camera) u.uCam.value.copy(camera.position);
      points.visible = u.uOpacity.value > 0.005;
    },
    set opacity(v) {
      u.uOpacity.value = Math.max(0, v);
    },
    get opacity() {
      return u.uOpacity.value;
    },
  };
}

/** A thin stream of water from (x, y, z) to the ground, with streaks running down it. */
export function stream({ pos, length, radius = 0.016, color = '#cfd6dc' }) {
  const geo = new THREE.CylinderGeometry(radius * 0.8, radius * 1.4, length, 8, 8, true).translate(0, -length / 2, 0);
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.55 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpacity; uniform vec3 uColor; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        float s = fract(vUv.y * 9.0 + uTime * 5.5 + sin(vUv.x * 18.0) * 0.15);
        float streak = 0.45 + 0.55 * smoothstep(0.55, 0.95, s);
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
        float a = uOpacity * streak * (0.35 + 0.65 * rim) * smoothstep(0.0, 0.08, vUv.y);
        gl_FragColor = vec4(uColor * (0.8 + 0.6 * rim), a);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.renderOrder = 2;
  mesh.castShadow = false;
  mesh.userData.noOcclude = true;
  mesh.name = 'gutter-stream';
  return {
    object: mesh,
    update(dt) {
      material.uniforms.uTime.value += dt;
    },
    set opacity(v) {
      material.uniforms.uOpacity.value = v;
      mesh.visible = v > 0.005;
    },
  };
}

/** Steam puffs rising from a vent (soft sprites, one draw). */
export function steam({ pos, count = 22, map, color = '#c8ccd0', opacity = 0.16, rise = 0.5, spread = 0.5 }) {
  const P = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    P.set(pos, i * 3);
    phase[i] = i / count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uMap: { value: map }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uRise: { value: rise }, uSpread: { value: spread } },
    vertexShader: /* glsl */ `
      uniform float uTime, uRise, uSpread; attribute float aPhase; varying float vT;
      void main() {
        float t = fract(uTime * 0.16 + aPhase);
        vT = t;
        vec3 p = position;
        p.y += t * 2.2 * uRise * 2.0;
        p.x += sin(aPhase * 40.0 + uTime * 0.7) * uSpread * t;
        p.z += cos(aPhase * 23.0 + uTime * 0.5) * uSpread * t;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (90.0 + 420.0 * t) / max(-mv.z, 0.5);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity; varying float vT;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a * uOpacity * smoothstep(0.0, 0.15, vT) * (1.0 - vT);
        if (a < 0.002) discard;
        gl_FragColor = vec4(uColor, a);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 3;
  points.name = 'steam';
  return {
    object: points,
    update(dt) {
      material.uniforms.uTime.value += dt;
    },
  };
}
