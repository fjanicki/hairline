#!/usr/bin/env python3
"""Check built SFX: decode each .ogg back (ffmpeg), report LUFS, true peak, and for loops the wrap
discontinuity (|last->first step| vs the 99th percentile of sample steps; ~1 or below is seamless).
Usage: .cache/sfx/venv/bin/python -I scripts/sfx/verify.py <public/assets/sfx>
"""
import json, os, subprocess, sys
import numpy as np, pyloudnorm as pyln
from scipy.signal import resample_poly

d = sys.argv[1]
man = json.load(open(os.path.join(d, "sfx.json")))
M = pyln.Meter(48000)
bad = 0
for name, v in man.items():
    for f in v["files"]:
        raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", os.path.join(d, f), "-f", "f32le", "-ac", str(v["channels"]), "-ar", "48000", "-"], capture_output=True, check=True).stdout
        x = np.frombuffer(raw, np.float32).reshape(-1, v["channels"])
        tp = 20 * np.log10(np.abs(resample_poly(x, 4, 1, axis=0)).max() + 1e-12)
        y = x if len(x) >= 19200 else np.vstack([x, np.zeros((19200 - len(x), x.shape[1]), np.float32)])
        lu = M.integrated_loudness(y)
        note = ""
        if v["loop"]:
            steps = np.abs(np.diff(x, axis=0)).max(axis=1)
            wrap = np.abs(x[0] - x[-1]).max()
            ratio = wrap / (np.percentile(steps, 99) + 1e-9)
            note = f" wrap={ratio:.2f}"
            if ratio > 1.5: note += " !SEAM"; bad += 1
        flag = " !TP" if tp > -0.95 else ""
        bad += bool(flag)
        print(f"{f:28s} {len(x)/48000:6.2f}s int {lu:6.1f} LUFS  tp {tp:5.1f}{flag}{note}  {os.path.getsize(os.path.join(d, f))//1024} KB")
print("problems:", bad)
