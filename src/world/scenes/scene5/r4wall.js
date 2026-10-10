import * as THREE from 'three';
import { canvas, texFrom, props } from './util.js';

// Revision 4 pieces of Ch7 « Le Mur » (docs/SCRIPT-R4.md §8), added by scene5.js on top of scene2's 'wall' variant:
//   layoutMural   the seven mural panels along the wall: scene2 cuts the wall into equal slots, one per entry of
//                 L.ch7.signs.panels; here the five neighbours' panels get their R3 size back and the two new ones
//                 are small: M. Durand's spoke key (brass and steel on cream) beside Odile's hand, and Jo's
//                 fine-line swallow (black on oxblood), the smallest panel on the wall, at the kebab end.
//   openShop      CYCLES DURAND by day: the shutter rolled up, the lit shop behind the glass, the « FERMÉ » note gone.
//   makeR4Cast    M. Durand (a chair next to Odile's) and Jo (at her panel), with the spots the chapter uses.

const GREY = new THREE.Color('#b9b5ad');
const WHITE = new THREE.Color('#ffffff');
// Along the wall from the bakery end (z -12) to the kebab end (-32): width and height in metres, centre height.
const ORDER = ['benali', 'ines', 'sami', 'odile', 'durand', 'marco', 'jo'];
const SIZE = {
  big: { w: 3.3, h: 2.5, y: 3.05 }, // the R3 panels (PANEL y0 1.8, h 2.5), a little narrower to make room
  durand: { w: 1.25, h: 0.85, y: 2.42 },
  jo: { w: 0.5, h: 0.4, y: 2.25 },
};
const WALL_Z0 = -12;
const WALL_Z1 = -31.55; // the line runs to -32; this keeps Jo's swallow clear of the downpipe at the wall's end

// ------------------------------------------------------------------------------------------- panel art

/** M. Durand's panel: a round spoke key, life-size and then some, painted like a shop sign. No text. */
function durandArt() {
  return canvas(500, 340, (g, W, H) => {
    // Cream ground with a fine Bleu Durand rule an inch in: he measured.
    g.fillStyle = '#efe6cf';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#4a6a8e';
    g.lineWidth = 3;
    g.strokeRect(14, 14, W - 28, H - 28);
    const cx = W / 2;
    const cy = H / 2 + 4;
    const R = 112;
    // A soft painted shadow, down and right (trompe-l’œil).
    g.fillStyle = 'rgba(70,60,45,0.22)';
    g.beginPath();
    g.arc(cx + 10, cy + 12, R, 0, Math.PI * 2);
    g.fill();
    // The steel disc, with four slots in the rim (four spoke sizes).
    const steel = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    steel.addColorStop(0, '#dfe3e6');
    steel.addColorStop(0.45, '#9ea6ad');
    steel.addColorStop(1, '#5f676e');
    g.fillStyle = steel;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 4; i++) {
      g.save();
      g.translate(cx, cy);
      g.rotate(Math.PI / 4 + (i * Math.PI) / 2);
      const sw = 12 + i * 3; // each slot a size up
      g.fillRect(-sw / 2, -R - 2, sw, 34);
      g.beginPath();
      g.arc(0, -R + 32, sw / 2, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    g.globalCompositeOperation = 'source-over';
    // Re-lay the cream in the slots (destination-out cut through the ground too), then the shadow under them.
    g.globalCompositeOperation = 'destination-over';
    g.fillStyle = '#efe6cf';
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = '#3c4247';
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.stroke();
    // Brass boss and rivet.
    const brass = g.createRadialGradient(cx - 14, cy - 14, 4, cx, cy, 46);
    brass.addColorStop(0, '#f2d79a');
    brass.addColorStop(0.55, '#c49a52');
    brass.addColorStop(1, '#7c5a26');
    g.fillStyle = brass;
    g.beginPath();
    g.arc(cx, cy, 44, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#5b4220';
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = '#efe6cf';
    g.beginPath();
    g.arc(cx, cy, 11, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // A highlight along the steel's top-left edge.
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cx, cy, R - 6, Math.PI * 1.05, Math.PI * 1.45);
    g.stroke();
  });
}

/** Jo's panel: a small swallow, fine black line on oxblood, a little crooked (her first tattoo). No text. */
function joArt() {
  return canvas(320, 256, (g, W, H) => {
    g.fillStyle = '#6b2430';
    g.fillRect(0, 0, W, H);
    g.save();
    g.translate(W / 2 + 6, H / 2 + 4);
    g.rotate(-0.12); // toute croche
    g.lineJoin = g.lineCap = 'round';
    const ink = '#141012';
    const belly = '#ead9c0';
    // Wings: two long swept blades.
    const wing = (s) => {
      g.beginPath();
      g.moveTo(-6, -6);
      g.quadraticCurveTo(-40 * s, -70, -118 * s, -58);
      g.quadraticCurveTo(-64 * s, -30, -14 * s, 10);
      g.closePath();
    };
    g.fillStyle = '#4a1720';
    for (const s of [1, -1]) {
      wing(s);
      g.fill();
    }
    g.strokeStyle = ink;
    g.lineWidth = 2.6;
    for (const s of [1, -1]) {
      wing(s);
      g.stroke();
      // three feather lines
      for (let k = 1; k <= 3; k++) {
        g.beginPath();
        g.moveTo(-18 * s - k * 14 * s, -6 - k * 6);
        g.lineTo(-38 * s - k * 22 * s, -36 - k * 5);
        g.stroke();
      }
    }
    // Body: a teardrop, the belly cream; the forked tail.
    g.beginPath();
    g.moveTo(0, -40);
    g.quadraticCurveTo(24, -18, 10, 34);
    g.lineTo(-10, 34);
    g.quadraticCurveTo(-24, -18, 0, -40);
    g.closePath();
    g.fillStyle = belly;
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(-9, 32);
    g.lineTo(-30, 92);
    g.lineTo(-4, 50);
    g.lineTo(4, 50);
    g.lineTo(30, 92);
    g.lineTo(9, 32);
    g.fillStyle = '#2a0d12';
    g.fill();
    g.stroke();
    // Head cap and the eye.
    g.beginPath();
    g.arc(0, -30, 10, Math.PI, 0);
    g.fillStyle = ink;
    g.fill();
    g.fillStyle = belly;
    g.beginPath();
    g.arc(4, -32, 2, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
}

/**
 * Lay the seven panels out along the wall (mutates scene2's panel records: z0, z1, mesh transform; the two new
 * panels get their art and a grey -> full-colour setColor). Call before scene5 wraps them (panelControl).
 * Returns the panels in the order scene2 gave them (indices 0-4 unchanged), plus byId.
 */
export function layoutMural(panels) {
  const byId = Object.fromEntries((panels || []).map((p) => [p.id, p]));
  const list = ORDER.filter((id) => byId[id]);
  if (!byId.durand && !byId.jo) return { panels, byId }; // nothing new to make room for: keep scene2's slots
  const sizeOf = (id) => SIZE[id] || SIZE.big;
  const used = list.reduce((a, id) => a + sizeOf(id).w, 0);
  const gap = Math.max(0.05, (Math.abs(WALL_Z1 - WALL_Z0) - used) / list.length);
  let z = WALL_Z0 - gap / 2;
  for (const id of list) {
    const p = byId[id];
    const s = sizeOf(id);
    const mesh = p.mesh;
    p.z0 = z;
    p.z1 = z - s.w;
    z = p.z1 - gap;
    if (!mesh) continue;
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    const gw = bb.max.x - bb.min.x || 1;
    const gh = bb.max.y - bb.min.y || 1;
    mesh.scale.set(s.w / gw, s.h / gh, 1);
    mesh.position.z = (p.z0 + p.z1) / 2;
    mesh.position.y = s.y;
    const art = id === 'durand' ? durandArt : id === 'jo' ? joArt : null;
    if (art) {
      const m = mesh.material;
      m.map?.dispose?.();
      m.map = texFrom(art());
      m.transparent = false;
      m.depthWrite = true;
      m.needsUpdate = true;
      // Full-colour art: the material goes grey -> white (scene5's saturation control does the rest).
      p.setColor = function setColor(k) {
        this.k = Math.max(0, Math.min(1, k));
        m.color.copy(GREY).lerp(WHITE, this.k);
      };
      p.setColor(0);
    }
  }
  return { panels, byId };
}

// ------------------------------------------------------------------------------------------- the open shop

/** The shop behind the glass by day: bikes on the hooks again, the bench under its lamp, warm light. */
function shopArt() {
  return canvas(1024, 640, (g, W, H) => {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2a2119');
    bg.addColorStop(0.55, '#3d2f22');
    bg.addColorStop(1, '#1c1611');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    // Warm pool of the bench lamp, right of centre.
    const pool = g.createRadialGradient(W * 0.68, H * 0.45, 10, W * 0.68, H * 0.45, W * 0.42);
    pool.addColorStop(0, 'rgba(255,206,140,0.6)');
    pool.addColorStop(1, 'rgba(255,200,130,0)');
    g.fillStyle = pool;
    g.fillRect(0, 0, W, H);
    // Back-wall hooks and three bikes hung by the top tube, two outlines still empty.
    g.lineCap = g.lineJoin = 'round';
    const bike = (x, y, s, col, outline = false) => {
      g.strokeStyle = col;
      g.lineWidth = outline ? 3 : 7 * s;
      if (outline) g.setLineDash([10, 8]);
      for (const dx of [-62, 62]) {
        g.beginPath();
        g.arc(x + dx * s, y + 46 * s, 44 * s, 0, Math.PI * 2);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(x - 62 * s, y + 46 * s);
      g.lineTo(x - 18 * s, y);
      g.lineTo(x + 40 * s, y);
      g.lineTo(x + 62 * s, y + 46 * s);
      g.moveTo(x - 18 * s, y);
      g.lineTo(x, y + 46 * s);
      g.lineTo(x - 62 * s, y + 46 * s);
      g.moveTo(x, y + 46 * s);
      g.lineTo(x + 40 * s, y);
      g.stroke();
      g.setLineDash([]);
    };
    g.fillStyle = '#9a8f80';
    for (const x of [170, 360, 550, 740, 900]) {
      g.fillRect(x - 24, 120, 6, 18);
      g.fillRect(x + 18, 120, 6, 18);
    }
    bike(170, 150, 1, '#1b1b1d');
    bike(360, 150, 1, 'rgba(230,220,200,0.35)', true);
    bike(550, 150, 1, '#4a6a8e');
    bike(740, 150, 1, 'rgba(230,220,200,0.35)', true);
    bike(900, 150, 0.9, '#7a2a22');
    // The workbench with a wheel in the truing stand, the tins, the lamp.
    g.fillStyle = '#2b2019';
    g.fillRect(470, 420, 520, 26);
    g.fillRect(480, 446, 16, 150);
    g.fillRect(964, 446, 16, 150);
    g.strokeStyle = '#c9c2b4';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(700, 350, 62, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 1.5;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      g.beginPath();
      g.moveTo(700, 350);
      g.lineTo(700 + Math.cos(a) * 60, 350 + Math.sin(a) * 60);
      g.stroke();
    }
    g.fillStyle = '#4a6a8e';
    g.fillRect(840, 392, 34, 28);
    g.fillStyle = '#8a8478';
    g.fillRect(884, 398, 26, 22);
    g.fillStyle = '#3a3a3a';
    g.fillRect(620, 250, 6, 170);
    g.fillStyle = '#ffe0a8';
    g.beginPath();
    g.arc(623, 246, 16, 0, Math.PI * 2);
    g.fill();
    // Counter on the left, no dust sheet now; a till.
    g.fillStyle = '#3e3126';
    g.fillRect(40, 430, 300, 210);
    g.fillStyle = '#5a4a3a';
    g.fillRect(40, 420, 300, 14);
    g.fillStyle = '#26221e';
    g.fillRect(230, 380, 70, 42);
    // Glass: a sky streak and a dark lower band.
    const gl = g.createLinearGradient(0, 0, W, H);
    gl.addColorStop(0, 'rgba(255,255,255,0.10)');
    gl.addColorStop(0.35, 'rgba(255,255,255,0.0)');
    gl.addColorStop(0.62, 'rgba(255,255,255,0.08)');
    gl.addColorStop(1, 'rgba(255,255,255,0.0)');
    g.fillStyle = gl;
    g.fillRect(0, 0, W, H);
    // The mullion: a door on the right third.
    g.fillStyle = '#2a2e33';
    g.fillRect(W * 0.7, 0, 10, H);
    g.fillRect(0, 0, W, 8);
  });
}

/**
 * CYCLES DURAND open by day (SCRIPT-R4 §8: « The bike shop's shutter is up »): a lit shopfront over scene2's closed
 * shutter (wall variant: x = 5.95 facade, z -31.3 .. -36.7), and the « FERMÉ » note taken down.
 */
export function openShop(parent, { signs } = {}) {
  const zc = (-31.3 + -36.7) / 2;
  const tex = texFrom(shopArt());
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: '#a59684' });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 2.64), mat);
  mesh.rotation.y = -Math.PI / 2;
  mesh.position.set(5.95 - 0.085, 0.07 + 1.32, zc);
  mesh.name = 'durand-shop-open';
  mesh.userData.noOcclude = true;
  parent.add(mesh);
  if (signs?.shopNote) signs.shopNote.visible = false;
  return {
    mesh,
    dispose() {
      tex.dispose();
      mat.dispose();
      mesh.geometry.dispose();
    },
  };
}

// ------------------------------------------------------------------------------------------- the cast

/**
 * M. Durand and Jo. Durand sits in a chair beside Odile's (on her right, clear of the radio crate behind her);
 * Jo stands at her swallow. Returns { durand, jo, durandSeat: {seat, facing}, spots }.
 *   spots.durandChair  his chair (the `durandPanel` hotspot)      spots.joPanel  where Jo stands at her panel
 *   spots.durandShop   at CYCLES DURAND for the golden walk        spots.samiShop Sami's bike at the shop
 *   spots.joDoor       Jo at ENCRE FINE's door for the golden walk
 */
export async function makeR4Cast(ctx, parent, { odileChair, chairFacing, surfaceAt, wallX, joPanel, encreDoor }) {
  const A = ctx.assets;
  const mk = (o) => {
    const c = A.makeCharacter({ castShadow: false, ...o }); // draw-call budget: the neighbours don't cast either
    parent.add(c.root);
    return c;
  };
  const durand = mk({ preset: 'durand', name: 'Durand' });
  const jo = mk({ preset: 'jo', name: 'Jo' });

  // His chair: a metre from Odile's on the shop-window side (her radio crate is on the other), a little forward,
  // turned a touch toward her. Her chalk crate sits between them.
  const [ox, oz] = odileChair;
  const side = new THREE.Vector3(Math.cos(chairFacing), 0, -Math.sin(chairFacing));
  const fwd = new THREE.Vector3(Math.sin(chairFacing), 0, Math.cos(chairFacing));
  const cp = new THREE.Vector3(ox, 0, oz).addScaledVector(side, -1.0).addScaledVector(fwd, 0.3);
  cp.x = Math.max(cp.x, -5.6); // clear of ENCRE FINE's window
  cp.y = surfaceAt(cp.x, cp.z);
  const facing = chairFacing + 0.3;
  const [chair] = await props(ctx, [['props/chair_painted.glb', { height: 0.96 }]]);
  chair.position.copy(cp);
  chair.rotation.y = facing;
  chair.userData.noRestyle = true;
  parent.add(chair);
  const seat = cp.clone().addScaledVector(new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing)), 0.035);
  durand.root.position.copy(seat);
  durand.root.rotation.y = facing;
  durand.play('sit_idle', 0);
  durand.model.position.y = 0;

  const jp = joPanel ? [wallX + 1.9, joPanel - 0.35] : [wallX + 1.9, -31.6]; // past her panel: Gérard stands at his
  jo.root.position.set(jp[0], surfaceAt(jp[0], jp[1]), jp[1]);
  jo.root.rotation.y = -Math.PI / 2 - 0.25;
  jo.play('idle', 0); // her idle is arms crossed

  const door = encreDoor || [-5.0, -40.6];
  return {
    durand,
    jo,
    chair,
    durandSeat: { seat, facing },
    spots: {
      durandChair: [seat.x + 0.2, seat.z + 0.5],
      joPanel: jp,
      durandShop: [4.85, -33.0],
      samiShop: [3.75, -34.4],
      joDoor: [door[0] + 0.45, door[1] + 0.2],
    },
  };
}
