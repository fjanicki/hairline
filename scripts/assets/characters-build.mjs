// Builds the web-ready character set from the Quaternius "Universal" packs (CC0).
// Usage: node scripts/assets/characters-build.mjs <src-dir> <out-dir>
//   <src-dir> holds the extracted pack folders ubc/, ual1/, ual2/, outfits/ (see characters.sh).
// Writes into <out-dir>:
//   parts.glb    one 65-bone skeleton + every body / head / hair / outfit part as its own skinned mesh,
//                each with its own inverse bind matrices; rest poses for the 4 rigs in scene extras
//   anims.glb    the mannequin skeleton (no mesh) + only the clips we use, renamed to our names
//   kit_m.png, kit_f.png   RGBA garment masks in the athletic body UVs: R top, G sleeves (1 short / 0.5 long),
//                B legs (1 shorts / 0.5 full length), A shoes
// and <src-dir>/manifest.json (part tris / luminance, clip durations) for reference.
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, dedup, quantize, resample, compactPrimitive, getBounds, unpartition } from '@gltf-transform/functions';
import sharp from 'sharp';
import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [SRC, OUT] = process.argv.slice(2);
if (!SRC || !OUT) { console.error('usage: characters-build.mjs <src-dir> <out-dir>'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const log = (...a) => console.log('  [characters]', ...a);

const UBC = join(SRC, 'ubc/Universal Base Characters[Standard]');
const BODY_DIR = join(UBC, 'Base Characters/Godot - UE');
const HAIR_DIR = join(UBC, 'Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)');
const OUTFIT_DIR = join(SRC, 'outfits/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits');
const UAL1 = join(SRC, 'ual1/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb');
const UAL2 = join(SRC, 'ual2/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb');

// ---------------------------------------------------------------------------------------------
// What we ship. Part name -> [source file, node name in source]. Sexes: m / f.
const RIGS = {
  // rig name: source glTF whose joint rest pose the parts were bound to
  m_athletic: join(BODY_DIR, 'Superhero_Male_FullBody.gltf'),
  f_athletic: join(BODY_DIR, 'Superhero_Female_FullBody.gltf'),
  m_regular: join(OUTFIT_DIR, 'Male_Peasant.gltf'),
  f_regular: join(OUTFIT_DIR, 'Female_Peasant.gltf'),
};
const PARTS = {
  m_body: [RIGS.m_athletic, 'SuperHero_Male'], // full athletic body (runners); the head is cut from it too
  m_eyes: [RIGS.m_athletic, 'Eyes'],
  m_brows: [RIGS.m_athletic, 'Eyebrows'],
  f_body: [RIGS.f_athletic, 'Superhero_Female'],
  f_eyes: [RIGS.f_athletic, 'Eyes'],
  f_brows: [RIGS.f_athletic, 'Eyebrows'],
  m_shirt: [RIGS.m_regular, 'Male_Peasant_Body'],
  m_sleeves: [RIGS.m_regular, 'Male_Peasant_Arms'], // sleeves + bare hands
  m_trousers: [RIGS.m_regular, 'Male_Peasant_Legs'],
  m_shoes: [RIGS.m_regular, 'Male_Peasant_Feet'],
  f_blouse: [RIGS.f_regular, 'Female_Peasant_Body'],
  f_sleeves: [RIGS.f_regular, 'Female_Peasant_Arms'],
  f_trousers: [RIGS.f_regular, 'Female_Peasant_Legs'],
  f_shoes: [RIGS.f_regular, 'Female_Peasant_Feet'],
  m_trousers2: [join(OUTFIT_DIR, 'Male_Ranger.gltf'), 'Male_Ranger_Legs'],
  m_boots: [join(OUTFIT_DIR, 'Male_Ranger.gltf'), 'Male_Ranger_Feet_Boots'],
  m_hood: [join(OUTFIT_DIR, 'Male_Ranger.gltf'), 'Male_Ranger_Head_Hood'],
  f_trousers2: [join(OUTFIT_DIR, 'Female_Ranger.gltf'), 'Female_Ranger_Legs'],
  f_boots: [join(OUTFIT_DIR, 'Female_Ranger.gltf'), 'Female_Ranger_Feet'],
  f_hood: [join(OUTFIT_DIR, 'Female_Ranger.gltf'), 'Female_Ranger_Head_Hood'],
  hair_buzzed: [join(HAIR_DIR, 'Hair_Buzzed.gltf'), 'Hair_Buzzed'],
  hair_parted: [join(HAIR_DIR, 'Hair_SimpleParted.gltf'), 'Hair_SimpleParted'],
  hair_beard: [join(HAIR_DIR, 'Hair_Beard.gltf'), 'Hair_Beard'],
  hair_long: [join(HAIR_DIR, 'Hair_Long.gltf'), 'Hair_Long'],
  hair_buns: [join(HAIR_DIR, 'Hair_Buns.gltf'), 'Hair_Buns'],
  hair_buzzed_f: [join(HAIR_DIR, 'Hair_BuzzedFemale.gltf'), 'Hair_BuzzedFemale'],
};
// Cut parts (bind pose, metres; a triangle is kept when its centroid passes `keep`).
//   heads for the clothed rigs: the athletic body above the collar (its chest would poke through the
//   regular-fit shirts) is tucked in (narrower, flatter) so it fills the collar openings without poking through
//   f_sleeves: the peasant blouse sleeves without their fantasy gloves/bracers; f_hands: bare forearms + hands instead
function tuck(yTop, yBottom, zAxis) {
  return ([x, y, z]) => {
    const t = Math.min(1, Math.max(0, (yTop - y) / (yTop - yBottom)));
    return [x * (1 - 0.25 * t), y, zAxis + (z - zAxis) * (1 - 0.5 * t)];
  };
}
const CUTS = {
  m_head: { from: 'm_body', keep: ([x, y]) => y > 1.39 && Math.abs(x) < 0.13, shape: tuck(1.53, 1.39, -0.03) },
  f_head: { from: 'f_body', keep: ([x, y]) => y > 1.39 && Math.abs(x) < 0.12, shape: tuck(1.49, 1.39, -0.04) },
  f_hands: { from: 'f_body', keep: ([x, y]) => Math.abs(x) > 0.47 && y > 1.2 },
  f_sleeves: { from: 'f_sleeves', keep: ([x]) => Math.abs(x) < 0.50, replace: true },
};
// Material renames (source name -> ours). Hands on outfit sleeves use the athletic skin (same UV layout).
const MAT = {
  MI_Superhero_Male: 'skin_m', MI_Superhero_Female: 'skin_f', MI_Regular_Male: 'skin_m', MI_Regular_Female: 'skin_f',
  MI_Eyes: 'eyes', MI_Hair_1: 'hair_1', MI_Hair_2: 'hair_2', MI_Peasant: 'cloth_a', MI_Ranger: 'cloth_b',
};
// Clips: our name -> [library file, clip name]. Kept in anims.glb in this order.
const CLIPS = {
  idle: [1, 'Idle_Loop'], walk: [1, 'Walk_Loop'], walk_formal: [1, 'Walk_Formal_Loop'], run: [1, 'Jog_Fwd_Loop'],
  sprint: [1, 'Sprint_Loop'], sneak: [1, 'Crouch_Fwd_Loop'], crouch_idle: [1, 'Crouch_Idle_Loop'],
  kneel_work: [1, 'Fixing_Kneeling'], sit_idle: [1, 'Sitting_Idle_Loop'], sit_talk: [1, 'Sitting_Talking_Loop'],
  sit_down: [1, 'Sitting_Enter'], stand_up: [1, 'Sitting_Exit'], talk: [1, 'Idle_Talking_Loop'],
  reach: [1, 'Interact'], pick_up: [1, 'PickUp_Table'], push: [1, 'Push_Loop'], paint: [1, 'Idle_Torch_Loop'],
  agree: [2, 'Yes'], headShake: [2, 'Idle_No_Loop'], arms_crossed: [2, 'Idle_FoldArms_Loop'],
  phone: [2, 'Idle_TalkingPhone_Loop'], lean: [2, 'Idle_Rail_Loop'], call_out: [2, 'Idle_Rail_Call'],
  hammer: [2, 'TreeChopping_Loop'], kneel_reach: [2, 'Farm_PlantSeed'], pour: [2, 'Farm_Watering'],
  carry: [2, 'Walk_Carry_Loop'], drink: [2, 'Consume'], open_box: [2, 'Chest_Open'], get_up: [2, 'LayToIdle'],
  hold_can: [2, 'Idle_Lantern_Loop'], shamble: [2, 'Zombie_Walk_Fwd_Loop'], slump: [2, 'Zombie_Idle_Loop'],
  fall: [2, 'Hit_Knockback'],
};

// ---------------------------------------------------------------------------------------------
// Quaternius glTFs reference a few images by wrong names (T_X_png.png); resolve them leniently.
async function readLenient(file) {
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const dir = dirname(file), resources = {};
  for (const b of json.buffers ?? []) resources[b.uri] = readFileSync(join(dir, decodeURIComponent(b.uri)));
  for (const im of json.images ?? []) {
    const cands = [im.uri, im.uri.replace(/_png\.png$/, '.png'), (im.name ?? '').replace(/(\.png)?$/, '.png')];
    const hit = cands.map((c) => join(dir, decodeURIComponent(c))).find((c) => existsSync(c));
    if (!hit) throw new Error(`missing image ${im.uri} for ${file}`);
    resources[im.uri] = readFileSync(hit);
  }
  return io.readJSON({ json, resources });
}
const findNode = (doc, name) => doc.getRoot().listNodes().find((n) => n.getName() === name);
const jointRest = (doc) => {
  const out = {};
  for (const j of doc.getRoot().listSkins()[0].listJoints()) out[j.getName()] = { t: j.getTranslation().map((v) => +v.toFixed(5)), r: j.getRotation().map((v) => +v.toFixed(5)) };
  return out;
};

// ---------------------------------------------------------------------------------------------
// PARTS
async function buildParts() {
  const doc = new Document();
  doc.createBuffer();
  const scene = doc.createScene('characters');
  doc.getRoot().setDefaultScene(scene);
  const armature = doc.createNode('Armature');
  scene.addChild(armature);
  let joints = null; // name -> Node in doc
  const rests = {};
  const sources = new Map(); // file -> merged map
  const skinCache = new Map(); // source skin (merged) -> our skin
  const srcDocs = new Map();

  for (const [rig, file] of Object.entries(RIGS)) rests[rig] = jointRest(await readLenient(file));

  async function source(file) {
    if (sources.has(file)) return sources.get(file);
    const src = await readLenient(file);
    srcDocs.set(file, src);
    const map = mergeDocuments(doc, src);
    if (!joints) {
      // The first source (athletic male) provides our one skeleton.
      const srcRoot = src.getRoot().listSkins()[0].listJoints()[0];
      const root = map.get(srcRoot);
      root.getParentNode()?.removeChild(root);
      armature.addChild(root);
      joints = new Map();
      root.traverse((n) => joints.set(n.getName(), n));
    }
    sources.set(file, map);
    return map;
  }

  const parts = {};
  for (const [part, [file, nodeName]] of Object.entries(PARTS)) {
    const map = await source(file);
    const srcNode = findNode(srcDocs.get(file), nodeName);
    if (!srcNode) throw new Error(`node ${nodeName} not in ${file}`);
    const node = map.get(srcNode);
    const srcSkin = node.getSkin();
    let skin = skinCache.get(srcSkin);
    if (!skin) {
      skin = doc.createSkin(part).setInverseBindMatrices(srcSkin.getInverseBindMatrices()).setSkeleton(joints.get('root'));
      for (const j of srcSkin.listJoints()) {
        const ours = joints.get(j.getName());
        if (!ours) throw new Error(`joint ${j.getName()} missing in our skeleton`);
        skin.addJoint(ours);
      }
      skinCache.set(srcSkin, skin);
    }
    node.getParentNode()?.removeChild(node);
    node.setSkin(skin).setName(part);
    node.getMesh().setName(part);
    armature.addChild(node);
    parts[part] = node;
  }

  // Drop everything merged that we did not adopt (source scenes, armatures, animations).
  for (const s of doc.getRoot().listScenes()) if (s !== scene) s.dispose();
  const keep = new Set();
  armature.traverse((n) => keep.add(n));
  for (const n of doc.getRoot().listNodes()) if (!keep.has(n)) n.dispose();
  for (const a of doc.getRoot().listAnimations()) a.dispose();

  for (const [part, { from, keep, replace, shape }] of Object.entries(CUTS)) {
    const srcNode = parts[from];
    const mesh = doc.createMesh(part);
    for (const prim of srcNode.getMesh().listPrimitives()) {
      const pos = prim.getAttribute('POSITION'), idx = prim.getIndices().getArray();
      const kept = [], a = [], b = [], c = [];
      for (let t = 0; t < idx.length; t += 3) {
        pos.getElement(idx[t], a); pos.getElement(idx[t + 1], b); pos.getElement(idx[t + 2], c);
        if (keep([0, 1, 2].map((k) => (a[k] + b[k] + c[k]) / 3))) kept.push(idx[t], idx[t + 1], idx[t + 2]);
      }
      if (!kept.length) continue;
      const cut = prim.clone();
      cut.setIndices(doc.createAccessor(part + '_idx').setType('SCALAR').setArray(new Uint32Array(kept)));
      compactPrimitive(cut);
      if (shape) {
        const pos2 = cut.getAttribute('POSITION'), v = [];
        for (let i = 0; i < pos2.getCount(); i++) pos2.setElement(i, shape(pos2.getElement(i, v)));
      }
      mesh.addPrimitive(cut);
    }
    if (replace) {
      const old = srcNode.getMesh();
      srcNode.setMesh(mesh);
      old.dispose();
      continue;
    }
    const node = doc.createNode(part).setMesh(mesh).setSkin(srcNode.getSkin());
    armature.addChild(node);
    parts[part] = node;
  }

  // Attributes: keep POSITION NORMAL TEXCOORD_0 JOINTS_0 WEIGHTS_0; renormalise 4 weights.
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    for (const s of prim.listSemantics()) if (!/^(POSITION|NORMAL|TEXCOORD_0|JOINTS_0|WEIGHTS_0)$/.test(s)) prim.setAttribute(s, null);
    const w = prim.getAttribute('WEIGHTS_0');
    if (w) {
      const el = [];
      for (let i = 0; i < w.getCount(); i++) {
        w.getElement(i, el);
        const sum = el.reduce((a, b) => a + b, 0) || 1;
        w.setElement(i, el.map((v) => v / sum));
      }
    }
  }

  // Materials: rename, merge duplicates by our name.
  const byName = new Map();
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const m = prim.getMaterial();
    const ours = MAT[m.getName()] ?? (Object.values(MAT).includes(m.getName()) ? m.getName() : null);
    if (!ours) throw new Error(`unmapped material ${m.getName()}`);
    if (!byName.has(ours)) byName.set(ours, m.setName(ours));
    prim.setMaterial(byName.get(ours));
  }
  for (const m of doc.getRoot().listMaterials()) {
    // Hair, eyes and skin are dielectric; the cloth ORM's blue channel marks the metal buckles.
    if (!/^cloth/.test(m.getName())) m.setMetallicFactor(0);
    m.setDoubleSided(m.getName().startsWith('hair') || m.getName().startsWith('cloth'));
  }

  await prune()(doc);
  await dedup()(doc);
  await processTextures(doc, parts);
  await measureParts(doc, parts);

  // Facing: the eyes sit in front of the Head joint. Report it (three.js convention check).
  const eyes = getBounds(parts.m_eyes);
  log(`eyes centre z=${((eyes.min[2] + eyes.max[2]) / 2).toFixed(3)} (positive = model faces +Z)`);

  // Mannequin rest (anims) for the pelvis height offset.
  const ual = await io.read(UAL1);
  rests.mannequin = jointRest(ual);
  const pelvisZ = (r) => r.pelvis.t[2];
  scene.setExtras({
    hairline: {
      rigs: Object.fromEntries(Object.entries(rests).map(([k, r]) => [k, Object.fromEntries(Object.entries(r).map(([b, v]) => [b, v.t]))])),
      pelvisRest: Object.fromEntries(Object.keys(rests).map((k) => [k, pelvisZ(rests[k])])),
      licence: 'CC0 1.0, Quaternius (Universal Base Characters, Modular Character Outfits - Fantasy)',
    },
  });

  await quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8, normalizeWeights: true })(doc);
  await prune()(doc);
  await unpartition()(doc);
  await io.write(join(OUT, 'parts.glb'), doc);
  return { parts, doc };
}

// Textures: <=1k JPG (eyes keep 256). Cloth albedo is made grey and levelled per part (mean linear
// luminance ~CLOTH_LUM inside each part's UV islands), so one recipe tint lands on its colour.
const CLOTH_LUM = 0.42;
async function processTextures(doc, parts) {
  for (const tex of doc.getRoot().listTextures()) {
    const name = tex.getName() || tex.getURI();
    const slots = new Set();
    for (const m of doc.getRoot().listMaterials()) {
      if (m.getBaseColorTexture() === tex) slots.add(m.getName().startsWith('cloth') ? 'cloth' : 'base');
      if (m.getNormalTexture() === tex) slots.add('normal');
      if (m.getMetallicRoughnessTexture() === tex) slots.add('mr');
    }
    let img = sharp(Buffer.from(tex.getImage())).removeAlpha();
    const meta = await img.metadata();
    const size = Math.min(meta.width, 1024);
    img = img.resize(size, size, { kernel: 'lanczos3' });
    if (slots.has('base') && /Superhero/.test(name)) img = img.modulate({ saturation: 0.78, brightness: 1.06 }); // skin: less orange, tint per recipe
    if (slots.has('cloth')) {
      const { data } = await img.greyscale().raw().toBuffer({ resolveWithObject: true });
      img = sharp(levelCloth(data, size, tex, parts), { raw: { width: size, height: size, channels: 1 } }).toColourspace('srgb');
    }
    const buf = await img.jpeg({ quality: slots.has('normal') ? 92 : 86, mozjpeg: true }).toBuffer();
    tex.setImage(new Uint8Array(buf)).setMimeType('image/jpeg').setURI(name.replace(/\.png$/i, '') + '.jpg');
    log(`texture ${name} ${meta.width}->${size} [${[...slots].join(',')}] ${(buf.length / 1024).toFixed(0)} KB`);
  }
}
const toLin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const toSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
function levelCloth(grey, S, tex, parts) {
  const gain = new Float32Array(S * S); // 0 = not covered yet
  for (const node of Object.values(parts)) {
    const prims = node.getMesh().listPrimitives().filter((p) => p.getMaterial()?.getBaseColorTexture() === tex);
    if (!prims.length) continue;
    const cover = new Uint8Array(S * S);
    let sum = 0, cnt = 0;
    const a = [], b = [], c = [];
    for (const prim of prims) {
      const uv = prim.getAttribute('TEXCOORD_0'), idx = prim.getIndices().getArray();
      const wrap = (e) => [(e[0] - Math.floor(e[0])) * S, (e[1] - Math.floor(e[1])) * S];
      for (let t = 0; t < idx.length; t += 3) {
        uv.getElement(idx[t], a); uv.getElement(idx[t + 1], b); uv.getElement(idx[t + 2], c);
        rasterTri(S, wrap(a), wrap(b), wrap(c), (x, y) => {
          const o = y * S + x;
          if (cover[o]) return;
          cover[o] = 1; sum += toLin(grey[o] / 255); cnt++;
        });
      }
    }
    const g = Math.min(25, Math.max(1, CLOTH_LUM / Math.max(1e-4, sum / Math.max(1, cnt))));
    for (let o = 0; o < S * S; o++) if (cover[o]) gain[o] = Math.max(gain[o], g);
  }
  // Spread gains a few texels past the island borders (bilinear / mip sampling), default 1.
  for (let pass = 0; pass < 6; pass++) {
    const next = gain.slice();
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const o = y * S + x;
      if (gain[o]) continue;
      const n = [x > 0 && gain[o - 1], x < S - 1 && gain[o + 1], y > 0 && gain[o - S], y < S - 1 && gain[o + S]].filter(Boolean);
      if (n.length) next[o] = Math.max(...n);
    }
    gain.set(next);
  }
  const out = Buffer.alloc(S * S);
  for (let o = 0; o < S * S; o++) {
    let v = toLin(grey[o] / 255) * (gain[o] || 1);
    if (v > 0.8) v = 0.8 + 0.2 * (1 - Math.exp(-(v - 0.8) / 0.2)); // soft shoulder, no hard clip
    out[o] = Math.round(toSrgb(v) * 255);
  }
  return out;
}

// Per-part mean albedo luminance (linear), so a recipe tint can be compensated to land on its colour.
async function measureParts(doc, parts) {
  const cache = new Map();
  const pixels = async (tex) => {
    if (!cache.has(tex)) {
      const { data, info } = await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      cache.set(tex, { data, w: info.width, h: info.height, c: info.channels });
    }
    return cache.get(tex);
  };
  const lin = (v) => toLin(v / 255);
  for (const [part, node] of Object.entries(parts)) {
    const prim = node.getMesh().listPrimitives()[0];
    const tex = prim.getMaterial().getBaseColorTexture();
    let tris = 0;
    for (const p of node.getMesh().listPrimitives()) tris += p.getIndices().getCount() / 3;
    const extras = { part, tris, material: prim.getMaterial().getName() };
    if (tex) {
      // Mean linear luminance over the texels the part covers (UV raster), not per vertex.
      const px = await pixels(tex);
      const S = px.w, cover = new Uint8Array(S * px.h);
      let sum = 0, cnt = 0;
      const a = [], b = [], c = [];
      const wrap = (e) => [(e[0] - Math.floor(e[0])) * S, (e[1] - Math.floor(e[1])) * px.h];
      for (const p of node.getMesh().listPrimitives()) {
        if (p.getMaterial().getBaseColorTexture() !== tex) continue;
        const uv = p.getAttribute('TEXCOORD_0'), idx = p.getIndices().getArray();
        for (let t = 0; t < idx.length; t += 3) {
          uv.getElement(idx[t], a); uv.getElement(idx[t + 1], b); uv.getElement(idx[t + 2], c);
          rasterTri(S, wrap(a), wrap(b), wrap(c), (x, y) => {
            const o = y * S + x;
            if (cover[o]) return;
            cover[o] = 1; cnt++;
            sum += 0.2126 * lin(px.data[o * px.c]) + 0.7152 * lin(px.data[o * px.c + 1]) + 0.0722 * lin(px.data[o * px.c + 2]);
          });
        }
      }
      extras.lum = +(sum / Math.max(1, cnt)).toFixed(4);
    }
    node.setExtras(extras);
  }
}

// ---------------------------------------------------------------------------------------------
// KIT MASKS: rasterise garment regions of the athletic bodies into their UV space.
async function buildKitMask(file, nodeName, out) {
  const src = await readLenient(file);
  const node = findNode(src, nodeName);
  const prim = node.getMesh().listPrimitives()[0];
  const skin = node.getSkin();
  const names = skin.listJoints().map((j) => j.getName());
  const pos = prim.getAttribute('POSITION'), uv = prim.getAttribute('TEXCOORD_0');
  const J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
  const idx = prim.getIndices().getArray();
  const n = pos.getCount();
  // Joint heights from the inverse bind matrices (bind pose).
  const ibm = skin.getInverseBindMatrices(), m = [];
  const jointY = {};
  names.forEach((nm, i) => { ibm.getElement(i, m); jointY[nm] = worldOfInverse(m)[1]; });
  const kneeY = jointY.calf_l, ankleY = jointY.foot_l, hipY = jointY.pelvis, neckY = jointY.neck_01;
  ibm.getElement(names.indexOf('hand_l'), m);
  const wristX = Math.abs(worldOfInverse(m)[0]);
  const vals = new Float32Array(n * 4);
  const p = [], j = [], w = [];
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < n; i++) {
    pos.getElement(i, p); J.getElement(i, j); W.getElement(i, w);
    const wsum = (re) => j.reduce((s, ji, k) => s + (re.test(names[ji]) ? w[k] : 0), 0);
    const torso = wsum(/^(spine_0[123]|clavicle_[lr])$/) + 0.6 * wsum(/^pelvis$/);
    const upperArm = wsum(/^upperarm_[lr]$/);
    const arm = upperArm + wsum(/^(lowerarm|hand|thumb|index|middle|ring|pinky)/);
    const legs = wsum(/^(pelvis|thigh_[lr])$/);
    const feet = wsum(/^(foot|ball)/);
    // Top: torso from the waistband to the neck; arms excluded outside the armholes (keeps singlet straps).
    const top = smooth(neckY + 0.01, neckY - 0.04, p[1]) * smooth(hipY + 0.02, hipY + 0.07, p[1]) * (1 - smooth(0.5, 0.75, arm) * smooth(0.11, 0.15, Math.abs(p[0])));
    // Sleeves: the upper half of the upper arm (distance from the shoulder axis).
    const shoulderX = Math.abs(p[0]);
    const sleeve = smooth(0.3, 0.6, upperArm) * (1 - smooth(0.30, 0.38, shoulderX));
    // Long sleeves (value 0.5): the whole arm to just short of the wrist.
    const longSleeve = smooth(0.3, 0.6, arm) * (1 - smooth(wristX - 0.05, wristX - 0.02, shoulderX));
    // Shorts: pelvis and thighs down to a hand above the knee.
    const shorts = Math.min(1, legs) * smooth(kneeY + 0.12, kneeY + 0.18, p[1]) * (1 - smooth(0.3, 0.6, torso + arm)) + (p[1] > kneeY + 0.18 && p[1] < hipY + 0.06 && Math.abs(p[0]) < 0.25 ? 1 : 0);
    const shoes = Math.max(smooth(0.3, 0.6, feet), 1 - smooth(ankleY + 0.02, ankleY + 0.06, p[1]));
    // Long legs (value 0.5): thighs and calves down to the shoes.
    const longLegs = smooth(0.3, 0.6, legs + wsum(/^calf_[lr]$/)) * (1 - smooth(0.3, 0.6, arm)) * smooth(ankleY + 0.03, ankleY + 0.07, p[1]);
    // R top, G sleeves (1 short, 0.5 long), B legs (1 shorts, 0.5 full length), A shoes.
    vals.set([top, Math.max(sleeve, 0.5 * longSleeve), Math.max(Math.min(1, shorts), 0.5 * longLegs), shoes], i * 4);
  }
  const S = 512;
  const img = new Float32Array(S * S * 4), cov = new Uint8Array(S * S);
  const a = [], b = [], c = [];
  for (let t = 0; t < idx.length; t += 3) {
    const [i0, i1, i2] = [idx[t], idx[t + 1], idx[t + 2]];
    uv.getElement(i0, a); uv.getElement(i1, b); uv.getElement(i2, c);
    rasterTri(S, [a[0] * S, a[1] * S], [b[0] * S, b[1] * S], [c[0] * S, c[1] * S], (x, y, l0, l1, l2) => {
      const o = y * S + x;
      for (let k = 0; k < 4; k++) img[o * 4 + k] = l0 * vals[i0 * 4 + k] + l1 * vals[i1 * 4 + k] + l2 * vals[i2 * 4 + k];
      cov[o] = 1;
    });
  }
  // Dilate 4 px into empty texels so bilinear sampling at UV seams does not bleed.
  for (let pass = 0; pass < 4; pass++) {
    const nc = cov.slice();
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const o = y * S + x;
      if (cov[o]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= S || yy >= S || !cov[yy * S + xx]) continue;
        for (let k = 0; k < 4; k++) img[o * 4 + k] = img[(yy * S + xx) * 4 + k];
        nc[o] = 1;
        break;
      }
    }
    cov.set(nc);
  }
  const bytes = new Uint8Array(S * S * 4);
  for (let i = 0; i < img.length; i++) bytes[i] = Math.round(Math.min(1, Math.max(0, img[i])) * 255);
  await sharp(Buffer.from(bytes), { raw: { width: S, height: S, channels: 4 } }).png({ compressionLevel: 9 }).toFile(out);
  log(`kit mask ${out.split('/').pop()} (knee ${kneeY.toFixed(2)} hip ${hipY.toFixed(2)} neck ${neckY.toFixed(2)})`);
}
function worldOfInverse(m) {
  // Translation of the inverse of an affine column-major 4x4 (rotation part orthonormal * scale 1).
  const t = [m[12], m[13], m[14]];
  return [-(m[0] * t[0] + m[1] * t[1] + m[2] * t[2]), -(m[4] * t[0] + m[5] * t[1] + m[6] * t[2]), -(m[8] * t[0] + m[9] * t[1] + m[10] * t[2])];
}
function rasterTri(S, p0, p1, p2, fn) {
  const minX = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0]) - 1)), maxX = Math.min(S - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0]) + 1));
  const minY = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1]) - 1)), maxY = Math.min(S - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1]) + 1));
  const area = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
  if (Math.abs(area) < 1e-9) return;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const px = x + 0.5, py = y + 0.5;
    const l1 = ((px - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (py - p0[1])) / area;
    const l2 = ((p1[0] - p0[0]) * (py - p0[1]) - (px - p0[0]) * (p1[1] - p0[1])) / area;
    const l0 = 1 - l1 - l2;
    const e = -0.02; // slight conservative edge so neighbouring triangles meet
    if (l0 >= e && l1 >= e && l2 >= e) fn(x, y, Math.max(0, l0), Math.max(0, l1), Math.max(0, l2));
  }
}

// ---------------------------------------------------------------------------------------------
// ANIMS: mannequin skeleton (no mesh) + the clips we use. Rotation tracks for every bone, translation
// only for the pelvis (keeps each rig's bone lengths), no scale tracks. Renamed to our names.
async function buildAnims() {
  const doc = await io.read(UAL1);
  const ual2 = await io.read(UAL2);
  const ual2Anims = new Set(ual2.getRoot().listAnimations());
  const map = mergeDocuments(doc, ual2);
  const merged2 = new Set([...ual2Anims].map((a) => map.get(a)));
  const skeleton = doc.getRoot().listSkins()[0].listJoints();
  const nodes = new Map(skeleton.map((j) => [j.getName(), j]));
  const wanted = new Map(Object.entries(CLIPS).map(([ours, [lib, name]]) => [`${lib}:${name}`, ours]));
  const durations = {};
  for (const anim of doc.getRoot().listAnimations()) {
    const ours = wanted.get(`${merged2.has(anim) ? 2 : 1}:${anim.getName()}`);
    if (!ours) { anim.listSamplers().forEach((sm) => sm.dispose()); anim.dispose(); continue; }
    anim.setName(ours);
    for (const ch of anim.listChannels()) {
      const target = ch.getTargetNode(), path = ch.getTargetPath();
      const name = target?.getName();
      if (!target || path === 'scale' || (path === 'translation' && name !== 'pelvis')) { ch.getSampler().dispose(); ch.dispose(); continue; }
      ch.setTargetNode(nodes.get(name)); // UAL2 channels -> the UAL1 skeleton
    }
    let d = 0;
    for (const sm of anim.listSamplers()) { const arr = sm.getInput().getArray(); d = Math.max(d, arr[arr.length - 1]); }
    durations[ours] = +d.toFixed(2);
  }
  const missing = [...wanted.values()].filter((v) => durations[v] === undefined);
  if (missing.length) throw new Error('clips not found: ' + missing.join(', '));
  // Keep only the UAL1 skeleton nodes: no meshes, skins, materials or the merged UAL2 scene.
  const keep = new Set(skeleton);
  const scene = doc.getRoot().listScenes()[0];
  const armature = skeleton[0].getParentNode();
  if (armature) keep.add(armature);
  for (const s of doc.getRoot().listScenes()) if (s !== scene) s.dispose();
  for (const n of doc.getRoot().listNodes()) {
    if (!keep.has(n)) n.dispose();
    else n.setMesh(null).setSkin(null);
  }
  for (const s of doc.getRoot().listSkins()) s.dispose();
  await resample({ tolerance: 1e-4 })(doc);
  // Rotations as normalised int16 (core glTF allows it for rotation outputs; ~1e-4 precision).
  for (const anim of doc.getRoot().listAnimations()) for (const ch of anim.listChannels()) {
    if (ch.getTargetPath() !== 'rotation') continue;
    const out = ch.getSampler().getOutput();
    if (out.getComponentType() !== 5126) continue;
    const f = out.getArray(), i16 = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) i16[i] = Math.round(Math.max(-1, Math.min(1, f[i])) * 32767);
    const q = doc.createAccessor().setType('VEC4').setArray(i16).setNormalized(true);
    ch.getSampler().setOutput(q);
  }
  await dedup()(doc);
  await prune({ keepLeaves: true })(doc);
  scene.setExtras({ hairline: { clips: durations, source: Object.fromEntries(Object.entries(CLIPS).map(([k, [l, n]]) => [k, `UAL${l}:${n}`])) } });
  // Accessors still held only by detached samplers (from the merged documents) are dropped explicitly.
  const live = new Set(doc.getRoot().listAnimations().flatMap((a) => a.listSamplers()));
  for (const a of doc.getRoot().listAccessors()) if (!a.listParents().some((p) => live.has(p))) a.dispose();
  await unpartition()(doc);
  await io.write(join(OUT, 'anims.glb'), doc);
  return durations;
}

// ---------------------------------------------------------------------------------------------
const t0 = Date.now();
const { parts } = await buildParts();
await buildKitMask(RIGS.m_athletic, 'SuperHero_Male', join(OUT, 'kit_m.png'));
await buildKitMask(RIGS.f_athletic, 'Superhero_Female', join(OUT, 'kit_f.png'));
const durations = await buildAnims();
const kb = (f) => (statSync(join(OUT, f)).size / 1024).toFixed(0) + ' KB';
log(`parts.glb ${kb('parts.glb')}, anims.glb ${kb('anims.glb')} (${Object.keys(durations).length} clips), kit masks ${kb('kit_m.png')} + ${kb('kit_f.png')}`);
// Human-readable summary next to the sources (not shipped).
writeFileSync(join(SRC, 'manifest.json'), JSON.stringify({
  parts: Object.fromEntries(Object.entries(parts).map(([k, n]) => [k, n.getExtras()])),
  clips: durations,
}, null, 1));
log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
