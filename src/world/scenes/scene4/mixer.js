import * as THREE from 'three';
import { loadProp, makeCanvas } from './geo.js';
import { TINS } from '../../../story/crafts/mix.js';

// Ch4 Day 8: Odile's mixing station (docs/DESIGN.md R3.3). An enamel pot and five small tins on an
// upturned crate beside the trestles, in the bulb's pool. The pot's paint surface carries the live
// mix; a drop tilts its tin, falls, rings the surface and swirls in. Hidden until the grey beat.
// Animation runs from update(dt) (scene4's update calls it).

const POT_R = 0.08; // 16 cm across
const POT_H = 0.1;
const CAP = 18; // drops at the brim
const TIN_S = 0.68; // paint_can scan scale (about 9.5 cm tall)
const ease = (k) => k * k * (3 - 2 * k);

/** A soft spiral streak (alpha), for the stir swirl. */
function swirlTexture() {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  g.translate(64, 64);
  g.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const t = i / 90;
    const a = t * Math.PI * 3.2;
    const r = 6 + t * 54;
    g.strokeStyle = `rgba(255,255,255,${0.85 * (1 - t) ** 0.6})`;
    g.lineWidth = 9 * (1 - t) + 2;
    g.beginPath();
    g.arc(0, 0, r, a, a + 0.18);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/**
 * buildMixer(ctx, group, {pos: [x, z], ry}) -> {pot, tins[5], setSwatch(hex), pour(i, n), tipOut(),
 * setLevel(n), focus, top, group, ready, visible, update(dt), hexNow()}
 */
export function buildMixer(ctx, parent, { pos = [1.9, -0.3], ry = 0 } = {}) {
  const group = new THREE.Group();
  group.name = 'mixer';
  group.position.set(pos[0], 0, pos[1]);
  group.rotation.y = ry;
  group.visible = false;
  parent.add(group);

  const top = new THREE.Group(); // the crate's top surface (y set once the crates load)
  group.add(top);

  // ---- the pot: chipped cream enamel outside, a dark rim, paint inside
  const enamel = new THREE.MeshStandardMaterial({ color: '#cfc8b6', roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide });
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(POT_R, POT_R * 0.86, POT_H, 28, 1, true).translate(0, POT_H / 2, 0), enamel);
  shell.castShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(POT_R, 0.004, 6, 32).rotateX(Math.PI / 2).translate(0, POT_H, 0), new THREE.MeshStandardMaterial({ color: '#2a2a2c', roughness: 0.5 }));
  // A worn, darker bottom, so an empty pot never reads as a pot of white.
  const floor = new THREE.Mesh(new THREE.CircleGeometry(POT_R * 0.86, 24).rotateX(-Math.PI / 2).translate(0, 0.004, 0), new THREE.MeshStandardMaterial({ color: '#2c3034', emissive: '#3a3d40', roughness: 0.6 }));
  // Wet paint that reads in its true colour under the tungsten bulb: nearly all self-lit and outside
  // the tone curve (the hue is what the player judges), a touch lit (the gloss and the bulb's glint).
  // CAST undoes the workshop grade's warm tint and shadow lift (measured on rendered greys).
  const LIT = 0.1;
  const CAST = new THREE.Color(0.8, 0.94, 1.08);
  const trueColour = (m, c) => {
    m.color.copy(c).multiplyScalar(LIT);
    m.emissive.copy(c).multiplyScalar(1 - LIT).multiply(CAST);
    m.toneMapped = false;
  };
  const paintMat = new THREE.MeshStandardMaterial({ color: '#8d877c', roughness: 0.2, metalness: 0 });
  const paintCol = new THREE.Color('#8d877c');
  trueColour(paintMat, paintCol);
  const paint = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), paintMat);
  paint.name = 'mix-paint';
  paint.visible = false;
  // Ripple ring and the swirl ride just above the paint.
  const rippleMat = new THREE.MeshBasicMaterial({ color: '#fff8ea', transparent: true, opacity: 0, depthWrite: false, fog: false });
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2), rippleMat);
  ripple.visible = false;
  const swirlMat = new THREE.MeshStandardMaterial({ color: '#ffffff', alphaMap: swirlTexture(), transparent: true, opacity: 0, roughness: 0.2, depthWrite: false });
  const swirl = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), swirlMat);
  swirl.visible = false;
  const pot = new THREE.Group();
  pot.name = 'mix-pot';
  pot.position.set(0, 0, 0.075);
  pot.add(shell, rim, floor, paint, ripple, swirl);
  for (const m of [ripple, swirl, paint]) m.userData.noOcclude = true;
  top.add(pot);

  // A falling drop (one, reused).
  const dropMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2 });
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.007, 10, 8), dropMat);
  drop.visible = false;
  top.add(drop);

  // ---- five small open tins in a row behind the pot
  const tins = TINS.map((t, i) => {
    const g = new THREE.Group();
    g.name = `tin-${t.id}`;
    g.userData.tin = i;
    g.position.set((i - 2) * 0.105, 0, -0.115);
    const discMat = new THREE.MeshStandardMaterial({ roughness: 0.3 });
    trueColour(discMat, new THREE.Color(t.color));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.056 * TIN_S, 18).rotateX(-Math.PI / 2), discMat);
    disc.position.y = 0.138 * TIN_S;
    disc.userData.tin = i;
    g.add(disc);
    g.userData.disc = disc;
    // A fat invisible pick target (so a click near the tin counts).
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 8).translate(0, 0.065, 0), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.tin = i;
    hit.userData.noOcclude = true;
    g.add(hit);
    g.userData.hit = hit;
    top.add(g);
    return g;
  });

  // ---- the crate (two stacked scans) and the tin bodies, async
  const ready = (async () => {
    const [crateA, crateB, can] = await Promise.all([
      loadProp(ctx.assets, 'crate_wood', { height: 0.36 }),
      loadProp(ctx.assets, 'crate_wood', { height: 0.36, castShadow: false }),
      loadProp(ctx.assets, 'paint_can', { castShadow: false }),
    ]);
    crateA.rotation.y = 0.04;
    crateB.position.y = 0.36;
    crateB.rotation.y = Math.PI - 0.06; // upturned: the top crate the other way round
    group.add(crateA, crateB);
    top.position.y = 0.36 + (crateB.userData.size?.y ?? 0.36);
    // Dull the scan (it is fully metallic) and share one clone of its material across the five.
    let mat = null;
    for (const g of tins) {
      const c = can.clone(true);
      c.scale.setScalar(TIN_S);
      c.traverse((o) => {
        if (!o.isMesh) return;
        if (!mat) {
          mat = o.material.clone();
          mat.metalness = 0.2;
          mat.roughness = 0.9;
          mat.color.set('#cfc6b8');
        }
        o.material = mat;
        o.userData.tin = g.userData.tin;
      });
      g.add(c);
    }
  })();

  // ---- live state
  const st = {
    level: 0, // drops in the pot (shown)
    levelTarget: 0,
    from: new THREE.Color('#8d877c'),
    to: new THREE.Color('#8d877c'),
    k: 1, // colour ease 0..1 over 0.4 s
    hex: null,
    ripple: 1,
    swirl: 1,
    swirlSpin: 0,
    tilts: TINS.map(() => 0), // seconds left in each tin's tilt
    drops: [], // {tin, t}
    slosh: 0,
    wobble: 0,
  };
  const surfaceY = (n) => 0.012 + (POT_H - 0.022) * Math.min(1, n / CAP);
  const applyLevel = () => {
    const n = st.level;
    paint.visible = n > 0.05;
    const y = surfaceY(n);
    const r = POT_R * 0.86 + (POT_R - POT_R * 0.86) * (y / POT_H) - 0.002;
    paint.position.y = y;
    paint.scale.setScalar(r);
    ripple.position.y = y + 0.0015;
    swirl.position.y = y + 0.001;
    swirl.scale.setScalar(r * 0.95);
  };
  applyLevel();

  const api = {
    group,
    pot,
    tins,
    top,
    ready,
    /** The focus target for mood.focusOn (the pot). */
    focus: pot,
    /** Pick targets for P.pick(): one fat invisible cylinder per tin (userData.tin = its index). */
    pickables: tins.map((g) => g.userData.hit),
    get visible() {
      return group.visible;
    },
    set visible(v) {
      group.visible = v;
    },
    /** Ease the paint to `hex` over 0.4 s with a stir swirl (null = keep). */
    setSwatch(hex, { snap = false } = {}) {
      if (!hex) return;
      st.hex = hex;
      st.from.copy(paintCol);
      st.to.set(hex);
      st.k = snap ? 1 : 0;
      if (snap) trueColour(paintMat, paintCol.copy(st.to));
    },
    hexNow: () => st.hex,
    /** Paint level in drops (0..18). */
    setLevel(n, { snap = false } = {}) {
      st.levelTarget = Math.max(0, Math.min(CAP, n));
      if (snap) {
        st.level = st.levelTarget;
        applyLevel();
      }
    },
    /** Sound hook (crafts/mixer.js): fn(tin) when a drop lands in the pot. */
    onLand: null,
    /** Tin i tilts for 0.35 s and `n` drops fall into the pot (the ripple and swirl follow). */
    pour(i, n = 1) {
      st.tilts[i] = 0.35 + Math.min(0.6, (n - 1) * 0.12);
      for (let k = 0; k < Math.min(n, 3); k++) st.drops.push({ tin: i, t: -0.12 - k * 0.12 });
    },
    /** Empty the pot (the level falls, a slosh wobble). */
    tipOut() {
      st.levelTarget = 0;
      st.slosh = 0.45;
    },
    update(dt) {
      if (!group.visible || !(dt > 0)) return;
      // Level eases (a drop is quick, tipping out is a pour).
      const rate = st.levelTarget < st.level ? 22 : 8;
      if (Math.abs(st.level - st.levelTarget) > 0.01) {
        st.level += (st.levelTarget - st.level) * (1 - Math.exp(-rate * dt));
        applyLevel();
      }
      // Colour.
      if (st.k < 1) {
        st.k = Math.min(1, st.k + dt / 0.4);
        trueColour(paintMat, paintCol.copy(st.from).lerp(st.to, ease(st.k)));
      }
      // Tins tilt toward the pot and back.
      tins.forEach((g, i) => {
        st.tilts[i] = Math.max(0, st.tilts[i] - dt);
        const target = st.tilts[i] > 0 ? 0.55 : 0;
        g.rotation.x += (target - g.rotation.x) * (1 - Math.exp(-22 * dt)); // +x tips the lip toward +z, the pot
        g.position.y = g.rotation.x * 0.02;
      });
      // Drops fall from the tin's lip to the surface; each lands as a ripple and a swirl.
      for (let k = st.drops.length - 1; k >= 0; k--) {
        const dr = st.drops[k];
        dr.t += dt;
        if (dr.t < 0) continue;
        const tin = tins[dr.tin];
        const fall = 0.22;
        const u = Math.min(1, dr.t / fall);
        const sx = tin.position.x * (1 - u) + pot.position.x * u * 0.4;
        const sz = tin.position.z + 0.05 + (pot.position.z - tin.position.z - 0.05) * u;
        const sy = 0.12 * (1 - u * u) + surfaceY(st.level) * u * u;
        drop.visible = true;
        drop.position.set(sx, sy, sz);
        dropMat.color.set(TINS[dr.tin].color);
        if (u >= 1) {
          st.drops.splice(k, 1);
          drop.visible = st.drops.some((x) => x.t >= 0);
          st.ripple = 0;
          st.swirl = 0;
          swirlMat.color.set(TINS[dr.tin].color);
          try {
            api.onLand?.(dr.tin);
          } catch (err) {
            console.error('[mixer] onLand failed', err);
          }
        }
      }
      // Ripple: a ring that spreads across the surface and fades.
      if (st.ripple < 1) {
        st.ripple = Math.min(1, st.ripple + dt / 0.55);
        ripple.visible = paint.visible;
        const r = (0.15 + 0.85 * st.ripple) * paint.scale.x;
        ripple.scale.setScalar(r);
        rippleMat.opacity = 0.55 * (1 - st.ripple);
      } else ripple.visible = false;
      // Swirl: the drop's colour streaks round and blends in.
      if (st.swirl < 1) {
        st.swirl = Math.min(1, st.swirl + dt / 0.6);
        swirl.visible = paint.visible;
        st.swirlSpin += dt * 7 * (1 - st.swirl);
        swirl.rotation.y = -st.swirlSpin;
        swirlMat.opacity = 0.75 * (1 - ease(st.swirl));
      } else swirl.visible = false;
      // Slosh: the pot rocks as it's tipped out.
      if (st.slosh > 0) {
        st.slosh = Math.max(0, st.slosh - dt);
        st.wobble = Math.sin(st.slosh * 30) * st.slosh * 0.35;
      } else st.wobble *= 1 - Math.min(1, dt * 10);
      pot.rotation.z = st.wobble;
    },
  };
  return api;
}
