// Ch4 workshop layout: one place for the room's measurements, shared by scene4.js and the dressing
// modules in this folder. Metres; camera at +Z looking toward -Z; the +Z wall is the dollhouse cut.
//
//   back wall z = -3:  drums | main bench + vice, pegboard above, fluorescent tube | steel paint shelf |
//                      high grimy window over a small bench | plank stack | internal doorway (x 3.4)
//   left wall (street): roll-up garage door, half open, grey daylight and the wet street under it
//   right wall:         leaning old signs (back), Odile's corner: chair, floor lamp, radio, kettle (front)
//   centre:             the old door on two trestles under the bare bulb (the sanding station)
//   front-left:         the bike repair stand; crates, ladder and the pump in the corner

export const W = 9;
export const D = 6;
export const H = 3.3;
export const T = 0.18;
export const IN_X = W / 2 - T / 2; // 4.41, inner face of the side walls
export const BACK_Z = -D / 2 + T / 2; // -2.91, inner face of the back wall
export const OUT_X = W / 2 + T / 2; // 4.59
export const FRONT_Z = D / 2; // 3.0, the dollhouse cut
export const ZB0 = -D / 2 - T / 2; // outer face of the back wall

export const DOORWAY = { x0: 2.98, x1: 3.82, h: 2.06 };
export const DOOR_X = (DOORWAY.x0 + DOORWAY.x1) / 2; // 3.4
export const WIN = { x0: 0.3, x1: 1.7, y0: 2.25, y1: 2.95 };
export const GARAGE = { z0: -1.3, z1: 1.1, h: 2.5, open: 1.35 }; // opening on the left wall; door bottom at `open`
export const BENCH = { x0: -3.6, x1: -0.7, z0: BACK_Z, z1: -2.16, top: 0.92 };
export const TRESTLE = { x: 0.3, z: -0.2, top: 0.75 };
export const DOOR_LEN = 2.0;
export const DOOR_WID = 0.82;
export const DOOR_THK = 0.04;
export const STAND = { x: -2.5, z: 1.5, lift: 0.25 };
export const EASEL = { x: -1.55, z: -2.55 };
export const BOARD_W = 0.72;
export const BOARD_H = 0.36;
export const BOARD_PX = [1024, 512];
export const DADO = 1.1; // painted brick up to here

export const BULB = { x: TRESTLE.x, y: 2.45, z: TRESTLE.z };
export const TUBE = { x: -2.15, y: 2.78, z: -2.5 };
export const PEG = { x: -2.62, y: 1.75, w: 1.75, h: 1.15, px: [1024, 672] };
export const SHELF = { x: -0.1, z: BACK_Z + 0.245, h: 2.0 }; // steel paint shelf (Poly Haven), front at ~-2.43
export const SIDE = { x0: 0.82, x1: 2.12, z0: BACK_Z, z1: -2.38, top: 0.86 }; // small bench under the window
export const LAMP = { x: 4.1, z: 0.55 };
export const STOOL = { x: -3.25, z: -1.9 }; // home position (left end of the bench)

export const WOOD_GREY = '#8d877c';
export const SIGN_RED = '#a3392b';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
