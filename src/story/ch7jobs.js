import * as THREE from 'three';
import { L } from './script.js';
import { rhythm } from './minigames.js';
import { mem, remember } from './memory.js';
import { craftPointer } from './crafts/pointer.js';
import { reveal, dry } from './crafts/finish.js';
import { makeDust, scrapeAt, scrubber } from './crafts/juice.js';
import { trueWheel } from './crafts/truing.js';
import { letter } from './crafts/letters.js';
import { tuneRadio, STATIONS, signalAt } from './crafts/radio.js';
import { rigBike } from '../world/bikeRig.js';
import { wheelSound } from './crafts/sound.js';

// Ch7's (was Ch5) street jobs (docs/DESIGN.md R3.8): four optional hotspots between "Find Odile" and the line,
// each a short cinematic around a Ch4 craft: Mme Benali's shutter (the rhythm, scrubbed), Odile's
// radio (tuneRadio), Marco's A-board (letter()), Ines's wheel (trueWheel). Each ends on its reveal,
// brings its own spot's colour back (material saturation, no hope change) and writes mem.jobs.<id>,
// which the ending cards read. Props: world/scenes/scene5/jobs.js (W.jobs).
//
// setupJobs(ctx, d, W, {bark, followDefault, isRoaming, taught}) -> {close(), dispose(), busy(), pending()}
// Called after 'meet'; close() when the optional hotspots drop (the line). The shutter and the board
// open at once; the radio and Ines's wheel once Sami's chain is on (taught()): Sami parks by the
// radio for Teach, says it's still broken, and stands at the bike-shop window after. busy() is true
// while a job plays (ch7.js holds Sami's arrival for it); pending() while any job is still open.

const ORDER = ['shutter', 'radio', 'board', 'wheel'];
const PROMPT = { shutter: 'shutter', radio: 'radio', board: 'board', wheel: 'inesBike' };
const MUSIC_U = STATIONS.find((s) => s.id === 'music').u;
const ease = (k) => k * k * (3 - 2 * k);

export function setupJobs(ctx, d, W, api) {
  const J = W?.jobs;
  if (!J) return { close() {}, dispose() {}, busy: () => false, pending: () => false, callShutter() {} };
  const { hotspots, player, cam, ui, audio, engine, world } = ctx;
  const T = () => L.ch7.jobs; // read live: the language can change mid-chapter
  const H = player.char;
  const offs = [];
  let closed = false;

  const fade = (to, dur) =>
    d.gate(ui.fade(to, dur), () => {
      ui.fade(to, 0);
      return false;
    });
  const LATE = new Set(['radio', 'wheel']);
  let running = null;
  const open = (id) => !closed && !running && api.isRoaming() && !mem.jobs[id] && (!LATE.has(id) || api.taught());
  /** Hugo at his work spot, in a held clip (scripted, so the Player leaves it alone). */
  const stand = ([x, z, facing], clip) => {
    player.teleport(x, z, facing);
    player.scripted = true;
    H.play(clip, 0.3);
  };
  /** The job's colour: its materials from grey (0.15) to their own over 1.5 s. extra(k) rides along. */
  const colourBack = (ctrl, extra) => {
    let t = 0;
    const off = world.onUpdate((_dt, raw) => {
      t += raw;
      const k = Math.min(1, t / 1.5);
      ctrl.set(0.15 + 0.85 * ease(k));
      extra?.(ease(k));
      if (k >= 1) off();
    });
  };

  // ------------------------------------------------------------------ (a) Mme Benali's shutter
  async function shutter() {
    const S = J.spots.shutter;
    const sh = J.shutter;
    const TS = T().shutter;
    await fade(1, 0.35);
    stand(S.stand, 'push');
    cam.set(S.shot);
    await fade(0, 0.4);
    const P = craftPointer(ctx);
    const dust = makeDust(ctx);
    const at = new THREE.Vector3();
    let progress = 0;
    await rhythm(ctx, d, {
      band: [1.6, 2.6],
      mashAt: 3.4,
      idleAuto: { after: 5, rate: 2.1 },
      prompt: `${L.ch3.keys.both} ${L.ch4.sanding.hint}`,
      gauge: { label: TS.gauge },
      poll: scrubber(P),
      onStroke: (s, inBand) => {
        // One recorded push on the rusty runners per stroke, 0.35-0.5 by stroke strength (sfx.md Ch5).
        scrapeAt(audio, s.rate, { name: 'shutter_runner_scrape', volume: [0.35, 0.115], pitch: [0.94, 0.08], jitter: 0.05 });
        progress = Math.min(1, progress + (inBand ? 0.07 : 0.03));
        sh.twitch();
        const side = s.lastKey === 'KeyA' ? -1 : 1;
        dust.emit(sh.runnerAt(side, at), { n: 6, color: '#8a4a2a', dir: [0.4, -0.3, 0], speed: 0.45, spread: 0.6 });
      },
      onMash: () => {
        const m = T().shutter.mash;
        ui.thought(m.text, 2.4, { who: m.who });
      },
      done: () => progress >= 1,
    });
    P.dispose();
    // Up it goes, rattling all the way.
    H.play('idle', 0.4);
    audio.sfx('shutter_roll_up', {
      volume: 0.5,
      pos: sh.runnerAt(1, new THREE.Vector3()),
      ref: 2,
      fallback: (a) => {
        for (let i = 0; i < 20; i++) d.after(i * 0.08, () => a.noise({ type: 'highpass', freq: 1800, dur: 0.05, volume: 0.06 }));
      },
    });
    colourBack(sh.color, (k) => sh.setShop(k));
    await d.gate(sh.rollUp(1.6), () => {
      sh.setUp();
      return false;
    });
    sh.setUp();
    await reveal(ctx, d, { hold: 1.0, pulse: 0 }); // the flash, no hope: jobs keep their colour local
    sh.setShop(1);
    sh.color.set(1);
    await d.say(T().shutter.done);
    dust.dispose();
  }

  // ------------------------------------------------------------------ (b) Odile's radio
  async function radio() {
    const S = J.spots.radio;
    const R = J.radio;
    await fade(1, 0.35);
    player.teleport(S.stand[0], S.stand[1], S.stand[2]);
    player.root.visible = false; // POV: his hands are on the knob
    cam.set(S.shot);
    R.mode = 'job';
    R.voice.level(0.32, 0.6);
    await fade(0, 0.4);
    await tuneRadio(ctx, d, { radio: R, voice: R.voice, text: T().radio });
    colourBack(R.color);
    await reveal(ctx, d, { hold: 1.0, pulse: 0 }); // the flash, no hope: jobs keep their colour local
    await d.say(T().radio.done);
    // "Leave it on the music."
    const from = R.voice.u;
    let t = 0;
    await d.until(() => {
      t += engine.rawDt || 0.016;
      const k = Math.min(1, t / 1.2);
      const u = from + (MUSIC_U - from) * ease(k);
      R.voice.set(u);
      R.setDial(u);
      R.setSignal(Math.max(...STATIONS.map((s) => signalAt(u, s))));
      return k >= 1;
    });
    R.setDial(MUSIC_U);
    R.voice.set(MUSIC_U);
    R.voice.music(true);
    R.setSignal(1); // the lamp stays lit while the music plays
    R.color.set(1);
    R.mode = 'music';
    audio.music('piano', { volume: 0.12, fade: 2 });
  }

  // ------------------------------------------------------------------ (c) Marco's A-board
  async function board() {
    const S = J.spots.board;
    const A = J.board;
    const Bd = A.board;
    await fade(1, 0.35);
    player.teleport(S.stand[0], S.stand[1], S.stand[2]);
    player.root.visible = false; // POV, as at Ch4's easel
    cam.set(A.shot());
    Bd.guides(true);
    Bd.update();
    await fade(0, 0.4);
    // The primer comes up fresh as the strokes land.
    let fresh = 0;
    let freshTo = 0;
    const offFresh = world.onUpdate((_dt, raw) => {
      fresh += (freshTo - fresh) * (1 - Math.exp(-5 * raw));
      A.setFresh(fresh);
    });
    const n = Bd.paths.length;
    const score = await letter(ctx, d, Bd, { speed: 0.6, lead: 0.5, gap: 0.4, onStroke: (i) => (freshTo = (i + 1) / n) });
    offFresh();
    A.setFresh(1);
    Bd.guides(false);
    Bd.update();
    dry(ctx, Bd.material, { secs: 12 });
    colourBack(A.color);
    await reveal(ctx, d, { hold: 1.0, pulse: 0 }); // the flash, no hope: jobs keep their colour local
    const tiers = T().board.tiers;
    await d.say(score < 0.16 ? tiers.good : score < 0.42 ? tiers.middle : tiers.poor);
    A.color.set(1);
  }

  // ------------------------------------------------------------------ (d) Ines's wheel
  async function wheel() {
    const IB = J.inesBike;
    await fade(1, 0.4);
    if (!IB.rig) IB.rig = rigBike(IB.bike);
    IB.flip();
    stand(IB.stand(), 'kneel_work');
    cam.set(IB.shot());
    await fade(0, 0.45);
    const ticking = wheelSound(ctx, IB.rig); // the freewheel follows her wheel (hand turns, the free spin)
    try {
      await trueWheel(ctx, d, { rig: IB.rig, faults: [[3, 0.7], [10, 1.3]], text: T().wheel.truing });
      colourBack(IB.color);
      await reveal(ctx, d, { hold: 1.0, pulse: 0 }); // the flash, no hope: jobs keep their colour local
      const done = T().wheel.done;
      api.bark(done.text, done.who, 2.6);
      await d.wait(1.2);
      IB.color.set(1);
      await fade(1, 0.35);
    } finally {
      ticking.dispose();
    }
    IB.lean(); // back on its kickstand at the window
  }

  const JOBS = { shutter, radio, board, wheel };
  const run = async (id) => {
    if (mem.jobs[id]) return;
    running = id;
    // Where he stood to start it: his work spots can be off the walkable street (the shutter's in
    // the bakery doorway, the wheel's against the shop window), so he comes back here after.
    const back = [player.root.position.x, player.root.position.z, player.root.rotation.y];
    try {
      await d.cinematic(
        async () => {
          await JOBS[id]();
          remember(`jobs.${id}`, true);
          // Cut back to the street.
          await fade(1, 0.3);
          player.teleport(...back);
          player.root.visible = true;
          player.scripted = false;
          H.play('idle', 0.2);
          api.followDefault(true);
          await fade(0, 0.45);
        },
        { letterbox: false },
      );
    } finally {
      running = null;
    }
  };

  for (const id of ORDER) {
    const s = J.spots[id];
    hotspots.add({ id, pos: s.pos, radius: s.radius, prompt: L.ch7.prompts[PROMPT[id]], enabled: () => open(id), onInteract: () => run(id) });
  }

  // One approach bark per job (while it is open, within 4.5 m; Sami shouts about Ines's wheel from
  // the bike-shop window), never over another bark: the first waits 3 s after the opener, then at
  // most one every 4 s.
  const said = new Set();
  const NEAR = { wheel: 9 };
  let quietUntil = -1;
  offs.push(
    world.onUpdate(() => {
      if (closed || d.state !== 'play' || ui.modal || running) return;
      if (quietUntil < 0) quietUntil = engine.now + 3;
      if (engine.now < quietUntil) return;
      const p = player.root.position;
      for (const id of ORDER) {
        if (said.has(id) || !open(id)) continue;
        const [x, z] = J.spots[id].pos;
        if (Math.hypot(p.x - x, p.z - z) > (NEAR[id] ?? 4.5)) continue;
        said.add(id);
        quietUntil = engine.now + 4;
        const line = T()[id].near;
        api.bark(line.text, line.who, 3);
        break;
      }
    }),
  );

  return {
    busy: () => !!running,
    /** Any job still open (Odile's "Ready" asks once before closing them). */
    pending: () => ORDER.some(open),
    /** Mme Benali calls from up the street, if her shutter's still stuck and he's far from it. */
    callShutter() {
      if (said.has('shutter') || !open('shutter')) return;
      const p = player.root.position;
      const [x, z] = J.spots.shutter.pos;
      if (Math.hypot(p.x - x, p.z - z) < 8) return;
      const c = T().shutter.call;
      api.bark(c.text, c.who, 3.2);
      quietUntil = engine.now + 4;
    },
    /** The line is next: the jobs left undone stay undone. */
    close() {
      closed = true;
      for (const id of ORDER) hotspots.remove(id);
    },
    dispose() {
      closed = true;
      for (const off of offs) off();
    },
  };
}
