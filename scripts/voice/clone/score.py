"""Québec-aware CER for Jo's lines (pure Python; Mac side, recomputed from the Whisper text stored in qa.json).

Whisper large-v3 writes colloquial Québécois in standard spelling: « Chu » as « je suis » / « j'suis » / « je ne
suis », « Y dort » as « il dort », « Pis » as « puis », and it hears « Benali » as « Benally », « pois » as
« poids ». Those are spellings of what was said, not model errors, so before the CER (qa.cer: shared normalisation
plus the silent-ending variant) the transcript is mapped back to the script's words. A « ne » that Whisper
writes (« je ne suis ») still counts as an error: it may really be in the audio.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import qa  # noqa: E402  scripts/voice/qa.py (norm, cer)

# (regex on the normalised transcript, replacement, only when the reference has this word)
QC_EQUIV = [
    (r"\bje ne suis\b", "chu ne", "chu"),
    (r"\b(je|j) suis\b", "chu", "chu"),
    (r"\bil\b", "y", "y"),
    (r"\bpuis\b", "pis", "pis"),
    (r"\bbenally\b", "benali", "benali"),
    (r"\bpoids\b", "pois", "pois"),
]


def qc_hyp(ref: str, hyp: str) -> str:
    r = set(qa.norm(ref).split())
    h = qa.norm(hyp)
    for pat, rep, need in QC_EQUIV:
        if need in r:
            h = re.sub(pat, rep, h)
    return h


def cer_qc(ref: str, hyp: str) -> float:
    return round(qa.cer(ref, qc_hyp(ref, hyp)), 3)


def best_take(keys, qa_res, text):
    """The kept take of a line: lowest Québec-aware CER, then the lower take number."""
    ks = [k for k in keys if k in qa_res]
    return min(ks, key=lambda k: (cer_qc(text, qa_res[k].get("asr", "")), k)) if ks else None
