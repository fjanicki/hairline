"""Bake the French voice lines of HAIRLINE with Kyutai TTS 1.6B en_fr (and Chatterbox Multilingual for the speakers
whose cast.json entry has "engine": "chatterbox": Jo).

Run with the evaluation venv (mlx-whisper, speechbrain, parselmouth, pyloudnorm):
    nice -n 10 .cache/tts/A/evalvenv/bin/python scripts/voice/generate.py [options]

Inputs : scripts/voice/lines.fr.json (node scripts/voice/extract-lines.mjs), scripts/voice/cast.json
Outputs: public/assets/voice/fr/<key>[-<speaker>].ogg + manifest.json
State  : .cache/tts/gen/state.json, takes in .cache/tts/gen/takes/<id>/, report in .cache/tts/gen/report.json

Incremental: a line is skipped when its key + text + TTS text + cast entry + delivery chain hash is
unchanged and its .ogg exists. If only the delivery chain / output settings changed, the kept take is
re-processed without regenerating. Interrupted runs resume from the saved takes.

Per line: generate (batched, Mac MLX worker and optionally the auriga ROCm worker), speaker post
(Sami: childify), Whisper CER vs the TTS text, words/s and cut-off checks; up to 3 regenerations
with other seeds when CER > maxCer, pacing is implausible or the ending is cut; the best take is kept
and failures are logged. Then delivery processing, edge trim, loudness / true-peak, Opus .ogg.

Options:
  --only hugo,odile    restrict to speakers          --keys k1,k2   restrict to keys / ids
  --limit N            at most N lines this run      --batch N      Mac batch size (default cast)
  --remote auriga      also dispatch batches to auriga (scripts/voice/remote/auriga_gen.sh)
  --remote-chunk N     lines per auriga run (default 96, batch 32)
  --repost             re-run delivery processing for all lines (keeps takes)
  --regen              discard the selected lines' takes and generate them again (use with --only/--keys)
  --no-mac             generate only on the remote worker

Engines (cast.json speakers[*].engine, default "kyutai"):
  kyutai      "voice" (a kyutai/tts-voices embedding), "cfg", "temp"; Mac MLX worker and/or auriga (auriga_gen.sh).
  chatterbox  zero-shot cloning from "ref" (a wav in the repo; its sha256 must equal "refHash"), with "exaggeration",
              "cfgWeight", "temp", "t3", "lang". Always on auriga (remote/auriga_cb.sh: scripts/voice/clone/cb_worker.py
              in ~/hairline-clone/venv-cb), host = --remote or the speaker's "host"; never on the Mac. The takes'
              Whisper transcripts are also made on auriga (remote/asr_remote.py). The engine, model, settings and the
              reference's hash are in the generation hash, so a new reference regenerates that speaker only.
  --dry-run            list what would be done        --report-only  recompute report/manifest/audition
"""
import argparse
import hashlib
import json
import os
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import qa  # noqa: E402

CACHE = ROOT / ".cache/tts/gen"
TAKES = CACHE / "takes"
STATE_P = CACHE / "state.json"
MAC_PY = ROOT / ".cache/tts/A/venv/bin/python"
WORKER = HERE / "kyutai_worker.py"
AURIGA = HERE / "remote/auriga_gen.sh"
AURIGA_CB = HERE / "remote/auriga_cb.sh"
POST_VERSION = 7  # bump when the post-processing code (not the cast.json chain) changes

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--only", default="")
ap.add_argument("--keys", default="")
ap.add_argument("--limit", type=int, default=0)
ap.add_argument("--batch", type=int, default=0)
ap.add_argument("--remote", default="")
ap.add_argument("--remote-chunk", type=int, default=96)
ap.add_argument("--remote-batch", type=int, default=32)
ap.add_argument("--repost", action="store_true")
ap.add_argument("--regen", action="store_true", help="discard the takes of the selected lines and generate anew")
ap.add_argument("--dry-run", action="store_true")
ap.add_argument("--report-only", action="store_true")
ap.add_argument("--requa", action="store_true", help="re-score stored takes (stored ASR text) with the current QA rules")
ap.add_argument("--reasr", action="store_true", help="re-run ASR on all stored takes, then re-score")
ap.add_argument("--no-mac", action="store_true", help="generate only on the remote worker")
ap.add_argument("--seed-offset", type=int, default=0,
                help="add N to the retake seeds (with --regen: a fresh set of takes for a line whose seeds all failed)")
args = ap.parse_args()

LINES = json.load(open(HERE / "lines.fr.json"))
CAST = json.load(open(HERE / "cast.json"))
QA = CAST["qa"]
# Padding tokens before the first word. Takes made before 2026-10-07 used 2 (moshi default); 6 lets the voice
# start from silence instead of mid-phoneme. Deliberately NOT part of gen_hash: passing takes stay valid.
PAD = int(CAST["model"]["defaults"].get("initialPadding", 2))
OUT = ROOT / CAST["output"]["dir"]
OUT.mkdir(parents=True, exist_ok=True)
TAKES.mkdir(parents=True, exist_ok=True)


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def prep(t: str) -> str:  # Kyutai text fixes found in the bake-off (.cache/tts/A/tools/prep.py)
    t = t.replace("’", "'").replace("‘", "'")
    t = t.replace("…", "... ")
    t = re.sub(r"\b([A-ZÀ-ÖØ-Þ]{2,})\b", lambda m: m.group(1).capitalize(), t)
    return re.sub(r"\s+", " ", t).strip()


def h(obj) -> str:
    return hashlib.sha1(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]


def line_id(l):
    return Path(l["file"]).stem


PRON = json.load(open(HERE / "pronunciation.json"))


def tts_of(l):  # per-key TTS text: pronunciation.json "lines", then cast.json ttsOverride, then lines.fr.json
    o = PRON.get("lines", {}).get(l["key"]) or CAST.get("ttsOverride", {}).get(l["key"]) or {}
    return o.get("tts", l["tts"])


def engine(spk: str) -> str:
    return CAST["speakers"][spk].get("engine", "kyutai")


_REF_SHA = {}


def ref_sha(sp) -> str:
    """sha256 of a cloning reference (repo path). It must match the cast entry's refHash: a replaced reference is
    caught here instead of silently mixing takes of two voices."""
    p = ROOT / sp["ref"]
    if p not in _REF_SHA:
        _REF_SHA[p] = "sha256:" + hashlib.sha256(p.read_bytes()).hexdigest()
        if sp.get("refHash") and sp["refHash"] != _REF_SHA[p]:
            sys.exit(f"{sp['ref']}: sha256 {_REF_SHA[p]} differs from cast.json refHash {sp['refHash']}; "
                     "update refHash after replacing the reference (this regenerates the speaker)")
    return _REF_SHA[p]


def gen_hash(l):
    sp = CAST["speakers"][l["speaker"]]
    if engine(l["speaker"]) == "chatterbox":
        return h({"engine": "chatterbox", "model": sp["model"], "t3": sp["t3"], "lang": sp["lang"],
                  "tts": prep(tts_of(l)), "refHash": ref_sha(sp), "exaggeration": sp["exaggeration"],
                  "cfgWeight": sp["cfgWeight"], "temp": sp["temp"], "seeds": QA["retakeSeeds"], "post": sp["post"]})
    return h({"model": CAST["model"]["id"], "tts": prep(tts_of(l)), "voice": sp["voice"], "cfg": sp["cfg"],
              "temp": sp["temp"], "seeds": QA["retakeSeeds"], "post": sp["post"]})


def post_hash(l):
    best = STATE.get(line_id(l), {}).get("best") or {}
    return h({"gen": gen_hash(l), "take": best.get("proc"), "key": l["key"], "text": l["text"], "delivery": l["delivery"],
              "chain": CAST["deliveries"][l["delivery"]], "out": CAST["output"], "v": POST_VERSION})


# ---------------------------------------------------------------- state
def load_state():
    try:
        return json.load(open(STATE_P))
    except Exception:
        return {}


STATE = load_state()
STATE_LOCK = threading.Lock()


def save_state():
    with STATE_LOCK:
        tmp = STATE_P.with_suffix(".tmp")
        json.dump(STATE, open(tmp, "w"), ensure_ascii=False, indent=1)
        os.replace(tmp, STATE_P)


# ---------------------------------------------------------------- speaker post (Sami)
def speaker_post(raw: Path, proc: Path, ops):
    if not ops:
        shutil.copy(raw, proc)
        return
    import parselmouth
    from parselmouth.praat import call
    snd = parselmouth.Sound(str(raw))
    for op in ops:
        if op["op"] in ("childify", "gender"):  # Sami: child; Jo (R4): Québécois man -> woman
            snd = call(snd, "Change gender", 75, 600, op["formantRatio"], op["targetF0"], op["pitchRange"], 1.0)
        elif op["op"] == "lengthen":  # Durand (R4): slower, pitch kept
            snd = call(snd, "Lengthen (overlap-add)", 75, 600, op["factor"])
        else:
            raise ValueError(op)
    snd.save(str(proc), "WAV")


# ---------------------------------------------------------------- QA of one take
def score(t):
    s = t["cer"]
    if not t["ended"] or t["cut"]:
        s += 0.5
    if t["badPace"]:
        s += 0.3
    s += 0.25 * len(t.get("edge") or []) + (0.2 if t.get("hotOnset") else 0) + (0.3 if t.get("wrongSpk") else 0)
    return s


def qa_take(i, take):
    l = BYID[i]
    sp = CAST["speakers"][l["speaker"]]
    raw = Path(take["raw"])
    proc = raw.with_name(raw.stem + ".proc.wav")
    speaker_post(raw, proc, sp["post"])
    y, sr = sf.read(proc, dtype="float32")
    if y.ndim > 1:
        y = y.mean(1)
    # A transcript made on auriga (engine=chatterbox: remote/asr_remote.py) is of the raw take; it stands for the
    # processed one only when there is no speaker post (raw == proc). Otherwise Whisper runs here.
    hyp = take.pop("asrRemote", None) if not sp["post"] else None
    if hyp is None:
        take.pop("asrRemote", None)
        hyp = qa.asr(proc)
    st = qa.signal_stats(y, sr, tts_of(l))
    take.update(proc=str(proc), asr=hyp, wps=round(st["wps"], 2), cps=round(st["cps"], 1), span=st["span"],
                letters=st["letters"], tailDb=round(st["tail_db"], 1))
    take["speaker"] = l["speaker"]
    take_extras(take, y, sr)
    return judge(l, take)


def take_extras(take, y=None, sr=None):
    """Onset level (first 10 ms vs the loudest 10 ms frame) and the ECAPA embedding of a take."""
    if "onsetDb" in take and "emb" in take and "f0r" in take:
        return
    take.pop("emb", None)  # recompute all from the same file
    import librosa
    if y is None:
        y, sr = sf.read(take["proc"], dtype="float32")
        if y.ndim > 1:
            y = y.mean(1)
    n = int(sr * 0.01)
    m = max(1, len(y) // n)
    fd = 20 * np.log10(np.sqrt((y[: m * n].reshape(m, n) ** 2).mean(1) + 1e-12))
    take["onsetDb"] = round(float(fd[0] - fd.max()), 1)
    y16 = librosa.resample(y, orig_sr=sr, target_sr=16000)
    take["emb"] = [round(float(v), 5) for v in qa.ecapa(y16)]
    take["f0r"] = None
    med = F0MED.get(take.get("speaker"))
    if med:  # pitch in a range around the character's median (avoids Praat octave errors on short clips)
        take["f0r"] = round(qa.f0_median(y16, 16000, floor=max(50, med / 2.2), ceil=med * 2.5), 1) or None


CENT = {}
F0MED = {}


def _kept(l):
    """Kept take of a line, only when it was made with the speaker's current cast entry (a recast speaker must not
    be judged against the old voice's pitch / centroid)."""
    st = STATE.get(line_id(l)) or {}
    return (st.get("best") or {}) if st.get("genHash") == gen_hash(l) else {}


def centroids():
    """Per-speaker ECAPA centroid sums and median F0 of the kept takes (dry), for the per-take speaker check."""
    CENT.clear()
    f0s = {}
    for l in LINES["lines"]:
        b = _kept(l)
        if b.get("f0"):
            f0s.setdefault(l["speaker"], []).append(b["f0"])
    F0MED.clear()
    F0MED.update({k: float(np.median(v)) for k, v in f0s.items() if len(v) >= 3})
    for l in LINES["lines"]:
        b = _kept(l)
        if b.get("emb"):
            c = CENT.setdefault(l["speaker"], {"sum": 0, "n": 0, "files": set()})
            c["sum"] = c["sum"] + np.array(b["emb"])
            c["n"] += 1
            c["files"].add(line_id(l))


def edge_words(l, take):
    """First/last-word checks on the ASR: a stray word before the line ('et j'allais'), a dropped first word
    ("'aurais pu" for "J'aurais pu"), or the last word missing. Returns a list of problems."""
    r0 = qa.norm(tts_of(l))
    eq = lambda ws: [w2 for w in ws for w2 in qa.ASR_EQUIV.get(w, w).split()]  # noqa: E731
    ref, hyp = eq(r0.split()), eq(qa.qc_hyp(r0, qa.norm(qa.strip_hallu(take.get("asr") or ""))).split())
    if not ref or not hyp or QA.get("noAsr", {}).get(l["key"]):
        return []

    def same(a, b):
        a, b = qa.ASR_EQUIV.get(a, a), qa.ASR_EQUIV.get(b, b)
        if a == b or qa.silent(a) == qa.silent(b):
            return True
        import jiwer
        return len(a) >= 3 and float(jiwer.cer(a, b)) <= 0.34

    out = []
    if not same(ref[0], hyp[0]):
        if len(hyp) > 1 and same(ref[0], hyp[1]) or len(hyp) > 2 and same(ref[0], hyp[2]):
            out.append("lead-extra")
        elif len(ref) > 1 and same(ref[1], hyp[0]):
            out.append("lead-drop")
    if len(ref) > 1 and not any(same(ref[-1], w) for w in hyp[-3:]) and not any(same(ref[-2], w) for w in hyp[-2:]):
        # homophones across word boundaries ('des cols' / 'd'école', 'assis' / 'à 6'): compare the sound of
        # the last ~10 letters instead of words
        import jiwer
        import unicodedata

        def tail(ws):
            t = "".join(qa.silent(w) for w in ws).replace("ç", "s")
            t = "".join(ch for ch in unicodedata.normalize("NFD", t) if unicodedata.category(ch) != "Mn")
            return t[-10:]
        if float(jiwer.cer(tail(ref), tail(hyp))) > 0.35:
            out.append("tail-drop")
    return out


def speaker_check(l, take):
    """Nearest-centroid ECAPA check (leave-one-out) for speakers with >= 3 kept takes and a voiced span >= 0.8 s
    (ECAPA is unreliable on shorter clips)."""
    if not take.get("emb") or take.get("span", 0) < 0.8 or not CENT:
        return None
    e = np.array(take["emb"])
    i = line_id(l)
    cos = {}
    for spk, c in CENT.items():
        sm, n = c["sum"], c["n"]
        if spk == l["speaker"] and i in c["files"]:
            b = STATE[i].get("best") or {}
            if b.get("emb"):
                sm, n = sm - np.array(b["emb"]), n - 1
        if n < 3:
            continue
        v = sm / np.linalg.norm(sm)
        cos[spk] = float(e @ v)
    if l["speaker"] not in cos:
        return None
    return {"own": round(cos[l["speaker"]], 3), "nearest": max(cos, key=cos.get),
            "nearestCos": round(max(cos.values()), 3)}


def judge(l, take):
    """Pass/fail from the stored take metrics (re-runnable with --requa / --reasr)."""
    lo, hi = QA["cps"]  # letters per second over the voiced span (French speech ~10-17)
    n = take.get("letters", 99)
    take["badPace"] = bool((n >= 12 and not (lo <= take["cps"] <= hi)) or take["span"] > 1.5 + n * 0.15)
    take["cut"] = bool(take["tailDb"] > QA["maxTailDb"])
    if take.get("asr") and qa.strip_hallu(take["asr"]) != take["asr"]:  # caption hallucination ("Sous-titrage ...")
        take["asrRaw"], take["asr"] = take["asr"], qa.strip_hallu(take["asr"])
    ver = QA.get("verified", {}).get(l["key"])  # a take checked by hand (Whisper skips a part it hears on its own)
    if ver and ver.get("genHash") == gen_hash(l) and ver.get("attempt") == take.get("attempt") and take.get("asr") != ver["heard"]:
        take["asrRaw"], take["asr"] = take["asr"], ver["heard"]
    no_asr = QA.get("noAsr", {}).get(l["key"])
    if no_asr:  # interjections ASR cannot score: judge on the voiced span only
        a, b = no_asr["span"]
        c = 0.0 if a <= take["span"] <= b else 1.0
    else:
        c = qa.cer(tts_of(l), take["asr"])
    take["cer"] = round(c, 4)
    # Edge / speaker checks (2026-10-07 audit): stray or clipped first word, hot onset, wrong voice.
    take["speaker"] = l["speaker"]
    if ("emb" not in take or "onsetDb" not in take or "f0r" not in take) and take.get("proc") and Path(take["proc"]).exists():
        take_extras(take)
    if take.get("f0r") is None and F0MED.get(l["speaker"]) and take.get("proc") and Path(take["proc"]).exists():
        # scored before the speaker had a pitch median (first pass of a new / recast speaker): measure it now, or
        # the second pass would skip the pitch check for every first-pass take
        import librosa
        y16, _ = librosa.load(take["proc"], sr=16000, mono=True)
        med = F0MED[l["speaker"]]
        take["f0r"] = round(qa.f0_median(y16, 16000, floor=max(50, med / 2.2), ceil=med * 2.5), 1) or None
    take["edge"] = edge_words(l, take)
    od = take.get("onsetDb", -99)  # the model started mid-phoneme: clipped consonant or a stray syllable
    take["hotOnset"] = bool(od > QA.get("hotOnsetDb", -12) and (take["edge"] or c > 0.0) or od > QA.get("hotOnsetHardDb", -6))
    sc = speaker_check(l, take)
    take["spk"] = sc
    take["wrongSpk"] = bool(sc and sc["nearest"] != l["speaker"])
    med = F0MED.get(l["speaker"])
    take["f0Dev"] = round(12 * np.log2(take["f0r"] / med), 1) if take.get("f0r") and med else None
    lim = QA.get("maxF0DevSt", 7) if take.get("machine", "mac") == "mac" else QA.get("maxF0DevStRemote", 4)
    if take["f0Dev"] is not None and abs(take["f0Dev"]) > lim:
        take["wrongSpk"] = True  # pitch far off the character's (Odile at 280 Hz, Gérard +6 st on auriga)
    take["pass"] = bool(c <= QA["maxCer"] and not take["cut"] and not take["badPace"] and take["ended"]
                        and not take["edge"] and not take["hotOnset"] and not take["wrongSpk"])
    take["score"] = round(score(take), 4)
    return take


# ---------------------------------------------------------------- selection
lines = LINES["lines"]
if args.only:
    keep = set(args.only.split(","))
    lines = [l for l in lines if l["speaker"] in keep]
if args.keys:
    keep = set(args.keys.split(","))
    lines = [l for l in lines if l["key"] in keep or line_id(l) in keep]
BYID = {line_id(l): l for l in lines}

# A line that becomes a per-speaker variant (the same text now said by a second character) moves from
# <key>.ogg to <key>-<speaker>.ogg: keep its takes when they were made with this speaker's voice.
for l in LINES["lines"]:
    i = line_id(l)
    old = STATE.get(l["key"])
    if l.get("variant") and i not in STATE and old and old.get("genHash") == gen_hash(l) and old.get("best") \
            and (old["best"].get("speaker") or l["speaker"]) == l["speaker"]:
        STATE[i] = json.loads(json.dumps(old))
        STATE[i].pop("postHash", None)
        STATE[i].pop("out", None)
        log(f"variant {i}: kept the takes of {l['key']}")

def pick_best(i):
    st = STATE.get(i)
    if not st or not st.get("takes"):
        return
    good = [t for t in st["takes"] if t.get("proc") and Path(t["proc"]).exists()]
    if good:
        st["best"] = min(good, key=lambda t: (t["score"], t["attempt"]))


if args.regen:
    for i in BYID:
        STATE.pop(i, None)
centroids()
SPK_NO_F0 = {l["speaker"] for l in lines} - set(F0MED)  # no pitch reference yet (new or recast speaker)

if args.reasr or args.requa:
    for i, l in BYID.items():
        st = STATE.get(i, {})
        if st.get("genHash") != gen_hash(l):
            continue
        for t in st.get("takes", []):
            if t.get("proc") and Path(t["proc"]).exists():
                if args.reasr:
                    t["asr"] = qa.asr(t["proc"])
                if args.reasr or "cps" not in t:
                    y, sr = sf.read(t["proc"], dtype="float32")
                    stt = qa.signal_stats(y if y.ndim == 1 else y.mean(1), sr, tts_of(l))
                    t.update(wps=round(stt["wps"], 2), cps=round(stt["cps"], 1), span=stt["span"],
                             letters=stt["letters"], tailDb=round(stt["tail_db"], 1))
                judge(l, t)
        if st.get("takes"):
            old = (st.get("best") or {}).get("proc")
            pick_best(i)
            emb_keep = st["best"].get("emb") if old == st["best"]["proc"] else None
            if not emb_keep:
                st["best"].pop("emb", None)
                st["best"].pop("f0", None)
            if any(t.get("pass") for t in st["takes"]):
                st["done"] = True
            elif len(st["takes"]) <= QA["retakes"]:
                st["done"] = False  # gets its remaining retakes on this run
    save_state()
    log("re-scored stored takes" + (" (new ASR)" if args.reasr else ""))

need_gen, need_post, up_to_date = [], [], []
for l in lines:
    i = line_id(l)
    st = STATE.get(i, {})
    ogg = OUT / l["file"]
    best_ok = st.get("genHash") == gen_hash(l) and st.get("best") and Path(st["best"]["proc"]).exists()
    finished = best_ok and (st["best"].get("pass") or len(st.get("takes", [])) > QA["retakes"])
    if finished and st.get("postHash") == post_hash(l) and ogg.exists() and not args.repost:
        up_to_date.append(i)
    elif finished:
        need_post.append(i)
    else:
        need_gen.append(i)
if args.limit:
    need_gen = need_gen[: args.limit]
log(f"{len(lines)} lines: {len(up_to_date)} up to date, {len(need_post)} to re-process, {len(need_gen)} to generate")
if args.dry_run:
    for i in need_gen:
        print("gen ", i, BYID[i]["speaker"], prep(tts_of(BYID[i])))
    for i in need_post:
        print("post", i)
    sys.exit(0)


# ---------------------------------------------------------------- generation machines
WORK = []  # list of (id, attempt)
WORK_LOCK = threading.Lock()
RESULTS = queue.Queue()
INFLIGHT = {"n": 0}
STOP = threading.Event()
WORK_EVT = threading.Event()  # set when work is queued: idle workers wake on it (a plain time.sleep in a background
#                               job can be held for minutes by macOS timer coalescing)
MACHINE_STATS = {}


def item_for(i, attempt, out_path):
    l = BYID[i]
    sp = CAST["speakers"][l["speaker"]]
    return {"id": i, "text": prep(tts_of(l)), "voice": sp["voice"], "cfg": sp["cfg"], "temp": sp["temp"],
            "seed": QA["retakeSeeds"][attempt] + args.seed_offset, "out": str(out_path), "attempt": attempt, "pad": PAD}


def take_path(i, attempt, machine):
    d = TAKES / i / STATE[i]["genHash"]
    d.mkdir(parents=True, exist_ok=True)
    return d / f"a{attempt}-{machine}.wav"


def has_work(eng="kyutai"):
    with WORK_LOCK:
        return any(engine(BYID[w[0]]["speaker"]) == eng for w in WORK)


def grab(n, eng="kyutai"):
    """Take up to n similar-length work items (same attempt -> same seed) of one engine."""
    with WORK_LOCK:
        mine = [w for w in WORK if engine(BYID[w[0]]["speaker"]) == eng]
        if not mine:
            return []
        mine.sort(key=lambda x: (x[1], len(BYID[x[0]]["tts"])))
        a0 = mine[0][1]
        same = [w for w in mine if w[1] == a0][:n]
        for w in same:
            WORK.remove(w)
        INFLIGHT["n"] += len(same)
        return same


def mac_machine(batch):
    name = "mac"
    MACHINE_STATS[name] = {"lines": 0, "audio_s": 0.0, "gen_s": 0.0, "batches": 0}
    p = subprocess.Popen(["nice", "-n", "10", str(MAC_PY), "-I", str(WORKER)], stdin=subprocess.PIPE,
                         stdout=subprocess.PIPE, stderr=open(CACHE / "mac_worker.log", "a"), text=True, bufsize=1)
    assert json.loads(p.stdout.readline()).get("ready")
    log("mac worker ready")
    while not STOP.is_set():
        got = grab(batch)
        if not got:
            if INFLIGHT["n"] == 0 and not has_work():
                break
            WORK_EVT.wait(1)
            WORK_EVT.clear()
            continue
        items = [item_for(i, a, take_path(i, a, name)) for i, a in got]
        req = {"seed": items[0]["seed"], "temp": items[0]["temp"], "initialPadding": PAD, "items": items}
        p.stdin.write(json.dumps(req, ensure_ascii=False) + "\n")
        p.stdin.flush()
        r = json.loads(p.stdout.readline())
        if not r.get("ok"):
            log("mac batch failed:", r.get("error"))
            for it in items:
                RESULTS.put((it["id"], {"attempt": it["attempt"], "machine": name, "raw": None, "error": r.get("error")}))
            continue
        ms = MACHINE_STATS[name]
        ms["batches"] += 1
        ms["gen_s"] += r["gen_s"]
        for it, o in zip(items, r["items"]):
            ms["lines"] += 1
            ms["audio_s"] += o["dur"]
            RESULTS.put((it["id"], {"attempt": it["attempt"], "machine": name, "seed": it["seed"], "raw": o["out"],
                                    "dur": o["dur"], "ended": o["ended"], "batch": len(items), "pad": PAD}))
        log(f"mac batch {len(items)}: {sum(o['dur'] for o in r['items']):.1f}s audio in {r['gen_s']:.1f}s")
    p.stdin.close()
    p.wait()


def remote_machine(host, chunk, batch):
    name = host
    MACHINE_STATS[name] = {"lines": 0, "audio_s": 0.0, "gen_s": 0.0, "batches": 0}
    rdir = CACHE / "remote"
    rdir.mkdir(exist_ok=True)
    while not STOP.is_set():
        got = grab(chunk)
        if not got:
            if INFLIGHT["n"] == 0 and not has_work():
                break
            WORK_EVT.wait(2)
            WORK_EVT.clear()
            continue
        jobs = []
        for i, a in got:
            it = item_for(i, a, None)
            jobs.append({"key": f"{i}.a{a}", "model": "A", "speaker": BYID[i]["speaker"], "text": it["text"],
                         "voice": it["voice"], "cfg": it["cfg"], "temp": it["temp"], "seed": it["seed"],
                         "initial_padding": PAD, "prep": False})
        run = "hl-" + h([j["key"] + STATE[i]["genHash"] for j, (i, a) in zip(jobs, got)])[:10]
        jp = rdir / f"{run}.json"
        json.dump(jobs, open(jp, "w"), ensure_ascii=False, indent=1)
        od = rdir / run
        t0 = time.time()
        rc = subprocess.run(["bash", str(AURIGA), str(jp), str(od), "--name", run, "--batch", str(batch),
                             "--host", host], stdout=open(CACHE / f"{host}.log", "a"), stderr=subprocess.STDOUT).returncode
        dt = time.time() - t0
        ms = MACHINE_STATS[name]
        n_ok = 0
        for j, (i, a) in zip(jobs, got):
            src = od / f"{j['key']}.wav"
            if rc == 0 and src.exists():
                dst = take_path(i, a, name)
                shutil.copy(src, dst)
                d = sf.info(dst).duration
                ms["lines"] += 1
                ms["audio_s"] += d
                n_ok += 1
                RESULTS.put((i, {"attempt": a, "machine": name, "seed": j["seed"], "raw": str(dst), "dur": d,
                                 "ended": True, "batch": batch, "pad": PAD}))
            else:
                with WORK_LOCK:  # hand back to the Mac
                    WORK.append((i, a))
                    INFLIGHT["n"] -= 1
        ms["gen_s"] += dt
        ms["batches"] += 1
        log(f"{host} run {run}: {n_ok}/{len(jobs)} lines in {dt:.0f}s (rc {rc})")
        if rc != 0:
            log(f"{host} failed; disabling remote for this run")
            break


def cb_machine(host, chunk):
    """engine=chatterbox speakers: Chatterbox Multilingual on auriga (remote/auriga_cb.sh -> clone/cb_worker.py), one
    take per (line, attempt) at that attempt's retake seed, with the Whisper transcript made on auriga too. The
    machine name is the host, so the remote pitch limit (maxF0DevStRemote) applies."""
    name = host
    MACHINE_STATS[name] = {"lines": 0, "audio_s": 0.0, "gen_s": 0.0, "batches": 0}
    rdir = CACHE / "remote"
    rdir.mkdir(exist_ok=True)
    while not STOP.is_set():
        got = grab(chunk, "chatterbox")
        if not got:
            if INFLIGHT["n"] == 0 and not has_work("chatterbox"):
                break
            WORK_EVT.wait(2)
            WORK_EVT.clear()
            continue
        jobs = []
        for i, a in got:
            l = BYID[i]
            sp = CAST["speakers"][l["speaker"]]
            ref = ROOT / sp["ref"]
            jobs.append({"key": f"{i}.a{a}", "refLocal": str(ref),
                         "refName": f"{ref.stem}-{ref_sha(sp)[7:19]}{ref.suffix}", "text": prep(tts_of(l)),
                         "lang": sp["lang"], "seed": QA["retakeSeeds"][a] + args.seed_offset, "takes": 1,
                         "exaggeration": sp["exaggeration"], "cfg_weight": sp["cfgWeight"], "temperature": sp["temp"]})
        run = "cb-" + h([j["key"] + STATE[i]["genHash"] for j, (i, a) in zip(jobs, got)])[:10]
        # the reference goes to auriga under a content-addressed name (a replaced reference never reuses a file)
        stage = rdir / run / "refs"
        stage.mkdir(parents=True, exist_ok=True)
        for j in jobs:
            dst = stage / j.pop("refName")
            if not dst.exists():
                shutil.copy(j["refLocal"], dst)
            j["refLocal"] = str(dst)
        t3 = {CAST["speakers"][BYID[i]["speaker"]]["t3"] for i, _ in got}
        assert len(t3) == 1, "one T3 checkpoint per run"
        jp = rdir / f"{run}.json"
        json.dump(jobs, open(jp, "w"), ensure_ascii=False, indent=1)
        od = rdir / run / "out"
        t0 = time.time()
        rc = subprocess.run(["bash", str(AURIGA_CB), str(jp), str(od), "--name", run, "--host", host, "--t3", t3.pop()],
                            stdout=open(CACHE / f"{host}-cb.log", "a"), stderr=subprocess.STDOUT).returncode
        dt = time.time() - t0
        asr = {}
        try:
            asr = json.load(open(od / "asr.json"))
        except Exception:  # noqa: BLE001
            pass
        ms = MACHINE_STATS[name]
        n_ok = 0
        for j, (i, a) in zip(jobs, got):
            src = od / f"{j['key']}.t0.wav"
            if rc == 0 and src.exists():
                dst = take_path(i, a, name)
                shutil.copy(src, dst)
                d = sf.info(dst).duration
                ms["lines"] += 1
                ms["audio_s"] += d
                n_ok += 1
                tk = {"attempt": a, "machine": name, "engine": "chatterbox", "seed": j["seed"], "raw": str(dst),
                      "dur": d, "ended": True, "batch": 1, "pad": None}
                if src.name in asr:
                    tk["asrRemote"] = asr[src.name]
                RESULTS.put((i, tk))
            else:  # nobody else can make these takes: leave them for the next run
                with WORK_LOCK:
                    INFLIGHT["n"] -= 1
        ms["gen_s"] += dt
        ms["batches"] += 1
        log(f"{host} chatterbox run {run}: {n_ok}/{len(jobs)} takes in {dt:.0f}s (rc {rc})")
        if rc != 0:
            log(f"{host} chatterbox failed (see {CACHE / (host + '-cb.log')}); its lines stay pending, re-run to resume")
            break


# ---------------------------------------------------------------- post-processing
def ffmpeg_chain(y, sr_in, chain, sr_out=48000):
    import tempfile
    with tempfile.TemporaryDirectory(dir=CACHE) as td:
        a, b = Path(td) / "a.wav", Path(td) / "b.wav"
        if sr_in != sr_out:
            from math import gcd
            from scipy.signal import resample_poly
            g = gcd(sr_in, sr_out)
            y = resample_poly(y.astype(np.float64), sr_out // g, sr_in // g).astype(np.float32)
        sf.write(a, y, sr_out, subtype="FLOAT")
        af = chain or "anull"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(a), "-af", af, "-ar", str(sr_out), "-ac", "1",
                        "-c:a", "pcm_f32le", str(b)], check=True)
        z, _ = sf.read(b, dtype="float32")
    return z


def frame_db(y, sr, win=0.01):
    n = int(sr * win)
    m = len(y) // n
    if m == 0:
        return np.array([-120.0])
    r = np.sqrt((y[: m * n].reshape(m, n) ** 2).mean(1) + 1e-12)
    return 20 * np.log10(r)


def edges(y, sr, thr_db, run=3):
    """First / last sample of the voiced part: the first / last run of `run` consecutive 10 ms frames within
    thr_db of the loudest frame, so an isolated click (Mimi's first decoded frame) is not taken as the start."""
    d = frame_db(y, sr)
    a = d > d.max() + thr_db
    if len(a) >= run:
        r = np.convolve(a.astype(int), np.ones(run, int), mode="valid") == run  # r[i]: frames i..i+run-1 all above
        v = np.where(r)[0]
        if len(v):
            n = int(sr * 0.01)
            return v[0] * n, (v[-1] + run) * n
    v = np.where(a)[0]
    if not len(v):
        return 0, len(y)
    n = int(sr * 0.01)
    return v[0] * n, (v[-1] + 1) * n


def lufs(y, sr):
    import pyloudnorm as pyln
    z = y
    if len(z) < sr * 1.0:  # integrated loudness needs >= 400 ms; tile short clips for the measurement
        z = np.tile(z, int(np.ceil(sr * 1.0 / max(len(z), 1))) + 1)
    return pyln.Meter(sr).integrated_loudness(z.astype(np.float64))


def true_peak_db(y, sr):
    from scipy.signal import resample_poly
    z = resample_poly(y.astype(np.float64), 4, 1)
    return 20 * np.log10(np.abs(z).max() + 1e-12)


def limit(y, sr, ceiling_db):
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    from scipy.signal import resample_poly
    z = np.abs(resample_poly(y.astype(np.float64), 4, 1))[: len(y) * 4].reshape(-1, 4).max(1)
    c = 10 ** (ceiling_db / 20)
    g = np.minimum(1.0, c / np.maximum(z, 1e-9))
    w = int(sr * 0.004)
    g = minimum_filter1d(g, 2 * w + 1)
    g = uniform_filter1d(g, w + 1)
    return (y * g).astype(np.float32)


def post_line(i):
    l = BYID[i]
    st = STATE[i]
    dl = CAST["deliveries"][l["delivery"]]
    o = CAST["output"]
    y, sr = sf.read(st["best"]["proc"], dtype="float32")
    if y.ndim > 1:
        y = y.mean(1)
    # 1. trim the model's leading/trailing silence on the dry take
    s, e = edges(y, sr, o["edgeThresholdDb"])
    s = max(0, s - int(sr * 0.04))
    e = min(len(y), e + int(sr * 0.10))
    y = y[s:e]
    # 2. normalise to ~-20 dBFS RMS, add the room-tone / hiss bed at a fixed SNR, pad for tails
    rms = np.sqrt((y ** 2).mean() + 1e-12)
    y = y * (10 ** (-20 / 20) / rms)
    pad = np.zeros(int(sr * 0.25), np.float32)
    zc = ffmpeg_chain(np.concatenate([y, pad]), sr, dl["ffmpeg"])  # clean pass: decides the trim points
    if dl.get("noiseDb") is not None:
        rng = np.random.default_rng(int(l["key"][:8], 16))
        nz = rng.standard_normal(len(y) + len(pad)).astype(np.float32)
        nz = np.convolve(nz, np.ones(3) / 3, mode="same")  # slightly darker than white
        nz *= 10 ** (dl["noiseDb"] / 20) / (np.sqrt((nz ** 2).mean()) + 1e-12)
        z = ffmpeg_chain(np.concatenate([y, pad]) + nz, sr, dl["ffmpeg"])
    else:
        z = zc
    # 3. edge trim on the processed clean signal: output.preRollMs before / output.postRollMs after the first / last run of
    #    30 ms within output.trimThresholdDb of the loudest 10 ms frame (before POST_VERSION 6 a single click
    #    frame at the start of the take kept up to 0.85 s of quiet model noise in front of the line), fades
    s2, e2 = edges(zc, 48000, o.get("trimThresholdDb", -48))
    s2 = max(0, s2 - int(48000 * o.get("preRollMs", 30) / 1000))
    e2 = min(len(z), e2 + int(48000 * o.get("postRollMs", 100) / 1000))
    z = z[s2:e2].copy()
    fi, fo = int(48000 * 0.005), int(48000 * 0.03)
    z[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)
    z[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32)
    # 4. loudness + true-peak, verified on the decoded Opus
    want = dl["lufs"]
    target = want
    ceiling = o["limiterCeiling"]
    ogg = OUT / l["file"]
    for attempt in range(5):
        x = z.copy()
        for _ in range(3):
            x = x * 10 ** ((target - lufs(x, 48000)) / 20)
            x = limit(x, 48000, ceiling)
        tmp = CACHE / f"_{i}.wav"
        sf.write(tmp, x, 48000, subtype="FLOAT")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-c:a", "libopus", "-b:a", o["bitrate"],
                        "-vbr", "on", "-application", "audio", "-ac", "1", "-ar", "48000",
                        "-map_metadata", "-1", str(ogg)], check=True)
        dec = subprocess.run(["ffmpeg", "-v", "error", "-i", str(ogg), "-f", "f32le", "-ac", "1", "-ar", "48000", "-"],
                             check=True, capture_output=True).stdout
        d = np.frombuffer(dec, np.float32)
        tp, lu = true_peak_db(d, 48000), lufs(d, 48000)
        tmp.unlink()
        if tp <= o["truePeak"] and abs(lu - want) <= 0.5:
            break
        if tp > o["truePeak"]:
            ceiling -= 0.5
        target += want - lu  # compensate codec loudness drift
    hs, he = edges(d, 48000, -45)  # same definition as scripts/voice/audit.py
    st["out"] = {"file": l["file"], "dur": round(len(d) / 48000, 3), "lufs": round(lu, 2), "tp": round(tp, 2),
                 "headMs": round(hs / 48, 1), "tailMs": round((len(d) - he) / 48, 1),
                 "bytes": ogg.stat().st_size}
    st["postHash"] = post_hash(l)
    return i


# ---------------------------------------------------------------- run
t_start = time.time()
if not args.report_only and need_gen:
    for i in need_gen:
        gh = gen_hash(BYID[i])
        st = STATE.get(i, {})
        if st.get("genHash") != gh:
            STATE[i] = {"genHash": gh, "takes": [], "done": False}
        else:
            STATE[i]["done"] = False
        tk = STATE[i]["takes"]
        # resume: re-use takes already made for this hash
        nxt = len(tk)
        if tk and (any(t.get("pass") for t in tk) or nxt > QA["retakes"]):
            STATE[i]["done"] = True
            continue
        WORK.append((i, nxt))
    save_state()
    threads = []
    if not args.no_mac and has_work("kyutai"):
        threads.append(threading.Thread(target=mac_machine, args=(args.batch or CAST["model"]["defaults"]["batch"],),
                                        daemon=True))
    if args.remote and has_work("kyutai"):
        threads.append(threading.Thread(target=remote_machine, args=(args.remote, args.remote_chunk,
                                                                      args.remote_batch), daemon=True))
    if has_work("chatterbox"):  # Chatterbox runs on auriga only (never on the Mac)
        cb_hosts = {args.remote or CAST["speakers"][BYID[i]["speaker"]].get("host", "auriga") for i, _ in WORK
                    if engine(BYID[i]["speaker"]) == "chatterbox"}
        for host in sorted(cb_hosts):
            threads.append(threading.Thread(target=cb_machine, args=(host, args.remote_chunk), daemon=True))
    for t in threads:
        t.start()
    total = len(WORK)
    done_n = 0
    flag = CACHE / "ENABLE_REMOTE"  # write a host name into this file to attach a remote worker mid-run
    while True:
        if not args.remote and flag.exists() and WORK:
            host = flag.read_text().strip() or "auriga"
            args.remote = host
            t = threading.Thread(target=remote_machine, args=(host, args.remote_chunk, args.remote_batch), daemon=True)
            t.start()
            threads.append(t)
            log(f"attached remote worker {host}")
        try:
            i, take = RESULTS.get(timeout=2)
        except queue.Empty:
            if not any(t.is_alive() for t in threads):
                break
            continue
        st = STATE[i]
        if take.get("raw"):
            try:
                qa_take(i, take)
            except Exception as ex:  # noqa: BLE001
                take.update(error=repr(ex), cer=1.0, score=9.0, **{"pass": False})
        else:
            take.update(cer=1.0, score=9.0, **{"pass": False})
        st["takes"].append(take)
        if take["pass"] or len(st["takes"]) > QA["retakes"]:
            st["done"] = True
            done_n += 1
            if not take["pass"]:
                log(f"FAIL {i} after {len(st['takes'])} takes; best kept")
        else:
            with WORK_LOCK:
                WORK.append((i, len(st["takes"])))
            WORK_EVT.set()
        with WORK_LOCK:
            INFLIGHT["n"] -= 1
        tag = "ok " if take["pass"] else "re " if not st["done"] else "BAD"
        log(f"[{done_n}/{total}] {tag} {i} {BYID[i]['speaker']:8s} a{take['attempt']} {take.get('machine')} "
            f"cer={take.get('cer')} cps={take.get('cps')} tail={take.get('tailDb')} | {take.get('asr', take.get('error'))}")
        if done_n % 10 == 0:
            save_state()
    save_state()

# choose best take for every finished line
for i in list(BYID):
    pick_best(i)


def lead_trim(i):
    """Kyutai sometimes prepends a short word to very short lines ('Trop facile.' for 'Facile.'). When the
    ASR hypothesis is <extra words> + <the line>, cut the audio just before the line's first word."""
    l, st = BYID[i], STATE[i]
    b = st["best"]
    ref = qa.norm(tts_of(l)).split()
    if not ref or b.get("pass") or b.get("trimmed"):
        return False
    hyp = qa.norm(b.get("asr") or "").split()
    if len(hyp) <= len(ref) or qa.cer(" ".join(ref), " ".join(hyp[len(hyp) - len(ref):])) > QA["maxCer"]:
        return False
    ws = qa.words_ts(b["proc"])
    first = None
    for k, (w, t0, _) in enumerate(ws):
        if qa.norm(w).split()[:1] == [qa.silent(ref[0])] or qa.silent(qa.norm(w)).split()[:1] == [qa.silent(ref[0])]:
            first = t0
    if first is None or first <= 0.05:
        return False
    y, sr = sf.read(b["proc"], dtype="float32")
    cut = max(0, int((first - 0.06) * sr))
    p = Path(b["proc"]).with_name(Path(b["proc"]).stem.replace(".proc", "") + "-trim.proc.wav")
    z = y[cut:].copy()
    f = int(sr * 0.015)
    z[:f] *= np.linspace(0, 1, f, dtype=np.float32)
    sf.write(p, z, sr)
    t = dict(b, proc=str(p), attempt=b["attempt"], trimmed=round(cut / sr, 3))
    for k in ("emb", "f0", "f0r", "onsetDb", "spk", "edge"):
        t.pop(k, None)
    t["asr"] = qa.asr(p)
    stt = qa.signal_stats(z, sr, tts_of(l))
    t.update(cps=round(stt["cps"], 1), span=stt["span"], letters=stt["letters"], tailDb=round(stt["tail_db"], 1))
    judge(l, t)
    st["takes"].append(t)
    pick_best(i)
    log(f"lead-trim {i}: cut {cut / sr:.2f}s -> cer {t['cer']} | {t['asr']}")
    return True


if not args.report_only:
    for i in list(BYID):
        st = STATE.get(i)
        if st and st.get("best") and st.get("done") and len(st["takes"]) > QA["retakes"]:
            lead_trim(i)
save_state()
t_gen = time.time() - t_start

# post-process
todo = [i for i in BYID if STATE.get(i, {}).get("best") and STATE[i].get("done", True)
        and (args.repost or STATE[i].get("postHash") != post_hash(BYID[i]) or not (OUT / BYID[i]["file"]).exists())]
if not args.report_only and todo:
    from concurrent.futures import ThreadPoolExecutor
    log(f"post-processing {len(todo)} lines")
    with ThreadPoolExecutor(6) as ex:
        for i in ex.map(post_line, todo):
            pass
    save_state()

# ---------------------------------------------------------------- manifest (all lines of lines.fr.json)
ALL = LINES["lines"]
man_lines = {}
missing = []
for l in ALL:
    i = line_id(l)
    st = STATE.get(i, {})
    if not st.get("out") or st.get("postHash") != post_hash(l) or not (OUT / l["file"]).exists() \
            or not st.get("best", {}).get("pass"):  # only clips that passed QA (a missing key = no voice)
        missing.append(i)
        continue
    ent = {"file": l["file"], "dur": st["out"]["dur"], "speaker": l["speaker"], "delivery": l["delivery"],
           "text": l["text"]}
    if l.get("variant"):
        man_lines.setdefault(l["key"], {"variants": {}})["variants"][l["who"]] = ent
    else:
        man_lines[l["key"]] = ent
mp = OUT / "manifest.json"
old = {}
try:
    old = json.load(open(mp))
except Exception:
    pass
CLONED = sorted(k for k in CAST["speakers"] if engine(k) == "chatterbox")
man = {"version": 1, "model": f"{CAST['model']['id']} (moshi-mlx bf16 on the Mac / PyTorch-ROCm on auriga; cfg 2.0, temp 0.6)"
       + "".join(f"; {k}: {CAST['speakers'][k]['model']} (cloned voice, auriga)" for k in CLONED),
       "generatedAt": old.get("generatedAt") if old.get("lines") == man_lines else
       datetime.now(timezone.utc).isoformat(timespec="seconds"),
       "lines": dict(sorted(man_lines.items()))}
json.dump(man, open(mp, "w"), ensure_ascii=False, indent=1)
# remove .ogg files no longer referenced
ref = {l["file"] for l in ALL}
for f in OUT.glob("*.ogg"):
    if f.name not in ref:
        f.unlink()
        log("removed stale", f.name)

# ---------------------------------------------------------------- report: QA, distinctness, F0
rep = {"lines": len(ALL), "inManifest": len(ALL) - len(missing), "missing": missing}
fails, cers, durs, size = [], [], 0.0, 0
by_machine = {}
for l in ALL:
    st = STATE.get(line_id(l), {})
    b = st.get("best")
    if not b:
        continue
    cers.append(b["cer"])
    by_machine[b["machine"]] = by_machine.get(b["machine"], 0) + 1
    if not b.get("pass"):
        fails.append({"id": line_id(l), "speaker": l["speaker"], "cer": b["cer"], "asr": b.get("asr"),
                      "tts": tts_of(l), "cut": b.get("cut"), "badPace": b.get("badPace"), "takes": len(st["takes"])})
    if st.get("out"):
        durs += st["out"]["dur"]
        size += st["out"]["bytes"]
rep.update(failed=fails, meanCer=round(float(np.mean(cers)), 4) if cers else None,
           totalDurS=round(durs, 1), totalMB=round(size / 1e6, 2), keptByMachine=by_machine,
           takesTotal=sum(len(STATE.get(line_id(l), {}).get("takes", [])) for l in ALL),
           machineStats=MACHINE_STATS, genWallS=round(t_gen, 1))
outs = [STATE[line_id(l)]["out"] for l in ALL if STATE.get(line_id(l), {}).get("out")]
if outs:
    rep["loudness"] = {"maxTp": max(o["tp"] for o in outs), "maxHeadMs": max(o["headMs"] for o in outs),
                       "maxTailMs": max(o["tailMs"] for o in outs)}

# speaker distinctness (ECAPA on dry kept takes) and F0
import librosa  # noqa: E402

emb, f0 = {}, {}
for l in ALL:
    st = STATE.get(line_id(l), {})
    b = st.get("best")
    if not b:
        continue
    if "emb" not in b or "f0" not in b:
        y16, _ = librosa.load(b["proc"], sr=16000)
        b["emb"] = [round(float(v), 5) for v in qa.ecapa(y16)]
        b["f0"] = round(qa.f0_median(y16, 16000), 1)
    emb.setdefault(l["speaker"], []).append(np.array(b["emb"]))
    if b["f0"]:
        f0.setdefault(l["speaker"], []).append(b["f0"])
save_state()
cent = {k: (np.mean(v, 0) / np.linalg.norm(np.mean(v, 0))) for k, v in emb.items()}
ks = sorted(cent)
pairs = sorted(((round(float(cent[a] @ cent[b]), 3), a, b) for x, a in enumerate(ks) for b in ks[x + 1:]),
               reverse=True)
within = {k: round(float(np.mean([e @ cent[k] for e in v])), 3) for k, v in emb.items()}
rep["distinctness"] = {"metric": "ECAPA cosine between speaker centroids (dry kept takes)",
                       "threshold": 0.40, "maxPair": pairs[0] if pairs else None, "top": pairs[:8],
                       "withinSpeakerToCentroid": within, "pass": bool(not pairs or pairs[0][0] < 0.40)}
rep["f0Median"] = {k: round(float(np.median(v)), 1) for k, v in f0.items()}
json.dump(rep, open(CACHE / "report.json", "w"), ensure_ascii=False, indent=1)
log(json.dumps({k: rep[k] for k in ("lines", "inManifest", "meanCer", "totalDurS", "totalMB", "keptByMachine",
                                    "takesTotal", "genWallS")}))
log("failed:", len(fails), "| distinctness max pair:", rep["distinctness"]["maxPair"], "| F0:", rep["f0Median"])

# ---------------------------------------------------------------- audition page
AUD = ROOT / ".cache/tts/audition"
AUD.mkdir(parents=True, exist_ok=True)
esc = lambda s: str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")  # noqa
order = ["hugo", "odile", "sami", "bastien", "lou", "gerard", "benali", "jo", "durand", "okafor", "receptionist", "tv",
         "radio_fishing", "radio_football", "radio_forecast"]
blocks = []
for spk in order:
    ls = [l for l in ALL if l["speaker"] == spk and STATE.get(line_id(l), {}).get("out")]
    if not ls:
        continue
    # 3 real lines: prefer different deliveries, then longer lines
    pick = []
    for dlv in ["spoken", "inner", "bark", "voicemail", "tv", "radio", "flashback"]:
        c = sorted([l for l in ls if l["delivery"] == dlv], key=lambda l: -len(l["text"]))
        if c:
            pick.append(c[min(1, len(c) - 1)])
    for l in sorted(ls, key=lambda l: -len(l["text"])):
        if len(pick) >= 3:
            break
        if l not in pick:
            pick.append(l)
    pick = pick[:3]
    sp = CAST["speakers"][spk]
    meta = LINES["speakers"].get(spk, {})
    rows = "".join(
        f'<tr><td class="d">{esc(l["delivery"])}</td><td>{esc(l["text"])}<small>{esc(l.get("en", ""))}</small></td>'
        f'<td><audio controls preload="none" src="../../../{esc(CAST["output"]["dir"])}/{esc(l["file"])}"></audio></td>'
        f'<td class="m">CER {STATE[line_id(l)]["best"]["cer"]:.2f}</td></tr>' for l in pick)
    allrows = "".join(
        f'<tr><td class="d">{esc(l["delivery"])}</td><td>{esc(l["text"])}</td>'
        f'<td><audio controls preload="none" src="../../../{esc(CAST["output"]["dir"])}/{esc(l["file"])}"></audio></td>'
        f'<td class="m">{esc(l["file"][:-4])}</td></tr>' for l in sorted(ls, key=lambda l: l["path"]))
    blocks.append(f'<section><h2>{esc(meta.get("who", spk))} <span>{esc(meta.get("name", ""))}'
                  f' · {esc(meta.get("age", ""))} · F0 {rep["f0Median"].get(spk, 0):.0f} Hz · {len(ls)} lines</span></h2>'
                  f'<p class="v">{esc(sp.get("voice") or (sp.get("engine", "") + ": " + sp.get("ref", "")))} ({esc(sp["licence"])}){"".join(" + " + o["op"] for o in sp["post"])}'
                  f' — {esc(sp.get("why", ""))}</p><table>{rows}</table>'
                  + (f'<details><summary>All {len(ls)} lines</summary><table>{allrows}</table></details>' if len(ls) > 3 else '')
                  + '</section>')

# QA pass (scripts/voice/audit.py + .cache/tts/qa/changes.json): what was found, before / after
qa_html = ""
try:
    aud = json.load(open(CACHE / "audit.json"))
    fl = "".join(
        f'<tr><td class="d">{esc(r["speaker"])}</td><td>{esc(r["text"])}<small>heard: {esc(r["asr"])}</small></td>'
        f'<td><audio controls preload="none" src="../../../{esc(CAST["output"]["dir"])}/{esc(r["file"])}"></audio></td>'
        f'<td class="m">{esc("; ".join(r["flags"]))}</td></tr>' for r in aud["flagged"])
    qa_html += (f'<h2>Audit of the final clips <span>{aud["checked"]} checked · {len(aud["flagged"])} flagged · '
                f'mean CER {aud["summary"]["meanCer"]} · max true peak {aud["summary"]["maxTp"]} dBTP · '
                f'max head / tail silence {aud["summary"]["maxHeadMs"]:.0f} / {aud["summary"]["maxTailMs"]:.0f} ms</span></h2>'
                '<p class="v">Remaining flags after the QA pass: homophones Whisper spells differently, Whisper losing '
                'a clip-initial word it hears with more leading silence, and ECAPA on clips under a second. See docs/voice.md §12.</p>'
                f'<table>{fl}</table>')
except Exception:  # noqa: BLE001
    pass
try:
    chg = json.load(open(ROOT / ".cache/tts/qa/changes.json"))
    byf = {line_id(l): l for l in ALL}
    rows_c = "".join(
        f'<tr><td class="d">{esc(byf[i]["speaker"])}<small>{esc(c["kind"])}</small></td><td>{esc(byf[i]["text"])}'
        f'<small>{esc(c["why"])}</small></td><td>'
        + (f'<audio controls preload="none" src="../qa/before/{esc(byf[i]["file"])}"></audio><small>before</small>'
           if c["kind"] == "regenerated" else '<small>new line</small>')
        + f'</td><td><audio controls preload="none" src="../../../{esc(CAST["output"]["dir"])}/{esc(byf[i]["file"])}"></audio>'
          f'<small>after</small></td></tr>'
        for i, c in chg["clips"].items() if i in byf)
    qa_html += (f'<h2>QA pass {esc(chg["date"])} <span>{sum(c["kind"] == "regenerated" for c in chg["clips"].values())} '
                f'regenerated · {sum(c["kind"] == "new" for c in chg["clips"].values())} new</span></h2>'
                '<p class="v">Every clip was also re-trimmed (click-proof edge detection: no more up to 0.85 s of '
                'model noise in front of a line).</p>'
                f'<details open><summary>Before / after</summary><table>{rows_c}</table></details>')
except Exception:  # noqa: BLE001
    pass
# New lines (R4 voice phase): every clip not in the manifest before it, by chapter then speaker
new_html = ""
try:
    base = set(json.load(open(CACHE / "baseline-r4.json"))["ids"])
    game_ch = {}
    for f in sorted((ROOT / "src/story/text/games").glob("ch*.js")):
        for g in re.findall(r"^  (\w+): \{", f.read_text(), re.M):
            game_ch[g] = f.stem
    def chap(l):
        a = l["path"].split(".")
        if a[0] == "games" and len(a) > 1:
            return game_ch.get(a[1], "games")
        return a[0] if re.fullmatch(r"ch\d", a[0]) else "items" if a[0] == "items" else "common"
    CH_NAME = {**{f"ch{n}": f"Chapitre {n}" for n in range(1, 8)}, "items": "Objets (tous chapitres)",
               "common": "Commun", "games": "Mini-jeux"}
    new = [l for l in ALL if line_id(l) not in base]
    by = {}
    for l in new:
        by.setdefault(chap(l), {}).setdefault(l["speaker"], []).append(l)
    secs = []
    for ch in sorted(by, key=lambda c: (not c.startswith("ch"), c)):
        sub = []
        for spk in [s for s in order if s in by[ch]] + sorted(set(by[ch]) - set(order)):
            ls = sorted(by[ch][spk], key=lambda l: l["path"])
            rr = []
            for l in ls:
                st = STATE.get(line_id(l), {})
                b = st.get("best") or {}
                ok = bool(b.get("pass")) and bool(st.get("out"))
                au = (f'<audio controls preload="none" src="../../../{esc(CAST["output"]["dir"])}/{esc(l["file"])}"></audio>'
                      if (OUT / l["file"]).exists() else "<small>no clip</small>")
                rr.append(f'<tr{"" if ok else " class=bad"}><td class="d">{esc(l["delivery"])}</td><td>{esc(l["text"])}'
                          f'<small>{esc(l["path"])}{" · heard: " + esc(b.get("asr", "")) if b.get("cer") else ""}</small></td>'
                          f'<td>{au}</td><td class="m">CER {b.get("cer", 1):.2f} · {len(st.get("takes", []))} take(s)'
                          f'{" · " + esc(b.get("machine", "")) if b else ""}{"" if ok else " · QA FAIL"}</td></tr>')
            sub.append(f'<h3>{esc(LINES["speakers"].get(spk, {}).get("who", spk))} <span>{len(ls)}</span></h3><table>{"".join(rr)}</table>')
        n = sum(len(v) for v in by[ch].values())
        secs.append(f'<details open><summary><b>{esc(CH_NAME.get(ch, ch))}</b> · {n} lines</summary>{"".join(sub)}</details>')
    new_dur = sum(STATE.get(line_id(l), {}).get("out", {}).get("dur", 0) for l in new)
    new_html = (f'<h2>New lines (R4) <span>{len(new)} clips · {new_dur / 60:.1f} min · by chapter, then speaker</span></h2>'
                '<p class="v">Every clip that was not in the manifest before the R4 voice phase. Jo is the cloned voice '
                'cb-qc1-clear (Chatterbox Multilingual, docs/voice.md §15; her clips were regenerated 2026-10-09); M. Durand is '
                'provisional (§13). To recast one speaker, change its entry in scripts/voice/cast.json, then '
                '<code>generate.py --only jo --remote auriga --no-mac</code>.</p>' + "".join(secs))
except Exception as ex:  # noqa: BLE001
    log("new-lines section skipped:", repr(ex))
(AUD / "index.html").write_text(f"""<!doctype html><meta charset="utf-8"><title>HAIRLINE cast audition</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{{--bg:#141210;--fg:#e9e2d6;--dim:#9a9184;--line:#2c2823;--acc:#d9a441}}
body{{margin:0;padding:24px 16px;background:var(--bg);color:var(--fg);font:15px/1.45 -apple-system,system-ui,sans-serif;max-width:1100px}}
h1{{font-weight:300;letter-spacing:.2em;margin:0 0 4px}} h2{{margin:28px 0 4px;color:var(--acc);font-weight:500}}
h2 span{{color:var(--dim);font-size:13px;font-weight:400}} .v{{color:var(--dim);font-size:12px;margin:0 0 6px}}
table{{border-collapse:collapse;width:100%}} td{{border-bottom:1px solid var(--line);padding:8px;vertical-align:middle}}
td small{{display:block;color:var(--dim);font-size:12px}} .d{{color:var(--dim);font-size:12px;width:70px}} .m{{color:var(--dim);font-size:12px;white-space:nowrap}}
audio{{width:240px;height:32px}} a{{color:var(--acc)}} .note{{color:var(--dim)}}
details{{margin:8px 0}} h3{{margin:14px 0 2px;font-weight:500}} h3 span{{color:var(--dim);font-size:12px}} tr.bad td{{background:#3a1d1a}} code{{color:var(--acc)}} summary{{cursor:pointer;color:var(--dim)}} td small{{display:block}}
</style>
<h1>HAIRLINE · French cast</h1>
<p class="note">Kyutai TTS 1.6B en_fr, final processed clips (Opus, delivery processing baked in). Three real lines per character
(fewer when the character has fewer). Mean CER {rep['meanCer']}, {rep['inManifest']}/{rep['lines']} lines, {rep['totalDurS']/60:.1f} min.
Max ECAPA similarity between two characters: {esc(rep['distinctness']['maxPair'])}. <a href="../listen.html">Listening checklist</a>.</p>
{new_html}
<h2 style="margin-top:40px">Cast <span>three real lines per character, then all of them</span></h2>
{''.join(blocks)}
{qa_html}
""")
log("audition page:", AUD / "index.html")

# A speaker that had no pitch median / ECAPA centroid at the start of the run (new or recast) was generated without
# the per-take pitch and speaker checks. Now that its kept takes exist, re-score them (and give the takes that
# fail their remaining retakes) in a second pass.
if SPK_NO_F0 and not (args.requa or args.reasr or args.dry_run or args.report_only):
    now = {l["speaker"] for l in ALL if _kept(l).get("f0")}
    cnt = {s: sum(1 for l in ALL if l["speaker"] == s and _kept(l).get("f0")) for s in SPK_NO_F0 & now}
    redo = sorted(s for s, n in cnt.items() if n >= 3)
    if redo:
        argv, skip = [], False
        for a in sys.argv[1:]:
            if skip:
                skip = False
                continue
            if a in ("--only", "--keys"):
                skip = True
                continue
            if a == "--regen" or a.startswith(("--only=", "--keys=")):
                continue
            argv.append(a)
        log("second pass with pitch / speaker checks for", ",".join(redo))
        os.execv(sys.executable, [sys.executable, __file__, *argv, "--requa", "--only", ",".join(redo)])
