import * as THREE from 'three';
import { pointLight, canvasTexture, rng as seeded } from '../../build.js';
import { Batch, cbox, cyl, rod, noOcclude } from './kit.js';
import { SIDEWALK_Y } from './street.js';
import { BENCH_FIXED } from './fixtures.js';
import { slipperPrintTexture } from './r4art.js';

// The Night Fixer's work on Rue des Tanneurs (R4), each with a before / after state the chapters set
// week by week (docs/SCRIPT-R4.md §9.1): Mme Benali's shutter (rusty rails that scream -> oiled), the
// bench (three rotten slats -> three new 52 cm slats in Bleu Durand), Gérard's neon (a taped wire
// that flickers -> a neat new cable), the CYCLES DURAND card (scene2/durand.js). Plus the bakery at
// 4 a.m. (shutter half up, the glow, a floured board on a trestle) and the sawdust slipper print on
// No. 14's doorstep.

export const BLEU_DURAND = '#7590aa'; // faded, powdery (the tin is #5f86a8)

/**
 * The bench's three replaced slots. seat: addBench's return. Returns { group, set(fixed) }:
 * before = one slat gone, one snapped and sagging, one rotten; after = three 52 cm slats in blue.
 */
export function benchSlats(seat, M) {
  const group = new THREE.Group();
  group.name = 'bench-slats';
  const old = new Batch();
  const fresh = new Batch();
  const rot = new THREE.MeshStandardMaterial({ color: '#3b332b', roughness: 0.95 });
  const blue = new THREE.MeshStandardMaterial({ color: BLEU_DURAND, roughness: 0.92 });
  old.material('timber', M.timber.material).material('rot', rot);
  fresh.material('blue', blue);
  const w = seat.pitch - 0.014;
  const [s0, s1, s2] = BENCH_FIXED.map((i) => seat.slot(i));
  // s0: gone (two rusty screw stubs on the rails). s1: snapped, both halves sagging into the gap.
  old.add('timber', cbox(0.24, 0.034, w), { pos: [s1[0] - 0.13, s1[1] - 0.03, s1[2]], rot: [0, 0, -0.24] });
  old.add('timber', cbox(0.24, 0.034, w), { pos: [s1[0] + 0.13, s1[1] - 0.03, s1[2]], rot: [0, 0, 0.24] });
  // s2: rotten, black and short, dropped a centimetre, skewed.
  old.add('rot', cbox(0.4, 0.03, w * 0.85), { pos: [s2[0] + 0.04, s2[1] - 0.012, s2[2]], rot: [0, 0.06, 0.02] });
  for (const dx of [-0.19, 0.19]) old.add('rot', cyl(0.006, 0.006, 0.02, 5), { pos: [s0[0] + dx, s0[1] - 0.02, s0[2]] });
  // After: three new slats, 52 cm (a centimetre proud of the old 50 each side), painted.
  for (const s of [s0, s1, s2]) fresh.add('blue', cbox(0.52, 0.036, w), { pos: s });
  const before = old.build('bench-old');
  const after = fresh.build('bench-new');
  group.add(before, after);
  noOcclude(group);
  let fixed = false;
  const set = (v) => {
    fixed = !!v;
    before.visible = !fixed;
    after.visible = fixed;
  };
  set(false);
  return {
    group,
    set,
    get fixed() {
      return fixed;
    },
    /** Centre of the new slats (world), for the camera, the tape and the PHOTO frame. */
    focus: new THREE.Vector3(s1[0], s1[1], s1[2]),
  };
}

/**
 * Mme Benali's roller shutter as its own mesh (the evening and wall variants batch it): open 0..1, the
 * guide rails rusty or oiled. P: the bakery's facade frame; w, h: the opening. Also the 4 a.m. state:
 * the bakery lit (#ffc98a) with a floured board on a trestle pulled out under the half-raised shutter.
 */
export function benaliShutter({ P, w, h = 2.75, M, haloTex, window: win }) {
  const group = new THREE.Group();
  group.name = 'benali-shutter';
  P.decompose(group.position, group.quaternion, group.scale);
  const panelGeo = cbox(w, h, 0.05);
  panelGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(panelGeo.attributes.position.count * 3).fill(0.72), 3));
  const panel = new THREE.Mesh(panelGeo, M.roller.material);
  panel.castShadow = true;
  const bar = new THREE.Mesh(cbox(w, 0.06, 0.08), M.iron.material);
  group.add(panel, bar);
  // Guide rails over the batched ones: rust, or a dark film of fresh oil.
  // (Just inside the opening, proud of the pilasters, so the PHOTO can frame one.)
  // Thirteen years of rust in flakes and runs; the oil darkens it, fills it and makes it shine.
  const rustMap = canvasTexture(32, 512, (c, cw, ch) => {
    const R = seeded(13);
    c.fillStyle = '#9a6038';
    c.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 700; i++) {
      c.fillStyle = ['#6e3e22', '#b8784a', '#5a3a26', '#c89060', '#7a7068'][(R() * 5) | 0];
      c.fillRect(R() * cw, R() * ch, 1 + R() * 6, 2 + R() * 18);
    }
  });
  const rust = new THREE.MeshStandardMaterial({ map: rustMap, roughness: 0.98, metalness: 0.1 });
  const oil = new THREE.MeshStandardMaterial({ map: rustMap, color: '#4a3a2a', roughness: 0.08, metalness: 0.35, envMapIntensity: 2.2 });
  const rails = [-1, 1].map((sx) => {
    const r = new THREE.Mesh(cbox(0.09, h - 0.04, 0.11), rust);
    r.position.set(sx * (w / 2 - 0.035), h / 2, 0.075);
    group.add(r);
    return r;
  });
  // Oil drips on the pavement at the rails' feet (only once it is oiled).
  const dripTex = canvasTexture(64, 64, (c, cw, ch) => {
    const g = c.createRadialGradient(cw / 2, ch / 2, 2, cw / 2, ch / 2, cw / 2);
    g.addColorStop(0, 'rgba(18,16,12,0.9)');
    g.addColorStop(0.6, 'rgba(18,16,12,0.55)');
    g.addColorStop(1, 'rgba(18,16,12,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, cw, ch);
  });
  const dripMat = new THREE.MeshStandardMaterial({ map: dripTex, transparent: true, depthWrite: false, roughness: 0.08, metalness: 0.3, polygonOffset: true, polygonOffsetFactor: -3 });
  const drips = [-1, 1].map((sx) => {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16).rotateX(-Math.PI / 2), dripMat);
    d.position.set(sx * (w / 2 - 0.035), SIDEWALK_Y + 0.004, 0.17);
    d.renderOrder = 3;
    group.add(d);
    return d;
  });
  // 4 a.m.: the trestle and its floured board, a warm light from the shop.
  const tb = new Batch();
  const flour = new THREE.MeshStandardMaterial({
    roughness: 0.95,
    map: canvasTexture(256, 128, (c, cw, ch) => {
      c.fillStyle = '#b89870';
      c.fillRect(0, 0, cw, ch);
      const R = seeded(36);
      for (let i = 0; i < 1600; i++) {
        c.fillStyle = `rgba(245,240,228,${R() * 0.6})`;
        c.beginPath();
        c.arc(cw / 2 + (R() - 0.5) * cw * 0.9, ch / 2 + (R() - 0.5) * ch * 0.8, 1 + R() * 4, 0, Math.PI * 2);
        c.fill();
      }
    }),
  });
  tb.material('timber', M.timber.material).material('flour', flour);
  const tx = w * 0.18;
  const tz = 0.62;
  for (const sx of [-0.5, 0.5]) {
    tb.add('timber', rod([tx + sx, 0, tz - 0.25], [tx + sx, 0.84, tz], 0.02));
    tb.add('timber', rod([tx + sx, 0, tz + 0.25], [tx + sx, 0.84, tz], 0.02));
  }
  tb.add('timber', cbox(1.25, 0.03, 0.06), { pos: [tx, 0.84, tz] });
  tb.add('flour', cbox(1.3, 0.035, 0.62), { pos: [tx, 0.875, tz] });
  tb.add('timber', cyl(0.025, 0.025, 0.42, 10), { pos: [tx + 0.32, 0.92, tz + 0.12], rot: [0, 0, Math.PI / 2] }); // rolling pin
  const trestle = tb.build('benali-trestle');
  noOcclude(trestle);
  group.add(trestle);
  const light = pointLight(0xffc98a, 6, { pos: [0, 0, 0], distance: 7 });
  light.position.set(0, 1.6, 0.25);
  light.userData.noCone = true;
  group.add(light);
  const spill = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 2.4).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: haloTex, color: 0xffc98a, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  spill.position.set(0, SIDEWALK_Y + 0.011, 1.0);
  spill.renderOrder = 4;
  group.add(spill);

  const state = { open: 0, oiled: false, lit: false, from: 0, to: 0, t: 0, dur: 0 };
  const apply = () => {
    const sh = Math.max(0.03, h * (1 - state.open));
    panel.scale.y = sh / h;
    panel.position.set(0, h - sh / 2, 0.05);
    bar.position.set(0, h - sh + 0.03, 0.08);
  };
  const setOiled = (v) => {
    state.oiled = !!v;
    for (const r of rails) r.material = state.oiled ? oil : rust;
    for (const d of drips) d.visible = state.oiled;
  };
  const setLit = (v) => {
    state.lit = !!v;
    trestle.visible = state.lit;
    light.visible = state.lit;
    spill.visible = state.lit;
    // The interior-mapped window behind (scene2/bakery.js): glowing, or the plain day tint.
    const u = win?.material?.uniforms?.uTint;
    if (u) {
      win.userData.baseTint ??= u.value.clone();
      if (state.lit) u.value.setRGB(1.55, 1.2, 0.82);
      else u.value.copy(win.userData.baseTint);
    }
  };
  apply();
  setOiled(false);
  setLit(false);
  return {
    group,
    get open() {
      return state.open;
    },
    get oiled() {
      return state.oiled;
    },
    get lit() {
      return state.lit;
    },
    /** 0 = down, 1 = rolled up; secs > 0 animates (the scream is the chapter's sound). */
    setOpen(k, secs = 0) {
      k = Math.max(0, Math.min(1, k));
      if (secs > 0) Object.assign(state, { from: state.open, to: k, t: 0, dur: secs });
      else {
        state.open = k;
        state.dur = 0;
        apply();
      }
    },
    setOiled,
    /** The bakery at 4 a.m.: lit, the trestle out. */
    setLit,
    /** The floured board on its trestle (world): CROISSANT's close shot. */
    trestle: new THREE.Vector3(tx, 0.9, tz).applyMatrix4(P),
    /** The street-end guide rail at hinge height (world): the PHOTO frame's target. */
    focus: new THREE.Vector3(w / 2 - 0.035, 1.25, 0.13).applyMatrix4(P),
    update(raw) {
      if (state.dur > 0) {
        state.t = Math.min(state.dur, state.t + raw);
        const e = state.t / state.dur;
        state.open = state.from + (state.to - state.from) * (e * e * (3 - 2 * e));
        apply();
        if (state.t >= state.dur) state.dur = 0;
      }
    },
  };
}

/**
 * Gérard's neon wiring under the blade sign: a taped wire sagging from the sign to the junction box on
 * the wall (it flickers), or a neat new cable clipped along the board's edge and down the wall (rewired).
 * from: [x, y, z] under the board (world); to: the junction box on the wall.
 */
export function neonWires({ from, to }, M) {
  const A = new THREE.Vector3(...from);
  const B = new THREE.Vector3(...to);
  const tape = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.7 });
  const loose = new THREE.Group();
  const mid = A.clone().lerp(B, 0.45).add(new THREE.Vector3(0, -0.75, 0.04));
  const sag = new THREE.CatmullRomCurve3([A, A.clone().lerp(mid, 0.5).add(new THREE.Vector3(0, -0.12, 0)), mid, B]);
  loose.add(new THREE.Mesh(new THREE.TubeGeometry(sag, 24, 0.011, 5, false), M.cable.material));
  const blob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6).scale(1.8, 1, 1), tape);
  blob.position.copy(mid);
  loose.add(blob);
  // Rewired: along the underside of the board to the wall, then down to the box, with clips.
  const neat = new THREE.Group();
  const corner = new THREE.Vector3(B.x, A.y, A.z);
  const down = new THREE.Vector3(B.x, B.y, A.z);
  for (const [p, q] of [[A, corner], [corner, down], [down, B]]) {
    if (p.distanceTo(q) < 0.005) continue;
    neat.add(new THREE.Mesh(rod(p.toArray(), q.toArray(), 0.01, 6), M.cable.material));
  }
  for (let k = 1; k < 4; k++) {
    const clip = new THREE.Mesh(cbox(0.02, 0.022, 0.024), M.iron.material);
    clip.position.copy(A.clone().lerp(corner, k / 4));
    neat.add(clip);
  }
  const box = new THREE.Mesh(cbox(0.06, 0.12, 0.1), M.casement.material);
  box.position.copy(B);
  const group = new THREE.Group();
  group.name = 'neon-wires';
  group.add(loose, neat, box);
  noOcclude(group);
  let fixed = false;
  const set = (v) => {
    fixed = !!v;
    loose.visible = !fixed;
    neat.visible = fixed;
  };
  set(false);
  return {
    group,
    set,
    get fixed() {
      return fixed;
    },
  };
}

/** The sawdust slipper print on a doorstep: a flat decal at [x, z], hidden until shown. */
export function printMark([x, z], rotY = 0) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.62).rotateX(-Math.PI / 2).rotateY(rotY),
    new THREE.MeshStandardMaterial({ map: slipperPrintTexture(), transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3 }),
  );
  m.position.set(x, SIDEWALK_Y + 0.005, z);
  m.renderOrder = 3;
  m.name = 'slipper-print';
  m.visible = false;
  m.userData.noOcclude = true;
  return m;
}
