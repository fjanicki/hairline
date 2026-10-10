#!/usr/bin/env python3
"""Print the docs/assets/sfx.md catalogue table from scripts/sfx/recipes.json + public/assets/sfx/sfx.json.
Usage: python3 -I scripts/sfx/catalogue.py <root>
"""
import json, os, sys

root = sys.argv[1] if len(sys.argv) > 1 else "."
spec = json.load(open(os.path.join(root, "scripts/sfx/recipes.json")))
gp = os.path.join(root, "scripts/sfx/recipes-gen.json")
if os.path.exists(gp):  # generated set (scripts/sfx/generate.py)
    g = json.load(open(gp))
    spec["sources"].update(g["sources"])
    spec["recipes"] += g["recipes"]
man = json.load(open(os.path.join(root, "public/assets/sfx/sfx.json")))
PACKS = {
    "rpg": ("https://kenney.nl/assets/rpg-audio", "CC0 (Kenney)"),
    "impact": ("https://kenney.nl/assets/impact-sounds", "CC0 (Kenney)"),
    "moresounds": ("https://opengameart.org/content/202-more-sound-effects", "CC0 (owlishmedia, OpenGameArt)"),
    "pencil": ("https://opengameart.org/content/pencil-sounds", "CC0 (antumdeluge, OpenGameArt; from Freesound #443241, #571800)"),
    "breathing": ("https://opengameart.org/content/breathing-tired", "CC0 (mikeask, OpenGameArt)"),
    "synth": ("scripts/sfx/synth.py", "CC0 (synthesised for this project)"),
}

def source_cell(r):
    srcs = [r["src"]] + [m["src"] for m in r.get("mix", [])] + [p["src"] for p in r.get("parts", [])]
    out, lic = [], set()
    for s in dict.fromkeys(srcs):
        meta = spec["sources"].get(s, {})
        if meta.get("pack") == "gen":
            files = r.get("files") or [s]
            out.append(f"generated: {meta['model']} (`generate.py`), prompt \"{meta['prompt']}\"; picked takes "
                       + ", ".join(f"{spec['sources'][f]['take'][:-4]} (CLAP {spec['sources'][f]['clap']:.2f})" for f in files))
            lic.add("TangoFlux weights: non-commercial research (Stability AI Community + WavCaps academic)")
            break
        if "id" in meta:
            out.append(f"[BBC {meta['id']}](https://sound-effects.bbcrewind.co.uk/search?q={meta['id']}) {meta['desc']}")
            lic.add("BBC RemArc (personal/educational)")
        elif meta.get("pack") == "synth":
            files = r.get("files") or [s]
            out.append(f"synthesised: `scripts/sfx/synth.py` `{meta['fn']}()`, {meta['desc']}")
            lic.add(PACKS["synth"][1])
        else:
            url, l = PACKS[meta["pack"]]
            files = r.get("files") or [s]
            out.append(f"[{os.path.basename(os.path.dirname(url + '/'))}]({url}) `{', '.join(os.path.basename(f) for f in files)}`")
            lic.add(l)
    return "<br>".join(out), "; ".join(sorted(lic))

print("| File | What | Chapter / beat | Replaces | Loop | Bus / volume / filter | Source | Licence |")
print("|---|---|---|---|---|---|---|---|")
for r in spec["recipes"]:
    v = man.get(r["name"], {})
    files = v.get("files", [])
    fcell = f"`{files[0]}`" if len(files) == 1 else f"`{r['name']}_01..{len(files):02d}.ogg`"
    dur = v.get("detail", [{}])[0].get("dur")
    fcell += f"<br>{len(files)} x {dur:.2f} s, ch{v.get('channels')}, {r['cat']}" if dur else ""
    src, lic = source_cell(r)
    print(f"| {fcell} | {r['what']} | {r['ch']} | {r['replaces']} | {'yes' if v.get('loop') else 'no'} | {r['bus']} | {src} | {lic} |")
