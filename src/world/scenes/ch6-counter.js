import * as THREE from 'three';
import { box, mat, pointLight, sign, canvasTexture, rng as seeded } from '../build.js';
import { kebabCounter } from '../props/r4.js';

// CHEZ GÉRARD at 1 a.m., behind the counter (docs/SCRIPT-R4.md §7, Ch6 Week 6; the KEBAB WRAP scene).
// A small set of its own (the street's shopfront has no room behind it, and at night its shutter is half
// down): Ch6 swaps to it with Director.scene(COUNTER_SET). Owned by the Ch6 agent.
//
// Layout (metres, local to this set; the street is beyond the front wall, +Z):
//   room          x -2.4..2.4, z -2.8..2.2, ceiling 2.85; white tiles to 1.2 m, cream plaster above
//   counter       the props/r4.js kebabCounter (2.4 m), customer side +Z, at z 0; the spit at its left end
//   behind it     Gérard by the spit, Hugo beside him (z -0.75), the back worktop with the fryer, the sauce
//                 bottles in a row, the ticket spike (Gérard's receipts) and the till
//   front wall    the window (x -2.3..0.55) with CHEZ GÉRARD in pink neon seen from inside (mirrored, steady
//                 since Week 6), the glass door (x 0.8..1.75) with its bell; the dark street beyond
//   customers     five passers-by on the customer side, hidden until « La porte s’ouvre. »
// Returns { group, bounds, spots, shots, gerard, customers, setCustomers(n), neon, spike, update }.

const W = 4.8;
const X0 = -2.4;
const X1 = 2.4;
const Z0 = -2.8; // back wall
const Z1 = 2.2; // front wall (inside face)
const H = 2.85;
const TILE_H = 1.2;
const PINK = 0xff3d6e;
const WIN = { x0: -2.3, x1: 0.55, y0: 0.95, y1: 2.35 };
const DOOR = { x0: 0.8, x1: 1.75, h: 2.25 };

/** The chapter look for this set (Director.scene -> ctx.loadSet): indoor PBR sets, no street, no cones. */
export const COUNTER_LOOK = {
  key: 'counter',
  ground: 'workshop.concrete',
  slab: 'interior.tile',
  facade: 'interior.tile',
  walls: 'interior.plaster',
  wet: 0,
  grime: 0.7,
  kenney: { grime: 0.5, desat: 0.15 },
  cones: false,
  hdris: ['interior_dim'],
  materials: ['tile_white_long', 'plaster_painted', 'metal_plate_worn', 'workshop_floor_concrete'],
  props: [],
};

/** Mood for the counter: a fluorescent white room, warm grill, the pink neon from the window. */
export const COUNTER_MOOD = {
  preset: 'flat',
  overrides: {
    skyTop: '#0a0b0d',
    skyBottom: '#141518',
    hemiSky: '#c9cfd0',
    hemiGround: '#3a2e2a',
    hemiIntensity: 2.4,
    sunColor: '#dfe6ea',
    sunIntensity: 1.1,
    sunDir: [0.3, 0.9, 0.5],
    fillColor: '#f0e6dc',
    fillIntensity: 3.2,
    vignette: 0.5,
    lightChroma: 0.75,
    grain: 0.06,
  },
};

function floorTexture() {
  // Old quarry tiles, terracotta and cream, a chequer worn pale where people stand.
  return canvasTexture(512, 512, (g, w, h) => {
    const n = 8;
    const s = w / n;
    const R = seeded(14);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const dark = (i + j) % 2 === 0;
        const v = (R() - 0.5) * 18;
        g.fillStyle = dark ? `rgb(${140 + v},${70 + v * 0.6},${52 + v * 0.5})` : `rgb(${206 + v},${194 + v},${170 + v})`;
        g.fillRect(i * s, j * s, s, s);
        g.fillStyle = 'rgba(0,0,0,0.05)';
        for (let k = 0; k < 10; k++) g.fillRect(i * s + R() * s, j * s + R() * s, 2 + R() * 4, 2 + R() * 4);
      }
    g.strokeStyle = 'rgba(60,50,44,0.55)';
    g.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      g.beginPath();
      g.moveTo(i * s, 0);
      g.lineTo(i * s, h);
      g.moveTo(0, i * s);
      g.lineTo(w, i * s);
      g.stroke();
    }
  }, { repeat: [3, 3] });
}

function tileTexture() {
  // White metro tiles with grey grout, a few yellowed by the grill.
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#9a9a94';
    g.fillRect(0, 0, w, h);
    const R = seeded(5);
    const tw = 64;
    const th = 32;
    for (let r = 0; r < h / th; r++)
      for (let c = -1; c < w / tw + 1; c++) {
        const x = c * tw + (r % 2 ? tw / 2 : 0);
        const y = r * th;
        const v = 232 - R() * 16;
        g.fillStyle = `rgb(${v},${v - 2},${v - 10 - R() * 10})`;
        g.fillRect(x + 2, y + 2, tw - 4, th - 4);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(x + 4, y + 4, tw - 12, 4);
      }
  }, { repeat: [6, 3] });
}

function menuTexture() {
  // The back-lit menu board over the back worktop (dressing; prices in euros, French style).
  return canvasTexture(1024, 384, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2b1d18');
    grad.addColorStop(1, '#170f0c');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd36b';
    g.font = '800 64px system-ui, Helvetica, Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText('CHEZ GÉRARD', w / 2, 76);
    g.font = '600 38px system-ui, Helvetica, Arial, sans-serif';
    const rows = [
      ['Galette kebab', '7,50 €'],
      ['Sandwich kebab', '7,00 €'],
      ['Assiette', '10,50 €'],
      ['Frites', '3,00 €'],
      ['Thé à la menthe', '1,50 €'],
    ];
    rows.forEach(([a, b], i) => {
      const y = 140 + i * 48;
      g.textAlign = 'left';
      g.fillStyle = '#f2e6d0';
      g.fillText(a, 90, y);
      g.textAlign = 'right';
      g.fillStyle = '#ffd36b';
      g.fillText(b, w - 90, y);
      g.fillStyle = 'rgba(242,230,208,0.25)';
      g.fillRect(90, y + 10, w - 180, 2);
    });
  });
}

function neonTexture(text) {
  // The window neon seen from inside the shop: mirrored, a soft halo round the tube.
  return canvasTexture(1024, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.translate(w, 0);
    g.scale(-1, 1);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'italic 700 120px "Brush Script MT", "Segoe Script", cursive, system-ui';
    g.shadowColor = 'rgba(255,61,110,0.9)';
    g.shadowBlur = 40;
    g.strokeStyle = '#ff6e94';
    g.lineWidth = 10;
    g.strokeText(text, w / 2, h / 2);
    g.shadowBlur = 0;
    g.strokeStyle = '#ffe0ea';
    g.lineWidth = 3.5;
    g.strokeText(text, w / 2, h / 2);
  });
}

/** Gérard's ticket spike: a steel spike on a little base, the night's receipts speared on it. */
function ticketSpike() {
  const g = new THREE.Group();
  g.name = 'ticket-spike';
  const steel = new THREE.MeshStandardMaterial({ color: '#b8bcc0', metalness: 0.85, roughness: 0.35 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.015, 20), steel);
  base.position.y = 0.0075;
  g.add(base);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.17, 6), steel);
  rod.position.y = 0.1;
  g.add(rod);
  const paper = new THREE.MeshStandardMaterial({ color: '#cfc9bb', roughness: 0.95, side: THREE.DoubleSide });
  const R = seeded(43);
  for (let i = 0; i < 26; i++) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.075 + R() * 0.03), paper);
    t.rotation.set(-Math.PI / 2 + (R() - 0.5) * 0.35, 0, R() * Math.PI * 2);
    t.position.set((R() - 0.5) * 0.012, 0.02 + i * 0.0045, (R() - 0.5) * 0.012);
    g.add(t);
  }
  return g;
}

/** A row of squeeze bottles: white sauce, samouraï, ketchup, mustard, harissa. */
function sauceBottles() {
  const g = new THREE.Group();
  const cols = ['#f3eee2', '#d8542e', '#c4251c', '#e8b421', '#8e1c12', '#f3eee2'];
  cols.forEach((c, i) => {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.19, 14), new THREE.MeshStandardMaterial({ color: c, roughness: 0.35 }));
    body.position.y = 0.095;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 10), new THREE.MeshStandardMaterial({ color: '#eaeaea', roughness: 0.4 }));
    cap.position.y = 0.22;
    b.add(body, cap);
    b.position.x = i * 0.085;
    g.add(b);
  });
  return g;
}

export async function buildCh6Counter(ctx, { text = {} } = {}) {
  const { assets, look } = ctx;
  const group = new THREE.Group();
  group.name = 'ch6-counter';
  const add = (o) => (group.add(o), o);

  // ---------------------------------------------------------------- shell
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.55, color: '#ffffff' });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, Z1 - Z0).rotateX(-Math.PI / 2), floorMat);
  floor.position.set(0, 0, (Z0 + Z1) / 2);
  floor.receiveShadow = true;
  add(floor);
  const tileMat = mat('#ffffff', { map: tileTexture(), roughness: 0.25, surface: false });
  const plaster = look?.surface ? look.surface('interior.plaster', { tint: '#efe2c6' }) : mat('#d9cfb8');
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, Z1 - Z0).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#cfc8b8', roughness: 0.95 }));
  ceil.position.set(0, H, (Z0 + Z1) / 2);
  add(ceil);
  // Back and side walls: tiles to 1.2 m, plaster above (thin boxes so the camera's occlusion sees them).
  const wall = (w, h, d, pos, m) => add(box(w, h, d, { material: m, pos }));
  wall(W, TILE_H, 0.1, [0, 0, Z0 - 0.05], tileMat);
  wall(W, H - TILE_H, 0.1, [0, TILE_H, Z0 - 0.05], plaster);
  for (const [sx, x] of [[-1, X0 - 0.05], [1, X1 + 0.05]]) {
    const a = add(box(0.1, TILE_H, Z1 - Z0, { material: tileMat, pos: [x, 0, (Z0 + Z1) / 2] }));
    const b = add(box(0.1, H - TILE_H, Z1 - Z0, { material: plaster, pos: [x, TILE_H, (Z0 + Z1) / 2] }));
    a.userData.side = b.userData.side = sx;
  }
  // Front wall around the window and the door (the camera never sits outside it).
  const front = (x0, x1, y0, y1) => wall(x1 - x0, y1 - y0, 0.14, [(x0 + x1) / 2, y0, Z1 + 0.07], plaster);
  front(X0, WIN.x0, 0, H);
  front(WIN.x0, WIN.x1, 0, WIN.y0);
  front(WIN.x0, WIN.x1, WIN.y1, H);
  front(WIN.x1, DOOR.x0, 0, H);
  front(DOOR.x0, DOOR.x1, DOOR.h, H);
  front(DOOR.x1, X1, 0, H);
  // Night outside: a dark street plane, sodium-lit at the bottom.
  const night = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 4),
    new THREE.MeshBasicMaterial({
      map: canvasTexture(256, 128, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#07080b');
        gr.addColorStop(0.55, '#1a1714');
        gr.addColorStop(0.8, '#4a3622');
        gr.addColorStop(1, '#2a2018');
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
        // Far windows across the street.
        g.fillStyle = 'rgba(255,190,120,0.5)';
        for (const [x, y] of [[40, 30], [150, 22], [200, 44]]) g.fillRect(x, y, 10, 14);
      }),
      fog: false,
    }),
  );
  night.position.set(-0.4, 1.6, Z1 + 2.2);
  night.rotation.y = Math.PI;
  add(night);
  // Glass in the window and the door: a faint reflective film.
  const glass = new THREE.MeshStandardMaterial({ color: '#0b0d10', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false });
  const winGlass = new THREE.Mesh(new THREE.PlaneGeometry(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0), glass);
  winGlass.position.set((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, Z1 + 0.04);
  winGlass.rotation.y = Math.PI;
  winGlass.userData.noOcclude = true;
  add(winGlass);
  const doorGlass = winGlass.clone();
  doorGlass.geometry = new THREE.PlaneGeometry(DOOR.x1 - DOOR.x0 - 0.12, DOOR.h - 0.2);
  doorGlass.position.set((DOOR.x0 + DOOR.x1) / 2, DOOR.h / 2 + 0.05, Z1 + 0.06);
  add(doorGlass);
  const frameMat = new THREE.MeshStandardMaterial({ color: '#7c7f84', metalness: 0.8, roughness: 0.4 });
  for (const [x0, x1, y0, y1] of [[DOOR.x0, DOOR.x0 + 0.06, 0, DOOR.h], [DOOR.x1 - 0.06, DOOR.x1, 0, DOOR.h], [DOOR.x0, DOOR.x1, DOOR.h - 0.06, DOOR.h], [DOOR.x0, DOOR.x1, 1.0, 1.06]]) {
    add(box(x1 - x0, y1 - y0, 0.06, { material: frameMat, pos: [(x0 + x1) / 2, y0, Z1 + 0.03] }));
  }
  // The door bell (a brass bell on a spring over the door).
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c8a050', metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }));
  bell.rotation.x = Math.PI;
  bell.position.set(DOOR.x0 + 0.2, DOOR.h + 0.08, Z1 - 0.06);
  add(bell);

  // ---------------------------------------------------------------- the neon in the window (steady)
  const neonMat = new THREE.MeshBasicMaterial({ map: neonTexture(text.neon || 'CHEZ GÉRARD'), transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) });
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48), neonMat);
  neon.position.set((WIN.x0 + WIN.x1) / 2, WIN.y1 - 0.38, Z1 + 0.02);
  neon.rotation.y = Math.PI;
  neon.renderOrder = 4;
  neon.userData.noOcclude = true;
  add(neon);
  const neonLight = pointLight(PINK, 6, { pos: [(WIN.x0 + WIN.x1) / 2, WIN.y1 - 0.4, Z1 - 0.35], distance: 6 });
  add(neonLight);

  // ---------------------------------------------------------------- lights: two tubes, the grill
  const tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#e9f2ec').multiplyScalar(2.2), toneMapped: false });
  for (const z of [-1.3, 0.9]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 8).rotateZ(Math.PI / 2), tubeMat);
    t.position.set(0, H - 0.06, z);
    add(t);
    add(box(1.5, 0.03, 0.09, { color: '#e2e2de', pos: [0, H - 0.04, z], castShadow: false }));
  }
  const key = pointLight(0xe9f0ea, 9, { pos: [0.2, H - 0.25, -0.6], distance: 9 }); // no shadow: a cube map costs 6 passes
  add(key);
  add(pointLight(0xe9f0ea, 4, { pos: [0, H - 0.25, 1.1], distance: 7 }));

  // ---------------------------------------------------------------- the counter and the work side
  const counter = kebabCounter({ width: 2.4, depth: 0.62, height: 0.95 });
  counter.group.position.set(-0.15, 0, 0);
  add(counter.group);
  const grillLight = pointLight(0xff7a2a, 3.2, { pos: [-0.15 - 1.2 + 0.24, 1.3, -0.15], distance: 2.6 });
  add(grillLight);
  // The till on the counter's right end, the ticket spike beside it.
  const till = new THREE.Group();
  till.add(box(0.34, 0.1, 0.3, { color: '#2a2b2e', pos: [0, 0, 0] }));
  const screen = box(0.22, 0.12, 0.02, { color: '#1a1c1e', pos: [0, 0.1, -0.08] });
  screen.rotation.x = -0.35;
  till.add(screen);
  till.position.set(0.82, 0.97, -0.08);
  till.rotation.y = Math.PI;
  add(till);
  const spike = ticketSpike();
  spike.position.set(0.42, 0.97, -0.18);
  add(spike);
  // The back worktop: steel, a fryer, the sauce bottles, a stack of foil boxes, the tea glasses.
  const steel = new THREE.MeshStandardMaterial({ color: '#c4c8cc', metalness: 0.8, roughness: 0.38 });
  add(box(W - 0.2, 0.9, 0.62, { material: steel, pos: [0, 0, Z0 + 0.36] }));
  add(box(0.5, 0.3, 0.46, { color: '#55585c', metalness: 0.7, roughness: 0.45, pos: [-1.55, 0.9, Z0 + 0.36] })); // fryer
  const oil = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.34).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b8862a', roughness: 0.1, metalness: 0.3 }));
  oil.position.set(-1.55, 1.19, Z0 + 0.36);
  add(oil);
  const sauces = sauceBottles();
  sauces.position.set(-0.6, 0.9, Z0 + 0.42);
  add(sauces);
  for (let i = 0; i < 4; i++) {
    const glassTea = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.09, 12), new THREE.MeshStandardMaterial({ color: '#d8e4e0', transparent: true, opacity: 0.45, roughness: 0.05 }));
    glassTea.position.set(0.55 + i * 0.09, 0.945, Z0 + 0.35);
    add(glassTea);
  }
  add(box(0.3, 0.22, 0.24, { color: '#d7d9dc', metalness: 0.6, roughness: 0.3, pos: [1.35, 0.9, Z0 + 0.36] })); // foil boxes
  // A drinks fridge in the back right corner, lit.
  const fridge = box(0.7, 1.9, 0.6, { color: '#e8e8e6', roughness: 0.4, pos: [X1 - 0.45, 0, Z0 + 0.95] });
  add(fridge);
  const fridgeGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.5), new THREE.MeshBasicMaterial({ color: '#cfe8f0', toneMapped: false }));
  fridgeGlow.position.set(X1 - 0.45 - 0.355, 1.0, Z0 + 0.95);
  fridgeGlow.rotation.y = -Math.PI / 2;
  add(fridgeGlow);
  // Bottles in it (a few colours behind the glow).
  // The menu board over the back worktop.
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.82), new THREE.MeshBasicMaterial({ map: menuTexture(), toneMapped: false, color: new THREE.Color(0.85, 0.85, 0.85) }));
  menu.position.set(-0.1, 2.05, Z0 + 0.01);
  add(menu);
  // Customer side: a shelf along the left wall and three stools.
  add(box(0.32, 0.05, 1.7, { color: '#8a6a4a', roughness: 0.6, pos: [X0 + 0.16, 1.05, 1.15] }));
  for (const z of [0.6, 1.15, 1.7]) {
    add(box(0.05, 0.72, 0.05, { color: '#3a3b3e', metalness: 0.7, pos: [X0 + 0.6, 0, z] }));
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 16), new THREE.MeshStandardMaterial({ color: '#8e2a2a', roughness: 0.5 }));
    seat.position.set(X0 + 0.6, 0.74, z);
    add(seat);
  }
  // A framed photo of a football team and a calendar on the right wall, a fly on the wall (no).
  const team = sign('', 0.5, 0.36, { bg: '#5a6a5a', border: '#2b2620' });
  team.position.set(X1 - 0.01, 1.75, 0.9);
  team.rotation.y = -Math.PI / 2;
  add(team);

  // ---------------------------------------------------------------- people
  const gerard = assets.makeCharacter({ preset: 'gerard', name: 'Gérard' });
  gerard.root.position.set(-0.75, 0, -0.72);
  gerard.root.rotation.y = 0;
  gerard.play('idle', 0);
  add(gerard.root);
  // Customers on the customer side, facing the counter; hidden until the door opens.
  const CUST = [
    [0.15, 0.75, Math.PI, 'phone'],
    [-0.55, 0.85, Math.PI - 0.15, 'idle'],
    [0.85, 0.95, Math.PI + 0.2, 'idle'],
    [-1.35, 1.55, Math.PI - 0.4, 'phone'],
    [1.25, 1.65, Math.PI + 0.35, 'arms_crossed'],
  ];
  const customers = CUST.map(([x, z, ry, clip], i) => {
    const c = assets.makeCharacter({ preset: 'passerby', seed: `kebab-${i}`, name: `client-${i}` });
    c.root.position.set(x, 0, z);
    c.root.rotation.y = ry;
    c.play(clip, 0);
    c.root.visible = false;
    add(c.root);
    return c;
  });

  const bounds = [
    { minX: -1.15, maxX: 1.2, minZ: -1.95, maxZ: -0.5 }, // behind the counter
    { minX: 1.2, maxX: 1.95, minZ: -1.95, maxZ: 1.9 }, // the gap at the right end, to the door
    { minX: -1.9, maxX: 1.95, minZ: 0.5, maxZ: 1.9 }, // the customer side
  ];
  const spots = {
    spawn: [0.55, -0.78],
    hugo: [0.2, -0.75], // beside Gérard, behind the bowls
    gerard: [-0.75, -0.72],
    gerardTalk: [-0.3, -0.75], // where the E prompt sits
    door: [1.3, 1.6],
    spike: [0.42, -0.6],
    hugoReceipts: [0.78, -0.95],
    gerardReceipts: [-0.4, -0.85],
  };
  const shots = {
    // From the customer side, front right: the counter, the spit, Gérard and Hugo behind it.
    counter: { pos: [1.55, 1.72, 1.85], look: [-0.45, 1.15, -0.65], fov: 50 },
    // Across the bowls to the window and its neon (the kebabIntro opening: « Regarde mon néon. »).
    neon: { pos: [-0.25, 2.0, -2.15], look: [-0.9, 1.7, 2.2], fov: 54 },
    // High in the back corner over the fryer: the customers coming in, Gérard and Hugo from behind.
    rush: { pos: [-1.9, 2.3, -2.35], look: [0.45, 0.95, 1.3], fov: 58 },
    // Close on the ticket spike and Gérard's hands (the receipts).
    receipts: { pos: [-0.35, 1.78, 1.35], look: [0.2, 1.25, -0.85], fov: 46 },
    // Behind the counter, over the bowls (the game's backdrop).
    work: { pos: [0.1, 1.85, -1.6], look: [-0.2, 0.9, 0.15], fov: 48 },
  };

  let t = 0;
  return {
    group,
    bounds,
    spots,
    shots,
    gerard,
    customers,
    counter,
    spike,
    neon: { mesh: neon, light: neonLight },
    door: { pos: [(DOOR.x0 + DOOR.x1) / 2, 1.2, Z1], bell: bell.position.clone() },
    /** Show the first n customers (0 hides them all). */
    setCustomers(n) {
      customers.forEach((c, i) => (c.root.visible = i < n));
    },
    update(dt, raw) {
      t += raw;
      // The spit turns; the grill breathes.
      if (counter.spit) counter.spit.rotation.y += raw * 0.35;
      grillLight.intensity = 3.0 + Math.sin(t * 7.3) * 0.25 + Math.sin(t * 13.1) * 0.15;
    },
  };
}

/** The Director.scene set for the counter. opts override fields (player, camera...). */
export const COUNTER_SET = (opts = {}) => ({
  name: 'ch6-counter',
  look: COUNTER_LOOK,
  build: (ctx) => buildCh6Counter(ctx, { text: { neon: ctx.L?.ch2?.signs?.kebab } }),
  surface: null,
  preset: COUNTER_MOOD.preset,
  overrides: COUNTER_MOOD.overrides,
  ...opts,
  player: { spawn: [0.55, -0.78], facing: 0, ...(opts.player || {}) },
  camera: opts.camera === undefined ? { offset: [0.9, 1.9, 2.4], look: [-0.3, 1.0, -0.4], fov: 50, lerp: 5 } : opts.camera,
});
