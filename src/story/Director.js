import * as THREE from 'three';
import { ground } from '../world/build.js';
import { releaseChapterListeners } from './i18n.js';
import { beginChapter } from './memory.js';
import { pocket, caseFile, beginChapterItems } from './items.js';
import { saveChapter, clearSave } from './save.js';
import { endingLines } from './ending.js';
import { playGame } from './games/index.js';
import { PRESETS } from '../render/Mood.js';
import { STREET_MOODS } from '../world/scenes/scene2.js';

/** True for a light CSS hex colour ('#fff', '#f4efe6', ...). */
function isLightColor(css) {
  const c = new THREE.Color();
  try {
    c.setStyle(css || '#000');
  } catch {
    return false;
  }
  return c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 0.5;
}

/**
 * Linear chapter runner. Every blocking beat goes through gate(), so the debug skip()
 * can always resolve whatever the story is waiting on (wait / card / dialogue / hotspot / loop).
 *
 * state: 'boot' | 'transition' | 'play' | 'dialogue' | 'cutscene' | 'end'
 * Hotspots only react to E in 'play'.
 */
export class Director {
  constructor(ctx, chapters, { skipCards = false } = {}) {
    this.ctx = ctx;
    this.chapters = chapters;
    this.index = -1;
    this.skipCards = skipCards;
    this.flags = new Set();
    this.skipRequested = false;
    this._state = 'boot';
    this._gates = [];
    this._chapterTimers = [];
    this.ready = new Promise((resolve) => (this._resolveReady = resolve));
  }

  get state() {
    return this._state;
  }

  set state(s) {
    this._state = s;
    if (s === 'play' && this.index >= 0 && this._resolveReady) {
      this._resolveReady({ chapter: this.index });
      this._resolveReady = null;
    }
  }

  get chapter() {
    return this.chapters[this.index];
  }

  // ------------------------------------------------------------- gates

  /**
   * Wrap a promise so skip() can resolve it. onSkip() may clean up (close UI) and return true
   * to say "I handled it, wait for the promise to settle naturally" (a second skip forces it).
   * Resolves with the promise's value, or 'skipped'.
   */
  gate(promise, onSkip) {
    let entry;
    const p = new Promise((resolve) => {
      entry = { resolve, onSkip, skips: 0 };
      this._gates.push(entry);
      Promise.resolve(promise).then(resolve, (err) => {
        console.error('[director] gated promise rejected', err);
        resolve('error');
      });
    });
    return p.finally(() => {
      const i = this._gates.indexOf(entry);
      if (i >= 0) this._gates.splice(i, 1);
    });
  }

  /** Debug: resolve the innermost thing the story is waiting on. Returns true if something was skipped. */
  skip() {
    const g = this._gates[this._gates.length - 1];
    if (!g) {
      this.skipRequested = true;
      return false;
    }
    g.skips++;
    let handled = false;
    try {
      handled = g.skips === 1 && g.onSkip ? g.onSkip() === true : (g.onSkip?.(), false);
    } catch (err) {
      console.error('[director] onSkip failed', err);
    }
    if (!handled) g.resolve('skipped');
    return true;
  }

  /** True once if skip() was called while nothing was gated (for custom loops). */
  consumeSkip() {
    const s = this.skipRequested;
    this.skipRequested = false;
    return s;
  }

  // ------------------------------------------------------------- beats

  /** Wait `s` real seconds (pauses with the game). opts: { scaled=false } */
  wait(s, opts) {
    return this.gate(this.ctx.engine.wait(s, opts));
  }

  /** Next frame's scaled dt (not gated). */
  frame() {
    return this.ctx.engine.frame();
  }

  /**
   * Run fn(dt) every frame until it returns truthy. Gated: skip() ends the loop early.
   * Resolves with fn's truthy value, or 'skipped'.
   */
  until(fn) {
    let stop = false;
    const loop = (async () => {
      for (;;) {
        const dt = await this.ctx.engine.frame();
        if (stop) return 'skipped';
        const r = fn(dt);
        if (r) return r;
      }
    })();
    return this.gate(loop, () => {
      stop = true;
      return false;
    });
  }

  /**
   * Let the bark or thought on screen be said and go before the next line (a game's tier line, a
   * board thought): at least `min` s, at most `max` s. Gated. (R4: punchlines were stepped on.)
   */
  thoughtDone(min = 0.6, max = 5) {
    const { ui } = this.ctx;
    let w = 0;
    return this.until((dt) => (w += dt) >= max || (w >= min && !ui.thoughtSpeaking?.() && !ui.thoughtEl?.classList.contains('show')));
  }

  /** Resolve when pred() is true (checked each frame). Gated. */
  waitUntil(pred) {
    return this.until(() => (pred() ? true : false));
  }

  /** Text card (see ui.card). Auto-closes immediately with ?skipcards=1. */
  card(lines, opts) {
    return this.gate(this.ctx.ui.card(lines, opts), () => {
      this.ctx.ui.skipCard();
      return false;
    });
  }

  /** Blocking dialogue. Freezes the player while open. */
  async say(lines) {
    const { player, ui } = this.ctx;
    const prevState = this.state;
    const wasFrozen = player.frozen;
    this.state = 'dialogue';
    player.frozen = true;
    try {
      const p = ui.dialogue(lines);
      return await this.gate(p, () => {
        p.cancel?.();
        return false;
      });
    } finally {
      player.frozen = wasFrozen;
      this.state = prevState === 'cutscene' ? 'cutscene' : 'play';
    }
  }

  /** Blocking inner-monologue line(s): think('Line.') or think(['A', 'B']). */
  think(text) {
    const arr = Array.isArray(text) ? text : [text];
    return this.say(arr.map((t) => ({ who: this.ctx.L?.names?.hugo || 'Hugo', text: t, inner: true })));
  }

  /** Non-blocking line in the lower third (= ui.thought). opts: { who } turns it into a spoken bark. */
  thought(text, secs, opts) {
    this.ctx.ui.thought(text, secs, opts);
  }

  /** The menu itself (no replies): resolves with the picked index (or the correct one on skip). */
  async _menu(menu) {
    // Like say(): Hugo can't walk off (or jog into a stumble) while a menu is open.
    const { player } = this.ctx;
    const wasFrozen = player.frozen;
    player.frozen = true;
    try {
      return await this.gate(this.ctx.ui.choices(menu), () => {
        this.ctx.ui.skipChoices();
        return true;
      });
    } finally {
      player.frozen = wasFrozen;
    }
  }

  /**
   * Blocking choice menu. Resolves with the picked index (or the correct one on skip). Never loops.
   * A menu with a `who` (SCRIPT-R4 `d.choose (who: 'Jo')`) also plays the picked option's `reply` as dialogue,
   * said by `option.who ?? menu.who` (a string, a string[] or line objects; null = no reply), before it
   * resolves. A menu without `who` (STRIDE) plays nothing: the chapter handles its replies (d.think).
   */
  async choose(menu) {
    const r = await this._menu(menu);
    const o = menu.who && typeof r === 'number' ? menu.options?.[r] : null;
    if (o?.reply != null) {
      const who = o.who ?? menu.who;
      const lines = (Array.isArray(o.reply) ? o.reply : [o.reply]).map((x) => (typeof x === 'string' ? { who, text: x } : x));
      if (lines.length) await this.say(lines);
    }
    return r;
  }

  /**
   * Correction menu: loops until the correct option is picked. Wrong options play their reply.
   * menu: { who='Odile', prompt, options:[{ text, correct, reply, who? }] }. Resolves { tries }.
   */
  async correct(menu) {
    const who = menu.who || this.ctx.L?.names?.odile || 'Odile';
    let tries = 0;
    for (;;) {
      tries++;
      const r = await this._menu(menu);
      const i = typeof r === 'number' ? r : -1;
      const o = menu.options[i] ?? menu.options.find((x) => x.correct);
      if (o.reply) await this.say([{ who: o.who ?? who, text: o.reply }]);
      if (o.correct) return { tries };
      o._used = true;
    }
  }

  /** Wait for hotspot `id` (player presses E near it). skip() triggers it as if pressed. */
  interact(id) {
    const { hotspots } = this.ctx;
    this.state = 'play';
    return this.gate(hotspots.waitFor(id), () => {
      if (hotspots.get(id)) {
        hotspots.trigger(id);
        return true;
      }
      return false;
    });
  }

  /** Run fn as a cutscene: player frozen, hotspots off, letterbox on. */
  async cinematic(fn, { letterbox = true } = {}) {
    const { player, ui } = this.ctx;
    const wasFrozen = player.frozen;
    this.state = 'cutscene';
    player.frozen = true;
    if (letterbox) ui.letterbox(true);
    try {
      return await fn();
    } finally {
      if (letterbox) ui.letterbox(false);
      player.frozen = wasFrozen;
      this.state = 'play';
    }
  }

  /** Hope helper: move hope to h over ~secs (0 = snap). */
  hope(h, secs = 2) {
    if (secs <= 0) this.ctx.mood.set(h, { snap: true });
    else this.ctx.mood.set(h, { lambda: 4.6 / secs });
  }

  /** Chapter-scoped timer (cancelled when the chapter ends). Returns cancel(). */
  after(sec, fn) {
    const cancel = this.ctx.engine.after(sec, fn);
    this._chapterTimers.push(cancel);
    return cancel;
  }

  // ------------------------------------------------------------- items (story/items.js)

  /** `item+ id`: put an item in the pocket. opts: { toast=true } (« + Mètre ruban »). False if full. */
  give(id, opts) {
    return pocket.add(id, opts);
  }

  /** `item− id`: take it out of the pocket. opts: { toast=true } (« − Papier de verre »). */
  take(id, { toast = true } = {}) {
    return pocket.remove(id, { toast });
  }

  /** True if the pocket holds the item (or any of a list). */
  has(id) {
    return pocket.has(id);
  }

  /** `clue+ id`: a clue in the case tab (written on; opens the case on first use). opts: { toast=true }. */
  clue(id, opts) {
    return caseFile.add(id, opts);
  }

  /** `clueNote id`: the clue's note is replaced by its noteLater. */
  clueNote(id, opts) {
    return caseFile.update(id, opts);
  }

  /** Pin or update a suspect in the case tab: opts { status: 'checked'|'toCheck'|'none', as, later }. */
  suspect(id, opts) {
    return caseFile.suspect(id, opts);
  }

  /** `caseFile.open()`: the notebook gets its back pages (the L’AFFAIRE tab). */
  openCase() {
    return caseFile.open();
  }

  // ------------------------------------------------------------- minigames (story/games/)

  /** Run a Revision 4 minigame (= playGame(id, ctx, d, opts)); the held item is put away first. */
  game(id, opts) {
    return playGame(id, this.ctx, this, opts);
  }

  // ------------------------------------------------------------- scenes and looks (Revision 4)

  /**
   * Swap the scene mid-chapter (Ch5 and Ch6 move between the workshop, the street by day and at night and
   * the flat). set: { build(ctx), look, preset, overrides, player, camera, hope, name } (story/sets.js:
   * SETS.workshop(), SETS.street('night'), SETS.flat()). Fades to black (gated), clears the old scene's
   * hotspots, walks, world hooks, live canvas text and colour focus, builds the new one through the look
   * pipeline (main.js ctx.loadSet: materials, props, HDRIs, light cones, shadow box, boot weather), moves Hugo
   * to set.player.spawn (the chapter's `player` options under set.player), points the camera, applies the
   * set's mood preset (hope kept unless set.hope) and step surface, shows an optional `card` on black, and fades back in
   * (fadeIn: false leaves the screen black for the caller). Timers (d.after) and the HUD survive.
   * Resolves with the new world (= ctx.world.current).
   */
  async scene(set, { card = null, cardOpts = { big: true }, out = 0.6, inn = 0.9, fadeIn = true } = {}) {
    const ctx = this.ctx;
    const { ui, hotspots, runner, world, player, cam, mood } = ctx;
    const prev = this.state;
    this.state = 'transition';
    try {
      await this.gate(ui.fade(1, out));
      hotspots.clear();
      runner.clear();
      ui.prompt(null);
      world.unload();
      releaseChapterListeners(); // the old scene's live canvas text
      mood.clearFocus();
      const ch = this.chapter || {};
      const build = async (c) => {
        try {
          const r = await set.build(c);
          if (r?.group) return r;
          console.warn('[director] scene build returned no group', set.name);
          return { group: new THREE.Group(), ...(r || {}) };
        } catch (err) {
          console.error('[director] scene build failed', set.name, err);
          const group = new THREE.Group();
          group.add(ground({ size: 60 }));
          return { group, bounds: [{ minX: -25, maxX: 25, minZ: -25, maxZ: 25 }], spots: {}, shots: {} };
        }
      };
      const built = ctx.loadSet ? await ctx.loadSet(set.look ?? null, build, { bounds: set.player?.bounds }) : await build(ctx);
      world.load(built);
      const pc = { ...(ch.player || {}), ...(set.player || {}) };
      player.configure({ ...pc, bounds: pc.bounds ?? built.bounds ?? [] });
      const camOpts = set.camera || ch.camera || {};
      cam.follow(player.root, { offset: camOpts.offset ?? [0, 2.6, 4.2], look: camOpts.look ?? [0, 1.1, 0], lerp: camOpts.lerp ?? 6 });
      cam.setRoll(0);
      cam.fov(camOpts.fov ?? 55);
      cam.snap();
      if (set.surface !== undefined && ctx.audio) ctx.audio.surface = set.surface; // the step sounds
      if (set.preset) mood.applyPreset(set.preset, set.overrides || {});
      if (typeof set.hope === 'number') mood.set(set.hope, { snap: true });
      await ctx.engine.precompile?.();
      if (card) await this.card(card, cardOpts);
      if (fadeIn) await this.gate(ui.fade(0, this.skipCards ? 0.3 : inn));
      return world.current;
    } finally {
      this.state = prev === 'cutscene' ? 'cutscene' : 'play';
    }
  }

  /**
   * Change the mood preset without a rebuild (an evening caption in the workshop, the night falling on the
   * street). p: a Mood preset name ('street', 'wall', ...), a street variant ('day' | 'night': scene2.js
   * STREET_MOODS), or { preset, overrides } / a preset object. Blends over `secs` (0 = cut). Hope is kept.
   */
  preset(p, secs = 2) {
    const { mood } = this.ctx;
    const m = typeof p === 'string' && STREET_MOODS[p] ? STREET_MOODS[p] : p;
    if (m && typeof m === 'object' && 'preset' in m) mood.applyPreset(m.preset, { ...(m.overrides || {}), blend: secs });
    else if (typeof m === 'string' && !PRESETS[m]) console.warn('[director] unknown preset', p);
    else mood.applyPreset(m, { blend: secs });
  }

  // ------------------------------------------------------------- flow

  _resetBetweenChapters() {
    const { engine, input, audio, mood, cam, ui, hotspots, runner, world, player } = this.ctx;
    for (const c of this._chapterTimers) c();
    this._chapterTimers = [];
    hotspots.clear();
    runner.clear();
    world.unload();
    ui.clearTransient();
    player.clearListeners();
    releaseChapterListeners(); // the old scene's live canvas text
    engine.timeScale = 1;
    input.enabled = true;
    audio.restore();
    this.ctx.voice?.stopAll(); // no line outlives its chapter
    mood.pass.uniforms.uFlash.value = 0;
    mood.clearFocus();
    mood.painOverride = null;
    mood.followTarget = null;
    cam.setRoll(0);
    cam.fov(55);
  }

  async _build(ch) {
    this.ctx.waypoint = null; // a chapter's place pointer (ObjectivePointer) never outlives it
    try {
      const r = await ch.build(this.ctx);
      if (r && r.group) return r;
      console.warn('[director] build() returned no group for', ch.id);
      return { group: new THREE.Group(), ...(r || {}) };
    } catch (err) {
      console.error('[director] build failed for', ch.id, err);
      const group = new THREE.Group();
      group.add(ground({ size: 60 }));
      return { group, bounds: [{ minX: -25, maxX: 25, minZ: -25, maxZ: 25 }], spots: {} };
    }
  }

  /**
   * Seed the watch and the notebook for chapter i from L.watch.atChapter[i] / L.notebook.atChapter[i]
   * (null hides them). The notebook persists within a run: if it already holds at least as many
   * entries as the seed (the player played through), it is kept and just docked.
   */
  _seedHud(i) {
    const { ui, L } = this.ctx;
    const w = L?.watch?.atChapter?.[i];
    if (w) ui.watch(w.face, { label: w.label ?? null, lap: w.lap ?? null, tick: false, over: false });
    else ui.watch(null);
    const nb = L?.notebook?.atChapter?.[i];
    if (nb) {
      if (ui.notebook.entries.length >= nb.length) {
        ui.notebook.set(ui.notebook.entries);
      } else ui.notebook.set(nb);
    } else ui.notebook.hide();
  }

  /** Play chapters from index i to the end, then the end card. */
  async start(i = 0) {
    const ctx = this.ctx;
    const { ui, player, cam, mood, audio, world } = ctx;
    for (this.index = Math.max(0, Math.min(i, this.chapters.length - 1)); this.index < this.chapters.length; this.index++) {
      const ch = this.chapters[this.index];
      this.state = 'transition';
      this.skipRequested = false;
      await ui.fade(1, 0.8);
      this._resetBetweenChapters();
      beginChapter(this.index); // replaying a chapter clears its own flags and later ones
      ctx.hotspots?.bindDirector?.(this); // item lines (wrong item, gifts, needs) go through say()
      beginChapterItems(this.index, ch.id); // the pocket for this chapter (its seed, or its first start's)
      saveChapter(this.index); // a reload resumes here (Continue on the title screen)
      // The title's pale ink needs a dark screen: over a white cut (Ch2 -> Ch3) show it after the fade-in.
      const showTitle = ch.title && !this.skipCards ? () => ui.chapterTitle(this.index + 1, ch.title) : null;
      const lightFade = isLightColor(ui.fadeColor);
      if (showTitle && !lightFade) showTitle();

      const built = await this._build(ch);
      world.load(built);
      const pc = ch.player || {};
      player.configure({ ...pc, bounds: pc.bounds ?? built.bounds ?? [] });
      const camOpts = ch.camera || {};
      cam.follow(player.root, { offset: camOpts.offset ?? [0, 2.6, 4.2], look: camOpts.look ?? [0, 1.1, 0], lerp: camOpts.lerp ?? 6 });
      cam.fov(camOpts.fov ?? 55);
      cam.snap();
      mood.applyPreset(ch.preset || 'void');
      mood.set(ch.hope ?? 0.1, { snap: true });
      if (ch.music !== undefined) {
        if (ch.music) audio.music(ch.music.name ?? ch.music, { volume: ch.music.volume, fade: ch.music.fade ?? 3 });
        else audio.music(null, { fade: 2 });
      }
      for (const name of ['rain', 'crowd']) {
        const on = (ch.ambience || []).includes(name);
        audio.ambience(name, on, { fade: 2.5 });
      }
      ui.objective(ch.objective);
      this._seedHud(this.index);
      await ctx.engine.precompile?.(); // shaders for the whole chapter, while the screen is covered
      await ui.fade(0, this.skipCards ? 0.3 : 1.2);
      if (showTitle && lightFade) showTitle();
      this.state = 'play';
      ctx.voice?.chapter(this.index); // French clips: release the last chapter's, prefetch this one's

      try {
        await ch.run(ctx, this);
      } catch (err) {
        console.error('[director] chapter failed, continuing', ch.id, err);
      }
    }
    this.state = 'transition';
    await ui.fade(1, 1.2);
    this._resetBetweenChapters();
    // The end card draws no 3D scene worth keeping: free every material set and prop on the GPU.
    ctx.materials?.retain([]);
    ctx.voice?.chapter(-1);
    audio.releaseChapter?.(['piano']); // the last chapter's sfx buffers and loops: the end card only has the piano
    ctx.assets?.releaseProps([]);
    audio.music('piano', { volume: 0.4, fade: 3 });
    this.state = 'end';
    clearSave(); // finished: the next visit starts from the beginning
    await ui.endCard({ ...ui.L.ending, lines: endingLines() });
  }

  /** Debug: reload at chapter i with debug flags. */
  goto(i) {
    const q = new URLSearchParams({ debug: '1', autostart: '1', skipcards: '1', chapter: String(i) });
    location.href = `${location.pathname}?${q}`;
  }
}
