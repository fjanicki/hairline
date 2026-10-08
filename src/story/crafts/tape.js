import { L } from '../script.js';
import { craftPointer } from './pointer.js';

// Ch4 Day 8: Measure twice, with the tape (docs/DESIGN.md R3.2). Hold Space or the mouse button to
// run the blade out; it slows into the jamb (81.5 cm), touches with a tock, then bows as the case is
// pressed in (0.8 cm/s, creak at 83). Release reads snap(x, 0.5) in [80.5, 82.5]; under 79.5 it zips
// back and doesn't count. Two equal readings in a row agree. After 3 disagreements Odile holds the
// end (the next reading soft-stops at 81.5 and counts on its own). Idle 6 s: it pulls itself and
// lets go on the tock. A skip gives [81.5, 81.5].

const JAMB = 81.5;
const STOP = 83;
const SHORT = 79.5;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Reading (cm) -> index into the 5 reading / cut lines. */
export const readingIndex = (cm) => clamp(Math.round((cm - 80.5) / 0.5), 0, 4);

/** measureTape(ctx, d, {tape, text}) -> Promise<{readings, agreed, assisted, skipped}> */
export async function measureTape(ctx, d, { tape, text = L.ch4.day8.tape } = {}) {
  const { ui, input, audio } = ctx;
  const P = craftPointer(ctx);
  // Sound (docs/assets/sfx.md Ch4): the blade's whirr is a loop whose gain and rate follow the blade
  // speed (60 -> 4 cm/s: rate 1.2 -> 0.7); the tock on the jamb alternates tape_tock / table_tock; the
  // bow creaks (scaffold_creak at rate 1.6); the zip back is tape_retract.
  let whirr = null;
  const blade = (v) => {
    if (!whirr && v > 0 && audio?.loopSfx) whirr = audio.loopSfx('tape_pull', { volume: 0, bus: 'fx', fade: 0.03 });
    const k = clamp((v - 4) / 56, 0, 1);
    whirr?.set(v > 0 ? 0.3 * (0.35 + 0.65 * k) : 0, 0.7 + 0.5 * k, 0.05);
  };
  let tocks = 0;
  const tock = () =>
    tocks++ % 2 === 0
      ? audio.sfx('tape_tock', { volume: 0.4, jitter: 0.05 })
      : audio.sfx('table_tock', { volume: 0.3, rate: 1.3, jitter: 0.05, fallback: (a) => a.tick({ volume: 0.22 }) });
  const retract = (volume = 0.45) => audio.sfx('tape_retract', { volume, fallback: (a) => a.noise({ type: 'highpass', freq: 2400, dur: 0.25, volume: 0.07 }) });
  let readings = [];
  let agreed = null;
  let disagree = 0;
  let held = false; // Odile holds the end
  let skipped = false;
  let x = 0;
  let lastShort = -1e9;
  tape.visible = true;
  tape.setLength(0);
  tape.setBow(0);
  tape.loupe.set(0);
  tape.loupe.show(true);

  /** One pull. Resolves a reading (cm), null (too short) or 'skipped'. */
  const pull = async () => {
    let touched = false;
    let creaked = false;
    let holding = false;
    let auto = false;
    let idle = 0;
    let zip = x > 0 ? 0.25 : 0; // the blade runs back into the case first
    const zipFrom = x;
    if (zip > 0) retract(0.3);
    let armed = false;
    let bow = 0;
    P.update(); // drop clicks made on the dialogue
    ui.prompt(text.hint);
    const r = await d.until((dt) => {
      P.update();
      if (zip > 0) {
        zip = Math.max(0, zip - dt);
        x = zipFrom * (zip / 0.25);
        tape.setLength(x);
        tape.setBow(0);
        tape.loupe.set(x);
        return false;
      }
      const down = input.down.has('Space') || P.down;
      if (!armed) {
        armed = !down; // a hold must start inside this pull
        return false;
      }
      if (!holding && !auto) {
        if (down) holding = true;
        else if ((idle += dt) >= 6) auto = true;
        if (!holding && !auto) return false;
      }
      const pulling = auto ? !touched : down;
      if (pulling) {
        if (!touched) {
          const v = x < 70 ? 60 : 60 + ((4 - 60) * (x - 70)) / (JAMB - 70);
          x += v * dt;
          blade(v);
          if (x >= JAMB) {
            x = JAMB;
            touched = true;
            blade(0);
            tock(); // the case meets the jamb
          }
        } else if (!held && x < STOP) {
          x = Math.min(STOP, x + 0.8 * dt);
          blade(0);
          if (x >= STOP && !creaked) {
            creaked = true;
            audio.sfx('scaffold_creak', { volume: 0.12, rate: 1.6, fallback: (a) => a.noise({ type: 'bandpass', freq: 240, q: 6, dur: 0.3, volume: 0.06 }) });
          }
        } else blade(0);
        bow = touched ? clamp((x - JAMB) / (STOP - JAMB), 0, 1) : 0;
        tape.setLength(Math.min(x, JAMB) + (x - Math.min(x, JAMB)) * 0.15); // the blade can't pass the jamb: it bows
        tape.setBow(bow);
        tape.loupe.set(x, { touch: touched, bow });
        tape.userData.x = x; // for tests
        return false;
      }
      // Released.
      blade(0);
      if (x < SHORT) return { short: true };
      if (held) return { cm: JAMB };
      return { cm: clamp(Math.round(x * 2) / 2, 80.5, 82.5) };
    });
    ui.prompt(null);
    tape.setBow(0);
    blade(0);
    if (r === 'skipped') return r;
    if (r.short) {
      retract();
      if (ctx.engine.now - lastShort > 3) {
        lastShort = ctx.engine.now;
        ui.thought(text.short.text, 2.4, { who: text.short.who });
      }
      return null;
    }
    return r.cm;
  };

  try {
    for (let guard = 0; guard < 40 && agreed == null; guard++) {
      const cm = await pull();
      if (cm === 'skipped') {
        skipped = true;
        break;
      }
      if (cm == null) continue;
      readings.push(cm);
      const i = readingIndex(cm);
      const first = readings.length === 1;
      await d.say([(first ? text.readings : text.again)[i]]);
      if (held) {
        agreed = cm;
        break;
      }
      if (first) {
        await d.say(text.twice);
        continue;
      }
      if (cm === readings[readings.length - 2]) {
        agreed = cm;
        break;
      }
      const line = text.differ[disagree % text.differ.length];
      disagree++;
      if (disagree >= 3) {
        held = true;
        await d.say([line, ...text.help]);
      } else await d.say([line]);
    }
  } finally {
    whirr?.stop(0.08);
    ui.prompt(null);
    P.dispose();
    tape.loupe.show(false);
    tape.setBow(0);
    tape.visible = false;
    x = 0;
    tape.setLength(0);
  }
  if (skipped || agreed == null) {
    readings = [JAMB, JAMB];
    agreed = JAMB;
  }
  return { readings, agreed, assisted: held, skipped };
}
