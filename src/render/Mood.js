import * as THREE from 'three';

// "Colour is hope." Mood owns the global lights, sky, fog and the MoodShader uniforms (grade + grime).
// hope: 0 = grey, 1 = full colour, >1 = oversaturated (Ch3 flashback).

const COOL = new THREE.Vector3(0.86, 0.93, 1.08);
const GOLD = new THREE.Vector3(1.08, 1.0, 0.86);
const NEUTRAL = new THREE.Vector3(1, 1, 1);
const ORIGIN = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const damp = (a, b, lambda, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt));

/**
 * Preset fields (all optional; defaults in DEFAULT_PRESET):
 *  skyTop, skyBottom           sky gradient at hope 0
 *  skyTopHope, skyBottomHope   sky gradient at hope 1 (defaults to the hope-0 colours)
 *  fogColor, fogColorHope      FogExp2 colour at hope 0 / 1
 *  fogDensity, fogDensityHope  FogExp2 density at hope 0 / 1 (0 = no fog)
 *  hemiSky, hemiGround, hemiIntensity
 *  sunColor, sunIntensity, sunDir [x,y,z] (direction *towards* the sun), shadows (bool)
 *  fillColor, fillIntensity      soft point light that rides with the camera so figures read (0 = off)
 *  exposure (tone mapping), contrast, vignette, neutralTint (true = no cool/gold tint)
 *  lightChroma                  saturation kept in bright areas at low hope (0 = none; lamps/TV glow)
 *  vignetteColor                colour the vignette sinks towards (default black)
 *  grain                        film grain amount (scaled by 1.2 - 0.5*clamp(hope,0,1) at runtime)
 *  dirt                         static lens dirt / smudges (0..1)
 *  showSky (bool, default true)
 */
const DEFAULT_PRESET = {
  skyTop: '#1a1d22',
  skyBottom: '#2a2e33',
  fogColor: '#2a2e33',
  fogDensity: 0,
  hemiSky: '#8890a0',
  hemiGround: '#202020',
  hemiIntensity: 0.8,
  sunColor: '#ffffff',
  sunIntensity: 1,
  sunDir: [0.4, 0.8, 0.5],
  shadows: true,
  fillColor: '#c8d2e0',
  fillIntensity: 0,
  exposure: 1,
  contrast: 1,
  vignette: 0.45,
  lightChroma: 0,
  vignetteColor: '#000000',
  grain: 0,
  dirt: 0,
  neutralTint: false,
  showSky: true,
};

export const PRESETS = {
  // Ch1: Hugo's flat at night. Green-grey nicotine ambient, no fog. The chapter adds the TV
  // PointLight #9fb7d6 (key light) and a failing fluorescent strip #cfe6d0.
  flat: {
    skyTop: '#07090a',
    skyBottom: '#101411',
    fogColor: '#101411',
    fogDensity: 0,
    hemiSky: '#5d665a',
    hemiGround: '#2a2622',
    hemiIntensity: 3.0,
    sunColor: '#8aa2b4',
    sunIntensity: 0.9,
    sunDir: [-0.5, 0.9, -0.6],
    fillColor: '#c8d0c4',
    fillIntensity: 4.5,
    exposure: 1.0,
    contrast: 1.07,
    vignette: 0.6,
    vignetteColor: '#0d0f0a',
    lightChroma: 0.55, // the TV's blue survives the grey
    grain: 0.07,
    dirt: 0.4,
  },
  // Ch2 (and Ch5 before golden hour falls back to `wall`): Rue des Tanneurs, wet, late evening.
  // The chapter adds sodium lamps #d9a35a and the pink MARCO'S neon #ff3d6e.
  street: {
    skyTop: '#2f3438',
    skyBottom: '#5f6560',
    skyTopHope: '#3c3a40',
    skyBottomHope: '#6e665c',
    fogColor: '#5f6560',
    fogColorHope: '#6c665e',
    fogDensity: 0.045,
    hemiSky: '#666c66',
    hemiGround: '#1c1d1b',
    hemiIntensity: 1.4,
    sunColor: '#8f9aa2',
    sunIntensity: 0.55,
    sunDir: [0.35, 0.45, -0.8],
    fillIntensity: 7,
    exposure: 1.0,
    contrast: 1.05,
    vignette: 0.56,
    vignetteColor: '#0c0c0a',
    lightChroma: 0.85, // sodium amber and the pink neon survive the grey
    grain: 0.065,
    dirt: 0.45,
  },
  // Ch3 flashback: a dawn ring road. Cold, bright, acid; hope is forced high (1.15 -> 0.75).
  // neutralTint so the STRIDE green reads cold. The chapter adds a low cold sun ahead.
  dawnrun: {
    skyTop: '#1b2a44',
    skyBottom: '#4f6f8f',
    fogColor: '#4f6f8f',
    fogDensity: 0.02,
    hemiSky: '#a9bdd6',
    hemiGround: '#2a2f38',
    hemiIntensity: 1.1,
    sunColor: '#cfe3ff',
    sunIntensity: 2.0,
    sunDir: [0.15, 0.25, -1], // low, ahead (down -Z)
    fillColor: '#cfe3ff',
    fillIntensity: 2.5,
    exposure: 1.05,
    contrast: 1.12,
    vignette: 0.4,
    neutralTint: true,
    grain: 0.04,
    dirt: 0.15,
  },
  // Ch4: Odile's workshop. Tungsten bulb #ffb36b (chapter light) over grey daylight from a grimy
  // high window. lightChroma 0.5 keeps the bulb warm at low hope; the vignette sinks to brown.
  workshop: {
    skyTop: '#16130f',
    skyBottom: '#241e18',
    fogColor: '#241e18',
    fogDensity: 0,
    hemiSky: '#7a7468',
    hemiGround: '#2e2620',
    hemiIntensity: 2.6,
    sunColor: '#b8bcc0',
    sunIntensity: 1.1,
    sunDir: [-0.6, 0.8, 0.25], // grey daylight from the street side (left)
    fillColor: '#e6d6c0',
    fillIntensity: 3.5,
    exposure: 1.0,
    contrast: 1.06,
    vignette: 0.55,
    vignetteColor: '#1c140c',
    lightChroma: 0.5,
    grain: 0.06,
    dirt: 0.35,
  },
  // Ch5: the street by day, overcast, warming with hope (rain off).
  wall: {
    skyTop: '#8a949c',
    skyBottom: '#b9bfc2',
    skyTopHope: '#7fa6c9',
    skyBottomHope: '#e8cf9e',
    fogColor: '#b9bfc2',
    fogColorHope: '#e2cfa8',
    fogDensity: 0.02,
    fogDensityHope: 0.008,
    hemiSky: '#b4bcc2',
    hemiGround: '#4a4238',
    hemiIntensity: 1.2,
    sunColor: '#e6dccb',
    sunIntensity: 1.4,
    sunDir: [-0.45, 0.65, 0.35],
    fillIntensity: 3,
    exposure: 1.02,
    contrast: 1.04,
    vignette: 0.45,
    vignetteColor: '#1a1610',
    lightChroma: 0.3,
    grain: 0.045,
    dirt: 0.25,
  },
  // Ch5 final walk: late-afternoon gold breaking under the cloud from the far end of the street.
  // Still dirty, lit differently.
  golden: {
    skyTop: '#b07a5c',
    skyBottom: '#f2c879',
    fogColor: '#eac28a',
    fogDensity: 0.008,
    hemiSky: '#f4d3a0',
    hemiGround: '#5a4030',
    hemiIntensity: 0.95,
    sunColor: '#ffc27a',
    sunIntensity: 2.5,
    sunDir: [-0.35, 0.22, -0.9],
    fillColor: '#ffd9a8',
    fillIntensity: 3,
    exposure: 1.05,
    contrast: 1.05,
    vignette: 0.42,
    vignetteColor: '#2a1a0c',
    grain: 0.03,
    dirt: 0.12,
  },
  // Neutral black void (title, transitions).
  void: { skyTop: '#000000', skyBottom: '#000000', hemiIntensity: 0.2, sunIntensity: 0.2, showSky: false },
};

const COLOR_KEYS = ['skyTop', 'skyBottom', 'skyTopHope', 'skyBottomHope', 'fogColor', 'fogColorHope', 'hemiSky', 'hemiGround', 'sunColor', 'fillColor', 'vignetteColor'];
const NUM_KEYS = ['fogDensity', 'fogDensityHope', 'hemiIntensity', 'sunIntensity', 'fillIntensity', 'exposure', 'contrast', 'vignette', 'lightChroma', 'grain', 'dirt'];

function resolve(p) {
  const r = { ...DEFAULT_PRESET, ...p };
  r.skyTopHope ??= r.skyTop;
  r.skyBottomHope ??= r.skyBottom;
  r.fogColorHope ??= r.fogColor;
  r.fogDensityHope ??= r.fogDensity;
  const out = { raw: { ...p } };
  for (const k of COLOR_KEYS) out[k] = new THREE.Color(r[k]);
  for (const k of NUM_KEYS) out[k] = r[k];
  out.sunDir = new THREE.Vector3(...r.sunDir).normalize();
  out.shadows = r.shadows;
  out.neutralTint = r.neutralTint;
  out.showSky = r.showSky;
  return out;
}

function lerpState(a, b, k, out) {
  for (const key of COLOR_KEYS) out[key].copy(a[key]).lerp(b[key], k);
  for (const key of NUM_KEYS) out[key] = a[key] + (b[key] - a[key]) * k;
  out.sunDir.copy(a.sunDir).lerp(b.sunDir, k).normalize();
  out.shadows = b.shadows;
  out.neutralTint = k < 0.5 ? a.neutralTint : b.neutralTint;
  out.showSky = b.showSky;
  return out;
}

export class Mood {
  constructor({ engine, sky, audio }) {
    this.engine = engine;
    this.scene = engine.scene;
    this.camera = engine.camera;
    this.pass = engine.moodPass;
    this.sky = sky;
    this.audio = audio;
    this.player = null; // set by main
    this.followTarget = null; // Object3D the sun shadow follows (player root by default)

    this.hope = 0.05;
    this.target = 0.05;
    this.lambda = 1.5;

    this.hemi = new THREE.HemisphereLight(0x8890a0, 0x202020, 0.8);
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = this.sun.shadow.camera;
    s.left = -22;
    s.right = 22;
    s.top = 22;
    s.bottom = -22;
    s.near = 1;
    s.far = 90;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.fill = new THREE.PointLight(0xc8d2e0, 0, 12, 1.6);
    for (const o of [this.hemi, this.sun, this.sun.target, this.fill]) o.userData.noDispose = true;
    this.scene.add(this.hemi, this.sun, this.sun.target, this.fill);
    this.fog = new THREE.FogExp2(0x2a2e33, 0);
    this.scene.fog = this.fog;

    this.presetName = 'void';
    this._to = resolve(PRESETS.void);
    this._from = resolve(PRESETS.void);
    this._cur = resolve(PRESETS.void);
    this._blend = { t: 1, dur: 0 };

    // Four colour-focus slots (see focusOn). Each: { obj, offsetY, decay, floor, value, radius }.
    this.focus = [0, 1, 2, 3].map(() => ({ obj: null, offsetY: 1.3, decay: 0.25, floor: 0, value: 0, radius: 0.28 }));
    /** When a number, drives the red pain vignette instead of player.pain^2 (Ch3 flashback). null = off. */
    this.painOverride = null;
    this.flashDecay = 2;
    this._tint = new THREE.Vector3();
    this._v = new THREE.Vector3();
    this._sky0 = new THREE.Color();
    this._sky1 = new THREE.Color();
    this._lightQ = new THREE.Quaternion();
    this._lightQi = new THREE.Quaternion();
    this._lightM = new THREE.Matrix4();
  }

  /**
   * Snap a shadow-camera centre to the shadow map's texel grid in light space, so shadows of thin
   * things (rails, poles) don't crawl as the target moves. Modifies p.
   */
  _snapToShadowTexels(p, sunDir) {
    const cam = this.sun.shadow.camera;
    const texel = (cam.right - cam.left) / this.sun.shadow.mapSize.x;
    // Same orientation the shadow camera gets from lookAt(target) with up = +Y.
    const q = this._lightQ.setFromRotationMatrix(this._lightM.lookAt(sunDir, ORIGIN, UP));
    const inv = this._lightQi.copy(q).invert();
    p.applyQuaternion(inv);
    p.x = Math.round(p.x / texel) * texel;
    p.y = Math.round(p.y / texel) * texel;
    p.applyQuaternion(q);
  }

  /** The preset currently applied (resolved values). */
  get preset() {
    return this._to;
  }

  /**
   * Apply a preset by name (see PRESETS) or object, optionally with overrides.
   * opts: { blend = 0 (seconds to cross-fade lights/sky/fog), ...overrides }
   */
  applyPreset(p, { blend = 0, ...overrides } = {}) {
    const base = typeof p === 'string' ? PRESETS[p] : p;
    if (!base) console.warn('[mood] unknown preset', p);
    this.presetName = typeof p === 'string' ? p : 'custom';
    const next = resolve({ ...(base || {}), ...overrides });
    this._from = lerpState(this._cur, this._cur, 0, resolve({}));
    this._to = next;
    this._blend = { t: 0, dur: Math.max(0, blend) };
    if (blend <= 0) lerpState(this._to, this._to, 1, this._cur);
  }

  /** Change some preset fields (e.g. { fogDensity: 0.02 }) over `secs`. */
  tweak(fields, secs = 2) {
    this.applyPreset({ ...this._to.raw, ...fields }, { blend: secs });
  }

  /** Set the hope target. opts: { snap=false, lambda=1.5 (damping speed) } */
  set(h, { snap = false, lambda = 1.5 } = {}) {
    this.target = h;
    this.lambda = lambda;
    if (snap) this.hope = h;
  }

  add(d) {
    this.set(this.target + d, { lambda: this.lambda });
  }

  /** Hope bump with a warm flash. */
  pulse(d = 0.1, flash = 0.25) {
    this.add(d);
    this.pass.uniforms.uFlash.value = Math.max(this.pass.uniforms.uFlash.value, flash);
  }

  /** White flash (1 = full white), decays over ~1/decay seconds. */
  flash(amount = 1, decay = 2) {
    this.flashDecay = decay;
    this.pass.uniforms.uFlash.value = amount;
  }

  /** Move hope to `to` reaching ~99% in `secs` (Ch3: drain(0, 2)). */
  drain(to, secs) {
    this.target = to;
    this.lambda = 4.6 / Math.max(0.05, secs);
  }

  /**
   * Radial colour focus that tracks obj on screen. Four independent slots (0..3); the shader takes
   * the max, so several made things can hold colour at once (door slot 0, bike slot 1, sign slot 2).
   * The strength decays at `decay`/s down to `floor` (kept until the slot is released or the chapter ends).
   * obj = null releases the slot. opts: { strength=1, decay=0.25, offsetY=1.3, floor=0, slot=0, radius=0.28 }
   * radius is in screen heights (0.28 = the old single focus disc).
   */
  focusOn(obj, { strength = 1, decay = 0.25, offsetY = 1.3, floor = 0, slot = 0, radius = 0.28 } = {}) {
    const f = this.focus[Math.max(0, Math.min(3, slot | 0))];
    if (!obj) {
      Object.assign(f, { obj: null, value: 0, floor: 0 });
      return;
    }
    Object.assign(f, { obj, offsetY, decay, floor, radius, value: Math.max(strength, floor) });
  }

  /** Release every focus slot (the Director calls it between chapters). */
  clearFocus() {
    for (const f of this.focus) Object.assign(f, { obj: null, value: 0, floor: 0 });
    for (const u of this.pass.uniforms.uFocus.value) u.set(-10, -10, 0.28, 0);
  }

  update(_dt, raw) {
    const dt = raw;
    const u = this.pass.uniforms;
    this.hope = damp(this.hope, this.target, this.lambda, dt);
    const h = this.hope;
    const h01 = clamp(h, 0, 1);

    // Preset cross-fade
    const b = this._blend;
    if (b.t < 1) {
      b.t = b.dur > 0 ? Math.min(1, b.t + dt / b.dur) : 1;
      const k = b.t * b.t * (3 - 2 * b.t);
      lerpState(this._from, this._to, k, this._cur);
    }
    const c = this._cur;

    // Grade
    u.uSat.value = h;
    u.uLightSat.value = c.lightChroma;
    this._tint.copy(c.neutralTint ? NEUTRAL : COOL).lerp(GOLD, c.neutralTint ? 0 : h01);
    u.uTint.value.copy(this._tint);
    u.uContrast.value = damp(u.uContrast.value, c.contrast, 3, dt);
    u.uVignette.value = damp(u.uVignette.value, c.vignette, 3, dt);
    u.uFlash.value = Math.max(0, u.uFlash.value - dt * this.flashDecay);
    // Grime: grain eases as hope rises but never disappears.
    u.uGrain.value = c.grain * (1.2 - 0.5 * h01);
    u.uDirt.value = c.dirt;
    u.uVigColor.value.set(c.vignetteColor.r, c.vignetteColor.g, c.vignetteColor.b);
    u.uTime.value = this.engine.now % 1000;
    // Pain: painOverride (Ch3) wins; otherwise player.pain^2. No red vignette while the pain bar is
    // hidden (Ch5's final walk: it hurts less than he expects).
    let painTarget;
    if (typeof this.painOverride === 'number') painTarget = clamp(this.painOverride, 0, 1);
    else {
      const pain = this.player && this.player.showPain !== false ? this.player.pain : 0;
      painTarget = pain * pain;
    }
    u.uPain.value = damp(u.uPain.value, painTarget, 8, dt);

    // Focus slots
    for (let i = 0; i < 4; i++) {
      const f = this.focus[i];
      const fu = u.uFocus.value[i];
      f.value = Math.max(f.floor, f.value - dt * f.decay);
      if (!f.obj || f.value <= 0) {
        fu.set(-10, -10, f.radius, 0);
        continue;
      }
      f.obj.getWorldPosition(this._v);
      this._v.y += f.offsetY;
      this._v.project(this.camera);
      // Behind the camera (z > 1) the projection mirrors: park the disc off-screen for the frame.
      const visible = this._v.z <= 1 && Math.abs(this._v.x) < 1.3 && Math.abs(this._v.y) < 1.3;
      if (visible) fu.set(this._v.x * 0.5 + 0.5, this._v.y * 0.5 + 0.5, f.radius, f.value);
      else fu.set(-10, -10, f.radius, 0);
    }

    // Sky, fog, lights
    this._sky0.copy(c.skyTop).lerp(c.skyTopHope, h01);
    this._sky1.copy(c.skyBottom).lerp(c.skyBottomHope, h01);
    this.sky.set(this._sky0, this._sky1);
    this.sky.mesh.visible = c.showSky;
    this.scene.background.copy(this._sky1);
    this.fog.color.copy(c.fogColor).lerp(c.fogColorHope, h01);
    this.fog.density = c.fogDensity + (c.fogDensityHope - c.fogDensity) * h01;
    this.hemi.color.copy(c.hemiSky);
    this.hemi.groundColor.copy(c.hemiGround);
    this.hemi.intensity = c.hemiIntensity;
    this.sun.color.copy(c.sunColor);
    this.sun.intensity = c.sunIntensity;
    this.sun.castShadow = c.shadows;
    this.engine.renderer.toneMappingExposure = c.exposure;
    this.fill.color.copy(c.fillColor);
    this.fill.intensity = c.fillIntensity;
    this.fill.position.copy(this.camera.position);
    this.fill.position.y += 0.6;

    const t = this.followTarget || this.player?.root;
    if (t) {
      t.getWorldPosition(this._v);
      this._snapToShadowTexels(this._v, c.sunDir);
      this.sun.target.position.copy(this._v);
      this.sun.position.copy(this._v).addScaledVector(c.sunDir, 40);
    }

    this.sky.follow(this.camera);
    this.audio?.drone(h);
  }
}
