"""QA helpers for the French voice bake (run in .cache/tts/A/evalvenv, Python 3.11).

- ASR: mlx-whisper large-v3, French, greedy; CER against the TTS text after a shared normalisation.
- Pacing: words per second over the voiced span.
- Cut-off: energy of the last 60 ms relative to the loud part of the file.
- F0: Praat median pitch.
- Speaker embeddings: speechbrain ECAPA (VoxCeleb), L2-normalised, cosine similarity.
"""
import re
import unicodedata
from pathlib import Path

import jiwer
import librosa
import numpy as np
from num2words import num2words

ASR_REPO = "mlx-community/whisper-large-v3-mlx"


def norm(t: str) -> str:
    t = re.sub(r"\*[^*]*\*", " ", t)
    t = t.replace("’", "'").replace("‘", "'").replace("…", " ").replace("œ", "oe").replace("æ", "ae")
    t = re.sub(r"(\d+)\s*h\s*(\d+)", lambda m: m.group(1) + " heures " + m.group(2), t)
    t = re.sub(r"(\d)\s*km\b", lambda m: m.group(1) + " kilomètres", t)
    t = re.sub(r"(\d+),5\b", lambda m: m.group(1) + " et demi", t)  # ASR writes "81,5" for "quatre-vingt-un et demi"
    t = re.sub(r"(\d+),(\d+)", lambda m: m.group(1) + " virgule " + m.group(2), t)
    t = re.sub(r"\d+", lambda m: " " + num2words(int(m.group(0)), lang="fr") + " ", t)
    t = t.lower()
    t = re.sub(r"[-'«»\"“”.,!?;:()\[\]/]", " ", t)
    t = unicodedata.normalize("NFC", t)
    return re.sub(r"\s+", " ", t).strip()


def asr(path: str) -> str:
    """Whisper drops a word that starts at t=0, and hallucinates words into padded silence. So: pad 0.4 s of
    silence in front (0.3 s behind), transcribe with word timestamps, and drop words that lie entirely in the
    padding."""
    import mlx_whisper
    y, _ = librosa.load(str(path), sr=16000, mono=True)
    dur = len(y) / 16000
    y = np.concatenate([np.zeros(6400, np.float32), y.astype(np.float32), np.zeros(4800, np.float32)])
    r = mlx_whisper.transcribe(y, path_or_hf_repo=ASR_REPO, language="fr", temperature=0.0, word_timestamps=True,
                               condition_on_previous_text=False, verbose=None)
    ws = [w for s in r["segments"] for w in s.get("words", [])]
    if not ws:
        return r["text"].strip()
    keep = [w["word"] for w in ws if w["end"] - 0.4 > 0.03 and w["start"] - 0.4 < dur - 0.03]
    return "".join(keep).strip()


# ASR spellings of the cast's proper names that sound identical to the intended reading
ASR_EQUIV = {"marshall": "marchal", "marshal": "marchal", "révèle": "revel", "rêvel": "revel", "revelle": "revel",
             "rével": "revel", "rebel": "revel", "okafort": "okafor", "straide": "straïde", "stride": "straïde",
             "strayed": "straïde", "samy": "sami", "inès": "ines"}


def cer(ref: str, hyp: str) -> float:
    r, h = norm(ref), norm(hyp)
    h = " ".join(ASR_EQUIV.get(w, w) for w in h.split())
    r = " ".join(ASR_EQUIV.get(w, w) for w in r.split())
    if not r:
        return 0.0 if not h else 1.0
    return min(float(jiwer.cer(r, h)), float(jiwer.cer(silent(r), silent(h))))


def silent(t: str) -> str:
    """Drop French silent inflection endings so homophones match ('ignoré'/'ignorée', 'qu'ils gagnent'/'qu'il gagne')."""
    out = []
    for w in t.split():
        w = re.sub(r"(ent|es|s|x|e)$", "", w) if len(w) > 3 else re.sub(r"s$", "", w)
        w = w.replace("é", "e").replace("è", "e").replace("ê", "e")
        out.append(w)
    return " ".join(out)


def words_ts(path: str):
    """Whisper word timestamps (seconds, on the unpadded signal)."""
    import mlx_whisper
    y, _ = librosa.load(str(path), sr=16000, mono=True)
    y = np.concatenate([np.zeros(6400, np.float32), y.astype(np.float32), np.zeros(4800, np.float32)])
    r = mlx_whisper.transcribe(y, path_or_hf_repo=ASR_REPO, language="fr", temperature=0.0, word_timestamps=True,
                               condition_on_previous_text=False, verbose=None)
    return [(w["word"], w["start"] - 0.4, w["end"] - 0.4) for s in r["segments"] for w in s["words"]]


def signal_stats(y: np.ndarray, sr: int, text: str) -> dict:
    hop = int(sr * 0.01)
    rms = librosa.feature.rms(y=y, frame_length=hop * 3, hop_length=hop)[0]
    p95 = np.percentile(rms, 95) + 1e-9
    voiced = np.where(rms > p95 * 0.05)[0]
    lead = float(voiced[0] * 0.01) if len(voiced) else 0.0
    trail = float((len(rms) - 1 - voiced[-1]) * 0.01) if len(voiced) else 0.0
    span = float((voiced[-1] - voiced[0] + 1) * 0.01) if len(voiced) else 0.0
    tail_db = float(20 * np.log10(rms[-6:].mean() + 1e-9) - 20 * np.log10(p95))
    words = len(norm(text).split())
    wps = words / span if span > 0 else 0.0
    letters = len(re.sub(r"[^a-zà-öø-ÿ]", "", norm(text)))
    cps = letters / span if span > 0 else 0.0
    return {"lead": lead, "trail": trail, "span": span, "tail_db": tail_db, "words": words, "wps": wps,
            "letters": letters, "cps": cps}


def f0_median(y: np.ndarray, sr: int, floor=60, ceil=700) -> float:
    import parselmouth
    snd = parselmouth.Sound(y.astype(np.float64), sr)
    f0 = snd.to_pitch(time_step=0.01, pitch_floor=floor, pitch_ceiling=ceil).selected_array["frequency"]
    f0 = f0[f0 > 0]
    return float(np.median(f0)) if len(f0) else 0.0


_enc = None


def ecapa(y16: np.ndarray) -> np.ndarray:
    global _enc
    import torch
    if _enc is None:
        from speechbrain.inference.speaker import EncoderClassifier
        _enc = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb",
                                              savedir=str(Path.home() / ".cache/huggingface/speechbrain-ecapa"))
    with torch.no_grad():
        e = _enc.encode_batch(torch.from_numpy(y16.astype(np.float32))[None]).squeeze().numpy()
    return e / np.linalg.norm(e)
