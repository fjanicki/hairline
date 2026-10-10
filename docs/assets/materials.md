# Materials and HDRI asset group

- **Fetch:** `scripts/assets/materials.sh`, run by `scripts/fetch-assets.sh`. Standalone: `bash scripts/assets/materials.sh` (ROOT, CACHE and OUT default to the repo layout).
  - Downloads are cached in `.cache/dl/materials/{ph,acg,hdri}/` and skipped when present. A run with a warm cache takes about 0.3 s and downloads nothing.
  - Only the files listed below are copied. Material folders and `.hdr` files that drop out of the tables are deleted, so nothing unused ships.
  - The procedural grime masks come from `scripts/assets/materials-grime.mjs` (Node only, no dependencies, seeded). It reruns only when a mask is missing, and its output is byte-identical every time.
- **Output:**
  - `public/assets/materials/<our_id>/{color,normal,arm}.jpg`
  - `public/assets/materials/grime/*`
  - `public/assets/materials/materials.json`
  - `public/assets/hdri/<our_id>.hdr`
  - `.cache/dl/materials/hdri/hdri.json` (the HDRI source list; kept in the cache, not shipped)
- **Size:** 23 materials take 47.5 MB, the 5 grime layers 1.2 MB and the 5 HDRIs 7.5 MB, so **56.2 MB in total** (apparent size). The generator can also make `oil_stains` and `peeling` masks, but nothing uses them, so they are not shipped.
- **Licence:** everything is **CC0**: textures and HDRIs from [Poly Haven](https://polyhaven.com), decals from [ambientCG](https://ambientcg.com), and the generated masks are ours. No attribution is required; `docs/CREDITS.md` lists every source anyway.
- **Visual check:** a contact sheet (a sphere, a 2 × 2 m floor and a wall per material, lit only by the HDRI) was rendered under all 8 candidate HDRIs, then the probe page was deleted.
  - 9 of the 32 candidate materials were dropped as too clean, too saturated or redundant: `old_wooden_floor_02`, `caban`, `rough_linen`, `asphalt_04`, `cobblestone_square`, `brick_wall_02`, `plastered_wall_04`, `white_plaster_rough_01` and `concrete_floor_damaged_01`.
  - The HDRI `vignaioli_night` was dropped because it duplicates `night_street`.

## Map layout (identical for every material)

| File | Content | Colour space | three.js slot |
|---|---|---|---|
| `color.jpg` | albedo | sRGB (`THREE.SRGBColorSpace`) | `map` |
| `normal.jpg` | tangent-space normal, **OpenGL convention** (+Y up; Poly Haven `nor_gl`) | linear (`NoColorSpace`) | `normalMap` |
| `arm.jpg` | R = ambient occlusion, G = roughness, B = metalness (glTF ORM packing) | linear | `aoMap`, `roughnessMap` and `metalnessMap` all share this one texture; set `roughness: 1, metalness: 1` so the maps rule |

- Normal and ARM maps are always 1k. Colour is 1k, or 2k on the three hero surfaces.
- `aoMap` reads UV channel 0 in r186, so no `uv2` is needed.
- `materials.json` holds `{ "<our_id>": { source, tile: [w, h] (metres), maps, res, chapters } }`.
  - Set the texture repeat by world size: `repeat = surfaceMetres / tile`. For example, a 20 × 8 m wall with `facade_brick_dark` (2.5 m) gets `repeat.set(8, 3.2)`.
  - On a merged mesh with metre-based UVs (scene1 and scene4 `bx()` / `slab()`), use `repeat = 1 / tile`.

```js
const tl = new THREE.TextureLoader();
function pbr(id, tile, repeatU, repeatV = repeatU) {
  const t = (f, srgb) => {
    const x = tl.load(`assets/materials/${id}/${f}.jpg`);
    x.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    x.wrapS = x.wrapT = THREE.RepeatWrapping;
    x.repeat.set(repeatU, repeatV);
    x.anisotropy = 8;
    return x;
  };
  const arm = t('arm');
  return new THREE.MeshStandardMaterial({ map: t('color', true), normalMap: t('normal'), aoMap: arm, roughnessMap: arm, metalnessMap: arm, roughness: 1, metalness: 1 });
}
```

- **Fallback:** `TextureLoader` calls `onError` and leaves the material with no map, so a missing file degrades to the flat `color`. Keep the current flat colour on the material as that fallback, and keep a mid-value `color` multiplier (`#ffffff`–`#cfcfcf`).
- **Consistency:**
  - Tint with `material.color` (multiply) to pull a material toward the chapter palette: for example, `fabric_wool` toward slate for the sofa and toward a dull blue for the bedding.
  - Let the MoodShader do the desaturating. Do not pre-grey the albedo.
- **Tiling:** add `grime/macro.png` at a 10–20 m scale (multiply the albedo by roughly 0.8–1.2) on every big floor and wall, so the repeat does not show.

## Materials

Tile is the real-world size of one texture repeat, from Poly Haven `dimensions`. **Hero** marks the three surfaces with 2k colour.

| our_id | Source (Poly Haven) | Colour | Tile (m) | KB | Intended use → chapter |
|---|---|---|---|---|---|
| `flat_floorboards` | [old_wood_floor](https://polyhaven.com/a/old_wood_floor) | 1k | 3.0 | 2068 | Worn grey-brown floorboards for the whole flat floor → **ch1**. Layer the existing stain and wear canvas over it as a second `map`, or multiply it in. |
| `plaster_painted` | [painted_plaster_wall](https://polyhaven.com/a/painted_plaster_wall) | 1k | 2.0 | 2051 | Pale painted plaster, quite clean. It gives the relief and roughness under the nicotine wallpaper canvas (ch1) and the plaster above the dado (ch4) → **ch1, ch4**. It needs `leaks`, `edge_dirt` and `streaks` over it. |
| `tile_white_long` | [long_white_tiles](https://polyhaven.com/a/long_white_tiles) | 1k | 1.27 | 1801 | Kitchenette splash-back under the fluorescent strip → **ch1**. Grout grime comes from `streaks`. |
| `fabric_wool` | [poly_wool_herringbone](https://polyhaven.com/a/poly_wool_herringbone) | 1k | 0.27 | 3138 | Grey herringbone wool: the sofa, and the bedding and blanket (tint them) → **ch1**. The weave is invisible at the dollhouse distance, so it mostly gives soft roughness and AO. **Kenney props have atlas UVs, so use this only on procedural boxes or on Poly Haven props with real UVs.** |
| `street_asphalt_wet` | [asphalt_02](https://polyhaven.com/a/asphalt_02) | **2k (hero)** | 3.0 | 4506 | Dark, cracked asphalt for the street road → **ch2, ch5**, and the ring road → **ch3** (its lane-paint canvas goes on top). For wet: drive roughness down and darken the albedo with `grime/puddles.png` (see Grime). |
| `street_cobbles` | [cobblestone_embedded_asphalt](https://polyhaven.com/a/cobblestone_embedded_asphalt) | 1k | 1.9 | 2923 | Dark setts half-buried in tar, for the gutter strips, the patch in front of No. 14 and the alley mouths → **ch2, ch5** ("wet cobbles and asphalt"). |
| `street_pavement` | [concrete_pavement](https://polyhaven.com/a/concrete_pavement) | 1k | 1.8 | 2846 | Stained concrete paving slabs for the sidewalks → **ch2, ch3, ch5**. Use it also for the kerb tops. |
| `concrete_grimy` | [concrete_wall_006](https://polyhaven.com/a/concrete_wall_006) | 1k | 2.0 | 2861 | Weathered cast concrete with holes and stains: kerb faces, plinths, the ch3 retaining wall and coping, and the footbridge → **ch2, ch3, ch5**. |
| `facade_brick_dark` | [red_bricks_04](https://polyhaven.com/a/red_bricks_04) | **2k** | 2.5 | 1607 | Dark red northern brick, sooty, for the main facades and the side of the blind wall → **ch2, ch3 (silhouettes), ch5**. The 2k colour costs only about 1 MB here. |
| `facade_brick_painted` | [painted_worn_brick](https://polyhaven.com/a/painted_worn_brick) | 1k | 1.8 | 2665 | Cream paint flaking off brick, for the ghost-sign wall and the bakery (Benali) → **ch2, ch5**. |
| `facade_brick_plaster` | [red_brick_plaster_patch_02](https://polyhaven.com/a/red_brick_plaster_patch_02) | 1k | 1.5 | 1601 | Render fallen off brick in patches, for the row houses toward No. 14, the ground floor of No. 14 and the bike-shop side → **ch2, ch5**. |
| `facade_render` | [concrete_wall_008](https://polyhaven.com/a/concrete_wall_008) | 1k | 2.71 | 1761 | Stained cream render with formwork lines: rendered upper floors, Gérard's and the rear blocks → **ch2, ch3, ch5**. |
| `shutter_rusty` | [rusty_metal_shutter](https://polyhaven.com/a/rusty_metal_shutter) | 1k | 1.9 | 1880 | Ribbed roller shutter: CYCLES DURAND (z −34), the shuttered shops, the ch4 garage door and the Ch2 No. 14 garage door → **ch2, ch4, ch5**. Tags and posters go on top as decals or canvas. |
| `metal_painted_green` | [green_metal_rust](https://polyhaven.com/a/green_metal_rust) | 1k | 1.0 | 434 | Bottle-green painted steel with rust scabs: downpipes, the bike-shop fascia, the bench frame and doors → **ch2, ch5**. |
| `metal_painted_rusty` | [rusty_metal_02](https://polyhaven.com/a/rusty_metal_02) | 1k | 1.0 | 1096 | White paint eaten by orange rust: lamp posts, the fridge side, railings and the drum tops → **ch1, ch2, ch4, ch5**. It is strongly coloured, so tint it toward grey for ch1 and ch2. |
| `metal_corrugated_rusty` | [rusty_corrugated_iron](https://polyhaven.com/a/rusty_corrugated_iron) | 1k | 2.0 | 1641 | Corrugated rusty sheet: the No. 14 awning, the scaffold hoarding, the workshop lean-to, the fence by the bike shop → **ch2, ch4, ch5**. |
| `wall_mural_render` | [plastered_wall_03](https://polyhaven.com/a/plastered_wall_03) | **2k (hero)** | 4.0 | 3093 | The blind wall (x −5.95, z −12…−32, 20 × 8 m) → **ch2, ch5**. A light, slightly mottled render that reads as **primed** and takes the mural panels. For ch2, darken it with `leaks` + `edge_dirt` (+ posters and tags). Repeat `(5, 2)`. |
| `workshop_floor_concrete` | [garage_floor](https://polyhaven.com/a/garage_floor) | 1k | 1.89 | 1881 | Warm stained garage concrete for the 9 × 6 m workshop floor → **ch4**, and the floor inside the open garage → **ch5**. (1k colour at a 1.9 m tile is already 540 px/m, so 2k was not worth 2 MB.) |
| `brick_whitewashed` | [whitewashed_brick](https://polyhaven.com/a/whitewashed_brick) | 1k | 2.0 | 2372 | Painted brick for the workshop walls → **ch4**. Use the existing dado and hand-mark canvas as a multiply layer. |
| `wood_planks_weathered` | [weathered_brown_planks](https://polyhaven.com/a/weathered_brown_planks) | 1k | 1.8 | 640 | Grey-brown old timber: scaffold planks, pallets, the shelf boards and the leaning plank stack → **ch4, ch5**. |
| `wood_planks_painted` | [distressed_painted_planks](https://polyhaven.com/a/distressed_painted_planks) | 1k | 1.6 | 1134 | Pale painted planks with chipped paint: the internal door Hugo sands (the "grimy paint" state before the reveal), the old sign backs → **ch4**. |
| `wood_plywood` | [plywood](https://polyhaven.com/a/plywood) | 1k | 0.5 | 2376 | Plywood: the bench top, the sign blanks, the pegboard backing (under the existing pegboard canvas) and the mural panel boards → **ch4, ch5**. |
| `metal_plate_worn` | [metal_plate_02](https://polyhaven.com/a/metal_plate_02) | 1k | 2.0 | 1842 | Dark worn steel plate: the metal workbench top and vice-bench cladding, the tool chest and the drums → **ch4, ch5**. |

### Coverage by scene

- **Ch1 flat:** `flat_floorboards`, `plaster_painted` (+ wallpaper canvas), `tile_white_long`, `fabric_wool`, `metal_painted_rusty` (fridge or radiator).
- **Ch2 and Ch5 street:**
  - road and ground: `street_asphalt_wet`, `street_cobbles`, `street_pavement`, `concrete_grimy`;
  - facades: `facade_brick_dark`, `facade_brick_painted`, `facade_brick_plaster`, `facade_render`;
  - metal: `shutter_rusty`, `metal_painted_green`, `metal_corrugated_rusty`;
  - the blind wall: `wall_mural_render`.
  - **Dirty glass** has no PBR source: use a dark glass `MeshStandardMaterial` (roughness about 0.15) with `grime/streaks.jpg` as the `roughnessMap` (the mask is greyscale, so the `.g` that `roughnessMap` reads works directly).
- **Ch3 ring road:** `street_asphalt_wet` (with the lane canvas), `street_pavement`, `concrete_grimy` (retaining wall), `facade_brick_dark` and `facade_render` on the silhouettes. There is no park path in the current layout.
- **Ch4 workshop:** `workshop_floor_concrete`, `brick_whitewashed`, `plaster_painted`, `wood_planks_weathered`, `wood_planks_painted`, `wood_plywood`, `metal_plate_worn`, `shutter_rusty` (garage door).
  - **Pegboard:** there is no CC0 pegboard. Keep the scene4 canvas and lay `wood_plywood` normal and ARM under it.

## Grime layers (`public/assets/materials/grime/`)

All are greyscale, **linear** (`NoColorSpace`), with white = the effect. Read the `.r` channel.

| File | Source | Size | Tiles? | Meaning → suggested use |
|---|---|---|---|---|
| `leaks.jpg` | ambientCG [Leaking003](https://ambientcg.com/a/Leaking003) (opacity mask) | 1024 × 512 | **No** (a decal; it fades at the edges, and streaks run down from the top edge) | Rain and rust streaks under sills, copings, downpipe brackets and the billboard. Place it as a decal plane, or as a second UV set with ClampToEdge. Darken the albedo by about 0.5 × mask and raise the roughness slightly. |
| `edge_dirt.jpg` | ambientCG [Leaking008](https://ambientcg.com/a/Leaking008) (opacity mask) | 1024 × 256 | U only | A band of splash-back dirt at the foot of a wall (the bottom of the image = the ground). Repeat along the base of the facades, the blind wall and the inside of the workshop walls, about 0.6–1 m tall. |
| `streaks.jpg` | ambientCG [SurfaceImperfections003](https://ambientcg.com/a/SurfaceImperfections003) (opacity) | 1024² | Yes | Vertical streaky smudges, about 1 m per tile. Use them for the roughness breakup of dirty glass, the TV screen, fridge doors and metal. |
| `puddles.png` | generated | 1024² | Yes | 255 = standing water, about 90 = a damp rim, 0 = dry (about 15 % water and 30 % wet overall). Use 4–8 m per tile on the street asphalt and pavement: `roughness = mix(r, 0.04, k)` and `albedo *= mix(1, 0.45, k)`. Scale `k` down in ch5 ("puddles drying"). |
| `oil_stains.png` (not shipped) | generated | 1024² | Yes | Dark blotch clusters with a faint tide ring (about 17 % coverage). Put them on the workshop floor under the bench and the bike stand, under parked spots on the street and around the dumpster. Darken the albedo and lower the roughness a little. |
| `peeling.png` (not shipped) | generated | 1024² | Yes | 255 = paint gone and the substrate shows, plus thin lifted edges and hairline cracks (about 16 % coverage). Use it to reveal brick or plaster under paint (`facade_brick_painted`, the ch1 wallpaper by the window, the ch4 door before sanding). |
| `macro.png` | generated | 512² | Yes | A low-frequency breakup centred on 128. Multiply the albedo by `0.8 + 0.4·m` at a 10–20 m tile on every large surface to kill the repeat. |

The masks are deliberately not baked into the colour maps. Chapters can then weather the same material differently: ch2 wet and stained, ch5 drier and cleaner.

## HDRIs (`public/assets/hdri/`)

1k equirect Radiance `.hdr`, about 1.4–1.8 MB each.
- **Loading:** `import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'`, set `mapping = THREE.EquirectangularReflectionMapping`, and pass the result through `PMREMGenerator.fromEquirectangular` → `scene.environment`.
- **Background:** none of them is meant as the visible background. The scenes keep their own sky colour and fog.
- **Key direction:** a unit vector in **three.js world space** with `scene.environmentRotation` at 0. It was measured as the luminance-weighted mean of the brightest 0.2 % of solid angle.
  - Aim the scene's `DirectionalLight` (sun or key) along it, or rotate the environment (`scene.environmentRotation.y`) so the key comes from where the scene's own lights are.
  - "Key share" is the fraction of the total light coming from that hot spot: a high value means a hard, single key; a low value means a soft dome.

| our_id | Source | Mood | Key direction (three.js) / elevation | Key share | Suggested use and `environmentIntensity` |
|---|---|---|---|---|---|
| `night_street` | [cobblestone_street_night](https://polyhaven.com/a/cobblestone_street_night) | A narrow old-town cobbled street at night under sodium lamps: orange key, black sky, wet-looking cobbles | `[0.90, 0.43, 0.01]` / 25° (one lamp, very hot: peak 28,800) | 79 % | **Ch2** evening rain. Use 0.15–0.35: it is only for reflections in the puddles and glass, and the scene's PointLights stay the key. Expect warm specular glints; the MoodShader desaturates them at low hope. |
| `dawn_fog` | [beach_parking](https://polyhaven.com/a/beach_parking) | Foggy sunrise over an open lot: cold blue dome, low sun just above the horizon | `[0.70, 0.06, 0.72]` / 4° | 4 % (fog-diffused) | **Ch3** dawn ring road: matches the cold low sun "ahead". Point the run direction (−Z) toward the key by rotating the environment by about 136° (2.4 rad) around Y. Check the sign in one shot, because three's `environmentRotation` convention is easy to flip. Use 0.6–1.0. |
| `overcast_street` (dropped: no chapter used it) | [urban_street_01](https://polyhaven.com/a/urban_street_01) | A London residential street, overcast morning: neutral grey, soft from above | `[0.27, 0.96, −0.02]` / 74° (an overhead dome, no sun) | 1 % | **Ch5** daytime start (the `wall` preset is overcast); also a neutral rainy-day fallback for ch2 and ch3. Use 0.5–0.9. |
| `golden_street` | [vatican_road](https://polyhaven.com/a/vatican_road) | A Rome street at golden hour: warm low sun, blue sky, long shadows | `[0.75, 0.43, 0.50]` / 25° | 5 % | **Ch5** golden walk and crane (hope 1.0). Align the warm `DirectionalLight` with the key; the dome itself reads slightly cool. Use 0.6–1.0. |
| `bright_square` (dropped: no chapter used it) | [piazza_bologni](https://polyhaven.com/a/piazza_bologni) | A sunny, partly cloudy city square: bright, neutral-warm, soft | `[0.67, 0.72, 0.19]` / 46° | 3 % | The "colour returns" end: the final card, the photo beat, and the title backdrop if one is wanted. Use 0.7–1.0. |
| `interior_dim` | [lebombo](https://polyhaven.com/a/lebombo) | An empty house interior, tiled floor, daylight through a window: warm, low contrast | `[0.81, 0.21, 0.55]` / 12° (the window) | 5 % | **Ch1** flat. At night use only 0.08–0.2, as fill and reflections, with the TV PointLight as the key. Rotate the window toward the scene's moonlit window (back wall, −Z): a rotation of about 124° (2.2 rad) around Y, checking the sign in a shot. |
| `workshop` | [small_workshop](https://polyhaven.com/a/small_workshop) | A small cluttered workshop with fluorescent tubes and a lamp: greenish-warm mixed light, concrete floor | `[0.76, 0.47, 0.45]` / 28° (fluorescent and lamp) | 38 % | **Ch4** workshop, and the open garage interior in ch5. Use 0.25–0.5 under the warm bulb `#ffb36b`. |

## Risks and notes

- **Budget:** this group is about 60 MB of the 150 MB total. The biggest items are `street_asphalt_wet` (4.5 MB), `fabric_wool` (3.1 MB) and `wall_mural_render` (3.1 MB).
  - If the budget gets tight, cut in this order: `fabric_wool` (weave invisible at game distance), `tile_white_long`, then the 2k colour on `street_asphalt_wet` (set its res to `1k` in the table: −2.3 MB).
  - The JPGs are Poly Haven's originals at about q95. Re-encoding them would save about 40 %, but it would need an image tool in the fetch script.
- **Kenney models** use atlas UVs, so these tiling materials apply only to procedural geometry (`ground`, `box`, merged slabs, facades) or to props with real UVs. For a Kenney mesh, use triplanar mapping in `onBeforeCompile`, or keep the flat colours.
- **Do not use `aoMap` without lights that respect it:** in three.js `aoMap` only darkens indirect light (ambient, hemisphere and environment). That is what we want, and it means the AO is invisible in a scene lit only by point lights. An environment map (above) makes it count.
- **External services:** the URLs follow the stable Poly Haven pattern (`dl.polyhaven.org/file/ph-assets/Textures/jpg/<res>/<id>/<id>_<map>_<res>.jpg`) and the ambientCG `get?file=<id>_1K-JPG.zip`. If either service renames files, `curl -f` stops the script with an error. Already-cached downloads keep working offline.
