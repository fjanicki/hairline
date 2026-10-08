import * as THREE from 'three';
import * as B from '../../build.js';
import { H, BULB, TUBE, WIN, LAMP, DOORWAY, BACK_Z, damp } from './layout.js';
import { bx, tube, merged, loadProp } from './geo.js';

// The workshop's practicals. One bare tungsten bulb on its cord over the trestles is the key (warm,
// shadowed, it blooms); a fluorescent fitting over the bench flickers until Week 7; the high window
// lets in a cool shaft of daylight; Odile's floor lamp is a small warm pool in her corner; a dim bulb
// up the stairwell gives the doorway depth. The Mood preset adds the hemisphere, the grey daylight
// from the street and the camera fill.

const TUBE_COLOR = new THREE.Color('#cfe6d0');

/** A warm emissive material that blooms (linear values > the preset's bloom threshold). */
function glowMat(color, k) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), fog: false });
}

export async function buildLights(ctx, group, surf) {
  const { assets } = ctx;
  const R = B.rng(17);
  const [bulbProp, fluoroProp] = await Promise.all([
    loadProp(assets, 'bulb', { height: 0.11, castShadow: false }),
    loadProp(assets, 'fluoro_light', { center: false, castShadow: false }),
  ]);

  // ---- the bare bulb: ceiling rose, twisted cord, bakelite holder, the bulb (glass replaced by an
  // emissive one: the scanned transmission glass renders dark without a transmission pass).
  const drop = H - BULB.y;
  const bulbRig = new THREE.Group();
  bulbRig.name = 'bulb-rig';
  bulbRig.position.set(BULB.x, H, BULB.z);
  bulbRig.add(
    merged([new THREE.CylinderGeometry(0.045, 0.05, 0.03, 16).translate(0, -0.015, 0), new THREE.CylinderGeometry(0.016, 0.02, 0.06, 10).translate(0, -drop + 0.02, 0)], surf.black, {
      castShadow: false,
    }),
    merged([tube([0, -0.02, 0], [0, -drop + 0.05, 0], 0.0035, { seg: 5 })], surf.cord, { castShadow: false }),
  );
  const bulbMat = glowMat('#ffd29a', 4.2);
  let bulbMesh = null;
  bulbProp.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const glass = mats.some((m) => /glass/i.test(m?.name || ''));
    if (glass || bulbProp.userData.isFallback) {
      o.material = bulbMat;
      bulbMesh = o;
    } else {
      // The screw base: a dull brass clone (the shared one stays untouched).
      o.material = o.material.clone();
      o.material.emissive = new THREE.Color('#2a1a08');
    }
    o.castShadow = false;
  });
  bulbProp.rotation.x = Math.PI; // base up, glass down
  bulbProp.position.y = -drop + 0.02;
  bulbRig.add(bulbProp);
  group.add(bulbRig);
  // A soft halo sprite around the glass so it reads as hot even on the low tier (no bloom there).
  const haloTex = B.canvasTexture(64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,214,160,0.9)');
    grd.addColorStop(0.25, 'rgba(255,190,120,0.35)');
    grd.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.55 }));
  halo.scale.setScalar(0.42);
  halo.position.y = -drop - 0.04;
  halo.userData.noOcclude = true;
  bulbRig.add(halo);

  const bulbSpot = new THREE.SpotLight(0xffb36b, 38, 12, 1.2, 0.85, 2);
  bulbSpot.name = 'bulb-key';
  bulbSpot.position.set(BULB.x, BULB.y - 0.08, BULB.z);
  bulbSpot.target.position.set(BULB.x - 0.15, 0, BULB.z + 0.25);
  bulbSpot.castShadow = true;
  bulbSpot.shadow.mapSize.set(1024, 1024);
  bulbSpot.shadow.bias = -0.0006;
  bulbSpot.shadow.normalBias = 0.02;
  bulbSpot.shadow.radius = 3;
  bulbSpot.shadow.camera.near = 0.15;
  bulbSpot.shadow.camera.far = 9;
  // The upward share of the bulb: lights the walls and the cord, no shadow, no cone.
  const bulbGlow = B.pointLight(0xffb36b, 5.5, { pos: [BULB.x, BULB.y - 0.06, BULB.z], distance: 7.5 });
  bulbGlow.userData.noCone = true;
  group.add(bulbSpot, bulbSpot.target, bulbGlow);

  // ---- the fluorescent fitting over the bench, hung on two short chains.
  const fl = fluoroProp;
  fl.position.set(TUBE.x, TUBE.y, TUBE.z);
  fl.scale.setScalar(1.25); // a 1.1 m fitting
  let tubeMat = null;
  fl.traverse((o) => {
    if (!o.isMesh) return;
    const glass = /glass/i.test(o.material?.name || '') || fl.userData.isFallback;
    o.material = o.material.clone();
    if (glass) {
      tubeMat = o.material;
      tubeMat.emissive = new THREE.Color('#ffffff');
      if (!tubeMat.emissiveMap) tubeMat.emissive.copy(TUBE_COLOR);
      tubeMat.toneMapped = true;
    }
  });
  group.add(fl);
  // The fallback (or a fitting with no glass slot): a plain tube we can drive the same way.
  if (!tubeMat) {
    tubeMat = new THREE.MeshStandardMaterial({ color: '#d8e6da', emissive: TUBE_COLOR, roughness: 0.4 });
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.1, 10).rotateZ(Math.PI / 2), tubeMat);
    t.position.set(TUBE.x, TUBE.y - 0.03, TUBE.z);
    group.add(t);
  }
  const chainGeos = [];
  for (const dx of [-0.42, 0.42]) {
    for (let y = TUBE.y + 0.01; y < H - 0.02; y += 0.045) chainGeos.push(new THREE.TorusGeometry(0.012, 0.0025, 4, 8).rotateY((y * 40) % 2 > 1 ? Math.PI / 2 : 0).translate(TUBE.x + dx, y + 0.02, TUBE.z));
    chainGeos.push(bx(TUBE.x + dx - 0.03, TUBE.x + dx + 0.03, H - 0.02, H, TUBE.z - 0.03, TUBE.z + 0.03));
  }
  group.add(merged(chainGeos, surf.steel, { castShadow: false, name: 'tube-chains' }));
  const tubeLight = B.pointLight(0xcfe6d0, 6, { pos: [TUBE.x, TUBE.y - 0.25, TUBE.z + 0.25], distance: 6.5 });
  tubeLight.userData.noCone = true;
  group.add(tubeLight);

  // ---- daylight through the high window: a cool soft spot, no shadow (its cone is added by the
  // render pass as the visible shaft), aimed down and into the room.
  const wx = (WIN.x0 + WIN.x1) / 2;
  const winSpot = new THREE.SpotLight(0xa9b8c6, 9, 7, 0.42, 1, 1.6);
  winSpot.name = 'window-day';
  winSpot.position.set(wx, (WIN.y0 + WIN.y1) / 2, BACK_Z - 0.05);
  winSpot.target.position.set(wx - 0.35, 0, -0.55);
  winSpot.userData.noCone = true; // its own wide, faint shaft instead of the default cone
  group.add(winSpot, winSpot.target);
  const shaftDir = new THREE.Vector3(wx - 0.35, 0, -0.55).sub(winSpot.position).normalize();
  const shaft = B.lightCone({ length: 3.3, radius: 0.95, apex: 0.42, color: '#b8c6d0', opacity: 0.075, softness: 1.8, pos: [wx, (WIN.y0 + WIN.y1) / 2 - 0.05, BACK_Z + 0.05], dir: shaftDir });
  shaft.name = 'window-shaft';
  group.add(shaft);

  // ---- Odile's floor lamp: a cream fabric shade on a brass stem (a small warm practical).
  const lamp = new THREE.Group();
  lamp.name = 'floor-lamp';
  lamp.position.set(LAMP.x, 0, LAMP.z);
  lamp.add(
    merged(
      [new THREE.CylinderGeometry(0.13, 0.15, 0.03, 20).translate(0, 0.015, 0), tube([0, 0.03, 0], [0, 1.36, 0], 0.011, { seg: 10 }), new THREE.CylinderGeometry(0.02, 0.02, 0.06, 10).translate(0, 1.33, 0)],
      surf.brass,
      { castShadow: true },
    ),
  );
  const shadeMat = new THREE.MeshStandardMaterial({
    color: '#cbbd9e',
    roughness: 0.95,
    side: THREE.DoubleSide,
    emissive: new THREE.Color('#ffb070'),
    emissiveIntensity: 0.55,
  });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.24, 22, 1, true).translate(0, 1.42, 0), shadeMat);
  shade.castShadow = false;
  lamp.add(shade, new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8).translate(0, 1.36, 0), glowMat('#ffcf96', 3)));
  group.add(lamp);
  const lampLight = B.pointLight(0xffa860, 2.6, { pos: [LAMP.x - 0.05, 1.32, LAMP.z], distance: 3.6 });
  lampLight.userData.noCone = true;
  group.add(lampLight);

  // ---- spill from the bulb toward the doorway end (the frame and the hung door shots).
  const doorFill = B.pointLight(0xffb070, 1.4, { pos: [DOORWAY.x0 - 0.6, 2.3, -1.9], distance: 3.2 });
  doorFill.userData.noCone = true;
  group.add(doorFill);

  // ---- up the stairwell: a dim landing bulb so the doorway has depth.
  const stairLight = B.pointLight(0xffc88a, 2.2, { pos: [DOORWAY.x0 + 0.3, 2.45, -4.0], distance: 3.4 });
  stairLight.userData.noCone = true;
  group.add(stairLight);

  // ------------------------------------------------------------ live state
  const tube_ = { mode: 'flicker', level: 1, off: 0, next: 1.5 };
  const v = new THREE.Vector3();
  const audio = ctx.audio;
  let t = 0;
  // Sound (docs/assets/sfx.md Ch4): the tube's hum is a point source gated by the tube (it drops out in
  // each stutter); a long stutter plays a recorded fluoro_flicker (at most one every 5 s; the short
  // ones are the hum's gaps). Started on the first frame; main.js stops it at the next chapter.
  const TUBE_POS = [TUBE.x, TUBE.y - 0.05, TUBE.z];
  let hum = null;
  let flickAt = -1e9;

  function updateTube(raw) {
    const s = tube_;
    if (!hum && audio?.loopSfx) hum = audio.loopSfx('fluoro_hum', { volume: 0, bus: 'beds', pos: TUBE_POS, ref: 1.5, fade: 1.5 }); // ducks under voices
    let target = 1;
    if (s.mode === 'off') target = 0;
    else if (s.mode === 'flicker') {
      s.next -= raw;
      if (s.next <= 0 && s.off <= 0) {
        const long = R() < 0.3;
        s.off = 0.05 + R() * (long ? 0.6 : 0.15);
        s.next = 0.6 + R() * 3.5;
        if (long && t - flickAt >= 5) {
          flickAt = t;
          audio?.sfx?.('fluoro_flicker', { volume: 0.2, bus: 'bus', pos: TUBE_POS, ref: 1.5, fallback: (a) => a.tone({ freq: 120, to: 100, dur: 0.06, type: 'square', volume: 0.025 }) });
        }
      }
      if (s.off > 0) {
        s.off -= raw;
        target = R() < 0.5 ? 0.05 : 0.35;
      } else target = 0.92 + 0.05 * Math.sin(t * 50);
    }
    s.level = s.mode === 'flicker' ? target : damp(s.level, target, 10, raw);
    hum?.set(s.level > 0.3 ? 0.1 * Math.min(1, s.level) : 0, null, 0.03); // the hum cuts out with the tube
    tubeLight.intensity = (s.mode === 'on' ? 4.2 : 6) * s.level; // fixed in Week 7: a steadier, softer tube
    tubeMat.emissiveIntensity = 0.15 + 2.6 * s.level;
  }

  return {
    bulbSpot,
    bulbGlow,
    bulbMesh,
    tubeLight,
    winSpot,
    lampLight,
    /** 'flicker' | 'on' | 'off' (true / false accepted). */
    fluoro(mode) {
      tube_.mode = mode === true ? 'on' : mode === false ? 'off' : mode;
    },
    update(dt, raw) {
      t += raw;
      updateTube(raw);
      // The bulb sways a hair on its cord; light and shadow follow.
      bulbRig.rotation.z = 0.025 * Math.sin(t * 0.7);
      bulbRig.rotation.x = 0.018 * Math.sin(t * 0.53 + 1);
      bulbProp.getWorldPosition(v);
      v.y -= 0.07; // the filament, not the screw base
      bulbSpot.position.copy(v);
      bulbGlow.position.copy(v);
      const flick = 0.97 + 0.03 * Math.sin(t * 13.1) * Math.sin(t * 3.7);
      bulbSpot.intensity = 38 * flick;
      halo.material.opacity = 0.5 * flick;
    },
  };
}
