// Ch2 evening street: the recorded sound that belongs to the scene (docs/assets/sfx.md, Integration "Ch2").
//
//   streetHums(ctx, at)  point sources driven by scene2's update (the lights' flicker gates their hum):
//                        the doorway tube (fluoro_hum 0.12 x (1 - d/9)), Marco's neon and the buzzing sodium
//                        lamp (neon_buzz 0.1 within 8 m, highpass 150 Hz), the drips off the No. 14 lean-to
//                        (amb_drips 0.2, distance gain). Each is a loopSfx handle on 'bus' with rolloff 0
//                        (pan only); the gain window is the doc's linear one, computed here.
//   streetBeds(audio)    the chapter beds (through ambience(), so voices duck them): amb_street_night 0.35 +
//                        amb_city_far 0.2, and amb_street_wet 0.25 near the road end (z > -12), crossfaded
//                        with the night street by z. dip(on) lowers them ~4 dB (the ghost-sign linger).
//
// Both are evening-only (Ch5 builds the 'wall' variant of scene2 and owns its own sound).

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** at: { tube: [x,y,z], neon: [x,y,z], lamp: Object3D | [x,y,z], drips: [x,y,z] }. */
export function streetHums(ctx, at) {
  const audio = ctx.audio;
  if (!audio?.ok) return { update() {}, stop() {} };
  // 'beds': through the beds gain on the bus, so these hums duck under voices with the street beds.
  const loop = (name, pos, extra = {}) => audio.loopSfx(name, { volume: 0, bus: 'beds', pos, ref: 1, rolloff: 0, fade: 0.05, ...extra });
  const hums = {
    tube: at.tube && loop('fluoro_hum', at.tube),
    neon: at.neon && loop('neon_buzz', at.neon, { highpass: 150 }),
    lamp: at.lamp && loop('neon_buzz', at.lamp, { highpass: 150, rate: 0.94 }), // a different pitch from Marco's
    drips: at.drips && loop('amb_drips', at.drips),
  };
  const head = [0, 0, 0];
  const pt = (p) => (Array.isArray(p) ? p : p?.isObject3D ? [p.position.x, p.position.y, p.position.z] : null);
  const dist = (p) => {
    const q = pt(p);
    return q ? Math.hypot(q[0] - head[0], q[1] - head[1], q[2] - head[2]) : 99;
  };
  let stopped = false;
  return {
    /** Per frame. g: { tube: 0..1 (the tube's light), neon: 0..1, lamp: 0..1 }. */
    update(g = {}) {
      if (stopped) return;
      const p = ctx.player?.root?.position;
      if (!p) return;
      head[0] = p.x;
      head[1] = p.y + 1.5;
      head[2] = p.z;
      hums.tube?.set(0.12 * clamp01(1 - dist(at.tube) / 9) * (g.tube ?? 1), null, 0.03);
      hums.neon?.set(0.1 * clamp01(1 - dist(at.neon) / 8) * (g.neon ?? 1), null, 0.03);
      hums.lamp?.set(0.1 * clamp01(1 - dist(at.lamp) / 8) * (g.lamp ?? 1), null, 0.03);
      hums.drips?.set(0.2 * clamp01(1 - dist(at.drips) / 14), null, 0.3);
    },
    stop(fade = 0.3) {
      stopped = true;
      for (const h of Object.values(hums)) h?.stop(fade);
    },
  };
}

/** Street beds for Ch2 (call from run(); update(z) every frame; stop(fade) at the end). */
export function streetBeds(audio) {
  const BEDS = { night: ['amb_street_night', 0.35], far: ['amb_city_far', 0.2], wet: ['amb_street_wet', 0.25] };
  const last = {};
  let dip = 1;
  let z = 99;
  let on = true;
  const apply = (fade) => {
    // Wet road end: full at z > -8, gone by z < -16; the night street gives way by half there.
    const w = clamp01((z + 16) / 8);
    const vol = { night: 0.35 * (1 - 0.5 * w), far: 0.2, wet: 0.25 * w };
    for (const k in BEDS) {
      const v = +(vol[k] * dip).toFixed(3);
      if (last[k] !== undefined && Math.abs(v - last[k]) < 0.004) continue;
      last[k] = v;
      audio.ambience(BEDS[k][0], true, { volume: v, fade });
    }
  };
  return {
    start(z0, fade = 2.5) {
      z = z0;
      apply(fade);
    },
    update(z1) {
      if (!on) return;
      z = z1;
      apply(0.4);
    },
    /** The ghost-sign linger: the street steps back a little while the old letters take colour. */
    dip(down) {
      if (!on) return;
      dip = down ? 0.63 : 1;
      apply(down ? 1.2 : 2.5);
    },
    stop(fade = 0.3) {
      on = false;
      for (const k in BEDS) audio.ambience(BEDS[k][0], false, { fade });
    },
  };
}
