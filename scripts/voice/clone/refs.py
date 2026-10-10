"""Reference clips for zero-shot cloning: adult women with a Québec accent from Mozilla Common Voice French (CC0).
Runs on auriga (venv-qa). Source: the Common Voice shard the R4 accent calibration already downloaded
(~/hairline-tts/accent/calib/qc0.parquet: 8400 clips tagged « Français du Canada » / « Québécois »), restricted to
the 30 women of the calibration set (calib/qc/f_<speaker prefix>.wav) so the speakers are ones the three accent
classifiers already scored as Canadian.

  venv-qa/bin/python bin/refs.py --parquet ~/hairline-tts/accent/calib/qc0.parquet \
      --calib ~/hairline-tts/accent/calib/qc --out refs/

For each woman in her twenties, thirties or forties (Common Voice self-reported age band), every clip with
up_votes >= 2 and no down vote is decoded and scored: speech/noise ratio (90th / 10th percentile frame RMS),
bandwidth (99 % spectral roll-off), clipping. The best clips are joined (0.3 s gaps, best first: Chatterbox
conditions on the first 6 s / 10 s) to 12-15 s at 24 kHz, -20 dBFS RMS -> refs/<prefix>.wav, refs/refs.json.
Speakers stay anonymous: only the hashed Common Voice speaker prefix is kept, never a name or the sentence.
"""
import argparse
import io
import json
from pathlib import Path

import librosa
import numpy as np
import pyarrow.parquet as pq
import soundfile as sf

ap = argparse.ArgumentParser()
ap.add_argument("--parquet", required=True)
ap.add_argument("--calib", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--ages", default="twenties,thirties,fourties")
ap.add_argument("--min-s", type=float, default=12.0)
ap.add_argument("--max-s", type=float, default=15.0)
args = ap.parse_args()

SR = 24000
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)
women = {p.name[2:12] for p in Path(args.calib).glob("f_*.wav")}
ages = set(args.ages.split(","))
rows = [r for r in pq.read_table(args.parquet).to_pylist()
        if r["speaker_id"][:10] in women and r["gender"] == "female_feminine" and r["age"] in ages
        and (r["up_votes"] or 0) >= 2 and not (r["down_votes"] or 0) and "États-Unis" not in (r["accents"] or "")]
by = {}
for r in rows:
    by.setdefault(r["speaker_id"][:10], []).append(r)


def score(y):
    hop = int(SR * 0.01)
    rms = librosa.feature.rms(y=y, frame_length=hop * 3, hop_length=hop)[0] + 1e-7
    snr = float(20 * np.log10(np.percentile(rms, 90) / np.percentile(rms, 10)))
    roll = float(np.median(librosa.feature.spectral_rolloff(y=y, sr=SR, roll_percent=0.99)))
    clip = float(np.mean(np.abs(y) > 0.985))
    return snr, roll, clip


meta = {}
for spk, rs in sorted(by.items()):
    clips = []
    for r in rs[:40]:
        try:
            y, sr = sf.read(io.BytesIO(r["audio"]["bytes"]), dtype="float32", always_2d=True)
        except Exception:
            continue
        y = librosa.resample(y.mean(1), orig_sr=sr, target_sr=SR)
        y, _ = librosa.effects.trim(y, top_db=35, frame_length=1024, hop_length=256)
        if len(y) < SR * 2.5:
            continue
        snr, roll, clip = score(y)
        # clean = high speech/noise ratio, full band (roll-off > 7 kHz), no clipping
        q = snr + (0 if roll > 7000 else -15) - 400 * clip
        clips.append((q, snr, roll, clip, len(y) / SR, y))
    if not clips:
        continue
    clips.sort(key=lambda c: -c[0])
    sel, tot = [], 0.0
    for c in clips:
        if tot >= args.min_s:
            break
        if tot + c[4] > args.max_s + 2:
            continue
        sel.append(c)
        tot += c[4] + 0.3
    gap = np.zeros(int(SR * 0.3), np.float32)
    y = np.concatenate([x for c in sel for x in (c[5], gap)])[: int(SR * args.max_s)]
    y = y * (10 ** (-20 / 20) / (np.sqrt(np.mean(y ** 2)) + 1e-9))
    y = np.clip(y, -0.99, 0.99)
    sf.write(out / f"{spk}.wav", y, SR, subtype="PCM_16")
    meta[spk] = {"age": rs[0]["age"], "accents": rs[0]["accents"], "clips_available": len(rs),
                 "clips_used": len(sel), "dur": round(len(y) / SR, 2),
                 "snr_db": round(float(np.mean([c[1] for c in sel])), 1),
                 "rolloff_hz": round(float(np.mean([c[2] for c in sel]))),
                 "clip_frac": round(float(np.mean([c[3] for c in sel])), 5),
                 "source": "Mozilla Common Voice French (CC0), speaker " + spk}
    print(spk, meta[spk])
(out / "refs.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
print(len(meta), "references in", out)
