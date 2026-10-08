import * as THREE from 'three';

// Small, cheap feedback shared by the crafts (docs/DESIGN.md R3.1, R3.5): a dust puff pool, a
// scrape that follows the stroke rate, a brush hiss, and a mouse "scrub" that strokes like A/D.

const clamp = THREE.MathUtils.clamp;

const DUST_VS = /* glsl */ `
  attribute vec3 color;
  attribute float alpha;
  uniform float uSize, uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = color;
    vAlpha = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = alpha > 0.0 ? max(1.0, uSize * uScale / max(0.05, -mv.z)) : 0.0;
    gl_Position = projectionMatrix * mv;
  }`;
const DUST_FS = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = dot(c, c);
    if (r > 0.25) discard;
    gl_FragColor = vec4(mix(vColor, vec3(1.0), 0.2), vAlpha * (1.0 - r * 3.2)); // powder catches the light
  }`;

/**
 * A pool of dust motes in one Points draw (gravity 3 m/s^2, fading out), updated in world.onUpdate
 * and added to the chapter group (disposed with it).
 * emit(pos, {n = 8, color, dir, speed = 0.6, spread = 0.5, life = 0.9}): `pos` a Vector3 or [x, y, z],
 * `dir` the throw direction (Vector3 / [x, y, z], default up), `spread` the cone jitter (0..1).
 */
export function makeDust(ctx, { max = 96, size = 0.012 } = {}) {
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  const alpha = new Float32Array(max);
  const vel = new Float32Array(max * 3);
  const age = new Float32Array(max);
  const life = new Float32Array(max);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSize: { value: size }, uScale: { value: 400 } },
    vertexShader: DUST_VS,
    fragmentShader: DUST_FS,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'craft-dust';
  points.frustumCulled = false;
  points.renderOrder = 2;
  points.userData.noOcclude = true;
  ctx.world.add(points);
  let next = 0;
  let live = 0;
  const c = new THREE.Color();
  const d = new THREE.Vector3();
  const v3 = (p) => (Array.isArray(p) ? d.set(p[0], p[1], p[2]) : d.copy(p));

  const off = ctx.world.onUpdate((dt) => {
    if (!live) return;
    // Pixel scale for world-sized points: half the drawing buffer height over tan(fov / 2).
    const cam = ctx.camera;
    const h = ctx.renderer?.domElement?.height || 800;
    mat.uniforms.uScale.value = h / 2 / Math.tan(THREE.MathUtils.degToRad((cam?.fov || 50) / 2));
    live = 0;
    for (let i = 0; i < max; i++) {
      if (alpha[i] <= 0) continue;
      age[i] += dt;
      const k = age[i] / life[i];
      if (k >= 1) {
        alpha[i] = 0;
        continue;
      }
      live++;
      vel[i * 3 + 1] -= 3 * dt;
      const drag = Math.exp(-1.8 * dt);
      vel[i * 3] *= drag;
      vel[i * 3 + 2] *= drag;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      alpha[i] = 0.9 * (1 - k * k);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.alpha.needsUpdate = true;
  });

  return {
    points,
    emit(at, { n = 8, color = '#bdb6a8', dir = null, speed = 0.6, spread = 0.5, life: secs = 0.9 } = {}) {
      const o = v3(at).clone();
      const base = dir ? v3(dir).clone().normalize() : new THREE.Vector3(0, 1, 0);
      c.set(color);
      for (let k = 0; k < n; k++) {
        const i = next;
        next = (next + 1) % max;
        const j = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2 * spread);
        const v = base.clone().add(j).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.7));
        v.y += 0.35 * speed; // a little lift before it falls
        pos.set([o.x + (Math.random() - 0.5) * 0.03, o.y, o.z + (Math.random() - 0.5) * 0.03], i * 3);
        vel.set([v.x, v.y, v.z], i * 3);
        const s = 0.85 + Math.random() * 0.3;
        col.set([c.r * s, c.g * s, c.b * s], i * 3);
        age[i] = 0;
        life[i] = secs * (0.6 + Math.random() * 0.6);
        alpha[i] = 0.85;
      }
      live = n;
      geo.attributes.color.needsUpdate = true;
    },
    dispose() {
      off();
      points.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}

/**
 * One stroke sound whose playbackRate and volume follow the stroke rate (strokes/s); `ref` is a full
 * stroke (k = rate / ref). Recorded set `name` (docs/assets/sfx.md): sanding by default (volume
 * 0.10 + 0.14 k, rate 0.85 + 0.3 k); the procedural band-noise scrape is the fallback.
 * opts: { ref = 2, name = 'sand_stroke', volume = [base, perK], pitch = [base, perK], jitter = 0.04 }.
 */
export function scrapeAt(audio, rate, { ref = 2.0, name = 'sand_stroke', volume = [0.1, 0.14], pitch = [0.85, 0.3], jitter = 0.04 } = {}) {
  const k = clamp((rate || 0) / ref, 0, 1.3);
  const fallback = (a) => a.scrape({ volume: 0.1 + 0.14 * k, freq: 700 + 700 * k });
  if (!audio?.sfx) return audio && fallback(audio);
  audio.sfx(name, { volume: volume[0] + volume[1] * k, rate: pitch[0] + pitch[1] * k, jitter, fallback });
}

let hissAt = -1;
/** A soft bristle hiss while a brush moves; `speed` 0..1. Throttled to one burst per 0.12 s. */
export function brushHiss(audio, speed) {
  const t = performance.now() / 1000;
  if (t - hissAt < 0.12 || !(speed > 0.02)) return;
  hissAt = t;
  audio?.noise({ type: 'bandpass', freq: 3200, q: 0.8, dur: 0.12, volume: 0.035 * clamp(speed, 0, 1) });
}

/**
 * Mouse scrubbing for rhythm({poll}): a stroke is a horizontal drag that has travelled `minTravel` px
 * since it last reversed (the drag's opening run before its first reversal doesn't count) (a left stroke is 'KeyA', a right one 'KeyD'; null otherwise). The returned
 * poll calls pointer.update() itself, so it must be the frame's only caller (rhythm reads it first).
 */
export function scrubber(pointer, { minTravel = 40 } = {}) {
  let dir = 0;
  let travel = 0;
  let fired = false;
  return () => {
    const P = pointer.update();
    if (!P.down) {
      dir = 0;
      travel = 0;
      fired = false;
      return null;
    }
    const dx = P.dragX;
    if (!dx) return null;
    const s = Math.sign(dx);
    if (s !== dir) {
      // A drag's opening run (grabbed mid-stroke, a half stroke) only sets the direction: the
      // strokes count from its first turn, so the first interval isn't a too-fast half.
      fired = dir === 0;
      dir = s;
      travel = 0;
    }
    travel += Math.abs(dx);
    if (!fired && travel >= minTravel) {
      fired = true;
      return dir < 0 ? 'KeyA' : 'KeyD';
    }
    return null;
  };
}
