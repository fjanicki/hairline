import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, soundfile as sf, metrics as M
OUT = sys.argv[1]; pref = sys.argv[2]
g = {}
for line in open(sys.argv[3], encoding="utf-8").readlines()[1:]:
    f = [x.strip() for x in line.split("|")]
    if len(f) > 5: g.setdefault(f[0], (f[1], f[5]))
for k in sorted(os.listdir(OUT)):
    if not k.startswith(pref): continue
    d = os.path.join(OUT, k); clips = sorted(c for c in os.listdir(d) if c.endswith(".wav"))
    vs = [M.voice_stats(os.path.join(d, c)) for c in clips]
    sp = k.split("_", 1)[1]
    print(f"{k:12s} {g.get(sp,('?',''))[0]} n={len(clips)} f0={np.median([v['f0_med'] for v in vs]):.0f} "
          f"p10-90={np.median([v['f0_p10'] for v in vs]):.0f}-{np.median([v['f0_p90'] for v in vs]):.0f} "
          f"jit={np.median([v.get('jitter',0) for v in vs])*100:.2f}% hnr={np.median([v.get('hnr',0) for v in vs]):.1f} | {g.get(sp,('',''))[1][:40]}")
