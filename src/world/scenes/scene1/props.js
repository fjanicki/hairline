import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { L } from '../../../story/script.js';
import { canvasTexture, bicycle, rng, saddleGeometry, relangTexture } from '../../build.js';
import { IN_X, BACK_Z, BIKE_POS, rod, place, merged } from './common.js';

// The story props of the flat: the watch on its charger (the Poly Haven scan with a lit face),
// the phone, the X-ray, the 38 bibs (one quad each, slightly curled, one atlas), the rusted race
// bike on its hooks, the medals, and the litter (takeaway, pizza boxes, post, running shoes).

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ the watch

/** The GPS watch on its clip charger, cable off the sill and down to the socket by the radiator. */
export async function buildWatch(assets, mats) {
  const g = new THREE.Group();
  g.name = 'gps-watch';
  const watch = new THREE.Group();
  const scan = await assets.prop('props/wrist_watch.glb', { center: false });
  let faceY = 0.0062;
  let faceW = 0.026;
  if (scan.userData.isFallback) {
    scan.scale.set(0.04 / scan.userData.size.x, 0.012 / scan.userData.size.y, 0.2 / scan.userData.size.z);
    scan.position.y = 0.006;
    faceY = 0.0125;
  }
  watch.add(scan);
  const faceTex = canvasTexture(64, 64, (c, w, h) => {
    c.fillStyle = '#0b0d0c';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#c8d0c6';
    c.font = '700 22px ui-monospace, Menlo, monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText((L.watch?.zero || '0.0 km').replace(/\s*km$/, ''), w / 2, h / 2);
    c.font = '700 9px ui-monospace, Menlo, monospace';
    c.fillText('km', w / 2 + 16, h / 2 + 14);
    c.fillStyle = '#3b7a3b';
    c.fillRect(8, 8, 18, 4); // battery bar (charging)
  });
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(faceW, faceW * 0.92).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      map: faceTex,
      roughness: 0.15,
      emissive: '#ffffff',
      emissiveMap: faceTex,
      emissiveIntensity: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  face.position.y = faceY;
  watch.add(face);
  watch.rotation.y = Math.PI / 2 + 0.25; // strap along the sill
  g.add(watch);
  // Charger puck under the watch's back, a green LED, the cable off the sill and down the wall.
  const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.006, 16), mats.dark);
  puck.position.set(0.0, -0.001, 0.0);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.003, 0.004), new THREE.MeshBasicMaterial({ color: '#57d46a' }));
  led.position.set(0.02, 0.002, 0.012);
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        V(0.018, 0.0, 0),
        V(0.06, 0.002, 0.04),
        V(0.14, 0.002, 0.07),
        V(0.3, 0.002, 0.085),
        V(0.4, 0.0, 0.095),
        V(0.43, -0.03, 0.105),
        V(0.45, -0.2, 0.03),
        V(0.48, -0.45, 0.0),
        V(0.5, -0.66, -0.008),
      ]),
      64,
      0.0022,
      5,
      false,
    ),
    mats.dark,
  );
  g.add(puck, led, cable);
  return { group: g, watch, led };
}

// ------------------------------------------------------------------ the phone

export function buildPhone(mats) {
  const g = new THREE.Group();
  g.name = 'phone';
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.078, 0.009, 0.158, 2, 0.004), mats.phone);
  body.position.y = 0.0045;
  body.castShadow = true;
  const tex = canvasTexture(64, 128, (c, w, h) => {
    const grd = c.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#3a4c66');
    grd.addColorStop(1, '#1a2230');
    c.fillStyle = grd;
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.fillRect(16, 14, 32, 7); // clock
    for (let i = 0; i < 5; i++) {
      c.fillStyle = 'rgba(230,236,245,0.55)';
      c.fillRect(6, 34 + i * 17, w - 12, 13); // notification rows
      c.fillStyle = 'rgba(20,28,40,0.6)';
      c.fillRect(10, 38 + i * 17, 30, 2);
      c.fillRect(10, 42 + i * 17, 40, 2);
    }
    // a crack across the glass
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(4, 96);
    c.lineTo(22, 88);
    c.lineTo(30, 92);
    c.lineTo(60, 70);
    c.stroke();
  });
  const screenMat = new THREE.MeshBasicMaterial({ map: tex });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.148).rotateX(-Math.PI / 2), screenMat);
  screen.position.y = 0.0095;
  g.add(body, screen);
  return { group: g, screenMat };
}

// ------------------------------------------------------------------ the X-ray

/** The X-ray film taped to the fridge: blue-black, white tibia, a biro circle round the line. */
export function buildXray() {
  const draw = (c, w, h) => {
    const bg = c.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, h * 0.7);
    bg.addColorStop(0, '#1b2838');
    bg.addColorStop(1, '#070b12');
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(150,170,190,0.12)';
    c.beginPath();
    c.moveTo(w * 0.22, 0);
    c.bezierCurveTo(w * 0.12, h * 0.3, w * 0.24, h * 0.7, w * 0.34, h);
    c.lineTo(w * 0.72, h);
    c.bezierCurveTo(w * 0.8, h * 0.7, w * 0.9, h * 0.3, w * 0.8, 0);
    c.closePath();
    c.fill();
    const bone = (pts, width, alpha) => {
      c.strokeStyle = `rgba(232,238,244,${alpha})`;
      c.lineCap = 'round';
      c.lineWidth = width;
      c.beginPath();
      c.moveTo(pts[0][0] * w, pts[0][1] * h);
      c.bezierCurveTo(pts[1][0] * w, pts[1][1] * h, pts[2][0] * w, pts[2][1] * h, pts[3][0] * w, pts[3][1] * h);
      c.stroke();
    };
    bone(
      [
        [0.45, -0.05],
        [0.44, 0.35],
        [0.47, 0.7],
        [0.48, 1.02],
      ],
      34,
      0.7,
    );
    bone(
      [
        [0.45, -0.05],
        [0.44, 0.35],
        [0.47, 0.7],
        [0.48, 1.02],
      ],
      16,
      0.35,
    );
    bone(
      [
        [0.66, -0.02],
        [0.67, 0.35],
        [0.65, 0.7],
        [0.63, 1.0],
      ],
      10,
      0.55,
    );
    c.fillStyle = 'rgba(232,238,244,0.62)';
    c.beginPath();
    c.ellipse(w * 0.47, h * 0.02, 52, 22, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(w * 0.5, h * 0.99, 40, 16, 0, 0, Math.PI * 2);
    c.fill();
    // The dreaded black line: barely there, across the shaft.
    const fy = h * 0.56;
    c.strokeStyle = 'rgba(8,14,22,0.85)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(w * 0.385, fy - 3);
    c.lineTo(w * 0.455, fy + 1);
    c.lineTo(w * 0.53, fy + 4);
    c.stroke();
    // Dr Okafor's biro circle: two loose loops, not quite closed.
    c.strokeStyle = 'rgba(40,80,190,0.9)';
    c.lineWidth = 2;
    for (let k = 0; k < 2; k++) {
      c.beginPath();
      for (let a = 0.3 + k * 0.4; a < Math.PI * 2 + 0.6 + k * 0.4; a += 0.12) {
        const r = 1 + 0.06 * Math.sin(a * 3 + k);
        c.lineTo(w * 0.46 + Math.cos(a) * 34 * r + k * 3, fy + Math.sin(a) * 22 * r - k * 2);
      }
      c.stroke();
    }
    c.fillStyle = 'rgba(235,240,245,0.85)';
    c.font = '700 22px system-ui, sans-serif';
    c.fillText(L.ch1.signs.xrayMark, w * 0.08, h * 0.1);
    c.fillStyle = 'rgba(220,226,232,0.35)';
    c.fillRect(w * 0.62, h * 0.9, w * 0.32, 12);
    // Yellowed tape over the top corners.
    c.fillStyle = 'rgba(214,200,150,0.6)';
    for (const [x, r] of [
      [0.1, -0.5],
      [0.9, 0.45],
    ]) {
      c.save();
      c.translate(w * x, 10);
      c.rotate(r);
      c.fillRect(-26, -9, 52, 18);
      c.restore();
    }
  };
  const tex = canvasTexture(256, 320, draw);
  // The film is stiff but bowed off the door a little.
  const geo = new THREE.PlaneGeometry(0.3, 0.375, 6, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, 0.006 * (1 - Math.pow(p.getX(i) / 0.15, 2)));
  geo.computeVertexNormals();
  const film = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.05, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.06 }),
  );
  film.name = 'xray';
  relangTexture(film.material, () => canvasTexture(256, 320, draw), ['map', 'emissiveMap']); // the L/R mark
  return film;
}

// ------------------------------------------------------------------ the 38 bibs

const CELL = [0.235, 0.195];
const BIB = [0.21, 0.165];
const PANELS = [
  { cols: 4, rows: 3, count: 12, wall: 'back', c: [-2.42, 1.6] }, // x, y centre
  { cols: 4, rows: 4, count: 16, wall: 'left', c: [-1.88, 1.45] }, // z, y centre
  { cols: 3, rows: 4, count: 10, wall: 'left', c: [-1.0, 1.45] },
];

/** Where every bib hangs: { wall, s, y, rot, w, h, curl, corner }. Shared with the wallpaper (shadows). */
export function bibLayout() {
  const R = rng(38);
  const out = [];
  for (const p of PANELS) {
    const w = p.cols * CELL[0];
    const h = p.rows * CELL[1];
    for (let i = 0; i < p.count; i++) {
      const col = i % p.cols;
      const row = (i / p.cols) | 0;
      out.push({
        wall: p.wall,
        s: p.c[0] - w / 2 + (col + 0.5) * CELL[0] + (R() - 0.5) * 0.015,
        y: p.c[1] + h / 2 - (row + 0.5) * CELL[1] + (R() - 0.5) * 0.015,
        rot: (R() - 0.5) * 0.09,
        w: BIB[0] * (0.94 + R() * 0.08),
        h: BIB[1] * (0.94 + R() * 0.08),
        curl: R() < 0.35 ? 0.01 + R() * 0.02 : 0.002,
        corner: (R() * 4) | 0,
      });
    }
  }
  return out;
}

/** 38 race bibs: one atlas canvas, one curled quad each, merged into one mesh. */
export function buildBibs(layout) {
  const COLS = 8;
  const CW = 128;
  const CH = 100;
  const R = rng(83);
  const bands = ['#c23b2e', '#2f5f9a', '#e0b030', '#3a8a5a', '#d26a2a', '#6a4a9a', '#20252c'];
  const tex = canvasTexture(1024, 512, (g) => {
    g.fillStyle = '#d8d2c0';
    g.fillRect(0, 0, 1024, 512);
    layout.forEach((_, n) => {
      const x = (n % COLS) * CW;
      const y = ((n / COLS) | 0) * CH;
      const age = 0.3 + 0.7 * R();
      g.fillStyle = `hsl(45, ${10 + age * 25}%, ${86 - age * 14}%)`;
      g.fillRect(x, y, CW, CH);
      g.fillStyle = bands[(R() * bands.length) | 0];
      g.globalAlpha = 0.85 - age * 0.3;
      g.fillRect(x, y, CW, CH * 0.2);
      g.fillRect(x, y + CH * 0.9, CW, CH * 0.1);
      // sponsor strip under the band
      g.fillStyle = 'rgba(20,20,24,0.5)';
      g.fillRect(x + 8, y + CH * 0.24, CW * 0.4, 4);
      g.globalAlpha = 1;
      const num = String(100 + ((R() * 8900) | 0));
      g.fillStyle = '#16171a';
      g.font = `800 ${Math.round(CH * 0.4)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(num, x + CW / 2, y + CH * 0.55, CW * 0.86);
      if (R() < 0.6) {
        const hh = 2 + ((R() * 2) | 0);
        const mm = String((R() * 60) | 0).padStart(2, '0');
        const ss = String((R() * 60) | 0).padStart(2, '0');
        g.fillStyle = 'rgba(40,60,150,0.8)';
        g.font = `italic 600 ${Math.round(CH * 0.15)}px "Bradley Hand", "Segoe Print", cursive`;
        g.fillText(`${hh}:${mm}:${ss}`, x + CW * 0.62, y + CH * 0.82);
      }
      // creases and grubby thumb marks
      g.strokeStyle = 'rgba(80,70,50,0.25)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + R() * CW, y);
      g.lineTo(x + R() * CW, y + CH);
      g.stroke();
      g.fillStyle = 'rgba(70,60,40,0.18)';
      g.beginPath();
      g.arc(x + CW * (0.1 + R() * 0.8), y + CH * (0.2 + R() * 0.6), 6 + R() * 6, 0, Math.PI * 2);
      g.fill();
      // safety pins
      g.fillStyle = '#a8aaac';
      for (const [sx, sy] of [
        [6, 6],
        [CW - 12, 6],
        [6, CH - 8],
        [CW - 12, CH - 8],
      ])
        g.fillRect(x + sx, y + sy, 6, 2);
    });
  });
  tex.generateMipmaps = true;
  const geos = layout.map((b, n) => {
    const geo = new THREE.PlaneGeometry(b.w, b.h, 2, 2);
    const uv = geo.attributes.uv;
    const pos = geo.attributes.position;
    const u0 = ((n % COLS) * CW) / 1024;
    const v1 = 1 - (((n / COLS) | 0) * CH) / 512;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + (uv.getX(i) * CW) / 1024, v1 - ((1 - uv.getY(i)) * CH) / 512);
    // curl one corner off the wall, bow the paper a little
    const cx = b.corner & 1 ? 1 : -1;
    const cy = b.corner & 2 ? 1 : -1;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / (b.w / 2);
      const y = pos.getY(i) / (b.h / 2);
      const k = Math.max(0, (x * cx + y * cy) / 2);
      pos.setZ(i, 0.002 + b.curl * k * k + 0.002 * (1 - x * x));
    }
    geo.computeVertexNormals();
    geo.rotateZ(b.rot);
    if (b.wall === 'back') geo.translate(b.s, b.y, BACK_Z + 0.004);
    else {
      geo.rotateY(Math.PI / 2); // faces +X, into the room
      geo.translate(-IN_X + 0.004, b.y, b.s);
    }
    return geo;
  });
  const mesh = merged(geos, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88, side: THREE.DoubleSide }), { castShadow: false, name: 'race-bibs' });
  return mesh;
}

/** Finisher medals hung together on one nail between the bibs and the bike. */
export function buildMedals(batch, mats) {
  const nail = V(-IN_X + 0.01, 1.84, -0.42);
  const strip = (p, q, w) => {
    const d = new THREE.Vector3().subVectors(q, p);
    const g = new THREE.BoxGeometry(0.0015, d.length(), w);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    return g.translate((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2);
  };
  for (let i = 0; i < 3; i++) {
    const end = V(-IN_X + 0.006 + i * 0.003, 1.42 - i * 0.05, -0.42 + (i - 1) * 0.07);
    for (const dz of [-0.016, 0.016])
      batch.add(mats.ribbons[i], strip(nail.clone().setX(nail.x + 0.003 + i * 0.002), end.clone().setZ(end.z + dz), 0.02), { castShadow: false });
    batch.add(mats.brass, new THREE.CylinderGeometry(0.032, 0.032, 0.005, 16).rotateZ(Math.PI / 2).translate(end.x + 0.004, end.y - 0.03, end.z), {
      castShadow: false,
    });
  }
  batch.add(mats.steel, rod(V(-IN_X, nail.y, nail.z), V(-IN_X + 0.03, nail.y + 0.004, nail.z), 0.002, 4), { castShadow: false });
}

// ------------------------------------------------------------------ the race bike

/** Two L-hooks screwed into the left wall, rubber-coated. */
export function bikeHooks(batch, mats) {
  for (const z of [0.24, 0.68]) {
    const y = 1.79;
    batch.add(mats.dark, rod(V(-IN_X, y, z), V(-2.6, y, z), 0.008));
    batch.add(mats.dark, rod(V(-2.6, y - 0.008, z), V(-2.6, y + 0.05, z), 0.008));
    batch.add(mats.steel, new THREE.CylinderGeometry(0.02, 0.02, 0.01, 10).rotateZ(Math.PI / 2).translate(-IN_X + 0.005, y, z), { castShadow: false });
  }
}

/**
 * Old race bike: the procedural road bike with its paint gone to rust (PBR rust layered over its
 * own materials), a proper saddle, faded team colours on the down tube, hung on the hooks.
 */
export function hangingBike(materials, mats) {
  const bike = bicycle({ frame: '#34506e', rust: 0.8, saddle: false }); // team blue under the rust (Ch4 and Ch5 too)
  const done = new Set();
  bike.traverse((o) => {
    if (!o.isMesh || done.has(o.material)) return;
    done.add(o.material);
    const n = o.name;
    try {
      if (n === 'bike-frame') materials?.enhance?.(o.material, 'metal_painted_rusty', { albedo: 0.85, scale: 0.25, level: 0.12, roughnessVar: 0.8 });
      else if (o.material.metalness > 0.05) materials?.enhance?.(o.material, 'metal_painted_rusty', { albedo: 0.5, scale: 0.2, roughnessVar: 0.6 });
    } catch (e) {
      console.warn('[hairline] ch1 bike restyle failed', e);
    }
  });
  const a = V(0, 0.27, -0.08);
  const b = V(0, 0.68, 0.41);
  const sleeve = (t0, t1, m) => {
    const s = new THREE.Mesh(rod(a.clone().lerp(b, t0), a.clone().lerp(b, t1), 0.0205, 10), m);
    s.castShadow = true;
    bike.add(s);
  };
  sleeve(0.32, 0.5, mats.teamBlue); // what's left of the team blue
  sleeve(0.56, 0.66, mats.teamWhite);
  // A real saddle (the builder's box saddle is left off): rounded, wide at the back, nose forward (+Z).
  const seat = bike.userData.seat || V(0, 0.93, -0.28);
  const sg = saddleGeometry(); // narrow nose, wide rear, rails (build.js)
  sg.translate(seat.x, seat.y + 0.024, seat.z + 0.02);
  const saddle = new THREE.Mesh(sg, mats.saddle);
  saddle.castShadow = true;
  bike.add(saddle);
  bike.position.set(BIKE_POS[0], BIKE_POS[1], BIKE_POS[2]);
  return bike;
}

// ------------------------------------------------------------------ litter

/** Noodle cartons (merged) and pizza boxes. */
export function takeaway(mats) {
  const cartonGeo = () => new THREE.CylinderGeometry(0.06, 0.042, 0.09, 4, 1).rotateY(Math.PI / 4).translate(0, 0.045, 0);
  const pizzaTex = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#8a7556';
    c.fillRect(0, 0, w, h);
    // corrugated cardboard grain
    for (let y = 0; y < h; y += 3) {
      c.fillStyle = `rgba(60,44,26,${0.05 + (y % 9 === 0 ? 0.05 : 0)})`;
      c.fillRect(0, y, w, 1);
    }
    // the printed lid: a red roundel, a script name, a phone number strip
    c.strokeStyle = 'rgba(120,36,28,0.75)';
    c.lineWidth = 7;
    c.beginPath();
    c.arc(w * 0.5, h * 0.45, 62, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = 'rgba(120,36,28,0.75)';
    c.font = 'italic 800 34px Georgia, serif';
    c.textAlign = 'center';
    c.fillText('Pizza', w * 0.5, h * 0.47);
    c.font = '700 16px system-ui, sans-serif';
    c.fillText('NAPOLI  ·  LIVRAISON', w * 0.5, h * 0.82);
    c.fillRect(w * 0.18, h * 0.86, w * 0.64, 4);
    // grease blooms through the card
    for (const [x, y, r] of [
      [0.7, 0.3, 40],
      [0.28, 0.7, 30],
    ]) {
      const g = c.createRadialGradient(w * x, h * y, 2, w * x, h * y, r);
      g.addColorStop(0, 'rgba(50,30,10,0.55)');
      g.addColorStop(1, 'rgba(50,30,10,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }
  });
  const pizza = new THREE.MeshStandardMaterial({ map: pizzaTex, roughness: 0.9 });
  return {
    cartons: (batch, items) => {
      for (const [x, z, r, y, tip = 0] of items) batch.add(mats.carton, place(cartonGeo(), [x, y, z], [tip, r, 0]));
    },
    pizza: () => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.34), pizza);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    },
  };
}

/**
 * Running shoes kicked off by the door: a sculpted sole with toe spring and a heel, the upper
 * low at the toe and open at the collar, laces. The loudest colour in the flat, and still dull.
 */
function shoeGeos(right) {
  const L = 0.28;
  // sole: a side profile (heel at -z, toe at +z) extruded across the width
  const prof = new THREE.Shape();
  prof.moveTo(-L / 2, 0);
  prof.lineTo(L / 2 - 0.04, 0.0);
  prof.quadraticCurveTo(L / 2 + 0.005, 0.004, L / 2, 0.03);
  prof.lineTo(-L / 2 + 0.01, 0.034);
  prof.quadraticCurveTo(-L / 2 - 0.006, 0.03, -L / 2, 0);
  const sole = new THREE.ExtrudeGeometry(prof, {
    depth: 0.085,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
    curveSegments: 6,
  });
  sole.translate(0, 0, -0.0425).rotateY(-Math.PI / 2); // profile x -> world z
  // narrow the sole at the waist and the heel
  const sp = sole.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const z = sp.getZ(i) / (L / 2);
    sp.setX(i, sp.getX(i) * (0.82 + 0.18 * Math.cos(z * 1.6)) + (right ? 1 : -1) * 0.008 * z);
  }
  sole.computeVertexNormals();
  // upper: a soft shell, low at the toe, tall at the heel collar
  const up = new THREE.IcosahedronGeometry(1, 3);
  const p = up.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    const t = (z + 1) / 2; // 0 heel .. 1 toe
    const h = 0.075 * (1 - 0.55 * t * t);
    y = Math.max(0, y) * h + 0.03;
    x = Math.sign(x) * Math.pow(Math.abs(x), 0.7) * 0.043 * (0.85 + 0.15 * Math.sin(t * Math.PI));
    z = z * (L / 2 - 0.012);
    p.setXYZ(i, x + (right ? 1 : -1) * 0.006 * t, y, z);
  }
  up.computeVertexNormals();
  return { sole, up };
}

export function runningShoes(batch, mats, [x, z], rotY) {
  for (const s of [-1, 1]) {
    const { sole, up } = shoeGeos(s > 0);
    const r = rotY + s * 0.18 + (s > 0 ? 0.5 : 0);
    const m = new THREE.Matrix4().makeRotationY(r).setPosition(x + s * 0.08 * Math.cos(rotY), 0, z + s * 0.05);
    if (s > 0) m.multiply(new THREE.Matrix4().makeRotationZ(0.35).setPosition(0, 0.012, 0)); // one on its side
    batch.add(mats.sole, sole.applyMatrix4(m), { castShadow: false });
    batch.add(mats.shoe, up.applyMatrix4(m));
    // the dark collar opening at the heel, and a heel tab
    batch.add(
      mats.dark,
      new THREE.CircleGeometry(1, 14)
        .scale(0.03, 0.045, 1)
        .rotateX(-Math.PI / 2 + 0.25)
        .translate(0, 0.104, -0.075)
        .applyMatrix4(m.clone()),
      { castShadow: false },
    );
    batch.add(mats.sole, new THREE.BoxGeometry(0.02, 0.05, 0.012).translate(0, 0.09, -0.135).applyMatrix4(m.clone()), { castShadow: false });
    for (let k = 0; k < 4; k++)
      batch.add(mats.sole, new THREE.BoxGeometry(0.05, 0.004, 0.006).translate(0, 0.098 - k * 0.008 - 0.02, -0.01 + k * 0.025).applyMatrix4(m), {
        castShadow: false,
      });
  }
}

/** Post on the mat: a few envelopes and a flyer. */
export function post(batch, mats, cx, cz) {
  const R = rng(12);
  for (let i = 0; i < 6; i++) {
    batch.add(
      mats.paper,
      new THREE.BoxGeometry(0.22, 0.003, 0.11).rotateY((R() - 0.5) * 1.6).translate(cx - 0.3 + R() * 0.55, 0.012 + i * 0.0032, cz + R() * 0.3),
      { castShadow: false },
    );
  }
}

/** Crumpled paper balls (one mesh). */
export function paperBalls(batch, mats, cx, cz, n = 5) {
  const R = rng(9);
  for (let i = 0; i < n; i++) {
    const r = 0.035 + R() * 0.015;
    batch.add(
      mats.paperFlat,
      new THREE.IcosahedronGeometry(r, 0)
        .rotateX(R() * 3)
        .rotateY(R() * 3)
        .translate(cx + R() * 0.35, r * 0.8, cz + R() * 0.25),
      { castShadow: false },
    );
  }
}
