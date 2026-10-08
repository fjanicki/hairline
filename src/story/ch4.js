import * as THREE from 'three';
import { L } from './script.js';
import { rememberOpenSign } from './minigames.js';
import { sandDoor, trueBike, letterSign } from './ch4crafts.js';
import { measureTape, readingIndex } from './crafts/tape.js';
import { mixGrey } from './crafts/mixer.js';
import { dry, reveal } from './crafts/finish.js';
import { remember } from './memory.js';
import { buildScene4 } from '../world/scenes/scene4.js';
import { IN_X, GARAGE } from '../world/scenes/scene4/layout.js';
import { PRESETS } from '../render/Mood.js';
import { duckUnderVoice, wheelSound } from './crafts/sound.js';

// Ch4 "Measure Twice": Odile's workshop, Day 5 to Week 7 in the boot (docs/DESIGN.md).
// Colour comes back on the things he makes and accumulates: the door (focus slot 0), the bike
// (slot 1: Sami's, then Hugo's own race bike on the stand by Week 7), the OPEN sign (slot 2).
// Every await goes through the Director (d.say / d.gate / d.until / d.interact ...), so
// __game.debug.skip() always progresses and no minigame can block.

const T4 = L.ch4;
const N = L.notebook.items;
const CAM = { offset: [0, 3.4, 3.6], look: [0, 1.0, -0.6] };
// Light: the workshop preset with less ambient and fill, so the bare bulb makes a warm pool and the
// corners fall off into brown dark (the room is lit by its practicals, see scene4/lights.js).
const LOOK = { ...PRESETS.workshop, hemiIntensity: 0.9, fillIntensity: 1.5, envIntensity: 0.13, envIntensityHope: 0.2 };

const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const clamp = THREE.MathUtils.clamp;

// Sound (docs/assets/sfx.md, Ch4 Integration list). Beds: the workshop room tone all four days (0.3,
// 0.25 in Week 4, 0.2 low-passed on the dry Week 7) and the rain on the roof on Day 5 / Day 8. Point
// sources: Odile's kettle once a day, the radio on its crate, the garage door. The crafts (ch4crafts.js,
// crafts/*) play their own recorded cues; the tube hum and flicker live in scene4/lights.js.
const SOUNDS = [
  'amb_workshop', 'amb_rain_window', 'fluoro_hum', 'fluoro_flicker', 'kettle_boil', 'radio_static', 'radio_talk_fishing',
  'tool_hook', 'tool_take', 'sand_stroke', 'sand_loop', 'tape_pull', 'tape_tock', 'table_tock', 'tape_retract', 'scaffold_creak',
  'plane_stroke', 'paint_lid_open', 'paint_drop', 'paint_stir_loop', 'paint_slosh', 'tin_tap', 'brush_stroke', 'creak_wood', 'creak_wood_alt',
  'garage_door_open', 'bike_bell', 'spoke_key', 'brake_rub', 'freewheel_tick', 'freewheel_coastdown', 'brush_wall_loop',
  // the notebook (UI.js) and the stumble (Player.js): docs/assets/sfx.md, Global
  'notebook_open', 'page_flip', 'notebook_close', 'pencil_write', 'pencil_erase', 'pencil_erase_alt', 'body_thud',
];
const BED = { name: 'amb_workshop', volume: 0.3 };
const RAIN = { name: 'amb_rain_window', volume: 0.2, lowpass: 900 };
const SND = {
  kettle: [4.07, 0.55, 2.62],
  radio: [4.0, 0.45, 1.98],
  garage: [-IN_X, 1.2, (GARAGE.z0 + GARAGE.z1) / 2],
};

export default {
  id: 'workshop',
  get title() {
    return T4.title;
  },
  hope: 0.12,
  preset: LOOK,
  objective: null,
  music: { name: 'contemplation', volume: 0.3, fade: 3 },
  ambience: [],
  sounds: SOUNDS,
  camera: { offset: CAM.offset, look: CAM.look, fov: 55, lerp: 5 },
  player: { spawn: [3.4, -2.4], facing: 0, boot: true, limp: 0.85, painRate: 1 / 1.0, canJog: true, footsteps: 'boot' },
  build: (ctx) => buildScene4(ctx),

  async run(ctx, d) {
    const { ui, player, hotspots, mood, audio, cam, runner, input, engine } = ctx;
    const W = ctx.world.current;
    const S = W.spots;
    const O = W.odile;
    const K = W.sami;
    player.firstStumbleDone = true; // day four is long gone: stumbles draw from the bag

    // ------------------------------------------------------------ helpers
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
    const nb = (p) => d.gate(p);
    const cut = async (setup, { out = 0.45, inn = 0.6, card = null } = {}) => {
      await d.gate(ui.fade(1, out));
      try {
        setup();
      } catch (err) {
        console.error('[ch4] cut setup failed', err);
      }
      if (card) await d.card(card, { big: true });
      await d.gate(ui.fade(0, inn));
    };
    const pick = (bag, i) => bag[i % bag.length];

    // ---- sound helpers
    /** Odile's kettle, once a day (a quiet 40 s point source; dips under the voices, stops at a cut). */
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
    const required = async (id, pos, prompt, onInteract) => {
      hotspots.add({ id, pos, prompt, required: true, onInteract });
      roam = true;
      try {
        await d.interact(id);
      } finally {
        roam = false;
      }
    };
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

    // The rim kisses the pad once a turn (from Sami's arrival until it's true).
    W.bike.onRub = (dev) => audio.sfx('brake_rub', { volume: Math.min(0.45, 0.15 + (dev || 0) * 10), pos: W.bike.pads, fallback: (a) => a.tick({ volume: 0.22 }) });

    // ============================================================ DAY 5
    W.fluoro('flicker');
    W.rain(1);
    audio.ambience(BED.name, true, { volume: BED.volume, lowpass: 20000, fade: 3 });
    audio.ambience(RAIN.name, true, { volume: RAIN.volume, lowpass: RAIN.lowpass, fade: 3 });
    kettleOn();
    put(O, S.odileTrestle, S.spawn);
    act(O, 'arms_crossed', 0.2);
    follow(true);
    player.scripted = true;
    const walkIn = walk(player.char, [3.05, -1.5], { speed: 0.9 });
    await d.card(T4.cards.day5, { big: true, bg: 'clear' });
    await walkIn;
    player.scripted = false;
    player.face(O.root.position.x, O.root.position.z);
    faceTo(O, ...hugoXZ());

    await d.say(T4.day5.arrive);
    O.play('reach', 0.3, { once: true }); // she hands him a pencil and a school exercise book
    await d.say(T4.day5.book.slice(0, 1));
    ui.notebook.set([]);
    ui.notebook.open(0);
    act(O, 'talk');
    await d.say(T4.day5.book.slice(1));
    await nb(ui.notebook.add(N.ride));
    await nb(ui.notebook.add(N.run));
    await d.say(T4.day5.strike);
    await nb(ui.notebook.strike(N.ride));
    await nb(ui.notebook.strike(N.run));
    act(O, 'arms_crossed');
    await d.say(T4.day5.strikeThink);
    act(O, 'talk');
    await d.say(T4.day5.holdStill);
    await nb(ui.notebook.add(N.hold));
    ui.notebook.dock();
    await d.say(T4.day5.door);
    // Odile goes back to her bench; he goes to the board.
    runner.walkTo(O, S.odileBench, { speed: 0.8, face: Math.PI }).then(() => act(O, 'lean', 0.5)); // back to work at her bench
    ui.objective(T4.objectives.day5);

    await required('pegboard', S.pegboard, T4.prompts.pegboard, async () => {
      player.face(-2.62, -3);
      await d.say(T4.day5.pegboard);
      W.takeSandpaper();
      audio.sfx('tool_hook', { volume: 0.55 }); // fallback: scrape(0.12)
    });
    ui.objective(T4.objectives.sand);
    await required('door', S.door, T4.prompts.door);
    ui.objective(null);

    await d.cinematic(
      async () => {
        putHugo(S.hugoSand, [W.door.group.position.x, W.door.group.position.z - 1]);
        await shot(W.shots.sand, 1.2);
        await d.say(T4.day5.grain);
        pose('lean');
        await sanding();
        pose(null);
        await d.wait(0.5);
        await d.say(T4.day5.after);
        await nb(ui.notebook.add(N.sand));
        d.hope(0.2);
      },
      { letterbox: false },
    );
    await back();

    /** Day 5 sanding (ch4crafts.js): A/D or a mouse scrub, dust, a reveal on the bare wood. */
    async function sanding() {
      await sandDoor(ctx, d, W);
    }

    // ============================================================ DAY 8
    await cut(
      () => {
        player.limp = 0.82;
        kettleOn(); // Day 8: she has the kettle on again
        putHugo([1.9, 0.95], [W.doorX, -2.9]);
        put(O, S.odileBench, [W.door.group.position.x, W.door.group.position.z]);
        act(O, 'arms_crossed', 0.1);
        follow(true);
      },
      { card: T4.cards.day8 },
    );
    await d.say(T4.day8.start);
    ui.objective(T4.objectives.day8);
    await required('frame', S.frame, T4.prompts.frame);
    ui.objective(null);

    // Measure twice, with the tape (crafts/tape.js).
    await d.cinematic(
      async () => {
        putHugo([S.hugoFrame[0] - 0.38, S.hugoFrame[1] - 0.04], [W.doorX - 0.3, -3.2]); // at the near jamb, so the far one shows
        await shot(W.shots.frame, 1.0);
        await d.gate(player.crouch(0.6));
        audio.sfx('tape_tock', { volume: 0.4, jitter: 0.05, fallback: (a) => a.tick({ volume: 0.2 }) }); // the case hooks on the near jamb
        const m = await measureTape(ctx, d, { tape: W.tape, text: T4.day8.tape });
        remember('measure', { readings: m.readings, agreed: m.agreed, assisted: m.assisted });
        await d.gate(player.stand(0.6));
        await d.say([T4.day8.tape.cut[readingIndex(m.agreed)]]); // Doors lie. Frames lie worse...
        // Half a centimetre off the hinge side: three plane strokes, 0.9 s apart.
        for (let i = 0; i < 3; i++) audio.sfx('plane_stroke', { volume: 0.45, delay: 0.25 + i * 0.9, fallback: false });
        await d.wait(3.0);
        await nb(ui.notebook.add(N.measure));
      },
      { letterbox: false },
    );
    await back();
    player.face(O.root.position.x, O.root.position.z);
    faceTo(O, ...hugoXZ());
    act(O, 'talk');
    await d.say(T4.day8.grey);

    // The grey: the colour toy at Odile's crate (crafts/mixer.js); the door takes the accepted mix.
    await d.cinematic(
      async () => {
        const pot = W.mixer.group.position;
        await cut(() => {
          W.mixer.visible = true;
          putHugo(W.mixSpots.hugo, [pot.x, pot.z]);
          player.root.visible = false; // his eyes on the pot (as at the easel in Week 7)
          put(O, W.mixSpots.odile, [pot.x, pot.z]); // at his shoulder, out of frame
          act(O, 'arms_crossed', 0.1);
          cam.set(W.shots.mix);
        });
        const g = await mixGrey(ctx, d, { mixer: W.mixer, text: T4.day8.mixer, look: T4.day8.greyLook });
        player.root.visible = true;
        remember('doorGrey', g.hex);
        remember('grey', { tries: g.tries, assisted: g.assisted });
        W.door.setPaintColor(g.hex);
      },
      { letterbox: false },
    );

    // Auto-paint (no minigame): the grey goes on in six bands, wet, and dries matte; the door holds colour.
    await d.cinematic(
      async () => {
        await cut(() => {
          W.mixer.visible = false; // Odile clears the crate away
          putHugo(S.hugoSand, [W.door.group.position.x, W.door.group.position.z - 1]);
          faceTo(O, W.door.group.position.x, W.door.group.position.z);
          act(O, 'arms_crossed', 0.1);
          cam.set(W.shots.paint);
        });
        pose('lean');
        dry(ctx, W.door.material, { secs: 20 });
        await autoPaint();
        await reveal(ctx, d, { hold: 1.2 });
        pose(null);
        await d.say(T4.day8.painted);
        await nb(ui.notebook.add(N.grey));
      },
      { letterbox: false },
    );
    // The door goes back in its frame (still in focus slot 0).
    await cut(() => {
      W.hangDoor();
      putHugo(S.hugoSign, [W.doorX, -3]);
      put(O, S.odileSign, [W.doorX, -3]);
      act(O, 'arms_crossed', 0.1);
      cam.set(W.shots.hungDoor);
    });
    audio.sfx('creak_wood', { volume: 0.3, alt: 'creak_wood_alt', fallback: false }); // the door swings in its frame
    await d.wait(1.6);
    await back(1.0);

    async function autoPaint() {
      const door = W.door;
      const DUR = 4;
      let t = 0;
      let band = -1;
      let bloomed = false;
      const bloom = () => {
        if (bloomed) return;
        bloomed = true;
        mood.focusOn(door.group, { slot: 0, strength: 1, decay: 0.15, floor: 0.5, offsetY: 1 });
        d.hope(0.35);
      };
      await d.until((dt) => {
        t += dt;
        const p = Math.min(1, t / DUR);
        door.setPaint(p);
        const k = Math.min(5, Math.floor(p * 6));
        door.setBrush(true, k, Math.min(1, p * 6 - k));
        if (k !== band) {
          band = k;
          audio.sfx('brush_stroke', { volume: 0.4, fallback: (a) => a.scrape({ volume: 0.18 }) });
          if (k === 5) bloom();
        }
        return p >= 1;
      });
      door.setPaint(1);
      door.setBrush(false);
      bloom();
    }

    // ============================================================ WEEK 4
    W.bike.setWobble(0.07);
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
      { card: T4.cards.week4 },
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
        await d.say(T4.week4.sami.slice(0, 1));
        faceTo(O, ...hugoXZ()); // "Don't look at me. Ask him."
        act(O, 'sit_talk');
        await d.say(T4.week4.sami.slice(1));
        act(K, 'idle');
      },
      { letterbox: false },
    );
    O.root.rotation.y = Math.PI;
    act(O, 'sit_idle');
    await back();
    ui.objective(T4.objectives.week4);
    await required('bike', S.bike, T4.prompts.bike);
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
        await d.say(T4.week4.bike);
        pose('crouch_idle'); // down at the wheel, an eye on the rim
        W.bike.setSpin(0); // he stops it with a hand; it runs down while Sami takes hold
        await d.say(T4.week4.hold);
        await truing();
        await d.wait(0.3); // the reveal has held on it already
        pose(null);
        act(K, 'talk');
        await shot(W.shots.bikeTalk, 1.0);
        W.bike.setSpin(1.1); // Sami spins it
        d.after(1.8, () => W.bike.setSpin(0));
        await d.say(T4.week4.after);
        // The laugh.
        await d.say(T4.week4.laughStage);
        faceTo(O, ...hugoXZ()); // Odile looks up from the bench
        mood.pulse(0.08);
        d.hope(0.5);
        await d.wait(0.6);
        await d.say(T4.week4.laugh);
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
    await d.say(T4.week4.wrap);
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

    /** Week 4 truing by ear (ch4crafts.js / crafts/truing.js), then the colour comes to the bike. */
    async function truing() {
      await trueBike(ctx, d, W);
      mood.focusOn(W.bike.group, { slot: 1, floor: 0.55, offsetY: 0.5 });
      d.hope(0.42);
    }

    // ============================================================ WEEK 7
    await cut(
      () => {
        player.limp = 0.75;
        W.fluoro('on'); // fixed, at last
        W.rain(0);
        audio.ambience(BED.name, true, { volume: 0.2, lowpass: 2500, fade: 2 }); // dry: the rain in the bed low-passed away
        kettleOn();
        putHugo([1.2, 1.1], [-1.5, -2.5]);
        W.setStool?.(null);
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
      { card: T4.cards.week7 },
    );
    await d.say(T4.week7.raceBike);
    ui.objective(T4.objectives.week7);
    await required('bench', S.bench, T4.prompts.bench);
    ui.objective(null);

    await d.cinematic(
      async () => {
        const B7 = T4.week7;
        putHugo([-0.72, -2.0], [W.board.group.position.x, W.board.group.position.z]); // beside her, not between her and the lens
        faceTo(O, W.board.group.position.x, W.board.group.position.z);
        act(O, 'paint'); // the liner brush up to the board
        await shot(W.shots.bench, 1.2);
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
        const score = await lettering();
        const tiers = B7.lettering.tiers;
        await d.say(score < 0.16 ? tiers.good : score < 0.42 ? tiers.middle : tiers.poor);
        await d.correct(B7.signMenu);
        await initials();
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
      },
      { letterbox: false },
    );
    player.root.visible = true;
    W.board.setBrush(false);

    // Advance: Week 12.
    kettleOff();
    audio.ambience(BED.name, false, { fade: 1.5 });
    await d.gate(ui.fade(1, 1.0));
    ui.notebook.dock();
    await d.card(T4.cards.week12, { big: true });

    // ------------------------------------------------------------ lettering (crafts/letters.js)
    /** LETTERING: letter() over the chalk guides (WASD or a mouse drag), the board dries, a reveal. */
    async function lettering() {
      return letterSign(ctx, d, W);
    }

    /** Hugo letters a tiny "H.R." in the corner (one auto stroke). */
    async function initials() {
      const Bd = W.board;
      const [CW, CH] = Bd.size;
      let t = 0;
      audio.sfx('brush_stroke', { volume: 0.3, rate: 1.1, fallback: false });
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
  },
};
