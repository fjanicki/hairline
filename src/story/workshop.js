import * as THREE from 'three';
import { L } from './script.js';
import { mem } from './memory.js';
import { IN_X, GARAGE } from '../world/scenes/scene4/layout.js';
import { PRESETS } from '../render/Mood.js';
import { duckUnderVoice } from './crafts/sound.js';

// Odile's workshop (scene4) for every chapter that plays in it: Ch4 (Day 5, Day 8), Ch5 (Week 2 opening,
// Week 4 truing), Ch6 (Week 7 OPEN sign, Week 6 soup). Shared constants, the staging helpers the workshop
// beats use, and dressWorkshop(), which puts the room in the state an earlier chapter left it in (the
// chapters are separate builds, so a later chapter rebuilds scene4 from scratch).
//
//   const k = workshopKit(ctx, d, W);  // W = ctx.world.current (or the result of d.scene(...))
//   k.follow(true); await k.cut(() => { ... }, { card: L.ch5.cards.week4 }); await k.required('bike', S.bike, prompt);
//
// Shared by the chapter builders: add helpers here only additively (docs/API.md "Workshop kit").

/** The room camera (follows W.camRig, a clamped stand-in for the player). */
export const CAM = { offset: [0, 3.4, 3.6], look: [0, 1.0, -0.6] };
// Light: the workshop preset with less ambient and fill, so the bare bulb makes a warm pool and the
// corners fall off into brown dark (the room is lit by its practicals, see scene4/lights.js).
export const LOOK = { ...PRESETS.workshop, hemiIntensity: 0.9, fillIntensity: 1.5, envIntensity: 0.13, envIntensityHope: 0.2 };

// Sound (docs/assets/sfx.md, Ch4 Integration list). Beds: the workshop room tone (0.3, 0.25 in Week 4,
// 0.2 low-passed on the dry Week 7) and the rain on the roof on Day 5 / Day 8. Point sources: Odile's
// kettle, the radio on its crate, the garage door. The crafts play their own recorded cues.
export const SOUNDS = [
  'amb_workshop', 'amb_rain_window', 'fluoro_hum', 'fluoro_flicker', 'kettle_boil', 'radio_static', 'radio_talk_fishing',
  'tool_hook', 'tool_take', 'sand_stroke', 'sand_loop', 'tape_pull', 'tape_tock', 'table_tock', 'tape_retract', 'scaffold_creak',
  'plane_stroke', 'paint_lid_open', 'paint_drop', 'paint_stir_loop', 'paint_slosh', 'tin_tap', 'brush_stroke', 'creak_wood', 'creak_wood_alt',
  'garage_door_open', 'bike_bell', 'spoke_key', 'brake_rub', 'freewheel_tick', 'freewheel_coastdown', 'brush_wall_loop',
  // the notebook (UI.js) and the stumble (Player.js): docs/assets/sfx.md, Global
  'notebook_open', 'page_flip', 'notebook_close', 'pencil_write', 'pencil_erase', 'pencil_erase_alt', 'body_thud',
];
export const BED = { name: 'amb_workshop', volume: 0.3 };
export const RAIN = { name: 'amb_rain_window', volume: 0.2, lowpass: 900 };
export const SND = {
  kettle: [4.07, 0.55, 2.62],
  radio: [4.0, 0.45, 1.98],
  garage: [-IN_X, 1.2, (GARAGE.z0 + GARAGE.z1) / 2],
};
/** Chapter `camera` / `player` defaults for a chapter that opens in the workshop. */
export const CHAPTER_CAMERA = { offset: CAM.offset, look: CAM.look, fov: 55, lerp: 5 };
export const CHAPTER_PLAYER = { spawn: [3.4, -2.4], facing: 0, boot: true, limp: 0.85, painRate: 1 / 1.0, canJog: true, footsteps: 'boot' };

const clamp = THREE.MathUtils.clamp;

/**
 * Dress a fresh scene4 build as an earlier chapter left it. stage:
 *   'day8'  - after Ch4: sandpaper gone, the door sanded, painted in the player's grey (mem.doorGrey) and hung,
 *             holding its colour (focus slot 0)
 *   'week4' - the same (Sami's bike went home with him)
 *   'week7' - the same, plus the tube fixed and no rain (the OPEN sign itself is Ch6's beat)
 * The mood focus needs ctx.mood; the room otherwise stays as built (rain 1, flicker) for 'day8'.
 */
export function dressWorkshop(ctx, W, stage = 'day8') {
  if (!W?.door) return;
  W.takeSandpaper?.();
  W.door.setSand(1);
  W.door.setPaintColor(mem.doorGrey || L.ch4.day8.paintColor);
  W.door.setPaint(1);
  W.door.setBrush(false);
  W.hangDoor();
  ctx.mood?.focusOn(W.door.group, { slot: 0, strength: 0.5, decay: 0.15, floor: 0.5, offsetY: 1 });
  if (stage === 'week4') W.rain(0.25);
  if (stage === 'week7') {
    W.fluoro('on');
    W.rain(0);
  }
}

/**
 * The workshop beats' staging helpers (as Ch4 has always used them). All waits are gated, so
 * __game.debug.skip() progresses. Returns { follow, followShot, shot, back, faceTo, put, act, pose, putHugo,
 * hugoXZ, walk, nb, cut, required, roaming, kettleOn, kettleOff, addRoomSpots }.
 */
export function workshopKit(ctx, d, W) {
  const { ui, player, hotspots, audio, cam, runner } = ctx;

  const follow = (snap = false) => {
    const p = player.root.position;
    if (snap) W.camRig.position.set(clamp(p.x * 0.7, -1.1, 1.1), 0, clamp(p.z, -1.4, 1.9));
    cam.follow(W.camRig, { offset: CAM.offset, look: CAM.look, lerp: 4, snap });
  };
  const followShot = () => {
    const r = W.camRig.position;
    return { pos: [r.x + CAM.offset[0], CAM.offset[1], r.z + CAM.offset[2]], look: [r.x + CAM.look[0], CAM.look[1], r.z + CAM.look[2]], fov: 55 };
  };
  /** Tween to a fixed shot (skippable: a skip hard-cuts there). */
  const shot = (s, dur = 1.2) => {
    const target = typeof s === 'function' ? s() : s;
    if (dur <= 0) {
      cam.set(target);
      return Promise.resolve();
    }
    return d.gate(cam.tween(target, dur), () => {
      cam.set(target);
      return false;
    });
  };
  /** Back to the room camera (fov eases back first, then the follow takes over). */
  const back = async (dur = 0.9) => {
    await shot(followShot(), dur);
    follow();
  };
  const faceTo = (char, x, z) => {
    const p = char.root.position;
    char.root.rotation.y = Math.atan2(x - p.x, z - p.z);
  };
  const put = (char, [x, z], look) => {
    char.root.position.set(x, 0, z);
    if (look) faceTo(char, look[0], look[1]);
    char.play('idle', 0.2);
  };
  /** Clip choice for an NPC (staging only; a missing clip is a no-op). */
  const act = (char, clip, fade = 0.35) => char.play(clip, fade);
  /** Hugo holds a work pose (scripted, so the Player leaves the clip alone); null hands him back. */
  const pose = (clip) => {
    if (clip) {
      player.scripted = true;
      player.char.play(clip, 0.4);
    } else {
      player.char.play('idle', 0.4);
      player.scripted = false;
    }
  };
  const putHugo = ([x, z], look) => {
    player.teleport(x, z);
    if (look) player.face(look[0], look[1]);
  };
  const hugoXZ = () => [player.root.position.x, player.root.position.z];
  /** Gated NPC walk; a skip snaps the character to the end point. */
  const walk = (char, to, opts = {}) => {
    const h = runner.walkTo(char, to, { speed: 1.0, ...opts });
    return d.gate(h, () => {
      h.stop();
      char.root.position.set(to[0], 0, to[1]);
      if (opts.face !== undefined) char.root.rotation.y = opts.face;
      return false;
    });
  };
  /** A notebook promise (ui.notebook.add / strike / annotate), gated. */
  const nb = (p) => d.gate(p);
  /** Fade out, setup(), an optional week card, fade in. */
  const cut = async (setup, { out = 0.45, inn = 0.6, card = null } = {}) => {
    await d.gate(ui.fade(1, out));
    try {
      setup();
    } catch (err) {
      console.error('[workshop] cut setup failed', err);
    }
    if (card) await d.card(card, { big: true });
    await d.gate(ui.fade(0, inn));
  };

  // ---- sound
  /** Odile's kettle (a quiet 40 s point source; dips under the voices, stops at a cut). */
  let kettle = null;
  const kettleOn = () => {
    kettle?.stop(0.5);
    kettle = audio.sfx('kettle_boil', { volume: 0.25, bus: 'bus', pos: SND.kettle, ref: 1.5, jitter: 0, fallback: false });
    if (kettle) duckUnderVoice(ctx, kettle, { db: 6 });
  };
  const kettleOff = () => {
    kettle?.stop(0.6);
    kettle = null;
  };

  // Optional hotspots: only while the player is free to walk toward a required one.
  let roam = false;
  /** A required hotspot, then wait for it. extra: item options (Hotspots: needs, needsLine, ...). */
  const required = async (id, pos, prompt, onInteract, extra = {}) => {
    hotspots.add({ id, pos, prompt, required: true, onInteract, ...extra });
    roam = true;
    try {
      await d.interact(id);
    } finally {
      roam = false;
    }
  };

  /** The optional room hotspots (the old signs, the radio; L.ch4 text), live while a required one waits. */
  const addRoomSpots = () => {
    const S = W.spots;
    const T4 = L.ch4;
    hotspots.add({
      id: 'oldSigns',
      pos: S.oldSigns,
      prompt: T4.prompts.oldSigns,
      enabled: () => roam,
      onInteract: async () => {
        await d.say(T4.oldSigns);
      },
    });
    hotspots.add({
      id: 'radio',
      pos: S.radio,
      prompt: T4.prompts.radio,
      enabled: () => roam,
      onInteract: async () => {
        // A burst of static through the radio band, then the one station (the fishing man, babble)
        // low under her line.
        const st = audio.sfx('radio_static', { volume: 0.3, band: 'radio', pos: SND.radio, ref: 2, offset: Math.random() * 7, jitter: 0, fallback: (a) => a.noise({ type: 'bandpass', freq: 1600, q: 1.4, dur: 0.6, volume: 0.05 }) });
        if (st) {
          // 0.6 s of it, the last 0.2 s fading.
          st.gain.gain.setValueAtTime(0.3, audio.t + 0.4);
          st.gain.gain.linearRampToValueAtTime(0, audio.t + 0.6);
          try {
            st.src.stop(audio.t + 0.62);
          } catch {
            /* noop */
          }
        }
        const talk = audio.loopSfx('radio_talk_fishing', { volume: 0.1, bus: 'beds', band: 'radio', pos: SND.radio, ref: 2, fade: 0.4 });
        try {
          await d.wait(0.45);
          await d.say(T4.radio);
        } finally {
          talk.stop(0.6);
        }
      },
    });
  };

  return {
    follow, followShot, shot, back, faceTo, put, act, pose, putHugo, hugoXZ, walk, nb, cut, required,
    roaming: () => roam,
    kettleOn, kettleOff, addRoomSpots,
  };
}
