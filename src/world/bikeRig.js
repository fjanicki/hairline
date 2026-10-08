import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as B from './build.js';

// The workshop rig for a build.bicycle() (moved out of scene4.js; Ch4 Week 4 and Ch5 Ines's wheel):
// rear-wheel spin, a rim that wanders sideways (a yaw pivot round the axle), brake pads that flash on
// the rub, "pushed by" follow, and a manual mode for truing (crafts/truing.js).
//
// Angles: the rig's `angle` turns the rear wheel (rear.rotation.x = -angle). Spoke i sits at
// i * 22.5 deg in the wheel, measured from the bike's +Z (front) toward +Y (up); at rig angle a it
// shows at i * 22.5 deg + a. So rig.TOP (12 o'clock) is PI/2 and the pads sit at rig.PAD.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const bx = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
const RUB = 0.012; // rad of rim yaw at the pad that touches it (lateral mode)

/**
 * rigBike(bike) -> rig. Spin and wobble as before (setSpin / setWobble / syncRub), plus:
 *   setAngle(rad)       manual: the wheel sits at `rad` (spin 0) until the next setSpin()
 *   setLateral(fn)      fn(angle) -> rad of yaw at the pad replaces the cosine wobble; null restores it
 *   flashPad()          the pad flash on its own
 *   onRub(dev)          called on a rub: the worst point passing the pads (either direction), or in
 *                       lateral mode |fn| rising past 0.012 rad (dev = that |fn|)
 *   spokes              the rear wheel's LineSegments (bike.userData.spokes[1])
 */
export function rigBike(bike) {
  const [front, rear] = bike.userData.wheels;
  // Insert a yaw pivot between the bike and the rear wheel so the whole wheel can wander sideways.
  const yaw = new THREE.Group();
  yaw.position.copy(rear.position);
  bike.add(yaw);
  bike.remove(rear);
  rear.position.set(0, 0, 0);
  yaw.add(rear);
  // Rear brake pads, where the seat stays bridge over the rim.
  const padMat = new THREE.MeshStandardMaterial({ color: '#1e1e20', roughness: 0.9, emissive: '#000000' });
  const padGeo = mergeGeometries([bx(-0.034, -0.018, -0.012, 0.012, -0.022, 0.022), bx(0.018, 0.034, -0.012, 0.012, -0.022, 0.022)]);
  const pads = new THREE.Mesh(padGeo, padMat);
  const R = bike.userData.wheelRadius;
  const ang = Math.atan2(0.27, 0.42); // toward the seat-stay bridge
  pads.position.set(0, yaw.position.y + Math.cos(ang) * (R - 0.03), yaw.position.z + Math.sin(ang) * (R - 0.03));
  bike.add(pads);
  const bridge = new THREE.Mesh(bx(-0.05, 0.05, -0.006, 0.006, -0.008, 0.008), B.mat('#9a9c9e', { roughness: 0.4, metalness: 0.6 }));
  bridge.position.copy(pads.position);
  bridge.position.y += 0.02;
  bike.add(bridge);

  const st = {
    spin: 0, // rev/s of the rear wheel
    spinTarget: 0,
    angle: 0,
    amp: 0, // wobble amplitude (rad of yaw)
    rubAngle: 0,
    flash: 0,
    follow: null,
    lastPos: new THREE.Vector3(),
    manual: false,
    lateral: null,
    rubbing: false,
  };
  const TAU = Math.PI * 2;
  const rub = (dev) => {
    st.flash = 1;
    try {
      api.onRub?.(dev);
    } catch (err) {
      console.error('[bikeRig] onRub failed', err);
    }
  };
  const api = {
    group: bike,
    rear,
    front,
    yaw,
    pads,
    st,
    R,
    spokes: bike.userData.spokes[1],
    TOP: Math.PI / 2,
    PAD: Math.PI / 2 - ang,
    /** Called each time the rim's worst point passes the pads while the wheel is out of true. */
    onRub: null,
    setSpin(revPerSec, { snap = false } = {}) {
      st.manual = false;
      st.spinTarget = revPerSec;
      if (snap) st.spin = revPerSec;
    },
    setWobble(a) {
      st.amp = a;
    },
    /** The rim's worst point reaches the pad `secs` from now (at the current spin). */
    syncRub(secs) {
      st.rubAngle = st.angle + Math.PI * 2 * st.spin * secs;
    },
    rub() {
      st.flash = 1;
    },
    flashPad() {
      st.flash = 1;
    },
    /** Manual mode: the wheel sits at `rad` (no spin) until setSpin(). */
    setAngle(rad) {
      st.manual = true;
      st.spin = st.spinTarget = 0;
      st.angle = rad;
    },
    /** fn(angle) -> yaw (rad) of the rim at the pads; null goes back to the cosine wobble. */
    setLateral(fn) {
      st.lateral = typeof fn === 'function' ? fn : null;
      st.rubbing = false;
    },
    /** Walk the bike beside `char` (on the side away from the camera). null stops. */
    follow(char) {
      st.follow = char;
      if (char) st.lastPos.copy(char.root.position);
    },
    update(dt) {
      const before = Math.floor((st.angle - st.rubAngle) / TAU);
      if (!st.manual) {
        st.spin = damp(st.spin, st.spinTarget, 2.5, dt);
        st.angle += TAU * st.spin * dt;
      }
      rear.rotation.x = -st.angle;
      const target = st.lateral ? clamp(st.lateral(st.angle) || 0, -0.3, 0.3) : st.amp * Math.cos(st.angle - st.rubAngle);
      yaw.rotation.y = damp(yaw.rotation.y, target, 14, dt);
      st.flash = Math.max(0, st.flash - dt * 4);
      padMat.emissive.setRGB(1.4 * st.flash, 0.72 * st.flash, 0.3 * st.flash); // hot rubber: reads through the grade
      if (st.follow) {
        const r = st.follow.root;
        const a = r.rotation.y;
        const fwd = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
        const left = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
        if (left.z > 0) left.negate(); // keep the bike on the far side of the kid
        bike.position.copy(r.position).addScaledVector(left, 0.42).addScaledVector(fwd, 0.12);
        bike.position.y = 0;
        bike.rotation.set(0, a, 0);
        const moved = r.position.distanceTo(st.lastPos);
        st.lastPos.copy(r.position);
        front.rotation.x -= moved / R;
        st.angle += moved / R;
      }
      if (st.lateral) {
        const dev = Math.abs(target);
        if (dev > RUB && !st.rubbing) rub(dev);
        st.rubbing = dev > RUB;
      } else {
        const after = Math.floor((st.angle - st.rubAngle) / TAU);
        if (after !== before && st.amp > 0.015) rub(st.amp);
      }
    },
  };
  return api;
}
