import * as THREE from 'three';
import * as B from '../../build.js';
import { Batch, canvas, texFrom, rngOf, surf, slab, rod, props } from './util.js';
import { makeBrush } from './wallside.js';

// Ch5: No. 14's garage door fully open. Just inside: the workbench with the vice, the pegboard with
// its painted tool outlines (and the small wristwatch outline Odile has already painted around the
// nail), the 3D watch that Hugo hangs there, a bench lamp and a failing tube, Hugo's old race bike
// clean on a repair stand, Odile's old signs against the wall, and the OPEN sign from Ch4 under the
// awning. Interior props don't cast sun shadows (the room is lit by its own bulbs), and the small
// ones are hidden when the camera is far up the street.

const PB_W = 1.6;
const PB_H = 1.0;
const NAIL_Y = 1.62;

/** Pegboard: hardboard with holes, painted tool outlines, and the wristwatch outline at the nail. */
function pegboardCanvas(w, h, outlines, watch, label) {
  const R = rngOf(1414);
  return canvas(w, h, (g) => {
    g.fillStyle = '#8f7c62';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) {
      g.fillStyle = R() < 0.5 ? 'rgba(40,26,14,0.07)' : 'rgba(255,240,210,0.05)';
      g.fillRect(R() * w, R() * h, 1 + R() * 3, 1 + R() * 2);
    }
    // grime: handprints and oil at working height, darker toward the bottom
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(30,20,10,0)');
    gr.addColorStop(1, 'rgba(30,20,10,0.25)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(36,24,14,0.16)';
    for (let i = 0; i < 30; i++) {
      g.beginPath();
      g.ellipse(R() * w, h * (0.55 + R() * 0.45), 8 + R() * 26, 6 + R() * 16, R() * 3, 0, Math.PI * 2);
      g.fill();
    }
    const step = w / 36;
    g.fillStyle = 'rgba(24,16,8,0.9)';
    for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) {
      g.beginPath();
      g.arc(x, y, step * 0.13, 0, Math.PI * 2);
      g.fill();
    }
    // painted outlines (cream sign-writer's enamel, a little uneven)
    const px = w / PB_W; // pixels per metre
    g.strokeStyle = 'rgba(236,228,206,0.92)';
    g.lineJoin = 'round';
    g.lineCap = 'round';
    for (const o of outlines) {
      g.save();
      g.translate(o.u * w, o.v * h);
      g.rotate(o.rot || 0);
      g.lineWidth = 0.007 * px;
      const s = px;
      g.beginPath();
      if (o.kind === 'hammer') {
        g.rect(-0.012 * s, -0.12 * s, 0.024 * s, 0.27 * s);
        g.rect(-0.055 * s, -0.15 * s, 0.11 * s, 0.035 * s);
      } else if (o.kind === 'saw') {
        g.moveTo(-0.33 * s, -0.06 * s);
        g.lineTo(0.2 * s, -0.08 * s);
        g.lineTo(0.2 * s, 0.07 * s);
        g.lineTo(0.31 * s, 0.07 * s);
        g.lineTo(0.31 * s, -0.09 * s);
        g.lineTo(0.2 * s, -0.09 * s);
        g.moveTo(-0.33 * s, -0.06 * s);
        g.lineTo(-0.33 * s, 0.0 * s);
        g.lineTo(0.2 * s, 0.07 * s);
      } else if (o.kind === 'spanner') {
        g.rect(-0.011 * s, -0.15 * s, 0.022 * s, 0.3 * s);
        g.moveTo(0.03 * s, -0.16 * s);
        g.arc(0, -0.16 * s, 0.03 * s, 0, Math.PI * 2);
        g.moveTo(0.028 * s, 0.17 * s);
        g.arc(0, 0.17 * s, 0.028 * s, 0, Math.PI * 2);
      } else if (o.kind === 'driver') {
        g.rect(-0.016 * s, -0.1 * s, 0.032 * s, 0.1 * s);
        g.moveTo(0, 0);
        g.lineTo(0, 0.11 * s);
      } else if (o.kind === 'pliers') {
        g.moveTo(-0.01 * s, -0.08 * s);
        g.lineTo(-0.03 * s, 0.1 * s);
        g.moveTo(0.01 * s, -0.08 * s);
        g.lineTo(0.03 * s, 0.1 * s);
        g.moveTo(0.012 * s, -0.08 * s);
        g.arc(0, -0.08 * s, 0.012 * s, 0, Math.PI * 2);
      } else if (o.kind === 'brush') {
        g.rect(-0.01 * s, -0.16 * s, 0.02 * s, 0.17 * s);
        g.rect(-0.027 * s, 0.01 * s, 0.054 * s, 0.09 * s);
      } else if (o.kind === 'square') {
        g.moveTo(-0.12 * s, -0.12 * s);
        g.lineTo(-0.12 * s, 0.12 * s);
        g.lineTo(0.12 * s, 0.12 * s);
        g.lineTo(0.12 * s, 0.09 * s);
        g.lineTo(-0.09 * s, 0.09 * s);
        g.lineTo(-0.09 * s, -0.12 * s);
        g.closePath();
      }
      g.stroke();
      g.restore();
    }
    // The wristwatch outline, painted small around the nail, as if it had always been there.
    const x = watch.u * w;
    const y = watch.v * h;
    g.lineWidth = 0.006 * px;
    g.strokeStyle = 'rgba(232,196,120,0.95)';
    g.beginPath();
    g.roundRect(x - 0.014 * px, y - 0.012 * px, 0.028 * px, 0.21 * px, 0.01 * px);
    g.stroke();
    g.beginPath();
    g.roundRect(x - 0.024 * px, y + 0.058 * px, 0.048 * px, 0.05 * px, 0.012 * px);
    g.stroke();
    g.font = `italic ${Math.round(0.022 * px)}px Georgia, serif`;
    g.fillStyle = 'rgba(232,196,120,0.9)';
    g.textAlign = 'center';
    g.fillText(label, x, y + 0.25 * px);
  });
}

/** Watch face decal: a dim LCD reading 0.0 (L.watch.zero: '0,0' in French). */
function faceCanvas(zero = '0.0') {
  return canvas(64, 64, (g) => {
    g.fillStyle = '#0b120e';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#7f9a7a';
    g.font = '700 22px ui-monospace, Menlo, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(zero, 32, 36);
    g.font = '700 8px ui-monospace, Menlo, monospace';
    g.fillText('km', 32, 52);
  });
}

/** One of Odile's old shop signs (enamel paint on board). */
function oldSign(text, w, h, bg, fg) {
  return B.sign(text, w, h, { bg, fg, font: 'Georgia, "Times New Roman", serif', weathered: 0.6, letterSpacing: 3, border: fg, pxPerM: 220 });
}

/**
 * Dress the workshop. opts: { spots, wallZ (interior back wall z), openSign (canvas|texture), T5, shell (build a floor and wall linings) }.
 * Returns { pegboard, nail, watch, race, bulb, tubeMat, nailPoint, detail, update(dt, raw, camera), dispose() }.
 */
export async function buildWorkshop(ctx, parent, { spots, wallZ, openSign, T5, shell = false }) {
  const batch = new Batch('ch5-workshop');
  const detailBatch = new Batch('ch5-workshop-detail');
  const root = new THREE.Group();
  root.name = 'ch5-workshop';
  parent.add(root);
  const detail = new THREE.Group(); // small props: hidden from far away
  detail.name = 'ch5-workshop-detail';
  root.add(detail);

  const [nx, nz] = spots.nail;
  const pbZ = Number.isFinite(wallZ) ? Math.max(nz - 0.95, wallZ + 0.035) : nz - 0.95;
  const IW = { x0: -2.6, x1: 2.6, z0: Number.isFinite(wallZ) ? wallZ : pbZ - 0.04, z1: -48, h: 3.1 };

  // ---- shell: joists; and, when the street brought no room of its own, a concrete floor and
  // whitewashed brick linings
  {
    const depth = IW.z1 - IW.z0;
    const timber = surf(ctx, 'workshop.timber', { grime: 0.5 }, '#6e6050');
    for (let i = 0; i < 6; i++) batch.add(slab(IW.x1 - IW.x0, 0.16, 0.08, timber, [0, IW.h - 0.17, IW.z0 + 0.4 + i * ((depth - 0.6) / 5)], { cast: false }));
  }
  if (shell) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(IW.x1 - IW.x0, IW.z1 - IW.z0).rotateX(-Math.PI / 2), surf(ctx, 'workshop.concrete', {}, '#7a7268'));
    floor.position.set(0, 0.004, (IW.z0 + IW.z1) / 2);
    floor.receiveShadow = true;
    batch.add(floor);
    const brick = surf(ctx, 'workshop.brick', {}, '#a8a296');
    const lin = (w, h, x, z, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), brick);
      m.position.set(x, h / 2, z);
      m.rotation.y = ry;
      m.receiveShadow = true;
      return m;
    };
    const depth = IW.z1 - IW.z0;
    batch.add(lin(IW.x1 - IW.x0, IW.h, 0, IW.z0 + 0.02, 0));
    batch.add(lin(depth, IW.h, IW.x0 + 0.02, (IW.z0 + IW.z1) / 2, Math.PI / 2));
    batch.add(lin(depth, IW.h, IW.x1 - 0.02, (IW.z0 + IW.z1) / 2, -Math.PI / 2));
  }

  // ---- workbench in front of the pegboard
  const pbCx = nx - 0.35;
  const pbCy = 1.45;
  const benchZ = pbZ + 0.34;
  const TOP = 0.9;
  {
    const ply = surf(ctx, 'workshop.plywood', { grime: 0.7 }, '#a08a68');
    const timber = surf(ctx, 'workshop.timber', { grime: 0.6 }, '#6e6050');
    batch.add(slab(1.86, 0.045, 0.64, ply, [pbCx, TOP - 0.045, benchZ]));
    batch.add(slab(1.86, 0.1, 0.05, timber, [pbCx, TOP - 0.145, benchZ + 0.3]));
    for (const sx of [-0.86, 0.86]) for (const sz of [-0.26, 0.26]) batch.add(slab(0.075, TOP - 0.045, 0.075, timber, [pbCx + sx, 0, benchZ + sz]));
    batch.add(slab(1.72, 0.03, 0.56, ply, [pbCx, 0.2, benchZ]));
    for (const sx of [-0.86, 0.86]) batch.add(slab(0.06, 0.06, 0.52, timber, [pbCx + sx, 0.14, benchZ]));
  }

  // Years of work on the bench top: tin rings, paint drips, oil, a pencil line or two (decal).
  {
    const R = rngOf(515);
    const tex = texFrom(
      canvas(512, 192, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        const ring = (x, y, r, c, a) => {
          g.strokeStyle = c;
          g.globalAlpha = a;
          g.lineWidth = 2 + R() * 3;
          g.beginPath();
          g.arc(x, y, r, R() * 0.5, Math.PI * 2 - R() * 0.8);
          g.stroke();
        };
        for (let i = 0; i < 9; i++) ring(R() * w, R() * h, 16 + R() * 6, ['#d9a441', '#8a2b22', '#3a3530', '#2f6f8a'][i % 4], 0.5 + R() * 0.4);
        for (let i = 0; i < 160; i++) {
          g.globalAlpha = 0.3 + R() * 0.6;
          g.fillStyle = ['#d9a441', '#8a2b22', '#e8dcc0', '#2f6f8a', '#3a3530'][(R() * 5) | 0];
          g.beginPath();
          g.arc(R() * w, R() * h, 0.6 + R() * 3, 0, Math.PI * 2);
          g.fill();
        }
        for (let i = 0; i < 6; i++) {
          const x = R() * w;
          const y = R() * h;
          const r = 14 + R() * 30;
          const gr = g.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, 'rgba(30,22,14,0.45)');
          gr.addColorStop(1, 'rgba(30,22,14,0)');
          g.globalAlpha = 1;
          g.fillStyle = gr;
          g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        g.globalAlpha = 0.6;
        g.strokeStyle = '#3a3a3a';
        g.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          g.beginPath();
          const x = R() * w;
          g.moveTo(x, R() * h);
          g.lineTo(x + (R() - 0.5) * 120, R() * h);
          g.stroke();
        }
      }),
    );
    const top = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.6).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    );
    top.position.set(pbCx, TOP + 0.001, benchZ);
    top.receiveShadow = true;
    batch.add(top);
  }

  // ---- pegboard (hardboard + a timber frame) with tool outlines and the watch outline
  const px = (u) => pbCx + (u - 0.5) * PB_W;
  const py = (v) => pbCy + (0.5 - v) * PB_H;
  const watchUV = { u: (nx - pbCx) / PB_W + 0.5, v: 0.5 - (NAIL_Y - pbCy) / PB_H };
  const tools = [
    { kind: 'hammer', u: 0.08, v: 0.42, path: 'props/hammer.glb' },
    { kind: 'saw', u: 0.32, v: 0.22, path: 'props/handsaw.glb' },
    { kind: 'square', u: 0.3, v: 0.62 },
    { kind: 'spanner', u: 0.18, v: 0.6, path: 'props/spanner.glb' },
    { kind: 'spanner', u: 0.22, v: 0.62, path: 'props/spanner.glb', s: 0.8 },
    { kind: 'driver', u: 0.5, v: 0.55, path: 'props/screwdriver.glb' },
    { kind: 'driver', u: 0.55, v: 0.55, path: 'props/screwdriver.glb', s: 0.85 },
    { kind: 'pliers', u: 0.6, v: 0.25, path: 'props/pliers.glb' },
    { kind: 'brush', u: 0.88, v: 0.42 }, // out on the street
    { kind: 'brush', u: 0.93, v: 0.42 },
  ];
  const pbArt = () => texFrom(pegboardCanvas(1024, 640, tools, watchUV, ctx.L.ch5.signs.rest));
  const pbTex = pbArt();
  const pegMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: pbTex, roughness: 0.85 });
  B.relangTexture(pegMat, pbArt); // 'rest' under the watch outline
  try {
    ctx.look?.enhance?.(pegMat, 'workshop.plywood', { albedo: 0.2, normalScale: 0.5, roughnessVar: 0.5 });
  } catch {
    /* flat board */
  }
  const peg = new THREE.Mesh(new THREE.BoxGeometry(PB_W, PB_H, 0.012), [null, null, null, null, pegMat, null].map((m) => m || surf(ctx, 'workshop.timber', {}, '#6e6050')));
  peg.position.set(pbCx, pbCy, pbZ - 0.006);
  peg.receiveShadow = true;
  peg.userData.dynamic = true; // multi-material: kept as is
  root.add(peg);
  {
    const timber = surf(ctx, 'workshop.timber', { grime: 0.6 }, '#6e6050');
    const t = 0.045;
    batch.add(slab(PB_W + 2 * t, t, 0.03, timber, [pbCx, pbCy + PB_H / 2, pbZ]));
    batch.add(slab(PB_W + 2 * t, t, 0.03, timber, [pbCx, pbCy - PB_H / 2 - t, pbZ]));
    for (const s of [-1, 1]) batch.add(slab(t, PB_H, 0.03, timber, [pbCx + s * (PB_W / 2 + t / 2), pbCy - PB_H / 2, pbZ]));
  }
  // the real tools in their outlines (the brushes and the square are out)
  const toolList = tools.filter((t) => t.path);
  const toolProps = await props(ctx, toolList.map((t) => [t.path, {}]));
  const hookMat = new THREE.MeshStandardMaterial({ color: '#8c8c88', roughness: 0.4, metalness: 0.8 });
  toolProps.forEach((p, i) => {
    const t = toolList[i];
    const x = px(t.u);
    const y = py(t.v);
    const z = pbZ + 0.004;
    if (t.s) p.scale.setScalar(t.s);
    if (t.kind === 'hammer') p.position.set(x, y - 0.15, z + 0.012);
    else if (t.kind === 'saw') {
      p.rotation.y = Math.PI / 2;
      p.position.set(x, y - 0.08, z + 0.02);
    } else if (t.kind === 'spanner') {
      p.rotation.x = Math.PI / 2;
      p.position.set(x, y, z);
    } else if (t.kind === 'driver') {
      p.rotation.z = Math.PI;
      p.position.set(x, y + 0.1, z + 0.014);
    } else if (t.kind === 'pliers') p.position.set(x, y - 0.08, z + 0.01);
    for (const m of [p]) m.traverse((o) => o.isMesh && (o.castShadow = false));
    detailBatch.add(p);
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.05, 5).rotateX(Math.PI / 2), hookMat);
    hook.position.set(x, t.kind === 'saw' ? y + 0.02 : y + (t.kind === 'hammer' ? 0.1 : t.kind === 'pliers' ? 0.08 : 0.12), pbZ + 0.025);
    detailBatch.add(hook);
  });

  // ---- the nail and the watch (hidden until he hangs it)
  const nail = new THREE.Group();
  {
    const steel = new THREE.MeshStandardMaterial({ color: '#9a9ca0', metalness: 0.85, roughness: 0.35 });
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.045, 6).rotateX(Math.PI / 2), steel);
    shank.position.z = 0.022;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.0025, 10).rotateX(Math.PI / 2), steel);
    head.position.z = 0.045;
    nail.add(shank, head);
    nail.position.set(nx, NAIL_Y, pbZ);
    root.add(nail);
  }
  const watch = new THREE.Group();
  {
    const [w] = await props(ctx, [['props/wrist_watch.glb', { width: 0.036 }]]);
    if (!w.userData.isFallback) {
      // The strap lies flat along Z with the face up: stand it up so it hangs from the clasp end.
      w.rotation.x = Math.PI / 2;
      w.position.set(0, -0.11, 0.003);
      watch.add(w);
      const zero = () => texFrom(faceCanvas((ctx.L.watch?.zero || '0.0 km').replace(/\s*km$/, '')));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.026, 0.024), new THREE.MeshBasicMaterial({ map: zero(), toneMapped: false, color: '#9fb59a' }));
      B.relangTexture(face.material, zero);
      face.position.set(0, -0.11 + 0.019, 0.0105);
      watch.add(face);
    } else {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.2, 0.004), new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.7 }));
      strap.position.y = -0.1;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.04, 0.012), new THREE.MeshStandardMaterial({ color: '#3a3d42', metalness: 0.5, roughness: 0.4 }));
      body.position.set(0, -0.09, 0.006);
      watch.add(strap, body);
    }
    watch.position.set(nx, NAIL_Y, pbZ + 0.008);
    watch.rotation.z = 0.04;
    watch.visible = false;
    watch.traverse((o) => o.isMesh && (o.castShadow = false));
    root.add(watch);
  }

  // ---- on and around the bench
  const items = await props(ctx, [
    ['props/bench_vice.glb', {}],
    ['props/oil_can.glb', { height: 0.2 }],
    ['props/paint_can.glb', { height: 0.19 }],
    ['props/paint_can.glb', { height: 0.19 }],
    ['props/paint_can.glb', { height: 0.19 }],
    ['props/radio.glb', { height: 0.24 }],
    ['props/toolbox.glb', { height: 0.3 }],
    ['props/stool.glb', { height: 0.62 }],
    ['props/track_pump.glb', { height: 0.58 }],
    ['props/steel_shelves.glb', { height: 2.0 }],
    ['props/cardboard_box.glb', { height: 0.3 }],
    ['props/cardboard_box.glb', { height: 0.26 }],
    ['props/crate_wood.glb', { height: 0.35 }],
    ['props/milk_crate.glb', { height: 0.26 }],
    ['props/paint_can.glb', { height: 0.19 }],
    ['props/paint_can.glb', { height: 0.19 }],
  ]);
  const [vice, oil, can1, can2, jar, radio, toolbox, stool, pump, shelves, box1, box2, crate, milk, can3, can4] = items;
  const front = benchZ + 0.32;
  vice.position.set(pbCx + 0.74, TOP - 0.086 - 0.002, front - 0.12);
  oil.position.set(pbCx + 0.45, TOP, benchZ - 0.12);
  oil.rotation.y = -0.6;
  can1.position.set(pbCx - 0.62, TOP, benchZ - 0.05);
  can2.position.set(pbCx - 0.45, TOP, benchZ + 0.08);
  jar.position.set(pbCx - 0.25, TOP, benchZ - 0.16);
  radio.position.set(pbCx + 0.15, TOP, benchZ - 0.2);
  radio.rotation.y = 0.12;
  toolbox.position.set(pbCx - 0.4, 0.215, benchZ);
  toolbox.rotation.y = 0.2;
  crate.position.set(pbCx + 0.35, 0.215, benchZ - 0.02);
  stool.position.set(pbCx - 0.55, 0, front + 0.45);
  stool.rotation.y = 0.5;
  pump.position.set(nx + 1.65, 0, pbZ + 0.25);
  pump.rotation.y = -0.4;
  shelves.position.set(IW.x0 + 0.3, 0, pbZ + 1.55);
  shelves.rotation.y = Math.PI / 2;
  box1.position.set(IW.x0 + 0.3, 1.36, pbZ + 1.4);
  box2.position.set(IW.x0 + 0.3, 0.06, pbZ + 1.75);
  box2.rotation.y = 0.3;
  milk.position.set(IW.x0 + 0.35, 0, pbZ + 2.6);
  milk.rotation.y = 0.4;
  can3.position.set(IW.x0 + 0.28, 0.79, pbZ + 1.25);
  can4.position.set(IW.x0 + 0.3, 0.79, pbZ + 1.42);
  for (const p of [vice, oil, can1, can2, jar, radio, pump, box1, box2, milk, can3, can4, shelves, stool, crate, toolbox]) {
    p.traverse((o) => o.isMesh && (o.castShadow = false));
    detailBatch.add(p);
  }
  // paint in the open tins, brushes in the jar
  {
    const pm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32 });
    const disc = (c, at) => {
      const geo = new THREE.CircleGeometry(0.067, 20).rotateX(-Math.PI / 2);
      const col = new THREE.Color(c);
      const a = new Float32Array(geo.attributes.position.count * 3);
      for (let k = 0; k < a.length; k += 3) col.toArray(a, k);
      geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
      const m = new THREE.Mesh(geo, pm);
      m.position.copy(at.position).add(new THREE.Vector3(0, 0.172, 0));
      detailBatch.add(m);
    };
    disc('#d9a441', can1);
    disc('#8a2b22', can2);
    disc('#e8dcc0', can3);
    for (const [i, c] of ['#d9a441', '#2f6f8a', '#3a3530'].entries()) {
      const b = makeBrush(c, { len: 0.24, width: 0.035 });
      b.rotation.set(0.12 * (i - 1), i, 0.1 * (i - 1));
      b.position.copy(jar.position).add(new THREE.Vector3((i - 1) * 0.02, 0.05, 0));
      b.traverse((o) => o.isMesh && (o.castShadow = false));
      detailBatch.add(b);
    }
  }

  // ---- Odile's old signs leaning on the right wall, two spare tyres on a hook
  {
    const s1 = oldSign('TABAC', 1.3, 0.42, '#2d4a6e', '#e2d6bc');
    s1.position.set(IW.x1 - 0.12, 0.22, pbZ + 2.2);
    s1.rotation.set(0, -Math.PI / 2, 0);
    s1.rotateX(-0.12);
    const s2 = oldSign('CAFÉ DU MARCHÉ', 1.6, 0.5, '#5a2a24', '#e8cf9e');
    s2.position.set(IW.x1 - 0.2, 0.27, pbZ + 2.75);
    s2.rotation.set(0, -Math.PI / 2, 0);
    s2.rotateX(-0.16);
    for (const s of [s1, s2]) {
      s.castShadow = false;
      s.receiveShadow = true;
      detailBatch.add(s);
    }
    const tyre = new THREE.MeshStandardMaterial({ color: '#1d1d1f', roughness: 0.9 });
    for (let i = 0; i < 2; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.016, 8, 40), tyre);
      t.position.set(IW.x1 - 0.06 - i * 0.035, 2.0 - i * 0.04, pbZ + 1.3);
      t.rotation.y = Math.PI / 2;
      t.rotation.x = 0.05 * i;
      detailBatch.add(t);
    }
  }

  // ---- Hugo's old race bike, clean, on a repair stand (front wheel toward the door)
  const standX = nx + 1.15;
  const standZ = pbZ + 1.0;
  const race = B.bicycle({ frame: '#34506e', rust: 0 }); // the team blue of Ch1 and Ch4, cleaned
  {
    const parts = race.children;
    const frameMesh = parts.find((p) => p.name === 'bike-frame');
    if (frameMesh) {
      const fm = frameMesh.material;
      frameMesh.material = new THREE.MeshPhysicalMaterial({ color: fm.color, roughness: 0.32, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12 });
      fm.dispose();
    }
    const chain = parts[2];
    if (chain?.material) {
      chain.material.color.set('#d4d7db');
      chain.material.metalness = 0.9;
      chain.material.roughness = 0.2;
    }
    race.position.set(standX, 0.32, standZ);
    race.traverse((o) => o.isMesh && (o.castShadow = false));
    detail.add(race);
    const steel = new THREE.MeshStandardMaterial({ color: '#2e3034', roughness: 0.45, metalness: 0.7 });
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const post = V(standX - 0.32, 0, standZ - 0.18);
    const top = V(standX - 0.32, 1.12, standZ - 0.18);
    detailBatch.add(rod(post, top, 0.022, steel, 8));
    for (const a of [0, 2.1, 4.2]) detailBatch.add(rod(V(post.x, 0.25, post.z), V(post.x + Math.cos(a) * 0.42, 0.01, post.z + Math.sin(a) * 0.42), 0.014, steel, 6));
    const clampAt = V(standX, 1.12, standZ - 0.27);
    detailBatch.add(rod(top, clampAt, 0.016, steel, 6));
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.06), new THREE.MeshStandardMaterial({ color: '#7a1e18', roughness: 0.5 }));
    jaw.position.copy(clampAt);
    detailBatch.add(jaw);
  }

  // ---- the bench lamp (enamel shade, a real bulb) and a fluorescent fitting that is going
  const lampAt = new THREE.Vector3(pbCx + 0.15, 1.95, benchZ + 0.05);
  const bulbGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc58a').multiplyScalar(4), toneMapped: false });
  {
    const shadeGeo = new THREE.LatheGeometry(
      [new THREE.Vector2(0.03, 0.12), new THREE.Vector2(0.05, 0.1), new THREE.Vector2(0.12, 0.02), new THREE.Vector2(0.16, -0.02)],
      24,
    );
    const shade = new THREE.Mesh(shadeGeo, new THREE.MeshStandardMaterial({ color: '#3f5446', roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide }));
    shade.position.copy(lampAt);
    detailBatch.add(shade);
    detailBatch.add(rod(lampAt.clone().add(new THREE.Vector3(0, 0.12, 0)), new THREE.Vector3(lampAt.x, IW.h - 0.17, lampAt.z), 0.004, new THREE.MeshStandardMaterial({ color: '#1a1a1a' }), 4));
    const [b] = await props(ctx, [['props/bulb.glb', { height: 0.1, castShadow: false }]]);
    b.rotation.x = Math.PI;
    b.position.copy(lampAt).add(new THREE.Vector3(0, 0.08, 0));
    b.traverse((o) => {
      if (o.isMesh && /glass/i.test(o.material?.name || '')) o.material = bulbGlow;
    });
    detail.add(b);
  }
  const bulb = B.pointLight('#ffc28a', 2.4, { pos: [lampAt.x, lampAt.y - 0.12, lampAt.z], distance: 4.5 });
  bulb.userData.noCone = true;
  root.add(bulb);
  const tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#cfe6d0').multiplyScalar(1.6), toneMapped: false });
  {
    const [f] = await props(ctx, [['props/fluoro_light.glb', { center: false, castShadow: false }]]);
    f.position.set(nx + 0.9, IW.h - 0.02, pbZ + 1.4);
    f.rotation.y = Math.PI / 2;
    f.traverse((o) => {
      if (o.isMesh && /glass/i.test(o.material?.name || '')) {
        o.material = tubeMat;
        o.userData.dynamic = true;
      }
    });
    detail.add(f);
  }

  // ---- the OPEN sign under the awning, from Ch4's board if we have it
  let openSignMesh = null;
  {
    let signTex = null;
    if (openSign) {
      const img = openSign.isTexture ? openSign.image : openSign;
      if (img && (img.width || img.naturalWidth)) signTex = texFrom(img);
    }
    let board;
    if (signTex) {
      const img = signTex.image;
      const aspect = (img.width || 2) / (img.height || 1);
      board = new THREE.Mesh(new THREE.BoxGeometry(0.62 * aspect, 0.62, 0.025), [null, null, null, null, new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.7 }), null].map((m) => m || new THREE.MeshStandardMaterial({ color: '#3b3430', roughness: 0.8 })));
    } else {
      board = B.sign(T5.signs?.open ?? 'OPEN', 1.1, 0.48, { bg: '#e8dfc8', fg: '#8a2b22', font: 'Georgia, serif', border: '#3b3a36', weathered: 0.1 });
    }
    const SX = -2.45;
    const SY = 2.25;
    const SZ = -47.62;
    board.position.set(SX, SY, SZ);
    board.castShadow = true;
    root.add(board);
    openSignMesh = board;
    const chain = new THREE.MeshStandardMaterial({ color: '#3a3a3c', roughness: 0.4, metalness: 0.8 });
    const hw = (board.geometry.parameters?.width ?? 1.1) / 2 - 0.06;
    const hh = (board.geometry.parameters?.height ?? 0.5) / 2;
    for (const s of [-1, 1]) batch.add(rod(new THREE.Vector3(SX + s * hw, SY + hh, SZ), new THREE.Vector3(SX + s * hw * 0.9, 4.15, SZ - 0.15), 0.005, chain, 4));
  }

  batch.build(root);
  detailBatch.build(detail);
  for (const o of detail.children) o.castShadow = false;

  const nailPoint = new THREE.Vector3(nx, NAIL_Y, pbZ + 0.03);
  const centre = new THREE.Vector3(0, 1.2, (IW.z0 + IW.z1) / 2);
  return {
    pegboard: peg,
    nail,
    watch,
    race,
    bulb,
    bulbGlow,
    tubeMat,
    nailPoint,
    openSign: openSignMesh,
    detail,
    update(camera) {
      if (camera) detail.visible = camera.position.distanceTo(centre) < 17;
    },
    dispose() {
      batch.dispose();
      detailBatch.dispose();
    },
  };
}
