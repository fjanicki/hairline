import * as THREE from 'three';
import { Batch, canvas, texFrom, rngOf, surf, slab, rod, props } from './util.js';
import { relangTexture } from '../../build.js';

// Ch5 dressing along the mural wall: drop cloths, paint tins (their paint is the colour that comes
// back first), a trestle table at the bakery end, the stepladder at the kebab end, and Odile's
// painted chair with her crate of chalk and a mug.

const PAINTS = ['#d9a441', '#c24a3a', '#2f6f8a', '#c25a7a', '#d98a3a', '#6a8a4a', '#e8dcc0'];

/** Paint-spattered canvas drop cloth (colour), with drips in the panel colours. */
function dropClothCanvas(seed, colors) {
  const R = rngOf(seed);
  return canvas(512, 1024, (g, w, h) => {
    g.fillStyle = '#bdb39c';
    g.fillRect(0, 0, w, h);
    // weave and grime
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = R() < 0.5 ? 'rgba(60,50,40,0.06)' : 'rgba(255,250,240,0.05)';
      g.fillRect(R() * w, R() * h, 1 + R() * 3, 1);
    }
    // a seam and a hem
    g.fillStyle = 'rgba(80,70,52,0.25)';
    g.fillRect(0, h * 0.5 - 2, w, 3);
    g.fillRect(4, 0, 3, h);
    g.fillRect(w - 7, 0, 3, h);
    // soft dirt blooms (radial, so they don't read as printed spots)
    for (let i = 0; i < 8; i++) {
      const x = R() * w;
      const y = R() * h;
      const r = 30 + R() * 70;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(70,58,44,0.12)');
      gr.addColorStop(1, 'rgba(70,58,44,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // paint: drips, spatter, a footprint or two, a brush wipe
    for (let i = 0; i < 220; i++) {
      g.fillStyle = colors[(R() * colors.length) | 0];
      g.globalAlpha = 0.55 + R() * 0.45;
      g.beginPath();
      const r = R() < 0.9 ? 0.8 + R() * 3.5 : 4 + R() * 9;
      g.ellipse(R() * w, R() * h, r, r * (0.6 + R() * 0.6), R() * 3, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = colors[(R() * colors.length) | 0];
      g.globalAlpha = 0.5;
      g.lineWidth = 8 + R() * 10;
      g.lineCap = 'round';
      g.beginPath();
      const x = R() * w;
      const y = R() * h;
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 40, y + 20, x + 60 + R() * 60, y - 10 + R() * 30);
      g.stroke();
    }
    g.globalAlpha = 1;
  });
}

/** Wrinkled cloth: a plane on the ground with soft folds and a raised edge. */
function clothGeometry(w, d, seed) {
  const R = rngOf(seed);
  const geo = new THREE.PlaneGeometry(w, d, 14, 40).rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const folds = [0, 1, 2, 3].map(() => ({ z: (R() - 0.5) * d * 0.85, a: 0.018 + R() * 0.02, w: 0.06 + R() * 0.1, ang: (R() - 0.5) * 0.9 }));
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    let y = 0.003 + 0.002 * Math.sin(x * 23 + z * 7) + 0.002 * Math.sin(z * 17);
    let fold = 0;
    for (const f of folds) {
      const dz = z - f.z - x * f.ang;
      fold += f.a * Math.exp(-(dz * dz) / (f.w * f.w));
    }
    y += fold;
    // the edge against the wall rides up a little
    if (x < -w / 2 + 0.06) y += 0.01;
    p.setY(i, y);
    // baked occlusion: crests catch the light, the flat cloth between folds sits darker
    const k = 0.8 + 0.2 * Math.min(1, fold / 0.02);
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/** A house-painting brush (handle, ferrule, bristles tipped with paint). Origin at the handle end, along +Y. */
let BRUSH_MATS = null;
export function makeBrush(color, { len = 0.26, width = 0.05 } = {}) {
  const g = new THREE.Group();
  BRUSH_MATS ??= {
    wood: new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: 0.6 }),
    steel: new THREE.MeshStandardMaterial({ color: '#a8a8a4', roughness: 0.35, metalness: 0.8 }),
    bristle: new THREE.MeshStandardMaterial({ color: '#3a2e24', roughness: 0.9 }),
    paint: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }),
  };
  const { wood, steel, bristle, paint } = BRUSH_MATS;
  const hl = len * 0.6;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, hl, 8).translate(0, hl / 2, 0), wood);
  const ferrule = new THREE.Mesh(new THREE.BoxGeometry(width, 0.035, 0.016).translate(0, hl + 0.017, 0), steel);
  const br = new THREE.Mesh(new THREE.BoxGeometry(width * 0.95, len * 0.2, 0.014).translate(0, hl + 0.035 + len * 0.1, 0), bristle);
  const tipGeo = new THREE.BoxGeometry(width * 0.97, len * 0.08, 0.015).translate(0, hl + 0.035 + len * 0.18, 0);
  const col = new THREE.Color(color);
  const ca = new Float32Array(tipGeo.attributes.position.count * 3);
  for (let k = 0; k < ca.length; k += 3) col.toArray(ca, k);
  tipGeo.setAttribute('color', new THREE.BufferAttribute(ca, 3));
  const tip = new THREE.Mesh(tipGeo, paint);
  for (const m of [handle, ferrule, br, tip]) m.castShadow = true;
  g.add(handle, ferrule, br, tip);
  return g;
}

/**
 * Dress the wall side. opts: { wallX, groundAt(x,z), spots, panels }.
 * Returns { chair: {object, seat: Vector3, facing}, paints, dispose() }.
 */
export async function dressWallside(ctx, parent, { wallX, groundAt, spots, panels, lineZ0, lineZ1, ladderZ }) {
  const batch = new Batch('ch5-wallside');
  const root = new THREE.Group();
  root.name = 'ch5-wallside';
  parent.add(root);
  const gy = (x, z) => groundAt(x, z);
  const colors = (panels?.length ? panels.map((p) => p.color).filter(Boolean) : []).concat(PAINTS).slice(0, 7);

  // ---- drop cloths, one canvas shared (flipped / rotated per cloth)
  const clothTex = texFrom(dropClothCanvas(61, colors));
  const clothMat = new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.95, color: '#ffffff', vertexColors: true });
  try {
    ctx.look?.enhance?.(clothMat, 'interior.fabric', { albedo: 0.25, normalScale: 0.6, scale: 1.4, grime: 0.3, wet: 0, level: 0.3 });
  } catch {
    /* flat cloth */
  }
  const clothW = 0.98;
  const cx = wallX + clothW / 2 + 0.02;
  for (const [z, len, seed] of [[-14.6, 4.6, 61], [-21.7, 4.9, 62], [-28.7, 4.6, 63]]) {
    const m = new THREE.Mesh(clothGeometry(clothW, len, seed), clothMat);
    m.position.set(cx, gy(cx, z) + 0.001, z);
    m.rotation.y = (seed - 62) * 0.012 + (seed === 62 ? Math.PI : 0);
    m.receiveShadow = true;
    m.castShadow = false;
    batch.add(m);
  }

  // ---- paint tins along the foot of the wall, their paint the colours of the panels above
  const tinSpots = [
    [-12.9, 0], [-13.15, 1], [-12.7, 2], // bakery end
    [-17.4, 1], [-17.62, 3],
    [-22.6, 2], [-22.35, 4], [-22.85, 0],
    [-26.9, 3], [-27.15, 4],
    [-31.2, 4], [-31.45, 0], [-30.95, 1],
  ];
  const tinProps = await props(ctx, tinSpots.map(() => ['props/paint_can.glb', { height: 0.19 }]));
  const R = rngOf(99);
  const discGeo = new THREE.CircleGeometry(0.067, 20).rotateX(-Math.PI / 2);
  const discs = [];
  tinProps.forEach((t, i) => {
    const [z, ci] = tinSpots[i];
    const x = wallX + 0.16 + R() * 0.12;
    const y = gy(x, z);
    t.position.set(x, y, z);
    t.rotation.y = R() * Math.PI * 2;
    batch.add(t);
    if (!t.userData.isFallback) {
      const col = new THREE.Color(colors[ci % colors.length]);
      const d = new THREE.Mesh(discGeo.clone(), null);
      // vertex colours so every disc merges into one draw
      const n = d.geometry.attributes.position.count;
      const c = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) col.toArray(c, k * 3);
      d.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3));
      d.position.set(x, y + 0.172, z);
      discs.push(d);
    }
  });
  const paintMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0 });
  for (const d of discs) {
    d.material = paintMat;
    batch.add(d);
  }
  // brushes resting across a few tins, and two on the cloth
  const brushes = [];
  for (const [i, lie] of [[1, false], [5, false], [9, false], [12, false], [3, true], [7, true]]) {
    const [z, ci] = tinSpots[i];
    const b = makeBrush(colors[ci % colors.length]);
    const t = tinProps[i];
    if (lie) {
      b.position.set(wallX + 0.55, gy(wallX + 0.55, z) + 0.012, z + 0.4);
      b.rotation.set(Math.PI / 2, 0, 0.6 + R());
    } else {
      b.position.set(t.position.x - 0.12, t.position.y + 0.2, t.position.z - 0.02);
      b.rotation.set(0.15, R() * 0.5, -Math.PI / 2 + 0.08);
    }
    brushes.push(b);
    batch.add(b);
  }

  // ---- trestle table at the bakery end (sketches and tins on a plank)
  {
    const timber = surf(ctx, 'workshop.timber', { wet: 0, grime: 0.5 }, '#6e6050');
    const ply = surf(ctx, 'workshop.plywood', { wet: 0, grime: 0.6 }, '#a08a68');
    const tx = -5.42;
    const tz = -10.4;
    const y0 = gy(tx, tz);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    for (const dz of [-0.7, 0.7]) {
      const z = tz + dz;
      batch.add(slab(0.5, 0.06, 0.07, timber, [tx, y0 + 0.66, z]));
      for (const sx of [-1, 1]) {
        batch.add(rod(V(tx + sx * 0.26, y0, z - 0.06), V(tx + sx * 0.1, y0 + 0.66, z), 0.025, timber, 5));
        batch.add(rod(V(tx + sx * 0.26, y0, z + 0.06), V(tx + sx * 0.1, y0 + 0.66, z), 0.025, timber, 5));
      }
    }
    batch.add(slab(0.62, 0.025, 2.0, ply, [tx, y0 + 0.72, tz]));
    // a rolled sketch and a flat one, chalk-blue lines on cream
    const sketchTex = () =>
      texFrom(
        canvas(256, 192, (g, w, h) => {
          g.fillStyle = '#e8e0cc';
          g.fillRect(0, 0, w, h);
          g.strokeStyle = 'rgba(40,70,110,0.7)';
          g.lineWidth = 2;
          for (let i = 0; i < 5; i++) g.strokeRect(10 + i * 48, 40, 40, 100);
          g.beginPath();
          g.moveTo(8, 150);
          g.lineTo(w - 8, 150);
          g.stroke();
          g.fillStyle = 'rgba(40,70,110,0.7)';
          g.font = '14px "Bradley Hand", cursive';
          g.fillText(ctx.L.ch5.signs.sketch, 12, 24);
        }),
      );
    const sketch = sketchTex();
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: sketch, roughness: 0.9 }));
    relangTexture(sheet.material, sketchTex);
    sheet.position.set(tx + 0.02, y0 + 0.734, tz + 0.25);
    sheet.rotation.y = 0.12;
    batch.add(sheet);
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ddd4bf', roughness: 0.9 }));
    roll.position.set(tx - 0.12, y0 + 0.758, tz - 0.4);
    roll.rotation.y = 0.3;
    batch.add(roll);
    const tins = await props(ctx, [['props/paint_can.glb', { height: 0.19 }], ['props/paint_can.glb', { height: 0.19 }]]);
    tins[0].position.set(tx + 0.1, y0 + 0.733, tz - 0.6);
    tins[1].position.set(tx - 0.1, y0 + 0.733, tz - 0.78);
    tins.forEach((t) => batch.add(t));
  }

  // ---- stepladders: one folded open along the wall at the kebab end, one at the mural with a
  // neighbour up it (kept loose: it steps aside, behind a cut, while Hugo paints the line)
  const [lad, muralLadder] = await props(ctx, [['props/stepladder.glb', { height: 1.34 }], ['props/stepladder.glb', { height: 1.34 }]]);
  {
    const lz = Math.min(lineZ1 - 0.9, -32.9);
    lad.position.set(wallX + 0.42, gy(wallX + 0.42, lz), lz);
    lad.rotation.y = Math.PI / 2 + 0.06;
    batch.add(lad);
    const mz = ladderZ ?? -21.4;
    // Steps away from the wall (+X), the back legs against it.
    muralLadder.position.set(wallX + 0.56, gy(wallX + 0.56, mz), mz);
    muralLadder.rotation.y = Math.PI;
    root.add(muralLadder);
  }

  // ---- Odile's chair (faces the mural), her milk crate with a chalk tin and a mug
  const [ox, oz] = spots.odileChair;
  const facing = Math.atan2(wallX - ox, (lineZ0 + lineZ1) / 2 - oz);
  const oy = gy(ox, oz);
  const [chairP, crate] = await props(ctx, [['props/chair_painted.glb', { height: 0.96 }], ['props/milk_crate.glb', { height: 0.27 }]]);
  chairP.position.set(ox, oy, oz);
  chairP.rotation.y = facing;
  chairP.userData.noRestyle = true;
  root.add(chairP); // stays loose: the seat point is read from it
  const side = new THREE.Vector3(Math.cos(facing), 0, -Math.sin(facing)); // chair's right
  const fwd = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
  const cpos = new THREE.Vector3(ox, oy, oz).addScaledVector(side, -0.46).addScaledVector(fwd, 0.1);
  crate.position.copy(cpos);
  crate.rotation.y = facing + 0.3;
  batch.add(crate);
  {
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.095, 14).translate(0, 0.0475, 0), new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.4 }));
    mug.position.copy(cpos).add(new THREE.Vector3(0.05, 0.27, 0.04));
    mug.castShadow = true;
    batch.add(mug);
    const chalkTin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.1).translate(0, 0.025, 0), new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 0.5, metalness: 0.4 }));
    chalkTin.position.copy(cpos).add(new THREE.Vector3(-0.06, 0.27, -0.06));
    chalkTin.rotation.y = 0.4;
    batch.add(chalkTin);
    const chalkMat = new THREE.MeshStandardMaterial({ color: '#efeadc', roughness: 0.95 });
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 6).rotateZ(Math.PI / 2), chalkMat);
      c.position.copy(cpos).add(new THREE.Vector3(-0.1 + i * 0.022, 0.325, -0.06));
      c.rotation.y = 0.4 + i * 0.1;
      batch.add(c);
    }
  }
  // The seat point (pelvis over root for the seated clips): a hair in front of the chair centre.
  const seat = new THREE.Vector3(ox, oy, oz).addScaledVector(fwd, 0.035);

  batch.build(root);
  return {
    chair: { object: chairP, seat, facing },
    muralLadder,
    dispose() {
      batch.dispose();
    },
  };
}
