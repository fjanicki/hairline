import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { L } from '../../story/script.js';
import * as B from '../build.js';
import { W, D, H, OUT_X, BACK_Z, DOORWAY, DOOR_X, WIN, GARAGE, BENCH, TRESTLE, DOOR_LEN, DOOR_WID, DOOR_THK, STAND, EASEL, BOARD_W, BOARD_H, BOARD_PX, BULB, STOOL, SIGN_RED, WOOD_GREY, clamp, damp } from './scene4/layout.js';
import { bx, rbox, tube, merged, makeCanvas } from './scene4/geo.js';
import { makeSurfaces } from './scene4/surfaces.js';
import { buildShell } from './scene4/shell.js';
import { dress, buildOldSigns } from './scene4/dressing.js';
import { buildLights } from './scene4/lights.js';
import { dustMotes, rainBox } from './scene4/fx.js';

// Ch4 "Measure Twice": Odile's repair workshop, ground floor of No. 14 Rue des Tanneurs.
// A 9 x 6 m dollhouse room (the +Z wall is omitted so the follow camera sits outside it; an
// invisible ceiling and fourth wall cast shadow so daylight only gets in under the garage door).
// The layout lives in scene4/layout.js; the room, furniture, props, lights and particles are built
// by the modules in scene4/; this file keeps the story objects (the door Hugo sands and paints, the
// bike on the stand, the OPEN board) and the chapter API ch4.js drives.
//
// Colour story: the room is timber, concrete and whitewash, dusty and warm under one bulb; the
// things he makes (the door, the wheel, the sign) are what the focus slots give colour first.

// ------------------------------------------------------------------ small value noise (door paint)

function valueNoise(seed) {
  const R = B.rng(seed);
  const N = 256;
  const perm = new Uint8Array(N * 2);
  const vals = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    perm[i] = i;
    vals[i] = R();
  }
  for (let i = N - 1; i > 0; i--) {
    const j = (R() * (i + 1)) | 0;
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < N; i++) perm[N + i] = perm[i];
  const at = (x, y) => vals[perm[(perm[x & 255] + y) & 255]];
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = s(x - xi);
    const fy = s(y - yi);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

// ------------------------------------------------------------------ the door (sand / paint mask)

/**
 * The old door: nine coats of paint (a tired green over cream over red-oxide primer), flaking in
 * organic patches down to grey wood, raw pale wood under it, and the warm grey on top. Canvas u runs
 * along the door's length, v across its width. setSand(p) reveals wood in streaks along the grain
 * (back edge first); setPaint(p) lays the grey in 6 bands.
 */
function buildDoor(surf, materials) {
  const CW = 1024;
  const CH = 420;
  const R = B.rng(101);
  const panels = [
    [60, 50, 420, 140],
    [544, 50, 420, 140],
    [60, 230, 420, 140],
    [544, 230, 420, 140],
  ];
  const mould = (g, light, dark) => {
    for (const [x, y, w, h] of panels) {
      g.strokeStyle = dark;
      g.lineWidth = 5;
      g.strokeRect(x, y, w, h);
      g.strokeStyle = light;
      g.lineWidth = 2;
      g.strokeRect(x + 5, y + 5, w - 10, h - 10);
      g.strokeStyle = dark;
      g.lineWidth = 1;
      g.strokeRect(x + 9, y + 9, w - 18, h - 18);
    }
  };

  // Layer 1: nine coats, flaking. One warped fractal field, cut at four levels, gives the strata:
  // the green top coat, the cream under it, the red-oxide primer and, deepest, grey weathered wood.
  // Chips are small and gather at the edges and along the mouldings (where hands and knocks wear
  // it); each step down gets a dark shadow under the raised coat's lip and a pale lifted edge, and a
  // height map of the same strata drives the bump (so the chips have thickness under the bulb).
  const old = makeCanvas(CW, CH);
  const oldH = makeCanvas(CW, CH); // height: top coat 1, cream .72, oxide .5, wood .25
  {
    const g = old.getContext('2d');
    const img = g.createImageData(CW, CH);
    const hImg = oldH.getContext('2d').createImageData(CW, CH);
    const d = img.data;
    const hd = hImg.data;
    const n1 = valueNoise(7);
    const n2 = valueNoise(19);
    const n3 = valueNoise(43);
    const green = [92, 106, 84];
    const cream = [196, 186, 158];
    const oxide = [120, 72, 54];
    const wood = [118, 104, 88];
    const nearMould = (x, y) => {
      let m = 0;
      for (const [px, py, pw, ph] of panels) {
        const dx = Math.min(Math.abs(x - px), Math.abs(x - px - pw));
        const dy = Math.min(Math.abs(y - py), Math.abs(y - py - ph));
        if (x > px - 12 && x < px + pw + 12 && y > py - 12 && y < py + ph + 12) m = Math.max(m, 1 - Math.min(dx, dy) / 12);
      }
      return Math.max(0, m);
    };
    const W = new Float32Array(CW * CH);
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        // Domain-warped and stretched along the grain (u), the way paint lifts on a door.
        const wx = x + n3(x / 60, y / 30) * 40;
        const wy = y + n3(x / 50 + 9, y / 25) * 14;
        let f = n1(wx / 70, wy / 30) * 0.45 + n1(wx / 22, wy / 11) * 0.33 + n1(wx / 7, wy / 4) * 0.22;
        const edge = Math.min(y, CH - y, x * 0.6, (CW - x) * 0.6) / 70; // more wear at the edges
        f += 0.16 * (1 - Math.min(1, edge)) + 0.09 * nearMould(x, y);
        W[y * CW + x] = f;
      }
    }
    const level = (f) => (f > 0.74 ? 3 : f > 0.705 ? 2 : f > 0.665 ? 1 : 0); // 0 green .. 3 wood
    const COL = [green, cream, oxide, wood];
    const HGT = [255, 184, 128, 64];
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        const i = y * CW + x;
        const L0 = level(W[i]);
        // Raised lip of the coat above, lit from the upper left: shadow just inside a step down,
        // a pale lifted edge just outside it.
        const up = level(W[Math.max(0, y - 2) * CW + Math.max(0, x - 2)]);
        const dn = level(W[Math.min(CH - 1, y + 2) * CW + Math.min(CW - 1, x + 2)]);
        let shade = 0.94 + n2(x / 7, y / 7) * 0.1;
        if (up < L0) shade *= 0.62; // in the shadow of the coat above
        else if (dn > L0) shade *= 1.12; // the coat's chipped edge catches the light
        const grain = n2(x / 140, y / 2.5) * 0.06;
        const c = COL[L0];
        const k = i * 4;
        d[k] = Math.min(255, c[0] * (shade + grain));
        d[k + 1] = Math.min(255, c[1] * (shade + grain));
        d[k + 2] = Math.min(255, c[2] * (shade + grain));
        d[k + 3] = 255;
        const h = HGT[L0] + (L0 === 3 ? n2(x / 140, y / 2.5) * 40 : n2(x / 5, y / 5) * 10);
        hd[k] = hd[k + 1] = hd[k + 2] = Math.min(255, h);
        hd[k + 3] = 255;
      }
    }
    oldH.getContext('2d').putImageData(hImg, 0, 0);
    function i4(x, y) {
      return (y * CW + x) * 4;
    }
    g.putImageData(img, 0, 0);
    mould(g, 'rgba(210,214,190,0.22)', 'rgba(20,24,18,0.5)');
    // Hairline cracks along the grain, brush ridges and decades of hands.
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(22,20,16,${0.12 + R() * 0.25})`;
      g.lineWidth = 0.8;
      g.beginPath();
      let x = R() * CW;
      let y = R() * CH;
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) g.lineTo((x += 10 + R() * 40), (y += (R() - 0.5) * 4));
      g.stroke();
    }
    const grd = g.createRadialGradient(CW / 2, CH * 0.88, 4, CW / 2, CH * 0.88, 150);
    grd.addColorStop(0, 'rgba(30,24,16,0.6)');
    grd.addColorStop(1, 'rgba(30,24,16,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, CW, CH);
    const edge = g.createLinearGradient(0, 0, 0, CH);
    edge.addColorStop(0, 'rgba(30,24,16,0.25)');
    edge.addColorStop(0.1, 'rgba(30,24,16,0)');
    edge.addColorStop(0.9, 'rgba(30,24,16,0)');
    edge.addColorStop(1, 'rgba(30,24,16,0.3)');
    g.fillStyle = edge;
    g.fillRect(0, 0, CW, CH);
    g.fillStyle = '#2a2622';
    g.fillRect(CW / 2 - 20, CH - 60, 40, 30);
    g.fillStyle = '#0e0c0a';
    g.beginPath();
    g.arc(CW / 2, CH - 46, 6, 0, Math.PI * 2);
    g.fill();
  }

  // Layer 2: raw pale wood with the grain along u.
  const wood = makeCanvas(CW, CH);
  {
    const g = wood.getContext('2d');
    B.paintNoise(g, CW, CH, '#94774f', 0.04); // raw pine, kept below the bulb's bloom
    for (let i = 0; i < 220; i++) {
      const y = R() * CH;
      g.strokeStyle = `rgba(110,74,40,${0.06 + R() * 0.18})`;
      g.lineWidth = 0.6 + R() * 1.6;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= CW; x += 48) g.lineTo(x, y + Math.sin(x * 0.008 + i) * (2 + R() * 4));
      g.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const x = R() * CW;
      const y = R() * CH;
      g.fillStyle = 'rgba(100,64,34,0.5)';
      g.beginPath();
      g.ellipse(x, y, 10 + R() * 8, 4 + R() * 3, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(110,74,40,0.25)';
      g.beginPath();
      g.ellipse(x, y, 22 + R() * 10, 8 + R() * 4, 0, 0, Math.PI * 2);
      g.stroke();
    }
    // Paint still in the corners of the mouldings (sanding never quite gets it).
    mould(g, 'rgba(240,220,190,0.2)', 'rgba(92,106,84,0.55)');
    g.fillStyle = 'rgba(70,50,30,0.4)';
    g.fillRect(CW / 2 - 20, CH - 60, 40, 30);
  }
  const woodH = makeCanvas(CW, CH);
  B.paintNoise(woodH.getContext('2d'), CW, CH, '#606060', 0.08);
  // Once the plywood set is in, the sanded wood takes its real grain (tiled along u, 0.5 m a tile),
  // in an uneven tone, with filler patches, the old coats left in the grain and in the mouldings.
  const woodReal = materials?.image?.('wood_plywood');
  woodReal?.then((im) => {
    if (!im) return;
    const g = wood.getContext('2d');
    const T = Math.round(CW / (DOOR_LEN / 0.5));
    // Over the pale pine base (keeps its value under the bulb): the scan's grain, in luminosity.
    g.save();
    g.globalCompositeOperation = 'luminosity';
    g.globalAlpha = 0.6;
    for (let x = 0; x < CW; x += T) for (let y = 0; y < CH; y += T) g.drawImage(im, x, y, T, T);
    g.restore();
    const Rw = B.rng(77);
    for (let i = 0; i < 26; i++) {
      // Uneven tone: darker where the old finish soaked in, paler where the block bit deeper.
      const x = Rw() * CW;
      const y = Rw() * CH;
      const r = g.createRadialGradient(x, y, 2, x, y, 40 + Rw() * 90);
      const dark = Rw() < 0.55;
      r.addColorStop(0, dark ? 'rgba(80,52,28,0.22)' : 'rgba(235,215,180,0.18)');
      r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, CW, CH);
    }
    for (let i = 0; i < 7; i++) {
      // Filler: pale putty smears over old dents and nail holes.
      g.fillStyle = `rgba(205,190,160,${0.55 + Rw() * 0.3})`;
      g.beginPath();
      g.ellipse(Rw() * CW, Rw() * CH, 6 + Rw() * 16, 3 + Rw() * 6, (Rw() - 0.5) * 0.4, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 110; i++) {
      // Old paint left down in the grain: short streaks along u.
      g.fillStyle = ['rgba(92,106,84,0.45)', 'rgba(196,186,158,0.35)', 'rgba(120,72,54,0.4)'][i % 3];
      g.fillRect(Rw() * CW, Rw() * CH, 3 + Rw() * 14, 1 + Rw() * 1.2);
    }
    mould(g, 'rgba(240,220,190,0.25)', 'rgba(92,106,84,0.7)');
    g.fillStyle = 'rgba(70,50,30,0.4)';
    g.fillRect(CW / 2 - 20, CH - 60, 40, 30);
    compose();
  });

  const greyH = makeCanvas(CW, CH);
  B.paintNoise(greyH.getContext('2d'), CW, CH, '#909090', 0.04);
  // Layer 3: the warm grey, laid with a wide brush.
  const grey = makeCanvas(CW, CH);
  {
    const g = grey.getContext('2d');
    B.paintNoise(g, CW, CH, L.ch4.day8.paintColor || WOOD_GREY, 0.03);
    for (let i = 0; i < 320; i++) {
      const y = R() * CH;
      g.strokeStyle = R() < 0.5 ? 'rgba(255,250,240,0.06)' : 'rgba(40,36,30,0.06)';
      g.lineWidth = 1 + R() * 3;
      g.beginPath();
      g.moveTo(R() * 100, y);
      g.lineTo(CW - R() * 100, y + (R() - 0.5) * 6);
      g.stroke();
    }
    mould(g, 'rgba(255,248,236,0.2)', 'rgba(40,36,30,0.38)');
    g.fillStyle = '#5a554c';
    g.fillRect(CW / 2 - 20, CH - 60, 40, 30);
  }

  // Sanding streaks (back edge first) and paint bands.
  const streaks = [];
  for (let i = 0; i < 70; i++) {
    const v = R() * CH;
    streaks.push({ v, h: 6 + R() * 22, u0: R() * 120, u1: CW - R() * 120, t: 0.82 * (0.7 * (v / CH) + 0.3 * R()) });
  }
  const mask = makeCanvas(CW, CH);
  const mg = mask.getContext('2d');
  const out = makeCanvas(CW, CH);
  const og = out.getContext('2d');
  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // The bump: the strata heights, composed with the same masks as the colour.
  const outH = makeCanvas(CW, CH);
  const oh = outH.getContext('2d');
  const hTex = new THREE.CanvasTexture(outH);
  hTex.colorSpace = THREE.NoColorSpace;
  const layer = (dst, src) => {
    mg.globalCompositeOperation = 'source-in';
    mg.drawImage(src, 0, 0);
    dst.drawImage(mask, 0, 0);
  };

  let sand = 0;
  let paint = 0;
  const compose = () => {
    og.globalCompositeOperation = 'source-over';
    og.drawImage(old, 0, 0);
    oh.drawImage(oldH, 0, 0);
    if (sand > 0) {
      mg.globalCompositeOperation = 'source-over';
      mg.clearRect(0, 0, CW, CH);
      mg.fillStyle = '#fff';
      for (const s of streaks) {
        const a = clamp((sand - s.t) / 0.12, 0, 1);
        if (a <= 0) continue;
        mg.globalAlpha = a;
        mg.fillRect(s.u0, s.v - s.h / 2, s.u1 - s.u0, s.h);
        mg.fillRect(s.u0 * 0.3, s.v - s.h / 4, s.u1 - s.u0 * 0.3, s.h / 2);
      }
      const all = clamp((sand - 0.86) / 0.14, 0, 1);
      if (all > 0) {
        mg.globalAlpha = all;
        mg.fillRect(0, 0, CW, CH);
      }
      mg.globalAlpha = 1;
      const keep = makeMaskCopy();
      layer(og, wood);
      restoreMask(keep);
      layer(oh, woodH);
    }
    if (paint > 0) {
      mg.globalCompositeOperation = 'source-over';
      mg.clearRect(0, 0, CW, CH);
      const bandH = CH / 6;
      for (let k = 0; k < 6; k++) {
        const q = clamp(paint * 6 - k, 0, 1);
        if (q <= 0) continue;
        const x1 = q * CW;
        const grd = mg.createLinearGradient(Math.max(0, x1 - 60), 0, x1, 0);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        mg.fillStyle = '#fff';
        mg.fillRect(0, k * bandH - 2, Math.max(0, x1 - 60), bandH + 4);
        mg.fillStyle = grd;
        mg.fillRect(Math.max(0, x1 - 60), k * bandH - 2, Math.min(60, x1), bandH + 4);
      }
      const keep = makeMaskCopy();
      layer(og, grey);
      restoreMask(keep);
      layer(oh, greyH);
    }
    tex.needsUpdate = true;
    hTex.needsUpdate = true;
  };
  // The mask canvas is consumed by 'source-in'; keep a copy to reuse it for the height layer.
  const maskCopy = makeCanvas(CW, CH);
  const makeMaskCopy = () => {
    const c = maskCopy.getContext('2d');
    c.clearRect(0, 0, CW, CH);
    c.drawImage(mask, 0, 0);
    return maskCopy;
  };
  const restoreMask = (c) => {
    mg.globalCompositeOperation = 'source-over';
    mg.clearRect(0, 0, CW, CH);
    mg.drawImage(c, 0, 0);
  };
  compose();

  // One material (one draw): the canvas is laid out for the +y face; the 4 cm edges pick up a
  // squeezed copy of it, which reads as painted edges. The canvas doubles as a bump map, so the
  // flaking edges and the mouldings catch the bulb.
  // A slightly dimmed albedo: the door lies right under the bulb, and the grey must stay a grey there.
  const faceMat = new THREE.MeshStandardMaterial({ color: '#d2d2d2', map: tex, bumpMap: hTex, bumpScale: 2.2, roughness: 0.8 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(DOOR_LEN, DOOR_THK, DOOR_WID), faceMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'old-door';
  const group = new THREE.Group();
  group.name = 'door';
  group.add(mesh);
  // Hardware, shown once it hangs: a brass knob, the escutcheon and three hinges (door-local:
  // x along the length, y the face normal, z across).
  const hw = new THREE.Group();
  hw.add(
    merged(
      [
        new THREE.SphereGeometry(0.028, 14, 10).translate(0, DOOR_THK / 2 + 0.055, DOOR_WID / 2 - 0.08),
        new THREE.CylinderGeometry(0.008, 0.008, 0.05, 8).translate(0, DOOR_THK / 2 + 0.025, DOOR_WID / 2 - 0.08),
        bx(-0.06, 0.06, DOOR_THK / 2, DOOR_THK / 2 + 0.006, DOOR_WID / 2 - 0.1, DOOR_WID / 2 - 0.06),
      ],
      surf.brass,
      { castShadow: false },
    ),
    merged(
      [-0.8, 0, 0.8].map((x) => bx(x - 0.05, x + 0.05, DOOR_THK / 2, DOOR_THK / 2 + 0.004, -DOOR_WID / 2, -DOOR_WID / 2 + 0.03)),
      surf.black,
      { castShadow: false },
    ),
  );
  hw.visible = false;
  mesh.add(hw);

  const lie = () => {
    group.position.set(TRESTLE.x, 0, TRESTLE.z);
    group.rotation.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.position.set(0, TRESTLE.top + DOOR_THK / 2 + 0.002, 0);
    hw.visible = false;
  };
  lie();

  // Sanding block / wide brush that rides on the face while Hugo works.
  const block = new THREE.Group();
  block.add(
    merged([bx(-0.065, 0.065, 0, 0.035, -0.04, 0.04)], B.mat('#b58a5a', { roughness: 0.9, surface: false }), { castShadow: true }),
    merged([bx(-0.07, 0.07, -0.004, 0.002, -0.045, 0.045)], B.mat('#c9b48a', { roughness: 1, surface: false }), { castShadow: false }),
  );
  block.visible = false;
  group.add(block);
  // A 10 cm flat brush: grey-loaded bristles on the face, a chrome ferrule, the handle trailing
  // back along the stroke at about 35 degrees (setBrush tilts it), not standing up like a mallet.
  const brush = new THREE.Group();
  const brushBody = new THREE.Group();
  brushBody.add(
    merged([bx(-0.007, 0.007, 0.0, 0.012, -0.05, 0.05)], B.mat(WOOD_GREY, { roughness: 0.6, surface: false }), { castShadow: false }),
    merged([bx(-0.008, 0.008, 0.012, 0.05, -0.05, 0.05)], B.mat('#3c3832', { roughness: 0.95, surface: false })),
    merged([bx(-0.01, 0.01, 0.05, 0.076, -0.052, 0.052)], surf.chrome),
    merged([rbox(0.016, 0.16, 0.034, 0, 0.155, 0)], B.mat('#7a4a2c', { roughness: 0.7, surface: false })),
  );
  brushBody.rotation.z = 0.95;
  brush.add(brushBody);
  brush.visible = false;
  group.add(brush);
  const faceY = TRESTLE.top + DOOR_THK + 0.002;

  return {
    group,
    mesh,
    block,
    brush,
    get sand() {
      return sand;
    },
    get paint() {
      return paint;
    },
    setSand(p) {
      p = clamp(p, 0, 1);
      if (Math.abs(p - sand) < 0.004 && p < 1) return;
      sand = p;
      compose();
    },
    setPaint(p) {
      p = clamp(p, 0, 1);
      if (Math.abs(p - paint) < 0.004 && p < 1) return;
      paint = p;
      faceMat.bumpScale = 2.2 * (1 - 0.6 * p); // fresh paint fills the grain
      compose();
    },
    /** Sanding block on the face: x along the length (-1..1 of half-length), f across (0 back .. 1 front). */
    setBlock(on, x = 0, f = 0) {
      block.visible = on;
      block.position.set(x * (DOOR_LEN / 2 - 0.1), faceY, -DOOR_WID / 2 + 0.06 + f * (DOOR_WID - 0.12));
    },
    /** Wide brush at band k (0..5), q along the length (0..1). */
    setBrush(on, k = 0, q = 0) {
      brush.visible = on;
      brush.position.set(-DOOR_LEN / 2 + 0.05 + q * (DOOR_LEN - 0.1), faceY, -DOOR_WID / 2 + ((k + 0.5) / 6) * DOOR_WID);
      brush.rotation.set(0, 0, 0);
    },
    lie,
    /** Stand the door up in the internal doorway, painted face toward the room (+Z). */
    hang() {
      block.visible = false;
      brush.visible = false;
      group.position.set(DOOR_X, 0, -D / 2 - 0.0);
      group.rotation.set(0, 0, 0);
      // local x (length) -> world up, local y (face normal) -> world +Z, local z -> world x.
      const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
      mesh.quaternion.setFromRotationMatrix(m);
      mesh.position.set(0, DOOR_LEN / 2 + 0.02, 0.025);
      hw.visible = true;
    },
    /** World point at the centre of the painted face. */
    faceCenter() {
      return mesh.getWorldPosition(new THREE.Vector3());
    },
  };
}

// ------------------------------------------------------------------ the bicycle on the work stand

/** Give a build.bicycle() frame a clear-coated paint (per instance) so it sits next to the scans. */
function finishBike(bike, rust = 0) {
  const fm = bike.userData.frameMaterial;
  if (!fm) return bike;
  const phys = new THREE.MeshPhysicalMaterial({
    color: fm.color.clone(),
    roughness: 0.38 + 0.45 * rust,
    metalness: 0.15,
    clearcoat: 0.9 * (1 - rust),
    clearcoatRoughness: 0.3,
  });
  bike.traverse((o) => {
    if (o.material === fm) o.material = phys;
  });
  fm.dispose();
  bike.userData.frameMaterial = phys;
  return bike;
}

/**
 * Wraps build.bicycle() for the workshop: wheel spin, a rear wheel that wobbles out of true once per
 * turn (a yaw pivot around the axle), brake pads that flash on the rub, and "pushed by" follow.
 */
function rigBike(bike) {
  const [front, rear] = bike.userData.wheels;
  // Insert a yaw pivot between the bike and the rear wheel so the whole wheel can wander sideways.
  const yaw = new THREE.Group();
  yaw.position.copy(rear.position);
  bike.add(yaw);
  bike.remove(rear);
  rear.position.set(0, 0, 0);
  yaw.add(rear);
  // Rear brake pads, where the seat stays bridge over the rim.
  const padMat = new THREE.MeshStandardMaterial({ color: '#1e1e20', roughness: 0.9, emissive: '#000000' });
  const padGeo = mergeGeometries([bx(-0.034, -0.018, -0.012, 0.012, -0.022, 0.022), bx(0.018, 0.034, -0.012, 0.012, -0.022, 0.022)]);
  const pads = new THREE.Mesh(padGeo, padMat);
  const R = bike.userData.wheelRadius;
  const ang = Math.atan2(0.27, 0.42); // toward the seat-stay bridge
  pads.position.set(0, yaw.position.y + Math.cos(ang) * (R - 0.03), yaw.position.z + Math.sin(ang) * (R - 0.03));
  bike.add(pads);
  const bridge = new THREE.Mesh(bx(-0.05, 0.05, -0.006, 0.006, -0.008, 0.008), B.mat('#9a9c9e', { roughness: 0.4, metalness: 0.6 }));
  bridge.position.copy(pads.position);
  bridge.position.y += 0.02;
  bike.add(bridge);

  const st = {
    spin: 0, // rev/s of the rear wheel
    spinTarget: 0,
    angle: 0,
    amp: 0, // wobble amplitude (rad of yaw)
    rubAngle: 0,
    flash: 0,
    follow: null,
    lastPos: new THREE.Vector3(),
  };
  const TAU = Math.PI * 2;
  const api = {
    group: bike,
    rear,
    front,
    yaw,
    pads,
    st,
    /** Called each time the rim's worst point passes the pads while the wheel is out of true. */
    onRub: null,
    setSpin(revPerSec, { snap = false } = {}) {
      st.spinTarget = revPerSec;
      if (snap) st.spin = revPerSec;
    },
    setWobble(a) {
      st.amp = a;
    },
    /** The rim's worst point reaches the pad `secs` from now (at the current spin). */
    syncRub(secs) {
      st.rubAngle = st.angle + Math.PI * 2 * st.spin * secs;
    },
    rub() {
      st.flash = 1;
    },
    /** Walk the bike beside `char` (on the side away from the camera). null stops. */
    follow(char) {
      st.follow = char;
      if (char) st.lastPos.copy(char.root.position);
    },
    update(dt) {
      const before = Math.floor((st.angle - st.rubAngle) / TAU);
      st.spin = damp(st.spin, st.spinTarget, 2.5, dt);
      st.angle += TAU * st.spin * dt;
      rear.rotation.x = -st.angle;
      const target = st.amp * Math.cos(st.angle - st.rubAngle);
      yaw.rotation.y = damp(yaw.rotation.y, target, 14, dt);
      st.flash = Math.max(0, st.flash - dt * 4);
      padMat.emissive.setRGB(0.5 * st.flash, 0.32 * st.flash, 0.18 * st.flash);
      if (st.follow) {
        const r = st.follow.root;
        const a = r.rotation.y;
        const fwd = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
        const left = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
        if (left.z > 0) left.negate(); // keep the bike on the far side of the kid
        bike.position.copy(r.position).addScaledVector(left, 0.42).addScaledVector(fwd, 0.12);
        bike.position.y = 0;
        bike.rotation.set(0, a, 0);
        const moved = r.position.distanceTo(st.lastPos);
        st.lastPos.copy(r.position);
        front.rotation.x -= moved / R;
        st.angle += moved / R;
      }
      const after = Math.floor((st.angle - st.rubAngle) / TAU);
      if (after > before && st.amp > 0.015) {
        st.flash = 1;
        try {
          api.onRub?.();
        } catch (err) {
          console.error('[scene4] onRub failed', err);
        }
      }
    },
  };
  return api;
}

// ------------------------------------------------------------------ the OPEN sign board

/**
 * The cream-primed sign board on its little easel. The paint canvas holds primer + paint; the
 * display canvas adds the chalk guides on top. Lettering is drawn in 3D on the board itself.
 */
function buildBoard(surf) {
  const [CW, CH] = BOARD_PX;
  const R = B.rng(211);
  const paintC = makeCanvas(CW, CH);
  const pg = paintC.getContext('2d');
  B.paintNoise(pg, CW, CH, '#ad9f80', 0.035); // cream primer, kept under the tube's bloom
  for (let i = 0; i < 120; i++) {
    pg.strokeStyle = R() < 0.5 ? 'rgba(255,252,240,0.08)' : 'rgba(120,100,70,0.05)';
    pg.lineWidth = 1 + R() * 3;
    const y = R() * CH;
    pg.beginPath();
    pg.moveTo(0, y);
    pg.lineTo(CW, y + (R() - 0.5) * 8);
    pg.stroke();
  }
  const edge = pg.createLinearGradient(0, 0, 0, CH);
  edge.addColorStop(0, 'rgba(90,70,40,0.12)');
  edge.addColorStop(0.15, 'rgba(90,70,40,0)');
  edge.addColorStop(0.85, 'rgba(90,70,40,0)');
  edge.addColorStop(1, 'rgba(90,70,40,0.16)');
  pg.fillStyle = edge;
  pg.fillRect(0, 0, CW, CH);

  // Stroke paths (px) for O-P-E-N: O (one loop), P (stem, bowl), E (stem, comb), N (zigzag).
  const TOP = 120;
  const BOT = 380;
  const MID = (TOP + BOT) / 2;
  const sx = -14; // centre the word
  const ellipse = (cx, cy, rx, ry, a0, a1, n = 40) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return pts;
  };
  const shift = (pts) => pts.map(([u, v]) => [u + sx, v]);
  const strokes = [
    shift(ellipse(215, MID, 86, (BOT - TOP) / 2, -Math.PI / 2, -Math.PI / 2 - Math.PI * 2, 56)), // O, anticlockwise
    shift([
      [372, TOP],
      [372, BOT],
    ]), // P stem
    shift([[372, TOP], [430, TOP], ...ellipse(430, TOP + 68, 66, 68, -Math.PI / 2, Math.PI / 2, 24), [372, TOP + 136]]), // P bowl
    shift([
      [560, TOP],
      [560, BOT],
    ]), // E stem
    shift([
      [700, TOP],
      [566, TOP],
      [566, MID],
      [672, MID],
      [566, MID],
      [566, BOT],
      [710, BOT],
    ]), // E comb
    shift([
      [790, BOT],
      [790, TOP],
      [935, BOT],
      [935, TOP],
    ]), // N
  ];
  // Arc-length tables.
  const paths = strokes.map((pts) => {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, cum, length: cum[cum.length - 1] };
  });
  const pointAt = (path, s) => {
    const { pts, cum, length } = path;
    s = clamp(s, 0, length);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const k = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
  };

  // Chalk guides.
  const guideC = makeCanvas(CW, CH);
  {
    const g = guideC.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 1.5;
    g.setLineDash([10, 8]);
    for (const y of [TOP, BOT]) {
      g.beginPath();
      g.moveTo(60, y);
      g.lineTo(CW - 60, y);
      g.stroke();
    }
    g.strokeStyle = 'rgba(250,250,250,0.6)';
    g.lineWidth = 3;
    g.setLineDash([7, 6]);
    for (const p of paths) {
      g.beginPath();
      p.pts.forEach(([u, v], i) => (i ? g.lineTo(u, v) : g.moveTo(u, v)));
      g.stroke();
    }
  }

  const display = makeCanvas(CW, CH);
  const dg = display.getContext('2d');
  const tex = new THREE.CanvasTexture(display);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  let guides = true;
  let dirty = true;
  const redraw = () => {
    dg.drawImage(paintC, 0, 0);
    if (guides) {
      dg.globalAlpha = 0.55;
      dg.drawImage(guideC, 0, 0);
      dg.globalAlpha = 1;
    }
    tex.needsUpdate = true;
    dirty = false;
  };
  redraw();

  const color = L.ch4.week7.lettering.paint || SIGN_RED;
  let last = null;
  const seg = (a, b) => {
    // Main body + two thin bristle tracks, slightly offset.
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    pg.lineCap = 'round';
    pg.strokeStyle = color;
    pg.globalAlpha = 0.93;
    pg.lineWidth = 9;
    pg.beginPath();
    pg.moveTo(a[0], a[1]);
    pg.lineTo(b[0], b[1]);
    pg.stroke();
    pg.globalAlpha = 0.35;
    pg.lineWidth = 1.6;
    pg.strokeStyle = '#6e2018';
    for (const o of [-3, 2.6]) {
      pg.beginPath();
      pg.moveTo(a[0] + nx * o, a[1] + ny * o);
      pg.lineTo(b[0] + nx * o, b[1] + ny * o);
      pg.stroke();
    }
    pg.globalAlpha = 1;
    dirty = true;
  };

  // Mesh: backing + face, easel legs behind.
  const group = new THREE.Group();
  group.name = 'open-sign';
  const face = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, BOARD_H), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  face.position.set(0, BOARD_H / 2 + 0.02, 0.012);
  face.receiveShadow = true;
  face.name = 'open-sign-face';
  const back = new THREE.Mesh(bx(-BOARD_W / 2 - 0.01, BOARD_W / 2 + 0.01, 0.01, BOARD_H + 0.03, -0.01, 0.01), surf.timberDark);
  back.castShadow = true;
  group.add(face, back);
  const easel = merged(
    [rbox(0.025, 0.5, 0.02, -0.2, 0.24, -0.08, -0.3, 0, 0.06), rbox(0.025, 0.5, 0.02, 0.2, 0.24, -0.08, -0.3, 0, -0.06), rbox(0.5, 0.02, 0.05, 0, 0.012, 0.025)],
    surf.timber,
  );
  group.add(easel);
  // The liner brush: tip at the origin, handle up and toward the camera.
  const brush = new THREE.Group();
  brush.add(
    merged([new THREE.ConeGeometry(0.004, 0.018, 8).rotateX(Math.PI).translate(0, 0.009, 0)], B.mat('#5a2a20', { roughness: 0.8 }), { castShadow: false }),
    merged([new THREE.CylinderGeometry(0.0045, 0.0045, 0.018, 8).translate(0, 0.027, 0)], B.mat('#b9b8b0', { roughness: 0.3, metalness: 0.8 }), { castShadow: false }),
    merged([new THREE.CylinderGeometry(0.0032, 0.005, 0.2, 8).translate(0, 0.136, 0)], B.mat('#2c2a28', { roughness: 0.5 }), { castShadow: false }),
  );
  brush.rotation.set(0.95, 0, -0.55); // handle leans back toward the camera and to the right
  brush.visible = false;
  face.add(brush);

  const toLocal = (u, v, lift = 0) => new THREE.Vector3((u / CW - 0.5) * BOARD_W, (0.5 - v / CH) * BOARD_H, 0.002 + lift);

  return {
    group,
    face,
    easel,
    brush,
    canvas: paintC,
    paths,
    pointAt,
    size: [CW, CH],
    /** Paint from the last point to (u, v) in canvas px. */
    paintTo(u, v) {
      const p = [u, v];
      if (last) seg(last, p);
      last = p;
    },
    lift() {
      last = null;
    },
    setBrush(on, u = CW / 2, v = CH / 2, lift = 0) {
      brush.visible = on;
      brush.position.copy(toLocal(u, v, lift));
    },
    guides(on) {
      guides = on;
      dirty = true;
    },
    /** Paint a whole stroke perfectly (skip / fallback). */
    perfect(i) {
      const p = paths[i];
      last = null;
      for (let s = 0; s <= p.length; s += 6) {
        const q = pointAt(p, s);
        if (last) seg(last, q);
        last = q;
      }
      last = null;
    },
    /** Hugo's tiny "H.R." in the bottom-right corner, revealed left to right (k 0..1). */
    initials(k) {
      const text = L.ch4.signs.initials;
      pg.save();
      pg.font = 'italic 600 30px Georgia, "Times New Roman", serif';
      pg.textAlign = 'right';
      pg.textBaseline = 'alphabetic';
      const w = pg.measureText(text).width;
      const x1 = CW - 64;
      pg.beginPath();
      pg.rect(x1 - w - 2, CH - 90, (w + 4) * clamp(k, 0, 1), 60);
      pg.clip();
      pg.fillStyle = color;
      pg.fillText(text, x1, CH - 46);
      pg.restore();
      dirty = true;
    },
    /** A copy of the finished sign (primer + paint, no guides) for Ch5. */
    snapshot() {
      const c = makeCanvas(CW, CH);
      c.getContext('2d').drawImage(paintC, 0, 0);
      return c;
    },
    update() {
      if (dirty) redraw();
    },
    /** World position of a canvas point on the board face. */
    worldAt(u, v) {
      return face.localToWorld(toLocal(u, v));
    },
  };
}


// ------------------------------------------------------------------ the high window's glass

/** Glass for the high window: grey daylight, grime and slow rain streaks (no NaN paths). */
function windowGlassMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uRain: { value: 1 }, uBright: { value: 1.9 } },
    fog: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uRain, uBright;
      varying vec2 vUv;
      float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        vec2 uv = vUv;
        vec3 sky = mix(vec3(0.34, 0.37, 0.39), vec3(0.5, 0.52, 0.53), uv.y);
        // The building opposite, a dark band across the bottom.
        sky = mix(vec3(0.12, 0.12, 0.12), sky, smoothstep(0.18, 0.32, uv.y + 0.03 * sin(uv.x * 9.0)));
        float grime = vn(uv * vec2(9.0, 5.0)) * 0.6 + vn(uv * vec2(23.0, 13.0)) * 0.4;
        float edge = smoothstep(0.35, 0.0, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
        vec3 col = sky * (1.0 - 0.45 * grime - 0.35 * edge);
        col = mix(col, vec3(0.22, 0.18, 0.12), 0.25 * edge);
        // Rain trails sliding down the glass.
        float x = uv.x * 34.0;
        float id = floor(x);
        float fx = fract(x) - 0.5;
        float sp = 0.05 + 0.08 * h1(id * 1.7);
        float y = fract(uv.y + uTime * sp + h1(id * 9.1));
        float trail = (1.0 - smoothstep(0.0, 0.08, abs(fx))) * smoothstep(0.0, 0.25, y) * (1.0 - smoothstep(0.25, 0.9, y));
        col += vec3(0.10, 0.11, 0.12) * trail * step(0.55, h1(id * 3.3)) * uRain;
        gl_FragColor = vec4(max(col, vec3(0.0)) * uBright, 1.0);
      }`,
  });
}

/** One gradient blob shadow (shared by the figures). */
function blobTexture() {
  return B.canvasTexture(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(0,0,0,0.5)');
    grd.addColorStop(0.6, 'rgba(0,0,0,0.22)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
}

// ------------------------------------------------------------------ builder

export async function buildScene4(ctx) {
  const { assets } = ctx;
  const group = new THREE.Group();
  group.name = 'scene4';
  const surf = makeSurfaces(ctx);

  // The room, then (in parallel) the props and the practicals.
  const shell = buildShell(ctx, group, surf);
  const [props, lights] = await Promise.all([dress(ctx, group, surf), buildLights(ctx, group, surf)]);
  buildOldSigns(group, surf);

  const glassMat = windowGlassMaterial();
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0), glassMat);
  glass.position.set((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, -3.01);
  glass.name = 'high-window';
  group.add(glass);

  // ---- story objects
  const door = buildDoor(surf, ctx.materials);
  group.add(door.group);
  const tape = props.tape;

  const sbike = rigBike(finishBike(B.bicycle({ frame: '#8a2b22', rust: 0.2 }), 0.2));
  sbike.group.visible = false;
  group.add(sbike.group);
  // Hugo's own race bike (Week 7): team blue gone chalky, the chain cleaned bright.
  const raceBike = finishBike(B.bicycle({ frame: '#34506e', rust: 0.15 }), 0.1);
  raceBike.visible = false;
  raceBike.rotation.y = Math.PI / 2;
  raceBike.position.set(STAND.x, STAND.lift, STAND.z);
  group.add(raceBike);

  // The repair stand: a tripod, a telescoping post and a clamp head that grips the seat tube.
  {
    const sx = STAND.x - 0.28;
    const sz = STAND.z - 0.22;
    const head = [sx, 1.06, STAND.z];
    const parts = [
      ...[0.5, 2.6, 4.7].map((a) => tube([sx, 0.3, sz], [sx + Math.sin(a) * 0.42, 0.012, sz + Math.cos(a) * 0.42], 0.013)),
      bx(sx - 0.022, sx + 0.022, 0.05, 0.62, sz - 0.022, sz + 0.022),
      bx(sx - 0.016, sx + 0.016, 0.62, 1.04, sz - 0.016, sz + 0.016),
      bx(sx - 0.03, sx + 0.03, 0.58, 0.66, sz - 0.03, sz + 0.03), // the collar
      bx(sx - 0.018, sx + 0.018, 1.02, 1.08, sz, head[2] - 0.03), // arm
    ];
    group.add(merged(parts, surf.steelPainted, { name: 'repair-stand' }));
    group.add(
      merged(
        [bx(sx - 0.04, sx + 0.04, 1.0, 1.1, head[2] - 0.05, head[2] + 0.03), bx(sx - 0.07, sx - 0.04, 1.03, 1.07, head[2] - 0.01, head[2] + 0.01), rbox(0.1, 0.012, 0.012, sx + 0.06, 1.12, head[2] - 0.01, 0, 0, 0.3)],
        surf.black,
        { name: 'stand-clamp' },
      ),
    );
  }

  const board = buildBoard(surf);
  board.group.position.set(EASEL.x, BENCH.top, EASEL.z);
  board.group.visible = false;
  group.add(board.group);

  // ---- characters (released automatically at chapter end)
  const odile = assets.makeCharacter({ preset: 'odile', tint: '#9a7a4e', name: 'Odile' });
  const sami = assets.makeCharacter({ preset: 'sami', tint: '#c24a3a', name: 'Sami' });
  odile.root.position.set(1.7, 0, -1.25);
  sami.root.visible = false;
  sami.root.position.set(-OUT_X - 3, 0, 0);
  group.add(odile.root, sami.root);
  odile.play('idle');
  sami.play('idle');

  // Soft contact shadows so the figures sit on the floor where the bulb's shadow doesn't reach.
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: false });
  const blobGeo = new THREE.PlaneGeometry(0.85, 0.85).rotateX(-Math.PI / 2);
  const blobs = [ctx.player?.root, odile.root, sami.root].map((target) => {
    const m = new THREE.Mesh(blobGeo, blobMat);
    m.renderOrder = 1;
    m.userData.target = target;
    m.userData.noOcclude = true;
    group.add(m);
    return m;
  });

  // ---- particles: dust in the bulb's cone and the window shaft, rain past the garage door
  const wx = (WIN.x0 + WIN.x1) / 2;
  const dust = dustMotes(
    [
      { apex: [BULB.x, BULB.y - 0.05, BULB.z], dir: [-0.06, -1, 0.1], length: 2.3, radius: 1.7, count: 300, color: '#ffd4a0' },
      { apex: [wx, 2.6, BACK_Z], dir: [-0.15, -0.8, 0.85], length: 3.0, radius: 0.85, count: 170, color: '#c8d4dc' },
    ],
    { haze: 70 },
  );
  group.add(dust.object);
  const rain = rainBox([-OUT_X - 3.2, 0, GARAGE.z0 - 0.4], [-OUT_X - 0.1, GARAGE.h + 0.3, GARAGE.z1 + 0.4], { count: 260 });
  group.add(rain.object);

  // The camera rig: a softened, clamped stand-in for the player so the frame never swings into
  // the void beside the room.
  const camRig = new THREE.Object3D();
  camRig.name = 'cam-rig';
  group.add(camRig);

  // ------------------------------------------------------------------ live state
  let rainLevel = 1;
  let t = 0;
  const player = ctx.player;

  function setRain(level) {
    rainLevel = level;
    rain.level = level;
    surf.setWet(0.25 + 0.75 * level);
  }
  setRain(1);

  function update(dt, raw) {
    t += raw;
    // Camera rig: clamped and softened player position.
    if (player?.root) {
      const p = player.root.position;
      camRig.position.x = damp(camRig.position.x, clamp(p.x * 0.7, -1.1, 1.1), 5, raw);
      camRig.position.z = damp(camRig.position.z, clamp(p.z, -1.4, 1.9), 5, raw);
    }
    lights.update(dt, raw);
    glassMat.uniforms.uTime.value = t;
    glassMat.uniforms.uRain.value = rainLevel;
    dust.update(t, ctx.renderer, ctx.camera);
    rain.update(t);
    sbike.update(dt);
    board.update();
    for (const b of blobs) {
      const tg = b.userData.target;
      b.visible = !!tg && tg.visible;
      if (b.visible) b.position.set(tg.position.x, 0.006, tg.position.z);
    }
  }

  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const boardCenter = () => board.face.getWorldPosition(new THREE.Vector3());
  return {
    group,
    // Walkable rectangles (union), carved around the bench, trestles, stand, signs and Odile's corner.
    bounds: [
      { minX: -3.6, maxX: -1.0, minZ: -1.85, maxZ: 1.15 }, // in front of the bench, the left middle
      { minX: -4.1, maxX: -3.5, minZ: -1.45, maxZ: 1.15 }, // by the garage door (past the drums)
      { minX: -1.2, maxX: -0.55, minZ: -1.85, maxZ: -0.9 }, // by the vice
      { minX: -0.65, maxX: 3.75, minZ: -1.9, maxZ: -0.9 }, // behind the trestles
      { minX: 3.0, maxX: 3.8, minZ: -2.65, maxZ: -1.8 }, // the internal doorway threshold
      { minX: 1.6, maxX: 3.75, minZ: -0.95, maxZ: 0.6 }, // right of the trestles
      { minX: -1.5, maxX: 3.05, minZ: 0.5, maxZ: 2.6 }, // front middle
      { minX: -3.55, maxX: -1.4, minZ: 1.85, maxZ: 2.6 }, // in front of the bike stand
    ],
    spots: {
      spawn: [DOOR_X, -2.4],
      pegboard: [-2.6, -1.62],
      door: [TRESTLE.x, 0.72],
      frame: [DOOR_X, -2.05],
      bike: [-2.15, 0.45],
      bench: [-0.92, -1.42],
      oldSigns: [3.45, -0.75],
      radio: [2.8, 1.85],
      // Where people stand for the beats.
      hugoSand: [TRESTLE.x - 0.15, 0.62],
      hugoFrame: [DOOR_X, -2.32],
      hugoBench: [EASEL.x, -1.75],
      hugoBikeStand: [STAND.x - 0.55, STAND.z - 0.55],
      hugoSign: [2.45, -2.0],
      odileSign: [1.6, -1.35],
      odileTrestle: [1.75, -1.2],
      odileBench: [EASEL.x, -1.78],
      odileAside: [-2.42, -1.62],
      odileChair: [3.45, 1.05],
      samiParked: [-3.35, 0.6],
      samiHold: [STAND.x + 0.65, STAND.z - 0.45],
      samiOutside: [-OUT_X - 3.2, 0.1],
    },
    // Fixed camera shots for the craft beats ({pos, look, fov}).
    shots: {
      sand: { pos: [1.75, 1.85, 1.2], look: [TRESTLE.x, 0.76, TRESTLE.z], fov: 42 },
      paint: { pos: [1.4, 1.62, 0.95], look: [TRESTLE.x - 0.1, 0.77, TRESTLE.z], fov: 40 },
      frame: { pos: [1.85, 1.35, -1.25], look: [DOOR_X, 0.95, BACK_Z - 0.05], fov: 46 },
      // From behind and beside the rear wheel, so its sideways wander reads; wheel left of the ring.
      truing: { pos: [STAND.x - 1.4, 0.95, STAND.z + 0.55], look: [STAND.x - 0.4, STAND.lift + 0.37, STAND.z + 0.28], fov: 42 },
      samiIn: { pos: [-0.9, 1.95, 2.6], look: [-3.9, 0.95, 0.1], fov: 50 },
      threeShot: { pos: [0.9, 2.1, 2.9], look: [-2.0, 1.0, -0.4], fov: 52 },
      bikeTalk: { pos: [-0.9, 1.75, 2.9], look: [-2.6, 0.95, 1.0], fov: 48 },
      bench: { pos: [0.45, 1.7, -0.35], look: [EASEL.x + 0.2, 1.05, -2.35], fov: 46 },
      hungDoor: { pos: [1.9, 1.7, 0.2], look: [DOOR_X - 0.1, 1.3, BACK_Z], fov: 44 },
      lettering() {
        const c = boardCenter();
        return { pos: [c.x, c.y + 0.03, c.z + 0.88], look: [c.x, c.y, c.z], fov: 30 };
      },
    },
    update,
    door,
    bike: sbike,
    raceBike,
    board,
    tape,
    odile,
    sami,
    camRig,
    stool: props.stool,
    stand: STAND,
    doorX: DOOR_X,
    lights,
    /** Fluorescent tube: 'flicker' | 'on' | 'off'. */
    fluoro(mode) {
      lights.fluoro(mode);
    },
    /** Rain on the high window and in the street, 0..1 (the cobbles dry with it). */
    rain(level) {
      setRain(level);
    },
    takeSandpaper() {
      props.sandpaper.visible = false;
    },
    /** Move Odile's stool: [x, z] and a yaw, or null for its home at the end of the bench. */
    setStool(pos = null, rotY = 0.4) {
      const s = props.stool;
      s.position.set(pos ? pos[0] : STOOL.x, 0, pos ? pos[1] : STOOL.z);
      s.rotation.y = rotY;
    },
    /** Put Sami's bike on the work stand (side-on to the camera, front wheel toward +X). */
    bikeOnStand() {
      sbike.follow(null);
      const g = sbike.group;
      g.visible = true;
      g.rotation.set(0, Math.PI / 2, 0);
      g.position.set(STAND.x, STAND.lift, STAND.z);
    },
    /** Park Sami's bike on the floor at (x, z) facing rotY. */
    parkBike(x, z, rotY = Math.PI / 2) {
      sbike.follow(null);
      const g = sbike.group;
      g.visible = true;
      g.rotation.set(0, rotY, 0);
      g.position.set(x, 0, z);
    },
    /** The door goes back into its frame. */
    hangDoor() {
      door.hang();
    },
    /** The OPEN sign goes on the door he painted, facing +Z. */
    hangSign() {
      board.easel.visible = false;
      board.setBrush(false);
      board.group.visible = true;
      board.group.position.set(DOOR_X, 1.3, -D / 2 + 0.06);
      board.group.rotation.set(0, 0, 0);
    },
    showBoard(on) {
      board.group.visible = on;
    },
    /** World point on the rear wheel axle of the bike on the stand. */
    rearWheel: () => V3(STAND.x - 0.5, STAND.lift + 0.34, STAND.z),
    socket: shell.socket,
    floorSize: [W, D, H],
  };
}
