import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MoodShader } from '../render/MoodShader.js';

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
    // No canvas MSAA: the scene is drawn into the composer's targets, which carry their own samples.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    const coarse = window.matchMedia?.('(pointer:coarse)').matches;
    this.maxPixelRatio = coarse ? 1.25 : 1.5; // 4x MSAA on top, so a lower cap is still crisp
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxPixelRatio));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.info.autoReset = false; // info.render.calls = whole frame (all passes)

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600); // near 0.1: depth precision for far track lines
    this.camera.position.set(0, 2.6, 4.2);
    this.scene.add(this.camera); // so camera-attached objects render

    // Multisampled composer targets: anti-aliases the scene geometry (canvas MSAA would only touch
    // the final full-screen quad).
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    rt.texture.name = 'EffectComposer.rt1';
    this.composer = new EffectComposer(this.renderer, rt);
    // The chain is fixed (Render -> Mood -> Output, two swaps per frame), and RenderPass draws into
    // the composer's readBuffer, which is renderTarget2 at the start of every frame. Only that one
    // needs MSAA and depth; the Mood pass writes renderTarget1, a plain single-sample target.
    this.composer.renderTarget1.samples = 0;
    this.composer.renderTarget1.depthBuffer = false;
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.moodPass = new ShaderPass(MoodShader);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.moodPass);
    this.composer.addPass(this.outputPass);

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
    this._listeners = { pause: [], resize: [] };
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
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.moodPass.uniforms.uAspect.value = w / h;
    for (const fn of this._listeners.resize) fn(w, h);
  }

  setPaused(p) {
    p = !!p;
    if (p === this.paused) return;
    this.paused = p;
    for (const fn of this._listeners.pause) fn(p);
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
      this.composer.render(raw);
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
