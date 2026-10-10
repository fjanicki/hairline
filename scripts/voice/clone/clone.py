"""R4 Jo: zero-shot voice cloning audition (Chatterbox Multilingual from Québécoise Common Voice references), compared
with the Kyutai options already on .cache/tts/audition-r4/index.html. Orchestrates auriga from the Mac; all model
work (generation, Whisper, ECAPA, age/gender, accent classifiers, UTMOS) runs on auriga, none on the Mac's GPU.
Nothing here touches cast.json, the game's clips or the manifest.

  scripts/voice/clone/remote/setup_auriga.sh          # once: ~/hairline-clone (venv-cb, venv-qa)
  python3 scripts/voice/clone/clone.py refs           # Common Voice references -> auriga refs/cand + scores
  python3 scripts/voice/clone/clone.py gen            # Chatterbox takes (every screened reference x 6 lines x 2)
  python3 scripts/voice/clone/clone.py kyutai         # the 5 Kyutai Jo options on the 3 lines they lack
  .cache/tts/A/evalvenv/bin/python scripts/voice/clone/clone.py qa    # QA every take on auriga, then `accent`
  .cache/tts/A/evalvenv/bin/python scripts/voice/clone/clone.py accent  # accent classifiers + UTMOS only
  .cache/tts/A/evalvenv/bin/python scripts/voice/clone/clone.py page   # pick, encode, section + rebuild page

Work files: .cache/tts/audition-r4/work/clone/ (Mac) and ~/hairline-clone/ (auriga).
"""
import json
import statistics as st
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE.parent))
import audition_r4 as A  # noqa: E402

HOST = "auriga"
R = "hairline-clone"                     # remote dir, relative to $HOME
W = A.WORK / "clone"                     # local work dir
NB = A.NB

# ---------------------------------------------------------------- lines (docs/SCRIPT-R4.md, 2026-10-09)
# `kyutai`: the id of the same text in audition_r4.JO_LINES, whose takes already exist for the Kyutai options.
LINES = [
    {"id": "c1", "tag": "flirty", "src": "ch5.week4.jo", "kyutai": "j3",
     "text": f"Attends. Tu répares sa roue en l’écoutant{NB}? Ok. C’est hot."},
    {"id": "c2", "tag": "deadpan", "src": "ch5.week3.joMenu (1)", "kyutai": "s3",
     "text": f"Deux cent douze{NB}? Ok. Pis{NB}? Tu sais faire quoi d’autre{NB}?"},
    {"id": "c3", "tag": "warm", "src": "ch5.week3.jo", "kyutai": "j5",
     "text": "Chaque tattoo, c’est quelque chose que j’ai appris. Le fouet, c’est l’année où j’ai réussi la tourtière "
             "de ma grand-mère. L’engrenage, c’est le char manuel."},
    {"id": "c4", "tag": "stakeout (hushed)", "src": "ch6.week9.stakeout",
     "text": "Soupe aux pois. Celle de ma grand-mère. Chu pas venue pour l’enquête, chu venue pour la soupe."},
    {"id": "c5", "tag": "Québécois: « Ben là »", "src": "ch5.week3.joMenu (3)",
     "text": f"T’as fait des croissants avec madame Benali à quatre heures du matin{NB}? Ben là. T’es pas mal plus "
             "intéressant que t’en as l’air."},
    {"id": "c6", "tag": "Québécois: « Tabarnouche »", "src": "ch6.week6.photo",
     "text": f"Tabarnouche. Y dort jamais, lui{NB}?"},
]
LINE = {l["id"]: l for l in LINES}

# Chatterbox Multilingual settings: the model card's defaults (good across languages). The reference is in the
# target language, so its accent is what we want carried over (cfg_weight 0 would suppress it).
CB = {"lang": "fr", "exaggeration": 0.5, "cfg_weight": 0.5, "temperature": 0.8, "seed": 1, "takes": 2}
CB_T3 = "v3"

# Screened references (Common Voice speaker prefixes, women, Canadian on all three classifiers, estimated age
# 24-41, cast similarity < 0.40); the three best after cloning become cb-qc1..3 (see `page`).
SCREEN = ["0ac15640cf", "ed0e4d79c6", "34cf47070d", "2fec6b140c", "e26d042cfc", "394a648b5c", "6f96c34a25"]
# Final picks, in page order (set after `qa`; reasons in docs/voice.md §13).
PICKS = {"cb-qc1": "34cf47070d", "cb-qc2": "ed0e4d79c6", "cb-qc3": "2fec6b140c"}
# Dropped after QA: 6f96c34a25 (most natural, UTMOS 3.89, strongly Canadian, but 0.41 from Lou's centroid),
# 0ac15640cf (0.41 from the forecast radio, accent mostly lost), e26d042cfc and 394a648b5c (accent mostly lost).
NOTES = {  # per option, for the card (numbers from the 2026-10-09 run)
    "cb-qc1": "Lower, slightly husky voice (F0 about 172 Hz). Common Voice age band « twenties », estimated 33 on "
              "the cloned lines. The strongest Québec accent of the clones: all three classifiers call both halves "
              "Canadian, and 5 of the 5 takes long enough to score. Nearest cast voice: Lou at 0.38, just under the "
              "0.40 limit, so check her against Lou by ear.",
    "cb-qc2": "Brighter, higher voice (F0 about 235 Hz). Common Voice age band « forties », but she reads young "
              "(estimated 25). Canadian on 5 of 5 takes for all three classifiers, though Voxlect Whisper is weaker "
              "on the first three lines. The most distinct from the cast (radio forecast 0.31).",
    "cb-qc3": "Mid voice (F0 about 209 Hz), age band « twenties », estimated 31. The accent carries less: Canadian on "
              "the stakeout / « Ben là » / « Tabarnouche » half, mostly not on the first three lines. Kept as the "
              "third speaker that passes every check.",
}


def tts_text(t: str) -> str:
    return t.replace(NB, " ").replace(" ", " ").replace("’", "'").replace("…", "...")


def sh(cmd, **kw):
    print("+", cmd if isinstance(cmd, str) else " ".join(cmd), file=sys.stderr)
    return subprocess.run(cmd, shell=isinstance(cmd, str), check=True, **kw)


def push_bin():
    sh(["ssh", HOST, f"mkdir -p {R}/bin {R}/work {R}/runs"])
    sh(["rsync", "-a", str(HERE / "cb_worker.py"), str(HERE / "qa_remote.py"), str(HERE / "refs.py"),
        str(ROOT / "scripts/voice/qa.py"), str(ROOT / ".cache/tts/A/tools/agegender.py"), f"{HOST}:{R}/bin/"])


def remote(cmd, log, wait=True):
    """Run a command in ~/hairline-clone detached (setsid nohup), then wait for it, printing the log tail."""
    sh(["ssh", HOST, f"cd {R} && rm -f {log}.rc && setsid nohup bash -c '{cmd}; echo $? > $HOME/{R}/{log}.rc' > {log} 2>&1 "
                     f"< /dev/null &"])
    if not wait:
        return
    import time
    while True:
        time.sleep(20)
        r = subprocess.run(["ssh", HOST, f"cd {R}; tail -c 400 {log} | tr '\\r' '\\n' | grep -v '^Sampling' | tail -2;"
                                         f" cat {log}.rc 2>/dev/null"], capture_output=True, text=True)
        print(r.stdout.strip().splitlines()[-2:] if r.stdout.strip() else "...", file=sys.stderr, flush=True)
        lines = r.stdout.strip().splitlines()
        if lines and lines[-1].strip().isdigit():
            if lines[-1].strip() != "0":
                sys.exit(f"remote command failed, see {HOST}:~/{R}/{log}")
            return


def fetch(rpath, local):
    Path(local).mkdir(parents=True, exist_ok=True)
    sh(["rsync", "-a", "--exclude", "*.tmp.wav", f"{HOST}:{R}/{rpath}", str(local)])


# ---------------------------------------------------------------- refs
def cmd_refs():
    push_bin()
    remote("venv-qa/bin/python bin/refs.py --parquet ~/hairline-tts/accent/calib/qc0.parquet "
           "--calib ~/hairline-tts/accent/calib/qc --out refs/cand", "work/refs.log")
    centroids()
    remote("venv-qa/bin/python bin/qa_remote.py --wavs refs/cand --centroids work/centroids.json "
           "--out work/qa_refs.json && cd ~/hairline-tts/accent && venv/bin/python accent_id.py --voxlect voxlect "
           "--out ~/hairline-clone/work/accent_refs.json ~/hairline-clone/refs/cand/ && venv/bin/python mos.py "
           "~/hairline-clone/work/mos_refs.json ~/hairline-clone/refs/cand", "work/refs_qa.log")
    for f in ("qa_refs", "accent_refs", "mos_refs"):
        fetch(f"work/{f}.json", W)
    fetch("refs/cand/", W / "refs")


def centroids():
    """The game cast's ECAPA centroids (audition_r4 analyse) plus M. Durand's provisional voice (9834, 7 takes)."""
    c = json.loads((A.WORK / "cast_centroids.json").read_text())
    dp = W / "durand_centroid.json"
    if not dp.exists():
        import numpy as np
        sh(["ssh", HOST, f"mkdir -p {R}/work/durand"])
        sh(["rsync", "-a"] + [str(f) for f in sorted(A.RAW.glob("durand__9834__d?.t0.wav"))] + [f"{HOST}:{R}/work/durand/"])
        (W / "c13.json").write_text(json.dumps(c))
        sh(["rsync", "-a", str(W / "c13.json"), f"{HOST}:{R}/work/centroids13.json"])
        remote("venv-qa/bin/python bin/qa_remote.py --wavs work/durand --centroids work/centroids13.json "
               "--out work/qa_durand.json", "work/durand.log")
        fetch("work/qa_durand.json", W)
        es = [np.array(r["emb"]) for r in json.loads((W / "qa_durand.json").read_text()).values()]
        m = np.mean(es, 0)
        dp.write_text(json.dumps((m / np.linalg.norm(m)).tolist()))
    c["durand"] = json.loads(dp.read_text())
    (W / "centroids.json").write_text(json.dumps(c))
    sh(["rsync", "-a", str(W / "centroids.json"), f"{HOST}:{R}/work/centroids.json"])
    return c


# ---------------------------------------------------------------- Chatterbox generation
def cmd_gen():
    push_bin()
    jobs = []
    for spk in SCREEN:
        for l in LINES:
            jobs.append({"key": f"cb__{spk}__{l['id']}", "ref": f"refs/cand/{spk}.wav", "text": tts_text(l["text"]),
                         **CB})
    W.mkdir(parents=True, exist_ok=True)
    (W / "cb_jobs.json").write_text(json.dumps(jobs, ensure_ascii=False, indent=1))
    sh(["rsync", "-a", str(W / "cb_jobs.json"), f"{HOST}:{R}/runs/cb_jobs.json"])
    remote(f"venv-cb/bin/python bin/cb_worker.py runs/cb_jobs.json runs/cb --t3 {CB_T3}", "work/cb.log")
    fetch("runs/cb/", W / "raw")
    sh(["rsync", "-a", f"{HOST}:{R}/work/cb.log", str(W / "cb.log")])


# ---------------------------------------------------------------- Kyutai: the 3 new lines for the 5 existing options
KY_VOICES = ["2216", "2114", "2154", "12977", "5830"]


def cmd_kyutai():
    jobs = []
    for v in KY_VOICES:
        for l in LINES:
            if "kyutai" not in l:
                jobs.append({"key": f"jo__{v}__{l['id']}", "model": "A", "voice": A.cml(v), "speaker": "jo",
                             "text": l["text"], "seed": 1, "takes": A.TAKES, "initial_padding": A.PAD})
    W.mkdir(parents=True, exist_ok=True)
    (W / "hl-r4-clone-kyutai.json").write_text(json.dumps(jobs, ensure_ascii=False, indent=1))
    sh([str(ROOT / "scripts/voice/remote/auriga_gen.sh"), str(W / "hl-r4-clone-kyutai.json"), str(W / "ky_raw")])
    # the game's post for the shifted options (Praat Change gender, as audition_r4 shift)
    for spk, p in A.SHIFTED.items():
        for f in sorted((W / "ky_raw").glob(f"jo__{spk}__*.wav")):
            dst = f.with_name(f.name.replace(f"jo__{spk}__", f"jo__{spk}f__"))
            if not dst.exists():
                A.shift(f, dst, p["targetF0"], p["formantRatio"], p["pitchRange"])


KY_OPTS = ["2216f", "2114f", "2154", "12977", "5830"]


def ky_takes(vid, lid):
    """Raw takes of a Kyutai option for one of LINES: the audition's own takes, or the ones made by `kyutai`."""
    l = LINE[lid]
    if "kyutai" in l:
        return sorted(A.RAW.glob(f"jo__{vid}__{l['kyutai']}.t*.wav"))
    return sorted((W / "ky_raw").glob(f"jo__{vid}__{lid}.t*.wav"))


def cb_takes(spk, lid):
    return sorted((W / "raw").glob(f"cb__{spk}__{lid}.t*.wav"))


# ---------------------------------------------------------------- QA (auriga)
def cmd_qa():
    push_bin()
    centroids()
    stage = W / "qa_up"
    stage.mkdir(parents=True, exist_ok=True)
    items = []
    for spk in SCREEN:
        for l in LINES:
            for f in cb_takes(spk, l["id"]):
                items.append({"wav": f"runs/cb/{f.name}", "text": l["text"]})
    for vid in KY_OPTS:
        for l in LINES:
            for f in ky_takes(vid, l["id"]):
                dst = stage / f"ky__{vid}__{l['id']}.{f.name.split('.')[-2]}.wav"
                if not dst.exists():
                    dst.write_bytes(f.read_bytes())
                items.append({"wav": f"runs/ky/{dst.name}", "text": l["text"]})
    (W / "items.json").write_text(json.dumps(items, ensure_ascii=False))
    sh(["rsync", "-a", f"{stage}/", f"{HOST}:{R}/runs/ky/"])
    sh(["rsync", "-a", str(W / "items.json"), f"{HOST}:{R}/work/items.json"])
    remote("venv-qa/bin/python bin/qa_remote.py --items work/items.json --centroids work/centroids.json "
           "--out work/qa.json", "work/qa.log")
    fetch("work/qa.json", W)
    cmd_accent()


def cmd_accent():
    """Accent classifiers + UTMOS on auriga. Per option, two clips: the kept takes (Québec-aware CER, score.py) of
    lines c1-c3 and of c4-c6, each trimmed, 0.25 s apart, cut at 15 s (Voxlect's limit; one clip of all six would
    lose the most Québécois lines). Every single take is scored too (unreliable under ~3 s)."""
    import numpy as np
    import librosa
    import soundfile as sf
    from score import best_take
    qa = json.loads((W / "qa.json").read_text())
    stage = W / "qa_up"
    acc = W / "accent"
    acc.mkdir(parents=True, exist_ok=True)
    opts = [(f"cb-{s}", "cb", s) for s in SCREEN] + [(f"ky-{v}", "ky", v) for v in KY_OPTS]
    for name, kind, v in opts:
        for half, ids in (("a", ["c1", "c2", "c3"]), ("b", ["c4", "c5", "c6"])):
            ys = []
            for lid in ids:
                pre = f"runs/{kind}/{kind}__{v}__{lid}."
                b = best_take([k for k in qa if k.startswith(pre)], qa, LINE[lid]["text"])
                if not b:
                    continue
                local = (W / "raw" / Path(b).name) if kind == "cb" else (stage / Path(b).name)
                y, _ = librosa.load(local, sr=16000)
                y, _ = librosa.effects.trim(y, top_db=40)
                ys += [y, np.zeros(4000, np.float32)]
            if ys:
                sf.write(acc / f"{name}__{half}.wav", np.concatenate(ys)[:16000 * 15], 16000)
    sh(["ssh", HOST, f"rm -rf {R}/work/accent"])
    sh(["rsync", "-a", f"{acc}/", f"{HOST}:{R}/work/accent/"])
    remote("cd ~/hairline-tts/accent && venv/bin/python accent_id.py --voxlect voxlect "
           "--out ~/hairline-clone/work/accent_opts.json ~/hairline-clone/work/accent/ ~/hairline-clone/runs/cb "
           "~/hairline-clone/runs/ky && "
           "venv/bin/python mos.py ~/hairline-clone/work/mos.json ~/hairline-clone/runs/cb ~/hairline-clone/runs/ky",
           "work/accent.log")
    fetch("work/accent_opts.json", W)
    fetch("work/mos.json", W)


# ---------------------------------------------------------------- page
def cmd_page():
    import page  # scripts/voice/clone/page.py
    page.build()


if __name__ == "__main__":
    {"refs": cmd_refs, "gen": cmd_gen, "kyutai": cmd_kyutai, "qa": cmd_qa, "accent": cmd_accent, "page": cmd_page,
     "centroids": centroids}[sys.argv[1]]()
