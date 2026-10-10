import * as THREE from 'three';
import { box, mat, pointLight, sign, relabel, relangTexture, canvasTexture, grimeTexture, rain as makeRain, rng as seeded } from '../build.js';
import { Batch, boxGeo, cbox, cyl, rod, tubeGeo, compose, atlasPlane, noOcclude } from './scene2/kit.js';
import { windowAtlas, posterAtlas } from './scene2/art.js';
import { FRONT_X, GF, FLOOR, BUILDINGS, LIT_CELLS, addBuilding, addWindow, addDoor, addShopfront, facadeFrame } from './scene2/facades.js';
import { buildStreet, SIDEWALK_Y } from './scene2/street.js';
import { addLamp, addBench, addDumpster, addCables, addAwning, buildTowerFrame, BENCH_FIXED } from './scene2/fixtures.js';
import { streetMaterials } from './scene2/materials.js';
import { splashes, stream, steam } from './scene2/fx.js';
import { bakeryWindow } from './scene2/bakery.js';
import { streetHums } from './scene2/sound.js';
import { buildEncre } from './scene2/encre.js';
import { buildDurand } from './scene2/durand.js';
import { benchSlats, benaliShutter, neonWires, printMark } from './scene2/fixes.js';

// Rue des Tanneurs. Built for Ch2 ("Never Stop": late evening, rain) and Ch5 ("The Wall": day,
// then golden hour) from one STREET CONTRACT (docs/DESIGN.md), and for the Revision 4 chapters
// (docs/SCRIPT-R4.md: Ch5 "Qui a huilé le rideau ?" by day, Ch6 "Service de nuit" at night):
//
//   buildScene2(ctx, { variant: 'evening' | 'wall' | 'day' | 'night', text })
//
// Layout (metres; the player walks toward -Z; spawn z +8..+3):
//   road + sidewalks     asphalt x -3.5..3.5 with cobbled gutters and kerbs, sidewalks to the facades at
//                        |x| = 5.95 (3.5 cm up), z +14..-45, then the pavement in front of No. 14
//   left  (x < 0)        row | bakery (Benali) z -5.7..-12 | BLIND WALL z -12..-32, h 8, face +X | CHEZ GÉRARD
//                        z -32..-36.3 (Lou's window on the 4th floor) | bench [-5.32, -36.5] | ENCRE FINE
//                        z -36.5..-42.2 (Jo's tattoo shop, a real room behind the glass) | row houses to -48
//   right (x > 0)        row | gable with the MARCHAL & FILLE ghost sign z -6.3..-13.7 (sign at z -10, high)
//                        | row | doorway with the buzzing tube z -20.3..-24.5 | row | CYCLES DURAND z -31.3..-36.7 | row
//   end of the street    No. 14 at z -48 (facade faces +Z): the workshop garage door x -1.6..1.6 (h 2.7) under a deep
//                        corrugated lean-to, the fascia above it, Hugo's lit third-floor window. Interior room x -2.6..2.6,
//                        z -48..-53.2.
//   evening (Ch2)        STRIDE billboard on the blind wall (z -18, high), Odile's scaffold tower at [-1, -46.2],
//                        Odile on it, the five-runner club (hidden until Ch2 needs them), rain, fly-posters,
//                        ENCRE FINE's sign hanging crooked and Jo's stepladder under it.
//   wall (Ch7, was Ch5)  primed wall + the neighbours' mural panels (z -12..-32, y 1.8..4.3), the pale billboard
//                        rectangle with bolt holes above them, the garage door fully open, no rain, no street lights.
//   day (R4 Ch5/Ch6)     Weeks 2-6, overcast morning, wet 0.4 (puddles), the billboard and posters still up, the
//                        bakery shutter on its own (open / oiled), the garage door half open, the fixes (below),
//                        CYCLES DURAND's door and the room behind it (Ch6 Week 6).
//   night (R4 Ch5/Ch6)   3 a.m.: sodium lamps, wet ground, no rain (setRain for a drizzle), one lit window (Lou's),
//                        CHEZ GÉRARD closed (neon off, shutter half down), No. 14 shut, the bakery dark (or the
//                        4 a.m. state: lit, shutter half up, the floured board on its trestle), Durand's night loop.
//
// The buildings, street surface and furniture are procedural (scene2/*.js): look.js recipes on every big
// surface, merged per material into a few draw calls (see scene2/kit.js Batch). The R4 sets are in
// scene2/encre.js, durand.js, fixes.js and rooms.js (walk-in ground floors), their canvas art in r4art.js.
//
// Extras on the returned object (every variant unless noted):
//   seat, shots, interior, wallLine, fascia, lights, setRain(v), signs, encre (ENCRE FINE: door, setOpen,
//   setTilt / straighten for the blade sign, ladder + joLadder in 'evening', bindBounds), bench (the slats)
//   evening: odile, tower, holdSpot, holdLeg, odileGround, wobble(amp), odileDown(), club[]
//   wall:    panels:[{id, mesh, z0, z1, color, setColor(k)}], setPanels(k), setGolden(), shopCardAt, boltHolesAt, nailPos
//   day / night: fixes {shutter, bench, card, neon}(fixed) + fixes.state, bakery (Mme Benali's shutter: setOpen,
//            setOiled, setLit), durand (setOpen, setLight, setPinned, focus), neon {setOn, setFlicker}, gerard
//            {setShutter}, marks.print(on), paths {nightLoop, nightStops, bastienRoute}, anchors, mood

const SODIUM = 0xd9a35a;
const NEON = 0xff3d6e;
const TUBE = 0xcfe6d0;
const WARM = 0xffb36b;
const LAMP_INTENSITY = 95;
const WALL = { x: -5.95, z0: -12, z1: -32, h: 8 };
const BILLBOARD = { z: -18, y0: 4.7, w: 7.4, h: 3.0 };
const PANEL = { y0: 1.8, h: 2.5, gap: 0.2 };
const DOOR_Z = -48;
const GARAGE = { x0: -1.6, x1: 1.6, h: 2.7 };
const INTERIOR = { minX: -2.6, maxX: 2.6, minZ: -53.2, maxZ: -48, h: 3.1 };
const FACADE = { w: 28, h: 14 };
const TOWER = { x: -1, z: -46.2, size: 2, lift: 0.12 };
const SEAT = { x: -5.32, z: -36.5, facing: Math.PI / 2, standX: -4.8 };
const SEAT_LAMP_Z = -38.6; // LAMPS: the one over the bench
// Durand's night loop (R4, world [x, z], closed): out of his shop door, up the right pavement, across to
// Mme Benali's shutter, down past the blind wall and under Gérard's neon to the bench, back across.
const NIGHT_LOOP = [
  [4.9, -32.6], [4.75, -24], [4.75, -13.5], [1.2, -10.6], [-4.5, -9.8], [-4.55, -14], [-4.6, -22], [-4.6, -30],
  [-4.4, -32.4], [-4.5, -35.4], [-4.55, -36.6], [-3.0, -37.4], [1.5, -35.8], [4.6, -33.3],
];
const NIGHT_STOPS = { door: 0, shutter: 4, neon: 8, bench: 10 };
const HOLD_LEG = [TOWER.x + 0.95, TOWER.z + 0.95]; // the tower's front-right leg
const HOLD_SPOT = [TOWER.x + 1.32, TOWER.z + 1.32];
const ODILE_GROUND = [1.8, -45.55]; // beside Hugo, not hidden behind him from shots.after

// Street lamps (none in front of the blind wall: the Ch5 line runs along it). light: real PointLight.
const LAMPS = [
  { side: -1, z: 2, model: 'square', light: true },
  { side: 1, z: -4, model: 'curved', light: true },
  { side: -1, z: -9, model: 'square', light: true, flicker: true },
  { side: 1, z: -16, model: 'curved', light: true },
  { side: 1, z: -28, model: 'curved', light: true },
  { side: -1, z: -38.6, model: 'square', light: true }, // over the bench
  { side: 1, z: -41.6, model: 'curved', bulb: false }, // dead
  { side: -1, z: -45.6, model: 'square' },
];

const HANDWRITING = '"Bradley Hand", "Segoe Print", "Noteworthy", "Comic Sans MS", cursive';
const SANS = 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** '#rrggbb' + alpha -> 'rgba(...)'. */
function hexA(hex, a) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

// TEXT: the street-name plaques (dressing)
const STREET_NAME = 'RUE DES\nTANNEURS';
// TEXT: Gérard's fascia (shop dressing, not story text)
const GERARD_FASCIA = 'GRILL · KEBAB · FRITES';
// TEXT: R4 shop dressing, overridden by L.ch2.signs.<key> or opts.text.<key> when the script gives one.
// The photo caption and the tin label are read out in Ch6 (docs/SCRIPT-R4.md §7.2): keep them in step.
const R4_TEXT = {
  encre: 'ENCRE FINE',
  encreTrade: 'tatouage fin',
  durandPhoto: 'Albert Durand, 1974',
  durandTin: 'Bleu Durand, 1979, O. M.',
};
const VARIANTS = ['evening', 'wall', 'day', 'night'];
// The street's own weather for the R4 variants (the chapter look's wet / grime otherwise).
const WEATHER = { day: { wet: 0.4, ground: 0.75, grime: 0.9 }, night: { wet: 1, grime: 1 } };
const DURAND_BLUE = '#4a6a8e'; // CYCLES DURAND's fascia, faded blue (a fair-play tell, SCRIPT-R4 §9.2)

/**
 * Suggested mood for the R4 variants: ctx.mood.applyPreset(S.mood.preset, S.mood.overrides). 'day' is a
 * flat overcast morning on the `wall` preset; 'night' is SCRIPT-R4's night preset (sodium, fog 0.03,
 * grain 0.07) on `street`. Hope is the chapter's: the colour that came back stays.
 */
export const STREET_MOODS = {
  day: {
    preset: 'wall',
    overrides: {
      skyTop: '#7f888e',
      skyBottom: '#adb3b4',
      skyTopHope: '#8496a6',
      skyBottomHope: '#cfc9bb',
      fogColor: '#a7adad',
      fogColorHope: '#bdb9ae',
      fogDensity: 0.012,
      fogDensityHope: 0.008,
      hemiIntensity: 1.5,
      sunColor: '#d9dce0',
      sunIntensity: 1.0,
      sunDir: [0.55, 0.6, 0.45],
      env: 'dawn_fog',
      envIntensity: 0.1,
      envIntensityHope: 0.12,
      envAlign: true,
      lightChroma: 0.4,
      split: 0.12,
    },
  },
  night: {
    preset: 'street',
    overrides: {
      skyTop: '#101316',
      skyBottom: '#262b2c',
      skyTopHope: '#15161c',
      skyBottomHope: '#2e2b29',
      fogColor: '#2c3131',
      fogColorHope: '#33302c',
      fogDensity: 0.03,
      hemiIntensity: 0.75,
      sunColor: '#6f7f8e',
      sunIntensity: 0.22,
      fillIntensity: 5,
      envIntensity: 0.035,
      envIntensityHope: 0.045,
      vignette: 0.6,
      grain: 0.07,
    },
  },
};

// ------------------------------------------------------------------ textures

function radialTexture() {
  return canvasTexture(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.22, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
}

/**
 * Dusk (or overcast) sky as an equirect environment for puddles and dark glass (auto-PMREM'd).
 * golden: the Ch5 late-sun variant (warm horizon, matching the 'golden' preset sky).
 */
function skyEnv(day, golden = false) {
  const tex = canvasTexture(256, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, golden ? '#7a5a4c' : day ? '#9aa2a8' : '#4a5056');
    g.addColorStop(0.42, golden ? '#c98e5e' : day ? '#c3c6c4' : '#6c7176');
    g.addColorStop(0.5, golden ? '#e8b46e' : day ? '#d2cdc2' : '#868079');
    g.addColorStop(0.56, golden ? '#3a2e24' : '#3a3b3e');
    g.addColorStop(1, golden ? '#1e1a16' : '#202124');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    if (!day) {
      for (let i = 0; i < 9; i++) {
        const x = (i / 9) * w + 8;
        const r = c.createRadialGradient(x, h * 0.47, 0, x, h * 0.47, 10);
        r.addColorStop(0, 'rgba(255,190,110,0.85)');
        r.addColorStop(1, 'rgba(255,190,110,0)');
        c.fillStyle = r;
        c.fillRect(x - 12, h * 0.47 - 12, 24, 24);
      }
      const p = c.createRadialGradient(w * 0.3, h * 0.48, 0, w * 0.3, h * 0.48, 14);
      p.addColorStop(0, 'rgba(255,61,110,0.8)');
      p.addColorStop(1, 'rgba(255,61,110,0)');
      c.fillStyle = p;
      c.fillRect(w * 0.3 - 16, h * 0.48 - 16, 32, 32);
    }
  });
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

/** The STRIDE billboard: a runner mid-stride in acid green on black, the brand and the slogan. */
function strideTexture(text) {
  const [brand, tagline] = String(text).split(/\s+—\s+/);
  const R = seeded(77);
  return canvasTexture(2048, 830, (c, w, h) => {
    c.fillStyle = '#0a0c0b';
    c.fillRect(0, 0, w, h);
    const halo = c.createRadialGradient(1480, 420, 60, 1480, 420, 560);
    halo.addColorStop(0, 'rgba(198,244,50,0.26)');
    halo.addColorStop(1, 'rgba(198,244,50,0)');
    c.fillStyle = halo;
    c.fillRect(860, 0, w - 860, h);
    // Speed lines.
    c.strokeStyle = 'rgba(198,244,50,0.32)';
    c.lineWidth = 7;
    for (let i = 0; i < 22; i++) {
      const y = 70 + i * 32 + (i % 3) * 6;
      c.beginPath();
      c.moveTo(930 + (i % 5) * 36, y);
      c.lineTo(1230 - (i % 4) * 54, y);
      c.stroke();
    }
    // The runner, limbs as thick round strokes, leaning into the drive.
    const limb = (pts, width) => {
      c.lineWidth = width;
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) c.lineTo(p[0], p[1]);
      c.stroke();
    };
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = '#c6f432';
    c.fillStyle = '#c6f432';
    const sh = [1530, 240];
    const hip = [1410, 480];
    limb([sh, [1400, 320], [1330, 405]], 60);
    limb([hip, [1290, 615], [1140, 760]], 76);
    limb([sh, hip], 124);
    limb([hip, [1590, 540], [1560, 730], [1620, 742]], 78);
    limb([sh, [1650, 330], [1720, 232]], 60);
    c.beginPath();
    c.arc(1585, 152, 62, 0, Math.PI * 2);
    c.fill();
    // Brand.
    c.fillStyle = '#f1f4e8';
    c.font = `italic 900 270px ${SANS}`;
    c.textBaseline = 'alphabetic';
    c.fillText(brand || 'STRIDE', 100, 330);
    c.fillStyle = '#c6f432';
    c.beginPath();
    c.moveTo(112, 372);
    c.lineTo(900, 372);
    c.lineTo(868, 404);
    c.lineTo(94, 404);
    c.closePath();
    c.fill();
    c.fillStyle = '#c6f432';
    c.font = `italic 800 84px ${SANS}`;
    if ('letterSpacing' in c) c.letterSpacing = '10px';
    c.fillText(tagline || '', 112, 540);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    // Weathering: grime, rust tears from the top bolts, a peeled strip bottom right.
    for (let i = 0; i < 46; i++) {
      c.fillStyle = `rgba(32,26,18,${0.05 + R() * 0.1})`;
      c.beginPath();
      c.arc(R() * w, R() * h, 20 + R() * 120, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = 0; i < 6; i++) {
      const x = 120 + (i * (w - 240)) / 5;
      const g = c.createLinearGradient(0, 0, 0, 260 + R() * 200);
      g.addColorStop(0, 'rgba(122,70,38,0.65)');
      g.addColorStop(1, 'rgba(122,70,38,0)');
      c.fillStyle = g;
      c.fillRect(x - 5, 0, 10 + R() * 6, 460);
    }
    c.fillStyle = '#7d7a72';
    c.beginPath();
    c.moveTo(w, h - 300);
    c.lineTo(w - 230, h);
    c.lineTo(w, h);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.fillRect(0, h - 24, w, 24);
  });
}

/** Faded hand-painted wall sign: cream letters with an ochre shade, eroded by forty-odd winters. */
function ghostTexture(text) {
  const parts = String(text).split(/\s+—\s+/);
  const lines = [parts[0] || '', parts.slice(1).join(' — ')];
  const R = seeded(52);
  return canvasTexture(1600, 720, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const draw = (t, y, size, spacing) => {
      c.font = `700 ${size}px ${SERIF}`;
      if ('letterSpacing' in c) c.letterSpacing = `${spacing}px`;
      // Forty winters took the shade line; what is left of the cream is thin and chalky.
      c.fillStyle = 'rgba(236,226,200,0.46)';
      c.fillText(t, w / 2, y);
    };
    draw(lines[0], h * 0.36, 190, 6);
    draw(lines[1], h * 0.74, 104, 18);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    // A pinstripe border, mostly gone.
    c.strokeStyle = 'rgba(236,226,200,0.4)';
    c.lineWidth = 8;
    c.strokeRect(30, 30, w - 60, h - 60);
    // Erosion: knock holes and streaks out of the paint.
    c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 2600; i++) {
      c.fillStyle = `rgba(0,0,0,${0.3 + R() * 0.7})`;
      const r = 1 + R() * 7;
      c.beginPath();
      c.arc(R() * w, R() * h, r, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = 0; i < 14; i++) {
      const x = R() * w;
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(0,0,0,0.0)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0.2)');
      c.fillStyle = g;
      c.fillRect(x, 0, 6 + R() * 26, h);
    }
    // Patched render: whole patches gone where the wall was repaired.
    for (let i = 0; i < 5; i++) {
      const x = R() * w;
      const y = R() * h;
      c.fillStyle = 'rgba(0,0,0,0.9)';
      c.beginPath();
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        const r = 60 + R() * 110;
        c.lineTo(x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r * 0.7);
      }
      c.closePath();
      c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  });
}

/** Shop window: Gérard's kebab interior (the bakery has its own, scene2/bakery.js). */
function windowTexture() {
  return kebabWindowTexture();
}

// TEXT: Gérard's menu board (shop dressing, not story text)
const GERARD_MENU = [['KEBAB', '6,50'], ['ASSIETTE', '9,00'], ['FRITES', '3,00'], ['BOISSONS', '2,00']];

/**
 * CHEZ GÉRARD at night, through the glass: tiled back wall, a lit menu board, the doner on its spit in
 * front of the grill's glow, a drinks fridge, the counter; condensation fogging the lower glass,
 * droplets and a grimy film. The window plane is 3.2 x 1.86 m.
 */
function kebabWindowTexture() {
  const R = seeded(343);
  return canvasTexture(1024, 600, (c, w, h) => {
    // Back wall: white tiles gone cream under the fluorescent.
    c.fillStyle = '#cdc4ae';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(120,110,90,0.35)';
    c.lineWidth = 2;
    for (let y = 0; y < h; y += 34) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    for (let x = 0; x < w; x += 34) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, h);
      c.stroke();
    }
    const glow = c.createRadialGradient(w * 0.62, h * 0.35, 20, w * 0.62, h * 0.35, w * 0.6);
    glow.addColorStop(0, 'rgba(255,236,190,0.55)');
    glow.addColorStop(1, 'rgba(120,90,50,0.35)');
    c.fillStyle = glow;
    c.fillRect(0, 0, w, h);
    // The menu board: a dark lightbox with photos and prices.
    c.fillStyle = '#20201e';
    c.fillRect(40, 30, w - 80, 150);
    GERARD_MENU.forEach(([name, price], i) => {
      const x = 60 + i * ((w - 120) / 4);
      const bw = (w - 120) / 4 - 20;
      const ph = c.createLinearGradient(0, 44, 0, 120);
      ph.addColorStop(0, ['#c8823c', '#b06a3a', '#e0b050', '#7a8a9a'][i]);
      ph.addColorStop(1, '#5a3a22');
      c.fillStyle = ph;
      c.fillRect(x, 44, bw, 78);
      c.fillStyle = 'rgba(255,255,255,0.15)';
      c.beginPath();
      c.ellipse(x + bw / 2, 86, bw * 0.32, 22, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#f2ead6';
      c.font = `800 26px ${SANS}`;
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(name, x, 146);
      c.fillStyle = '#ffd36a';
      c.textAlign = 'right';
      c.fillText(price, x + bw, 146);
    });
    // The grill's glow and the doner on its spit.
    const gr = c.createLinearGradient(0, 200, 0, 470);
    gr.addColorStop(0, 'rgba(255,140,60,0.0)');
    gr.addColorStop(1, 'rgba(255,120,40,0.55)');
    c.fillStyle = gr;
    c.fillRect(620, 200, 150, 270);
    c.fillStyle = '#3a3a3c';
    c.fillRect(690, 190, 8, 300);
    const cone = c.createLinearGradient(640, 0, 750, 0);
    cone.addColorStop(0, '#5a3218');
    cone.addColorStop(0.45, '#a8683a');
    cone.addColorStop(1, '#4a2a14');
    c.fillStyle = cone;
    c.beginPath();
    c.moveTo(642, 220);
    c.lineTo(748, 220);
    c.lineTo(722, 450);
    c.lineTo(668, 450);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(40,20,10,0.4)';
    c.lineWidth = 3;
    for (let y = 236; y < 450; y += 16) {
      c.beginPath();
      c.moveTo(650 + (y - 220) * 0.1, y);
      c.lineTo(740 - (y - 220) * 0.1, y + 4);
      c.stroke();
    }
    // Drinks fridge on the left: a cold rectangle of cans.
    c.fillStyle = '#cfe0e8';
    c.fillRect(70, 210, 190, 260);
    for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 7; k++) {
        c.fillStyle = ['#b83a32', '#2f5f9a', '#e0c040', '#3a8a4a', '#d8d8d8'][(r * 7 + k) % 5];
        c.fillRect(80 + k * 25, 222 + r * 62, 18, 40);
      }
      c.fillStyle = 'rgba(80,90,100,0.6)';
      c.fillRect(70, 266 + r * 62, 190, 4);
    }
    c.strokeStyle = '#8a9298';
    c.lineWidth = 6;
    c.strokeRect(70, 210, 190, 260);
    // The counter: steel front, a glass sneeze guard with trays of salad.
    c.fillStyle = '#8c8f90';
    c.fillRect(0, 470, w, 130);
    c.fillStyle = 'rgba(255,255,255,0.18)';
    for (let x = 0; x < w; x += 46) c.fillRect(x, 470, 3, 130);
    for (let k = 0; k < 6; k++) {
      c.fillStyle = ['#7a9a4a', '#c84a3a', '#e8e0c8', '#d8a040', '#6a8a3a', '#e8d8b0'][k];
      c.fillRect(300 + k * 52, 446, 44, 22);
    }
    c.fillStyle = 'rgba(220,235,240,0.25)';
    c.fillRect(290, 380, 330, 70);
    // A figure behind the counter (Gérard, mid-shift), soft.
    c.fillStyle = 'rgba(40,34,30,0.55)';
    c.beginPath();
    c.ellipse(860, 300, 38, 44, 0, 0, Math.PI * 2);
    c.fill();
    c.fillRect(800, 340, 120, 140);
    // Condensation on the lower glass, droplets, a wiped arc, grime film.
    const fog = c.createLinearGradient(0, h * 0.45, 0, h);
    fog.addColorStop(0, 'rgba(230,226,216,0)');
    fog.addColorStop(1, 'rgba(230,226,216,0.6)');
    c.fillStyle = fog;
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'destination-out';
    c.lineWidth = 46;
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.arc(420, 620, 200, Math.PI * 1.15, Math.PI * 1.75);
    c.stroke();
    c.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 240; i++) {
      const x = R() * w;
      const y = h * 0.35 + R() * h * 0.65;
      const r = 1 + R() * 3.5;
      c.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.3})`;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
      if (R() < 0.12) {
        c.fillStyle = 'rgba(255,255,255,0.18)';
        c.fillRect(x - 1, y, 2, 20 + R() * 60);
      }
    }
    // A grimy film and one diagonal sheen of the street reflected in the glass.
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `rgba(70,64,52,${0.03 + R() * 0.04})`;
      c.beginPath();
      c.ellipse(R() * w, R() * h, 20 + R() * 60, 10 + R() * 30, R() * 3, 0, Math.PI * 2);
      c.fill();
    }
    const sheen = c.createLinearGradient(0, 0, w, h);
    sheen.addColorStop(0.3, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.42, 'rgba(255,255,255,0.12)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    c.fillStyle = sheen;
    c.fillRect(0, 0, w, h);
    // Depth: the room falls off into shadow at the edges and under the ceiling.
    const v = c.createRadialGradient(w * 0.55, h * 0.5, h * 0.3, w * 0.55, h * 0.5, w * 0.7);
    v.addColorStop(0, 'rgba(20,14,8,0)');
    v.addColorStop(1, 'rgba(20,14,8,0.55)');
    c.fillStyle = v;
    c.fillRect(0, 0, w, h);
  });
}

/** Neon text on a transparent background (soft glow baked in). */
function neonTexture(text) {
  return canvasTexture(640, 200, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.font = `italic 800 112px ${SANS}`;
    const fit = Math.min(112, Math.floor((112 * (w - 70)) / c.measureText(text).width)); // 'CHEZ GÉRARD' fits too
    c.font = `italic 800 ${fit}px ${SANS}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = 'rgba(255,61,110,0.95)';
    c.shadowBlur = 28;
    c.strokeStyle = '#ff6d92';
    c.lineWidth = 9;
    c.strokeText(text, w / 2, h / 2 + 4);
    c.shadowBlur = 8;
    c.strokeStyle = '#ffd6e2';
    c.lineWidth = 3;
    c.strokeText(text, w / 2, h / 2 + 4);
  });
}

/** Hugo's lit window: warm lamp glow, a curtain half drawn. */
function litWindowTexture() {
  return canvasTexture(128, 160, (c, w, h) => {
    const g = c.createRadialGradient(w * 0.62, h * 0.6, 4, w * 0.62, h * 0.6, h * 0.8);
    g.addColorStop(0, '#fff0cc');
    g.addColorStop(0.5, '#e8b56e');
    g.addColorStop(1, '#8a5a2e');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(70,46,30,0.75)';
    c.fillRect(0, 0, w * 0.34, h);
    c.fillStyle = 'rgba(40,30,22,0.9)';
    c.fillRect(w / 2 - 2, 0, 4, h);
    c.fillRect(0, h * 0.45, w, 4);
  });
}

/**
 * The fascia board above the garage door. Odile letters it: "RÉPARATI" -> "RÉPARATIONS.".
 * The prefix is drawn where it sits in the finished, centred word, so letters never shift.
 */
function fasciaBoard(full, start, w, h) {
  const W = 1024;
  const H = Math.round((W * h) / w);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const base = document.createElement('canvas');
  base.width = W;
  base.height = H;
  {
    const b = base.getContext('2d');
    b.fillStyle = '#2c3530';
    b.fillRect(0, 0, W, H);
    const R = seeded(1414);
    for (let i = 0; i < 60; i++) {
      b.fillStyle = `rgba(${R() < 0.5 ? '15,12,10' : '120,110,90'},${0.04 + R() * 0.08})`;
      b.beginPath();
      b.arc(R() * W, R() * H, 6 + R() * 40, 0, Math.PI * 2);
      b.fill();
    }
    b.strokeStyle = 'rgba(214,196,150,0.75)';
    b.lineWidth = 4;
    b.strokeRect(14, 12, W - 28, H - 24);
  }
  let fs = H * 0.62;
  const setFont = () => (g.font = `700 ${fs}px ${SERIF}`);
  setFont();
  if ('letterSpacing' in g) g.letterSpacing = '6px';
  while (fs > 10 && g.measureText(full).width > W * 0.88) {
    fs *= 0.94;
    setFont();
  }
  const x0 = (W - g.measureText(full).width) / 2;
  const startN = full.startsWith(start) ? start.length : 0;
  let shown = -1;
  const draw = (n) => {
    n = Math.max(0, Math.min(full.length, Math.round(n)));
    if (n === shown) return false;
    shown = n;
    g.clearRect(0, 0, W, H);
    g.drawImage(base, 0, 0);
    setFont();
    if ('letterSpacing' in g) g.letterSpacing = '6px';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    const text = startN || n >= full.length ? full.slice(0, n) : start;
    g.fillStyle = 'rgba(150,110,40,0.9)'; // shade
    g.fillText(text, x0 + 4, H / 2 + 6);
    g.fillStyle = '#ece0bf';
    g.fillText(text, x0, H / 2 + 2);
    tex.needsUpdate = true;
    return true;
  };
  return { tex, draw, startN: startN || start.length, fullN: full.length, get shown() { return shown; } };
}

// ------------------------------------------------------------------ mural panels (wall variant)

const PANEL_FALLBACK = [
  { id: 'benali', color: '#e8c27a' },
  { id: 'ines', color: '#c24a6a' },
  { id: 'sami', color: '#c24a3a' },
  { id: 'odile', color: '#9a7a4e' },
  { id: 'marco', color: '#d98a3a' }, // Gérard (the panel ids are the text's keys)
];

/**
 * One neighbour's panel, drawn in light greys on a transparent background so the material colour
 * (grey -> the panel's own colour) tints the motif. A pale primer wash shows the panel's edges.
 */
function panelTexture(id, seed) {
  const W = 576;
  const H = 400;
  const R = seeded(seed);
  return canvasTexture(W, H, (c) => {
    c.clearRect(0, 0, W, H);
    // Wash: a ragged, brushed rectangle.
    c.fillStyle = 'rgba(255,255,255,0.42)';
    c.beginPath();
    c.moveTo(10 + R() * 8, 10 + R() * 8);
    for (let k = 1; k <= 8; k++) c.lineTo((k / 8) * (W - 20) + 10, 6 + R() * 10);
    for (let k = 1; k <= 6; k++) c.lineTo(W - 6 - R() * 10, (k / 6) * (H - 20) + 10);
    for (let k = 7; k >= 0; k--) c.lineTo((k / 8) * (W - 20) + 10, H - 6 - R() * 10);
    for (let k = 5; k >= 1; k--) c.lineTo(6 + R() * 10, (k / 6) * (H - 20) + 10);
    c.closePath();
    c.fill();
    const ink = 'rgba(46,44,42,0.92)';
    const paint = '#f4f2ee';
    const half = '#c9c6c0';
    c.lineJoin = c.lineCap = 'round';
    if (id === 'benali') {
      // The croissant that came out a moon.
      const L = document.createElement('canvas');
      L.width = W;
      L.height = H;
      const m = L.getContext('2d');
      m.fillStyle = paint;
      m.beginPath();
      m.arc(W * 0.46, H * 0.52, 150, 0, Math.PI * 2);
      m.fill();
      m.globalCompositeOperation = 'destination-out';
      m.beginPath();
      m.arc(W * 0.58, H * 0.42, 128, 0, Math.PI * 2);
      m.fill();
      m.globalCompositeOperation = 'source-over';
      m.strokeStyle = 'rgba(46,44,42,0.5)';
      m.lineWidth = 6;
      for (let i = 0; i < 4; i++) {
        m.beginPath();
        m.arc(W * 0.46, H * 0.52, 150, Math.PI * (0.62 + i * 0.12), Math.PI * (0.66 + i * 0.12));
        m.lineTo(W * 0.46 + Math.cos(Math.PI * (0.64 + i * 0.12)) * 110, H * 0.52 + Math.sin(Math.PI * (0.64 + i * 0.12)) * 110);
        m.stroke();
      }
      c.drawImage(L, 0, 0);
      c.fillStyle = half;
      for (const [x, y, r] of [[420, 90, 14], [470, 170, 9], [380, 300, 11], [120, 80, 8]]) {
        c.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          const rr = k % 2 ? r * 0.45 : r;
          c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        c.closePath();
        c.fill();
      }
    } else if (id === 'ines') {
      c.font = `italic 900 104px ${SANS}`; // the whole street name fits the panel
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 22;
      c.strokeStyle = ink;
      c.save();
      c.translate(W / 2, H * 0.47);
      c.rotate(-0.08);
      c.strokeText('TANNEURS', 0, 0);
      c.fillStyle = paint;
      c.fillText('TANNEURS', 0, 0);
      c.fillStyle = half;
      c.fillRect(-250, 40, 500, 10);
      c.restore();
      c.fillStyle = paint;
      for (let i = 0; i < 7; i++) c.fillRect(70 + i * 66 + R() * 20, H * 0.6, 6, 30 + R() * 60); // drips
    } else if (id === 'sami') {
      c.strokeStyle = ink;
      c.lineWidth = 16;
      const wheel = (x) => {
        c.beginPath();
        c.arc(x, H * 0.62, 88, 0, Math.PI * 2);
        c.stroke();
      };
      wheel(W * 0.27);
      wheel(W * 0.73);
      c.strokeStyle = paint;
      c.lineWidth = 18;
      c.beginPath();
      c.moveTo(W * 0.27, H * 0.62);
      c.lineTo(W * 0.45, H * 0.36);
      c.lineTo(W * 0.66, H * 0.36);
      c.lineTo(W * 0.73, H * 0.62);
      c.moveTo(W * 0.27, H * 0.62);
      c.lineTo(W * 0.5, H * 0.62);
      c.lineTo(W * 0.45, H * 0.36);
      c.moveTo(W * 0.5, H * 0.62);
      c.lineTo(W * 0.66, H * 0.36);
      c.moveTo(W * 0.45, H * 0.36);
      c.lineTo(W * 0.43, H * 0.27);
      c.moveTo(W * 0.66, H * 0.36);
      c.lineTo(W * 0.68, H * 0.22);
      c.stroke();
      c.lineWidth = 14;
      c.beginPath();
      c.moveTo(W * 0.38, H * 0.26);
      c.lineTo(W * 0.48, H * 0.26);
      c.moveTo(W * 0.64, H * 0.22);
      c.lineTo(W * 0.74, H * 0.24);
      c.stroke();
    } else if (id === 'odile') {
      // An open hand holding a long-haired lettering brush.
      c.fillStyle = paint;
      c.strokeStyle = ink;
      c.lineWidth = 8;
      c.beginPath();
      c.ellipse(W * 0.42, H * 0.62, 92, 110, 0.2, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      const fingers = [[-0.62, 112], [-0.25, 140], [0.08, 146], [0.42, 128]];
      for (const [a, len] of fingers) {
        c.save();
        c.translate(W * 0.42 + Math.sin(a) * 70, H * 0.62 - Math.cos(a) * 80);
        c.rotate(a);
        c.beginPath();
        c.roundRect ? c.roundRect(-20, -len, 40, len, 20) : c.rect(-20, -len, 40, len);
        c.fill();
        c.stroke();
        c.restore();
      }
      c.save();
      c.translate(W * 0.42 - 84, H * 0.62 + 10);
      c.rotate(-1.1);
      c.beginPath();
      c.roundRect ? c.roundRect(-18, -60, 36, 90, 18) : c.rect(-18, -60, 36, 90);
      c.fill();
      c.stroke();
      c.restore();
      c.strokeStyle = half;
      c.lineWidth = 10;
      c.beginPath();
      c.moveTo(W * 0.3, H * 0.92);
      c.lineTo(W * 0.86, H * 0.12);
      c.stroke();
      c.fillStyle = ink;
      c.beginPath();
      c.moveTo(W * 0.86, H * 0.12);
      c.lineTo(W * 0.93, H * 0.02);
      c.lineTo(W * 0.89, H * 0.13);
      c.closePath();
      c.fill();
    } else if (id === 'marco') {
      // The great kebab: a doner cone on its spit, and a pitta.
      c.fillStyle = paint;
      c.strokeStyle = ink;
      c.lineWidth = 9;
      c.beginPath();
      c.moveTo(W * 0.24, H * 0.14);
      c.lineTo(W * 0.48, H * 0.14);
      c.lineTo(W * 0.42, H * 0.86);
      c.lineTo(W * 0.3, H * 0.86);
      c.closePath();
      c.fill();
      c.stroke();
      c.strokeStyle = 'rgba(46,44,42,0.45)';
      c.lineWidth = 5;
      for (let i = 1; i < 9; i++) {
        const y = H * (0.14 + i * 0.08);
        const k = (y - H * 0.14) / (H * 0.72);
        c.beginPath();
        c.moveTo(W * (0.24 + 0.06 * k), y);
        c.lineTo(W * (0.48 - 0.06 * k), y + 6);
        c.stroke();
      }
      c.strokeStyle = ink;
      c.lineWidth = 8;
      c.beginPath();
      c.moveTo(W * 0.36, H * 0.04);
      c.lineTo(W * 0.36, H * 0.96);
      c.stroke();
      c.fillStyle = half;
      c.beginPath();
      c.ellipse(W * 0.72, H * 0.58, 110, 70, -0.3, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = paint;
      c.beginPath();
      c.ellipse(W * 0.72, H * 0.5, 86, 30, -0.3, 0, Math.PI * 2);
      c.fill();
    } else {
      c.fillStyle = paint;
      for (let i = 0; i < 6; i++) {
        c.beginPath();
        c.arc(80 + R() * (W - 160), 80 + R() * (H - 160), 30 + R() * 50, 0, Math.PI * 2);
        c.fill();
      }
    }
    paintOnRender(c, W, H, R);
  });
}

/**
 * Make a crisp canvas motif read as paint brushed onto render: drips run down from the bottom of
 * painted shapes, every edge is dry-brushed (alpha eroded by a noise streaked along the stroke),
 * and the solid fills thin out in places so the wall shows through. The wall's own render relief
 * comes from Materials.enhance on the panel material.
 */
function paintOnRender(c, W, H, R) {
  // Drips: from the lowest painted pixel of a few columns, in that pixel's colour.
  const src = c.getImageData(0, 0, W, H).data;
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(30 + R() * (W - 60));
    let y = H - 1;
    while (y > 0 && src[(y * W + x) * 4 + 3] < 200) y--;
    if (y < H * 0.2 || y > H - 12) continue;
    const k = (y * W + x) * 4;
    c.strokeStyle = `rgba(${src[k]},${src[k + 1]},${src[k + 2]},0.85)`;
    c.lineCap = 'round';
    c.lineWidth = 2 + R() * 3;
    const len = 14 + R() * 50;
    c.beginPath();
    c.moveTo(x, y - 2);
    c.lineTo(x + (R() - 0.5) * 2, Math.min(H - 4, y + len));
    c.stroke();
  }
  const img = c.getImageData(0, 0, W, H);
  const d = img.data;
  // Value noise, stretched along x (the brush runs horizontally across the panel).
  const G = 64;
  const grid = new Float32Array(G * G).map(() => R());
  const at = (gx, gy) => grid[((gy % G) + G) % G * G + (((gx % G) + G) % G)];
  const noise = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
    const b2 = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
    return a + (b2 - a) * sy;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 4 + 3;
      const a = d[k] / 255;
      if (a <= 0) continue;
      const n = noise(x / 9, y / 2.2) * 0.65 + noise(x / 2.5, y / 1.2) * 0.35;
      // The primer wash only breathes a little; motif edges go ragged; solids thin out in places.
      let edge;
      if (a < 0.6) edge = a * (0.8 + 0.4 * n);
      else if (a < 0.98) edge = (a - 0.5 + (n - 0.5) * 0.9) * 2.4 + 0.5;
      else edge = 1 - (0.3 * Math.max(0, n - 0.66)) / 0.34;
      d[k] = Math.round(255 * Math.min(1, Math.max(0, Math.min(a, edge))));
    }
  }
  c.putImageData(img, 0, 0);
}

// ------------------------------------------------------------------ geometry helpers

/** Shape with a U-notch (the garage opening) at the bottom, UVs in 0..1 over the whole face. */
function notchedFacade(W, H, x0, x1, hh) {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0);
  s.lineTo(x0, 0);
  s.lineTo(x0, hh);
  s.lineTo(x1, hh);
  s.lineTo(x1, 0);
  s.lineTo(W / 2, 0);
  s.lineTo(W / 2, H);
  s.lineTo(-W / 2, H);
  s.closePath();
  const geo = new THREE.ShapeGeometry(s);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + W / 2) / W, pos.getY(i) / H);
  uv.needsUpdate = true;
  return geo;
}

// ------------------------------------------------------------------ helpers

/** Place a mesh in a facade-local frame: parent (Matrix4) x local [x, y, z] (+ optional rotY). */
function placeOn(mesh, parent, local, rotY = 0) {
  const m = compose({ pos: local, rotY }).premultiply(parent);
  m.decompose(mesh.position, mesh.quaternion, mesh.scale);
  return mesh;
}

/** Fly-posters and tags: quads into the 'poster' batch, layered a few millimetres apart. */
function posterWall(batch, cells, { side, z0, z1, y0 = 0.5, y1 = 2.5, count, seed, tags = 0, plane = FRONT_X, base = 0.01 }) {
  const R = seeded(seed);
  const posters = cells.filter((c) => c.kind === 'poster');
  const tagCells = cells.filter((c) => c.kind === 'tag');
  let layer = 0;
  const put = (cell, w, h, z, y, rot) => {
    const g = atlasPlane(w, h, cell.uv).rotateZ(rot);
    const parent = compose({ pos: [side * (plane - base - layer * 0.0025), y, z], rotY: side < 0 ? Math.PI / 2 : -Math.PI / 2 });
    batch.add('poster', g, { parent });
    layer++;
  };
  for (let i = 0; i < count; i++) {
    const s = 0.62 + R() * 0.55;
    // Pasted in loose rows (fly-posting crews work along a line), some on top of each other.
    const row = R() < 0.65 ? 0 : 1;
    const y = Math.min(y1 - s * 0.5, y0 + s * 0.5 + row * (s * 0.92) + (R() - 0.5) * 0.12);
    put(posters[(R() * posters.length) | 0], s, s, z0 - R() * (z0 - z1), y, (R() - 0.5) * 0.05);
  }
  for (let i = 0; i < tags; i++) {
    const s = 1.1 + R() * 0.9;
    put(tagCells[(R() * tagCells.length) | 0], s, s, z0 - R() * (z0 - z1), 0.7 + R() * 1.4, (R() - 0.5) * 0.15);
  }
}

// ------------------------------------------------------------------ builder

/**
 * @param ctx  the game ctx
 * @param opts { variant: 'evening' (Ch2) | 'wall' (Ch5 / R4 Ch7) | 'day' | 'night' (R4 Ch5, Ch6),
 *               text: { encre, encreTrade, durandPhoto, durandTin } (R4 dressing; see R4_TEXT) }
 */
export async function buildScene2(ctx, { variant = 'evening', text = {} } = {}) {
  const { assets } = ctx;
  const T = ctx.L.ch2;
  const S5 = ctx.L.ch7?.signs || {};
  const V = VARIANTS.includes(variant) ? variant : 'evening';
  const evening = V === 'evening'; // Ch2 only: Odile's tower, the club, the rain, the half-lettered fascia
  const wallV = V === 'wall';
  const day = V === 'day';
  const night = V === 'night';
  const dark = evening || night; // street lamps lit, night glass and sky
  const r4 = day || night; // the hub variants: the fixes, the bakery shutter, the Durand room
  const TX = { ...R4_TEXT, ...(T.signs || {}), ...text };
  const group = new THREE.Group();
  group.name = `scene2-${V}`;
  const rng = seeded(1414);
  const prop = (path, opts) => assets.prop(path, opts);
  const env = skyEnv(!dark);
  const haloTex = radialTexture();
  const posters = posterAtlas(31);
  const M = streetMaterials(ctx, { evening: dark, env, windowTex: windowAtlas(), decalTex: null, posterTex: posters.texture, weather: WEATHER[V] || null });
  const batch = new Batch();
  const street = buildStreet(ctx, batch);
  M.decal.material.map = street.texture;
  for (const [k, v] of Object.entries(M)) batch.material(k, v.material, v.opts);
  const signs = {};

  // ---------------------------------------------------------------- ground
  for (const g of street.geos) batch.add('decal', g);

  // ---------------------------------------------------------------- facades
  const shopSigns = [];
  // ENCRE FINE is a room in every variant; CYCLES DURAND opens in the R4 ones (scene2/rooms.js).
  const hollow = new Set(['encre', ...(r4 ? ['durand'] : [])]);
  for (const b of BUILDINGS) addBuilding(batch, b, { evening: dark, rng, litCells: LIT_CELLS, shopSigns, lights: !night, hollow });
  for (const s of shopSigns) {
    const m = sign(s.text, s.w, 0.42, { bg: null, fg: '#cfc4a8', font: SERIF, weathered: 0.6, letterSpacing: 5, pxPerM: 200 });
    placeOn(m, s.parent, [s.pos[0], s.pos[1], s.pos[2] + 0.005]);
    m.material.polygonOffset = true;
    m.material.polygonOffsetFactor = -1;
    m.userData.noOcclude = true;
    group.add(m);
  }

  // Blue enamel street-name plaques on the corners either side of the bakery / ghost-sign blocks.
  for (const [side, z] of [[-1, -4.55], [1, -5.15], [-1, 13.0]]) {
    const plaque = sign(STREET_NAME, 0.72, 0.36, { bg: '#2a4a74', fg: '#eeeae0', border: '#eeeae0', weathered: 0.35, pxPerM: 360, weight: 600 });
    group.add(placeOn(plaque, facadeFrame(side, z, 3.05), [0, 0, 0.012]));
  }

  // Dim skyline behind the rows (Kenney low-detail blocks, restyled; mostly swallowed by the fog).
  const skyline = [];
  for (let i = 0; i < 7; i++) {
    for (const side of [-1, 1]) {
      skyline.push({ k: 'abcd'[(i + (side > 0 ? 2 : 0)) % 4], x: side * (20 + rng() * 6), z: 10 - i * 9 - rng() * 4, H: 17 + rng() * 9, r: rng() * Math.PI });
    }
  }
  const skylineProps = await Promise.all(skyline.map((s) => prop(`kenney/city/low-detail-building-${s.k}.glb`, { height: s.H, castShadow: false, tint: 0x9a9ea4 })));
  skylineProps.forEach((g, i) => {
    g.position.set(skyline[i].x, 0, skyline[i].z);
    g.rotation.y = skyline[i].r;
    noOcclude(g);
    group.add(g);
  });

  // ---------------------------------------------------------------- the blind wall
  const wallLen = WALL.z0 - WALL.z1; // 20
  const WT = { w: 2048, h: Math.round((2048 * WALL.h) / wallLen) };
  const wallTex = !wallV
    ? grimeTexture({ w: WT.w, h: WT.h, base: '#9a9486', spread: 0.05, seed: 7, posters: 0, tags: 3, stains: 16, drips: 14 })
    : grimeTexture({ w: WT.w, h: WT.h, base: '#c6bfad', spread: 0.06, seed: 21, posters: 0, tags: 0, stains: 7, drips: 6, damp: '#6b6a5a' });
  {
    // Canvas mapping for the +X face: canvas left = +Z end (z -12), top = wall top.
    const c = wallTex.userData.canvas.getContext('2d');
    const U = (z) => ((WALL.z0 - z) / wallLen) * WT.w;
    const V = (y) => (1 - y / WALL.h) * WT.h;
    // Rust streaks under the two downpipe brackets.
    for (const z of [-12.4, -31.6]) {
      const g = c.createLinearGradient(0, 0, 0, WT.h);
      g.addColorStop(0, 'rgba(122,70,38,0.55)');
      g.addColorStop(1, 'rgba(122,70,38,0.08)');
      c.fillStyle = g;
      c.fillRect(U(z) - 26, 0, 52, WT.h);
    }
    if (!wallV) {
      // Paste ghosts: pale rectangles where older posters were scraped off, glue tide marks.
      const R = seeded(71);
      for (let i = 0; i < 26; i++) {
        const x = R() * WT.w;
        const y = V(0.5 + R() * 2.4);
        const w = 50 + R() * 70;
        c.fillStyle = `rgba(214,206,186,${0.12 + R() * 0.18})`;
        c.fillRect(x, y - w * 1.3, w, w * 1.3);
        c.strokeStyle = 'rgba(60,52,40,0.18)';
        c.lineWidth = 2;
        c.strokeRect(x, y - w * 1.3, w, w * 1.3);
      }
      // Rain darkening under the coping and the billboard's lower edge.
      for (const [y, a] of [[WALL.h, 0.4], [BILLBOARD.y0, 0.35]]) {
        const g = c.createLinearGradient(0, V(y), 0, V(y) + 160);
        g.addColorStop(0, `rgba(30,30,26,${a})`);
        g.addColorStop(1, 'rgba(30,30,26,0)');
        c.fillStyle = g;
        c.fillRect(0, V(y), WT.w, 160);
      }
    } else {
      // Old tags ghosting through the primer.
      const R = seeded(88);
      c.globalAlpha = 0.12;
      c.strokeStyle = '#3a3a40';
      c.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        c.lineWidth = 10 + R() * 10;
        c.beginPath();
        let x = R() * WT.w;
        let y = V(0.6 + R() * 4);
        c.moveTo(x, y);
        for (let k = 0; k < 6; k++) c.quadraticCurveTo(x + 30, y - 60, (x += 50 + R() * 40), (y += (R() - 0.5) * 70));
        c.stroke();
      }
      c.globalAlpha = 1;
      // Where the billboard was: a paler, cleaner rectangle, bolt holes and their rust tears.
      const bx0 = U(BILLBOARD.z + BILLBOARD.w / 2);
      const bx1 = U(BILLBOARD.z - BILLBOARD.w / 2);
      const by0 = V(BILLBOARD.y0 + BILLBOARD.h);
      const by1 = V(BILLBOARD.y0);
      c.fillStyle = 'rgba(232,226,212,0.75)';
      c.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
      c.strokeStyle = 'rgba(80,70,56,0.25)';
      c.lineWidth = 3;
      c.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
      for (let i = 0; i < 6; i++) {
        for (const yy of [by0 + 18, by1 - 18]) {
          const x = bx0 + 24 + (i * (bx1 - bx0 - 48)) / 5;
          const g = c.createLinearGradient(0, yy, 0, yy + 120);
          g.addColorStop(0, 'rgba(122,70,38,0.6)');
          g.addColorStop(1, 'rgba(122,70,38,0)');
          c.fillStyle = g;
          c.fillRect(x - 3, yy, 6, 120);
          c.fillStyle = '#1e1a16';
          c.beginPath();
          c.arc(x, yy, 6, 0, Math.PI * 2);
          c.fill();
        }
      }
      // Odile's chalk guide: one long faint line at shoulder height, end to end (the brush covers it).
      c.strokeStyle = 'rgba(245,242,232,0.35)';
      c.lineWidth = 3;
      c.setLineDash([22, 10]);
      c.beginPath();
      c.moveTo(0, V(1.55));
      c.lineTo(WT.w, V(1.55));
      c.stroke();
      c.setLineDash([]);
    }
    wallTex.needsUpdate = true;
  }
  {
    const depth = 7;
    const geo = new THREE.BoxGeometry(depth, WALL.h, wallLen).translate(0, WALL.h / 2, 0);
    const face = mat('#ffffff', { map: wallTex, roughness: 0.92, surface: 'mural.wall' });
    const side = M.brick.material;
    const wall = new THREE.Mesh(geo, [face, side, side, side, side, side]); // +X face = the street
    wall.position.set(WALL.x - depth / 2, 0, (WALL.z0 + WALL.z1) / 2);
    wall.castShadow = true;
    wall.receiveShadow = true;
    wall.name = 'blind-wall';
    group.add(wall);
    // Coping, a plinth course, two downpipes with brackets and shoes.
    batch.add('trim', boxGeo(0.5, 0.18, wallLen + 0.3), { pos: [WALL.x - 0.15, WALL.h, (WALL.z0 + WALL.z1) / 2] });
    batch.add('trim', boxGeo(0.08, 0.35, wallLen), { pos: [WALL.x, 0, (WALL.z0 + WALL.z1) / 2] });
    for (const z of [-12.4, -31.6]) {
      batch.add('pipe', cyl(0.055, 0.055, WALL.h - 0.25, 10), { pos: [WALL.x + 0.1, 0.12, z] });
      batch.add('pipe', cbox(0.22, 0.22, 0.22), { pos: [WALL.x + 0.12, WALL.h - 0.2, z] });
      for (let y = 1.4; y < WALL.h - 0.5; y += 2.1) batch.add('iron', cbox(0.16, 0.05, 0.14), { pos: [WALL.x + 0.06, y, z] });
    }
    // Fly-posters (until the wall is primed): the wheat-paste wall at street level, a few tags over them.
    if (!wallV) {
      posterWall(batch, posters.cells, { side: -1, z0: -12.6, z1: -16.4, count: 9, seed: 5, tags: 1 });
      posterWall(batch, posters.cells, { side: -1, z0: -19.5, z1: -25.8, count: 15, seed: 6, tags: 2 });
      posterWall(batch, posters.cells, { side: -1, z0: -27.4, z1: -31.4, count: 7, seed: 9, tags: 2 });
    }
  }

  // ---------------------------------------------------------------- shopfronts
  // Bakery (Benali): shutter down at night, open by day. The R4 variants give the shutter its own mesh
  // (scene2/fixes.js): it opens and closes, its rails get oiled, and at 4 a.m. the bakery is lit.
  let bakery = null;
  {
    const zc = (-5.7 + -11.95) / 2;
    const P = facadeFrame(-1, zc, 0);
    // (R4 Ch2: the evening shutter is its own mesh too, so the batched one is always rolled up.)
    addShopfront(batch, P, { w: 4.6, open: 1, glass: false, tint: '#b8b2a4', fasciaTint: '#5a4a3c' });
    const fascia = sign(T.signs.bakery, 4.9, 0.48, { bg: null, fg: '#e6d9bc', font: SERIF, weathered: 0.45, letterSpacing: 4 });
    fascia.material.polygonOffset = true;
    fascia.material.polygonOffsetFactor = -1;
    group.add(placeOn(fascia, P, [0, 3.36, 0.12]));
    signs.bakery = fascia;
    if (evening) {
      // R4 Ch2 (the CH1-4 agent): closing time. The shop is still lit and the shutter mostly up; Mme Benali
      // pulls it down in three screaming jerks as Hugo passes (ch2.js: bakery.setOpen(k, secs)).
      const win = bakeryWindow(4.5, 2.55, { depth: 1.2, tint: '#b39672' });
      group.add(placeOn(win, P, [0, 1.3, 0.02]));
      bakery = benaliShutter({ P, w: 4.6, M, haloTex, window: win });
      bakery.setOpen(0.78);
      group.add(bakery.group);
    } else {
      // A shop with depth behind the glass (interior mapping), under a reflective film like Gérard's.
      const win = bakeryWindow(4.5, 2.55, { depth: 1.2, tint: night ? '#3a3632' : '#9a9184' });
      group.add(placeOn(win, P, [0, 1.3, 0.02]));
      if (r4) {
        bakery = benaliShutter({ P, w: 4.6, M, haloTex, window: win });
        bakery.setOpen(day ? 1 : 0);
        bakery.setOiled(night);
        group.add(bakery.group);
      }
      const film = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 2.55), new THREE.MeshStandardMaterial({ color: '#000000', roughness: 0.05, metalness: 0, envMap: env, envMapIntensity: 1.3, transparent: true, opacity: 0.24, depthWrite: false }));
      film.renderOrder = 2;
      film.userData.noOcclude = true;
      group.add(placeOn(film, P, [0, 1.3, 0.035]));
    }
  }
  // CHEZ GÉRARD: lit window, a stall riser, a projecting neon blade sign, steam from the extractor.
  let neonMat = null;
  let neonLight = null;
  let gerardSpill = null;
  let wires = null;
  {
    const zc = (-32.05 + -36.35) / 2;
    const P = facadeFrame(-1, zc, 0);
    addShopfront(batch, P, { w: 3.3, open: night ? 0.45 : 1, glass: false, tint: '#a8a49a', fasciaTint: '#4a2e26' }); // closed at 3 a.m.: half down
    batch.add('trim', cbox(3.3, 0.6, 0.12), { parent: P, pos: [0, 0.3, 0.06] });
    batch.add('casement', cbox(3.3, 0.06, 0.06), { parent: P, pos: [0, 2.48, 0.04] });
    for (const x of [-0.55, 0.55]) batch.add('casement', cbox(0.05, 1.9, 0.05), { parent: P, pos: [x, 1.55, 0.04] });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.86), new THREE.MeshBasicMaterial({ map: windowTexture(), color: evening ? 0xb4a892 : night ? 0x2e2a26 : 0x8a857c }));
    group.add(placeOn(win, P, [0, 1.55, 0.012]));
    // The glass itself: a faint reflective film over the interior (catches the lamp and the street).
    const film = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.86), new THREE.MeshStandardMaterial({ color: '#000000', roughness: 0.04, metalness: 0, envMap: env, envMapIntensity: 1.4, transparent: true, opacity: 0.28, depthWrite: false }));
    film.renderOrder = 2;
    film.userData.noOcclude = true;
    group.add(placeOn(film, P, [0, 1.55, 0.03]));
    const fas = sign(GERARD_FASCIA, 3.4, 0.4, { bg: null, fg: '#e8d6b0', font: SANS, weight: 800, weathered: 0.4, letterSpacing: 6 });
    fas.material.polygonOffset = true;
    fas.material.polygonOffsetFactor = -1;
    group.add(placeOn(fas, P, [0, 3.36, 0.12]));
    // Extractor louvre above the fascia.
    batch.add('trim', cbox(0.5, 0.36, 0.14), { parent: facadeFrame(-1, -35.7, 4.55), pos: [0, 0, 0.07] });
    for (let k = 0; k < 4; k++) batch.add('casement', cbox(0.44, 0.03, 0.04), { parent: facadeFrame(-1, -35.7, 4.55), pos: [0, -0.12 + k * 0.08, 0.15], rot: [0.5, 0, 0] });
    // Blade sign at the +Z end of the shop, readable from up the street.
    const bladeZ = -32.5;
    batch.add('iron', cbox(1.4, 0.06, 0.06), { pos: [-FRONT_X + 0.7, 3.95, bladeZ] });
    batch.add('iron', rod([-FRONT_X + 0.02, 3.55, bladeZ], [-FRONT_X + 1.2, 3.95, bladeZ], 0.015));
    batch.add('casement', cbox(1.36, 0.46, 0.08), { pos: [-FRONT_X + 0.72, 3.25, bladeZ] });
    neonMat = new THREE.MeshBasicMaterial({ map: neonTexture(T.signs.kebab), transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    neonMat.color.setScalar(evening ? 1.6 : night ? 0.1 : 0.55);
    relangTexture(neonMat, () => neonTexture(T.signs.kebab));
    const neon =new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.42), neonMat);
    neon.position.set(-FRONT_X + 0.72, 3.48, bladeZ + 0.05);
    neon.renderOrder = 4;
    group.add(neon);
    const back = neon.clone();
    back.position.z = bladeZ - 0.05;
    back.rotation.y = Math.PI;
    group.add(back);
    neonLight = pointLight(NEON, evening ? 7 : 0, { pos: [-FRONT_X + 1.1, 3.1, bladeZ + 0.4], distance: 8 });
    if (night) neonLight.visible = false;
    neonLight.userData.noCone = true;
    group.add(neonLight);
    signs.kebab = neon;
    // Warm light from the window on the wet pavement (additive; fog-faded in update).
    gerardSpill = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 4.2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: haloTex, color: 0xffcf96, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    gerardSpill.position.set(-FRONT_X + 1.2, SIDEWALK_Y + 0.01, zc);
    gerardSpill.renderOrder = 4;
    gerardSpill.visible = !night;
    group.add(gerardSpill);
    // The neon's wiring (R4): a taped loop while it flickers, a neat new cable once rewired.
    if (r4) {
      wires = neonWires({ from: [-FRONT_X + 0.42, 3.03, bladeZ], to: [-FRONT_X + 0.03, 2.62, bladeZ + 0.12] }, M);
      group.add(wires.group);
    }
  }
  // The tube doorway (right, z -22.4): a porch with a canopy, a steel door, a fluorescent tube that buzzes and fails.
  let tubeMat = null;
  let tubeLight = null;
  {
    const zc = -22.4;
    const P = facadeFrame(1, zc - 0.6, 0);
    for (const x of [-0.85, 0.85]) batch.add('render', cbox(0.16, 2.85, 0.55), { parent: P, pos: [x, 1.425, 0.275] });
    batch.add('trim', cbox(1.95, 0.14, 0.7), { parent: P, pos: [0, 2.92, 0.33] });
    batch.add('roller', cbox(1.3, 2.4, 0.05), { parent: P, pos: [0, 1.2, 0.03], color: '#8e8c86' });
    batch.add('iron', cbox(0.04, 0.22, 0.05), { parent: P, pos: [0.45, 1.05, 0.08] });
    batch.add('trim', cbox(1.6, 0.08, 0.6), { parent: P, pos: [0, 0.04, 0.3] });
    batch.add('iron', cbox(1.25, 0.06, 0.12), { parent: P, pos: [0, 2.7, 0.3] });
    addWindow(batch, facadeFrame(1, zc + 1.25, 1.85), { w: 1.0, h: 1.6, grille: true });
    tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(TUBE).multiplyScalar(dark ? 2.2 : 0.7), toneMapped: false });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.15, 8).rotateZ(Math.PI / 2), tubeMat);
    group.add(placeOn(tube, P, [0, 2.63, 0.32]));
    if (dark) {
      tubeLight = pointLight(TUBE, 5, { pos: [0, 0, 0], distance: 6.5 });
      placeOn(tubeLight, P, [0, 2.3, 0.75]);
      tubeLight.userData.noCone = true;
      group.add(tubeLight);
    }
    if (!wallV) posterWall(batch, posters.cells, { side: 1, z0: zc + 2.0, z1: zc + 0.4, count: 3, seed: 61, y0: 0.6, y1: 3.0 });
  }
  // CYCLES DURAND: shutter down for good, a hand-written thank-you taped to it. In the R4 variants
  // (scene2/durand.js) the shutter covers only the window: the shop door beside it opens on the room,
  // and the card is either fallen on the pavement or pinned back up, straight.
  let durand = null;
  {
    const zc = (-31.3 + -36.7) / 2;
    const P = facadeFrame(1, zc, 0);
    const shopName = () => String(T.signs.shop).split(/\s+—\s+/);
    const name = shopName();
    if (!r4) addShopfront(batch, P, { w: 4.4, tint: '#a8998a', fasciaTint: DURAND_BLUE });
    const fascia = sign(name[0] || 'CYCLES DURAND', 4.4, 0.48, { bg: null, fg: '#d8d2c4', weathered: 0.7, letterSpacing: 6 });
    relabel(fascia, () => shopName()[0] || 'CYCLES DURAND');
    fascia.material.polygonOffset = true;
    fascia.material.polygonOffsetFactor = -1;
    group.add(placeOn(fascia, P, [0, 3.36, 0.12]));
    const note = sign(name.join('\n'), 0.8, 0.6, { bg: '#e6e0cf', fg: '#2b2a28', font: HANDWRITING, weight: 400, weathered: 0.3, pxPerM: 420, pad: 0.1 });
    relabel(note, () => shopName().join('\n'));
    if (r4) {
      durand = buildDurand(ctx, { batch, group, b: BUILDINGS.find((b) => b.id === 'durand'), M, env, note, fasciaTint: DURAND_BLUE, text: { photo: TX.durandPhoto, tin: TX.durandTin, shop: name[0] || 'CYCLES DURAND' } });
      durand.setPinned(false);
    } else {
      placeOn(note, P, [0.8, 1.55, 0.085]);
      note.rotateZ(0.04);
      group.add(note);
    }
    signs.shopNote = note;
    if (evening) posterWall(batch, posters.cells, { side: 1, z0: zc - 0.6, z1: zc - 2.0, count: 1, seed: 81, tags: 2, plane: FRONT_X - 0.075, base: 0.004 });
  }
  // ENCRE FINE (every variant; scene2/encre.js): crooked sign and Jo's ladder in Ch2, lettered from Ch5 on.
  const encre = await buildEncre(ctx, {
    batch,
    group,
    b: BUILDINGS.find((b) => b.id === 'encre'),
    M,
    env,
    haloTex,
    dark,
    crooked: evening,
    ladder: evening,
    lettered: !evening,
    text: { name: TX.encre, trade: TX.encreTrade },
  });
  signs.encre = encre.sign;
  if (night) encre.setLight(0.3); // 3 a.m.: Jo is on the bench; her lamps are on, the room is dim
  // The ghost sign, high on the gable brick.
  {
    const gm = new THREE.MeshStandardMaterial({ map: ghostTexture(T.signs.ghost), transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 });
    ctx.materials?.enhance?.(gm, 'facade_brick_painted', { albedo: 0.6, normalScale: 1 }); // the letters follow the brick
    const g = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.9), gm);
    g.rotation.y = -Math.PI / 2;
    g.position.set(FRONT_X - 0.02, 8.7, -10);
    g.renderOrder = 1;
    group.add(g);
    signs.ghost = g;
    posterWall(batch, posters.cells, { side: 1, z0: -7.0, z1: -11.8, count: 6, seed: 91, tags: 2 }); // still there in Ch5
  }
  // More paper on the row by the club's straight (both variants: it is the same street weeks later).
  posterWall(batch, posters.cells, { side: 1, z0: -14.3, z1: -15.6, count: 3, seed: 95 });

  // ---------------------------------------------------------------- the STRIDE billboard (until the mural)
  let bbMat = null;
  const bbBase = day ? 0.3 : 0.55;
  if (!wallV) {
    const bb = new THREE.Group();
    bb.name = 'billboard';
    const tex = strideTexture(T.signs.billboard);
    bbMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: bbBase, roughness: 0.6 });
    relangTexture(bbMat, () => strideTexture(T.signs.billboard), ['map', 'emissiveMap']);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(BILLBOARD.w, BILLBOARD.h), bbMat);
    face.rotation.y = Math.PI / 2;
    face.position.set(WALL.x + 0.2, BILLBOARD.y0 + BILLBOARD.h / 2, BILLBOARD.z);
    bb.add(face);
    // Steel frame, stand-off brackets, a service walkway with a rail, two gooseneck lamps.
    const zc = BILLBOARD.z;
    const top = BILLBOARD.y0 + BILLBOARD.h;
    batch.add('iron', boxGeo(0.12, 0.14, BILLBOARD.w + 0.3), { pos: [WALL.x + 0.14, top, zc] });
    batch.add('iron', boxGeo(0.12, 0.14, BILLBOARD.w + 0.3), { pos: [WALL.x + 0.14, BILLBOARD.y0 - 0.14, zc] });
    for (const dz of [-BILLBOARD.w / 2 - 0.08, BILLBOARD.w / 2 + 0.08]) batch.add('iron', boxGeo(0.12, BILLBOARD.h + 0.28, 0.12), { pos: [WALL.x + 0.14, BILLBOARD.y0 - 0.14, zc + dz] });
    for (let k = -2; k <= 2; k++) batch.add('iron', rod([WALL.x + 0.02, BILLBOARD.y0 - 1.6, zc + k * 1.7], [WALL.x + 0.78, BILLBOARD.y0 - 0.95, zc + k * 1.7], 0.025));
    batch.add('iron', boxGeo(0.7, 0.04, BILLBOARD.w), { pos: [WALL.x + 0.45, BILLBOARD.y0 - 0.95, zc] });
    batch.add('iron', boxGeo(0.04, 0.04, BILLBOARD.w), { pos: [WALL.x + 0.78, BILLBOARD.y0 - 0.02, zc] });
    for (let k = -4; k <= 4; k++) batch.add('iron', boxGeo(0.025, 0.95, 0.025), { pos: [WALL.x + 0.78, BILLBOARD.y0 - 0.95, zc + k * (BILLBOARD.w / 8.2)] });
    for (const dz of [-2, 2]) {
      batch.add('iron', tubeGeo([[WALL.x + 0.15, top + 0.07, zc + dz], [WALL.x + 0.6, top + 0.45, zc + dz], [WALL.x + 1.05, top + 0.3, zc + dz]], 0.02, 12, 5));
      batch.add('iron', new THREE.CylinderGeometry(0.05, 0.16, 0.18, 10, 1, true).rotateZ(-0.7), { pos: [WALL.x + 1.08, top + 0.24, zc + dz] });
      batch.add('lampGlass', new THREE.CircleGeometry(0.13, 10).rotateX(Math.PI / 2).rotateZ(-0.7), { pos: [WALL.x + 1.04, top + 0.18, zc + dz], color: new THREE.Color(0xfff1d8).multiplyScalar(day ? 1.1 : 3.2) });
    }
    group.add(bb);
    signs.billboard = face;
  }

  // ---------------------------------------------------------------- the mural panels (wall)
  const panels = [];
  if (wallV) {
    const list = Array.isArray(S5.panels) && S5.panels.length ? S5.panels : PANEL_FALLBACK;
    const slot = wallLen / list.length;
    const GREY = new THREE.Color('#b9b5ad');
    list.forEach((p, i) => {
      const z0 = WALL.z0 - i * slot;
      const z1 = z0 - slot;
      const target = new THREE.Color(p.color || '#d9a441');
      const m = new THREE.MeshStandardMaterial({ map: panelTexture(p.id, 300 + i * 7), color: GREY.clone(), transparent: true, depthWrite: false, roughness: 0.88, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      // Paint on render: the wall's own relief and tone come through the motif.
      ctx.materials?.enhance?.(m, 'wall_mural_render', { albedo: 0.55, normalScale: 1.1, roughnessVar: 0.5 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(slot - PANEL.gap, PANEL.h), m);
      mesh.rotation.y = Math.PI / 2;
      mesh.position.set(WALL.x + 0.015, PANEL.y0 + PANEL.h / 2, (z0 + z1) / 2);
      mesh.renderOrder = 1;
      mesh.receiveShadow = true;
      mesh.name = `panel-${p.id}`;
      group.add(mesh);
      panels.push({
        id: p.id,
        mesh,
        z0,
        z1,
        color: p.color,
        k: 0,
        setColor(k) {
          this.k = clamp01(k);
          m.color.copy(GREY).lerp(target, this.k);
        },
      });
    });
  }

  // ---------------------------------------------------------------- No. 14 (closes the street)
  const fasciaW = 3.6;
  const fasciaH = 0.6;
  const fascia = fasciaBoard(T.signs.fascia, evening ? T.signs.fasciaStart : T.signs.fascia, fasciaW, fasciaH);
  {
    const GFH = 4.2;
    const lower = new THREE.Mesh(notchedFacade(FACADE.w, GFH, GARAGE.x0, GARAGE.x1, GARAGE.h), M.brickPlaster.material);
    lower.position.set(0, 0, DOOR_Z);
    const upper = new THREE.Mesh(new THREE.PlaneGeometry(FACADE.w, FACADE.h - GFH).translate(0, (FACADE.h + GFH) / 2, 0), M.render.material);
    upper.position.set(0, 0, DOOR_Z);
    for (const m of [lower, upper]) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.name = 'no14';
      group.add(m);
    }
    // Trims: plinth, string courses, cornice; parapet and a chimney stack against the sky.
    const zf = DOOR_Z;
    for (const [x0, x1] of [[-FACADE.w / 2, GARAGE.x0 - 0.16], [GARAGE.x1 + 0.16, FACADE.w / 2]]) batch.add('trim', boxGeo(x1 - x0, 0.45, 0.1), { pos: [(x0 + x1) / 2, 0, zf] });
    batch.add('trim', boxGeo(FACADE.w, 0.2, 0.18), { pos: [0, GFH - 0.1, zf] });
    for (const y of [7.25, 10.35]) batch.add('trim', boxGeo(FACADE.w, 0.12, 0.1), { pos: [0, y, zf] });
    batch.add('trim', boxGeo(FACADE.w, 0.24, 0.5), { pos: [0, FACADE.h - 0.5, zf] });
    batch.add('trim', boxGeo(FACADE.w, 0.5, 0.6), { pos: [0, FACADE.h, zf - 0.3] });
    batch.add('brick', boxGeo(1.2, 2.4, 0.9), { pos: [-7.5, FACADE.h, zf - 2] });
    batch.add('brick', boxGeo(0.9, 1.8, 0.7), { pos: [6.2, FACADE.h, zf - 2.4] });
    // Garage door jambs and lintel (steel).
    batch.add('iron', boxGeo(0.16, GARAGE.h + 0.16, 0.2), { pos: [GARAGE.x0 - 0.08, 0, zf + 0.05] });
    batch.add('iron', boxGeo(0.16, GARAGE.h + 0.16, 0.2), { pos: [GARAGE.x1 + 0.08, 0, zf + 0.05] });
    batch.add('iron', boxGeo(GARAGE.x1 - GARAGE.x0 + 0.32, 0.16, 0.2), { pos: [0, GARAGE.h, zf + 0.05] });
    // The fascia board in a moulded frame.
    const fm = new THREE.Mesh(new THREE.PlaneGeometry(fasciaW, fasciaH), new THREE.MeshStandardMaterial({ map: fascia.tex, roughness: 0.62 }));
    fm.position.set(0, 3.2, DOOR_Z + 0.06);
    group.add(fm);
    batch.add('door', cbox(fasciaW + 0.2, fasciaH + 0.16, 0.05), { pos: [0, 3.2, DOOR_Z + 0.025], color: '#3a4440' });
    fascia.mesh = fm;
    fascia.draw(evening ? fascia.startN : fascia.fullN);
    // The stairwell door and its enamel number.
    addDoor(batch, compose({ pos: [3.75, 0, DOOR_Z] }), { w: 1.1, h: 2.2, fan: 0.45, tint: '#5a4636', lit: evening ? { cell: LIT_CELLS[3], color: '#a08a68' } : null });
    const num = sign(T.signs.number, 0.42, 0.22, { bg: '#2d4a6e', fg: '#e8e4da', border: '#e8e4da', weathered: 0.3, pxPerM: 400 });
    relabel(num, () => T.signs.number);
    num.position.set(4.95, 1.85, DOOR_Z + 0.03); // clear of the door surround (x <= 4.5, 0.18 deep), seen from the left
    group.add(num);
    signs.number = num;
    // Windows: three upper floors. Hugo's (third floor, above the workshop) is lit.
    const cols = [-11.5, -8.3, -5.1, -1.3, 1.3, 5.1, 8.3, 11.5];
    const floorsY = [5.6, 8.7, 11.8];
    const HUGO = { x: 1.3, y: 11.8 };
    const R = seeded(1448);
    floorsY.forEach((y, fi) => {
      for (const x of cols) {
        const hugo = dark && x === HUGO.x && y === HUGO.y; // (night: the same layout, every window dark)
        const r = R();
        let lit = dark && !hugo && r < 0.12 ? { cell: LIT_CELLS[(R() * 4) | 0], color: new THREE.Color('#ffd7a0').multiplyScalar(0.8 + R() * 0.5) } : null;
        if (night) lit = null;
        addWindow(batch, compose({ pos: [x, y, DOOR_Z] }), {
          w: 1.05,
          h: fi === 0 ? 2.1 : 1.7,
          balcony: fi === 0 && Math.abs(x) > 4,
          shutters: hugo ? 'open' : R() < 0.2 ? 'closed' : R() < 0.75 ? 'open' : null,
          shutterTint: '#8c979e',
          lit,
        });
        if (hugo && evening) {
          const litM = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.65), new THREE.MeshBasicMaterial({ map: litWindowTexture(), fog: false, toneMapped: false }));
          litM.position.set(HUGO.x, HUGO.y, DOOR_Z + 0.018);
          litM.name = 'hugo-window';
          group.add(litM);
          signs.hugoWindow = litM;
        }
      }
    });
  }

  // Interior room behind the garage door (Ch5 dresses it; the evening variant gets clutter here).
  const interiorLight = pointLight(WARM, evening ? 12 : 9, { pos: [0, 2.35, -50.4], distance: 10 });
  interiorLight.userData.noCone = true;
  interiorLight.visible = !night; // 3 a.m.: No. 14 is shut
  group.add(interiorLight);
  {
    const iw = INTERIOR.maxX - INTERIOR.minX;
    const idp = INTERIOR.maxZ - INTERIOR.minZ;
    const zc = (INTERIOR.maxZ + INTERIOR.minZ) / 2;
    // The same whitewashed brick recipe as Ch4's workshop (no grime canvas on top: its own drawn
    // pattern fought the PBR courses and doubled the bricks).
    const wallM = ctx.look ? ctx.look.surface('workshop.brick') : mat(evening ? '#a89e8c' : '#ffffff', { map: grimeTexture({ w: 512, h: 256, base: '#a49a88', seed: 141, posters: 2, tags: 0, stains: 8, drips: 4 }), roughness: 0.95 });
    const floorM = ctx.look ? ctx.look.surface('workshop.concrete') : mat('#8a8680', { roughness: 0.92 });
    const ceilM = mat('#6e6a64', { roughness: 0.95 });
    const plane = (w, h, m) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    const back = plane(iw, INTERIOR.h, wallM);
    back.position.set(0, INTERIOR.h / 2, INTERIOR.minZ);
    const left = plane(idp, INTERIOR.h, wallM);
    left.rotation.y = Math.PI / 2;
    left.position.set(INTERIOR.minX, INTERIOR.h / 2, zc);
    const right = plane(idp, INTERIOR.h, wallM);
    right.rotation.y = -Math.PI / 2;
    right.position.set(INTERIOR.maxX, INTERIOR.h / 2, zc);
    const floor = plane(iw, idp, floorM);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, zc);
    const ceil = plane(iw, idp, ceilM);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, INTERIOR.h, zc);
    for (const m of [back, left, right, floor, ceil]) m.receiveShadow = true;
    group.add(back, left, right, floor, ceil);
    // Bulb on a flex.
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(WARM).multiplyScalar(3), toneMapped: false }));
    bulb.position.set(0, 2.45, -50.4);
    group.add(bulb, box(0.01, 0.6, 0.01, { color: '#222222', pos: [0, 2.5, -50.4], castShadow: false }));
    if (!wallV) {
      // What the light under the door shows: a bench with tins, a sign board leaning, shelving.
      batch.add('timber', cbox(2.2, 0.06, 0.7), { pos: [-0.9, 0.9, -52.75] });
      for (const x of [-1.9, 0.1]) for (const z of [-52.5, -53.0]) batch.add('steel', cyl(0.03, 0.03, 0.88, 6), { pos: [x, 0, z] });
      batch.add('timber', cbox(1.6, 0.6, 0.03), { pos: [1.7, 0.33, -50.0], rot: [0, -1.2, 0.18] });
      batch.add('timber', cbox(1.2, 0.04, 0.4), { pos: [-2.3, 1.6, -51.0], rot: [0, Math.PI / 2, 0] });
      batch.add('timber', cbox(1.2, 0.04, 0.4), { pos: [-2.3, 2.1, -51.0], rot: [0, Math.PI / 2, 0] });
      // Tins on the shelves and the bench, old sign blanks leaning on the back wall, a stool.
      const R = seeded(52);
      for (const y of [1.62, 2.12]) for (let k = 0; k < 5; k++) batch.add('steel', cyl(0.07, 0.07, 0.13 + R() * 0.06, 10), { pos: [-2.3, y, -51.45 + k * 0.22 + R() * 0.05] });
      for (let k = 0; k < 4; k++) batch.add('steel', cyl(0.08, 0.08, 0.16, 10), { pos: [-1.6 + k * 0.32, 0.93, -52.7 + R() * 0.1] });
      for (let k = 0; k < 3; k++) batch.add('door', cbox(0.9 + R() * 0.5, 0.5 + R() * 0.3, 0.025), { pos: [1.1 + k * 0.25, 0.4, -53.05 + k * 0.05], rot: [-0.12, 0, 0], color: ['#6a5a48', '#4a5a52', '#7a6a50'][k] });
      batch.add('timber', cyl(0.18, 0.2, 0.04, 12), { pos: [-0.4, 0.62, -51.6] });
      for (const [dx, dz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) batch.add('steel', rod([-0.4 + dx * 1.4, 0, -51.6 + dz * 1.4], [-0.4 + dx, 0.62, -51.6 + dz], 0.015));
    }
  }
  // Garage door: half down in the evening and in the R4 days (warm light under it), shut at 3 a.m.,
  // rolled up for the mural.
  let doorPanel = null;
  {
    batch.add('roller', boxGeo(3.4, 0.32, 0.34), { pos: [0, GARAGE.h - 0.02, DOOR_Z - 0.22], color: '#9a9ea2' });
    doorPanel = new THREE.Mesh(new THREE.BoxGeometry(3.24, 1.38, 0.05).translate(0, 0.69, 0), M.roller.material);
    doorPanel.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(doorPanel.geometry.attributes.position.count * 3).fill(0.75), 3));
    doorPanel.position.set(0, GARAGE.h - 1.38, DOOR_Z - 0.06);
    doorPanel.castShadow = true;
    doorPanel.visible = !wallV;
    if (night) {
      doorPanel.scale.y = GARAGE.h / 1.38;
      doorPanel.position.y = 0;
    }
    group.add(doorPanel);
  }
  // Warm spill on the wet pavement in front of the door (additive, fog-faded in update).
  const spill = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 3.4).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: haloTex, color: 0xffc58a, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  spill.position.set(0, SIDEWALK_Y + 0.01, DOOR_Z + 1.6);
  spill.renderOrder = 4;
  spill.visible = !night;
  group.add(spill);

  // The deep lean-to over the workshop front, the cables overhead.
  const awning = addAwning(batch, { doorZ: DOOR_Z });
  addCables(batch);

  // ---------------------------------------------------------------- street lamps (wall consoles)
  const heads = [];
  const lights = [];
  let flickerLight = null;
  let benchLamp = null; // the lamp over the bench (the stakeout's streetlight)
  LAMPS.forEach((l) => {
    const lit = l.light && dark;
    const glassColor = l.bulb === false ? '#2a2a28' : lit ? new THREE.Color(SODIUM).multiplyScalar(5) : dark ? new THREE.Color(SODIUM).multiplyScalar(1.4) : '#a8a396';
    const p = addLamp(batch, { side: l.side, z: l.z, glassKey: l.flicker && lit ? 'lampGlassFlicker' : 'lampGlass', glassColor });
    const head = { x: p.x, y: p.y, z: p.z, lamp: l };
    if (l.bulb !== false) heads.push(head);
    if (lit) {
      const pl = pointLight(SODIUM, LAMP_INTENSITY, { pos: [p.x, p.y - 0.12, p.z], distance: 18 });
      pl.userData.base = LAMP_INTENSITY;
      group.add(pl);
      lights.push(pl);
      head.light = pl;
      if (l.flicker) flickerLight = pl;
      if (l.z === SEAT_LAMP_Z) benchLamp = pl;
    }
  });
  const litHeads = heads.filter((h) => h.light);
  let halos = null;
  let haloGeo = null;
  let haloBase = null;
  if (dark && litHeads.length) {
    haloGeo = new THREE.BufferGeometry();
    haloGeo.setAttribute('position', new THREE.Float32BufferAttribute(heads.flatMap((h) => [h.x, h.y, h.z]), 3));
    const hc = new THREE.Color(SODIUM);
    haloGeo.setAttribute('color', new THREE.Float32BufferAttribute(heads.flatMap((h) => (h.light ? [hc.r, hc.g, hc.b] : [hc.r * 0.3, hc.g * 0.3, hc.b * 0.3])), 3));
    halos = new THREE.Points(
      haloGeo,
      new THREE.PointsMaterial({ map: haloTex, size: 2.4, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    haloBase = Float32Array.from(haloGeo.getAttribute('color').array);
    halos.renderOrder = 4;
    halos.frustumCulled = false;
    group.add(halos);
  }

  // ---------------------------------------------------------------- bench, dumpster and the kerbside
  // The bench: three of its slats rotten in Ch2, replaced by the Night Fixer (Ch5 Week 3) in Bleu Durand.
  const bench = benchSlats(addBench(batch, { x: SEAT.x, z: SEAT.z, gap: BENCH_FIXED }), M);
  bench.set(wallV || night);
  group.add(bench.group);
  addDumpster(batch, { x: 5.42, z: -38.9, side: 1 });
  const litter = !wallV
    ? [
        ['kenney/survival/bottle-large.glb', { height: 0.32, castShadow: false }, [5.3, -3.1], 0.4, 'lying'],
        ['kenney/survival/bottle-large.glb', { height: 0.32, castShadow: false }, [-5.25, -27.6], 1.9, 'lying'],
        ['kenney/survival/bottle-large.glb', { height: 0.32, castShadow: false }, [5.45, -37.6], 0],
        ['kenney/survival/bottle-large.glb', { height: 0.32, castShadow: false }, [-3.75, -14.4], 0.8, 'lying'],
        ['kenney/retro/pallet-small.glb', { width: 1.0 }, [5.42, -19.4], 0.05],
        ['kenney/retro/pallet-small.glb', { width: 1.0 }, [5.42, -19.4], 0.25, 'stack'],
        ['kenney/roads/construction-cone.glb', { height: 0.5, castShadow: false }, [-2.45, -47.35], 0],
        ['kenney/roads/construction-cone.glb', { height: 0.5, castShadow: false }, [-2.85, -47.0], 0.6],
        ['kenney/retro/detail-bricks-type-a.glb', { height: 0.2, castShadow: false }, [-5.5, -29.4], 0.4],
        ['props/trash_bag.glb', { height: 0.62 }, [-5.45, -4.6], 0.3],
        ['props/trash_bag.glb', { height: 0.55 }, [-5.6, -4.05], 2.1],
        ['props/trash_bag.glb', { height: 0.6 }, [5.5, -37.5], 1.2],
        ['props/trash_bag.glb', { height: 0.5 }, [-5.4, -46.7], 0.7],
        ['props/trash_bag.glb', { height: 0.55 }, [5.55, -14.9], 2.6],
        ['props/bin_metal.glb', { height: 0.9 }, [5.5, -13.0], -1.2],
        ['props/bin_metal.glb', { height: 0.9 }, [-5.45, 3.6], 1.4],
        ['props/cardboard_box.glb', { height: 0.34 }, [5.4, -8.4], 0.5],
        ['props/cardboard_box.glb', { height: 0.3 }, [-5.45, -38.0], 2.2], // under ENCRE FINE's window
        ['props/barrel.glb', { height: 0.9 }, [5.45, -44.7], 0.3],
        ['props/milk_crate.glb', { height: 0.26 }, [-5.55, -31.9], 0.2],
        ['props/milk_crate.glb', { height: 0.26 }, [-5.55, -31.9], 0.5, 'stack'],
        ['props/milk_crate.glb', { height: 0.26 }, [-5.5, -32.45], 1.4],
        ['props/crate_wood.glb', { width: 0.8 }, [-5.4, -43.6], Math.PI / 2],
        ['props/cafe_set.glb', { height: 0.86 }, r4 ? [-5.25, -6.45] : [-5.25, -11.1], 0.08], // R4: clear of the shutter rail (PHOTO)
      ]
    : [
        ['kenney/survival/bottle-large.glb', { height: 0.32, castShadow: false }, [5.3, -3.1], 0.4, 'lying'],
        ['props/trash_bag.glb', { height: 0.6 }, [5.5, -37.5], 1.2],
        ['props/trash_bag.glb', { height: 0.5 }, [-5.4, -46.7], 0.7],
        ['props/bin_metal.glb', { height: 0.9 }, [5.5, -13.0], -1.2],
        ['props/cardboard_box.glb', { height: 0.34 }, [5.4, -8.4], 0.5],
        ['props/barrel.glb', { height: 0.9 }, [5.45, -44.7], 0.3],
        ['props/milk_crate.glb', { height: 0.26 }, [-5.5, -32.45], 1.4],
        ['props/cafe_set.glb', { height: 0.86 }, [-5.25, -11.1], 0.08],
      ];
  const litterProps = await Promise.all(litter.map(([p, o]) => prop(p, o)));
  litterProps.forEach((g, i) => {
    const [path, , [x, z], rot, how] = litter[i];
    g.position.set(x, SIDEWALK_Y, z);
    g.rotation.y = rot;
    if (how === 'lying') {
      g.rotation.set(0, rot, Math.PI / 2);
      g.position.y = SIDEWALK_Y + (g.userData.size?.x ?? 0.18) / 2;
    } else if (how === 'stack') {
      g.position.y = SIDEWALK_Y + (g.userData.size?.y ?? 0.3);
    }
    if (path.startsWith('props/') && (g.userData.size?.y ?? 1) < 0.7) g.traverse((o) => o.isMesh && (o.castShadow = false));
    noOcclude(g);
    group.add(g);
  });

  // ---------------------------------------------------------------- evening: Odile's tower, Odile, the club
  let tower = null;
  let odile = null;
  const club = [];
  const wob = { amp: 0, t: 0 };
  let clampLight = null;
  if (evening) {
    tower = new THREE.Group();
    tower.name = 'scaffold';
    tower.position.set(TOWER.x, SIDEWALK_Y, TOWER.z);
    const tb = new Batch();
    for (const k of ['steel', 'timber', 'iron']) tb.material(k, M[k].material, M[k].opts);
    const { deckTop } = buildTowerFrame(tb, { size: TOWER.size, lift: TOWER.lift });
    // Clamp-on work lamp on a short pole at the back-right post, well above Odile's head (it used to
    // sit at head height and read as part of her from the street), aimed down at the fascia.
    tb.add('iron', rod([0.88, deckTop + 0.9, 0.88], [0.88, deckTop + 1.75, 0.88], 0.014));
    tb.add('iron', rod([0.88, deckTop + 1.75, 0.88], [0.74, deckTop + 1.86, 0.66], 0.012));
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 14, 1, true), new THREE.MeshStandardMaterial({ color: '#3c3e40', side: THREE.DoubleSide, metalness: 0.4, roughness: 0.5 }));
    head.position.set(0.7, deckTop + 1.86, 0.6);
    head.rotation.x = -2.35;
    const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(WARM).multiplyScalar(4), toneMapped: false }));
    lampBulb.position.set(0.7, deckTop + 1.8, 0.54);
    tower.add(head, lampBulb);
    clampLight = pointLight(WARM, 7, { pos: [0.6, deckTop + 1.6, 0.25], distance: 6 });
    clampLight.userData.noCone = true;
    tower.add(clampLight);
    const frame = tb.build('scaffold');
    noOcclude(frame);
    tower.add(frame);
    // Odile's kit on the deck: tins, a jar of brushes.
    const [can1, can2] = await Promise.all([prop('props/paint_can.glb', { height: 0.15 }), prop('props/paint_can.glb', { height: 0.15 })]);
    can1.position.set(-0.55, deckTop, -0.3);
    can2.position.set(-0.32, deckTop, -0.55);
    can2.rotation.y = 1.3;
    tower.add(can1, can2);
    for (let k = 0; k < 4; k++) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.01, 0.26, 5), M.timber.material);
      br.position.set(-0.55 + (k - 1.5) * 0.015, deckTop + 0.2, -0.3 + (k % 2) * 0.012);
      br.rotation.z = (k - 1.5) * 0.12;
      tower.add(br);
    }
    // Odile, on the deck, close to the fascia, lettering.
    odile = assets.makeCharacter({ preset: 'odile', tint: 0x9a7a4e, name: 'Odile' });
    odile.root.position.set(0.15, deckTop, -0.72);
    odile.root.rotation.y = Math.PI;
    odile.model.rotation.x = 0.1;
    odile.play('paint');
    tower.add(odile.root);
    const hand = odile.bone?.('RightHand');
    if (hand) {
      tower.updateMatrixWorld(true);
      const s = hand.getWorldScale(new THREE.Vector3()).x || 1;
      const brush = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.26, 6), mat('#6b4a2e'));
      brush.scale.setScalar(1 / s);
      brush.position.set(0, 0.1 / s, 0);
      brush.castShadow = false;
      hand.add(brush);
    }
    group.add(tower);

    // The run club: Bastien (hi-vis yellow) + four runners in club colours (lime, cobalt, teal, navy).
    // No tans or oranges: under the grey grade those read as bare skin.
    const tints = [0xd6e04a, 0xa8c43a, 0x2f56a8, 0x1d6a72, 0x22314f];
    for (let i = 0; i < tints.length; i++) {
      const c = assets.makeCharacter({ preset: i === 0 ? 'bastien' : 'runner', variant: 'long', tint: tints[i], name: i === 0 ? 'Bastien' : `Runner ${i}` });
      c.root.position.set(0, 0, 30);
      c.root.rotation.y = Math.PI;
      c.root.visible = false;
      group.add(c.root);
      club.push(c);
    }
  }

  // ---------------------------------------------------------------- rain and its details
  const rain = dark ? makeRain({ count: 2200, opacity: 0.3 }) : null; // night: off until setRain()
  if (rain) group.add(rain.object);
  const fx = [];
  let splash = null;
  let pour = null;
  if (evening) {
    splash = splashes();
    group.add(splash.object);
    pour = stream({ pos: awning.gap, length: awning.gap[1] - SIDEWALK_Y });
    group.add(pour.object);
    const vent = steam({ pos: [-FRONT_X + 0.25, 4.75, -35.7], map: haloTex, rise: 0.55, spread: 0.6 });
    group.add(vent.object);
    fx.push(splash, pour, vent);
    // A splash cluster where the gutter pours.
    const sp = splashes({ count: 26, box: [0.5, 0.5], y: SIDEWALK_Y + 0.01 });
    sp.object.material.uniforms.uCam.value.set(awning.gap[0], 0, awning.gap[2] + 4);
    sp.object.material.uniforms.uMinZ.value = -99;
    sp.object.material.uniforms.uScale.value = 260;
    sp.object.name = 'gutter-splash';
    group.add(sp.object);
    fx.push({ update: (dt) => (sp.object.material.uniforms.uTime.value += dt) });
  }

  // ---------------------------------------------------------------- R4: Lou's window, the doorstep print
  // Lou's window: CHEZ GÉRARD's building, 4th floor, the one window lit at 3 a.m. (her 3 h 04 photo).
  const gb = BUILDINGS.find((b) => b.id === 'marco');
  const LOU_WIN = [-FRONT_X + 0.016, GF + 3 * FLOOR + 0.95 + 0.85, gb.z0 - (gb.z0 - gb.z1) / 2];
  let louWindow = null;
  if (r4) {
    louWindow = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 1.66), new THREE.MeshBasicMaterial({ map: litWindowTexture(), fog: false, toneMapped: false }));
    louWindow.position.set(...LOU_WIN);
    louWindow.rotation.y = Math.PI / 2;
    louWindow.name = 'lou-window';
    louWindow.visible = night;
    group.add(louWindow);
  }
  const print = r4 ? printMark([3.75, DOOR_Z + 0.4], 0.3) : null; // No. 14's stairwell doorstep
  if (print) group.add(print);

  // ---------------------------------------------------------------- merge the batch
  group.add(batch.build('street'));

  // ---------------------------------------------------------------- bounds
  const bounds = evening
    ? [
        { minX: -5.0, maxX: 4.85, minZ: -45.1, maxZ: 9 },
        { minX: -5.0, maxX: TOWER.x - 1.05, minZ: -47.3, maxZ: -45.1 },
        { minX: TOWER.x + 1.05, maxX: 4.85, minZ: -47.3, maxZ: -45.1 },
      ]
    : r4
    ? [{ minX: -5.0, maxX: 4.85, minZ: -47.3, maxZ: 9 }] // the garage door is half down or shut: the workshop is its own scene
    : [
        { minX: -5.0, maxX: 4.85, minZ: -47.3, maxZ: 9 },
        { minX: GARAGE.x0 + 0.25, maxX: GARAGE.x1 - 0.25, minZ: DOOR_Z - 0.4, maxZ: -47.0 },
        { minX: INTERIOR.minX + 0.35, maxX: INTERIOR.maxX - 0.35, minZ: INTERIOR.minZ + 0.45, maxZ: DOOR_Z - 0.2 },
      ];

  // ---------------------------------------------------------------- animation
  const rain0 = evening ? 0.3 : 0;
  const state = { t: 0, rain: rain0, rainTarget: rain0, rainUser: night ? 0 : 1, bbFlick: 0, bbNext: 3, lampFlick: 0, lampNext: 2, neonFlick: 0, neonNext: 4, tubeFlick: 0, tubeNext: 1.5, buzzAt: 0 };
  state.neonBase = neonMat ? neonMat.color.r : 1;
  state.neonLightBase = neonLight ? neonLight.intensity : 0;
  // Gérard's neon flickers "on purpose" (Ch2, Ch5, Ch6 Week 5) until it is rewired; steady in Ch7.
  state.neonFlicker = evening || day;
  const tubeBase = new THREE.Color(TUBE).multiplyScalar(dark ? 2.2 : 0.7);
  const flickGlass = M.lampGlassFlicker.material;
  let flickCone = undefined; // core light cone under the flickering lamp (found after the build)
  let flickConeBase = 0;
  const _hp = new THREE.Vector3();
  // Recorded hums at the lights (evening and night; scene2/sound.js): each follows its light's flicker.
  // The chapter preloads them (fluoro_hum, neon_buzz, amb_drips); at 3 a.m. Gérard's neon is off.
  const hum = dark
    ? streetHums(ctx, {
        tube: [FRONT_X - 0.4, 2.6, -22.8],
        neon: night ? null : [-FRONT_X + 0.72, 3.48, -32.5],
        lamp: flickerLight ? flickerLight.position.toArray() : null,
        drips: awning.gap,
      })
    : null;
  const humGain = { tube: 1, neon: 1, lamp: 1 };
  /** 1 - FogExp2 factor at world point p (1 = clear, 0 = fully fogged). */
  const fogVis = (p) => {
    const dens = ctx.scene.fog?.density || 0;
    const dd = dens * ctx.camera.position.distanceTo(p);
    return Math.exp(-dd * dd);
  };
  const flick = (key, next, minGap, maxGap, minLen, maxLen, raw) => {
    state[next] -= raw;
    if (state[next] <= 0) {
      state[key] = minLen + Math.random() * (maxLen - minLen);
      state[next] = minGap + Math.random() * (maxGap - minGap);
    }
    if (state[key] > 0) {
      state[key] -= raw;
      return true;
    }
    return false;
  };

  function update(dt, raw) {
    state.t += raw;
    // Rain: on, easing past z -36 and almost gone under the awning.
    if (rain) {
      const pz = ctx.player?.root?.position.z ?? 0;
      const ease = pz > -30 ? 1 : pz > -40 ? 1 - 0.75 * ((-30 - pz) / 10) : pz > -44.5 ? 0.25 : 0.12;
      state.rainTarget = 0.3 * ease * state.rainUser;
      state.rain += (state.rainTarget - state.rain) * (1 - Math.exp(-1.2 * raw));
      rain.opacity = state.rain;
      rain.object.visible = state.rain > 0.003; // night: no draw until setRain()
      if (rain.object.visible) rain.update(dt, ctx.camera);
      if (splash) splash.opacity = state.rain * 1.25;
      if (pour) pour.opacity = 0.18 + state.rain * 0.7;
    }
    for (const f of fx) f.update(dt, ctx.camera);
    // Additive glows ignore fog (it would grey them); fade them with the same FogExp2 curve.
    if (halos) {
      const hc = haloGeo.getAttribute('color');
      for (let i = 0; i < heads.length; i++) {
        const h = heads[i];
        const vis = fogVis(_hp.set(h.x, h.y, h.z));
        for (let k = 0; k < 3; k++) hc.array[i * 3 + k] = haloBase[i * 3 + k] * vis;
      }
      hc.needsUpdate = true;
    }
    const spillVis = Math.pow(fogVis(spill.position), 0.5);
    spill.material.opacity = (evening ? 0.32 : day ? 0.16 : 0.12) * spillVis;
    if (gerardSpill) gerardSpill.material.opacity = (evening ? 0.22 : 0.06) * Math.pow(fogVis(gerardSpill.position), 0.5);
    encre.spill.material.opacity = (dark ? 0.24 : 0.07) * encre.lightK * Math.pow(fogVis(encre.spill.position), 0.5);
    for (const lit of [signs.hugoWindow, louWindow]) if (lit?.visible) lit.material.color.setScalar(0.25 + 0.95 * Math.pow(fogVis(lit.position), 0.3));
    encre.update(raw, state.t);
    durand?.update(raw);
    bakery?.update(raw);

    // Billboard: one tube is going.
    if (bbMat) bbMat.emissiveIntensity = flick('bbFlick', 'bbNext', 3, 8, 0.25, 0.75, raw) ? (Math.sin(state.t * 47) > 0.2 ? bbBase : 0.12) : bbBase;

    // One sodium lamp buzzes (its light, its glass and the core's light cone under it).
    if (flickerLight) {
      const f = flick('lampFlick', 'lampNext', 2.5, 6.5, 0.4, 1.2, raw) ? (Math.sin(state.t * 31) > -0.1 ? 0.85 : 0.15) : 1;
      flickerLight.intensity = flickerLight.userData.base * f;
      humGain.lamp = f;
      flickGlass.color.setScalar(0.12 + 0.88 * f);
      if (flickCone === undefined && result.lightCones) {
        flickCone = result.lightCones.find((c) => c.userData.light === flickerLight) || null;
        flickConeBase = flickCone?.material.uniforms.uOpacity.value ?? 0;
      }
      if (flickCone) flickCone.material.uniforms.uOpacity.value = flickConeBase * f;
    }
    // Gérard's neon: short dropouts ("ambience"), until the Night Fixer rewires it.
    if (neonMat) {
      const off = state.neonFlicker && flick('neonFlick', 'neonNext', 3, 7, 0.05, 0.22, raw) && Math.sin(state.t * 60) > 0;
      neonMat.color.setScalar(off ? state.neonBase * 0.15 : state.neonBase);
      humGain.neon = off ? 0.15 : 1;
      if (neonLight) neonLight.intensity = off ? 0.6 : state.neonLightBase;
    }
    // The doorway tube: stutters, and buzzes when you're near.
    if (tubeMat && dark) {
      const on = flick('tubeFlick', 'tubeNext', 2, 5, 0.3, 1.1, raw);
      const k = on ? (Math.sin(state.t * 53) > 0.3 ? 1 : 0.08) : 1;
      tubeMat.color.copy(tubeBase).multiplyScalar(k);
      if (tubeLight) tubeLight.intensity = 5 * k;
      humGain.tube = k > 0.5 ? 1 : 0.1; // the hum drops out with the stutter (the ticks below are the strike)
      if (on && state.t > state.buzzAt) {
        state.buzzAt = state.t + 0.45;
        const p = ctx.player?.root?.position;
        const d = p ? Math.hypot(p.x - (FRONT_X - 0.5), p.z + 22.4) : 99;
        if (d < 9) ctx.audio?.tone({ freq: 120, to: 118, dur: 0.3, type: 'sawtooth', volume: 0.028 * (1 - d / 9) });
      }
    }
    hum?.update(humGain);
    // The tower wobbles when Hugo fidgets (and creaks a hair on its own).
    if (tower) {
      wob.t += raw;
      wob.amp *= Math.exp(-2.6 * raw);
      tower.rotation.z = wob.amp * Math.sin(wob.t * 11) + 0.002 * Math.sin(state.t * 0.9);
      tower.rotation.x = wob.amp * 0.6 * Math.sin(wob.t * 9 + 1);
    }
  }

  // ---------------------------------------------------------------- spots, shots, extras
  const spots = {
    ghost: [4.3, -10],
    billboard: [-3.6, -15.2],
    shop: [4.3, -34],
    bench: [-4.55, SEAT.z],
    seat: [SEAT.x, SEAT.z],
    door: [0, -47.0],
    odile: [TOWER.x + 1.4, TOWER.z + 1.6],
    // Ch5 contract
    odileChair: [-4.45, -38.5],
    saunter: [-3.8, -22],
    nail: [0, -52.35],
    boltHoles: [-4.2, BILLBOARD.z],
    shopCard: [4.3, -34],
    benali: [-3.9, -14],
    ines: [-3.9, -20],
    marco: [-3.9, -30.5],
    // R4, every variant: ENCRE FINE (encre, joDoor, encreInside, encreTable, encreSign; joLadder in Ch2)
    ...encre.spots,
    stakeoutBench: [SEAT.x, SEAT.z], // sit here (seat.facing): CYCLES DURAND is across the street, a little to the right
    benchLamp: [-4.75, SEAT_LAMP_Z], // under the streetlight by the bench (the stakeout's cone)
  };
  if (r4) {
    Object.assign(spots, {
      // The Ch5 hub: where each suspect hangs out, and what was fixed overnight.
      benaliDoor: [-4.5, -8.8],
      shutter: [-4.45, -10.6], // Mme Benali's shutter, by its street-end rail (the PHOTO of the hinge)
      gerardCounter: [-4.55, -34.2],
      neon: [-4.3, -32.0],
      louWall: [-4.6, -26.5],
      samiKerb: [3.95, -29.5], // sitting on the kerb, feet in the gutter
      bastien: [-3.4, -17.5], // jogging on the spot by the billboard
      bastienStart: [2.2, 12],
      bastienEnd: [2.2, -44],
      bastienRoute: [[2.2, 12], [2.2, -44]], // start, end (also paths.bastienRoute)
      oldManSeat: [SEAT.x, SEAT.z - 0.55], // Week 3: asleep at the end of the bench
      oldManBike: [SEAT.x + 0.32, SEAT.z - 1.12], // his black bike leaning on the armrest
      print: [3.75, DOOR_Z + 0.75], // No. 14's doorstep (the sawdust slipper print)
      ...durand.spots, // durandDoor, durandInside, durandBench, durandPhoto, durandCalendar, durandTin, durandOutlines, durandPhotos, durandCard
    });
  }
  const shots = {
    ghost: { pos: [-2.2, 1.6, -4.8], look: [5.9, 8.2, -10], fov: 54 },
    billboard: { pos: [2.4, 1.7, -10.6], look: [-5.9, 6.0, -18], fov: 54 },
    shop: { pos: [2.0, 1.95, -29.3], look: [5.9, 1.55, -33.9], fov: 46 }, // over Hugo's shoulder: the note stays clear of him
    bench: { pos: [-1.6, 1.5, -34.4], look: [-5.2, 0.9, -36.7], fov: 52 },
    hold: { pos: [2.9, 1.55, -41.3], look: [-0.55, 2.35, -46.2], fov: 52 },
    after: { pos: [-1.3, 1.65, -41.4], look: [1.05, 1.35, -45.3], fov: 48 },
    wall: { pos: [0.4, 1.7, -22], look: [-5.95, 2.6, -22], fov: 62 },
    door: { pos: [0, 1.7, -42.5], look: [0, 1.6, -49], fov: 52 },
    // Inside the workshop (the follow camera would sit in the doorway, under the lintel).
    nail: { pos: [1.7, 1.75, -49.2], look: [-0.1, 1.4, -53.1], fov: 54 },
    // R4: ENCRE FINE (jo: the Ch2 cameo on the ladder; encreTable: STENCIL), the bench seen from the seat.
    ...encre.shots,
    stakeout: { pos: [SEAT.x + 0.2, 1.18, SEAT.z + 0.15], look: [5.9, 1.45, -32.6], fov: 50 },
    stakeoutWide: { pos: [-1.4, 2.3, -42.6], look: [-4.6, 0.9, -36.4], fov: 50 },
    benchSlats: { pos: [-4.15, 1.2, bench.focus.z + 0.55], look: [bench.focus.x, bench.focus.y, bench.focus.z], fov: 40 },
  };
  if (r4) {
    const tr = bakery.trestle;
    Object.assign(shots, {
      hub: { pos: [2.4, 3.1, 4.0], look: [-0.6, 1.4, -28], fov: 55 },
      bakery: { pos: [-1.3, 1.65, -5.4], look: [-5.9, 1.35, -9.4], fov: 50 },
      shutterRail: { pos: [-4.35, 1.2, -10.3], look: [bakery.focus.x, 0.95, bakery.focus.z], fov: 40 }, // PHOTO: the oiled rail
      croissant: { pos: [tr.x + 1.25, 1.7, tr.z + 0.55], look: [tr.x, tr.y, tr.z], fov: 44 }, // the floured board at 4 a.m.
      gerard: { pos: [-1.8, 1.7, -29.4], look: [-5.9, 1.9, -33.6], fov: 52 },
      neon: { pos: [-2.6, 2.1, -30.0], look: [-5.3, 3.15, -32.5], fov: 44 },
      louWindow: { pos: [4.6, 1.6, -26.4], look: [LOU_WIN[0], LOU_WIN[1] - 1.2, LOU_WIN[2]], fov: 44 }, // from across the street
      print: { pos: [2.9, 1.45, -45.9], look: [3.75, 0, DOOR_Z + 0.4], fov: 44 },
      ...durand.shots, // durandDoor (KEY RING: the lock), durandInside, durandBench, durandPhoto, durandCalendar, durandOutlines, durandCard
    });
  }

  const result = {
    group,
    variant: V,
    bounds,
    spots,
    shots,
    seat: SEAT,
    interior: INTERIOR,
    wallLine: { x: WALL.x, z0: WALL.z0, z1: WALL.z1, y: 1.55, height: WALL.h },
    fascia,
    signs,
    lights: { lamps: lights, neon: neonLight, tube: tubeLight, interior: interiorLight, clamp: clampLight, bench: benchLamp, encre: encre.light },
    /** ENCRE FINE (scene2/encre.js): door + setOpen(k, secs), bindBounds(bounds), setTilt(r) / straighten(secs) for the
     *  blade sign, ladder + joLadder {pos, facing} in Ch2, spots, shots, focus {table, sign, flash}. */
    encre,
    /** The bench's three slats: set(fixed), focus (the new slats' centre, world). */
    bench,
    /** Rain multiplier 0..1 (eased). The z-based easing past -36 still applies. */
    setRain(v) {
      state.rainUser = clamp01(v);
    },
    update,
    /** Stop the scene's recorded hums (the chapter's last cut; releaseChapter stops them anyway). */
    stopSound(fade = 0.3) {
      hum?.stop(fade);
    },
    dispose() {
      hum?.stop(0.1);
      env.dispose();
    },
  };

  if (evening) {
    Object.assign(result, {
      /** R4 Ch2: Mme Benali's shutter (setOpen(k, secs); starts 0.78 up), focus (the street-end rail, world). */
      bakery,
      odile,
      tower,
      club,
      holdSpot: HOLD_SPOT,
      holdLeg: HOLD_LEG,
      odileGround: ODILE_GROUND,
      /** Kick the scaffold wobble (radians of sway). */
      wobble(amp = 0.035) {
        wob.amp = Math.min(0.06, wob.amp + amp);
        wob.t = 0;
      },
      /** Odile "climbs down" (call behind a fade): she stands on the pavement facing Hugo. */
      odileDown(face = HOLD_SPOT) {
        if (!odile) return;
        group.attach(odile.root);
        odile.root.position.set(ODILE_GROUND[0], SIDEWALK_Y, ODILE_GROUND[1]);
        odile.root.rotation.set(0, Math.atan2(face[0] - ODILE_GROUND[0], face[1] - ODILE_GROUND[1]), 0);
        odile.model.rotation.x = 0;
        odile.play('arms_crossed', 0.1);
      },
    });
  } else if (wallV) {
    Object.assign(result, {
      panels,
      /** Set every panel's colour 0 (grey) .. 1 (its own colour). */
      setPanels(k) {
        for (const p of panels) p.setColor(k);
      },
      /** Golden hour: the mural in full colour, Gérard's neon on, the workshop glowing. */
      setGolden() {
        for (const p of panels) p.setColor(1);
        state.neonBase = 1.4;
        state.neonLightBase = 3;
        interiorLight.intensity = 12;
        // Glass reflects the warm sky, not the overcast one.
        const g = M.glass.material;
        if (!g.userData.golden) {
          g.userData.golden = true;
          g.envMap = skyEnv(true, true);
          g.envMapIntensity = 0.6;
          g.needsUpdate = true;
        }
      },
      nailPos: [0, 1.6, INTERIOR.minZ + 0.06],
      shopCardAt: [FRONT_X - 0.05, 1.45, (-31.3 + -36.7) / 2 - 0.9, -Math.PI / 2],
      boltHolesAt: [WALL.x + 0.02, BILLBOARD.y0 + BILLBOARD.h / 2, BILLBOARD.z],
    });
  }
  encre.bindBounds(bounds);
  if (r4) {
    durand.bindBounds(bounds);
    // What the Night Fixer has done, week by week (SCRIPT-R4 §9.1): each setter takes true = fixed.
    const fixes = {
      /** Mme Benali's shutter: rusty rails (it screams) -> oiled (Week 2). */
      shutter: (v) => bakery.setOiled(v),
      /** The bench: three rotten slats -> three new 52 cm slats in Bleu Durand (Week 3). */
      bench: (v) => bench.set(v),
      /** The CYCLES DURAND card: fallen on the pavement -> pinned back up, straight (Week 9, the stakeout). */
      card: (v) => durand.setPinned(v),
      /** Gérard's neon: flickering on a taped wire -> rewired, steady (Week 6). */
      neon: (v) => {
        wires?.set(v);
        state.neonFlicker = !v && !night;
      },
      get state() {
        return { shutter: bakery.oiled, bench: bench.fixed, card: durand.pinned, neon: !!wires?.fixed };
      },
    };
    // Defaults: by day nothing is fixed yet (the chapter sets each week); at 3 a.m. (Week 9) everything is,
    // except the card, which Durand pins back up during the stakeout.
    for (const k of ['shutter', 'bench', 'neon']) fixes[k](night);
    fixes.card(false);
    Object.assign(result, {
      fixes,
      /** Mme Benali's bakery: setOpen(k, secs), setOiled(v), setLit(v) (4 a.m.: lit, the trestle out), focus, trestle. */
      bakery,
      /** CYCLES DURAND: setOpen(k, secs) (the door; the room is walkable past 0.6), setLight(v), setPinned(v), focus, shots. */
      durand,
      /** Gérard's sign: on / off (3 a.m.: off), and its shop's shutter (night: half down). */
      neon: {
        setOn(on) {
          state.neonBase = on ? (night ? 1.6 : 0.55) : 0.1;
          state.neonLightBase = on && night ? 7 : 0;
          if (neonLight) {
            neonLight.visible = on && night;
            neonLight.intensity = state.neonLightBase;
          }
          if (neonMat) neonMat.color.setScalar(state.neonBase);
        },
        setFlicker(v) {
          state.neonFlicker = !!v;
        },
      },
      /** The doorstep print and the other one-off marks. */
      marks: {
        print(on) {
          print.visible = !!on;
        },
      },
      louWindow,
      /** Paths (world [x, z]): Durand's night loop (closed; stops index the points), Bastien's run. */
      paths: { nightLoop: NIGHT_LOOP, nightStops: NIGHT_STOPS, bastienRoute: [spots.bastienStart, spots.bastienEnd] },
      /** 3D anchors (world [x, y, z]) for focus and PHOTO frames. */
      anchors: {
        louWindow: LOU_WIN,
        shutterRail: bakery.focus.toArray(),
        trestle: bakery.trestle.toArray(),
        benchSlats: bench.focus.toArray(),
        neon: [-FRONT_X + 0.72, 3.25, -32.5],
        encreSign: encre.focus.sign.toArray(),
        encreTable: encre.focus.table.toArray(),
        ...Object.fromEntries(Object.entries(durand.focus).map(([k, v]) => [`durand${k[0].toUpperCase()}${k.slice(1)}`, v.toArray()])),
      },
      mood: STREET_MOODS[V],
    });
    spots.nightLoop = NIGHT_LOOP;
  }
  return result;
}
