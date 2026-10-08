"""Measure takes / finals for the bake-off.

usage:
  evalvenv/bin/python -I evaluate.py takes  <testset.json> <raw_dir> <out.json>      # ASR+CER+MOS+F0 for every take
  evalvenv/bin/python -I evaluate.py finals <testset.json> <final_dir> <raw_sel_dir> <out.json>
"""
import sys, os, json, re, itertools
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, soundfile as sf
import metrics as M

mode = sys.argv[1]
lines = json.load(open(sys.argv[2]))
byn = {str(l["n"]): l for l in lines}

def tail_cut(path):
    """energy in the final 40 ms relative to the loudest 40 ms (high = ends mid-phoneme)."""
    y, sr = sf.read(path, always_2d=True); y = y.mean(1)
    w = int(0.04 * sr); fr = [np.sqrt(np.mean(y[i:i + w] ** 2) + 1e-12) for i in range(0, len(y) - w, w)]
    return float(20 * np.log10(fr[-1] / max(fr)))

def measure(path, text, full=True):
    hyp, _ = M.asr(path)
    r = {"hyp": hyp, "cer": M.cer(text, hyp), "wer": M.wer(text, hyp),
         "dur": sf.info(path).duration, "mos": M.mos(path)}
    r.update({k: v for k, v in M.voice_stats(path).items() if k in ("f0_med", "f0_p10", "f0_p90", "jitter", "hnr", "f0_mean_semitone_sd")})
    if full:
        r.update(M.formant_spacing(path))
        hyp_auto, lang = M.asr(path, language=None)
        r["lang_detected"] = lang
        r["tail_db"] = tail_cut(path)
    return r

if mode == "takes":
    raw, out = sys.argv[3], sys.argv[4]
    res = json.load(open(out)) if os.path.exists(out) else {}
    for f in sorted(os.listdir(raw)):
        if not f.endswith(".wav") or f[:-4] in res:
            continue
        n = f.split("-")[0]
        if n not in byn:
            continue
        res[f[:-4]] = measure(os.path.join(raw, f), byn[n]["text"], full=False)
        r = res[f[:-4]]
        print(f"{f[:-4]:22s} cer={r['cer']:.3f} mos={r['mos']:.2f} f0={r['f0_med']:.0f} | {r['hyp']}", flush=True)
        json.dump(res, open(out, "w"), indent=1, ensure_ascii=False)
    sys.exit()

final, rawsel, out = sys.argv[3], sys.argv[4], sys.argv[5]
res = json.load(open(out)) if os.path.exists(out) else {"lines": {}}
embs = {}
for l in lines:
    n, ch = str(l["n"]), l["character"]
    fp = os.path.join(final, f"{n}-{ch}.wav")
    if not os.path.exists(fp):
        fp = os.path.join(final, "extra", f"{n}-{ch}.wav")
    if not os.path.exists(fp):
        continue
    rp0 = os.path.join(rawsel, f"{n}-{ch}.wav")
    if n in res["lines"] and res["lines"][n].get("mtime") == os.path.getmtime(fp):
        embs[n] = M.spk_emb(rp0 if os.path.exists(rp0) else fp)
        continue
    r = measure(fp, l["text"])
    r["mtime"] = os.path.getmtime(fp)
    rp = os.path.join(rawsel, f"{n}-{ch}.wav")
    r["mos_raw"] = M.mos(rp) if os.path.exists(rp) else None
    r["f0_raw"] = M.voice_stats(rp)["f0_med"] if os.path.exists(rp) else None
    embs[n] = M.spk_emb(rp if os.path.exists(rp) else fp)
    res["lines"][n] = {"character": l.get("voice", ch), "delivery": l.get("delivery"), "text": l["text"], **r}
    print(f"{n:>3} {ch:8s} cer={r['cer']:.3f} mos={r['mos']:.2f}/{(r['mos_raw'] or 0):.2f} f0={r['f0_med']:.0f} "
          f"lang={r['lang_detected']} tail={r['tail_db']:.0f}dB | {r['hyp']}", flush=True)
    json.dump(res, open(out, "w"), indent=1, ensure_ascii=False)

# distinctness: cosine between lines (ECAPA on the un-processed selected take)
keys = sorted(embs)
S = {a: {b: float(np.dot(embs[a], embs[b])) for b in keys} for a in keys}
chars = {}
for k in keys:
    chars.setdefault(res["lines"][k]["character"], []).append(k)
intra = {c: [S[a][b] for a, b in itertools.combinations(v, 2)] for c, v in chars.items() if len(v) > 1}
inter = {}
for c1, c2 in itertools.combinations(sorted(chars), 2):
    inter[f"{c1}|{c2}"] = float(np.mean([S[a][b] for a in chars[c1] for b in chars[c2]]))
res["sim_matrix"] = S
res["intra"] = intra
res["inter"] = inter
json.dump(res, open(out, "w"), indent=1, ensure_ascii=False)

print("\nintra-character consistency (cos, higher=better):")
for c, v in intra.items():
    print(f"  {c:8s} {np.round(v, 3).tolist()}")
iv = sorted(inter.items(), key=lambda kv: -kv[1])
print(f"inter-character cos: mean={np.mean([v for _, v in iv]):.3f} max={iv[0][1]:.3f} ({iv[0][0]})")
for k, v in iv[:6]:
    print(f"  {k:20s} {v:.3f}")
print("\nmean CER", np.mean([r["cer"] for r in res["lines"].values()]),
      "mean MOS(final)", np.mean([r["mos"] for r in res["lines"].values()]),
      "mean MOS(raw)", np.mean([r["mos_raw"] for r in res["lines"].values() if r["mos_raw"]]))
