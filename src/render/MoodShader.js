import * as THREE from 'three';

// Full-screen composite + colour grade + grime pass. Runs in linear HDR before OutputPass (tone mapping
// + sRGB). Post.js feeds it the resolved scene colour, its depth, the GTAO map and the bloom chain.
//
// Composite (Post owns these; 0 / null = off):
//   tAO, uAO        - ambient occlusion (GTAO, half res) multiplied in, faded by distance fog and kept
//                     off bright pixels (lamps, emissives)
//   tDepth          - scene depth, for the AO fog fade and the height fog
//   uHFog           - height fog: density at uHFogY, falling off by uHFogFalloff per metre above it;
//                     integrated along the view ray (sky included), coloured uHFogColor
//   tBloom, uBloom  - bloom chain (soft-thresholded, so only practicals and emissives feed it), added
//   uCA             - chromatic aberration at the frame edges (0..1)
// Grade (Mood owns these):
//   uSat      - saturation (driven by hope: 0 = grey, 1 = natural, >1 = oversaturated)
//   uTint     - multiplicative tint (cool -> gold with hope)
//   uLift, uGamma, uGain - per-channel lift (added in the shadows), gamma (around mid-grey), gain
//   uSplitShadow, uSplitHigh, uSplit - split tone: shadow / highlight hues (unit luminance), amount
//   uContrast - contrast around mid-grey
//   uShoulder - soft highlight roll-off before ACES (0 = off): hot lamps keep a gradient
//   uVignette - vignette strength; uVigColor is the colour the edges sink towards (black by default)
//   uPain     - red pain vignette (player.pain^2, or mood.painOverride)
//   uFlash    - white flash
//   uFocus[4] - up to 4 radial "colour returns here first" discs: (x, y) in UV, z radius, w strength.
//               The saturation boost is the max over the slots, so colour accumulates on what he made.
//   uLightSat - saturation kept in bright, lit areas even at low hope (the TV glow, sodium lamps)
//   uGrain    - animated film grain (multiplicative, stronger in shadows)
//   uDirt     - static lens dirt / smudges (2-octave value noise + 3 soft corner blotches)
//   uTime     - seconds (animates the grain)
// Safety: the input is sanitised first (NaN / Inf / negatives -> 0, then clamped to 64: a NaN from
// any material survives the MSAA resolve), no pow() of a possibly negative value (log() only on
// max(x, 1e-6)), and max(col, 0.) at the end.
export const MoodShader = {
  name: 'MoodShader',
  uniforms: {
    tDiffuse: { value: null },
    tAO: { value: null },
    tDepth: { value: null },
    tBloom: { value: null },
    uAO: { value: 0 },
    uBloom: { value: 0 },
    uCA: { value: 0 },
    uHasDepth: { value: 0 },
    uProjInv: { value: new THREE.Matrix4() },
    uCamWorld: { value: new THREE.Matrix4() },
    uFogDensity: { value: 0 },
    uHFog: { value: 0 },
    uHFogY: { value: 0 },
    uHFogFalloff: { value: 0.5 },
    uHFogColor: { value: new THREE.Vector3(0.3, 0.3, 0.3) },
    uSat: { value: 0.05 },
    uLightSat: { value: 0 },
    uTint: { value: new THREE.Vector3(1, 1, 1) },
    uLift: { value: new THREE.Vector3(0, 0, 0) },
    uGamma: { value: new THREE.Vector3(1, 1, 1) },
    uGain: { value: new THREE.Vector3(1, 1, 1) },
    uSplitShadow: { value: new THREE.Vector3(1, 1, 1) },
    uSplitHigh: { value: new THREE.Vector3(1, 1, 1) },
    uSplit: { value: 0 },
    uShoulder: { value: 0 },
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
    uniform sampler2D tDiffuse, tAO, tDepth, tBloom;
    uniform float uAO, uBloom, uCA, uHasDepth, uFogDensity, uHFog, uHFogY, uHFogFalloff;
    uniform mat4 uProjInv, uCamWorld;
    uniform vec3 uHFogColor;
    uniform float uSat, uLightSat, uContrast, uVignette, uPain, uFlash, uAspect, uGrain, uDirt, uTime, uSplit, uShoulder;
    uniform vec3 uTint, uVigColor, uLift, uGamma, uGain, uSplitShadow, uSplitHigh;
    uniform vec4 uFocus[4];
    varying vec2 vUv;

    const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

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
    // NaN / Inf / negative -> 0, then a ceiling so one hot texel can't smear across the bloom chain.
    vec3 sane(vec3 c) {
      c = vec3(c.r == c.r ? c.r : 0.0, c.g == c.g ? c.g : 0.0, c.b == c.b ? c.b : 0.0);
      return clamp(c, 0.0, 64.0);
    }

    void main() {
      // Scene colour, with optional chromatic aberration growing towards the frame edges.
      vec3 c;
      vec2 dv = vUv - 0.5;
      if (uCA > 0.0) {
        vec2 off = dv * dot(dv, dv) * uCA * 0.022;
        c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      } else {
        c = texture2D(tDiffuse, vUv).rgb;
      }
      c = sane(c);

      // View ray and distance from the depth buffer (AO fog fade + height fog).
      float dist = 0.0;
      vec3 rayW = vec3(0.0, 0.0, -1.0);
      bool sky = true;
      if (uHasDepth > 0.5) {
        float d = texture2D(tDepth, vUv).x;
        sky = d >= 0.99999;
        vec4 vp = uProjInv * vec4(vUv * 2.0 - 1.0, (sky ? 0.5 : d) * 2.0 - 1.0, 1.0);
        vec3 v = vp.xyz / max(abs(vp.w), 1e-6) * sign(vp.w);
        rayW = normalize(mat3(uCamWorld) * v);
        dist = sky ? 220.0 : length(v);
      }

      // Ambient occlusion: off in fog and on bright pixels (practicals must not go grey).
      if (uAO > 0.0) {
        float ao = texture2D(tAO, vUv).r;
        float fogK = exp(-uFogDensity * uFogDensity * dist * dist);
        float lum0 = dot(c, LUMA);
        float k = uAO * fogK * (1.0 - smoothstep(0.8, 3.0, lum0)) * (sky ? 0.0 : 1.0);
        c *= mix(1.0, clamp(ao, 0.0, 1.0), clamp(k, 0.0, 1.0));
      }

      // Height fog, integrated along the ray: density uHFog at uHFogY, e^-falloff per metre above it.
      if (uHFog > 0.0 && uHasDepth > 0.5) {
        vec3 camP = uCamWorld[3].xyz;
        float b = max(uHFogFalloff, 1e-3);
        float dy = rayW.y * dist;
        float base = uHFog * exp(-b * (camP.y - uHFogY));
        float t = abs(dy) > 1e-3 ? (1.0 - exp(-b * dy)) / (b * dy) : 1.0;
        float integral = base * dist * max(t, 0.0);
        float f = 1.0 - exp(-min(integral, 20.0));
        c = mix(c, uHFogColor, clamp(f, 0.0, 0.92));
      }

      // Bloom from practicals: added before the grade so lightChroma keeps it coloured at low hope.
      if (uBloom > 0.0) c += sane(texture2D(tBloom, vUv).rgb) * uBloom;

      float l = dot(c, LUMA);

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

      // Lift / gamma / gain (gamma pivots on mid-grey, so it bends the curve without moving 0.18).
      col = col * uGain;
      col += uLift * (1.0 - smoothstep(0.0, 0.4, col));
      col = 0.18 * exp(log(max(col, vec3(1e-6)) / 0.18) / max(uGamma, vec3(0.05)));
      // Split tone: shadows lean towards one hue, highlights towards another.
      if (uSplit > 0.0) {
        float t = smoothstep(0.02, 0.5, dot(col, LUMA));
        col *= mix(vec3(1.0), mix(uSplitShadow, uSplitHigh, t), uSplit);
      }

      // Contrast around mid-grey. Above the pivot it is linear; below it a power curve (same value
      // and slope at the pivot) so shadows deepen without being clamped to flat digital black.
      vec3 cHi = (col - 0.18) * uContrast + 0.18;
      vec3 cLo = 0.18 * exp(uContrast * log(max(col, vec3(1e-6)) / 0.18));
      col = mix(cLo, cHi, step(vec3(0.18), col));

      // Filmic shoulder: compress luminance above 1 (hue kept) so a hot bulb rolls off before ACES.
      if (uShoulder > 0.0) {
        float lc = max(dot(col, LUMA), 1e-6);
        float k = 1.0 + 3.0 / uShoulder;
        float lo = lc > 1.0 ? 1.0 + (lc - 1.0) / (1.0 + (lc - 1.0) / k) : lc;
        col *= lo / lc;
      }

      // Vignette (towards uVigColor, keeping some of the luminance so it reads as stained, not black).
      float v = smoothstep(0.15, 0.6, dot(dv, dv) * 2.0);
      float lc = max(dot(col, LUMA), 0.0);
      // uVigColor is used as a hue (normalised to unit luminance), so a near-black brown still stains.
      vec3 vt = uVigColor / max(dot(uVigColor, LUMA), 1e-4);
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
        float lg = max(dot(col, LUMA), 0.0);
        col *= 1.0 + uGrain * (h - 0.5) * 2.0 * (1.0 - 0.5 * smoothstep(0.0, 0.5, lg));
        // A small additive term so near-black areas still carry grain.
        col += uGrain * 0.012 * (h - 0.5) * (1.0 - smoothstep(0.0, 0.05, lg));
      }

      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};
