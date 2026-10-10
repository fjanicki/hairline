"""Chatterbox Multilingual (Resemble AI, MIT) zero-shot cloning worker, run on auriga in ~/hairline-clone/venv-cb.

  venv-cb/bin/python bin/cb_worker.py jobs.json out_dir/ [--t3 v3] [--device cuda]

jobs.json: [{"key": str, "ref": wav path on this host, "text": str, "lang": "fr", "seed": int, "takes": n,
             "exaggeration": 0.5, "cfg_weight": 0.5, "temperature": 0.8}]
Writes out_dir/<key>.t<i>.wav (24 kHz mono, take i uses seed + 100 * i), skipping files that exist; a take is
written to .tmp.wav and renamed, so a killed run leaves no truncated file. Jobs are grouped by reference so the
speaker conditioning (voice-encoder embedding + 6 s of prompt tokens + 10 s decoder reference) is built once per
reference. Output carries Resemble's Perth imperceptible watermark, as every Chatterbox output does.
Also the game pipeline's worker for engine=chatterbox speakers (generate.py -> scripts/voice/remote/auriga_cb.sh).
"""
import argparse
import json
import os
import random
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

ap = argparse.ArgumentParser()
ap.add_argument("jobs")
ap.add_argument("out")
ap.add_argument("--t3", default="v3", help="multilingual T3 checkpoint: v3 (t3_mtl23ls_v3) or v2")
ap.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
args = ap.parse_args()

out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)
jobs = json.load(open(args.jobs))
todo = [(j, i) for j in jobs for i in range(j.get("takes", 1)) if not (out / f"{j['key']}.t{i}.wav").exists()]
print(f"chatterbox: {len(todo)} takes to make ({sum(j.get('takes', 1) for j in jobs)} in jobs)", flush=True)
if not todo:
    sys.exit(0)

from chatterbox.mtl_tts import ChatterboxMultilingualTTS  # noqa: E402

t0 = time.time()
model = ChatterboxMultilingualTTS.from_pretrained(device=args.device, t3_model=args.t3)
print(f"model loaded in {time.time() - t0:.0f} s on {args.device} (t3 {args.t3})", flush=True)


def seed_all(s):
    random.seed(s)
    np.random.seed(s)
    torch.manual_seed(s)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(s)


cur_ref = None
audio_s = gen_s = 0.0
for n, (j, i) in enumerate(sorted(todo, key=lambda ji: (ji[0]["ref"], ji[0]["key"], ji[1]))):
    ex = float(j.get("exaggeration", 0.5))
    if j["ref"] != cur_ref:
        model.prepare_conditionals(j["ref"], exaggeration=ex)
        cur_ref = j["ref"]
    seed_all(int(j.get("seed", 1)) + 100 * i)
    t = time.time()
    with torch.inference_mode():
        wav = model.generate(j["text"], language_id=j.get("lang", "fr"), exaggeration=ex,
                             cfg_weight=float(j.get("cfg_weight", 0.5)), temperature=float(j.get("temperature", 0.8)))
    dt = time.time() - t
    y = wav.squeeze(0).cpu().numpy().astype(np.float32)
    dst = out / f"{j['key']}.t{i}.wav"
    tmp = dst.with_suffix(".tmp.wav")
    sf.write(tmp, y, model.sr, subtype="PCM_16")
    os.replace(tmp, dst)
    audio_s += len(y) / model.sr
    gen_s += dt
    print(f"[{n + 1}/{len(todo)}] {dst.name} {len(y) / model.sr:.1f} s audio in {dt:.1f} s", flush=True)
print(f"done: {audio_s:.0f} s of audio in {gen_s:.0f} s (RTF {gen_s / max(audio_s, 1e-6):.2f})", flush=True)
