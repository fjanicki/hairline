#!/usr/bin/env python3
"""Generate the SFX that no recorded source covered (.cache/sfx/generate-prompts.json) with a local
text-to-audio model, pick the best takes automatically, and hand them to build.py.

    V=.cache/sfx/gen/venv/bin/python
    nice -n 10 $V -I scripts/sfx/generate.py --root . gen      [--only a,b] [--batch 4]
    nice -n 10 $V -I scripts/sfx/generate.py --root . score    [--only a,b]
               $V -I scripts/sfx/generate.py --root . pick     [--only a,b]
               $V -I scripts/sfx/generate.py --root . recipes
    (or `all` = gen + score + pick + recipes), then:
    .cache/sfx/venv/bin/python -I scripts/sfx/build.py --root . --only <names>

Model: TangoFlux (declare-lab/TangoFlux on Hugging Face, 515M-parameter rectified-flow FluxTransformer,
44.1 kHz stereo, up to 30 s; non-commercial research licence, see docs/assets/sfx.md). It is run with our own
~60-line inference below, built only from diffusers/transformers classes (FluxTransformer2DModel,
AutoencoderOobleck, T5EncoderModel) and the safetensors weights; no code from the model repo is executed.
(Stable Audio Open 1.0 / Small would also fit, but they are gated on Hugging Face and the account has not
been granted access.)

Steps:
  gen     N takes per item (seeded, deterministic): .cache/sfx/gen/takes/<name>/s<seed>.wav (float WAV, 44.1k
          stereo, length = duration + 0.5 s for one-shots, duration + xfade + 1 s for loops). Existing takes
          are skipped, so `gen` is resumable and re-runnable.
  score   LAION CLAP (laion/larger_clap_general) audio-text cosine of every take against its prompt, plus
          artifact checks: clipping (flat tops), silence, spectral flatness (vs the item's other takes),
          sudden level jumps and, for loops, level stability and the head/tail match at the loop seam.
          -> .cache/sfx/gen/scores.json
  pick    best `variants` takes per item by score = CLAP - penalties (hard rejects and the item's `exclude`
          takes, {take: reason} vetoed by listening or scripts/sfx/qa.py, excluded), skipping
          near-duplicates (CLAP audio embedding cosine > 0.97 to a take already picked); one-shots are
          spectrally gated (denoise(): the model's steady hiss) and trimmed (onset - 10 ms .. decay to -50 dB, capped near the prompt duration) and written to
          .cache/sfx/dl/gen/<name>_NN.wav (loops: the whole take), which is build.py's input.
  recipes writes one recipe per item into scripts/sfx/recipes-gen.json (src gen/..., mode files or loop,
          cat from the prompt list) and a `sources` entry per file; build.py and catalogue.py merge it into
          recipes.json, so the generated set is built like the recorded one.
"""
import hashlib
import json
import math
import os
import sys
import time

import numpy as np

MODEL_REPO = "declare-lab/TangoFlux"
MODEL_REV = "367005e963cb3a9fb2e03a46104d7de23e34ceea"
T5_REPO = "google/flan-t5-large"
T5_REV = "0613663d0d48ea86ba8cb3d7a44f0f65dc596a2a"
CLAP_REPO = "laion/larger_clap_general"
CLAP_REV = "refs/pr/2"  # the Hugging Face safetensors conversion of the checkpoint (no pickle load)
MODEL_NAME = "TangoFlux"
SR_GEN = 44100
STEPS = 50
CFG = 4.5
MAX_GEN = 30.0
SEED_BASE = 1000
MIN_CLAP = 0.10  # below this LAION-CLAP cosine a take is rarely the sound asked for

# How many takes to generate per item: one-shots 3x variants (min 6), loops/beds 4x variants (min 4).
def n_takes(it):
    v = it["variants"]
    return max(4, 4 * v) if it["loop"] or it["duration"] > 6 else max(6, 3 * v)


def loop_params(it):
    """(start, dur, xfade) of the loop inside the take; TangoFlux tops out at 30 s."""
    d = it["duration"]
    xf = 3.0 if d >= 15 else (1.0 if d >= 8 else (0.5 if d >= 3 else 0.3))
    d = min(d, MAX_GEN - xf - 1.0)
    return 0.4, d, xf


def gen_len(it):
    if it["loop"]:
        s, d, xf = loop_params(it)
        return min(MAX_GEN, s + d + xf + 0.6)
    # TangoFlux was trained on ~10 s clips: sub-second requests come out empty or garbled, so one-shots
    # are generated at >= 3 s and the event is cut out afterwards (trim_bounds).
    return min(MAX_GEN, max(3.0, it["duration"] + 0.5))


def log(*a):
    print(*a, flush=True)


# ----------------------------------------------------------------------------- TangoFlux inference

def load_tangoflux(device):
    import torch
    from torch import nn
    from diffusers import AutoencoderOobleck, FluxTransformer2DModel
    from huggingface_hub import snapshot_download
    from safetensors.torch import load_file
    from transformers import T5EncoderModel, T5TokenizerFast

    mdir = snapshot_download(MODEL_REPO, revision=MODEL_REV, allow_patterns=["config.json", "*.safetensors", "*.md"])
    tdir = snapshot_download(T5_REPO, revision=T5_REV, allow_patterns=["*.json", "model.safetensors", "spiece.model"])
    cfg = json.load(open(os.path.join(mdir, "config.json")))

    class PosEmb(nn.Module):  # Stable Audio style Fourier features of a scalar in [0, 1]
        def __init__(self, dim):
            super().__init__()
            self.weights = nn.Parameter(torch.zeros(dim // 2))

        def forward(self, t):
            t = t[..., None]
            f = t * self.weights[None] * 2 * math.pi
            return torch.cat((t, f.sin(), f.cos()), dim=-1)

    class Duration(nn.Module):
        def __init__(self, out_dim, max_value, internal=256):
            super().__init__()
            self.time_positional_embedding = nn.Sequential(PosEmb(internal), nn.Linear(internal + 1, out_dim))
            self.max_value, self.out_dim = max_value, out_dim

        def forward(self, secs):
            x = secs.clamp(0, self.max_value) / self.max_value
            return self.time_positional_embedding(x).view(-1, 1, self.out_dim)

    class TF(nn.Module):  # attribute names match the checkpoint's keys
        def __init__(self):
            super().__init__()
            self.text_encoder = T5EncoderModel.from_pretrained(tdir)
            d = self.text_encoder.config.d_model
            self.fc = nn.Sequential(nn.Linear(d, cfg["joint_attention_dim"]), nn.ReLU())
            self.duration_emebdder = Duration(d, cfg["max_duration"])
            self.transformer = FluxTransformer2DModel(
                in_channels=cfg["in_channels"], num_layers=cfg["num_layers"], num_single_layers=cfg["num_single_layers"],
                attention_head_dim=cfg["attention_head_dim"], num_attention_heads=cfg["num_attention_heads"],
                joint_attention_dim=cfg["joint_attention_dim"], pooled_projection_dim=d, guidance_embeds=False)

    model = TF()
    missing, unexpected = model.load_state_dict(load_file(os.path.join(mdir, "tangoflux.safetensors")), strict=False)
    missing = [k for k in missing if not k.startswith("text_encoder.")]  # T5 embed_tokens tie: expected
    assert not missing and not unexpected, (missing[:5], unexpected[:5])
    vae = AutoencoderOobleck()
    vae.load_state_dict(load_file(os.path.join(mdir, "vae.safetensors")))
    tok = T5TokenizerFast.from_pretrained(tdir)
    model.eval().to(device)
    vae.eval().to(device)
    return model, vae, tok, cfg


def tf_generate(bundle, prompt, seconds, seeds, device, steps=STEPS, cfg_scale=CFG, negative=""):
    """One prompt, len(seeds) takes (batched). Returns float32 (n, samples, 2)."""
    import torch
    from diffusers import FlowMatchEulerDiscreteScheduler

    model, vae, tok, cfg = bundle
    n = len(seeds)
    with torch.no_grad():
        b = tok([prompt], max_length=tok.model_max_length, padding=True, truncation=True, return_tensors="pt")
        u = tok([negative], max_length=b.input_ids.shape[1], padding="max_length", truncation=True, return_tensors="pt")
        ids = torch.cat([u.input_ids, b.input_ids]).to(device)
        mask = torch.cat([u.attention_mask, b.attention_mask]).to(device)
        h = model.text_encoder(input_ids=ids, attention_mask=mask)[0]  # (2, L, d): uncond, cond
        m = mask.bool().unsqueeze(-1)
        pooled = model.fc((h * m).sum(1) / m.sum(1))
        dur = model.duration_emebdder(torch.tensor([seconds], device=device, dtype=torch.float32)).expand(2, -1, -1)
        ehs = torch.cat([h, dur], dim=1)
        ehs = ehs.repeat_interleave(n, 0)  # [uncond x n, cond x n]
        pooled = pooled.repeat_interleave(n, 0)
        L = cfg["audio_seq_len"]
        lat = torch.stack([torch.randn(L, 64, generator=torch.Generator().manual_seed(s)) for s in seeds]).to(device)
        txt_ids = torch.zeros(ehs.shape[1], 3, device=device)
        img_ids = torch.arange(L, device=device).float()[:, None].repeat(1, 3)
        sch = FlowMatchEulerDiscreteScheduler(num_train_timesteps=1000)
        sch.set_timesteps(sigmas=list(np.linspace(1.0, 1 / steps, steps)), device=device)
        for t in sch.timesteps:
            x = torch.cat([lat, lat])
            v = model.transformer(hidden_states=x, timestep=(t / 1000).expand(2 * n).to(device), guidance=None,
                                  pooled_projections=pooled, encoder_hidden_states=ehs, txt_ids=txt_ids,
                                  img_ids=img_ids, return_dict=False)[0]
            vu, vc = v.chunk(2)
            lat = sch.step(vu + cfg_scale * (vc - vu), t, lat).prev_sample
        wav = vae.decode(lat.transpose(2, 1)).sample  # (n, 2, T)
    wav = wav[:, :, : int(seconds * SR_GEN)].float().cpu().numpy()
    return np.ascontiguousarray(wav.transpose(0, 2, 1))


def cmd_gen(root, items, batch, negative, pause):
    """Takes live in .cache/sfx/gen/takes/<name>/s<seed>.wav next to a settings.json (model revision,
    prompt, negative prompt, length, steps, CFG); when the settings change, the item's takes are redone."""
    import soundfile as sf
    import torch

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    bundle = None
    for it in items:
        d = os.path.join(root, ".cache/sfx/gen/takes", it["name"])
        os.makedirs(d, exist_ok=True)
        secs = gen_len(it)
        neg = it.get("negative_prompt", negative)
        settings = {"model": f"{MODEL_REPO}@{MODEL_REV}", "prompt": it["prompt"], "negative": neg, "seconds": secs,
                    "steps": STEPS, "cfg": CFG}
        sp = os.path.join(d, "settings.json")
        try:
            old = json.load(open(sp))
        except Exception:
            old = None
        if old != settings:
            for f in os.listdir(d):
                if f.endswith(".wav"):
                    os.remove(os.path.join(d, f))
            json.dump(settings, open(sp, "w"), indent=1)
        base = SEED_BASE + int(hashlib.sha1(it["name"].encode()).hexdigest()[:6], 16) % 100000
        seeds = [base + i for i in range(n_takes(it) + it.get("extra_takes", 0))]  # extra: low-yield items
        todo = [s for s in seeds if not os.path.exists(os.path.join(d, f"s{s}.wav"))]
        if not todo:
            continue
        if bundle is None:
            t0 = time.time()
            bundle = load_tangoflux(device)
            log(f"model loaded on {device} in {time.time() - t0:.0f} s")
        for i in range(0, len(todo), batch):
            chunk = todo[i : i + batch]
            t0 = time.time()
            wavs = tf_generate(bundle, it["prompt"], secs, chunk, device, negative=neg)
            for s, w in zip(chunk, wavs):
                sf.write(os.path.join(d, f"s{s}.wav"), w, SR_GEN, subtype="FLOAT")
            log(f"  {it['name']}: {len(chunk)} x {secs:.1f} s in {time.time() - t0:.1f} s")
            time.sleep(pause)  # leave the GPU to other work between batches
        if device == "mps":
            torch.mps.empty_cache()


# ----------------------------------------------------------------------------- analysis

def db(v):
    return 20 * np.log10(np.maximum(v, 1e-9))


def env(m, sr, win):
    h = max(1, int(sr * win))
    n = len(m) // h
    return db(np.sqrt((m[: n * h].reshape(n, h) ** 2).mean(axis=1))), h


def flat_tops(x, thr=0.5, run=4):
    """Count runs of >= run identical-ish samples above thr: hard clipping signature."""
    a = np.abs(x)
    same = (np.abs(np.diff(x)) < 1e-5) & (a[1:] > thr)
    if not same.any():
        return 0
    c, best, cnt = 0, 0, 0
    for s in same:
        c = c + 1 if s else 0
        if c == run - 1:
            cnt += 1
    return cnt


def spectral_flatness(m, sr):
    import librosa
    return librosa.feature.spectral_flatness(y=m, n_fft=2048, hop_length=512)[0]


def onsets(e, hop, pk, thresh=12.0):
    """Frames where the envelope jumps `thresh` dB above the median of the previous 150 ms (and is within
    20 dB of the take's peak)."""
    w = int(0.15 / hop)
    out, last = [], -10 ** 9
    for i in range(1, len(e)):
        base = np.median(e[max(0, i - w) : i])
        if e[i] - base > thresh and e[i] > pk - 20 and (i - last) * hop > 0.12:
            out.append(i)
            last = i
    return out


def trim_bounds(m, sr, it):
    """The shipped window of a one-shot take.
    Single transients (prompt duration <= 0.7 s: steps, drops, tocks): the loudest onset, from 10 ms before
    it to the next onset / the decay to -50 dB / 1.25 x the duration, whichever is first.
    Longer one-shots: from the first onset (or the first frame within 35 dB of the peak) to the decay or
    1.25 x the duration. Multi-second events (> 6 s) keep their build-up from the start of the take."""
    hop = 0.005
    e, h = env(m, sr, hop)
    pk = e.max()
    ons = onsets(e, hop, pk)
    pad = int(0.01 * sr)
    floor = np.percentile(e, 20)
    if it["duration"] <= 0.7 and ons:
        peaks = [e[o : o + 20].max() for o in ons]
        k = int(np.argmax(peaks))
        on = ons[k]
        nxt = ons[k + 1] * h - pad if k + 1 < len(ons) else len(m)
    else:
        # within 35 dB of the peak, and 10 dB over the take's floor (20th percentile: its hiss). QA: takes
        # whose hiss sat within 35 dB of the event kept up to a second of hiss before it (tv_crt_off)
        es = np.convolve(np.pad(e, (2, 1), mode="edge"), np.ones(4) / 4, mode="valid")  # 20 ms: single hiss spikes do not count
        first = int(np.argmax(es > max(pk - 35, floor + 10)))
        # the onset that starts that frame's event (QA: this took the earliest onset anywhere before it,
        # so a tick in the lead-in hiss pulled the start back to the head of the take)
        on = min([o for o in ons if first - int(0.1 / hop) <= o <= first + 4] or [first])
        nxt = len(m)
    start = max(0, on * h - pad)
    if it["duration"] > 6:
        start = 0
    cap = start + int(sr * it["duration"] * (1.0 if it["duration"] > 6 else 1.25))
    below = np.where(e[on:] > max(pk - (40 if it["duration"] <= 0.7 else 50), floor + 6))[0]
    dec = (on + below[-1] + 1) * h + int(0.02 * sr) if len(below) else len(m)
    end = min(len(m), dec, cap, nxt)
    return start, max(end, start + int(0.05 * sr))


def denoise(x, sr, floor_db=-20.0, alpha=2.0):
    """Spectral gate for one-shots: TangoFlux leaves a steady band-limited hiss under everything (and
    after the event). The noise spectrum is the mean power of the quietest 20 % of STFT frames; each bin
    gets a Wiener-style gain (1 - alpha*N/P), floored at floor_db and smoothed over 5 frames."""
    from scipy.signal import stft, istft
    from scipy.ndimage import uniform_filter1d

    out = np.empty_like(x)
    for c in range(x.shape[1]):
        f, t, X = stft(x[:, c], fs=sr, nperseg=1024, noverlap=768)
        P = np.abs(X) ** 2
        fe = P.sum(axis=0)
        q = fe <= np.percentile(fe, 20)
        N = P[:, q].mean(axis=1, keepdims=True) if q.any() else P.min(axis=1, keepdims=True)
        g = np.maximum(1 - alpha * N / (P + 1e-20), 10 ** (floor_db / 20) ** 2)
        g = np.sqrt(uniform_filter1d(g, 5, axis=1))
        _, y = istft(X * g, fs=sr, nperseg=1024, noverlap=768)
        out[:, c] = y[: len(x)] if len(y) >= len(x) else np.pad(y, (0, len(x) - len(y)))
    return out


def prepare(x, it):
    """What the pick writes before trimming: one-shots are denoised, loops/beds are left as generated."""
    if it["loop"] or it["cat"].startswith("amb"):
        return x
    return denoise(x, SR_GEN)


def region(x, it):
    """The part of a take that ends up in the game: the loop span, or the trimmed one-shot."""
    if it["loop"]:
        s, d, xf = loop_params(it)
        return x[int(s * SR_GEN) : int((s + d + xf) * SR_GEN)]
    a, b = trim_bounds(x.mean(axis=1), SR_GEN, it)
    return x[a:b]


def analyse(x, sr, it):
    """Return (metrics, flags, hard_reject)."""
    m = x.mean(axis=1)
    flags, hard = [], False
    peak = float(np.abs(x).max())
    met = {"peak_db": round(float(db(peak)), 1)}
    ft = flat_tops(m)
    met["flat_tops"] = ft
    if ft > 3:
        flags.append("clipping"); hard = True
    e, h = env(m, sr, 0.02)
    met["max_rms_db"] = round(float(e.max()), 1)
    if e.max() < -50:
        flags.append("silent"); hard = True
    # an event must stand out of its own take: a one-shot whose loudest 20 ms is < 12 dB over the median
    # frame is a noise bed, not the sound asked for
    # (sustained one-shots, > 3 s like the freewheel coast-down, are a texture end to end: no crest test)
    met["crest_db"] = round(float(e.max() - np.median(e)), 1)
    if not (it["loop"] or it["duration"] > 3) and met["crest_db"] < 12:
        flags.append("no_event"); hard = True
    act = e > e.max() - 30
    met["active_s"] = round(float(act.sum() * 0.02), 2)
    if act.sum() * 0.02 < 0.04:
        flags.append("too_short"); hard = True
    sfm = spectral_flatness(m, sr)
    e2, _ = env(m, sr, 512 / sr)
    k = min(len(sfm), len(e2))
    w = e2[:k] > e2[:k].max() - 25
    met["flatness"] = round(float(np.median(sfm[:k][w])) if w.any() else 1.0, 4)
    # sample-level glitches: a step far above the signal's own step distribution
    # (isolated: the step is also far above the local level around it, so a sharp attack doesn't count)
    st = np.abs(np.diff(m))
    p999 = np.percentile(st, 99.9) + 1e-9
    worst = 0.0
    for i in np.where(st > 6 * p999)[0][:200]:
        w = 120  # ~2.7 ms each side
        loc = np.concatenate([m[max(0, i - w) : i], m[i + 2 : i + 2 + w]])
        r = st[i] / (np.sqrt((loc ** 2).mean()) + 1e-9)
        worst = max(worst, float(r))
    met["glitch"] = round(worst, 1)
    if worst > 8:
        flags.append("glitch")
    # sudden level jumps (50 ms frames): a rise of > 24 dB in one frame after the sound is going
    e5, _ = env(m, sr, 0.05)
    jumps = np.diff(e5)
    first = int(np.argmax(e5 > e5.max() - 30))
    met["max_jump_db"] = round(float(jumps[first + 2 :].max()) if len(jumps) > first + 2 else 0.0, 1)
    if it["loop"] or it["cat"].startswith("amb"):
        s, d, xf = loop_params(it)
        a, b = int(s * sr), int((s + d + xf) * sr)
        seg = m[a:b]
        e1, _ = env(seg, sr, 0.5)
        met["level_std_db"] = round(float(np.std(e1)), 2)
        if np.std(e1) > (5 if it["cat"].startswith("amb") or it["cat"] == "radio" else 6):
            flags.append("unsteady")
        if met["max_jump_db"] > 18:
            flags.append("level_jump")
        # seam: the head window is crossfaded with the window just past the loop end
        X = int(xf * sr)
        head, tail = m[a : a + X], m[a + int(d * sr) : a + int(d * sr) + X]
        met["seam_db"] = round(float(abs(db(np.sqrt((head ** 2).mean())) - db(np.sqrt((tail ** 2).mean())))), 2)

        def spec(v):
            S = np.abs(np.fft.rfft(v[: (len(v) // 2048) * 2048].reshape(-1, 2048) * np.hanning(2048), axis=1)).mean(0)
            return np.log(S + 1e-6)
        sh, stl = spec(head), spec(tail)
        met["seam_spec"] = round(float(np.mean(np.abs(sh - stl))), 3)
        if met["seam_db"] > 3 or met["seam_spec"] > 0.6:
            flags.append("seam")
        # silence holes inside a bed
        if (e1 < e1.max() - 25).any():
            flags.append("dropout")
    else:
        a, b = trim_bounds(m, sr, it)
        met["trim"] = [round(a / sr, 3), round(b / sr, 3)]
        w = m[a:b]
        ew, _ = env(w, sr, 0.02)
        # level of the last 20 ms against the window's peak: still loud there means the cut truncates it
        met["tail_db"] = round(float(ew[-1] - ew.max()), 1) if len(ew) else 0.0
        if met["tail_db"] > -18 and it["duration"] <= 6:
            flags.append("overruns")
        # sudden jumps inside the shipped window (a second event slammed in, or a glitchy burst)
        if len(ew) > 3 and np.diff(ew)[1:].max(initial=-99) > 30:
            flags.append("level_jump")
        # the window must hold the sound, not a stray quiet bit
        if ew.max() < e.max() - 12:
            flags.append("weak_event")
    return met, flags, hard


def clap_embed(paths_or_arrays, texts, device):
    import torch
    from transformers import ClapModel, ClapProcessor
    import librosa

    proc = ClapProcessor.from_pretrained(CLAP_REPO, revision=CLAP_REV)
    model = ClapModel.from_pretrained(CLAP_REPO, revision=CLAP_REV, use_safetensors=True).eval().to(device)
    with torch.no_grad():
        ti = proc(text=texts, return_tensors="pt", padding=True)
        t = model.get_text_features(**{k: v.to(device) for k, v in ti.items()})
        t = getattr(t, "pooler_output", t)
        t = torch.nn.functional.normalize(t, dim=-1).cpu().numpy()
        out = []
        for x in paths_or_arrays:
            # 10 s windows (CLAP's input length), embeddings averaged
            y = librosa.resample(x.mean(axis=1), orig_sr=SR_GEN, target_sr=48000)
            win = 480000
            chunks = [y[i : i + win] for i in range(0, max(1, len(y) - win // 4), win)] or [y]
            ai = proc(audio=chunks, sampling_rate=48000, return_tensors="pt")
            a = model.get_audio_features(**{k: v.to(device) for k, v in ai.items()})
            a = getattr(a, "pooler_output", a)
            a = torch.nn.functional.normalize(a, dim=-1).mean(0)
            out.append(torch.nn.functional.normalize(a, dim=-1).cpu().numpy())
    return np.stack(out), t


def cmd_score(root, items):
    import soundfile as sf
    import torch

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    path = os.path.join(root, ".cache/sfx/gen/scores.json")
    try:
        scores = json.load(open(path))
    except Exception:
        scores = {}
    for it in items:
        d = os.path.join(root, ".cache/sfx/gen/takes", it["name"])
        takes = sorted(f for f in os.listdir(d) if f.endswith(".wav")) if os.path.isdir(d) else []
        if not takes:
            continue
        xs = [prepare(sf.read(os.path.join(d, f), dtype="float32", always_2d=True)[0], it) for f in takes]
        emb, temb = clap_embed([region(x, it) for x in xs], [it["prompt"]], device)
        rows = {}
        for f, x, a in zip(takes, xs, emb):
            met, flags, hard = analyse(x, SR_GEN, it)
            met["clap"] = round(float(a @ temb[0]), 4)
            rows[f] = {"clap": met["clap"], "metrics": met, "flags": flags, "reject": hard, "emb": [round(float(v), 5) for v in a]}
        loud = max(r["metrics"]["max_rms_db"] for r in rows.values())
        bed = it["loop"] or it["cat"].startswith("amb")  # a quiet room tone is right, not a failed take
        for r in rows.values():
            if not bed and r["metrics"]["max_rms_db"] < loud - 18 and not r["reject"]:
                r["flags"].append("quiet"); r["reject"] = True  # mostly a near-empty take
        # spectral flatness relative to the item's other takes (a take much noisier than its siblings)
        fl = np.array([r["metrics"]["flatness"] for r in rows.values()])
        med, mad = np.median(fl), np.median(np.abs(fl - np.median(fl))) + 1e-4
        for r in rows.values():
            z = (r["metrics"]["flatness"] - med) / (1.4826 * mad)
            r["metrics"]["flatness_z"] = round(float(z), 2)
            if z > 3 and r["metrics"]["flatness"] > 0.05:
                r["flags"].append("noisy")
            pen = 0.04 * len([f for f in r["flags"] if f not in ("overruns",)]) + (0.02 if "overruns" in r["flags"] else 0)
            r["score"] = round(r["clap"] - pen - (1.0 if r["reject"] else 0.0), 4)
        scores[it["name"]] = {"prompt": it["prompt"], "takes": rows}
        best = max(rows.values(), key=lambda r: r["score"])
        log(f"  {it['name']}: {len(rows)} takes, CLAP {min(r['clap'] for r in rows.values()):.3f}..{max(r['clap'] for r in rows.values()):.3f}, best score {best['score']:.3f}, "
            f"flagged {sum(bool(r['flags']) for r in rows.values())}, rejected {sum(r['reject'] for r in rows.values())}")
        json.dump(scores, open(path, "w"), indent=1)


def cmd_pick(root, items):
    import soundfile as sf

    scores = json.load(open(os.path.join(root, ".cache/sfx/gen/scores.json")))
    out = os.path.join(root, ".cache/sfx/dl/gen")
    os.makedirs(out, exist_ok=True)
    picks_path = os.path.join(root, ".cache/sfx/gen/picks.json")
    try:
        picks = json.load(open(picks_path))
    except Exception:
        picks = {}
    for it in items:
        sc = scores.get(it["name"])
        if not sc:
            log(f"  ! {it['name']}: no scored takes")
            continue
        rows = sorted(sc["takes"].items(), key=lambda kv: -kv[1]["score"])
        chosen = []
        top = max((r["clap"] for _, r in rows if not r["reject"]), default=0.0)
        floor = max(MIN_CLAP, top - 0.15)  # a pick must still be about the prompt
        veto = it.get("exclude", {})  # {take: reason}: takes rejected by listening / scripts/sfx/qa.py
        rows = [(f, r) for f, r in rows if f not in veto]
        for f, r in rows:
            if r["reject"] or r["clap"] < floor:
                continue
            e = np.array(r["emb"])
            if any(float(e @ np.array(sc["takes"][g]["emb"])) > 0.97 for g in chosen):
                continue
            chosen.append(f)
            if len(chosen) == it["variants"]:
                break
        if len(chosen) < it["variants"]:  # not enough distinct ones: fill with near-duplicates above the floor
            for f, r in rows:
                if not r["reject"] and r["clap"] >= floor and f not in chosen and len(chosen) < it["variants"]:
                    chosen.append(f)
        if len(chosen) < it["variants"]:
            log(f"  ! {it['name']}: only {len(chosen)} of {it['variants']} usable takes (add extra_takes or rephrase)")
        for old in os.listdir(out):
            if old.startswith(it["name"] + "_") and old[len(it["name"]) + 1 : -4].isdigit():
                os.remove(os.path.join(out, old))
        info = []
        for i, f in enumerate(chosen):
            x, sr = sf.read(os.path.join(root, ".cache/sfx/gen/takes", it["name"], f), dtype="float32", always_2d=True)
            x = prepare(x, it)
            if not it["loop"]:
                a, b = sc["takes"][f]["metrics"]["trim"]
                x = x[int(a * sr) : int(b * sr)]
            name = f"{it['name']}_{i + 1:02d}.wav"
            sf.write(os.path.join(out, name), x, sr, subtype="FLOAT")
            r = sc["takes"][f]
            info.append({"file": name, "take": f, "clap": r["clap"], "score": r["score"], "flags": r["flags"], "dur": round(len(x) / sr, 3)})
        picks[it["name"]] = info
        log(f"  {it['name']}: " + ", ".join(f"{p['take']} clap {p['clap']:.3f}{' ' + '/'.join(p['flags']) if p['flags'] else ''}" for p in info))
    json.dump(picks, open(picks_path, "w"), indent=1)


# ----------------------------------------------------------------------------- recipes

def cmd_recipes(root, items):
    """Write scripts/sfx/recipes-gen.json (merged into recipes.json by build.py and catalogue.py): one
    recipe per generated item plus a `sources` entry per picked file. Items not in `items` are kept."""
    path = os.path.join(root, "scripts/sfx/recipes-gen.json")
    try:
        spec = json.load(open(path))
    except Exception:
        spec = {"sources": {}, "recipes": []}
    spec["_doc"] = ("Generated SFX recipes, written by scripts/sfx/generate.py (`recipes` step) from scripts/sfx/gen-prompts.json "
                    "and the automatic picks; build.py and catalogue.py merge this into recipes.json. Sources are "
                    ".cache/sfx/dl/gen/<name>_NN.wav (picked, trimmed TangoFlux takes). Do not edit by hand: change "
                    "gen-prompts.json (an item's `recipe` holds the catalogue fields and build overrides) and re-run.")
    picks = json.load(open(os.path.join(root, ".cache/sfx/gen/picks.json")))
    recs = {r["name"]: r for r in spec["recipes"]}
    for it in items:
        p = picks.get(it["name"])
        if not p:
            continue
        files = [f"gen/{q['file']}" for q in p]
        x = it.get("recipe", {})  # catalogue fields (what, ch, replaces, bus) and build overrides
        r = {"name": it["name"], "cat": it["cat"], "src": files[0]}
        if it["loop"]:
            s, d, xf = loop_params(it)
            r.update({"mode": "loop", "start": s, "dur": d, "xfade": xf})
            if len(files) > 1:
                r["files"] = files  # build.py loops the same span of each file: <name>_01..NN.ogg
        else:
            r.update({"mode": "files", "files": files})
        r.update({k: v for k, v in x.items() if k in ("af", "fade_in", "fade_out", "ch_out", "room")})
        r["what"] = x.get("what", it["prompt"])
        r["ch"] = x.get("ch", it["cue"].split(";")[0])
        r["replaces"] = x.get("replaces", it["cue"].split(";")[1].strip() if ";" in it["cue"] else "new")
        r["bus"] = x.get("bus", "fx")
        recs[it["name"]] = r
        for k in [k for k in spec["sources"] if k.startswith(f"gen/{it['name']}_")]:
            del spec["sources"][k]
        for q in p:
            spec["sources"][f"gen/{q['file']}"] = {"pack": "gen", "model": MODEL_NAME, "prompt": it["prompt"],
                                                   "take": q["take"], "clap": q["clap"]}
    order = [i["name"] for i in json.load(open(os.path.join(root, "scripts/sfx/gen-prompts.json")))["items"]]
    rl = sorted(recs.values(), key=lambda r: order.index(r["name"]) if r["name"] in order else 999)
    src = dict(sorted(spec["sources"].items()))
    with open(path, "w") as f:  # one entry per line, like recipes.json
        f.write("{\n  \"_doc\": " + json.dumps(spec["_doc"]) + ",\n  \"sources\": {\n")
        f.write(",\n".join(f"    {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}" for k, v in src.items()))
        f.write("\n  },\n  \"recipes\": [\n")
        f.write(",\n".join("    " + json.dumps(r, ensure_ascii=False) for r in rl))
        f.write("\n  ]\n}\n")
    log(f"recipes-gen.json: {len(rl)} recipes, {len(src)} sources")


def main(argv):
    root, only, batch, pause = os.getcwd(), None, 4, 2.0
    cmds = []
    it = iter(argv)
    for a in it:
        if a == "--root": root = next(it)
        elif a == "--only": only = set(next(it).split(","))
        elif a == "--batch": batch = int(next(it))
        elif a == "--pause": pause = float(next(it))
        else: cmds.append(a)
    root = os.path.abspath(root)
    meta = json.load(open(os.path.join(root, "scripts/sfx/gen-prompts.json")))
    items = [i for i in meta["items"] if not only or i["name"] in only]
    for c in cmds or ["all"]:
        if c in ("gen", "all"): cmd_gen(root, items, batch, meta.get("negative_prompt_default", ""), pause)
        if c in ("score", "all"): cmd_score(root, items)
        if c in ("pick", "all"): cmd_pick(root, items)
        if c in ("recipes", "all"): cmd_recipes(root, items)


if __name__ == "__main__":
    main(sys.argv[1:])
