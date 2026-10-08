import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as B from '../../build.js';
import { makeLetterBoard } from '../../../story/crafts/letters.js';
import { radioVoice } from '../../../story/crafts/radio.js';

// Ch5's street jobs, the props (docs/DESIGN.md R3.8): Mme Benali's stuck shutter over the bakery,
// Odile's radio on a crate by her chair, Marco's faded A-board between the kebab shop and the bench,
// Ines's bike leaning at the bike-shop window. Each job's own materials hold a grey (sat 0.15) until
// the job is done; setColor(k) brings them back. Nothing here casts a shadow except the bike frame.
//
// buildJobs(ctx, group, {wallX, spots, groundAt, street, signs, word})
//   -> {shutter, radio, board, inesBike, spots, update(dt, raw), dispose()}

const FRONT_X = 5.95; // scene2 facades
export const JOB_SPOTS = {
  // pos: the hotspot; stand: where Hugo works (x, z, facing); shot: the job's camera.
  shutter: { pos: [-4.75, -8.6], radius: 1.4, stand: [-5.2, -8.95, -Math.PI / 2], shot: { pos: [-2.1, 1.5, -5.6], look: [-5.85, 1.45, -9.4], fov: 46 } },
  radio: { pos: [-3.45, -40.15], radius: 1.1, stand: [-3.7, -39.3, -2.2], shot: { pos: [-3.66, 0.74, -39.49], look: [-4.3, 0.47, -39.95], fov: 27 } },
  board: { pos: [-4.15, -34.6], radius: 1.1, stand: [-4.2, -34.6, -Math.PI / 2] },
  wheel: { pos: [4.45, -32.05], radius: 1.2 }, // stand and shot: inesBike.stand() / .shot() (follow the flip)
};
const SHUTTER = { z: (-5.7 + -11.95) / 2, w: 4.6, h: 2.75, stuck: 0.45 };
const RADIO_AT = [-4.3, -39.95];
const BOARD_AT = [-5.0, -34.6];
const BIKE_AT = [5.62, -32.1];
const BIKE_FLIP = [4.72, -32.1]; // upside down on the pavement for the job

const arr = (m) => (Array.isArray(m) ? m : m ? [m] : []);

/** A saturation uniform on a material (the map times colour goes to grey at 0). Null if unsupported. */
function addSat(material) {
  if (!material) return null;
  if (material.userData.__jobSat) return material.userData.__jobSat;
  if (!(material.isMeshStandardMaterial || material.isMeshBasicMaterial || material.isMeshLambertMaterial || material.isMeshPhongMaterial)) return null;
  const u = { value: 1 };
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    shader.uniforms.uJobSat = u;
    shader.fragmentShader =
      'uniform float uJobSat;\n' +
      shader.fragmentShader.replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n{ float gj = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = mix(vec3(gj) * 0.9, diffuseColor.rgb, clamp(uJobSat, 0.0, 1.0)); }',
      );
  };
  const prevKey = material.customProgramCacheKey;
  material.customProgramCacheKey = function () {
    return `${prevKey.call(this)}|jobSat`;
  };
  material.userData.__jobSat = u;
  material.needsUpdate = true;
  return u;
}

/** Colour control over objects / materials: set(k) from a luma grey (0) to their own colour (1). */
function colorControl(items, k0 = 0.15) {
  const us = [];
  const take = (m) => {
    const u = addSat(m);
    if (u && !us.includes(u)) us.push(u);
  };
  for (const it of items) {
    if (!it) continue;
    if (it.isMaterial) take(it);
    else it.traverse?.((o) => o.isMesh && arr(o.material).forEach(take));
  }
  const c = {
    k: k0,
    set(k) {
      c.k = THREE.MathUtils.clamp(k, 0, 1);
      for (const u of us) u.value = c.k;
    },
  };
  c.set(k0);
  return c;
}

/** Fewer draws: the meshes under `root` that share a material become one mesh (in root space). */
function mergeByMaterial(root) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    if (!groups.has(o.material)) groups.set(o.material, []);
    groups.get(o.material).push(o);
  });
  for (const [m, list] of groups) {
    if (list.length < 2) continue;
    const geos = list.map((o) => {
      const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld.clone().premultiply(inv));
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      return g;
    });
    const geo = mergeGeometries(geos);
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    for (const o of list) o.removeFromParent();
    root.add(mesh);
  }
}

// ------------------------------------------------------------------------------------- shutter

/** Slats (u 0 .. 0.94), and a column at the right edge: rust (v 0 .. 0.5) and dark iron (v 0.5 .. 1). */
function shutterTexture() {
  const tex = B.canvasTexture(256, 128, (g, w, h) => {
    const sw = Math.floor(w * 0.94);
    B.paintNoise(g, w, h, '#56685c', 0.05);
    for (let i = 0; i < 4; i++) {
      const y = (i * h) / 4;
      const s = h / 4;
      const grd = g.createLinearGradient(0, y, 0, y + s);
      grd.addColorStop(0, 'rgba(255,255,240,0.18)');
      grd.addColorStop(0.45, 'rgba(255,255,240,0.02)');
      grd.addColorStop(0.85, 'rgba(0,0,0,0.12)');
      grd.addColorStop(1, 'rgba(0,0,0,0.5)');
      g.fillStyle = grd;
      g.fillRect(0, y, sw, s);
    }
    // Rust bleeding down from the edges.
    for (let i = 0; i < 40; i++) {
      const x = Math.random() < 0.5 ? Math.random() * 18 : sw - Math.random() * 18;
      g.fillStyle = `rgba(${120 + Math.random() * 30},${60 + Math.random() * 20},30,${0.15 + Math.random() * 0.3})`;
      g.fillRect(x, Math.random() * h, 1 + Math.random() * 3, 4 + Math.random() * 24);
    }
    // The column (canvas y runs down; v up): iron on top, rust below.
    g.fillStyle = '#2c2a28';
    g.fillRect(sw, 0, w - sw, h / 2);
    g.fillStyle = '#7a4a30';
    g.fillRect(sw, h / 2, w - sw, h / 2);
  });
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** A box's 24 vertices with every UV at (u, v) (a flat colour from the texture). */
function solidBox(w, h, d, x, y, z, u, v) {
  const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v);
  return g;
}

function buildShutter(group, { window: win, sign }) {
  const tex = shutterTexture();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.58, metalness: 0.3 });
  const { z, w, h } = SHUTTER;
  const x = -FRONT_X + 0.068;
  // Runners (static) over scene2's guide rails, in rust; the curtain front and the bottom bar move.
  const runners = [-1, 1].map((s) => solidBox(0.1, h, 0.085, -FRONT_X + 0.062, h / 2, z + s * (w / 2 + 0.01), 0.97, 0.25));
  const bar = solidBox(0.07, 0.06, w, x + 0.012, 0, z, 0.97, 0.75);
  const front = new THREE.PlaneGeometry(w, 1).rotateY(Math.PI / 2).translate(x + 0.005, 0, z);
  for (let i = 0; i < front.attributes.uv.count; i++) front.attributes.uv.setX(i, front.attributes.uv.getX(i) * 0.94);
  const geo = mergeGeometries([...runners, bar, front].map((g) => (g.index ? g.toNonIndexed() : g)));
  const nRun = runners.reduce((n, g) => n + (g.index ? g.index.count : g.attributes.position.count), 0);
  const nBar = bar.index ? bar.index.count : bar.attributes.position.count;
  [...runners, bar, front].forEach((g) => g.dispose());
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const barY = Float32Array.from({ length: nBar }, (_, i) => pos.getY(nRun + i));
  const frontAt = nRun + nBar;
  const frontV = Array.from({ length: pos.count - frontAt }, (_, i) => pos.getY(frontAt + i) > 0); // top vertices
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'job-shutter';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  group.add(mesh);

  const PERIOD = 0.3; // four 7.5 cm slats per texture repeat
  let bottom = h * SHUTTER.stuck; // the curtain's bottom edge (m)
  let twitch = 0;
  let kickT = -1;
  const apply = () => {
    const b = Math.min(h, bottom + twitch);
    const len = h - b;
    for (let i = 0; i < nBar; i++) pos.setY(nRun + i, barY[i] + b + 0.03);
    for (let i = 0; i < frontV.length; i++) {
      const top = frontV[i];
      pos.setY(frontAt + i, top ? h : b);
      uv.setY(frontAt + i, top ? len / PERIOD : 0); // slats ride up with the bottom bar
    }
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    geo.computeBoundingSphere();
  };
  apply();

  // The shop behind: the bakery window dimmed (scene2's interior-mapped pane) until it's open.
  const tint = win?.material?.uniforms?.uTint;
  const base = tint ? tint.value.clone() : null;
  const glowC = new THREE.Color('#ffc98a');
  const color = colorControl([mat, sign]);
  let roll = null; // {t, from}
  const shutter = {
    mesh,
    color,
    open: 0,
    /** A stroke: the curtain jumps up 2 cm and settles. */
    twitch() {
      kickT = 0;
    },
    /** Where the rust comes off (world), the runner on side s (-1 / 1), at the curtain's bottom. */
    runnerAt(s, out = new THREE.Vector3()) {
      return out.set(-FRONT_X + 0.13, bottom + twitch + 0.05, z + s * (w / 2 + 0.01));
    },
    /** Roll it all the way up over `secs`; resolves when it's up. */
    rollUp(secs = 1.6) {
      roll = { t: 0, from: bottom, secs };
      return new Promise((r) => (roll.done = r));
    },
    /** Shop light: 0 dimmed .. 1 open, glow 0 .. 1.4 on top. */
    setShop(k) {
      shutter.open = k;
      if (!tint) return;
      tint.value.copy(base).multiplyScalar(0.55 + 0.45 * k).add(glowC.clone().multiplyScalar(0.18 * 1.4 * k));
    },
    setUp() {
      roll = null;
      bottom = h;
      twitch = 0;
      apply();
    },
    update(dt) {
      if (roll) {
        roll.t += dt;
        const k = Math.min(1, roll.t / roll.secs);
        bottom = roll.from + (h - roll.from) * (1 - (1 - k) * (1 - k));
        if (k >= 1) {
          const done = roll.done;
          roll = null;
          done?.();
        }
        apply();
      } else if (kickT >= 0) {
        // Up 2 cm in 60 ms, then it sags back.
        kickT += dt;
        twitch = 0.02 * (kickT < 0.06 ? kickT / 0.06 : Math.exp(-(kickT - 0.06) * 7));
        if (kickT > 1) {
          kickT = -1;
          twitch = 0;
        }
        apply();
      }
    },
  };
  shutter.setShop(0);
  return shutter;
}

// ------------------------------------------------------------------------------------- radio

/** The dial: a cream scale 88 .. 108 (digits only), a red needle, Odile's chalk ticks. 512 x 72 px. */
function makeDial() {
  const W = 512;
  const H = 72;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const X0 = 34;
  const X1 = 478;
  const xOf = (u) => X0 + (X1 - X0) * u;
  const marks = [];
  let u = 0.16;
  const draw = () => {
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#ecdcaa');
    grd.addColorStop(1, '#c9b27a');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#3a2e22';
    g.fillStyle = '#3a2e22';
    g.lineWidth = 2;
    g.font = '600 19px Georgia, serif';
    g.textAlign = 'center';
    for (let f = 88; f <= 108; f++) {
      const x = xOf((f - 88) / 20);
      const big = f % 4 === 0;
      g.beginPath();
      g.moveTo(x, 34);
      g.lineTo(x, big ? 46 : 41);
      g.stroke();
      if (big) g.fillText(String(f), x, 66);
    }
    g.beginPath();
    g.moveTo(X0, 34);
    g.lineTo(X1, 34);
    g.stroke();
    // Chalk: a short slanted stroke over each found station.
    g.strokeStyle = 'rgba(250,250,245,0.95)';
    g.lineWidth = 5;
    g.lineCap = 'round';
    for (const m of marks) {
      const x = xOf(m);
      g.beginPath();
      g.moveTo(x - 5, 6);
      g.lineTo(x + 4, 27);
      g.stroke();
    }
    // The needle.
    const x = xOf(u);
    g.strokeStyle = '#b3261e';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(x, 2);
    g.lineTo(x, 52);
    g.stroke();
    // Glass sheen and the bezel.
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(0, 0, W, 22);
    g.strokeStyle = 'rgba(40,30,20,0.6)';
    g.lineWidth = 5;
    g.strokeRect(2, 2, W - 4, H - 4);
    tex.needsUpdate = true;
  };
  draw();
  return {
    tex,
    set(v) {
      if (Math.abs(v - u) < 1e-4) return;
      u = v;
      draw();
    },
    mark(v) {
      if (marks.some((m) => Math.abs(m - v) < 1e-3)) return;
      marks.push(v);
      draw();
    },
  };
}

async function buildRadio(ctx, group, { surfaceAt }) {
  const [crate, set] = await Promise.all([
    ctx.assets.prop('props/crate_wood.glb', { height: 0.36, castShadow: false }),
    ctx.assets.prop('props/radio.glb', { height: 0.25, castShadow: false, tint: '#ffffff' }),
  ]);
  const [x, z] = RADIO_AT;
  const y = surfaceAt(x, z);
  const root = new THREE.Group();
  root.name = 'job-radio';
  root.position.set(x, y, z);
  root.rotation.y = 0.95; // its face toward the street and the chair
  crate.rotation.y = 0.2;
  mergeByMaterial(crate);
  root.add(crate);
  set.position.y = 0.36;
  root.add(set);
  // The dial over the tuning slot along the top of the front, the magic eye to its right (measured on
  // the 0.25 m set: the body runs 0.36 .. 0.49 under the handle, its front at z 0.046).
  const dial = makeDial();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.0225), new THREE.MeshStandardMaterial({ map: dial.tex, roughness: 0.35, emissive: '#2a2010', emissiveMap: dial.tex, emissiveIntensity: 0.6 }));
  face.position.set(0, 0.468, 0.049);
  face.name = 'radio-dial';
  root.add(face);
  const lampMat = new THREE.MeshBasicMaterial({ color: '#5cff7a', toneMapped: false, fog: false });
  const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.0075, 16), lampMat);
  lamp.position.set(0.106, 0.468, 0.049);
  lamp.name = 'radio-lamp';
  root.add(lamp);
  group.add(root);
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });

  const voice = radioVoice(ctx.audio);
  const color = colorControl([set]);
  const LAMP = new THREE.Color('#5cff7a');
  let signal = 1;
  let flare = 0;
  const radio = {
    group: root,
    face,
    lamp,
    voice,
    color,
    mode: 'idle', // 'idle' (the fishing, quietly) | 'job' (the craft drives it) | 'music' (fixed)
    setDial(u) {
      dial.set(u);
    },
    setSignal(k) {
      signal = k;
    },
    flare() {
      flare = 1;
    },
    mark(u) {
      dial.mark(u);
    },
    update(dt, player) {
      flare = Math.max(0, flare - dt * 1.6);
      const k = 0.05 + 0.75 * signal * signal + 1.8 * flare;
      lampMat.color.copy(LAMP).multiplyScalar(k);
      voice.update();
      if (radio.mode !== 'job' && player) {
        const p = player.root.position;
        const dist = Math.hypot(p.x - x, p.z - z);
        const fall = THREE.MathUtils.clamp(1 - (dist - 2) / 22, 0.15, 1);
        voice.level((radio.mode === 'music' ? 0.32 : 0.16) * fall, 0.3);
      }
    },
    dispose() {
      voice.dispose();
      dial.tex.dispose();
    },
  };
  return radio;
}

// ------------------------------------------------------------------------------------- the A-board

function buildBoard(ctx, group, { surfaceAt, word }) {
  const LEAF = 0.94;
  const a = 0.2; // each leaf's lean
  const H = LEAF * Math.cos(a);
  const foot = LEAF * Math.sin(a);
  const leafGeo = (sign) =>
    new THREE.BoxGeometry(0.64, LEAF, 0.022)
      .rotateX(-sign * a)
      .translate(0, H / 2, (sign * foot) / 2);
  const geo = mergeGeometries([leafGeo(1), leafGeo(-1)]);
  const frameMat = B.mat('#7a2a22', { roughness: 0.7, surface: false });
  const frame = new THREE.Mesh(geo, frameMat);
  frame.name = 'job-aboard';
  frame.castShadow = false;
  frame.receiveShadow = true;
  const root = new THREE.Group();
  root.name = 'job-board';
  const [x, z] = BOARD_AT;
  root.position.set(x, surfaceAt(x, z), z);
  root.rotation.y = Math.PI / 2 - 0.25; // to the street, turned a little up it
  root.add(frame);
  // The lettering panel on the front leaf (KEBAB, faded): makeLetterBoard, as Ch4's OPEN.
  const board = makeLetterBoard({ w: 0.56, h: 0.36, base: '#e6dcc4', paint: '#a3392b', word, ghost: 'rgba(160,120,120,0.35)' });
  const pivot = new THREE.Group();
  pivot.position.set(0, H / 2, foot / 2);
  pivot.rotation.x = -a;
  pivot.add(board.group);
  board.group.position.set(0, 0.17, 0.011);
  root.add(pivot);
  board.back.visible = false; // the A-board's own leaf backs the panel
  board.guides(false);
  board.update();
  board.group.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  group.add(root);
  const FADED = new THREE.Color(0.66, 0.65, 0.63);
  board.material.color.copy(FADED);
  const color = colorControl([frameMat]);
  return {
    root,
    board,
    color,
    /** Primer from faded (0) to fresh cream (1). */
    setFresh(k) {
      board.material.color.copy(FADED).lerp(new THREE.Color(1, 1, 1), THREE.MathUtils.clamp(k, 0, 1));
    },
    /** The job's camera: square to the panel, fov 30. */
    shot() {
      root.updateMatrixWorld(true);
      const c = board.face.getWorldPosition(new THREE.Vector3());
      const n = new THREE.Vector3(0, 0, 1).transformDirection(board.face.matrixWorld);
      const p = c.clone().addScaledVector(n, 0.8);
      return { pos: [p.x, p.y + 0.01, p.z], look: [c.x, c.y, c.z], fov: 30 };
    },
    dispose() {
      board.dispose();
    },
  };
}

// ------------------------------------------------------------------------------------- Ines's bike

/** Fewer draws for a build.bicycle(): the chain goes into the metal, each tyre and rim into one mesh. */
function slimBike(bike) {
  const plain = (g) => {
    const n = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal'].includes(k)) n.deleteAttribute(k);
    return n;
  };
  const [, metal, chain] = bike.children.filter((o) => o.isMesh);
  if (metal && chain?.geometry?.type === 'TubeGeometry') {
    metal.geometry = mergeGeometries([plain(metal.geometry), plain(chain.geometry)]);
    chain.removeFromParent();
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.45 });
  for (const w of bike.userData.wheels || []) {
    const [tire, rim] = w.children.filter((o) => o.isMesh);
    if (!tire || !rim) continue;
    const tint = (g, c) => {
      const n = plain(g);
      const col = new Float32Array(n.attributes.position.count * 3);
      for (let i = 0; i < col.length; i += 3) col.set([c.r, c.g, c.b], i);
      n.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return n;
    };
    const geo = mergeGeometries([tint(tire.geometry, new THREE.Color('#1c1c1e')), tint(rim.geometry, rim.material.color)]);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'wheel-tyre-rim';
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    tire.removeFromParent();
    rim.removeFromParent();
    w.add(mesh);
  }
}

function buildInesBike(group, { surfaceAt }) {
  const bike = B.bicycle({ frame: '#c24a6a', rust: 0.05 });
  bike.name = 'job-ines-bike';
  bike.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  const frame = bike.getObjectByName('bike-frame');
  if (frame) frame.castShadow = true;
  slimBike(bike);
  const pivot = new THREE.Group();
  pivot.name = 'job-ines';
  pivot.add(bike);
  group.add(pivot);
  const color = colorControl([frame?.material]);
  const api = {
    group: pivot,
    bike,
    color,
    rig: null,
    /** Leaning at the bike-shop window (front wheel up the street). */
    lean() {
      const [x, z] = BIKE_AT;
      pivot.position.set(x, surfaceAt(x, z), z);
      pivot.rotation.set(0, 0, -0.12);
      bike.position.set(0, 0, 0);
      bike.rotation.set(0, 0, 0);
      api.rig?.setSpin(0, { snap: true });
    },
    /** Upside down on its saddle and bars, on the pavement. */
    flip() {
      const [x, z] = BIKE_FLIP;
      pivot.position.set(x, surfaceAt(x, z), z);
      pivot.rotation.set(0, 0, 0);
      bike.rotation.set(0.12, 0, Math.PI); // bars and saddle both on the ground
      bike.position.set(0, 0.945, 0);
      if (api.rig) api.rig.TOP = -Math.PI / 2 + 0.12; // 12 o'clock is near the wheel's own 6 now
    },
    /** The rear axle (world), once flipped. */
    axle() {
      pivot.updateMatrixWorld(true);
      const w = api.rig?.rear || bike.userData.wheels?.[1];
      return w ? w.getWorldPosition(new THREE.Vector3()) : pivot.position.clone();
    },
    /** The rear wheel from the street side, a little behind and above: the whole rim, the chalk tick
     *  at the top and the pads in frame (as the Ch4 truing camera). */
    shot() {
      const a = api.axle();
      return { pos: [a.x - 1.5, a.y + 0.5, a.z - 0.72], look: [a.x, a.y - 0.2, a.z + 0.05], fov: 46 };
    },
    /** Where Hugo kneels: the far side of the wheel, toward the bars, facing the street. */
    stand() {
      const a = api.axle();
      return [a.x + 0.6, a.z + 0.5, -Math.PI / 2 - 0.5];
    },
    update(dt) {
      api.rig?.update(dt);
    },
  };
  api.lean();
  return api;
}

// ------------------------------------------------------------------------------------- build

export async function buildJobs(ctx, group, { spots, groundAt, surfaceAt = groundAt, street, signs, word = 'KEBAB' } = {}) {
  const ground = surfaceAt || (() => 0);
  let win = null;
  street?.traverse((o) => {
    if (o.name === 'bakery-window') win = o;
  });
  const shutter = buildShutter(group, { window: win, sign: signs?.bakery });
  const radio = await buildRadio(ctx, group, { surfaceAt: ground });
  const board = buildBoard(ctx, group, { surfaceAt: ground, word });
  const inesBike = buildInesBike(group, { surfaceAt: ground });
  return {
    shutter,
    radio,
    board,
    inesBike,
    spots: JOB_SPOTS,
    update(dt, raw) {
      const r = raw ?? dt;
      shutter.update(r);
      radio.update(r, ctx.player);
      inesBike.update(r);
    },
    dispose() {
      radio.dispose();
      board.dispose();
    },
  };
}
