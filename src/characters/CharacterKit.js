import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CLIP_RETIME, CLIP_STRIDE, castRecipes } from './cast.js';

// Builds characters from the Quaternius "Universal" set (docs/assets/characters.md):
//   parts.glb  one 65-bone skeleton + 31 skinned parts, each with its own inverse bind matrices
//   anims.glb  34 clips under our names (rotations for every bone, translation on the pelvis only)
// A character keeps only its recipe's parts. Parts that share a source material are merged into one
// SkinnedMesh (cached geometry, a skeleton that lists the bones once per part so every part keeps
// its own binding), so a clothed adult is 4-5 draw calls instead of 9-10. Per-part colours live in a
// small uniform array indexed by a per-vertex part slot, so the geometry is shared by every
// character with the same parts and only the materials are per character.

const MAX_SLOTS = 8;
const EYES_FAR = 7; // metres: beyond this the eyes are about a pixel, so their draw call is skipped
const _wp = new THREE.Vector3();
const _hp = new THREE.Vector3();
const BODY_SPHERE = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.5);
const CLOTH_GAIN_MAX = 4;
const KIT_CUT = { none: 2, short: 0.75, long: 0.35 };
const _c = new THREE.Color();

/** Linear colour for a part: colour / mean luminance of its grey-levelled texture (clamped). */
function partColor(target, hex, lum) {
  target.set(hex);
  return lum > 0 ? target.multiplyScalar(Math.min(CLOTH_GAIN_MAX, 1 / lum)) : target;
}

export class CharacterKit {
  constructor(loader, urlOf) {
    this.loader = loader;
    this.urlOf = urlOf;
    this.ready = false;
  }

  /** Load parts.glb, anims.glb and the kit masks. Rejects on failure (Assets falls back). */
  async load(onProgress = () => {}) {
    const prog = [0, 0];
    const track = (i) => (e) => {
      if (e.total) prog[i] = Math.min(1, e.loaded / e.total);
      onProgress(prog[0] * 0.85 + prog[1] * 0.15);
    };
    const [parts, anims] = await Promise.all([
      this.loader.loadAsync(this.urlOf('characters/parts.glb'), track(0)),
      this.loader.loadAsync(this.urlOf('characters/anims.glb'), track(1)),
    ]);
    const meta = parts.scene.userData.hairline;
    if (!meta?.rigs || !meta?.pelvisRest) throw new Error('parts.glb has no rig metadata');
    this.meta = meta;

    // Part primitives by part name: [{ mesh, material }] (m_sleeves is a Group of two primitives).
    this.parts = new Map();
    parts.scene.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const name = o.userData.part || o.parent?.userData.part;
      if (!name) return;
      if (!this.parts.has(name)) this.parts.set(name, []);
      this.parts.get(name).push({ mesh: o, lum: o.userData.lum ?? o.parent?.userData.lum ?? 0.42 });
    });
    // Each part's quantised positions -> bind space (metres, T-pose, feet at y = 0): the cloth shader
    // places hems, boot shafts and the face by position, and the apron is fitted to it.
    parts.scene.updateMatrixWorld(true);
    for (const prims of this.parts.values()) {
      for (const p of prims) {
        const sk = p.mesh.skeleton;
        const i = sk.bones.findIndex((b) => b.name === 'root');
        p.bindQ = i >= 0 ? new THREE.Matrix4().multiplyMatrices(sk.bones[i].matrixWorld, sk.boneInverses[i]) : new THREE.Matrix4();
      }
    }
    // The bone hierarchy alone: every character is a SkeletonUtils.clone of it.
    const tpl = SkeletonUtils.clone(parts.scene);
    const arm = tpl.getObjectByName('Armature') || tpl;
    for (const c of [...arm.children]) if (!c.isBone) arm.remove(c);
    this.template = tpl;
    const first = this.parts.values().next().value?.[0]?.mesh;
    this.boneIndex = new Map((first?.skeleton.bones || []).map((b, i) => [b.name, i])); // same order in every part

    // Clips by our names, the long loops retimed (see cast.js CLIP_RETIME).
    this.clips = {};
    for (const clip of anims.animations) {
      const name = clip.name === 'sneak' ? 'crouch_walk' : clip.name; // 'sneak' stays the legacy crouch pose
      const want = CLIP_RETIME[name];
      if (want && clip.duration > 0) {
        const k = want / clip.duration;
        const seen = new Set(); // GLTFLoader shares one times array between the channels of a sampler input
        for (const t of clip.tracks) {
          if (seen.has(t.times)) continue;
          seen.add(t.times);
          for (let i = 0; i < t.times.length; i++) t.times[i] *= k;
        }
        clip.duration = want;
      }
      if (CLIP_STRIDE[name]) shortenStride(clip, CLIP_STRIDE[name]);
      clip.name = name;
      this.clips[name] = clip;
    }

    // Kit masks (RGBA, linear). ImageBitmap with premultiplyAlpha 'none' keeps RGB where alpha is 0.
    this.kitMaps = {};
    const bmp = new THREE.ImageBitmapLoader();
    bmp.setOptions({ imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    await Promise.all(
      ['m', 'f'].map((s) =>
        bmp.loadAsync(this.urlOf(`characters/kit_${s}.png`)).then(
          (img) => {
            const t = new THREE.Texture(img);
            t.flipY = false;
            t.colorSpace = THREE.NoColorSpace;
            t.needsUpdate = true;
            this.kitMaps[s] = t;
          },
          (err) => console.warn(`[hairline] kit_${s}.png failed, runners get plain bodies`, err?.message || err),
        ),
      ),
    );
    // Bind-space transform of each athletic body (its quantised positions -> metres, T-pose): the
    // kit shader fills the torso by position, because the top mask leaves bands of skin.
    parts.scene.updateMatrixWorld(true);
    this.kitQ = {};
    for (const s of ['m', 'f']) {
      const mesh = this.parts.get(`${s}_body`)?.[0]?.mesh;
      const i = mesh ? mesh.skeleton.bones.findIndex((b) => b.name === 'root') : -1;
      if (i >= 0) this.kitQ[s] = new THREE.Matrix4().multiplyMatrices(mesh.skeleton.bones[i].matrixWorld, mesh.skeleton.boneInverses[i]);
    }
    this._geo = new Map(); // merged geometry cache
    this.ready = true;
    onProgress(1);
  }

  /** Recipes for a preset (see cast.js). */
  recipes(preset, variant, seed) {
    return castRecipes(preset, variant, seed);
  }

  /**
   * Build the skinned model for a set of outfits. Returns
   *   { rig, outfits: { name: { recipe, meshes, slots } }, materials, bones: Map }
   * Every outfit's meshes are built up front; the caller shows one at a time.
   */
  build(outfits, { castShadow = true, overrides = {} } = {}) {
    const rig = SkeletonUtils.clone(this.template);
    rig.name = 'rig';
    const bones = new Map();
    rig.traverse((o) => o.isBone && bones.set(o.name, o));
    const arm = rig.getObjectByName('Armature') || rig;
    const materials = [];
    const out = {};
    for (const [oname, recipe0] of Object.entries(outfits)) {
      const recipe = applyOverrides(recipe0, overrides);
      this.applyRig(bones, recipe.rig);
      rig.updateMatrixWorld(true);
      const groups = new Map(); // source material -> [{part, mesh, lum}]
      for (const part of recipe.parts) {
        const prims = this.parts.get(part);
        if (!prims) {
          console.warn('[hairline] unknown character part', part);
          continue;
        }
        for (const p of prims) {
          const key = p.mesh.material.name || p.mesh.material.uuid;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push({ part, ...p });
        }
      }
      const meshes = [];
      const slots = []; // { material, slot, part, kind, lum }
      for (const [key, prims] of groups) {
        for (let i = 0; i < prims.length; i += MAX_SLOTS) {
          const chunk = prims.slice(i, i + MAX_SLOTS);
          const entry = this._merged(key, chunk);
          const mat = this._material(chunk[0].mesh.material, recipe, chunk);
          const mesh = new THREE.SkinnedMesh(entry.geometry, mat);
          mesh.name = `${oname}:${key}`;
          const sk = new THREE.Skeleton(
            entry.boneNames.map((n) => bones.get(n)),
            entry.boneInverses,
          );
          mesh.bind(sk, new THREE.Matrix4());
          // One whole-body sphere for every part (rig space, padded like the old bind sphere x1.5): a
          // head-only sphere would cull the hair when a clip moves the head (sitting, kneeling).
          // Poses on model.position/rotation move it with the mesh.
          mesh.boundingSphere = BODY_SPHERE.clone();
          mesh.frustumCulled = true;
          const kind = kindOf(key);
          mesh.castShadow = castShadow && (kind === 'skin' || kind === 'cloth'); // hair and eyes add no readable shadow
          mesh.receiveShadow = true;
          mesh.userData.sharedGeometry = true; // cached: never disposed with a chapter
          arm.add(mesh);
          meshes.push(mesh);
          materials.push(mat);
          chunk.forEach((p, s) => slots.push({ material: mat, slot: s, part: p.part, kind, lum: p.lum, boneOffset: entry.offsets[s] }));
        }
      }
      // Odile's apron: a real garment over the blouse, skinned to the spine, pelvis and thighs.
      if (recipe.apron) {
        const apron = this._apron(recipe, bones);
        if (apron) {
          apron.castShadow = castShadow;
          arm.add(apron);
          meshes.push(apron);
          materials.push(apron.material);
        }
      }
      // Distance cull for the eyes, driven by the head mesh (always drawn). Shadow cameras have no
      // parent; the main camera lives in the scene (Engine), so only it decides.
      const eyes = meshes.find((m) => m.name.endsWith(':eyes'));
      const skin = meshes.find((m) => /:skin/.test(m.name));
      if (eyes && skin) {
        skin.onBeforeRender = (_r, _s, camera) => {
          if (!camera.parent) return;
          const head = bones.get('Head');
          eyes.visible = skin.visible && (!head || camera.getWorldPosition(_wp).distanceTo(head.getWorldPosition(_hp)) < EYES_FAR);
        };
      }
      out[oname] = { recipe, meshes, slots };
      for (const s of slots) this.colorSlot(s, recipe);
    }
    return { rig, outfits: out, materials, bones };
  }

  /** Set bone rest translations to a rig's proportions (rotations come from the clips). */
  applyRig(bones, rigName) {
    const rest = this.meta.rigs[rigName] || this.meta.rigs.m_regular;
    for (const [name, p] of Object.entries(rest)) bones.get(name)?.position.fromArray(p);
  }

  /** Model y offset (rig units) so the clip's mannequin pelvis height fits this rig. */
  pelvisOffset(rigName) {
    const pr = this.meta.pelvisRest;
    return (pr[rigName] ?? pr.mannequin) - pr.mannequin;
  }

  /** Write a slot's colour from the recipe (skin multiply, hair and cloth divided by luminance). */
  colorSlot(s, recipe, override) {
    const u = s.material.userData.hl.tint.value[s.slot];
    const part = s.part;
    const hl = s.material.userData.hl;
    if (hl.slot) {
      // Cloth: x = the texture's mean luminance (the de-detail pivot); y = 1 on shoes/boots, whose
      // shaft above the ankle takes the trousers' colour (a trouser leg over a shoe, not a knee boot).
      const shoe = s.kind === 'cloth' && /shoes|boots/.test(part);
      const top = s.kind === 'cloth' && /shirt|blouse/.test(part); // z: the toggle placket, the corset / belt
      hl.slot.value[s.slot].set(s.lum, shoe ? 1 : 0, top ? 1 : 0, 0);
      if (shoe) {
        const legs = recipe.parts.find((p) => /trousers/.test(p));
        partColor(hl.shaft.value[s.slot], (legs && recipe.colors?.[legs]) || '#34363a', s.lum);
      }
    }
    if (s.kind === 'skin') u.set(override ?? recipe.skin ?? '#e0bc9f');
    else if (s.kind === 'hair') partColor(u, override ?? (part.endsWith('brows') ? recipe.brows ?? recipe.hair : recipe.hair) ?? '#2a2420', s.lum);
    else if (s.kind === 'cloth') partColor(u, override ?? recipe.colors?.[part] ?? '#4a4a4a', s.lum);
    else u.setRGB(1, 1, 1);
  }

  /** Recolour the kit (athletic bodies). */
  setKit(material, kit) {
    const hl = material.userData.hl;
    if (!hl?.kit) return;
    hl.kitTop.value.set(kit.top ?? '#888888');
    // Trim: a darker shade of the top (or a lighter one on a very dark top); reflective bands on bright tops.
    const lum = hl.kitTop.value.r * 0.2126 + hl.kitTop.value.g * 0.7152 + hl.kitTop.value.b * 0.0722;
    hl.kitTrim.value.copy(hl.kitTop.value).multiplyScalar(lum > 0.03 ? 0.32 : 3.2);
    hl.kitBands.value = lum > 0.3 ? 1 : 0;
    hl.kitLegs.value.set(kit.bottom ?? '#1c1d20');
    hl.kitShoes.value.set(kit.shoes ?? '#2a2d33');
    hl.kitCut.value.set(KIT_CUT[kit.sleeves] ?? KIT_CUT.none, KIT_CUT[kit.legs] ?? KIT_CUT.short);
  }

  /**
   * A bib apron (Odile): a skinned grid fitted just in front of the outfit's bind-pose surface, from
   * the chest to the knees, with two straps up to the neck. Weighted to the spine, the pelvis and
   * the thighs, so it follows walks, kneels and the stoop. Geometry and texture are cached.
   */
  _apron(recipe, bones) {
    const key = 'apron|' + recipe.rig + '|' + recipe.parts.join(',');
    let geo = this._geo.get(key)?.geometry;
    const need = ['spine_03', 'spine_02', 'spine_01', 'pelvis', 'thigh_l', 'thigh_r'];
    if (need.some((n) => !bones.get(n))) return null;
    const left = bones.get('thigh_l').getWorldPosition(new THREE.Vector3()).x > 0 ? 1 : -1; // +x side of thigh_l
    if (!geo) {
      // Front-most z of the torso and leg garments, in 2 cm height bins (|x| < 0.2).
      const Y0 = 0.5;
      const Y1 = 1.44;
      const NB = Math.ceil((Y1 - Y0) / 0.02) + 1;
      const NXB = 11; // 4 cm columns over |x| < 0.22, for the bib (it has to clear the bust)
      const front = new Float32Array(NB).fill(-1);
      const front2 = new Float32Array(NB * NXB).fill(-1);
      const xb = (x) => Math.max(0, Math.min(NXB - 1, Math.round((x + 0.2) / 0.04)));
      const v = new THREE.Vector3();
      for (const part of recipe.parts.filter((p) => /blouse|shirt|trousers|body/.test(p))) {
        for (const p of this.parts.get(part) || []) {
          const P = p.mesh.geometry.attributes.position;
          for (let i = 0; i < P.count; i++) {
            v.fromBufferAttribute(P, i).applyMatrix4(p.bindQ);
            if (Math.abs(v.x) > 0.2 || v.y < Y0 - 0.02 || v.y > Y1 + 0.02) continue;
            const b = Math.round((v.y - Y0) / 0.02);
            if (b < 0 || b >= NB) continue;
            front[b] = Math.max(front[b], v.z);
            front2[b * NXB + xb(v.x)] = Math.max(front2[b * NXB + xb(v.x)], v.z);
          }
        }
      }
      // Hangs straight from the belly down (cloth does not follow the crotch), lies on the chest above.
      let hang = -1;
      for (let b = NB - 1; b >= 0; b--) {
        const y = Y0 + b * 0.02;
        if (front[b] < 0) front[b] = b < NB - 1 ? front[b + 1] : 0.12;
        if (y < 1.12) hang = Math.max(hang, front[b]);
        if (y < 1.0) front[b] = Math.max(front[b], hang - (1.0 - y) * 0.06);
      }
      const yb = (y) => Math.max(0, Math.min(NB - 1, Math.round((y - Y0) / 0.02)));
      const zAt = (y) => front[yb(y)] + 0.014;
      // On the chest: the highest point of the surface around (x, y) (+-1 bin), plus clearance.
      const zBib = (x, y) => {
        let z = -1;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) {
          const b = yb(y + dy * 0.02);
          const c = Math.max(0, Math.min(NXB - 1, xb(x) + dx));
          z = Math.max(z, front2[b * NXB + c]);
        }
        return z < 0 ? zAt(y) : z + 0.016;
      };
      const halfW = (y) => (y > 1.12 ? 0.115 : y > 1.02 ? THREE.MathUtils.lerp(0.19, 0.115, (y - 1.02) / 0.1) : 0.19 + (1.02 - y) * 0.04);
      const NX = 8;
      const rows = [];
      for (let y = Y1; y >= Y0 - 1e-6; y -= 0.04) rows.push(y);
      const pos = [];
      const uv = [];
      const si = [];
      const sw = [];
      const idx = [];
      const BI = { spine_03: 0, spine_02: 1, spine_01: 2, pelvis: 3, thigh_l: 4, thigh_r: 5 };
      const weights = (x, y) => {
        const w = new Map();
        const add = (b, k) => k > 0 && w.set(b, (w.get(b) || 0) + k);
        if (y >= 1.3) add('spine_03', 1);
        else if (y >= 1.15) add('spine_03', (y - 1.15) / 0.15), add('spine_02', 1 - (y - 1.15) / 0.15);
        else if (y >= 1.0) add('spine_02', (y - 1.0) / 0.15), add('spine_01', 1 - (y - 1.0) / 0.15);
        else if (y >= 0.92) add('spine_01', (y - 0.92) / 0.08), add('pelvis', 1 - (y - 0.92) / 0.08);
        else {
          const t = THREE.MathUtils.smoothstep(y, 0.92, 0.6) * 0.85;
          add('pelvis', 1 - t);
          const sl = THREE.MathUtils.smoothstep(x * left, -0.09, 0.09);
          add('thigh_l', t * sl);
          add('thigh_r', t * (1 - sl));
        }
        const e = [...w.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
        const sum = e.reduce((a, [, k]) => a + k, 0) || 1;
        return e.map(([b, k]) => [BI[b], k / sum]);
      };
      const vert = (x, y, z, u, vv) => {
        pos.push(x, y, z);
        uv.push(u, vv);
        const w = weights(x, y);
        for (let k = 0; k < 4; k++) {
          si.push(w[k]?.[0] ?? 0);
          sw.push(w[k]?.[1] ?? 0);
        }
        return pos.length / 3 - 1;
      };
      const grid = [];
      rows.forEach((y, r) => {
        const hw = halfW(y);
        const row = [];
        for (let c = 0; c <= NX; c++) {
          const f = c / NX;
          const x = (f * 2 - 1) * hw;
          const hang = zAt(y) - Math.pow(Math.abs(f * 2 - 1), 2) * 0.07; // the skirt wraps a little round the legs
          const z = y >= 1.04 ? zBib(x, y) : y <= 0.96 ? hang : THREE.MathUtils.lerp(hang, zBib(x, y), (y - 0.96) / 0.08);
          row.push(vert(x, y, z, f, 1 - r / (rows.length - 1)));
        }
        grid.push(row);
      });
      for (let r = 0; r < grid.length - 1; r++) {
        for (let c = 0; c < NX; c++) {
          const a = grid[r][c], b = grid[r][c + 1], d = grid[r + 1][c], e = grid[r + 1][c + 1];
          idx.push(a, d, b, b, d, e);
        }
      }
      // Neck straps: from the bib's top corners up and back to the base of the neck.
      for (const sx of [-1, 1]) {
        const x0 = sx * 0.1;
        const x1 = sx * 0.07;
        const s0 = [vert(x0 - 0.012, Y1, zAt(Y1) - 0.01, 0.02, 1), vert(x0 + 0.012, Y1, zAt(Y1) - 0.01, 0.06, 1)];
        const s1 = [vert(x1 - 0.011, 1.485, zBib(x1, 1.44) - 0.012, 0.02, 1), vert(x1 + 0.011, 1.485, zBib(x1, 1.44) - 0.012, 0.06, 1)];
        const s2 = [vert(x1 * 0.85 - 0.011, 1.51, -0.02, 0.02, 1), vert(x1 * 0.85 + 0.011, 1.51, -0.02, 0.06, 1)];
        idx.push(s0[0], s0[1], s1[0], s1[0], s0[1], s1[1], s1[0], s1[1], s2[0], s2[0], s1[1], s2[1]);
      }
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      geo.name = 'char:apron';
      this._geo.set(key, { geometry: geo });
    }
    const mat = new THREE.MeshStandardMaterial({ map: apronTexture(), color: recipe.apron, roughness: 0.92, side: THREE.DoubleSide });
    mat.name = 'apron';
    mat.userData.part = 'cloth';
    mat.userData.hl = {};
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.name = 'apron';
    const list = ['spine_03', 'spine_02', 'spine_01', 'pelvis', 'thigh_l', 'thigh_r'].map((n) => bones.get(n));
    const sk = new THREE.Skeleton(list, list.map((b) => b.matrixWorld.clone().invert()));
    mesh.bind(sk, new THREE.Matrix4());
    mesh.boundingSphere = BODY_SPHERE.clone();
    mesh.receiveShadow = true;
    mesh.userData.sharedGeometry = true;
    return mesh;
  }

  _merged(key, chunk) {
    const id = key + '|' + chunk.map((p) => p.mesh.uuid).join(',');
    let e = this._geo.get(id);
    if (e) return e;
    let nv = 0;
    let ni = 0;
    for (const p of chunk) {
      const g = p.mesh.geometry;
      nv += g.attributes.position.count;
      ni += g.index ? g.index.count : g.attributes.position.count;
    }
    const pos = new Float32Array(nv * 3);
    const nor = new Float32Array(nv * 3);
    const uv = new Float32Array(nv * 2);
    const si = new Uint16Array(nv * 4);
    const sw = new Float32Array(nv * 4);
    const slot = new Float32Array(nv);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    const boneNames = [];
    const boneInverses = [];
    const offsets = [];
    let vo = 0;
    let io = 0;
    chunk.forEach((p, s) => {
      const g = p.mesh.geometry;
      const sk = p.mesh.skeleton;
      const bo = boneNames.length;
      offsets.push(bo);
      for (const b of sk.bones) boneNames.push(b.name);
      for (const m of sk.boneInverses) boneInverses.push(m);
      const P = g.attributes.position;
      const N = g.attributes.normal;
      const T = g.attributes.uv;
      const J = g.attributes.skinIndex;
      const W = g.attributes.skinWeight;
      for (let v = 0; v < P.count; v++) {
        const o = vo + v;
        pos[o * 3] = P.getX(v);
        pos[o * 3 + 1] = P.getY(v);
        pos[o * 3 + 2] = P.getZ(v);
        if (N) {
          nor[o * 3] = N.getX(v);
          nor[o * 3 + 1] = N.getY(v);
          nor[o * 3 + 2] = N.getZ(v);
        }
        if (T) {
          uv[o * 2] = T.getX(v);
          uv[o * 2 + 1] = T.getY(v);
        }
        si[o * 4] = J.getX(v) + bo;
        si[o * 4 + 1] = J.getY(v) + bo;
        si[o * 4 + 2] = J.getZ(v) + bo;
        si[o * 4 + 3] = J.getW(v) + bo;
        sw[o * 4] = W.getX(v);
        sw[o * 4 + 1] = W.getY(v);
        sw[o * 4 + 2] = W.getZ(v);
        sw[o * 4 + 3] = W.getW(v);
        slot[o] = s;
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.getX(i) + vo;
      else for (let i = 0; i < P.count; i++) idx[io + i] = vo + i;
      io += g.index ? g.index.count : P.count;
      vo += P.count;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    geo.setAttribute('partSlot', new THREE.BufferAttribute(slot, 1));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.name = 'char:' + id.slice(0, 48);
    e = { geometry: geo, boneNames, boneInverses, offsets };
    this._geo.set(id, e);
    return e;
  }

  /** Per-character material: a clone of the source material with the part-tint (and kit) shader patch. */
  _material(src, recipe, chunk = []) {
    const m = src.clone();
    m.color.setRGB(1, 1, 1);
    const kind = kindOf(src.name);
    const cloth = kind === 'cloth';
    const age = kind === 'skin' && !recipe.kit ? recipe.age || 0 : 0;
    const sex = recipe.rig?.startsWith('f') ? 'f' : 'm';
    const useKit = kind === 'skin' && !!recipe.kit && !!this.kitMaps[sex] && /athletic/.test(recipe.rig);
    const hl = {
      tint: { value: Array.from({ length: MAX_SLOTS }, () => new THREE.Color(1, 1, 1)) },
      kit: useKit,
      kitMap: { value: useKit ? this.kitMaps[sex] : null },
      kitTop: { value: new THREE.Color() },
      kitTrim: { value: new THREE.Color() },
      kitBands: { value: 0 },
      kitLegs: { value: new THREE.Color() },
      kitShoes: { value: new THREE.Color() },
      kitCut: { value: new THREE.Vector2(2, 2) },
      kitQ: { value: this.kitQ?.[sex] || new THREE.Matrix4() },
      kitK: { value: (this.meta.pelvisRest[recipe.rig] || 0.949) / 0.949 }, // body size vs the male athlete
      kitNeck: { value: sex === 'f' ? 1.47 : 1.555 }, // collar height at the back of the neck (m)
      // Per-slot bind transforms (see load) and, on cloth, the de-detail pivot and boot-shaft colours.
      bindQ: { value: Array.from({ length: MAX_SLOTS }, (_, i) => chunk[i]?.bindQ ?? new THREE.Matrix4()) },
      slot: cloth ? { value: Array.from({ length: MAX_SLOTS }, () => new THREE.Vector4(0.42, 0, 0, 0)) } : null,
      shaft: cloth ? { value: Array.from({ length: MAX_SLOTS }, () => new THREE.Color(0, 0, 0)) } : null,
      age: { value: age },
      hideSlot: { value: -1 }, // one part slot whose left-leg vertices are discarded (under the walking boot)
      hideBones: { value: new THREE.Vector4(-1, -1, -1, -1) },
    };
    m.userData.hl = hl;
    m.userData.part = kind;
    if (useKit) this.setKit(m, recipe.kit);
    m.onBeforeCompile = (shader) => {
      shader.uniforms.hlTint = hl.tint;
      shader.uniforms.hlHideSlot = hl.hideSlot;
      shader.uniforms.hlHideBones = hl.hideBones;
      shader.uniforms.hlBindQ = hl.bindQ;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute float partSlot;
uniform vec3 hlTint[${MAX_SLOTS}];
uniform mat4 hlBindQ[${MAX_SLOTS}];
uniform float hlHideSlot;
uniform vec4 hlHideBones;
varying vec3 vHlTint;
varying vec3 vHlPos;
varying float vHlHide;
float hlIn( float j ) { vec4 d = abs( hlHideBones - j ); return step( min( min( d.x, d.y ), min( d.z, d.w ) ), 0.5 ); }`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
	vHlTint = hlTint[ int( partSlot + 0.5 ) ];
	vHlPos = ( hlBindQ[ int( partSlot + 0.5 ) ] * vec4( position, 1.0 ) ).xyz; // bind space, metres
	vHlHide = 0.0;
	#ifdef USE_SKINNING
	if ( abs( partSlot - hlHideSlot ) < 0.5 ) vHlHide = dot( skinWeight, vec4( hlIn( skinIndex.x ), hlIn( skinIndex.y ), hlIn( skinIndex.z ), hlIn( skinIndex.w ) ) );
	#endif`,
        );
      let frag = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vHlTint;\nvarying vec3 vHlPos;\nvarying float vHlHide;\n' + HL_NOISE)
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n\tif ( vHlHide > 0.5 ) discard;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb *= vHlTint;\n\tfloat hlKit = 0.0;');
      if (cloth) {
        Object.assign(shader.uniforms, { hlSlot: hl.slot, hlShaft: hl.shaft });
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>\nuniform vec4 hlSlot[${MAX_SLOTS}];\nuniform vec3 hlShaft[${MAX_SLOTS}];\nvarying vec4 vHlSlot;\nvarying vec3 vHlShaft;`)
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvHlSlot = hlSlot[ int( partSlot + 0.5 ) ];\n\tvHlShaft = hlShaft[ int( partSlot + 0.5 ) ];');
        frag = frag
          .replace('#include <common>', '#include <common>\nvarying vec4 vHlSlot;\nvarying vec3 vHlShaft;\nfloat hlShaftK = 0.0;')
          .replace('\tdiffuseColor.rgb *= vHlTint;\n', CLOTH_FRAG)
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = max( roughnessFactor, 0.8 );')
          .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n\tnormal = normalize( mix( normal, nonPerturbedNormal, hlShaftK * 0.75 ) );');
      }
      if (age) {
        shader.uniforms.hlAge = hl.age;
        frag = frag.replace('#include <common>', '#include <common>\nuniform float hlAge;').replace('\tdiffuseColor.rgb *= vHlTint;\n', '\tdiffuseColor.rgb *= vHlTint;\n' + AGE_FRAG);
      }
      if (hl.kit) {
        Object.assign(shader.uniforms, { hlKitMap: hl.kitMap, hlKitTop: hl.kitTop, hlKitTrim: hl.kitTrim, hlKitBands: hl.kitBands, hlKitLegs: hl.kitLegs, hlKitShoes: hl.kitShoes, hlKitCut: hl.kitCut, hlKitQ: hl.kitQ, hlKitK: hl.kitK, hlKitNeck: hl.kitNeck });
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform mat4 hlKitQ;\nuniform float hlKitK;\nvarying vec3 vKitPos;')
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
	vKitPos = ( hlKitQ * vec4( position, 1.0 ) ).xyz;
	// Trainers: the feet are puffed out a few millimetres (bind pose), so the painted shoe reads as a
	// shoe over the sculpted toes rather than a bare foot.
	transformed += objectNormal * 0.009 * smoothstep( 0.125, 0.075, vKitPos.y / hlKitK );`,
          );
        frag = frag
          .replace('#include <common>', '#include <common>\nuniform sampler2D hlKitMap;\nuniform vec3 hlKitTop;\nuniform vec3 hlKitTrim;\nuniform float hlKitBands;\nuniform vec3 hlKitLegs;\nuniform vec3 hlKitShoes;\nuniform vec2 hlKitCut;\nuniform float hlKitK;\nuniform float hlKitNeck;\nvarying vec3 vKitPos;\nfloat hlKitFold = 0.0;')
          .replace(
            'float hlKit = 0.0;',
            `float hlKit = 0.0;
	{
		vec4 km = texture2D( hlKitMap, vMapUv );
		// Torso by bind-pose position (metres, T-pose): waist to a neckline that drops to the shoulders.
		vec3 kp = vKitPos / hlKitK;
		float ax = abs( kp.x );
		float neck = hlKitNeck / hlKitK - max( ax - 0.06, 0.0 ) * 0.3 - step( 0.03, kp.z ) * 0.045;
		float torso = step( 0.97, kp.y ) * step( kp.y, neck ) * step( ax, mix( 0.215, 0.3, step( 1.38, kp.y ) ) );
		float top = max( max( step( 0.5, km.r ), torso ), step( hlKitCut.x, km.g ) );
		// Shorts / tights by position too (a straight waistband; the mask's edge is ragged).
		// High enough at the back to cover the top of the seat (no sculpted crease above the waistband).
		float legs = step( kp.y, 1.035 ) * step( mix( 0.115, 0.6, step( 0.5, hlKitCut.y ) ), kp.y );
		float shoes = max( step( 0.5, km.a ), step( kp.y, 0.075 ) );
		// The skin texture's shading is mostly muscle definition: a garment keeps only a little of it.
		float shade = 0.92 + 0.2 * dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
		// Garment design, by bind-pose position, so the paint reads as clothing: darker side panels, a trim at the neckline, the sleeve hems and the waistband, and on bright tops
		// two reflective bands (the club's hi-vis).
		vec3 topC = hlKitTop;
		float side = smoothstep( 0.135, 0.165, ax ) * step( kp.y, 1.36 ) * step( 0.97, kp.y ) * step( ax, 0.3 );
		topC = mix( topC, hlKitTrim, side * 0.75 );
		float neckTrim = step( neck - 0.025, kp.y ) * step( kp.y, neck ) * step( ax, 0.3 );
		float hem = step( hlKitCut.x, km.g ) * ( 1.0 - step( hlKitCut.x + 0.07, km.g ) ) * step( 0.27, ax );
		topC = mix( topC, hlKitTrim, max( neckTrim, hem ) );
		float band = hlKitBands * ( 1.0 - side ) * ( step( 1.08, kp.y ) * step( kp.y, 1.115 ) + step( 1.24, kp.y ) * step( kp.y, 1.275 ) );
		topC = mix( topC, vec3( 0.62, 0.64, 0.66 ), band );
		vec3 legC = mix( hlKitLegs, hlKitLegs * 1.9 + 0.03, step( 1.0, kp.y ) ); // waistband
		vec3 shoeC = mix( hlKitShoes, vec3( 0.72, 0.7, 0.66 ), step( kp.y, 0.032 ) ); // midsole
		shoeC = mix( shoeC, vec3( 0.035 ), step( kp.y, 0.011 ) ); // outsole
		diffuseColor.rgb = mix( diffuseColor.rgb, topC * shade, top );
		diffuseColor.rgb = mix( diffuseColor.rgb, legC * shade, legs );
		diffuseColor.rgb = mix( diffuseColor.rgb, shoeC, shoes );
		hlKit = max( max( top, legs ), shoes );
		// Soft drape folds on the top (a height field, bump-mapped below).
		hlKitFold = top * ( sin( kp.y * 41.0 + sin( kp.x * 23.0 ) * 1.7 + kp.z * 9.0 ) * 0.6 + sin( kp.y * 17.0 - kp.x * 31.0 ) * 0.4 );
	}`,
          )
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = mix( roughnessFactor, 0.82, hlKit );')
          .replace(
            '#include <normal_fragment_maps>',
            `#include <normal_fragment_maps>
	{
		// Cloth: drop most of the body's muscle normal map under the kit, then add the drape folds.
		normal = normalize( mix( normal, nonPerturbedNormal, hlKit * 0.85 ) );
		vec3 hlP = - vViewPosition;
		vec3 sx = dFdx( hlP ), sy = dFdy( hlP );
		vec2 dh = vec2( dFdx( hlKitFold ), dFdy( hlKitFold ) ) * 0.0035;
		vec3 r1 = cross( sy, normal ), r2 = cross( normal, sx );
		float det = dot( sx, r1 );
		if ( abs( det ) > 1e-12 ) {
			vec3 g = sign( det ) * ( dh.x * r1 + dh.y * r2 );
			normal = normalize( abs( det ) * normal - g );
		}
	}`,
          );
      }
      shader.fragmentShader = frag;
    };
    m.customProgramCacheKey = () => (hl.kit ? 'hl-char-kit' : cloth ? 'hl-char-cloth' : age ? 'hl-char-age' : 'hl-char');
    return m;
  }
}

// Cheap 3D value noise for the cloth and skin patches (bind-space metres in).
const HL_NOISE = /* glsl */ `
float hlHash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
float hlNoise( vec3 x ) {
	vec3 i = floor( x ), f = fract( x );
	f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( mix( hlHash( i ), hlHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( hlHash( i + vec3( 0, 1, 0 ) ), hlHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
		mix( mix( hlHash( i + vec3( 0, 0, 1 ) ), hlHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( hlHash( i + vec3( 0, 1, 1 ) ), hlHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
}`;

// Cloth (the Quaternius fantasy outfits): the grey-levelled atlas carries armbands, belts, toggles,
// a corset and buckled boots as dark / bright patches. Keep ~40% of its contrast around its mean (folds
// and seams stay, the appliqué fades into the garment), recolour boot shafts as trouser legs, then add
// a fabric heather and grime towards the hems so the cast weathers like the scanned props.
const CLOTH_FRAG = /* glsl */ `
	{
		float pivot = vHlSlot.x;
		float shaft = vHlSlot.y * smoothstep( 0.13, 0.17, vHlPos.y );
		hlShaftK = shaft;
		// Tops: the toggle placket down the front and the corset / belt band at the waist go plain.
		float placket = vHlSlot.z * ( 1.0 - smoothstep( 0.03, 0.05, abs( vHlPos.x ) ) ) * step( 0.0, vHlPos.z ) * step( 1.0, vHlPos.y );
		float waist = vHlSlot.z * ( 1.0 - smoothstep( 1.2, 1.24, vHlPos.y ) );
		hlShaftK = max( hlShaftK, placket );
		float keep = mix( 0.4, 0.14, max( hlShaftK, waist ) );
		diffuseColor.rgb = max( vec3( pivot ) + ( diffuseColor.rgb - pivot ) * keep, vec3( 0.0 ) );
		float heather = hlNoise( vHlPos * 260.0 ) * 0.6 + hlNoise( vHlPos * 90.0 ) * 0.4;
		float blotch = hlNoise( vHlPos * 9.0 + 3.7 );
		float hem = smoothstep( 0.5, 0.04, vHlPos.y );
		diffuseColor.rgb *= ( 0.93 + 0.14 * heather ) * ( 1.0 - 0.1 * blotch ) * ( 1.0 - 0.22 * hem * ( 0.5 + blotch ) );
		diffuseColor.rgb *= mix( vHlTint, vHlShaft, shaft );
	}
`;

// Age (Odile): a paler, less rosy skin, shadows under the eyes and down from the nose, a few forehead
// lines and crow's feet, and faint age spots. Female head, bind-space metres (eyes at y 1.64-1.67).
const AGE_FRAG = /* glsl */ `
	if ( hlAge > 0.0 && vHlPos.y > 1.55 ) {
		vec3 q = vHlPos;
		float ax = abs( q.x );
		float g = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
		diffuseColor.rgb = mix( diffuseColor.rgb, vec3( g ) * vec3( 1.06, 1.0, 0.95 ), 0.14 * hlAge );
		float front = smoothstep( 0.03, 0.06, q.z );
		float bag = exp( -pow( ( ax - 0.03 ) / 0.02, 2.0 ) - pow( ( q.y - 1.637 ) / 0.007, 2.0 ) );
		float fold = exp( -pow( ( ax - 0.021 - ( 1.625 - q.y ) * 0.35 ) / 0.0035, 2.0 ) ) * smoothstep( 1.575, 1.59, q.y ) * smoothstep( 1.63, 1.615, q.y );
		float crow = exp( -pow( ( ax - 0.066 ) / 0.008, 2.0 ) - pow( ( q.y - 1.656 ) / 0.012, 2.0 ) ) * ( 0.5 + 0.5 * sin( q.y * 900.0 + ax * 300.0 ) );
		float brow = smoothstep( 1.69, 1.7, q.y ) * smoothstep( 1.735, 1.72, q.y ) * smoothstep( 0.05, 0.07, q.z ) * pow( 0.5 + 0.5 * sin( q.y * 1150.0 ), 6.0 );
		float spots = smoothstep( 0.78, 0.86, hlNoise( q * 160.0 ) );
		float dark = ( 0.26 * bag + 0.3 * fold + 0.2 * crow + 0.14 * brow ) * front + 0.1 * spots;
		diffuseColor.rgb *= 1.0 - dark * hlAge;
		diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 0.9, 0.84, 0.86 ), bag * front * hlAge * 0.4 );
	}
`;

const LEG_TRACK = /^(thigh|calf|foot|ball)_[lr]\.quaternion$/;

/**
 * Shorten a locomotion loop's stride in place (cast.js CLIP_STRIDE): every leg rotation is slerped
 * towards its cycle mean by `legs`, and the pelvis track (armature space, Z up) is raised by `lift`.
 */
function shortenStride(clip, { legs, lift }) {
  const mean = new THREE.Quaternion();
  const q = new THREE.Quaternion();
  for (const t of clip.tracks) {
    if (LEG_TRACK.test(t.name)) {
      const v = Float32Array.from(t.values);
      const n = v.length / 4;
      mean.set(0, 0, 0, 0);
      for (let i = 0; i < n; i++) {
        q.fromArray(v, i * 4);
        if (mean.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
        mean.set(mean.x + q.x, mean.y + q.y, mean.z + q.z, mean.w + q.w);
      }
      mean.normalize();
      for (let i = 0; i < n; i++) q.fromArray(v, i * 4).slerp(mean, 1 - legs).toArray(v, i * 4);
      t.values = v;
    } else if (t.name === 'pelvis.position') {
      const v = Float32Array.from(t.values);
      for (let i = 2; i < v.length; i += 3) v[i] += lift;
      t.values = v;
    }
  }
}

let _apronTex = null;
/** Worn canvas for the apron (shared): weave, grime, a pocket, and a sign painter's flecks and wipes. */
function apronTexture() {
  if (_apronTex) return _apronTex;
  const W = 256;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#d8d0c0';
  g.fillRect(0, 0, W, H);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < H; y += 2) {
    g.fillStyle = `rgba(60,48,30,${0.03 + rnd() * 0.04})`;
    g.fillRect(0, y, W, 1);
  }
  for (let x = 0; x < W; x += 2) {
    g.fillStyle = `rgba(255,250,235,${0.02 + rnd() * 0.03})`;
    g.fillRect(x, 0, 1, H);
  }
  // Grime: darker towards the hem and where hands wipe (the sides at the waist).
  const hem = g.createLinearGradient(0, H * 0.55, 0, H);
  hem.addColorStop(0, 'rgba(50,38,24,0)');
  hem.addColorStop(1, 'rgba(50,38,24,0.35)');
  g.fillStyle = hem;
  g.fillRect(0, 0, W, H);
  for (const sx of [0.12, 0.88]) {
    const r = g.createRadialGradient(W * sx, H * 0.42, 4, W * sx, H * 0.42, 70);
    r.addColorStop(0, 'rgba(40,30,20,0.3)');
    r.addColorStop(1, 'rgba(40,30,20,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, W, H);
  }
  // Pocket and hem stitching.
  g.strokeStyle = 'rgba(60,45,28,0.55)';
  g.lineWidth = 2;
  g.strokeRect(W * 0.28, H * 0.44, W * 0.44, H * 0.12);
  g.setLineDash([4, 4]);
  g.strokeRect(6, 6, W - 12, H - 12);
  g.setLineDash([]);
  // Paint: flecks, drips and a couple of brush wipes in the sign colours.
  const inks = ['#8c2a22', '#2f4f7a', '#e8e2d0', '#2a2a28', '#5d7a3a', '#c9a23a'];
  for (let i = 0; i < 140; i++) {
    g.fillStyle = inks[Math.floor(rnd() * inks.length)];
    g.globalAlpha = 0.5 + rnd() * 0.4;
    g.beginPath();
    g.arc(rnd() * W, H * 0.25 + rnd() * H * 0.75, 0.8 + rnd() * 2.4, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 6; i++) {
    g.strokeStyle = inks[i % inks.length];
    g.globalAlpha = 0.45;
    g.lineWidth = 5 + rnd() * 5;
    g.lineCap = 'round';
    const x = (i % 2 ? 0.8 : 0.08) * W + rnd() * 20;
    const y = H * (0.4 + rnd() * 0.25);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 30, y + 30 + rnd() * 40);
    g.stroke();
  }
  g.globalAlpha = 1;
  _apronTex = new THREE.CanvasTexture(c);
  _apronTex.colorSpace = THREE.SRGBColorSpace;
  _apronTex.anisotropy = 4;
  _apronTex.userData.shared = true;
  return _apronTex;
}

function kindOf(materialName) {
  if (/^skin/.test(materialName)) return 'skin';
  if (/^hair/.test(materialName)) return 'hair';
  if (/^eyes/.test(materialName)) return 'eyes';
  return 'cloth';
}

/** Caller overrides on a recipe (scale, tint of the primary garment or kit top). */
function applyOverrides(recipe, { tint, scale } = {}) {
  const r = { ...recipe, colors: { ...(recipe.colors || {}) }, kit: recipe.kit ? { ...recipe.kit } : undefined };
  if (scale !== undefined) r.scale = scale;
  if (tint !== undefined && tint !== null) {
    if (r.apron) r.apron = tint; // Odile: callers' "ochre" tint is the apron
    else if (r.kit) r.kit.top = tint;
    else for (const p of r.primary || []) r.colors[p] = tint;
  }
  return r;
}

