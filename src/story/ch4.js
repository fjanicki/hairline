import * as THREE from 'three';
import { L } from './script.js';
import { rhythm, timing, makeSteer, rememberOpenSign } from './minigames.js';
import { buildScene4 } from '../world/scenes/scene4.js';

// Ch4 "Measure Twice": Odile's workshop, Day 5 to Week 7 in the boot (docs/DESIGN.md).
// Colour comes back on the things he makes and accumulates: the door (focus slot 0), the bike
// (slot 1: Sami's, then Hugo's own race bike on the stand by Week 7), the OPEN sign (slot 2).
// Every await goes through the Director (d.say / d.gate / d.until / d.interact ...), so
// __game.debug.skip() always progresses and no minigame can block.

const T4 = L.ch4;
const N = L.notebook.items;
const CAM = { offset: [0, 3.4, 3.6], look: [0, 1.0, -0.6] };
const ODILE = L.names?.odile || 'Odile';

const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const clamp = THREE.MathUtils.clamp;

export default {
  id: 'workshop',
  title: T4.title,
  hope: 0.12,
  preset: 'workshop',
  objective: null,
  music: { name: 'contemplation', volume: 0.3, fade: 3 },
  ambience: [],
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
    /** Correction menu with an optional stage line after a given wrong reply (Day 8 "I know the type"). */
    const correctWith = async (menu, extra = {}) => {
      const who = menu.who || ODILE;
      for (let guard = 0; guard < 12; guard++) {
        const r = await d.choose(menu);
        const correctIdx = Math.max(0, menu.options.findIndex((x) => x.correct));
        const i = typeof r === 'number' && menu.options[r] ? r : correctIdx;
        const o = menu.options[i];
        if (o.reply) await d.say([{ who, text: o.reply }]);
        if (extra[i]) await d.say([extra[i]]);
        if (o.correct) return;
        o._used = true; // greyed next time, as in d.correct
      }
    };
    const pick = (bag, i) => bag[i % bag.length];

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
        audio.noise({ type: 'bandpass', freq: 1600, q: 1.4, dur: 0.6, volume: 0.05 });
        await d.say(T4.radio);
      },
    });

    // The rim kisses the pad once a turn (from Sami's arrival until it's true).
    W.bike.onRub = () => audio.tick({ volume: 0.22 });

    // ============================================================ DAY 5
    W.fluoro('flicker');
    W.rain(1);
    audio.ambience('rain', true, { volume: 0.1, lowpass: 600, fade: 3 });
    put(O, S.odileTrestle, S.spawn);
    follow(true);
    player.scripted = true;
    const walkIn = walk(player.char, [3.05, -1.5], { speed: 0.9 });
    await d.card(T4.cards.day5, { big: true, bg: 'clear' });
    await walkIn;
    player.scripted = false;
    player.face(O.root.position.x, O.root.position.z);
    faceTo(O, ...hugoXZ());

    await d.say(T4.day5.arrive);
    await d.say(T4.day5.book.slice(0, 1)); // she hands him a pencil and a school exercise book
    ui.notebook.set([]);
    ui.notebook.open(0);
    await d.say(T4.day5.book.slice(1));
    await nb(ui.notebook.add(N.ride));
    await nb(ui.notebook.add(N.run));
    await d.say(T4.day5.strike);
    await nb(ui.notebook.strike(N.ride));
    await nb(ui.notebook.strike(N.run));
    await d.say(T4.day5.strikeThink);
    await d.say(T4.day5.holdStill);
    await nb(ui.notebook.add(N.hold));
    ui.notebook.dock();
    await d.say(T4.day5.door);
    // Odile goes back to her bench; he goes to the board.
    runner.walkTo(O, S.odileBench, { speed: 0.8, face: Math.PI });
    ui.objective(T4.objectives.day5);

    await required('pegboard', S.pegboard, T4.prompts.pegboard, async () => {
      player.face(-2.62, -3);
      await d.say(T4.day5.pegboard);
      W.takeSandpaper();
      audio.scrape({ volume: 0.12 });
    });
    ui.objective(T4.objectives.sand);
    await required('door', S.door, T4.prompts.door);
    ui.objective(null);

    await d.cinematic(
      async () => {
        putHugo(S.hugoSand, [W.door.group.position.x, W.door.group.position.z - 1]);
        await shot(W.shots.sand, 1.2);
        await d.say(T4.day5.grain);
        await sanding();
        await d.wait(0.5);
        await d.say(T4.day5.after);
        await nb(ui.notebook.add(N.sand));
        d.hope(0.2);
      },
      { letterbox: false },
    );
    await back();

    async function sanding() {
      const SD = T4.sanding;
      const door = W.door;
      let progress = door.sand;
      let blockX = 0;
      let blockTarget = 0;
      let crossAt = -1e9;
      let mashI = 0;
      let buzzed = false;
      door.setBlock(true, 0, 0);
      const r = await rhythm(ctx, d, {
        band: [1.5, 2.5],
        mashAt: 3.4,
        idleAuto: { after: 6, rate: 2 },
        cooldown: 6,
        prompt: `[A / D] ${L.hints.sand}`,
        gauge: { label: SD.gauge },
        onStroke: (s, inBand) => {
          audio.scrape();
          progress = Math.min(1, progress + (inBand ? 0.035 : 0.012));
          blockTarget = s.lastKey === 'KeyA' ? -0.35 : 0.35;
          door.setSand(progress);
          if (!buzzed && progress >= 0.5) {
            buzzed = true;
            ui.watchBuzz(SD.buzz);
            d.after(2.6, () => d.thought(SD.buzzReply, 2));
          }
        },
        onMash: () => ui.thought(pick(SD.barks.mash, mashI++), 2.4, { who: SD.barks.who }),
        onFrame: (dt) => {
          // Across the grain (W/S): she notices.
          const across = ['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown'].some((k) => input.pressed.has(k));
          if (across && engine.now - crossAt > 6) {
            crossAt = engine.now;
            ui.thought(SD.barks.cross, 2.6, { who: SD.barks.who });
          }
          blockX = damp(blockX, blockTarget, 12, dt);
          const centre = 0.5 * Math.sin(progress * 9.0); // the block works its way along the door
          door.setBlock(true, (centre + blockX) / 0.9, clamp(progress * 1.12, 0, 1));
        },
        done: () => progress >= 1,
      });
      if (r.skipped) progress = 1;
      door.setSand(1);
      door.setBlock(false);
    }

    // ============================================================ DAY 8
    await cut(
      () => {
        player.limp = 0.82;
        putHugo([1.9, 0.95], [W.doorX, -2.9]);
        put(O, S.odileBench, [W.door.group.position.x, W.door.group.position.z]);
        follow(true);
      },
      { card: T4.cards.day8 },
    );
    await d.say(T4.day8.start);
    ui.objective(T4.objectives.day8);
    await required('frame', S.frame, T4.prompts.frame);
    ui.objective(null);

    await d.cinematic(
      async () => {
        const M = T4.day8.measure;
        putHugo(S.hugoFrame, [W.doorX, -3.2]);
        await shot(W.shots.frame, 1.0);
        await d.gate(player.crouch(0.6));
        W.tape.visible = true;
        audio.tick({ volume: 0.2 });
        await d.say(M.slice(0, 2)); // Eighty-one and a half. / Measure twice.
        W.tape.visible = false;
        await d.say(M.slice(2, 4)); // Again? / Yes.
        W.tape.visible = true;
        audio.tick({ volume: 0.2 });
        await d.say(M.slice(4, 5)); // ...Eighty-one and a half.
        W.tape.visible = false;
        await d.gate(player.stand(0.6));
        await d.say(M.slice(5)); // Doors lie. Frames lie worse...
        await nb(ui.notebook.add(N.measure));
      },
      { letterbox: false },
    );
    await back();
    player.face(O.root.position.x, O.root.position.z);
    faceTo(O, ...hugoXZ());
    await d.say(T4.day8.grey);
    await correctWith(T4.day8.greyMenu, { 1: T4.day8.greyLook });

    // Auto-paint (no minigame): the warm grey goes on in six bands; the door holds colour.
    await d.cinematic(
      async () => {
        await cut(() => {
          putHugo(S.hugoSand, [W.door.group.position.x, W.door.group.position.z - 1]);
          faceTo(O, W.door.group.position.x, W.door.group.position.z);
          cam.set(W.shots.paint);
        });
        await autoPaint();
        await d.wait(0.8);
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
      cam.set(W.shots.hungDoor);
    });
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
          audio.scrape({ volume: 0.18 });
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
        audio.ambience('rain', false, { fade: 2 });
        W.rain(0.25);
        putHugo([0.2, 1.1], [-3.5, 0.4]);
        put(O, S.odileBench);
        O.root.rotation.y = Math.PI; // at the bench, back to us
        K.root.visible = true;
        put(K, S.samiOutside);
        K.root.rotation.y = Math.PI / 2;
        W.parkBike(S.samiOutside[0] + 0.1, S.samiOutside[1] - 0.42, Math.PI / 2);
        W.bike.follow(K);
        cam.set(W.shots.samiIn);
      },
      { card: T4.cards.week4 },
    );

    await d.cinematic(
      async () => {
        await walk(K, S.samiParked, { speed: 1.15 });
        W.bike.follow(null);
        faceTo(K, ...hugoXZ());
        await shot(W.shots.threeShot, 1.1);
        await d.say(T4.week4.sami.slice(0, 1));
        faceTo(O, ...hugoXZ()); // "Don't look at me. Ask him."
        await d.say(T4.week4.sami.slice(1));
      },
      { letterbox: false },
    );
    O.root.rotation.y = Math.PI;
    await back();
    ui.objective(T4.objectives.week4);
    await required('bike', S.bike, T4.prompts.bike);
    ui.objective(null);

    await d.cinematic(
      async () => {
        await d.gate(ui.fade(1, 0.35));
        W.bikeOnStand(); // it flips onto the stand
        put(K, S.samiHold, [W.stand.x, W.stand.z]);
        putHugo(S.hugoBikeStand, [S.hugoBikeStand[0], S.hugoBikeStand[1] + 2]);
        W.bike.setSpin(1 / 2.4, { snap: true });
        cam.set(W.shots.truing);
        await d.gate(ui.fade(0, 0.45));
        await d.say(T4.week4.bike);
        await d.say(T4.week4.hold);
        await truing();
        await d.wait(0.9);
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
    K.root.visible = false;
    W.bike.follow(null);
    W.bike.group.visible = false;
    O.root.rotation.y = Math.PI;

    async function truing() {
      const TR = T4.week4.truing;
      const bike = W.bike;
      let amp = 0.07;
      let barkI = 0;
      bike.setWobble(amp);
      const res = await timing(ctx, d, {
        hits: 4,
        rings: 8,
        duration: 2.4,
        cue: TR.cue,
        shout: TR.shout,
        missText: null,
        onRing: () => {
          bike.setSpin(1 / 2.4, { snap: true });
          bike.syncRub(2.4 * 0.75); // the rub lands on the ring's perfect moment (tick via onRub)
        },
        onHit: () => {
          amp *= 0.6;
          bike.setWobble(amp);
          audio.ping();
        },
        onMiss: () => ui.thought(pick(TR.misses.bag, barkI++), 2.2, { who: TR.misses.who }),
      });
      if (!res.skipped && res.assisted > 0) ui.thought(TR.assisted.text, 2.6, { who: TR.assisted.who });
      bike.setWobble(0); // true and silent
      bike.setSpin(0.6);
      mood.focusOn(bike.group, { slot: 1, floor: 0.55, offsetY: 0.5 });
      d.hope(0.42);
    }

    // ============================================================ WEEK 7
    await cut(
      () => {
        player.limp = 0.75;
        W.fluoro('on'); // fixed, at last
        W.rain(0);
        putHugo([1.2, 1.1], [-1.5, -2.5]);
        put(O, S.odileBench);
        O.root.rotation.y = Math.PI;
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
        await d.say(B7.intro.slice(0, 5)); // ... "I need someone to—"
        await d.wait(0.9);
        await d.say(B7.intro.slice(5)); // "...Hold this board." ...

        // He takes her place at the board. (POV: Hugo hides so he doesn't fill the lens.)
        await d.gate(ui.fade(1, 0.35));
        put(O, S.odileAside, [W.board.group.position.x, W.board.group.position.z]);
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
        await d.say(B7.wrap);
      },
      { letterbox: false },
    );
    player.root.visible = true;
    W.board.setBrush(false);

    // Advance: Week 12.
    await d.gate(ui.fade(1, 1.0));
    ui.notebook.dock();
    await d.card(T4.cards.week12, { big: true });

    // ------------------------------------------------------------ lettering (local minigame)
    /**
     * LETTERING: six strokes over chalk guides. The path point advances on its own (0.45 board
     * widths/s); the tip = path point + an offset that drifts (smooth noise, growing over a stroke)
     * and that WASD corrects in screen space, with no momentum. Score = mean |offset| over the word.
     * Idle is fine (bounded drift, scores "middle"); steadying it scores "good"; a skip paints the guides perfectly.
     */
    async function lettering() {
      const Bd = W.board;
      const [CW] = Bd.size;
      const speed = 0.45 * CW; // px/s along the path
      const KPX = 34; // px of tip offset per unit
      let i = 0;
      let s = 0;
      let phase = 'lead';
      let wait = 1.1;
      let sum = 0;
      let n = 0;
      let steer = null;
      ui.prompt(L.hints.steer);
      const lead = () => {
        const [u, v] = Bd.paths[i].pts[0];
        Bd.setBrush(true, u, v, 0.025);
      };
      lead();
      const r = await d.until((dt) => {
        if (!(dt > 0)) return false;
        if (phase === 'lead') {
          wait -= dt;
          lead();
          if (wait <= 0) {
            phase = 'draw';
            s = 0;
            steer = makeSteer({ dims: 2, drift: 0.7, driftGrow: 0.2, gain: 0.9, recenter: 0.35, seed: 101 + i * 37 }); // idle lands in the middle tier
            Bd.lift();
          }
          return false;
        }
        const path = Bd.paths[i];
        const off = steer.step(dt, input);
        s += speed * dt;
        const [u, v] = Bd.pointAt(path, s);
        const tu = u + off.x * KPX;
        const tv = v - off.y * KPX; // W = up on screen = -v on the canvas
        Bd.paintTo(tu, tv);
        Bd.setBrush(true, tu, tv, 0);
        sum += off.length();
        n++;
        if (s >= path.length) {
          Bd.lift();
          i++;
          if (i >= Bd.paths.length) return true;
          phase = 'lead';
          wait = 0.7;
        }
        return false;
      });
      ui.prompt(null);
      if (r === 'skipped') for (let k = i; k < Bd.paths.length; k++) Bd.perfect(k);
      Bd.lift();
      Bd.setBrush(false);
      return n > 0 && r !== 'skipped' ? sum / n : 0;
    }

    /** Hugo letters a tiny "H.R." in the corner (one auto stroke). */
    async function initials() {
      const Bd = W.board;
      const [CW, CH] = Bd.size;
      let t = 0;
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
