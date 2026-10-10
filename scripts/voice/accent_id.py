"""French accent (dialect) identification for voice casting (R4: Jo, Québécoise).

Scores WAV files with up to three classifiers and writes one JSON object per file:
  vx_whisper  Voxlect French dialect, Whisper-large-v3 + LoRA (tiantiaf/voxlect-french-dialect-whisper-large-v3,
              OpenRAIL; trained on Common Voice 11 fr accents): Africa / France / Canada / Swiss-Belgium-German
  vx_mms      Voxlect French dialect, MMS-LID-256 + LoRA (tiantiaf/voxlect-french-dialect-mms-lid-256, CC BY-NC 4.0;
              used only to rank voices, nothing of it ships)
  ca_xlsr     CommonAccent-style XLSR-53 French accent (sinhprous/accent-french, MIT; unofficial, no reported
              accuracy): France / Canada / Belgium / Switzerland
Each model sees at most 15 s (Voxlect's training limit; clips under 3 s are unreliable, so the caller
concatenates short TTS lines first).

Runs on auriga (ROCm) in ~/hairline-tts/accent/venv (torch 2.11 rocm7.2, transformers 4.46.3, speechbrain
1.1.1, loralib) with the Voxlect repo cloned next to it:
  venv/bin/python accent_id.py --voxlect voxlect --out scores.json a.wav b.wav ...
  venv/bin/python accent_id.py --models vx_whisper --out scores.json dir/   (every *.wav under dir)
"""
import argparse
import json
import sys
from pathlib import Path

import librosa
import numpy as np
import torch
import torch.nn.functional as F

VX_LABELS = ["africa", "france", "canada", "swiss_belgium"]
CA_LABELS = ["france", "canada", "belgium", "swiss"]  # label_encoder.txt order
SR = 16000
MAX_S = 15

ap = argparse.ArgumentParser()
ap.add_argument("inputs", nargs="+")
ap.add_argument("--out", required=True)
ap.add_argument("--voxlect", default="voxlect", help="path to a clone of github.com/tiantiaf0627/voxlect")
ap.add_argument("--models", default="vx_whisper,vx_mms,ca_xlsr")
args = ap.parse_args()

files = []
for s in args.inputs:
    p = Path(s)
    files += sorted(p.rglob("*.wav")) if p.is_dir() else [p]
files = [f for f in files if not f.name.endswith(".tmp.wav")]
out = Path(args.out)
res = json.loads(out.read_text()) if out.exists() else {}
dev = "cuda" if torch.cuda.is_available() else "cpu"


def load(f):
    y, _ = librosa.load(str(f), sr=SR, mono=True)
    y, _ = librosa.effects.trim(y, top_db=40)
    return y[: SR * MAX_S].astype(np.float32), len(y) / SR


def run_model(name, fn):
    todo = [f for f in files if name not in res.get(str(f), {})]
    print(f"{name}: {len(todo)} files", file=sys.stderr)
    for i, f in enumerate(todo):
        y, dur = load(f)
        r = res.setdefault(str(f), {})
        r["dur"] = round(min(dur, MAX_S), 2)
        with torch.no_grad():
            r[name] = {k: round(float(v), 4) for k, v in fn(y).items()}
        if i % 25 == 0:
            out.write_text(json.dumps(res, indent=1))
    out.write_text(json.dumps(res, indent=1))


models = args.models.split(",")
sys.path.insert(0, str(Path(args.voxlect).resolve()))
if "vx_whisper" in models:
    from src.model.dialect.whisper_dialect import WhisperWrapper
    m = WhisperWrapper.from_pretrained("tiantiaf/voxlect-french-dialect-whisper-large-v3").to(dev).eval()

    def vx_whisper(y):
        logits = m(torch.from_numpy(y)[None].to(dev))
        logits = logits[0] if isinstance(logits, tuple) else logits
        return dict(zip(VX_LABELS, F.softmax(logits, dim=1)[0].tolist()))
    run_model("vx_whisper", vx_whisper)
    del m
    torch.cuda.empty_cache()

if "vx_mms" in models:
    from src.model.dialect.mms_dialect import MMSWrapper
    m2 = MMSWrapper.from_pretrained("tiantiaf/voxlect-french-dialect-mms-lid-256").to(dev).eval()

    def vx_mms(y):
        logits = m2(torch.from_numpy(y)[None].to(dev))
        logits = logits[0] if isinstance(logits, tuple) else logits
        return dict(zip(VX_LABELS, F.softmax(logits, dim=1)[0].tolist()))
    run_model("vx_mms", vx_mms)
    del m2
    torch.cuda.empty_cache()

if "ca_xlsr" in models:
    import shutil
    from huggingface_hub import snapshot_download
    from speechbrain.inference.interfaces import foreign_class
    # The repo's hyperparams.yaml names a SpeechBrain 0.5 class (lobes.models.huggingface_wav2vec) and its own hub
    # path; run it from a local copy with the 1.x class and local checkpoint paths.
    src = Path("pretrained/accent-french-src").resolve()
    if not (src / "hyperparams.yaml").exists():
        shutil.copytree(snapshot_download("sinhprous/accent-french"), src, dirs_exist_ok=True)
        hp = (src / "hyperparams.yaml").read_text()
        hp = hp.replace("speechbrain.lobes.models.huggingface_wav2vec.HuggingFaceWav2Vec2",
                        "speechbrain.lobes.models.huggingface_transformers.wav2vec2.Wav2Vec2")
        hp = hp.replace("pretrained_path: sinhprous/accent-french", f"pretrained_path: {src}")
        (src / "hyperparams.yaml").unlink()
        (src / "hyperparams.yaml").write_text(hp)
        ci = (src / "custom_interface.py").read_text().replace("speechbrain.pretrained", "speechbrain.inference")
        (src / "custom_interface.py").unlink()
        (src / "custom_interface.py").write_text(ci)
    c = foreign_class(source=str(src), pymodule_file="custom_interface.py",
                      classname="CustomEncoderWav2vec2Classifier", savedir="pretrained/accent-french",
                      run_opts={"device": dev})

    def ca_xlsr(y):
        prob = c.classify_batch(torch.from_numpy(y)[None])[0][0]
        prob = prob[: len(CA_LABELS)]  # the head has 21 outputs, only the first 4 are trained labels
        prob = prob / prob.sum()
        return dict(zip(CA_LABELS, prob.tolist()))
    run_model("ca_xlsr", ca_xlsr)

print(f"wrote {out} ({len(res)} files)", file=sys.stderr)
