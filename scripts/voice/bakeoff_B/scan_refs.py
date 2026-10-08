"""Extract candidate reference speakers from Common Voice fr (CC0) and MLS fr (CC-BY 4.0)
and measure F0 / voice quality / UTMOSv2 so voices can be chosen without listening.

usage: evalvenv/bin/python -I scan_refs.py <B_dir>
writes <B_dir>/cand/<src>_<id>/NN.wav (24 kHz mono, trimmed) and <B_dir>/cand/scan.json
"""
import sys, os, io, json, csv, tarfile, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, soundfile as sf, librosa, pandas as pd
import metrics as M

B = os.path.abspath(sys.argv[1])
OUT = os.path.join(B, "cand"); os.makedirs(OUT, exist_ok=True)
random.seed(0)
SR = 24000

def save_clip(y, sr, path):
    y = librosa.resample(y.astype(np.float32), orig_sr=sr, target_sr=SR) if sr != SR else y.astype(np.float32)
    y, _ = librosa.effects.trim(y, top_db=35)
    if len(y) < SR * 1.5:
        return False
    y = y / (np.max(np.abs(y)) + 1e-9) * 0.7
    sf.write(path, y, SR)
    return True

# --------------------------------------------------------------- Common Voice
want_cv = {("seventies", "female_feminine"): 99, ("eighties", "female_feminine"): 99,
           ("sixties", "female_feminine"): 12, ("teens", "female_feminine"): 99,
           ("teens", "male_masculine"): 99, ("fifties", "female_feminine"): 8,
           ("fifties", "male_masculine"): 6, ("fourties", "male_masculine"): 6,
           ("thirties", "male_masculine"): 6}
sel = {}
for sp in ["dev", "test", "other"]:
    df = pd.read_csv(os.path.join(B, f"data/cv/transcript/fr/{sp}.tsv"), sep="\t", quoting=csv.QUOTE_NONE, low_memory=False)
    df = df[df.client_id.notna()]
    for (age, g), grp in df.groupby(["age", "gender"]):
        if (age, g) not in want_cv:
            continue
        clients = list(grp.client_id.unique())
        # prefer clients with more clips (more material, usually better set-ups)
        clients.sort(key=lambda c: -int((grp.client_id == c).sum()))
        for c in clients[: want_cv[(age, g)]]:
            rows = grp[grp.client_id == c]
            if len(rows) < 3:
                continue
            key = c[:10]
            if key in sel:
                continue
            sel[key] = {"src": "cv", "split": sp, "age": age, "gender": g,
                        "paths": list(rows.path)[:8], "sentences": list(rows.sentence)[:8]}
print("cv candidates", len(sel), flush=True)

EXTRACTED = os.path.exists(os.path.join(OUT, ".extracted"))
need = {}
for k, v in (sel.items() if not EXTRACTED else []):
    for p in v["paths"]:
        need[f"fr_{v['split']}_0/{p}"] = k
for sp in (["dev", "test", "other"] if not EXTRACTED else []):
    with tarfile.open(os.path.join(B, f"data/cv/audio/fr/{sp}/fr_{sp}_0.tar")) as tf:
        for m in tf:
            if m.name in need and m.isfile():
                k = need[m.name]
                d = os.path.join(OUT, "cv_" + k); os.makedirs(d, exist_ok=True)
                data = tf.extractfile(m).read()
                y, sr = librosa.load(io.BytesIO(data), sr=None, mono=True)
                n = len([f for f in os.listdir(d) if f.endswith(".wav")])
                save_clip(y, sr, os.path.join(d, f"{n:02d}.wav"))

# --------------------------------------------------------------- MLS
gender = {}
for line in open(os.path.join(B, "data/mls/data/mls_french/metainfo.txt"), encoding="utf-8").readlines()[1:]:
    f = [x.strip() for x in line.split("|")]
    if len(f) > 2:
        gender[f[0]] = f[1]
import pyarrow.parquet as pq
for sp in ["dev", "test"]:
    t = pq.read_table(os.path.join(B, f"data/mls/french/{sp}-00000-of-00001.parquet"),
                      columns=["audio", "speaker_id", "transcript", "audio_duration"]).to_pandas()
    for spk, grp in t.groupby("speaker_id"):
        grp = grp[(grp.audio_duration > 6) & (grp.audio_duration < 16)].head(6)
        key = "mls_" + spk
        d = os.path.join(OUT, key); os.makedirs(d, exist_ok=True)
        for i, (_, r) in enumerate(grp.iterrows() if not EXTRACTED else []):
            y, sr = sf.read(io.BytesIO(r.audio["bytes"]))
            save_clip(y if y.ndim == 1 else y.mean(1), sr, os.path.join(d, f"{i:02d}.wav"))
        sel[spk] = {"src": "mls", "split": sp, "gender": gender.get(spk, "?"), "sentences": list(grp.transcript)}

open(os.path.join(OUT, ".extracted"), "w").close()
# --------------------------------------------------------------- measure
res = {}
for key in sorted(os.listdir(OUT)):
    d = os.path.join(OUT, key)
    if not os.path.isdir(d):
        continue
    clips = sorted(f for f in os.listdir(d) if f.endswith(".wav"))
    if not clips:
        continue
    vs = [M.voice_stats(os.path.join(d, c)) for c in clips]
    mos = [M.mos(os.path.join(d, c)) for c in clips[:1]]
    meta = sel.get(key[3:] if key.startswith("cv_") else key[4:], {})
    res[key] = {"meta": {k: v for k, v in meta.items() if k not in ("paths",)},
                "n": len(clips),
                "dur": float(sum(sf.info(os.path.join(d, c)).duration for c in clips)),
                "f0_med": float(np.median([v["f0_med"] for v in vs])),
                "jitter": float(np.median([v.get("jitter", 0) for v in vs])),
                "shimmer": float(np.median([v.get("shimmer", 0) for v in vs])),
                "hnr": float(np.median([v.get("hnr", 0) for v in vs])),
                "mos": float(np.mean(mos))}
    r = res[key]
    print(f"{key:18s} {meta.get('age','-'):9s} {str(meta.get('gender','-'))[:6]:6s} n={r['n']} dur={r['dur']:.0f}s "
          f"f0={r['f0_med']:.0f} jit={r['jitter']*100:.2f}% shim={r['shimmer']*100:.1f}% hnr={r['hnr']:.1f} mos={r['mos']:.2f}", flush=True)
json.dump(res, open(os.path.join(OUT, "scan.json"), "w"), indent=1, ensure_ascii=False)
