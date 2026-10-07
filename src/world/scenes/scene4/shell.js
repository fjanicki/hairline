import * as THREE from 'three';
import { W, D, H, IN_X, OUT_X, BACK_Z, FRONT_Z, ZB0, DOORWAY, WIN, GARAGE, DADO } from './layout.js';
import { slab, bx, tube, merged } from './geo.js';
import { floorTexture } from './textures.js';

// The room itself: concrete floor, whitewashed brick walls over an oil-painted dado, the internal
// doorway with the stairwell behind it, the high window, the roll-up garage door and the wet
// street under it, plus the skirting, frames, conduit and the shadow-only ceiling / fourth wall.

const CAP = 0x231f1b;

export function buildShell(ctx, group, surf) {
  const out = {};

  // ---- floor: the PBR garage concrete under a canvas of oil, drips and sawdust
  const floorMat = new THREE.MeshStandardMaterial({ color: '#a39b90', map: floorTexture(), roughness: 0.88, metalness: 0 });
  ctx.look?.enhance(floorMat, 'workshop.concrete', { albedo: 0.9, normalScale: 1.2, ao: 1 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), floorMat);
  floor.receiveShadow = true;
  floor.name = 'floor';
  group.add(floor);
  out.floorMat = floorMat;
  group.add(merged([bx(-OUT_X, OUT_X, -2.6, -0.01, ZB0, FRONT_Z + 0.02)], surf.capDark, { castShadow: false, name: 'under-slab' }));

  // Invisible shadow casters: a ceiling and a fourth wall, so daylight only enters under the garage
  // door and through the window.
  const shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const ceiling = new THREE.Mesh(bx(-OUT_X - 0.2, OUT_X + 0.2, H, H + 0.14, -D / 2 - 0.3, FRONT_Z + 0.05), shadowOnly);
  ceiling.castShadow = true;
  ceiling.name = 'ceiling-shadow-caster';
  const fourth = new THREE.Mesh(bx(-OUT_X, OUT_X, 0.0, H, FRONT_Z + 0.02, FRONT_Z + 0.12), shadowOnly);
  fourth.castShadow = true;
  fourth.name = 'fourth-wall-shadow-caster';
  group.add(ceiling, fourth);

  // ---- walls: brick above the dado, painted brick below (one mesh each)
  const o = { cap: CAP };
  const upper = [
    slab(-OUT_X, WIN.x0, DADO, H, ZB0, BACK_Z, o),
    slab(WIN.x0, WIN.x1, DADO, WIN.y0, ZB0, BACK_Z, o),
    slab(WIN.x0, WIN.x1, WIN.y1, H, ZB0, BACK_Z, o),
    slab(WIN.x1, DOORWAY.x0, DADO, H, ZB0, BACK_Z, o),
    slab(DOORWAY.x0, DOORWAY.x1, DOORWAY.h, H, ZB0, BACK_Z, o),
    slab(DOORWAY.x1, OUT_X, DADO, H, ZB0, BACK_Z, o),
    slab(-OUT_X, -IN_X, DADO, H, BACK_Z, GARAGE.z0, o),
    slab(-OUT_X, -IN_X, GARAGE.h, H, GARAGE.z0, GARAGE.z1, o),
    slab(-OUT_X, -IN_X, DADO, H, GARAGE.z1, FRONT_Z, o),
    slab(IN_X, OUT_X, DADO, H, BACK_Z, FRONT_Z, o),
  ];
  const lower = [
    slab(-OUT_X, DOORWAY.x0, 0, DADO, ZB0, BACK_Z, o),
    slab(DOORWAY.x1, OUT_X, 0, DADO, ZB0, BACK_Z, o),
    slab(-OUT_X, -IN_X, 0, DADO, BACK_Z, GARAGE.z0, o),
    slab(-OUT_X, -IN_X, 0, DADO, GARAGE.z1, FRONT_Z, o),
    slab(IN_X, OUT_X, 0, DADO, BACK_Z, FRONT_Z, o),
  ];
  group.add(merged(upper, surf.brick, { name: 'walls' }), merged(lower, surf.dado, { name: 'dado' }));
  // The building beyond the right wall, seen only as the dark section of the cut.
  group.add(merged([bx(OUT_X, OUT_X + 7, -2.6, H + 0.4, -D / 2 - 3, FRONT_Z)], surf.capDark, { castShadow: false, name: 'building-mass' }));

  // ---- trims: skirting, dado rail, the doorway architrave, the window frame (painted timber)
  const z1 = BACK_Z;
  const trim = [
    bx(-IN_X, DOORWAY.x0 - 0.07, 0, 0.14, z1, z1 + 0.022),
    bx(DOORWAY.x1 + 0.07, IN_X, 0, 0.14, z1, z1 + 0.022),
    bx(IN_X - 0.022, IN_X, 0, 0.14, z1 + 0.022, FRONT_Z - 0.01),
    bx(-IN_X, -IN_X + 0.022, 0, 0.14, z1 + 0.022, GARAGE.z0 - 0.06),
    bx(-IN_X, -IN_X + 0.022, 0, 0.14, GARAGE.z1 + 0.06, FRONT_Z - 0.01),
    // dado rail
    bx(-IN_X, DOORWAY.x0 - 0.07, DADO - 0.02, DADO + 0.035, z1, z1 + 0.03),
    bx(DOORWAY.x1 + 0.07, IN_X, DADO - 0.02, DADO + 0.035, z1, z1 + 0.03),
    bx(IN_X - 0.03, IN_X, DADO - 0.02, DADO + 0.035, z1 + 0.03, FRONT_Z - 0.01),
    bx(-IN_X, -IN_X + 0.03, DADO - 0.02, DADO + 0.035, z1 + 0.03, GARAGE.z0 - 0.06),
    bx(-IN_X, -IN_X + 0.03, DADO - 0.02, DADO + 0.035, GARAGE.z1 + 0.06, FRONT_Z - 0.01),
    // architrave
    bx(DOORWAY.x0 - 0.07, DOORWAY.x0, 0, DOORWAY.h + 0.07, z1, z1 + 0.035),
    bx(DOORWAY.x1, DOORWAY.x1 + 0.07, 0, DOORWAY.h + 0.07, z1, z1 + 0.035),
    bx(DOORWAY.x0 - 0.07, DOORWAY.x1 + 0.07, DOORWAY.h, DOORWAY.h + 0.08, z1, z1 + 0.04),
    // door stop inside the reveal, and the worn threshold
    bx(DOORWAY.x0, DOORWAY.x0 + 0.03, 0, DOORWAY.h, ZB0 + 0.02, ZB0 + 0.06),
    bx(DOORWAY.x1 - 0.03, DOORWAY.x1, 0, DOORWAY.h, ZB0 + 0.02, ZB0 + 0.06),
  ];
  group.add(merged(trim, surf.trim, { castShadow: false, name: 'trim' }));
  group.add(merged([bx(DOORWAY.x0, DOORWAY.x1, 0, 0.02, ZB0, BACK_Z + 0.04)], surf.timberDark, { castShadow: false, name: 'threshold' }));

  // The window: a steel frame with glazing bars, a deep concrete sill, and the glass shader.
  const wy = (WIN.y0 + WIN.y1) / 2;
  const frame = [
    bx(WIN.x0 - 0.05, WIN.x1 + 0.05, WIN.y1, WIN.y1 + 0.05, z1, z1 + 0.03),
    bx(WIN.x0 - 0.05, WIN.x0, WIN.y0, WIN.y1, z1, z1 + 0.03),
    bx(WIN.x1, WIN.x1 + 0.05, WIN.y0, WIN.y1, z1, z1 + 0.03),
    ...[0.25, 0.5, 0.75].map((k) => bx(WIN.x0 + (WIN.x1 - WIN.x0) * k - 0.012, WIN.x0 + (WIN.x1 - WIN.x0) * k + 0.012, WIN.y0, WIN.y1, ZB0 + 0.06, ZB0 + 0.09)),
    bx(WIN.x0, WIN.x1, wy - 0.012, wy + 0.012, ZB0 + 0.06, ZB0 + 0.09),
    // A top-hung vent pane, propped open a crack.
    bx(WIN.x0 + 0.02, WIN.x0 + (WIN.x1 - WIN.x0) * 0.25 - 0.02, WIN.y1 - 0.02, WIN.y1, ZB0 + 0.09, ZB0 + 0.12),
  ];
  group.add(merged(frame, surf.steelPainted, { castShadow: false, name: 'window-frame' }));
  group.add(merged([bx(WIN.x0 - 0.1, WIN.x1 + 0.1, WIN.y0 - 0.06, WIN.y0, ZB0, z1 + 0.11)], surf.kerb, { castShadow: true, name: 'sill' }));

  // ---- conduit, the fuse box, switch and sockets (one painted-steel mesh)
  const cz = z1 + 0.02;
  const conduit = [
    // fuse box at the left end of the back wall, conduit up to the ceiling line and along it
    bx(-4.28, -3.86, 1.5, 1.98, z1, z1 + 0.12),
    tube([-4.07, 1.98, cz], [-4.07, 3.06, cz], 0.012),
    tube([-4.07, 3.06, cz], [WIN.x0 - 0.12, 3.06, cz], 0.012),
    tube([-4.0, 1.5, cz], [-4.0, 0.42, cz], 0.012),
    tube([-4.0, 0.42, cz], [-3.62, 0.42, cz], 0.012),
    // down to the bench sockets (two double sockets above the splash-back)
    tube([-1.2, 3.06, cz], [-1.2, 1.24, cz], 0.011),
    bx(-1.32, -1.08, 1.12, 1.26, z1, z1 + 0.045),
    tube([-3.0, 3.06, cz], [-3.0, 2.36, cz], 0.011),
    // to the switch by the doorway
    tube([WIN.x0 - 0.12, 3.06, cz], [WIN.x1 + 0.12, 3.06, cz], 0.012),
    tube([WIN.x1 + 0.12, 3.06, cz], [DOORWAY.x0 - 0.16, 3.06, cz], 0.012),
    tube([DOORWAY.x0 - 0.16, 3.06, cz], [DOORWAY.x0 - 0.16, 1.4, cz], 0.011),
    bx(DOORWAY.x0 - 0.22, DOORWAY.x0 - 0.1, 1.24, 1.38, z1, z1 + 0.04),
    // a socket low on the back wall by the shelf (the extension cable plugs in here)
    tube([-0.75, 3.06, cz], [-0.75, 0.42, cz], 0.011),
    bx(-0.82, -0.68, 0.3, 0.42, z1, z1 + 0.045),
    // saddle clips
    ...[-3.5, -2.2, -0.9, 0.6, 2.2].map((x) => bx(x - 0.015, x + 0.015, 3.04, 3.08, z1, z1 + 0.045)),
  ];
  group.add(merged(conduit, surf.steelPainted, { castShadow: false, name: 'conduit' }));
  out.socket = new THREE.Vector3(-0.75, 0.36, z1 + 0.05);

  // ---- the roll-up garage door (half open), its drum, guide channels and pull rope
  const gz = (GARAGE.z0 + GARAGE.z1) / 2;
  const gdoor = new THREE.Mesh(bx(-IN_X + 0.02, -IN_X + 0.05, GARAGE.open, GARAGE.h + 0.02, GARAGE.z0 - 0.02, GARAGE.z1 + 0.02), surf.shutter);
  gdoor.castShadow = true;
  gdoor.receiveShadow = true;
  gdoor.name = 'garage-door';
  group.add(gdoor);
  group.add(
    merged(
      [
        new THREE.CylinderGeometry(0.17, 0.17, GARAGE.z1 - GARAGE.z0 + 0.16, 20).rotateX(Math.PI / 2).translate(-IN_X + 0.21, GARAGE.h + 0.2, gz),
        bx(-IN_X + 0.02, -IN_X + 0.1, GARAGE.open - 0.05, GARAGE.open, GARAGE.z0, GARAGE.z1),
        bx(-IN_X, -IN_X + 0.08, 0, GARAGE.h + 0.1, GARAGE.z0 - 0.07, GARAGE.z0),
        bx(-IN_X, -IN_X + 0.08, 0, GARAGE.h + 0.1, GARAGE.z1, GARAGE.z1 + 0.07),
        bx(-IN_X + 0.02, -IN_X + 0.4, GARAGE.h + 0.0, GARAGE.h + 0.05, GARAGE.z0 - 0.1, GARAGE.z0 - 0.06),
        bx(-IN_X + 0.02, -IN_X + 0.4, GARAGE.h + 0.0, GARAGE.h + 0.05, GARAGE.z1 + 0.06, GARAGE.z1 + 0.1),
      ],
      surf.steel,
      { name: 'garage-hardware' },
    ),
  );
  group.add(merged([tube([-IN_X + 0.12, GARAGE.open - 0.03, GARAGE.z1 - 0.12], [-IN_X + 0.16, 0.95, GARAGE.z1 - 0.1], 0.006)], surf.cord, { castShadow: false, name: 'pull-rope' }));

  // ---- outside: wet cobbles, pavement and kerb, the building opposite with a shut shopfront
  const street = new THREE.Mesh(new THREE.PlaneGeometry(6, 11).rotateX(-Math.PI / 2), surf.street);
  street.position.set(-OUT_X - 3.6, -0.11, -2.5);
  street.receiveShadow = true;
  street.name = 'street';
  const pave = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 11).rotateX(-Math.PI / 2), surf.pavement);
  pave.position.set(-OUT_X - 0.7, -0.004, -2.5);
  pave.receiveShadow = true;
  group.add(street, pave);
  group.add(merged([bx(-OUT_X - 1.55, -OUT_X - 1.4, -0.12, 0.0, -8, 3)], surf.kerb, { castShadow: false, name: 'kerb' }));
  const opp = merged([bx(-OUT_X - 7.0, -OUT_X - 6.6, -0.12, 7, -8, 3)], surf.facade, { castShadow: false, name: 'facade-opposite' });
  group.add(opp);
  group.add(merged([bx(-OUT_X - 6.62, -OUT_X - 6.56, 0, 2.6, -1.2, 1.9)], surf.shutter, { castShadow: false, name: 'shop-shutter' }));
  // A downpipe and a lit window opposite (rain-blurred, a hint of life).
  group.add(merged([tube([-OUT_X - 6.5, -0.1, -2.1], [-OUT_X - 6.5, 6.5, -2.1], 0.05)], surf.steelPainted, { castShadow: false, name: 'downpipe' }));

  // ---- the stairwell behind the internal doorway (up to Hugo's flat)
  const well = new THREE.Mesh(bx(DOORWAY.x0 - 0.3, DOORWAY.x1 + 0.6, 0, 2.9, -4.5, ZB0 - 0.001), surf.stairWall);
  well.receiveShadow = true;
  well.name = 'stairwell';
  group.add(well);
  const steps = [];
  for (let i = 0; i < 7; i++) steps.push(bx(DOORWAY.x0 - 0.3, DOORWAY.x1 - 0.05, 0.17 * i, 0.17 * (i + 1), -4.5, -4.5 + 0.19 * (7 - i)));
  group.add(merged(steps, surf.stairStep, { castShadow: false, name: 'stairs' }));
  group.add(merged([tube([DOORWAY.x1 - 0.12, 0.95, -3.1], [DOORWAY.x1 - 0.12, 2.15, -4.45], 0.02)], surf.timberDark, { castShadow: false, name: 'handrail' }));

  return out;
}

