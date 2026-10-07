import * as THREE from 'three';

// Ch3 race crowd: animated impostors baked from the real cast at build time.
//
// bakeCrowdAtlas() poses a handful of real spectator characters (assets.makeCharacter) through two
// clips each (calm and cheering), renders FRAMES frames of each into one atlas (a row per archetype
// and state, a column per frame), then disposes them. crowdMesh() draws hundreds of spectators as
// one InstancedMesh of camera-facing quads (turning about Y only) that sample the atlas: per
// instance an archetype row, a phase, a mirror flag and an excitement threshold. One draw call, no
// skinning; the near front row stays real characters (scene3.js).

const CELL_W = 128;
const CELL_H = 256;
export const FRAMES = 8;
// The bake frame in metres (the quad has the same extents): 1.1 m wide, -0.15..2.05 m high.
const FRAME_W = 1.1;
const FRAME_Y0 = -0.15;
const FRAME_H = 2.2;

/**
 * Bake the atlas. archetypes: [{ preset, variant, seed, tint, calm, cheer }] (clip names).
 * Returns { texture, rows, dispose } or null if the characters are unavailable.
 */
export function bakeCrowdAtlas(ctx, archetypes) {
  const { renderer, assets } = ctx;
  if (!renderer || !assets?.kit?.ready) return null;
  const rows = archetypes.length * 2;
  const atlas = new THREE.WebGLRenderTarget(CELL_W * FRAMES, CELL_H * rows, {
    type: THREE.UnsignedByteType,
    colorSpace: THREE.SRGBColorSpace,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });
  const cell = new THREE.WebGLRenderTarget(CELL_W, CELL_H, { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, samples: 4 });

  // Bake light: a cool sky dome, a soft key from the front-left and a warm rim from behind (the
  // race morning's low sun ahead of the runners lights the spectators from the side).
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#c9d8ee', '#4a443c', 2.1));
  const key = new THREE.DirectionalLight('#fff4e6', 2.2);
  key.position.set(-1.2, 1.6, 2.2);
  const rim = new THREE.DirectionalLight('#ffe2b8', 1.4);
  rim.position.set(1.5, 1.2, -2);
  scene.add(key, rim);
  const cam = new THREE.OrthographicCamera(-FRAME_W / 2, FRAME_W / 2, FRAME_Y0 + FRAME_H, FRAME_Y0, 0.1, 20);
  cam.position.set(0, 0, 6); // ortho bounds are camera-relative: keep the camera at y 0, level
  cam.lookAt(0, 0, 0);

  // Copy pass: cell (resolved MSAA) -> its slot in the atlas, raw (no blending, alpha kept).
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadMat = new THREE.MeshBasicMaterial({ map: cell.texture, transparent: true, blending: THREE.NoBlending, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat);
  quadScene.add(quad);

  const prevRT = renderer.getRenderTarget();
  const prevColor = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  const prevAuto = renderer.autoClear;
  const prevShadow = renderer.shadowMap.autoUpdate;
  renderer.shadowMap.autoUpdate = false;
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(atlas);
  renderer.clear(true, false, false);

  const chars = [];
  try {
    archetypes.forEach((a, ai) => {
      const ch = assets.makeCharacter({ preset: a.preset || 'spectator', variant: a.variant, seed: a.seed, tint: a.tint, name: `crowd-bake-${ai}`, castShadow: false });
      chars.push(ch);
      if (ch.isFallback || !ch.mixer) return;
      if (a.colors) for (const [p, c] of Object.entries(a.colors)) ch.setPartColor(p, c);
      ch.root.rotation.y = a.turn || 0;
      scene.add(ch.root);
      [a.calm, a.cheer].forEach((clip, si) => {
        const act = ch.actions[clip] || ch.actions.idle;
        ch.mixer.stopAllAction();
        if (!act) return;
        act.reset();
        act.enabled = true;
        act.setEffectiveWeight(1);
        act.setEffectiveTimeScale(1);
        act.play();
        const dur = act.getClip().duration || 1;
        for (let f = 0; f < FRAMES; f++) {
          act.time = (f / FRAMES) * dur + (a.offset || 0);
          ch.update(0);
          ch.root.updateMatrixWorld(true);
          renderer.setRenderTarget(cell);
          renderer.clear(true, true, false);
          renderer.render(scene, cam);
          const row = ai * 2 + si;
          atlas.viewport.set(f * CELL_W, row * CELL_H, CELL_W, CELL_H);
          atlas.scissor.copy(atlas.viewport);
          atlas.scissorTest = true;
          renderer.setRenderTarget(atlas);
          renderer.render(quadScene, quadCam);
          atlas.scissorTest = false;
          atlas.viewport.set(0, 0, atlas.width, atlas.height);
        }
      });
      scene.remove(ch.root);
    });
  } catch (err) {
    console.warn('[hairline] ch3 crowd bake failed', err);
  } finally {
    for (const ch of chars) ch.dispose();
    renderer.setRenderTarget(prevRT);
    renderer.setClearColor(prevColor, prevAlpha);
    renderer.autoClear = prevAuto;
    renderer.shadowMap.autoUpdate = prevShadow;
    cell.dispose();
    quadMat.dispose();
    quad.geometry.dispose();
  }
  // Mipmaps for the whole atlas (the per-cell renders only touched slices).
  return {
    texture: atlas.texture,
    target: atlas,
    rows,
    dispose: () => atlas.dispose(),
  };
}

/**
 * The billboard crowd. spots: [{ x, y, z, row (archetype), scale, flip, phase, excite (0..1
 * threshold), shade (brightness) }]. Returns { mesh, uniforms } with uniforms.uTime / uExcite /
 * uLight (rgb light multiplier) to drive.
 */
export function crowdMesh(atlas, spots, { fps = 9 } = {}) {
  const n = spots.length;
  const geo = new THREE.PlaneGeometry(FRAME_W, FRAME_H).translate(0, FRAME_Y0 + FRAME_H / 2, 0);
  const inst = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4); // row, phase, flip, excite
  const dummy = new THREE.Object3D();
  const uniforms = {
    uTime: { value: 0 },
    uExcite: { value: 0.6 },
    uFps: { value: fps },
    uRows: { value: atlas.rows },
  };
  const material = new THREE.MeshBasicMaterial({ map: atlas.texture, alphaTest: 0.45, color: 0xffffff, fog: true });
  material.alphaToCoverage = true;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec4 aCrowd;
        uniform float uTime, uExcite, uFps, uRows;`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        {
          float frames = ${FRAMES.toFixed(1)};
          // Excited spectators cheer (odd rows) and animate faster; the rest stand (even rows).
          float cheer = step(aCrowd.w, uExcite);
          float rate = mix(0.55, 1.0, cheer) * (0.85 + 0.3 * fract(aCrowd.y * 7.13));
          float fr = floor(mod(uTime * uFps * rate + aCrowd.y * frames, frames));
          float row = aCrowd.x * 2.0 + cheer;
          vec2 cuv = vec2(uv.x, uv.y);
          #ifdef USE_MAP
            vMapUv = vec2((fr + cuv.x) / frames, (row + cuv.y) / uRows);
          #endif
        }`,
      )
      .replace(
        '#include <project_vertex>',
        `vec4 mvPosition;
        {
          mat4 im = modelMatrix * instanceMatrix;
          vec3 ip = im[3].xyz;
          float sc = length(im[1].xyz);
          vec3 toCam = cameraPosition - ip;
          toCam.y = 0.0;
          toCam = normalize(toCam + vec3(1e-4, 0.0, 0.0));
          vec3 right = vec3(toCam.z, 0.0, -toCam.x);
          vec3 wp = ip + right * position.x * sc * aCrowd.z + vec3(0.0, position.y * sc, 0.0);
          mvPosition = viewMatrix * vec4(wp, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }`,
      );
  };
  material.customProgramCacheKey = () => 'ch3-crowd-impostor';

  const mesh = new THREE.InstancedMesh(geo, material, Math.max(1, n));
  mesh.count = n;
  const col = new THREE.Color();
  spots.forEach((s, i) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.scale.setScalar(s.scale ?? 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, col.setScalar(s.shade ?? 1));
    inst.setXYZW(i, s.row, s.phase ?? Math.random(), s.flip ? -1 : 1, s.excite ?? 0.5);
  });
  geo.setAttribute('aCrowd', inst);
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  // The billboard turns: pad the bounds so a quad seen edge-on never culls early.
  if (mesh.boundingSphere) mesh.boundingSphere.radius += 2;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.name = 'crowd-impostors';
  mesh.userData.noOcclude = true;
  return { mesh, uniforms, material };
}

/** Soft contact shadows under the crowd: one instanced dark blob per spectator. */
export function crowdShadows(spots, blobTexture) {
  const geo = new THREE.PlaneGeometry(0.9, 0.7).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: blobTexture, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.InstancedMesh(geo, material, Math.max(1, spots.length));
  mesh.count = spots.length;
  const d = new THREE.Object3D();
  spots.forEach((s, i) => {
    d.position.set(s.x, s.y + 0.004, s.z);
    d.rotation.set(0, (s.phase ?? 0) * 6.28, 0);
    d.scale.setScalar(s.scale ?? 1);
    d.updateMatrix();
    mesh.setMatrixAt(i, d.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 1;
  mesh.name = 'crowd-shadows';
  return mesh;
}
