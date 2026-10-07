#!/usr/bin/env bash
# Downloads the verified third-party assets and extracts only the files the game uses into
# public/assets (gitignored). This file fetches the Kenney pieces and the audio (CC0, Kenney and
# OpenGameArt); the Quaternius characters, Poly Haven / ambientCG materials and HDRIs, and the
# Poly Haven props come from scripts/assets/<group>.sh, run at the end with ROOT, CACHE and OUT set.
# Idempotent: every download is cached in .cache/dl and skipped when present. See docs/CREDITS.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE="$ROOT/.cache/dl"
OUT="$ROOT/public/assets"
mkdir -p "$CACHE" "$OUT/audio"
rm -rf "$OUT/models" "$ROOT/public/__probe" # the old Xbot folder and a stray test dir, if an old checkout left them

fetch() { # fetch <cache-subdir> <file> <url>
  local dir="$CACHE/$1" file="$CACHE/$1/$2"
  mkdir -p "$dir"
  if [[ ! -s "$file" ]]; then
    echo "  downloading $2"
    curl -fsSL --retry 2 -o "$file.part" "$3" # atomic: an interrupted run never leaves a stub
    mv "$file.part" "$file"
  fi
}

extract() { # extract <zip> <dest-dir> <path-in-zip>...
  local zip="$1" dest="$2"; shift 2
  mkdir -p "$dest"
  for p in "$@"; do unzip -o -j -q "$zip" "$p" -d "$dest"; done
}

# Kenney (CC0): only the few low-poly pieces the scenes still place (the street filler: fogged
# skyline blocks, cones, bottles, pallets, a dumpster). Everything else is procedural or a Poly Haven
# scan now. The tree is rebuilt from the cached zips on every run, so files dropped from these lists
# never linger in public/assets.
KTMP="$OUT/kenney.tmp"
rm -rf "$KTMP"

echo "Kenney City Kit Commercial (CC0)"
fetch citycom c.zip https://kenney.nl/media/pages/assets/city-kit-commercial/a742d900eb-1753115042/kenney_city-kit-commercial_2.1.zip
F=()
for m in low-detail-building-a low-detail-building-b low-detail-building-c low-detail-building-d; do F+=("Models/GLB format/$m.glb"); done
extract "$CACHE/citycom/c.zip" "$KTMP/city" "${F[@]}"
extract "$CACHE/citycom/c.zip" "$KTMP/city/Textures" "Models/GLB format/Textures/colormap.png"

echo "Kenney City Kit Roads (CC0)"
fetch roads r.zip https://kenney.nl/media/pages/assets/city-kit-roads/74288c9459-1787042796/kenney_city-kit-roads.zip
extract "$CACHE/roads/r.zip" "$KTMP/roads" "Models/GLB format/construction-cone.glb" "Models/GLB format/light-square.glb"
extract "$CACHE/roads/r.zip" "$KTMP/roads/Textures" "Models/GLB format/Textures/colormap.png"

echo "Kenney Retro Urban Kit (CC0)"
fetch retro u.zip https://kenney.nl/media/pages/assets/retro-urban-kit/8314d4db22-1738147509/kenney_retro-urban-kit.zip
F=()
for m in detail-dumpster-closed pallet-small detail-bricks-type-a detail-bench; do F+=("Models/GLB format/$m.glb"); done
extract "$CACHE/retro/u.zip" "$KTMP/retro" "${F[@]}"
F=()
for t in metal_wall roof wall planks concrete metal; do F+=("Models/GLB format/Textures/$t.png"); done # what those four reference
extract "$CACHE/retro/u.zip" "$KTMP/retro/Textures" "${F[@]}"

echo "Kenney Survival Kit (CC0)"
fetch survival s.zip https://kenney.nl/media/pages/assets/survival-kit/4065a8185b-1712149243/kenney_survival-kit.zip
extract "$CACHE/survival/s.zip" "$KTMP/survival" "Models/GLB format/bottle-large.glb"
extract "$CACHE/survival/s.zip" "$KTMP/survival/Textures" "Models/GLB format/Textures/colormap.png"

rm -rf "$OUT/kenney" && mv "$KTMP" "$OUT/kenney"

echo "Audio (CC0)"
fetch impact i.zip https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip
F=(); for i in 0 1 2 3 4; do F+=("Audio/footstep_concrete_00$i.ogg"); done
rm -f "$OUT"/audio/footstep_grass_*.ogg # no grass any more
extract "$CACHE/impact/i.zip" "$OUT/audio" "${F[@]}"
# OpenGameArt (all CC0; docs/CREDITS.md has each page):
#   "Contemplation" by Joth            https://opengameart.org/content/contemplation-0
#   "Emotional piano loop" by extenz   https://opengameart.org/content/emotional-piano-loop
#   "Rain (loopable)" by Ylmir         https://opengameart.org/content/rain-loopable
#   "Crowd Shouting/Speaking Ambience" by StarNinjas  https://opengameart.org/content/crowd-shoutingspeaking-ambience
fetch contemplation Contemplation.mp3 https://opengameart.org/sites/default/files/Contemplation.mp3
cp "$CACHE/contemplation/Contemplation.mp3" "$OUT/audio/contemplation.mp3"
fetch piano piano.wav "https://opengameart.org/sites/default/files/Piano%20Loop.wav"
# The piano loop is 4.9 MB of PCM: ship it as Ogg Opus (~0.4 MB; Ogg keeps the loop gapless). The
# WAV stays in the cache, and is shipped as the fallback only when ffmpeg is missing (Audio.js tries
# piano.ogg, then piano.wav).
if [[ -s "$OUT/audio/piano.ogg" && "$OUT/audio/piano.ogg" -nt "$CACHE/piano/piano.wav" ]]; then
  rm -f "$OUT/audio/piano.wav"
elif command -v ffmpeg >/dev/null \
  && ffmpeg -nostdin -loglevel error -y -i "$CACHE/piano/piano.wav" -c:a libopus -b:a 112k -f ogg "$OUT/audio/piano.ogg.part"; then
  mv "$OUT/audio/piano.ogg.part" "$OUT/audio/piano.ogg"
  rm -f "$OUT/audio/piano.wav"
else
  echo "  [hairline] no ffmpeg with libopus: shipping the 4.9 MB piano.wav instead of piano.ogg" >&2
  cp "$CACHE/piano/piano.wav" "$OUT/audio/piano.wav"
  rm -f "$OUT/audio/piano.ogg" "$OUT/audio/piano.ogg.part"
fi
fetch rain rain.zip "https://opengameart.org/sites/default/files/Rain%20OGG.zip"
unzip -o -j -q "$CACHE/rain/rain.zip" "2.ogg" -d "$CACHE/rain" && cp "$CACHE/rain/2.ogg" "$OUT/audio/rain.ogg"
fetch crowd crowd.ogg https://opengameart.org/sites/default/files/crowd_shouting_0.ogg
cp "$CACHE/crowd/crowd.ogg" "$OUT/audio/crowd.ogg"

# Extra asset groups (HD characters, PBR materials, HDRIs, props): one script per group.
for extra in "$ROOT"/scripts/assets/*.sh; do
  [[ -e "$extra" ]] || continue
  echo "== $(basename "$extra")"
  ROOT="$ROOT" CACHE="$CACHE" OUT="$OUT" bash "$extra"
done

echo "Done. $(find "$OUT" -type f | wc -l | tr -d ' ') files in public/assets"
