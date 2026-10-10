import * as THREE from 'three';
import { pointLight } from '../../build.js';
import { Batch, cbox, cyl, rod, noOcclude } from './kit.js';
import { SIDEWALK_Y } from './street.js';
import { addRoom, doorLeaf } from './rooms.js';
import { outlineWallTexture, photoWallTexture, photo1974Texture, calendarTexture, jigRuleTexture, tinLabelTexture, slipperPrintTexture } from './r4art.js';
import { BLEU_DURAND } from './fixes.js';

// CYCLES DURAND by day and at night (R4 'day' / 'night' variants; Ch2 and Ch7 keep the plain
// shuttered front scene2.js builds). The roller shutter stays down over the window; beside it is the
// shop door the key ring opens (Ch6 Week 6). Behind it a real room (rooms.js): dust, the painted
// outlines of the bikes that are gone under six empty hooks, a counter under a dust sheet, a photo
// wall (52 years), and one clean corner (docs/SCRIPT-R4.md §7.2): the workbench with a cutting jig set
// at 52, fresh sawdust, the open tin of Bleu Durand, the framed 1974 photo, the calendar with every
// night ticked and timed in pencil. A bare bulb lights it once the door opens.
//
// Facade-local frame (rooms.js): side +1, so +x = world +z (up the street), +z = out to the street.

const WIN = { x0: -2.3, x1: 0.75, h: 2.75 };
const DOOR = { x0: 0.95, x1: 1.9, h: 2.3 };
const DEPTH = 5.0;
const ROOM_H = 3.2;

/**
 * ctx, batch, group, b (BUILDINGS 'durand'), M, env, note (the card mesh from scene2), text: { photo, tin, shop }.
 */
export function buildDurand(ctx, { batch, group, b, M, env, note, text, fasciaTint }) {
  const room = addRoom(batch, b, {
    depth: DEPTH,
    h: ROOM_H,
    openings: [{ x0: DOOR.x0 - 0.03, x1: DOOR.x1 + 0.03, h: WIN.h - 0.05 }], // the door and its fanlight
    wallKey: 'roomPlaster',
    floorKey: 'roomConcrete',
    back: false,
  });
  const P = room.P;
  const at = (x, y, z) => ({ parent: P, pos: [x, y, z] });
  const front = new THREE.Group();
  front.name = 'cycles-durand';
  P.decompose(front.position, front.quaternion, front.scale);
  group.add(front);

  // ------------------------------------------------------------ the front
  const W = room.W;
  for (const sx of [-1, 1]) batch.add('trim', cbox(0.3, 3.3, 0.16), at(sx * (W / 2 - 0.15), 1.65, 0.08));
  batch.add('door', cbox(W - 0.1, 0.62, 0.1), { ...at(0, 3.36, 0.06), color: fasciaTint });
  batch.add('trim', cbox(W + 0.1, 0.1, 0.24), at(0, 3.72, 0.12));
  // Shutter over the window: down for good, its housing and rails.
  const ww = WIN.x1 - WIN.x0;
  const wx = (WIN.x0 + WIN.x1) / 2;
  batch.add('roller', cbox(ww, WIN.h, 0.05), { ...at(wx, WIN.h / 2, 0.05), color: '#a8998a' });
  batch.add('roller', cbox(ww + 0.12, 0.34, 0.32), { ...at(wx, WIN.h + 0.17, 0.16), color: '#a8998a' });
  for (const sx of [-1, 1]) batch.add('iron', cbox(0.07, WIN.h, 0.09), at(wx + sx * (ww / 2 + 0.01), WIN.h / 2, 0.06));
  batch.add('iron', cbox(ww, 0.06, 0.08), at(wx, 0.03, 0.08));
  // The door: a moulded frame, a fanlight, a worn step.
  const dx = (DOOR.x0 + DOOR.x1) / 2;
  const dw = DOOR.x1 - DOOR.x0;
  for (const x of [DOOR.x0 - 0.05, DOOR.x1 + 0.05]) batch.add('casement', cbox(0.08, WIN.h, 0.1), at(x, WIN.h / 2, 0.0));
  batch.add('casement', cbox(dw + 0.18, 0.08, 0.1), at(dx, DOOR.h + 0.02, 0.0));
  batch.add('casement', cbox(dw + 0.18, 0.08, 0.1), at(dx, WIN.h - 0.03, 0.0));
  batch.add('trim', cbox(dw + 0.3, 0.06, 0.34), at(dx, 0.03, 0.15));
  const dusty = new THREE.MeshStandardMaterial({ color: '#4c4a44', roughness: 0.6, metalness: 0, envMap: env, envMapIntensity: 0.5, transparent: true, opacity: 0.78, depthWrite: false });
  const fanlight = new THREE.Mesh(new THREE.PlaneGeometry(dw, WIN.h - DOOR.h - 0.12), dusty);
  fanlight.position.set(dx, (DOOR.h + WIN.h) / 2, -0.02);
  front.add(noOcclude(fanlight));
  const leafMat = new THREE.MeshStandardMaterial({ color: fasciaTint, roughness: 0.75 });
  ctx.materials?.weather?.(leafMat, { grime: 0.8 });
  // Hinged on the street-end side: open, the leaf lies against the wall and the room stays in view.
  const door = doorLeaf({ hinge: DOOR.x1, dir: -1, w: dw, h: DOOR.h - 0.04, material: leafMat, glass: dusty, plate: M.iron.material });
  front.add(door.pivot);

  // ------------------------------------------------------------ the card: fallen, or pinned back up straight
  const pins = new THREE.Group();
  const pinMat = new THREE.MeshStandardMaterial({ color: BLEU_DURAND, roughness: 0.4 });
  for (const [px, py] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), pinMat);
    p.position.set(px * 0.36, py * 0.26, 0.008);
    pins.add(p);
  }
  note.add(pins);
  const cardOn = new THREE.Vector3(wx + 0.35, 1.5, 0.085);
  let pinned = false;
  const setPinned = (v) => {
    pinned = !!v;
    note.position.set(0, 0, 0);
    note.rotation.set(0, 0, 0);
    if (pinned) {
      note.position.copy(cardOn);
      note.material.color.setScalar(1);
    } else {
      // Face down-ish in the gutter of the shutter, wet and trodden on.
      note.position.set(wx + 0.75, SIDEWALK_Y + 0.006, 0.42);
      note.rotation.set(-Math.PI / 2, 0, 0.55);
      note.material.color.setScalar(0.5);
    }
    pins.visible = pinned;
  };
  front.add(note);
  setPinned(false);

  // ------------------------------------------------------------ inside
  const inside = new THREE.Group();
  inside.name = 'durand-inside';
  front.add(inside);
  const ib = new Batch();
  const dustSheet = new THREE.MeshStandardMaterial({ color: '#b9b2a2', roughness: 1 });
  const tyre = new THREE.MeshStandardMaterial({ color: '#1c1c1c', roughness: 0.85 });
  const sawdust = new THREE.MeshStandardMaterial({ map: slipperPrintTexture({ print: false }), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
  ib.material('timber', M.timber.material).material('iron', M.iron.material).material('steel', M.steel.material).material('sheet', dustSheet).material('tyre', tyre);
  const D = DEPTH;
  const iw = W - 0.3;
  const xL = -W / 2 + 0.15; // inner face of the left wall (world -z end)
  const xR = W / 2 - 0.15;
  // Back wall: two rows of three bikes, each hung by its top tube from a pair of hooks; only the
  // painted outlines are left (texture x from the wall's left edge, y = the top tube's height).
  const slots = [];
  for (const y of [2.55, 1.6]) for (let k = 0; k < 3; k++) slots.push({ x: 0.2 + k * ((iw - 0.4) / 3), y });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(iw, ROOM_H), new THREE.MeshStandardMaterial({ map: outlineWallTexture(iw, ROOM_H, slots), roughness: 0.95 }));
  back.position.set(0, ROOM_H / 2, -D + 0.012);
  inside.add(back);
  for (const sl of slots) {
    for (const dx of [0.7, 1.05]) {
      const hx = -iw / 2 + sl.x + dx;
      ib.add('iron', rod([hx, sl.y + 0.06, -D + 0.01], [hx, sl.y + 0.06, -D + 0.16], 0.011));
      ib.add('iron', rod([hx, sl.y + 0.06, -D + 0.16], [hx, sl.y + 0.13, -D + 0.18], 0.011));
    }
  }
  // The workbench along the left wall at the back: the clean corner.
  const bz0 = -2.55;
  const bz1 = -4.75;
  const bzc = (bz0 + bz1) / 2;
  const bx = xL + 0.36;
  const top = 0.9;
  ib.add('timber', cbox(0.68, 0.06, bz0 - bz1), { pos: [bx, top - 0.03, bzc] });
  ib.add('timber', cbox(0.6, 0.03, bz0 - bz1 - 0.2), { pos: [bx, 0.22, bzc] });
  for (const z of [bz0 - 0.08, bz1 + 0.08]) for (const x of [bx - 0.28, bx + 0.28]) ib.add('timber', cbox(0.06, top - 0.06, 0.06), { pos: [x, (top - 0.06) / 2, z] });
  // The cutting jig: a fence along the bench, the steel rule, the stop block at 52.
  ib.add('timber', cbox(0.05, 0.07, 0.9), { pos: [bx - 0.2, top + 0.035, bzc + 0.25] });
  const rule = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.045).rotateX(-Math.PI / 2).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ map: jigRuleTexture(), roughness: 0.4, metalness: 0.5 }));
  rule.position.set(bx - 0.14, top + 0.002, bzc + 0.25);
  inside.add(rule);
  const stopZ = bzc + 0.25 + 0.36 - (52 / 70) * 0.72; // the rule runs 0..70 cm toward -z
  ib.add('steel', cbox(0.09, 0.08, 0.04), { pos: [bx - 0.15, top + 0.04, stopZ] });
  const dust = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.5).rotateX(-Math.PI / 2), sawdust);
  dust.position.set(bx + 0.05, top + 0.003, stopZ - 0.15);
  inside.add(dust);
  const dust2 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7).rotateX(-Math.PI / 2), sawdust);
  dust2.position.set(bx + 0.3, 0.045, stopZ - 0.1);
  inside.add(dust2);
  // A blue slat offcut on the bench.
  const offcut = new THREE.Mesh(cbox(0.5, 0.034, 0.068), new THREE.MeshStandardMaterial({ color: BLEU_DURAND, roughness: 0.92 }));
  offcut.position.set(bx + 0.1, top + 0.017, bzc - 0.45);
  offcut.rotation.y = 0.2;
  inside.add(offcut);
  // The tin of Bleu Durand, open, a brush across it.
  const tinPos = [bx + 0.12, top, bz0 - 0.32];
  ib.add('steel', cyl(0.09, 0.09, 0.13, 16), { pos: tinPos });
  const paint = new THREE.Mesh(new THREE.CircleGeometry(0.085, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#5f86a8', roughness: 0.3 }));
  paint.position.set(tinPos[0], top + 0.122, tinPos[2]);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0915, 0.0915, 0.07, 20, 1, true, Math.PI * 0.2, Math.PI * 1.1), new THREE.MeshStandardMaterial({ map: tinLabelTexture(text.tin), roughness: 0.8 }));
  label.position.set(tinPos[0], top + 0.065, tinPos[2]);
  inside.add(paint, label);
  ib.add('timber', cyl(0.008, 0.008, 0.26, 6), { pos: [tinPos[0] - 0.13, top + 0.135, tinPos[2]], rot: [0, 0, Math.PI / 2 - 0.1] });
  // On the wall above the bench: the 1974 photo and the calendar.
  const wall = (tex, w, h, z, y) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
    m.position.set(xL + 0.025, y, z);
    inside.add(m);
    return m;
  };
  const photo = wall(photo1974Texture(text.photo, text.shop), 0.46, 0.38, -4.15, 1.62);
  photo.position.x = xL + 0.032;
  ib.add('timber', cbox(0.03, 0.42, 0.5), { pos: [xL + 0.012, 1.62, -4.15] }); // its frame's backing
  const calendar = wall(calendarTexture(), 0.34, 0.49, -3.2, 1.55);
  // A counter under a dust sheet by the window, the till a lump under it.
  ib.add('timber', cbox(0.6, 0.95, 1.5), { pos: [xL + 0.75, 0.475, -1.15] });
  ib.add('sheet', cbox(0.66, 0.02, 1.58), { pos: [xL + 0.75, 0.96, -1.15] });
  ib.add('sheet', cbox(0.02, 0.6, 1.58), { pos: [xL + 0.42, 0.67, -1.15], rot: [0, 0, -0.06] });
  ib.add('sheet', cbox(0.42, 0.26, 0.4), { pos: [xL + 0.75, 1.1, -1.35] });
  // The photo wall opposite: 52 years.
  const photos = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.35).rotateY(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: photoWallTexture(3.3, 1.35), transparent: true, roughness: 0.6 }));
  photos.position.set(xR - 0.02, 1.85, -2.85);
  inside.add(photos);
  // Old tyres stacked in the back corner, a truing stand with nothing in it.
  for (let i = 0; i < 4; i++) ib.add('tyre', new THREE.TorusGeometry(0.31, 0.022, 6, 28).rotateX(Math.PI / 2), { pos: [xR - 0.45, 0.06 + i * 0.045, -D + 0.5] });
  ib.add('steel', rod([xR - 1.2, 0.04, -D + 0.6], [xR - 1.2, 0.9, -D + 0.6], 0.02));
  ib.add('steel', cbox(0.04, 0.4, 0.04), { pos: [xR - 1.2, 1.1, -D + 0.6] });
  ib.add('steel', rod([xR - 1.2, 1.3, -D + 0.6], [xR - 1.2, 1.3, -D + 0.95], 0.015));
  // The bulb on its flex.
  const bulbOn = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(3), toneMapped: false });
  const bulbOff = new THREE.MeshStandardMaterial({ color: '#8a857a', roughness: 0.3 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), bulbOff);
  bulb.position.set(0, ROOM_H - 0.55, -2.6);
  ib.add('iron', cbox(0.008, 0.5, 0.008), { pos: [0, ROOM_H - 0.27, -2.6] });
  inside.add(bulb);
  const insideMesh = ib.build('durand-inside');
  inside.add(insideMesh);
  noOcclude(inside);
  const light = pointLight(0xffd9a0, 8, { pos: [0, 0, 0], distance: 9 });
  light.position.set(0, ROOM_H - 0.65, -2.6);
  light.userData.noCone = true;
  front.add(light);

  // ------------------------------------------------------------ state
  let lit = false;
  let lightAuto = true;
  const setLight = (v) => {
    lit = !!v;
    light.visible = lit;
    bulb.material = lit ? bulbOn : bulbOff;
  };
  const anim = { from: 0, to: 0, t: 0, dur: 0 };
  let walkOn = false;
  const bounds = { door: room.rect(DOOR.x0 + 0.12, DOOR.x1 - 0.12, 1.25, -0.7), room: room.rect(-1.0, xR - 0.35, -0.55, -D + 0.45), back: room.rect(xL + 0.8, xR - 0.35, -2.1, -D + 0.45) };
  let live = null; // the street's live bounds array (walkable when open)
  const applyDoor = (k) => {
    door.set(k);
    inside.visible = k > 0.001;
    if (lightAuto) setLight(k > 0.001);
    const walk = k > 0.6;
    if (live && walk !== walkOn) {
      walkOn = walk;
      for (const r of [bounds.door, bounds.room, bounds.back]) {
        const i = live.indexOf(r);
        if (walk && i < 0) live.push(r);
        else if (!walk && i >= 0) live.splice(i, 1);
      }
    }
  };
  applyDoor(0);

  const w2 = (x, z) => {
    const p = room.toWorld(x, 0, z);
    return [+p.x.toFixed(2), +p.z.toFixed(2)];
  };
  const v3 = (x, y, z) => room.toWorld(x, y, z);
  const spots = {
    durandDoor: w2(dx, 0.75),
    durandInside: w2(0.3, -2.4),
    durandBench: w2(bx + 0.75, bzc + 0.2),
    durandPhoto: w2(xL + 1.0, -4.0),
    durandCalendar: w2(xL + 1.0, -3.2),
    durandTin: w2(bx + 0.75, bz0 - 0.3),
    durandOutlines: w2(0.4, -3.7),
    durandPhotos: w2(xR - 1.1, -2.85),
    durandCard: w2(wx + 0.5, 0.85),
  };
  const focus = {
    lock: v3(DOOR.x0 + 0.09, 1.04, 0.02),
    bench: v3(bx - 0.1, top + 0.05, stopZ),
    tin: v3(...tinPos).setY(top + 0.1),
    photo: v3(xL + 0.03, 1.62, -4.15),
    calendar: v3(xL + 0.03, 1.55, -3.2),
    outlines: v3(0, 1.9, -D + 0.05),
    photos: v3(xR - 0.03, 1.85, -2.85),
    card: v3(cardOn.x, cardOn.y, cardOn.z),
  };
  const shot = (p, l, fov) => ({ pos: v3(...p).toArray().map((n) => +n.toFixed(2)), look: v3(...l).toArray().map((n) => +n.toFixed(2)), fov });
  const shots = {
    durandDoor: shot([DOOR.x0 - 0.5, 1.45, 1.0], [DOOR.x0 + 0.12, 1.05, 0], 40), // KEY RING: the lock
    durandInside: shot([1.35, 1.7, -0.75], [-1.5, 1.3, -D + 0.3], 62),
    durandBench: shot([bx + 1.25, 1.6, bzc + 0.75], [bx - 0.1, top, bzc - 0.2], 50),
    durandPhoto: shot([xL + 1.3, 1.62, -3.75], [xL, 1.6, -4.15], 42),
    durandCalendar: shot([xL + 1.2, 1.6, -2.85], [xL, 1.55, -3.2], 42),
    durandOutlines: shot([0.6, 1.6, -1.2], [0, 1.9, -D], 58),
    durandCard: shot([wx + 1.5, 1.4, 2.0], [wx + 0.35, 0.75, 0.15], 50),
  };

  return {
    group: front,
    inside,
    door,
    light,
    note,
    spots,
    shots,
    focus,
    bounds,
    photo,
    calendar,
    get pinned() {
      return pinned;
    },
    /** The card: false = fallen on the pavement, true = pinned back up, straight (Week 9). */
    setPinned,
    /** Bind the street's live bounds array: the room becomes walkable while the door is open. */
    bindBounds(arr) {
      live = arr;
    },
    get open() {
      return door.open;
    },
    /** The door: 0 shut .. 1 open; secs > 0 animates. The bulb follows unless setLight() was called. */
    setOpen(k, secs = 0) {
      k = Math.max(0, Math.min(1, k));
      if (secs > 0) Object.assign(anim, { from: door.open, to: k, t: 0, dur: secs });
      else {
        anim.dur = 0;
        applyDoor(k);
      }
    },
    setLight(v) {
      lightAuto = false;
      setLight(v);
    },
    update(raw) {
      if (anim.dur > 0) {
        anim.t = Math.min(anim.dur, anim.t + raw);
        const e = anim.t / anim.dur;
        applyDoor(anim.from + (anim.to - anim.from) * (e * e * (3 - 2 * e)));
        if (anim.t >= anim.dur) anim.dur = 0;
      }
    },
  };
}
