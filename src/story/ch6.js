import * as THREE from 'three';
import { L } from './script.js';
import { mem, remember } from './memory.js';
import { pocket, caseFile, fillItem, giftLines } from './items.js';
import { rememberOpenSign } from './minigames.js';
import { letterSign } from './ch4crafts.js';
import { PRESETS } from '../render/Mood.js';
import { SFX_BEDS } from '../core/Sfx.js';
import { STREET_MOODS } from '../world/scenes/scene2.js';
import { bicycle } from '../world/build.js';
import { thermosSet } from '../world/props/r4.js';
import { COUNTER_SET } from '../world/scenes/ch6-counter.js';
import { SOUNDS as WORKSHOP_SOUNDS, BED, workshopKit, dressWorkshop } from './workshop.js';
import { SETS } from './sets.js';

// Ch6 « Service de nuit » (Revision 4): Weeks 5 to 9 (docs/SCRIPT-R4.md §7, §9.3–9.4; §17 overrides).
//   Week 5   the street by day (this chapter's own build): the card, one thought.
//   Week 6   1 h CHEZ GÉRARD's counter (world/scenes/ch6-counter.js): kebabIntro, KEBAB WRAP (the tea),
//            receipts · 2 h 10 the street at night: Lou's bark, the click · 15 h the street by day: Jo at
//            ENCRE FINE, the bike-shop door (the mystery key, KEY RING), inside CYCLES DURAND (the 1974 photo
//            names him), shopOut · the workshop: the soup for Odile (optional), Sami doing his homework.
//   Week 7   the workshop: the OPEN sign (the old ch4 Week 7, lines unchanged) framed by joEnter / joBack,
//            the stay menu, then ENCRE FINE at 18 h: STENCIL.
//   Week 8   card, one thought.
//   Week 9   23 h the flat: the cork board (DEDUCTION, the wrong-accusation vignettes, Odile's hints) ·
//            2 h 50 the street at night: the bench with Jo, STAKEOUT (STRIDE's bravo gives it away), the
//            reveal and the offer with M. Durand, the bakery lights up. Fade to white.
// Hope 0.5 → 0.52 (kebab) → 0.54 (the shop) → 0.62 (the sign) → 0.64 (stencil) → 0.68 (the reveal).
// Every await goes through the Director, so __game.debug.skip() always progresses.

const T = L.ch6;
const G = L.games;
const N = L.notebook.items;
const NOTES = L.notebook.notes;

const STREET_CAMERA = { offset: [0, 2.6, 4.2], look: [0, 1.1, 0], fov: 55, lerp: 6 };
const LIMP = 0.76;
const SEAT = { x: -5.32, z: -36.5 }; // scene2 SEAT: the bench, the sitter facing +X
const DAY = STREET_MOODS.day;

// Every scene's sounds, preloaded with the chapter (docs .cache/r4/sfx-names.md for the R4 sets).
const SOUNDS = [
  ...WORKSHOP_SOUNDS,
  // the street beds and the flat's
  'amb_street_day', 'amb_street_night', 'amb_city_far', 'amb_drips', 'amb_night_still', 'amb_fridge_hum', 'neon_buzz', 'neon_flicker',
  // the counter
  'spit_sizzle', 'knife_slice', 'sauce_squirt', 'foil_wrap', 'till_drawer', 'coins_drop', 'door_bell_shop', 'liquid_pour', 'mug_clink',
  // the clue sound, the keys, the shop
  'pawl_click', 'keys_jingle', 'key_insert', 'key_stuck', 'lock_turn', 'door_slam', 'cloth_rustle',
  // ENCRE FINE, the board, the stakeout, the reveal
  'tattoo_machine', 'felttip_write', 'cork_pin', 'stamp_thump', 'phone_vibrate_table', 'phone_sms', 'stride_alert', 'phone_buzz_hand',
  'stride_bravo', 'watch_haptic', 'watch_haptic_long', 'breath_exhale', 'breath_tired', 'boot_step_wet', 'thermos_cap', 'stopwatch_click',
  'stopwatch_tick', 'shutter_glide',
];

export default {
  id: 'night',
  get title() {
    return T.title;
  },
  hope: 0.5,
  preset: { ...PRESETS[DAY.preset], ...DAY.overrides }, // Week 5 opens on the street by day (CHAPTER_LOOKS[5])
  objective: null,
  music: { name: 'contemplation', volume: 0.28, fade: 3 },
  ambience: [],
  sounds: SOUNDS,
  camera: STREET_CAMERA,
  player: { spawn: [0.6, -19], facing: Math.PI, boot: true, limp: LIMP, painRate: 1 / 1.0, canJog: true, footsteps: 'boot' },
  build: (ctx) => SETS.street('day').build(ctx),

  async run(ctx, d) {
    const { player } = ctx;
    player.firstStumbleDone = true;
    const beds = bedsKit(ctx.audio);
    seedCaseFile();
    try {
      await week5(ctx, d, beds);
      await week6Counter(ctx, d, beds);
      await week6Walk(ctx, d, beds);
      await week6Afternoon(ctx, d, beds);
      const W = await week6Workshop(ctx, d, beds);
      await week7(ctx, d, W, beds);
      await week7Stencil(ctx, d, beds);
      await week9Board(ctx, d, beds);
      await week9Stakeout(ctx, d, beds);
    } finally {
      beds.off(1.5);
    }
  },
};

// ================================================================ helpers

/** Beds and loops by name: set({name: volume | {volume, ...opts}}) fades in what is listed and out the rest. */
function bedsKit(audio) {
  const AMB = new Set(SFX_BEDS);
  const on = new Map(); // name -> loop handle (loopSfx) or true (ambience)
  const set = (spec = {}, fade = 1.5) => {
    for (const [name, h] of [...on]) {
      if (name in spec) continue;
      if (h === true) audio.ambience(name, false, { fade });
      else h?.stop?.(fade);
      on.delete(name);
    }
    for (const [name, v] of Object.entries(spec)) {
      const o = typeof v === 'number' ? { volume: v } : v;
      if (AMB.has(name)) {
        audio.ambience(name, true, { ...o, fade });
        on.set(name, true);
      } else if (on.has(name)) on.get(name)?.set?.(o.volume, o.rate ?? 1, fade);
      else on.set(name, audio.loopSfx(name, { bus: 'beds', ...o, fade }) || null);
    }
  };
  return { set, off: (fade = 1) => set({}, fade) };
}

/** Jumping straight into Ch6 (no Ch5 played): the case file as Ch5's required scenes leave it, silently. */
function seedCaseFile() {
  if (mem.caseFile?.open) return;
  remember('caseFile', {
    ...mem.caseFile,
    open: true,
    clues: ['cleanKey', 'photoHinge', 'slat52', 'blueChip', 'segmentD52'],
    later: [],
    suspects: {
      hugo: { status: 'none', as: null, later: false },
      benali: { status: 'checked', as: null, later: false },
      bastien: { status: 'checked', as: null, later: false },
      jo: { status: 'checked', as: null, later: false },
      oldman: { status: 'none', as: null, later: false },
      lou: { status: 'toCheck', as: null, later: false },
      gerard: { status: 'toCheck', as: null, later: false },
      sami: { status: 'checked', as: null, later: false },
    },
  });
}

const yawTo = (from, to) => Math.atan2(to[0] - from[0], to[1] - from[1]);
const at2 = (o) => [o.root.position.x, o.root.position.z];

/** A character placed in the current world (released with it). */
function makeChar(ctx, preset, name, opts = {}) {
  const c = ctx.assets.makeCharacter({ preset, name, ...opts });
  ctx.world.add(c.root);
  return c;
}
function place(c, [x, z], face, clip = 'idle') {
  c.root.position.set(x, 0, z);
  if (face !== undefined) c.root.rotation.y = typeof face === 'number' ? face : yawTo([x, z], face);
  c.root.visible = true;
  c.play(clip, 0.2);
}

/** A gated camera tween (a skip hard-cuts there). */
function shot(ctx, d, s, dur = 1.0) {
  const { cam } = ctx;
  if (dur <= 0) {
    cam.set(s);
    return Promise.resolve();
  }
  return d.gate(cam.tween(s, dur), () => {
    cam.set(s);
    return false;
  });
}
function followStreet(ctx, snap = false) {
  ctx.cam.follow(ctx.player.root, { offset: STREET_CAMERA.offset, look: STREET_CAMERA.look, lerp: STREET_CAMERA.lerp, snap });
  ctx.cam.fov(STREET_CAMERA.fov);
  if (snap) ctx.cam.snap();
}
/** Fade out, setup(), fade in (gated). */
async function cut(ctx, d, setup, { out = 0.45, inn = 0.6, card = null, color } = {}) {
  await d.gate(ctx.ui.fade(1, out, color));
  try {
    await setup?.();
  } catch (err) {
    console.error('[ch6] cut setup failed', err);
  }
  if (card) await d.card(card, { big: true });
  await d.gate(ctx.ui.fade(0, inn));
}
/** A required hotspot, waited for (skip triggers it). */
async function required(ctx, d, spot) {
  ctx.hotspots.add({ required: true, ...spot });
  await d.interact(spot.id);
}
const sfx = (ctx, name, opts = {}) => ctx.audio.sfx(name, { fallback: false, ...opts });

// ================================================================ Week 5 (§7.1)

async function week5(ctx, d, beds) {
  const W = ctx.world.current;
  // What the Fixer has done by Week 5: the shutter (Week 2), the bench (Week 3). The neon still flickers.
  W.fixes?.shutter(true);
  W.fixes?.bench(true);
  W.fixes?.neon(false);
  W.fixes?.card(false);
  W.neon?.setFlicker(true);
  beds.set({ amb_street_day: 0.3, amb_city_far: 0.15 }, 2);
  ctx.player.frozen = true;
  await d.card(T.cards.week5, { big: true });
  await d.say(T.week5);
  ctx.player.frozen = false;
}

// ================================================================ Week 6, 1 h: CHEZ GÉRARD (§7.2, §7.6.1)

async function week6Counter(ctx, d, beds) {
  const { ui, player, cam } = ctx;
  beds.set({}, 0.6);
  const W = await d.scene(COUNTER_SET({ player: { limp: LIMP } }), { card: T.cards.week6 });
  const S = W.spots;
  const Gd = W.gerard;
  cam.set(W.shots.counter);
  beds.set({ spit_sizzle: 0.2, fluoro_hum: { volume: 0.06, lowpass: 3000 }, neon_buzz: { volume: 0.05, highpass: 150 } }, 1.2);
  ui.caption(T.captions.night1, { secs: 3 });
  ui.objective(T.objectives.kebab);
  Gd.play('idle');
  player.face(S.gerard[0], S.gerard[1]);

  await required(ctx, d, {
    id: 'gerard',
    pos: S.gerardTalk,
    radius: 1.3,
    prompt: T.prompts.gerard,
    person: 'gerard',
    onInteract: async () => {
      await d.cinematic(
        async () => {
          ui.objective(null);
          const I = T.week6.kebabIntro;
          player.face(S.gerard[0], S.gerard[1]);
          Gd.root.rotation.y = yawTo(S.gerard, [player.root.position.x, player.root.position.z]);
          Gd.play('talk');
          // « Regarde mon néon. »: across the bowls to the window, the neon steady and pink.
          await shot(ctx, d, W.shots.neon, 0.9);
          await d.say(I.slice(0, 2));
          await shot(ctx, d, W.shots.counter, 0.8);
          await d.say(I.slice(2, 7));
          // « La porte s’ouvre. Trois clients. Puis cinq. »: from the back corner, the customers coming in.
          cam.set(W.shots.rush);
          sfx(ctx, 'door_bell_shop', { volume: 0.35, pos: W.door.bell.toArray(), ref: 3 });
          W.setCustomers(3);
          await d.wait(0.5);
          await d.say(I.slice(7, 8));
          sfx(ctx, 'door_bell_shop', { volume: 0.3, rate: 1.05, pos: W.door.bell.toArray(), ref: 3 });
          W.setCustomers(5);
          await d.say(I.slice(8));
          Gd.play('idle');
        },
        { letterbox: false },
      );
    },
  });

  // KEBAB WRAP: two orders, the tea between them (the blurred cap, the dimes, the click as the door shuts).
  const r = await d.game('kebab', {
    text: G.kebab,
    flicker: false, // rewired: steady from Week 6 (SCRIPT-R4 §13.5)
    onTea: async () => {
      sfx(ctx, 'liquid_pour', { volume: 0.25 });
      d.after(3.0, () => sfx(ctx, 'door_bell_shop', { volume: 0.3, rate: 0.95, pos: W.door.bell.toArray(), ref: 3 }));
      await d.say(G.kebab.teaStage);
    },
  });
  if (r?.assisted && !r?.skipped) await d.say(G.kebab.assistStage);

  // 2 a.m.: the shop closing. The customers gone, the receipts on the spike.
  const R6 = T.week6.receipts;
  await cut(ctx, d, () => {
    W.setCustomers(0);
    player.teleport(S.hugoReceipts[0], S.hugoReceipts[1]);
    player.face(S.gerardReceipts[0], S.gerardReceipts[1]);
    Gd.root.position.set(S.gerardReceipts[0], 0, S.gerardReceipts[1]);
    Gd.root.rotation.y = yawTo(S.gerardReceipts, S.hugoReceipts);
    cam.set(W.shots.receipts);
  });
  await d.cinematic(
    async () => {
      Gd.play('talk');
      sfx(ctx, 'till_drawer', { volume: 0.3 });
      await d.say(R6.slice(0, 1));
      // STRIDE on the receipts.
      ui.watchBuzz(T.week6.buzz, 2.6);
      await d.wait(2.4);
      d.thought(T.week6.buzzReply, 2.6);
      await d.wait(2.8);
      sfx(ctx, 'page_flip', { volume: 0.3, rate: 1.2 });
      await d.say(R6.slice(1, 4));
      sfx(ctx, 'page_flip', { volume: 0.25, rate: 1.3 });
      await d.say(R6.slice(4, 10));
      d.clue('receipts');
      d.suspect('gerard', { status: 'checked' });
      await d.wait(0.6);
      sfx(ctx, 'foil_wrap', { volume: 0.35 });
      await d.say(R6.slice(10, 11));
      d.give('kebab');
      ui.notebook.open(0);
      await d.say(R6.slice(11));
      ui.notebook.dock();
      d.hope(0.52, 2);
      Gd.play('idle');
    },
    { letterbox: false },
  );
}

// ================================================================ Week 6, 2 h 10: the walk home, the click (§7.2)

async function week6Walk(ctx, d, beds) {
  const { ui, player, cam } = ctx;
  beds.set({}, 0.5);
  // Out of Gérard's door (closed now: the shutter half down), heading home to No. 14.
  const W = await d.scene(SETS.street('night', { player: { spawn: [-4.15, -33.0], facing: Math.PI, limp: LIMP } }));
  W.neon?.setOn(true); // rewired, steady (Gérard leaves it on as he locks up)
  W.neon?.setFlicker(false);
  beds.set({ amb_night_still: 0.3, neon_buzz: { volume: 0.04, highpass: 150 } }, 1.5);
  followStreet(ctx, true);
  ui.caption(T.captions.night2, { secs: 3 });
  ui.objective(T.objectives.home);
  d.after(1.4, () => d.thought(T.week6.lou.text, 3.4, { who: T.week6.lou.who }));

  // A few steps down the street, past the bench: the click, behind him.
  ctx.waypoint = [player.root.position.x, -39.2]; // the pointer for « Rentrer. » (a place, not a hotspot)
  const r = await d.until(() => player.root.position.z < -38.6);
  ctx.waypoint = null;
  ui.objective(null);
  const from = new THREE.Vector3(4.2, 0.45, -32.8);
  const to = new THREE.Vector3(4.8, 0.45, -22);
  const clicks = 9;
  for (let i = 0; i < clicks; i++) {
    const k = i / (clicks - 1);
    const p = from.clone().lerp(to, k);
    d.after(i * 0.55, () => sfx(ctx, 'pawl_click', { volume: 0.32 * (1 - k * 0.75), jitter: 0.03, lowpass: 3200 - k * 1600, pos: p.toArray(), ref: 3 }));
  }
  await d.cinematic(
    async () => {
      if (r !== 'skipped') await d.wait(0.9);
      d.thought(T.week6.click[0], 2.4);
      await d.wait(2.2);
      // He stops and turns; the camera turns with him: the street is empty.
      const p = player.root.position;
      player.face(p.x + 0.2, p.z + 10);
      await shot(ctx, d, { pos: [p.x - 0.5, 1.75, p.z - 2.6], look: [p.x + 2.0, 1.35, p.z + 12], fov: 52 }, 1.4);
      d.thought(T.week6.click[1], 5);
      await d.wait(5.2);
      d.thought(T.week6.click[2], 4.2);
      d.clue('freewheelClick');
      await d.wait(4.4);
    },
    { letterbox: true },
  );
}

// ================================================================ Week 6, 15 h: Jo, the key ring, CYCLES DURAND (§7.2, §7.6.2)

async function week6Afternoon(ctx, d, beds) {
  const { ui, player, cam, hotspots, runner } = ctx;
  beds.set({}, 0.5);
  const W = await d.scene(SETS.street('day', { player: { spawn: [-0.4, -27.5], facing: Math.PI, limp: LIMP } }));
  const S = W.spots;
  W.fixes?.shutter(true);
  W.fixes?.bench(true);
  W.fixes?.neon(true); // rewired three nights ago
  W.fixes?.card(false);
  W.neon?.setFlicker(false);
  beds.set({ amb_street_day: 0.3, amb_city_far: 0.15, neon_buzz: { volume: 0.03, highpass: 150 } }, 1.5);
  followStreet(ctx, true);
  ui.caption(T.captions.afternoon, { secs: 3 });
  ui.objective(T.objectives.jo);

  // Jo on her doorstep, arms crossed.
  const J = makeChar(ctx, 'jo', 'Jo');
  place(J, S.joDoor, Math.PI / 2, 'arms_crossed');

  await required(ctx, d, {
    id: 'jo',
    pos: S.joDoor,
    radius: 1.9,
    prompt: T.prompts.jo,
    person: 'jo',
    onInteract: async () => {
      const B = T.week6.jo;
      ui.objective(null);
      await d.cinematic(
        async () => {
          // A two-shot on her doorstep: Hugo on the pavement, the camera across the street.
          const hugoAt = [S.joDoor[0] + 1.25, S.joDoor[1] + 0.35];
          player.teleport(hugoAt[0], hugoAt[1]);
          player.face(...S.joDoor);
          J.root.rotation.y = yawTo(S.joDoor, hugoAt);
          await shot(ctx, d, { pos: [S.joDoor[0] + 4.3, 1.65, S.joDoor[1] + 1.6], look: [S.joDoor[0] + 0.55, 1.35, S.joDoor[1] + 0.1], fov: 46 }, 0.9);
          J.play('talk');
          await d.say(B.slice(0, 7));
          J.play('arms_crossed');
          sfx(ctx, 'keys_jingle', { volume: 0.45, pos: [S.joDoor[0], 1.1, S.joDoor[1]], ref: 2 });
          await d.say(B.slice(7, 9));
          d.give('keyRing');
          d.suspect('jo', { later: true });
          J.play('talk');
          await d.say(B.slice(9));
          d.give('soup');
          J.play('idle');
        },
        { letterbox: false },
      );
      followStreet(ctx);
    },
  });
  ui.objective(T.objectives.shop);
  // She crosses to the shop with him (she has the keys' story, he has the keys).
  const joWait = [S.durandDoor[0] - 0.95, S.durandDoor[1] - 1.05]; // beyond him from the mystery-key shot
  runner.walkTo(J, joWait, { speed: 1.2, face: yawTo(joWait, S.durandDoor) });

  // The bike-shop door: the mystery key first, then KEY RING.
  await required(ctx, d, {
    id: 'shopDoor',
    pos: S.durandDoor,
    radius: 1.5,
    prompt: T.prompts.shopDoor,
    needs: 'keyRing',
    needsLine: T.needs.shopDoor,
    object: 'door',
    onInteract: async () => {
      await d.cinematic(
        async () => {
          ui.objective(null);
          J.root.position.set(joWait[0], 0, joWait[1]);
          J.root.rotation.y = yawTo(joWait, S.durandDoor);
          J.play('arms_crossed');
          player.teleport(S.durandDoor[0] - 0.15, S.durandDoor[1]);
          player.face(S.durandDoor[0] + 2, S.durandDoor[1]);
          const lock = W.anchors?.durandLock;
          // Wide enough for Jo watching the mystery key (the key ring's own close-up comes with the game).
          await shot(ctx, d, { pos: [S.durandDoor[0] - 3.3, 1.65, S.durandDoor[1] + 2.2], look: [S.durandDoor[0] + 0.2, 1.2, S.durandDoor[1] - 0.2], fov: 48 }, 0.9);
          const M = T.week6.keyRing.mystery;
          sfx(ctx, 'key_insert', { volume: 0.35, pos: lock, ref: 2 });
          await d.say(M.slice(0, 2));
          sfx(ctx, 'key_stuck', { volume: 0.35, pos: lock, ref: 2 });
          await d.say(M.slice(2));
          const k = await d.game('keyring', { text: G.keyRing, facing: Math.PI / 2 });
          if (k && !k.skipped && !k.assisted && (k.tries ?? 9) <= 3) await d.say(G.keyRing.foundFast);
          sfx(ctx, 'door_bell_shop', { volume: 0.3, rate: 0.9, pos: lock, ref: 3 });
          sfx(ctx, 'creak_wood', { volume: 0.3, rate: 0.85, pos: lock, ref: 3 });
          W.durand?.setOpen(1, 1.2);
          await d.wait(1.0);
        },
        { letterbox: false },
      );
      followStreet(ctx);
    },
  });

  // Inside CYCLES DURAND (objective search): bench and photo required, the rest optional.
  ui.objective(T.objectives.search);
  const inside = [S.durandInside[0] - 0.4, S.durandInside[1] + 0.9];
  runner.walkTo(J, inside, { speed: 1.1 });
  beds.set({ amb_street_day: { volume: 0.12, lowpass: 900 }, amb_city_far: 0.08, amb_workshop: { volume: 0.1, lowpass: 800 } }, 2);
  const roomShot = W.shots.durandInside;
  let inRoom = false;
  let busy = false;
  const offCam = ctx.world.onUpdate(() => {
    if (busy || d.state !== 'play') return;
    const x = player.root.position.x;
    if (!inRoom && x > 6.25 && roomShot) {
      inRoom = true;
      cam.tween(roomShot, 0.6);
    } else if (inRoom && x < 6.0) {
      inRoom = false;
      followStreet(ctx);
    }
  });
  const back = async () => {
    if (inRoom && roomShot) await shot(ctx, d, roomShot, 0.6);
    else followStreet(ctx);
  };
  const done = new Set();
  const look = (id, pos, prompt, lines, after, shotName, req = false) =>
    hotspots.add({
      id,
      pos,
      radius: 1.1,
      prompt,
      required: req,
      onInteract: async () => {
        busy = true;
        try {
          await d.cinematic(
            async () => {
              player.face(...pos);
              J.root.rotation.y = yawTo(at2(J), pos);
              if (W.shots[shotName]) await shot(ctx, d, W.shots[shotName], 0.8);
              await after?.('before');
              await d.say(lines);
              await after?.('after');
            },
            { letterbox: false },
          );
          await back();
        } finally {
          busy = false;
          done.add(id);
        }
      },
    });
  const SH = T.week6.shop;
  look('outlines', S.durandOutlines, T.prompts.outlines, SH.outlines, null, 'durandOutlines');
  look('shopBench', S.durandBench, T.prompts.shopBench, SH.bench, (w) => w === 'after' && d.clueNote('slat52'), 'durandBench', true);
  look('tin', S.durandTin, T.prompts.tin, SH.tin, (w) => {
    if (w === 'before') sfx(ctx, 'tin_tap', { volume: 0.25 });
    else d.clueNote('blueChip');
  }, 'durandBench');
  look('photo', S.durandPhoto, T.prompts.photo, SH.photo, (w) => {
    if (w === 'before') sfx(ctx, 'tool_take', { volume: 0.2 });
    else {
      d.clue('shopPhoto');
      d.suspect('oldman', { as: 'durand', later: true });
    }
  }, 'durandPhoto', true);
  look('calendar', S.durandCalendar, T.prompts.calendar, SH.calendar, (w) => w === 'before' && sfx(ctx, 'page_flip', { volume: 0.25, rate: 0.9 }), 'durandCalendar');
  await d.interact('shopBench');
  await d.interact('photo');
  // Both found: out the door (the optional ones stay until he leaves).
  const doorIn = [S.durandDoor[0] + 0.95, S.durandDoor[1]];
  await required(ctx, d, { id: 'leave', pos: doorIn, radius: 1.0, prompt: T.prompts.leave, onInteract: async () => {} });
  offCam();
  for (const id of ['outlines', 'tin', 'calendar']) hotspots.remove(id);
  ui.objective(null);
  await d.cinematic(
    async () => {
      player.teleport(S.durandDoor[0] - 0.6, S.durandDoor[1] + 0.4);
      player.face(S.durandDoor[0] - 3, S.durandDoor[1]);
      runner.clear?.();
      J.root.position.set(S.durandDoor[0] - 1.1, 0, S.durandDoor[1] - 0.6);
      J.root.rotation.y = yawTo(at2(J), at2(player));
      followStreet(ctx, true);
      W.durand?.setOpen(0, 1.0);
      sfx(ctx, 'creak_wood', { volume: 0.25, rate: 0.9 });
      beds.set({ amb_street_day: 0.3, amb_city_far: 0.15 }, 1.5);
      await shot(ctx, d, { pos: [S.durandDoor[0] - 3.4, 1.7, S.durandDoor[1] + 1.2], look: [S.durandDoor[0] - 0.6, 1.3, S.durandDoor[1]], fov: 50 }, 0.8);
      J.play('talk');
      sfx(ctx, 'keys_jingle', { volume: 0.35 });
      await d.say(T.week6.shopOut.slice(0, 1));
      d.take('keyRing');
      await d.say(T.week6.shopOut.slice(1));
      d.hope(0.54, 2);
      J.play('idle');
      await d.wait(0.6);
    },
    { letterbox: false },
  );
}

// ================================================================ Week 6: the soup, in the workshop (optional)

async function week6Workshop(ctx, d, beds) {
  const { ui, player, hotspots } = ctx;
  beds.set({}, 0.5);
  const W = await d.scene(SETS.workshop({ player: { spawn: [-2.3, 0.55], facing: Math.PI / 2, limp: LIMP } }), { fadeIn: false });
  dressWorkshop(ctx, W, 'week4');
  W.rain(0);
  const S = W.spots;
  const O = W.odile;
  const K = W.sami;
  const k = workshopKit(ctx, d, W);
  // Odile at her bench on her stool; Sami beside her, his homework on the bench (wordless).
  W.setStool?.([S.odileBench[0], S.odileBench[1] - 0.02], Math.PI + 0.3);
  k.put(O, [S.odileBench[0], S.odileBench[1] - 0.02]);
  O.root.rotation.y = Math.PI;
  k.act(O, 'sit_idle', 0.1);
  if (K) {
    K.root.visible = true;
    k.put(K, [S.odileBench[0] + 0.85, S.odileBench[1] + 0.12]);
    K.root.rotation.y = Math.PI;
    k.act(K, 'lean', 0.1);
  }
  k.follow(true);
  beds.set({ amb_workshop: 0.25 }, 1.5);
  await d.gate(ui.fade(0, 0.8));

  let finished = false;
  // The soup scene: from E with nothing held (the soup taken here) or from the held soup (already given).
  const giveSoup = async () => {
    await d.cinematic(
      async () => {
        k.putHugo([S.odileBench[0] - 0.8, S.odileBench[1] + 0.7], at2(O)); // to her side: the room camera sees them both
        O.root.rotation.y = yawTo(at2(O), k.hugoXZ());
        await d.say(T.week6.soup.slice(0, 2));
        if (pocket.has('soup')) d.take('soup');
        await d.say(T.week6.soup.slice(2));
      },
      { letterbox: false },
    );
    finished = true;
  };
  const odileAt = [S.odileBench[0] + 0.35, S.odileBench[1] + 0.55];
  hotspots.add({
    id: 'odileSoup',
    pos: odileAt,
    radius: 1.3,
    once: false,
    person: 'odile',
    required: pocket.has('soup'), // optional, but Jo pointed at it
    prompt: fillItem(L.items.ui.give, 'soup'),
    enabled: () => !finished && (pocket.has('soup') || !!pocket.selected()),
    onInteract: () => (pocket.has('soup') ? giveSoup() : null),
    onGift: async (id) => {
      if (id === 'soup') await giveSoup();
      else await d.say(giftLines(id, 'odile') || []);
    },
  });
  if (K)
    hotspots.add({
      id: 'samiGift',
      pos: [S.odileBench[0] + 0.85, S.odileBench[1] + 0.6],
      radius: 1.1,
      once: false,
      person: 'sami',
      prompt: T.prompts.jo,
      enabled: () => !!pocket.selected(),
      onInteract: async () => {},
    });
  hotspots.add({ id: 'leave', pos: [-3.8, -0.95], radius: 0.9, prompt: T.prompts.leave, required: !pocket.has('soup'), onInteract: async () => (finished = true) });
  // A skip ends the beat (the soup stays optional).
  await d.until(() => finished);
  for (const id of ['odileSoup', 'samiGift', 'leave']) hotspots.remove(id);
  return W;
}

// ================================================================ Week 7 (§7.3): the OPEN sign (moved), Jo's bookends

/** Week 7: the OPEN sign (the old ch4 Week 7, its lines unchanged) + joEnter, the 2 s hold, « 18 H », joBack, stayMenu. */
async function week7(ctx, d, W, beds) {
  const { ui, player, mood, audio, cam, hotspots } = ctx;
  const S = W.spots;
  const O = W.odile;
  const { follow, shot: kshot, faceTo, put, act, putHugo, hugoXZ, nb, cut: kcut, required: kreq, kettleOn, kettleOff, addRoomSpots, roaming, walk } = workshopKit(ctx, d, W);
  addRoomSpots();
  // The radio this week: the fishing man's old carp (SCRIPT-R4 §7.3), not Ch4's line.
  hotspots.remove('radio');
  hotspots.add({
    id: 'radio',
    pos: S.radio,
    prompt: L.ch4.prompts.radio,
    enabled: () => roaming(),
    onInteract: async () => {
      sfx(ctx, 'radio_static', { volume: 0.25, band: 'radio', pos: [4.0, 0.45, 1.98], ref: 2 });
      const talk = audio.loopSfx('radio_talk_fishing', { volume: 0.08, bus: 'beds', band: 'radio', pos: [4.0, 0.45, 1.98], ref: 2, fade: 0.4 });
      try {
        await d.wait(0.4);
        const R = T.week7.radioStation;
        d.thought(R.fishing, 5.5, { who: R.who });
        await d.wait(5.6);
        await d.say(T.week7.radio);
      } finally {
        talk?.stop(0.6);
      }
    },
  });
  const J = makeChar(ctx, 'jo', 'Jo');
  J.root.visible = false;
  const doorIn = [S.frame[0] - 0.1, S.frame[1] + 0.45];
  await kcut(
    () => {
      player.limp = 0.75;
      W.sami && (W.sami.root.visible = false);
      W.setStool?.(null);
      W.fluoro('on'); // fixed, at last
      W.rain(0);
      beds.set({}, 1);
      audio.ambience(BED.name, true, { volume: 0.2, lowpass: 2500, fade: 2 }); // dry: the rain in the bed low-passed away
      kettleOn();
      putHugo([1.2, 1.1], [-1.5, -2.5]);
      put(O, S.odileBench);
      O.root.rotation.y = Math.PI;
      act(O, 'lean', 0.1);
      W.showBoard(true);
      W.board.guides(true);
      // Hugo's own race bike, chain cleaned, has taken the stand.
      W.raceBike.visible = true;
      mood.focusOn(W.raceBike, { slot: 1, strength: 0.55, floor: 0.55, decay: 0, offsetY: 0.5 });
      follow(true);
    },
    { card: T.cards.week7 },
  );
  await d.say(T.week7.raceBike);

  // joEnter (R4): Jo brings back Odile's brush, then slams the door.
  await d.cinematic(
    async () => {
      sfx(ctx, 'creak_wood', { volume: 0.25, rate: 1.1, pos: [S.frame[0], 1.2, S.frame[1]], ref: 2 });
      place(J, doorIn, S.odileBench, 'walk');
      const to = [S.odileBench[0] + 0.95, S.odileBench[1] + 0.55];
      await walk(J, to, { speed: 1.2, face: yawTo(to, S.odileBench) });
      act(J, 'talk');
      player.face(...to);
      const E = T.week7.joEnter;
      await d.say(E.slice(0, 2));
      J.root.rotation.y = yawTo(to, hugoXZ());
      await d.say(E.slice(2, 3));
      await walk(J, doorIn, { speed: 1.4 });
      J.root.visible = false;
      sfx(ctx, 'door_slam', { volume: 0.5, pos: [S.frame[0], 1.2, S.frame[1]], ref: 2 });
      await d.say(E.slice(3));
    },
    { letterbox: false },
  );
  follow();

  ui.objective(T.objectives.week7);
  await kreq('bench', S.bench, T.prompts.bench);
  ui.objective(null);

  await d.cinematic(
    async () => {
      const B7 = T.week7;
      putHugo([-0.72, -2.0], [W.board.group.position.x, W.board.group.position.z]); // beside her, not between her and the lens
      faceTo(O, W.board.group.position.x, W.board.group.position.z);
      act(O, 'paint'); // the liner brush up to the board
      await kshot(W.shots.bench, 1.2);
      // The tip shivers.
      const [u0, v0] = W.board.paths[0].pts[0];
      let shiver = true;
      const offShiver = ctx.world.onUpdate(() => {
        if (shiver) W.board.setBrush(true, u0 + (Math.random() - 0.5) * 14, v0 + (Math.random() - 0.5) * 14, 0.02 + Math.random() * 0.01);
      });
      await d.say(B7.stage);
      shiver = false;
      offShiver();
      W.board.setBrush(false);
      act(O, 'talk');
      await d.say(B7.intro.slice(0, 5)); // ... "I need someone to—"
      await d.wait(0.9);
      await d.say(B7.intro.slice(5)); // "...Hold this board." ...

      // He takes her place at the board. (POV: Hugo hides so he doesn't fill the lens.)
      await d.gate(ui.fade(1, 0.35));
      put(O, S.odileAside, [W.board.group.position.x, W.board.group.position.z]);
      act(O, 'arms_crossed', 0.1);
      putHugo(S.hugoBench, [S.hugoBench[0], -3]);
      player.root.visible = false;
      cam.set(W.shots.lettering());
      mood.focusOn(W.board.face, { slot: 2, strength: 1, decay: 0.2, floor: 0.3, offsetY: 0 });
      await d.gate(ui.fade(0, 0.5));
      const score = await letterSign(ctx, d, W);
      const tiers = B7.lettering.tiers;
      await d.say(score < 0.16 ? tiers.good : score < 0.42 ? tiers.middle : tiers.poor);
      await d.correct(B7.signMenu);
      await initials(ctx, d, W);
      await d.say(B7.signThink);
      W.board.guides(false);
      W.board.update();
      rememberOpenSign(W.board.snapshot());

      // The sign goes up on the door he painted; the colour spreads into the room.
      await d.gate(ui.fade(1, 0.45));
      W.hangSign();
      player.root.visible = true;
      putHugo(S.hugoSign, [W.doorX, -3]);
      put(O, S.odileSign, [W.doorX, -3]);
      cam.set(W.shots.hungDoor);
      await d.gate(ui.fade(0, 0.7));
      mood.focusOn(W.board.face, { slot: 2, strength: 1, decay: 0.25, floor: 0.6, offsetY: 0 });
      d.hope(0.62, 4);
      await d.wait(1.2);
      await nb(ui.notebook.add(N.sign));
      ui.watchBuzz(B7.buzz);
      d.after(2.6, () => d.thought(B7.buzzReply, 2.4));
      await d.wait(5.2); // let "...Three hours?" clear before the wrap dialogue
      faceTo(O, ...hugoXZ());
      player.face(O.root.position.x, O.root.position.z);
      act(O, 'talk');
      await d.say(B7.wrap);
      // « Quel trait ? » used to end a chapter: hold on it, no answer (Ch7 answers it).
      act(O, 'idle');
      await d.wait(2.0);
    },
    { letterbox: false },
  );
  player.root.visible = true;
  W.board.setBrush(false);
  kettleOff();
  audio.ambience(BED.name, false, { fade: 1.5 });
  ui.notebook.dock();

  // The cut, « 18 H », Jo comes back for the sign.
  await kcut(() => {
    audio.ambience(BED.name, true, { volume: 0.18, lowpass: 2200, fade: 1 });
    mood.focusOn(W.board.face, { slot: 2, strength: 1, decay: 0.25, floor: 0.6, offsetY: 0 });
    putHugo(S.hugoSign, [W.doorX, -3]);
    put(O, [S.odileChair[0] - 0.4, S.odileChair[1] - 0.6], S.hugoSign);
    act(O, 'arms_crossed', 0.1);
    place(J, [1.6, -2.05], [W.doorX, -3], 'arms_crossed'); // off the lens-to-Hugo line (she stood inside him: PT57 #9)
    cam.set({ pos: [0.55, 1.7, 0.75], look: [2.55, 1.3, -2.3], fov: 50 }); // Jo, Hugo, the sign on the door
  });
  ui.caption(T.captions.evening, { secs: 3 });
  await d.cinematic(
    async () => {
      const B = T.week7.joBack;
      await d.say(B.slice(0, 2));
      J.root.rotation.y = yawTo(at2(J), hugoXZ());
      player.face(...at2(J));
      act(J, 'talk');
      await d.say(B.slice(2));
      const i = await d.choose(T.week7.stayMenu);
      if (i === 0) remember('joStay', true);
      act(J, 'idle');
      await d.wait(0.4);
    },
    { letterbox: false },
  );
  audio.ambience(BED.name, false, { fade: 1 });
}

// ================================================================ Week 7, 18 h: ENCRE FINE, STENCIL (§7.3, §7.6.3)

async function week7Stencil(ctx, d, beds) {
  const { ui, player, hotspots } = ctx;
  const W = await d.scene(SETS.street('day', { player: { spawn: [-3.4, -33.2], facing: Math.PI, limp: LIMP } }));
  const S = W.spots;
  W.fixes?.shutter(true);
  W.fixes?.bench(true);
  W.fixes?.neon(true);
  W.fixes?.card(false);
  W.neon?.setFlicker(false);
  W.encre?.setOpen(1);
  W.encre?.setLight?.(1);
  d.preset({ preset: DAY.preset, overrides: { ...DAY.overrides, sunColor: '#e8c9a0', sunIntensity: 1.2, fogColor: '#b2a89a', skyBottom: '#c2b29c' } }, 0);
  beds.set({ amb_street_day: 0.25, amb_city_far: 0.15 }, 1.5);
  followStreet(ctx, true);
  ui.objective(T.objectives.stencil);
  const J = makeChar(ctx, 'jo', 'Jo');
  const tableAt = S.encreTable;
  const top = W.anchors?.encreTable || [tableAt[0], 0.95, tableAt[1] - 0.6];
  const cam0 = W.shots.encreTable?.pos || [top[0] + 0.75, 1.6, top[2] + 0.55];
  // Across the light table from the lens, leaning in to watch.
  const away = [top[0] - cam0[0], top[2] - cam0[2]];
  const al = Math.hypot(...away) || 1;
  const joAt = [top[0] + (away[0] / al) * 0.62, top[2] + (away[1] / al) * 0.62];
  place(J, S.encreInside, S.encreTable, 'idle');
  const machinePos = W.anchors?.encreTable || [tableAt[0], 1.0, tableAt[1]];

  await required(ctx, d, { id: 'encre', pos: S.joDoor, radius: 1.4, prompt: T.prompts.encre, onInteract: async () => {} });
  ui.objective(null);
  await cut(ctx, d, () => {
    player.teleport(tableAt[0], tableAt[1]);
    player.face(tableAt[0], tableAt[1] - 2);
    place(J, joAt, [top[0], top[2]], 'arms_crossed');
    ctx.cam.set(W.shots.encreTable);
    beds.set({ amb_street_day: { volume: 0.1, lowpass: 900 }, tattoo_machine: { volume: 0.05, pos: machinePos, ref: 2 } }, 1);
  });
  await d.cinematic(
    async () => {
      J.play('talk');
      await d.say(T.week7.stencilIntro);
      J.play('arms_crossed');
    },
    { letterbox: false },
  );
  const r = await d.game('stencil', { text: G.stencil });
  remember('stencil', r?.tier && ['good', 'middle', 'poor'].includes(r.tier) ? r.tier : 'middle');
  await d.thoughtDone(1.2, 5); // her tier line is the game's bark: let it land
  await d.cinematic(
    async () => {
      const A = T.week7.stencilAfter;
      // The game's top-down view of the light table cut both heads off (PT57): look up across it at her.
      ctx.cam.set({ pos: [cam0[0], 1.72, cam0[2]], look: [(top[0] + joAt[0]) / 2, 1.38, (top[2] + joAt[1]) / 2], fov: 56 });
      J.play('talk');
      await d.say(A.slice(0, 2));
      await d.gate(ui.notebook.add(N.fineLine));
      await d.say(A.slice(2, 3));
      sfx(ctx, 'felttip_write', { volume: 0.3 });
      await d.gate(ui.notebook.annotate(N.fineLine, NOTES.badly, { hand: 'jo' }));
      await d.say(A.slice(3));
      d.hope(0.64, 2);
      J.play('idle');
      await d.wait(0.8);
      ui.notebook.dock();
    },
    { letterbox: false },
  );
  hotspots.remove('encre');
}

// ================================================================ Weeks 8 and 9, 23 h: the board (§7.4, §7.5, §7.6.4, §9.3, §9.4)

// Where the imagined suspect stands in the flat (beside the board), and the shot that frames them.
const VIGNETTE = { at: [0.95, -1.7], shot: { pos: [0.25, 1.55, 0.15], look: [1.05, 1.25, -1.75], fov: 42 } };
const SUSPECT_PRESETS = { sami: ['sami', { tint: '#c24a3a' }], lou: ['lou', {}], gerard: ['gerard', {}], benali: ['mme', {}], bastien: ['bastien', {}], jo: ['jo', {}] };

async function week9Board(ctx, d, beds) {
  const { ui, player, cam, mood } = ctx;
  beds.set({}, 0.6);
  // Beside the board already (he has been pacing): a fixed wide shot (the free camera sees the whole
  // dollhouse, about 340 draw calls; the board's close shot about 230, the wide one 265).
  const W = await d.scene(SETS.flat({ player: { spawn: [1.45, -0.6], facing: Math.PI * 0.9, limp: LIMP } }), { card: T.cards.week8, fadeIn: false });
  if (W.shots.corkboard) cam.set(W.shots.corkboard);
  await d.say(T.week8);
  await d.card(T.cards.week9, { big: true });
  beds.set({ amb_fridge_hum: 0.2 }, 1.5);
  await d.gate(ui.fade(0, 0.9));
  ui.caption(T.captions.board, { secs: 3 });
  ui.objective(T.objectives.board);
  const S = W.spots;

  await required(ctx, d, {
    id: 'board',
    pos: S.corkboard,
    radius: 1.3,
    prompt: T.prompts.board,
    onInteract: async () => {
      await d.cinematic(
        async () => {
          ui.objective(null);
          player.face(1.72, -3);
          if (W.shots.corkboard) await shot(ctx, d, W.shots.corkboard, 1.0);
          await d.say(T.week9.boardIntro);
        },
        { letterbox: false },
      );
    },
  });

  // The vignettes: the board blurs (the game does it), the suspect stands beside it under a soft light.
  const people = {};
  const spot = new THREE.SpotLight(0xffe2b8, 0, 6, 0.42, 0.7, 1.6);
  spot.position.set(VIGNETTE.at[0] - 0.4, 2.6, VIGNETTE.at[1] + 0.9);
  spot.target.position.set(VIGNETTE.at[0], 0.9, VIGNETTE.at[1]);
  spot.userData.noCone = true;
  ctx.world.add(spot, spot.target);
  const layer = () => document.querySelector('.gb-deduction');
  const showBoard = (k) => {
    const el = layer();
    if (el) {
      el.style.transition = 'opacity 0.45s ease';
      el.style.opacity = String(k);
    }
  };
  const saved = { pos: null };
  const vignette = async (who, lines) => {
    const hugoSelf = who === 'hugo';
    let c = null;
    if (!hugoSelf) {
      if (!people[who] && SUSPECT_PRESETS[who]) {
        const [preset, o] = SUSPECT_PRESETS[who];
        people[who] = makeChar(ctx, preset, `vignette-${who}`, o);
      }
      c = people[who] || null;
    }
    saved.pos = [player.root.position.x, player.root.position.z];
    showBoard(0.12);
    await d.wait(0.35);
    if (c) place(c, VIGNETTE.at, [VIGNETTE.shot.pos[0], VIGNETTE.shot.pos[2]], 'idle');
    if (hugoSelf) {
      player.teleport(VIGNETTE.at[0], VIGNETTE.at[1]);
      player.face(VIGNETTE.shot.pos[0], VIGNETTE.shot.pos[2]);
    }
    spot.intensity = 18;
    cam.set(VIGNETTE.shot);
    try {
      await d.say(lines);
    } finally {
      if (c) c.root.visible = false;
      if (hugoSelf) player.teleport(saved.pos[0], saved.pos[1]);
      spot.intensity = 0;
      if (W.shots.corkboard) cam.set(W.shots.corkboard);
      showBoard(1);
      await d.wait(0.3);
    }
  };
  const A = T.week9.accuse;
  const r = await d.game('deduction', {
    text: G.deduction,
    clues: caseFile.clues(),
    onAccuse: async (id, { count }) => {
      const lines = A[id];
      if (!lines) return;
      await vignette(id, count > 1 ? lines.slice(-1) : id === 'hugo' ? lines : [...A.stage, ...lines]); // Hugo's own pin has its own stage line
    },
    onHint: async (level) => {
      if (level === 1) {
        sfx(ctx, 'phone_vibrate_table', { volume: 0.35 });
        await d.say(T.week9.hint);
        return;
      }
      await d.say(T.week9.hint2.phone);
      // She comes up: in the room, a little out of breath.
      if (!people.odile) people.odile = makeChar(ctx, 'odile', 'vignette-odile', { tint: '#9a7a4e' });
      await vignette('odile', T.week9.hint2.room);
    },
  });
  remember('caseFile.wrong', r?.wrong ?? 0);
  remember('caseFile.accused', Array.isArray(r?.accused) ? r.accused : []);
  await d.thoughtDone(0.3, 5); // the board's last thought (« Le même vélo… ») before Odile's line
  await d.cinematic(
    async () => {
      await d.say(T.week9.boardDone);
      await d.wait(0.6);
      sfx(ctx, 'phone_sms', { volume: 0.3 });
      ui.watchBuzz(T.week9.sms, 5, { title: T.week9.smsFrom });
      await d.wait(4.2);
      await d.say(T.week9.smsAfter);
    },
    { letterbox: false },
  );
}

// ================================================================ Week 9, 2 h 50: the stakeout, the reveal (§7.5, §7.6.5)

async function week9Stakeout(ctx, d, beds) {
  const { ui, player, cam, hotspots, audio, mood } = ctx;
  beds.set({}, 0.6);
  const W = await d.scene(SETS.street('night', { player: { spawn: [-3.3, -30.4], facing: Math.PI, limp: LIMP } }));
  const S = W.spots;
  W.neon?.setOn(false); // unplugged for the night (Week 8: twice a night, for the ambience)
  W.fixes?.card(false);
  beds.set({ amb_night_still: 0.22 }, 1.5);
  followStreet(ctx, true);
  ui.caption(T.captions.stakeout, { secs: 3 });
  ui.objective(T.objectives.bench);

  // Jo already on the repaired bench, the thermos beside her.
  const SEATS = { jo: [SEAT.x, SEAT.z + 0.55], hugo: [SEAT.x, SEAT.z - 0.1], durand: [SEAT.x, SEAT.z - 0.7] };
  const J = makeChar(ctx, 'jo', 'Jo');
  place(J, SEATS.jo, Math.PI / 2, 'sit_idle');
  const thermos = thermosSet({ coffee: [false, false] });
  thermos.group.scale.setScalar(0.9);
  thermos.group.position.set(SEAT.x - 0.05, 0.46, SEAT.z + 1.0);
  thermos.group.rotation.y = Math.PI / 2;
  ctx.world.add(thermos.group);
  // M. Durand, up the street, pushing his black bike (the stakeout walks him).
  const D = makeChar(ctx, 'durand', 'M. Durand');
  const bike = bicycle({ frame: '#1d1f22', rust: 0.35 });
  bike.position.set(-0.42, 0, 0.22);
  D.root.add(bike);
  const path = [
    [-4.5, -19.5],
    { at: [-4.55, -26.5], look: true },
    [-4.6, -31.5],
    { at: [-4.5, -34.4], look: true },
    [-3.4, -36.2],
    [0.4, -35.9],
    [3.4, -34.4],
    S.durandCard,
  ];
  place(D, path[0], Math.PI, 'idle');
  D.root.visible = false;
  const twoShot = { pos: [-2.55, 1.35, -36.15], look: [-5.25, 0.85, -36.45], fov: 44 };

  await required(ctx, d, {
    id: 'sit',
    pos: S.bench,
    radius: 1.4,
    prompt: T.prompts.sit,
    onInteract: async () => {
      ui.objective(null);
      await d.cinematic(
        async () => {
          player.teleport(SEATS.hugo[0], SEATS.hugo[1], Math.PI / 2);
          sfx(ctx, 'creak_wood', { volume: 0.3, pos: [SEAT.x, 0.5, SEAT.z], ref: 2 });
          await d.gate(player.setPose('sit', 0.6));
          await shot(ctx, d, twoShot, 1.0);
          const I = T.week9.stakeoutIntro;
          await d.say(I.slice(0, 1));
          J.play('sit_talk');
          await d.say(I.slice(1, 2));
          d.give('thermos');
          await d.say(I.slice(2, 5));
          sfx(ctx, 'page_flip', { volume: 0.25 });
          await d.say(I.slice(5));
          const i = await d.choose(T.week9.cuteMenu);
          if (i === 1) remember('joProud', true);
          await d.say(T.week9.stakeoutTalk);
          J.play('sit_idle');
          ui.watchBuzz(T.week9.stakeoutBuzz, 2.8);
          sfx(ctx, 'watch_haptic_long', { volume: 0.4 });
          await d.wait(2.6);
          J.play('sit_talk');
          await d.say(T.week9.stakeoutWhisper);
          J.play('sit_idle');
          await d.wait(0.5);
          sfx(ctx, 'pawl_click', { volume: 0.15, lowpass: 2500, pos: [-4.5, 0.4, -19], ref: 3 });
          d.after(0.45, () => sfx(ctx, 'pawl_click', { volume: 0.13, lowpass: 2400, pos: [-4.5, 0.4, -19.2], ref: 3 }));
          await d.wait(0.9);
          await d.say(T.week9.stakeoutClick);
        },
        { letterbox: false },
      );
    },
  });
  // No « Surveiller la rue. » objective here: the game hides the HUD, so it only showed once the game
  // was over (PT57 #16); the game's own hints say what to do.

  // STAKEOUT: first person from the bench; the bravo at CYCLES DURAND gives it away.
  D.root.visible = true;
  const eye = [SEAT.x + 0.12, 1.12, SEATS.hugo[1]];
  let kudos = 0;
  // First person from his seat: Jo sits 0.6 m up the bench, inside the view's arc, and her head hid the
  // street (PT57 #2). She is off screen for the game and back for the reveal.
  J.root.visible = false;
  await d.game('stakeout', {
    text: G.stakeout,
    suspect: D,
    path,
    clickAt: [-0.42, 0.34, -0.28],
    from: eye,
    facing: 0.87, // up the street and across: the shutter end to CYCLES DURAND in the arc
    lamp: [-4.75, 4.4, -38.6],
    speed: 0.55,
    onArrive: async ({ suspect }) => {
      // He pins the fallen card back up, straight; the phone buzzes loudly.
      suspect.root.rotation.y = Math.PI / 2;
      suspect.play('idle');
      W.fixes?.card(true);
      sfx(ctx, 'cork_pin', { volume: 0.18, pos: [S.durandCard[0], 1.4, S.durandCard[1]], ref: 3 });
      await d.wait(0.6);
      sfx(ctx, 'stride_alert', { volume: 0.3 });
      sfx(ctx, 'phone_buzz_hand', { volume: 0.4 });
      const i = await d.choose(T.week9.bravo);
      kudos = i === 1 ? 1 : 0;
      sfx(ctx, 'stride_bravo', { volume: 0.3 });
      await d.wait(0.7);
      sfx(ctx, 'watch_haptic', { volume: 0.14, lowpass: 900, pos: [S.durandCard[0], 1.2, S.durandCard[1]], ref: 3 });
      await d.say(T.week9.bravoAfter);
    },
  });
  remember('durandKudos', kudos);
  J.root.visible = true;
  ui.objective(null);

  // The reveal (the card pinned back up, straight).
  const Rv = T.week9.reveal;
  const card = S.durandCard;
  const hugoAt = [card[0] - 2.1, card[1] - 0.5];
  const joAt = [card[0] - 1.5, card[1] - 1.25]; // beyond Hugo, clear of Durand in the shot
  await d.cinematic(
    async () => {
      player.face(card[0], card[1]);
      await d.gate(player.setPose('stand', 0.5));
      sfx(ctx, 'boot_step_wet', { volume: 0.5 });
      sfx(ctx, 'body_thud', { volume: 0.2, rate: 1.3 });
      await d.say(Rv.slice(0, 1));
      await cut(ctx, d, () => {
        place(D, card, Math.PI / 2, 'idle'); // his back to them, at the card
        player.teleport(hugoAt[0], hugoAt[1]);
        player.face(card[0], card[1]);
        place(J, joAt, card, 'idle');
        thermos.group.position.set(joAt[0] - 0.05, 0.0, joAt[1] + 0.35);
        thermos.group.visible = false;
        cam.set({ pos: [card[0] - 4.6, 1.6, card[1] + 1.4], look: [card[0] - 0.6, 1.25, card[1] - 0.2], fov: 46 });
      }, { out: 0.35, inn: 0.5 });
      await d.say(Rv.slice(1, 3));
      // He turns round.
      D.root.rotation.y = yawTo(card, hugoAt);
      D.play('talk');
      await d.say(Rv.slice(3, 11));
      sfx(ctx, 'stopwatch_click', { volume: 0.35, pos: [card[0], 1.2, card[1]], ref: 2 });
      await d.say(Rv.slice(11, 12));
      const tick = audio.loopSfx('stopwatch_tick', { volume: 0.1, bus: 'fx', fade: 0.2 });
      try {
        await d.say(Rv.slice(12, 13));
      } finally {
        tick?.stop(0.2);
      }
      sfx(ctx, 'stopwatch_click', { volume: 0.3, rate: 1.05 });
      await d.say(Rv.slice(13));
      d.hope(0.66, 3);
      const O = T.week9.offer;
      await d.say(O.slice(0, 8));
      J.play('talk');
      await d.say(O.slice(8, 9));
      sfx(ctx, 'thermos_cap', { volume: 0.3 });
      d.after(0.7, () => sfx(ctx, 'liquid_pour', { volume: 0.3 }));
      d.take('thermos');
      await d.wait(1.0);
      await d.say(O.slice(9));
      J.play('idle');
      D.play('idle');
    },
    { letterbox: false },
  );

  // The rags (§1.5): an optional gift, if Ch5 ended with them in the pocket.
  if (mem.ragsKept && pocket.has('rags')) {
    followStreet(ctx);
    let gave = false;
    const giveRags = async () => {
      if (gave || !pocket.has('rags')) return;
      gave = true;
      pocket.give('rags', 'durand');
      sfx(ctx, 'cloth_rustle', { volume: 0.25 });
      await d.say(giftLines('rags', 'durand') || []);
    };
    hotspots.add({
      id: 'durandRags',
      pos: card,
      radius: 1.6,
      once: false,
      person: 'durand',
      prompt: fillItem(L.items.ui.give, 'rags'),
      enabled: () => !gave,
      onInteract: giveRags,
      onGift: async (id) => {
        if (id === 'rags') {
          gave = true;
          await d.say(giftLines('rags', 'durand') || []);
        } else await d.say(giftLines(id, 'durand') || []);
      },
    });
    ui.objective(T.objectives.bench);
    await required(ctx, d, { id: 'sit2', pos: S.bench, radius: 1.4, prompt: T.prompts.sit, onInteract: async () => {} });
    hotspots.remove('durandRags');
    ui.objective(null);
  }

  // All three on the repaired bench until the bakery lights up.
  await cut(ctx, d, () => {
    player.teleport(SEATS.hugo[0], SEATS.hugo[1] - 0.05, Math.PI / 2);
    player.setPose('sit', 0);
    D.root.remove(bike);
    bike.position.set(SEAT.x + 0.35, 0, SEAT.z - 1.55);
    bike.rotation.y = 0.15;
    ctx.world.add(bike);
    place(D, [SEATS.durand[0], SEATS.durand[1] - 0.05], Math.PI / 2, 'sit_idle');
    place(J, [SEATS.jo[0], SEATS.jo[1] - 0.05], Math.PI / 2, 'sit_idle');
    W.bakery?.setLit(false);
    cam.set({ pos: [-2.25, 1.45, -36.55], look: [-5.25, 0.9, -36.6], fov: 50 });
  }, { out: 0.6, inn: 1.2 });
  await d.cinematic(
    async () => {
      const E = T.week9.end;
      await d.say(E.slice(0, 2));
      await d.gate(ui.notebook.add(N.case));
      d.hope(0.68, 3);
      mood.pulse?.(0.06);
      await d.wait(0.8);
      ui.notebook.dock();
      // Four o'clock: up the street the bakery lights up, its shutter glides (oiled, barely there).
      await cut(ctx, d, () => {
        if (W.shots.bakery) cam.set(W.shots.bakery);
      }, { out: 0.5, inn: 0.8 });
      W.bakery?.setLit(true);
      W.bakery?.setOpen?.(0.5, 3);
      sfx(ctx, 'shutter_glide', { volume: 0.3, pos: [-5.5, 1.2, -8.8], ref: 4 });
      await d.wait(1.8);
      await d.say(E.slice(2));
      await d.wait(1.0);
      await d.gate(ui.fade(1, 2.6, '#ffffff'));
    },
    { letterbox: true },
  );
}

// ================================================================ the lettering's initials (Week 7)

/** Hugo letters a tiny "H.R." in the corner (one auto stroke). */
async function initials(ctx, d, W) {
  const Bd = W.board;
  const [CW, CH] = Bd.size;
  let t = 0;
  ctx.audio.sfx('brush_stroke', { volume: 0.3, rate: 1.1, fallback: false });
  await d.until((dt) => {
    t += dt;
    const k = Math.min(1, t / 1.0);
    Bd.initials(k);
    Bd.setBrush(true, CW - 150 + 90 * k, CH - 56, 0);
    return k >= 1;
  });
  Bd.initials(1);
  Bd.setBrush(false);
}
