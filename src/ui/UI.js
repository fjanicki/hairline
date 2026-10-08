import './style.css';
import { LANGS, getLang, setLang, onLangChange, retext, english, num } from '../story/i18n.js';
import { label } from '../core/KeyLabels.js';

// All DOM is created here. Every blocking element (dialogue, choices, card, driveRing)
// returns a Promise and has a matching skip*/cancel* method used by Director.skip().
// Language changes (i18n.setLang) re-render whatever is on screen at once (_relang), except a
// dialogue line or card already showing. In debug, this.textLog collects every string shown.

const el = (tag, cls, parent, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Parse "*emphasis*" into segments. */
function segments(text) {
  const out = [];
  String(text)
    .split(/(\*[^*]+\*)/g)
    .forEach((part) => {
      if (!part) return;
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) out.push({ t: part.slice(1, -1), em: true });
      else out.push({ t: part, em: false });
    });
  return out;
}

function renderSegments(segs, n = Infinity) {
  let html = '';
  let left = n;
  for (const s of segs) {
    if (left <= 0) break;
    const t = s.t.slice(0, left);
    left -= t.length;
    html += s.em ? `<em>${esc(t)}</em>` : esc(t);
  }
  return html;
}

const plainLength = (segs) => segs.reduce((a, s) => a + s.t.length, 0);

/** "[E] Watch" -> kbd chip + text. */
function promptHtml(text) {
  const m = String(text).match(/^\[([^\]]+)\]\s*(.*)$/);
  if (m) return `<span class="kbd">${esc(m[1])}</span>${esc(m[2])}`;
  return esc(text);
}

/**
 * CSS class for a speaker: the first word of the English `who`, lowercased ('Dr Okafor' -> 'dr',
 * "Dr Okafor's office" -> 'dr'; a translated label maps back through i18n.english).
 */
function speakerClass(who) {
  return String(english(who) || '')
    .toLowerCase()
    .split(/[\s(']/)[0]
    .replace(/[^a-z0-9-]/g, '');
}

/** Restart a one-shot CSS animation class. */
function retick(e, cls) {
  e.classList.remove(cls);
  void e.offsetWidth;
  e.classList.add(cls);
}

const CHARS_PER_SEC = 40;

export class UI {
  constructor(root, { input, L, skipCards = false }) {
    this.root = root;
    this.input = input;
    this.L = L;
    this.skipCards = skipCards;
    this.updateWhilePaused = false;
    this.paused = false; // set by main while the pause overlay is up

    this._dialogue = null; // active dialogue state
    this._dialogueQueue = Promise.resolve();
    this._choices = null;
    this._card = null;
    this._drive = null;
    this._fade = null;
    this._timers = [];
    this._chapterPrompt = null;
    this._spotText = null;
    this.audio = null; // set by main (watch buzz, pencil scratch)
    // French voice-over (core/Voice.js, set by main): dialogue / card lines and thoughts call voice.play().
    // A thought that arrives while a voiced thought is still being said waits in _voiceQueue (max 2).
    this.voice = null;
    this.autoAdvance = false; // debug/tests: advance dialogue lines by themselves (never before the clip ends)
    this._thoughtClip = null;
    this._voiceQueue = [];
    this._watch = { face: null, label: null, lap: null, over: false, shown: false, count: null, buzzUntil: 0 };
    this._nb = { entries: [], shown: false, open: false };
    this._gauge = null;
    this.notebook = {
      set: (entries) => this._nbSet(entries),
      add: (text, opts) => this._nbAdd(text, opts),
      strike: (text, on) => this._nbStrike(text, on),
      annotate: (text, note) => this._nbAnnotate(text, note),
      open: (secs) => this._nbOpen(secs),
      dock: () => this._nbDock(),
      hide: () => this._nbHide(),
    };
    Object.defineProperty(this.notebook, 'entries', { get: () => this._nb.entries.map((e) => ({ ...e })) });
    Object.defineProperty(this.notebook, 'visible', { get: () => this._nb.shown });
    Object.defineProperty(this.notebook, 'isOpen', { get: () => this._nb.open });

    this.textLog = null; // main sets an array in debug mode (__game.debug.textLog)
    this._build();
    onLangChange(() => this._relang());

    document.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this.paused) return;
      if (e.target.closest?.('button')) return;
      if (this._card) this._advanceCard();
      else if (this._dialogue) this._advanceDialogue();
    });
  }

  _build() {
    const r = this.root;
    this.hud = el('div', 'ui-layer hud', r);
    this.letterboxEl = el('div', 'ui-layer letterbox', r);
    this.objectiveEl = el('div', 'objective', this.hud);
    this.hintEl = el('div', 'hint', this.hud);
    this.bannerEl = el('div', 'banner', this.hud);
    this.captionEl = el('div', 'caption', this.hud, '<div class="bar"></div><div class="text"></div>');
    this.promptEl = el('div', 'prompt', this.hud);
    this.painEl = el('div', 'pain', this.hud, '<div class="label"></div><div class="track"><div class="fill"></div></div>');
    this.painEl.querySelector('.label').textContent = this.L.ui.pain;
    this.painFill = this.painEl.querySelector('.fill');
    this.gaugeEl = el(
      'div',
      'gauge',
      this.hud,
      '<div class="glabel"></div><div class="gtrack"><div class="gband"></div><div class="gneedle"></div></div><div class="gtext"></div>',
    );
    this.driveEl = el('div', 'drive', this.hud, '<div class="target"></div><div class="ring"></div><div class="key"></div>');
    this.driveEl.querySelector('.key').textContent = this.L.ui.space;
    this.notebookEl = el(
      'div',
      'notebook',
      this.hud,
      `<div class="nb-spiral"></div><div class="nb-head"></div><ol class="nb-list"></ol>`,
    );
    this.notebookEl.querySelector('.nb-head').textContent = this.L.notebook?.heading || 'WHAT I CAN DO';
    this.nbList = this.notebookEl.querySelector('.nb-list');

    this.fadeEl = el('div', 'ui-layer fade', r);
    // The watch lives outside the HUD layer so `over: true` can lift it above the fade (z 26).
    this.watchEl = el(
      'div',
      'watch',
      r,
      `<div class="strap top"></div><div class="strap bottom"></div>
       <div class="case"><div class="btn-l"></div><div class="btn-r"></div>
         <div class="screen"><div class="wlabel"></div><div class="wface"></div><div class="wlap"></div></div>
       </div>
       <div class="notif"><div class="ntitle"></div><div class="ntext"></div></div>`,
    );
    this.watchEl.querySelector('.ntitle').textContent = this.L.names.stride;
    this.thoughtEl = el('div', 'thought', r);
    this.chapterEl = el('div', 'chapter-title', r, '<div class="num"></div><div class="name"></div>');
    this.dialogueEl = el('div', 'dialogue', r, '<div class="who"></div><div class="text"></div><div class="next"></div>');
    this.dialogueEl.id = 'dialogue';
    this.whoEl = this.dialogueEl.querySelector('.who');
    this.textEl = this.dialogueEl.querySelector('.text');
    this.nextEl = this.dialogueEl.querySelector('.next');
    this.nextEl.textContent = this.L.ui.next;
    this.choicesEl = el('div', 'choices', r);
    this.choicesEl.id = 'choices';
    this.cardEl = el('div', 'ui-layer card', r);
    this.cardEl.id = 'card';
    this.titleEl = el('div', 'ui-layer title', r);
    this.endEl = el('div', 'ui-layer end', r);
    this.endEl.id = 'end';
    this.loadingEl = el('div', 'ui-layer loading', r, '<div class="mark"></div><div class="bar"><div></div></div>');
    this.loadingEl.querySelector('.mark').textContent = this.L.title?.name || '';
    this.fadeValue = 1;
    this.fadeColor = '#000';
  }

  /** True while a dialogue, choice menu or card is open. */
  get modal() {
    return !!(this._dialogue || this._choices || this._card);
  }

  // ------------------------------------------------------------- loading / title

  loading(p) {
    this.loadingEl.querySelector('.bar div').style.width = `${Math.round(p * 100)}%`;
  }

  hideLoading() {
    this.loadingEl.classList.add('done');
    setTimeout(() => this.loadingEl.classList.add('hidden'), 900);
  }

  /**
   * Title screen with the language switch and an Options button. Resolves on click / E / Enter
   * (not on its buttons, nor while Options is open). onBegin runs inside the gesture (audio resume).
   * quality: as for showPause (the Options panel's graphics row).
   * resume: { num, name() } when there is saved progress: the begin line becomes Continue (click / E /
   * Enter) and a New game button joins the foot. Resolves 'continue', 'new' or 'begin'.
   */
  title({ onBegin, quality, resume = null } = {}) {
    this._title = { quality, resume };
    this._renderTitle();
    this.titleEl.classList.remove('hidden');
    requestAnimationFrame(() => this.titleEl.classList.add('show'));
    return new Promise((resolve) => {
      const go = (e, choice = resume ? 'continue' : 'begin') => {
        if (e.type === 'newgame') return finish('new');
        if (e.type === 'keydown' && e.code === 'Escape' && this._optionsEl) return this._closeOptions();
        if (e.type === 'keydown' && !['Enter', 'KeyE', 'Space'].includes(e.code)) return;
        if (this._optionsEl || (e.type === 'pointerdown' && e.target.closest?.('button'))) return;
        if (e.type === 'keydown' && e.code !== 'KeyE' && document.activeElement?.closest?.('.title button')) return; // Enter/Space press a focused button
        finish(choice);
      };
      const finish = (choice) => {
        this.titleEl.removeEventListener('pointerdown', go);
        this.titleEl.removeEventListener('newgame', go);
        window.removeEventListener('keydown', go);
        this._title = null;
        onBegin?.();
        this.titleEl.classList.remove('show');
        setTimeout(() => this.titleEl.classList.add('hidden'), 1300);
        resolve(choice);
      };
      this.titleEl.addEventListener('pointerdown', go);
      this.titleEl.addEventListener('newgame', go); // the New game button (see _renderTitle)
      window.addEventListener('keydown', go);
    });
  }

  _renderTitle() {
    const T = this.L.title;
    const resume = this._title?.resume;
    const begin = resume ? T.continue.replace('{n}', resume.num).replace('{name}', resume.name() || '') : T.begin;
    this.titleEl.innerHTML = `
      <h1>${esc(T.name)}</h1>
      <div class="hairline-rule"></div>
      <div class="tagline">${esc(T.tagline)}</div>
      <div class="controls">${T.controls.map(([k, v]) => `<div><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')}</div>
      <div class="begin">${esc(begin)}</div>
      <div class="title-foot"></div>`;
    if (this.titleEl.classList.contains('show')) this.titleEl.querySelector('.hairline-rule').style.transition = 'none';
    const foot = this.titleEl.querySelector('.title-foot');
    this._langButtons(foot);
    const opts = el('button', 'quality-opt title-options', foot, esc(this.L.options.title));
    opts.addEventListener('click', () => this._openOptions({ quality: this._title?.quality }));
    if (resume) {
      const fresh = el('button', 'quality-opt title-new', foot, esc(T.newGame));
      fresh.addEventListener('click', () => {
        if (!this._optionsEl) this.titleEl.dispatchEvent(new Event('newgame'));
      });
    }
    this._log(T.tagline);
    this._log(begin);
  }

  /** English / Français buttons (native names), the current one highlighted. */
  _langButtons(parent) {
    const btns = LANGS.map(({ code, label }) => {
      const b = el('button', 'quality-opt lang-opt', parent, esc(label));
      b.lang = code;
      b.dataset.lang = code;
      b.classList.toggle('on', code === getLang());
      b.addEventListener('click', () => setLang(code)); // _relang re-renders (and re-highlights)
      return b;
    });
    return btns;
  }

  /** The Options rows: language, voices, then graphics quality (when given). */
  _optionsRows(parent, quality) {
    const O = this.L.options;
    const P = this.L.pause;
    const lang = el('div', 'quality', parent);
    el('span', 'quality-label', lang, esc(O.language));
    this._langButtons(lang);
    if (this.voice) this._voiceRow(parent);
    if (quality?.tiers?.length) {
      const row = el('div', 'quality', parent);
      el('span', 'quality-label', row, esc(P.quality));
      const btns = quality.tiers.map((t) => {
        const b = el('button', 'quality-opt', row, esc(P.tiers?.[t] ?? t));
        b.dataset.tier = t;
        b.addEventListener('click', () => {
          quality.set(t);
          for (const x of btns) x.classList.toggle('on', x.dataset.tier === quality.get());
        });
        return b;
      });
      for (const x of btns) x.classList.toggle('on', x.dataset.tier === quality.get());
    }
  }

  /**
   * Voices on/off (saved by Voice). Voices are French only: in another language the row is greyed,
   * its buttons disabled, with a short note. Re-rendered by _relang with the rest of the panel.
   */
  _voiceRow(parent) {
    const O = this.L.options;
    const V = this.voice;
    const ok = V.supported;
    const row = el('div', 'quality voices', parent);
    el('span', 'quality-label', row, esc(O.voices));
    const btns = [true, false].map((on) => {
      const b = el('button', 'quality-opt', row, esc(on ? O.voicesOn : O.voicesOff));
      b.dataset.voices = on ? 'on' : 'off';
      b.disabled = !ok;
      b.classList.toggle('on', V.enabled === on); // greyed in English, but the saved choice still shows
      b.addEventListener('click', () => {
        V.setEnabled(on);
        for (const x of btns) x.classList.toggle('on', (x.dataset.voices === 'on') === V.enabled);
      });
      return b;
    });
    if (!ok) {
      for (const b of btns) Object.assign(b.style, { opacity: '0.4', cursor: 'default', pointerEvents: 'none' });
      const note = el('span', 'quality-note', row, esc(O.voicesNote));
      Object.assign(note.style, { fontSize: '12px', fontStyle: 'italic', color: 'var(--ink-faint)', marginLeft: '6px' });
    }
  }

  /** Options panel over the title screen (the pause menu shows the same rows in place). */
  _openOptions({ quality } = {}) {
    this._closeOptions();
    const o = (this._optionsEl = el('div', 'ui-layer overlay options', this.root));
    o._quality = quality;
    this._renderOptions();
  }

  _renderOptions() {
    const o = this._optionsEl;
    if (!o) return;
    o.innerHTML = `<h2>${esc(this.L.options.title)}</h2>`;
    this._optionsRows(o, o._quality);
    const back = el('button', 'btn', o, esc(this.L.options.back));
    back.addEventListener('click', () => this._closeOptions());
    back.focus({ preventScroll: true });
  }

  _closeOptions() {
    this._optionsEl?.remove();
    this._optionsEl = null;
  }

  // ------------------------------------------------------------- fade

  /**
   * Fade the screen to `to` (0 clear .. 1 opaque) over dur seconds. Resolves when done.
   * color: CSS colour; when omitted the current colour is kept while the screen is covered
   * (so a cut to white stays white across the chapter change), otherwise black.
   */
  fade(to, dur = 1, color) {
    if (color) this.fadeColor = color;
    else if (this.fadeValue <= 0.01) this.fadeColor = '#000';
    this.fadeEl.style.background = this.fadeColor;
    if (this._fade) this._fade.resolve();
    if (dur <= 0) {
      this._setFade(to);
      this._fade = null;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this._fade = { from: this.fadeValue, to, t: 0, dur, resolve };
    });
  }

  _setFade(v) {
    this.fadeValue = v;
    this.fadeEl.style.opacity = v;
    this.fadeEl.style.display = v <= 0.001 ? 'none' : 'block';
  }

  letterbox(on) {
    this.letterboxEl.classList.toggle('on', !!on);
  }

  // ------------------------------------------------------------- cards

  /**
   * Full-screen text card, one line at a time. Resolves when it closes.
   * opts: { skippable=true, centered, lineDelay=1.6, hold=2.4, bg='#000' | 'clear', color, big, mono, italic }
   * E / click: reveal all lines, then close.
   */
  card(lines, opts = {}) {
    if (!Array.isArray(lines)) lines = [lines];
    this._closeCard(true);
    const { skippable = true, lineDelay = 1.6, hold = 2.4, bg = '#000', color, big = false, mono = false, italic = false } = opts;
    const c = this.cardEl;
    c.className = 'ui-layer card';
    if (bg === 'clear' || bg === 'transparent') {
      c.classList.add('clear');
      c.style.background = '';
    } else c.style.background = bg;
    if (big) c.classList.add('big');
    if (mono) c.classList.add('mono');
    if (italic) c.classList.add('italic');
    c.innerHTML = lines.map((l) => `<div class="line">${renderSegments(segments(l))}</div>`).join('');
    lines.forEach((l) => this._log(l));
    if (color) c.style.color = color;
    else c.style.color = '';
    if (skippable && !this.skipCards) el('div', 'skip', c, esc(this.L.ui.next));
    c.classList.remove('hidden');
    requestAnimationFrame(() => c.classList.add('show'));
    const lineEls = [...c.querySelectorAll('.line')];
    return new Promise((resolve) => {
      this._card = {
        lineEls,
        shown: 0,
        t: 0,
        nextAt: 0.35,
        lineDelay: this.skipCards ? 0 : lineDelay,
        hold: this.skipCards ? 0.15 : hold,
        doneAt: null,
        opened: performance.now(),
        skippable,
        resolve,
        lines, // voiced card lines (Ch3 crack): each says its clip before the next appears
        clip: null,
        quietAt: 0,
      };
    });
  }

  _advanceCard() {
    const k = this._card;
    if (!k || !k.skippable || performance.now() - k.opened < 250) return;
    if (k.shown < k.lineEls.length) {
      k.clip?.stop();
      k.lineEls.forEach((e) => e.classList.add('show'));
      k.shown = k.lineEls.length;
      k.doneAt = k.t + Math.min(k.hold, 1.2);
      k.opened = performance.now();
    } else this._closeCard();
  }

  _closeCard(immediate = false) {
    const k = this._card;
    if (!k) return;
    this._card = null;
    k.clip?.stop();
    this.cardEl.classList.remove('show');
    if (immediate) this.cardEl.classList.add('hidden');
    else setTimeout(() => !this._card && this.cardEl.classList.add('hidden'), 650);
    k.resolve();
  }

  /** Close the active card now (Director.skip). */
  skipCard() {
    this._closeCard();
  }

  _updateCard(dt) {
    const k = this._card;
    if (!k) return;
    k.t += dt;
    if (this.input.pressed.has('KeyE') || this.input.pressed.has('Enter')) {
      this.input.consume('KeyE');
      this._advanceCard();
      if (!this._card) return;
    }
    if (k.clip?.busy) k.quietAt = k.t + 0.25; // a line being said holds the next one (and the close)
    while (k.shown < k.lineEls.length && k.t >= k.nextAt && k.t >= k.quietAt) {
      const i = k.shown++;
      k.lineEls[i].classList.add('show');
      k.nextAt = k.t + k.lineDelay;
      k.clip = this.voice?.play(k.lines[i], this.L.names?.hugo, { kind: 'dialogue' }) || null;
      if (k.clip) {
        k.quietAt = k.t + k.clip.remaining() + 0.25;
        break;
      }
    }
    if (k.shown >= k.lineEls.length) {
      if (k.doneAt === null) k.doneAt = k.t + k.hold;
      if (k.t >= k.doneAt && k.t >= k.quietAt) this._closeCard();
    }
  }

  /** Non-blocking chapter title over the opening fade. */
  chapterTitle(num, name, secs = 3.2) {
    this._chapterNum = num;
    const label = num ? this.L.ui.chapter.replace('{n}', num) : '';
    this.chapterEl.querySelector('.num').textContent = label;
    this.chapterEl.querySelector('.name').textContent = name || '';
    this._log(label);
    this._log(name);
    this.chapterEl.classList.add('show');
    this._later(secs, () => this.chapterEl.classList.remove('show'), 'chapter');
  }

  // ------------------------------------------------------------- dialogue

  /**
   * Dialogue box. lines: [{ who, text, inner?, voicemail? }] (a single line or string also works).
   * Types at 40 chars/s; E or click completes the line, then advances. Space never advances.
   * Resolves after the last line. Calls are queued (a single busy guard).
   */
  dialogue(lines) {
    if (!Array.isArray(lines)) lines = [lines];
    lines = lines.map((l) => (typeof l === 'string' ? { who: null, text: l } : l)).filter(Boolean);
    const token = { cancelled: false };
    const run = () =>
      new Promise((resolve) => {
        if (!lines.length || token.cancelled) return resolve();
        this._dialogue = { lines, i: -1, n: 0, len: 0, segs: null, typing: false, guardUntil: 0, resolve, token };
        this.thoughtEl.classList.remove('show'); // a dialogue replaces any thought in the lower third
        this._thoughtClip?.stop(0.06); // ... and interrupts its voice
        this.voice?.hold(true); // the beds stay ducked between its lines
        this.dialogueEl.classList.add('show');
        this._nextLine();
      });
    const p = this._dialogueQueue.then(run);
    this._dialogueQueue = p.catch(() => {});
    // cancel(): close this dialogue if open, or drop it if still queued.
    p.cancel = () => {
      token.cancelled = true;
      if (this._dialogue?.token === token) this._closeDialogue();
    };
    return p;
  }

  _nextLine() {
    const d = this._dialogue;
    d.i++;
    if (d.i >= d.lines.length) return this._closeDialogue();
    const line = d.lines[d.i];
    const who = line.who || '';
    this.whoEl.className = 'who ' + speakerClass(who);
    this.whoEl.innerHTML = line.inner ? '' : (line.voicemail ? `<span class="tag">${esc(this.L.ui.voicemail)}</span>` : '') + esc(who);
    if (!line.inner) {
      if (line.voicemail) this._log(this.L.ui.voicemail);
      this._log(who);
    }
    this._log(line.text);
    this.dialogueEl.classList.toggle('inner', !!line.inner);
    this.dialogueEl.classList.toggle('voicemail', !!line.voicemail);
    d.segs = segments(line.text);
    d.len = plainLength(d.segs);
    d.n = 0;
    d.typing = true;
    d.guardUntil = performance.now() + (d.i === 0 ? 150 : 120);
    this.textEl.innerHTML = '';
    this.nextEl.classList.remove('show');
    // Voice: the previous line's clip stops (E moved on), this one starts; the next two decode ahead.
    d.clip?.stop();
    d.clip = null;
    d.typedAt = 0;
    d.clipEndAt = 0;
    const V = this.voice;
    if (V?.active) {
      const vw = (l) => (l.inner && !l.who ? this.L.names?.hugo : l.who);
      const clip = (d.clip = V.play(line.text, vw(line), { kind: 'dialogue' }));
      clip?.ended.then(() => {
        if (d.clip === clip) d.clipEndAt = performance.now();
      });
      V.ahead(d.lines.slice(d.i + 1, d.i + 3).map((l) => ({ text: l.text, who: vw(l) })));
    }
  }

  _advanceDialogue() {
    const d = this._dialogue;
    if (!d || performance.now() < d.guardUntil) return;
    if (d.typing) {
      d.n = d.len;
      d.typing = false;
      this.textEl.innerHTML = renderSegments(d.segs);
      this.nextEl.classList.add('show');
      d.guardUntil = performance.now() + 120;
    } else this._nextLine();
  }

  _closeDialogue() {
    const d = this._dialogue;
    if (!d) return;
    this._dialogue = null;
    d.clip?.stop();
    this.voice?.hold(false);
    this.dialogueEl.classList.remove('show', 'inner', 'voicemail');
    d.resolve();
    const pt = this._pendingThought;
    this._pendingThought = null;
    if (pt) queueMicrotask(() => !this._dialogue && this.thought(...pt));
  }

  /** Close the active dialogue now (Director.skip). */
  skipDialogue() {
    this._closeDialogue();
  }

  _updateDialogue(dt) {
    const d = this._dialogue;
    if (!d) return;
    if (this.input.pressed.has('KeyE') || this.input.pressed.has('Enter')) {
      this.input.consume('KeyE');
      this._advanceDialogue();
      if (!this._dialogue) return;
    }
    if (d.typing) {
      d.n = Math.min(d.len, d.n + dt * CHARS_PER_SEC);
      this.textEl.innerHTML = renderSegments(d.segs, Math.floor(d.n));
      if (d.n >= d.len) {
        d.typing = false;
        this.nextEl.classList.add('show');
      }
    }
    // Debug/tests only (autoAdvance): a line moves on by itself once typed, read, and, if voiced, said
    // to the end + 250 ms. In play only E / click advance; they stop the clip at once.
    if (this.autoAdvance && !d.typing) {
      const now = performance.now();
      d.typedAt ||= now;
      const said = !d.clip || (!d.clip.busy && now >= d.clipEndAt + 250);
      if (said && now >= d.typedAt + (d.clip ? 0 : 900)) this._nextLine();
    }
  }

  // ------------------------------------------------------------- choices

  /** Choice menu { prompt, options:[{text}] }. Resolves with the chosen index (keys 1-3 or click). */
  choices(menu) {
    this._closeChoices(null);
    const c = this.choicesEl;
    c.innerHTML = '';
    if (menu.prompt) el('div', 'q', c, esc(menu.prompt));
    this._log(menu.prompt);
    const opts = menu.options || [];
    return new Promise((resolve) => {
      this._choices = { menu, resolve, opened: performance.now(), buttons: [] };
      opts.forEach((o, i) => {
        this._log(o.text);
        const b = el('button', '', c, `<span class="kbd">${i + 1}</span>${esc(o.text)}`);
        if (o._used) b.classList.add('used');
        b.addEventListener('click', () => this._pick(i));
        this._choices.buttons.push(b);
      });
      c.classList.add('show');
    });
  }

  _pick(i) {
    const k = this._choices;
    if (!k || performance.now() - k.opened < 150) return;
    if (i < 0 || i >= k.buttons.length) return;
    k.buttons[i].classList.add('sel');
    this._closeChoices(i);
  }

  _closeChoices(i) {
    const k = this._choices;
    if (!k) return;
    this._choices = null;
    this.choicesEl.classList.remove('show');
    k.resolve(i);
  }

  /** Close the active menu (Director.skip). index defaults to the first correct option. */
  skipChoices(index) {
    const k = this._choices;
    if (!k) return;
    const opts = k.menu.options || [];
    const i = index ?? Math.max(0, opts.findIndex((o) => o.correct));
    this._closeChoices(i);
  }

  _updateChoices() {
    if (!this._choices) return;
    for (let i = 0; i < 9; i++) {
      if (this.input.pressed.has(`Digit${i + 1}`) || this.input.pressed.has(`Numpad${i + 1}`)) {
        this._pick(i);
        return;
      }
    }
  }

  // ------------------------------------------------------------- HUD bits

  /** Objective line, top-left (null hides). */
  objective(text) {
    const e = this.objectiveEl;
    if (!text) {
      e.classList.remove('show');
      this._objective = null;
      this._timers = this._timers.filter((t) => t.key !== 'objective'); // drop a pending show
      return;
    }
    if (text === this._objective) return;
    this._objective = text;
    e.classList.remove('show');
    this._later(0.25, () => {
      e.textContent = this._objective ?? text;
      e.classList.add('show');
      this._log(this._objective ?? text);
    }, 'objective');
  }

  /** Chapter-owned prompt ("[E] Reset", "[Space] ..."). Takes priority over hotspot prompts. null clears. */
  prompt(text) {
    this._chapterPrompt = text || null;
    this._renderPrompt();
  }

  _spotPrompt(text) {
    const t = text ? `[${label('KeyE')}] ${text}` : null; // follows the keyboard layout
    if (t === this._spotText) return;
    this._spotText = t;
    this._renderPrompt();
  }

  _renderPrompt() {
    const t = this._chapterPrompt || this._spotText;
    if (t) {
      if (this._promptShown !== t) {
        this.promptEl.innerHTML = promptHtml(t);
        this._log(t);
      }
      this.promptEl.classList.add('show');
    } else this.promptEl.classList.remove('show');
    this._promptShown = t;
  }

  /** Small transient tip at the top (e.g. "Hold Shift to jog"). */
  hint(text, secs = 5) {
    this._hint = text;
    this.hintEl.innerHTML = promptHtml(text);
    this.hintEl.classList.add('show');
    this._log(text);
    this._later(secs, () => this.hintEl.classList.remove('show'), 'hint');
  }

  /**
   * Non-blocking line in the lower third. Without `who` it is an italic inner thought; with `who`
   * ('Odile', 'Sami', ...) it is a spoken bark with a speaker label in that speaker's colour.
   * opts: { who, replace } - replace: a newer line from the same `who` (a radio station as the dial
   * moves) cuts the one being said and drops its waiting lines instead of queueing behind them.
   * Returns the voice clip (French, voices on) or null.
   */
  thought(text, secs = 3.5, { who, replace = false } = {}) {
    // Never on top of an open dialogue (same lower third): hold it until the dialogue closes.
    if (this._dialogue) {
      this._pendingThought = [text, secs, { who, replace }];
      return null;
    }
    if (replace && (this._thought?.who ?? null) === (who ?? null)) {
      this._voiceQueue = this._voiceQueue.filter((x) => (x.who ?? null) !== (who ?? null));
      if (this._thoughtClip?.busy) this._thoughtClip.stop(0.12);
    }
    // Never over a voiced thought still being said: wait for it (the newest two wait; older ones drop).
    if (this._thoughtClip?.busy) {
      const q = this._voiceQueue;
      if (!q.some((x) => x.text === text) && this._thought?.text !== text) {
        q.push({ text, secs, who, at: performance.now() });
        if (q.length > 2) q.shift();
      }
      return null;
    }
    const e = this.thoughtEl;
    this._thought = { text, who };
    this._log(who);
    this._log(text);
    this._renderThought();
    e.classList.add('show');
    // Voice: stays up at least the clip's length + 0.4 s (a dialogue clip playing means no clip here).
    this._thoughtClip?.stop();
    const clip = (this._thoughtClip = this.voice?.play(text, who || this.L.names?.hugo, { kind: 'thought' }) || null);
    if (clip) {
      secs = Math.max(secs, clip.dur + 0.4);
      clip.ended.then(() => clip === this._thoughtClip && (this._thoughtSaidAt = performance.now()));
    }
    let holds = 0;
    const hide = () => {
      // Still loading or saying it (a late decode): hold on until it has been said (a few times at most).
      if (clip && clip === this._thoughtClip && clip.busy && holds++ < 4) {
        return this._later(Math.max(0.1, clip.remaining()) + 0.4, hide, 'thought');
      }
      e.classList.remove('show');
    };
    this._later(secs, hide, 'thought');
    return clip;
  }

  /** A voiced thought is being said or waits to be (never true in English or with voices off). */
  thoughtSpeaking() {
    return !!this._thoughtClip?.busy || this._voiceQueue.length > 0;
  }

  /** Per frame: show the next waiting thought once the voiced one before it has been said. */
  _updateVoiceQueue() {
    const q = this._voiceQueue;
    const now = performance.now();
    const dt = now - (this._vqT || now);
    this._vqT = now;
    if (!q.length) return;
    // A waiting line ages only while it waits on another voiced thought: time under a dialogue or a
    // card does not count (it is shown once they close, as in English where it was up before them).
    if (this._dialogue || this._card) {
      for (const x of q) x.at += dt;
      return;
    }
    if (this._thoughtClip?.busy) return;
    if (this._thoughtClip && now < (this._thoughtSaidAt || 0) + 400) return; // the said line stays up 0.4 s
    while (q.length && now - q[0].at > 6000) q.shift(); // stale
    const n = q.shift();
    if (n) this.thought(n.text, n.secs, { who: n.who });
  }

  _renderThought() {
    const { text, who } = this._thought;
    const e = this.thoughtEl;
    const body = renderSegments(segments(text));
    if (who) {
      e.innerHTML = `<div class="who ${speakerClass(who)}">${esc(who)}</div><div class="said">${body}</div>`;
      e.classList.add('spoken');
    } else {
      e.innerHTML = body;
      e.classList.remove('spoken');
    }
  }

  /** Pain meter 0..1. */
  pain(v, visible = true) {
    const show = visible && v > 0.001;
    if (show !== this._painShown) {
      this.painEl.classList.toggle('show', show);
      this._painShown = show;
    }
    const w = Math.round(Math.min(1, v) * 1000) / 10;
    if (w !== this._painW) {
      this.painFill.style.width = `${w}%`;
      this.painEl.classList.toggle('hot', v > 0.75);
      this._painW = w;
    }
  }

  /** Broadcast-style lower-third caption. secs=0 keeps it until caption(null). */
  caption(text, { secs = 0 } = {}) {
    if (!text) {
      this.captionEl.classList.remove('show');
      return;
    }
    this.captionEl.querySelector('.text').textContent = text;
    this.captionEl.classList.add('show');
    this._log(text);
    if (secs > 0) this._later(secs, () => this.captionEl.classList.remove('show'), 'caption');
  }

  /** Large centred text for a moment. opts: { secs=1.6, label (small caps above), xl=false, mono=false } */
  banner(text, { secs = 1.6, label, xl = false, mono = false } = {}) {
    const e = this.bannerEl;
    if (!text) {
      e.classList.remove('show');
      return;
    }
    e.className = 'banner' + (xl ? ' xl' : '');
    this._banner = { text, label, mono };
    this._renderBanner();
    this._log(label);
    this._log(text);
    requestAnimationFrame(() => e.classList.add('show'));
    if (secs > 0) this._later(secs, () => e.classList.remove('show'), 'banner');
  }

  _renderBanner() {
    const { text, label, mono } = this._banner;
    this.bannerEl.innerHTML = (label ? `<small>${esc(label)}</small>` : '') + (mono ? `<span class="mono">${esc(text)}</span>` : esc(text));
  }

  // ------------------------------------------------------------- GPS watch

  /**
   * GPS watch HUD, docked bottom-right. face: text such as '0.0 km' (a trailing unit is drawn small);
   * null hides it (it slides away). opts: { label, lap, tick=true, over }
   *   label  small caps line above the face ('THIS WEEK', 'WALK', 'RACE'); omitted = unchanged, null = none
   *   lap    small line under the face ('LAST WEEK 212.4', '38:40'); omitted = unchanged, null = none
   *   tick   pulse the face when its text changes (pass false for per-frame live updates)
   *   over   true lifts it above the fade (z 26, readable over black); omitted = unchanged
   * A running watchCount() is stopped by any explicit watch() call.
   */
  watch(face, { label, lap, tick = true, over } = {}) {
    const w = this._watch;
    const e = this.watchEl;
    if (face === null || face === undefined) {
      w.count = null;
      if (w.shown) {
        e.classList.remove('show', 'focus');
        e.classList.add('off');
        this._later(0.8, () => !this._watch.shown && e.classList.remove('off', 'over'), 'watch-off');
      }
      Object.assign(w, { shown: false, face: null, over: false });
      return;
    }
    if (w.count && !w._fromCount) w.count = null;
    if (this._timers.some((t) => t.key === 'watch-off')) this._timers = this._timers.filter((t) => t.key !== 'watch-off');
    e.classList.remove('off');
    const faceEl = e.querySelector('.wface');
    if (face !== w.face) {
      this._renderFace(face);
      if (tick && w.face !== null && w.shown) retick(faceEl, 'tick');
      w.face = face;
    }
    if (label !== undefined && label !== w.label) {
      e.querySelector('.wlabel').textContent = label ?? '';
      w.label = label ?? null;
      this._log(label);
    }
    if (lap !== undefined && lap !== w.lap) {
      const lapEl = e.querySelector('.wlap');
      this._renderLap(lap ?? '');
      if (/[a-z]/i.test(lap ?? '')) this._log(lap); // not the per-frame clock
      if (tick && w.lap !== null && w.shown) retick(lapEl, 'tick');
      w.lap = lap ?? null;
    }
    e.classList.toggle('has-label', !!w.label);
    e.classList.toggle('has-lap', !!w.lap);
    if (over !== undefined) w.over = !!over;
    e.classList.toggle('over', w.over);
    if (!w.shown) {
      w.shown = true;
      e.classList.remove('show');
      void e.offsetWidth;
    }
    e.classList.add('show');
  }

  /** Lap line in the language's decimal mark; a long one ('SEM. PRÉC. 212,4') is set tighter to clear the round screen. */
  _renderLap(lap) {
    const e = this.watchEl.querySelector('.wlap');
    e.textContent = num(lap);
    e.classList.toggle('long', lap.length > 15);
  }

  /** Face text in the language's decimal mark ('0,32 km'), a trailing unit drawn small. */
  _renderFace(face) {
    const s = num(String(face));
    const m = s.match(/^(.*?)(\s*(?:km|m|spm))$/);
    this.watchEl.querySelector('.wface').innerHTML = m ? `${esc(m[1])}<small>${esc(m[2].trim())}</small>` : esc(s);
  }

  /**
   * Count the watch face from `from` to `to` over `secs` (real time, eased), e.g. 170.2 -> 212.4.
   * opts: { label, lap, over, unit='km', decimals=1, ease=true }
   * Returns a Promise (resolves when the count lands) with .finish() to jump to the end.
   * Gate it in chapters: d.gate(p, () => { p.finish(); return true; })
   */
  watchCount(from, to, secs = 1.5, { label, lap, over, unit = 'km', decimals = 1, ease = true } = {}) {
    const fmt = (v) => `${v.toFixed(decimals)}${unit ? ' ' + unit : ''}`;
    this.watch(fmt(from), { label, lap, over, tick: false });
    let resolve;
    const p = new Promise((r) => (resolve = r));
    const c = { from, to, secs: Math.max(0.01, secs), t: 0, fmt, ease, resolve, lastText: null };
    this._watch.count = c;
    p.finish = () => {
      if (this._watch.count === c) c.t = c.secs;
    };
    return p;
  }

  _updateWatch(raw) {
    const w = this._watch;
    const c = w.count;
    if (c) {
      c.t += raw;
      const k = Math.min(1, c.t / c.secs);
      const e = c.ease ? 1 - (1 - k) * (1 - k) * (1 - k) : k;
      const text = c.fmt(c.from + (c.to - c.from) * e);
      if (text !== c.lastText) {
        c.lastText = text;
        w._fromCount = true;
        this.watch(text, { tick: false });
        w._fromCount = false;
        if (Math.random() < 0.5) this.audio?.tick({ volume: 0.05 });
      }
      if (k >= 1) {
        w.count = null;
        retick(this.watchEl.querySelector('.wface'), 'tick');
        c.resolve();
      }
    }
    if (w.buzzUntil && performance.now() > w.buzzUntil) {
      w.buzzUntil = 0;
      this.watchEl.classList.remove('buzzing');
      if (w.buzzTemp) {
        w.buzzTemp = false;
        if (!w.face) this.watchEl.classList.remove('show');
      }
    }
  }

  /**
   * The watch buzzes: a notification slides out beside the face, the watch shakes, audio.buzz().
   * Non-blocking. If the watch is hidden it pops up for the duration.
   * opts: { title='STRIDE' }
   */
  watchBuzz(text, secs = 2.4, { title = this.L.names?.stride || 'STRIDE' } = {}) {
    const e = this.watchEl;
    const w = this._watch;
    e.querySelector('.ntitle').textContent = title || '';
    e.querySelector('.ntext').innerHTML = renderSegments(segments(text));
    w.buzz = { text, title };
    this._log(title);
    this._log(text);
    if (!w.shown) {
      w.buzzTemp = true;
      e.classList.remove('off');
      e.classList.add('show');
    }
    e.classList.remove('buzzing');
    void e.offsetWidth;
    e.classList.add('buzzing');
    w.buzzUntil = performance.now() + secs * 1000;
    this.audio?.buzz();
  }

  /**
   * Swell the watch to the centre of the screen (Ch2 "How far?"), or dock it again.
   * opts: { flare } CSS colour of the glow on the screen and the lap line.
   */
  watchFocus(on, { flare } = {}) {
    const e = this.watchEl;
    if (flare) e.style.setProperty('--flare', flare);
    else if (!on) e.style.removeProperty('--flare');
    e.classList.toggle('flare', !!(on && flare));
    e.classList.toggle('focus', !!on);
  }

  // ------------------------------------------------------------- notebook ("WHAT I CAN DO")

  _nbSet(entries) {
    const n = this._nb;
    if (!entries) {
      n.entries = [];
      this.nbList.innerHTML = '';
      this._nbHide();
      return;
    }
    n.entries = entries.map((x) => (typeof x === 'string' ? { text: x } : { ...x }));
    this._nbRender();
    this._nbShow();
    this._nbDock(true);
  }

  /** Rebuild the rows from the entries (no write-on animation). */
  _nbRender() {
    this.nbList.innerHTML = '';
    for (const it of this._nb.entries) {
      this.nbList.appendChild(this._nbRow(it, false));
      this._log(it.text);
      this._log(it.note);
    }
  }

  _nbRow(it, animate) {
    const li = document.createElement('li');
    li.className = 'nb-row' + (it.hand === 'sami' ? ' sami' : '') + (it.struck ? ' struck' : '');
    li.innerHTML = `<span class="nb-text"><span class="ink">${esc(it.text)}</span><span class="strike"></span></span><span class="nb-note">${it.note ? esc(it.note) : ''}</span>`;
    li.dataset.text = it.text;
    if (animate) {
      const ink = li.querySelector('.ink');
      ink.classList.add('writing');
      ink.style.animationDuration = `${Math.max(0.5, Math.min(1.1, 0.25 + it.text.length * 0.035))}s`;
    }
    return li;
  }

  _nbFind(text) {
    // An entry written before a language change still matches its key in the new language.
    const i = this._nb.entries.findIndex((e) => e.text === text || retext(e.text) === retext(text));
    return { i, it: this._nb.entries[i], li: i >= 0 ? this.nbList.children[i] : null };
  }

  _nbScratch(secs = 0.6) {
    const a = this.audio;
    if (!a) return;
    for (let t = 0; t < secs; t += 0.11) a.noise({ type: 'highpass', freq: 3800, q: 0.6, dur: 0.05, volume: 0.035, tail: 0.03, delay: t });
  }

  /**
   * Notebook foley (docs/assets/sfx.md, Global): the recorded pencil, eraser and exercise book on fx
   * (loaded with Ch4 / Ch5's `sounds`). `scratch` (secs): the procedural pencil ticks when the file is
   * missing or not decoded yet; 0 = silent then. Returns the sfx handle or null.
   */
  _nbSound(name, opts = {}, scratch = 0) {
    const a = this.audio;
    if (!a?.sfx) return scratch ? this._nbScratch(scratch) : null;
    return a.sfx(name, { bus: 'fx', jitter: 0.05, ...opts, fallback: scratch ? () => this._nbScratch(scratch) : false });
  }

  /** Write a new line (animated). Opens the notebook for 3 s. Returns a Promise (~0.8 s). */
  _nbAdd(text, { hand = 'hugo' } = {}) {
    const it = { text, hand };
    this._nb.entries.push(it);
    this._log(text);
    const li = this._nbRow(it, true);
    this.nbList.appendChild(li);
    this._nbShow();
    this._nbOpen(3.2);
    // Sami's "Teech." is slower and heavier (rate 0.85); Hugo's entries 0.9-1.1.
    this._nbSound('pencil_write', hand === 'sami' ? { volume: 0.35, rate: 0.85, jitter: 0.02 } : { volume: 0.35, jitter: 0.1 }, 0.7);
    return new Promise((r) => this._later(0.9, r));
  }

  /** Strike a line through an entry (lightly, in pencil), or erase the strike (on=false). */
  _nbStrike(text, on = true) {
    const { it, li } = this._nbFind(text);
    if (!it) return Promise.resolve();
    it.struck = !!on;
    if (li) {
      li.classList.remove('striking', 'erasing');
      void li.offsetWidth;
      li.classList.toggle('struck', !!on);
      li.classList.add(on ? 'striking' : 'erasing');
    }
    this._nbShow();
    this._nbOpen(3);
    if (on) {
      // A quick pencil line through it: the start of the writing take, faster, cut short.
      const h = this._nbSound('pencil_write', { volume: 0.3, rate: 1.25, jitter: 0.05 }, 0.4);
      if (h?.stop) this._later(0.45, () => h.stop(0.12));
    } else this._nbSound('pencil_erase', { volume: 0.35, alt: 'pencil_erase_alt' }, 0.25); // the eraser lifts it
    return new Promise((r) => this._later(0.7, r));
  }

  /** Append a small note after an entry ('Run.' -> 'Run. (some Sundays)'), written on. */
  _nbAnnotate(text, note) {
    const { it, li } = this._nbFind(text);
    if (!it) return Promise.resolve();
    it.note = note || undefined;
    this._log(note);
    if (li) {
      const n = li.querySelector('.nb-note');
      n.textContent = note || '';
      n.classList.remove('writing');
      void n.offsetWidth;
      if (note) n.classList.add('writing');
    }
    this._nbShow();
    this._nbOpen(3);
    if (note) this._nbSound('pencil_write', { volume: 0.32, rate: 1.05, jitter: 0.05 }, 0.5);
    return new Promise((r) => this._later(0.8, r));
  }

  _nbShow() {
    this._nb.shown = true;
    this.notebookEl.classList.add('show');
  }

  /** Open the notebook full size for `secs` (0 = until dock()), then dock it top-right. */
  _nbOpen(secs = 3) {
    this._nbShow();
    if (!this._nb.open) {
      // Docked -> full size: the book opens, a page turns.
      this._nbSound('notebook_open', { volume: 0.35 });
      this._nbSound('page_flip', { volume: 0.3, delay: 0.08 });
    }
    this._nb.open = true;
    this.notebookEl.classList.add('open');
    if (secs > 0 && Number.isFinite(secs)) this._later(secs, () => this._nbDock(), 'nb-dock');
    else this._timers = this._timers.filter((t) => t.key !== 'nb-dock');
  }

  _nbDock(quiet = false) {
    if (this._nb.open && !quiet) this._nbSound('notebook_close', { volume: 0.3 }); // full size -> docked
    this._nb.open = false;
    this._timers = this._timers.filter((t) => t.key !== 'nb-dock');
    this.notebookEl.classList.remove('open');
  }

  /** Hide the notebook (entries are kept; set(null) clears them). */
  _nbHide() {
    this._nb.shown = false;
    this._nbDock(true);
    this.notebookEl.classList.remove('show');
  }

  // ------------------------------------------------------------- gauge

  /**
   * Horizontal meter with a needle and a target band, above the prompt at bottom-centre.
   * label null hides it. opts: { value, band:[lo, hi], max=1, color (band colour), text (readout),
   * min=0, warn=false (needle red) }. Call every frame with new values; it is cheap.
   */
  gauge(label, { value = 0, band, max = 1, min = 0, color, text, warn = false } = {}) {
    const e = this.gaugeEl;
    if (label === null || label === undefined) {
      if (this._gauge) e.classList.remove('show');
      this._gauge = null;
      return;
    }
    const g = (this._gauge ||= {});
    const span = Math.max(1e-6, max - min);
    const k = (v) => Math.max(0, Math.min(1, (v - min) / span)) * 100;
    if (g.label !== label) {
      e.querySelector('.glabel').textContent = label;
      g.label = label;
      this._log(label);
    }
    const bandEl = e.querySelector('.gband');
    if (band) {
      bandEl.style.left = `${k(band[0])}%`;
      bandEl.style.width = `${Math.max(0, k(band[1]) - k(band[0]))}%`;
      bandEl.style.display = '';
    } else bandEl.style.display = 'none';
    if (color !== g.color) {
      bandEl.style.background = color || '';
      g.color = color;
    }
    const pct = k(value);
    e.querySelector('.gneedle').style.left = `${pct}%`;
    const inBand = band ? value >= band[0] && value <= band[1] : false;
    e.classList.toggle('in', inBand);
    e.classList.toggle('warn', !!warn);
    const t = text ?? '';
    if (t !== g.text) {
      e.querySelector('.gtext').textContent = t;
      g.text = t;
    }
    e.classList.add('show');
  }

  /**
   * Shrinking timing ring. Press Space when the ring meets the target circle.
   * Runs on real time (slow motion does not shorten it). Presses in the first `guard` share of the
   * travel are ignored rather than failing, so a nervous early tap is forgiven.
   * opts: { duration=2.4 (s, ring travel), window=0.18 (s, +-), guard=0.4, cue='[Space]',
   *         shout=null (banner text on a hit; null = none), missText=null (thought on a miss) }
   * The perfect moment is at 0.75 * duration. Resolves { hit, error } where error is
   * |press - perfect| in seconds (null if no press).
   */
  driveRing({ duration = 2.4, window = 0.18, guard = 0.4, cue = `[${this.L.hints.space}]`, shout = null, missText = null } = {}) {
    this.cancelDrive();
    const e = this.driveEl;
    e.classList.remove('hit', 'miss');
    e.querySelector('.key').innerHTML = promptHtml(cue);
    this._cue = cue;
    this._log(cue);
    e.classList.add('show');
    return new Promise((resolve) => {
      this._drive = { t: 0, duration, perfect: duration * 0.75, window, guard, shout, missText, resolve };
      this._renderDrive(0);
    });
  }

  _renderDrive(t) {
    const d = this._drive;
    const k = t / d.perfect; // 0 at start, 1 when it meets the target
    const s = Math.max(0.2, 2.6 - 1.6 * k); // 2.6x -> 1x at the target (the cue sits just outside 2.6x)
    const ring = this.driveEl.querySelector('.ring');
    ring.style.transform = `scale(${s})`;
    ring.style.opacity = String(Math.min(1, 0.3 + k));
    // The target brightens as the ring closes in, so the moment reads.
    this.driveEl.classList.toggle('near', Math.abs(t - d.perfect) <= d.window);
  }

  _endDrive(result) {
    const d = this._drive;
    if (!d) return;
    this._drive = null;
    this.driveEl.classList.remove('near');
    if (result.hit) {
      this.driveEl.classList.add('hit');
      if (d.shout) this.banner(d.shout, { xl: false, secs: 1.2 });
    } else if (!result.cancelled) {
      // A miss still says something: a muted version of the shout.
      this.driveEl.classList.add('miss');
      if (d.missText) this.thought(d.missText, 2.4);
    }
    this._later(result.hit ? 0.4 : 0.5, () => this.driveEl.classList.remove('show', 'hit', 'miss'), 'drive');
    d.resolve(result);
  }

  /** Cancel an active drive ring (resolves as a miss). */
  cancelDrive() {
    if (this._drive) this._endDrive({ hit: false, error: null, cancelled: true });
  }

  _updateDrive(dt) {
    const d = this._drive;
    if (!d) return;
    d.t += dt;
    if (this.input.pressed.has('Space') && d.t >= d.perfect * d.guard) {
      const error = Math.abs(d.t - d.perfect);
      return this._endDrive({ hit: error <= d.window, error });
    }
    if (d.t >= d.duration) return this._endDrive({ hit: false, error: null });
    this._renderDrive(d.t);
  }

  // ------------------------------------------------------------- overlays

  /** Pause overlay. handlers: { onResume, onRestart } */
  /**
   * Pause overlay. quality (optional): { get() -> tier, set(tier), tiers: ['low', 'medium', 'high'] }
   * adds a graphics-quality switch (applied at once; remembered for the next visit).
   */
  showPause({ onResume, onRestart, quality }) {
    if (this.pauseEl) return;
    this.pauseEl = el('div', 'ui-layer overlay', this.root);
    this._pause = { onResume, onRestart, quality, view: 'main' };
    this._renderPause();
  }

  /** Pause menu: Resume / Restart chapter / Options, or the Options rows (language, graphics) + Back. */
  _renderPause() {
    const k = this._pause;
    const p = this.pauseEl;
    if (!p || !k) return;
    const P = this.L.pause;
    p.classList.toggle('options', k.view === 'options');
    if (k.view === 'options') {
      p.innerHTML = `<h2>${esc(this.L.options.title)}</h2>`;
      this._optionsRows(p, k.quality);
      const back = el('button', 'btn', p, esc(this.L.options.back));
      back.addEventListener('click', () => {
        k.view = 'main';
        this._renderPause();
      });
      back.focus({ preventScroll: true });
      return;
    }
    p.innerHTML = `<h2>${esc(P.title)}</h2>`;
    const resume = el('button', 'btn', p, esc(P.resume));
    const restart = el('button', 'btn', p, esc(P.restart));
    const options = el('button', 'btn', p, esc(P.options));
    el('div', 'small', p, `${esc(P.escKey)} · ${esc(P.muteHint)}`);
    resume.addEventListener('click', () => k.onResume?.());
    restart.addEventListener('click', () => k.onRestart?.());
    options.addEventListener('click', () => {
      k.view = 'options';
      this._renderPause();
    });
    resume.focus({ preventScroll: true });
  }

  hidePause() {
    this.pauseEl?.remove();
    this.pauseEl = null;
    this._pause = null;
  }

  /** Mobile / small-screen warning. Resolves on "Continue anyway". */
  mobileWarning() {
    const w = el('div', 'ui-layer overlay warning', this.root);
    w.innerHTML = `<h2>${esc(this.L.title.name)}</h2><p>${esc(this.L.mobile.text)}</p>`;
    const b = el('button', 'btn', w, esc(this.L.mobile.continue));
    return new Promise((resolve) => {
      b.addEventListener('click', () => {
        w.remove();
        resolve();
      });
    });
  }

  /** Fatal "no WebGL" card with the opening text. */
  noWebGL() {
    this.loadingEl.classList.add('hidden');
    const f = el('div', 'ui-layer overlay fatal', this.root);
    f.innerHTML =
      this.L.opening.map((l) => `<div class="line">${esc(l)}</div>`).join('') + `<div class="msg">${esc(this.L.noWebGL)}</div>`;
  }

  /** Fatal "context lost" card. `onReload` (main.js) reloads at the current chapter, like Restart. */
  contextLost(onReload = () => location.reload()) {
    const f = el('div', 'ui-layer overlay fatal', this.root);
    f.innerHTML = `<p>${esc(this.L.contextLost)}</p>`;
    const b = el('button', 'btn', f, esc(this.L.reload));
    b.addEventListener('click', () => onReload());
  }

  /**
   * Ending: card(E.lines), then each of E.bigs (big centred text), then the E.hairline 1 px line
   * drawing across the centre (0 -> 60% width), then E.thanks + Play again + E.credits.
   * Resolves once the final screen is up. Play again reloads without query flags.
   */
  async endCard(E = this.L.ending) {
    if (E.lines?.length) await this.card(E.lines, { lineDelay: 2.4, hold: 3 });
    // Ch5 ends on a white fade. Turn the layer under the closing card black, or the white shows
    // through while the card fades out and the end screen fades in.
    this.fade(1, 0, '#000');
    const e = this.endEl;
    e.innerHTML = `<div class="big"></div><div class="hairline"></div><div class="thanks">${esc(E.thanks)}</div>`;
    const again = el('button', 'btn again', e, esc(E.playAgain));
    again.id = 'play-again';
    const credits = el('div', 'credits', e, esc(E.credits));
    this._end = { E, again, credits };
    [E.thanks, E.playAgain, E.credits].forEach((s) => this._log(s));
    again.addEventListener('click', () => {
      const lang = new URLSearchParams(location.search).get('lang');
      location.href = location.pathname + (lang ? `?lang=${encodeURIComponent(getLang())}` : '');
    });
    e.classList.remove('hidden');
    requestAnimationFrame(() => e.classList.add('show'));
    const big = e.querySelector('.big');
    const hair = e.querySelector('.hairline');
    if (E.hairlineColor) hair.style.background = E.hairlineColor;
    const fast = this.skipCards;
    const wait = (s) => new Promise((r) => setTimeout(r, (fast ? Math.min(s, 0.15) : s) * 1000));
    await wait(1.1);
    for (const b of E.bigs || []) {
      big.textContent = num(b);
      this._log(num(b));
      big.classList.add('show');
      await wait(1.6);
      big.classList.remove('show');
      await wait(1.2);
    }
    big.classList.add('gone');
    if (E.hairline) {
      hair.style.transitionDuration = fast ? '0.2s' : '2.2s';
      hair.classList.add('draw');
      await wait(2.4);
    }
    e.querySelector('.thanks').classList.add('show');
    await wait(1.1);
    again.classList.add('show');
    credits.classList.add('show');
  }

  /** Hide transient chapter UI (called between chapters). */
  clearTransient() {
    this.objective(null);
    this.prompt(null);
    this._spotPrompt(null);
    this.caption(null);
    this.banner(null);
    this.watchFocus(false);
    this.watch(null);
    this.notebook.hide();
    this.gauge(null);
    this.pain(0, false);
    this.letterbox(false);
    this.cancelDrive();
    this.hintEl.classList.remove('show');
    this.thoughtEl.classList.remove('show');
    this._pendingThought = null;
    this._thoughtClip?.stop();
    this._voiceQueue.length = 0;
  }

  // ------------------------------------------------------------- language

  /** Debug text log (__game.debug.textLog): every string the UI shows, capped. */
  _log(s) {
    const t = this.textLog;
    if (!t || s === null || s === undefined || s === '') return;
    t.push(String(s));
    if (t.length > 2000) t.splice(0, t.length - 2000);
  }

  /** After i18n.setLang: re-render everything on screen except a dialogue line or card already up. */
  _relang() {
    const L = this.L;
    const $ = (sel, root = this.root) => root.querySelector(sel);
    $('.label', this.painEl).textContent = L.ui.pain;
    this.nextEl.textContent = L.ui.next;
    const skip = $('.skip', this.cardEl);
    if (skip) skip.textContent = L.ui.next;
    $('.nb-head', this.notebookEl).textContent = L.notebook?.heading || '';
    $('.mark', this.loadingEl).textContent = L.title?.name || '';
    if (this._title) this._renderTitle();
    if (this._optionsEl) this._renderOptions();
    if (this._pause) this._renderPause();
    if (this._objective) {
      this._objective = retext(this._objective);
      if (this.objectiveEl.classList.contains('show')) {
        this.objectiveEl.textContent = this._objective;
        this._log(this._objective);
      }
    }
    this._chapterPrompt = retext(this._chapterPrompt);
    this._spotText = retext(this._spotText);
    this._promptShown = null;
    this._renderPrompt();
    if (this._hint) {
      this._hint = retext(this._hint);
      this.hintEl.innerHTML = promptHtml(this._hint);
    }
    if (this._thought) {
      this._thought = { text: retext(this._thought.text), who: retext(this._thought.who) };
      if (this.thoughtEl.classList.contains('show')) this._renderThought();
    }
    const pt = this._pendingThought;
    if (pt) this._pendingThought = [retext(pt[0]), pt[1], { who: retext(pt[2]?.who) }];
    for (const q of this._voiceQueue) Object.assign(q, { text: retext(q.text), who: retext(q.who) });
    const cap = $('.text', this.captionEl);
    cap.textContent = retext(cap.textContent);
    if (this._banner) {
      this._banner.text = retext(this._banner.text);
      this._banner.label = retext(this._banner.label);
      this._renderBanner();
    }
    $('.num', this.chapterEl).textContent = this._chapterNum ? L.ui.chapter.replace('{n}', this._chapterNum) : '';
    const name = $('.name', this.chapterEl);
    name.textContent = retext(name.textContent);
    // Watch: label, lap, the last notification, and the face's decimal mark.
    const w = this._watch;
    if (w.face) this._renderFace(w.face);
    if (w.label) $('.wlabel', this.watchEl).textContent = w.label = retext(w.label);
    if (w.lap) this._renderLap((w.lap = retext(w.lap)));
    if (w.buzz) {
      w.buzz = { text: retext(w.buzz.text), title: retext(w.buzz.title) };
      $('.ntitle', this.watchEl).textContent = w.buzz.title || '';
      $('.ntext', this.watchEl).innerHTML = renderSegments(segments(w.buzz.text));
    } else $('.ntitle', this.watchEl).textContent = L.names.stride;
    // Notebook entries keep their struck state and notes.
    if (this._nb.entries.length) {
      for (const it of this._nb.entries) {
        it.text = retext(it.text);
        if (it.note) it.note = retext(it.note);
      }
      this._nbRender();
    }
    if (this._gauge?.label) {
      this._gauge.label = retext(this._gauge.label);
      $('.glabel', this.gaugeEl).textContent = this._gauge.label;
    }
    $('.key', this.driveEl).innerHTML = this._cue ? promptHtml((this._cue = retext(this._cue))) : esc(L.ui.space);
    // An open menu: its options are L objects (swapped in place) or plain strings from L.
    const k = this._choices;
    if (k) {
      const q = $('.q', this.choicesEl);
      if (q) q.textContent = retext(k.menu.prompt);
      (k.menu.options || []).forEach((o, i) => {
        const b = k.buttons[i];
        if (b) b.innerHTML = `<span class="kbd">${i + 1}</span>${esc(retext(o.text))}`;
      });
    }
    if (this._end) {
      const { E, again, credits } = this._end;
      const thanks = $('.thanks', this.endEl);
      if (thanks) thanks.textContent = retext(E.thanks);
      again.textContent = retext(E.playAgain);
      credits.textContent = retext(E.credits);
    }
  }

  // ------------------------------------------------------------- loop

  _later(secs, fn, key) {
    if (key) this._timers = this._timers.filter((t) => t.key !== key);
    this._timers.push({ left: secs, fn, key });
  }

  update(dt, raw) {
    const f = this._fade;
    if (f) {
      f.t += raw;
      const k = Math.min(1, f.t / f.dur);
      this._setFade(f.from + (f.to - f.from) * k);
      if (k >= 1) {
        this._fade = null;
        f.resolve();
      }
    }
    if (this._timers.length) {
      const due = [];
      for (const t of this._timers) if ((t.left -= raw) <= 0) due.push(t);
      if (due.length) {
        this._timers = this._timers.filter((t) => t.left > 0);
        for (const t of due) t.fn();
      }
    }
    this._updateCard(raw);
    this._updateChoices();
    this._updateDialogue(raw);
    this._updateVoiceQueue();
    this._updateDrive(raw);
    this._updateWatch(raw);
  }
}
