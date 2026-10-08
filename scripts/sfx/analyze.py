#!/usr/bin/env python3
"""Inspect source audio for slicing: duration, level, a coarse RMS envelope and transient onsets.

Usage: .cache/sfx/venv/bin/python -I scripts/sfx/analyze.py [--env 1.0] [--onsets] [--thresh 12] file...
"""
import sys
import numpy as np
import soundfile as sf

def load_mono(path):
    x, sr = sf.read(path, always_2d=True, dtype="float32")
    return x.mean(axis=1), sr, x.shape[1]

def db(v):
    return 20 * np.log10(np.maximum(v, 1e-9))

def onsets(m, sr, thresh_db=12.0, hop=0.005, min_gap=0.12):
    """Peaks where the 5 ms envelope jumps thresh_db above the median of the previous 150 ms."""
    h = int(sr * hop)
    n = len(m) // h
    env = np.sqrt((m[: n * h].reshape(n, h) ** 2).mean(axis=1))
    e = db(env)
    w = int(0.15 / hop)
    out, last = [], -1e9
    for i in range(w, n):
        base = np.median(e[i - w : i])
        if e[i] - base > thresh_db and i * hop - last > min_gap and e[i] > -55:
            j = i + int(np.argmax(e[i : i + 10]))
            out.append((j * hop, e[j]))
            last = i * hop
    return out

def main(argv):
    env_step, do_on, thr = 1.0, False, 12.0
    files = []
    it = iter(argv)
    for a in it:
        if a == "--env": env_step = float(next(it))
        elif a == "--onsets": do_on = True
        elif a == "--thresh": thr = float(next(it))
        else: files.append(a)
    for f in files:
        m, sr, ch = load_mono(f)
        dur = len(m) / sr
        print(f"== {f}  {dur:.1f}s sr{sr} ch{ch} peak {db(np.abs(m).max()):.1f} dBFS rms {db(np.sqrt((m**2).mean())):.1f}")
        if env_step > 0:
            h = int(sr * env_step)
            n = len(m) // h
            r = db(np.sqrt((m[: n * h].reshape(n, h) ** 2).mean(axis=1)))
            print("  env:", " ".join(f"{v:.0f}" for v in r))
        if do_on:
            o = onsets(m, sr, thr)
            print(f"  onsets ({len(o)}):", " ".join(f"{t:.2f}@{v:.0f}" for t, v in o[:80]))

if __name__ == "__main__":
    main(sys.argv[1:])
