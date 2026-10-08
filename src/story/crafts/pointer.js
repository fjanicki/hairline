import * as THREE from 'three';

// Mouse for the crafts (docs/DESIGN.md R3.1). Alive only inside a cinematic, where the camera rig
// ignores the mouse; never takes pointer lock. Call P.update() once per frame (top of d.until), then
// read this frame's state. Events between frames are accumulated, so a fast click is never lost.

const CLICK_PX = 6;
const CLICK_S = 0.35;

export function craftPointer(ctx) {
  const canvas = ctx.renderer?.domElement || ctx.engine?.renderer?.domElement;
  const camera = ctx.camera;
  const ray = new THREE.Raycaster();
  const raw = { x: 0, y: 0, down: false, presses: 0, releases: 0, clicks: 0, dx: 0, dy: 0, wheel: 0, at: null };
  const P = {
    ndc: new THREE.Vector2(),
    down: false,
    pressed: false,
    released: false,
    click: false,
    dragX: 0,
    dragY: 0,
    wheel: 0, // whole notches this frame (-3..3)
    scrolling: false, // any wheel event this frame (a trackpad gesture's tail)
    update,
    pick,
    cursor,
    dispose,
  };
  const ndcOf = (e) => {
    const r = canvas.getBoundingClientRect();
    raw.x = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
    raw.y = -((e.clientY - r.top) / Math.max(1, r.height)) * 2 + 1;
  };
  const onDown = (e) => {
    if (e.button !== 0) return;
    ndcOf(e);
    raw.down = true;
    raw.presses++;
    raw.at = { x: e.clientX, y: e.clientY, t: performance.now(), far: false };
  };
  const onMove = (e) => {
    ndcOf(e);
    if (!raw.down) return;
    raw.dx += e.movementX ?? 0;
    raw.dy += e.movementY ?? 0;
    if (raw.at && Math.hypot(e.clientX - raw.at.x, e.clientY - raw.at.y) > CLICK_PX) raw.at.far = true;
  };
  const onUp = (e) => {
    if (e.button !== 0 || !raw.down) return;
    ndcOf(e);
    raw.down = false;
    raw.releases++;
    const a = raw.at;
    if (a && !a.far && performance.now() - a.t <= CLICK_S * 1000) raw.clicks++;
    raw.at = null;
  };
  const onWheel = (e) => {
    e.preventDefault();
    // + = toward the user (scrolling down / pulling the wheel back)
    const px = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    raw.wheel += px / 100;
    raw.scrolled = true;
  };
  const onBlur = () => {
    if (raw.down) raw.releases++;
    raw.down = false;
    raw.at = null;
  };
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  function update() {
    P.ndc.set(raw.x, raw.y);
    P.pressed = raw.presses > 0;
    P.released = raw.releases > 0;
    P.click = raw.clicks > 0;
    P.down = raw.down || (P.pressed && !P.released); // a press seen this frame counts as held
    P.dragX = raw.dx;
    P.dragY = raw.dy;
    const n = raw.wheel > 0 ? Math.floor(raw.wheel) : Math.ceil(raw.wheel);
    P.wheel = THREE.MathUtils.clamp(n, -3, 3);
    raw.wheel -= n; // keep the sub-notch remainder (trackpads)
    P.scrolling = !!raw.scrolled; // any wheel event this frame, even under a notch (a gesture's tail)
    raw.scrolled = false;
    raw.presses = raw.releases = raw.clicks = 0;
    raw.dx = raw.dy = 0;
    return P;
  }
  function pick(objects) {
    if (!objects?.length) return null;
    ray.setFromCamera(P.ndc, camera);
    const hit = ray.intersectObjects(objects, true).find((h) => h.object.visible !== false);
    return hit ? { object: hit.object, point: hit.point } : null;
  }
  function cursor(css) {
    canvas.style.cursor = css || '';
  }
  function dispose() {
    canvas.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('wheel', onWheel);
    canvas.style.cursor = '';
  }
  return P;
}
