import * as THREE from 'three';
import { L } from './script.js';
import { rhythm } from './minigames.js';
import { remember } from './memory.js';
import { craftPointer } from './crafts/pointer.js';
import { reveal, dry } from './crafts/finish.js';
import { makeDust, scrapeAt, scrubber } from './crafts/juice.js';
import { trueWheel } from './crafts/truing.js';
import { letter } from './crafts/letters.js';

// Ch4's crafts with their juice (docs/DESIGN.md R3.4, R3.5): Day 5 sanding, Week 4 truing by ear,
// Week 7 lettering. ch4.js frames the shot and calls these; each ends on its reveal beat.

const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const clamp = THREE.MathUtils.clamp;
const PAINT = new THREE.Color('#8f8a80');
const WOOD = new THREE.Color('#cdb89a');

/** Day 5: sand the door to bare wood (A/D or a mouse scrub), then hold on it. */
export async function sandDoor(ctx, d, W) {
  const { ui, input, engine, audio } = ctx;
  const SD = L.ch4.sanding;
  const door = W.door;
  let progress = door.sand;
  let blockX = 0;
  let blockTarget = 0;
  let crossAt = -1e9;
  let mashI = 0;
  let buzzed = false;
  let puffs = 0; // dust still to come off this stroke
  let strokeDir = 1;
  let sandAssist = 0; // seconds the assist's sand_loop keeps running after its last stroke
  let sandLoop = null;
  const P = craftPointer(ctx);
  const dust = makeDust(ctx);
  const at = new THREE.Vector3();
  const along = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  door.setBlock(true, 0, 0);
  const r = await rhythm(ctx, d, {
    band: [1.5, 2.5],
    mashAt: 3.4,
    idleAuto: { after: 6, rate: 2 },
    cooldown: 6,
    prompt: `${L.ch3.keys.both} ${SD.hint}`,
    gauge: { label: SD.gauge },
    poll: scrubber(P),
    onStroke: (s, inBand) => {
      // Recorded strokes (docs/assets/sfx.md Ch4): rate and volume follow the stroke rate; mashing is
      // a fixed fast scrub; the idle assist's strokes are the continuous sand_loop (onFrame).
      if (s.auto) sandAssist = 0.8;
      else if (s.mashing) audio.sfx('sand_stroke', { volume: 0.3, rate: 1.25, jitter: 0.05, fallback: (a) => a.scrape({ freq: 1800, volume: 0.26 }) });
      else scrapeAt(audio, s.rate);
      progress = Math.min(1, progress + (inBand ? 0.035 : 0.012));
      strokeDir = s.lastKey === 'KeyA' ? -1 : 1;
      blockTarget = 0.35 * strokeDir;
      door.setSand(progress);
      puffs = 8;
      if (!buzzed && progress >= 0.5) {
        buzzed = true;
        ui.watchBuzz(SD.buzz);
        d.after(2.6, () => d.thought(SD.buzzReply, 2));
      }
    },
    onMash: () => ui.thought(SD.barks.mash[mashI++ % SD.barks.mash.length], 2.4, { who: SD.barks.who }),
    onFrame: (dt) => {
      // The idle assist sands on its own: the loop runs while its strokes keep coming.
      sandAssist = Math.max(0, sandAssist - dt);
      if (sandAssist > 0 && !sandLoop) sandLoop = audio.loopSfx?.('sand_loop', { volume: 0.25, bus: 'fx', fade: 0.25 });
      sandLoop?.set(sandAssist > 0 ? 0.25 : 0, null, 0.2);
      // Across the grain (W/S): she notices.
      const across = ['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown'].some((k) => input.pressed.has(k));
      if (across && engine.now - crossAt > 6) {
        crossAt = engine.now;
        ui.thought(SD.barks.cross, 2.6, { who: SD.barks.who });
      }
      blockX = damp(blockX, blockTarget, 12, dt);
      const centre = 0.5 * Math.sin(progress * 9.0); // the block works its way along the door
      door.setBlock(true, (centre + blockX) / 0.9, clamp(progress * 1.12, 0, 1));
      // Dust off the block as it travels, thrown along the stroke: grey paint first, pale wood by the end.
      if (puffs > 0 && dt > 0) {
        const n = Math.min(puffs, Math.max(1, Math.round(dt * 40)));
        puffs -= n;
        door.block.getWorldPosition(at);
        at.y += 0.03; // off the top of the block, clear of the face
        along.set(strokeDir, 0.6, 0).applyQuaternion(door.group.getWorldQuaternion(q));
        dust.emit(at, { n, color: col.copy(PAINT).lerp(WOOD, progress), dir: along, speed: 0.6, spread: 0.5 });
      }
    },
    done: () => progress >= 1,
  });
  sandLoop?.stop(0.3);
  P.dispose();
  if (r.skipped) progress = 1;
  door.setSand(1);
  door.setBlock(false);
  await reveal(ctx, d, { hold: 1.2 });
  dust.dispose();
}

/** Week 4: true Sami's rear wheel by ear (one slack spoke), then hold on it spinning free. */
export async function trueBike(ctx, d, W) {
  const res = await trueWheel(ctx, d, { rig: W.bike, faults: [[4, 0.6]] });
  remember('wheel', { secs: res.secs, plucks: res.plucks, assisted: !res.skipped && res.assisted, overTight: !res.skipped && res.overTight });
  await reveal(ctx, d, { hold: 1.5 });
  return res;
}

/** Week 7: letter OPEN on the board; the paint goes on wet and dries; hold on the finished sign. */
export async function letterSign(ctx, d, W) {
  const score = await letter(ctx, d, W.board);
  W.board.update();
  dry(ctx, W.board.face.material, { secs: 15 });
  await reveal(ctx, d, { hold: 1.2 });
  return score;
}
