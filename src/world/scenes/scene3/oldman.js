import * as THREE from 'three';
import { bicycle } from '../../build.js';

// R4 Ch3 (docs/SCRIPT-R4.md §4, §0.4.2): the wordless seed. Week 31, Saturday 4 h 47: on the far kerb an old man
// in a flat cap and a brown cardigan pushes a black bike the other way (+Z). Its worn freewheel clicks once per
// wheel turn (`pawl_click`, 0.4 s apart, far and panned). Hugo doesn't turn his head; the camera doesn't either.
// No line, no hotspot. It pays off in Ch6: « Vous ne m’avez jamais vu. Vous regardiez votre montre. »
//
//   const man = oldManPass(ctx);   // at run() start: built hidden (no hitch mid-run)
//   man.start(z);                  // he appears at z on the far kerb and walks toward +Z
//   man.stop();                    // hidden, the clicks stop (the Week 31 cut)

const KERB_X = -7.75; // the far (left) pavement, its road edge, his path; Hugo trains in the right lane (x 3.6)
const PAVE_Y = 0.14; // scene3's pavement top (WALK_Y)
const CLICK_EVERY = 0.4;

export function oldManPass(ctx) {
  const { assets, audio, world } = ctx;
  const char = assets.makeCharacter({ preset: 'durand', name: 'le vieux monsieur (Ch3)' });
  const root = char.root;
  root.visible = false;
  world.add(root);
  // His bike on his left (road side), front wheel ahead, his hands near the bars.
  const bike = bicycle({ frame: '#141416', rust: 0.15 });
  bike.name = 'oldman-bike';
  bike.visible = false;
  bike.traverse((o) => o.isMesh && (o.castShadow = false));
  world.add(bike);
  const pace = char.pace || 0.6;
  let on = false;
  let click = 0;
  const pos = new THREE.Vector3();
  const off = world.onUpdate((dt) => {
    if (!on) return;
    root.position.z += pace * dt;
    // Well behind Hugo now (the camera never looked): gone.
    if (root.position.z > (ctx.player?.root?.position.z ?? -1e9) + 16) {
      on = false;
      root.visible = false;
      bike.visible = false;
      return;
    }
    bike.position.set(root.position.x + 0.42, PAVE_Y, root.position.z + 0.32);
    click -= dt;
    if (click <= 0) {
      click += CLICK_EVERY * (0.96 + Math.random() * 0.08);
      pos.set(bike.position.x, 0.35, bike.position.z - 0.5); // the rear hub
      audio.sfx('pawl_click', { volume: 0.32, jitter: 0.03, lowpass: 3200, pos: [pos.x, pos.y, pos.z], ref: 5, fallback: false });
    }
  });
  return {
    char,
    bike,
    /** He comes into view at `z` (ahead of Hugo), walking toward +Z. */
    start(z) {
      root.position.set(KERB_X, PAVE_Y, z);
      root.rotation.y = 0;
      root.visible = true;
      bike.visible = true;
      bike.rotation.set(0, 0, 0);
      const a = char.play('walk', 0.1);
      if (a) a.timeScale = char.strideRate('walk', pace);
      click = 0.2;
      on = true;
    },
    get on() {
      return on;
    },
    get z() {
      return root.position.z;
    },
    stop() {
      on = false;
      root.visible = false;
      bike.visible = false;
    },
    dispose() {
      off();
    },
  };
}
