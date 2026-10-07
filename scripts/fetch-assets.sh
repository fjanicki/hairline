#!/usr/bin/env bash
# Downloads the verified third-party assets (CC0 Kenney / OpenGameArt, plus the
# three.js example Xbot) and extracts only the files the game uses into public/assets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE="$ROOT/.cache/dl"
OUT="$ROOT/public/assets"
mkdir -p "$CACHE" "$OUT"/{models,kenney,audio}

fetch() { # fetch <cache-subdir> <file> <url>
  local dir="$CACHE/$1" file="$CACHE/$1/$2"
  mkdir -p "$dir"
  if [[ ! -s "$file" ]]; then
    echo "  downloading $2"
    curl -fsSL -o "$file" "$3"
  fi
}

extract() { # extract <zip> <dest-dir> <path-in-zip>...
  local zip="$1" dest="$2"; shift 2
  mkdir -p "$dest"
  for p in "$@"; do unzip -o -j -q "$zip" "$p" -d "$dest"; done
}

echo "Characters"
fetch xbot Xbot.glb https://cdn.jsdelivr.net/gh/mrdoob/three.js@r186/examples/models/gltf/Xbot.glb
cp "$CACHE/xbot/Xbot.glb" "$OUT/models/Xbot.glb"

echo "Kenney Furniture Kit (CC0)"
fetch furniture f.zip https://kenney.nl/media/pages/assets/furniture-kit/440e0608a4-1677580847/kenney_furniture-kit.zip
F=()
for m in loungeSofa televisionVintage cabinetTelevision tableCoffee bedSingle cardboardBoxClosed cardboardBoxOpen \
         kitchenFridge kitchenCabinet lampRoundFloor rugRectangle sideTable chair table books trashcan pottedPlant \
         doorway wallWindow bench; do F+=("Models/GLTF format/$m.glb"); done
extract "$CACHE/furniture/f.zip" "$OUT/kenney/furniture" "${F[@]}"

echo "Kenney City Kit Commercial (CC0)"
fetch citycom c.zip https://kenney.nl/media/pages/assets/city-kit-commercial/a742d900eb-1753115042/kenney_city-kit-commercial_2.1.zip
F=()
for m in building-a building-b building-c building-d building-e building-f building-g building-h \
         low-detail-building-a low-detail-building-b low-detail-building-c low-detail-building-d detail-awning; do
  F+=("Models/GLB format/$m.glb"); done
extract "$CACHE/citycom/c.zip" "$OUT/kenney/city" "${F[@]}"
extract "$CACHE/citycom/c.zip" "$OUT/kenney/city/Textures" "Models/GLB format/Textures/colormap.png"

echo "Kenney City Kit Roads (CC0)"
fetch roads r.zip https://kenney.nl/media/pages/assets/city-kit-roads/74288c9459-1787042796/kenney_city-kit-roads.zip
F=()
for m in road-straight light-square light-curved construction-fence construction-cone construction-barrier dumpster; do
  F+=("Models/GLB format/$m.glb"); done
extract "$CACHE/roads/r.zip" "$OUT/kenney/roads" "${F[@]}"
extract "$CACHE/roads/r.zip" "$OUT/kenney/roads/Textures" "Models/GLB format/Textures/colormap.png"

echo "Kenney Retro Urban Kit (CC0)"
fetch retro u.zip https://kenney.nl/media/pages/assets/retro-urban-kit/8314d4db22-1738147509/kenney_retro-urban-kit.zip
F=()
for m in detail-bench detail-dumpster-open wall-broken-type-a detail-barrier-strong-damaged pallet planks \
         detail-light-single tree-small; do F+=("Models/GLB format/$m.glb"); done
extract "$CACHE/retro/u.zip" "$OUT/kenney/retro" "${F[@]}"
mkdir -p "$OUT/kenney/retro/Textures"
unzip -o -j -q "$CACHE/retro/u.zip" "Models/GLB format/Textures/*" -d "$OUT/kenney/retro/Textures"

F=()
for m in scaffolding-structure scaffolding-floor scaffolding-poles wall-a-flat wall-a-garage wall-a-door wall-a-window \
         detail-cables-type-a detail-bricks-type-a pallet-small detail-dumpster-closed; do F+=("Models/GLB format/$m.glb"); done
extract "$CACHE/retro/u.zip" "$OUT/kenney/retro" "${F[@]}"

echo "Kenney Survival Kit (CC0)"
fetch survival s.zip https://kenney.nl/media/pages/assets/survival-kit/4065a8185b-1712149243/kenney_survival-kit.zip
F=()
for m in workbench workbench-grind workbench-anvil tool-hammer tool-axe tool-shovel bucket barrel barrel-open \
         box box-open box-large resource-planks resource-wood metal-panel metal-panel-screws structure-metal-wall \
         structure-metal-roof structure-metal-doorway chest bottle-large signpost; do F+=("Models/GLB format/$m.glb"); done
extract "$CACHE/survival/s.zip" "$OUT/kenney/survival" "${F[@]}"
extract "$CACHE/survival/s.zip" "$OUT/kenney/survival/Textures" "Models/GLB format/Textures/colormap.png"

echo "Kenney Nature Kit (CC0)"
fetch nature n.zip https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip
F=()
for m in tree_default_fall tree_oak_fall tree_cone_fall tree_thin_fall tree_simple_fall grass_large grass \
         plant_bush stump_old log fence_simple rock_largeA; do F+=("Models/GLTF format/$m.glb"); done
extract "$CACHE/nature/n.zip" "$OUT/kenney/nature" "${F[@]}"

echo "Kenney Mini Arena (CC0)"
fetch arena a.zip https://kenney.nl/media/pages/assets/mini-arena/88f977a0cb-1709220730/kenney_mini-arena.zip
extract "$CACHE/arena/a.zip" "$OUT/kenney/arena" "Models/GLB format/trophy.glb" "Models/GLB format/banner.glb" "Models/GLB format/column-damaged.glb"
extract "$CACHE/arena/a.zip" "$OUT/kenney/arena/Textures" "Models/GLB format/Textures/colormap.png"

echo "Audio (CC0)"
fetch impact i.zip https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip
F=(); for i in 0 1 2 3 4; do F+=("Audio/footstep_concrete_00$i.ogg" "Audio/footstep_grass_00$i.ogg"); done
extract "$CACHE/impact/i.zip" "$OUT/audio" "${F[@]}"
fetch contemplation Contemplation.mp3 https://opengameart.org/sites/default/files/Contemplation.mp3
cp "$CACHE/contemplation/Contemplation.mp3" "$OUT/audio/contemplation.mp3"
fetch piano piano.wav "https://opengameart.org/sites/default/files/Piano%20Loop.wav"
cp "$CACHE/piano/piano.wav" "$OUT/audio/piano.wav"
fetch rain rain.zip "https://opengameart.org/sites/default/files/Rain%20OGG.zip"
unzip -o -j -q "$CACHE/rain/rain.zip" "2.ogg" -d "$CACHE/rain" && cp "$CACHE/rain/2.ogg" "$OUT/audio/rain.ogg"
fetch crowd crowd.ogg https://opengameart.org/sites/default/files/crowd_shouting_0.ogg
cp "$CACHE/crowd/crowd.ogg" "$OUT/audio/crowd.ogg"

echo "Done. $(find "$OUT" -type f | wc -l | tr -d ' ') files in public/assets"
