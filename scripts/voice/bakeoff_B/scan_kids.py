"""Extract boy speakers (age 9-12) from speechocean762 (Apache-2.0) as timbre references for Sami."""
import sys, os, io, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, soundfile as sf, librosa, pyarrow.parquet as pq
import metrics as M
B = os.path.abspath(sys.argv[1]); OUT = os.path.join(B, "cand")
t = pq.read_table(os.path.join(B, "data/so762/data/train-00000-of-00001.parquet"), columns=["audio", "speaker", "gender", "age", "text", "fluency", "total"]).to_pandas()
print(t.groupby(["gender", "age"]).speaker.nunique().to_string())
boys = t[(t.age >= 9) & (t.age <= 12) & (t.gender.str.lower().str.startswith("m"))]
for spk, g in boys.groupby("speaker"):
    g = g.sort_values("total", ascending=False).head(10)
    d = os.path.join(OUT, f"so_{spk}"); os.makedirs(d, exist_ok=True)
    for i, (_, r) in enumerate(g.iterrows()):
        y, sr = sf.read(io.BytesIO(r.audio["bytes"])); y = y if y.ndim == 1 else y.mean(1)
        y = librosa.resample(y.astype(np.float32), orig_sr=sr, target_sr=24000)
        y, _ = librosa.effects.trim(y, top_db=35); y = y / (np.abs(y).max() + 1e-9) * 0.7
        sf.write(os.path.join(d, f"{i:02d}.wav"), y, 24000)
    clips = sorted(f for f in os.listdir(d) if f.endswith(".wav"))
    vs = [M.voice_stats(os.path.join(d, c)) for c in clips]
    print(f"so_{spk} age={g.age.iloc[0]} n={len(clips)} dur={sum(sf.info(os.path.join(d,c)).duration for c in clips):.0f}s "
          f"f0={np.median([v['f0_med'] for v in vs]):.0f} hnr={np.median([v.get('hnr',0) for v in vs]):.1f} "
          f"mos={M.mos(os.path.join(d, clips[0])):.2f} fluency={g.fluency.mean():.1f} | {g.text.iloc[0][:50]}", flush=True)
