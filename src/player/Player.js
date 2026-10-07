import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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

// Pose targets applied to char.model (offset y, pitch x) on top of the limp dip.
const POSES = {
  stand: { y: 0, pitch: 0, clip: 'idle' },
  crouch: { y: -0.32, pitch: 0.38, clip: 'sneak' }, // sprint "set" position
  sit: { y: -0.42, pitch: -0.08, clip: 'sad' },
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
};

const BOOT_SHELL = '#3a3d42';
const BOOT_STRAP = '#6a6d72';
const BOOT_SOLE = '#1f2124';

/**
 * The walking boot, in metres: ankle at the origin, +Y up the shin, +Z toward the toes.
 * Merged per material (shell, sole, straps = 3 meshes); only the shell casts a shadow (the sole and
 * straps are smaller than a shadow texel at gameplay distance).
 */
function makeBootMesh(shin = 0.42) {
  const g = new THREE.Group();
  g.name = 'walking-boot';
  const shell = new THREE.MeshStandardMaterial({ color: BOOT_SHELL, roughness: 0.62, metalness: 0.05 });
  const strap = new THREE.MeshStandardMaterial({ color: BOOT_STRAP, roughness: 0.8 });
  const sole = new THREE.MeshStandardMaterial({ color: BOOT_SOLE, roughness: 0.95 });
  const at = (geo, x, y, z) => geo.translate(x, y, z);
  const add = (geos, m, castShadow) => {
    const merged = geos.length > 1 ? mergeGeometries(geos) : geos[0];
    if (merged !== geos[0]) for (const gg of geos) gg.dispose();
    const mesh = new THREE.Mesh(merged, m);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };
  const h = Math.max(0.24, shin * 0.78); // up to just below the knee
  add(
    [
      at(new RoundedBoxGeometry(0.15, h, 0.16, 3, 0.045), 0, h / 2 - 0.03, -0.005), // shin shell
      at(new RoundedBoxGeometry(0.15, 0.12, 0.3, 3, 0.04), 0, -0.04, 0.07), // foot
    ],
    shell,
    true,
  );
  add([at(new RoundedBoxGeometry(0.16, 0.045, 0.33, 2, 0.015), 0, -0.11, 0.075)], sole, false); // thick rocker sole
  add(
    [
      ...[0.25, 0.55, 0.85].map((k) => at(new THREE.BoxGeometry(0.162, 0.03, 0.172), 0, (h - 0.03) * k, -0.005)), // straps
      at(new THREE.BoxGeometry(0.155, 0.028, 0.2), 0, 0.025, 0.11), // forefoot strap
    ],
    strap,
    false,
  );
  return g;
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
   *         footsteps:'concrete'|'grass'|'boot'|null, walkSpeed=1.3, jogSpeed=2.6,
   *         boot=false (walking boot on the left shin), tint=HUGO_TINT }
   * Not sticky: every call applies the defaults for anything it omits (Ch3's green kit and bare
   * leg never carry into Ch4).
   */
  configure(opts = {}) {
    const o = { ...DEFAULTS, ...opts };
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
   * Parented to the LeftLeg bone; the capsule fallback gets a box at its left base.
   */
  setBoot(on) {
    on = !!on;
    this.boot = on;
    if (on && !this._bootObj) this._bootObj = this._makeBoot();
    if (this._bootObj) this._bootObj.visible = on;
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
    const toe = char.bone('LeftToeBase') || char.bone('LeftToe_End');
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
    holder.scale.setScalar(1 / ws); // Xbot's armature is cm-scaled: build the boot in metres
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
    Object.assign(p, { name, fromY: p.y, fromPitch: p.pitch, toY: target.y, toPitch: target.pitch, t: 0, dur });
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
    if (!this._bag.length) this._bag = shuffle([...(this.lines?.bag || [])]);
    return this._bag.pop() || '';
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
    _d.set(inp.x, 0, inp.z).normalize();
    this.tryMove(_d.x * speed * dt, _d.z * speed * dt);
    this.root.rotation.y = dampAngle(this.root.rotation.y, Math.atan2(_d.x, _d.z), 10, dt); // Xbot faces +Z

    let phase = 0;
    if (jogging) {
      const a = this.char.play('run', 0.25);
      if (a) {
        a.timeScale = 0.75;
        phase = (a.time / a.getClip().duration) % 1;
      }
    } else {
      const a = this.char.play('walk', 0.3);
      if (a) {
        phase = (a.time / a.getClip().duration) % 1;
        a.timeScale = (speed / 1.25) * THREE.MathUtils.lerp(1, phase < 0.5 ? 0.85 : 1.1, this.limp); // uneven step
      } else phase = ((performance.now() / 1000) * 1.1) % 1;
    }
    this._applyModel(jogging ? 0 : -this.limp * 0.05 * (0.5 + 0.5 * Math.sin(phase * TAU))); // one dip per cycle
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
