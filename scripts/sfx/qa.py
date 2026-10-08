#!/usr/bin/env python3
"""Adversarial QA of the built SFX set (public/assets/sfx). Stricter than verify.py: it re-measures every file
the way build.py targets it and checks things build.py never looks at.

    .cache/sfx/gen/venv/bin/python -I scripts/sfx/qa.py --root . [--clap] [--doc] [--json out.json]

Per file:
  format     Ogg Opus, 48 kHz, channel count as the manifest says; manifest and directory agree
  loudness   the category's measure (integrated for beds, max momentary 400 ms for one-shots), within
             1.5 dB of the target, or under it by exactly the true-peak cap build.py logged (then "capped")
  peak       true peak (4x oversampled) <= -1 dBTP, no sample at full scale, |DC| < 0.01
  boost      a source that came in more than 15 dB under target (its noise floor came up with it)
  loop seam  wrap step vs the 99th-percentile sample step (<= 1.5), and the RMS level and the spectral
             tilt either side of the wrap (50 ms each side; <= 3 dB / <= 4 dB)
  silence    beds and loops: no dropout (>= 0.4 s more than 35 dB under the file's median level);
             one-shots: lead-in <= 30 ms, no internal gap >= 0.4 s, tail <= 0.35 s of near-silence
  duration   per category range (one-shots not under 0.12 s; beds long enough not to be heard looping)
  stereo     stereo beds are not dual mono, and their L/R correlation is not negative
  clap       (--clap) LAION CLAP cosine of the file against its catalogue description ("what"), and the rank of
             that description among all the catalogue's descriptions; flagged when < 0.10 and ranked > 10
Set level: total size < 25 MB.
Doc (--doc): docs/assets/sfx.md audit rows all have a verdict and name only built sets; every set has a catalogue
row with a licence and appears in the Integration list.
Exit status 0 always; read the ERR / WARN lines.
"""
import json, os, subprocess, sys

import numpy as np
import pyloudnorm as pyln
from scipy.signal import resample_poly

SR = 48000
METER = pyln.Meter(SR)
BUDGET = 25e6
DUR = {  # category -> (min s, max s) for one-shots; loops/beds use LOOP_MIN
    "tick": (0.12, 1.6), "foley_soft": (0.12, 8.0), "foley": (0.12, 8.0), "heavy": (0.3, 6.0), "floor": (0.3, 2.0),
    "event": (2.0, 60.0), "event_peaky": (2.0, 30.0), "crowd": (5.0, 60.0),
}
LOOP_MIN = {"amb": 20, "amb_int": 15, "amb_far": 20, "crowd": 20, "hum": 4, "tv": 15, "radio": 6}


def decode(path, ch):
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-f", "f32le", "-ac", str(ch), "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch)


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,sample_rate,channels:format=format_name",
                          "-of", "json", path], capture_output=True, text=True).stdout
    j = json.loads(out)
    s = j["streams"][0]
    return s["codec_name"], int(s["sample_rate"]), int(s["channels"]), j["format"]["format_name"]


def loudness(x, measure):  # as build.py
    pad = max(0, int(0.45 * SR) - len(x))
    y = np.concatenate([x, np.zeros((pad, x.shape[1]), np.float32)]) if pad else x
    if measure == "integrated" and len(y) >= 3 * SR:
        return METER.integrated_loudness(y)
    w, hop = int(0.4 * SR), int(0.1 * SR)
    best = -120.0
    for i in range(0, max(1, len(y) - w + 1), hop):
        v = METER.integrated_loudness(y[i:i + w])
        if np.isfinite(v):
            best = max(best, v)
    return best


def db(v):
    return 20 * np.log10(np.maximum(v, 1e-12))


def env(m, win=0.01):
    h = int(SR * win)
    n = len(m) // h
    return db(np.sqrt((m[:n * h].reshape(n, h) ** 2).mean(axis=1))) if n else np.array([-120.0])


def runs(mask):
    """lengths (in frames) and starts of True runs"""
    out, i = [], 0
    while i < len(mask):
        if mask[i]:
            j = i
            while j < len(mask) and mask[j]:
                j += 1
            out.append((i, j - i))
            i = j
        else:
            i += 1
    return out


def tilt(seg):
    """high/low energy ratio in dB (above / below 2 kHz)"""
    s = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    f = np.fft.rfftfreq(len(seg), 1 / SR)
    return 10 * np.log10((s[f >= 2000].sum() + 1e-12) / (s[(f > 40) & (f < 2000)].sum() + 1e-12))


def check(name, v, cat, path, x):
    errs, warns, info = [], [], {}
    m = x.mean(axis=1)
    dur = len(x) / SR
    info["dur"] = round(dur, 3)
    # loudness
    tp_pre = float(db(np.abs(resample_poly(x, 4, 1, axis=0)).max()))
    lu = loudness(x, cat["measure"])
    det = next((d for d in v["detail"] if d["file"] == os.path.basename(path)), {})
    cap = det.get("tp_limited_db", 0.0)
    delta = lu - v["target_lufs"]
    info.update(lufs=round(lu, 1), delta=round(delta, 1), cap=cap)
    if delta > 1.5:
        errs.append(f"too loud: {lu:.1f} vs target {v['target_lufs']} ({cat['measure']})")
    elif delta < -1.5:
        if tp_pre > -1.7:  # at the true-peak ceiling: it cannot go louder without a limiter
            (warns if delta < -6 else info.setdefault("notes", [])).append(f"{-delta:.1f} dB under target, peak-limited (tp {tp_pre:.1f}, cap {cap})")
        elif abs(delta + cap) <= 1.5:
            (warns if cap > 6 else info.setdefault("notes", [])).append(f"{-delta:.1f} dB under target (true-peak cap {cap})")
        else:
            errs.append(f"too quiet: {lu:.1f} vs target {v['target_lufs']}, cap only {cap}")
    if det.get("lufs_in") is not None and v["target_lufs"] - det["lufs_in"] > 15:
        warns.append(f"source came in at {det['lufs_in']} ({v['target_lufs'] - det['lufs_in']:.0f} dB boost: noise floor raised)")
    # peak / DC / clipping
    tp = db(np.abs(resample_poly(x, 4, 1, axis=0)).max())
    info["tp"] = round(float(tp), 2)
    if tp > -0.95:
        errs.append(f"true peak {tp:.2f} dBTP > -1")
    if np.abs(x).max() >= 0.999:
        errs.append("sample at full scale")
    dc = float(np.abs(x.mean(axis=0)).max())
    if dc > 0.01:
        warns.append(f"DC offset {dc:.3f}")
    e = env(m)
    loud = e[e > -90]
    med = float(np.median(loud)) if len(loud) else -120.0
    if v["loop"] or cat["measure"] == "integrated":
        # dropouts
        # the faded-out end of a non-loop event is not a dropout
        drop = [r for r in runs(e < med - 35) if r[1] * 0.01 >= 0.4 and (v["loop"] or r[0] + r[1] < len(e) - 1)]
        if drop:
            errs.append(f"dropout(s) {', '.join(f'{s * 0.01:.1f}s+{n * 0.01:.1f}' for s, n in drop[:3])}")
    if v["loop"]:
        steps = np.abs(np.diff(x, axis=0)).max(axis=1)
        ratio = float(np.abs(x[0] - x[-1]).max() / (np.percentile(steps, 99) + 1e-9))
        # level / tone either side of the wrap, compared with the same measure at every 25 ms inside the
        # file: a seam is a problem only when the wrap jumps more than the material itself does
        w = int(0.05 * SR)
        mm = np.concatenate([m[-w:], m[:w]])  # the wrap sits at index w
        def jumps(sig, at):
            a, b = sig[at - w:at], sig[at:at + w]
            return float(db(np.sqrt((a ** 2).mean())) - db(np.sqrt((b ** 2).mean()))), float(tilt(a) - tilt(b))
        lj, tj = jumps(mm, w)
        inner = [jumps(m, i) for i in range(w, len(m) - w, int(0.025 * SR))]
        pl = float(np.mean([abs(j[0]) >= abs(lj) for j in inner])) if inner else 1.0
        pt = float(np.mean([abs(j[1]) >= abs(tj) for j in inner])) if inner else 1.0
        info.update(wrap=round(ratio, 2), wrap_level_db=round(lj, 1), wrap_level_pct=round(pl, 3),
                    wrap_tilt_db=round(tj, 1), wrap_tilt_pct=round(pt, 3))
        if ratio > 1.5:
            errs.append(f"loop seam click (wrap step x{ratio:.2f})")
        if abs(lj) > 3 and pl < 0.02:
            (errs if abs(lj) > 6 else warns).append(f"loop seam level jump {lj:+.1f} dB (only {pl:.1%} of the file jumps as much)")
        if abs(tj) > 4 and pt < 0.02:
            warns.append(f"loop seam tone jump {tj:+.1f} dB (only {pt:.1%} of the file jumps as much)")
        lo = LOOP_MIN.get(v["cat"], 1.5)
        if dur < lo:
            warns.append(f"loop only {dur:.1f} s (min {lo} s for {v['cat']})")
    else:
        lo, hi = DUR.get(v["cat"], (0.12, 60))
        if dur < lo:
            warns.append(f"very short: {dur:.2f} s (min {lo})")
        if dur > hi:
            warns.append(f"long: {dur:.2f} s (max {hi})")
        if cat["measure"] != "integrated":
            pk = e.max()
            on = np.nonzero(e > pk - 30)[0]
            lead = on[0] * 0.01 if len(on) else 0
            on45 = np.nonzero(e > pk - 45)[0]
            tail = (len(e) - 1 - on45[-1]) * 0.01 if len(on45) else 0
            body = e[3:-3] if len(e) > 10 else e
            floor = float(np.percentile(body, 10))
            info.update(lead=round(lead, 3), tail=round(tail, 2), floor=round(floor, 1), snr=round(float(pk - floor), 1))
            if v["cat"] == "tick" and pk - floor < 20 and floor > -50 and dur > 0.4:  # sustained foley has no floor to measure
                warns.append(f"steady floor at {floor:.0f} dBFS, only {pk - floor:.0f} dB under the peak (hiss or drone)")
            if lead > 0.03:
                warns.append(f"lead-in {lead * 1000:.0f} ms before the event (late on trigger)")
            if tail > 0.35:
                warns.append(f"{tail:.2f} s of near-silent tail")
            gaps = [r for r in runs(e[on[0]:on[-1] + 1] < pk - 45) if r[1] * 0.01 >= 0.4] if len(on) else []
            if gaps:
                warns.append(f"internal gap {max(g[1] for g in gaps) * 0.01:.1f} s")
    if x.shape[1] == 2:
        l, r = x[:, 0], x[:, 1]
        if np.abs(l - r).max() < 1e-4:
            warns.append("stereo file is dual mono")
        c = float(np.corrcoef(l, r)[0, 1])
        info["lr_corr"] = round(c, 2)
        if c < -0.2:
            errs.append(f"L/R correlation {c:.2f} (cancels in mono)")
    return errs, warns, info


def clap_scores(items, device):
    import torch, librosa
    from transformers import ClapModel, ClapProcessor
    repo, rev = "laion/larger_clap_general", "refs/pr/2"
    proc = ClapProcessor.from_pretrained(repo, revision=rev)
    model = ClapModel.from_pretrained(repo, revision=rev, use_safetensors=True).eval().to(device)
    out = {}
    with torch.no_grad():
        texts = sorted({t for _, _, t in items})
        ti = proc(text=texts, return_tensors="pt", padding=True)
        t = model.get_text_features(**{k: v.to(device) for k, v in ti.items()})
        t = getattr(t, "pooler_output", t)
        T = dict(zip(texts, torch.nn.functional.normalize(t, dim=-1).cpu().numpy()))
        for f, x, text in items:
            y = x.mean(axis=1)
            win = 480000
            chunks = [y[i:i + win] for i in range(0, max(1, len(y) - win // 4), win)] or [y]
            ai = proc(audio=chunks, sampling_rate=SR, return_tensors="pt")
            a = model.get_audio_features(**{k: v.to(device) for k, v in ai.items()})
            a = getattr(a, "pooler_output", a)
            a = torch.nn.functional.normalize(torch.nn.functional.normalize(a, dim=-1).mean(0), dim=-1).cpu().numpy()
            sims = {t: float(a @ T[t]) for t in texts}
            own = sims[text]
            # rank of its own description among all the catalogue's descriptions (1 = best match): CLAP
            # cosines are low on sub-second clips, the rank says whether it is still the right sound
            out[f] = (round(own, 3), 1 + sum(v > own for v in sims.values()), len(texts))
    return out


def check_doc(root, man):
    """docs/assets/sfx.md: every audit row has a verdict, every file it names exists, every set has a catalogue
    row with a licence, and every set is wired in the Integration list (or marked keep / spare there)."""
    import re
    doc = open(os.path.join(root, "docs/assets/sfx.md")).read()
    errs = []
    def section(title):
        i = doc.find("\n## " + title)
        j = doc.find("\n## ", i + 4)
        return doc[i:j if j > 0 else None] if i >= 0 else ""
    sets = set(man)
    def known(tok):
        t = re.sub(r"(_\d\d)?(\.\.\d\d)?(\.ogg)?$", "", tok)
        return t in sets or tok in sets
    audit = section("Audit")
    rows = [l for l in audit.splitlines() if l.startswith("| ") and not l.startswith("| Sound") and not l.startswith("|---")]
    for l in rows:
        cells = [c.strip() for c in l.strip("|").split("|")]
        v = cells[-1]
        if not re.search(r"\b(file|gen|keep|voice|as Ch4|not SFX)\b", v):
            errs.append(f"audit row without a verdict: {cells[0]}")
        for tok in re.findall(r"`([a-z0-9_]{3,}(?:_\d\d\.\.\d\d)?)`", v):
            if not known(tok) and not tok.endswith("()") and tok not in ("rain", "crowd"):
                errs.append(f"audit names `{tok}` ({cells[0]}), which is not in sfx.json")
    cat = section("Catalogue")
    seen = {}
    for l in cat.splitlines():
        m = re.match(r"\| `([a-z0-9_]+?)(?:_01\.\.\d\d)?(?:\.ogg)?`", l)
        if m:
            seen[m.group(1)] = [c.strip() for c in l.strip("|").split("|")][-1]
    for n in sorted(sets):
        if n not in seen:
            errs.append(f"{n}: no catalogue row")
        elif not seen[n]:
            errs.append(f"{n}: catalogue row without a licence")
    integ = section("Integration")
    for n in sorted(sets):
        if f"`{n}`" not in integ and not re.search(rf"`{n}_\d\d", integ):
            errs.append(f"{n}: not in the Integration list")
    return errs, len(rows)


def main(argv):
    root = argv[argv.index("--root") + 1] if "--root" in argv else "."
    d = os.path.join(root, "public/assets/sfx")
    man = json.load(open(os.path.join(d, "sfx.json")))
    spec = json.load(open(os.path.join(root, "scripts/sfx/recipes.json")))
    g = os.path.join(root, "scripts/sfx/recipes-gen.json")
    recipes = spec["recipes"] + (json.load(open(g))["recipes"] if os.path.exists(g) else [])
    what = {r["name"]: r["what"] for r in recipes}
    gen = {r["name"] for r in (json.load(open(g))["recipes"] if os.path.exists(g) else [])}
    cats = spec["categories"]
    report, decoded, n_err, n_warn = {}, [], 0, 0
    listed = {f for v in man.values() for f in v["files"]}
    on_disk = {f for f in os.listdir(d) if f.endswith(".ogg")}
    for f in sorted(on_disk - listed):
        print(f"ERR  {f}: on disk but not in sfx.json"); n_err += 1
    for f in sorted(listed - on_disk):
        print(f"ERR  {f}: in sfx.json but missing"); n_err += 1
    for name in sorted(set(man) - set(what)):
        print(f"ERR  {name}: in sfx.json but no recipe"); n_err += 1
    for name, v in man.items():
        for f in v["files"]:
            p = os.path.join(d, f)
            if not os.path.exists(p):
                continue
            errs, warns = [], []
            codec, sr, ch, fmt = probe(p)
            if codec != "opus" or "ogg" not in fmt:
                errs.append(f"format {codec}/{fmt}, want opus/ogg")
            if sr != 48000:
                errs.append(f"sample rate {sr}")
            if ch != v["channels"]:
                errs.append(f"{ch} channels, manifest says {v['channels']}")
            x = decode(p, v["channels"])
            e2, w2, info = check(name, v, cats[v["cat"]], p, x)
            errs += e2; warns += w2
            info["size"] = os.path.getsize(p)
            info["set"] = name
            info["gen"] = name in gen
            report[f] = {"errs": errs, "warns": warns, **info}
            if "--clap" in argv:
                decoded.append((f, x, what.get(name, name)))
            n_err += len(errs); n_warn += len(warns)
    if decoded:
        import torch
        dev = "mps" if torch.backends.mps.is_available() else "cpu"
        sc = clap_scores(decoded, dev)
        for f, (c, rank, n) in sc.items():
            report[f].update(clap=c, clap_rank=rank)
            if c < 0.10 and rank > 10:
                report[f]["warns"].append(f"CLAP {c:.3f} vs its description, which ranks {rank} of {n}: weak match"); n_warn += 1
    for f, r in sorted(report.items()):
        for e in r["errs"]:
            print(f"ERR  {f}: {e}")
        for w in r["warns"]:
            print(f"WARN {f}: {w}")
    total = sum(r["size"] for r in report.values())
    print(f"files {len(report)} in {len(man)} sets, {total / 1e6:.2f} MB of {BUDGET / 1e6:.0f} MB budget"
          f"{' OVER BUDGET' if total > BUDGET else ''}; errors {n_err}, warnings {n_warn}")
    if "--doc" in argv:
        derrs, nrows = check_doc(root, man)
        for e in derrs:
            print(f"DOC  {e}")
        print(f"doc: {nrows} audit rows, {len(man)} sets; {len(derrs)} doc problems")
    if "--json" in argv:
        json.dump(report, open(argv[argv.index("--json") + 1], "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1:])
