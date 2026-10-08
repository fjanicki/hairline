"""Whisper large-v3 French CER of <n>-<character>.wav files against testset.json.
Same text normalisation as .cache/tts/A/tools/evaluate.py (greedy decoding, language fr).
usage: eval_cer.py testset.json wav_dir out.json"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import jiwer
import librosa
import torch
from num2words import num2words
from transformers import pipeline


def norm(t: str) -> str:
    t = re.sub(r"\*[^*]*\*", " ", t)
    t = t.replace("’", "'").replace("‘", "'").replace("…", " ").replace("œ", "oe")
    t = re.sub(r"(\d+)\s*h\s*(\d+)", lambda m: m.group(1) + " heures " + m.group(2), t)
    t = re.sub(r"(\d)\s*km\b", lambda m: m.group(1) + " kilomètres", t)
    t = re.sub(r"(\d+),(\d+)", lambda m: m.group(1) + " virgule " + m.group(2), t)
    t = re.sub(r"\d+", lambda m: " " + num2words(int(m.group(0)), lang="fr") + " ", t)
    t = t.lower()
    t = re.sub(r"[-'«»\"“”.,!?;:()]", " ", t)
    t = unicodedata.normalize("NFC", t)
    return re.sub(r"\s+", " ", t).strip()


testset, wavdir, outp = sys.argv[1:4]
tests = {t["n"]: t for t in json.load(open(testset))}
asr = pipeline("automatic-speech-recognition", model="openai/whisper-large-v3", torch_dtype=torch.float16,
               device="cuda")
res = {}
for w in sorted(Path(wavdir).glob("*.wav")):
    m = re.match(r"(\d+)-", w.name)
    if not m or int(m.group(1)) not in tests:
        continue
    t = tests[int(m.group(1))]
    y, _ = librosa.load(w, sr=16000, mono=True)
    hyp = asr(y, generate_kwargs={"language": "fr", "task": "transcribe", "num_beams": 1})["text"].strip()
    cer = jiwer.cer(norm(t["text"]), norm(hyp))
    res[w.name] = dict(n=t["n"], character=t["character"], text=t["text"], asr=hyp, cer=cer,
                       wer=jiwer.wer(norm(t["text"]), norm(hyp)), dur=len(y) / 16000)
    print(f"{w.name} CER={cer:.3f} | {hyp}", flush=True)
cers = [r["cer"] for r in res.values()]
res["_summary"] = dict(n=len(cers), mean_cer=sum(cers) / max(len(cers), 1), max_cer=max(cers, default=0))
print(json.dumps(res["_summary"]))
json.dump(res, open(outp, "w"), indent=1, ensure_ascii=False)
