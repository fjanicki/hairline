"""Whisper transcripts of generated takes on auriga (ROCm), so the per-take QA of engine=chatterbox speakers does not
use the Mac's GPU. Runs in ~/hairline-clone/venv-qa (transformers, torch ROCm), started by auriga_cb.sh.

  venv-qa/bin/python bin/asr_remote.py <dir of .wav> <out.json>

Writes {"<file name>": transcript} for every .wav in the dir (skips names already in out.json). The decoding is
scripts/voice/qa.py asr() on transformers instead of mlx-whisper: openai/whisper-large-v3 (same weights), French,
greedy, 0.4 s / 0.3 s of padding, and words lying entirely in the padding dropped. generate.py then scores the
transcript on the Mac with qa.cer() (CPU), the same as a Mac transcript.
"""
import json
import sys
from pathlib import Path

import librosa
import numpy as np
import torch

src, out = Path(sys.argv[1]), Path(sys.argv[2])
res = json.loads(out.read_text()) if out.exists() else {}
todo = [f for f in sorted(src.glob("*.wav")) if not f.name.endswith(".tmp.wav") and f.name not in res]
print(f"asr: {len(todo)} of {len(res) + len(todo)} files", flush=True)
if todo:
    from transformers import pipeline
    pipe = pipeline("automatic-speech-recognition", model="openai/whisper-large-v3", dtype=torch.float16,
                    device="cuda:0" if torch.cuda.is_available() else "cpu")


def asr(y16: np.ndarray) -> str:
    dur = len(y16) / 16000
    y = np.concatenate([np.zeros(6400, np.float32), y16.astype(np.float32), np.zeros(4800, np.float32)])
    r = pipe({"raw": y, "sampling_rate": 16000}, return_timestamps="word",
             generate_kwargs={"language": "fr", "task": "transcribe", "num_beams": 1})
    ws = r.get("chunks") or []
    if not ws:
        return r["text"].strip()
    keep = []
    for w in ws:
        s, e = w["timestamp"]
        e = e if e is not None else s + 0.3
        if e - 0.4 > 0.03 and s - 0.4 < dur - 0.03:
            keep.append(w["text"])
    return "".join(keep).strip()


for n, f in enumerate(todo):
    y16, _ = librosa.load(str(f), sr=16000, mono=True)
    res[f.name] = asr(y16)
    print(f"[{n + 1}/{len(todo)}] {f.name} | {res[f.name]}", flush=True)
    if n % 10 == 0:
        out.write_text(json.dumps(res, ensure_ascii=False, indent=0))
out.write_text(json.dumps(res, ensure_ascii=False, indent=0))
print(f"wrote {out} ({len(res)})", flush=True)
