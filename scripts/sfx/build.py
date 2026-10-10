#!/usr/bin/env python3
"""Build HAIRLINE's recorded SFX from the cached originals.

    .cache/sfx/venv/bin/python -I scripts/sfx/build.py --root <repo> [--dl <dir>] [--out <dir>] [--force] [--only name,...]

Reads scripts/sfx/recipes.json (sources under synth/ are rendered first by scripts/sfx/synth.py). For each recipe: decode the source region with ffmpeg (plus the recipe's
`af` filter chain, resampled to 48 kHz), slice it (seg / onsets / strokes / loop / concat / files), fold to
mono for point sources, add an optional synthetic room tail, fade, make loops seamless (equal-power
crossfade of the loop's tail into its head, so the last sample runs straight into the first), normalise
per category (integrated LUFS for beds, max momentary LUFS for one-shots), cap the true peak at -1 dBTP
(4x oversampled), and encode Ogg Opus into <out>/<name>[_NN].ogg. The encode is decoded and measured again:
Opus drops 1-2 dB of K-weighted loudness on bright, noisy material (sanding, brushes, shutters), so the gain
is corrected and the file re-encoded, within the true-peak ceiling (scripts/sfx/qa.py found it).

Idempotent: a hash of each recipe (+ its sources' metadata, size and mtime, the categories and this file's
BUILD_VERSION) is kept in
<dl>/../build-state.json; unchanged recipes whose outputs exist are skipped. Writes <out>/sfx.json (the
manifest: files, loop, duration, channels, loudness) on every run.
"""
import hashlib
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.signal import butter, resample_poly, sosfilt

BUILD_VERSION = 8  # 7: post-encode loudness correction; source contents in the hash. 8: best-of encode under the TP ceiling
SR = 48000
TP_CEIL = -1.5  # dBTP before encoding (Opus overshoots by up to ~0.5 dB; the shipped files stay <= -1 dBTP)
TP_OUT = -1.2  # dBTP ceiling of the decoded file when the post-encode loudness correction raises the gain


def log(*a):
    print(*a, flush=True)


# ------------------------------------------------------------------ decode

def decode(path, start=None, dur=None, af=None):
    """Float32 (n, 2) at 48 kHz. Mono sources come back duplicated."""
    cmd = ["ffmpeg", "-nostdin", "-v", "error"]
    if start is not None:
        cmd += ["-ss", f"{start:.4f}"]
    if dur is not None:
        cmd += ["-t", f"{dur:.4f}"]
    chain = [af] if af else []
    chain.append(f"aresample={SR}:filter_size=64:cutoff=0.97")
    cmd += ["-i", path, "-af", ",".join(chain), "-ac", "2", "-f", "f32le", "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def decode_out(path, ch):
    """A built file decoded at its own channel count (decode() upmixes mono to stereo at -3 dB per side)."""
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-ac", str(ch), "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, ch).copy()


def db(v):
    return 20 * np.log10(np.maximum(v, 1e-12))


def env_db(m, win=0.02):
    h = max(1, int(SR * win))
    n = len(m) // h
    if n == 0:
        return np.array([-120.0]), h
    e = np.sqrt((m[: n * h].reshape(n, h) ** 2).mean(axis=1))
    return db(e), h


# ------------------------------------------------------------------ slicers

def pick_spread(cands, count, min_gap):
    """cands: [(t, level)]. Drop loud outliers (> median + 6 dB), take the loudest spaced >= min_gap."""
    if not cands:
        return []
    lv = np.array([c[1] for c in cands])
    med = np.median(lv)
    pool = sorted([c for c in cands if c[1] <= med + 6], key=lambda c: -c[1])
    out = []
    for t, v in pool:
        if all(abs(t - u) >= min_gap for u, _ in out):
            out.append((t, v))
        if len(out) == count:
            break
    return sorted(out)


def find_onsets(m, thresh=12.0, hop=0.005):
    e, h = env_db(m, hop)
    w = int(0.15 / hop)
    out, last = [], -1e9
    for i in range(w, len(e)):
        base = np.median(e[i - w : i])
        if e[i] - base > thresh and (i - last) * hop > 0.1 and e[i] > -55:
            j = i + int(np.argmax(e[i : i + 10]))
            out.append((j * hop, float(e[j])))
            last = i
    return out


def find_strokes(m, min_len, max_len):
    """Segments between envelope minima (60 ms smoothed 20 ms RMS)."""
    e, h = env_db(m, 0.02)
    k = 3
    s = np.convolve(e, np.ones(k) / k, mode="same")
    mins = [i for i in range(2, len(s) - 2) if s[i] <= s[i - 1] and s[i] <= s[i + 1] and s[i] < np.max(s[max(0, i - 10) : i + 10]) - 6]
    out = []
    for a, b in zip(mins, mins[1:]):
        L = (b - a) * 0.02
        if min_len <= L <= max_len:
            out.append((a * 0.02, L, float(np.max(s[a:b]))))
    return out


# ------------------------------------------------------------------ processing

def to_channels(x, ch):
    if ch == 1:
        return x.mean(axis=1, keepdims=True)
    return x


def room(x, spec, seed=7):
    """Convolve with a synthetic dark room tail: decaying low-passed noise, mixed wet/dry."""
    rng = np.random.default_rng(seed)
    n = int(SR * spec["len"])
    ir = rng.standard_normal(n) * np.exp(-np.linspace(0, 7, n))
    sos = butter(2, spec["lp"] / (SR / 2), output="sos")
    ir = sosfilt(sos, ir)
    ir /= np.sqrt((ir ** 2).sum()) + 1e-12
    tail = np.zeros((len(x) + n - 1, x.shape[1]), dtype=np.float32)
    for c in range(x.shape[1]):
        tail[:, c] = np.convolve(x[:, c], ir)
    dry = np.zeros_like(tail)
    dry[: len(x)] = x
    mix = spec["mix"]
    wet_gain = np.sqrt((x ** 2).sum()) / (np.sqrt((tail ** 2).sum()) + 1e-12)
    return (dry * (1 - mix) + tail * wet_gain * mix).astype(np.float32)


def fades(x, fin, fout):
    n = len(x)
    a = min(n // 2, int(SR * fin))
    b = min(n // 2, int(SR * fout))
    if a > 0:
        x[:a] *= (np.sin(np.linspace(0, np.pi / 2, a)) ** 2)[:, None]
    if b > 0:
        x[n - b :] *= (np.cos(np.linspace(0, np.pi / 2, b)) ** 2)[:, None]
    return x


def make_loop(x, dur, xfade):
    """x holds dur + xfade seconds. Returns dur seconds whose end runs seamlessly into its start."""
    L = int(SR * dur)
    X = int(SR * xfade)
    # Snap L to a rising zero crossing of the mono sum near the nominal length (cosmetic: the crossfade
    # already makes the join sample-continuous, since out[0] == x[L] follows out[L-1] == x[L-1]).
    m = x.mean(axis=1)
    lo, hi = max(X + 1, L - int(0.01 * SR)), min(len(m) - X - 1, L + int(0.01 * SR))
    zc = [i for i in range(lo, hi) if m[i - 1] < 0 <= m[i]]
    if zc:
        L = min(zc, key=lambda i: abs(i - L))
    out = x[:L].copy()
    t = np.linspace(0, np.pi / 2, X)
    fin, fout = np.sin(t)[:, None], np.cos(t)[:, None]  # equal power (uncorrelated material)
    out[:X] = x[:X] * fin + x[L : L + X] * fout
    return out


METER = pyln.Meter(SR)


def loudness(x, measure):
    pad = max(0, int(0.45 * SR) - len(x))
    y = np.concatenate([x, np.zeros((pad, x.shape[1]), dtype=x.dtype)]) if pad else x
    if measure == "integrated" and len(y) >= 3 * SR:
        return METER.integrated_loudness(y)
    # max momentary: 400 ms windows, 100 ms hop
    w, hop = int(0.4 * SR), int(0.1 * SR)
    best = -120.0
    for i in range(0, max(1, len(y) - w + 1), hop):
        v = METER.integrated_loudness(y[i : i + w])
        if np.isfinite(v):
            best = max(best, v)
    return best


def true_peak(x):
    up = resample_poly(x, 4, 1, axis=0)
    return db(np.abs(up).max())


def normalise(x, cat):
    """Gain to the category target (no peak cap yet). Returns (y, measured_lufs, true_peak_dBTP)."""
    lu = loudness(x, cat["measure"])
    y = x * (10 ** ((cat["target"] - lu) / 20))
    return y.astype(np.float32), lu, true_peak(y)


def encode(x, path, kbps):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as t:
        tmp = t.name
    try:
        sf.write(tmp, x, SR, subtype="FLOAT")
        part = path + ".part"
        subprocess.run(
            ["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", tmp, "-c:a", "libopus", "-b:a", f"{kbps}k", "-vbr", "on",
             "-compression_level", "10", "-application", "audio", "-map_metadata", "-1", "-f", "ogg", part],
            check=True,
        )
        os.replace(part, path)
    finally:
        os.unlink(tmp)


# ------------------------------------------------------------------ recipes

def clips_for(r, dl):
    src = os.path.join(dl, r["src"])
    af = r.get("af")
    mode = r["mode"]
    if mode == "seg":
        return [decode(src, s, d, af) for s, d in r["seg"]], False
    if mode == "files":
        return [decode(os.path.join(dl, f), None, None, af) for f in r["files"]], False
    if mode == "loop" and "files" in r:  # loop variants: the same loop span from each file (generated takes)
        return [decode(os.path.join(dl, f), r["start"], r["dur"] + r["xfade"], af) for f in r["files"]], True
    if mode == "loop":
        x = decode(src, r["start"], r["dur"] + r["xfade"], af)
        for mx in r.get("mix", []):
            y = decode(os.path.join(dl, mx["src"]), mx["start"], r["dur"] + r["xfade"], mx.get("af"))
            n = min(len(x), len(y))
            x = x[:n] + y[:n] * (10 ** (mx["gain_db"] / 20))
        return [x], True
    if mode == "concat":
        parts = [decode(os.path.join(dl, p["src"]), p["start"], p["dur"], af) for p in r["parts"]]
        X = int(SR * r.get("xfade", 0.3))
        out = parts[0]
        for p in parts[1:]:
            t = np.linspace(0, np.pi / 2, X)[:, None]
            seam = out[-X:] * np.cos(t) + p[:X] * np.sin(t)
            out = np.concatenate([out[:-X], seam, p[X:]])
        return [out], False
    if mode in ("onsets", "strokes"):
        a, b = r["region"]
        x = decode(src, a, b - a, af)
        m = x.mean(axis=1)
        if mode == "onsets":
            cands = find_onsets(m, r.get("thresh", 12))
            picks = pick_spread(cands, r["count"], r.get("min_gap", 1.0))
            pre, L = r.get("pre", 0.01), r["len"]
            segs = [(t - pre, L) for t, _ in picks]
        else:
            st = find_strokes(m, r["min_len"], r["max_len"])
            picks = pick_spread([(t, v) for t, _, v in st], r["count"], r.get("min_gap", 1.0))
            lens = {t: L for t, L, _ in st}
            segs = [(t, lens[t] + 0.04) for t, _ in picks]
        r["_picked"] = [round(a + s, 3) for s, _ in segs]
        clips = []
        for s, L in segs:
            i0, i1 = max(0, int(s * SR)), min(len(x), int((s + L) * SR))
            clips.append(x[i0:i1].copy())
        if len(clips) < r["count"]:
            log(f"  ! {r['name']}: only {len(clips)} of {r['count']} slices found")
        return clips, False
    raise ValueError(f"unknown mode {mode}")


def build(r, cats, dl, out):
    cat = cats[r["cat"]]
    clips, loop = clips_for(r, dl)
    ch = r.get("ch_out", 2 if cat["measure"] == "integrated" and r["cat"] not in ("hum", "tv", "radio") else 1)
    files, info, done = [], [], []
    for x in clips:
        x = to_channels(x, ch)
        if r.get("room"):
            x = room(fades(x, 0.003, 0.04), r["room"])  # fade the dry cut first, or it clicks inside the tail
        if loop:  # `seamless`: the source is already a seamless loop (scripts/sfx/synth.py renders them circularly)
            x = x[: int(SR * r["dur"])] if r.get("seamless") else make_loop(x, r["dur"], r["xfade"])
        else:
            x = fades(x, r.get("fade_in", 0.003), r.get("fade_out", min(0.08, len(x) / SR * 0.3)))
        done.append(normalise(x, cat))
    # True-peak cap: the median of the caps the variants need is applied to the whole set (so the
    # variants stay loudness-matched), then any variant still over the ceiling gets its own extra cut.
    need = [max(0.0, tp - TP_CEIL) for _, _, tp in done]
    common = float(np.median(need)) if need else 0.0
    for i, (y, lu, tp) in enumerate(done):
        lim = max(common, need[i])
        y = (y * (10 ** (-lim / 20))).astype(np.float32)
        name = r["name"] if len(clips) == 1 else f"{r['name']}_{i + 1:02d}"
        path = os.path.join(out, name + ".ogg")
        encode(y, path, cat["kbps"])
        # Opus loses up to ~2 dB of K-weighted loudness on bright noise: measure the decoded file and
        # correct the gain toward the target. Opus' true peak moves unpredictably with the gain, so a few
        # gains are tried and the encode closest to the target with a decoded true peak <= -1 dBTP is kept.
        want = cat["target"] - lim
        g_tot, best = 0.0, None  # best: (shortfall, gain, encoded bytes)
        for _ in range(6):
            z = decode_out(path, ch)
            short = want - loudness(z, cat["measure"])
            tp = true_peak(z)
            if tp <= -1.0 and short > -1.0 and (best is None or abs(short) < abs(best[0])):
                best = (short, g_tot, open(path, "rb").read())
            if tp > -1.0:
                g = TP_OUT - tp - 0.1  # over the ceiling: back off
            elif short > 0.3 and TP_OUT - tp > 0.15:
                g = min(short, TP_OUT - tp)
            elif short < -1.0:
                g = short
            else:
                break
            g = float(g)
            g_tot += g
            y = (y * (10 ** (g / 20))).astype(np.float32)
            encode(y, path, cat["kbps"])
        else:
            if best is not None:  # out of tries: keep the best encode seen
                g_tot = best[1]
                with open(path, "wb") as f:
                    f.write(best[2])
        files.append(name + ".ogg")
        info.append({"file": name + ".ogg", "dur": round(len(y) / SR, 3), "lufs_in": round(lu, 1), "tp_limited_db": round(lim, 1),
                     **({"opus_gain_db": round(g_tot, 1)} if g_tot else {})})
        if lim > 3:
            log(f"  ~ {name}: true-peak cap took {lim:.1f} dB off the {cat['target']} LUFS target")
    return {"files": files, "loop": loop, "channels": ch, "cat": r["cat"], "target_lufs": cat["target"], "detail": info,
            **({"picked_at": r["_picked"]} if "_picked" in r else {})}


def load_spec(root):
    """recipes.json plus the generated set (recipes-gen.json, written by generate.py) when present."""
    spec = json.load(open(os.path.join(root, "scripts/sfx/recipes.json")))
    gp = os.path.join(root, "scripts/sfx/recipes-gen.json")
    if os.path.exists(gp):
        g = json.load(open(gp))
        names = {r["name"] for r in spec["recipes"]}
        dup = [r["name"] for r in g["recipes"] if r["name"] in names]
        assert not dup, f"recipes-gen.json repeats recipes.json names: {dup}"
        spec["sources"].update(g["sources"])
        spec["recipes"] += g["recipes"]
    return spec


def main(argv):
    args = {"--root": None, "--dl": None, "--out": None, "--only": None}
    force = "--force" in argv
    it = iter([a for a in argv if a != "--force"])
    for a in it:
        args[a] = next(it)
    root = args["--root"] or os.getcwd()
    dl = args["--dl"] or os.path.join(root, ".cache/sfx/dl")
    out = args["--out"] or os.path.join(root, "public/assets/sfx")
    only = set(args["--only"].split(",")) if args["--only"] else None
    spec = load_spec(root)
    cats = spec["categories"]
    state_path = os.path.join(os.path.dirname(dl), "build-state.json")
    try:
        state = json.load(open(state_path))
    except Exception:
        state = {}
    man_path = os.path.join(out, "sfx.json")
    try:
        manifest = json.load(open(man_path))
    except Exception:
        manifest = {}
    os.makedirs(out, exist_ok=True)
    if any(r["src"].startswith("synth/") for r in spec["recipes"]):
        # synthesised sources (scripts/sfx/synth.py, the project's own work): rendered here when missing, so a
        # fresh checkout needs no download for them; rewritten only when synth.py's SYNTH_VERSION changes
        import importlib.util
        sp = importlib.util.spec_from_file_location("hairline_sfx_synth", os.path.join(root, "scripts/sfx/synth.py"))
        mod = importlib.util.module_from_spec(sp)
        sp.loader.exec_module(mod)
        mod.ensure(dl, log=log)
    wanted = set()
    for r in spec["recipes"]:
        name = r["name"]
        wanted.add(name)
        if only and name not in only:
            continue
        srcs = [r["src"]] + r.get("files", []) + [m["src"] for m in r.get("mix", [])] + [p["src"] for p in r.get("parts", [])]
        # the sources' metadata and file stats are hashed too: a re-pick of a generated take keeps its file
        # name (gen/<name>_01.wav), so the recipe alone does not change when the audio does
        stat = [[s, spec["sources"].get(s), *((lambda st: [st.st_size, st.st_mtime_ns])(os.stat(os.path.join(dl, s)))
                                              if os.path.exists(os.path.join(dl, s)) else [None])] for s in dict.fromkeys(srcs)]
        key = hashlib.sha1(json.dumps([BUILD_VERSION, r, cats[r["cat"]], stat], sort_keys=True).encode()).hexdigest()
        have = manifest.get(name, {}).get("files") or []
        if not force and state.get(name) == key and have and all(os.path.exists(os.path.join(out, f)) for f in have):
            continue
        if any(s.startswith("gen/") for s in srcs) and not all(os.path.exists(os.path.join(dl, s)) for s in srcs):
            # generated sources exist only where scripts/sfx/generate.py has run (an hour on the GPU, ~6 GB of
            # model weights); a fresh checkout keeps whatever was built before and skips the rest
            log(f"  ~ {name}: generated source missing, skipped (run scripts/sfx/generate.py)")
            continue
        log(f"- {name}")
        # drop stale variants of this name before writing the new set
        for f in have:
            p = os.path.join(out, f)
            if os.path.exists(p):
                os.remove(p)
        manifest[name] = build(r, cats, dl, out)
        state[name] = key
        json.dump(state, open(state_path, "w"), indent=1)
    # forget recipes that were removed
    for name in list(manifest):
        if name not in wanted:
            for f in manifest[name].get("files", []):
                p = os.path.join(out, f)
                if os.path.exists(p):
                    os.remove(p)
            del manifest[name]
            state.pop(name, None)
    json.dump(state, open(state_path, "w"), indent=1)
    with open(man_path + ".part", "w") as f:  # atomic: a failed run never leaves a half-written manifest
        json.dump(dict(sorted(manifest.items())), f, indent=1)
    os.replace(man_path + ".part", man_path)
    total = sum(os.path.getsize(os.path.join(out, f)) for v in manifest.values() for f in v["files"])
    log(f"sfx: {sum(len(v['files']) for v in manifest.values())} files, {total / 1e6:.2f} MB in {out}")


if __name__ == "__main__":
    main(sys.argv[1:])
