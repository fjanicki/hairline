#!/usr/bin/env python3
"""
qc_scan.py — extract the first speaker's (female) audio from a multi-speaker
CC-licensed recording, quality-screen her clips, and build a Chatterbox reference
(12-20 s, 24 kHz, -20 dBFS) from the best clips.

Speaker selection: 2 s ECAPA windows, agglomerative clustering k=2..6; her cluster
is the female one (median p_female >= 0.5) with the highest *purity* (fraction of
the cluster's own windows with p_female >= 0.5; gate 0.75 rejects 50/50 under-splits)
and the largest pure coverage (rejects over-split fragments). Clips are cut from
contiguous runs of her accepted windows (her cluster, p_female >= 0.5): a rejected
turn always splits a run and is never copied. Each final clip is re-checked
per-clip (audeering, 16 kHz input) — mixed/overlap clips are dropped.

All local: silero-VAD + SpeechBrain ECAPA + sklearn + audeering age/gender
(.cache/tts/A/tools/agegender.py) + quality.py + mlx-whisper. No remote services.

State (W = ~/hairline-clone/work/qc/): timeline.json, diar.json, clips.json,
clips/*.wav, pool.wav; output ref in ~/hairline-clone/refs2/.

Usage:
  qc_scan.py asr [src.mp3]
  qc_scan.py diar
  qc_scan.py refs
  qc_scan.py all
"""
import argparse
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

D = Path.home() / "hairline-clone"
W = D / "work" / "qc"
REFDIR = D / "refs2"
SRC = Path.home() / "Downloads" / "qc_creative_common.mp3"
JINGLE_END = 0.0  # s: opening mask; 0.0 — transcript shows her speaking from 0.0 s
sys.path.insert(0, str(Path(__file__).resolve().parent))
import quality as Q  # noqa: E402

CLIPS = W / "clips"
DEV = "mps" if torch.backends.mps.is_available() else "cpu"
BRIDGE = 0.5  # s: merge accepted windows across short pauses; a rejected turn
              # is >= 2 s (one window) wide, so it always splits, never bridges


def log(msg: str) -> None:
    print(f"[qc] {msg}", flush=True)


def md5(p: Path) -> str:
    h = hashlib.md5()
    for b in p.open("rb"):
        h.update(b)
    return h.hexdigest()


def load_wav(name: str, sr: int) -> np.ndarray:
    p = W / f"full{sr // 1000}k.wav"
    if not p.exists():
        p.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(SRC),
                        "-ac", "1", "-ar", str(sr), str(p)], check=True)
    y, _ = sf.read(p, dtype="float32", always_2d=True)
    return y.mean(1)


def asr(src: Path = SRC) -> None:
    """mlx-whisper large-v3-turbo, French, word timestamps -> timeline.json."""
    tl = W / "timeline.json"
    if tl.exists():
        log("timeline.json exists, skipping asr")
        return
    import mlx_whisper

    W.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    y, _ = sf.read(W / "full24k.wav", dtype="float32", always_2d=True)
    r = mlx_whisper.transcribe(y.mean(1).astype(np.float32),
                               path_or_hf_repo="mlx-community/whisper-large-v3-turbo",
                               language="fr", word_timestamps=True, verbose=False)
    segs = []
    for s in r["segments"]:
        words = [{"w": w["word"].strip(), "t": round(w["start"], 2), "e": round(w["end"], 2)}
                 for w in s.get("words", [])]
        segs.append({"start": round(s["start"], 2), "end": round(s["end"], 2),
                     "text": s["text"].strip(), "words": words})
    tl.write_text(json.dumps({"model": "mlx-community/whisper-large-v3-turbo",
                              "lang": "fr", "src": str(src), "segments": segs}, indent=1))
    log(f"asr done in {time.time() - t0:.0f} s: {len(segs)} segments")


# ---------- diarization ----------

def vad_spans(y16: np.ndarray) -> list:
    """silero-VAD speech spans (in seconds), the opening jingle excluded."""
    import silero_vad

    model = silero_vad.load_silero_vad()
    start = int(JINGLE_END * 16000)
    tail = torch.from_numpy(np.ascontiguousarray(y16[start:])).float()
    ts = silero_vad.get_speech_timestamps(
        tail, model, sampling_rate=16000, threshold=0.5,
        min_silence_duration_ms=250, speech_pad_ms=40)
    out = []
    for t in ts:
        s = t["start"] / 16000 + start / 16000
        e = t["end"] / 16000 + start / 16000
        if e - s >= 0.8:
            out.append((s, e))
    return out


def ecapa_embed() -> torch.nn.Module:
    from speechbrain.inference.speaker import EncoderClassifier
    return EncoderClassifier.from_hparams(
        source="speechbrain/spkrec-ecapa-voxceleb",
        savedir=Path.home() / ".cache" / "huggingface" / "speechbrain-ecapa")


def cluster(spans: list, y16: np.ndarray, emb: torch.nn.Module):
    """2 s windows over speech; agglomerative cosine clustering (silhouette-picked k).
    Returns (labels per span-second window, n_clusters, silhouette)."""
    from sklearn.cluster import AgglomerativeClustering
    from sklearn.metrics import silhouette_score

    step, win = 2.0, 2.0
    times, X, idx = [], [], []  # idx: window -> span position
    for i, (s, e) in enumerate(spans):
        t = s
        while t + win <= e:
            x = np.ascontiguousarray(y16[int(t * 16000):int((t + win) * 16000)])
            if len(x) == 16000 * win:
                with torch.no_grad():
                    vec = emb.encode_batch(torch.from_numpy(x)[None].to(DEV)).cpu().numpy()[0]
                X.append(vec / (np.linalg.norm(vec) + 1e-9)); times.append(t + win / 2); idx.append(i)
            t += step
    if not X:
        raise SystemExit("no windows")
    X = np.array(X)
    best = (0, 1, 0.0)
    for k in range(2, 6):
        lab = AgglomerativeClustering(n_clusters=k, metric="precomputed",
                                      linkage="average").fit_predict(1 - X @ X.T)
        sc = float(silhouette_score(1 - X @ X.T, lab, metric="precomputed"))
        if sc > best[2]:
            best = (sc, k, lab)
    _, k, lab = best
    return lab, k, float(best[0])


def window_gender(y16: np.ndarray):
    """per-window (p_female, apparent age) via project .cache/tts/A/tools/agegender.py."""
    sys.path.insert(0, str(Path(__file__).resolve().parents[3] / ".cache" / "tts" / "A" / "tools"))
    import agegender
    model = agegender.AgeGender(device=DEV)
    pf, age = [], []
    for i, t in enumerate(times_global):
        x = y16[int((t - 1.0) * 16000):int((t + 1.0) * 16000)]  # true window: center ± 1 s
        if len(x) < 16000:
            pf.append(None); age.append(None)
            continue
        r = model(x.astype("float32"))
        pf.append(float(r["p_female"])); age.append(float(r["age"]))
        if (i + 1) % 50 == 0:
            log(f"gender: {i + 1}/{len(times_global)}")
    return pf, age


times_global = []  # set in diar()


def make_clips(y24: np.ndarray, acc: list) -> list:
    """Cut clips from contiguous runs of accepted speaker windows ([s, e] each).
    Adjacent accepted windows merge (gap <= BRIDGE); a rejected turn is always
    >= 1 window wide, so it splits the run — male turns are never copied,
    even inside a VAD span that is mostly hers. 24 kHz, 60 ms pad, 20 ms fades."""
    CLIPS.mkdir(parents=True, exist_ok=True)
    segs, cur = [], None
    for s, e in sorted(acc):
        if cur is not None and s - cur[1] <= BRIDGE:
            cur[1] = e
        else:
            if cur:
                segs.append(cur)
            cur = [s, e]
    if cur:
        segs.append(cur)
    out, n = [], 0
    for s, e in segs:
        if e - s < 1.0:  # lone partial window: too short, drop
            continue
        pad = 0.06
        a, b = max(0.0, s - pad), e + pad
        x = y24[int(a * 24000):int(b * 24000)]
        fade = int(0.02 * 24000)
        x[:fade] *= np.linspace(0, 1, fade, dtype=np.float32)
        x[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
        fp = CLIPS / f"qc_{n:03d}.wav"
        sf.write(fp, x, 24000, subtype="PCM_16")
        out.append({"file": fp.name, "start": round(a, 2), "end": round(b, 2),
                    "dur": round(len(x) / 24000, 2)})
        n += 1
    return out


def score_clips(clips: list):
    """quality.py per clip (measured on 24 kHz, as in cml_scan). Sorted by q desc."""
    for c in clips:
        y, sr = sf.read(CLIPS / c["file"], dtype="float32", always_2d=True)
        r = Q.measure(y.mean(1), int(sr))
        c["quality"] = {k: v for k, v in r.items() if k != "dnsmos"}
        c["dnsmos"] = r["dnsmos"]
        c["q"] = Q.qscore(r)
    clips.sort(key=lambda c: -c["q"])
    for n, c in enumerate(clips):
        c["rank"] = n + 1
    return clips


def annotate(clips: list):
    """Attach whisper text overlapping each clip (timeline.json) and persist clips.json."""
    tl = W / "timeline.json"
    d = json.loads(tl.read_text()) if tl.exists() else {}
    segs = d.get("segments") or d.get("segs") or []
    for c in clips:
        txt = []
        for s in segs:
            if s["end"] > c["start"] + 0.3 and s["start"] < c["end"] - 0.3:
                txt.append(s["text"])
        c["text"] = " ".join(txt)
    (W / "clips.json").write_text(json.dumps(clips, indent=1))


def verify_gender(clips: list, y16: np.ndarray) -> list:
    """Per-clip gender check vs the 16 kHz source (audeering wants 16k in).
    Drops clips not clearly female (overlap/mixed speech); rewrites clips.json."""
    sys.path.insert(0, str(Path(__file__).resolve().parents[3] / ".cache" / "tts" / "A" / "tools"))
    import agegender
    model = agegender.AgeGender(device=DEV)
    keep, drop = [], []
    for c in clips:
        x = y16[int(c["start"] * 16000): int(c["end"] * 16000)]
        if len(x) < 16000:
            drop.append((c, None))
            continue
        r = model(x.astype("float32"))
        c["p_female"] = round(float(r["p_female"]), 3)
        c["age"] = round(float(r["age"]), 1)
        (keep if c["p_female"] >= 0.5 else drop).append((c, float(r["p_female"])))
    for c, pf in drop:
        f = CLIPS / c["file"]
        if f.exists():
            f.unlink()
        log(f"dropped {c['file']} ({c['dur']:.1f} s): p_female={pf if pf is not None else 'n/a'}")
    log(f"gender check: {len(keep)} kept, {len(drop)} dropped "
        f"({sum(c['dur'] for c, _ in drop) / 60:.2f} min mixed/overlap)")
    out = [c for c, _ in keep]
    (W / "clips.json").write_text(json.dumps(out, indent=1))
    return out


# ---------- refs ----------

def norm_rms(x: np.ndarray, target=0.1) -> np.ndarray:
    r = np.sqrt(np.mean(x ** 2))
    return x * (target / r) if r > 1e-6 else x


def refs(clips: list, min_d=12.0, max_d=20.0):
    """Best-first concatenation (12-20 s, 24 kHz, -20 dBFS) + full pool."""
    if not clips:
        raise SystemExit("no clips (run diar first)")
    REFDIR.mkdir(parents=True, exist_ok=True)
    h8 = md5(SRC)[:8]
    gap = np.zeros(int(0.3 * 24000), dtype=np.float32)
    parts, t = [], 0.0
    for c in clips:  # already sorted best-first
        x, _ = sf.read(CLIPS / c["file"], dtype="float32")
        if t >= max_d:
            break
        x = norm_rms(x)
        if t + len(x) / 24000 <= min_d or t == 0.0:
            parts.append(x); t += len(x) / 24000
        else:
            keep = int((max_d - t) * 24000)
            parts.append(x[:keep]); t += keep / 24000
            break
    out = np.concatenate(parts)
    fp = REFDIR / f"qc_{h8}.wav"
    sf.write(fp, out, 24000, subtype="PCM_16")
    x, sr = sf.read(fp, dtype="float32", always_2d=True)
    q = Q.measure(x.mean(1), int(sr))
    log(f"ref {fp.name}: {len(out) / 24000:.1f} s, q={Q.qscore(q)}, "
        f"snr={q['snr']:.0f} dB, presence={q['presence']:.2f}, dnsmos_ovr={q['dnsmos']['ovr']:.2f}")
    # full pool
    allx, t = [], 0.0
    for c in clips:
        x, _ = sf.read(CLIPS / c["file"], dtype="float32")
        allx.append(norm_rms(x))
        if t > 0:
            allx.append(gap)
        t += len(x) / 24000
    pf = W / "pool.wav"
    sf.write(pf, np.concatenate(allx), 24000, subtype="PCM_16")
    log(f"pool {pf}: {len(np.concatenate(allx)) / 24000:.0f} s ({len(clips)} clips)")
    return fp


def diar(src: Path = SRC) -> None:
    W.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    y16 = load_wav("16", 16000)
    spans = vad_spans(y16)
    log(f"vad: {len(spans)} spans, {sum(e - s for s, e in spans):.0f} s speech "
        f"(jingle {JINGLE_END:.1f} s masked)")
    emb = ecapa_embed()
    global times_global
    step, win = 2.0, 2.0
    X, idx, times_global = [], [], []
    for i, (s, e) in enumerate(spans):
        t = s
        while t + win <= e:
            x = np.ascontiguousarray(y16[int(t * 16000):int((t + win) * 16000)])
            if len(x) == int(16000 * win):
                with torch.no_grad():
                    vec = emb.encode_batch(torch.from_numpy(x)[None].to(DEV)).cpu().numpy().ravel()
                X.append(vec / (np.linalg.norm(vec) + 1e-9))
                times_global.append(t + win / 2); idx.append(i)
            t += step
    log(f"ecapa: {len(X)} windows in {time.time() - t0:.0f} s")
    from sklearn.cluster import AgglomerativeClustering
    from sklearn.metrics import silhouette_score
    X = np.asarray(X, dtype=np.float32)
    D = np.clip(1.0 - X @ X.T, 0.0, 2.0)
    np.fill_diagonal(D, 0.0)
    # Her cluster must be (a) female (median p_female >= 0.5) and (b) clean:
    #   purity = fraction of the cluster's own windows with p_female >= 0.5 (>= 0.75).
    #   Under-split (k too small) drags in another speaker -> purity ~0.5-0.7 -> rejected.
    #   Over-split  (k too large) fragments her             -> less coverage -> rejected.
    # Among qualifying female clusters, take the largest pure coverage (tie: smaller k).
    log("gender: scoring all windows (one pass)")
    pf_win, age_win = window_gender(y16)

    def _gen(lab):
        out = {}
        for c in range(max(lab) + 1):
            fs = [pf_win[i] for i in range(len(lab)) if lab[i] == c and pf_win[i] is not None]
            ag_ = [age_win[i] for i in range(len(lab)) if lab[i] == c and age_win[i] is not None]
            out[c] = {"p_female": float(np.median(fs)) if fs else None,
                      "age": float(np.mean(ag_)) if ag_ else None}
        return out

    best = None  # (pure_s, -k, k, lab, c, gen, sc, purity)
    for k in range(2, 7):
        lab_k = AgglomerativeClustering(n_clusters=k, metric="precomputed",
                                        linkage="average").fit_predict(D)
        sc_k = float(silhouette_score(D, lab_k, metric="precomputed"))
        gen_k = _gen(lab_k)
        fem = [c for c in range(k) if (gen_k[c]["p_female"] or 0) >= 0.5]
        log(f"k={k}: sil={sc_k:.3f} " + " ".join(
            f"c{c}:t0={min(times_global[i] for i in range(len(lab_k)) if lab_k[i] == c):.0f}s"
            f":{sum(1 for i in range(len(lab_k)) if lab_k[i] == c) * 2:.0f}s"
            f":pf={(gen_k[c]['p_female'] or 0):.2f}" for c in range(k))
            + (f"  FEMALE={fem}" if fem else ""))
        for c in fem:
            js = [i for i in range(len(lab_k)) if lab_k[i] == c]
            raw = len(js) * 2
            pure = sum(1 for i in js if (pf_win[i] or 0) >= 0.5) * 2
            purity = pure / raw if raw else 0.0
            log(f"   c{c}: purity={purity:.2f} pure={pure:.0f}s raw={raw:.0f}s")
            if purity < 0.75:  # 50/50 under-split merges score ~0.5; true cluster stays
                continue
            cand = (pure, -k, k, lab_k, c, gen_k, sc_k, purity)
            if best is None or cand[0] > best[0] + 1 or (
                    abs(cand[0] - best[0]) <= 1 and cand[1] > best[1]):
                best = cand
    if best is None:
        raise SystemExit("no clean female cluster found — check by ear")
    pure, neg_k, k, lab, c, gen, sc, purity = best
    first = int(c)
    log(f"selected cluster {first} (k={k}): p_female={gen[first]['p_female']:.2f}, "
        f"age={gen[first]['age']:.0f}, purity={purity:.2f}, {pure:.0f} s speech")
    stats = {}
    for c in sorted(set(lab)):
        segs_c = [j for j, l in enumerate(lab) if l == c]
        stats[str(c)] = {"win": len(segs_c),
                         "t0": round(min(times_global[j] for j in segs_c), 1),
                         "speech_s": round(len(segs_c) * 2.0, 0)}
    gen_first = gen.get(int(first)) or {"p_female": None, "age": None}
    log(f"first speaker (cluster {first}): p_female={gen_first['p_female']:.2f}, "
        f"apparent age={gen_first['age']:.0f} (expect female)")
    if gen_first["p_female"] is None or gen_first["p_female"] < 0.5:
        log("WARNING: first speaker does not classify as female — check by ear")
    (W / "diar.json").write_text(json.dumps(
        {"src": str(src), "md5": md5(src), "jingle_end": JINGLE_END,
         "speech_s": round(sum(e - s for s, e in spans), 1),
         "n_spans": len(spans), "k": k, "silhouette": round(float(sc), 4),
         "clusters": stats, "gender": gen, "first_speaker": int(first)}, indent=1))
    # accepted = her windows (her cluster AND p_female >= 0.5); cut their intervals,
    # never bridging rejected turns (see make_clips)
    acc = [(times_global[i] - 1.0, times_global[i] + 1.0)
           for i in range(len(times_global))
           if lab[i] == first and (pf_win[i] or 0) >= 0.5]
    log(f"accepted windows: {len(acc)} ({sum(e - s for s, e in acc) / 60:.1f} min)")
    clips = make_clips(load_wav("24", 24000), acc)
    log(f"clips: {len(clips)} ({sum(c['dur'] for c in clips) / 60:.1f} min)")
    clips = score_clips(clips)
    annotate(clips)
    clips = verify_gender(clips, y16)
    log(f"done in {time.time() - t0:.0f} s; top clips:")
    for c in clips[:5]:
        log(f"  q={c['q']:.2f} {c['file']} ({c['dur']:.1f} s) {c.get('text', '')[:80]}")


def run_all(src: Path = SRC) -> None:
    asr(src)
    diar(src)
    refs(json.loads((W / "clips.json").read_text()))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["asr", "diar", "refs", "all"])
    ap.add_argument("src", nargs="?", default=str(SRC))
    a = ap.parse_args()
    src = Path(a.src).expanduser()
    {"asr": lambda: asr(src),
     "diar": lambda: diar(src),
     "refs": lambda: refs(json.loads((W / "clips.json").read_text())),
     "all": lambda: run_all(src)}[a.cmd]()
