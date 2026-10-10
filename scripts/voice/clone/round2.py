"""R4 Jo, cloning round 2: cleaner references. Orchestrates auriga from the Mac (all model work on auriga's GPU /
CPU, none on the Mac's GPU). Nothing here touches cast.json, generate.py, extract-lines.mjs, qa.py or the game's clips.

User verdict on round 1: cb-qc1 has the right timbre and accent but sounds muffled (blamed on its reference);
cb-qc2 6/10; cb-qc3 too France-French; 2216f the worst. Round 2 looks for cleaner source recordings (main track)
and, as a comparison, cleans up cb-qc1's own reference.

  python3 scripts/voice/clone/round2.py push           # bin/ scripts to auriga
  # on auriga (see each script's docstring): cv_scan.py screen|clips|refs, cml_scan.py inventory|sample|screen|
  #   more|refs, enhance.sh (DeepFilterNet / Resemble Enhance on cb-qc1's rebuilt reference)
  python3 scripts/voice/clone/round2.py score          # every refs2/*.wav: quality, accent x3, ECAPA/age/gender, UTMOS
  python3 scripts/voice/clone/round2.py gen            # Chatterbox: OPTS x 6 lines x 2 takes
  .cache/tts/A/evalvenv/bin/python scripts/voice/clone/round2.py qa      # takes: Whisper, ECAPA, accent, UTMOS, quality
  .cache/tts/A/evalvenv/bin/python scripts/voice/clone/round2.py page    # section2.html + page rebuild

Work files: .cache/tts/audition-r4/work/clone2/ (Mac), ~/hairline-clone/{refs2,runs/cb2,work} (auriga).
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import clone as C  # noqa: E402  (LINES, tts_text, sh, remote, fetch, centroids, push_bin, HOST, R)

W2 = C.A.WORK / "clone2"
HOST, R = C.HOST, C.R
CB = dict(C.CB)  # model-card defaults: exaggeration 0.5, cfg 0.5, temperature 0.8, seed 1, 2 takes

EQ = "equalizer=f=3500:t=q:w=1.0:g=3,highshelf=f=7000:g=2"  # gentle presence lift (post, last resort)

# Round-2 options: id -> reference on auriga (relative to ~/hairline-clone), Chatterbox settings, and a note.
# Filled in from the `score` ranking (docs/voice.md §13.2 has the reasons).
OPTS = {
    # Part 1: cb-qc1's own speaker (Common Voice 34cf47070d), cleaner references (comparison track)
    "q1-dfn": {"ref": "refs2/enh/r1_34cf47070d_dfn.wav", "note": "round-1 reference through DeepFilterNet 3 (denoise)"},
    "q1-re": {"ref": "refs2/enh/r1_34cf47070d_re-enhance.wav",
              "note": "round-1 reference through Resemble Enhance (denoise + enhance, 44.1 kHz)"},
    "q1-r2": {"ref": "refs2/cv_34cf47070d.wav", "note": "rebuilt from her best clips (DNSMOS / bandwidth ranking)"},
    "q1-r2re": {"ref": "refs2/enh/r2_34cf47070d_re-enhance.wav", "note": "best clips + Resemble Enhance"},
    "q1-re-x": {"ref": "refs2/enh/r1_34cf47070d_re-enhance.wav", "cb": {"exaggeration": 0.6, "cfg_weight": 0.4,
                "temperature": 0.7}, "note": "Resemble Enhance reference, exaggeration 0.6, cfg 0.4, temperature 0.7"},
    # Last resort, labelled as such on the page: q1-re's takes with a gentle presence EQ (no new generation)
    "q1-eq": {"ref": "refs2/enh/r1_34cf47070d_re-enhance.wav", "from": "q1-re", "eq": EQ,
              "note": "q1-re takes + post-EQ (+3 dB at 3.5 kHz, +2 dB shelf above 7 kHz)"},
    # Part 2: other Common Voice speakers, references rebuilt from each one's best clips (all shards)
    **{f"cv-{s[:4]}": {"ref": f"refs2/cv_{s}.wav", "spk": s, "note": "Common Voice, best clips"} for s in
       ["0ac15640cf", "6f96c34a25", "df0a86d055", "50f0eefd72", "394a648b5c", "33e9fe2b78", "a4fbe7a8f1",
        "766f7b6893", "ed0e4d79c6", "7a3202b03a"]},
    "cv-394a-re": {"ref": "refs2/enh/cv_394a648b5c_re-enhance.wav", "note": "Common Voice, best clips + Resemble Enhance"},
    "cv-50f0-re": {"ref": "refs2/enh/cv_50f0eefd72_re-enhance.wav", "note": "Common Voice, best clips + Resemble Enhance"},
    # Part 2: LibriVox reader 1649 (CML-TTS / MLS speaker id = LibriVox reader id), public domain recordings
    "lv-1649": {"ref": "refs2/lv_1649.wav", "note": "LibriVox original 128 kbps MP3, her cleanest segment"},
    "lv-1649n": {"ref": "refs2/lv_1649n.wav", "note": "LibriVox original 128 kbps MP3, Mille et une nuits chapters"},
    "cml-1649": {"ref": "refs2/cml_1649.wav", "note": "the same reader from CML-TTS (64 kbps MP3 source, 24 kHz)"},
}


# Cards on the page, in order (the rest of OPTS is in the score table). Numbers from the 2026-10-09 run.
CV_SRC = "Mozilla Common Voice 25.0 French (CC0), anonymous contributor"
LV_SRC = ("LibriVox reader « Kalynda » (reader 1649), public domain; via CML-TTS French (CC BY 4.0), the 64 kbps "
          "LibriVox MP3 at 24 kHz")
CARDS = [
    {"id": "cb-qc1-clear", "oid": "q1-re", "label": "cb-qc1-clear · cb-qc1, cleaned reference", "reco": True,
     "source": CV_SRC + " (the cb-qc1 speaker)",
     "done": "The same 15 s reference as cb-qc1, run through Resemble Enhance (denoise + enhance, MIT) before cloning. "
             "No post-processing.",
     "note": "Same voice and accent as cb-qc1 (ECAPA 0.87 to cb-qc1's own takes), with the background noise of her "
             "recording gone: predicted naturalness UTMOS 3.85 against 3.41 for cb-qc1, Canadian on 5 of 5 takes."},
    {"id": "cb-qc1-eq", "oid": "q1-eq", "label": "cb-qc1-eq · cb-qc1-clear + presence EQ (post)",
     "source": CV_SRC + " (the cb-qc1 speaker)",
     "done": "The cb-qc1-clear takes with a gentle EQ after generation: +3 dB around 3.5 kHz, +2 dB shelf above "
             "7 kHz. This is post-processing (the « last resort »), not a cleaner reference.",
     "note": "Compare with cb-qc1-clear to hear whether the remaining dullness is the voice itself or the sound."},
    {"id": "cb-qc1-dfn", "oid": "q1-dfn", "label": "cb-qc1-dfn · cb-qc1, denoised reference",
     "source": CV_SRC + " (the cb-qc1 speaker)",
     "done": "The cb-qc1 reference through DeepFilterNet 3 (noise suppression only, MIT / Apache-2.0).",
     "note": "The closest to cb-qc1 (ECAPA 0.96 to its takes) and cleaner, but not brighter: denoising alone does "
             "not add presence."},
    {"id": "cb-qc4", "oid": "cv-394a-re", "label": "cb-qc4 · new Québécoise (Common Voice)",
     "source": CV_SRC,
     "done": "A speaker round 1 had dropped. Her reference was rebuilt from her best clips of all three Common Voice "
             "shards (ranked by DNSMOS / bandwidth), then run through Resemble Enhance.",
     "note": "Brighter and younger (F0 about 230 Hz). Canadian on all three classifiers; the most distinct from the "
             "cast (radio forecast 0.22)."},
    {"id": "cb-qc5", "oid": "cml-1649", "label": "cb-qc5 · LibriVox reader (audiobook recording)",
     "source": LV_SRC,
     "done": "A LibriVox audiobook reader found by screening all 40 women of CML-TTS French with the accent "
             "classifiers. Reference: two of her CML-TTS segments.",
     "note": "The brightest, most present sound of the new options (2–5 kHz at -14 dB, against -21 dB for cb-qc1). Voxlect MMS and "
             "XLSR call her Canadian on every take, Voxlect Whisper does not: listen for the accent. Reads young "
             "(about 25)."},
    {"id": "cb-qc6", "oid": "cv-50f0-re", "label": "cb-qc6 · new Québécoise (Common Voice), close to Lou",
     "source": CV_SRC,
     "done": "Reference rebuilt from her best Common Voice clips, then Resemble Enhance.",
     "note": "Among the most natural (UTMOS 3.99), mid-low voice, self-reported thirties. But her ECAPA centroid is "
             "0.43 from Lou's (over the 0.40 limit): only if she clearly differs from Lou by ear."},
]

INTRO = """<p><b>Your verdict on round 1:</b> cb-qc1 had the right timbre and accent but sounded muted;
cb-qc2 6/10; cb-qc3 too France-French; 2216f the worst. Round 2 looks for cleaner source recordings first, and fixes
cb-qc1's own reference as a comparison. All options: Chatterbox Multilingual (MIT), same 6 lines, 2 takes each, the
better kept by the Québec-aware CER; the game's « spoken » chain and -19 LUFS, like every option on this page.</p>
<p><b>Why cb-qc1 was muffled.</b> Not bandwidth (her reference reaches 11.7 kHz). Her recording is noisy: DNSMOS
background 2.96 and overall 2.65, against 4.0–4.2 and 3.2–3.5 for the game's cast clips. All 42 of her Common Voice
clips are like that (median overall 2.54), so no cleaner clips of her exist. Chatterbox copies the recording, not
just the voice; her takes also came out darker than cb-qc2's (2–5 kHz at -21 dB against -15 dB, relative to
100–1000 Hz). Cleaning the reference (Resemble Enhance) raises the reference to 3.06 overall / 3.69 background and the
takes' naturalness from UTMOS 3.41 to 3.85, with the same voice and accent (cb-qc1-clear).</p>
<p><b>Searched:</b> all 42 adult Québécoises of Common Voice 25.0 (3 shards, 2,500 clips scored), all 40 women of
CML-TTS French (LibriVox), and LibriVox readers of Québec books. Most clean audiobook voices are France-French; one
LibriVox reader is called Canadian (cb-qc5). The other Québec-book readers found were France-French, over 50, or
recorded at 8 kHz bandwidth.</p>"""


def push():
    C.push_bin()
    C.sh(["rsync", "-a"] + [str(HERE / f) for f in ("quality.py", "cv_scan.py", "cml_scan.py", "enhance.py")
                             if (HERE / f).exists()] + [f"{HOST}:{R}/bin/"])


def cmd_score(*dirs):
    """Score every reference in refs2/ (or the given dirs on auriga)."""
    push()
    C.centroids()
    dirs = dirs or ("refs2",)
    ds = " ".join(dirs)
    C.remote(f"venv-qa/bin/python bin/quality.py work/q_refs2.json {ds} && "
             f"venv-qa/bin/python bin/qa_remote.py --wavs {ds} --centroids work/centroids.json --out work/qa_refs2.json && "
             f"cd ~/hairline-tts/accent && venv/bin/python accent_id.py --voxlect voxlect "
             f"--out ~/hairline-clone/work/accent_refs2.json " + " ".join(f"~/hairline-clone/{d}" for d in dirs) +
             " && venv/bin/python mos.py ~/hairline-clone/work/mos_refs2.json " +
             " ".join(f"~/hairline-clone/{d}" for d in dirs), "work/score_refs2.log")
    for f in ("q_refs2", "qa_refs2", "accent_refs2", "mos_refs2"):
        C.fetch(f"work/{f}.json", W2)
    for d in dirs:
        C.fetch(f"{d}/", W2 / d)
    table()


def canada(a):
    return [a.get(m, {}).get("canada") for m in ("vx_whisper", "vx_mms", "ca_xlsr")] if a else [None] * 3


def table(prefix=""):
    q = json.loads((W2 / "q_refs2.json").read_text())
    qa = json.loads((W2 / "qa_refs2.json").read_text())
    acc = json.loads((W2 / "accent_refs2.json").read_text())
    mos = json.loads((W2 / "mos_refs2.json").read_text())
    rows = []
    for k, m in q.items():
        n = Path(k).stem
        if prefix and not n.startswith(prefix):
            continue
        a = next((v for kk, v in acc.items() if Path(kk).stem == n), {})
        r = next((v for kk, v in qa.items() if Path(kk).stem == n), {})
        u = next((v for kk, v in mos.items() if Path(kk).stem == n), None)
        near = max(r.get("ecapa", {}).items(), key=lambda kv: kv[1]) if r.get("ecapa") else ("?", 0)
        rows.append((m["q"], n, m["dnsmos"]["ovr"], m["dnsmos"]["sig"], m["dnsmos"]["bak"], m["bw"], m["presence"],
                     m["snr"], canada(a), r.get("pFemale"), r.get("age"), r.get("f0"), near, u))
    rows.sort(key=lambda x: -x[0])
    print(f"{'ref':22} {'q':>5} {'ovr':>4} {'sig':>4} {'bak':>4} {'bw':>5} {'pres':>5} {'snr':>4}  canada(W,M,X)    "
          f"fem  age   f0  nearest      utmos")
    for q_, n, o, s, b, bw, pr, sn, ca, pf, age, f0, near, u in rows:
        cs = " ".join("  - " if x is None else f"{x:.2f}" for x in ca)
        print(f"{n:22} {q_:5.2f} {o:4.2f} {s:4.2f} {b:4.2f} {bw:5} {pr:5.1f} {sn:4.0f}  {cs}  "
              f"{pf or 0:.2f} {age or 0:4.0f} {f0 or 0:4.0f}  {near[0][:10]:10} {near[1]:.2f}  {u or 0:.2f}")


def cmd_gen():
    push()
    jobs = []
    for oid, o in OPTS.items():
        if "from" in o:
            continue
        for l in C.LINES:
            jobs.append({"key": f"{oid}__{l['id']}", "ref": o["ref"], "text": C.tts_text(l["text"]),
                         **{**CB, **o.get("cb", {})}})
    W2.mkdir(parents=True, exist_ok=True)
    (W2 / "cb_jobs.json").write_text(json.dumps(jobs, ensure_ascii=False, indent=1))
    C.sh(["rsync", "-a", str(W2 / "cb_jobs.json"), f"{HOST}:{R}/runs/cb2_jobs.json"])
    C.remote(f"venv-cb/bin/python bin/cb_worker.py runs/cb2_jobs.json runs/cb2 --t3 {C.CB_T3}", "work/cb2.log")
    C.fetch("runs/cb2/", W2 / "raw")
    post_eq()


def post_eq():
    """Options with "from" + "eq": the source option's raw takes through an ffmpeg EQ (CPU, Mac), pushed to auriga
    next to the generated takes so the QA treats them like any other option."""
    for oid, o in OPTS.items():
        if "from" not in o:
            continue
        for f in sorted((W2 / "raw").glob(f"{o['from']}__*.wav")):
            dst = W2 / "raw" / f.name.replace(f"{o['from']}__", f"{oid}__")
            if not dst.exists():
                C.sh(["ffmpeg", "-v", "error", "-y", "-i", str(f), "-af", o["eq"], "-c:a", "pcm_s16le", str(dst)])
    C.sh(["rsync", "-a", f"{W2 / 'raw'}/", f"{HOST}:{R}/runs/cb2/"])


def cmd_qa():
    """Whisper/ECAPA/age/gender per take, then accent (lines 1-3 and 4-6 joined, kept takes), UTMOS, quality."""
    import numpy as np
    import librosa
    import soundfile as sf
    from score import best_take
    push()
    C.centroids()
    items = [{"wav": f"runs/cb2/{f.name}", "text": C.LINE[f.name.split("__")[1].split(".")[0]]["text"]}
             for f in sorted((W2 / "raw").glob("*.wav")) if f.name.split("__")[0] in OPTS]
    (W2 / "items.json").write_text(json.dumps(items, ensure_ascii=False))
    C.sh(["rsync", "-a", str(W2 / "items.json"), f"{HOST}:{R}/work/items2.json"])
    C.remote("venv-qa/bin/python bin/qa_remote.py --items work/items2.json --centroids work/centroids.json "
             "--out work/qa2.json", "work/qa2.log")
    C.fetch("work/qa2.json", W2)
    qa = json.loads((W2 / "qa2.json").read_text())
    acc = W2 / "accent"
    kept_dir = W2 / "kept"
    for d in (acc, kept_dir):
        d.mkdir(parents=True, exist_ok=True)
    for oid in OPTS:
        for half, ids in (("a", ["c1", "c2", "c3"]), ("b", ["c4", "c5", "c6"])):
            ys = []
            for lid in ids:
                b = best_take([k for k in qa if k.startswith(f"runs/cb2/{oid}__{lid}.")], qa, C.LINE[lid]["text"])
                if not b:
                    continue
                src = W2 / "raw" / Path(b).name
                dst = kept_dir / src.name
                if not dst.exists():
                    dst.write_bytes(src.read_bytes())
                y, _ = librosa.load(src, sr=16000)
                y, _ = librosa.effects.trim(y, top_db=40)
                ys += [y, np.zeros(4000, np.float32)]
            if ys:
                sf.write(acc / f"{oid}__{half}.wav", np.concatenate(ys)[:16000 * 15], 16000)
    # round 1's kept takes of cb-qc1 / cb-qc2, measured the same way (before / after)
    qa1 = json.loads((C.W / "qa.json").read_text())
    for tag, spk in (("r1-qc1", C.PICKS["cb-qc1"]), ("r1-qc2", C.PICKS["cb-qc2"])):
        for l in C.LINES:
            b = best_take([k for k in qa1 if k.startswith(f"runs/cb/cb__{spk}__{l['id']}.")], qa1, l["text"])
            if b:
                dst = kept_dir / f"{tag}__{l['id']}.{Path(b).name.split('.')[-2]}.wav"
                if not dst.exists():
                    dst.write_bytes((C.W / "raw" / Path(b).name).read_bytes())
    C.sh(["ssh", HOST, f"rm -rf {R}/work/accent2 {R}/work/kept2"])
    C.sh(["rsync", "-a", f"{acc}/", f"{HOST}:{R}/work/accent2/"])
    C.sh(["rsync", "-a", f"{kept_dir}/", f"{HOST}:{R}/work/kept2/"])
    C.remote("venv-qa/bin/python bin/quality.py work/q_kept2.json work/kept2 && "
             "cd ~/hairline-tts/accent && venv/bin/python accent_id.py --voxlect voxlect "
             "--out ~/hairline-clone/work/accent2.json ~/hairline-clone/work/accent2/ ~/hairline-clone/runs/cb2 && "
             "venv/bin/python mos.py ~/hairline-clone/work/mos2.json ~/hairline-clone/runs/cb2", "work/accent2.log")
    for f in ("accent2", "mos2", "q_kept2"):
        C.fetch(f"work/{f}.json", W2)


def cmd_page():
    import page2
    page2.build()


if __name__ == "__main__":
    {"push": lambda: push(), "eq": post_eq, "score": cmd_score, "table": table, "gen": cmd_gen, "qa": cmd_qa,
     "page": cmd_page}[sys.argv[1]](*sys.argv[2:])
