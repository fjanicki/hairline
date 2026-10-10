#!/usr/bin/env bash
# Recorded sound effects: downloads the originals (BBC Sound Effects archive WAVs, Kenney CC0 packs,
# OpenGameArt CC0 packs) into .cache/sfx/dl/<source>/ and builds public/assets/sfx/<name>.ogg (Ogg Opus,
# trimmed, faded, seamless loops, loudness-normalised per category, true peak <= -1 dBTP) plus
# public/assets/sfx/sfx.json, with scripts/sfx/build.py driven by scripts/sfx/recipes.json.
# Catalogue, licences and per-cue mixing notes: docs/assets/sfx.md.
#
# Run through scripts/fetch-assets.sh, or standalone: ROOT=$PWD bash scripts/assets/sfx.sh
# Env: ROOT, OUT (as the other groups; CACHE is not used: the originals live in $SFX_DL),
#      SFX_DL (default $ROOT/.cache/sfx/dl), SFX_SKIP=1 to skip this group, SFX_FORCE=1 to rebuild all.
# Idempotent: every download is cached and skipped when present; build.py only rebuilds recipes that
# changed. The BBC originals are about 820 MB of WAV (downloaded once).
#
# Licences: Kenney and OpenGameArt packs are CC0. BBC Sound Effects are under the RemArc licence
# (personal, educational and research use only): fine for this personal, unpublished project, but a
# public release needs a commercial licence (BBC / Pro Sound Effects) or replacements. See the doc.
#
# Generated SFX (scripts/sfx/generate.py, TangoFlux, non-commercial research licence) are built by the same
# build.py from .cache/sfx/dl/gen/ when those picks exist; this script never runs the generator (about 6 GB of
# weights and an hour on the GPU), so a fresh checkout keeps what was built and skips the rest.
set -euo pipefail

ROOT="${ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
OUT="${OUT:-$ROOT/public/assets}"
DL="${SFX_DL:-$ROOT/.cache/sfx/dl}"
VENV="$ROOT/.cache/sfx/venv"
UA="hairline-fetch-assets/1.0"

if [[ "${SFX_SKIP:-}" == 1 ]]; then echo "  sfx: skipped (SFX_SKIP=1)"; exit 0; fi
command -v ffmpeg >/dev/null || { echo "  sfx: ffmpeg (with libopus) is required; skipping" >&2; exit 0; }
mkdir -p "$DL/bbc" "$DL/kenney" "$DL/oga"

get() { # get <dest-file> <url>   (atomic, cached)
  local f="$1"
  [[ -s "$f" ]] && return 0
  echo "  downloading $(basename "$f")"
  curl -fsSL --retry 2 -A "$UA" -o "$f.part" "$2"
  mv "$f.part" "$f"
}

# Each archive is extracted into its own directory, and only the members we use (audio files).
unpack() { # unpack <zip> <dest-dir> <member>...   (-j: flat)
  local zip="$1" dest="$2"; shift 2
  mkdir -p "$dest"
  for m in "$@"; do [[ -s "$dest/$(basename "$m")" ]] || unzip -o -j -q "$zip" "$m" -d "$dest"; done
}

echo "BBC Sound Effects (RemArc licence: personal/educational/research use)"
BBC_IDS=(
  07010167 07045107 07043377 07042249 07059070 07026083 07026084 07055092 07027080
  07031026 07031012 07004188 07037037 07037080 07037078 07037360 NHU05008020 07045141
  NHU05104268 07031004 07043081 07045123 07045125 07010181 07045095 07027207
  07075036 07058163 07027110 07031023 NHU05068153 07076042 07037426 07014195 07043020
)
for id in "${BBC_IDS[@]}"; do
  get "$DL/bbc/$id.wav" "https://sound-effects-media.bbcrewind.co.uk/wav/$id.wav"
done

echo "Kenney RPG Audio + Impact Sounds (CC0)"
get "$DL/kenney/rpg.zip" https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip
F=(); for n in bookFlip1 bookFlip2 bookFlip3 bookOpen bookClose creak1 creak2 creak3 metalClick metalLatch; do F+=("Audio/$n.ogg"); done
for n in knifeSlice knifeSlice2 handleCoins handleCoins2 cloth1 cloth2 cloth3 cloth4 doorClose_1 doorClose_3 doorClose_4; do F+=("Audio/$n.ogg"); done  # R4
unpack "$DL/kenney/rpg.zip" "$DL/kenney/rpg" "${F[@]}"
get "$DL/kenney/impact.zip" https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip
F=()
for i in 0 1 2 3; do F+=("Audio/impactTin_medium_00$i.ogg"); done
for i in 0 1 2; do F+=("Audio/impactWood_light_00$i.ogg"); done
for i in 0 1; do F+=("Audio/impactPlate_light_00$i.ogg" "Audio/impactSoft_heavy_00$i.ogg"); done
for i in 0 1 2 3 4; do F+=("Audio/footstep_wood_00$i.ogg"); done
unpack "$DL/kenney/impact.zip" "$DL/kenney/impact" "${F[@]}"

echo "OpenGameArt (CC0)"
#   "202 More Sound Effects" by owlishmedia  https://opengameart.org/content/202-more-sound-effects
#   "Pencil Sounds" by antumdeluge           https://opengameart.org/content/pencil-sounds
#   "Breathing Tired" by mikeask             https://opengameart.org/content/breathing-tired
get "$DL/oga/MoreSounds.zip" https://opengameart.org/sites/default/files/MoreSounds.zip
mkdir -p "$DL/oga/MoreSounds/Velcro" "$DL/oga/MoreSounds/Camera"
unpack "$DL/oga/MoreSounds.zip" "$DL/oga/MoreSounds/Velcro" Velcro/Velcro_01.wav Velcro/Velcro_02.wav Velcro/Velcro_03.wav
unpack "$DL/oga/MoreSounds.zip" "$DL/oga/MoreSounds/Camera" Camera/Camera_01.wav
get "$DL/oga/pencil.zip" https://opengameart.org/sites/default/files/pencil.zip
unpack "$DL/oga/pencil.zip" "$DL/oga/pencil/flac" flac/pencil_write.flac flac/pencil_erase.flac
get "$DL/oga/breathing_tired.wav" "https://opengameart.org/sites/default/files/breathing%20tired.wav"

# Python 3.12 venv for the build (numpy, scipy, soundfile, pyloudnorm), made with uv.
if [[ ! -x "$VENV/bin/python" ]] || ! "$VENV/bin/python" -c "import numpy, scipy, soundfile, pyloudnorm" 2>/dev/null; then
  UV="$(command -v uv || echo "$HOME/.local/bin/uv")"
  if [[ ! -x "$UV" ]]; then echo "  sfx: uv not found; cannot build (install uv, then re-run)" >&2; exit 0; fi
  "$UV" venv -q -p 3.12 "$VENV"
  "$UV" pip install -q -p "$VENV/bin/python" numpy scipy soundfile pyloudnorm
fi

echo "Building public/assets/sfx"
ARGS=(--root "$ROOT" --dl "$DL" --out "$OUT/sfx")
[[ "${SFX_FORCE:-}" == 1 ]] && ARGS+=(--force)
nice -n 10 "$VENV/bin/python" -I "$ROOT/scripts/sfx/build.py" "${ARGS[@]}"
