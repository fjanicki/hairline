"""Bake delivery processing + loudness into a TTS take.

usage: evalvenv/bin/python -I post.py in.wav out.wav <delivery> [--pitch_ratio r] [--formant_ratio f]
deliveries: spoken | bark | inner | voicemail | tv | flashback
target: 48 kHz mono, -19 LUFS (spoken/bark/tv/flashback), -23 (inner), -21 (voicemail),
        true peak <= -1.5 dBTP, <= 120 ms head/tail silence.
"""
import sys, os, subprocess, tempfile, argparse
import numpy as np, soundfile as sf, librosa, pyloudnorm as pyln
from scipy.signal import resample_poly

ap = argparse.ArgumentParser()
ap.add_argument("inp"); ap.add_argument("out"); ap.add_argument("delivery")
ap.add_argument("--pitch_ratio", type=float, default=1.0)
ap.add_argument("--formant_ratio", type=float, default=1.0)
a = ap.parse_args()

SR = 48000
TARGET = {"inner": -23.0, "voicemail": -21.0}.get(a.delivery, -19.0)
FX = {
    "spoken":    "highpass=f=70,acompressor=threshold=-20dB:ratio=2:attack=10:release=120,"
                 "aecho=0.9:0.9:9|17:0.05|0.03",
    "bark":      "highpass=f=80,acompressor=threshold=-18dB:ratio=2.5:attack=8:release=100,"
                 "aecho=0.9:0.9:11|23:0.07|0.04",
    "inner":     "highpass=f=90,lowpass=f=6000,equalizer=f=220:t=q:w=1:g=2,"
                 "acompressor=threshold=-24dB:ratio=2:attack=15:release=150,aecho=0.85:0.8:13|27:0.12|0.07",
    "voicemail": "highpass=f=300,highpass=f=300,lowpass=f=3400,lowpass=f=3400,"
                 "acompressor=threshold=-26dB:ratio=4:attack=5:release=80,"
                 "aresample=8000,acrusher=bits=10:mode=log:mix=0.35,aresample=48000",
    "tv":        "highpass=f=110,lowpass=f=9000,equalizer=f=2800:t=q:w=1.2:g=3,"
                 "acompressor=threshold=-22dB:ratio=3.5:attack=5:release=90",
    "flashback": "highpass=f=90,lowpass=f=7500,aecho=0.8:0.7:35|61|97:0.22|0.15|0.09",
}[a.delivery]

y, sr = sf.read(a.inp, always_2d=True); y = y.mean(1).astype(np.float32)
y = librosa.resample(y, orig_sr=sr, target_sr=SR)

if a.pitch_ratio != 1.0 or a.formant_ratio != 1.0:
    import parselmouth
    from parselmouth.praat import call
    snd = parselmouth.Sound(y.astype(np.float64), SR)
    pitch = snd.to_pitch_ac(0.01, 60, 600); f = pitch.selected_array["frequency"]; med = float(np.median(f[f > 0]))
    snd = call(snd, "Change gender", 60, 600, a.formant_ratio, med * a.pitch_ratio, 1.0, 1.0)
    y = snd.values[0].astype(np.float32)

def trim(x, pad=0.1):
    hop = int(0.01 * SR)
    rms = np.sqrt(np.convolve(x ** 2, np.ones(hop) / hop, mode="same") + 1e-12)
    db = 20 * np.log10(rms + 1e-9); thr = db.max() - 45
    idx = np.where(db > thr)[0]
    if not len(idx):
        return x
    s = max(0, idx[0] - int(pad * SR)); e = min(len(x), idx[-1] + int(pad * SR))
    out = x[s:e].copy(); f = int(0.008 * SR)
    out[:f] *= np.linspace(0, 1, f); out[-f:] *= np.linspace(1, 0, f)
    return out

y = trim(y)
with tempfile.TemporaryDirectory() as td:
    i, o = os.path.join(td, "i.wav"), os.path.join(td, "o.wav")
    # pad the tail so echoes are not cut, they are trimmed again afterwards
    sf.write(i, np.concatenate([y, np.zeros(int(0.3 * SR), np.float32)]), SR, subtype="FLOAT")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", i, "-af", FX, "-ar", str(SR), "-ac", "1", "-c:a", "pcm_f32le", o], check=True)
    y, _ = sf.read(o); y = y.astype(np.float32)
y = trim(y, pad=0.1)

meter = pyln.Meter(SR, block_size=0.4 if len(y) > 0.5 * SR else 0.2)
def tp(x):
    return 20 * np.log10(np.max(np.abs(resample_poly(x, 4, 1))) + 1e-12)
def limit(x, ceil_db):
    # simple look-ahead peak limiter on the 4x-oversampled envelope
    c = 10 ** (ceil_db / 20); up = np.abs(resample_poly(x, 4, 1)); env = up.reshape(-1, 4).max(1) if len(up) >= 4 * len(x) else np.abs(x)
    env = env[: len(x)]
    g = np.minimum(1.0, c / (env + 1e-12))
    win = int(0.004 * SR)  # 4 ms look-ahead / hold, then smooth release
    from scipy.ndimage import minimum_filter1d
    gm = minimum_filter1d(g, size=2 * win + 1).astype(np.float32)
    rel = np.exp(-1 / (0.05 * SR)); out = np.empty_like(gm); cur = 1.0
    for k, v in enumerate(gm):
        cur = v if v < cur else v + (cur - v) * rel
        out[k] = cur
    return x * out
for _ in range(4):
    L = meter.integrated_loudness(y)
    y = y * 10 ** ((TARGET - L) / 20)
    if tp(y) > -1.6:
        y = limit(y, -2.0)
    if abs(meter.integrated_loudness(y) - TARGET) < 0.3 and tp(y) <= -1.5:
        break
os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
sf.write(a.out, y, SR, subtype="PCM_16")
print(f"{os.path.basename(a.out)} {a.delivery} LUFS={meter.integrated_loudness(y):.1f} TP={tp(y):.1f} dur={len(y)/SR:.2f}")
