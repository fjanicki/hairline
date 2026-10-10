import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pointLight } from '../../build.js';
import { Batch, cbox, cyl, rod, compose, noOcclude } from './kit.js';
import { SIDEWALK_Y } from './street.js';
import { addRoom, doorLeaf } from './rooms.js';
import { flashWallTexture, encreSignTexture, giltTexture } from './r4art.js';

// ENCRE FINE (R4): Jo's fine-line tattoo shop in B1, the empty unit diagonally across from CYCLES
// DURAND (left side, z -36.5 .. -42.2, behind the bench). A real room behind a big shop window, lit
// from inside: the flash wall, the black tattoo bed under an articulated lamp, the light table by the
// window (STENCIL's close shot), ink on a trolley. A hand-lettered blade sign hangs from a bracket on
// the far pier: in Ch2 ('evening') it hangs crooked and Jo's stepladder stands under it; from Ch5 on
// it is straight and the fascia carries the name in gilt.
//
// Facade-local frame (rooms.js): x along the facade (side -1: +x = world -z), +z out to the street.
// Shop layout in that frame: window x -2.4 .. 0.85, door x 1.0 .. 1.95, blade sign at x 2.32.

const WIN = { x0: -2.4, x1: 0.85, y0: 0.45, y1: 2.5 };
const DOOR = { x0: 1.0, x1: 1.95, h: 2.3 };
const OPEN_H = 2.6; // the shopfront opening (window, door and fanlight)
const SIGN = { x: 2.32, y: 2.95, reach: 1.05, w: 0.9, h: 0.6 };
const LAMP_COLOR = 0xffe2c4;
export const ENCRE_TINT = '#5a1f28'; // oxblood (Jo's colour, darkened for paint)

/**
 * ctx, batch (street Batch), group, b (the BUILDINGS record), M (street materials), env, haloTex,
 * o: { dark (lamps lit), crooked (Ch2), ladder (Ch2), lettered (gilt name on the fascia), text: {name, trade} }
 */
export async function buildEncre(ctx, { batch, group, b, M, env, haloTex, dark, crooked, ladder: withLadder, lettered, text }) {
  const room = addRoom(batch, b, {
    depth: 4.6,
    h: 3.0,
    openings: [{ x0: WIN.x0 - 0.05, x1: DOOR.x1 + 0.05, h: OPEN_H }],
    wallKey: 'roomPlaster',
    floorKey: 'roomBoards',
    back: true,
  });
  const P = room.P;
  const at = (x, y, z) => ({ parent: P, pos: [x, y, z] });
  const shop = new THREE.Group();
  shop.name = 'encre-fine';
  P.decompose(shop.position, shop.quaternion, shop.scale);
  group.add(shop);

  // ------------------------------------------------------------ shopfront
  const W = room.W;
  for (const sx of [-1, 1]) batch.add('trim', cbox(0.3, 3.3, 0.16), at(sx * (W / 2 - 0.15), 1.65, 0.08));
  batch.add('door', cbox(W - 0.1, 0.62, 0.1), { ...at(0, 3.36, 0.06), color: ENCRE_TINT });
  batch.add('trim', cbox(W + 0.1, 0.1, 0.24), at(0, 3.72, 0.12));
  // Stall riser under the window, the frame, mullions, the transom and the fanlight bar.
  batch.add('door', cbox(WIN.x1 - WIN.x0, WIN.y0, 0.08), { ...at((WIN.x0 + WIN.x1) / 2, WIN.y0 / 2, 0.02), color: ENCRE_TINT });
  batch.add('casement', cbox(DOOR.x1 - WIN.x0 + 0.1, 0.08, 0.08), at((WIN.x0 + DOOR.x1) / 2, OPEN_H - 0.04, 0.0));
  batch.add('casement', cbox(DOOR.x1 - WIN.x0 + 0.1, 0.06, 0.07), at((WIN.x0 + DOOR.x1) / 2, WIN.y1, 0.0));
  batch.add('casement', cbox(WIN.x1 - WIN.x0, 0.06, 0.1), at((WIN.x0 + WIN.x1) / 2, WIN.y0, 0.02));
  for (const x of [WIN.x0 - 0.03, (WIN.x0 + WIN.x1) / 2, WIN.x1 + 0.02, DOOR.x0 - 0.04, DOOR.x1 + 0.03]) batch.add('casement', cbox(0.06, OPEN_H, 0.08), at(x, OPEN_H / 2, 0));
  batch.add('trim', cbox(DOOR.x1 - DOOR.x0 + 0.2, 0.05, 0.3), at((DOOR.x0 + DOOR.x1) / 2, 0.025, 0.12)); // step
  // The glass: a faint reflective film so the lit room reads through it.
  const glassMat = new THREE.MeshStandardMaterial({ color: '#0c0f12', roughness: 0.05, metalness: 0, envMap: env, envMapIntensity: dark ? 1.1 : 1.4, transparent: true, opacity: dark ? 0.16 : 0.3, depthWrite: false });
  // The window and the fanlight over window and door: one mesh.
  const panes = mergeGeometries([
    new THREE.PlaneGeometry(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0).translate((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, -0.02),
    new THREE.PlaneGeometry(DOOR.x1 - WIN.x0, OPEN_H - WIN.y1 - 0.1).translate((WIN.x0 + DOOR.x1) / 2, (WIN.y1 + OPEN_H) / 2, -0.02),
  ]);
  const pane = new THREE.Mesh(panes, glassMat);
  pane.renderOrder = 2;
  shop.add(noOcclude(pane));
  const leafMat = new THREE.MeshStandardMaterial({ color: ENCRE_TINT, roughness: 0.55 });
  const door = doorLeaf({ hinge: DOOR.x0, dir: 1, w: DOOR.x1 - DOOR.x0, h: DOOR.h, material: leafMat, glass: glassMat, plate: M.iron.material });
  shop.add(door.pivot);
  // The fascia: fresh oxblood; the name in gilt once she has had it lettered (Ch5 on).
  let gilt = null;
  if (lettered) {
    const gm = new THREE.MeshStandardMaterial({ map: giltTexture(text.name), transparent: true, depthWrite: false, metalness: 0.6, roughness: 0.35, envMap: env, polygonOffset: true, polygonOffsetFactor: -1 });
    gilt = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.6, 0.42), gm);
    gilt.position.set(0, 3.36, 0.115);
    shop.add(gilt);
  }

  // ------------------------------------------------------------ the blade sign (bracket, chains, board)
  const SY = SIGN.y;
  batch.add('iron', cbox(0.05, 0.05, SIGN.reach + 0.1), at(SIGN.x, SY, SIGN.reach / 2 + 0.05));
  batch.add('iron', rod([SIGN.x, SY - 0.45, 0.02], [SIGN.x, SY - 0.02, SIGN.reach * 0.7], 0.014), {
    parent: P,
  });
  batch.add('iron', new THREE.TorusGeometry(0.09, 0.01, 5, 14).rotateY(Math.PI / 2), at(SIGN.x, SY - 0.12, 0.3));
  const signPivot = new THREE.Group();
  signPivot.position.set(SIGN.x, SY - 0.03, 0.15 + SIGN.reach / 2);
  shop.add(signPivot);
  const signMat = new THREE.MeshStandardMaterial({ map: encreSignTexture(text.name, text.trade), roughness: 0.7, side: THREE.DoubleSide });
  // The board's faces look along local x (world +-z: up and down the street); it hangs below the chains.
  // One material for the whole board (a material array would cost a draw call per face group): the
  // 3 cm edges just catch a sliver of the paint.
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.03, SIGN.h, SIGN.w), signMat);
  board.position.set(0, -0.14 - SIGN.h / 2, 0);
  board.castShadow = true;
  const chains = new THREE.Mesh(
    mergeGeometries([-1, 1].map((s) => new THREE.CylinderGeometry(0.006, 0.006, 0.14, 4).translate(0, -0.07, s * (SIGN.w / 2 - 0.08)))),
    M.iron.material,
  );
  signPivot.add(board, chains);
  let tilt = 0;
  let tiltTo = 0;
  let tiltRate = 0;
  const setTilt = (r) => {
    tilt = r;
    // In-plane tilt: the board's plane holds local y and z (the frame's z = out to the street).
    signPivot.rotation.x = r;
  };
  setTilt(crooked ? -0.21 : 0);

  // ------------------------------------------------------------ inside
  const ib = new Batch();
  const leather = new THREE.MeshStandardMaterial({ color: '#19191b', roughness: 0.42, metalness: 0 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#cfd2d4', roughness: 0.22, metalness: 1, envMap: env, envMapIntensity: 0.8 });
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4e4').multiplyScalar(2.2), toneMapped: false });
  const inkMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3 });
  // No shadow casters in here: the sun doesn't reach the room and its lamp casts none. The desk's wood
  // goes into the street batch's timber (one draw call fewer).
  const noShadow = { castShadow: false };
  ib.material('leather', leather, noShadow).material('chrome', chrome, noShadow).material('glow', glow, noShadow).material('ink', inkMat, noShadow);
  const D = room.depth;
  // The flash wall, over the back plaster.
  const fw = room.W - 0.4;
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(fw, room.h - 0.05), new THREE.MeshStandardMaterial({ map: flashWallTexture(fw, room.h - 0.05), roughness: 0.85 }));
  flash.position.set(0, (room.h - 0.05) / 2, -D + 0.03);
  shop.add(flash);
  // The tattoo bed: a padded top on a chrome pedestal, the back raised.
  const bx = 0.25;
  const bz = -2.85;
  ib.add('leather', cbox(1.5, 0.12, 0.62), { pos: [bx, 0.72, bz] });
  ib.add('leather', cbox(0.62, 0.1, 0.6), { pos: [bx - 0.98, 0.95, bz], rot: [0, 0, -0.55] });
  ib.add('chrome', cyl(0.05, 0.05, 0.62), { pos: [bx, 0.04, bz] });
  ib.add('chrome', cyl(0.3, 0.32, 0.04), { pos: [bx, 0.04, bz] });
  // The articulated lamp on its floor stand, head over the bed.
  const lx = bx + 0.95;
  const lz = bz - 0.55;
  ib.add('chrome', cyl(0.2, 0.22, 0.04), { pos: [lx, 0.04, lz] });
  ib.add('chrome', rod([lx, 0.08, lz], [lx, 1.55, lz], 0.016));
  ib.add('chrome', rod([lx, 1.55, lz], [lx - 0.55, 1.85, lz + 0.35], 0.012));
  ib.add('chrome', rod([lx - 0.55, 1.85, lz + 0.35], [lx - 0.85, 1.45, lz + 0.5], 0.012));
  ib.add('leather', new THREE.CylinderGeometry(0.06, 0.13, 0.12, 14, 1, true), { pos: [lx - 0.88, 1.4, lz + 0.52] });
  ib.add('glow', new THREE.CircleGeometry(0.11, 14).rotateX(Math.PI / 2), { pos: [lx - 0.88, 1.34, lz + 0.52] });
  // Trolley with ink caps and bottles.
  const tx = bx + 0.4;
  const tz = bz + 0.75;
  ib.add('chrome', cbox(0.5, 0.02, 0.38), { pos: [tx, 0.78, tz] });
  ib.add('chrome', cbox(0.5, 0.02, 0.38), { pos: [tx, 0.4, tz] });
  for (const [dx, dz] of [[-0.23, -0.17], [0.23, -0.17], [-0.23, 0.17], [0.23, 0.17]]) ib.add('chrome', cyl(0.008, 0.008, 0.78), { pos: [tx + dx, 0.02, tz + dz] });
  const inks = ['#151312', '#151312', '#6b2430', '#2f4f6a', '#151312', '#c9a23a'];
  inks.forEach((col, i) => ib.add('ink', cyl(0.025, 0.025, 0.11, 8), { pos: [tx - 0.18 + i * 0.07, 0.79, tz - 0.05], color: col }));
  // The light table by the window (STENCIL): a desk, its glowing top tilted toward the stool.
  const ltx = -1.45;
  const ltz = -1.05;
  batch.add('timber', cbox(1.1, 0.04, 0.62), at(ltx, 0.86, ltz));
  for (const [dx, dz] of [[-0.5, -0.27], [0.5, -0.27], [-0.5, 0.27], [0.5, 0.27]]) batch.add('timber', cbox(0.04, 0.84, 0.04), at(ltx + dx, 0.43, ltz + dz));
  ib.add('leather', cbox(0.66, 0.05, 0.5), { pos: [ltx, 0.92, ltz], rot: [0.18, 0, 0] });
  ib.add('glow', new THREE.PlaneGeometry(0.6, 0.44).rotateX(-Math.PI / 2 + 0.18), { pos: [ltx, 0.947, ltz] });
  // Two stools.
  for (const [sx, sz, sh] of [[ltx, ltz - 0.6, 0.62], [bx - 0.1, bz + 0.62, 0.55]]) {
    ib.add('leather', cyl(0.17, 0.17, 0.06, 14), { pos: [sx, sh, sz] });
    ib.add('chrome', cyl(0.02, 0.02, sh, 6), { pos: [sx, 0.04, sz] });
    ib.add('chrome', new THREE.TorusGeometry(0.15, 0.01, 4, 16).rotateX(Math.PI / 2), { pos: [sx, 0.22, sz] });
  }
  // A pendant over the room.
  ib.add('leather', new THREE.CylinderGeometry(0.06, 0.2, 0.18, 16, 1, true), { pos: [-0.2, 2.62, -2.2] });
  ib.add('glow', new THREE.CircleGeometry(0.17, 16).rotateX(Math.PI / 2), { pos: [-0.2, 2.53, -2.2] });
  ib.add('leather', cbox(0.01, 0.3, 0.01), { pos: [-0.2, 2.71, -2.2] });
  const inside = ib.build('encre-inside');
  shop.add(inside);
  const lightBase = dark ? 7 : 4.5;
  const glowBase = glow.color.clone();
  let lightK = 1;
  const light = pointLight(LAMP_COLOR, lightBase, { pos: [0, 0, 0], distance: 7 });
  light.position.set(-0.2, 2.3, -2.0);
  light.userData.noCone = true;
  shop.add(light);
  // The window's light on the pavement (additive, the street fades it with the fog).
  const spill = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 2.6).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: haloTex, color: 0xffe0bc, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  spill.position.copy(room.toWorld(-0.6, 0, 1.5));
  spill.position.y = SIDEWALK_Y + 0.012;
  spill.renderOrder = 4;
  group.add(spill);

  // ------------------------------------------------------------ Jo's stepladder (Ch2)
  let ladder = null;
  let joLadder = null;
  if (withLadder) {
    const lb = new Batch();
    lb.material('steel', M.steel.material, M.steel.opts).material('timber', M.timber.material, M.timber.opts);
    // An A-frame: the step side faces up the street (+z in world = local -x for this side).
    const H = 1.5;
    const spread = 0.42;
    for (const s of [-1, 1]) {
      lb.add('steel', rod([s * 0.24, 0, spread], [s * 0.2, H, 0.04], 0.018));
      lb.add('steel', rod([s * 0.24, 0, -spread], [s * 0.2, H, -0.04], 0.016));
    }
    for (let i = 1; i <= 4; i++) {
      const y = i * 0.3;
      const zz = spread * (1 - y / H) + 0.04 * (y / H);
      lb.add('timber', cbox(0.44, 0.03, 0.11), { pos: [0, y, zz] });
    }
    lb.add('timber', cbox(0.46, 0.05, 0.22), { pos: [0, H + 0.02, 0] });
    lb.add('steel', rod([-0.22, 0.6, 0.27], [-0.22, 0.6, -0.27], 0.008));
    lb.add('steel', rod([0.22, 0.6, 0.27], [0.22, 0.6, -0.27], 0.008));
    ladder = lb.build('jo-ladder');
    // World: under the sign's far side, the steps facing +Z (toward Hugo coming down the street).
    const foot = room.toWorld(SIGN.x + 0.6, 0, 0.15 + SIGN.reach / 2);
    ladder.position.set(foot.x, SIDEWALK_Y, foot.z);
    ladder.rotation.y = 0; // local +z of the ladder = world +z
    noOcclude(ladder);
    group.add(ladder);
    // Jo stands on the third step, facing +Z (her feet; the chapter puts her root here).
    const stepY = 0.9;
    const stepZ = spread * (1 - stepY / H) + 0.04 * (stepY / H);
    joLadder = { pos: [foot.x, SIDEWALK_Y + stepY + 0.015, foot.z + stepZ - 0.02], facing: 0 };
  }

  // ------------------------------------------------------------ anchors and state
  const w = (x, z) => {
    const p = room.toWorld(x, 0, z);
    return [+p.x.toFixed(2), +p.z.toFixed(2)];
  };
  const spots = {
    encre: w(-0.8, 0.9), // the pavement in front of the window
    joDoor: w((DOOR.x0 + DOOR.x1) / 2, 0.7),
    encreInside: w(-0.4, -2.0),
    encreTable: w(ltx, ltz - 0.6), // the light table's stool
    encreSign: w(SIGN.x - 0.4, 1.3),
  };
  if (joLadder) spots.joLadder = [+joLadder.pos[0].toFixed(2), +joLadder.pos[2].toFixed(2)];
  const tableTop = room.toWorld(ltx, 0.95, ltz);
  const signC = room.toWorld(SIGN.x, SY - 0.45, 0.15 + SIGN.reach / 2);
  const shots = {
    // Up the street: Jo on her ladder under the crooked board.
    jo: { pos: [signC.x + 1.9, 1.75, signC.z + 3.6], look: [signC.x - 0.1, 2.3, signC.z - 0.3], fov: 50 },
    encre: { pos: [spots.encre[0] + 3.2, 1.7, spots.encre[1] + 1.8], look: [room.toWorld(-0.6, 1.4, -2).x, 1.3, room.toWorld(-0.6, 1.4, -2).z], fov: 52 },
    // Over the light table, the flash wall behind (STENCIL).
    encreTable: { pos: [tableTop.x + 0.75, 1.62, tableTop.z + 0.55], look: [tableTop.x - 0.05, 0.95, tableTop.z - 0.05], fov: 46 },
    encreInside: { pos: room.toWorld(1.5, 1.7, -0.6).toArray(), look: room.toWorld(-0.6, 1.3, -4.4).toArray(), fov: 58 },
  };
  // Walkable while the door is open: the doorway (reaching the pavement's bounds) and the room.
  const bounds = { door: room.rect(DOOR.x0 + 0.12, DOOR.x1 - 0.12, 1.15, -0.6), room: room.rect(-0.85, 2.2, -0.5, -2.2), table: room.rect(-2.3, -0.85, -1.45, -2.2) };
  let live = null;
  let walkOn = false;
  const anim = { from: 0, to: 0, t: 0, dur: 0 };
  const applyDoor = (k) => {
    door.set(k);
    const walk = k > 0.6;
    if (live && walk !== walkOn) {
      walkOn = walk;
      for (const r of Object.values(bounds)) {
        const i = live.indexOf(r);
        if (walk && i < 0) live.push(r);
        else if (!walk && i >= 0) live.splice(i, 1);
      }
    }
  };

  return {
    group: shop,
    door,
    light,
    spill,
    sign: signPivot,
    gilt,
    ladder,
    joLadder,
    spots,
    shots,
    bounds,
    focus: { table: tableTop, sign: signC, flash: room.toWorld(0, 1.8, -D + 0.05) },
    /** The shop's lights: 1 = open (default), 0.3 = 3 a.m. (only the lamps glowing, the room dim). The street
     *  scales the pavement spill by `lightK`. */
    setLight(k) {
      lightK = Math.max(0, k);
      light.intensity = lightBase * lightK;
      glow.color.copy(glowBase).multiplyScalar(0.45 + 0.55 * Math.min(1, lightK));
    },
    get lightK() {
      return lightK;
    },
    /** The blade sign's in-plane tilt (radians; 0 = straight). */
    get tilt() {
      return tilt;
    },
    setTilt(r) {
      tiltTo = r;
      tiltRate = 0;
      setTilt(r);
    },
    /** Swing the board straight (or to `to`) over `secs` (Jo fixes it herself). */
    straighten(secs = 0.9, to = 0) {
      tiltTo = to;
      tiltRate = Math.abs(to - tilt) / Math.max(0.05, secs);
    },
    /** Bind the street's live bounds array: the shop becomes walkable while the door is open. */
    bindBounds(arr) {
      live = arr;
    },
    get open() {
      return door.open;
    },
    /** Jo's door: 0 shut .. 1 open; secs > 0 animates. */
    setOpen(k, secs = 0) {
      k = Math.max(0, Math.min(1, k));
      if (secs > 0) Object.assign(anim, { from: door.open, to: k, t: 0, dur: secs });
      else {
        anim.dur = 0;
        applyDoor(k);
      }
    },
    update(raw, t) {
      if (anim.dur > 0) {
        anim.t = Math.min(anim.dur, anim.t + raw);
        const e = anim.t / anim.dur;
        applyDoor(anim.from + (anim.to - anim.from) * (e * e * (3 - 2 * e)));
        if (anim.t >= anim.dur) anim.dur = 0;
      }
      if (tiltRate > 0) {
        const d = tiltTo - tilt;
        const step = Math.sign(d) * Math.min(Math.abs(d), tiltRate * raw);
        setTilt(tilt + step);
        if (Math.abs(tiltTo - tilt) < 1e-4) tiltRate = 0;
      } else if (tiltTo === tilt) {
        // The board stirs on its chains.
        signPivot.rotation.z = 0.015 * Math.sin(t * 0.8);
      }
    },
  };
}
