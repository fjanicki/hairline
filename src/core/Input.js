// Keyboard input by KeyboardEvent.code.
// `pressed` holds the codes pressed since the previous frame and stays valid for
// the whole frame, including promise continuations that run right after it.
// `enabled=false` silences gameplay queries (axes/isDown/wasPressed) but not the
// raw sets, so UI (dialogue, cards) keeps working during cutscenes.

const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Set();
    this.pressTime = new Map(); // code -> performance.now() of the last keydown
    this.enabled = true;
    this._next = new Set();
    this._synthetic = new Map(); // code -> active synthetic hold count
    this._listeners = [];

    target.addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this._press(e.code, e.timeStamp || performance.now());
      for (const fn of this._listeners) fn(e.code, e);
    });
    target.addEventListener('keyup', (e) => {
      if (!this._synthetic.get(e.code)) this.down.delete(e.code);
    });
    window.addEventListener('blur', () => {
      for (const c of [...this.down]) if (!this._synthetic.get(c)) this.down.delete(c);
    });
  }

  _press(code, t = performance.now()) {
    this.down.add(code);
    this._next.add(code);
    this.pressTime.set(code, t);
  }

  /** Raw keydown listener (fires immediately, even while paused). Returns off(). */
  onKey(fn) {
    this._listeners.push(fn);
    return () => {
      const i = this._listeners.indexOf(fn);
      if (i >= 0) this._listeners.splice(i, 1);
    };
  }

  /** Called by the engine at the start of every frame. */
  beginFrame() {
    this.pressed = this._next;
    this._next = new Set();
  }

  /** Movement axes, world-relative. W/Up: z=-1, S/Down: z=+1, A/Left: x=-1, D/Right: x=+1. */
  axes() {
    if (!this.enabled) return { x: 0, z: 0 };
    const d = this.down;
    const x = (d.has('KeyD') || d.has('ArrowRight') ? 1 : 0) - (d.has('KeyA') || d.has('ArrowLeft') ? 1 : 0);
    const z = (d.has('KeyS') || d.has('ArrowDown') ? 1 : 0) - (d.has('KeyW') || d.has('ArrowUp') ? 1 : 0);
    return { x, z };
  }

  isDown(code) {
    return this.enabled && this.down.has(code);
  }

  wasPressed(code) {
    return this.enabled && this.pressed.has(code);
  }

  /** Removes a press so later systems in this frame do not also react to it. */
  consume(code) {
    this.pressed.delete(code);
  }

  get shift() {
    return this.isDown('ShiftLeft') || this.isDown('ShiftRight');
  }

  /** performance.now() timestamp of the latest keydown of `code` (or undefined). */
  lastPress(code) {
    return this.pressTime.get(code);
  }

  /** Synthetic key press for tests: visible in `pressed` for exactly one frame. */
  press(code) {
    this._next.add(code);
    this.pressTime.set(code, performance.now());
    for (const fn of this._listeners) fn(code, null);
  }

  /** Synthetic hold for tests/debug: key is down for `ms`, with a press edge at the start. */
  hold(code, ms = 500) {
    this._synthetic.set(code, (this._synthetic.get(code) || 0) + 1);
    this._press(code);
    for (const fn of this._listeners) fn(code, null);
    return new Promise((resolve) => {
      setTimeout(() => {
        const n = (this._synthetic.get(code) || 1) - 1;
        if (n <= 0) {
          this._synthetic.delete(code);
          this.down.delete(code);
        } else this._synthetic.set(code, n);
        resolve();
      }, ms);
    });
  }
}
