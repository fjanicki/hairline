import * as THREE from 'three';
import { L } from '../../story/script.js';
import {
  W,
  D,
  H,
  T,
  IN_X,
  BACK_Z,
  EX,
  WIN,
  DOOR,
  DOOR_X,
  TV_POS,
  TV_TOP,
  FLUORO_Z,
  FRIDGE,
  FRIDGE_FRONT,
  KITCHEN,
  BIKE_POS,
  clamp,
  damp,
  hash,
  boxAt,
  rod,
  place,
  merged,
  Batch,
  cloth,
  softBox,
} from './scene1/common.js';
import { wallpaperTexture, wallUV, paperTexture, floorStainTexture, rugTexture, spillTexture, softDot } from './scene1/textures.js';
import { buildWindow, SODIUM, SODIUM_DIR } from './scene1/window.js';
import {
  buildTrims,
  buildElectrics,
  buildSideboard,
  buildCoffeeTable,
  buildKitchen,
  buildFridge,
  buildRadiator,
  buildLamp,
  buildDoor,
  buildHall,
  buildDeadPlant,
  buildOddments,
} from './scene1/furniture.js';
import {
  buildWatch,
  buildPhone,
  buildXray,
  bibLayout,
  buildBibs,
  buildMedals,
  bikeHooks,
  hangingBike,
  takeaway,
  runningShoes,
  post,
  paperBalls,
} from './scene1/props.js';
import { drawBroadcast } from './scene1/broadcast.js';

// Ch1 "No Impact": Hugo's third-floor flat, night, boot day 4. A 6 x 5 m dollhouse room (the +Z
// wall is omitted so the follow camera sits outside it), dressed as a real, neglected flat:
// nicotine wallpaper peeling off damp plaster, worn PBR floorboards, painted skirting, cornice and
// architraves, a kitchenette, a column radiator, scanned props (CRT, sofa, iron bed, boxes, bin
// bags, the watch) and procedural ones built from the same PBR materials.
//
// Light: the flickering CRT is the key (a shadowed SpotLight forward from the screen); the sodium
// streetlight outside throws the window, its mullions and moving rain drops across the floor
// (shadowed SpotLight with an animated light map) and a visible dusty shaft; one warm floor lamp;
// the failing fluorescent strip under the kitchen shelf. The chapter's interior_dim HDRI fills.
//
// Layout (top view, camera at +Z looking toward -Z):
//   back wall z = -2.5:  bed + bibs (left) | lamp, window + radiator, watch on the sill | tin under the
//                        drip | TV on the sideboard | dead plant, door, bin bags
//   left wall:           bibs above the bed; medals; the rusting race bike on two hooks
//   middle:              rug, coffee table (phone, takeaway), foam roller, sofa facing the TV
//   right wall:          crutches, fridge (X-ray), kitchenette under its strip light, pedal bin
//   front-left corner:   moving boxes

const TV_COLOR = 0x9fb7d6;
const TV_INTENSITY = 20; // candela at full brightness (spot, forward from the screen)
const SHOT_LEVELS = [1.0, 0.8, 0.62]; // relative screen brightness per broadcast shot
const SHOT_TINT = [new THREE.Color('#a9bfda'), new THREE.Color('#9fc0a0'), new THREE.Color('#b4c2cf')];

const FLUORO_COLOR = 0xcfe6d0;
const FLUORO_INTENSITY = 2.4;
const LAMP_INTENSITY = 1.5;

// Every PBR id this chapter's build uses (loaded behind the fade, so nothing pops in).
const MATERIAL_IDS = [
  'flat_floorboards',
  'plaster_painted',
  'tile_white_long',
  'fabric_wool',
  'metal_painted_rusty',
  'wood_planks_painted',
  'wood_plywood',
  'metal_plate_worn',
];

// ------------------------------------------------------------------ materials

function makeMaterials(ctx) {
  const look = ctx.look;
  const lib = ctx.materials;
  const own = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });
  const S = (name, opts = {}) => (look?.surface ? look.surface(name, opts) : own(opts.color || '#8a8478'));
  const enh = (m, id, o) => {
    try {
      lib?.enhance?.(m, id, o);
    } catch (e) {
      console.warn('[hairline] ch1 material enhance failed', id, e);
    }
    return m;
  };
  const glow = (c, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), fog: false });
  return {
    trim: S('workshop.paintedWood', { tint: '#ddd3bb', level: 0.22, scale: 0.45 }),
    door: enh(own('#7d766a', { roughness: 0.7 }), 'wood_planks_painted', { albedo: 0.25, scale: 0.35, roughnessVar: 0.6 }),
    kitchen: S('workshop.paintedWood', { tint: '#c3c9ac', level: 0.18, scale: 0.4 }),
    teak: S('workshop.plywood', { tint: '#8f5c34', level: 0.055, scale: 0.6, roughness: 0.75 }),
    worktop: S('workshop.plywood', { tint: '#cbbfa4', level: 0.17, scale: 0.9, roughness: 0.7 }),
    tile: S('interior.tile', { scale: 0.8 }),
    rust: S('metal.rust', { scale: 0.35, level: 0.16 }),
    fabric: S('interior.fabric', { tint: '#8a7356', level: 0.07, side: THREE.DoubleSide }),
    duvet: S('interior.fabric', { tint: '#6f7c8a', level: 0.08, scale: 1.6 }),
    sheet: S('interior.fabric', { tint: '#bdb6a4', level: 0.2, scale: 2 }),
    blanket: S('interior.fabric', { tint: '#7f6a5a', level: 0.07, scale: 1.2 }),
    lino: S('interior.tile', { tint: '#8a7a64', level: 0.12, scale: 2 }),
    hallWall: S('interior.plaster', { tint: '#c8b48e', level: 0.26 }),
    fridge: enh(own('#cfc8b4', { roughness: 0.42 }), 'metal_painted_rusty', { albedo: 0.4, level: 0.3, scale: 0.7, roughnessVar: 0.8 }),
    steel: enh(own('#8d9093', { metalness: 0.85, roughness: 0.45 }), 'metal_plate_worn', { albedo: 0.5, scale: 0.4, roughnessVar: 0.7 }),
    chrome: own('#b8bbbe', { metalness: 1, roughness: 0.28 }),
    alu: own('#a3a6a8', { metalness: 0.9, roughness: 0.4 }),
    brass: own('#8c7448', { metalness: 0.9, roughness: 0.45 }),
    dark: own('#1f2023', { roughness: 0.6 }),
    dark2: own('#121315', { roughness: 0.5 }),
    // Small table clutter takes a scanned detail too (scuffs, fibre, stains), so it sits beside the CRT scan.
    plastic: enh(own('#a7a293', { roughness: 0.55 }), 'plaster_painted', { albedo: 0.35, scale: 0.12, normalScale: 0.4, roughnessVar: 0.7, grime: 0.5 }),
    plasticRed: own('#8a3a30', { roughness: 0.5 }),
    rubber: own('#2a2c30', { roughness: 0.75 }),
    paper: enh(own('#a8a296', { roughness: 0.92 }), 'plaster_painted', { albedo: 0.45, scale: 0.15, normalScale: 0.5, grime: 0.4 }),
    paperFlat: own('#a39e92', { roughness: 1, flatShading: true }),
    cardboard: enh(own('#9a7d58', { roughness: 0.9 }), 'wood_plywood', { albedo: 0.3, scale: 0.18, normalScale: 0.5, grime: 0.5 }),
    carton: enh(own('#a49d8c', { roughness: 0.85 }), 'plaster_painted', { albedo: 0.55, scale: 0.1, normalScale: 0.6, roughnessVar: 0.6, grime: 0.6 }),
    crockery: own('#8e897c', { roughness: 0.3 }),
    glass: own('#3d4a44', { roughness: 0.12, metalness: 0.1 }),
    terracotta: own('#8a5a44', { roughness: 0.92 }),
    leaf: own('#6b5a3a', { roughness: 0.9, side: THREE.DoubleSide }),
    phone: own('#1c1e22', { roughness: 0.35 }),
    saddle: own('#1d1d1f', { roughness: 0.55 }),
    teamBlue: own('#7d8fa6', { roughness: 0.8 }),
    teamWhite: enh(own('#a09a88', { roughness: 0.7 }), 'metal_plate_worn', { albedo: 0.35, scale: 0.15, normalScale: 0.4, roughnessVar: 0.6, grime: 0.4 }),
    shoe: own('#8fa448', { roughness: 0.7 }),
    sole: own('#b3aea2', { roughness: 0.8 }),
    ribbons: [
      own('#7a2a28', { roughness: 0.6, side: THREE.DoubleSide }),
      own('#2a3e66', { roughness: 0.6, side: THREE.DoubleSide }),
      own('#6a5a2a', { roughness: 0.6, side: THREE.DoubleSide }),
    ],
    shade: new THREE.MeshStandardMaterial({
      color: '#9a8566',
      roughness: 0.9,
      side: THREE.DoubleSide,
      emissive: new THREE.Color('#ff9a50'),
      emissiveIntensity: 0.32,
    }),
    bulb: glow('#ffc890', 4),
  };
}

// ------------------------------------------------------------------ walls (one atlas)

/**
 * Axis-aligned wall box from world extents, UV-mapped into the wallpaper atlas by face (the back
 * wall's faces, the left and right walls' inner faces), with the cut faces (wall tops, front
 * ends) painted dark through vertex colours.
 */
function wallSlab(x0, x1, y0, y1, z0, z1, cap) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const uv = g.attributes.uv;
  const col = new Float32Array(pos.count * 3);
  const capCol = new THREE.Color(cap);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = nrm.getX(i);
    const ny = nrm.getY(i);
    const nz = nrm.getZ(i);
    let u;
    if (Math.abs(nz) > 0.5) u = wallUV('back', x, y);
    else if (nx > 0.5) u = wallUV('left', z, y);
    else if (nx < -0.5) u = wallUV('right', z, y);
    else u = [0.001, 0.001];
    uv.setXY(i, u[0], u[1]);
    const isCut = (ny > 0.5 && y > H - 0.01) || (nz > 0.5 && z > D / 2 - 0.01);
    const c = isCut ? capCol : { r: 1, g: 1, b: 1 };
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// ------------------------------------------------------------------ dust (lit only in the beams)

/**
 * Motes drifting through the room, shaded in the vertex shader: they glow amber where the
 * streetlight's beam passes (the same parallelepiped as the shaft), blue-grey in the TV's cone,
 * and are nearly invisible elsewhere. One draw.
 */
function dustMotes(count, tvPos) {
  const base = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    base[i * 3] = -2.2 + hash(i * 1.1) * 4.2;
    base[i * 3 + 1] = 0.2 + hash(i * 2.3) * 2.3;
    base[i * 3 + 2] = -2.35 + hash(i * 3.7) * 3.6;
    seed[i] = hash(i * 9.3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(base, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const ex = new THREE.Vector3(1, 0, 0);
  const ey = new THREE.Vector3(0, 1, 0);
  const inv = new THREE.Matrix3().set(ex.x, ey.x, SODIUM_DIR.x, ex.y, ey.y, SODIUM_DIR.y, ex.z, ey.z, SODIUM_DIR.z).invert();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uKnock: { value: 0 },
      uMap: { value: softDot() },
      uO: { value: new THREE.Vector3(WIN.x0, WIN.y0, BACK_Z - 0.06) },
      uInv: { value: inv },
      uSize: { value: new THREE.Vector3(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0, 4.6) },
      uSodium: { value: new THREE.Color(SODIUM).multiplyScalar(1.6) },
      uTv: { value: new THREE.Color(TV_COLOR).multiplyScalar(0.9) },
      uTvPos: { value: tvPos.clone() },
      uTvLevel: { value: 1 },
      uScale: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uTime, uKnock, uTvLevel, uScale;
      uniform vec3 uO, uSize, uSodium, uTv, uTvPos;
      uniform mat3 uInv;
      varying vec3 vCol;
      void main() {
        vec3 p = position;
        float ph = seed * 40.0;
        p.x += 0.07 * sin(uTime * 0.13 + ph);
        p.y += 0.12 * sin(uTime * 0.09 + ph * 1.3) + uKnock * 0.02 * sin(ph * 5.0 + uTime * 40.0);
        p.z += 0.06 * cos(uTime * 0.11 + ph);
        vec3 q = uInv * (p - uO);
        vec3 inB = step(vec3(0.0), q) * step(q, uSize);
        float beam = inB.x * inB.y * inB.z * (1.0 - q.z / uSize.z);
        vec3 tv = p - uTvPos;
        float tvk = uTvLevel * smoothstep(0.2, 0.75, normalize(tv).z) * clamp(1.6 / (0.6 + dot(tv, tv)), 0.0, 1.0);
        float twinkle = 0.6 + 0.4 * sin(uTime * (1.5 + seed * 2.0) + ph);
        vCol = (uSodium * beam + uTv * tvk * 0.5 + vec3(0.012)) * twinkle;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uScale * (5.0 + 5.0 * seed) / max(0.5, -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec3 vCol;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).r;
        gl_FragColor = vec4(vCol * a, 1.0);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.name = 'dust';
  pts.userData.noOcclude = true;
  return pts;
}

// ------------------------------------------------------------------ builder

export async function buildScene1(ctx) {
  const { assets } = ctx;
  const group = new THREE.Group();
  group.name = 'scene1';
  const matsReady = ctx.materials?.preload ? ctx.materials.preload(MATERIAL_IDS, { timeout: 4000 }).catch(() => {}) : null;
  const mats = makeMaterials(ctx);
  const batch = new Batch();
  const bibs = bibLayout();

  // ---- floor: the PBR boards with the flat's own stains over them; the under-slab of the cut
  const floorMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: floorStainTexture(), roughness: 0.8 });
  ctx.look?.enhance?.(floorMat, 'interior.floorboards', { albedo: 1 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), floorMat);
  floor.receiveShadow = true;
  floor.name = 'floor';
  group.add(floor);
  group.add(merged([new THREE.BoxGeometry(W + T, 0.3, D + 0.08).translate(0, -0.155, -0.04)], mats.dark2, { castShadow: false, name: 'under-slab' }));
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.4, 0.12, D + 0.4).translate(0, H + 0.06, 0),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  ceiling.name = 'ceiling-shadow-caster';
  ceiling.castShadow = true; // invisible, but keeps the streetlight out of everywhere except the window
  group.add(ceiling);

  // ---- walls: one merged mesh on the wallpaper atlas (bib shadows painted into it)
  const zb0 = -D / 2 - T / 2;
  const zb1 = BACK_Z;
  const cap = 0x2b2d30;
  const walls = [
    wallSlab(-EX, WIN.x0, 0, H, zb0, zb1, cap),
    wallSlab(WIN.x0, WIN.x1, 0, WIN.y0, zb0, zb1, cap),
    wallSlab(WIN.x0, WIN.x1, WIN.y1, H, zb0, zb1, cap),
    wallSlab(WIN.x1, DOOR.x0, 0, H, zb0, zb1, cap),
    wallSlab(DOOR.x0, DOOR.x1, DOOR.h, H, zb0, zb1, cap),
    wallSlab(DOOR.x1, EX, 0, H, zb0, zb1, cap),
    wallSlab(-EX, -IN_X, 0, H, BACK_Z, D / 2, cap),
    wallSlab(IN_X, EX, 0, H, BACK_Z, D / 2, cap),
  ];
  const wallTex = wallpaperTexture((g, frame) => {
    // soft shadows behind the bibs (their curled corners lift off the wall)
    for (const b of bibs) {
      frame(b.wall);
      g.save();
      g.translate(b.s + 0.008, b.y - 0.012);
      g.rotate(b.rot);
      g.fillStyle = 'rgba(25,20,12,0.2)';
      g.fillRect(-b.w / 2 - 0.006, -b.h / 2 - 0.006, b.w + 0.012, b.h + 0.012);
      g.fillStyle = 'rgba(25,20,12,0.22)';
      g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      g.restore();
    }
  });
  const wallMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: wallTex, vertexColors: true, roughness: 0.9 });
  ctx.look?.enhance?.(wallMat, 'interior.plaster', { albedo: 0.5, normalScale: 1.2 });
  group.add(merged(walls, wallMat, { name: 'walls' }));

  // Wallpaper strips curling off by the window and in the corner.
  const paperMat = new THREE.MeshStandardMaterial({ color: '#99917f', map: paperTexture(), roughness: 0.95, side: THREE.DoubleSide });
  const peel = (w, h, curl, [x, y, z], rz, ry = 0) => {
    const geo = new THREE.PlaneGeometry(w, h, 1, 8);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) + h / 2) / h;
      p.setZ(i, curl * t * t);
      p.setY(i, p.getY(i) - curl * 0.35 * t * t * t);
    }
    geo.computeVertexNormals();
    geo.rotateZ(rz);
    geo.rotateY(ry);
    geo.translate(x, y, z);
    return geo;
  };
  group.add(
    merged(
      [peel(0.14, 0.22, 0.035, [WIN.x0 - 0.17, 0.68, BACK_Z + 0.003], Math.PI - 0.15), peel(0.12, 0.2, 0.03, [WIN.x1 + 0.25, 2.12, BACK_Z + 0.003], 0.08)],
      paperMat,
      { name: 'peeling-paper', castShadow: false },
    ),
  );

  // ---- trims, electrics, window, fittings, furniture (static pieces go into the batch)
  buildTrims(batch, mats);
  buildElectrics(batch, mats);
  const win = buildWindow(group, batch, mats);
  buildRadiator(batch, mats);
  buildSideboard(batch, mats);
  const tableTop = buildCoffeeTable(batch, mats, [0.55, -1.0]);
  const kitchen = buildKitchen(batch, mats);
  group.add(buildFridge(batch, mats));
  const lamp = buildLamp(batch, mats);
  group.add(lamp.shade, lamp.bulb, lamp.light);
  buildDeadPlant(batch, mats, [1.5, -2.2]);
  buildOddments(batch, mats);

  // Rug under the table: threadbare, its corner kicked up.
  const rugMat = new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.95 });
  ctx.look?.enhance?.(rugMat, 'interior.fabric', { albedo: 0.4 });
  const rugGeo = new THREE.PlaneGeometry(2.0, 1.4, 12, 8).rotateX(-Math.PI / 2);
  const rp = rugGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i);
    const z = rp.getZ(i);
    const k = Math.max(0, (x - 0.6) / 0.4) * Math.max(0, (z - 0.35) / 0.35);
    rp.setY(i, 0.006 + 0.05 * k * k + 0.002 * Math.sin(x * 9) * Math.sin(z * 7));
  }
  rugGeo.computeVertexNormals();
  const rug = new THREE.Mesh(rugGeo, rugMat);
  rug.position.set(0.55, 0, -0.72);
  rug.rotation.y = 0.04;
  rug.receiveShadow = true;
  rug.name = 'rug';
  group.add(rug);
  // Coir door mat.
  batch.add(mats.blanket, boxAt(DOOR_X - 0.32, DOOR_X + 0.32, 0, 0.012, -2.38, -2.0), { castShadow: false });

  // Bed linen on the iron frame: mattress, a sheet half off, a balled-up duvet, the pillow.
  const bedX = -IN_X + 0.47;
  const bedZ = BACK_Z + 1.02;
  const springY = 0.49;
  batch.add(mats.sheet, softBox(0.86, 0.17, 1.92, { e: 0.18, detail: 5, seed: 2, sag: 0.12 }).translate(bedX, springY + 0.085, bedZ));
  batch.add(
    mats.duvet,
    cloth(1.05, 1.25, { seg: 22, lumps: 0.06, drop: 0.32, dropSides: [0, 1, 0, 1], seed: 4, thick: 0.05 }).translate(bedX + 0.05, springY + 0.2, bedZ + 0.25),
  );
  batch.add(
    mats.sheet,
    softBox(0.56, 0.13, 0.36, { e: 0.45, detail: 4, lumps: 0.008, seed: 7, sag: 0.35 })
      .rotateY(0.12)
      .rotateZ(0.06)
      .translate(bedX - 0.02, springY + 0.23, bedZ - 0.72),
  );
  // A hoodie dropped at the foot of the bed.
  batch.add(
    mats.blanket,
    cloth(0.5, 0.4, { seg: 10, lumps: 0.05, seed: 9, thick: 0.03 })
      .rotateY(0.7)
      .translate(bedX + 0.15, springY + 0.21, bedZ + 0.75),
  );
  // Blanket on the sofa seat, half on the floor.
  batch.add(
    mats.blanket,
    cloth(0.9, 0.7, { seg: 16, lumps: 0.045, drop: 0.28, dropSides: [0, 0, 0, 1], seed: 11, thick: 0.025 })
      .rotateY(Math.PI + 0.15)
      .translate(1.1, 0.43, 0.32),
  );

  // ---- props: scans (every load fails soft to a grey box of the right size)
  const P = (path, opts) => assets.prop(path, opts);
  const [tv, sofa, bed, boxA, boxB, boxC, boxD, bagA, bagB, tin, fluoro] = await Promise.all([
    P('props/crt_tv.glb', { center: false }),
    P('props/sofa_worn.glb', { height: 0.82 }),
    P('props/iron_bed.glb', {}),
    P('props/cardboard_box.glb', { height: 0.48 }),
    P('props/cardboard_box.glb', { height: 0.4 }),
    P('props/cardboard_box.glb', { height: 0.5 }),
    P('props/cardboard_box.glb', { height: 0.34 }),
    P('props/trash_bag.glb', { height: 0.55 }),
    P('props/trash_bag.glb', { height: 0.42 }),
    P('props/paint_can.glb', { height: 0.15 }),
    P('props/fluoro_light.glb', { center: false }),
  ]);
  const put = (o, x, z, rotY = 0, y = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = rotY;
    group.add(o);
    return o;
  };
  put(tv, TV_POS[0], -2.132, 0, TV_TOP);
  if (tv.userData.isFallback) tv.position.z = TV_POS[1];
  put(sofa, 0.55, 0.42, Math.PI);
  put(bed, bedX, bedZ);
  put(boxA, -2.6, 1.5, 0.15);
  put(boxB, -2.12, 1.6, -0.25);
  put(boxC, -2.55, 2.12, 1.45);
  put(boxD, -2.58, 1.46, 0.5, boxA.userData.size?.y ?? 0.48);
  put(bagA, 2.64, -2.1, 0.6);
  put(bagB, 2.66, -1.62, 2.1);
  put(tin, -0.32, -2.25, 0.3);
  fluoro.rotation.y = Math.PI / 2;
  put(fluoro, IN_X - 0.13, FLUORO_Z, Math.PI / 2, kitchen.shelfY - 0.002);

  // ---- the TV: a live broadcast on a curved plane just inside the CRT's glass
  const scr = tv.userData.isFallback
    ? { x: 0, y: tv.userData.size.y * 0.55, z: tv.userData.size.z / 2 + 0.004, w: tv.userData.size.x * 0.75, h: tv.userData.size.y * 0.6 }
    : { x: -0.066, y: 0.259, z: 0.17, w: 0.37, h: 0.28 };
  const tvTex = new THREE.CanvasTexture(document.createElement('canvas'));
  tvTex.image.width = 256;
  tvTex.image.height = 192;
  tvTex.colorSpace = THREE.SRGBColorSpace;
  tvTex.generateMipmaps = false;
  tvTex.minFilter = THREE.LinearFilter;
  const tvCtx = tvTex.image.getContext('2d');
  const screenMat = new THREE.MeshBasicMaterial({ map: tvTex, fog: false });
  const sg = new THREE.PlaneGeometry(scr.w, scr.h, 8, 6);
  const sp = sg.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const u = sp.getX(i) / (scr.w / 2);
    const v = sp.getY(i) / (scr.h / 2);
    sp.setZ(i, 0.012 * (1 - u * u * 0.8) * (1 - v * v * 0.8));
  }
  const screen = new THREE.Mesh(sg, screenMat);
  screen.position.set(scr.x, scr.y, scr.z);
  screen.name = 'tv-screen';
  tv.add(screen);
  const ticker = () => `${L.ch1.tvTicker}     ·     ${L.ch1.tvTicker}     `; // read per frame: follows the language
  const screenWorld = new THREE.Vector3(TV_POS[0] + scr.x, TV_TOP + scr.y, tv.position.z + scr.z);
  // Rabbit-ear aerial on top.
  const ax = TV_POS[0] + 0.12;
  const ay = TV_TOP + (tv.userData.size?.y ?? 0.46);
  const az = tv.position.z - 0.08;
  batch.add(mats.dark, new THREE.CylinderGeometry(0.045, 0.05, 0.03, 14).translate(ax, ay + 0.015, az));
  batch.add(mats.chrome, rod(new THREE.Vector3(ax, ay + 0.03, az), new THREE.Vector3(ax - 0.22, ay + 0.42, az - 0.05), 0.003, 5), { castShadow: false });
  batch.add(mats.chrome, rod(new THREE.Vector3(ax, ay + 0.03, az), new THREE.Vector3(ax + 0.12, ay + 0.46, az - 0.08), 0.003, 5), { castShadow: false });
  // A remote and a mug next to the TV.
  batch.add(mats.dark, place(new THREE.BoxGeometry(0.05, 0.02, 0.17), [TV_POS[0] - 0.48, TV_TOP + 0.01, -2.0], [0, 0.4, 0]), { castShadow: false });

  // ---- story props
  const watch = await buildWatch(assets, mats);
  watch.group.position.set(-0.9, WIN.y0 + 0.016, BACK_Z + 0.02);
  group.add(watch.group);

  const phone = buildPhone(mats);
  phone.group.position.set(1.0, tableTop + 0.001, -0.92);
  phone.group.rotation.y = 0.35;
  group.add(phone.group);
  // The screen lights his face when he holds it up.
  const phoneLight = new THREE.PointLight(0xbcd0ff, 0, 1.5, 2); // lights his face and hand when awake
  phoneLight.position.set(0, 0.06, 0);
  phone.group.add(phoneLight);

  const xray = buildXray();
  xray.position.set(FRIDGE_FRONT - 0.016, 1.18, 0.78);
  xray.rotation.set(0, -Math.PI / 2, 0.035);
  group.add(xray);

  group.add(buildBibs(bibs));
  buildMedals(batch, mats);
  bikeHooks(batch, mats);
  const bike = hangingBike(ctx.materials, mats);
  group.add(bike);

  // Litter: takeaway on the table and the floor, mugs, pills, the bidon; pizza boxes by the door.
  const TA = takeaway(mats);
  TA.cartons(batch, [
    [0.2, -1.08, 0.3, tableTop],
    [0.42, -0.86, -0.5, tableTop],
    [1.58, 0.92, 0.9, 0, 1.4],
    [-0.38, 1.2, 0.2, 0, 1.5],
  ]);
  const mug = (x, y, z, r = 0, into = batch) => {
    into.add(mats.plastic, place(new THREE.CylinderGeometry(0.042, 0.038, 0.095, 14, 1, true), [x, y + 0.0475, z], [0, r, 0]));
    into.add(mats.dark2, new THREE.CylinderGeometry(0.039, 0.039, 0.003, 14).translate(x, y + 0.06, z), { castShadow: false });
    into.add(mats.plastic, place(new THREE.TorusGeometry(0.025, 0.006, 6, 10), [x + 0.045 * Math.cos(r), y + 0.05, z - 0.045 * Math.sin(r)], [0, r, 0]), {
      castShadow: false,
    });
  };
  // The coffee-table mug is loose (its own little group, pivot at its base) so it can rattle when
  // the table rocks; the table itself stays in the batch.
  const tableMug = new THREE.Group();
  tableMug.name = 'table-mug';
  tableMug.position.set(0.78, tableTop, -1.12);
  const loose = new Batch();
  mug(0, 0, 0, 0.6, { add: (m, g) => loose.add(m, g) }); // one set per material (no shadow pass in Ch1)
  loose.flush(tableMug, 'table-mug'); // two draw calls (plastic, coffee)
  group.add(tableMug);
  // Sunday's bib, folded in four, under the near leg once he steadies the table (hidden till then).
  const shim = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.003, 0.04), new THREE.MeshStandardMaterial({ color: '#d9d3c4', roughness: 0.95 }));
  shim.name = 'table-shim';
  shim.position.set(1.04, 0.0095, -0.77); // on the rug (its top is ~8 mm up)
  shim.rotation.y = 0.3;
  shim.visible = false;
  group.add(shim);
  mug(KITCHEN.depth > 0 ? IN_X - 0.25 : 0, KITCHEN.top, 1.45, 1.2);
  mug(-1.2, WIN.y0 + 0.012, BACK_Z + 0.06, 2.2);
  // ibuprofen: a box and a popped blister strip
  batch.add(mats.paper, place(new THREE.BoxGeometry(0.1, 0.025, 0.05), [0.62, tableTop + 0.0125, -0.82], [0, -0.3, 0]));
  batch.add(mats.chrome, place(new THREE.BoxGeometry(0.1, 0.004, 0.045), [0.5, tableTop + 0.002, -0.78], [0, 0.5, 0]), { castShadow: false });
  // the bidon (a cycling water bottle, old team colours)
  batch.add(mats.teamWhite, new THREE.CylinderGeometry(0.036, 0.036, 0.19, 14).translate(0.92, tableTop + 0.095, -1.15));
  batch.add(mats.dark, new THREE.CylinderGeometry(0.02, 0.03, 0.04, 10).translate(0.92, tableTop + 0.21, -1.15));
  for (const [z, rz, x] of [
    [-1.32, -1.38, IN_X - 0.05],
    [-1.02, -1.32, IN_X - 0.07],
  ]) {
    const pz = TA.pizza();
    pz.position.set(x, 0.17, z);
    pz.rotation.set(0, 0, rz);
    group.add(pz);
  }
  post(batch, mats, DOOR_X, -2.3);
  runningShoes(batch, mats, [1.95, -2.18], 0.35);
  paperBalls(batch, mats, 2.38, -1.95, 4);
  paperBalls(batch, mats, -0.75, 1.85, 3);

  // A wet sheen on the boards under the window (rain gets in), and the tin catching the drip.
  const wetTex = softDot();
  const wet = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.45).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: '#0d0e0c',
      roughness: 0.06,
      metalness: 0,
      transparent: true,
      opacity: 0.55,
      alphaMap: wetTex,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  wet.position.set(-1.0, 0.003, -2.2);
  wet.renderOrder = 1;
  wet.name = 'wet-patch';
  group.add(wet);
  const dripMat = new THREE.MeshBasicMaterial({ color: '#8c9aa6', transparent: true, opacity: 0.55, depthWrite: false });
  const drip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6).scale(1, 2.2, 1), dripMat);
  drip.name = 'drip';
  group.add(drip);
  const ripple = new THREE.Mesh(
    new THREE.RingGeometry(0.01, 0.016, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#9aa4ac', transparent: true, opacity: 0, depthWrite: false }),
  );
  ripple.position.set(-0.32, (tin.userData.size?.y ?? 0.15) - 0.02, -2.25);
  group.add(ripple);

  // ---- the failing fluorescent strip under the kitchen shelf (the scan's tube is the emitter)
  let tubeMat = null;
  fluoro.traverse((o) => {
    if (o.isMesh && /glass/i.test(o.material?.name || '')) {
      o.material = o.material.clone();
      o.material.emissive = new THREE.Color(FLUORO_COLOR);
      o.material.emissiveIntensity = 2.5;
      tubeMat = o.material;
    }
    if (o.isMesh) o.castShadow = false;
  });
  if (!tubeMat) {
    tubeMat = new THREE.MeshStandardMaterial({ color: '#dfe9de', emissive: new THREE.Color(FLUORO_COLOR), emissiveIntensity: 2.5 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.84, 10).rotateX(Math.PI / 2), tubeMat);
    tube.position.set(IN_X - 0.13, kitchen.shelfY - 0.03, FLUORO_Z);
    group.add(tube);
  }
  const fluoroLight = new THREE.PointLight(FLUORO_COLOR, FLUORO_INTENSITY, 3.4, 2);
  fluoroLight.position.set(IN_X - 0.24, kitchen.shelfY - 0.12, FLUORO_Z);
  fluoroLight.name = 'fluoro';
  group.add(fluoroLight);

  // ---- door: the leaf on its hinges, light spill on the floor, the lit landing behind
  const door = buildDoor(mats);
  group.add(door);
  const hall = buildHall(mats);
  group.add(hall);
  const spillMat = new THREE.MeshBasicMaterial({
    map: spillTexture(),
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.0).rotateX(-Math.PI / 2), spillMat);
  spill.position.set(DOOR_X, 0.006, BACK_Z + 0.5);
  spill.renderOrder = 2;
  spill.userData.noOcclude = true;
  group.add(spill);
  // the bright crack under the door
  const crackMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc88a').multiplyScalar(1.2), fog: false });
  const crack = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.x1 - DOOR.x0 - 0.06, 0.012).translate(DOOR_X, 0.006, -2.48), crackMat);
  group.add(crack);

  // ---- lights
  // The CRT: a soft, shadowed spot forward from the glass (no shadow of the set on its own wall),
  // and a dim fill just in front of it so the sideboard and the wall round it pick up the glow.
  const tvLight = new THREE.SpotLight(TV_COLOR, TV_INTENSITY, 9, 1.18, 0.85, 2);
  tvLight.name = 'tv-light';
  // Aimed at the sofa / Hugo's head height, not down at the coffee table: in the spot's near field
  // the table top used to burn out brighter than the screen.
  tvLight.position.copy(screenWorld).add(new THREE.Vector3(0, 0.02, 0.07));
  tvLight.target.position.set(screenWorld.x - 0.05, 0.85, 2.4);
  tvLight.castShadow = true;
  tvLight.shadow.mapSize.set(1024, 1024);
  tvLight.shadow.camera.near = 0.08;
  tvLight.shadow.camera.far = 8;
  tvLight.shadow.bias = -0.0006;
  tvLight.shadow.normalBias = 0.03;
  tvLight.shadow.radius = 5;
  tvLight.userData.noCone = true;
  const tvFill = new THREE.PointLight(TV_COLOR, 0.6, 1.5, 2);
  tvFill.position.copy(screenWorld).add(new THREE.Vector3(0, -0.06, 0.3));
  // The landing's bulkhead (on the stairwell wall, away from the door leaf so its edge doesn't clip).
  const hallLight = new THREE.PointLight(0xffc98a, 0, 6, 2);
  hallLight.position.set(DOOR_X + 0.2, 1.75, -3.9);
  // The landing light leaking under the door: a low warm key for the door corner (the phone and
  // door close-ups), so the door, the boards and the bin bags get a highlight, not just the crack.
  const underDoor = new THREE.PointLight(0xffc28a, 0.9, 3.2, 1.6);
  underDoor.position.set(DOOR_X - 0.15, 0.35, -1.75); // off the door, so it washes it instead of a hot spot
  underDoor.userData.noCone = true;
  group.add(tvLight, tvLight.target, tvFill, hallLight, underDoor);

  // ---- dust drifting through the beams
  const dust = dustMotes(260, screenWorld);
  group.add(dust);

  batch.flush(group, 'flat');
  await matsReady;

  // ------------------------------------------------------------------ live state
  const tvState = { on: true, offT: 0, shot: 0, shotT: 0, nextCut: 4.5, level: 1, dip: 0, power: 1, redraw: 0 };
  const phoneState = { mode: 'idle', glow: 0.1 }; // idle | awake | read
  const doorState = { spill: 0.35, level: 0.18, open: 0, openTarget: 0 };
  // Fluorescent flicker: a stutter sequence of [on (0..1), seconds] every ~7 s.
  const FLICKER = [
    [0, 0.07],
    [1, 0.05],
    [0, 0.16],
    [0.55, 0.06],
    [0, 0.32],
    [1, 0.04],
    [0, 0.06],
  ];
  const fl = { next: 5.5, seq: null, i: 0, tt: 0, on: 1, prev: 1 };
  const dripState = { t: 1.2, y: H, falling: false, ring: 1 };
  const tvTint = new THREE.Color().copy(SHOT_TINT[0]);
  let knock = 0; // decays after each hammer blow from downstairs
  const jig = { t: 9, amp: 0 }; // the table rocking: the phone and the mug rattle (0.6 s, damped)
  let t = 0;
  let rainAcc = 0;
  const audio = ctx.audio;

  // ---- sound sources (docs/assets/sfx.md, Ch1): point sources placed in the room, started on the first
  // frame (not during the build), stopped by soundsOff() at the door or by main.js at the next chapter.
  const SND = {
    fridge: [FRIDGE.x, 0.45, FRIDGE.z], // the compressor, low at the back
    tube: [IN_X - 0.13, kitchen.shelfY - 0.03, FLUORO_Z],
    tv: screenWorld.toArray(),
  };
  const snd = { started: false, off: false, fridge: null, hum: null, tv: null, wakes: 0, wasAwake: false };
  const startSounds = () => {
    snd.started = true;
    if (!audio?.loopSfx) return;
    // On 'beds' (the bus, through the beds gain): room tone ducks under the voices with the rain.
    snd.fridge = audio.loopSfx('amb_fridge_hum', { volume: 0.15, bus: 'beds', pos: SND.fridge, ref: 1.5, fade: 1.5 });
    snd.hum = audio.loopSfx('fluoro_hum', { volume: 0.1, bus: 'beds', pos: SND.tube, ref: 1.5, fade: 1.5 });
    if (tvState.on) snd.tv = audio.loopSfx('tv_race_bed', { volume: 0.3, bus: 'beds', band: 'tv', pos: SND.tv, ref: 2, fade: 1.5 });
  };
  const phoneBuzz = (volume = 0.45) => audio?.sfx?.('phone_vibrate_table', { volume, jitter: 0.03, pos: phone.group, ref: 1.5 });

  function update(_dt, raw) {
    t += raw;
    if (!snd.started) startSounds();

    // TV: broadcast shots cut every few seconds; light follows the picture, plus CRT flicker.
    if (tvState.on) {
      tvState.shotT += raw;
      if (t > tvState.nextCut) {
        tvState.shot = (tvState.shot + 1) % 3;
        tvState.shotT = 0;
        tvState.nextCut = t + 3.5 + Math.random() * 2.5;
        tvState.dip = 0.5; // the cut itself blinks
      }
      tvState.redraw -= raw;
      if (tvState.redraw <= 0) {
        tvState.redraw = 1 / 12;
        drawBroadcast(tvCtx, 256, 192, t, tvState.shot, tvState.shotT, ticker());
        tvTex.needsUpdate = true;
      }
      if (Math.random() < raw * 0.7) tvState.dip = Math.max(tvState.dip, 0.2 + Math.random() * 0.25);
    } else if (screen.visible) {
      // CRT switch-off: collapse to a bright line, then to nothing.
      tvState.offT += raw;
      const a = clamp(tvState.offT / 0.09, 0, 1);
      const b = clamp((tvState.offT - 0.09) / 0.22, 0, 1);
      screen.scale.set(Math.max(0.01, 1 - b), Math.max(0.02, 1 - a * 0.98), 1);
      tvState.power = (1 + 0.6 * a) * (1 - b);
      if (b >= 1) screen.visible = false;
    } else tvState.power = 0;
    tvState.level = damp(tvState.level, SHOT_LEVELS[tvState.shot], 14, raw);
    tvState.dip = Math.max(0, tvState.dip - raw * 5);
    const flick = 0.93 + 0.045 * Math.sin(t * 23.7) + 0.025 * Math.sin(t * 61.3 + 1.7);
    const k = tvState.level * flick * (1 - tvState.dip);
    const lightK = tvState.on ? k : tvState.power * (screen.scale.y > 0.5 ? 1 : 0.15);
    tvTint.lerp(SHOT_TINT[tvState.shot], 1 - Math.exp(-6 * raw));
    tvLight.color.copy(tvTint);
    tvLight.intensity = TV_INTENSITY * lightK;
    tvFill.intensity = 0.9 * lightK;
    screenMat.color.setScalar(1.45 * k * (tvState.on ? 1 : tvState.power) + 0.04);
    dust.material.uniforms.uTvLevel.value = lightK;

    // Fluorescent: steady, then a stutter (with a buzz as it strikes back) every 6-9 s.
    if (!fl.seq && t > fl.next) {
      // Never the same stutter twice: each step's length x0.6-1.5, and one in three ends early.
      const steps = Math.random() < 0.33 ? FLICKER.slice(0, 5) : FLICKER;
      fl.seq = steps.map(([on, s]) => [on, s * (0.6 + Math.random() * 0.9)]);
      fl.i = 0;
      fl.tt = 0;
      if (!snd.off) audio?.sfx?.('fluoro_flicker', { volume: 0.2, bus: 'bus', pos: SND.tube, ref: 1.5 }); // fallback: 120 Hz band noise
    }
    if (fl.seq) {
      fl.tt += raw;
      while (fl.seq && fl.tt >= fl.seq[fl.i][1]) {
        fl.tt -= fl.seq[fl.i][1];
        fl.i++;
        if (fl.i >= fl.seq.length) {
          fl.seq = null;
          fl.next = t + 6 + Math.random() * 3;
        }
      }
      fl.on = fl.seq ? fl.seq[fl.i][0] : 1;
    } else fl.on = 1;
    if (fl.on > fl.prev + 0.4 && !snd.off) audio?.tick?.({ volume: 0.05 });
    fl.prev = fl.on;
    snd.hum?.set(fl.on > 0.3 ? 0.1 * fl.on : 0, null, 0.03); // the hum cuts out with the tube
    knock = Math.max(0, knock - raw * 5);
    const fk = fl.on * (1 - 0.35 * knock);
    fluoroLight.intensity = FLUORO_INTENSITY * fk;
    tubeMat.emissiveIntensity = 0.06 + 2.5 * fk;
    // The lamp's old bulb shivers with each blow from downstairs.
    const lk = 1 - 0.18 * knock + 0.015 * Math.sin(t * 50);
    lamp.light.intensity = LAMP_INTENSITY * lk;

    // Phone: lights up now and then (12 unread), bright while read, then dark.
    let pTarget = 0.06;
    if (phoneState.mode === 'idle') pTarget = t % 7 < 1.8 ? 0.9 : 0.06;
    else if (phoneState.mode === 'awake') pTarget = 1.2;
    else pTarget = 0;
    // Every other wake buzzes on the table (from 14 s, clear of the first hammer burst at 8 s).
    const awake = phoneState.mode === 'idle' && t % 7 < 1.8;
    if (awake && !snd.wasAwake && ++snd.wakes % 2 === 1 && t > 12 && !snd.off) phoneBuzz(0.45);
    snd.wasAwake = awake;
    phoneState.glow = damp(phoneState.glow, pTarget, 6, raw);
    phone.screenMat.color.setScalar(0.02 + phoneState.glow);
    phoneLight.intensity = phoneState.mode === 'awake' ? 1.4 * phoneState.glow : 0;

    // Table rock: a damped tilt on the loose things on top (the table is batched and stays put).
    if (jig.t < 0.6) {
      jig.t += raw;
      const e = jig.t < 0.6 ? Math.exp(-6 * jig.t) * Math.sin(jig.t * 40) : 0;
      const k = jig.amp * e;
      const hop = Math.max(0, e) * jig.amp * 0.16; // 1-2 cm at the first knock
      tableMug.rotation.set(k, 0, k * 0.6);
      tableMug.position.y = tableTop + hop;
      phone.group.rotation.x = k * 0.6;
      phone.group.rotation.z = -k * 0.4;
      phone.group.position.y = tableTop + 0.001 + hop * 0.6;
    }

    // Charger LED: slow green pulse while the watch sits on it.
    if (watch.watch.visible) watch.led.material.color.setRGB(0.2, 0.55 + 0.35 * Math.sin(t * 2), 0.25);
    else watch.led.material.color.setRGB(0.08, 0.1, 0.08);

    // Door: spill brightens when the door is the way out; the landing pours in when opened.
    doorState.open = damp(doorState.open, doorState.openTarget, 3, raw);
    door.rotation.y = doorState.open * 1.25;
    hall.visible = doorState.open > 0.01;
    hallLight.intensity = 4 * doorState.open;
    doorState.level = damp(doorState.level, doorState.spill * 0.5 + doorState.open * 0.5, 2, raw);
    spillMat.opacity = doorState.level * (0.94 + 0.06 * Math.sin(t * 2.3));
    crackMat.color.setRGB(1, 0.78, 0.54).multiplyScalar(0.5 + doorState.level * 2.2);
    underDoor.intensity = (1.1 + doorState.level * 1.2) * (1 - doorState.open);

    // The drip from the ceiling corner into the tin, every couple of seconds.
    dripState.t -= raw;
    if (dripState.t <= 0 && !dripState.falling) {
      dripState.falling = true;
      dripState.y = H - 0.02;
      dripState.v = 0;
    }
    if (dripState.falling) {
      dripState.v += 9.8 * raw;
      dripState.y -= dripState.v * raw;
      if (dripState.y <= ripple.position.y) {
        dripState.falling = false;
        dripState.t = 2 + Math.random() * 1.2;
        dripState.ring = 0;
      }
    }
    drip.visible = dripState.falling;
    drip.position.set(-0.32, dripState.y, -2.25);
    dripState.ring = Math.min(1, dripState.ring + raw * 1.6);
    ripple.scale.setScalar(1 + dripState.ring * 3.5);
    ripple.material.opacity = 0.5 * (1 - dripState.ring);

    // Rain on the glass, the streetlight's dapples, the shaft and the dust.
    rainAcc += raw;
    if (rainAcc > 1 / 15) {
      win.update(t, rainAcc, 1);
      rainAcc = 0;
    }
    dust.material.uniforms.uTime.value = t;
    dust.material.uniforms.uKnock.value = knock;
    dust.material.uniforms.uScale.value = (ctx.renderer?.getPixelRatio?.() || 1) * 1.6;
  }

  return {
    group,
    // Walkable rectangles (union) carved around the furniture.
    bounds: [
      { minX: -1.72, maxX: -0.56, minZ: -1.85, maxZ: 1.1 }, // between bed and TV/table/sofa
      { minX: -1.4, maxX: -0.56, minZ: -2.2, maxZ: -1.85 }, // under the window (past the lamp)
      { minX: -2.65, maxX: -0.56, minZ: -0.22, maxZ: 0.88 }, // foot of the bed, under the bike
      { minX: -1.72, maxX: 2.1, minZ: 1.0, maxZ: 2.3 }, // front strip behind the sofa
      { minX: 1.66, maxX: 2.65, minZ: -1.7, maxZ: 0.28 }, // right: phone side
      { minX: 1.78, maxX: 2.4, minZ: -2.2, maxZ: -1.7 }, // the doorway (plant left, bin bag right)
      { minX: 1.66, maxX: 2.1, minZ: 0.2, maxZ: 1.1 }, // in front of the fridge
    ],
    // Hotspot positions on the floor ([x, z]).
    spots: {
      tv: [0.55, 1.3],
      phone: [1.75, -0.95],
      watch: [-0.95, -1.9],
      xray: [1.95, 0.85],
      bike: [-2.4, 0.4],
      bibs: [-1.4, -1.3],
      door: [DOOR_X, -1.85],
      table: [1.78, -0.38], // after the phone: the table rocks (Ch1 seed)
    },
    // Where Hugo stands for each close-up ([x, z]), and what he looks at (Vector3).
    stand: {
      tv: [0.55, 1.45],
      phone: [1.8, -0.95],
      watch: [-0.95, -1.95],
      xray: [1.85, 0.62],
      bike: [-2.1, 0.0],
      bibs: [-1.35, -1.25],
      door: [DOOR_X, -1.78],
      table: [1.82, -0.9],
    },
    focus: {
      tv: new THREE.Vector3(TV_POS[0], 0.85, -1.92),
      phone: new THREE.Vector3(1.0, tableTop, -0.92),
      watch: new THREE.Vector3(-0.9, 1.0, BACK_Z + 0.02),
      xray: new THREE.Vector3(FRIDGE_FRONT, 1.18, 0.78),
      bike: new THREE.Vector3(BIKE_POS[0], 1.45, BIKE_POS[2]),
      bibs: new THREE.Vector3(-IN_X, 1.45, -1.5),
      door: new THREE.Vector3(DOOR_X, 1.2, -D / 2),
      table: new THREE.Vector3(1.03, 0.1, -0.78),
    },
    // Close-up camera shots in world coordinates, composed for the stand points above.
    shots: {
      tv: { pos: [1.3, 1.65, 2.42], look: [0.5, 0.95, -2.0], fov: 40 },
      phone: { pos: [0.72, 1.62, 0.1], look: [1.7, 1.2, -1.05], fov: 44 },
      watch: { pos: [0.45, 1.6, -1.15], look: [-1.0, 1.05, -2.3], fov: 46 },
      xray: { pos: [1.15, 1.6, 1.55], look: [FRIDGE_FRONT - 0.01, 1.14, 0.76], fov: 36 },
      bike: { pos: [-0.7, 1.55, 1.75], look: [BIKE_POS[0] - 0.04, 1.45, BIKE_POS[2] - 0.05], fov: 42 },
      bibs: { pos: [-0.6, 1.7, -0.25], look: [-2.75, 1.5, -1.6], fov: 46 },
      door: { pos: [DOOR_X - 0.95, 1.6, -0.35], look: [DOOR_X, 1.15, -2.5], fov: 46 },
      table: { pos: [0.7, 1.55, 0.75], look: [1.35, 0.35, -0.85], fov: 46 },
    },
    update,
    /** Switch the TV off: the picture collapses and the key light dies. */
    tvOff() {
      if (!tvState.on) return;
      tvState.on = false;
      tvState.offT = 0;
      // Same frame: the broadcast dies under the CRT thunk and whine (fallback: a tick).
      snd.tv?.stop(0.08);
      snd.tv = null;
      audio?.sfx?.('tv_crt_off', { volume: 0.45, pos: SND.tv, ref: 2 });
    },
    /** The phone buzzes on the table (a notification). */
    phoneBuzz() {
      if (phoneState.mode === 'idle') phoneBuzz(0.45);
    },
    /** Stop the room's point sources (the door shut behind him). */
    soundsOff(fade = 0.4) {
      snd.started = true;
      snd.off = true; // he is out on the landing: no more flicker or phone either
      for (const k of ['fridge', 'hum', 'tv']) {
        snd[k]?.stop(fade);
        snd[k] = null;
      }
    },
    get tvIsOn() {
      return tvState.on;
    },
    /** Phone screen: 'idle' (wakes now and then), 'awake' (being read) or 'read' (dark). */
    phoneMode(mode) {
      phoneState.mode = mode;
    },
    /** Hugo takes the watch off its charger (the puck and cable stay). */
    takeWatch() {
      watch.watch.visible = false;
    },
    /** The door becomes the way out: its light spill brightens. */
    doorReady() {
      doorState.spill = 1;
    },
    openDoor() {
      doorState.openTarget = 1;
    },
    /** The coffee table rocks on its short leg: the phone and the mug rattle (amp in radians). */
    tableRock(amp = 0.12) {
      jig.t = 0;
      jig.amp = amp;
    },
    /** The folded bib goes under the near leg. */
    tableShim() {
      shim.visible = true;
    },
    /** A blow from the workshop downstairs: dust jumps, the tube and the lamp dip. */
    knock() {
      knock = 1;
    },
    tvLight,
    bike,
    phoneMesh: phone.group,
    lampLight: lamp.light,
    sodium: win.spot,
  };
}
