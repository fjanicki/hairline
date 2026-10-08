import { L } from '../script.js';
import { onLangChange } from '../i18n.js';
import { label } from '../../core/KeyLabels.js';
import { mixChip } from '../../ui/swatch.js';
import { craftPointer } from './pointer.js';
import { stirSlice } from './sound.js';
import { TINS, CANON, RECIPE, mixHex, classify } from './mix.js';

// Ch4 Day 8: the grey, a colour-mixing toy (docs/DESIGN.md R3.3). Drops from five tins into one pot
// (1-5, a click on a tin or on the chip), T / the chip tips it out, E / the chip shows Odile. Her
// verdict comes from crafts/mix.js; anything but the target keeps the pot as it is. Assist on
// rejected Dones r (2: a hint, 3: the recipe, 4: she does it) or on idle (12 / 24 / 40 s). A skip
// gives the canonical grey.

const CAP = 18;
const POURS = [
  [0, 5],
  [1, 1],
  [2, 2],
  [3, 1],
]; // Odile's four moves

/** mixGrey(ctx, d, {mixer, text, look}) -> Promise<{hex, tries, assisted, skipped}> */
export async function mixGrey(ctx, d, { mixer, text = L.ch4.day8.mixer, look = L.ch4.day8.greyLook } = {}) {
  const { ui, input, audio, mood } = ctx;
  const counts = [0, 0, 0, 0, 0];
  const total = () => counts.reduce((a, b) => a + b, 0);
  let r = 0; // rejected Dones
  let level = 0; // assist shown: 1 white-first hint, 2 the recipe, 3 she does it
  let idle = 0;
  let looked = false;
  let assisted = false;
  let skipped = false;
  let hex = null;
  let fullAt = -1e9;
  let judged = null; // the pot Odile last looked at: Done on the same pot again is just a shake
  let saidAt = 0; // when her last lines closed: an E mashed through them isn't a Done
  let last = null; // her last verdict

  mood.focusOn(mixer.focus, { slot: 0, strength: 1, floor: 1, decay: 0, radius: 0.12, offsetY: 0 });
  mixer.setLevel(0, { snap: true });
  // Sound (docs/assets/sfx.md Ch4): the lids come off before she speaks; each drop lands as a recorded
  // plop plus a slice of stirring (on the drop's landing frame, mixer.onLand); tipping out sloshes; the
  // lid is tapped back on after her yes. The plip tone is the fallback.
  const plip = () => audio.tone({ freq: 900, to: 400, dur: 0.08, volume: 0.08 });
  mixer.onLand = () => {
    audio.sfx('paint_drop', { volume: 0.4, jitter: 0.05, fallback: plip });
    stirSlice(audio, { volume: 0.3, delay: 0.06 });
  };
  audio.sfx('paint_lid_open', { volume: 0.5, fallback: false });
  audio.sfx('paint_lid_open', { volume: 0.4, delay: 0.55, fallback: false });
  await d.wait(1.1);
  await d.say(text.intro);

  const P = craftPointer(ctx);
  const queue = [];
  const tinList = () => text.tins.map((name, i) => ({ name, color: TINS[i].color }));
  const labels = () => ({ tip: text.tip, done: text.done, hint: text.hint, tipKey: label('KeyT'), doneKey: label('KeyE') });
  const chip = mixChip(ui, {
    tins: tinList(),
    labels: labels(),
    onTin: (i) => queue.push(['tin', i]),
    onTip: () => queue.push(['tip']),
    onDone: () => queue.push(['done']),
  });
  const offLang = onLangChange(() => chip.relabel(labels(), tinList()), { chapter: true });

  const show = (snap = false) => {
    hex = mixHex(counts);
    mixer.setSwatch(hex, { snap });
    mixer.setLevel(total(), { snap });
    chip.set(hex, counts);
  };
  const drop = (i) => {
    if (total() >= CAP) {
      chip.shake();
      if (ctx.engine.now - fullAt > 3) {
        fullAt = ctx.engine.now;
        ui.thought(text.full.text, 2.4, { who: text.full.who });
      }
      return;
    }
    counts[i]++;
    mixer.pour(i);
    audio.sfx('tin_tap', { volume: 0.12, jitter: 0.05, fallback: false }); // the tin tilts against its neighbour
    show();
  };
  const tipOut = () => {
    if (!total()) return;
    counts.fill(0);
    mixer.tipOut();
    audio.sfx('paint_slosh', { volume: 0.45, fallback: (a) => a.noise({ type: 'lowpass', freq: 500, dur: 0.4, volume: 0.1 }) });
    hex = null;
    chip.set(null, counts);
  };
  const pickTin = () => {
    const hit = P.pick(mixer.pickables);
    return hit ? hit.object.userData.tin : undefined;
  };
  /** Odile tips it out and does it in four moves. */
  const give = async () => {
    await d.say(text.give);
    assisted = true;
    tipOut();
    await d.wait(0.7);
    for (const [i, n] of POURS) {
      counts[i] += n;
      mixer.pour(i, n);
      show();
      await d.wait(0.75);
    }
    hex = CANON;
    mixer.setSwatch(CANON);
    chip.set(CANON, counts);
    await d.wait(0.4);
  };

  try {
    for (let guard = 0; guard < 60; guard++) {
      ui.prompt(text.hint);
      P.update();
      queue.length = 0;
      let t = 0;
      const act = await d.until((dt) => {
        P.update();
        t += dt;
        idle += dt;
        // Every keydown counts, even several merged into one frame by a hitch.
        for (let k = 0; k < 5; k++) for (let n = input.pressCount(`Digit${k + 1}`) + input.pressCount(`Numpad${k + 1}`); n > 0; n--) queue.push(['tin', k]);
        let a = queue.shift();
        if (!a && input.pressed.has('KeyT')) a = ['tip'];
        if (!a && t > 0.25 && input.pressed.has('KeyE') && (input.lastPress('KeyE') ?? 0) - saidAt >= 400) a = ['done'];
        const hover = pickTin();
        P.cursor(hover !== undefined ? 'pointer' : '');
        if (!a && P.click && hover !== undefined) a = ['tin', hover];
        if (a) {
          idle = 0;
          if (a[0] === 'tin') drop(a[1]);
          else if (a[0] === 'tip') tipOut();
          else if (total() < 2 || counts.join() === judged) chip.shake();
          else return 'done';
        }
        const want = idle >= 40 ? 3 : idle >= 24 ? 2 : idle >= 12 ? 1 : 0;
        return want > level ? 'idle' : false;
      });
      ui.prompt(null);
      P.cursor('');
      if (act === 'skipped') {
        skipped = true;
        break;
      }
      if (act === 'idle') {
        level++;
        if (level >= 3) {
          await give();
          await d.say(text.verdicts.target);
          break;
        }
        const h = level === 1 && (last === 'waiting' || last === 'light') ? text.warm : text.hints[level - 1];
        ui.thought(h.text, 5, { who: h.who });
        continue;
      }
      // Done: Odile looks in the pot.
      const v = classify(counts);
      if (v === 'target') {
        await d.say(text.verdicts.target);
        break;
      }
      r++;
      judged = counts.join();
      const lines = [...text.verdicts[v]];
      if (v === 'light' && !looked && counts[1] >= 1) {
        looked = true; // the look is for a grey, not a pot of white
        lines.push(look);
      }
      const want = r >= 4 ? 3 : r >= 3 ? 2 : r >= 2 ? 1 : 0;
      if (want > level && want < 3) {
        level = want;
        // He's already got a grey: the first hint is about warmth, not white-then-black.
        const warmIt = want === 1 && (v === 'waiting' || v === 'light' || last === 'waiting' || last === 'light');
        lines.push(warmIt ? text.warm : text.hints[want - 1]);
      }
      last = v;
      await d.say(lines);
      saidAt = performance.now();
      if (want >= 3) {
        level = 3;
        await give();
        await d.say(text.verdicts.target);
        break;
      }
      idle = 0;
    }
  } finally {
    mixer.onLand = null;
    if (!skipped) {
      // The lid tapped back on.
      audio.sfx('tin_tap', { volume: 0.25, delay: 0.1, fallback: false });
      audio.sfx('tin_tap', { volume: 0.22, delay: 0.32, fallback: false });
    }
    ui.prompt(null);
    offLang();
    P.dispose();
    chip.dispose();
    mood.focusOn(null, { slot: 0 });
  }
  if (skipped) {
    counts.splice(0, 5, ...RECIPE);
    hex = CANON;
    mixer.setSwatch(CANON, { snap: true });
    mixer.setLevel(total(), { snap: true });
    assisted = false;
  }
  return { hex: assisted || skipped ? CANON : hex || CANON, tries: r + 1, assisted, skipped };
}
