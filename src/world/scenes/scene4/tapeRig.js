import * as THREE from 'three';
import { makeCanvas } from './geo.js';

// Ch4 Day 8: the tape measure across the internal doorway (docs/DESIGN.md R3.2). Adds to the
// dressing's `tape` group: setLength(cm) runs the blade out from the case on the near jamb toward the
// far one (81.5 cm meets it), setBow(k) bends the blade's middle up (pressing the case into the
// jamb), and `loupe`: a magnified view of the blade at the case edge, drawn on a canvas and held in
// front of the camera, so the grade, grime and grain still apply. Digits only, no language.

const JAMB = 81.5;
const LW = 640; // loupe canvas
const LH = 180;
const PX_CM = LW / 6; // about 6 cm across: the blade magnified ~6x on screen
const HAIR = LW * 0.6;

function tickTexture() {
  // 10 cm of blade: cm ticks and a 5 mm tick, black on the yellow (the mesh tints it).
  const c = makeCanvas(256, 16);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 256, 16);
  g.fillStyle = '#2a2418';
  for (let i = 0; i < 20; i++) g.fillRect(i * 12.8, 0, 1.2, i % 2 ? 4 : 7);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/**
 * rigTape(ctx, tape, {x0, x1, y, z}) -> tape, with setLength(cm), setBow(k), loupe ({mesh, show(on),
 * set(x, {touch, bow})}), update(dt). x0: the blade's start at the case; x1: the far jamb's face.
 */
export function rigTape(ctx, tape, { x0, x1, y, z }) {
  // Swap the dressing's static blade for one that runs out and bows.
  const oldBlade = tape.children.find((o) => o.isMesh); // the case is a prop group, the blade a box
  oldBlade?.removeFromParent();
  oldBlade?.geometry?.dispose();
  const SEG = 40;
  const geo = new THREE.PlaneGeometry(1, 0.019, SEG, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0);
  const pos = geo.attributes.position;
  const baseY = Float32Array.from({ length: pos.count }, (_, i) => pos.getY(i));
  const ticks = tickTexture();
  const bladeMat = new THREE.MeshStandardMaterial({ color: '#c9a83a', map: ticks, roughness: 0.42, metalness: 0.3, side: THREE.DoubleSide });
  const blade = new THREE.Mesh(geo, bladeMat);
  blade.name = 'tape-blade';
  blade.position.set(x0, y, z);
  blade.castShadow = false;
  blade.userData.noOcclude = true;
  // The hook at the end: a small bent brass tab.
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.016, 0.021).translate(0.002, -0.006, 0), new THREE.MeshStandardMaterial({ color: '#a88a4a', roughness: 0.4, metalness: 0.7 }));
  hook.castShadow = false;
  hook.userData.noOcclude = true;
  tape.add(blade, hook);
  const scaleK = (x1 - x0) / (JAMB / 100); // 81.5 cm of blade reaches the far jamb

  let len = 0;
  let bow = 0;
  const layout = () => {
    const L = Math.max(0.002, (len / 100) * scaleK);
    blade.scale.x = L;
    ticks.repeat.x = L / 0.1;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i);
      pos.setY(i, baseY[i] + 0.015 * bow * Math.sin(Math.PI * u));
    }
    pos.needsUpdate = true;
    geo.computeBoundingSphere();
    hook.position.set(x0 + L, y, z);
  };
  layout();

  // ---- the loupe
  const canvas = makeCanvas(LW, LH);
  const g = canvas.getContext('2d');
  const ltex = new THREE.CanvasTexture(canvas);
  ltex.colorSpace = THREE.SRGBColorSpace;
  ltex.anisotropy = 4;
  const lmat = new THREE.MeshBasicMaterial({ map: ltex, fog: false, toneMapped: true });
  const lmesh = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.09), lmat);
  lmesh.name = 'tape-loupe';
  lmesh.visible = false;
  lmesh.renderOrder = 10;
  lmesh.castShadow = false;
  lmesh.receiveShadow = false;
  lmesh.userData.noOcclude = true;
  lmesh.frustumCulled = false;
  tape.parent?.add(lmesh);
  const offset = new THREE.Vector3(0, -0.077, -0.6); // lower third, above the prompt line
  const cam = ctx.camera;

  let drawn = '';
  const wood = (() => {
    // A sliver of jamb: painted edge then end grain, drawn once and blitted.
    const c = makeCanvas(LW, LH);
    const w = c.getContext('2d');
    w.fillStyle = '#6b5236';
    w.fillRect(0, 0, LW, LH);
    for (let i = 0; i < 26; i++) {
      w.strokeStyle = `rgba(${40 + i * 3},${26 + i * 2},14,${0.25 + (i % 3) * 0.12})`;
      w.lineWidth = 1 + (i % 4);
      w.beginPath();
      const x = 8 + i * 24 + Math.sin(i * 1.7) * 6;
      w.moveTo(x, 0);
      w.bezierCurveTo(x + 8, LH * 0.3, x - 6, LH * 0.7, x + 4, LH);
      w.stroke();
    }
    w.fillStyle = '#8f8677'; // old paint on the jamb's face edge
    w.fillRect(0, 0, 10, LH);
    w.fillStyle = 'rgba(0,0,0,0.45)';
    w.fillRect(10, 0, 3, LH);
    return c;
  })();

  function draw(x, touch, k) {
    const key = `${x.toFixed(2)}|${touch ? 1 : 0}|${k.toFixed(2)}`;
    if (key === drawn) return;
    drawn = key;
    // Blade
    const grd = g.createLinearGradient(0, 0, 0, LH);
    grd.addColorStop(0, '#e2c25a');
    grd.addColorStop(0.55, '#d4b148');
    grd.addColorStop(1, '#b8952f');
    g.fillStyle = grd;
    g.fillRect(0, 0, LW, LH);
    // Ticks bunch toward the hairline as the blade bows.
    const at = (v) => {
      const dv = v - x;
      const squeeze = 1 - 0.38 * k * Math.exp(-(dv * dv) / 4);
      return HAIR + dv * PX_CM * squeeze;
    };
    g.fillStyle = '#1e1a12';
    g.font = '600 34px ui-monospace, Menlo, Consolas, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    const lo = Math.floor((x - 4) * 10);
    const hi = Math.ceil((x + 4) * 10);
    for (let mm = Math.max(0, lo); mm <= hi; mm++) {
      const X = at(mm / 10);
      if (X < -4 || X > LW + 4) continue;
      const cm = mm % 10 === 0;
      const half = mm % 5 === 0;
      g.fillRect(X - (cm ? 1.5 : 0.9), 0, cm ? 3 : 1.8, cm ? 64 : half ? 42 : 24);
      if (cm) g.fillText(String(mm / 10), X, 112);
    }
    // The far jamb comes in from the right and meets the case edge at 81.5.
    const XJ = Math.max(HAIR, at(JAMB));
    if (XJ < LW) {
      g.drawImage(wood, 0, 0, LW - XJ, LH, XJ, 0, LW - XJ, LH);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(XJ - 5, 0, 5, LH);
    }
    // The case edge: a fixed hairline (thicker on contact, warm red while the blade bows).
    const w = touch ? 7 + 4 * k : 3;
    g.fillStyle = k > 0.02 ? `rgb(${235},${60 + 30 * (1 - k)},${36})` : touch ? '#b0201a' : '#8a1610';
    g.fillRect(HAIR - w / 2, 0, w, LH);
    if (k > 0.02) {
      g.fillStyle = `rgba(255,90,50,${0.25 * k})`;
      g.fillRect(HAIR - w * 2, 0, w * 4, LH);
    }
    // Lens: soft dark rim.
    const v = g.createRadialGradient(LW / 2, LH / 2, LH * 0.6, LW / 2, LH / 2, LW * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = v;
    g.fillRect(0, 0, LW, LH);
    g.strokeStyle = 'rgba(20,16,12,0.95)';
    g.lineWidth = 8;
    g.strokeRect(0, 0, LW, LH);
    ltex.needsUpdate = true;
  }

  const loupe = {
    mesh: lmesh,
    on: false,
    show(on) {
      loupe.on = !!on;
      if (!on) lmesh.visible = false;
    },
    /** Blade at x cm under the case edge; touch: the case is on the jamb; bow 0..1. */
    set(x, { touch = false, bow: k = 0 } = {}) {
      draw(x, touch, k);
    },
  };
  draw(0, false, 0);

  Object.assign(tape, {
    blade,
    loupe,
    setLength(cm) {
      len = Math.max(0, Math.min(90, cm));
      layout();
    },
    setBow(k) {
      bow = Math.max(0, Math.min(1, k));
      layout();
    },
    /** Called from the scene update: keep the loupe in front of the camera; hidden under dialogue. */
    updateTape(hidden = false) {
      lmesh.visible = loupe.on && tape.visible && !hidden;
      if (!lmesh.visible) return;
      cam.updateMatrixWorld();
      lmesh.position.copy(offset).applyQuaternion(cam.quaternion).add(cam.position);
      lmesh.quaternion.copy(cam.quaternion);
    },
  });
  return tape;
}
