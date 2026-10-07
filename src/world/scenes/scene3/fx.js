import * as THREE from 'three';
import { cloudTexture } from './textures.js';

// Ch3 shader materials and atmosphere: facade windows sampling an atlas, the far skyline with
// procedural windows, instanced light shafts under the lamps, the cloud band, rain splashes.

const LAMP_COLD = new THREE.Color('#dfe8ff');

/** Instanced window quads sampling a 4 x 2 atlas; aWin = (variant, row, lit). uLit scales the glow. */
export function windowMaterial(atlas) {
  const uLit = { value: 1 };
  const m = new THREE.MeshStandardMaterial({ map: atlas, emissiveMap: atlas, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.42, metalness: 0, envMapIntensity: 0.22 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uLit = uLit;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aWin;\nvarying float vWinLit;')
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        vec2 wuv = vec2((uv.x + aWin.x) * 0.25, (uv.y + aWin.y) * 0.5);
        #ifdef USE_MAP
          vMapUv = wuv;
        #endif
        #ifdef USE_EMISSIVEMAP
          vEmissiveMapUv = wuv;
        #endif
        vWinLit = aWin.z;`,
      );
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWinLit;\nuniform float uLit;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vWinLit * uLit;');
  };
  m.customProgramCacheKey = () => 'ch3-windows';
  m.userData.uLit = uLit;
  return m;
}

/**
 * Far skyline blocks: flat fogged masses with a procedural window grid (lit at random) on their
 * vertical faces, so the city reads at 60-200 m for one draw. uLit scales the lit windows.
 */
export function skylineMaterial() {
  const uLit = { value: 1 };
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uLit = uLit;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSkW;\nvarying vec3 vSkN;').replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      {
        vec4 skp = vec4(transformed, 1.0);
        vec3 skn = objectNormal;
        #ifdef USE_INSTANCING
          skp = instanceMatrix * skp;
          skn = mat3(instanceMatrix) * skn;
        #endif
        vSkW = (modelMatrix * skp).xyz;
        vSkN = normalize(mat3(modelMatrix) * skn);
      }`,
    );
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSkW;\nvarying vec3 vSkN;\nuniform float uLit;\nfloat skHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float skWin = 0.0;
        float skLit = 0.0;
        if (abs(vSkN.y) < 0.5) {
          float along = abs(vSkN.x) > 0.5 ? vSkW.z : vSkW.x;
          vec2 g = vec2(along / 2.6, vSkW.y / 3.2);
          vec2 f = fract(g);
          vec2 id = floor(g);
          skWin = step(0.22, f.x) * step(f.x, 0.78) * step(0.3, f.y) * step(f.y, 0.82) * step(1.0, id.y);
          float h = skHash(id + floor(vSkW.xz / 40.0));
          skLit = skWin * step(h, 0.07) * (0.5 + h * 7.0);
          // Read as facades through the haze, not grey boxes: a tone per building, floor slabs, deep
          // window reveals, and some panes that catch the pale sky instead.
          float bld = skHash(floor(vSkW.xz / 14.0) + 3.1);
          diffuseColor.rgb *= 0.82 + 0.3 * bld;
          diffuseColor.rgb *= 1.0 - 0.22 * (1.0 - step(0.1, f.y)) * step(1.0, id.y);
          float sky = step(0.72, skHash(id * 1.7 + 5.3));
          diffuseColor.rgb *= mix(1.0, mix(0.34, 1.35, sky), skWin);
        }
        // Parapet line and a darker roof edge at the top of each mass (the cornice reads at range).
        if (vSkN.y > 0.5) diffuseColor.rgb *= 0.7;`,
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.72, 0.42) * skLit * uLit * 0.9;')
      // The far masses keep a fifth of their facade through the scene fog (atmospheric perspective,
      // not a white-out), so the window grids read as a city rather than as grey boxes.
      .replace(
        '#include <fog_fragment>',
        `#ifdef USE_FOG
        #ifdef FOG_EXP2
          float skFog = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
        #else
          float skFog = smoothstep( fogNear, fogFar, vFogDepth );
        #endif
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, skFog * 0.8 );
        #endif`,
      );
  };
  m.customProgramCacheKey = () => 'ch3-skyline';
  m.userData.uLit = uLit;
  return m;
}

/** Instanced soft light shafts under the lamp heads (the build.lightCone look, one draw). */
export function coneField(heads, { color = LAMP_COLD, length = 7, radius = 2.6 } = {}) {
  const geo = new THREE.CylinderGeometry(0.06, radius, length, 24, 1, true).translate(0, -length / 2, 0);
  const op = new THREE.InstancedBufferAttribute(new Float32Array(heads.length).fill(1), 1);
  geo.setAttribute('aOp', op);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0.2 },
      uLen: { value: length },
      fogColor: { value: new THREE.Color() },
      fogDensity: { value: 0 },
      fogNear: { value: 1 },
      fogFar: { value: 1000 },
    },
    vertexShader: /* glsl */ `
      uniform float uLen;
      attribute float aOp;
      varying float vAlong, vOp, vFogDepth;
      varying vec3 vN, vV;
      void main() {
        vAlong = clamp(-position.y / uLen, 0.0, 1.0);
        vOp = aOp;
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        vV = normalize(-mv.xyz);
        vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor, fogColor;
      uniform float uOpacity, fogDensity;
      varying float vAlong, vOp, vFogDepth;
      varying vec3 vN, vV;
      void main() {
        float rim = pow(abs(dot(normalize(vN), normalize(vV))), 1.3);
        float foot = (1.0 - vAlong) * (1.0 - vAlong);
        float top = smoothstep(0.0, 0.06, vAlong);
        float near = smoothstep(0.8, 3.0, vFogDepth);
        float fog = exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
        float a = uOpacity * vOp * rim * foot * top * near * mix(0.3, 1.0, fog);
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: true,
  });
  const mesh = new THREE.InstancedMesh(geo, material, heads.length);
  const d = new THREE.Object3D();
  heads.forEach((h, i) => {
    d.position.copy(h);
    d.updateMatrix();
    mesh.setMatrixAt(i, d.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.boundingSphere.radius += length;
  mesh.renderOrder = 3;
  mesh.name = 'lamp-cones';
  mesh.userData.noOcclude = true;
  return { mesh, op, uniforms: material.uniforms };
}

/**
 * A cloud band on the far plane (like the shared Sky gradient, which it sits over): soft streaks
 * from the horizon to ~40 deg, lit on the side facing the sun. uniforms: uColor (shadow side),
 * uLit (lit side), uOpacity, uDrift (u offset, slow wind), uSun (direction).
 */
export function cloudDome(rnd) {
  const uniforms = {
    uMap: { value: cloudTexture(rnd) },
    uColor: { value: new THREE.Color('#5d7593') },
    uLit: { value: new THREE.Color('#c9d6e8') },
    uOpacity: { value: 0.7 },
    uDrift: { value: 0 },
    uSun: { value: new THREE.Vector3(0.12, 0.12, -1).normalize() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // at the far plane, behind everything
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uColor, uLit, uSun;
      uniform float uOpacity, uDrift;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float el = asin(clamp(d.y, -1.0, 1.0));
        float az = atan(d.x, -d.z);
        vec2 uv = vec2(az / 6.2831853 + 0.5 + uDrift, 1.0 - el / 0.72);
        vec4 c = texture2D(uMap, uv);
        float a = c.a * uOpacity * smoothstep(0.0, 0.07, el) * (1.0 - smoothstep(0.55, 0.72, el));
        float sun = pow(max(dot(d, normalize(uSun)), 0.0), 6.0);
        vec3 col = mix(uColor, uLit, clamp(c.r * 0.75 + sun * 0.8, 0.0, 1.0));
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.name = 'clouds';
  mesh.userData.noOcclude = true;
  return { mesh, uniforms };
}

/** Rain hitting the ground around the camera: expanding rings on the road and pavements (one draw). */
export function rainSplashes(count = 520, radius = 16) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 2 * radius;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 2 * radius;
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const uniforms = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uOpacity: { value: 0.3 }, uR: { value: radius }, uPx: { value: 400 } };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime, uR, uPx; uniform vec3 uCam;
      attribute float aSeed;
      varying float vA, vT;
      void main() {
        float cyc = 0.55 + aSeed * 0.5;
        float t = uTime / cyc + aSeed * 13.0;
        float k = floor(t);
        vT = fract(t);
        // Re-seat every cycle so splashes never repeat in place.
        vec2 jitter = vec2(fract(sin(k * 12.9 + aSeed * 78.2) * 4375.5), fract(sin(k * 39.3 + aSeed * 11.1) * 9837.1)) - 0.5;
        vec2 p = position.xz + jitter * 3.0;
        vec2 w = uCam.xz + mod(p - uCam.xz + uR, 2.0 * uR) - uR;
        float y = abs(w.x) > 7.2 ? 0.155 : 0.012;
        vec4 mv = viewMatrix * vec4(w.x, y, w.y, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        gl_PointSize = uPx * (0.05 + 0.14 * vT) / max(d, 0.5);
        vA = (1.0 - smoothstep(6.0, uR, d)) * smoothstep(0.6, 1.6, d);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; varying float vA, vT;
      void main() {
        vec2 c = gl_PointCoord * 2.0 - 1.0;
        c.y *= 2.6; // flattened onto the ground
        float r = length(c);
        float ring = smoothstep(0.62, 0.85, r) * (1.0 - smoothstep(0.85, 1.0, r));
        float a = ring * (1.0 - vT) * vA * uOpacity;
        if (a < 0.003) discard;
        gl_FragColor = vec4(vec3(0.82, 0.86, 0.92) * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, material);
  pts.frustumCulled = false;
  pts.renderOrder = 2;
  pts.name = 'rain-splashes';
  return { object: pts, uniforms };
}
