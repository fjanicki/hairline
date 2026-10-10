import * as THREE from 'three';
import { PEG, BACK_Z, BENCH } from '../world/scenes/scene4/layout.js';

// Ch5 helpers that are not the story itself (docs/SCRIPT-R4.md §6):
//   workshopProps(W)        the spoke key back in its outline on the pegboard and the folded rags under it
//   segmentScreen(ctx, d)   the STRIDE segment screen on Hugo's phone (Week 3, Bastien): 4 s or {KeyE}

// ------------------------------------------------------------------ the workshop: spoke key and rags

// The pegboard's empty spanner outline (scene4/textures.js PEG_TOOLS, « the missing one »): u 0.82, v 0.55.
const KEY_UV = [0.82, 0.55];

/** The spoke key on its outline and the rags on the bench below. Returns { key, rags, setKey(on), setRags(on) }. */
export function workshopProps(W) {
  // scene4 (R4) has the spoke key on its own outline (W.setSpokeKey, W.peg.spokeKey): use it. Older builds
  // without it get a stand-in key on the empty spanner outline.
  const own = typeof W.setSpokeKey !== 'function';
  const key = new THREE.Group();
  key.name = 'spoke-key';
  let x = PEG.x - PEG.w / 2 + KEY_UV[0];
  let y = PEG.y + PEG.h / 2 - KEY_UV[1];
  if (own) {
    const chrome = new THREE.MeshStandardMaterial({ color: '#b9bcbf', metalness: 0.85, roughness: 0.3 });
    // A flat steel bar with a ring at each end (the slots cut in): a classic spoke key, side on.
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.006), chrome);
    key.add(bar);
    for (const yy of [-0.105, 0.105]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.007, 6, 16), chrome);
      ring.position.y = yy;
      key.add(ring);
    }
    key.position.set(x, y + 0.02, BACK_Z + 0.03 + 0.016);
    key.rotation.z = 0.05;
    key.traverse((m) => m.isMesh && ((m.castShadow = false), (m.userData.noOcclude = true)));
    W.group.add(key);
  } else if (W.peg?.spokeKey) {
    x = W.peg.spokeKey.x;
    y = W.peg.spokeKey.y;
  }

  // A stack of four rags folded in four, on the bench under the pegboard.
  const rags = new THREE.Group();
  rags.name = 'rags';
  const tones = ['#b9a98c', '#8d8f8a', '#a35d45', '#c8c2b2'];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.022, 0.15), new THREE.MeshStandardMaterial({ color: tones[i], roughness: 1 }));
    m.position.set((i % 2 ? 0.008 : -0.006) + i * 0.002, 0.011 + i * 0.022, (i % 2 ? -0.006 : 0.005));
    m.rotation.y = (i - 1.5) * 0.06;
    rags.add(m);
  }
  rags.position.set(x + 0.3, RAGS_Y, BACK_Z + 0.32);
  rags.traverse((m) => m.isMesh && ((m.castShadow = true), (m.userData.noOcclude = true)));
  W.group.add(rags);

  key.visible = own;
  if (!own) W.setSpokeKey(true); // back in its outline (Week 2 on)
  return {
    key,
    rags,
    /** The world point of the spoke key (for a close shot). */
    keyAt: new THREE.Vector3(x, y, BACK_Z + 0.05),
    setKey(on) {
      if (own) key.visible = !!on;
      else W.setSpokeKey(on);
    },
    setRags(on) {
      rags.visible = !!on;
    },
  };
}
const RAGS_Y = BENCH.top; // Odile's bench top under the pegboard

// ------------------------------------------------------------------ the STRIDE segment screen

const CSS = `
.c5-seg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 24;
  pointer-events: auto; opacity: 0; transition: opacity .35s ease; background: radial-gradient(ellipse at center, rgba(0,0,0,.25), rgba(0,0,0,.6)); }
.c5-seg.show { opacity: 1; }
.c5-seg .ph { width: min(320px, 78vw); aspect-ratio: 9 / 18.5; max-height: 82vh; border-radius: 34px; background: #0b0c0d;
  border: 2px solid #2a2c2e; box-shadow: 0 18px 60px rgba(0,0,0,.6), inset 0 0 0 7px #121315; padding: 16px; box-sizing: border-box;
  display: flex; flex-direction: column; transform: translateY(14px) rotate(-1.5deg); transition: transform .45s cubic-bezier(.2,.8,.2,1); }
.c5-seg.show .ph { transform: none; }
.c5-seg .scr { flex: 1; border-radius: 22px; background: linear-gradient(180deg, #121417, #0d0f10); overflow: hidden; position: relative;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; color: #e8eae6; padding: 22px 18px; display: flex; flex-direction: column; gap: 10px; }
.c5-seg .crack { position: absolute; inset: 0; pointer-events: none; opacity: .35;
  background: linear-gradient(128deg, transparent 18%, rgba(255,255,255,.3) 18.2%, transparent 18.6%),
              linear-gradient(58deg, transparent 9%, rgba(255,255,255,.22) 9.2%, transparent 9.5%); }
.c5-seg .app { font-size: 11px; letter-spacing: .2em; color: #c6f432; font-weight: 700; }
.c5-seg .ttl { font-size: 13px; letter-spacing: .18em; color: #9aa0a0; }
.c5-seg .nm { font-size: 15px; line-height: 1.3; color: #fff; padding-bottom: 8px; border-bottom: 1px solid #2c3033; }
.c5-seg .lab { font-size: 10px; letter-spacing: .16em; color: #8a9090; margin-top: 4px; }
.c5-seg .leg { font-size: 34px; font-weight: 700; color: #c6f432; letter-spacing: .04em; line-height: 1; }
.c5-seg .st { font-size: 13px; color: #d9dcd6; }
.c5-seg .row { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
.c5-seg .row b { color: #fff; font-weight: 600; }
.c5-seg .sec { font-size: 12px; color: #9aa0a0; padding-top: 8px; border-top: 1px solid #2c3033; }
.c5-seg .you { margin-top: auto; font-size: 12px; color: #c6f432; opacity: .85; line-height: 1.35; }
`;
let styled = false;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * The STRIDE segment screen (SCRIPT-R4 §6.3, `ch5.week3.segment`): Hugo's cracked phone over the street, for
 * 4 s or until {KeyE} / a click. Gated (skip closes it). T: L.ch5.week3.segment.
 */
export async function segmentScreen(ctx, d, T, { secs = 4, appName = 'STRIDE' } = {}) {
  if (!styled) {
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    styled = true;
  }
  const host = ctx.ui?.root || document.querySelector('#ui') || document.body;
  const el = document.createElement('div');
  el.className = 'c5-seg';
  el.innerHTML = `<div class="ph"><div class="scr"><div class="crack"></div>
    <div class="app">${esc(appName)}</div>
    <div class="ttl">${esc(T.title)}</div>
    <div class="nm">${esc(T.name)}</div>
    <div class="lab">${esc(T.legendLabel)}</div>
    <div class="leg">${esc(T.legend)}</div>
    <div class="st">${esc(T.legendStat)}</div>
    <div class="row"><span>${esc(T.lastLabel)}</span><b>${esc(T.last)}</b></div>
    <div class="row"><span>${esc(T.paceLabel)}</span><b>${esc(T.pace)}</b></div>
    <div class="sec">${esc(T.second)}</div>
    <div class="you">${esc(T.you)}</div>
  </div></div>`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  let clicked = false;
  el.addEventListener('pointerdown', () => (clicked = true));
  ctx.audio?.sfx('stride_alert', { volume: 0.3, fallback: false });
  const wasFrozen = ctx.player.frozen;
  ctx.player.frozen = true;
  let t = 0;
  try {
    await d.until((dt) => {
      t += dt;
      return t >= secs || clicked || (t > 0.5 && ctx.input?.pressed?.has?.('KeyE'));
    });
  } finally {
    ctx.player.frozen = wasFrozen;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }
}
