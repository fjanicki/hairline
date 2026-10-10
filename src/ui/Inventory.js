import './inventory.css';
import { L } from '../story/script.js';
import { onLangChange } from '../story/i18n.js';
import { keyText } from '../core/KeyLabels.js';
import { pocket, caseFile, onItems, ITEMS, itemIcon, itemText, itemName, fillItem, personName, paintIcon } from '../story/items.js';

// The pocket (docs/SCRIPT-R4.md §1): a strip of paper tags at the bottom left, the held item, the item
// toasts, and the notebook's L’AFFAIRE page (filled from story/items.js caseFile through ui.notebook.caseSet).
//
// Keys (captured before Input, so they don't also walk Hugo or pause the game):
//   {Tab} opens or closes the strip (in play, with no dialogue or menu up); while it is open the arrow
//   keys move along it, {Enter} holds the item under the pencil (or puts it away), {Escape} closes it.
//   With an item held and the strip closed, {Escape} puts it away.
// Mouse: the pocket button opens it; a click on a tag holds it, a second click puts it away; the wheel
// over the strip moves along it. Opening the strip releases the pointer lock (no pause) so the cursor is
// free. Nothing here blocks the story: the main path uses items by itself (Hotspots: required items).

const el = (tag, cls, parent, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const TOAST_SECS = 1.6; // SCRIPT-R4 §1.2
const ARROWS = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

/** The pocket button's drawing: a jeans pocket with its stitching. */
function drawPocket(p) {
  const out = [
    [12, 12],
    [52, 12],
    [50, 40],
    [32, 54],
    [14, 40],
  ];
  p.wash('#5a6f8f').path(out, true).wash(null);
  p.dash(
    [
      [16, 18],
      [48, 18],
      [46.5, 38],
      [32, 49],
      [17.5, 38],
      [16, 18],
    ],
    2.6,
    2.2,
  );
  p.line(12, 12, 52, 12);
}

export class Inventory {
  /** deps: { ui, input, rig (CameraRig: the pointer lock), getDirector } */
  constructor({ ui, input, rig = null, getDirector }) {
    Object.assign(this, { ui, input, rig, getDirector });
    this.updateWhilePaused = true; // closes and hides under the pause menu
    this.isOpen = false;
    this.focus = 0;
    this._list = [];
    this._toasts = [];
    this._toast = null;
    this._mouse = null;

    const hud = ui.hud;
    this.el = el('div', 'pocket', hud);
    this.btn = el('button', 'pocket-btn', this.el, '<img class="pocket-ico" alt=""><img class="pocket-hold" alt=""><span class="pocket-n"></span><span class="kbd"></span>');
    this.btn.type = 'button';
    this.btn.querySelector('.pocket-ico').src = paintIcon(drawPocket, 96, 'pocket');
    this.strip = el(
      'div',
      'pocket-strip',
      this.el,
      '<div class="pocket-info"><div class="pi-name"></div><div class="pi-desc"></div></div><div class="pocket-slots"></div><button type="button" class="pocket-away"></button>',
    );
    this.slots = this.strip.querySelector('.pocket-slots');
    this.awayBtn = this.strip.querySelector('.pocket-away');
    this.heldEl = el('div', 'pocket-held', hud, '<img alt=""><span></span>');
    this.toastEl = el('div', 'pocket-toast', hud, '<img alt=""><span></span>');
    this.cursorEl = el('img', 'pocket-cursor', ui.root);
    this.cursorEl.alt = '';

    this.btn.addEventListener('click', () => (this.isOpen ? this.close() : this._canOpen() && this.open()));
    this.awayBtn.addEventListener('click', () => pocket.select(null));
    this.slots.addEventListener('click', (e) => {
      const b = e.target.closest?.('.pocket-slot');
      if (!b) return;
      this.focus = +b.dataset.i;
      this.choose();
    });
    this.slots.addEventListener('mouseover', (e) => {
      const b = e.target.closest?.('.pocket-slot');
      if (b && +b.dataset.i !== this.focus) this._setFocus(+b.dataset.i);
    });
    this.strip.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        // One tag per mouse notch; a trackpad's small deltas add up to one.
        this._wheel = (this._wheel || 0) + (e.deltaMode ? e.deltaY * 40 : e.deltaY);
        if (Math.abs(this._wheel) >= 50) {
          this.move(Math.sign(this._wheel));
          this._wheel = 0;
        }
      },
      { passive: false },
    );
    // Capture on document: before Input's window listener, so these keys never reach it.
    document.addEventListener('keydown', (e) => this._key(e), true);
    // input.press() (tests): no event to stop, but the pocket answers the same keys.
    input?.onKey((code, e) => {
      if (!e) this._handle(code, false);
    });
    window.addEventListener('mousemove', (e) => (this._mouse = { x: e.clientX, y: e.clientY }));
    onItems((e) => this._onItems(e));
    onLangChange(() => this._sync());
    this._sync();
  }

  // ------------------------------------------------------------- state

  _canAct() {
    const d = this.getDirector?.();
    const ui = this.ui;
    return !!d && d.state === 'play' && !ui.modal && !ui.paused && !ui.pauseEl && (ui.fadeValue ?? 0) < 0.5;
  }

  _canOpen() {
    return this._canAct() && !pocket.hidden;
  }

  _key(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (this._handle(e.code, e.repeat)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  /** One key: true if the pocket took it. */
  _handle(code, repeat) {
    if (code === 'Tab') {
      if (!this.isOpen && !this._canOpen()) return false; // Tab still moves focus in menus
      if (!repeat) this.isOpen ? this.close() : this.open();
      return true;
    }
    if (this.isOpen) {
      const dir = ARROWS[code];
      if (dir) {
        this.move(dir);
        return true;
      }
      if (code === 'Escape' || code === 'Enter' || code === 'NumpadEnter') {
        if (!repeat) code === 'Escape' ? this.close() : this.choose();
        return true;
      }
      return false;
    }
    if (code === 'Escape' && pocket.selected() && this._canAct()) {
      pocket.select(null); // put away, instead of pausing
      return true;
    }
    return false;
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    const held = this._list.indexOf(pocket.selected());
    this.focus = held >= 0 ? held : Math.min(this.focus, Math.max(0, this._list.length - 1));
    this.rig?.release?.(); // the cursor, for the tags (no pause)
    this._render();
    this.el.classList.add('open');
    this._rustle();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.remove('open');
  }

  move(dir) {
    const n = this._list.length;
    if (!this.isOpen || !n) return;
    this._setFocus((this.focus + dir + n) % n);
    this.ui.audio?.tick?.({ volume: 0.06 });
  }

  /** Hold the item under the pencil, or put it away if it is the held one. Closes the strip on a hold. */
  choose() {
    const id = this._list[this.focus];
    if (!id) return this.close();
    if (pocket.selected() === id) {
      pocket.select(null);
      return;
    }
    pocket.select(id);
    this.close();
    if (pocket.firstTime('useItem')) this.ui.hint(L.items?.hints?.useItem, 6);
  }

  _setFocus(i) {
    this.focus = i;
    for (const b of this.slots.children) b.classList.toggle('focus', +b.dataset.i === i);
    this._info();
  }

  _rustle() {
    this.ui.audio?.noise?.({ type: 'bandpass', freq: 2200, q: 0.7, dur: 0.14, volume: 0.035, tail: 0.08 });
  }

  // ------------------------------------------------------------- events

  _onItems(e) {
    const U = L.items?.ui || {};
    switch (e.type) {
      case 'add':
        if (e.toast) this._toastOf(e.id, fillItem(U.gained, e.id, { name: true }));
        if (pocket.firstTime('pocket')) this.ui.hint(L.items?.hints?.pocket, 5);
        break;
      case 'remove':
        if (e.toast) this._toastOf(e.id, fillItem(U.lost, e.id, { name: true }));
        break;
      case 'give':
        this._toastOf(e.id, fillItem(U.given, e.id, { name: true, who: personName(e.to) }));
        break;
      case 'full':
        this._toastOf(e.id, U.full);
        break;
      case 'case:clue':
        if (e.toast) this._toastOf(e.id, String(L.caseFile?.ui?.new || '').replace('{clue}', itemName(e.id)));
        break;
      case 'case:note':
        if (e.toast) this._toastOf(e.id, String(L.caseFile?.ui?.updated || '').replace('{clue}', itemName(e.id)));
        break;
      default:
        break;
    }
    if (e.type === 'restore' || e.type === 'clear') this.close();
    this._sync(e);
  }

  /** Re-read the pocket and the case file; e: the event that changed them (write-on for a new clue). */
  _sync(e = null) {
    this._list = pocket.list();
    if (this.focus >= this._list.length) this.focus = Math.max(0, this._list.length - 1);
    this._render();
    this._renderHeld();
    if (!e || e.type.startsWith('case:') || e.type === 'restore') this._syncCase(e);
  }

  _syncCase(e) {
    const C = L.caseFile || {};
    const U = C.ui || {};
    const stamp = { checked: U.checked, toCheck: U.toCheck, none: U.none };
    const data = {
      open: caseFile.isOpen(),
      title: L.items?.ui?.case,
      labels: { clues: U.clues, suspects: U.suspects },
      clues: caseFile.clues().map((id) => ({ id, ...caseFile.clueText(id), icon: itemIcon(id, 64) })),
      suspects: caseFile.suspects().map((s) => {
        const T = C.suspects?.[s.as || s.id] || {};
        const why = s.later && T.whyLater ? `${T.why} ${T.whyLater}` : T.why;
        return { id: s.id, name: T.name || s.id, why, alibi: T.alibi ? String(U.alibi || '{text}').replace('{text}', T.alibi) : '', stamp: stamp[s.status] || '', status: s.status };
      }),
    };
    const write = e?.type === 'case:clue' || e?.type === 'case:note' ? e.id : null;
    this.ui.notebook.caseSet?.(data, { write, writeHead: e?.type === 'case:open' && !write });
  }

  // ------------------------------------------------------------- render

  _render() {
    const U = L.items?.ui || {};
    const held = pocket.selected();
    this.btn.querySelector('.pocket-n').textContent = this._list.length ? String(this._list.length) : '';
    this.btn.querySelector('.kbd').textContent = keyText('{Tab}', L.keyNames);
    this.btn.title = U.pocket || '';
    this.awayBtn.textContent = U.putAway || '';
    this.awayBtn.classList.toggle('show', !!held);
    if (!this.isOpen) return;
    this.slots.innerHTML = this._list
      .map((id, i) => {
        const worn = ITEMS[id]?.worn && U.worn ? `<span class="pocket-worn">${esc(U.worn)}</span>` : '';
        const cls = `pocket-slot${i === this.focus ? ' focus' : ''}${id === held ? ' held' : ''}`;
        return `<button type="button" class="${cls}" data-i="${i}" data-id="${esc(id)}" style="--tilt:${((i * 37) % 7) - 3}deg"><img src="${esc(itemIcon(id))}" alt="">${worn}</button>`;
      })
      .join('');
    this._info();
  }

  _info() {
    const id = this._list[this.focus];
    const T = id ? itemText(id) : null;
    this.strip.querySelector('.pi-name').textContent = T ? T.name : L.items?.ui?.empty || '';
    this.strip.querySelector('.pi-desc').textContent = T?.desc || '';
    if (T) {
      this.ui._log?.(T.name);
      this.ui._log?.(T.desc);
    }
  }

  _renderHeld() {
    const id = pocket.selected();
    this.el.classList.toggle('holding', !!id);
    if (!id) return;
    const src = itemIcon(id);
    this.heldEl.querySelector('img').src = src;
    this.btn.querySelector('.pocket-hold').src = src; // in hand, on the pocket
    const t = fillItem(L.items?.ui?.held, id);
    this.heldEl.querySelector('span').textContent = t;
    this.ui._log?.(t);
    this.cursorEl.src = src;
  }

  _toastOf(id, text) {
    if (!text) return;
    this._toasts.push({ icon: id ? itemIcon(id) : '', text });
    if (this._toasts.length > 4) this._toasts.shift();
  }

  // ------------------------------------------------------------- per frame

  update(_dt, raw) {
    const ui = this.ui;
    const st = this.getDirector?.()?.state;
    const hudOn = (st === 'play' || st === 'dialogue') && !ui.paused && (ui.fadeValue ?? 0) < 0.5;
    const held = pocket.selected();
    this.el.classList.toggle('show', hudOn && !pocket.hidden && this._list.length > 0);
    if (this.isOpen && !this._canOpen()) this.close();
    // « En main : … » where the prompt goes, while no prompt is up; the icon by a free cursor.
    const promptUp = ui.promptEl?.classList.contains('show');
    this.heldEl.classList.toggle('show', !!held && hudOn && st === 'play' && !promptUp && !ui.modal);
    const m = this._mouse;
    const cursor = !!held && hudOn && st === 'play' && !!m && !document.pointerLockElement;
    this.cursorEl.classList.toggle('show', cursor);
    if (cursor) this.cursorEl.style.transform = `translate(${m.x + 14}px, ${m.y + 12}px)`;
    // Toasts, one at a time.
    const t = this._toast;
    if (t) {
      t.left -= raw;
      if (t.left <= 0) {
        this.toastEl.classList.remove('show');
        this._toast = null;
      }
    } else if (this._toasts.length) {
      const n = this._toasts.shift();
      this.toastEl.querySelector('img').src = n.icon || '';
      this.toastEl.querySelector('img').style.display = n.icon ? '' : 'none';
      this.toastEl.querySelector('span').textContent = n.text;
      this.toastEl.classList.remove('show');
      void this.toastEl.offsetWidth;
      this.toastEl.classList.add('show');
      ui._log?.(n.text);
      this._toast = { left: TOAST_SECS + 0.35 };
    }
  }
}
