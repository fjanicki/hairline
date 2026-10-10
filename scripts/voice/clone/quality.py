"""Audio-quality measures for cloning references (and their clones). Runs on auriga in ~/hairline-clone/venv-qa
(CPU is enough: DNSMOS is a small ONNX model). Used by cv_scan.py / cml_scan.py, and as a CLI:

  venv-qa/bin/python bin/quality.py out.json file.wav|dir/ ...

Per file:
  dnsmos   Microsoft DNSMOS P.835 (sig = speech quality, bak = background, ovr = overall) and P.808, via the
           `speechmos` package (MIT; models from microsoft/DNS-Challenge, MIT). 16 kHz, so it cannot see above 8 kHz.
  bw       effective bandwidth (Hz): the highest frequency where the long-term speech spectrum is within 50 dB of
           its 300-3000 Hz level (MP3 low-pass and narrow mics show up here).
  presence level of 2-5 kHz relative to 100-1000 Hz (dB, long-term speech spectrum): low = dull / muffled.
  air      level of 6-10 kHz relative to 100-1000 Hz (dB).
  snr      speech/noise ratio (dB): 90th / 10th percentile of 10 ms frame RMS.
  dr       direct-to-reverberant proxy (dB): median energy drop 50 ms after the end of each loud frame run
           (dry rooms decay fast). Rough; only for comparing clips of the same kind.
  lufs     integrated loudness (pyloudnorm).
"""
import json
import sys
from pathlib import Path

import librosa
import numpy as np


def ltas(y, sr, nfft=2048):
    """Long-term average spectrum (dB) over the speech-active frames."""
    S = np.abs(librosa.stft(y, n_fft=nfft, hop_length=nfft // 4)) ** 2
    e = S.sum(0)
    act = e > np.percentile(e, 50) if e.size > 4 else np.ones_like(e, bool)
    p = S[:, act].mean(1) + 1e-20
    f = librosa.fft_frequencies(sr=sr, n_fft=nfft)
    return f, 10 * np.log10(p)


def band(f, db, lo, hi):
    m = (f >= lo) & (f < hi)
    return float(10 * np.log10(np.mean(10 ** (db[m] / 10)))) if m.any() else float("nan")


def bandwidth(f, db, drop=50.0):
    ref = band(f, db, 300, 3000)
    sm = np.convolve(db, np.ones(9) / 9, mode="same")
    ok = np.where((sm > ref - drop) & (f > 1000))[0]
    return float(f[ok[-1]]) if ok.size else 0.0


def snr(y, sr):
    hop = int(sr * 0.01)
    rms = librosa.feature.rms(y=y, frame_length=hop * 3, hop_length=hop)[0] + 1e-7
    return float(20 * np.log10(np.percentile(rms, 90) / np.percentile(rms, 10)))


def dr_proxy(y, sr):
    hop = int(sr * 0.01)
    rms = librosa.feature.rms(y=y, frame_length=hop * 3, hop_length=hop)[0] + 1e-9
    db = 20 * np.log10(rms)
    loud = db > np.percentile(db, 80) - 6
    drops = []
    for i in range(1, len(db) - 6):
        if loud[i - 1] and not loud[i]:
            drops.append(db[i - 1] - db[i + 5])
    return float(np.median(drops)) if drops else float("nan")


_dns = None


def dnsmos(y16):
    from speechmos import dnsmos as D
    if len(y16) < 16000 * 9.1:  # DNSMOS needs 9.01 s: loop short clips (as the reference script does)
        y16 = np.tile(y16, int(np.ceil(16000 * 9.1 / max(len(y16), 1))))
    pk = float(np.max(np.abs(y16))) if len(y16) else 1.0
    r = D.run((y16 / pk * 0.99 if pk > 0.99 else y16).astype(np.float32), sr=16000)
    return {"sig": round(float(r["sig_mos"]), 3), "bak": round(float(r["bak_mos"]), 3),
            "ovr": round(float(r["ovrl_mos"]), 3), "p808": round(float(r["p808_mos"]), 3)}


def lufs(y, sr):
    import pyloudnorm as pyln
    try:
        return round(float(pyln.Meter(sr).integrated_loudness(y)), 1)
    except Exception:
        return None


def measure(y, sr, with_dnsmos=True):
    """y: mono float32 at its native rate (do not upsample first: bandwidth is measured on it)."""
    y = y.astype(np.float32)
    f, db = ltas(y, sr)
    lo = band(f, db, 100, 1000)
    r = {"sr": sr, "dur": round(len(y) / sr, 2), "bw": round(bandwidth(f, db)),
         "presence": round(band(f, db, 2000, 5000) - lo, 1),
         "air": round(band(f, db, 6000, min(10000, sr / 2)) - lo, 1) if sr > 12500 else None,
         "snr": round(snr(y, sr), 1), "dr": round(dr_proxy(y, sr), 1), "lufs": lufs(y, sr)}
    if with_dnsmos:
        r["dnsmos"] = dnsmos(librosa.resample(y, orig_sr=sr, target_sr=16000) if sr != 16000 else y)
    return r


def qscore(m):
    """One number to rank recordings by quality: DNSMOS overall, plus bandwidth and presence credit."""
    d = m.get("dnsmos") or {}
    bw = min(m.get("bw", 0), 12000)
    return round(d.get("ovr", 0) + 0.5 * d.get("sig", 0) + (bw - 8000) / 8000 + 0.02 * (m.get("presence", -30) + 20)
                 + 0.01 * min(m.get("snr", 0), 60), 3)


if __name__ == "__main__":
    import soundfile as sf
    out = Path(sys.argv[1])
    res = json.loads(out.read_text()) if out.exists() else {}
    for a in sys.argv[2:]:
        p = Path(a)
        for fp in (sorted(p.glob("*.wav")) + sorted(p.glob("*.ogg")) if p.is_dir() else [p]):
            y, sr = sf.read(fp, dtype="float32", always_2d=True)
            m = measure(y.mean(1), sr)
            m["q"] = qscore(m)
            res[str(fp)] = m
            print(fp.name, json.dumps(m), flush=True)
    out.write_text(json.dumps(res, indent=1))
