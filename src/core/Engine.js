import * as THREE from 'three';
import { Post } from '../render/Post.js';
import { TIERS, pickTier, saveTier, gpuName } from '../render/Quality.js';

export function hasWebGL() {
  return !!window.WebGL2RenderingContext;
}

/**
 * Renderer, scene, camera, post chain and the main loop.
 * Systems are updated in the order they were added (see main.js).
 * Two clocks: `now` (real seconds, pauses with the game) and `time` (scaled by timeScale).
 */
export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    // No canvas MSAA: the scene is drawn into Post's scene target, which carries its own samples.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    const coarse = window.matchMedia?.('(pointer:coarse)').matches;
    this.deviceMaxPixelRatio = coarse ? 1.25 : 1.5; // 4x MSAA on top, so a lower cap is still crisp
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    // r186 PCF is soft: a Vogel-disk kernel whose width is light.shadow.radius (set per quality tier).
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.info.autoReset = false; // info.render.calls = whole frame (all passes)

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600); // near 0.1: depth precision for far track lines
    this.camera.position.set(0, 2.6, 4.2);
    this.scene.add(this.camera); // so camera-attached objects render

    // Quality tier (?quality=low|medium|high, else remembered, else picked from the GPU).
    const pick = pickTier(this.renderer.getContext());
    this.qualitySource = pick.source;
    this.gpu = pick.gpu || gpuName(this.renderer.getContext());
    this.tier = TIERS[pick.tier];
    this.maxPixelRatio = Math.min(this.deviceMaxPixelRatio, this.tier.pixelRatio);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxPixelRatio));

    // Post chain (src/render/Post.js): scene -> GTAO -> bloom -> grade (MoodShader) -> OutputPass.
    this.post = new Post(this.renderer, this.scene, this.camera, this.tier.name);
    /** The grade pass: { uniforms } of the MoodShader material (Mood owns them). */
    this.moodPass = this.post.moodPass;

    this.timer = new THREE.Timer();
    this.timer.connect(document);

    this.paused = false;
    this.timeScale = 1;
    this.now = 0; // real seconds, frozen while paused
    this.time = 0; // scaled seconds
    this.dt = 0; // last scaled dt
    this.rawDt = 0; // last unscaled dt
    this.frameCount = 0;

    this.systems = [];
    this._timers = []; // {at, scaled, fn}
    this._frameWaiters = [];
    this._listeners = { pause: [], resize: [], quality: [] };
    this.contextLost = false;

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      this.onContextLost?.();
    });

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    window.visualViewport?.addEventListener('resize', this._onResize); // mobile URL bar show/hide
    this.resize();
  }

  /** Add a system with update(dt, rawDt). Order of addition = update order. */
  add(system) {
    this.systems.push(system);
    return system;
  }

  on(name, fn) {
    this._listeners[name]?.push(fn);
    return () => {
      const a = this._listeners[name];
      const i = a.indexOf(fn);
      if (i >= 0) a.splice(i, 1);
    };
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxPixelRatio));
    this.renderer.setSize(w, h, false);
    const pr = this.renderer.getPixelRatio();
    this.post.setSize(Math.floor(w * pr), Math.floor(h * pr));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    for (const fn of this._listeners.resize) fn(w, h);
  }

  /** Current quality tier name ('low' | 'medium' | 'high'). */
  get quality() {
    return this.tier.name;
  }

  /**
   * Switch the quality tier at runtime (pause menu, __game.quality.set). Rebuilds the post targets,
   * applies the pixel ratio and notifies 'quality' listeners (Mood: shadows; Materials: anisotropy).
   * remember=true stores the choice for the next visit.
   */
  setQuality(name, { remember = false } = {}) {
    const t = TIERS[name];
    if (!t) return this.tier.name;
    if (remember) saveTier(name);
    if (t === this.tier) return name;
    this.tier = t;
    this.maxPixelRatio = Math.min(this.deviceMaxPixelRatio, t.pixelRatio);
    this.post.setTier(name);
    this.resize();
    for (const fn of this._listeners.quality) fn(t);
    console.info('[hairline] quality', name);
    return name;
  }

  setPaused(p) {
    p = !!p;
    if (p === this.paused) return;
    this.paused = p;
    for (const fn of this._listeners.pause) fn(p);
  }

  /**
   * Compile every material in the scene (hidden beats included) while a chapter is still behind
   * the fade, in parallel where KHR_parallel_shader_compile exists, for the post chain's scene target
   * (its programs differ from the canvas ones). Resolves when ready, or after `timeout` s anyway.
   */
  async precompile(timeout = 3) {
    if (this.contextLost) return;
    const r = this.renderer;
    const prev = r.getRenderTarget();
    let done;
    try {
      r.setRenderTarget(this.post?.sceneRT ?? null);
      done = r.compileAsync(this.scene, this.camera);
    } catch (err) {
      console.warn('[hairline] precompile failed', err?.message || err);
      return;
    } finally {
      r.setRenderTarget(prev);
    }
    await Promise.race([done, this.wait(timeout)]);
  }

  /** Promise resolving after `sec` seconds of (unpaused) game time. scaled:true uses timeScale. */
  wait(sec, { scaled = false } = {}) {
    return new Promise((resolve) => {
      this._timers.push({ at: (scaled ? this.time : this.now) + Math.max(0, sec), scaled, fn: resolve });
    });
  }

  /** Call fn after `sec` real (unpaused) seconds. Returns a cancel function. */
  after(sec, fn, { scaled = false } = {}) {
    const t = { at: (scaled ? this.time : this.now) + Math.max(0, sec), scaled, fn };
    this._timers.push(t);
    return () => {
      const i = this._timers.indexOf(t);
      if (i >= 0) this._timers.splice(i, 1);
    };
  }

  /** Promise resolving on the next unpaused frame with the scaled dt. */
  frame() {
    return new Promise((resolve) => this._frameWaiters.push(resolve));
  }

  /**
   * Start the loop. tickWhenHidden (debug only): browsers stop requestAnimationFrame and throttle
   * timers in a hidden window, so automated tests drive the loop from a MessageChannel at ~60 Hz.
   */
  start({ tickWhenHidden = false } = {}) {
    let last = 0;
    const loop = (ts) => {
      requestAnimationFrame(loop);
      last = performance.now();
      this.tick(ts);
    };
    requestAnimationFrame(loop);
    if (!tickWhenHidden) return;
    this.timer.disconnect(); // the Page Visibility hook would zero every hidden-frame delta
    const ch = new MessageChannel();
    let spinning = false;
    ch.port1.onmessage = () => {
      if (!document.hidden) {
        spinning = false; // rAF is back in charge
        return;
      }
      const now = performance.now();
      if (now - last >= 16) {
        last = now;
        this.tick(now);
      }
      ch.port2.postMessage(0);
    };
    const kick = () => {
      if (document.hidden && !spinning) {
        spinning = true;
        ch.port2.postMessage(0);
      }
    };
    document.addEventListener('visibilitychange', kick);
    kick();
  }

  tick(ts) {
    this.timer.update(ts);
    const raw = Math.min(this.timer.getDelta(), 1 / 20);
    this.rawDt = raw;
    this.frameCount++;
    this.beforeFrame?.(); // input.beginFrame

    if (!this.paused) {
      const dt = raw * this.timeScale;
      this.dt = dt;
      this.now += raw;
      this.time += dt;
      this._runTimers();
      const waiters = this._frameWaiters;
      this._frameWaiters = [];
      for (const w of waiters) w(dt);
      for (const s of this.systems) {
        try {
          s.update(dt, raw);
        } catch (err) {
          console.error('[engine] system update failed', err);
        }
      }
    } else {
      // Paused: only systems that opt in (UI) keep ticking.
      for (const s of this.systems) if (s.updateWhilePaused) s.update(0, raw);
    }

    if (!this.contextLost) {
      this.renderer.info.reset();
      this.post.render(raw);
    }
  }

  _runTimers() {
    if (!this._timers.length) return;
    const due = [];
    this._timers = this._timers.filter((t) => {
      const clock = t.scaled ? this.time : this.now;
      if (clock >= t.at) {
        due.push(t);
        return false;
      }
      return true;
    });
    for (const t of due) {
      try {
        t.fn();
      } catch (err) {
        console.error('[engine] timer failed', err);
      }
    }
  }
}
