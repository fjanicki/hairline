"""Build a ~10 s reference clip from candidate clips: make_ref.py <cand_dir> <out.wav> [clip,clip,...] [--secs 10]"""
import sys, os, numpy as np, soundfile as sf, pyloudnorm as pyln
d, out = sys.argv[1], sys.argv[2]
sel = sys.argv[3].split(",") if len(sys.argv) > 3 and sys.argv[3] != "-" else None
secs = float(sys.argv[4]) if len(sys.argv) > 4 else 10.5
clips = sorted(c for c in os.listdir(d) if c.endswith(".wav"))
if sel: clips = [f"{int(s):02d}.wav" for s in sel]
parts, tot = [], 0
for c in clips:
    y, sr = sf.read(os.path.join(d, c)); assert sr == 24000
    parts += [y, np.zeros(int(0.25 * sr))]; tot += len(y) / sr
    if tot >= secs: break
y = np.concatenate(parts[:-1]).astype(np.float32)
m = pyln.Meter(24000); y = y * 10 ** ((-20 - m.integrated_loudness(y)) / 20)
y = y / max(1.0, np.abs(y).max() / 0.95)
os.makedirs(os.path.dirname(out), exist_ok=True); sf.write(out, y, 24000)
print(out, f"{len(y)/24000:.1f}s")
