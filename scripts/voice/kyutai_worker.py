"""Persistent Kyutai TTS 1.6B en_fr worker on MLX (Apple Silicon), batched.

Adapted from kyutai-labs/delayed-streams-modeling scripts/tts_mlx.py (MIT/Apache).
Run with the moshi-mlx venv:  nice -n 10 .cache/tts/A/venv/bin/python -I scripts/voice/kyutai_worker.py
Protocol (JSON lines):
  stdin : {"seed": int, "temp": 0.6, "initialPadding": 2, "items": [{"id": str, "text": str, "voice": "<tts-voices path>",
           "cfg": 2.0, "out": "/abs/raw.wav"}, ...]}
  stdout: {"ok": true, "gen_s": float, "items": [{"id", "out", "dur", "ended": bool}]}
          or {"ok": false, "error": str}
A batch shares one RNG seed; items in a batch may use different voices and cfg values.
The 24 kHz mono WAV written for each item is cut at the model's end step + final padding.
"""
import json
import sys
import time

import mlx.core as mx
import mlx.nn as nn  # noqa: F401
import numpy as np
import sentencepiece
import sphn
from moshi_mlx import models
from moshi_mlx.models.tts import DEFAULT_DSM_TTS_REPO, DEFAULT_DSM_TTS_VOICE_REPO, TTSModel
from moshi_mlx.utils.loaders import hf_get

# Memory guard: a watchdog kills Python processes above 64 GB. Keep MLX's buffer cache small
# and clear it after every batch.
mx.set_cache_limit(4 << 30)
mx.set_memory_limit(40 << 30)


def log(*a):
    print(*a, file=sys.stderr, flush=True)


raw_config = json.load(open(hf_get(hf_get("config.json", DEFAULT_DSM_TTS_REPO))))
mimi_w = hf_get(raw_config["mimi_name"], DEFAULT_DSM_TTS_REPO)
moshi_w = hf_get(raw_config.get("moshi_name", "model.safetensors"), DEFAULT_DSM_TTS_REPO)
tok = hf_get(raw_config["tokenizer_name"], DEFAULT_DSM_TTS_REPO)
lm_config = models.LmConfig.from_config_dict(raw_config)
lm_config.transformer.max_seq_len = lm_config.transformer.context
model = models.Lm(lm_config)
model.set_dtype(mx.bfloat16)
model.load_pytorch_weights(str(moshi_w), lm_config, strict=True)
text_tokenizer = sentencepiece.SentencePieceProcessor(str(tok))
mimi = models.mimi.Mimi(models.mimi_202407(lm_config.generated_codebooks))
mimi.load_pytorch_weights(str(mimi_w), strict=True)

tts = TTSModel(model, mimi, text_tokenizer, voice_repo=DEFAULT_DSM_TTS_VOICE_REPO, temp=0.6,
               cfg_coef=1.0, max_padding=8, initial_padding=2, final_padding=2,
               padding_bonus=0.0, raw_config=raw_config)
assert tts.valid_cfg_conditionings, "expected a CFG-distilled checkpoint"
tts.max_gen_length = 12.5 * 40  # 40 s hard cap per batch
tts.max_gen_length = int(tts.max_gen_length)
FRAME = int(mimi.sample_rate / mimi.frame_rate)
log("worker ready", mimi.sample_rate, FRAME)
print(json.dumps({"ready": True}), flush=True)


def run(req):
    items = req["items"]
    tts.temp = float(req.get("temp", 0.6))
    # padding tokens before the first word (moshi default 2). More lets the voice start from silence
    # instead of mid-phoneme at the first decoded frame (clipped first consonant / stray leading syllable).
    tts.machine.initial_padding = int(req.get("initialPadding", 2))
    mx.random.seed(int(req.get("seed", 1)))
    entries = [tts.prepare_script([it["text"]]) for it in items]
    attrs = [tts.make_condition_attributes([tts.get_voice_path(it["voice"])], float(it.get("cfg", 2.0)))
             for it in items]
    B = len(items)
    pcm = [[] for _ in range(B)]
    tts.mimi.reset_all()

    def on_frame(frame):
        if (frame == -1).any():
            return
        p = tts.mimi.decode_step(frame[:, :, None])  # [B, 1, FRAME]
        p = np.array(mx.clip(p[:, 0], -1, 1).astype(mx.float32))
        for b in range(B):
            pcm[b].append(p[b])

    t0 = time.time()
    res = tts.generate(entries, attrs, cfg_is_no_prefix=False, cfg_is_no_text=False, on_frame=on_frame)
    dt = time.time() - t0
    out = []
    for b, it in enumerate(items):
        wav = np.concatenate(pcm[b], -1) if pcm[b] else np.zeros(FRAME, np.float32)
        end = res.end_steps[b]
        if end is not None:
            wav = wav[: FRAME * (end + tts.final_padding)]
        sphn.write_wav(it["out"], wav, mimi.sample_rate)
        out.append({"id": it["id"], "out": it["out"], "dur": len(wav) / mimi.sample_rate, "ended": end is not None})
    mx.clear_cache()
    return {"ok": True, "gen_s": dt, "items": out}


for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        r = run(json.loads(line))
    except Exception as e:  # report and keep serving
        import traceback
        traceback.print_exc()
        mx.clear_cache()
        r = {"ok": False, "error": repr(e)}
    print(json.dumps(r), flush=True)
