import * as THREE from 'three';
import { L } from './script.js';
import { remember } from './memory.js';
import { dry, reveal } from './crafts/finish.js';
import { HUGO_PANEL } from '../world/scenes/scene5/hugoPanel.js';

// Ch7 (was Ch5) PANEL pieces (DESIGN R3.7, R3.5): Hugo's own panel where the billboard was, painted inside the
// 'Ready' hotspot before the line; the line's pre-roll shot; wet paint on the ribbon and the panels.

const MOTIFS = ['wheel', 'door', 'hand'];
const PAINT_SECS = 4;
const COLOR_SECS = 1.4;
const ease = (k) => k * k * (3 - 2 * k);

/** Where the panel is (world): the shot from the street looks here. */
export const panelLook = (W) => [W.wallX, HUGO_PANEL.y0 + 0.6, HUGO_PANEL.z];

/**
 * The beat: Odile offers the spot, a choice of motif, the street shot while the bands go on (grey,
 * then colour), the reveal, Odile's line. Resolves the motif. A skip picks the door and paints it.
 * fade(to, dur) and followDefault(snap) are ch7's helpers.
 */
export async function hugoPanelBeat(ctx, d, W, { fade, followDefault }) {
  const { cam, audio, player } = ctx;
  const T = L.ch7.panel;
  const panel = W.hugoPanel;
  await d.say(T.ask);
  // A skip takes the menu's 'correct' option: the door (no right answer here, just the canonical one).
  const pick = await d.choose({ ...T.menu, options: T.menu.options.map((o, i) => (i === 1 ? { ...o, correct: true } : o)) });
  const motif = MOTIFS[typeof pick === 'number' ? pick : 1] ?? 'door';
  remember('panel', motif);
  if (!panel) {
    await d.say(T.after[motif]);
    return motif;
  }
  await d.cinematic(
    async () => {
      await fade(1, 0.5);
      // From the street: Hugo is up the ladder, off the top of the frame.
      cam.set({ pos: [0.5, 1.7, -12.5], look: panelLook(W), fov: 40 });
      panel.setColor(0);
      panel.paint(motif, 0);
      await d.wait(0.15);
      await fade(0, 0.6);
      audio.sfx('creak_wood', { volume: 0.3, alt: 'creak_wood_alt', fallback: false }); // the ladder takes his weight
      await d.say(T.stage);
      // Six bands, one scrape each; the paint goes on wet and dries over 12 s.
      const drying = dry(ctx, panel.material, { secs: 12 });
      let t = 0;
      let band = -1;
      const r = await d.until((dt) => {
        t += dt;
        const p = Math.min(1, t / PAINT_SECS);
        panel.paint(motif, p);
        const k = Math.min(5, Math.floor(p * 6));
        if (k !== band) {
          band = k;
          audio.sfx('brush_stroke', { volume: 0.4, fallback: (a) => a.scrape({ volume: 0.16 }) });
        }
        return p >= 1;
      });
      panel.paint(motif, 1);
      if (r === 'skipped') {
        drying.stop();
        panel.setColor(1);
      } else {
        t = 0;
        await d.until((dt) => {
          t += dt;
          const k = Math.min(1, t / COLOR_SECS);
          panel.setColor(ease(k));
          return k >= 1;
        });
      }
      panel.setColor(1);
      d.hope(0.78, 2);
      await reveal(ctx, d, { hold: 1.2, pulse: 0.05 });
      await fade(1, 0.4);
      followDefault(true);
      player.face(W.chair?.seat?.x ?? W.spots.odileChair[0], W.chair?.seat?.z ?? W.spots.odileChair[1]);
      await d.wait(0.1);
      await fade(0, 0.5);
    },
    { letterbox: false },
  );
  await d.say(T.after[motif]);
  return motif;
}

/**
 * The line's opening shot: from the line camera's own position, looking up at Hugo's panel. Call it
 * right after the staging has snapped the follow camera (the shot it ends on); it returns run(), which
 * eases down to that shot over `secs` (gated) and hands back to `follow`. Null without a panel.
 */
export function linePreroll(ctx, W) {
  const { cam } = ctx;
  if (!W.hugoPanel?.mesh.visible) return null;
  const pos = cam.pos.clone();
  const look = cam.lookAt.clone();
  const fov = cam.fovValue;
  cam.set({ pos, look: panelLook(W), fov });
  return async (d, follow, secs = 1.6) => {
    await d.gate(cam.tween({ pos, look, fov }, secs), () => (cam.set({ pos, look, fov }), false));
    follow();
  };
}

/** The ribbon is wet while it goes on (#d9a441 x 0.82); after the line it eases to its colour over 10 s. */
export function wetRibbon(ctx, ribbon) {
  if (!ribbon?.color) return { dry() {} };
  const base = ribbon.color.clone();
  ribbon.color.copy(base).multiplyScalar(0.82);
  return {
    dry() {
      ribbon.color.copy(base);
      return dry(ctx, ribbon, { secs: 10, darken: 0.18 });
    },
  };
}

/**
 * Each mural panel goes wet (roughness 0.35) as the line first passes under it (its colour control's
 * k leaves 0), and dries back to its own roughness over 10 s. Returns stop().
 */
export function wetPanels(ctx, panels, { wet = 0.35, secs = 10 } = {}) {
  const items = panels.map((p) => {
    const mats = [];
    p.mesh?.traverse?.((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (typeof m?.roughness === 'number') mats.push({ m, dryR: m.roughness });
    });
    return { p, mats, t: -1 };
  });
  let off = ctx.world.onUpdate((dt) => {
    let busy = false;
    for (const it of items) {
      if (it.t < 0) {
        if ((it.p.k ?? 0) > 0) it.t = 0;
        else {
          busy = true;
          continue;
        }
      }
      if (it.t > secs) continue;
      it.t += dt;
      const e = ease(Math.min(1, it.t / secs));
      for (const { m, dryR } of it.mats) m.roughness = THREE.MathUtils.lerp(wet, dryR, e);
      busy = true;
    }
    if (!busy) stop();
  });
  const stop = () => {
    off?.();
    off = null;
    for (const it of items) for (const { m, dryR } of it.mats) m.roughness = dryR;
  };
  return { stop };
}
