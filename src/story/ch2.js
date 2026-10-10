import * as THREE from 'three';
import { L } from './script.js';
import { parseNum } from './i18n.js';
import { buildScene2 } from '../world/scenes/scene2.js';
import { remember } from './memory.js';
import { streetBeds } from '../world/scenes/scene2/sound.js';
import { SIDEWALK_Y } from '../world/scenes/scene2/street.js';

// Ch2 "Never Stop": Rue des Tanneurs, late evening, rain (docs/DESIGN.md).
// Beats, in order (auto beats are z-thresholds in one sequential chain, each gated on 'play'):
//   start thought -> z < -6 PAUSE buzz + "No." -> z < -24 the run club and Bastien (+ after-lines once he has gone)
//   -> z < -42 the loop line, Odile on the scaffold -> HOLD STILL -> "Name one thing" -> "How far?" -> watch, cut to white.
// Optional hotspots: the ghost sign (stay put after it: the linger seed), the STRIDE billboard, the closed bike shop, the bench (sit / stand).
// The watch is live the whole walk: face = 0.32 km + metres walked; lap = 38:40 -> 41:10 from progress along z.
// Revision 4 (docs/SCRIPT-R4.md §3): z < -9, Mme Benali's shutter screams down in three jerks (non-blocking: her
// bark, his thought); after the club, at ENCRE FINE (spots.joLadder), Jo on her stepladder (blocking, short:
// the call, the menu (option 1 = remember('joSign')), the sign slapped straight, she goes in, the door slams).

const T = L.ch2;
const CAM = { offset: [0, 2.6, 4.2], look: [0, 1.1, 0] };
const SPAWN = [0.8, 6];
const PAUSE_Z = -6;
const CLUB_Z = -24;
const ARRIVE_Z = -42;
const FADE_Z = -46; // the club fades out here
// club_pass_wet at the pass. The doc says 0.5: under rain.ogg, the music and the drone that measured
// +1.4 dB over the bed at the pass. 1.0 is the file's ceiling (its splashes peak at -1.6 dBFS).
const PACK_VOL = 1.0;
const RAIN_VOL = 0.22;
const STILL_SECS = 7; // HOLD STILL: seconds of stillness to fill the gauge
const ASSIST_AFTER = 25;
// R4: Mme Benali's shutter. SCRIPT-R4 says z < -9, but from there the follow camera has the bakery behind it:
// it starts at -3 (the shutter fully in frame on the left) and the PAUSE beat waits for her bark.
const SHUTTER_Z = -3;
const SHUTTER_LATE_Z = -16; // past this without the beat (a skip): the shutter is simply down
const JO_AHEAD = 5.5; // R4: Jo calls out when Hugo is this far short of her ladder (z)
// Recorded sfx sets (docs/assets/sfx.md, Integration "Ch2"), preloaded with the chapter through `sounds`.
// The beds start in run() (the Director only toggles rain / crowd); scene2 runs the hums and the drips.
const SOUNDS = [
  'amb_street_night',
  'amb_city_far',
  'amb_street_wet',
  'amb_drips',
  'neon_buzz',
  'fluoro_hum',
  'club_pass_wet',
  'run_step',
  'creak_wood',
  'creak_wood_alt',
  'scaffold_creak',
  'brush_stroke',
  'boot_step_wet',
  'body_thud',
  // R4 (.cache/r4/sfx-names.md): the bakery shutter, Jo's door and her palm on the sign
  'shutter_scream',
  'door_slam',
  'table_tock',
];
/** True while a voice clip is being said (French voices; docs/voice.md): big one-shots step back. */
const speaking = (ctx) => ctx.voice?.cur?.state === 'playing';
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const parseLap = (s) => {
  const [m, sec] = String(s).split(':').map(Number);
  return (m || 0) * 60 + (sec || 0);
};
const fmtLap = (t) => {
  const s = Math.floor(t);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
/** Shuffled bag: no repeats until every item has been drawn. Shuffles indices, so a language change applies at once. */
function bag(items) {
  let pool = [];
  let last = null;
  return () => {
    if (!pool.length) {
      pool = items.map((_, i) => i).sort(() => Math.random() - 0.5);
      if (pool.length > 1 && pool[pool.length - 1] === last) pool.unshift(pool.pop());
    }
    last = pool.pop();
    return items[last];
  };
}

export default {
  id: 'street',
  get title() {
    return T.title;
  },
  hope: 0.07,
  preset: 'street',
  get objective() {
    return T.objectives.start;
  },
  music: { name: 'contemplation', volume: 0.3 },
  ambience: ['rain'],
  sounds: SOUNDS,
  camera: { offset: CAM.offset, look: CAM.look },
  player: { spawn: SPAWN, facing: Math.PI, boot: true, limp: 0.95, painRate: 1 / 0.9, footsteps: 'boot' },
  build: (ctx) => buildScene2(ctx, { variant: 'evening' }),

  async run(ctx, d) {
    const { ui, player, input, cam, hotspots, audio, world, engine } = ctx;
    const S = world.current || {};
    const spots = world.spots || {};
    const shots = S.shots || {};
    const seat = S.seat || { x: -5.32, z: -36.5, facing: Math.PI / 2, standX: -4.8 };
    const offs = [];
    let lock = false; // optional hotspots off during the club and from the arrival on
    const ready = () => d.state === 'play' && !ui.modal && !lock;
    const follow = () => cam.follow(player.root, { offset: CAM.offset, look: CAM.look });

    // ------------------------------------------------------------ sound: the street under the rain
    // The boot clumps on wet asphalt (audio.surface 'street'); the beds follow z (wet road end -> night street).
    audio.surface = 'street';
    // rain.ogg is ~12 dB hotter than the normalised recorded beds: at the Director's 0.35 it buries the
    // street and the club pass (measured +1.4 dB at the pass). 0.22 (-4 dB) lets the street through.
    audio.ambience('rain', true, { volume: RAIN_VOL, fade: 2 });
    const beds = streetBeds(audio);
    beds.start(player.position.z);
    // The rain eases with the picture (scene2.js: full to z -30, x0.25 by -40, x0.12 under the No. 14
    // awning); the sound keeps a floor (on the awning it still drums): 0.22 -> 0.12 -> 0.09.
    let rainVol = RAIN_VOL;
    const rainEase = (z) => (z > -30 ? 1 : z > -40 ? 1 - 0.75 * ((-30 - z) / 10) : z > -44.5 ? 0.25 : 0.12);
    offs.push(
      world.onUpdate(() => {
        const z = player.position.z;
        beds.update(z);
        const v = +(RAIN_VOL * (0.35 + 0.65 * rainEase(z))).toFixed(3);
        if (Math.abs(v - rainVol) >= 0.004) {
          rainVol = v;
          audio.ambience('rain', true, { volume: v, fade: 1.2 });
        }
      }),
    );

    // ------------------------------------------------------------ the live watch
    const seed = L.watch?.atChapter?.[1] || {};
    const face0 = parseNum(seed.face) || 0.32;
    const lap0 = parseLap(T.lapStart);
    const lap1 = parseLap(T.lapEnd);
    const z0 = player.position.z;
    const prev = player.position.clone();
    let walked = 0;
    let progress = 0;
    let live = true;
    let shown = '';
    const watchFace = () => `${(face0 + walked / 1000).toFixed(2)} km`;
    offs.push(
      world.onUpdate(() => {
        if (!live) return;
        const p = player.position;
        const step = Math.hypot(p.x - prev.x, p.z - prev.z);
        if (step < 0.5) walked += step; // a teleport is not a walk
        prev.copy(p);
        progress = Math.max(progress, clamp((z0 - p.z) / (z0 - ARRIVE_Z), 0, 1));
        const face = watchFace();
        const lap = fmtLap(lap0 + progress * (lap1 - lap0));
        const key = face + lap;
        if (key !== shown) {
          shown = key;
          ui.watch(face, { lap, tick: false });
        }
      }),
    );

    d.after(0.8, () => d.thought(T.start, 5.5));

    // ------------------------------------------------------------ the bench (sit / stand)
    let seated = false;
    let benchSaid = false;
    const sit = async () => {
      seated = true;
      player.teleport(seat.x, seat.z, seat.facing);
      d.after(0.45, () => audio.sfx('creak_wood', { volume: 0.3, alt: 'creak_wood_alt', pos: [seat.x, 0.5, seat.z], ref: 2 })); // his weight lands
      await d.gate(player.setPose('sit', 0.7));
      if (!benchSaid) {
        benchSaid = true;
        await d.say(T.bench);
      }
    };
    const standUp = async (instant = false) => {
      if (!seated) return;
      seated = false;
      const sp = hotspots.get('bench');
      if (sp) sp.prompt = T.prompts.bench;
      if (instant) player.setPose('stand', 0);
      else {
        audio.sfx('creak_wood', { volume: 0.2, rate: 1.08, alt: 'creak_wood_alt', pos: [seat.x, 0.5, seat.z], ref: 2 });
        await d.gate(player.setPose('stand', 0.6));
      }
      player.teleport(seat.standX, seat.z, Math.PI);
    };
    offs.push(
      world.onUpdate((dt) => {
        if (seated) player.pain = Math.max(0, player.pain - 1.6 * dt); // a sit drains it fast
      }),
    );

    // ------------------------------------------------------------ R4: Mme Benali and her shutter; Jo on her ladder
    const shutter = shutterBeat(ctx, d, S, { ready, offs });
    const jo = makeJo(ctx, S);

    // ------------------------------------------------------------ optional hotspots
    const look = (shot, lines) =>
      d.cinematic(
        async () => {
          if (shot) await d.gate(cam.tween(shot, 1.1));
          await d.say(lines);
          follow();
        },
        { letterbox: false },
      );
    const ghostLook = () => {
      // Hand-painted letters: a breath of their old ochre while he reads them, fading after.
      if (S.signs?.ghost) ctx.mood.focusOn(S.signs.ghost, { slot: 3, strength: 0.6, decay: 0.08, floor: 0, offsetY: 0, radius: 0.3 });
      // The shot stays on the sign after the thought (ghostLinger hands the camera back).
      return d
        .cinematic(
          async () => {
            if (shots.ghost) await d.gate(cam.tween(shots.ghost, 1.1));
            await d.say(T.ghost);
          },
          { letterbox: false },
        )
        .then(ghostLinger);
    };
    // Seed: the look lingers. The camera holds on the sign until he moves; if he stays put 2.5 s (no
    // movement key), the old letters take a little colour back (slot 3's floor 0 -> 0.42 over 1.3 s)
    // and he notices the hairlines. Once. Moving (or 7 s later) hands the camera back and the colour
    // fades over ~3 s (the slot's 0.08/s decay).
    const ghostLinger = () => {
      const sign = S.signs?.ghost;
      const f = ctx.mood.focus?.[3];
      if (!sign || !f || !spots.ghost || lock) return follow();
      const [gx, gz] = spots.ghost;
      const last = player.position.clone();
      let still = 0;
      let on = 0; // seconds since the linger began
      let state = 'wait'; // wait | on
      const off = world.onUpdate((_dt, raw) => {
        const p = player.position;
        const moved = Math.hypot(p.x - last.x, p.z - last.z) > 0.002 || MOVE_KEYS.some((k) => input.isDown(k));
        last.copy(p);
        const inside = !lock && Math.hypot(p.x - gx, p.z - gz) <= 2.3;
        let end = moved || !inside;
        if (state === 'wait' && !end) {
          still = ready() ? still + raw : 0;
          if (still >= 2.5) {
            state = 'on';
            ctx.mood.focusOn(sign, { slot: 3, strength: f.obj === sign ? f.value : 0, decay: 0.08, floor: 0, offsetY: 0, radius: 0.3 });
            d.thought(T.ghostLinger, 5.5);
            remember('seeds.ghost', true);
            beds.dip(true);
          }
        }
        if (state === 'on') {
          on += raw;
          end = end || on > 7;
          if (f.obj === sign) f.floor = end ? 0 : Math.min(0.42, on / 3);
        }
        if (!end) return;
        off();
        if (state === 'on') beds.dip(false);
        follow(); // also after a skip's teleport: the club then tweens from the street view
      });
      offs.push(off);
    };
    if (spots.ghost) hotspots.add({ id: 'ghost', pos: spots.ghost, radius: 2.3, prompt: T.prompts.ghost, enabled: () => !lock, onInteract: ghostLook });
    if (spots.billboard) hotspots.add({ id: 'billboard', pos: spots.billboard, radius: 2.5, prompt: T.prompts.billboard, enabled: () => !lock, onInteract: () => look(shots.billboard, T.billboard) });
    if (spots.shop) hotspots.add({ id: 'shop', pos: spots.shop, radius: 2.2, prompt: T.prompts.shop, enabled: () => !lock, onInteract: () => look(shots.shop, T.shop) });
    if (spots.bench) {
      hotspots.add({
        id: 'bench',
        pos: spots.bench,
        radius: 1.4,
        prompt: T.prompts.bench,
        once: false,
        enabled: () => !lock,
        onInteract: async (spot) => {
          if (seated) await standUp();
          else {
            spot.prompt = T.prompts.stand;
            await sit();
          }
        },
      });
    }

    /** After a skipped threshold: put Hugo just past it (standing), so the rest stays consistent. */
    const jumpTo = (z) => {
      if (seated) standUp(true);
      player.setPose('stand', 0);
      player.teleport(clamp(player.position.x, -4.6, 4.6), Math.min(player.position.z, z), Math.PI);
      prev.copy(player.position);
      cam.snap();
    };

    // ------------------------------------------------------------ z < -6: PAUSE ACTIVITY?
    let r = await d.until(() => ready() && player.position.z < PAUSE_Z && shutter.quiet());
    if (r === 'skipped') jumpTo(PAUSE_Z - 0.3);
    ui.watchBuzz(T.pauseBuzz, 2.6);
    d.after(2.8, () => d.thought(T.pauseReply, 1.6));
    shutter.pauseDone(4.8); // his shutter thought comes after the « Non. »

    // ------------------------------------------------------------ z < -24: the run club
    r = await d.until(() => ready() && player.position.z < CLUB_Z);
    if (r === 'skipped') jumpTo(CLUB_Z - 0.3);
    lock = true;
    await runClub(ctx, d, S, { follow });
    lock = false;
    shutter.done(); // a skip past the bakery: the shutter is simply down

    // ------------------------------------------------------------ R4: Jo at ENCRE FINE (blocking, short)
    if (jo) {
      const jz = jo.ladder.pos[2] + JO_AHEAD;
      r = await d.until(() => ready() && player.position.z < jz);
      if (r === 'skipped') jumpTo(jz - 0.3);
      lock = true;
      if (seated) await standUp();
      await joCameo(ctx, d, S, jo, { follow });
      lock = false;
    }

    // ------------------------------------------------------------ z < -42: back where he started
    r = await d.until(() => ready() && player.position.z < ARRIVE_Z);
    if (r === 'skipped') jumpTo(ARRIVE_Z - 0.3);
    lock = true;
    for (const id of ['ghost', 'billboard', 'shop', 'bench']) hotspots.remove(id);
    if (seated) await standUp();
    live = false;
    ui.watch(watchFace(), { lap: T.lapEnd, tick: false });
    await d.say(T.arrivalLoop);

    const odileTop = new THREE.Vector3(-0.75, 2.9, -46.7);
    await d.cinematic(async () => {
      const p = player.position;
      player.face(odileTop.x, odileTop.z);
      await d.gate(cam.tween({ pos: [clamp(p.x + 1.5, -4.2, 4.4), 1.75, p.z + 2.8], look: [odileTop.x, 2.5, odileTop.z], fov: 50 }, 1.6));
      await d.say(T.arrival);
    });

    // ------------------------------------------------------------ HOLD STILL
    ui.objective(T.objectives.hold);
    await d.gate(ui.fade(1, 0.3));
    const spot = S.holdSpot || [0.32, -44.88];
    const leg = S.holdLeg || [-0.05, -45.25];
    player.setPose('stand', 0);
    player.teleport(spot[0], spot[1]);
    player.face(leg[0], leg[1]);
    player.frozen = true;
    if (shots.hold) cam.set(shots.hold);
    // Staging: one hand round the tower leg (the player stays frozen; the clip is only the pose).
    player.scripted = true;
    player.char.play('hold_can', 0.4);
    await d.gate(ui.fade(0, 0.45));
    await holdStill(ctx, d, S);
    ui.objective(null);
    d.hope(0.09);
    // The finished lettering is the first thing in the street to take colour back.
    if (S.fascia?.mesh) ctx.mood.focusOn(S.fascia.mesh, { slot: 2, strength: 0.85, decay: 0.12, floor: 0.3, offsetY: 0, radius: 0.2 });

    // Odile climbs down behind a short cut.
    await d.wait(0.6);
    await d.gate(ui.fade(1, 0.35));
    player.scripted = false;
    player.char.play('idle', 0.2);
    S.odileDown?.(spot);
    if (S.odileGround) player.face(S.odileGround[0], S.odileGround[1]);
    if (shots.after) cam.set(shots.after);
    await d.wait(0.25);
    await d.gate(ui.fade(0, 0.5));

    // ------------------------------------------------------------ "Name one thing."
    await d.say(T.after);
    await d.correct(T.nameOne);
    d.hope(0.12);

    // ------------------------------------------------------------ "How far?"
    // Hugo turns to go: a slow turn toward the street (+Z).
    {
      const from = player.root.rotation.y;
      const to = 0.25;
      let t = 0;
      await d.until((dt) => {
        t += engine.rawDt;
        const k = Math.min(1, t / 0.6);
        player.root.rotation.y = from + (to - from) * (k * k * (3 - 2 * k));
        return k >= 1;
      });
      player.root.rotation.y = to;
    }
    await d.say(T.leaving);
    // He looks down at his wrist.
    ui.watch(L.watch.zero, { label: L.watch.labels.week, lap: T.howFarLap, tick: true });
    ui.watchFocus(true, { flare: T.flare });
    await d.wait(1.8);
    // The cut to white takes the street with it (the rain carries on into the dawn run).
    beds.stop(0.3);
    S.stopSound?.(0.3);
    await d.gate(ui.fade(1, 0.25, '#fff'));
    for (const off of offs) off();
  },
};

// ------------------------------------------------------------------ R4: Mme Benali's shutter

/**
 * z < -9 (once, non-blocking, after the PAUSE thought): Mme Benali drags her shutter down; it screams and comes
 * down in three jerks. Then her bark over the noise, then his thought. A world.onUpdate watcher, not a d.until,
 * so the main chain (and skip) never waits on it. Returns { done() } (a skip past it: the shutter is down).
 */
function shutterBeat(ctx, d, S, { ready, offs }) {
  const { player, audio, world, assets, ui } = ctx;
  const B = S.bakery;
  const T = L.ch2.shutter;
  if (!B) return { done() {} };
  const f = B.focus; // the street-end rail at hinge height (world)
  // She stands on the pavement in front of the middle of the shutter, facing it (-X), the hook in her hands.
  const at = [f.x + 0.75, f.z + 2.0];
  const benali = assets.makeCharacter({ preset: 'mme', name: 'Mme Benali' });
  benali.root.position.set(at[0], SIDEWALK_Y, at[1]);
  benali.root.rotation.y = -Math.PI / 2;
  benali.play('hold_can', 0);
  world.add(benali.root);
  const shutterPos = [f.x, 1.4, f.z + 2.2];
  let state = 'wait';
  let since = 0; // seconds since the chapter started (the PAUSE beat is ~2.8 s after z -6)
  let barked = false;
  let thoughtAt = null; // seconds (since): set by the main chain after the PAUSE beat
  let thought = false;
  const finish = () => {
    if (state === 'done') return;
    state = 'done';
    B.setOpen(0);
    benali.root.visible = false;
  };
  const go = () => {
    state = 'run';
    benali.play('reach', 0.25);
    // The scream (one recording, 1.6-2 s) and its three judders.
    audio.sfx('shutter_scream', { volume: 0.6, pos: shutterPos, ref: 3, jitter: 0.02 });
    B.setOpen(0.5, 0.42);
    d.after(0.72, () => B.setOpen(0.24, 0.38));
    d.after(1.36, () => B.setOpen(0, 0.42));
    d.after(1.95, () => {
      // Pardon! She turns to him, over the last of the noise.
      const p = player.position;
      benali.root.rotation.y = Math.atan2(p.x - benali.root.position.x, p.z - benali.root.position.z);
      benali.play('talk', 0.3);
      ui.thought(T.bark.text, 3.4, { who: T.bark.who });
    });
    d.after(5.4, () => {
      barked = true;
      benali.play('arms_crossed', 0.4);
    });
    d.after(6.5, () => {
      state = 'over';
    });
  };
  offs.push(
    world.onUpdate((_dt, raw) => {
      since += raw;
      const z = player.position.z;
      if (barked && !thought && thoughtAt !== null && since >= thoughtAt && state !== 'done') {
        thought = true;
        d.thought(T.thought, 5.5);
      }
      if (state === 'wait') {
        if (z < SHUTTER_LATE_Z) return finish();
        if (z < SHUTTER_Z && ready()) go();
      } else if (state === 'over' && z < -22) {
        // She has gone in; the run club needs the pavement.
        state = 'done';
        benali.root.visible = false;
      }
    }),
  );
  return {
    done: () => state === 'wait' && finish(),
    /** False while the scream and her bark are on (the PAUSE beat waits). */
    quiet: () => state !== 'run' || barked,
    /** The PAUSE beat has played: his thought `secs` later, once her bark is over. */
    pauseDone(secs) {
      thoughtAt = since + secs;
    },
  };
}

// ------------------------------------------------------------------ R4: Jo at ENCRE FINE

/** Jo on the third step of her ladder under the crooked sign (null if the set has no ladder). */
function makeJo(ctx, S) {
  const jl = S.encre?.joLadder;
  if (!jl) return null;
  const char = ctx.assets.makeCharacter({ preset: 'jo', name: 'Jo' });
  // On the second step (0.6 m), not the third: her head clears the board and her hands reach it.
  char.root.position.set(jl.pos[0], SIDEWALK_Y + 0.615, jl.pos[2] + 0.076);
  char.root.rotation.y = Math.PI + (jl.facing || 0); // on the steps, facing the sign over the ladder top
  char.play('paint', 0);
  ctx.world.add(char.root);
  return { char, ladder: jl, ground: SIDEWALK_Y };
}

/**
 * The cameo: « Hey, le grand avec la botte ! », the menu, the palm on the sign, « Tu. On est pas à la banque. »,
 * she climbs down and goes in; the door slams; his thought.
 */
async function joCameo(ctx, d, S, J, { follow }) {
  const { player, cam, audio, world, runner, engine } = ctx;
  const T = L.ch2.jo;
  const { char } = J;
  const jr = char.root;
  const E = S.encre;
  const turnToHugo = () => {
    const p = player.position;
    jr.rotation.y = Math.atan2(p.x - jr.position.x, p.z - jr.position.z);
  };
  const twoShot = () => {
    const p = player.position;
    // Over his left shoulder on the line from her to him: he stands in the right third, she is up her
    // ladder left of centre. (The old shot looked across at the ladder from the street's middle and
    // left him ~60° out of frame.)
    const jx = jr.position.x;
    const jz = jr.position.z;
    let dx = p.x - jx;
    let dz = p.z - jz;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    const [rx, rz] = [dz, -dx]; // screen right when looking from him to her
    const cx = clamp(p.x + dx * 2.3 - rx * 1.1, -4.2, 4.4);
    const cz = p.z + dz * 2.3 - rz * 1.1;
    return { pos: [cx, 1.7, cz], look: [jx + (p.x - jx) * 0.35, 1.95, jz + (p.z - jz) * 0.35], fov: 32 };
  };
  await d.cinematic(
    async () => {
      // She turns on her step and calls down; he stops and looks up.
      turnToHugo();
      char.play('call_out', 0.25);
      player.face(jr.position.x, jr.position.z);
      await d.gate(cam.tween(twoShot(), 1.0));
      await d.say(T.call);
      char.play('talk', 0.3);
      const pick = await d.choose(T.menu);
      if (pick === 0) remember('joSign', true); // the honest answer (warmth +1, SCRIPT-R4 §11.2)

      // The palm: she turns back to the board and slaps it straight, first time, no level.
      jr.rotation.y = Math.PI + (J.ladder.facing || 0);
      char.play('reach', 0.2, { once: true });
      if (S.shots.jo) cam.tween(S.shots.jo, 0.8);
      d.after(0.45, () => {
        E.straighten?.(0.18);
        const c = E.focus?.sign;
        audio.sfx('table_tock', { volume: 0.4, rate: 0.8, pos: c ? [c.x, c.y, c.z] : null, ref: 2 });
      });
      await d.say(T.after.slice(0, 1));
      turnToHugo();
      char.play('talk', 0.3);
      await d.gate(cam.tween(twoShot(), 0.8));
      await d.say(T.after.slice(1, 7));

      // She climbs down and goes in; the door slams.
      let gone = false; // the door has slammed (a skip ends the walk early: nothing reopens it after)
      const leave = (async () => {
        char.play('stand', 0.2);
        audio.sfx('creak_wood', { volume: 0.25, rate: 1.3, alt: 'creak_wood_alt', pos: J.ladder.pos, ref: 2 });
        const y0 = jr.position.y;
        let t = 0;
        await new Promise((res) => {
          const off = world.onUpdate((_dt, raw) => {
            t += raw;
            const k = Math.min(1, t / 0.6);
            jr.position.y = y0 + (J.ground - y0) * k;
            if (k >= 1) {
              off();
              res();
            }
          });
        });
        const door = S.spots.joDoor;
        await runner.walkTo(char, [door[0] + 0.15, door[1] + 0.5], { speed: 1.25 });
        if (gone) return;
        E.setOpen?.(1, 0.3);
        await new Promise((res) => engine.after(0.3, res));
        const inside = S.spots.encreInside;
        if (gone) return;
        await runner.walkTo(char, [door[0] + (inside[0] - door[0]) * 0.35, door[1] + (inside[1] - door[1]) * 0.35], { speed: 1.25 });
      })();
      const done = () => {
        gone = true;
        jr.visible = false;
        E.setOpen?.(0, 0.12);
        const dp = S.spots.joDoor;
        audio.sfx('door_slam', { volume: 0.5, pos: [dp[0], 1.2, dp[1]], ref: 3 });
      };
      await d.say(T.after.slice(7, 8));
      await d.gate(leave, () => false);
      done();
      await d.wait(0.5);
      await d.say(T.after.slice(8));
    },
    { letterbox: false },
  );
  player.root.rotation.y = Math.PI;
  follow();
}

// ------------------------------------------------------------------ the run club

/**
 * Five runners come up from behind (+Z) and run past toward -Z (moved by hand). Bastien drops back
 * and jogs on the spot beside Hugo for the exchange, then runs off and fades at z -46; only then
 * the after-lines.
 */
async function runClub(ctx, d, S, { follow }) {
  const { player, ui, cam, audio, world, engine } = ctx;
  const club = S.club || [];
  if (!club.length) {
    await d.say(L.ch2.club);
    await d.say(L.ch2.clubAfter);
    return;
  }
  const px = player.position.x;
  const pz = player.position.z;
  const side = px < 1.2 ? 1 : -1; // pass on the side with more room
  const PACK = [
    [0.95, 0.0],
    [1.65, 1.1],
    [2.4, 0.4],
    [1.3, 2.3],
    [2.2, 3.0],
  ];
  const runners = club.map((char, i) => {
    const lane = clamp(px + side * PACK[i][0], -4.6, 4.6);
    char.root.position.set(lane, 0, pz + 12 + PACK[i][1]);
    char.root.rotation.y = Math.PI;
    char.setOpacity(1);
    char.root.visible = true;
    const v = 3.5 + i * 0.07;
    const a = char.play('run', 0.1);
    if (a) a.timeScale = char.strideRate('run', v); // cadence from ground speed: planted feet
    return { char, lane, v, mode: i === 0 ? 'approach' : 'run', fading: false, gone: false, beside: 0 };
  });
  const B = runners[0];
  // Sound: the pack is one recording (club_pass_wet) placed at the pack's centre, so it comes up from
  // behind, pans past on its side and thins out up the street (the inverse distance gain makes the
  // approach and the fade). Bastien's own steps (run_step) are separate. While a line is being said the
  // pack steps back 6 dB. Without the file the old per-runner patter plays instead.
  const pack = runners.slice(1);
  const packPos = [px, 0.6, pz + 13];
  const packAt = () => {
    let n = 0;
    let x = 0;
    let z = 0;
    for (const r of pack) {
      if (r.gone) continue;
      const q = r.char.root.position;
      x += q.x;
      z += q.z;
      n++;
    }
    if (n) {
      packPos[0] = x / n;
      packPos[2] = z / n;
    }
    return packPos;
  };
  packAt();
  const packSnd = audio.sfx('club_pass_wet', { volume: PACK_VOL, bus: 'bus', pos: packAt, ref: 3, rolloff: 1, jitter: 0.03, fallback: false });
  let packDuck = 1;
  let bStep = 0;
  let patter = 0;
  const off = world.onUpdate((dt) => {
    const hp = player.position;
    let near = 99;
    for (const r of runners) {
      if (r.gone) continue;
      const p = r.char.root.position;
      if (r.mode === 'beside') {
        // Jogging on the spot so the watch won't pause.
        const tx = clamp(hp.x + side * 0.95, -4.7, 4.7);
        const tz = hp.z - 0.1;
        const k = 1 - Math.exp(-5 * dt);
        p.x += (tx - p.x) * k;
        p.z += (tz - p.z) * k;
        r.char.root.rotation.y = Math.atan2(hp.x - p.x, hp.z - p.z);
        // Jogging on the spot: the run cycle blended half-and-half with idle shortens the stride
        // to a bounce (the run alone at low speed reads as a lunge).
        const a = r.char.play('run', 0.3);
        if (a) {
          a.timeScale = 0.75;
          a.setEffectiveWeight(0.5);
        }
        const idle = r.char.actions?.idle;
        if (idle && !idle.isRunning()) {
          idle.reset();
          idle.enabled = true;
          idle.setEffectiveWeight(0.5);
          idle.play();
        }
        r.beside += dt;
      } else {
        p.z -= r.v * dt;
        p.x += (r.lane - p.x) * (1 - Math.exp(-2 * dt));
        r.char.root.rotation.y = Math.PI;
        const run = r.char.actions?.run;
        if (run) run.timeScale = r.char.strideRate('run', r.v);
        if (r.mode === 'approach' && p.z <= hp.z + 0.4) {
          r.mode = 'beside';
          r.beside = 0;
        }
        if (!r.fading && p.z < FADE_Z) {
          r.fading = true;
          r.char.fade(0, 0.7).then(() => {
            r.gone = true;
            r.char.root.visible = false;
          });
        }
      }
      near = Math.min(near, Math.hypot(p.x - hp.x, p.z - hp.z));
    }
    // Bastien's feet: jogging on the spot beside Hugo, then running off up the street.
    bStep -= dt;
    if (!B.gone && (B.mode === 'beside' || B.mode === 'leave') && bStep <= 0) {
      bStep = B.mode === 'beside' ? 0.34 + Math.random() * 0.04 : 0.29 + Math.random() * 0.03;
      audio.sfx('run_step', { volume: 0.16, bus: 'bus', jitter: 0.06, pos: B.char.root, ref: 2, fallback: (a) => a.footstep('concrete', { volume: 0.16, rate: 1.1 }) });
    }
    if (packSnd) {
      const k = speaking(ctx) ? 0.5 : 1;
      if (k !== packDuck) {
        packDuck = k;
        packSnd.gain.gain.setTargetAtTime(PACK_VOL * k, audio.t, 0.12);
      }
    } else {
      // No recording: footfalls patter while the pack is close.
      patter -= dt;
      if (near < 11 && patter <= 0) {
        patter = 0.13 + Math.random() * 0.08;
        audio.footstep('concrete', { volume: 0.16 * (1 - near / 11), rate: 1.05 + Math.random() * 0.15 });
      }
    }
  });

  // Bastien reaches Hugo (forced after 12 s, or on skip).
  let t = 0;
  let r = await d.until(() => {
    t += engine.rawDt;
    return (B.mode === 'beside' && B.beside > 0.5 && d.state === 'play' && !ui.modal) || t > 12;
  });
  if (r === 'skipped' || B.mode !== 'beside') {
    B.mode = 'beside';
    B.char.root.position.set(clamp(player.position.x + side * 0.95, -4.7, 4.7), 0, player.position.z - 0.1);
  }
  const bp = B.char.root.position;
  player.face(bp.x, bp.z);
  const m = new THREE.Vector3().addVectors(player.position, bp).multiplyScalar(0.5);
  await d.cinematic(
    async () => {
      await d.gate(cam.tween({ pos: [m.x - side * 0.5, 1.8, m.z + 3.4], look: [m.x, 1.45, m.z - 0.2], fov: 48 }, 0.9));
      await d.say(L.ch2.club);
    },
    { letterbox: false },
  );
  // He runs off.
  B.mode = 'leave';
  B.lane = clamp(player.position.x + side * 1.2, -4.6, 4.6);
  B.v = 3.7;
  const a = B.char.play('run', 0.25);
  if (a) {
    a.timeScale = B.char.strideRate('run', B.v);
    a.setEffectiveWeight(1);
  }
  if (B.char.actions?.idle?.isRunning()) B.char.actions.idle.fadeOut(0.3);
  player.root.rotation.y = Math.PI;
  follow();

  // Only after he has gone: the after-lines.
  t = 0;
  r = await d.until(() => {
    t += engine.rawDt;
    return (B.gone || t > 14) && d.state === 'play' && !ui.modal;
  });
  if (r === 'skipped') {
    for (const x of runners) {
      x.gone = true;
      x.char.root.visible = false;
    }
  }
  off();
  packSnd?.stop(0.5);
  for (const x of runners) x.char.root.visible = false; // anyone still out there is past the fog
  await d.say(L.ch2.clubAfter);
}

// ------------------------------------------------------------------ HOLD STILL

/**
 * Hold the scaffold. The STILL gauge fills over 7 s while no movement key is held. Any movement
 * input drains 40%, creaks and wobbles the tower, and gets a bark from Odile. At 3.5 s of calm the
 * watch buzzes TIME TO MOVE! (the temptation). After 25 s the gauge fills regardless. The fascia
 * letters appear as the gauge fills ("RÉPARATI" -> "RÉPARATIONS.").
 */
async function holdStill(ctx, d, S) {
  const { ui, input, audio, engine } = ctx;
  const H = L.ch2.hold;
  const nextBark = bag(H.barks.bag);
  const F = S.fascia;
  let still = 0;
  let calm = 0;
  let t = 0;
  let lastBark = -9;
  let lastDrain = -9;
  let buzzed = false;
  let maxK = 0;
  let idleCreak = 5 + Math.random() * 4; // the tower creaks a hair on its own
  let done = false;
  ui.prompt(L.hints.still);
  const res = await d.until(() => {
    const raw = engine.rawDt;
    t += raw;
    const assist = t > ASSIST_AFTER;
    const pressed = MOVE_KEYS.some((k) => input.pressed.has(k));
    const held = MOVE_KEYS.some((k) => input.down.has(k));
    if (!assist && (pressed || (held && t - lastDrain > 0.8))) {
      lastDrain = t;
      still = Math.max(0, still - 0.4 * STILL_SECS);
      calm = 0;
      audio.sfx('scaffold_creak', { volume: 0.4, lowpass: 3000, gainJitter: 1.5 });
      S.wobble?.(0.03);
      if (t - lastBark > 1.6) {
        lastBark = t;
        // Odile answers the creak (her voiced bark comes just after it, not on top of it).
        const bark = nextBark();
        d.after(0.3, () => !done && ui.thought(bark, 2.4, { who: H.barks.who }));
      }
    } else if (!held || assist) {
      still += raw;
      calm += raw;
    }
    idleCreak -= raw;
    if (idleCreak <= 0) {
      idleCreak = 7 + Math.random() * 5;
      if (!speaking(ctx)) audio.sfx('scaffold_creak', { volume: 0.12, rate: 0.9, lowpass: 2200 });
    }
    if (!buzzed && calm >= 3.5) {
      buzzed = true;
      ui.watchBuzz(H.buzz);
      d.after(2.6, () => d.thought(H.buzzReply, 1.8));
    }
    const k = Math.min(1, still / STILL_SECS);
    maxK = Math.max(maxK, k);
    if (F && F.draw(F.startN + (F.fullN - F.startN) * Math.min(1, maxK * 1.05))) audio.sfx('brush_stroke', { volume: 0.3, jitter: 0.05, fallback: (a) => a.scrape({ volume: 0.07 }) });
    ui.gauge(H.gauge, { value: k, band: [0.92, 1], color: '#d9a441' });
    return k >= 1;
  });
  done = true;
  ui.gauge(null);
  ui.prompt(null);
  F?.draw(F.fullN);
  return res;
}
