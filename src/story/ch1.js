import * as THREE from 'three';
import { L } from './script.js';
import { PRESETS } from '../render/Mood.js';
import { buildScene1 } from '../world/scenes/scene1.js';

// Ch1 "No Impact": Hugo's flat, night, boot day 4. Hope 0.04 -> 0.06 (watch) -> 0.07 (door).
// Optional: TV (watch, then turn it off), phone (with the voicemail), X-ray, race bike, race bibs.
// Required: the GPS watch on its charger, which switches on the door; the door gives START WALK?,
// E starts the walk and the screen fades to black with the hammering still coming through the floor.

const MUSIC = { name: 'contemplation', volume: 0.32 };

// The `flat` preset relit for the re-dressed flat: the scene brings its own practicals (the CRT key,
// the sodium streetlight through the window, the floor lamp, the strip light), so the preset's sun
// is off (no shadow pass) and the nicotine ambient sinks, leaving pools of light and real darks.
// The interior HDRI stays as a dim fill so the PBR surfaces keep their relief in the shadows.
const PRESET = {
  ...PRESETS.flat,
  sunIntensity: 0,
  shadows: false,
  hemiIntensity: 0.75,
  fillIntensity: 1.0,
  fillNear: 3.5, // the close-ups (watch, phone) sit right behind him: no glare from the camera fill
  envIntensity: 0.22,
  exposure: 1.08,
};
// With the TV off the room loses its key light; pull the ambient down a little too.
const TV_OFF_LIGHTS = { hemiIntensity: 0.6, fillIntensity: 0.8 };
// Hotspot rings: the dark boards make the stock chalk ring (0xc9b48a) glare, so tint it down here.
const RING_COLOR = new THREE.Color(0xc9b48a).multiplyScalar(0.5);

const CAMERA = { offset: [0, 3.4, 3.6], look: [0, 1.0, -1.2] };
// The follow camera tracks a proxy clamped to the middle of the room, so it never swings far
// enough out past the dollhouse cut to show the void around the flat.
const PROXY_LIMITS = { minX: -1.5, maxX: 1.5, minZ: -2.2, maxZ: 1.5 };

// Fallbacks if the scene build failed (the Director then supplies a bare ground).
const DEFAULT_SPOTS = {
  tv: [0.55, 1.3],
  phone: [1.75, -0.95],
  watch: [-0.95, -1.9],
  xray: [1.95, 0.85],
  bike: [-2.4, 0.4],
  bibs: [-1.4, -1.3],
  door: [2.23, -1.85],
};

const HAMMER = { first: 8, every: 9, gap: 0.9 };
// Hugo's clip for each look beat: [clip, play options].
const CLIPS = {
  tv: ['slump', { timeScale: 0.45 }],
  xray: ['arms_crossed'],
  bike: null, // he just looks up at it
  bibs: ['reach', { once: true }],
};
// The phone in his right hand: offset along the hand bone (+Y runs to the fingers) and turn.
const PHONE_GRIP = {
  p: new THREE.Vector3(0.0, 0.085, 0.025),
  q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, Math.PI / 2)),
};
const clamp = THREE.MathUtils.clamp;

export default {
  id: 'flat',
  get title() {
    return L.ch1.title;
  },
  hope: 0.04,
  preset: PRESET,
  get objective() {
    return L.ch1.objectives.start;
  },
  music: MUSIC,
  ambience: ['rain'],
  camera: CAMERA,
  player: { spawn: [-0.4, 1.5], facing: Math.PI, boot: true, limp: 1, painRate: 1 / 0.7, canJog: true, footsteps: 'boot' },
  build: (ctx) => buildScene1(ctx),

  async run(ctx, d) {
    const { hotspots, ui, world, mood, audio, player, cam, input } = ctx;
    const scene = world.current || {};
    const S = { ...DEFAULT_SPOTS, ...(world.spots || {}) };
    const call = (name, ...args) => (typeof scene[name] === 'function' ? scene[name](...args) : undefined);
    const chapter = d.index;
    const alive = () => d.index === chapter;

    // Boot day 4: the first stumble of the game is the fixed line.
    player.firstStumbleDone = false;

    // ---- camera: follow a clamped proxy instead of Hugo himself
    const proxy = new THREE.Object3D();
    proxy.name = 'ch1-camera-proxy';
    world.add(proxy);
    const syncProxy = () => {
      const p = player.root.position;
      proxy.position.set(clamp(p.x, PROXY_LIMITS.minX, PROXY_LIMITS.maxX), 0, clamp(p.z, PROXY_LIMITS.minZ, PROXY_LIMITS.maxZ));
    };
    syncProxy();
    world.onUpdate(syncProxy);
    cam.follow(proxy, { offset: CAMERA.offset, look: CAMERA.look });

    // Close-up shots are fire-and-forget tweens, so nothing here can block a skip.
    let shotId = 0;
    const shot = (name, dur = 1.1) => {
      const s = scene.shots?.[name];
      if (!s) return;
      shotId++;
      cam.tween({ pos: s.pos, look: s.look, fov: s.fov }, dur);
    };
    const back = (dur = 0.9) => {
      const my = ++shotId;
      const p = proxy.position;
      cam
        .tween(
          {
            pos: [p.x + cam.offset.x, p.y + cam.offset.y, p.z + cam.offset.z],
            look: [p.x + cam.look.x, p.y + cam.look.y, p.z + cam.look.z],
            fov: 55,
          },
          dur,
        )
        .then(() => {
          if (my === shotId && alive()) cam.follow(null);
        });
    };

    // Step Hugo to the stand point for a close-up and turn him toward the object. Bounded in time
    // and gated, and it always hands the player back (scripted = false).
    const approach = (name) => {
      const stand = scene.stand?.[name];
      const target = scene.focus?.[name];
      const root = player.root;
      if (!root || (!stand && !target)) return Promise.resolve();
      const to = stand ? new THREE.Vector3(stand[0], root.position.y, stand[1]) : root.position.clone();
      const walk = root.position.distanceTo(to) > 0.06 && !player.char?.isFallback;
      if (walk) {
        player.scripted = true;
        player.char?.play('walk', 0.2);
      }
      let t = 0;
      let arrived = !walk;
      let finish;
      const done = new Promise((resolve) => {
        let off = null;
        finish = () => {
          off?.();
          off = null;
          if (player.scripted) {
            player.scripted = false;
            player.char?.play('idle', 0.3);
          }
          resolve();
        };
        off = world.onUpdate((_dt, raw) => {
          t += raw;
          let goal = root.rotation.y;
          if (!arrived) {
            const dx = to.x - root.position.x;
            const dz = to.z - root.position.z;
            const dist = Math.hypot(dx, dz);
            if (dist < 0.03 || t > 1.6) {
              arrived = true;
              if (player.scripted) player.char?.play('idle', 0.3);
            } else {
              const step = Math.min(dist, 1.05 * raw);
              root.position.x += (dx / dist) * step;
              root.position.z += (dz / dist) * step;
              goal = Math.atan2(dx, dz);
            }
          }
          if (arrived && target) goal = Math.atan2(target.x - root.position.x, target.z - root.position.z);
          const diff = Math.atan2(Math.sin(goal - root.rotation.y), Math.cos(goal - root.rotation.y));
          root.rotation.y += diff * (1 - Math.exp(-9 * raw));
          if (arrived && (Math.abs(diff) < 0.03 || t > 2.4)) finish();
        });
      });
      return d.gate(done, () => {
        finish();
        return false;
      });
    };

    // Hugo's body language for a beat: take him off the Player (scripted) and play a clip; a
    // one-shot settles into idle when it ends. Returns the release, which hands him back.
    const pose = (clip, { once = false, timeScale } = {}) => {
      const ch = player.char;
      if (!clip || !ch || ch.isFallback) return () => {};
      player.scripted = true;
      const a = ch.play(clip, 0.35, { once, timeScale });
      let held = true;
      if (once && a) {
        const dur = a.getClip().duration / Math.max(0.1, Math.abs(a.getEffectiveTimeScale() || 1));
        d.after(Math.max(0.2, dur - 0.15), () => held && ch.play('idle', 0.45));
      }
      return () => {
        if (!held) return;
        held = false;
        player.scripted = false;
        ch.play('idle', 0.4);
      };
    };

    // The phone rides in his right hand while he reads it and listens to the voicemail.
    const _hp = new THREE.Vector3();
    const _hq = new THREE.Quaternion();
    const holdPhone = () => {
      const ph = scene.phoneMesh;
      const hand = player.char?.bone?.('hand_r');
      if (!ph || !hand) return () => {};
      const home = { p: ph.position.clone(), q: ph.quaternion.clone() };
      const off = world.onUpdate(() => {
        hand.getWorldPosition(_hp);
        hand.getWorldQuaternion(_hq);
        ph.quaternion.copy(_hq).multiply(PHONE_GRIP.q);
        ph.position.copy(PHONE_GRIP.p).applyQuaternion(_hq).add(_hp);
      });
      return () => {
        off();
        ph.position.copy(home.p);
        ph.quaternion.copy(home.q);
      };
    };

    // Each interaction is a small cutscene: Hugo holds still, other hotspots wait.
    const beat = (fn) => d.cinematic(fn, { letterbox: false });
    const look = (name, lines, { onOpen, onClose, clip } = {}) =>
      beat(async () => {
        shot(name);
        await approach(name);
        const release = pose(clip?.[0], clip?.[1]);
        onOpen?.();
        await d.say(lines);
        onClose?.();
        release();
        back();
      });

    // Every hotspot of the chapter goes through this, so its floor ring sits quietly on the boards.
    const addSpot = (opts) => hotspots.add({ ringColor: RING_COLOR, ...opts });

    d.after(10, () => !player.hasJogged && ui.hint(L.hints.jog));

    // ---- Hammering through the floor: three steady blows, every ~9 s, until he leaves.
    let hammering = true;
    let hammerThought = true; // the first burst plays the thought (deferred while a dialogue is up)
    const blow = () => {
      audio.hammer();
      call('knock');
      cam.shake(0.006, 0.12);
    };
    const burst = () => {
      if (!hammering) return;
      for (let i = 0; i < 3; i++) d.after(i * HAMMER.gap, blow);
      if (hammerThought && d.state === 'play' && !ui.modal) {
        d.after(HAMMER.gap * 2 + 0.6, () => {
          if (!hammerThought || ui.modal || d.state !== 'play') return;
          hammerThought = false;
          d.thought(L.ch1.hammer, 6.5);
        });
      }
      d.after(HAMMER.every + (Math.random() - 0.5) * 1.2, burst);
    };
    d.after(HAMMER.first, burst);

    // ---- TV: the stage replay, then turn it off (the room's key light goes with it).
    addSpot({
      id: 'tv',
      pos: S.tv,
      radius: 1.0,
      prompt: L.ch1.prompts.tv,
      onInteract: async () => {
        await look('tv', L.ch1.tv, { clip: CLIPS.tv });
        addSpot({
          id: 'tvOff',
          pos: S.tv,
          radius: 1.0,
          prompt: L.ch1.prompts.tvOff,
          onInteract: () =>
            beat(async () => {
              shot('tv', 0.8);
              await approach('tv');
              call('tvOff');
              audio.tick({ volume: 0.2 });
              mood.tweak(TV_OFF_LIGHTS, 1.2);
              await d.wait(1.0);
              await d.say(L.ch1.tvOff);
              back();
            }),
        });
      },
    });

    // ---- Phone: 12 unread, and the voicemail.
    addSpot({
      id: 'phone',
      pos: S.phone,
      radius: 1.0,
      prompt: L.ch1.prompts.phone,
      onInteract: () =>
        beat(async () => {
          shot('phone');
          await approach('phone');
          // He bends for it, then reads it, and the voicemail goes to his ear.
          const release = pose('pick_up', { once: true });
          await d.wait(0.42);
          const drop = holdPhone();
          call('phoneMode', 'awake');
          d.after(0.5, () => player.scripted && player.char?.play('phone', 0.5));
          await d.say(L.ch1.phone);
          call('phoneMode', 'read');
          drop();
          release();
          back();
        }),
    });

    // ---- X-ray on the fridge, the bike on its hooks, the bibs above the bed.
    addSpot({ id: 'xray', pos: S.xray, radius: 1.0, prompt: L.ch1.prompts.xray, onInteract: () => look('xray', L.ch1.xray, { clip: CLIPS.xray }) });
    addSpot({ id: 'bike', pos: S.bike, radius: 1.0, prompt: L.ch1.prompts.bike, onInteract: () => look('bike', L.ch1.bike, { clip: CLIPS.bike }) });
    addSpot({ id: 'bibs', pos: S.bibs, radius: 1.0, prompt: L.ch1.prompts.bibs, onInteract: () => look('bibs', L.ch1.bibs, { clip: CLIPS.bibs }) });

    // ---- The GPS watch (required): still on its charger, still counting.
    addSpot({
      id: 'watch',
      pos: S.watch,
      radius: 1.05,
      prompt: L.ch1.prompts.watch,
      required: true,
      onInteract: () =>
        beat(async () => {
          shot('watch', 1.2);
          await approach('watch');
          const release = pose('pick_up', { once: true });
          await d.wait(0.45);
          call('takeWatch');
          audio.tick({ volume: 0.18 });
          await d.say(L.ch1.watch);
          const W = L.ch1.watchHud;
          ui.watch(W.face, { label: W.label, lap: W.lap });
          await d.wait(0.7);
          await d.say(L.ch1.watchAfter);
          d.hope(0.06, 3);
          ui.watchBuzz(L.ch1.buzz, 3.2);
          await d.wait(1.7);
          await d.say(L.ch1.buzzReply);
          release();
          back();
        }),
    });

    await d.interact('watch');

    // ---- The door is the way out now.
    ui.objective(L.ch1.objectives.leave);
    call('doorReady');
    addSpot({
      id: 'door',
      pos: S.door,
      radius: 1.05,
      prompt: L.ch1.prompts.door,
      required: true,
      onInteract: () =>
        beat(async () => {
          shot('door', 1.3);
          await approach('door');
          await d.say(L.ch1.door);
        }),
    });
    await d.interact('door');
    d.hope(0.07, 3);

    // ---- START WALK? The watch nags until he presses Start; then the door, the fade, the hammer.
    await d.cinematic(
      async () => {
        ui.watchBuzz(L.ch1.startBuzz, 4.5);
        ui.prompt(L.ch1.prompts.start);
        let nag = 0;
        await d.until(() => {
          if (input.pressed.has('KeyE') || input.pressed.has('Enter')) {
            input.consume('KeyE');
            return true;
          }
          nag += ctx.engine.rawDt;
          if (nag > 6) {
            nag = 0;
            ui.watchBuzz(L.ch1.startBuzz, 4.5);
          }
          return false;
        });
        ui.prompt(null);
        // The watch's start chirp, and the face goes to WALK.
        audio.tone({ freq: 1760, dur: 0.07, volume: 0.1, type: 'square', bus: 'fx' });
        audio.tone({ freq: 2350, dur: 0.11, volume: 0.1, type: 'square', bus: 'fx', delay: 0.11 });
        ui.watch(L.ch1.walkFace, { label: L.ch1.walkLabel, lap: null });
        pose('reach', { once: true });
        await d.wait(0.35);
        call('openDoor');
        await d.wait(0.9);
        // One last burst from downstairs carries through the fade (the regular chain stops).
        hammering = false;
        for (let i = 0; i < 3; i++) d.after(0.4 + i * HAMMER.gap, () => audio.hammer());
        audio.music(MUSIC.name, { volume: 0.16, fade: 2 });
        await d.gate(ui.fade(1, 1.8));
        await d.wait(1.8);
      },
      { letterbox: false },
    );
  },
};
