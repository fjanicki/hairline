"""Kyutai TTS 1.6B en_fr (PyTorch / ROCm) batch generator for the auriga worker.

Mirrors the Mac MLX driver (.cache/tts/A/tools/gen.py): temp 0.6, cfg 2.0 (CFG-distilled
conditioning), initial_padding 2, max_padding 8, final_padding 2, padding_bonus 0, n_q 32, bf16,
same text prep as A/tools/prep.py and the same per-character voices (voices_A.json).

usage: kyutai_gen.py jobs.json outdir [--batch 8] [--max-sec 60] [--only-model A]

jobs.json: list of {"key", "model": "A", "speaker", "text", "voice"?, "cfg"?, "temp"?,
                    "padding_bonus"?, "padding_between"?, "initial_padding"?, "seed"?, "takes"?, "prep"?}
Output: outdir/<key>.wav (takes == 1) or outdir/<key>.t<k>.wav, 24 kHz mono 16-bit.
Resumable: an item whose WAV exists is skipped; WAVs are written to .tmp then renamed.
Stats: one JSON line per WAV appended to outdir/_stats.jsonl.
"""
import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import numpy as np
import sphn
import torch

HERE = Path(__file__).resolve().parent


def prep(t: str) -> str:  # == .cache/tts/A/tools/prep.py
    t = t.replace("’", "'")
    t = t.replace("…", "... ")
    t = re.sub(r"\b([A-ZÀ-ÖØ-Þ]{2,})\b", lambda m: m.group(1).capitalize(), t)
    return re.sub(r"\s+", " ", t).strip()


ap = argparse.ArgumentParser()
ap.add_argument("jobs")
ap.add_argument("outdir")
ap.add_argument("--batch", type=int, default=32, help="items generated together on the GPU")
ap.add_argument("--max-sec", type=float, default=60.0, help="hard cap on generated audio per item")
ap.add_argument("--voices", default=str(HERE / "voices_A.json"))
ap.add_argument("--shard", default="0/1", help="i/n: only process items with index %% n == i")
args = ap.parse_args()

voices = json.load(open(args.voices))
jobs = [j for j in json.load(open(args.jobs)) if j.get("model", "A") == "A"]
out = Path(args.outdir)
out.mkdir(parents=True, exist_ok=True)
shard_i, shard_n = (int(x) for x in args.shard.split("/"))

# Expand takes into items, skip existing.
items = []
for j in jobs:
    takes = int(j.get("takes", 1))
    for k in range(takes):
        name = f"{j['key']}.wav" if takes == 1 else f"{j['key']}.t{k}.wav"
        items.append(dict(job=j, take=k, path=out / name))
items = [it for idx, it in enumerate(items) if idx % shard_n == shard_i]
todo = [it for it in items if not it["path"].exists()]
print(f"[kyutai] {len(items)} items in shard, {len(items) - len(todo)} already done, {len(todo)} to do",
      file=sys.stderr, flush=True)
if not todo:
    sys.exit(0)

from moshi.models.loaders import CheckpointInfo  # noqa: E402
from moshi.models.tts import DEFAULT_DSM_TTS_REPO, TTSModel  # noqa: E402

t_load = time.time()
ckpt = CheckpointInfo.from_hf_repo(DEFAULT_DSM_TTS_REPO)
tts = TTSModel.from_checkpoint_info(ckpt, n_q=32, temp=0.6, device="cuda", dtype=torch.bfloat16,
                                    initial_padding=2, max_padding=8, final_padding=2)
tts.max_gen_length = int(args.max_sec * tts.mimi.frame_rate) + tts.delay_steps + 16
print(f"[kyutai] model loaded in {time.time() - t_load:.1f}s on {torch.cuda.get_device_name(0)}",
      file=sys.stderr, flush=True)
SR = tts.mimi.sample_rate


def gen_params(j):
    return (float(j.get("temp", 0.6)), float(j.get("padding_bonus", 0.0)), int(j.get("initial_padding", 2)))


def voice_of(j):
    v = j.get("voice") or voices[j["speaker"]]
    if v.endswith(".safetensors") and os.path.isfile(v):  # uploaded local embedding
        return Path(v)
    return tts.get_voice_path(v)


# Items in one batch must share temp/padding_bonus (model-level params); group, then sort by length
# so batch members finish at similar steps (a batch runs until its longest item is done).
groups = {}
for it in todo:
    groups.setdefault(gen_params(it["job"]), []).append(it)

stats_f = open(out / "_stats.jsonl", "a")
torch.cuda.reset_peak_memory_stats()
for (temp, pbonus, ipad), its in groups.items():
    tts.temp, tts.padding_bonus = temp, pbonus
    tts.machine.initial_padding = ipad  # padding tokens before the first word (default 2)
    its.sort(key=lambda it: len(it["job"]["text"]))
    for b0 in range(0, len(its), args.batch):
        batch = its[b0:b0 + args.batch]
        texts = [prep(it["job"]["text"]) if it["job"].get("prep", True) else it["job"]["text"] for it in batch]
        entries = [tts.prepare_script([t], padding_between=int(it["job"].get("padding_between", 0)))
                   for t, it in zip(texts, batch)]
        attrs = [tts.make_condition_attributes([voice_of(it["job"])], float(it["job"].get("cfg", 2.0)))
                 for it in batch]
        j0 = batch[0]["job"]
        torch.manual_seed(int(j0.get("seed", 1)) + 7919 * batch[0]["take"])
        torch.cuda.synchronize()
        t0 = time.time()
        res = tts.generate(entries, attrs, cfg_is_no_prefix=False, cfg_is_no_text=False)
        frames = res.frames
        n_tot = len(frames)
        ends = res.end_steps
        max_end = max(e for e in ends if e is not None) if any(e is not None for e in ends) else None
        with tts.mimi.streaming(len(batch)), torch.no_grad():
            pcm = torch.cat([tts.mimi.decode(f[:, 1:, :]) for f in frames[tts.delay_steps:]], dim=-1)
        pcm = pcm.float().clamp(-1, 1).cpu().numpy()[:, 0]
        torch.cuda.synchronize()
        dt = time.time() - t0
        spf = SR / tts.mimi.frame_rate
        wavs = []
        for b, it in enumerate(batch):
            if ends[b] is None:  # did not finish within max_gen_length
                n_b = n_tot
            else:
                n_b = n_tot - (max_end - ends[b]) if max_end is not None else n_tot
            wavs.append(pcm[b, : int(max(0, n_b - tts.delay_steps) * spf)])
        tot_dur = sum(len(w) for w in wavs) / SR
        for b, it in enumerate(batch):
            w = wavs[b]
            tmp = it["path"].with_suffix(".tmp.wav")
            sphn.write_wav(str(tmp), w, SR)
            os.replace(tmp, it["path"])
            dur = len(w) / SR
            rec = dict(key=it["job"]["key"], take=it["take"], file=it["path"].name, text=texts[b],
                       dur_s=round(dur, 3), batch=len(batch), batch_gen_s=round(dt, 3),
                       batch_audio_s=round(tot_dur, 3), rtf_batch=round(dt / max(tot_dur, 1e-3), 4),
                       rtf_item_wall=round(dt / max(dur, 1e-3), 4), finished=ends[b] is not None,
                       peak_alloc_gb=round(torch.cuda.max_memory_allocated() / 2**30, 3),
                       peak_reserved_gb=round(torch.cuda.max_memory_reserved() / 2**30, 3))
            stats_f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            stats_f.flush()
        print(f"[kyutai] batch {len(batch)}: {tot_dur:.1f}s audio in {dt:.1f}s (RTF {dt / max(tot_dur, 1e-3):.3f}),"
              f" peak {torch.cuda.max_memory_reserved() / 2**30:.2f} GB", file=sys.stderr, flush=True)
print("[kyutai] DONE", file=sys.stderr, flush=True)
