import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

// Image-based lighting. HDRIs (public/assets/hdri/<id>.hdr, see docs/assets/materials.md) are loaded
// lazily with HDRLoader, prefiltered once with PMREMGenerator and cached by id. Mood picks the active
// one from the preset (`env`, `envIntensity`, `envRotation`) and writes scene.environment /
// environmentIntensity / environmentRotation every frame. A missing file just means no environment
// light (the hemisphere light still fills): the game never waits on an HDRI.

const BASE = `${import.meta.env.BASE_URL}assets/hdri/`;

export class Environment {
  constructor(renderer) {
    this.renderer = renderer;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.loader = new HDRLoader();
    // Float data so the hot spots can be capped before prefiltering (see load()).
    this.loader.setDataType(THREE.FloatType);
    /** Peak radiance cap per HDRI (a sun or a sodium lamp at 28,800 would be a white-hot dot in
     * every wet puddle and blow up the bloom). Hue is kept; the total key light drops a little. */
    this.peak = 24;
    /** Scale every HDRI to a mean radiance of 1 (see load()). */
    this.normalize = true;
    /** id -> { promise, texture (PMREM, null until ready), failed } */
    this.cache = new Map();
  }

  /** { mean (radiance before normalising), failed, ready } for a loaded / loading id. */
  info(id) {
    const e = this.cache.get(id);
    return e ? { mean: e.mean, failed: e.failed, ready: !!e.texture } : null;
  }

  /** The prefiltered texture for id, or null if it is not loaded (yet). */
  get(id) {
    return (id && this.cache.get(id)?.texture) || null;
  }

  /** Start loading id (no-op when cached). Resolves to the PMREM texture, or null on failure. */
  load(id, { peak = this.peak } = {}) {
    if (!id) return Promise.resolve(null);
    let e = this.cache.get(id);
    if (e) return e.promise;
    e = { texture: null, failed: false, promise: null };
    this.cache.set(id, e);
    e.promise = this.loader
      .loadAsync(`${BASE}${id}.hdr`)
      .then((eq) => {
        const { data: d, width: w, height: h } = eq.image;
        let sum = 0;
        let wsum = 0;
        for (let y = 0; y < h; y++) {
          const sw = Math.sin(((y + 0.5) / h) * Math.PI); // solid angle of the row
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const m = Math.max(d[i], d[i + 1], d[i + 2]);
            if (m > peak) {
              const k = peak / m;
              d[i] *= k;
              d[i + 1] *= k;
              d[i + 2] *= k;
            }
            sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) * sw;
            wsum += sw;
          }
        }
        // Normalise the mean radiance to 1, so envIntensity means the same thing for every HDRI
        // (0.1 = a dim fill, 0.3 = an overcast day next to the sun) whatever the capture exposure.
        const mean = sum / Math.max(wsum, 1e-6);
        e.mean = mean;
        if (this.normalize && mean > 1e-6) {
          const k = 1 / mean;
          for (let i = 0; i < d.length; i += 4) {
            d[i] *= k;
            d[i + 1] *= k;
            d[i + 2] *= k;
          }
        }
        eq.mapping = THREE.EquirectangularReflectionMapping;
        const rt = this.pmrem.fromEquirectangular(eq);
        eq.dispose();
        rt.texture.userData.hdriId = id;
        e.rt = rt;
        e.texture = rt.texture;
        return e.texture;
      })
      .catch((err) => {
        e.failed = true;
        console.warn('[hairline] HDRI failed to load, no environment light:', id, err?.message || err);
        return null;
      });
    return e.promise;
  }

  /** Preload several ids (missing ones are skipped). */
  preload(ids) {
    return Promise.all([...new Set(ids.filter(Boolean))].map((id) => this.load(id)));
  }

  /** Free every cached HDRI not in keep (ids). Call on chapter change. */
  retain(keep) {
    const k = new Set(keep.filter(Boolean));
    for (const [id, e] of this.cache) {
      if (k.has(id) || !e.texture) continue;
      e.rt.dispose();
      this.cache.delete(id);
    }
  }

  dispose() {
    for (const e of this.cache.values()) e.rt?.dispose();
    this.cache.clear();
    this.pmrem.dispose();
  }
}
