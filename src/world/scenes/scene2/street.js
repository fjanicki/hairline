import * as THREE from 'three';
import { canvasTexture, rng as seeded } from '../../build.js';
import { boxGeo, atlasPlane } from './kit.js';
import { cellUV } from './art.js';
import { FRONT_X } from './facades.js';

// The street surface: asphalt carriageway, cobbled gutters, concrete kerbs, paved sidewalks and the
// cross pavement in front of No. 14, plus road decals (manholes, drain grates, a worn zebra, tar
// sealant). Ground recipes come from look.js, so Ch2 is soaked and Ch5 dries out on the same street.
// The sidewalk sits 3.5 cm up and the road 1.5 cm down: a readable kerb, while feet (always at y 0)
// stay within a few centimetres of both.

export const ROAD = { x: 3.5, gutter: 0.4, kerb: 0.15, zMax: 14, zMin: -45.0, end: -48 };
export const SIDEWALK_Y = 0.035;
export const ROAD_Y = -0.015;

/** Decal atlas (2 x 2): manhole, drain grate, zebra stripe, tar sealant. */
function decalAtlas() {
  const S = 512;
  return canvasTexture(S * 2, S * 2, (c) => {
    c.clearRect(0, 0, S * 2, S * 2);
    const R = seeded(808);
    // 0: manhole (cast iron, raised grid, a rim of tar).
    {
      const cx = S / 2;
      const cy = S / 2;
      c.fillStyle = 'rgba(24,24,24,0.95)';
      c.beginPath();
      c.arc(cx, cy, S * 0.48, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#4a4744';
      c.beginPath();
      c.arc(cx, cy, S * 0.43, 0, Math.PI * 2);
      c.fill();
      c.save();
      c.beginPath();
      c.arc(cx, cy, S * 0.4, 0, Math.PI * 2);
      c.clip();
      c.strokeStyle = '#2e2c2a';
      c.lineWidth = 9;
      for (let k = -10; k <= 10; k++) {
        c.beginPath();
        c.moveTo(cx + k * 24 - 300, cy - 300);
        c.lineTo(cx + k * 24 + 300, cy + 300);
        c.stroke();
        c.beginPath();
        c.moveTo(cx + k * 24 + 300, cy - 300);
        c.lineTo(cx + k * 24 - 300, cy + 300);
        c.stroke();
      }
      c.restore();
      c.strokeStyle = '#2a2826';
      c.lineWidth = 14;
      c.beginPath();
      c.arc(cx, cy, S * 0.32, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#3a3836';
      c.font = `700 40px Georgia, serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('EAUX', cx, cy);
      for (let k = 0; k < 30; k++) {
        c.fillStyle = `rgba(120,70,40,${R() * 0.25})`;
        c.beginPath();
        c.arc(cx + (R() - 0.5) * S * 0.7, cy + (R() - 0.5) * S * 0.7, 6 + R() * 30, 0, Math.PI * 2);
        c.fill();
      }
    }
    // 1: drain grate (a steel grid in a concrete frame).
    {
      const x0 = S;
      c.fillStyle = 'rgba(70,68,64,0.95)';
      c.fillRect(x0 + S * 0.05, S * 0.18, S * 0.9, S * 0.64);
      c.fillStyle = '#0c0c0c';
      c.fillRect(x0 + S * 0.12, S * 0.26, S * 0.76, S * 0.48);
      c.fillStyle = '#3a3836';
      for (let k = 0; k < 14; k++) c.fillRect(x0 + S * 0.12 + k * S * 0.055, S * 0.26, S * 0.026, S * 0.48);
      c.fillRect(x0 + S * 0.12, S * 0.48, S * 0.76, 10);
    }
    // 2: a worn zebra stripe (paint abraded by tyres, more at the wheel tracks).
    {
      const y0 = S;
      c.fillStyle = 'rgba(176,174,166,0.8)';
      c.fillRect(S * 0.08, y0 + S * 0.04, S * 0.84, S * 0.92);
      c.globalCompositeOperation = 'destination-out';
      for (let k = 0; k < 4200; k++) {
        const y = y0 + R() * S;
        const track = Math.abs(((y - y0) / S) - 0.3) < 0.12 || Math.abs(((y - y0) / S) - 0.72) < 0.1;
        c.fillStyle = `rgba(0,0,0,${(track ? 0.7 : 0.35) * R()})`;
        c.beginPath();
        c.arc(R() * S, y, 2 + R() * (track ? 16 : 8), 0, Math.PI * 2);
        c.fill();
      }
      c.globalCompositeOperation = 'source-over';
    }
    // 3: tar sealant snaking over old cracks (kept well inside the cell: no mip bleed at its edges).
    {
      const x0 = S;
      const y0 = S;
      const lo = S * 0.12;
      const hi = S * 0.88;
      c.strokeStyle = 'rgba(12,12,12,0.55)';
      c.lineCap = 'round';
      c.lineJoin = 'round';
      for (let k = 0; k < 4; k++) {
        c.lineWidth = 2.5 + R() * 3;
        c.beginPath();
        let x = lo + R() * (hi - lo);
        let y = lo + R() * S * 0.15;
        c.moveTo(x0 + x, y0 + y);
        for (let i = 0; i < 9 && y < hi; i++) {
          x += (R() - 0.5) * 90;
          if (x < lo || x > hi) x = Math.max(lo, Math.min(hi, x)) - Math.sign(x - S / 2) * 30;
          y = Math.min(hi, y + 30 + R() * 50);
          c.lineTo(x0 + x, y0 + y);
        }
        c.stroke();
      }
    }
  });
}

/**
 * Build the ground into the batch (keys 'asphalt', 'cobbles', 'kerb', 'pavement') and return the
 * decal mesh. ctx gives the chapter weather (decals get wetter roughness in Ch2).
 */
export function buildStreet(ctx, batch) {
  const { x: RX, gutter: G, kerb: K, zMax, zMin, end } = ROAD;
  const len = zMax - zMin;
  const zc = (zMax + zMin) / 2;
  // Carriageway and gutters (planes; the world-mapped recipes need no UVs).
  const flat = (w, d) => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
  batch.add('asphalt', flat(RX * 2, len), { pos: [0, ROAD_Y, zc] });
  for (const s of [-1, 1]) {
    batch.add('cobbles', flat(G, len), { pos: [s * (RX + G / 2), ROAD_Y + 0.002, zc] });
    // Kerb: a long low block with its top and street face showing.
    batch.add('kerb', boxGeo(K, SIDEWALK_Y - ROAD_Y + 0.01, len + 0.0), { pos: [s * (RX + G + K / 2), ROAD_Y - 0.01, zc] });
    // Sidewalk to the facades (and on under the cross pavement).
    const sw = FRONT_X - (RX + G + K);
    batch.add('pavement', flat(sw + 0.1, zMax - end), { pos: [s * (RX + G + K + sw / 2 + 0.05), SIDEWALK_Y, (zMax + end) / 2] });
  }
  // The cross kerb and the pavement in front of No. 14.
  const crossW = (RX + G) * 2;
  batch.add('kerb', boxGeo(crossW, SIDEWALK_Y - ROAD_Y + 0.01, K), { pos: [0, ROAD_Y - 0.01, zMin - K / 2] });
  batch.add('pavement', flat(crossW, zMin - K - end), { pos: [0, SIDEWALK_Y, (zMin - K + end) / 2] });
  // Under everything (the gaps beyond the facades never show, but shadows and fog need a floor).
  batch.add('underlay', flat(80, 90), { pos: [0, -0.06, -16] });

  // Decals: one merged mesh over the atlas.
  const cells = [0, 1, 2, 3].map((i) => cellUV(i, 2));
  const geos = [];
  const put = (w, h, cell, x, z, rot = 0, y = ROAD_Y + 0.004) => {
    const g = atlasPlane(w, h, cell).rotateX(-Math.PI / 2).rotateY(rot).translate(x, y, z);
    geos.push(g);
  };
  const R = seeded(77);
  // Manholes in the wheel tracks, drain grates in the gutters by every downpipe-ish interval.
  for (const [x, z] of [[-1.1, 3.6], [1.3, -13.4], [-0.6, -26.8], [1.0, -39.2]]) put(0.8, 0.8, cells[0], x, z, R() * 6, ROAD_Y + 0.008);
  for (let z = 10; z > zMin + 1; z -= 9.5 + R() * 3) for (const s of [-1, 1]) put(0.36, 0.62, cells[1], s * (RX + 0.2), z + s * 2.3, Math.PI / 2, ROAD_Y + 0.008);
  // The zebra by the spawn (stripes along the road, laid across it).
  for (let i = 0; i < 7; i++) put(0.5, 2.6, cells[2], -3.0 + i * 1.0, -1.8, 0, ROAD_Y + 0.006);
  // Tar sealant over the old cracks.
  for (let i = 0; i < 10; i++) put(2.6, 2.6, cells[3], (R() - 0.5) * 5.6, zMax - 2 - R() * (len - 4), R() * 6);
  return { geos, texture: decalAtlas() };
}
