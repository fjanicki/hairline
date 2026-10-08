import * as THREE from 'three';

// Finishing beats shared by the crafts (docs/DESIGN.md R3.1, R3.5): wet paint easing to matte, and
// the short reveal hold on a finished piece.

const ease = (k) => k * k * (3 - 2 * k);

/**
 * Wet -> matte. The material starts glossy (wetRough) and a touch dark (`darken`), then eases to
 * `dryRough` and its own colour over `secs`. An unlit material (no roughness) only changes colour.
 * The colour it dries to is the colour at the call; anyone who recolours the material mid-dry should
 * call stop() first. Returns {done, stop()}; stop() snaps it dry.
 */
export function dry(ctx, material, { secs = 20, wetRough = 0.18, dryRough = material?.roughness, darken = 0.1 } = {}) {
  if (!material) return { done: Promise.resolve(), stop() {} };
  const lit = typeof material.roughness === 'number';
  const base = material.color ? material.color.clone() : null;
  const wet = new THREE.Color();
  let t = 0;
  let resolve;
  const done = new Promise((r) => (resolve = r));
  const apply = (k) => {
    // k: 0 wet .. 1 dry
    const e = ease(k);
    if (lit) material.roughness = wetRough + (dryRough - wetRough) * e;
    if (base) material.color.copy(wet.copy(base).multiplyScalar(1 - darken * (1 - e)));
  };
  let off = null;
  const stop = () => {
    if (!off) return;
    off();
    off = null;
    apply(1);
    resolve();
  };
  apply(0);
  off = ctx.world.onUpdate((dt) => {
    t += dt;
    const k = Math.min(1, t / Math.max(0.01, secs));
    apply(k);
    if (k >= 1) stop();
  });
  return { done, stop };
}

/** The settle sound under a reveal: a soft low sine sinking 196 -> 180 Hz and a low breath of noise. */
export function settle(audio, { volume = 0.14 } = {}) {
  audio?.tone({ freq: 196, to: 180, dur: 0.6, volume, attack: 0.04 });
  audio?.noise({ type: 'lowpass', freq: 400, q: 0.7, dur: 0.25, volume: volume * 0.6, attack: 0.03 });
}

/**
 * The completion beat: the caller has framed the shot; this settles, pulses hope a little and holds
 * (gated, so a skip cuts it short). Input does nothing during the hold.
 */
export async function reveal(ctx, d, { hold = 1.2, pulse = 0.04, volume = 0.14 } = {}) {
  settle(ctx.audio, { volume });
  ctx.mood?.pulse(pulse);
  await d.wait(hold);
}
