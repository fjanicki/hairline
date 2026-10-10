import * as THREE from 'three';
import { L } from './script.js';
import { remember } from './memory.js';
import { pocket, kindOf, onItems } from './items.js';
import { trueBike } from './ch4crafts.js';
import { wheelSound } from './crafts/sound.js';
import { buildScene4 } from '../world/scenes/scene4.js';
import { CHAPTER_LOOK } from '../player/CameraRig.js';
import { ch5Cast, chalkRing } from '../world/scenes/scene2/ch5-cast.js';
import { workshopProps, segmentScreen } from './ch5set.js';
import { LOOK, SOUNDS as WORKSHOP_SOUNDS, BED, RAIN, SND, CHAPTER_CAMERA, CHAPTER_PLAYER, workshopKit, dressWorkshop } from './workshop.js';
import { SETS } from './sets.js';

// Ch5 « Qui a huilé le rideau ? » (Revision 4, new): Weeks 2, 3 and 4 (docs/SCRIPT-R4.md §6, §17 overrides).
//   Week 2   the workshop (this chapter's own build: scene4): the spoke key is back, the case opens (L’AFFAIRE),
//            then up the street by day to Mme Benali's oiled shutter (PHOTO).
//   Week 3   4 h 10 the street at night, the bakery lit (CROISSANT); 10 h the workshop (Odile's brief, the chalk),
//            then the street hub: the bench (+ the old man asleep on it), Bastien (the STRIDE segment), Jo (ENCRE
//            FINE), optional Lou, Gérard, the slipper print (chalk + PHOTO); 16 h the workshop: Sami's PUNCTURE,
//            the wrap.
//   Week 4   the workshop (the old ch4 Week 4, moved with its lines unchanged): the spoke key from the pegboard,
//            TRUING, Jo comes in for a brush (between after[1] and after[2]), the laugh, the key hung back.
// The street is walked UP from No. 14 (toward +Z) in this chapter, so its follow camera looks +Z (STREET_CAM).
// Every await goes through the Director, so __game.debug.skip() always progresses.

const T = L.ch5;
const N = L.notebook.items;
const G = () => L.games;

// Sounds (docs/assets/sfx.md; .cache/r4/sfx-names.md), preloaded once at the chapter build: the workshop's,
// the street by day and at 4 a.m., the beats' cues and the three games' sets.
const SOUNDS = [
  ...WORKSHOP_SOUNDS,
  'amb_street_day', 'amb_city_far', 'amb_drips', 'neon_buzz', 'neon_flicker', 'tattoo_machine', 'amb_night_still', 'amb_bakery_night',
  'shutter_glide', 'oven_door', 'cloth_rustle', 'liquid_pour', 'stride_alert', 'run_step', 'chalk_line', 'pawl_click', 'door_slam', 'door_bell_shop', 'boot_step_wet',
  // PHOTO, CROISSANT, PUNCTURE
  'camera_shutter', 'dough_slap', 'dough_roll', 'water_slosh', 'bubble', 'bubble_chain', 'air_hiss', 'pump_stroke', 'velcro_rip',
];

// The street this chapter: Hugo comes out of No. 14 and walks up toward the bakery, so the camera sits on the
// -Z side and looks +Z (W walks up the street).
const STREET_CAM = { offset: [0, 2.6, -4.2], look: [0, 1.1, 0], fov: 55, lerp: 6 };
const NO14 = [0.6, -45.4]; // just out of the workshop's garage door, facing up the street
const DAWN = [-1.5, -18]; // 4 h 10: on the pavement, the bakery's glow ahead (SCRIPT-R4 §6.2)
const EXIT = [-3.85, 0.15]; // the workshop's garage door (the way out to the street)
// A close shot of the pegboard's spoke-key outline (scene4: pegboard x -2.62, y 1.75, back wall z -2.91).
const KEY_SHOT = { pos: [-1.5, 1.66, -0.7], look: [-2.55, 1.45, -2.9], fov: 46 };
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const dist2 = (p, q) => Math.hypot(p.x - q[0], p.z - q[1]);

export default {
  id: 'case',
  get title() {
    return T.title;
  },
  hope: 0.35,
  preset: LOOK,
  look: 'workshop', // opens in the workshop (CHAPTER_LOOKS[4] is the street by day)
  objective: null,
  music: { name: 'contemplation', volume: 0.3, fade: 3 },
  ambience: [],
  sounds: SOUNDS,
  camera: CHAPTER_CAMERA,
  player: { ...CHAPTER_PLAYER, limp: 0.8 },
  build: (ctx) => buildScene4(ctx),

  async run(ctx, d) {
    const { player } = ctx;
    player.firstStumbleDone = true;
    // The croissant given to Jo (SCRIPT-R4 §11.2 warmth+ joCroissant): the pocket's 'give' event, any scene.
    const offItems = onItems((e) => {
      if (e?.type === 'give' && e.id === 'croissant' && e.to === 'jo') remember('joCroissant', true);
    });
    try {
      const st = { ragsTaken: false };
      await week2(ctx, d, st);
      await dawn(ctx, d);
      await hub(ctx, d, st);
      const W = await afternoon(ctx, d, st);
      await week4(ctx, d, W);
      remember('ragsKept', d.has('rags')); // Ch6 starts with them (items.js SEED_IF; SCRIPT-R4 §1.5)
    } finally {
      offItems();
    }
  },
};

// ==================================================================== shared staging

/** The workshop's look limits (CameraRig CHAPTER_LOOK.workshop) while in the room; none on the street. */
function roomLimits(ctx, on) {
  const L0 = ctx.cam.limits;
  if (!L0) return;
  const c = on ? CHAPTER_LOOK.workshop : null;
  const DEG = Math.PI / 180;
  L0.yaw = c?.yaw ? [c.yaw[0] * DEG, c.yaw[1] * DEG] : null;
  if (c?.zoom) L0.zoom = [...c.zoom];
  else L0.zoom = [0.7, 1.4];
  if (c?.pitch) L0.pitch = [c.pitch[0] * DEG, c.pitch[1] * DEG];
  else L0.pitch = [10 * DEG, 55 * DEG];
  L0.box = c?.box ? { ...c.box } : null;
}

/** Is a gift held (the person spots only answer then, once their talk is done)? */
const holdingGift = () => {
  const h = pocket.selected?.();
  return !!h && kindOf(h) === 'gift';
};

/** Gated camera tween (a skip cuts there). */
const tween = (ctx, d, s, dur = 1.0) =>
  d.gate(ctx.cam.tween(s, dur), () => {
    ctx.cam.set(s);
    return false;
  });

/** Back to the street follow camera (eases back, keeps the player's look). */
const followStreet = (ctx) => ctx.cam.follow(ctx.player.root, { offset: STREET_CAM.offset, look: STREET_CAM.look, lerp: STREET_CAM.lerp });

/**
 * Hugo at a hotspot: in play he is already there (inside its ring); a skip or a test trigger fires it from
 * anywhere, so put him on its stand point first when he is far from it (no fade: it only happens then).
 */
function standBy(ctx, at, face) {
  const p = ctx.player.root.position;
  if (Math.hypot(p.x - at[0], p.z - at[1]) > 2.0) ctx.player.teleport(at[0], at[1]);
  if (face) ctx.player.face(face[0], face[1]);
}

/** Wait for any of the hotspot ids to fire (skip triggers the first one still there). */
function waitAny(ctx, d, ids) {
  const { hotspots } = ctx;
  d.state = 'play';
  return d.gate(Promise.race(ids.map((id) => hotspots.waitFor(id))), () => {
    const id = ids.find((i) => hotspots.get(i));
    if (id) {
      hotspots.trigger(id);
      return true;
    }
    return false;
  });
}

/** Turn `char` and Hugo to each other, a two-shot, the talk clip; d.say(lines); back to the home clip. */
async function talkTo(ctx, d, cast, id, lines, { shot, clip = 'talk', keep = false } = {}) {
  const c = cast[id]?.char;
  const { player } = ctx;
  if (c) {
    const p = player.root.position;
    const q = c.root.position;
    player.face(q.x, q.z);
    if (cast[id].home?.clip !== 'sit_idle' && cast[id].home?.clip !== 'run') c.root.rotation.y = Math.atan2(p.x - q.x, p.z - q.z);
    if (clip && cast[id].home?.clip !== 'run' && cast[id].home?.clip !== 'sit_idle') c.play(clip, 0.3);
  }
  await tween(ctx, d, shot || (c ? cast.talkShot(c) : null), 0.9);
  await d.say(lines);
  if (c && !keep) cast.home(id);
}

/** Street beds by day (SCRIPT-R4 §6: overcast, wet 0.4): the recorded beds through ambience(). */
function dayBeds(audio, on) {
  audio.ambience('amb_street_day', on, { volume: 0.3, fade: on ? 2 : 0.8 });
  audio.ambience('amb_city_far', on, { volume: 0.15, fade: on ? 2 : 0.8 });
  audio.ambience('amb_drips', on, { volume: 0.06, fade: on ? 2 : 0.8 });
}

/**
 * The street's point sounds while Hugo walks it by day: the neon's sputter near CHEZ GÉRARD (flickering in
 * Weeks 2-5) and ENCRE FINE's tattoo machine. Returns { stop(), dip(on) } (world.onUpdate: a scene swap ends it).
 */
function streetSounds(ctx, W) {
  const { audio, player, world } = ctx;
  const neonAt = W.anchors?.neon || [-5.2, 3.2, -32.5];
  const encre = W.encre?.spots?.encreInside || [-7, -39.4];
  const machine = audio.loopSfx?.('tattoo_machine', { volume: 0, bus: 'beds', pos: [encre[0], 1.1, encre[1]], ref: 2, fade: 0.2 }) || null;
  let nextFlick = 1.5;
  let t = 0;
  let dipped = false;
  let stopped = false;
  const off = world.onUpdate((dt) => {
    if (stopped) return;
    t += dt;
    const p = player.root.position;
    const dn = Math.hypot(p.x - neonAt[0], p.z - neonAt[2]);
    if (t > nextFlick) {
      nextFlick = t + 1.4 + Math.random() * 3;
      if (dn < 10) audio.sfx('neon_flicker', { volume: 0.15 * clamp01(1.2 - dn / 10), bus: 'bus', pos: neonAt, ref: 3, fallback: false });
    }
    const de = Math.hypot(p.x - encre[0], p.z - encre[1]);
    machine?.set((dipped ? 0.05 : 0.12) * clamp01(1 - de / 9), null, 0.2);
  });
  return {
    dip(on) {
      dipped = !!on;
    },
    stop() {
      stopped = true;
      off?.();
      machine?.stop(0.4);
    },
  };
}

// ==================================================================== WEEK 2 (§6.1)

async function week2(ctx, d, st) {
  const { ui, player, audio, hotspots, cam } = ctx;
  let W = ctx.world.current;
  dressWorkshop(ctx, W, 'day8'); // the door he painted, hung and holding its colour
  W.rain(0.25);
  const props = workshopProps(W); // the spoke key back in its outline; the rags beside it
  const k = workshopKit(ctx, d, W);
  const S = W.spots;
  const O = W.odile;
  roomLimits(ctx, true);
  audio.ambience(BED.name, true, { volume: BED.volume, fade: 2 });
  k.put(O, [-3.25, -1.35], [S.pegboard[0], -3]); // left of the board, out of the key's close shot
  k.act(O, 'arms_crossed', 0.1);
  k.putHugo([-1.1, -0.95], [-2.6, -2.9]);
  k.follow(true);
  cam.set(W.shots?.pegboard || KEY_SHOT); // scene4's close shot of the lower row (the key's outline)
  await d.card(T.cards.week2, { big: true });
  const WS = T.week2.workshop;
  await d.say(WS.slice(0, 1)); // the key is back, clean, oiled; the rags
  await k.back(1.0);
  k.faceTo(O, ...k.hugoXZ());
  player.face(O.root.position.x, O.root.position.z);
  k.act(O, 'talk');
  await d.say(WS.slice(1, 5));
  k.act(O, 'arms_crossed'); // she looks at him a long time; then the boot; then him
  await d.say(WS.slice(5, 6));
  k.act(O, 'talk');
  await d.say(WS.slice(6, 11));
  k.act(O, 'arms_crossed');
  await d.say(WS.slice(11, 12)); // he turns the exercise book over
  // L’AFFAIRE: the back pages, the heading written on, the first clue and the first pin (his own).
  ui.notebook.open(0);
  audio.sfx('page_flip', { volume: 0.3, fallback: false });
  d.openCase();
  await d.wait(1.2);
  d.clue('cleanKey');
  await d.wait(1.4);
  d.suspect('hugo', { status: 'none' });
  await d.wait(1.4);
  ui.notebook.dock();
  k.act(O, 'talk');
  await d.say(WS.slice(12));
  k.act(O, 'arms_crossed');
  ui.objective(T.objectives.benali);

  // Optional while he heads for the door: the rags, the radio (Week 2's line), the old signs, gifts for Odile.
  k.addRoomSpots();
  hotspots.remove('radio');
  roomSpots(ctx, d, W, k, { radio: T.week2.radio, rags: () => !st.ragsTaken, onRags: () => ((st.ragsTaken = true), props.setRags(false)) });
  await k.required('exit', EXIT, T.prompts.talk, null, { auto: true, radius: 0.85 });
  ui.objective(T.objectives.benali);
  audio.ambience(BED.name, false, { fade: 0.8 });

  // ------------------------------------------------------------ up the street to the bakery
  W = await d.scene(SETS.street('day', { player: { spawn: NO14, facing: 0 }, camera: STREET_CAM }));
  roomLimits(ctx, false);
  W.fixes?.shutter(true); // oiled in the night: it rises like a shutter
  W.bakery?.setOpen(1);
  W.marks?.print(false); // the slipper print is Week 3's
  const cast = ch5Cast(ctx, W, ['benali', 'gerard']);
  dayBeds(audio, true);
  const sounds = streetSounds(ctx, W);
  const S2 = W.spots;

  // Gérard's pre-emptive bark, once, within 4.5 m of his neon (SCRIPT-R4 §6.1).
  let barked = false;
  ctx.world.onUpdate(() => {
    if (barked || d.state !== 'play' || ui.modal) return;
    const p = player.root.position;
    if (dist2(p, S2.neon || [-4.3, -32]) < 5.6) { // §6.1 says 4.5 m; the middle of the road passes at 4.9 (PT57 #6)
      barked = true;
      const g = cast.gerard.char;
      g.root.rotation.y = Math.atan2(p.x - g.root.position.x, p.z - g.root.position.z);
      g.play('talk', 0.3);
      d.thought(T.week2.neon.text, 4.5, { who: T.week2.neon.who });
      d.after(4.5, () => cast.home('gerard'));
    }
  });

  // Mme Benali, at her door (required).
  const bd = S2.benaliDoor || [-4.5, -8.8];
  hotspots.add({
    id: 'benali',
    pos: [bd[0] + 0.85, bd[1]],
    radius: 1.5,
    prompt: T.prompts.talk,
    required: true,
    person: 'benali',
    onInteract: async () => {
      sounds.dip(true);
      standBy(ctx, [bd[0] + 0.85, bd[1]], bd);
      await talkTo(ctx, d, cast, 'benali', T.week2.benali, { keep: true });
      followStreet(ctx);
    },
  });
  await d.interact('benali');
  cast.home('benali');
  ui.objective(T.objectives.photo);

  // The shutter's rail: PHOTO (needs the phone: always in the pocket, used by itself).
  const rail = S2.shutter || [-4.45, -10.6];
  hotspots.add({
    id: 'shutterRunner',
    pos: [rail[0] + 0.75, rail[1]],
    radius: 1.3,
    prompt: T.prompts.shutterRunner,
    required: true,
    needs: 'phone',
    object: 'door',
    onInteract: async () => {
      standBy(ctx, [rail[0] + 0.75, rail[1] + 0.3], rail);
      await d.game('photo', { text: G().photo, target: W.anchors?.shutterRail || [-5.9, 1.25, -10.6], radius: 0.22 });
      await d.think(G().photo.good.hinge);
      const b = cast.benali.char;
      b.root.rotation.y = Math.atan2(player.root.position.x - b.root.position.x, player.root.position.z - b.root.position.z);
      b.play('talk', 0.3);
      await d.say(T.week2.photoDone);
      cast.home('benali');
      d.clue('photoHinge');
      d.hope(0.36); // no notebook entry: the phone knows how, not him (§0.4.12)
    },
  });
  await d.interact('shutterRunner');
  ui.objective(null);
  sounds.dip(false);
  followStreet(ctx);

  // Walking away: the thought, a few steps, then the Week 3 card.
  d.thought(T.week2.end, 6);
  const from = player.root.position.clone();
  let t = 0;
  await d.until((dt) => {
    t += dt;
    return t > 7 || (t > 3.5 && player.root.position.distanceTo(from) > 2.5);
  });
  sounds.stop();
  dayBeds(audio, false);
}

/** The workshop's optional spots while a required one waits: the rags, the radio, gifts to Odile. */
function roomSpots(ctx, d, W, k, { radio = null, rags = null, onRags = null } = {}) {
  const { hotspots, audio } = ctx;
  const S = W.spots;
  if (rags) {
    hotspots.add({
      id: 'rags',
      pos: [S.pegboard[0] + 0.35, S.pegboard[1] + 0.1],
      radius: 1.0,
      prompt: T.prompts.rags,
      enabled: () => k.roaming() && rags(),
      onInteract: async () => {
        ctx.player.face(S.pegboard[0] + 0.3, -3);
        audio.sfx('cloth_rustle', { volume: 0.25, rate: 0.9 + Math.random() * 0.2, fallback: false });
        onRags?.();
        d.give('rags');
        await d.say(T.week2.rags);
      },
    });
  }
  if (radio) {
    hotspots.add({
      id: 'radio',
      pos: S.radio,
      prompt: L.ch4.prompts.radio,
      enabled: () => k.roaming(),
      onInteract: async () => {
        audio.sfx('radio_static', { volume: 0.25, band: 'radio', pos: SND.radio, ref: 2, offset: Math.random() * 7, jitter: 0, fallback: false });
        const talk = audio.loopSfx('radio_talk_fishing', { volume: 0.08, bus: 'beds', band: 'radio', pos: SND.radio, ref: 2, fade: 0.4 });
        try {
          await d.wait(0.4);
          await d.say([{ who: 'Radio', text: radio.radio }]);
          talk.stop(0.5);
          await d.say(radio.after);
        } finally {
          talk.stop(0.5);
        }
      },
    });
  }
  // Odile takes gifts (the croissant, the rags) while he walks: only answers when one is held.
  const O = W.odile;
  hotspots.add({
    id: 'odileGift',
    pos: [O.root.position.x, O.root.position.z + 0.5],
    radius: 1.3,
    prompt: T.prompts.talk,
    person: 'odile',
    once: false,
    enabled: () => k.roaming() && holdingGift(),
    onInteract: async () => {},
  });
}

// ==================================================================== WEEK 3, 4 h 10 (§6.2)

async function dawn(ctx, d) {
  const { ui, player, audio, hotspots } = ctx;
  const W = await d.scene(SETS.street('night', { player: { spawn: DAWN, facing: 0 }, camera: STREET_CAM }), { card: T.cards.week3 });
  roomLimits(ctx, false);
  // 4 a.m.: the bakery lit, the shutter half up, the floured board out; CHEZ GÉRARD shut (the neon off), the
  // bench already mended (Friday night), the shutter oiled (Week 2). The neon is rewired only in Week 6.
  W.bakery?.setLit(true);
  W.bakery?.setOpen(0.38);
  W.fixes?.neon(false);
  W.neon?.setOn(false);
  W.fixes?.bench(true);
  W.fixes?.shutter(true);
  W.marks?.print(false);
  const cast = ch5Cast(ctx, W, ['benali']);
  const bd = W.spots.benaliDoor || [-4.5, -8.8];
  cast.benali.home = { pos: [bd[0] + 0.25, bd[1] - 0.9], rot: Math.PI / 2 + 0.5, clip: 'idle' };
  cast.home('benali');
  // Beds: the empty street at 4 a.m.; the bakery's kitchen through the half-raised shutter (closer = clearer).
  const still = audio.loopSfx('amb_night_still', { volume: 0.3, bus: 'beds', fade: 2 });
  const oven = audio.loopSfx('amb_bakery_night', { volume: 0.12, bus: 'beds', lowpass: 1500, pos: [-5.5, 1.2, -9], ref: 3, fade: 2 });
  const off = ctx.world.onUpdate(() => {
    const dz = dist2(player.root.position, [-5, -9]);
    oven?.set(0.12 + 0.18 * clamp01(1 - dz / 9), null, 0.4);
  });
  ui.caption(T.captions.dawn, { secs: 3.5 });
  d.thought(T.week3.dawn[0], 4);
  // The second thought 2 s later, unless he is already at the counter (it would wait for, and show over, CROISSANT).
  let atCounter = false;
  d.after(2, () => !atCounter && !ui.modal && d.state === 'play' && d.thought(T.week3.dawn[1], 4.5));
  ui.objective(T.objectives.bakery);

  hotspots.add({
    id: 'benali',
    pos: [bd[0] + 1.05, bd[1] - 0.9],
    radius: 1.6,
    prompt: T.prompts.talk,
    required: true,
    person: 'benali',
    onInteract: async () => {
      atCounter = true;
      ui.objective(null);
      standBy(ctx, [bd[0] + 1.05, bd[1] - 0.9], [bd[0] + 0.25, bd[1] - 0.9]);
      // She sees him and pushes the shutter up a little more: no shriek (it was oiled). The joke is the silence.
      W.bakery?.setOpen(0.5, 1.6);
      audio.sfx('shutter_glide', { volume: 0.3, pos: [-5.9, 1.4, -9.5], ref: 3, fallback: false });
      await talkTo(ctx, d, cast, 'benali', T.week3.benali, { keep: true });
      d.suspect('benali'); // pinned at dawn, à vérifier until the croissants
      // CROISSANT at the floured board.
      if (W.shots?.croissant) await tween(ctx, d, W.shots.croissant, 1.0);
      await d.game('croissant', { count: 3, text: G().croissant });
      // Her tier line is the game's own bark: let it be said before her next line.
      await d.thoughtDone(1.2, 5);
      await tween(ctx, d, cast.talkShot(cast.benali.char), 0.8);
      const BA = T.week3.benaliAfter;
      audio.sfx('oven_door', { volume: 0.4, pos: [-6.5, 1, -9], ref: 3, fallback: false }); // the trays go in
      cast.benali.char.play('talk', 0.3);
      await d.say(BA.slice(0, 2));
      cast.benali.char.play('reach', 0.3, { once: true });
      d.give('croissant'); // the most lunar one, whatever the tier
      await d.say(BA.slice(2, 3));
      ui.notebook.open(0);
      await d.gate(ui.notebook.add(N.croissant));
      await d.say(BA.slice(3, 4)); // he thinks, then adds a word
      await d.gate(ui.notebook.annotate(N.croissant, L.notebook.notes.moon));
      ui.notebook.dock();
      d.suspect('benali', { status: 'checked' });
      d.hope(0.38);
    },
  });
  await d.interact('benali');
  followStreet(ctx);
  await d.wait(1.2);
  off?.();
  still?.stop(1);
  oven?.stop(1);
}

// ==================================================================== WEEK 3, 10 h: brief, then the hub (§6.3)

async function hub(ctx, d, st) {
  const { ui, player, audio, hotspots, runner, cam } = ctx;
  // ------------------------------------------------------------ the workshop: Odile's brief, the chalk
  let W = await d.scene(SETS.workshop({ player: { spawn: [-0.4, -0.9], facing: Math.PI } }), { fadeIn: false });
  roomLimits(ctx, true);
  dressWorkshop(ctx, W, 'day8');
  W.rain(0);
  W.fluoro('on');
  const props = workshopProps(W);
  props.setRags(!st.ragsTaken);
  const k = workshopKit(ctx, d, W);
  const S = W.spots;
  const O = W.odile;
  audio.ambience(BED.name, true, { volume: BED.volume, fade: 1.5 });
  await k.cut(() => {
    k.put(O, S.odileBench, [-0.4, -0.9]);
    k.putHugo([-0.35, -0.95], [S.odileBench[0], S.odileBench[1]]);
    k.faceTo(O, -0.35, -0.95);
    k.act(O, 'talk', 0.1);
    k.follow(true);
  });
  ui.caption(T.captions.morning, { secs: 3 });
  await d.say(T.week3.brief.slice(0, 2));
  O.play('reach', 0.3, { once: true }); // her tailor's chalk
  d.give('chalk');
  await d.say(T.week3.brief.slice(2));
  k.act(O, 'arms_crossed');
  const both = () => (st.bench ? T.objectives.street : `${T.objectives.street} ${T.objectives.bench}`);
  ui.objective(both());
  k.addRoomSpots(); // the old signs and the radio (Ch4's lines), optional on the way out
  roomSpots(ctx, d, W, k, { rags: () => !st.ragsTaken, onRags: () => ((st.ragsTaken = true), props.setRags(false)) });
  await k.required('exit', EXIT, T.prompts.talk, null, { auto: true, radius: 0.85 });
  audio.ambience(BED.name, false, { fade: 0.8 });

  // ------------------------------------------------------------ the street hub
  W = await d.scene(SETS.street('day', { player: { spawn: NO14, facing: 0 }, camera: STREET_CAM }));
  roomLimits(ctx, false);
  W.fixes?.shutter(true);
  W.fixes?.bench(true); // three new slats, cut at 52, Bleu Durand
  W.bakery?.setOpen(1);
  W.marks?.print(true);
  W.encre?.setOpen(0);
  const cast = ch5Cast(ctx, W, ['benali', 'gerard', 'lou', 'bastien', 'jo', 'oldman']);
  dayBeds(audio, true);
  const sounds = streetSounds(ctx, W);
  const SP = W.spots;
  ui.objective(both());
  let roam = true;
  const done = new Set();
  const REQUIRED = ['bench', 'bastien', 'jo'];

  // Bastien's feet while he jogs on the spot (run_step near him).
  let jogging = true;
  let stepT = 0;
  ctx.world.onUpdate((dt) => {
    if (!jogging) return;
    stepT += dt;
    if (stepT < 0.37) return;
    stepT = 0;
    const b = cast.bastien.char.root.position;
    const dd = player.root.position.distanceTo(b);
    if (dd < 11) audio.sfx('run_step', { volume: 0.18 * clamp01(1.1 - dd / 11), pos: [b.x, 0.1, b.z], ref: 2, jitter: 0.05, fallback: false });
  });

  /** A person: talk once (`talk`), then only answers a held gift (Hotspots: L.items.give.<item>.<id>). */
  const person = (id, pos, prompt, talk, { required = false, radius = 1.35, gone } = {}) => {
    let talked = false;
    hotspots.add({
      id,
      pos,
      radius,
      prompt,
      required,
      once: false,
      person: id,
      takesGifts: () => talked, // the interview first: a held gift waits (PT57 #11)
      enabled: () => roam && !gone?.(),
      onInteract: async () => {
        if (talked) return;
        talked = true;
        sounds.dip(true);
        try {
          standBy(ctx, pos);
          await talk();
        } finally {
          sounds.dip(false);
          followStreet(ctx);
        }
        done.add(id);
        // From now on the spot only takes gifts (no ring beam, no pointer: it is not required any more).
        hotspots.add({ id, pos, radius, prompt, once: false, person: id, enabled: () => roam && !gone?.() && holdingGift(), onInteract: async () => {} });
      },
    });
  };

  // ---- the bench (required; needs the tape) and the old man asleep on it
  const seat = W.seat || { x: -5.32, z: -36.5 };
  let oldmanGone = false;
  hotspots.add({
    id: 'bench',
    pos: [seat.x + 0.9, seat.z + 0.45],
    radius: 0.95,
    prompt: T.prompts.bench,
    required: true,
    needs: 'tape',
    object: 'bench',
    enabled: () => roam,
    onInteract: async () => {
      try {
        await benchScene();
      } finally {
        followStreet(ctx); // back behind him (the bench shot used to stay put while he walked off)
      }
      done.add('bench');
      st.bench = true;
      ui.objective(both());
    },
  });
  person('oldman', [seat.x + 0.85, seat.z - 0.85], T.prompts.oldman, () => d.say(T.week3.oldmanLook), { radius: 0.7, gone: () => oldmanGone });

  async function benchScene() {
    const om = cast.oldman;
    standBy(ctx, [seat.x + 0.9, seat.z + 0.45]);
    player.face(seat.x, seat.z);
    await tween(ctx, d, W.shots.bench || cast.talkShot(om.char), 1.0);
    await d.say(T.week3.bench.slice(0, 1));
    // Measure twice: the tape out to the slat's end, the tock, back in.
    for (const line of [1, 2]) {
      await d.gate(player.crouch(0.5));
      audio.sfx('tape_pull', { volume: 0.35, fallback: false });
      await d.wait(0.6);
      audio.sfx('tape_tock', { volume: 0.4, jitter: 0.05, fallback: false });
      await d.say(T.week3.bench.slice(line, line + 1));
      audio.sfx('tape_retract', { volume: 0.35, fallback: false });
      await d.gate(player.stand(0.5));
    }
    if (W.shots.benchSlats) await tween(ctx, d, W.shots.benchSlats, 0.8);
    await d.say(T.week3.bench.slice(3, 5));
    d.clue('slat52');
    await d.wait(0.9);
    d.clue('blueChip');
    await d.wait(0.6);
    await tween(ctx, d, W.shots.bench || cast.talkShot(om.char), 0.8);
    om.char.play('sit_talk', 0.5); // he wakes
    await d.say(T.week3.bench.slice(5, 10));
    // He gets up, takes his bike by the handlebars and walks off: one click per wheel turn.
    oldmanGone = true;
    hotspots.remove('oldman');
    audio.sfx('creak_wood', { volume: 0.3, alt: 'creak_wood_alt', pos: [seat.x, 0.5, seat.z], ref: 2, fallback: false });
    const c = om.char;
    om.push();
    c.root.position.set(seat.x + 0.55, c.root.position.y, seat.z - 0.6);
    c.root.rotation.y = 0; // up the street (+Z)
    c.play('walk', 0.4);
    const pace = c.pace || 0.6;
    const away = runner.walkTo(c, [-4.55, -14], { speed: pace });
    let clickT = 0;
    let walking = true;
    const offClicks = ctx.world.onUpdate((dt) => {
      if (!walking) return;
      clickT += dt;
      if (clickT < 0.55) return;
      clickT = 0;
      const q = c.root.position;
      const dd = player.root.position.distanceTo(q);
      audio.sfx('pawl_click', { volume: Math.max(0.05, 0.35 - dd * 0.02), jitter: 0.03, pos: [q.x - 0.4, 0.35, q.z], ref: 3, lowpass: dd > 8 ? 2500 : undefined, fallback: false });
      if (dd > 22) {
        walking = false;
        c.root.visible = false;
      }
    });
    await d.wait(0.8);
    await d.say(T.week3.bench.slice(10, 11)); // stage: « Clic. Clic. Clic. »
    await d.wait(1.2);
    await d.say(T.week3.bench.slice(11));
    d.suspect('oldman', { status: 'none' });
    // He keeps walking (and clicking) up the street until he is out of earshot; then he is gone for good.
    d.after(30, () => {
      walking = false;
      away.stop?.();
      c.root.visible = false;
      offClicks?.();
    });
  }

  // ---- Bastien (required), jogging on the spot by the billboard
  const bp = SP.bastien || [-3.4, -17.5];
  let bastienGone = false;
  person(
    'bastien',
    [bp[0] + 0.9, bp[1]],
    T.prompts.talk,
    async () => {
      const B = T.week3.bastien;
      await talkTo(ctx, d, cast, 'bastien', B.slice(0, 4), { keep: true });
      await d.say(B.slice(4, 5));
      cast.bastien.char.play('reach', 0.2, { once: true }); // he turns his wrist to Hugo's face
      await d.wait(0.5);
      cast.home('bastien');
      await d.say(B.slice(5, 9));
      await segmentScreen(ctx, d, T.week3.segment);
      const A = T.week3.bastienAfter;
      await d.say(A.slice(0, 2));
      d.clue('segmentD52');
      await d.wait(0.6);
      d.suspect('bastien', { status: 'checked' });
      await d.say(A.slice(2));
      // He jogs off up the street, never pausing (his watch would).
      const b = cast.bastien.char;
      jogging = false;
      bastienGone = true;
      b.play('run', 0.3);
      const h = runner.walkTo(b, [2.2, 12], { speed: 3.4, run: true });
      d.after(9, () => {
        h.stop?.();
        b.root.visible = false;
      });
    },
    { required: true, gone: () => bastienGone },
  );

  // ---- Jo (required), inside ENCRE FINE
  const jd = W.encre?.spots?.joDoor || [-5.2, -40.9];
  person('jo', [jd[0] + 0.7, jd[1]], T.prompts.jo, () => joScene(), { required: true });

  async function joScene() {
    const E = W.encre;
    const jo = cast.jo.char;
    // ENCRE FINE's room frame (scene2/encre.js: left side, +x along the facade = world -z, +z out to the
    // street): world = [X0 + z, Z0 - x], from the encreInside spot (local -0.4, -2.0).
    const inside = E?.spots?.encreInside || [-7.95, -38.95];
    const X0 = inside[0] + 2.0;
    const Z0 = inside[1] - 0.4;
    const at = (x, z) => [X0 + z, Z0 - x];
    await d.gate(ui.fade(1, 0.45));
    E?.setOpen(1);
    audio.sfx('door_bell_shop', { volume: 0.25, rate: 1.1, fallback: false });
    // Hugo just inside the door, Jo in front of her flash wall, facing him.
    const h = at(1.3, -1.25);
    const j = at(0.05, -2.45);
    player.teleport(h[0], h[1]);
    jo.root.position.set(j[0], jo.root.position.y, j[1]);
    jo.root.rotation.y = Math.atan2(h[0] - j[0], h[1] - j[1]);
    player.face(j[0], j[1]);
    jo.play('talk', 0.1);
    // A two-shot from inside the window: both in profile, the flash wall behind them.
    const c = at(-0.95, -0.3);
    const m = at(0.68, -1.85);
    cam.set({ pos: [c[0], 1.62, c[1]], look: [m[0], 1.38, m[1]], fov: 52 });
    await d.gate(ui.fade(0, 0.55));
    audio.sfx('liquid_pour', { volume: 0.3, fallback: false }); // already pouring
    const J = T.week3.jo;
    await d.say(J.slice(0, 10));
    await d.say(J.slice(10, 11)); // the alibi: a kite, still red
    d.suspect('jo', { status: 'checked' });
    audio.sfx('cloth_rustle', { volume: 0.25, rate: 0.95, fallback: false }); // she rolls her sleeve up
    jo.play('stand', 0.3);
    await d.say(J.slice(11, 12));
    jo.play('talk', 0.3);
    await d.say(J.slice(12));
    const r = await d.choose(T.week3.joMenu); // the Director plays her reply
    if (r === 1 || r === 2) remember('joLearned', true);
    await d.say(T.week3.joAfter);
    await d.gate(ui.fade(1, 0.4));
    E?.setOpen(0);
    cast.home('jo');
    player.teleport(jd[0] + 0.85, jd[1] + 0.2);
    player.face(0, jd[1] + 6);
    followStreet(ctx);
    cam.snap?.();
    await d.gate(ui.fade(0, 0.5));
  }

  // ---- Lou (optional), against the wall by CHEZ GÉRARD
  const lp = SP.louWall || [-4.6, -26.5];
  person('lou', [lp[0] + 0.9, lp[1]], T.prompts.talk, async () => {
    const Lw = T.week3.lou;
    await talkTo(ctx, d, cast, 'lou', Lw.slice(0, 7), { keep: true });
    await d.say(Lw.slice(7, 8));
    d.clue('louPhoto');
    d.suspect('lou', { status: 'checked' });
    await d.say(Lw.slice(8));
    cast.home('lou');
  });

  // ---- Gérard (optional), at his counter window; the neon flickers through it
  const gp = SP.gerardCounter || [-4.55, -34.2];
  person('gerard', [gp[0] + 0.95, gp[1] + 0.35], T.prompts.talk, async () => {
    const neonAt = W.anchors?.neon || [-5.2, 3.2, -32.5];
    const flick = setInterval(() => audio.sfx('neon_flicker', { volume: 0.12, bus: 'bus', pos: neonAt, ref: 3, fallback: false }), 1700);
    try {
      await talkTo(ctx, d, cast, 'gerard', T.week3.gerard);
    } finally {
      clearInterval(flick);
    }
    d.suspect('gerard', { status: 'toCheck' });
  });

  // ---- the slipper print (optional): look, then the chalk (needs it), then PHOTO
  // The ring a step out from the doorstep: the camera looks up the street from behind Hugo, and at the
  // doorstep itself it would sit inside No. 14's facade.
  const pp = [3.6, -46.3];
  const printAt = [3.75, -47.6]; // scene2: printMark at DOOR_Z + 0.4
  // For the close shot (W.shots.print sits just above the ring) he steps aside, left of the lens:
  // standing on the ring, his shoulder filled the right of the frame.
  const printStand = () => {
    const side = [2.35, -46.85];
    if (player.inBounds(side[0], side[1])) player.teleport(side[0], side[1]);
    else standBy(ctx, pp);
    player.face(printAt[0], printAt[1]);
  };
  hotspots.add({
    id: 'print',
    pos: pp,
    radius: 1.1,
    prompt: T.prompts.print,
    enabled: () => roam,
    onInteract: async () => {
      printStand();
      if (W.shots.print) await tween(ctx, d, W.shots.print, 0.9);
      await d.say(T.week3.print);
      followStreet(ctx);
      hotspots.add({
        id: 'printChalk',
        pos: pp,
        radius: 1.1,
        prompt: T.prompts.printChalk,
        needs: 'chalk',
        needsLine: T.needs.printChalk,
        object: 'print',
        enabled: () => roam,
        onInteract: async () => {
          printStand();
          if (W.shots.print) await tween(ctx, d, W.shots.print, 0.6);
          await d.gate(player.crouch(0.5));
          audio.sfx('chalk_line', { volume: 0.35, fallback: false });
          audio.sfx('chalk_line', { volume: 0.3, delay: 0.55, fallback: false });
          W.group.add(chalkRing(printAt, { rx: 0.23, rz: 0.3 }));
          await d.wait(0.9);
          await d.gate(player.stand(0.5));
          await d.say(T.week3.printChalk);
          await d.game('photo', { text: G().photo, target: [printAt[0], 0.05, printAt[1]], radius: 0.16 });
          await d.think(G().photo.good.print);
          d.clue('slipperPrint');
          followStreet(ctx);
        },
      });
    },
  });

  // Near the print the street camera (behind him, looking up the street) faces Hugo, with the doorstep
  // behind him off screen (PT57 #4): within 2.2 m of the print it swings round to look down at No. 14.
  const PRINT_CAM = { offset: [-0.9, 2.5, 3.9], look: [0, 0.6, -1.0], lerp: 3 };
  let printCam = false;
  const offPrintCam = ctx.world.onUpdate(() => {
    if (!roam || d.state !== 'play' || cam.mode !== 'follow' || cam._tween) return;
    const p = player.root.position;
    const dist = Math.hypot(p.x - pp[0], p.z - pp[1]);
    const want = dist < 2.2 || (printCam && dist < 3.2);
    if (want && (!printCam || cam._baseOffset.z < 0)) {
      printCam = true;
      cam.follow(player.root, PRINT_CAM);
    } else if (!want && printCam) {
      printCam = false;
      followStreet(ctx);
    }
  });

  // ---- Mme Benali at her door: gifts only (she was seen at dawn)
  const bd = SP.benaliDoor || [-4.5, -8.8];
  hotspots.add({ id: 'benaliGift', pos: [bd[0] + 0.85, bd[1]], radius: 1.3, prompt: T.prompts.talk, person: 'benali', once: false, enabled: () => roam && holdingGift(), onInteract: async () => {} });

  // ------------------------------------------------------------ until the bench, Bastien and Jo are done
  while (!REQUIRED.every((id) => done.has(id))) {
    await waitAny(ctx, d, REQUIRED.filter((id) => !done.has(id)));
  }
  roam = false;
  offPrintCam?.();
  if (printCam) followStreet(ctx);
  ui.objective(null);
  d.thought(T.week3.hubDone, 6);
  if (!done.has('lou')) d.suspect('lou', { status: 'toCheck' });
  if (!done.has('gerard')) d.suspect('gerard', { status: 'toCheck' });
  let w = 0;
  // The whole thought, then the cut (it used to run on over the 16 H workshop: PT57 #12).
  await d.until((dt) => (w += dt) > 9 || (w > 6.3 && !ui.thoughtSpeaking?.()));
  sounds.stop();
  dayBeds(audio, false);
}

// ==================================================================== WEEK 3, 16 h: Sami's puncture, the wrap (§6.4)

async function afternoon(ctx, d, st) {
  const { ui, player, audio, hotspots, runner } = ctx;
  const W = await d.scene(SETS.workshop(), { fadeIn: false });
  roomLimits(ctx, true);
  dressWorkshop(ctx, W, 'day8');
  W.rain(0);
  W.fluoro('on');
  const props = workshopProps(W);
  props.setRags(!st.ragsTaken);
  const k = workshopKit(ctx, d, W);
  const S = W.spots;
  const O = W.odile;
  const K = W.sami;
  audio.ambience(BED.name, true, { volume: 0.25, fade: 1.5 });
  const HUGO = [0.55, 1.35];
  await k.cut(() => {
    W.setStool?.([S.odileBench[0], S.odileBench[1] - 0.02], Math.PI + 0.3);
    k.put(O, [S.odileBench[0], S.odileBench[1] - 0.02]);
    O.root.rotation.y = Math.PI;
    k.act(O, 'sit_idle', 0.1);
    k.putHugo(HUGO, [-1.2, 0.4]);
    K.root.visible = true;
    k.put(K, S.samiOutside);
    K.root.rotation.y = Math.PI / 2;
    ctx.cam.set(W.shots.threeShot);
  });
  ui.caption(T.captions.afternoon, { secs: 3 });
  ui.objective(T.objectives.sami);
  // Sami ducks in under the garage door, out of breath.
  const g = audio.sfx('garage_door_open', { volume: 0.4, pos: SND.garage, ref: 2, fallback: false });
  d.after(1.2, () => g?.stop(0.5));
  await k.walk(K, [-1.0, 0.75], { speed: 1.5 });
  k.faceTo(K, ...k.hugoXZ());
  player.face(K.root.position.x, K.root.position.z);
  k.act(K, 'talk');
  const SA = T.week3.sami;
  await d.say(SA.slice(0, 1));
  await d.say(SA.slice(1, 2)); // Odile, without looking up
  await d.say(SA.slice(2, 9));
  k.act(K, 'arms_crossed');
  await d.say(SA.slice(9));
  d.suspect('sami', { status: 'checked' });
  ui.objective(null);

  // PUNCTURE: the bucket on the floor in front of him (the game's own close shot).
  const r = await d.game('puncture', { text: G().puncture, at: [HUGO[0] - 0.55, 0, HUGO[1] - 0.45], facing: -Math.PI * 0.75 });
  await d.thoughtDone(0.3, 5); // his « Trente secondes… » first, then Sami's tier line
  await k.shot(W.shots.threeShot, 0.1);
  k.faceTo(K, ...k.hugoXZ());
  k.act(K, 'talk');
  const tier = r?.tier && G().puncture.tiers[r.tier] ? r.tier : 'middle';
  await d.say([G().puncture.tiers[tier], ...T.week3.samiAfter.slice(0, 3)]);
  k.faceTo(O, ...k.hugoXZ());
  k.act(O, 'sit_talk');
  await d.say(T.week3.samiAfter.slice(3));
  ui.notebook.open(0);
  await d.gate(ui.notebook.add(N.puncture));
  ui.notebook.dock();
  d.hope(0.4);
  k.act(K, 'idle');

  // The wrap: straight after, same shot.
  const WR = T.week3.wrap;
  await d.say(WR.slice(0, 2));
  k.faceTo(O, ...k.hugoXZ());
  k.act(O, 'sit_talk'); // she takes the chip, turns it over a long time; gives it back
  await d.say(WR.slice(2, 3));
  k.act(O, 'sit_talk');
  await d.say(WR.slice(3));
  k.act(O, 'sit_idle');
  audio.sfx('radio_static', { volume: 0.22, band: 'radio', pos: SND.radio, ref: 2, offset: Math.random() * 7, jitter: 0, fallback: false });
  const talk = audio.loopSfx('radio_talk_fishing', { volume: 0.08, bus: 'beds', band: 'radio', pos: SND.radio, ref: 2, fade: 0.4 });
  try {
    await d.wait(0.4);
    await d.say([{ who: 'Radio', text: T.week3.wrapRadio }]);
  } finally {
    talk.stop(0.6);
  }
  k.act(O, 'sit_talk');
  await d.say(T.week3.wrapEnd);
  k.act(O, 'sit_idle');
  // Sami off home; the screen goes to black for Week 4 (the same room).
  runner.walkTo(K, S.samiOutside, { speed: 1.3 });
  await d.wait(0.8);
  await d.gate(ui.fade(1, 0.6));
  hotspots.clear();
  K.root.visible = false;
  return W;
}

// ==================================================================== WEEK 4 (§6.6; the old ch4 Week 4)

/** Week 4: Sami's wheel. W: the workshop (16 h's room, re-dressed here); the screen is black. */
async function week4(ctx, d, W) {
  const { ui, player, mood, audio, cam, runner, hotspots } = ctx;
  roomLimits(ctx, true);
  dressWorkshop(ctx, W, 'week4');
  const props = workshopProps(W); // the key on the pegboard (the earlier props were in this room too)
  const S = W.spots;
  const O = W.odile;
  const K = W.sami;
  const { follow, shot, back, faceTo, put, act, pose, putHugo, hugoXZ, walk, nb, cut, required, kettleOff, addRoomSpots } = workshopKit(ctx, d, W);
  // Only one spoke key and one set of rags on this pegboard (afternoon() built a set already).
  for (const o of W.group.children.filter((c) => c.name === 'spoke-key' || c.name === 'rags')) if (o !== props.key && o !== props.rags) o.removeFromParent();
  props.setRags(false);
  addRoomSpots();
  // The rim kisses the pad once a turn (from Sami's arrival until it's true).
  W.bike.onRub = (dev) => audio.sfx('brake_rub', { volume: Math.min(0.45, 0.15 + (dev || 0) * 10), pos: W.bike.pads, fallback: (a) => a.tick({ volume: 0.22 }) });
  W.bike.setWobble(0.07);
  // Jo (comes in for a brush during the truing; stays by the garage door).
  const jo = ctx.assets.makeCharacter({ preset: 'jo', name: 'Jo', castShadow: false }); // by the door: no shadow (draw budget)
  jo.root.visible = false;
  ctx.world.add(jo.root);
  await cut(
    () => {
      player.limp = 0.78;
      audio.ambience(RAIN.name, false, { fade: 2 });
      audio.ambience(BED.name, true, { volume: 0.25, fade: 2 });
      kettleOff();
      W.rain(0.25);
      putHugo([0.2, 1.1], [-3.5, 0.4]);
      // At the bench on her stool, back to us, working.
      W.setStool?.([S.odileBench[0], S.odileBench[1] - 0.02], Math.PI + 0.3);
      put(O, [S.odileBench[0], S.odileBench[1] - 0.02]);
      O.root.rotation.y = Math.PI;
      act(O, 'sit_idle', 0.1);
      K.root.visible = true;
      put(K, S.samiOutside);
      K.root.rotation.y = Math.PI / 2;
      W.parkBike(S.samiOutside[0] + 0.1, S.samiOutside[1] - 0.42, Math.PI / 2);
      W.bike.follow(K);
      cam.set(W.shots.samiIn);
    },
    { card: T.cards.week4 },
  );

  // Sami rings at the garage door and ducks under it with the bike: the freewheel ticks as it rolls
  // (wheelSound follows the rear wheel all through Week 4: the walk in, the stand, the truing, his spin).
  const wheel = wheelSound(ctx, W.bike);
  await d.cinematic(
    async () => {
      audio.sfx('bike_bell', { volume: 0.35, pos: SND.garage, ref: 2, fallback: false });
      d.after(0.9, () => {
        const g = audio.sfx('garage_door_open', { volume: 0.4, pos: SND.garage, ref: 2, fallback: false });
        d.after(1.4, () => g?.stop(0.5)); // a part of it: the door knocked as he ducks under
      });
      await walk(K, S.samiParked, { speed: 1.15 });
      W.bike.follow(null);
      faceTo(K, ...hugoXZ());
      act(K, 'talk');
      await shot(W.shots.threeShot, 1.1);
      await d.say(T.week4.sami.slice(0, 1));
      faceTo(O, ...hugoXZ()); // "Don't look at me. Ask him."
      act(O, 'sit_talk');
      await d.say(T.week4.sami.slice(1));
      act(K, 'idle');
    },
    { letterbox: false },
  );
  O.root.rotation.y = Math.PI;
  act(O, 'sit_idle');
  await back();
  ui.objective(T.objectives.week4);
  await required('bike', S.bike, T.prompts.bike);
  ui.objective(null);

  await d.cinematic(
    async () => {
      await d.gate(ui.fade(1, 0.35));
      W.bikeOnStand(); // it flips onto the stand
      audio.sfx('tool_take', { volume: 0.3, fallback: false });
      put(K, S.samiHold, [W.stand.x, W.stand.z]);
      act(K, 'push', 0.1); // both hands on the bike
      putHugo(S.hugoBikeStand, [S.hugoBikeStand[0], S.hugoBikeStand[1] + 2]);
      W.bike.setSpin(1 / 2.4, { snap: true });
      cam.set(W.shots.truing);
      await d.gate(ui.fade(0, 0.45));
      await d.say(T.week4.bike);
      pose('crouch_idle'); // down at the wheel, an eye on the rim
      W.bike.setSpin(0); // he stops it with a hand; it runs down while Sami takes hold
      await d.say(T.week4.hold);
      pose(null);
      await d.say(T.week4.needs); // the spoke key: for once, it's on the board
    },
    { letterbox: false },
  );
  await back();

  // The spoke key from its outline (item+ spokeKey), then back to the wheel.
  ui.objective(T.objectives.spokeKey);
  await required('pegboard', S.pegboard, T.prompts.spokeKey, async () => {
    player.face(-2.62, -3);
    audio.sfx('tool_take', { volume: 0.4, fallback: false });
    props.setKey(false);
    d.give('spokeKey');
    d.thought(T.week4.keyTake, 3.5);
    await d.wait(0.5);
  });
  ui.objective(null);

  await d.cinematic(
    async () => {
      await d.gate(ui.fade(1, 0.35));
      putHugo(S.hugoBikeStand, [S.hugoBikeStand[0], S.hugoBikeStand[1] + 2]);
      cam.set(W.shots.truing);
      await d.gate(ui.fade(0, 0.4));
      pose('crouch_idle');
      // Jo comes in 6 s into the truing, and stays by the door, watching.
      let joIn = false;
      const joEnters = () => {
        if (joIn) return false;
        joIn = true;
        put(jo, [-3.65, -0.7], [S.hugoBikeStand[0], S.hugoBikeStand[1]]);
        jo.root.visible = true;
        jo.play('idle', 0.2); // arms crossed: her idle
        return true;
      };
      const cancelJo = d.after(6, () => {
        if (joEnters()) d.thought(T.week4.joEnter.text, 4.5, { who: T.week4.joEnter.who });
      });
      await truing();
      cancelJo();
      // A truing shorter than 6 s (or a skip): she comes in now, and says it out loud.
      if (joEnters()) await d.say([T.week4.joEnter]);
      await d.wait(0.3); // the reveal has held on it already
      pose(null);
      act(K, 'talk');
      await shot(W.shots.bikeTalk, 1.0);
      W.bike.setSpin(1.1); // Sami spins it
      d.after(1.8, () => W.bike.setSpin(0));
      await d.say(T.week4.after.slice(0, 2));
      // Jo, from the door: « C’est hot. »
      faceTo(jo, ...hugoXZ());
      jo.play('talk', 0.3);
      await shot(W.shots.threeShot, 0.9);
      const J = T.week4.jo;
      await d.say(J.slice(0, 3));
      faceTo(K, jo.root.position.x, jo.root.position.z);
      await d.say(J.slice(3, 5));
      faceTo(K, ...hugoXZ());
      await d.say(J.slice(5, 6)); // Odile, without looking up
      jo.play('stand', 0.3);
      await d.say(J.slice(6, 7)); // « Tiguidou. »
      // She takes the brush and goes; the door slams.
      const out = runner.walkTo(jo, [S.samiOutside[0] + 0.4, S.samiOutside[1]], { speed: 1.3 });
      await d.say(J.slice(7));
      audio.sfx('door_slam', { volume: 0.5, pos: SND.garage, ref: 2, fallback: false });
      d.after(1.5, () => {
        out.stop?.();
        jo.root.visible = false;
      });
      await shot(W.shots.bikeTalk, 0.8);
      act(K, 'talk');
      await d.say(T.week4.after.slice(2));
      // The laugh.
      await d.say(T.week4.laughStage);
      faceTo(O, ...hugoXZ()); // Odile looks up from the bench
      mood.pulse(0.08);
      d.hope(0.5);
      await d.wait(0.6);
      await d.say(T.week4.laugh);
      jo.root.visible = false;
    },
    { letterbox: false },
  );

  // Sami takes the bike home; the colour on it rides out of the door with him.
  await cut(() => {
    put(K, S.samiHold);
    faceTo(K, ...S.samiOutside);
    W.bike.group.rotation.set(0, K.root.rotation.y, 0);
    W.bike.follow(K);
    follow(true);
  });
  const leaving = runner.walkTo(K, S.samiOutside, { speed: 1.25 });
  faceTo(O, -4.5, 0.2); // nodding at the door
  await d.say(T.week4.wrap);
  await nb(ui.notebook.add(N.wheel));
  let left = false;
  leaving.then(() => (left = true));
  await d.until(() => left || K.root.position.x < -4.9);
  leaving.stop();
  mood.focusOn(null, { slot: 1 });
  wheel.dispose();
  K.root.visible = false;
  W.bike.follow(null);
  W.bike.group.visible = false;
  O.root.rotation.y = Math.PI;

  // The key goes back on its outline (item− spokeKey). End of Ch5.
  ui.objective(T.objectives.hangKey);
  await required('hangKey', S.pegboard, T.prompts.hangKey, async () => {
    player.face(-2.62, -3);
    faceTo(O, ...hugoXZ());
    act(O, 'sit_talk');
    audio.sfx('tool_hook', { volume: 0.5, fallback: false });
    props.setKey(true);
    await d.say(T.week4.end);
    d.take('spokeKey');
    act(O, 'sit_idle');
  });
  ui.objective(null);
  await d.wait(0.8);
  audio.ambience(BED.name, false, { fade: 1.5 });
  hotspots.clear();

  /** Week 4 truing by ear (ch4crafts.js / crafts/truing.js), then the colour comes to the bike. */
  async function truing() {
    await trueBike(ctx, d, W);
    mood.focusOn(W.bike.group, { slot: 1, floor: 0.55, offsetY: 0.5 });
    d.hope(0.42);
  }
}
