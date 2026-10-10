#!/usr/bin/env bash
# Set up the zero-shot voice-cloning audition env on auriga (RX 9070 XT, ROCm 7.2), apart from ~/hairline-tts.
#
#   scripts/voice/clone/remote/setup_auriga.sh [--host auriga]
#
# Creates ~/hairline-clone on the remote host:
#   venv-cb/   Chatterbox Multilingual (resemble-ai/chatterbox, MIT), torch 2.11.0+rocm7.2 (same wheels as
#              ~/hairline-tts), chatterbox installed --no-deps from a pinned commit (its pyproject pins torch 2.6,
#              which has no gfx1201 build), plus Whisper (transformers) for the take QA.
#   bin/       the worker and QA scripts (copied from scripts/voice/clone/ on every run of clone.py).
# The QA reuses ~/hairline-tts/accent/venv (accent classifiers) read-only; nothing in ~/hairline-tts changes.
# Fish Audio OpenAudio S1-mini is not installed: its weights are gated (fishaudio/s1-mini) and need the user's
# Hugging Face account to accept the terms first (see docs/voice.md §13).
set -euo pipefail
HOST=auriga
[[ "${1:-}" == "--host" ]] && HOST="$2"
CB_COMMIT=5de7a54aa4e5e2baadb0182dde554908b48b85c2   # resemble-ai/chatterbox master, 2026-10-09

ssh "$HOST" CB_COMMIT=$CB_COMMIT bash -s <<'REMOTE'
set -euo pipefail
UV=~/.local/bin/uv
R=~/hairline-clone
mkdir -p $R/bin $R/runs $R/refs
cd $R
if [[ ! -x venv-cb/bin/python ]]; then
  $UV venv -q --python 3.12 venv-cb
fi
PY=venv-cb/bin/python
$UV pip install -q --python $PY --index-url https://download.pytorch.org/whl/rocm7.2 \
  torch==2.11.0+rocm7.2 torchaudio==2.11.0+rocm7.2
$UV pip install -q --python $PY --no-deps "chatterbox-tts @ git+https://github.com/resemble-ai/chatterbox@$CB_COMMIT"
$UV pip install -q --python $PY --no-deps "resemble-perth @ git+https://github.com/resemble-ai/Perth.git@master"
# chatterbox's runtime deps minus torch/gradio (pins from its pyproject where they matter)
$UV pip install -q --python $PY "numpy<2" librosa==0.11.0 s3tokenizer transformers==5.2.0 diffusers==0.29.0 \
  conformer==0.3.2 safetensors==0.5.3 pykakasi==2.3.0 spacy-pkuseg pyloudnorm omegaconf soundfile \
  huggingface_hub accelerate jiwer num2words praat-parselmouth onnx
$PY - <<'PY'
import torch
print("torch", torch.__version__, "gpu", torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else "")
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
print("chatterbox import ok")
PY
# QA env: Whisper large-v3 (transformers), SpeechBrain ECAPA, audeering age/gender, Praat F0, loudness.
# The accent classifiers and UTMOS run in ~/hairline-tts/accent/venv (read-only use, cwd ~/hairline-tts/accent).
if [[ ! -x venv-qa/bin/python ]]; then
  $UV venv -q --python 3.12 venv-qa
fi
QPY=venv-qa/bin/python
$UV pip install -q --python $QPY --index-url https://download.pytorch.org/whl/rocm7.2 \
  torch==2.11.0+rocm7.2 torchaudio==2.11.0+rocm7.2
$UV pip install -q --python $QPY transformers==4.57.6 speechbrain==1.1.1 jiwer num2words librosa soundfile \
  praat-parselmouth pyloudnorm pyarrow accelerate
$QPY -c "import torch, speechbrain, parselmouth, transformers; print('qa env ok', torch.cuda.is_available())"
REMOTE
echo "setup done on $HOST:~/hairline-clone"
