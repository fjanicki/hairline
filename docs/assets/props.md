# Props asset group (hero props seen up close)

- **Fetch:** `scripts/assets/props.sh`, run by `scripts/fetch-assets.sh`. Standalone: `ROOT=$PWD bash scripts/assets/props.sh`.
- **Output:** `public/assets/props/<our_id>.glb`, one self-contained GLB per prop, plus `.cache/dl/props/props.json` (a catalogue in the download cache, not shipped: tris, bounds, root node names, materials, KB for each prop).
- **Load:** `assets.prop('props/<our_id>.glb', { height })`. It works as it does for the Kenney GLBs: it never rejects, a failed load gives a grey box, the footprint is centred and the bottom sits on y = 0. No Draco or meshopt decoder is needed.
- **Size:** 31 props, 19.0 MB in total (19,045 KB), 266k triangles if every prop were on screen at once. (`planter` and `shutter` were dropped in integration: no scene placed them.)
- **Licence:** every prop is **CC0** from [Poly Haven](https://polyhaven.com) (photo-scanned or scan-textured). No attribution is required. A courtesy line "Props: Poly Haven (CC0)" in the credits would be good practice.

## How the script builds them

1. It reads `https://api.polyhaven.com/files/<id>` and downloads the **1k glTF** variant (`.gltf` + `.bin` + `_diff/_nor_gl/_arm` JPGs) into `.cache/dl/props/<id>/`. A cached file is skipped when its byte size matches the API.
2. It installs pinned `@gltf-transform/{core,extensions,functions}@4.5.1` and `sharp@0.35.5` into `.cache/tools/props-pack/` (never into `package.json`), then runs `pack.mjs`, which the script writes itself. For each prop, `pack.mjs`:
   - keeps only the listed root nodes when the source file is a variant collection (`keep=`);
   - wraps everything in a single root node named `<our_id>`, which carries an optional unit fix (`scale=`);
   - re-encodes the textures as JPEG: **512 px** for hand-sized props and **1024 px** for furniture and street props. Normal maps use q90 with 4:4:4 chroma; colour and ARM maps use q80 mozjpeg;
   - runs `dedup` + `prune`, writes the GLB, and records stats.
3. A GLB is rebuilt only when its recipe changes (`PACK_VERSION`, source id, texture px, keep, scale). The script deletes anything in `public/assets/props/` that is not in the list. A second run with a warm cache takes about 1.5 s.
4. The script fails with a clear `props.sh: ...` message if the Poly Haven API, a download, the npm install or a pack step fails.

## Table

The size is the bounding box in metres, **x × y × z**, at native scale. Every prop is Y-up. The pivot is the native origin; `assets.prop` re-centres the footprint anyway. "Front" is the side that faces the camera with `rotation.y = 0` when the camera looks down −Z, the same convention as the Kenney props.

| our_id | Poly Haven source | Tris | Size (m) | KB | Tex px | Chapter → spot | Orientation / notes |
|---|---|---|---|---|---|---|---|
| `crt_tv` | [Television_01](https://polyhaven.com/a/Television_01) | 1,918 | 0.60 × 0.46 × 0.47 | 497 | 1024 | Ch1 TV `[0.55, 1.3]` on the TV cabinet | Screen faces +Z. A wood-cased 70s CRT. Overlay the broadcast CanvasTexture on a plane just in front of the glass. |
| `sofa_worn` | [sofa_03](https://polyhaven.com/a/sofa_03) | 8,004 | 2.73 × 1.12 × 0.93 | 609 | 1024 | Ch1 sofa | Seat faces +Z. Natively a 2.7 m three-seater; use `height: 0.85` (it then becomes about 2.1 m wide) or scale x. Worn brown upholstery. |
| `iron_bed` | [old_bed_frame](https://polyhaven.com/a/old_bed_frame) | 49,990 | 0.91 × 1.20 × 2.00 | 2051 | 1024 | Ch1 bed (left wall) | Long axis along Z, headboard at −Z. A bare rusty frame with mesh springs and **no mattress**: add a box mattress and a blanket on top. The heaviest prop; keep it to one instance. |
| `cardboard_box` | [cardboard_box_01](https://polyhaven.com/a/cardboard_box_01) | 16,952 | 0.39 × 0.34 × 0.52 | 879 | 1024 | Ch1 moving boxes; Ch4 "Measure" box prop | Taped and crushed. Clone it with different `height` and `rotation.y` values for a stack. |
| `trash_bag` | [trashbag](https://polyhaven.com/a/trashbag) | 4,482 | 0.53 × 0.57 × 0.46 | 277 | 512 | Ch1 bin bag; Ch2/Ch5 kerbside bags | Black glossy plastic. It reads well in the rain with a lower roughness. |
| `wrist_watch` | [digital_wrist_watch](https://polyhaven.com/a/digital_wrist_watch) | 10,390 | 0.04 × 0.01 × 0.22 | 906 | 1024 | **Hero.** Ch1 watch on the charger `[-0.95, -1.9]`; Ch5 watch in its pegboard outline, and on the nail | The strap lies open and flat along Z, with the face up (+Y). Use `height` with care, because y is only 8 mm: scale by width instead (`{ width: 0.04 }`) or by a fixed factor. Nodes: `digital_wrist_watch`, `_clasp`, `_strap_a`, `_strap_b`. The glass is alpha BLEND. Put an emissive "TIME TO MOVE" decal over the face. |
| `steel_shelves` | [steel_frame_shelves_01](https://polyhaven.com/a/steel_frame_shelves_01) | 4,348 | 1.10 × 2.14 × 0.50 | 424 | 1024 | Ch1 shelves; Ch4 paint-jar shelving | **Unit fix applied** (`scale=0.1`; the source is 21 m tall). Front faces +Z. The frame looks fairly new, so tint it darker or dirtier. |
| `fluoro_light` | [mounted_fluorescent_lights](https://polyhaven.com/a/mounted_fluorescent_lights) | 3,540 | 0.91 × 0.03 × 0.04 | 221 | 512 | Ch1 fluorescent strip; Ch4 `fluoro(on)` | One fitting (`keep=..._d`; the source has 7 identical copies). **The pivot is the ceiling mount at y = 0 and the tube hangs below it**, so pass `center: false` and place it at the ceiling height. The glass material has an emissive map: drive `emissiveIntensity` for the flicker and pair it with a RectAreaLight or PointLight. |
| `bench_vice` | [bench_vice_01](https://polyhaven.com/a/bench_vice_01) | 2,864 | 0.20 × 0.28 × 0.40 | 748 | 1024 | Ch4 main workbench corner (hero up close); Ch5 open workshop bench | The jaws open along Z, with the screw handle toward +Z. The origin is at the bench-top mount, and the body extends 8.6 cm below it to the clamp. It ships with control empties (`rig_bench_vice`), but the meshes are plain nodes: `bench_vice_frame`, `_clamp`, `_dial`, `_bar`. |
| `spanner` | [combination_wrench](https://polyhaven.com/a/combination_wrench) | 1,986 | 0.06 × 0.02 × 0.34 | 180 | 512 | Ch4 pegboard and bench; Ch5 bike stand | Lies flat, long axis Z. To hang it on the pegboard, use `rotation.x = -π/2`. |
| `drill` | [Drill_01](https://polyhaven.com/a/Drill_01) | 2,926 | 0.18 × 0.18 × 0.05 | 229 | 512 | Ch4 bench | Stands upright, side profile toward +Z. A modern lime-yellow cordless drill: tint it down (for example `#8a8a70`) so that it does not out-colour the things Hugo makes. |
| `hammer` | [cross_pein_hammer](https://polyhaven.com/a/cross_pein_hammer) | 2,124 | 0.10 × 0.30 × 0.02 | 180 | 512 | Ch4 pegboard (replaces `tool-hammer`); Ch5 | Authored **upright** (handle down, head up) and flat in the XY plane, so it hangs on the pegboard as-is. To lay it on a bench, use `rotation.x = -π/2`. |
| `handsaw` | [handsaw_wood](https://polyhaven.com/a/handsaw_wood) | 2,548 | 0.04 × 0.17 × 0.63 | 289 | 512 | Ch4 pegboard and bench | The blade is vertical, along Z. Rusty blade, wooden handle. |
| `pliers` | [pliers](https://polyhaven.com/a/pliers) | 4,540 | 0.06 × 0.18 × 0.02 | 293 | 512 | Ch4 pegboard | Upright in the XY plane (pegboard-ready). Red and yellow grips: tint them if they are too loud. Nodes: `pliers_a`, `pliers_b`, `pliers_pin`. |
| `screwdriver` | [screwdriver](https://polyhaven.com/a/screwdriver) | 3,412 | 0.03 × 0.21 × 0.03 | 171 | 512 | Ch4 pegboard and bench | Upright, tip up. |
| `tape_measure` | [measuring_tape_01](https://polyhaven.com/a/measuring_tape_01) | 2,868 | 0.04 × 0.07 × 0.17 | 207 | 512 | Optional: Ch4 "Measure Twice" | Stands on its side. DESIGN currently says "there is no tape measure", so this is available if the beat changes. Otherwise leave it out of the scene; it costs nothing until it is loaded. |
| `paint_can` | [can_rusted](https://polyhaven.com/a/can_rusted) | 3,520 | 0.13 × 0.15 × 0.13 | 253 | 512 | Ch4 Odile's paint tins; Ch5 paint buckets along the wall (replaces `survival/bucket`) | A rusty "STANDARD" tin with no lid. For the hope colour, add a disc of paint inside (a flat-colour CircleGeometry at the rim, about 0.13 m tall) that carries the colour. |
| `oil_can` | [small_oil_can_01](https://polyhaven.com/a/small_oil_can_01) | 16,746 | 0.27 × 0.24 × 0.10 | 569 | 512 | Ch4 bike stand (truing scene); Ch5 clean race bike | The spout points +X. |
| `toolbox` | [metal_toolbox](https://polyhaven.com/a/metal_toolbox) | 14,228 | 0.40 × 0.30 × 0.27 | 930 | 1024 | Ch4 floor by the bench; Ch5 workshop | Open, worn green. The front (latch) faces +Z. Nodes: `metal_toolbox`, `_tray`, `_lid`. The lid can be rotated to close it. |
| `stool` | [wooden_stool_01](https://polyhaven.com/a/wooden_stool_01) | 10,946 | 0.42 × 0.44 × 0.44 | 885 | 1024 | Ch4 Odile's stool at the bench | Paint-worn, symmetric. |
| `stepladder` | [wooden_ladder](https://polyhaven.com/a/wooden_ladder) | 8,492 | 0.96 × 1.33 × 0.50 | 873 | 1024 | Ch5 at the mural wall; Ch4 corner | The A-frame opens along X; the steps face ±X. Nodes: `wooden_ladder_supports`, `wooden_ladder_steps`. |
| `bulb` | [lightbulb_01](https://polyhaven.com/a/lightbulb_01) | 4,372 | 0.06 × 0.10 × 0.06 | 202 | 512 | Ch4 bare pendant bulb (the warm practical) | Base down. **The glass uses `KHR_materials_transmission`**, which renders black or dark without a transmission pass. For a lit bulb, replace the `lightbulb_01_glass` material with a `MeshStandardMaterial` (warm colour, `emissiveIntensity` about 3–5, so that it blooms into the vignette) and add the PointLight. The base has an emissive filament map. |
| `track_pump` | [tire_pump](https://polyhaven.com/a/tire_pump) | 6,572 | 0.26 × 0.58 × 0.10 | 326 | 512 | Ch4 bike stand; Ch5 "PUNCTURES FIXED" corner | A floor pump, standing. |
| `radio` | [boombox](https://polyhaven.com/a/boombox) | 10,168 | 0.72 × 0.47 × 0.19 | 546 | 512 | Ch4 optional radio hotspot | The front (speakers) faces +Z. The source is large (72 cm); use `height: 0.25` for a smaller workshop radio. The speaker grilles use alpha MASK. |
| `bin_metal` | [metal_trash_can](https://polyhaven.com/a/metal_trash_can) | 7,532 | 0.77 × 0.91 × 0.55 | 972 | 1024 | Ch2/Ch5 street bins; Ch1 kitchen bin | Only the rusty variant is kept. **The lid leans against the can** (node `metal_trash_can_rust_lid`): to close it, reset that node's rotation and lift it to y ≈ 0.9. Because the lid widens the footprint, `assets.prop` centring is offset from the can; use `width` rather than height-only sizing if the lid is moved. |
| `barrel` | [barrel_03](https://polyhaven.com/a/barrel_03) | 1,473 | 0.63 × 0.93 × 0.64 | 490 | 1024 | Ch2/Ch5 street (replaces `survival/barrel`) | A blue steel drum, rusty. Cheap: about 1.5k tris. |
| `crate_wood` | [wooden_crate_01](https://polyhaven.com/a/wooden_crate_01) | 6,576 | 0.82 × 0.35 × 0.41 | 655 | 1024 | Ch2/Ch5 street and shop fronts; Ch4 storage | A lidded chest-style crate with rope handles. Nodes: `wooden_crate_01`, `_lid`, `_latch`. |
| `milk_crate` | [plastic_crate_01](https://polyhaven.com/a/plastic_crate_01) | 18,320 | 0.30 × 0.26 × 0.41 | 1514 | 1024 | Ch2/Ch5 kerb (Sami sits on one); Ch4 | A red plastic crate. It stays desaturated until hope rises, so it is a nice candidate for the colour return. |
| `cafe_set` | [outdoor_table_chair_set_01](https://polyhaven.com/a/outdoor_table_chair_set_01) | 9,828 | 0.74 × 0.86 × 1.72 | 1020 | 1024 | Ch2/Ch5 café terrace (Mme Benali) | A table and two folding chairs along Z. Nodes: `outdoor_table_chair_set_01_table`, `_chair_01`, `_chair_02`; they can be split or rearranged. |
| `chair_painted` | [painted_wooden_chair_01](https://polyhaven.com/a/painted_wooden_chair_01) | 724 | 0.43 × 0.96 × 0.54 | 460 | 1024 | Ch5 Odile's chair on the street; Ch4 | White chipped paint. The seat front faces +Z. |
| `road_barrier` | [concrete_road_barrier_02](https://polyhaven.com/a/concrete_road_barrier_02) | 23,822 | 1.56 × 1.11 × 0.44 | 1189 | 1024 | Ch3 run route and marathon closures (next to the Kenney barriers) | A cast concrete block with lifting loops, long axis X. Reuse the clones; the clone cache keeps one GPU copy. |

## Not covered: gaps and decisions

- **Bicycles (Hugo's race bike, Sami's kid bike): no suitable CC0 model exists.**
  - Poly Haven has no bicycle (checked all 521 models). The only bike-adjacent items are `tire_pump` (shipped) and car rims and tyres.
  - OpenGameArt's CC0 "Bike" (`/content/bike-0`) is a blocky toy motorbike.
  - The Smithsonian 3D API returns no bicycle.
  - Quaternius and Kenney only have flat low-poly vehicles, which the brief rules out for hero props.
  - Sketchfab CC0 bikes are login-walled.
  - **Keep the procedural `build.bicycle()`.** It already has separate wheels for the truing wobble and the spin. Upgrading its materials (rubber tyres with roughness 0.9, a brushed-steel rim with metalness 1 and roughness 0.35, a chain using the `oil_can` dark metal look, and a frame clear-coat through `MeshPhysicalMaterial.clearcoat`) would close most of the gap with the scanned props around it.
- **No CC0 scan for:** fridge, mug, pill bottle, coffee table (the Poly Haven tables are ornate or antique), pallets, cones, water bottles, scaffolding, a street bench (`modular_street_seating` is 7.6 MB and modular), jars, brushes or clamps.
  - Keep the Kenney or procedural versions of these, tinted. They sit further from the camera.
  - `crate_wood` can stand in as a coffee table in Hugo's flat if wanted.
- **Considered and dropped:**
  - `exterior_aircon_unit` and `modular_street_seating`: 7.6 MB each.
  - `metal_tool_chest`: the open green `toolbox` fits Odile better.
  - `hanging_industrial_lamp`: `bulb` covers the warm practical light.
  - `fire_hydrant`: 86k tris.
  - The spray paint cans: Odile paints with brushes.

## Integration notes

- **Environment light is required.** The metal props (`barrel`, `bin_metal`, `bench_vice`, `toolbox`, `paint_can`, `spanner`) are PBR metals. Without `scene.environment`, they render near-black; in a test placement in Ch2, the barrel and the bin read as dark silhouettes. The lighting group's HDRI or a PMREM `RoomEnvironment` fixes this.
- **Hope and colour:** `tint` multiplies the scanned albedo, so keep tints light (≥ `#a0a0a0`). For a "dirtier" look, prefer `color` only on the flat Kenney props. The MoodShader already desaturates everything; the coloured scans (red milk crate, blue barrel, red and yellow pliers, lime drill) come back first when hope rises, so place them deliberately.
- **Hand-sized props** use 512 px textures. If a camera ever frames one closer than about 25 cm (the watch is the exception, at 1k), bump that row to 1024 in `props.sh`, then bump `PACK_VERSION` or delete its stamp.
- **Verified**, using a turntable grid probe in headless Chromium with the real GPU (since deleted):
  - All 33 GLBs load with r186 `GLTFLoader` and no errors.
  - Through the game's `assets.prop()`, a test placement of 7 props in Ch4 and 6 props in Ch2 gave no fallbacks, no errors and no warnings, at 121 fps.
  - `npx vite build` passes.
