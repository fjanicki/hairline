#!/usr/bin/env bash
# Hero props (CC0, Poly Haven photo-scans): downloads the 1k glTF variant of each model, then repacks it
# into one self-contained GLB at public/assets/props/<our_id>.glb with re-encoded JPEG textures
# (512 px for hand-sized props, 1k for furniture), plus .cache/dl/props/props.json (tris, bounds, nodes; not shipped).
# Run through scripts/fetch-assets.sh, or standalone: ROOT=$PWD bash scripts/assets/props.sh
# Idempotent: downloads are cached in $CACHE/props, and a GLB is only rebuilt when its recipe changes.
set -euo pipefail

ROOT="${ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
CACHE="${CACHE:-$ROOT/.cache/dl}"
OUT="${OUT:-$ROOT/public/assets}"
D="$CACHE/props"
DEST="$OUT/props"
TOOLS="$ROOT/.cache/tools/props-pack"
PACK_VERSION=2 # bump to force every GLB to be rebuilt
API=https://api.polyhaven.com
UA="hairline-fetch-assets/1.0"
mkdir -p "$D" "$DEST" "$TOOLS"

command -v node >/dev/null || { echo "props.sh: node is required" >&2; exit 1; }

# our_id  polyhaven_id  max_texture_px  [keep=<node,...>: drop the other root nodes]  [scale=<k>: unit fix]
#   [simplify=<ratio>: decimate an over-dense scan to about that fraction of its triangles (meshoptimizer)]
PROPS=(
  # Ch1 flat
  "crt_tv                Television_01               1024"
  "sofa_worn             sofa_03                     1024"
  "iron_bed              old_bed_frame               1024  simplify=0.12"
  "cardboard_box         cardboard_box_01            1024  simplify=0.15"
  "trash_bag             trashbag                    512"
  "wrist_watch           digital_wrist_watch         1024  simplify=0.3"
  "steel_shelves         steel_frame_shelves_01      1024  scale=0.1"
  "fluoro_light          mounted_fluorescent_lights  512   keep=mounted_fluorescent_lights_d"
  # Ch4 workshop (and the Ch5 open workshop)
  "bench_vice            bench_vice_01               1024"
  "spanner               combination_wrench          512"
  "drill                 Drill_01                    512"
  "hammer                cross_pein_hammer           512"
  "handsaw               handsaw_wood                512"
  "pliers                pliers                      512"
  "screwdriver           screwdriver                 512"
  "tape_measure          measuring_tape_01           512"
  "paint_can             can_rusted                  512"
  "oil_can               small_oil_can_01            512"
  "toolbox               metal_toolbox               1024"
  "stool                 wooden_stool_01             1024"
  "stepladder            wooden_ladder               1024"
  "bulb                  lightbulb_01                512"
  "track_pump            tire_pump                   512"
  "radio                 boombox                     512"
  # Ch2 / Ch5 street
  "bin_metal             metal_trash_can             1024  keep=metal_trash_can_rust,metal_trash_can_rust_lid,metal_trash_can_rust_handle_left,metal_trash_can_rust_handle_right"
  "barrel                barrel_03                   1024"
  "crate_wood            wooden_crate_01             1024"
  "milk_crate            plastic_crate_01            1024"
  "cafe_set              outdoor_table_chair_set_01  1024"
  "chair_painted         painted_wooden_chair_01     1024"
  # Ch3 run route
  "road_barrier          concrete_road_barrier_02    1024"
)

# ---- Packing toolchain (installed only into .cache/tools/props-pack, never into package.json)
if [[ ! -d "$TOOLS/node_modules/@gltf-transform/functions" || ! -d "$TOOLS/node_modules/sharp" || ! -d "$TOOLS/node_modules/meshoptimizer" ]]; then
  echo "  installing gltf-transform + sharp into .cache/tools/props-pack"
  [[ -f "$TOOLS/package.json" ]] || echo '{ "name": "props-pack", "private": true, "type": "module" }' > "$TOOLS/package.json"
  (cd "$TOOLS" && npm install --silent --no-audit --no-fund \
    @gltf-transform/core@4.5.1 @gltf-transform/extensions@4.5.1 @gltf-transform/functions@4.5.1 sharp@0.35.5 meshoptimizer@0.25.0) \
    || { echo "props.sh: npm install of the packing tools failed" >&2; exit 1; }
fi

# Repacks one Poly Haven glTF into a GLB under a single root node named <id>.
# Args: <id> <src.gltf> <out.glb> <maxTexturePx> <stats.json> <keepNodesCsv|-> <scale> <simplifyRatio|->
cat > "$TOOLS/pack.mjs" <<'EOF'
import { writeFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, getBounds, weld, simplify } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const [id, src, out, maxPx, statsPath, keepCsv, scale, ratio] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const root = doc.getRoot();
const scene = root.getDefaultScene() ?? root.listScenes()[0];

// Variant collections (two bins, seven light fittings...): keep only the listed root nodes.
if (keepCsv !== '-') {
  const keep = new Set(keepCsv.split(','));
  const missing = [...keep].filter((n) => !scene.listChildren().some((c) => c.getName() === n));
  if (missing.length) throw new Error(`keep: no root node named ${missing.join(', ')}`);
  for (const n of scene.listChildren()) if (!keep.has(n.getName())) n.dispose();
}
const wrap = doc.createNode(id).setScale([+scale, +scale, +scale]);
for (const n of scene.listChildren()) {
  scene.removeChild(n);
  wrap.addChild(n);
}
scene.addChild(wrap);

// Normal maps keep more JPEG quality and full chroma; colour / ARM maps go to q80.
const normals = new Set(root.listMaterials().map((m) => m.getNormalTexture()).filter(Boolean));
for (const tex of root.listTextures()) {
  const n = normals.has(tex);
  const img = await sharp(tex.getImage())
    .resize({ width: +maxPx, height: +maxPx, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: n ? 90 : 80, mozjpeg: true, chromaSubsampling: n ? '4:4:4' : '4:2:0' })
    .toBuffer();
  tex.setImage(img).setMimeType('image/jpeg').setURI(tex.getURI().replace(/\.\w+$/, '.jpg'));
}
// Over-dense scans (a 50k-triangle bed frame, 17k for a cardboard box) are decimated: they cast
// shadows from two lights in the Ch1 flat. The error bound keeps silhouettes (1% of the mesh size).
if (ratio !== '-') {
  await MeshoptSimplifier.ready;
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: +ratio, error: 0.01 }));
}
await doc.transform(dedup(), prune());

let tris = 0;
for (const node of root.listNodes()) {
  for (const p of node.getMesh()?.listPrimitives() ?? []) {
    tris += Math.round((p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3);
  }
}
const b = getBounds(scene);
const r = (v) => v.map((x) => Math.round(x * 1000) / 1000);
await io.write(out, doc);
writeFileSync(statsPath, JSON.stringify({
  tris,
  size: r(b.max.map((x, i) => x - b.min[i])),
  min: r(b.min),
  max: r(b.max),
  nodes: wrap.listChildren().map((n) => n.getName()),
  materials: root.listMaterials().map((m) => m.getName()),
  textures: root.listTextures().length,
}));
EOF

# Lists "<relative path>\t<url>\t<bytes>" for the 1k glTF of a Poly Haven files.json.
list_files() {
  node -e '
    const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const g = d?.gltf?.["1k"]?.gltf;
    if (!g?.url) { console.error("no gltf/1k entry"); process.exit(2); }
    console.log([g.url.split("/").pop(), g.url, g.size].join("\t"));
    for (const [p, f] of Object.entries(g.include ?? {})) console.log([p, f.url, f.size].join("\t"));
  ' "$1"
}

SHIP=()
for row in "${PROPS[@]}"; do
  read -r id ph px opts <<<"$row"
  keep=-; scale=1; simp=-
  for o in $opts; do
    case "$o" in keep=*) keep="${o#keep=}" ;; scale=*) scale="${o#scale=}" ;; simplify=*) simp="${o#simplify=}" ;; *) echo "props.sh: bad option $o" >&2; exit 1 ;; esac
  done
  SHIP+=("$id.glb")
  dir="$D/$ph"
  mkdir -p "$dir"
  if [[ ! -s "$dir/files.json" ]]; then
    curl -fsSL -A "$UA" "$API/files/$ph" -o "$dir/files.json.tmp" \
      || { echo "props.sh: Poly Haven API failed for '$ph' ($API/files/$ph)" >&2; exit 1; }
    mv "$dir/files.json.tmp" "$dir/files.json"
  fi
  listing="$(list_files "$dir/files.json")" \
    || { echo "props.sh: Poly Haven files.json for '$ph' has no 1k glTF (API changed?)" >&2; exit 1; }
  gltf=""
  while IFS=$'\t' read -r rel url size; do
    f="$dir/$rel"
    [[ -z "$gltf" ]] && gltf="$f"
    if [[ ! -s "$f" || "$(wc -c <"$f" | tr -d ' ')" != "$size" ]]; then
      echo "  downloading $ph/$rel"
      mkdir -p "$(dirname "$f")"
      curl -fsSL -A "$UA" "$url" -o "$f.tmp" || { echo "props.sh: download failed: $url" >&2; exit 1; }
      mv "$f.tmp" "$f"
    fi
  done <<<"$listing"

  recipe="v$PACK_VERSION $ph $px $keep $scale $simp"
  stamp="$dir/.packed-$id"
  if [[ -s "$DEST/$id.glb" && -s "$dir/stats-$id.json" && "$(cat "$stamp" 2>/dev/null)" == "$recipe" ]]; then
    continue
  fi
  echo "  packing $id <- $ph (${px}px)"
  node "$TOOLS/pack.mjs" "$id" "$gltf" "$dir/$id.glb" "$px" "$dir/stats-$id.json" "$keep" "$scale" "$simp" \
    || { echo "props.sh: packing $ph failed" >&2; exit 1; }
  cp "$dir/$id.glb" "$DEST/$id.glb"
  echo "$recipe" >"$stamp"
done

# Ship only what is listed: drop anything else (older recipes, stray files) from public/assets/props.
for f in "$DEST"/*; do
  [[ -e "$f" ]] || continue
  b="$(basename "$f")"
  [[ " ${SHIP[*]} " == *" $b "* ]] || { echo "  removing stale $b"; rm -rf "$f"; }
done

# props.json (a catalogue for authors, never loaded by the game, so it stays in the download cache):
# { our_id: { file, source, licence, tris, size[m], min, max, nodes, materials, kb } }
ROWS="$(printf '%s\n' "${PROPS[@]}")" node -e '
  const fs = require("fs"), path = require("path");
  const [D, DEST] = process.argv.slice(1);
  const out = {};
  for (const row of process.env.ROWS.trim().split("\n")) {
    const [id, ph, px] = row.trim().split(/\s+/);
    const s = JSON.parse(fs.readFileSync(path.join(D, ph, `stats-${id}.json`), "utf8"));
    const kb = Math.round(fs.statSync(path.join(DEST, `${id}.glb`)).size / 1024);
    out[id] = { file: `props/${id}.glb`, source: `https://polyhaven.com/a/${ph}`, licence: "CC0", texturePx: +px, kb, ...s };
  }
  fs.writeFileSync(path.join(D, "props.json"), JSON.stringify(out, null, 1) + "\n");
' "$D" "$DEST"

echo "  props: ${#PROPS[@]} GLBs, $(du -sh "$DEST" | cut -f1) in public/assets/props"
