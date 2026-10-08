"""Pick the best take per line (lowest CER, then highest MOS) and bake delivery processing.

usage: evalvenv/bin/python -I select_post.py <plan.json> <raw_dir> <takes.json> <rawsel_dir> <final_dir> <extra_dir>
Lines with a purely numeric n go to <final_dir>/<n>-<character>.wav; variants/probes go to <extra_dir>.
Also writes <rawsel_dir>/selection.json with first-take and best-of-N CER.
"""
import sys, os, json, shutil, subprocess
plan_p, raw, takes_p, rawsel, final, extra = sys.argv[1:7]
plan = json.load(open(plan_p)); takes = json.load(open(takes_p))
POST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "post.py")
for d in (rawsel, final, extra):
    os.makedirs(d, exist_ok=True)
sel = {}
for ln in plan["lines"]:
    n, ch = str(ln["n"]), ln["character"]
    cands = sorted((k for k in takes if k.startswith(f"{n}-{ch}-t")), key=lambda k: int(k.rsplit("t", 1)[1]))
    if not cands:
        continue
    best = min(cands, key=lambda k: (round(takes[k]["cer"], 3), -takes[k]["mos"]))
    sel[n] = {"character": ch, "first": cands[0], "first_cer": takes[cands[0]]["cer"], "best": best,
              "best_cer": takes[best]["cer"], "best_mos": takes[best]["mos"], "n_takes": len(cands),
              "all_cer": [round(takes[k]["cer"], 3) for k in cands]}
    shutil.copy(os.path.join(raw, best + ".wav"), os.path.join(rawsel, f"{n}-{ch}.wav"))
    v = plan["voices"][ln.get("voice", ch)]
    out = os.path.join(final if n.isdigit() else extra, f"{n}-{ch}.wav")
    args = [sys.executable, "-I", POST, os.path.join(raw, best + ".wav"), out, ln.get("delivery", "spoken")]
    for k, val in v.get("post", {}).items():
        args += [f"--{k}", str(val)]
    subprocess.run(args, check=True)
json.dump(sel, open(os.path.join(rawsel, "selection.json"), "w"), indent=1)
