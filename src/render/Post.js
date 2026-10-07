import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { MoodShader } from './MoodShader.js';
import { TIERS } from './Quality.js';

// The post chain. One frame:
//   1. scene -> sceneRT: half float, MSAA per tier, with a DepthTexture (resolved with the colour)
//   2. GTAO (medium/high): reads that depth only (normals rebuilt from depth, so the scene is NOT
//      drawn a second time), half (medium) or full (high) resolution, Poisson-denoised -> gtaoMap
//   3. bloom (medium/high): soft threshold (only practicals and emissives pass: bulbs, tubes, neon,
//      the TV), 5-level down/up chain at half resolution
//   4. grade (MoodShader): AO multiply, height fog, bloom add, hope saturation, focus slots, lift/
//      gamma/gain, split tone, contrast, shoulder, vignette, dirt, pain, flash, grain -> gradeRT
//   5. OutputPass: ACES tone mapping + sRGB to the canvas
// Everything after step 1 is single-sample. Every shader sanitises its input (NaN -> 0, clamp 64).

const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Prefilter: 4 bilinear taps (a 4x4 box) with Karis weighting against fireflies, then a soft knee.
const BLOOM_PREFILTER = /* glsl */ `
  uniform sampler2D tSrc;
  uniform vec2 uTexel;
  uniform float uThreshold, uKnee, uCeil;
  varying vec2 vUv;
  vec3 sane(vec3 c) { return clamp(vec3(c.r == c.r ? c.r : 0.0, c.g == c.g ? c.g : 0.0, c.b == c.b ? c.b : 0.0), 0.0, 64.0); }
  vec3 karis(vec3 c) { return c / (1.0 + max(c.r, max(c.g, c.b))); }
  void main() {
    vec3 a = sane(texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb);
    vec3 b = sane(texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb);
    vec3 c = sane(texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb);
    vec3 d = sane(texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb);
    vec3 wa = karis(a), wb = karis(b), wc = karis(c), wd = karis(d);
    float sw = (1.0 / (1.0 + max(a.r, max(a.g, a.b)))) + (1.0 / (1.0 + max(b.r, max(b.g, b.b))))
             + (1.0 / (1.0 + max(c.r, max(c.g, c.b)))) + (1.0 / (1.0 + max(d.r, max(d.g, d.b))));
    vec3 col = (wa + wb + wc + wd) / max(sw, 1e-4);
    float br = max(col.r, max(col.g, col.b));
    // Ceiling: a point-light glint on a wet, near-mirror puddle must not flood half the screen.
    col *= min(1.0, uCeil / max(br, 1e-4));
    br = min(br, uCeil);
    float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 1e-4);
    float w = max(soft, br - uThreshold) / max(br, 1e-4);
    gl_FragColor = vec4(col * max(w, 0.0), 1.0);
  }`;

// Dual-filter downsample (centre x4 + 4 diagonal taps).
const BLOOM_DOWN = /* glsl */ `
  uniform sampler2D tSrc;
  uniform vec2 uTexel;
  varying vec2 vUv;
  void main() {
    vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
    s += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
    s += texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
    s += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
    s += texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
    gl_FragColor = vec4(s / 8.0, 1.0);
  }`;

// Tent upsample of the smaller level, added to this level's downsample.
const BLOOM_UP = /* glsl */ `
  uniform sampler2D tSrc, tAdd;
  uniform vec2 uTexel;
  uniform float uSpread;
  varying vec2 vUv;
  void main() {
    vec2 o = uTexel * uSpread;
    vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
    s += (texture2D(tSrc, vUv + vec2(-o.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(o.x, 0.0)).rgb
        + texture2D(tSrc, vUv + vec2(0.0, -o.y)).rgb + texture2D(tSrc, vUv + vec2(0.0, o.y)).rgb) * 2.0;
    s += texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb
       + texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb;
    gl_FragColor = vec4(s / 16.0 + texture2D(tAdd, vUv).rgb, 1.0);
  }`;

const BLOOM_LEVELS = 5;

function quadMaterial(frag, uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: QUAD_VERT,
    fragmentShader: frag,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });
}

function colorTarget(w, h) {
  const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { type: THREE.HalfFloatType, depthBuffer: false });
  rt.texture.minFilter = THREE.LinearFilter;
  rt.texture.magFilter = THREE.LinearFilter;
  rt.texture.generateMipmaps = false;
  return rt;
}

export class Post {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {string} tier - 'low' | 'medium' | 'high'
   */
  constructor(renderer, scene, camera, tier = 'medium') {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.tier = TIERS[tier] || TIERS.medium;
    this.width = 1;
    this.height = 1;

    /** Live look parameters (Mood writes them every frame; the tier can still switch a feature off). */
    this.params = { ao: 1, aoRadius: 0.7, bloom: 0, bloomThreshold: 1.6, bloomKnee: 0.6, bloomSpread: 1, ca: 0 };
    /** Debug: fields here win over params (e.g. { ao: 0 } to compare); view: null | 'ao' | 'bloom'. */
    this.override = null;
    this.view = null;
    /** Per-frame draw-call split: scene (incl. shadow maps) and post (full-screen quads). */
    this.stats = { scene: 0, post: 0 };

    this.grade = quadMaterial(MoodShader.fragmentShader, THREE.UniformsUtils.clone(MoodShader.uniforms));
    // Focus slots are Vector4s Mood writes into; UniformsUtils.clone already gave us fresh ones.
    this.moodPass = { uniforms: this.grade.uniforms, material: this.grade };
    this.quad = new FullScreenQuad(this.grade);
    this.outputPass = new OutputPass();

    this.prefilter = quadMaterial(BLOOM_PREFILTER, {
      tSrc: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uThreshold: { value: 1.6 },
      uKnee: { value: 0.6 },
      uCeil: { value: 6 },
    });
    this.down = quadMaterial(BLOOM_DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.up = quadMaterial(BLOOM_UP, {
      tSrc: { value: null },
      tAdd: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uSpread: { value: 1 },
    });

    this.sceneRT = null;
    this.gradeRT = colorTarget(1, 1);
    this.bloomDown = [];
    this.bloomUp = [];
    this.gtao = null;
    this._build();
  }

  /** Recreate the scene target (MSAA count changes) and the AO pass for the current tier. */
  _build() {
    this.sceneRT?.dispose();
    this.sceneRT?.depthTexture?.dispose();
    const depth = new THREE.DepthTexture(this.width, this.height);
    depth.type = THREE.UnsignedIntType;
    this.sceneRT = new THREE.WebGLRenderTarget(this.width, this.height, {
      type: THREE.HalfFloatType,
      samples: this.tier.msaa,
      depthTexture: depth,
    });
    this.sceneRT.texture.name = 'Post.scene';
    this.sceneRT.texture.generateMipmaps = false;

    if (this.tier.ao) {
      if (!this.gtao) {
        this.gtao = new GTAOPass(this.scene, this.camera, 2, 2);
        this.gtao.output = GTAOPass.OUTPUT.Off; // we only want gtao.gtaoMap; the grade multiplies it in
      }
      this.gtao.setGBuffer(this.sceneRT.depthTexture); // depth only: normals are rebuilt from depth
      this.gtao.updateGtaoMaterial({ radius: this.params.aoRadius, distanceExponent: 1.6, thickness: 1.2, scale: 1.6, samples: this.tier.aoSamples, distanceFallOff: 1 });
      this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: this.tier.aoSamples >= 16 ? 16 : 8 });
    } else if (this.gtao) {
      this.gtao.dispose();
      this.gtao = null;
    }

    for (const rt of [...this.bloomDown, ...this.bloomUp]) rt.dispose();
    this.bloomDown = [];
    this.bloomUp = [];
    if (this.tier.bloom) {
      for (let i = 0; i < BLOOM_LEVELS; i++) {
        this.bloomDown.push(colorTarget(1, 1));
        this.bloomUp.push(colorTarget(1, 1));
      }
    }
    this.setSize(this.width, this.height);
  }

  setTier(name) {
    const t = TIERS[name];
    if (!t || t === this.tier) return;
    this.tier = t;
    this._build();
  }

  /** Drawing-buffer size in pixels (CSS size x pixel ratio). */
  setSize(w, h) {
    this.width = Math.max(1, Math.round(w));
    this.height = Math.max(1, Math.round(h));
    this.sceneRT.setSize(this.width, this.height);
    this.gradeRT.setSize(this.width, this.height);
    const k = this.tier.aoScale ?? 0.5;
    if (this.gtao) this.gtao.setSize(Math.ceil(this.width * k), Math.ceil(this.height * k));
    let bw = this.width;
    let bh = this.height;
    for (let i = 0; i < this.bloomDown.length; i++) {
      bw = Math.max(1, Math.ceil(bw / 2));
      bh = Math.max(1, Math.ceil(bh / 2));
      this.bloomDown[i].setSize(bw, bh);
      this.bloomUp[i].setSize(bw, bh);
    }
    this.grade.uniforms.uAspect.value = this.width / this.height;
  }

  _blit(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.quad.render(this.renderer);
  }

  _bloom(p) {
    const D = this.bloomDown;
    const U = this.bloomUp;
    const pf = this.prefilter.uniforms;
    pf.tSrc.value = this.sceneRT.texture;
    pf.uTexel.value.set(1 / this.width, 1 / this.height);
    pf.uThreshold.value = p.bloomThreshold;
    pf.uKnee.value = Math.max(0.01, p.bloomKnee);
    this._blit(this.prefilter, D[0]);
    const du = this.down.uniforms;
    for (let i = 1; i < D.length; i++) {
      du.tSrc.value = D[i - 1].texture;
      du.uTexel.value.set(1 / D[i - 1].width, 1 / D[i - 1].height);
      this._blit(this.down, D[i]);
    }
    const uu = this.up.uniforms;
    uu.uSpread.value = p.bloomSpread;
    let src = D[D.length - 1];
    for (let i = D.length - 2; i >= 0; i--) {
      uu.tSrc.value = src.texture;
      uu.tAdd.value = D[i].texture;
      uu.uTexel.value.set(1 / src.width, 1 / src.height);
      this._blit(this.up, U[i]);
      src = U[i];
    }
    return U[0].texture;
  }

  render() {
    const r = this.renderer;
    const info = r.info.render;
    const u = this.grade.uniforms;
    const t = this.tier;
    const p = this.override ? { ...this.params, ...this.override } : this.params;

    r.setRenderTarget(this.sceneRT);
    r.render(this.scene, this.camera);
    this.stats.scene = info.calls;

    // AO
    const aoOn = !!(this.gtao && p.ao > 0.001);
    if (aoOn) {
      if (this.gtao.gtaoMaterial.uniforms.radius.value !== p.aoRadius) this.gtao.updateGtaoMaterial({ radius: p.aoRadius });
      this.gtao.render(r, null, this.sceneRT);
    }
    u.tAO.value = aoOn ? this.gtao.gtaoMap : null;
    u.uAO.value = aoOn ? p.ao : 0;

    // Bloom
    const bloomOn = t.bloom && p.bloom > 0.001 && this.bloomDown.length > 0;
    u.tBloom.value = bloomOn ? this._bloom(p) : null;
    u.uBloom.value = bloomOn ? p.bloom : 0;

    // Grade
    u.tDiffuse.value = this.sceneRT.texture;
    u.tDepth.value = this.sceneRT.depthTexture;
    u.uHasDepth.value = 1;
    u.uProjInv.value.copy(this.camera.projectionMatrixInverse);
    u.uCamWorld.value.copy(this.camera.matrixWorld);
    u.uCA.value = t.ca ? p.ca : 0;
    this._blit(this.grade, this.gradeRT);

    // Tone map + sRGB to the canvas (debug views show an intermediate instead)
    this.outputPass.renderToScreen = true;
    const dbg = this.view === 'ao' && aoOn ? this.gtao.pdRenderTarget : this.view === 'bloom' && bloomOn ? this.bloomUp[0] : null;
    this.outputPass.render(r, null, dbg || this.gradeRT);
    this.stats.post = info.calls - this.stats.scene;
  }

  dispose() {
    this.sceneRT?.dispose();
    this.sceneRT?.depthTexture?.dispose();
    this.gradeRT.dispose();
    for (const rt of [...this.bloomDown, ...this.bloomUp]) rt.dispose();
    this.gtao?.dispose();
    for (const m of [this.grade, this.prefilter, this.down, this.up]) m.dispose();
    this.outputPass.dispose();
    this.quad.dispose();
  }
}
