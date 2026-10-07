import * as THREE from 'three';

// Full-screen colour grade + grime pass. Runs in linear HDR before OutputPass (tone mapping + sRGB).
//   uSat      - saturation (driven by hope: 0 = grey, 1 = natural, >1 = oversaturated)
//   uTint     - multiplicative tint (cool -> gold with hope)
//   uContrast - contrast around mid-grey
//   uVignette - vignette strength; uVigColor is the colour the edges sink towards (black by default)
//   uPain     - red pain vignette (player.pain^2, or mood.painOverride)
//   uFlash    - white flash
//   uFocus[4] - up to 4 radial "colour returns here first" discs: (x, y) in UV, z radius, w strength.
//               The saturation boost is the max over the slots, so colour accumulates on what he made.
//   uLightSat - saturation kept in bright, lit areas even at low hope (the TV glow, sodium lamps)
//   uGrain    - animated film grain (multiplicative, stronger in shadows)
//   uDirt     - static lens dirt / smudges (2-octave value noise + 3 soft corner blotches)
//   uTime     - seconds (animates the grain)
// Safety: no textures, no pow() (log() only on max(col, 1e-6)), max(col, 0.) at the end (NaN/negatives would survive MSAA as black).
export const MoodShader = {
  name: 'MoodShader',
  uniforms: {
    tDiffuse: { value: null },
    uSat: { value: 0.05 },
    uLightSat: { value: 0 },
    uTint: { value: new THREE.Vector3(1, 1, 1) },
    uContrast: { value: 1 },
    uVignette: { value: 0.45 },
    uVigColor: { value: new THREE.Vector3(0, 0, 0) },
    uPain: { value: 0 },
    uFlash: { value: 0 },
    uFocus: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(-10, -10, 0.28, 0)) },
    uAspect: { value: 1 },
    uGrain: { value: 0 },
    uDirt: { value: 0 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSat, uLightSat, uContrast, uVignette, uPain, uFlash, uAspect, uGrain, uDirt, uTime;
    uniform vec3 uTint, uVigColor;
    uniform vec4 uFocus[4];
    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      float a = hash12(i + 17.0);
      float b = hash12(i + vec2(1.0, 0.0) + 17.0);
      float c = hash12(i + vec2(0.0, 1.0) + 17.0);
      float d = hash12(i + vec2(1.0, 1.0) + 17.0);
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }
    float blotch(vec2 uv, vec2 c, float r) {
      vec2 d = (uv - c) * vec2(uAspect, 1.0);
      return 1.0 - smoothstep(0.0, r, length(d));
    }

    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));

      // Colour focus: the max over the four slots.
      float m = 0.0;
      for (int i = 0; i < 4; i++) {
        vec4 F = uFocus[i];
        vec2 f = (vUv - F.xy) * vec2(uAspect, 1.0);
        float r = max(F.z, 0.02);
        m = max(m, F.w * (1.0 - smoothstep(r * 0.3, r, length(f))));
      }
      float s = mix(uSat, max(uSat, 1.1), clamp(m, 0.0, 1.0));   // colour returns around the focus first
      s = max(s, uLightSat * smoothstep(0.03, 0.35, l));          // light sources keep a little colour
      vec3 col = mix(vec3(l), c, s) * uTint;
      // Contrast around mid-grey. Above the pivot it is linear; below it a power curve (same value
      // and slope at the pivot) so shadows deepen without being clamped to flat digital black.
      vec3 cHi = (col - 0.18) * uContrast + 0.18;
      vec3 cLo = 0.18 * exp(uContrast * log(max(col, vec3(1e-6)) / 0.18));
      col = mix(cLo, cHi, step(vec3(0.18), col));

      // Vignette (towards uVigColor, keeping some of the luminance so it reads as stained, not black).
      vec2 dv = vUv - 0.5;
      float v = smoothstep(0.15, 0.6, dot(dv, dv) * 2.0);
      float lc = max(dot(col, vec3(0.2126, 0.7152, 0.0722)), 0.0);
      // uVigColor is used as a hue (normalised to unit luminance), so a near-black brown still stains.
      vec3 vt = uVigColor / max(dot(uVigColor, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
      col = mix(col, vt * lc * 0.25, clamp(uVignette * v, 0.0, 1.0));

      // Dirt: static smudges + corner blotches, slight brown cast.
      if (uDirt > 0.0) {
        vec2 q = vUv * vec2(uAspect, 1.0);
        float n = vnoise(q * 3.1) * 0.65 + vnoise(q * 9.7 + 4.3) * 0.35;
        float smudge = smoothstep(0.45, 0.85, n);
        smudge = max(smudge, 0.8 * blotch(vUv, vec2(0.04, 0.08), 0.42));
        smudge = max(smudge, 0.6 * blotch(vUv, vec2(0.97, 0.9), 0.36));
        smudge = max(smudge, 0.5 * blotch(vUv, vec2(0.88, 0.03), 0.3));
        col *= 1.0 - uDirt * 0.35 * smudge;
        col *= mix(vec3(1.0), vec3(1.0, 0.94, 0.84), uDirt * 0.5 * smudge);
      }

      // Pain + flash.
      col = mix(col, vec3(0.6, 0.0, 0.0), clamp(uPain, 0.0, 1.0) * v * 0.8);
      col = mix(col, vec3(1.0), clamp(uFlash, 0.0, 1.0));

      // Film grain: multiplicative in linear space, stronger in the shadows.
      if (uGrain > 0.0) {
        float h = hash12(gl_FragCoord.xy + uTime * 61.0);
        float lg = max(dot(col, vec3(0.2126, 0.7152, 0.0722)), 0.0);
        col *= 1.0 + uGrain * (h - 0.5) * 2.0 * (1.0 - 0.5 * smoothstep(0.0, 0.5, lg));
        // A small additive term so near-black areas still carry grain.
        col += uGrain * 0.012 * (h - 0.5) * (1.0 - smoothstep(0.0, 0.05, lg));
      }

      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};
