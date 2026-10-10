import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture } from '../build.js';
import { MOTIFS } from '../../characters/tattoo.js';

// Revision 4 props (docs/DESIGN-R4.md), procedural, no downloads. Conventions as in world/build.js:
// metres, y up, each builder returns a Group whose origin is its footprint centre on the floor (or,
// for wall pieces, the centre of its back face, facing +z), plus handles for whatever a chapter or a
// minigame animates. Shapes cast shadows; tiny parts don't. Every string a prop shows comes in
// through opts (callers pass L.* text; the defaults are only placeholders or proper names).
//
//   evidenceBoard   Hugo's flat: cork in a pine frame, pins, cards, photos, red string
//   waterBucket     galvanised, with a water surface (PUNCTURE)
//   innerTube       a bike inner tube, coiled or open (PUNCTURE), with its valve
//   kebabCounter    CHEZ GÉRARD: steel counter, doner spit and grill, bowls, flatbread stack
//   thermosSet      a thermos and two enamel cups (the 3 a.m. stakeout)
//   keyRing         a ring of keys, each with its own bit profile (KEY RING)
//   phone           Hugo's phone, with a screen a caller can redraw (PHOTO)
//   tattooMachine   a rotary pen machine on its cable, ink caps in a holder (ENCRE FINE's window)
//   encreFineSign   Jo's crooked hand-lettered shop sign, black on cream
//   flashSheetTexture / flashWall   sheets of fine-line flash pinned to a wall

const TAU = Math.PI * 2;

// A small seeded RNG so every prop is the same every run.
function rand(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const std = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...opts });

function mesh(geo, material, { shadow = true, pos, rot } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadow;
  m.receiveShadow = true;
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  return m;
}

/** Merge geometries into one mesh (strip to position / normal / uv first). */
function merged(geos, material, opts) {
  const list = geos.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
    return n;
  });
  const m = mesh(mergeGeometries(list, false), material, opts);
  for (const g of geos) g.dispose();
  for (const g of list) g.dispose();
  return m;
}

/** A tube along points (CatmullRom), closed or not. */
function tube(points, r, { seg = 64, radial = 8, closed = false } = {}) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.5), seg, r, radial, closed);
}

// ------------------------------------------------------------------ textures (shared, cached)

const _tex = new Map();
function cached(key, make) {
  if (!_tex.has(key)) {
    const t = make();
    t.userData.shared = true;
    _tex.set(key, t);
  }
  return _tex.get(key);
}

function corkTexture() {
  return cached('cork', () =>
    canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = '#a87a4c';
      g.fillRect(0, 0, w, h);
      const r = rand(7);
      for (let i = 0; i < 9000; i++) {
        const v = r();
        g.fillStyle = v < 0.45 ? `rgba(70,40,18,${0.25 + r() * 0.35})` : v < 0.8 ? `rgba(200,150,95,${0.2 + r() * 0.3})` : `rgba(40,22,10,${0.3 + r() * 0.3})`;
        const s = 1 + r() * 3.5;
        g.fillRect(r() * w, r() * h, s, s * (0.6 + r()));
      }
    }, { repeat: [2, 2] }),
  );
}

/** Galvanised steel: a mottled spangle (crystal patches) in mid greys. */
function spangleTexture() {
  return cached('spangle', () =>
    canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#9ea2a4';
      g.fillRect(0, 0, w, h);
      const r = rand(3);
      for (let i = 0; i < 700; i++) {
        const x = r() * w;
        const y = r() * h;
        const s = 4 + r() * 12;
        const v = 140 + Math.floor(r() * 50);
        g.fillStyle = `rgba(${v},${v + 4},${v + 6},0.4)`;
        g.beginPath();
        const n = 5 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * TAU + r() * 0.5;
          const rr = s * (0.6 + r() * 0.5);
          if (k === 0) g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          else g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        g.closePath();
        g.fill();
      }
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(90,80,60,${r() * 0.12})`; // dull water stains
        g.beginPath();
        g.arc(r() * w, r() * h, 4 + r() * 20, 0, TAU);
        g.fill();
      }
    }, { repeat: [4, 1.5] }),
  );
}

function paperGrain(g, w, h, base = '#efe6d2', seed = 5) {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const r = rand(seed);
  for (let i = 0; i < (w * h) / 60; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(120,100,70,0.05)' : 'rgba(255,255,250,0.06)';
    g.fillRect(r() * w, r() * h, 1 + r() * 2, 1);
  }
}

// ------------------------------------------------------------------ the evidence board

/**
 * Hugo's corkboard (Ch6 DEDUCTION). A w x h board on the wall (origin: back centre, facing +z).
 * opts.cards: [{ x, y (m from the board's centre), w=0.1, h=0.07, kind: 'card'|'photo'|'note',
 *   text (short label, from L.*), draw(g, w, h) (custom canvas art), rot (rad), pin colour }]
 * opts.strings: [[i, j], ...] card indices joined by red string. With no cards, a few blank cards,
 * two photos and a street map (the board before the case).
 * Returns { group, cards: [Mesh] (each with userData.pin, a world-space pin point via
 * cardPin(i)), addString(a, b) -> Mesh, pinAt(x, y) -> Vector3 (local), board }.
 */
export function evidenceBoard({ width = 1.2, height = 0.85, cards, strings = [], seed = 4 } = {}) {
  const group = new THREE.Group();
  group.name = 'evidence-board';
  const r = rand(seed);
  const D = 0.018; // cork thickness
  const F = 0.035; // frame width
  const wood = std('#b08a5c', { roughness: 0.7 });
  const cork = std('#ffffff', { map: corkTexture(), roughness: 0.95 });
  const board = mesh(new THREE.BoxGeometry(width, height, D), cork, { pos: [0, 0, D / 2] });
  group.add(board);
  const frame = [];
  for (const sy of [-1, 1]) frame.push(new THREE.BoxGeometry(width + F * 2, F, D + 0.012).translate(0, sy * (height / 2 + F / 2), (D + 0.012) / 2));
  for (const sx of [-1, 1]) frame.push(new THREE.BoxGeometry(F, height, D + 0.012).translate(sx * (width / 2 + F / 2), 0, (D + 0.012) / 2));
  group.add(merged(frame, wood));

  const front = D + 0.001;
  const list =
    cards ||
    [
      { x: -0.4, y: 0.22, kind: 'photo', rot: -0.06 },
      { x: -0.12, y: 0.25, kind: 'card', rot: 0.04 },
      { x: 0.2, y: 0.2, kind: 'photo', rot: 0.08 },
      { x: 0.42, y: 0.12, kind: 'card', rot: -0.05 },
      { x: -0.3, y: -0.18, kind: 'map', w: 0.3, h: 0.22, rot: 0.02 },
      { x: 0.12, y: -0.15, kind: 'card', rot: -0.07 },
      { x: 0.38, y: -0.24, kind: 'note', rot: 0.1 },
    ];
  const cardMeshes = [];
  const pins = [];
  const pinGeo = new THREE.SphereGeometry(0.0055, 10, 8);
  const pinNeedle = new THREE.CylinderGeometry(0.0009, 0.0009, 0.012, 5).rotateX(Math.PI / 2);
  list.forEach((c, i) => {
    const kind = c.kind || 'card';
    const w = c.w ?? (kind === 'photo' ? 0.1 : kind === 'note' ? 0.075 : 0.11);
    const h = c.h ?? (kind === 'photo' ? 0.12 : kind === 'note' ? 0.075 : 0.07);
    const tex = canvasTexture(Math.round(w * 2400), Math.round(h * 2400), (g, cw, ch) => {
      if (kind === 'photo') {
        // A print with a white border; a grey street scene unless the caller draws one.
        g.fillStyle = '#f2f0ea';
        g.fillRect(0, 0, cw, ch);
        const b = cw * 0.07;
        g.save();
        g.beginPath();
        g.rect(b, b, cw - b * 2, ch - b * 3.2);
        g.clip();
        if (c.draw) c.draw(g, cw, ch);
        else {
          const sky = g.createLinearGradient(0, 0, 0, ch);
          sky.addColorStop(0, '#8d949a');
          sky.addColorStop(1, '#3d4246');
          g.fillStyle = sky;
          g.fillRect(0, 0, cw, ch);
          g.fillStyle = 'rgba(30,32,36,0.8)';
          for (let k = 0; k < 4; k++) g.fillRect(b + r() * cw * 0.8, ch * (0.25 + r() * 0.3), cw * (0.1 + r() * 0.2), ch);
        }
        g.restore();
        if (c.text) {
          g.fillStyle = '#2a2a30';
          g.font = `${Math.round(ch * 0.07)}px "Bradley Hand", "Segoe Print", cursive`;
          g.textAlign = 'center';
          g.fillText(c.text, cw / 2, ch - b * 0.8);
        }
      } else if (kind === 'map') {
        paperGrain(g, cw, ch, '#e9e3d0', 9);
        g.strokeStyle = 'rgba(70,70,80,0.6)';
        g.lineWidth = 3;
        for (let k = 0; k < 7; k++) {
          g.beginPath();
          g.moveTo(r() * cw, 0);
          g.lineTo(r() * cw, ch);
          g.stroke();
          g.beginPath();
          g.moveTo(0, r() * ch);
          g.lineTo(cw, r() * ch);
          g.stroke();
        }
        g.strokeStyle = '#b02a2a';
        g.lineWidth = 4;
        g.beginPath();
        g.arc(cw * 0.55, ch * 0.45, ch * 0.12, 0, TAU);
        g.stroke();
        if (c.draw) c.draw(g, cw, ch);
      } else {
        // An index card (ruled, red top line) or a yellow sticky note, in Hugo's capitals.
        paperGrain(g, cw, ch, kind === 'note' ? '#e9d36a' : '#f3efe4', 11 + i);
        if (kind === 'card') {
          g.strokeStyle = 'rgba(80,120,170,0.45)';
          g.lineWidth = 2;
          for (let y = ch * 0.38; y < ch; y += ch * 0.15) {
            g.beginPath();
            g.moveTo(0, y);
            g.lineTo(cw, y);
            g.stroke();
          }
          g.strokeStyle = 'rgba(190,60,60,0.6)';
          g.beginPath();
          g.moveTo(0, ch * 0.24);
          g.lineTo(cw, ch * 0.24);
          g.stroke();
        }
        if (c.draw) c.draw(g, cw, ch);
        if (c.text) {
          g.fillStyle = '#1f2430';
          let fs = ch * 0.2;
          g.font = `600 ${fs}px "Marker Felt", "Comic Sans MS", sans-serif`;
          const lines = String(c.text).split('\n');
          while (fs > 8 && Math.max(...lines.map((l) => g.measureText(l).width)) > cw * 0.9) {
            fs *= 0.9;
            g.font = `600 ${fs}px "Marker Felt", "Comic Sans MS", sans-serif`;
          }
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          lines.forEach((l, k) => g.fillText(l, cw / 2, ch * 0.55 + (k - (lines.length - 1) / 2) * fs * 1.15));
        }
      }
    });
    const paper = std('#ffffff', { map: tex, roughness: kind === 'photo' ? 0.45 : 0.9 });
    const m = mesh(new THREE.PlaneGeometry(w, h), paper, { shadow: false, pos: [c.x, c.y, front + i * 0.0004], rot: [0, 0, c.rot || 0] });
    m.name = 'card-' + i;
    group.add(m);
    cardMeshes.push(m);
    // A push pin near the top (slightly off-centre, as pinned by hand).
    const px = c.x + Math.sin(-(c.rot || 0)) * h * 0.4 + (r() - 0.5) * 0.01;
    const py = c.y + Math.cos(c.rot || 0) * h * 0.4;
    const col = c.pin || ['#c8302a', '#2c5aa8', '#e0b02a', '#2f8a4a'][i % 4];
    const head = mesh(pinGeo, std(col, { roughness: 0.35 }), { shadow: false, pos: [px, py, front + 0.012] });
    const needle = mesh(pinNeedle, std('#b8b8b8', { metalness: 1, roughness: 0.3 }), { shadow: false, pos: [px, py, front + 0.006] });
    group.add(head, needle);
    pins.push(new THREE.Vector3(px, py, front + 0.006));
    m.userData.pin = pins[i];
  });

  const stringMat = std('#b81e22', { roughness: 0.7 });
  /** Red string between two cards' pins (indices), or two local points: a slight sag. */
  const addString = (a, b) => {
    const p = typeof a === 'number' ? pins[a] : a;
    const q = typeof b === 'number' ? pins[b] : b;
    if (!p || !q) return null;
    const mid = p.clone().lerp(q, 0.5);
    mid.y -= p.distanceTo(q) * 0.03;
    mid.z += 0.002;
    const s = mesh(tube([p, mid, q], 0.0011, { seg: 12, radial: 4 }), stringMat, { shadow: false });
    s.name = 'string';
    group.add(s);
    return s;
  };
  for (const [a, b] of strings) addString(a, b);
  /** Local point on the cork surface at (x, y) from the board's centre. */
  const pinAt = (x, y) => new THREE.Vector3(x, y, front);
  return { group, board, cards: cardMeshes, pins, addString, pinAt };
}

// ------------------------------------------------------------------ the water bucket

/**
 * A galvanised bucket (about 10 l), with a wire handle and a water surface at `fill` (0..1).
 * Returns { group, water (Mesh: move water.position.y / scale), waterY, radius (at the water line) }.
 */
export function waterBucket({ fill = 0.72, height = 0.27, top = 0.15, bottom = 0.11, handleUp = false } = {}) {
  const group = new THREE.Group();
  group.name = 'water-bucket';
  const metal = std('#ffffff', { map: spangleTexture(), metalness: 0.75, roughness: 0.42 });
  // Wall: a lathe with two pressed ridges and a rolled rim.
  const prof = [];
  const R = (y) => bottom + (top - bottom) * (y / height);
  prof.push(new THREE.Vector2(0.001, 0.004), new THREE.Vector2(bottom - 0.004, 0.004), new THREE.Vector2(bottom, 0.0));
  for (let i = 1; i <= 24; i++) {
    const y = (i / 24) * height;
    const ridge = Math.exp(-Math.pow((y - height * 0.3) / 0.006, 2)) + Math.exp(-Math.pow((y - height * 0.72) / 0.006, 2));
    prof.push(new THREE.Vector2(R(y) + ridge * 0.005, y));
  }
  const wall = new THREE.LatheGeometry(prof, 40);
  group.add(mesh(wall, new THREE.MeshStandardMaterial({ map: metal.map, metalness: 0.75, roughness: 0.42, side: THREE.DoubleSide })));
  group.add(mesh(new THREE.TorusGeometry(top + 0.002, 0.0045, 8, 48).rotateX(Math.PI / 2).translate(0, height, 0), metal));
  // Ears and the wire handle (resting down on one side unless handleUp).
  const earGeo = [];
  for (const s of [-1, 1]) earGeo.push(new THREE.BoxGeometry(0.006, 0.03, 0.022).translate(s * (top - 0.001), height - 0.022, 0));
  group.add(merged(earGeo, metal, { shadow: false }));
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI;
    const x = Math.cos(a) * (top + 0.004);
    const lift = Math.sin(a) * (top * 0.9);
    pts.push(handleUp ? new THREE.Vector3(x, height - 0.02 + lift, 0) : new THREE.Vector3(x, height - 0.02 + lift * 0.18, lift * 0.98));
  }
  group.add(mesh(tube(pts, 0.0022, { seg: 32, radial: 6 }), std('#8a8e90', { metalness: 1, roughness: 0.35 }), { shadow: false }));
  // Water: a dark, glossy disc (it reflects the room), a touch below the wall so it never z-fights.
  const waterY = Math.max(0.02, height * fill);
  const water = mesh(new THREE.CircleGeometry(R(waterY) - 0.001, 40).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#2a3238', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.88, clearcoat: 1, clearcoatRoughness: 0.03 }), { shadow: false, pos: [0, waterY, 0] });
  water.name = 'water';
  group.add(water);
  return { group, water, waterY, radius: R(waterY) };
}

// ------------------------------------------------------------------ the inner tube

/**
 * A 700c road inner tube in matte black rubber. shape 'coil' (folded in three loops, as it comes
 * out of a saddle bag) or 'ring' (inflated, a 0.31 m torus). The valve (Presta) sticks out.
 * Returns { group, tube (Mesh), valve (Mesh), curve (the 'ring' centre line, for the puncture game) }.
 */
export function innerTube({ shape = 'coil', radius = 0.31, r = 0.012 } = {}) {
  const group = new THREE.Group();
  group.name = 'inner-tube';
  const rubber = std('#1c1c1e', { roughness: 0.62 });
  let curve;
  let geo;
  if (shape === 'ring') {
    curve = new THREE.EllipseCurve(0, 0, radius, radius);
    geo = new THREE.TorusGeometry(radius, r, 10, 96).rotateX(Math.PI / 2).translate(0, r, 0);
  } else {
    // Three stacked loops of a slightly flattened tube, the coil a little untidy.
    const pts = [];
    const rr = rand(2);
    const loops = 3;
    const n = 96;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = t * TAU * loops;
      const R = 0.1 + Math.sin(a * 0.5) * 0.006 + (rr() - 0.5) * 0.003;
      pts.push(new THREE.Vector3(Math.cos(a) * R, r * 0.8 + t * r * 2 * (loops - 1) * 0.85, Math.sin(a) * R * 0.92));
    }
    curve = new THREE.CatmullRomCurve3(pts);
    geo = new THREE.TubeGeometry(curve, 220, r * 0.85, 8, false);
    geo.scale(1, 0.7, 1); // squashed: a deflated tube
  }
  const t = mesh(geo, rubber);
  t.name = 'tube';
  group.add(t);
  // Presta valve: a brass-silver stem and a knurled nut, sticking out of the loop.
  const valve = new THREE.Group();
  const stem = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.048, 8).translate(0, 0.024, 0), std('#c9c4b4', { metalness: 1, roughness: 0.3 }), { shadow: false });
  const nut = mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.006, 10).translate(0, 0.018, 0), std('#7c7e82', { metalness: 1, roughness: 0.4 }), { shadow: false });
  const tip = mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.008, 6).translate(0, 0.052, 0), std('#a8a8a4', { metalness: 1, roughness: 0.3 }), { shadow: false });
  valve.add(stem, nut, tip);
  const p0 = shape === 'ring' ? new THREE.Vector3(radius, r, 0) : curve.getPoint(0.02);
  valve.position.copy(p0);
  valve.rotation.z = shape === 'ring' ? -Math.PI / 2 : -1.2;
  valve.name = 'valve';
  group.add(valve);
  return { group, tube: t, valve, curve };
}

// ------------------------------------------------------------------ the kebab counter

function meatTexture() {
  return cached('doner', () =>
    canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#7a4424';
      g.fillRect(0, 0, w, h);
      const r = rand(13);
      // Shaved strips and charred edges, running round the cone.
      for (let y = 0; y < h; y += 3) {
        g.fillStyle = `rgba(${150 + r() * 50},${80 + r() * 30},${40 + r() * 20},${0.3 + r() * 0.4})`;
        g.fillRect(0, y, w, 2);
      }
      for (let i = 0; i < 900; i++) {
        g.fillStyle = r() < 0.6 ? `rgba(40,18,8,${0.3 + r() * 0.4})` : `rgba(210,150,90,${0.3 + r() * 0.3})`;
        g.fillRect(r() * w, r() * h, 2 + r() * 10, 1 + r() * 2);
      }
    }, { repeat: [2, 1] }),
  );
}

function brushedSteel() {
  return cached('steel', () =>
    canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#b4b8bc';
      g.fillRect(0, 0, w, h);
      const r = rand(17);
      for (let i = 0; i < 1400; i++) {
        g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '40,44,48'},${r() * 0.08})`;
        g.fillRect(r() * w, r() * h, 20 + r() * 80, 1);
      }
    }, { repeat: [2, 1] }),
  );
}

/**
 * CHEZ GÉRARD's counter: a brushed-steel counter (`width` x 0.95 m, 0.6 deep), a vertical doner
 * spit with its cone of meat in front of a glowing grill, a row of bowls (lettuce, tomato, onion,
 * red cabbage, white sauce, chilli) and a stack of flatbreads. The customer side is +z.
 * Returns { group, spit (Group: rotate .rotation.y), cone, grill (emissive material), bowls: {name: Mesh},
 *   breads (Group), counterTop (y) }.
 */
export function kebabCounter({ width = 1.8, depth = 0.6, height = 0.95 } = {}) {
  const group = new THREE.Group();
  group.name = 'kebab-counter';
  const steel = std('#ffffff', { map: brushedSteel(), metalness: 0.85, roughness: 0.35 });
  const dark = std('#2a2c30', { roughness: 0.6 });
  // Body: a steel cabinet with a recessed kick plate and a thicker top with a bullnose edge.
  group.add(mesh(new THREE.BoxGeometry(width, height - 0.12, depth - 0.04).translate(0, 0.08 + (height - 0.12) / 2, 0), steel));
  group.add(mesh(new THREE.BoxGeometry(width - 0.04, 0.08, depth - 0.1).translate(0, 0.04, -0.02), dark));
  const topY = height;
  group.add(mesh(new RoundedBoxGeometry(width + 0.04, 0.04, depth + 0.04, 2, 0.012).translate(0, topY - 0.02, 0), steel));
  // A glass sneeze guard over the bowls on the customer side.
  const glass = new THREE.MeshPhysicalMaterial({ color: '#e8f0f0', roughness: 0.05, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false });
  const guard = mesh(new THREE.PlaneGeometry(width * 0.62, 0.26), glass, { shadow: false, pos: [width * 0.14, topY + 0.22, depth / 2 - 0.02], rot: [-0.35, 0, 0] });
  group.add(guard);
  group.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, width * 0.62, 10).rotateZ(Math.PI / 2).translate(width * 0.14, topY + 0.22 + 0.13 * Math.cos(0.35), depth / 2 - 0.02 + 0.13 * Math.sin(0.35)), steel, { shadow: false })); // its rail

  // The spit on the left: a base plate, the rod, the cone of meat (wider at the top), a cap.
  const spit = new THREE.Group();
  spit.name = 'spit';
  spit.position.set(-width / 2 + 0.24, topY, -0.06);
  const H = 0.5;
  const prof = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const rr = 0.07 + t * 0.06 + Math.sin(t * 9) * 0.004;
    prof.push(new THREE.Vector2(rr, 0.06 + t * H));
  }
  prof.unshift(new THREE.Vector2(0.004, 0.06));
  prof.push(new THREE.Vector2(0.004, 0.06 + H));
  const cone = mesh(new THREE.LatheGeometry(prof, 28), std('#ffffff', { map: meatTexture(), roughness: 0.7 }));
  cone.name = 'cone';
  spit.add(cone);
  spit.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, H + 0.24, 8).translate(0, (H + 0.24) / 2, 0), steel, { shadow: false }));
  spit.add(mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.02, 24).translate(0, 0.05, 0), steel));
  group.add(spit);
  group.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 28).translate(spit.position.x, topY + 0.015, spit.position.z), dark)); // drip tray
  // The vertical grill behind the spit: dark housing, glowing elements.
  const grillMat = new THREE.MeshStandardMaterial({ color: '#2a1a12', emissive: '#ff6a1a', emissiveIntensity: 2.2, roughness: 0.6 });
  const gx = spit.position.x;
  group.add(mesh(new THREE.BoxGeometry(0.34, 0.66, 0.06).translate(gx, topY + 0.36, -0.28), dark));
  const bars = [];
  for (let i = 0; i < 5; i++) bars.push(new THREE.BoxGeometry(0.24, 0.018, 0.012).translate(gx, topY + 0.12 + i * 0.11, -0.245));
  const grill = merged(bars, grillMat, { shadow: false });
  grill.name = 'grill';
  group.add(grill);

  // Bowls in a row (steel inserts), with their fillings as lumpy instanced bits.
  const bowls = {};
  const fillings = [
    ['salade', '#6f9a3a', 'leaf'],
    ['tomate', '#c0362a', 'cube'],
    ['oignon', '#e6dccb', 'ring'],
    ['chou', '#6a2a5a', 'leaf'],
    ['sauce', '#eee8d8', 'cream'],
    ['piment', '#8a1c10', 'cream'],
  ];
  const bw = Math.min(0.15, (width * 0.6) / fillings.length);
  const r = rand(21);
  fillings.forEach(([name, col, kind], i) => {
    const x = -width / 2 + 0.5 + i * (bw + 0.012);
    const b = new THREE.Group();
    b.position.set(x, topY, 0.12);
    b.add(mesh(new THREE.CylinderGeometry(bw / 2, bw / 2 - 0.012, 0.07, 24, 1, true).translate(0, 0.035, 0), new THREE.MeshStandardMaterial({ map: steel.map, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide }), { shadow: false }));
    b.add(mesh(new THREE.TorusGeometry(bw / 2, 0.003, 6, 24).rotateX(Math.PI / 2).translate(0, 0.07, 0), steel, { shadow: false }));
    const fm = std(col, { roughness: kind === 'cream' ? 0.25 : 0.7 });
    if (kind === 'cream') {
      b.add(mesh(new THREE.SphereGeometry(bw / 2 - 0.006, 20, 8, 0, TAU, 0, Math.PI / 2).scale(1, 0.25, 1).translate(0, 0.055, 0), fm, { shadow: false }));
    } else {
      const geo = kind === 'leaf' ? new THREE.BoxGeometry(0.03, 0.003, 0.012) : kind === 'ring' ? new THREE.TorusGeometry(0.01, 0.0025, 4, 10).rotateX(Math.PI / 2) : new THREE.BoxGeometry(0.012, 0.01, 0.012);
      // A mound of bits on a bed of the same colour.
      b.add(mesh(new THREE.SphereGeometry(bw / 2 - 0.008, 16, 6, 0, TAU, 0, Math.PI / 2).scale(1, 0.3, 1).translate(0, 0.048, 0), fm, { shadow: false }));
      const n = 40;
      const inst = new THREE.InstancedMesh(geo, fm, n);
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      for (let k = 0; k < n; k++) {
        const a = r() * TAU;
        const d = Math.sqrt(r()) * (bw / 2 - 0.016);
        q.setFromEuler(new THREE.Euler(r() * 0.8, r() * TAU, r() * 0.8));
        m4.compose(new THREE.Vector3(Math.cos(a) * d, 0.058 + r() * 0.012 - d * 0.2, Math.sin(a) * d), q, new THREE.Vector3(1, 1, 1));
        inst.setMatrixAt(k, m4);
      }
      inst.receiveShadow = true;
      b.add(inst);
    }
    b.name = name;
    bowls[name] = b;
    group.add(b);
  });

  // Flatbreads: a slightly irregular stack on a board at the right end.
  const breads = new THREE.Group();
  breads.name = 'breads';
  breads.position.set(width / 2 - 0.2, topY, 0.04);
  breads.add(mesh(new RoundedBoxGeometry(0.3, 0.02, 0.3, 2, 0.006).translate(0, 0.01, 0), std('#a87c4a', { roughness: 0.8 })));
  const breadTex = cached('bread', () =>
    canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = '#e2c48c';
      g.fillRect(0, 0, w, h);
      const rr = rand(31);
      for (let i = 0; i < 70; i++) {
        g.fillStyle = `rgba(140,90,40,${0.2 + rr() * 0.4})`;
        g.beginPath();
        g.arc(rr() * w, rr() * h, 1 + rr() * 4, 0, TAU);
        g.fill();
      }
    }),
  );
  const breadMat = std('#ffffff', { map: breadTex, roughness: 0.85 });
  for (let k = 0; k < 9; k++) {
    const b = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.007, 24).scale(1, 1, 0.92), breadMat, { shadow: k === 8, pos: [(r() - 0.5) * 0.02, 0.024 + k * 0.0075, (r() - 0.5) * 0.02], rot: [0, r() * TAU, 0] });
    breads.add(b);
  }
  group.add(breads);
  return { group, spit, cone, grill, grillMaterial: grillMat, bowls, breads, counterTop: topY };
}

// ------------------------------------------------------------------ thermos and cups

/**
 * A steel thermos (cap-cup on) and two enamel camping mugs, one with coffee. On the ground or a
 * bench; the thermos at the origin, the mugs beside it (+x). Returns { group, thermos, cups: [Mesh, Mesh] }.
 */
export function thermosSet({ color = '#2f5a48', cupColors = ['#e8e4d8', '#3a5a8a'], coffee = [true, false] } = {}) {
  const group = new THREE.Group();
  group.name = 'thermos-set';
  const body = std(color, { metalness: 0.4, roughness: 0.45 });
  const steel = std('#c4c6c8', { metalness: 1, roughness: 0.3 });
  const thermos = new THREE.Group();
  thermos.name = 'thermos';
  const prof = [new THREE.Vector2(0, 0), new THREE.Vector2(0.04, 0), new THREE.Vector2(0.043, 0.006), new THREE.Vector2(0.043, 0.24), new THREE.Vector2(0.036, 0.26), new THREE.Vector2(0.03, 0.27)];
  thermos.add(mesh(new THREE.LatheGeometry(prof, 28), body));
  thermos.add(mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.012, 28).translate(0, 0.012, 0), steel, { shadow: false })); // foot band
  thermos.add(mesh(new THREE.CylinderGeometry(0.046, 0.044, 0.07, 28).translate(0, 0.27 + 0.035, 0), body)); // cap-cup
  thermos.add(mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.008, 28).translate(0, 0.3, 0), steel, { shadow: false }));
  const handle = tube([new THREE.Vector3(0.043, 0.07, 0), new THREE.Vector3(0.068, 0.1, 0), new THREE.Vector3(0.068, 0.2, 0), new THREE.Vector3(0.043, 0.23, 0)], 0.006, { seg: 16, radial: 6 });
  thermos.add(mesh(handle, std('#1e2022', { roughness: 0.6 }), { shadow: false }));
  group.add(thermos);
  const cups = [];
  cupColors.forEach((c, i) => {
    const cup = new THREE.Group();
    cup.name = 'cup-' + i;
    const enamel = std(c, { roughness: 0.3 });
    const p = [new THREE.Vector2(0, 0), new THREE.Vector2(0.036, 0), new THREE.Vector2(0.04, 0.075), new THREE.Vector2(0.037, 0.075), new THREE.Vector2(0.033, 0.006), new THREE.Vector2(0, 0.006)];
    cup.add(mesh(new THREE.LatheGeometry(p, 24), new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, side: THREE.DoubleSide })));
    cup.add(mesh(new THREE.TorusGeometry(0.0395, 0.002, 6, 24).rotateX(Math.PI / 2).translate(0, 0.075, 0), std('#20242a', { roughness: 0.4 }), { shadow: false })); // the dark enamel rim
    cup.add(mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 12, Math.PI).rotateZ(-Math.PI / 2).translate(0.04, 0.045, 0), enamel, { shadow: false }));
    if (coffee[i]) cup.add(mesh(new THREE.CircleGeometry(0.036, 20).rotateX(-Math.PI / 2).translate(0, 0.058, 0), std('#2a160c', { roughness: 0.1 }), { shadow: false }));
    cup.position.set(0.11 + i * 0.1, 0, i ? 0.05 : -0.02);
    cup.rotation.y = i ? 2.2 : -0.6;
    group.add(cup);
    cups.push(cup);
  });
  return { group, thermos, cups };
}

// ------------------------------------------------------------------ the key ring

/**
 * A steel split ring with `count` keys hanging from it (the bike shop's 14). Each key is an
 * extruded shape (a bow, a shoulder, a blade cut with its own bit pattern) in brass or nickel; the
 * ring lies in the x/y plane (facing +z), centre at the origin, keys hanging down (rotate the
 * group or turn `ring.rotation.z` to spin them round). layout 'hang': bunched at the bottom, pulled
 * down by their weight; 'fan': spread right round the ring, every profile visible (KEY RING).
 * Returns { group, ring (Group: rotate .rotation.z), keys: [Mesh] (userData.bits: 5 cut depths 0..3,
 * userData.angle: its place on the ring) }.
 */
export function keyRing({ count = 14, radius = 0.028, seed = 52, layout = 'hang' } = {}) {
  const group = new THREE.Group();
  group.name = 'key-ring';
  const r = rand(seed);
  const ring = new THREE.Group();
  ring.name = 'ring';
  ring.add(mesh(new THREE.TorusGeometry(radius, 0.0016, 6, 48), std('#b8babc', { metalness: 1, roughness: 0.3 }), { shadow: false }));
  const brass = std('#c9a54e', { metalness: 1, roughness: 0.38 });
  const nickel = std('#c8c8c4', { metalness: 1, roughness: 0.32 });
  const keys = [];
  for (let i = 0; i < count; i++) {
    const bits = Array.from({ length: 5 }, () => Math.floor(r() * 4));
    const s = new THREE.Shape();
    // The blade down the -y axis with the bits on its +x edge, then the bow (round or square) with
    // the ring hole.
    const L = 0.038 + r() * 0.012;
    const bowR = 0.01 + r() * 0.003;
    const square = r() < 0.4;
    s.moveTo(0.0045, -0.003);
    s.lineTo(0.0045, -L * 0.18);
    // Bits: steps along the blade's +x edge.
    const step = (L * 0.7) / bits.length;
    bits.forEach((b, k) => {
      const y = -L * 0.2 - k * step;
      const x = 0.0045 - b * 0.0012;
      s.lineTo(x, y - step * 0.2);
      s.lineTo(x, y - step * 0.8);
    });
    s.lineTo(0.0012, -L);
    s.lineTo(-0.0035, -L * 0.94);
    s.lineTo(-0.0035, -0.003);
    if (square) {
      s.lineTo(-bowR, 0);
      s.lineTo(-bowR, bowR * 1.6);
      s.lineTo(bowR, bowR * 1.6);
      s.lineTo(bowR, 0);
    } else {
      s.absarc(0, bowR * 0.8, bowR, -Math.PI / 2 - 0.62, -Math.PI / 2 + 0.62, true); // over the top
    }
    s.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, bowR * (square ? 1.1 : 1.15), 0.0028, 0, TAU, true);
    s.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.0022, bevelEnabled: true, bevelThickness: 0.0004, bevelSize: 0.0004, bevelSegments: 1, curveSegments: 10 });
    geo.translate(0, -bowR * (square ? 1.1 : 1.15), -0.0011); // the hole at the origin
    const k = mesh(geo, r() < 0.55 ? brass : nickel, { shadow: false });
    const fan = layout === 'fan';
    const a = fan ? -Math.PI / 2 + (i / count) * TAU : -Math.PI / 2 + ((i - (count - 1) / 2) / count) * 1.8;
    k.position.set(Math.cos(a) * radius, Math.sin(a) * radius, (((i % 3) - 1) * 0.0025));
    // Radial on a fan; hanging, each key swings most of the way down under its own weight.
    k.rotation.z = (a + Math.PI / 2) * (fan ? 1 : 0.45) + (r() - 0.5) * 0.12;
    k.userData.bits = bits;
    k.userData.angle = a;
    k.name = 'key-' + i;
    ring.add(k);
    keys.push(k);
  }
  group.add(ring);
  return { group, ring, keys };
}

// ------------------------------------------------------------------ Hugo's phone

/**
 * Hugo's phone, lying flat (screen up, top towards -z). opts.screen: draw(g, w, h) for the screen
 * canvas (360 x 760); the default is a lock screen showing opts.time and opts.lines (strings from
 * L.*). Returns { group, screen (Mesh), redraw(draw), lit(on) }.
 */
export function phone({ screen, time = '03:12', lines = [], color = '#23262b', cracked = true } = {}) {
  const group = new THREE.Group();
  group.name = 'phone';
  const W = 0.072;
  const H = 0.152;
  group.add(mesh(new RoundedBoxGeometry(W, 0.008, H, 3, 0.0035).translate(0, 0.004, 0), std(color, { metalness: 0.5, roughness: 0.35 })));
  // The camera bump on the back (seen when Hugo holds it up).
  group.add(mesh(new RoundedBoxGeometry(0.026, 0.002, 0.026, 2, 0.003).translate(-W / 2 + 0.018, -0.0005, -H / 2 + 0.018), std('#1a1c20', { roughness: 0.3 }), { shadow: false }));
  const c = document.createElement('canvas');
  c.width = 360;
  c.height = 760;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const lockScreen = (gg, w, h) => {
    const bg = gg.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#1e2a3c');
    bg.addColorStop(1, '#0c1018');
    gg.fillStyle = bg;
    gg.fillRect(0, 0, w, h);
    gg.fillStyle = 'rgba(255,255,255,0.92)';
    gg.textAlign = 'center';
    gg.font = '200 96px "Helvetica Neue", Arial, sans-serif';
    gg.fillText(time, w / 2, 180);
    // Notifications: word-wrapped to two lines, an ellipsis past that.
    gg.font = '500 22px "Helvetica Neue", Arial, sans-serif';
    let y = 270;
    for (const l of lines) {
      const rows = [''];
      for (const word of String(l).split(' ')) {
        const t = rows[rows.length - 1] ? rows[rows.length - 1] + ' ' + word : word;
        if (gg.measureText(t).width <= w - 84 || !rows[rows.length - 1]) rows[rows.length - 1] = t;
        else if (rows.length < 2) rows.push(word);
        else {
          rows[1] = rows[1].replace(/\s*\S*$/, '') + '…';
          break;
        }
      }
      const hh = 34 + rows.length * 28;
      gg.fillStyle = 'rgba(235,240,248,0.16)';
      gg.beginPath();
      gg.roundRect(20, y, w - 40, hh, 18);
      gg.fill();
      gg.fillStyle = 'rgba(255,255,255,0.88)';
      gg.textAlign = 'left';
      rows.forEach((row, k) => gg.fillText(row, 40, y + 42 + k * 28));
      y += hh + 12;
    }
    if (cracked) {
      // The crack from Ch1 (scene1/props.js buildPhone): still there.
      gg.strokeStyle = 'rgba(255,255,255,0.45)';
      gg.lineWidth = 1.5;
      gg.beginPath();
      gg.moveTo(0, h * 0.74);
      gg.lineTo(w * 0.3, h * 0.68);
      gg.lineTo(w * 0.45, h * 0.71);
      gg.lineTo(w, h * 0.54);
      gg.moveTo(w * 0.3, h * 0.68);
      gg.lineTo(w * 0.36, h * 0.6);
      gg.stroke();
    }
    gg.fillStyle = 'rgba(255,255,255,0.7)';
    gg.fillRect(w / 2 - 60, h - 26, 120, 6);
  };
  const redraw = (draw = screen || lockScreen) => {
    g.clearRect(0, 0, c.width, c.height);
    draw(g, c.width, c.height);
    tex.needsUpdate = true;
  };
  redraw();
  const screenMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: true });
  const scr = mesh(new THREE.PlaneGeometry(W - 0.005, H - 0.006).rotateX(-Math.PI / 2), screenMat, { shadow: false, pos: [0, 0.0082, 0] });
  scr.name = 'screen';
  group.add(scr);
  const lit = (on) => screenMat.color.setScalar(on ? 1 : 0.02);
  return { group, screen: scr, redraw, lit };
}

// ------------------------------------------------------------------ ENCRE FINE

/**
 * A rotary pen tattoo machine lying on a tray, its cable coiled away, a holder of ink caps (blacks
 * and greys: fine line) and a wrapped grip. For ENCRE FINE's window or Jo's station.
 * Returns { group, machine (Group: lift and buzz it), caps: [Mesh] }.
 */
export function tattooMachine({ inks = ['#0c0c0e', '#0c0c0e', '#3a3a3e', '#6a6a70', '#9a9aa0', '#6b2430'] } = {}) {
  const group = new THREE.Group();
  group.name = 'tattoo-machine';
  // The tray: a shallow steel kidney dish.
  const tray = new THREE.Shape();
  tray.absellipse(0, 0, 0.13, 0.07, 0, TAU, false);
  group.add(mesh(new THREE.ExtrudeGeometry(tray, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.004, bevelSegments: 2, curveSegments: 48 }).rotateX(-Math.PI / 2), std('#b4b8bc', { metalness: 0.85, roughness: 0.5 })));
  const machine = new THREE.Group();
  machine.name = 'machine';
  const black = std('#16171a', { metalness: 0.6, roughness: 0.35 });
  const anod = std('#6b2430', { metalness: 0.7, roughness: 0.3 }); // Jo's oxblood, anodised
  // A pen: body, a knurled grip in a cohesive wrap, the cartridge needle tip, the cable.
  machine.add(mesh(new THREE.CylinderGeometry(0.014, 0.0125, 0.085, 20).rotateZ(Math.PI / 2).translate(0.03, 0, 0), anod));
  machine.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 20).rotateZ(Math.PI / 2).translate(-0.016, 0, 0), black, { shadow: false }));
  machine.add(mesh(new THREE.CylinderGeometry(0.011, 0.0095, 0.05, 16).rotateZ(Math.PI / 2).translate(-0.047, 0, 0), std('#2b2b30', { roughness: 0.85 }))); // wrapped grip
  machine.add(mesh(new THREE.CylinderGeometry(0.0085, 0.003, 0.03, 14).rotateZ(Math.PI / 2).translate(-0.087, 0, 0), new THREE.MeshPhysicalMaterial({ color: '#9aa4a8', transparent: true, opacity: 0.45, roughness: 0.15 }), { shadow: false })); // cartridge
  machine.add(mesh(new THREE.CylinderGeometry(0.0006, 0.0006, 0.006, 4).rotateZ(Math.PI / 2).translate(-0.105, 0, 0), std('#aaa', { metalness: 1 }), { shadow: false }));
  machine.position.set(0, 0.016, 0);
  machine.rotation.y = 0.25;
  group.add(machine);
  const cable = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const a = t * TAU * 1.3;
    cable.push(new THREE.Vector3(0.075 + t * 0.12 + Math.cos(a) * 0.05 * t, 0.006, Math.sin(a) * 0.06 * t - 0.01));
  }
  cable[0].set(0.072, 0.016, -0.018);
  group.add(mesh(tube(cable, 0.0028, { seg: 40, radial: 6 }), std('#1a1a1c', { roughness: 0.6 }), { shadow: false }));
  // Ink caps in a little holder.
  const holder = mesh(new RoundedBoxGeometry(0.07, 0.012, 0.05, 2, 0.003).translate(-0.02, 0.006, 0.11), std('#e8e8ea', { roughness: 0.4 }));
  group.add(holder);
  const capMat = new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.35, side: THREE.DoubleSide });
  const caps = [];
  inks.forEach((ink, i) => {
    const x = -0.045 + (i % 3) * 0.022;
    const z = 0.1 + Math.floor(i / 3) * 0.022;
    const cap = mesh(new THREE.CylinderGeometry(0.0085, 0.007, 0.014, 14, 1, true).translate(x, 0.019, z), capMat, { shadow: false });
    const surf = mesh(new THREE.CircleGeometry(0.0078, 14).rotateX(-Math.PI / 2).translate(x, 0.023, z), std(ink, { roughness: 0.3, envMapIntensity: 0.3 }), { shadow: false });
    group.add(cap, surf);
    caps.push(surf);
  });
  return { group, machine, caps };
}

/**
 * Jo's shop sign: « ENCRE FINE » hand-lettered in fine black line on a cream board, a hairline
 * border with tiny stars, the sub-line underneath (opts.sub, from L.*), hung a little crooked
 * (`tilt` rad). Origin: the back centre, facing +z. Returns { group, board (Mesh), redraw(text, sub) }.
 */
export function encreFineSign({ text = 'ENCRE FINE', sub = '', width = 1.6, height = 0.42, tilt = -0.035, hanging = true } = {}) {
  const group = new THREE.Group();
  group.name = 'encre-fine-sign';
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = Math.round((2048 * height) / width);
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const draw = (t, s) => {
    const w = c.width;
    const h = c.height;
    paperGrain(g, w, h, '#ece2cc', 23);
    // Hairline borders, the inner one with corner stars (the fine-line look).
    g.strokeStyle = '#141416';
    g.lineCap = 'round';
    g.lineWidth = 3;
    g.strokeRect(22, 22, w - 44, h - 44);
    g.lineWidth = 1.6;
    g.strokeRect(40, 40, w - 80, h - 80);
    g.lineWidth = 2.2;
    for (const [x, y] of [[40, 40], [w - 40, 40], [40, h - 40], [w - 40, h - 40]]) {
      g.save();
      g.translate(x, y);
      g.fillStyle = '#ece2cc';
      g.fillRect(-16, -16, 32, 32);
      MOTIFS.star(g, 14);
      g.restore();
    }
    // The name: tall thin capitals drawn as hairline outlines with a single inline (sign-writer's
    // fine-line lettering), slightly uneven so it reads as by hand.
    const fs = Math.round(h * (s ? 0.42 : 0.52));
    g.font = `300 ${fs}px Didot, "Bodoni 72", "Playfair Display", Georgia, serif`;
    if ('letterSpacing' in g) g.letterSpacing = `${Math.round(fs * 0.12)}px`;
    let scale = 1;
    const tw = g.measureText(t).width;
    if (tw > w - 220) scale = (w - 220) / tw;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const y0 = s ? h * 0.44 : h * 0.52;
    const r = rand(29);
    g.save();
    g.translate(w / 2, y0);
    g.scale(scale, 1);
    // Per-letter jitter: draw each glyph on its own.
    const glyphs = [...t];
    const widths = glyphs.map((ch) => g.measureText(ch).width + fs * 0.12);
    let x = -widths.reduce((a, b) => a + b, 0) / 2;
    glyphs.forEach((ch, i) => {
      const cx = x + widths[i] / 2;
      x += widths[i];
      if (ch === ' ') return;
      g.save();
      g.translate(cx, (r() - 0.5) * fs * 0.03);
      g.rotate((r() - 0.5) * 0.04);
      g.fillStyle = '#141416';
      g.fillText(ch, 0, 0);
      // A hairline shadow line to one side, the fine-line flourish.
      g.strokeStyle = 'rgba(20,20,22,0.85)';
      g.lineWidth = 1.4;
      g.strokeText(ch, fs * 0.035, fs * 0.03);
      g.restore();
    });
    g.restore();
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    // A fine line under the name with a small swallow at its centre, then the sub-line.
    g.lineWidth = 2;
    g.strokeStyle = '#141416';
    const ly = y0 + fs * 0.58;
    g.beginPath();
    g.moveTo(w * 0.24, ly);
    g.lineTo(w * 0.46, ly);
    g.moveTo(w * 0.54, ly);
    g.lineTo(w * 0.76, ly);
    g.stroke();
    g.save();
    g.translate(w / 2, ly);
    g.rotate(-Math.PI / 2 + 0.3);
    g.lineWidth = 2;
    MOTIFS.swallow(g, fs * 0.16);
    g.restore();
    if (s) {
      g.fillStyle = '#141416';
      const ss = Math.round(h * 0.085);
      g.font = `400 ${ss}px "Helvetica Neue", Arial, sans-serif`;
      if ('letterSpacing' in g) g.letterSpacing = `${Math.round(ss * 0.35)}px`;
      g.fillText(s, w / 2, ly + h * 0.14);
      if ('letterSpacing' in g) g.letterSpacing = '0px';
    }
    tex.needsUpdate = true;
  };
  draw(text, sub);
  const board = new THREE.Group();
  const T = 0.025;
  board.add(mesh(new RoundedBoxGeometry(width, height, T, 2, 0.006).translate(0, 0, T / 2), std('#2a2420', { roughness: 0.7 })));
  const face = mesh(new THREE.PlaneGeometry(width - 0.02, height - 0.02), std('#ffffff', { map: tex, roughness: 0.75 }), { shadow: false, pos: [0, 0, T + 0.0005] });
  board.add(face);
  board.rotation.z = tilt;
  group.add(board);
  if (hanging) {
    // Two chains up to the bracket (the sign hangs a little crooked: one chain is shorter).
    const chain = std('#2a2a2c', { metalness: 0.8, roughness: 0.4 });
    for (const sx of [-1, 1]) {
      const x = sx * width * 0.38;
      const yTop = height / 2 + 0.16;
      const yBot = height / 2 + x * Math.sin(tilt);
      group.add(mesh(new THREE.CylinderGeometry(0.003, 0.003, yTop - yBot, 5).translate(x, (yTop + yBot) / 2, T / 2), chain, { shadow: false }));
    }
    group.add(mesh(new THREE.BoxGeometry(width * 0.9, 0.02, 0.03).translate(0, height / 2 + 0.17, T / 2), chain));
  }
  return { group, board: face, redraw: draw };
}

/**
 * Flash sheets: `cols` x `rows` sheets of fine-line designs (the tattoo motifs, a few per sheet,
 * with tiny prices or numbers), taped on a wall. A canvas texture for a plane of `width` x `height`.
 * opts.labels: per-sheet captions (strings from L.*, optional). Returns a CanvasTexture (cached by
 * its options).
 */
export function flashSheetTexture({ cols = 4, rows = 2, width = 1.6, height = 0.8, labels = [], seed = 8 } = {}) {
  const key = `flash|${cols}|${rows}|${width}|${height}|${labels.join('/')}|${seed}`;
  return cached(key, () =>
    canvasTexture(2048, Math.round((2048 * height) / width), (g, w, h) => {
      // The wall behind: a dark plaster, so the sheets read.
      g.fillStyle = '#2c2a2a';
      g.fillRect(0, 0, w, h);
      const r = rand(seed);
      const names = Object.keys(MOTIFS);
      const sw = w / cols;
      const sh = h / rows;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const x = i * sw + sw * 0.08 + (r() - 0.5) * sw * 0.03;
          const y = j * sh + sh * 0.08 + (r() - 0.5) * sh * 0.03;
          const pw = sw * 0.84;
          const ph = sh * 0.84;
          g.save();
          g.translate(x + pw / 2, y + ph / 2);
          g.rotate((r() - 0.5) * 0.05);
          g.translate(-pw / 2, -ph / 2);
          g.fillStyle = 'rgba(0,0,0,0.35)';
          g.fillRect(6, 8, pw, ph); // drop shadow
          paperGrain(g, pw, ph, '#efe8d8', seed + i + j * cols);
          // Masking tape on two corners.
          g.fillStyle = 'rgba(226,212,170,0.85)';
          for (const cx of [0, pw]) {
            g.save();
            g.translate(cx, 0);
            g.rotate(cx ? 0.6 : -0.6);
            g.fillRect(-30, -10, 60, 22);
            g.restore();
          }
          // 3 x 2 designs per sheet, each with a tiny number under it.
          g.strokeStyle = g.fillStyle = '#121214';
          g.lineCap = 'round';
          g.lineJoin = 'round';
          let n = 0;
          for (let b = 0; b < 2; b++) {
            for (let a = 0; a < 3; a++) {
              const name = names[Math.floor(r() * names.length)];
              const k = Math.min(pw / 3, ph / 2) * 0.32;
              g.save();
              g.translate(pw * (0.18 + a * 0.32), ph * (0.3 + b * 0.42));
              g.rotate((r() - 0.5) * 0.4);
              g.lineWidth = 2.2;
              if (name === 'star') MOTIFS.star(g, k, r() < 0.5 ? 4 : 5);
              else MOTIFS[name](g, k, r() < 0.3);
              g.restore();
              g.font = `400 ${Math.round(ph * 0.04)}px "Helvetica Neue", Arial, sans-serif`;
              g.textAlign = 'center';
              g.fillText(String(++n + (i + j * cols) * 6), pw * (0.18 + a * 0.32), ph * (0.3 + b * 0.42) + k * 1.35);
            }
          }
          const label = labels[i + j * cols];
          if (label) {
            g.font = `italic 400 ${Math.round(ph * 0.06)}px Georgia, serif`;
            g.textAlign = 'center';
            g.fillText(label, pw / 2, ph * 0.08);
          }
          g.restore();
        }
      }
    }),
  );
}

/** The flash wall as a plane (origin: its centre, facing +z). Returns { group, mesh }. */
export function flashWall({ width = 1.6, height = 0.8, ...opts } = {}) {
  const group = new THREE.Group();
  group.name = 'flash-wall';
  const m = mesh(new THREE.PlaneGeometry(width, height), std('#ffffff', { map: flashSheetTexture({ width, height, ...opts }), roughness: 0.85 }), { shadow: false, pos: [0, 0, 0.002] });
  group.add(m);
  return { group, mesh: m };
}
