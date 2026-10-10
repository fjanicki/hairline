"""Round 2: LibriVox French readers outside CML-TTS (recorded after MLS was built), found through LibriVox books by
Québec authors. Recordings are in the public domain (archive.org: Public Domain Mark 1.0). Runs on auriga
(venv-qa).

  venv-qa/bin/python bin/lv_scan.py windows READER URL [URL..]   # original MP3 -> 15 s speech windows
        -> data/lvx/<reader>/<file>_<k>.wav (native rate), quality-measured into work/lvx/quality.json
  then, as for the other sources: accent_id.py on data/lvx/, qa_remote.py --wavs (gender / age / ECAPA)
  venv-qa/bin/python bin/lv_scan.py ref READER [KEY..]           # reference from the best windows -> refs2/lvx_<reader>.wav

Windows start 30 s into each file (skipping the LibriVox preamble) and are cut at pauses (energy minima).
"""
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
import quality as Q  # noqa: E402

D = Path.home() / "hairline-clone"
WORK = D / "work/lvx"
WORK.mkdir(parents=True, exist_ok=True)


def windows(reader, *urls, per_file=6, length=15.0):
    out = D / "data/lvx" / reader
    out.mkdir(parents=True, exist_ok=True)
    mp3d = D / "data/lv_mp3"
    mp3d.mkdir(parents=True, exist_ok=True)
    qp = WORK / "quality.json"
    res = json.loads(qp.read_text()) if qp.exists() else {}
    for url in urls:
        mp3 = mp3d / url.split("/")[-1]
        if not mp3.exists():
            urllib.request.urlretrieve(url, mp3.with_suffix(".part"))
            mp3.with_suffix(".part").rename(mp3)
        wav = mp3.with_suffix(".wav")
        if not wav.exists():
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(mp3), "-ac", "1", str(wav)], check=True)
        y, sr = sf.read(wav, dtype="float32")
        hop = int(sr * 0.01)
        rms = librosa.feature.rms(y=y, frame_length=hop * 3, hop_length=hop)[0]
        start, total = int(30 * sr), len(y)
        span = max(1, (total - start - int(length * sr)) // per_file)
        for k in range(per_file):
            a = start + k * span
            b = a + int(length * sr)
            if b > total:
                break
            # move both ends to the quietest frame within +-0.5 s (a pause)
            def snap(x):
                i = x // hop
                lo, hi = max(0, i - 50), min(len(rms), i + 50)
                return (lo + int(np.argmin(rms[lo:hi]))) * hop if hi > lo else x
            a, b = snap(a), snap(b)
            seg = y[a:b]
            name = f"{mp3.stem}_{k}"
            sf.write(out / f"{name}.wav", seg, sr, subtype="PCM_16")
            m = Q.measure(seg, sr)
            m["q"] = Q.qscore(m)
            m["src"] = url
            m["t"] = [round(a / sr, 2), round(b / sr, 2)]
            res[f"{reader}/{name}"] = m
        qp.write_text(json.dumps(res))
        print(reader, mp3.name, flush=True)
    cs = sorted(m["q"] for k, m in res.items() if k.startswith(reader + "/"))
    print(reader, len(cs), "q top4", round(float(np.mean(cs[-4:])), 3))


def ref(reader, *keys, max_s=15.0):
    res = json.loads((WORK / "quality.json").read_text())
    ks = list(keys) or [max(((m["q"], k) for k, m in res.items() if k.startswith(reader + "/")))[1].split("/")[1]]
    ys, sr = [], None
    for k in ks:
        y, sr = sf.read(D / "data/lvx" / reader / f"{k}.wav", dtype="float32")
        ys += [y, np.zeros(int(sr * 0.3), np.float32)]
    y = np.concatenate(ys)[: int(sr * max_s)]
    y, _ = librosa.effects.trim(y, top_db=35)
    y = y * (10 ** (-20 / 20) / (np.sqrt(np.mean(y ** 2)) + 1e-9))
    sf.write(D / "refs2" / f"lvx_{reader}.wav", np.clip(y, -0.99, 0.99), sr, subtype="PCM_16")
    (D / "refs2" / f"lvx_{reader}.json").write_text(json.dumps({"windows": ks, "src": [res[f"{reader}/{k}"]["src"] for k in ks],
                                                               "t": [res[f"{reader}/{k}"]["t"] for k in ks]}, indent=1))
    print(reader, ks, round(len(y) / sr, 2), "s")


if __name__ == "__main__":
    {"windows": windows, "ref": ref}[sys.argv[1]](*sys.argv[2:])
