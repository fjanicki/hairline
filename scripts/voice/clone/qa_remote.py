"""Take QA on auriga (ROCm) for the voice-clone audition: the same measures as audition_r4.py `analyse`, without the
Mac's GPU. Runs in ~/hairline-clone/venv-qa next to a copy of scripts/voice/qa.py and .cache/tts/A/tools/agegender.py.

  venv-qa/bin/python bin/qa_remote.py --items items.json [--wavs dir/] --centroids centroids.json --out qa.json

items.json: [{"wav": path, "text": reference text (or null: no ASR)}]. Per file it writes:
  asr, cer       Whisper large-v3 (openai/whisper-large-v3 via transformers, fp16, French, greedy), with qa.py's
                 0.4 s / 0.3 s padding and word-timestamp filter; CER by qa.cer() (shared normalisation)
  f0             Praat median pitch (60-500 Hz)
  age, pFemale   audeering/wav2vec2-large-robust-24-ft-age-gender (CC-BY-NC-SA-4.0, QA only)
  ecapa          cosine to each cast centroid (SpeechBrain ECAPA, VoxCeleb), emb = the take's embedding
  sig            qa.signal_stats() (lead, trail, span, tail_db, letters/s)
Whisper on ROCm differs slightly from the Mac's mlx-whisper (same weights): fine for ranking, see docs/voice.md §13.
"""
import argparse
import json
import sys
from pathlib import Path

import librosa
import numpy as np
import torch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import qa  # noqa: E402  (copy of scripts/voice/qa.py: norm, cer, f0_median, ecapa, signal_stats)

ap = argparse.ArgumentParser()
ap.add_argument("--items", help="json list of {wav, text}")
ap.add_argument("--wavs", nargs="*", default=[], help="extra wav files or dirs, scored without ASR")
ap.add_argument("--centroids", required=True)
ap.add_argument("--out", required=True)
args = ap.parse_args()

items = json.load(open(args.items)) if args.items else []
for w in args.wavs:
    p = Path(w)
    items += [{"wav": str(f), "text": None} for f in (sorted(p.glob("*.wav")) if p.is_dir() else [p])]
cen = {k: np.array(v) for k, v in json.load(open(args.centroids)).items()}
out = Path(args.out)
res = json.loads(out.read_text()) if out.exists() else {}
todo = [it for it in items if it["wav"] not in res]
print(f"qa: {len(todo)} of {len(items)} files", file=sys.stderr)

if todo:
    from transformers import pipeline
    asr_pipe = pipeline("automatic-speech-recognition", model="openai/whisper-large-v3", dtype=torch.float16,
                        device="cuda:0")
    from agegender import AgeGender
    ag = AgeGender(device="cuda")


_enc = None


def ecapa(y16: np.ndarray) -> np.ndarray:
    """qa.ecapa() with the encoder on the GPU (SpeechBrain moves it there on ROCm) and the result copied back."""
    global _enc
    if _enc is None:
        from speechbrain.inference.speaker import EncoderClassifier
        _enc = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb",
                                              savedir=str(Path.home() / ".cache/huggingface/speechbrain-ecapa"),
                                              run_opts={"device": "cuda"})
    with torch.no_grad():
        e = _enc.encode_batch(torch.from_numpy(y16.astype(np.float32))[None]).squeeze().cpu().numpy()
    return e / np.linalg.norm(e)


def asr(y16: np.ndarray) -> str:
    """qa.asr() on transformers: pad 0.4 s / 0.3 s, drop words that lie entirely in the padding."""
    dur = len(y16) / 16000
    y = np.concatenate([np.zeros(6400, np.float32), y16.astype(np.float32), np.zeros(4800, np.float32)])
    r = asr_pipe({"raw": y, "sampling_rate": 16000}, return_timestamps="word",
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


for i, it in enumerate(todo):
    f = it["wav"]
    y, sr = librosa.load(f, sr=24000, mono=True)
    y16 = librosa.resample(y, orig_sr=sr, target_sr=16000)
    e = ecapa(y16)
    a = ag(y16)
    r = {"dur": round(len(y) / sr, 2), "f0": round(qa.f0_median(y, sr, 60, 500), 1),
         "age": round(a["age"], 1), "pFemale": round(a["p_female"], 3), "pChild": round(a["p_child"], 3),
         "ecapa": {k: round(float(e @ c), 3) for k, c in cen.items()}, "emb": [round(float(x), 5) for x in e]}
    if it.get("text"):
        hyp = asr(y16)
        r["asr"] = hyp
        r["cer"] = round(qa.cer(it["text"], hyp), 3)
        r["sig"] = {k: round(v, 3) if isinstance(v, float) else v for k, v in qa.signal_stats(y, sr, it["text"]).items()}
    res[f] = r
    print(Path(f).name, r.get("cer"), r["f0"], r["age"], r["pFemale"], r.get("asr", ""), file=sys.stderr, flush=True)
    if i % 10 == 0:
        out.write_text(json.dumps(res, ensure_ascii=False))
out.write_text(json.dumps(res, ensure_ascii=False))
print(f"wrote {out} ({len(res)})", file=sys.stderr)
