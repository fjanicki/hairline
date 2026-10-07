import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CLIP_SPEED, WALK_CONTACT } from '../characters/cast.js';

/** Hugo's default body colour: slate (mid value so it survives the grade). */
export const HUGO_TINT = 0x4a5260;

const _d = new THREE.Vector3();
const TAU = Math.PI * 2;

function dampAngle(a, b, lambda, dt) {
  let d = ((b - a + Math.PI) % TAU) - Math.PI;
  if (d < -Math.PI) d += TAU;
  return a + d * (1 - Math.exp(-lambda * dt));
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Pose targets applied to char.model (offset y, pitch x) on top of the limp dip. The capsule
// fallback has no clips, so its sit/crouch keep the old offsets (fallbackY).
const POSES = {
  stand: { y: 0, pitch: 0, clip: 'idle' },
  crouch: { y: 0, pitch: 0, clip: 'crouch_idle', fallbackY: -0.32 }, // measuring low (Ch4)
  sit: { y: 0, pitch: 0, clip: 'sit_idle', fallbackY: -0.42 }, // benches: seat about 0.45 m
  fall: { y: 0.12, pitch: Math.PI / 2, clip: 'idle' }, // face down, head forward (+Z local)
  lie: { y: 0.12, pitch: Math.PI / 2, clip: 'idle' },
};

const DEFAULTS = {
  spawn: [0, 0],
  facing: Math.PI, // facing -Z
  limp: 1,
  painRate: 1 / 0.6,
  painCap: 0,
  canJog: true,
  showPain: true,
  bounds: null,
  footsteps: 'concrete',
  walkSpeed: 1.3,
  jogSpeed: 2.6,
  boot: false,
  tint: HUGO_TINT,
  outfit: 'civilian',
};

const BOOT_SHELL = '#d2d4d6'; // off-white medical plastic
const BOOT_FIT = 1.06; // the shell is widened to swallow the calf-high work boot under it
const BOOT_LINER = '#6b6f75'; // padded fabric sleeve (lighter than the trousers, so the boot reads apart)
const BOOT_FOAM = '#9a9ea4'; // the liner's foam lip at the cuff
const BOOT_STRAP = '#1c1d20'; // black Velcro
const BOOT_SOLE = '#2a2b2e'; // rubber rocker sole
const BOOT_ANKLE = 0.09; // ankle height above the floor in the bind pose (Universal rig)

/** A rounded-rectangle band (w x d, corner r) extruded `t` along +Y: the Velcro straps. */
function band(w, d, r, t) {
  const s = new THREE.Shape();
  const x = w / 2;
  const z = d / 2;
  s.moveTo(-x + r, -z);
  s.lineTo(x - r, -z);
  s.quadraticCurveTo(x, -z, x, -z + r);
  s.lineTo(x, z - r);
  s.quadraticCurveTo(x, z, x - r, z);
  s.lineTo(-x + r, z);
  s.quadraticCurveTo(-x, z, -x, z - r);
  s.lineTo(-x, -z + r);
  s.quadraticCurveTo(-x, -z, -x + r, -z);
  const geo = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2); // extrusion along +Y, shape in XZ
  return geo;
}

let _bootTex = null;
/**
 * The boot's procedural maps (shared): a fine hook-and-loop bump for the Velcro and the liner, a
 * faint mottle for the plastic's roughness, and the rocker sole's tread grooves.
 */
function bootTextures() {
  if (_bootTex) return _bootTex;
  const canvas = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    t.userData.shared = true;
    return t;
  };
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const noise = (g, w, h, lo, hi, n) => {
    g.fillStyle = `rgb(${lo},${lo},${lo})`;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      const v = lo + rnd() * (hi - lo);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
    }
  };
  const velcro = canvas(128, 128, (g, w, h) => noise(g, w, h, 70, 230, 9000));
  velcro.repeat.set(6, 2);
  const mottle = canvas(128, 128, (g, w, h) => {
    noise(g, w, h, 150, 200, 2500);
    g.filter = 'blur(2px)';
    g.drawImage(g.canvas, 0, 0);
  });
  const tread = canvas(64, 32, (g, w, h) => {
    g.fillStyle = '#c8c8c8';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#303030';
    for (let x = 2; x < w; x += 8) g.fillRect(x, 0, 3, h); // lugs on the sole's edge
    g.fillRect(0, h - 6, w, 6);
  });
  tread.repeat.set(5, 1);
  _bootTex = { velcro, mottle, tread };
  return _bootTex;
}

/**
 * The walking boot (an air-cast style walker), in metres: ankle at the origin, +Y up the shin, +Z
 * toward the toes. Off-white plastic struts and foot shell over a padded grey liner (foam lip at the
 * cuff), three black Velcro straps with D-rings plus one over the forefoot, and a treaded rocker sole.
 * A Group of one mesh per material (all shadow casters). Player.weatherBoot() patches the shared
 * materials with the chapter's grime and wet.
 */
function makeBootMesh(shin = 0.42) {
  const T = bootTextures();
  const at = (geo, x, y, z) => geo.translate(x, y, z);
  const h = Math.max(0.24, shin * 0.88); // up to just below the knee, over the work boot's cuff
  const floor = -BOOT_ANKLE;
  const mats = {
    shell: new THREE.MeshStandardMaterial({ color: BOOT_SHELL, roughness: 0.48, roughnessMap: T.mottle, metalness: 0 }),
    liner: new THREE.MeshStandardMaterial({ color: BOOT_LINER, roughness: 0.95, bumpMap: T.velcro, bumpScale: 0.6 }),
    foam: new THREE.MeshStandardMaterial({ color: BOOT_FOAM, roughness: 0.9, bumpMap: T.velcro, bumpScale: 0.3 }),
    strap: new THREE.MeshStandardMaterial({ color: BOOT_STRAP, roughness: 0.92, bumpMap: T.velcro, bumpScale: 1.2 }),
    ring: new THREE.MeshStandardMaterial({ color: '#8a8d92', roughness: 0.35, metalness: 0.85 }),
    sole: new THREE.MeshStandardMaterial({ color: BOOT_SOLE, roughness: 0.85, map: T.tread }),
  };
  const groups = {
    liner: [
      at(new RoundedBoxGeometry(0.136, h, 0.146, 3, 0.05), 0, h / 2 - 0.03, -0.004),
      at(new RoundedBoxGeometry(0.146, 0.095, 0.29, 3, 0.04), 0, floor + 0.09, 0.07), // padded foot
    ],
    foam: [at(new RoundedBoxGeometry(0.146, 0.03, 0.156, 2, 0.014), 0, h - 0.035, -0.004)],
    shell: [
      // Side struts and the rear spine of the shin cage; the foot shell under the forefoot strap.
      ...[-1, 1].map((sx) => at(new RoundedBoxGeometry(0.014, h - 0.03, 0.07, 2, 0.006), sx * 0.073, (h - 0.03) / 2 - 0.03, 0.005)),
      at(new RoundedBoxGeometry(0.1, h * 0.78, 0.014, 2, 0.006), 0, (h * 0.78) / 2 - 0.03, -0.077),
      // The footbed frame: a plastic tray round the padded foot, above the rocker sole.
      at(new RoundedBoxGeometry(0.16, 0.034, 0.318, 2, 0.012), 0, floor + 0.048, 0.073),
      at(new RoundedBoxGeometry(0.152, 0.07, 0.022, 2, 0.008), 0, floor + 0.07, -0.078), // heel cup
    ],
    sole: [at(new RoundedBoxGeometry(0.162, 0.04, 0.33, 2, 0.016), 0, floor + 0.015, 0.075)],
    strap: [
      ...[0.2, 0.5, 0.8].map((k) => at(band(0.162, 0.17, 0.05, 0.03), 0, (h - 0.06) * k - 0.013, -0.004)),
      at(band(0.162, 0.122, 0.046, 0.034).rotateX(Math.PI / 2), 0, floor + 0.087, 0.11), // over the forefoot
    ],
    ring: [0.2, 0.5, 0.8].map((k) => at(new THREE.TorusGeometry(0.012, 0.0026, 5, 10).rotateY(Math.PI / 2), 0.084, (h - 0.06) * k + 0.002, 0.03)),
  };
  const boot = new THREE.Group();
  boot.name = 'walking-boot';
  for (const [k, geos] of Object.entries(groups)) {
    for (const g of geos) if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const geo = mergeGeometries(geos, false) || geos[0];
    for (const g of geos) if (g !== geo) g.dispose();
    const mesh = new THREE.Mesh(geo, mats[k]);
    mesh.name = 'walking-boot:' + k;
    mesh.castShadow = k !== 'ring';
    mesh.receiveShadow = true;
    boot.add(mesh);
  }
  boot.userData.materials = Object.values(mats);
  return boot;
}

const _m1 = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _va = new THREE.Vector3();
const _vb = new THREE.Vector3();
const _vc = new THREE.Vector3();
const _ws = new THREE.Vector3();

/**
 * The limping protagonist (Hugo).
 * limp, footsteps, painRate, canJog, showPain, painCap are plain fields: chapters may write them
 * mid-scene without configure() (which would reset the pose). firstStumbleDone is public too:
 * set it to true to make the next stumble draw from the bag instead of L.stumble.first. World-relative WASD, Shift to (try to) jog, pain meter, stumbles.
 * Flags:
 *   frozen   - no movement, idles (set by Director.say)
 *   scripted - Player does nothing at all; chapter code drives root/animations (Runner, sprint)
 *   locked   - seconds of locked input after a stumble
 *   inputAllowed() - global gate (main.js: false while the Director is in 'boot' / 'transition' / 'end')
 */
export class Player {
  constructor({ input, audio, ui, cam, char, lines }) {
    this.input = input;
    this.audio = audio;
    this.ui = ui;
    this.cam = cam;
    this.char = char;
    this.root = char.root;
    this.model = char.model;
    this.lines = lines; // { first, bag }
    this.firstStumbleDone = false;
    this._bag = [];
    this._events = {};

    this.pain = 0;
    this.locked = 0;
    this.frozen = false;
    this.scripted = false;
    this.moving = false;
    this.jogging = false;
    this.hasJogged = false;
    this.stumbles = 0;
    this.speed = 0;
    this.poseOffset = { y: 0, pitch: 0 }; // extra chapter-driven offset on top of the pose (Ch3 set/lean)
    this._pose = { name: 'stand', y: 0, pitch: 0, fromY: 0, fromPitch: 0, t: 1, dur: 0, resolve: null };
    this._lurch = 0;
    this._lastPhase = 0;
    this._stepFlip = false;
    this.inputAllowed = () => true; // main.js: false outside play (title, transitions, end card)
    this.boot = false;
    this._bootObj = null;
    this.configure({});
  }

  /**
   * Per-chapter setup (Director calls it with chapter.player).
   * opts: { spawn:[x,z] | [x,y,z], facing (rad, 0 = +Z, PI = -Z), limp 0..1, painRate (1/secondsToMax),
   *         painCap (0 = none, e.g. 0.9 prevents stumbles), canJog, showPain, bounds:[{minX,maxX,minZ,maxZ}],
   *         footsteps:'concrete'|'boot'|null, walkSpeed=1.3, jogSpeed=2.6,
   *         boot=false (walking boot on the left shin), tint=HUGO_TINT,
   *         outfit='civilian' ('runner' | 'runner_dawn': the athletic body in painted kit) }
   * Not sticky: every call applies the defaults for anything it omits (Ch3's green kit and bare
   * leg never carry into Ch4).
   */
  configure(opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    this.char.setOutfit?.(o.outfit);
    this.setBoot(!!o.boot);
    this.char.setTint?.(o.tint);
    Object.assign(this, {
      limp: o.limp,
      painRate: o.painRate,
      painCap: o.painCap,
      canJog: o.canJog,
      showPain: o.showPain,
      footsteps: o.footsteps,
      walkSpeed: o.walkSpeed,
      jogSpeed: o.jogSpeed,
    });
    if (o.bounds) this.bounds = o.bounds;
    else if (!this.bounds) this.bounds = [];
    if (opts.spawn) {
      const s = opts.spawn;
      if (s.length === 3) this.teleport(s[0], s[2], o.facing, s[1]);
      else this.teleport(s[0], s[1], o.facing);
    } else if (opts.facing !== undefined) this.root.rotation.y = opts.facing;
    this.pain = 0;
    this.locked = 0;
    this.frozen = false;
    this.scripted = false;
    this.root.visible = true;
    this.poseOffset.y = 0;
    this.poseOffset.pitch = 0;
    this.setPose('stand', 0);
  }

  get position() {
    return this.root.position;
  }

  /**
   * Show or hide the walking boot on the left shin. No pose reset, so it is safe mid-scene
   * (Ch5 bench: setBoot(false), then set limp / footsteps directly).
   * Parented to the left shin bone (calf_l); the capsule fallback gets a box at its left base.
   */
  setBoot(on) {
    on = !!on;
    this.boot = on;
    if (on && !this._bootObj) {
      this._bootObj = this._makeBoot();
      if (this._bootWeather) this.weatherBoot(this._bootWeather.materials, this._bootWeather);
    }
    if (this._bootObj) this._bootObj.visible = on;
    this.char.hideLeftFoot?.(on); // the work boot under the shell would poke through it
  }

  /**
   * Weather the boot like the chapter's surfaces (main.js, after each build): `materials` is
   * ctx.materials, `w` = { grime, wet } from the chapter look. Patches once, then updates.
   */
  weatherBoot(materials, { grime = 0.5, wet = 0 } = {}) {
    this._bootWeather = { materials, grime, wet };
    const mats = [];
    this._bootObj?.traverse((o) => o.userData.materials && mats.push(...o.userData.materials));
    for (const m of mats) {
      if (m.userData.hlPatched) materials.setWeather(m, { grime: grime * 0.6, wet });
      else {
        materials.weather(m, { grime: grime * 0.6, wet });
        m.userData.hlPatched = true;
      }
    }
  }

  _makeBoot() {
    const char = this.char;
    const leg = char.isFallback ? null : char.bone('LeftLeg');
    const foot = leg ? char.bone('LeftFoot') : null;
    if (!leg || !foot) {
      // Capsule stand-in: the character's left is +X when it faces +Z.
      const b = makeBootMesh(0.42);
      b.position.set(0.11 * (this.model.scale.y || 1), 0.12, 0);
      this.model.add(b);
      return b;
    }
    // Bind-pose positions of knee, ankle and toe in LeftLeg's local space (so the current
    // animation frame doesn't skew it). Falls back to the current local transforms.
    let mesh = null;
    this.model.traverse((o) => {
      if (!mesh && o.isSkinnedMesh && o.skeleton?.bones.includes(leg)) mesh = o;
    });
    const toe = char.bone('LeftToeBase') || char.bone('LeftToe_End'); // ball_l / ball_leaf_l
    const ankle = _va.copy(foot.position);
    const toePos = _vb.set(0, 0, 0);
    let haveToe = false;
    if (mesh) {
      const sk = mesh.skeleton;
      const bind = (bone) => _m2.copy(sk.boneInverses[sk.bones.indexOf(bone)]).invert();
      const legInv = _m1.copy(sk.boneInverses[sk.bones.indexOf(leg)]); // inverse(bindLeg)
      ankle.setFromMatrixPosition(bind(foot)).applyMatrix4(legInv);
      if (toe && sk.bones.includes(toe)) {
        toePos.setFromMatrixPosition(bind(toe)).applyMatrix4(legInv);
        haveToe = true;
      }
    } else if (toe) {
      toePos.copy(toe.position).applyQuaternion(foot.quaternion).add(foot.position);
      haveToe = true;
    }
    this.root.updateMatrixWorld(true);
    leg.getWorldScale(_ws);
    const ws = _ws.y || 1;
    const shinM = ankle.length() * ws; // metres
    // Basis: +Y = ankle -> knee, +Z = toward the toes (perpendicular to the shin).
    const up = _vc.copy(ankle).multiplyScalar(-1).normalize();
    const fwd = haveToe ? toePos.clone().sub(ankle) : new THREE.Vector3(0, 0, 1);
    fwd.addScaledVector(up, -fwd.dot(up));
    if (fwd.lengthSq() < 1e-8) fwd.set(1, 0, 0).addScaledVector(up, -up.x);
    fwd.normalize();
    const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
    const holder = new THREE.Group();
    holder.name = 'boot-holder';
    holder.quaternion.setFromRotationMatrix(_m1.makeBasis(right, up, fwd));
    holder.position.copy(ankle);
    holder.scale.set(BOOT_FIT / ws, 1 / ws, BOOT_FIT / ws); // built in metres whatever the rig scale
    holder.add(makeBootMesh(shinM));
    leg.add(holder);
    return holder;
  }

  on(name, fn) {
    (this._events[name] ||= []).push(fn);
    return () => {
      const a = this._events[name];
      const i = a.indexOf(fn);
      if (i >= 0) a.splice(i, 1);
    };
  }

  _emit(name, ...args) {
    for (const fn of this._events[name] || []) {
      try {
        fn(...args);
      } catch (err) {
        console.error('[player] listener failed', err);
      }
    }
  }

  /** Remove every event listener (Director calls this between chapters). */
  clearListeners() {
    this._events = {};
  }

  teleport(x, z, facing, y = 0) {
    this.root.position.set(x, y, z);
    if (facing !== undefined) this.root.rotation.y = facing;
  }

  /** Turn to face a world point immediately. */
  face(x, z) {
    const p = this.root.position;
    this.root.rotation.y = Math.atan2(x - p.x, z - p.z);
  }

  inBounds(x, z) {
    if (!this.bounds || !this.bounds.length) return true;
    return this.bounds.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
  }

  tryMove(dx, dz) {
    const p = this.root.position;
    if (this.inBounds(p.x + dx, p.z)) p.x += dx;
    if (this.inBounds(p.x, p.z + dz)) p.z += dz;
  }

  /** Blend to a pose: 'stand' | 'crouch' | 'sit' | 'fall' | 'lie'. Resolves when the blend ends. */
  setPose(name, dur = 0.6) {
    const target = POSES[name] || POSES.stand;
    const p = this._pose;
    p.resolve?.();
    const toY = this.char.isFallback ? target.fallbackY ?? target.y : target.y;
    Object.assign(p, { name, fromY: p.y, fromPitch: p.pitch, toY, toPitch: target.pitch, t: 0, dur });
    this.char.play(target.clip, Math.min(0.4, dur || 0.01));
    return new Promise((resolve) => {
      p.resolve = resolve;
      if (dur <= 0) this._applyPose(1);
    });
  }

  crouch(dur = 0.8) {
    return this.setPose('crouch', dur);
  }

  stand(dur = 0.8) {
    return this.setPose('stand', dur);
  }

  /** Pitch forward onto the ground (Ch3). */
  fallForward(dur = 1.2) {
    return this.setPose('fall', dur);
  }

  _applyPose(k) {
    const p = this._pose;
    const e = k * k * (3 - 2 * k);
    p.y = p.fromY + (p.toY - p.fromY) * e;
    p.pitch = p.fromPitch + (p.toPitch - p.fromPitch) * e;
    p.t = k;
    if (k >= 1 && p.resolve) {
      const r = p.resolve;
      p.resolve = null;
      r();
    }
  }

  _nextStumbleLine() {
    if (!this.firstStumbleDone && this.lines?.first) {
      this.firstStumbleDone = true;
      return this.lines.first;
    }
    // Shuffled indices, read at draw time: the line follows a language change.
    if (!this._bag.length) this._bag = shuffle((this.lines?.bag || []).map((_, i) => i));
    return this.lines?.bag?.[this._bag.pop()] || '';
  }

  stumble() {
    this.stumbles++;
    this.locked = 1.1;
    this.pain = 0.6;
    this.jogging = false;
    this._lurch = 1;
    this.cam?.dip();
    this.audio?.heartbeat();
    const line = this._nextStumbleLine();
    if (line) this.ui?.thought(line, 3.2);
    this._emit('stumble', line);
  }

  update(dt) {
    // Pose blend (runs even when scripted so chapter cinematics can use poses)
    const p = this._pose;
    if (p.t < 1) this._applyPose(p.dur > 0 ? Math.min(1, p.t + dt / p.dur) : 1);
    this._lurch = Math.max(0, this._lurch - dt * 1.6);

    if (this.scripted) {
      this._applyModel(0);
      this.ui?.pain(this.pain, false);
      return;
    }

    const locked = this.locked > 0;
    this.locked = Math.max(0, this.locked - dt);
    const blocked = locked || this.frozen || p.name !== 'stand' || !this.inputAllowed();
    const inp = blocked ? { x: 0, z: 0 } : this.input.axes();
    const moving = inp.x !== 0 || inp.z !== 0;
    this.moving = moving;
    const wantJog = moving && this.input.shift;

    if (!moving) {
      this.jogging = false;
      this.speed = 0;
      if (p.name === 'stand') this.char.play('idle', 0.35);
      this.pain = Math.max(0, this.pain - dt * 0.5);
      this._applyModel(0);
      this._pain();
      return;
    }

    const jogging = wantJog && this.canJog;
    if (jogging && !this.jogging) {
      if (!this.hasJogged) this._emit('firstJog');
      this.hasJogged = true;
      this._emit('jog');
    }
    this.jogging = jogging;
    this.pain = jogging ? this.pain + this.painRate * dt : Math.max(0, this.pain - dt * 0.35);
    if (this.painCap > 0) this.pain = Math.min(this.pain, this.painCap);
    if (this.pain >= 1) {
      this.stumble();
      this._pain();
      return;
    }

    const speed = jogging ? this.jogSpeed : this.walkSpeed * THREE.MathUtils.lerp(1, 0.85, this.limp);
    this.speed = speed;
    _d.set(inp.x, 0, inp.z).normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.cam?.moveYaw || 0); // camera-relative (W = away from the camera)
    const mx = _d.x * speed * dt;
    const mz = _d.z * speed * dt;
    const px = this.root.position.x;
    const pz = this.root.position.z;
    this.tryMove(mx, mz);
    if (this.root.position.x === px && this.root.position.z === pz && mx && mz) {
      // A diagonal (camera-relative) step can wedge Hugo where two walkable rects meet with edges a
      // few cm apart: back the blocked axis off by up to 6 cm and take the other axis's step.
      const n = 0.06;
      if (this.inBounds(px + mx, pz - Math.sign(mz) * n)) this.root.position.set(px + mx, this.root.position.y, pz - Math.sign(mz) * n);
      else if (this.inBounds(px - Math.sign(mx) * n, pz + mz)) this.root.position.set(px - Math.sign(mx) * n, this.root.position.y, pz + mz);
    }
    this.root.rotation.y = dampAngle(this.root.rotation.y, Math.atan2(_d.x, _d.z), 10, dt); // characters face +Z

    // phase 0 = the left (bad) heel strike, 0.5 = the right one.
    let phase = 0;
    const size = this.model.scale.y || 1;
    if (jogging) {
      const a = this.char.play('run', 0.25);
      if (a) {
        a.timeScale = Math.max(0.5, this.char.strideRate('run', speed)); // a hobbling jog, planted feet
        phase = (a.time / a.getClip().duration - WALK_CONTACT.left + 1) % 1;
      }
    } else {
      const a = this.char.play('walk', 0.3);
      if (a) {
        phase = (a.time / a.getClip().duration - WALK_CONTACT.left + 1) % 1;
        // Uneven step: the stance on the bad leg is cut short, the good leg's is drawn out.
        a.timeScale = (speed / (CLIP_SPEED.walk * size)) * THREE.MathUtils.lerp(1, phase < 0.5 ? 1.15 : 0.85, this.limp);
      } else phase = ((performance.now() / 1000) * 1.1) % 1;
    }
    // One dip per cycle, deepest in mid-stance on the bad leg.
    this._applyModel(jogging ? 0 : -this.limp * 0.05 * (0.5 + 0.5 * Math.sin(phase * TAU)));
    this._steps(phase, jogging);
    this._pain();
  }

  _applyModel(dip) {
    const p = this._pose;
    this.model.position.y = dip + p.y + this.poseOffset.y;
    this.model.rotation.x = p.pitch + this.poseOffset.pitch + this._lurch * this._lurch * 0.28;
  }

  _steps(phase, jogging) {
    if (!this.footsteps) return;
    const last = this._lastPhase;
    this._lastPhase = phase;
    const crossed = (edge) => (last < edge && phase >= edge) || (last > phase && (phase >= edge || last < edge));
    for (const edge of [0.02, 0.52]) {
      if (crossed(edge)) {
        // The bad (left) leg lands softer and slower.
        const bad = edge < 0.5;
        if (this.footsteps === 'boot') {
          // The boot lands flat and heavy: a slowed concrete step plus a dull thud.
          if (bad) {
            this.audio?.footstep('concrete', { volume: 0.5, rate: 0.72 });
            this.audio?.thud({ volume: 0.15 });
          } else this.audio?.footstep('concrete', { volume: jogging ? 0.42 : 0.32, rate: 1 });
        } else {
          const vol = jogging ? 0.42 : bad ? 0.22 : 0.32;
          this.audio?.footstep(this.footsteps, { volume: vol, rate: bad ? 0.86 : 1 });
        }
        this._emit('step', bad);
      }
    }
  }

  _pain() {
    this.ui?.pain(this.pain, this.showPain && (this.pain > 0.01 || this.jogging));
  }
}
