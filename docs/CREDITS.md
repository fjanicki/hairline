# Credits and licences

Every third-party file the game uses, where it comes from and under which licence. **Everything
is CC0** (public domain dedication): no attribution is required and commercial use and
redistribution are allowed. The game credits the sources anyway, here, in the README and on the
end card. There is no CC-BY, Mixamo, login-walled or paid asset in the build.

None of these files are in git. `npm run setup:assets` (`bash scripts/fetch-assets.sh`)
downloads them from the URLs below into `.cache/dl` and copies only the files the game uses into
`public/assets` (about 92 MB). Each group's script is the authoritative list:

| Group | Script | Shipped |
|---|---|---|
| Characters and animations | `scripts/assets/characters.sh` (+ `characters-build.mjs`) | `public/assets/characters/` |
| PBR materials, grime masks, HDRIs | `scripts/assets/materials.sh` (+ `materials-grime.mjs`) | `public/assets/materials/`, `public/assets/hdri/` |
| Hero props | `scripts/assets/props.sh` | `public/assets/props/` |
| Kenney pieces, audio | `scripts/fetch-assets.sh` | `public/assets/kenney/`, `public/assets/audio/` |

Bicycles, the walking boot, the GPS watch face, the signs, the facades, the mural, the posters,
the crowd atlas and the canvas textures are procedural (code in `src/`), as are the heartbeat,
hammering, sanding, watch buzz, spoke pings, Velcro, snap and drone sounds (WebAudio).

## Characters: Quaternius (CC0)

[quaternius.com](https://quaternius.com), free "[Standard]" downloads on itch.io; the licence file
in each zip is CC0 1.0. Rebuilt into `parts.glb` and `anims.glb` (see `docs/assets/characters.md`).

| Pack | Source |
|---|---|
| Universal Base Characters | https://quaternius.itch.io/universal-base-characters |
| Universal Animation Library | https://quaternius.itch.io/universal-animation-library |
| Universal Animation Library 2 | https://quaternius.itch.io/universal-animation-library-2 |
| Modular Character Outfits - Fantasy | https://quaternius.itch.io/modular-character-outfits-fantasy |

## Props: Poly Haven (CC0)

Photo-scanned models from [polyhaven.com](https://polyhaven.com) ([licence](https://polyhaven.com/license)),
the 1k glTF variant repacked into one GLB each (see `docs/assets/props.md`).

| File | Poly Haven asset |
|---|---|
| `props/crt_tv.glb` | [Television_01](https://polyhaven.com/a/Television_01) |
| `props/sofa_worn.glb` | [sofa_03](https://polyhaven.com/a/sofa_03) |
| `props/iron_bed.glb` | [old_bed_frame](https://polyhaven.com/a/old_bed_frame) |
| `props/cardboard_box.glb` | [cardboard_box_01](https://polyhaven.com/a/cardboard_box_01) |
| `props/trash_bag.glb` | [trashbag](https://polyhaven.com/a/trashbag) |
| `props/wrist_watch.glb` | [digital_wrist_watch](https://polyhaven.com/a/digital_wrist_watch) |
| `props/steel_shelves.glb` | [steel_frame_shelves_01](https://polyhaven.com/a/steel_frame_shelves_01) |
| `props/fluoro_light.glb` | [mounted_fluorescent_lights](https://polyhaven.com/a/mounted_fluorescent_lights) |
| `props/bench_vice.glb` | [bench_vice_01](https://polyhaven.com/a/bench_vice_01) |
| `props/spanner.glb` | [combination_wrench](https://polyhaven.com/a/combination_wrench) |
| `props/drill.glb` | [Drill_01](https://polyhaven.com/a/Drill_01) |
| `props/hammer.glb` | [cross_pein_hammer](https://polyhaven.com/a/cross_pein_hammer) |
| `props/handsaw.glb` | [handsaw_wood](https://polyhaven.com/a/handsaw_wood) |
| `props/pliers.glb` | [pliers](https://polyhaven.com/a/pliers) |
| `props/screwdriver.glb` | [screwdriver](https://polyhaven.com/a/screwdriver) |
| `props/tape_measure.glb` | [measuring_tape_01](https://polyhaven.com/a/measuring_tape_01) |
| `props/paint_can.glb` | [can_rusted](https://polyhaven.com/a/can_rusted) |
| `props/oil_can.glb` | [small_oil_can_01](https://polyhaven.com/a/small_oil_can_01) |
| `props/toolbox.glb` | [metal_toolbox](https://polyhaven.com/a/metal_toolbox) |
| `props/stool.glb` | [wooden_stool_01](https://polyhaven.com/a/wooden_stool_01) |
| `props/stepladder.glb` | [wooden_ladder](https://polyhaven.com/a/wooden_ladder) |
| `props/bulb.glb` | [lightbulb_01](https://polyhaven.com/a/lightbulb_01) |
| `props/track_pump.glb` | [tire_pump](https://polyhaven.com/a/tire_pump) |
| `props/radio.glb` | [boombox](https://polyhaven.com/a/boombox) |
| `props/bin_metal.glb` | [metal_trash_can](https://polyhaven.com/a/metal_trash_can) |
| `props/barrel.glb` | [barrel_03](https://polyhaven.com/a/barrel_03) |
| `props/crate_wood.glb` | [wooden_crate_01](https://polyhaven.com/a/wooden_crate_01) |
| `props/milk_crate.glb` | [plastic_crate_01](https://polyhaven.com/a/plastic_crate_01) |
| `props/cafe_set.glb` | [outdoor_table_chair_set_01](https://polyhaven.com/a/outdoor_table_chair_set_01) |
| `props/chair_painted.glb` | [painted_wooden_chair_01](https://polyhaven.com/a/painted_wooden_chair_01) |
| `props/road_barrier.glb` | [concrete_road_barrier_02](https://polyhaven.com/a/concrete_road_barrier_02) |

## PBR materials and HDRIs: Poly Haven (CC0)

Textures (colour, OpenGL normal, ARM) and 1k HDRIs from [polyhaven.com](https://polyhaven.com)
(see `docs/assets/materials.md`).

| Material | Poly Haven texture |
|---|---|
| `materials/flat_floorboards` | [old_wood_floor](https://polyhaven.com/a/old_wood_floor) |
| `materials/plaster_painted` | [painted_plaster_wall](https://polyhaven.com/a/painted_plaster_wall) |
| `materials/tile_white_long` | [long_white_tiles](https://polyhaven.com/a/long_white_tiles) |
| `materials/fabric_wool` | [poly_wool_herringbone](https://polyhaven.com/a/poly_wool_herringbone) |
| `materials/street_asphalt_wet` | [asphalt_02](https://polyhaven.com/a/asphalt_02) |
| `materials/street_cobbles` | [cobblestone_embedded_asphalt](https://polyhaven.com/a/cobblestone_embedded_asphalt) |
| `materials/street_pavement` | [concrete_pavement](https://polyhaven.com/a/concrete_pavement) |
| `materials/concrete_grimy` | [concrete_wall_006](https://polyhaven.com/a/concrete_wall_006) |
| `materials/facade_brick_dark` | [red_bricks_04](https://polyhaven.com/a/red_bricks_04) |
| `materials/facade_brick_painted` | [painted_worn_brick](https://polyhaven.com/a/painted_worn_brick) |
| `materials/facade_brick_plaster` | [red_brick_plaster_patch_02](https://polyhaven.com/a/red_brick_plaster_patch_02) |
| `materials/facade_render` | [concrete_wall_008](https://polyhaven.com/a/concrete_wall_008) |
| `materials/shutter_rusty` | [rusty_metal_shutter](https://polyhaven.com/a/rusty_metal_shutter) |
| `materials/metal_painted_green` | [green_metal_rust](https://polyhaven.com/a/green_metal_rust) |
| `materials/metal_painted_rusty` | [rusty_metal_02](https://polyhaven.com/a/rusty_metal_02) |
| `materials/metal_corrugated_rusty` | [rusty_corrugated_iron](https://polyhaven.com/a/rusty_corrugated_iron) |
| `materials/wall_mural_render` | [plastered_wall_03](https://polyhaven.com/a/plastered_wall_03) |
| `materials/workshop_floor_concrete` | [garage_floor](https://polyhaven.com/a/garage_floor) |
| `materials/brick_whitewashed` | [whitewashed_brick](https://polyhaven.com/a/whitewashed_brick) |
| `materials/wood_planks_weathered` | [weathered_brown_planks](https://polyhaven.com/a/weathered_brown_planks) |
| `materials/wood_planks_painted` | [distressed_painted_planks](https://polyhaven.com/a/distressed_painted_planks) |
| `materials/wood_plywood` | [plywood](https://polyhaven.com/a/plywood) |
| `materials/metal_plate_worn` | [metal_plate_02](https://polyhaven.com/a/metal_plate_02) |

| HDRI | Poly Haven HDRI |
|---|---|
| `hdri/night_street.hdr` | [cobblestone_street_night](https://polyhaven.com/a/cobblestone_street_night) |
| `hdri/dawn_fog.hdr` | [beach_parking](https://polyhaven.com/a/beach_parking) |
| `hdri/interior_dim.hdr` | [lebombo](https://polyhaven.com/a/lebombo) |
| `hdri/workshop.hdr` | [small_workshop](https://polyhaven.com/a/small_workshop) |
| `hdri/golden_street.hdr` | [vatican_road](https://polyhaven.com/a/vatican_road) |

## Grime decals: ambientCG (CC0)

Opacity masks only, from [ambientCG](https://ambientcg.com) ([licence](https://docs.ambientcg.com/license/)).
`grime/puddles.png` and `grime/macro.png` are generated by `scripts/assets/materials-grime.mjs`.

| File | ambientCG asset |
|---|---|
| `materials/grime/leaks.jpg` | [Leaking003](https://ambientcg.com/view?id=Leaking003) |
| `materials/grime/edge_dirt.jpg` | [Leaking008](https://ambientcg.com/view?id=Leaking008) |
| `materials/grime/streaks.jpg` | [SurfaceImperfections003](https://ambientcg.com/view?id=SurfaceImperfections003) |

## Street pieces and footsteps: Kenney (CC0)

From [kenney.nl](https://kenney.nl) ([licence](https://kenney.nl/support): CC0). Only a few
low-poly pieces remain, restyled at load (`Materials.restyleKenney`).

| Kit | Files used |
|---|---|
| [City Kit Commercial](https://kenney.nl/assets/city-kit-commercial) | `low-detail-building-a…d` (the fogged skyline in Ch2 and Ch5) |
| [City Kit Roads](https://kenney.nl/assets/city-kit-roads) | `construction-cone`, `light-square` |
| [Retro Urban Kit](https://kenney.nl/assets/retro-urban-kit) | `detail-bench`, `detail-bricks-type-a`, `detail-dumpster-closed`, `pallet-small` and their textures |
| [Survival Kit](https://kenney.nl/assets/survival-kit) | `bottle-large` |
| [Impact Sounds](https://kenney.nl/assets/impact-sounds) | `footstep_concrete_000…004.ogg` |

## Music and ambience: OpenGameArt.org (CC0)

All four are published on [opengameart.org](https://opengameart.org) under CC0 (checked on each
page). Note that a different OpenGameArt track also called "Contemplation" (by bart) is CC-BY/GPL:
ours is Joth's, at the page below.

| File | Title, author | Page (licence) | Downloaded file |
|---|---|---|---|
| `audio/contemplation.mp3` (Ch1, Ch2, Ch4) | "Contemplation", Joth | https://opengameart.org/content/contemplation-0 (CC0) | https://opengameart.org/sites/default/files/Contemplation.mp3 |
| `audio/piano.ogg` (Ch5 and the end card; transcoded to Ogg Opus by `fetch-assets.sh`) | "Emotional piano loop", extenz | https://opengameart.org/content/emotional-piano-loop (CC0) | https://opengameart.org/sites/default/files/Piano%20Loop.wav |
| `audio/rain.ogg` (file `2.ogg` of the zip) | "Rain (loopable)", Ylmir | https://opengameart.org/content/rain-loopable (CC0) | https://opengameart.org/sites/default/files/Rain%20OGG.zip |
| `audio/crowd.ogg` (the Ch3 race) | "Crowd Shouting/Speaking Ambience", StarNinjas | https://opengameart.org/content/crowd-shoutingspeaking-ambience (CC0; the author asks for a link to their profile, given here as a courtesy) | https://opengameart.org/sites/default/files/crowd_shouting_0.ogg |

## Code

Written for this project. [three.js](https://threejs.org) r186 is MIT-licensed; Vite is MIT-licensed.
The asset build scripts use [glTF-Transform](https://gltf-transform.dev) (MIT) and
[sharp](https://sharp.pixelplumbing.com) (Apache-2.0) as dev tools only; neither ships.

