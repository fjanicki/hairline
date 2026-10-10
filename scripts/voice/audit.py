"""Adversarial QA of the FINAL French voice clips (the .ogg files the game will load), independent of the
generator's own take QA.

    nice -n 10 .cache/tts/A/evalvenv/bin/python -I scripts/voice/audit.py [--frac 0.25] [--seed N] [--all]
                                                                         [--keys k1,k2] [--out FILE]

Sample: a speaker-stratified random --frac of the clips in the manifest, plus every clip < 1 s or > 12 s,
every clip kept from a remote machine (auriga), every clip on the pronunciation spot list, and --keys.
--all checks every clip.

Per clip, on the decoded Opus (48 kHz):
  - Whisper large-v3, two readings (0.4 s and 0.55 s of leading zeros; the better one counts), CER vs the TTS
    text (flag > maxCer);
  - hallucinated additions: >= 2 inserted words, or the hypothesis >= 25 % longer than the reference;
  - truncation: the last reference word missing from the end of the hypothesis, the last recognised word
    ending < 40 ms before the clip end, or an onset that starts at full level (first 10 ms within 12 dB
    of the loudest frame);
  - loudness: integrated LUFS (clips < 1 s tiled, like the generator) within +-1 LU of the delivery target;
    true peak (4x oversampled) <= -1.5 dBTP; clipping (>= 3 consecutive samples at |x| >= 0.98);
  - head / tail silence > 150 ms (frames 45 dB below the loudest 10 ms frame);
  - wrong speaker: ECAPA embedding of the final clip, nearest of the per-speaker centroids (leave-one-out);
    also on the dry kept take (state.json) for EVERY clip.
  - machine consistency: clips kept from a remote worker vs the Mac distribution of the same speaker
    (ECAPA to the Mac centroid, F0, spectral centroid).
Writes .cache/tts/gen/audit.json and prints the flagged clips.
"""
import argparse
import json
import math
import random
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import qa  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--frac", type=float, default=0.25)
ap.add_argument("--seed", type=int, default=20261007)
ap.add_argument("--all", action="store_true")
ap.add_argument("--keys", default="")
ap.add_argument("--out", default=str(ROOT / ".cache/tts/gen/audit.json"))
args = ap.parse_args()

LINES = json.load(open(HERE / "lines.fr.json"))["lines"]
CAST = json.load(open(HERE / "cast.json"))
STATE = json.load(open(ROOT / ".cache/tts/gen/state.json"))
OUT = ROOT / CAST["output"]["dir"]
MAN = json.load(open(OUT / "manifest.json"))
SPOT = re.compile(r"Revel|Odile|Marchal|Okafor|Sami|Bastien|Benali|STRIDE|Tanneurs|H\. ?R\.|Hugues|Durand|Lou|Gérard|"
                  r"\b(deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quinze|vingt|trente|quarante|"
                  r"cinquante|soixante|cent|cents|mille|virgule)\b", re.I)


PRON = json.load(open(HERE / "pronunciation.json"))


def tts_of(l):
    o = PRON.get("lines", {}).get(l["key"]) or CAST.get("ttsOverride", {}).get(l["key"]) or {}
    return o.get("tts", l["tts"])


def in_manifest():
    files = set()
    for v in MAN["lines"].values():
        files |= {x["file"] for x in v["variants"].values()} if "variants" in v else {v["file"]}
    return files


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", "48000", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def frames_db(y, sr=48000, win=0.01):
    n = int(sr * win)
    m = len(y) // n
    r = np.sqrt((y[: m * n].reshape(m, n) ** 2).mean(1) + 1e-12)
    return 20 * np.log10(r)


def lufs(y, sr=48000):
    import pyloudnorm as pyln
    z = y if len(y) >= sr else np.tile(y, int(np.ceil(sr / max(len(y), 1))) + 1)
    return float(pyln.Meter(sr).integrated_loudness(z.astype(np.float64)))


def true_peak(y):
    from scipy.signal import resample_poly
    return float(20 * np.log10(np.abs(resample_poly(y.astype(np.float64), 4, 1)).max() + 1e-12))


def clip_runs(y, thr=0.98, run=3):
    m = np.abs(y) >= thr
    if not m.any():
        return 0
    d = np.diff(np.concatenate([[0], m.astype(int), [0]]))
    starts, ends = np.where(d == 1)[0], np.where(d == -1)[0]
    return int(((ends - starts) >= run).sum())


def transcribe(y48, dur, lead=0.55):
    """qa.asr() with the word list kept (start/end on the unpadded clip). `lead` s of zeros in front: with 0.4 s
    Whisper sometimes drops a clip-initial 'Vous' / 'Te' that is plainly there, with 0.55 s it sometimes
    hallucinates instead; the audit runs both and keeps the better reading (a clip fails only if both do)."""
    import librosa
    import mlx_whisper
    y = librosa.resample(y48, orig_sr=48000, target_sr=16000).astype(np.float32)
    n = int(16000 * lead)
    y = np.concatenate([np.zeros(n, np.float32), y, np.zeros(4800, np.float32)])
    r = mlx_whisper.transcribe(y, path_or_hf_repo=qa.ASR_REPO, language="fr", temperature=0.0, word_timestamps=True,
                               condition_on_previous_text=False, verbose=None)
    ws = [w for s in r["segments"] for w in s.get("words", [])]
    keep = [(w["word"], w["start"] - lead, w["end"] - lead) for w in ws
            if w["end"] - lead > 0.03 and w["start"] - lead < dur - 0.03]
    text = "".join(w for w, _, _ in keep).strip() if ws else r["text"].strip()
    return text, keep


def eq(a, b):
    return a == b or qa.silent(a) == qa.silent(b) or qa.ASR_EQUIV.get(a, a) == qa.ASR_EQUIV.get(b, b)


def additions(ref, hyp):
    import jiwer
    r, h = qa.norm(ref), qa.norm(hyp)
    r = " ".join(qa.silent(qa.ASR_EQUIV.get(w, w)) for w in r.split())
    h = " ".join(qa.silent(qa.ASR_EQUIV.get(w, w)) for w in h.split())
    if not r or not h:
        return 0, 0
    o = jiwer.process_words(r, h)
    return int(o.insertions), int(o.deletions)


# ------------------------------------------------------------------------------------------------ sample
files = in_manifest()
cand = [l for l in LINES if l["file"] in files and (OUT / l["file"]).exists()]
rng = random.Random(args.seed)
pick = set()
by_spk = {}
for l in cand:
    by_spk.setdefault(l["speaker"], []).append(l)
for spk, ls in sorted(by_spk.items()):
    n = max(1, math.ceil(len(ls) * args.frac))
    for l in rng.sample(sorted(ls, key=lambda x: x["file"]), n):
        pick.add(l["file"])
why = {}
for l in cand:
    i = Path(l["file"]).stem
    st = STATE.get(i, {})
    dur = st.get("out", {}).get("dur", 0)
    w = []
    if l["file"] in pick:
        w.append("random")
    if dur < 1.0 or dur > 12.0:
        w.append("duration")
    if (st.get("best") or {}).get("machine", "mac") != "mac":
        w.append("remote")
    if SPOT.search(l["text"]):
        w.append("spot")
    if args.keys and (l["key"] in args.keys.split(",") or i in args.keys.split(",")):
        w.append("asked")
    if args.all:
        w.append("all")
    if w:
        why[l["file"]] = w
sel = [l for l in cand if l["file"] in why]
print(f"{len(cand)} clips in manifest; checking {len(sel)} "
      f"(random {sum('random' in w for w in why.values())}, duration {sum('duration' in w for w in why.values())}, "
      f"remote {sum('remote' in w for w in why.values())}, spot {sum('spot' in w for w in why.values())})", flush=True)

# ------------------------------------------------------------------------------------------------ dry-take speaker check (all)
emb_dry = {}
for l in cand:
    b = STATE.get(Path(l["file"]).stem, {}).get("best") or {}
    if b.get("emb"):
        emb_dry[l["file"]] = (l["speaker"], np.array(b["emb"]), b.get("machine", "mac"), b.get("f0"))


def centroid_check(embs):
    """embs: file -> (speaker, vec). Leave-one-out nearest centroid; returns file -> (nearest, own_cos, best_other)."""
    sums, cnt = {}, {}
    for spk, e in embs.values():
        sums[spk] = sums.get(spk, 0) + e
        cnt[spk] = cnt.get(spk, 0) + 1
    res = {}
    for f, (spk, e) in embs.items():
        cos = {}
        for s2, sm in sums.items():
            c = sm - e if s2 == spk else sm
            n = cnt[s2] - (1 if s2 == spk else 0)
            if n == 0:
                continue
            c = c / np.linalg.norm(c)
            cos[s2] = float(e @ c)
        own = cos.get(spk)
        other = max(((v, k) for k, v in cos.items() if k != spk), default=(None, None))
        nearest = max(cos, key=cos.get) if cos else None
        res[f] = {"nearest": nearest, "own": None if own is None else round(own, 3),
                  "bestOther": other[1], "bestOtherCos": None if other[0] is None else round(other[0], 3)}
    return res


dry = centroid_check({f: (s, e) for f, (s, e, _, _) in emb_dry.items()})

# ------------------------------------------------------------------------------------------------ per-clip checks
TARGET = {k: v["lufs"] for k, v in CAST["deliveries"].items()}
rows = []
fin_emb = {}
import librosa  # noqa: E402

for n, l in enumerate(sel):
    i = Path(l["file"]).stem
    y = decode(OUT / l["file"])
    dur = len(y) / 48000
    fd = frames_db(y)
    mx = fd.max()
    v = np.where(fd > mx - 45)[0]
    head_ms = float(v[0] * 10) if len(v) else 0.0
    tail_ms = float((len(fd) - 1 - v[-1]) * 10) if len(v) else 0.0
    onset_hot = bool(len(fd) and fd[0] > mx - 12)
    ref = tts_of(l)
    no_asr = CAST["qa"].get("noAsr", {}).get(l["key"])
    reads = [transcribe(y, dur, 0.4), transcribe(y, dur, 0.55)]
    hyp, words = min(reads, key=lambda r: qa.cer(ref, r[0]))
    c = 0.0 if no_asr else qa.cer(ref, hyp)
    ins, dels = (0, 0) if no_asr else additions(ref, hyp)
    rn, hn = qa.norm(ref).split(), qa.norm(hyp).split()
    last_missing = bool(not no_asr and rn and hn and not any(eq(qa.ASR_EQUIV.get(rn[-1], rn[-1]), qa.ASR_EQUIV.get(w, w))
                                                         for w in hn[-3:]))
    # end of the last recognised word that is in the reference (Whisper appends '»' / 'Sous-titrage' ghosts)
    refset = {qa.silent(w) for w in rn}
    real = [w for w in words if any(qa.silent(x) in refset for x in qa.norm(w[0]).split())]
    last_end_gap = (dur - real[-1][2]) if real else None
    lu, tp = lufs(y), true_peak(y)
    clips = clip_runs(y)
    y16 = librosa.resample(y, orig_sr=48000, target_sr=16000)
    e = qa.ecapa(y16)
    fin_emb[l["file"]] = (l["speaker"], e)
    scs = librosa.feature.spectral_centroid(y=y, sr=48000, n_fft=1024, hop_length=480)[0]
    loud = fd[: len(scs)] > mx - 30
    sc = float(np.mean(scs[: len(loud)][loud])) if loud.any() else 0.0
    flags = []
    if c > CAST["qa"]["maxCer"]:
        flags.append(f"cer {c:.3f}")
    if ins >= 2 or (not no_asr and len(qa.norm(hyp)) > 1.25 * len(qa.norm(ref)) + 2):
        flags.append(f"addition (+{ins} words)")
    if last_missing and c > 0.03:
        flags.append("last word missing")
    if last_end_gap is not None and last_end_gap < 0.04:
        flags.append(f"speech runs to the end ({last_end_gap * 1000:.0f} ms)")
    if onset_hot:
        flags.append("hot onset (first 10 ms near full level)")
    if abs(lu - TARGET[l["delivery"]]) > 1.0:
        flags.append(f"loudness {lu:.1f} vs {TARGET[l['delivery']]}")
    if tp > -1.5:
        flags.append(f"true peak {tp:.2f}")
    if clips:
        flags.append(f"clipping x{clips}")
    if head_ms > 150 or tail_ms > 150:
        flags.append(f"edge silence head {head_ms:.0f} / tail {tail_ms:.0f} ms")
    rows.append({"file": l["file"], "speaker": l["speaker"], "delivery": l["delivery"], "why": why[l["file"]],
                 "machine": (STATE.get(i, {}).get("best") or {}).get("machine", "mac"), "dur": round(dur, 3),
                 "text": l["text"], "tts": ref, "asr": hyp, "cer": round(c, 4), "insertions": ins, "deletions": dels,
                 "lufs": round(lu, 2), "tp": round(tp, 2), "headMs": head_ms, "tailMs": tail_ms,
                 "lastWordEndGapMs": None if last_end_gap is None else round(last_end_gap * 1000),
                 "specCentroid": round(sc), "flags": flags})
    tag = "FLAG" if flags else "ok  "
    print(f"[{n + 1}/{len(sel)}] {tag} {l['file']} {l['speaker']:8s} {l['delivery']:9s} cer={c:.3f} lufs={lu:.1f} "
          f"tp={tp:.1f} h/t={head_ms:.0f}/{tail_ms:.0f} | {hyp}" + (f"  <-- {flags}" if flags else ""), flush=True)

fin = centroid_check(fin_emb)
for r in rows:
    f = fin.get(r["file"])
    d = dry.get(r["file"])
    r["speakerFinal"] = f
    r["speakerDry"] = d
    # single-clip speakers have no own centroid: flag only if very close to another character
    for tag, x in (("final", f), ("dry", d)):
        if not x:
            continue
        if x["own"] is not None and x["nearest"] != r["speaker"]:
            r["flags"].append(f"wrong speaker ({tag}): nearest {x['nearest']} {x['bestOtherCos']} > own {x['own']}")
        elif x["own"] is None and x["bestOtherCos"] is not None and x["bestOtherCos"] > 0.5:
            r["flags"].append(f"speaker ({tag}): close to {x['bestOther']} ({x['bestOtherCos']})")

dry_wrong = [{"file": f, "speaker": emb_dry[f][0], **x} for f, x in dry.items()
             if x["own"] is not None and x["nearest"] != emb_dry[f][0]]

# ------------------------------------------------------------------------------------------------ machine consistency
mach = []
for f, (spk, e, m, f0) in emb_dry.items():
    if m == "mac":
        continue
    mac = [(e2, f02) for f2, (s2, e2, m2, f02) in emb_dry.items() if s2 == spk and m2 == "mac"]
    if not mac:  # a speaker with no Mac clip (Jo, M. Durand: R4, generated on auriga only) has no reference
        continue
    c = np.mean([x for x, _ in mac], 0)
    c /= np.linalg.norm(c)
    mac_cos = [float(x @ c) for x, _ in mac]
    f0s = [x for _, x in mac if x]
    row = next((r for r in rows if r["file"] == f), {})
    same_dlv = [r2["specCentroid"] for r2 in rows if r2["speaker"] == spk and r2["machine"] == "mac"
                and r2["delivery"] == row.get("delivery")]
    mach.append({"file": f, "speaker": spk, "machine": m, "cosToMacCentroid": round(float(e @ c), 3),
                 "macCos": {"min": round(min(mac_cos), 3), "median": round(float(np.median(mac_cos)), 3)},
                 "f0": f0, "macF0": {"median": round(float(np.median(f0s)), 1), "p10": round(float(np.percentile(f0s, 10)), 1),
                                     "p90": round(float(np.percentile(f0s, 90)), 1)} if f0s else None,
                 "specCentroid": row.get("specCentroid"),
                 "macSpecCentroidSameDelivery": round(float(np.median(same_dlv))) if same_dlv else None})

flagged = [r for r in rows if r["flags"]]
rep = {"checked": len(rows), "inManifest": len(cand), "seed": args.seed, "frac": args.frac,
       "flagged": [{k: r[k] for k in ("file", "speaker", "delivery", "machine", "text", "asr", "cer", "flags")} for r in flagged],
       "dryWrongSpeaker": dry_wrong, "machineConsistency": mach,
       "summary": {"meanCer": round(float(np.mean([r["cer"] for r in rows])), 4) if rows else None,
                   "maxTp": max((r["tp"] for r in rows), default=None),
                   "lufsMaxDev": max((abs(r["lufs"] - TARGET[r["delivery"]]) for r in rows), default=None),
                   "maxHeadMs": max((r["headMs"] for r in rows), default=None),
                   "maxTailMs": max((r["tailMs"] for r in rows), default=None)},
       "rows": rows}
Path(args.out).write_text(json.dumps(rep, ensure_ascii=False, indent=1))
print(json.dumps({k: rep[k] for k in ("checked", "summary")}, ensure_ascii=False))
print("flagged:", len(flagged))
for r in flagged:
    print(" ", r["file"], r["speaker"], r["machine"], r["flags"], "|", r["tts"], "->", r["asr"])
print("dry-take wrong speaker (all clips):", dry_wrong)
print("machine consistency:", json.dumps(mach, ensure_ascii=False))
