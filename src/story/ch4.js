import { L } from './script.js';
import { sandDoor } from './ch4crafts.js';
import { measureTape, readingIndex } from './crafts/tape.js';
import { mixGrey } from './crafts/mixer.js';
import { dry, reveal } from './crafts/finish.js';
import { remember } from './memory.js';
import { buildScene4 } from '../world/scenes/scene4.js';
import { LOOK, SOUNDS, BED, RAIN, CHAPTER_CAMERA, CHAPTER_PLAYER, workshopKit } from './workshop.js';

// Ch4 « Mesurer deux fois »: Odile's workshop, Day 5 and Day 8 in the boot (docs/DESIGN.md, SCRIPT-R4 §5).
// Colour comes back on the things he makes and accumulates: the door (focus slot 0) here; Sami's bike
// (slot 1) in Ch5 Week 4 and the OPEN sign (slot 2) in Ch6 Week 7 (Revision 4 moved those weeks out).
// Every await goes through the Director (d.say / d.gate / d.until / d.interact ...), so
// __game.debug.skip() always progresses and no minigame can block. Staging helpers: story/workshop.js.

const T4 = L.ch4;
const N = L.notebook.items;

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
  camera: CHAPTER_CAMERA,
  player: CHAPTER_PLAYER,
  build: (ctx) => buildScene4(ctx),

  async run(ctx, d) {
    const { ui, player, mood, audio, cam, runner } = ctx;
    const W = ctx.world.current;
    const S = W.spots;
    const O = W.odile;
    player.firstStumbleDone = true; // day four is long gone: stumbles draw from the bag

    // ------------------------------------------------------------ helpers (story/workshop.js)
    const { follow, shot, back, faceTo, put, act, pose, putHugo, hugoXZ, walk, nb, cut, required, kettleOn, kettleOff, addRoomSpots } = workshopKit(ctx, d, W);
    addRoomSpots(); // the old signs and the radio, optional while a required spot waits
    W.setPegTape?.(true); // R4: Odile's tape on its outline until Day 8 (scene4 builds without it)
    W.setSpokeKey?.(false); // ...and the spoke key's outline beside it, empty (the hook)

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
    d.give('pencil'); // item+ pencil, with the exercise book (docs/SCRIPT-R4.md §5)
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

    // R4: the door answers before the sandpaper with its needs line (an optional spot while the
    // pegboard waits; required() only shows one required spot at a time, so it was unreachable).
    const early = (id, pos, prompt, needs, needsLine, object) => {
      ctx.hotspots.add({ id, pos, prompt, needs, needsLine, object, once: false, onInteract: async () => {} });
      return () => ctx.hotspots.remove(id);
    };
    const offDoorEarly = early('doorEarly', S.door, T4.prompts.door, 'sandpaper', T4.needs?.door, 'door');
    await required('pegboard', S.pegboard, T4.prompts.pegboard, async () => {
      player.face(-2.62, -3);
      await d.say(T4.day5.pegboard);
      W.takeSandpaper();
      d.give('sandpaper'); // into the pocket
      audio.sfx('tool_hook', { volume: 0.55 }); // fallback: scrape(0.12)
    });
    offDoorEarly();
    ui.objective(T4.objectives.sand);
    // Needs the sandpaper: E uses it from the pocket by itself (or held); without it, the needs line.
    await required('door', S.door, T4.prompts.door, null, { needs: 'sandpaper', needsLine: T4.needs?.door, object: 'door' });
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
        d.take('sandpaper'); // used up
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
    // R4 (SCRIPT-R4 §5): the tape is on the pegboard, on its own painted outline.
    ui.objective(T4.objectives.day8Tape);
    const offFrameEarly = early('frameEarly', S.frame, T4.prompts.frame, 'tape', T4.needs?.frame, null);
    await required('tapeTake', S.pegboard, T4.prompts.tapeTake, async () => {
      player.face(W.peg?.tape?.x ?? -2.7, -3);
      await shot(W.shots.pegboard, 0.9);
      await d.say(T4.day8.tapeTake);
      W.setPegTape?.(false);
      d.give('tape'); // item+ tape: « + Mètre ruban »
      audio.sfx('tool_take', { volume: 0.5, fallback: (a) => a.scrape({ volume: 0.1 }) });
      await d.wait(0.6);
      await back(0.8);
    });
    offFrameEarly();
    ui.objective(T4.objectives.day8);
    await required('frame', S.frame, T4.prompts.frame, null, { needs: 'tape', needsLine: T4.needs?.frame });
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

    // ============================================================ THE HOOK (Revision 4, SCRIPT-R4 §5)
    // Odile back at her bench; he goes to hang the tape back. « Garde-le. » Beside its outline, another one, empty.
    runner.walkTo(O, S.odileBench, { speed: 0.8, face: Math.PI }).then(() => act(O, 'lean', 0.5));
    ui.objective(T4.objectives.hook);
    await required('hook', S.pegboard, T4.prompts.hook, async () => {
      player.face(W.peg?.tape?.x ?? -2.7, -3);
      pose('reach');
      await shot(W.shots.pegboard, 1.0);
      await d.say(T4.day8.hook.slice(0, 1)); // « Garde-le. » He stops, the tape still in his hand.
      pose(null);
      audio.sfx('tool_hook', { volume: 0.25, rate: 1.15, fallback: false }); // his hand brushes the empty peg
      await d.say(T4.day8.hook.slice(1));
    });
    ui.objective(null);
    // Fade to black on the empty outline; the next chapter's title card follows.
    await d.gate(ui.fade(1, 1.6));

    // End of Ch4 (Revision 4): Week 4 is in ch5.js, Week 7 in ch6.js.
    kettleOff();
    audio.ambience(BED.name, false, { fade: 1.5 });
    audio.ambience(RAIN.name, false, { fade: 1.5 });
    ui.notebook.dock();
  },
};
