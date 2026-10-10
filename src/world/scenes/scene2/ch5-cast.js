import * as THREE from 'three';
import { bicycle } from '../../build.js';
import { SIDEWALK_Y } from './street.js';

// Ch5 « Qui a huilé le rideau ? » (R4): the people of the street by day and at 4 a.m. (docs/SCRIPT-R4.md §6),
// added at run time to a 'day' or 'night' scene2 build (W = d.scene(SETS.street(...))). Nothing here edits
// scene2.js: every figure and prop goes into W.group, so the scene swap disposes them with the street.
//
//   const cast = ch5Cast(ctx, W, ['benali', 'gerard']);   // who is on set
//   cast.benali.char, cast.benali.home ({pos, rot, clip}); cast.oldman.bike; cast.talkShot(char)
//
// Homes follow the STREET CONTRACT spots (docs/DESIGN.md: benaliDoor, gerardCounter, louWall, bastien,
// oldManSeat / oldManBike, encre*). Each figure is about 4 draw calls with its shadow: the hub has six.

const RIGHT = Math.PI / 2; // facing +X: out of the left-hand shopfronts, toward the road

/** A figure's home: where it stands, which way it faces, its idle clip (and a timeScale). */
function homes(W) {
  const S = W.spots || {};
  const encre = W.encre?.spots || {};
  return {
    benali: { pos: S.benaliDoor || [-4.5, -8.8], rot: RIGHT, clip: 'arms_crossed' },
    gerard: { pos: S.gerardCounter || [-4.55, -34.2], rot: RIGHT - 0.25, clip: 'arms_crossed' },
    lou: { pos: S.louWall || [-4.6, -26.5], rot: RIGHT + 0.3, clip: 'hold_can' }, // eyes on her phone
    bastien: { pos: S.bastien || [-3.4, -17.5], rot: RIGHT - 0.6, clip: 'run', timeScale: 0.55 }, // jogging on the spot
    jo: { pos: encre.encreInside || [-6.9, -39.5], rot: RIGHT, clip: 'idle' },
    oldman: { pos: S.oldManSeat || [-5.32, -37.05], rot: RIGHT, clip: 'sit_idle', y: SIDEWALK_Y },
  };
}

const PRESETS = {
  benali: { preset: 'mme', name: 'Mme Benali' },
  gerard: { preset: 'gerard', name: 'Gérard' },
  lou: { preset: 'lou', name: 'Lou' },
  bastien: { preset: 'bastien', tint: '#d6e04a', name: 'Bastien' },
  jo: { preset: 'jo', name: 'Jo' },
  oldman: { preset: 'durand', name: 'Le vieux monsieur' },
};

/**
 * Put `who` (ids: benali, gerard, lou, bastien, jo, oldman) on the street W. Returns
 * { [id]: { char, home }, home(id), talkShot(char, side), dispose() }; `oldman` also has `bike` (his black
 * bike leaning on the bench armrest) and `push()` (the bike moves to his right hand, for the walk away).
 */
export function ch5Cast(ctx, W, who = []) {
  const A = ctx.assets;
  const H = homes(W);
  const out = {};
  for (const id of who) {
    const o = PRESETS[id];
    if (!o) continue;
    const char = A.makeCharacter(o);
    W.group.add(char.root);
    const home = H[id];
    out[id] = { char, home };
    place(char, home);
  }

  // The old man's bike: black, worn, leaning on the bench armrest at the seat's end (SCRIPT-R4 §6.3).
  if (out.oldman) {
    const S = W.spots || {};
    const at = S.oldManBike || [-5.0, -37.62];
    const bike = bicycle({ frame: '#1d2124', rust: 0.45 });
    bike.name = 'oldman-bike';
    bike.position.set(at[0], SIDEWALK_Y, at[1]);
    bike.rotation.set(0, Math.PI, 0.16); // along the bench, front wheel toward -Z, leaning on the armrest
    bike.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.userData.noOcclude = true;
      }
    });
    W.group.add(bike);
    out.oldman.bike = bike;
    /** He stands and takes it by the handlebars: the bike rides at his right hand from now on. */
    out.oldman.push = () => {
      const c = out.oldman.char;
      c.root.attach(bike);
      bike.position.set(-0.42, 0, 0.22);
      bike.rotation.set(0, 0, 0);
      c.root.position.y = SIDEWALK_Y;
    };
  }

  out.home = (id) => out[id] && place(out[id].char, out[id].home);
  /**
   * A two-shot of Hugo and `char` from the road side: {pos, look, fov} for cam.tween / cam.set.
   * side: +1 / -1 picks the side of the line between them (default: the one toward the middle of the road).
   */
  out.talkShot = (char, { side, dist = 2.9, height = 1.62, fov = 46 } = {}) => {
    const p = ctx.player.root.position;
    const q = char.root.position;
    const mx = (p.x + q.x) / 2;
    const mz = (p.z + q.z) / 2;
    let nx = -(q.z - p.z);
    let nz = q.x - p.x;
    const n = Math.hypot(nx, nz) || 1;
    nx /= n;
    nz /= n;
    const s = side ?? (Math.sign(-mx * nx) || 1); // toward x = 0 (the road)
    return { pos: [mx + nx * s * dist, height, mz + nz * s * dist], look: [mx, 1.3, mz], fov };
  };
  out.dispose = () => {
    for (const id of who) out[id]?.char?.root?.removeFromParent();
    out.oldman?.bike?.removeFromParent();
  };
  return out;
}

function place(char, home) {
  if (!home) return;
  char.root.position.set(home.pos[0], home.y ?? SIDEWALK_Y, home.pos[1]);
  char.root.rotation.set(0, home.rot ?? 0, 0);
  char.root.visible = true;
  char.play(home.clip || 'idle', 0.2, home.timeScale ? { timeScale: home.timeScale } : undefined);
}

/** The chalk ring Hugo draws round the slipper print (No. 14's doorstep): a thin white ellipse. */
export function chalkRing(at, { rx = 0.2, rz = 0.3 } = {}) {
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const wob = 1 + 0.05 * Math.sin(a * 3 + 0.7);
    pts.push(new THREE.Vector3(Math.cos(a) * rx * wob, 0, Math.sin(a) * rz * wob));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true);
  const geo = new THREE.TubeGeometry(curve, 64, 0.009, 3, true);
  geo.scale(1, 0.15, 1);
  const ring = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#f1efe6', roughness: 1 }));
  ring.position.set(at[0], (at[2] ?? SIDEWALK_Y) + 0.004, at[1]);
  ring.name = 'chalk-ring';
  ring.castShadow = false;
  ring.userData.noOcclude = true;
  return ring;
}
