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
    t = re.sub(r"\bdix-neuf cents?\b", "mille neuf cent", t, flags=re.I)  # a year said "dix-neuf cent", written 1971
    t = re.sub(r"(\d+)\s*h\s*30\b", lambda m: m.group(1) + " heures et demie", t)  # "8h30" for "huit heures et demie"
    t = re.sub(r"(\d+)\s*h\s*(\d+)", lambda m: m.group(1) + " heures " + m.group(2), t)
    t = re.sub(r"(\d)\s*km\b", lambda m: m.group(1) + " kilomètres", t)
    t = re.sub(r"(\d+),5\b", lambda m: m.group(1) + " et demi", t)  # ASR writes "81,5" for "quatre-vingt-un et demi"
    t = re.sub(r"(\d+),(\d+)", lambda m: m.group(1) + " virgule " + m.group(2), t)
    t = re.sub(r"(\d+)\s*(?:ème|eme|e)\b", lambda m: " " + num2words(int(m.group(1)), lang="fr", to="ordinal") + " ", t)
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
    out = []
    for sg in r["segments"]:
        sw = [w for w in sg.get("words", []) if w["end"] - 0.4 > 0.03 and w["start"] - 0.4 < dur - 0.03]
        joined = "".join(w["word"] for w in sg.get("words", []))
        # A number that is in the segment text but missing from its word list (seen on a 1971 said slowly:
        # the words read "faite en pour", the text "faite en 1971 pour"): use the segment text.
        if sw and any(d not in joined for d in re.findall(r"\d+", sg.get("text", ""))):
            out.append(" " + sg["text"].strip())
        else:
            out += [w["word"] for w in sw]
    return "".join(out).strip()


# ASR spellings of the cast's proper names that sound identical to the intended reading
ASR_EQUIV = {"marshall": "marchal", "marshal": "marchal", "révèle": "revel", "rêvel": "revel", "revelle": "revel",
             "rével": "revel", "rebel": "revel", "okafort": "okafor", "straide": "straïde", "stride": "straïde",
             "strayed": "straïde", "samy": "sami", "loup": "lou", "gérart": "gérard",
             # R4 (Jo's Québécois words, spelled letters, homophones Whisper picks)
             "okay": "ok", "tigidou": "tiguidou", "tigido": "tiguidou", "tchum": "chum", "tchomme": "chum",
             "emme": "m", "ô": "o", "teinté": "un thé", "ticom": "chum", "tecom": "chum", "xiv": "quatorze"}

# Abbreviations Whisper writes for words the TTS text spells out ("M. Durand" for "monsieur Durand").
ABBR = [(r"\bM\.(?=\s)", "Monsieur"), (r"\b[Mm]\b\.?(?=\s+(?i:durand|revel|révèle|marchal|lemaire|okafor))", "Monsieur"), (r"\bMme\b\.?", "Madame"), (r"\bMlle\b\.?", "Mademoiselle")]


# Whisper's training-data captions: it appends them to clips that end in quiet room tone. Never in a HAIRLINE line.
HALLU = re.compile(r"\s*(sous-titrage|sous-titres|sous titrage)\b.*$|\s*(Merci d'avoir regardé|Abonnez-vous)\b.*$", re.I | re.S)


def strip_hallu(t: str) -> str:
    return HALLU.sub("", t or "").strip()


# Whisper writes colloquial Québécois (Jo) in standard spelling (and a few R4 homophones): « Chu » as « je suis », « Y dort » as « il dort »,
# « Pis » as « puis ». (pattern on the normalised transcript, replacement, word the reference must contain)
# Applied as an alternative reading only: cer() keeps the better of raw and mapped, so « il y a » can't get worse.
QC_EQUIV = [
    (r"\bje ne suis\b", "chu ne", "chu"),
    (r"\b(je|j) suis\b", "chu", "chu"),

    (r"\bpuis\b", "pis", "pis"),
    (r"\bbenally\b", "benali", "benali"),
    (r"\bpoids\b", "pois", "pois"),
    (r"\bles?quel(le)?s?\b", "lesquels", "lesquels"),
    (r"\bdeux\b(?!.*\bdeux\b)", "de", "de"),  # « De kebab. » heard « Deux kebabs » (/də/ ~ /dø/); see qc_hyp  # « Lesquels ? » /lekɛl/
]


def _cer1(r: str, h: str) -> float:
    return min(float(jiwer.cer(r, h)), float(jiwer.cer(silent(r), silent(h))))


def cer(ref: str, hyp: str) -> float:
    """CER, the best of a few equivalent readings of the transcript (abbreviations expanded, Québécois spellings,
    colloquial negation without « ne », the same sounds across a word boundary)."""
    hx = hyp
    for pat, rep in ABBR:
        hx = re.sub(pat, rep, hx)
    best = _cer_core(ref, hyp)
    return min(best, _cer_core(ref, hx)) if hx != hyp else best


def _sound(t: str) -> str:
    t = t.replace(" ", "").replace("ç", "s")
    return "".join(ch for ch in unicodedata.normalize("NFD", t) if unicodedata.category(ch) != "Mn")


def _cer_core(ref: str, hyp: str) -> float:
    r, h = norm(ref), norm(hyp)
    h = " ".join(ASR_EQUIV.get(w, w) for w in h.split())
    r = " ".join(ASR_EQUIV.get(w, w) for w in r.split())
    if not r:
        return 0.0 if not h else 1.0
    best = _cer1(r, h)
    hq = qc_hyp(r, h)
    if hq != h:
        best = min(best, _cer1(r, hq))
    rw = set(r.split())
    if "ne" not in rw and "n" not in rw:  # colloquial negation (« je veux pas »): Whisper writes the « ne »
        hn = " ".join(w for w in hq.split() if w not in ("ne", "n"))
        if hn != hq:
            best = min(best, _cer1(r, hn))
    if len(r) <= 12:  # short lines: same sounds across a word boundary (« Pas ça ! » heard « Passa ! »)
        best = min(best, float(jiwer.cer(_sound(r), _sound(hq))) if _sound(hq) else 1.0)
    return best


def qc_hyp(r: str, h: str) -> str:
    """The transcript with Whisper's standard spellings of Québécois words mapped back (normalised strings)."""
    words = set(r.split())
    for pat, rep, need in QC_EQUIV:
        if need in words and rep not in ("de",) or rep == "de" and "de" in words and "deux" not in words:
            h = re.sub(pat, rep, h)
    # « Y dort jamais » heard « il dort », « Y a une étiquette » heard « il y a »: only where the line says « y <word> »
    # without « il » (so « il y a » in a line stays as it is)
    rr = f" {r} "
    if re.search(r"(?<!\bil) y a\b", rr):
        h = re.sub(r"\bil y a\b", "y a", h) if " il y a " not in rr else h
    h = re.sub(r"\bil (\w+)", lambda m: f"y {m.group(1)}" if (f" y {m.group(1)} " in rr and f" il y {m.group(1)} " not in rr
                                                              and f" il {m.group(1)} " not in rr) else m.group(0), h)
    return h


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
