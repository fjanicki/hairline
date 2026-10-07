import * as THREE from 'three';
import { attachToBone } from './util.js';
import { makeBrush } from './wallside.js';

// Ch5 cast: Odile, Sami, the six neighbours at the mural (three with hotspots: Mme Benali, Ines,
// Marco) and the run club (hidden until the club beat). Each neighbour has a home pose: a clip and,
// for some, something in the right hand (a brush, a tin, Ines's camera).

const CLUB_TINTS = ['#d6e04a', '#a8c43a', '#2f56a8', '#1d6a72', '#22314f']; // the Ch2 club colours (no skin-like tans)

/** Ines's camera: a small black body, a lens and a strap loop. Origin in the palm. */
function makeCamera() {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: '#1c1d1f', roughness: 0.5, metalness: 0.2 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#b8b8b4', roughness: 0.25, metalness: 0.9 });
  const glass = new THREE.MeshStandardMaterial({ color: '#0d1418', roughness: 0.05, metalness: 0.6 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.075, 0.045), body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.045), chrome);
  top.position.y = 0.043;
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.04, 16).rotateX(Math.PI / 2), body);
  lens.position.set(0.012, 0, 0.042);
  const front = new THREE.Mesh(new THREE.CircleGeometry(0.02, 16), glass);
  front.position.set(0.012, 0, 0.0625);
  g.add(b, top, lens, front);
  g.traverse((o) => o.isMesh && (o.castShadow = false));
  return g;
}

/** A small paint tin with a wire handle (for a neighbour's hand). */
function makeTin(color) {
  const g = new THREE.Group();
  const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.13, 16), new THREE.MeshStandardMaterial({ color: '#8a8478', roughness: 0.45, metalness: 0.6 }));
  tin.position.y = -0.16;
  const paint = new THREE.Mesh(new THREE.CircleGeometry(0.056, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color, roughness: 0.35 }));
  paint.position.y = -0.096;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.003, 4, 16, Math.PI), new THREE.MeshStandardMaterial({ color: '#555', metalness: 0.8, roughness: 0.4 }));
  handle.position.y = -0.095;
  g.add(tin, paint, handle);
  g.traverse((o) => o.isMesh && (o.castShadow = false));
  return g;
}

/**
 * Make the cast. opts: { wallX, groundAt, panels, panelMid(i, dflt) }.
 * Returns { odile, sami, neighbours, club, homes: [{id, char, pos, rot, clip, prop}] }.
 */
export function makeCast(ctx, group, { wallX, groundAt, panelMid, ladderZ = -21.4, ladderStep = 0.62 }) {
  const A = ctx.assets;
  const mk = (o) => {
    const c = A.makeCharacter(o);
    group.add(c.root);
    return c;
  };
  const odile = mk({ preset: 'odile', tint: '#9a7a4e', name: 'Odile' });
  const sami = mk({ preset: 'sami', tint: '#c24a3a', name: 'Sami' });
  const neighbours = [
    mk({ preset: 'mme', name: 'neighbour-0' }),
    mk({ preset: 'ines', name: 'neighbour-1' }),
    mk({ preset: 'marco', name: 'neighbour-2' }),
    mk({ preset: 'passerby', variant: 'f', tint: '#6f7f8a', scale: 0.97, seed: 'mural-a', name: 'neighbour-3' }),
    mk({ preset: 'passerby', variant: 'm', tint: '#7a8a6a', scale: 1.0, seed: 'mural-b', name: 'neighbour-4' }),
    mk({ preset: 'passerby', variant: 'f', tint: '#8a6f7f', scale: 0.92, seed: 'mural-c', name: 'neighbour-5' }),
  ];
  const club = CLUB_TINTS.map((tint, i) => {
    const c = mk({ preset: i === 0 ? 'bastien' : 'runner', tint, scale: [1.0, 0.97, 1.02, 0.95, 0.99][i], name: i === 0 ? 'Bastien' : `runner-${i}` });
    c.root.visible = false;
    return c;
  });

  // Homes. The three with hotspots keep the contract positions (a step back from the wall, looking
  // at their panel); the other three work at the wall.
  const nearWall = wallX + 0.62;
  const homes = [
    { id: 'benali', pos: [wallX + 2.3, panelMid(0, -14)], rot: -Math.PI / 2 - 0.2, clip: 'arms_crossed' },
    { id: 'ines', pos: [wallX + 2.6, panelMid(1, -18) - 0.4], rot: -Math.PI / 2 + 0.25, clip: 'hold_can', prop: 'camera' },
    { id: 'marco', pos: [wallX + 2.25, panelMid(4, -30)], rot: -Math.PI / 2 - 0.2, clip: 'arms_crossed' },
    // up the stepladder at the mural (scene5/wallside), brush to the bottom of a panel
    { id: null, pos: [wallX + 0.9, ladderZ], y: ladderStep, rot: -Math.PI / 2, clip: 'paint', prop: 'brush', color: '#2f6f8a' },
    // on one knee at the foot of the wall, working a tin
    { id: null, pos: [nearWall + 0.1, panelMid(3, -26) + 0.9], rot: -Math.PI / 2 - 0.4, clip: 'kneel_work', prop: 'brush', color: '#c25a7a' },
    { id: null, pos: [wallX + 1.35, -16.6], rot: -Math.PI / 2 + 0.5, clip: 'hold_can', prop: 'tin', color: '#d98a3a' },
  ].map((h, i) => {
    const c = neighbours[i];
    let prop = null;
    if (h.prop === 'brush') {
      prop = makeBrush(h.color, { len: 0.26, width: 0.045 });
      prop.rotation.set(0, 0, Math.PI / 2);
      prop.position.set(0.0, 0.08, 0.02);
      prop.traverse((o) => o.isMesh && (o.castShadow = false));
    } else if (h.prop === 'tin') {
      prop = makeTin(h.color);
      prop.position.set(0, 0.06, 0.02);
    } else if (h.prop === 'camera') {
      prop = makeCamera();
      prop.rotation.set(0, Math.PI / 2, 0);
      prop.position.set(0.0, 0.08, 0.05);
    }
    if (prop && !attachToBone(c, 'hand_r', prop)) prop = null;
    c.root.position.set(h.pos[0], h.y ?? groundAt(h.pos[0], h.pos[1]), h.pos[1]);
    c.root.rotation.y = h.rot;
    c.play(h.clip, 0);
    const a = c.actions?.[h.clip];
    if (a) a.time = i * 0.7;
    return { ...h, char: c, prop };
  });

  // Neighbours don't cast shadows (budget); Odile, Sami, the club and Hugo do.
  for (const c of neighbours) c.root.traverse((o) => o.isMesh && (o.castShadow = false));
  return { odile, sami, neighbours, club, homes };
}

/**
 * Sami riding: the bike is scaled to a kid's size; his hands go to the bars and his feet ride the
 * pedals (bone aims after the mixer). Call update(dt, speed) every frame while he rides.
 */
export function makeRider(sami, bike, aimBone) {
  const ud = bike.userData || {};
  const bars = ud.bars ? ud.bars.clone() : new THREE.Vector3(0, 0.88, 0.49);
  const seat = ud.seat ? ud.seat.clone() : new THREE.Vector3(0, 0.95, -0.26);
  const bb = new THREE.Vector3(0, 0.27, -0.08);
  const crankR = 0.16;
  const bones = {
    ua_l: sami.bone?.('upperarm_l'),
    la_l: sami.bone?.('lowerarm_l'),
    ua_r: sami.bone?.('upperarm_r'),
    la_r: sami.bone?.('lowerarm_r'),
    th_l: sami.bone?.('thigh_l'),
    ca_l: sami.bone?.('calf_l'),
    th_r: sami.bone?.('thigh_r'),
    ca_r: sami.bone?.('calf_r'),
  };
  const spine = [sami.bone?.('spine_01'), sami.bone?.('spine_02')].filter(Boolean);
  const qa = new THREE.Quaternion();
  const qw = new THREE.Quaternion();
  const qp = new THREE.Quaternion();
  const side = new THREE.Vector3();
  // The mixer may skip a frame (or not drive a bone), so a relative turn would pile up: undo last
  // frame's turn first when the bone still holds it.
  const held = new Map();
  /** Rotate a bone about a world axis (after the mixer). */
  const turn = (bone, axis, angle) => {
    const h = held.get(bone);
    if (h && bone.quaternion.equals(h.after)) bone.quaternion.copy(h.before);
    const before = bone.quaternion.clone();
    qa.setFromAxisAngle(axis, angle);
    bone.getWorldQuaternion(qw);
    bone.parent.getWorldQuaternion(qp).invert();
    bone.quaternion.copy(qp.multiply(qa.multiply(qw)));
    bone.updateWorldMatrix(false, true);
    held.set(bone, { before, after: bone.quaternion.clone() });
  };
  const ok = Object.values(bones).every(Boolean);
  const t = new THREE.Vector3();
  const knee = new THREE.Vector3();
  const hip = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const hint = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  let crank = 0;
  return {
    seat,
    bars,
    lean: 0.42,
    crank: () => crank,
    update(dt, speed, w = 1) {
      if (!ok || w <= 0) return;
      crank -= (speed * dt) / 0.34 / 1.9; // gearing: about 1.9 wheel turns per crank turn
      bike.updateMatrixWorld(true);
      // lean over the bars (the seated clip sits bolt upright)
      side.set(1, 0, 0).transformDirection(bike.matrixWorld);
      for (const b of spine) turn(b, side, this.lean * w);
      // hands on the bar tops (facing +Z, his left is +X)
      for (const [s, ua, la] of [[1, bones.ua_l, bones.la_l], [-1, bones.ua_r, bones.la_r]]) {
        t.set(bars.x + s * 0.15, bars.y + 0.01, bars.z - 0.07).applyMatrix4(bike.matrixWorld);
        aimBone(ua, t, w);
        aimBone(la, t, w);
      }
      // feet on the pedals: two-bone IK (thigh, calf) with the knee bending forward over the bars
      fwd.set(0, 0, 1).transformDirection(bike.matrixWorld);
      for (const [s, th, ca, ph] of [[1, bones.th_l, bones.ca_l, 0], [-1, bones.th_r, bones.ca_r, Math.PI]]) {
        const a = crank + ph;
        t.set(s * 0.1, bb.y + Math.sin(a) * crankR + 0.05, bb.z + Math.cos(a) * crankR).applyMatrix4(bike.matrixWorld);
        th.updateWorldMatrix(true, true);
        hip.setFromMatrixPosition(th.matrixWorld);
        const lt = knee.setFromMatrixPosition(ca.matrixWorld).distanceTo(hip);
        const foot = ca.children.find((c) => c.isBone);
        const lc = foot ? dir.setFromMatrixPosition(foot.matrixWorld).distanceTo(knee) : lt;
        dir.subVectors(t, hip);
        const d = THREE.MathUtils.clamp(dir.length(), 0.05, (lt + lc) * 0.995);
        dir.normalize();
        const x = (lt * lt - lc * lc + d * d) / (2 * d);
        const h = Math.sqrt(Math.max(0, lt * lt - x * x));
        hint.copy(fwd).addScaledVector(dir, -fwd.dot(dir)).normalize();
        knee.copy(hip).addScaledVector(dir, x).addScaledVector(hint, h);
        aimBone(th, knee, w);
        ca.updateWorldMatrix(true, false);
        aimBone(ca, t, w);
      }
    },
  };
}
