"""Speech enhancement of a cloning reference (round 2, cb-qc1 comparison). Runs on auriga in
~/hairline-clone/venv-enh (torch 2.11 rocm7.2 + resemble-enhance, installed --no-deps).

  venv-enh/bin/python bin/enhance.py in.wav out_dir/ [--nfe 64] [--lambd 0.5] [--tau 0.5]

Writes out_dir/<stem>_re-denoise.wav (Resemble Enhance denoiser only) and out_dir/<stem>_re-enhance.wav (denoise +
enhancer: a latent flow-matching model that restores bandwidth / removes codec dullness, 44.1 kHz).
Resemble Enhance: MIT (github.com/resemble-ai/resemble-enhance), weights ResembleAI/resemble-enhance (MIT).
Its training modules import DeepSpeed at import time; inference never calls it, so a stub is registered instead of
installing DeepSpeed (no ROCm build for this GPU).
DeepFilterNet (MIT / Apache-2.0) runs separately as its release binary: tools/deep-filter (CPU, 48 kHz).
"""
import argparse
import sys
import types
from pathlib import Path


def stub_deepspeed():
    ds = types.ModuleType("deepspeed")
    ds.DeepSpeedConfig = object
    acc = types.ModuleType("deepspeed.accelerator")
    acc.get_accelerator = lambda: None
    rt = types.ModuleType("deepspeed.runtime")
    eng = types.ModuleType("deepspeed.runtime.engine")
    eng.DeepSpeedEngine = object
    ut = types.ModuleType("deepspeed.runtime.utils")
    ut.clip_grad_norm_ = None
    for m in (ds, acc, rt, eng, ut):
        sys.modules[m.__name__] = m


ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("out")
ap.add_argument("--nfe", type=int, default=64)
ap.add_argument("--lambd", type=float, default=0.5, help="denoise strength before enhancing (0-1)")
ap.add_argument("--tau", type=float, default=0.5, help="prior temperature (0-1)")
args = ap.parse_args()

stub_deepspeed()
import torch  # noqa: E402
import torchaudio  # noqa: E402
import soundfile as sf  # noqa: E402
from resemble_enhance.enhancer.inference import denoise, enhance  # noqa: E402

dev = "cuda" if torch.cuda.is_available() else "cpu"
y, sr = sf.read(args.src, dtype="float32", always_2d=True)
dwav = torch.from_numpy(y.mean(1))
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)
stem = Path(args.src).stem
w, nsr = denoise(dwav, sr, dev)
sf.write(out / f"{stem}_re-denoise.wav", w.cpu().numpy(), nsr, subtype="PCM_16")
w, nsr = enhance(dwav, sr, dev, nfe=args.nfe, solver="midpoint", lambd=args.lambd, tau=args.tau)
sf.write(out / f"{stem}_re-enhance.wav", w.cpu().numpy(), nsr, subtype="PCM_16")
print("wrote", out, nsr)
