#!/usr/bin/env bash
# Character asset group: Quaternius "Universal" family (CC0), fetched from itch.io's free
# [Standard] downloads, then trimmed into public/assets/characters by characters-build.mjs.
#   - Universal Base Characters      (bodies + hair, glTF)
#   - Universal Animation Library 1+2 (clips on the same rig, glTF)
#   - Modular Character Outfits - Fantasy (outfit parts on the same rig, glTF)
# Env (set by scripts/fetch-assets.sh, defaults for running it alone): ROOT, CACHE, OUT.
set -euo pipefail

ROOT="${ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
CACHE="${CACHE:-$ROOT/.cache/dl}"
OUT="${OUT:-$ROOT/public/assets}"
DL="$CACHE/characters"
mkdir -p "$DL"

die() { echo "[hairline] characters.sh: $*" >&2; exit 1; }
# itch_fetch's cookie jar, removed on any exit (including die).
JAR=""
trap '[[ -n "$JAR" ]] && rm -f "$JAR"' EXIT
# Top-level "url" of a JSON reply on stdin (the reply also nests other "url" keys).
json_url() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).url||"")}catch{}})'; }

# itch_fetch <slug> <exact upload name> <cache file>
# Free pay-what-you-want download: page -> csrf -> download page -> upload id by NAME -> signed URL (60 s).
itch_fetch() {
  local slug="$1" name="$2" file="$DL/$3"
  if [[ -s "$file" ]]; then echo "  cached $3"; return; fi
  local P="https://quaternius.itch.io/$slug" J; J="$(mktemp)"; JAR="$J"
  local page csrf dlpage dlhtml id signed
  # The extractions end in '|| true' so that, under set -euo pipefail, a grep that finds nothing
  # reaches the explicit checks (and their messages) instead of exiting silently.
  page="$(curl -fsS -c "$J" -b "$J" "$P")" || die "cannot open $P"
  csrf="$(grep -o 'name="csrf_token" value="[^"]*"' <<<"$page" | head -1 | sed 's/.*value="//;s/"$//' || true)"
  [[ -n "$csrf" ]] || die "no csrf_token on $P (itch page layout changed?)"
  dlpage="$(curl -fsS -c "$J" -b "$J" -X POST "$P/download_url" --data-urlencode "csrf_token=$csrf" | json_url)" \
    || die "$slug: POST /download_url failed"
  [[ -n "$dlpage" ]] || die "$slug: /download_url returned no url (itch flow changed?)"
  dlhtml="$(curl -fsS -c "$J" -b "$J" "$dlpage")" || die "$slug: cannot open the download page $dlpage"
  # Each upload block starts with data-upload_id="N" and later has <strong title="NAME" class="name">.
  id="$(tr '\n' ' ' <<<"$dlhtml" \
    | grep -o 'data-upload_id="[0-9]*"\|<strong title="[^"]*" class="name"' \
    | awk -v want="$name" '/upload_id/ { gsub(/[^0-9]/, ""); id = $0; next }
                           { t = $0; sub(/^<strong title="/, "", t); sub(/" class="name"$/, "", t);
                             if (t == want && id != "") { print id; exit } }' || true)"
  [[ -n "$id" ]] || die "$slug: no upload named '$name' on the download page (renamed on itch?)"
  signed="$(curl -fsS -c "$J" -b "$J" -X POST "$P/file/$id?source=view_game&as_props=1&after_download_lightbox=true" \
    --data-urlencode "csrf_token=$csrf" | json_url)" || die "$slug: POST for upload $id failed"
  [[ -n "$signed" ]] || die "$slug: upload $id gave no signed url"
  echo "  downloading $name (upload $id)"
  curl -fsSL --retry 2 -o "$file.part" "$signed" || die "$slug: download of upload $id failed"
  unzip -tqq "$file.part" >/dev/null || die "$slug: upload $id is not a valid zip (got $(head -c 64 "$file.part" | tr -d '\n'))"
  mv "$file.part" "$file"
  rm -f "$J"; JAR=""
}

echo "Quaternius Universal characters (CC0)"
itch_fetch universal-base-characters "Universal Base Characters[Standard].zip" ubc.zip
itch_fetch universal-animation-library "Universal Animation Library[Standard].zip" ual1.zip
itch_fetch universal-animation-library-2 "Universal Animation Library 2[Standard].zip" ual2.zip
itch_fetch modular-character-outfits-fantasy "Modular Character Outfits - Fantasy[Standard].zip" outfits.zip

# Extract only the glTF sources the build reads (FBX/Unity/.blend and the 4k PNG duplicates stay zipped).
SRC="$DL/src"
extract_once() { # extract_once <zip> <dest> <pattern>...
  local zip="$1" dest="$2"; shift 2
  local stamp="$dest/.from-$(basename "$zip")-$(wc -c <"$zip" | tr -d " ")"
  [[ -e "$stamp" ]] && return
  rm -rf "$dest"; mkdir -p "$dest"
  unzip -q -o "$zip" "$@" -d "$dest" || die "unzip failed for $(basename "$zip") (pack layout changed?)"
  touch "$stamp"
}
extract_once "$DL/ubc.zip" "$SRC/ubc" "*/Base Characters/Godot - UE/*" "*/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/*"
extract_once "$DL/ual1.zip" "$SRC/ual1" "*/Unreal-Godot/UAL1_Standard.glb"
extract_once "$DL/ual2.zip" "$SRC/ual2" "*/Unreal-Godot/UAL2_Standard.glb"
extract_once "$DL/outfits.zip" "$SRC/outfits" "*/Exports/glTF (Godot-Unreal)/Outfits/*"

# Build the trimmed web set (needs the devDependencies: npm install).
[[ -d "$ROOT/node_modules/@gltf-transform/core" && -d "$ROOT/node_modules/sharp" ]] || die "run 'npm install' first (needs @gltf-transform/* and sharp)"
# Rebuilt only when the build script or a source zip changes.
STAMP="$DL/build.stamp"
want="$( (cat "$ROOT/scripts/assets/characters-build.mjs"; ls -l "$DL"/*.zip | awk '{print $5, $NF}') | shasum | cut -c1-16)"
if [[ -s "$OUT/characters/parts.glb" && -s "$OUT/characters/anims.glb" && "$(cat "$STAMP" 2>/dev/null)" == "$want" ]]; then
  echo "  characters up to date"
else
  rm -rf "$OUT/characters.tmp"
  node "$ROOT/scripts/assets/characters-build.mjs" "$SRC" "$OUT/characters.tmp"
  rm -rf "$OUT/characters" && mv "$OUT/characters.tmp" "$OUT/characters"
  echo "$want" >"$STAMP"
fi
echo "  characters: $(du -sh "$OUT/characters" | cut -f1) in public/assets/characters"
