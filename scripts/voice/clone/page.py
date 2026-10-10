"""« Voix clonées » section of the R4 audition page (.cache/tts/audition-r4/index.html), then the page rebuild.
Called by `clone.py page`. Reads the auriga scores fetched into .cache/tts/audition-r4/work/clone/ and encodes the
kept takes with the audition's own encode() (the game's « spoken » chain, -19 LUFS, Opus), so every option on
the page is loudness-matched. The section's radio buttons share name="jo" with the Kyutai cards: the existing
« Your choice » line then reads « Jo = cb-qc1 »."""
import html
import json
import statistics as st
import subprocess
from pathlib import Path

import numpy as np

import audition_r4 as A
import audition_r4_page as P
import clone as C
from score import cer_qc

W = C.W
CLIPS = A.OUT / "clips"
MODELS = P.MODELS
CB_MODEL = ("Chatterbox Multilingual v3 (Resemble AI; ResembleAI/chatterbox, t3_mtl23ls_v3), zero-shot from the "
            "reference, French, exaggeration 0.5, cfg 0.5, temperature 0.8")
CB_LICENCE = "MIT (code and weights); output carries Resemble's inaudible Perth watermark"
REF_LICENCE = "Mozilla Common Voice French, CC0 (anonymous contributor)"
KY_LABEL = {"2216f": "A · 2216f", "2114f": "B · 2114f", "2154": "C · 2154", "12977": "D · 12977", "5830": "E · 5830"}
KY_MODEL = "Kyutai TTS 1.6B en_fr (CC-BY-4.0), CML-TTS voice (CC BY 4.0)"


def esc(s):
    return html.escape(str(s), quote=True)


def load(name):
    p = W / name
    return json.loads(p.read_text()) if p.exists() else {}


QA = load("qa.json")
for _k, _r in QA.items():  # Québec-aware CER (score.py) from the stored Whisper text; the raw one is kept
    if "asr" in _r:
        _lid = Path(_k).name.split("__")[2].split(".")[0]
        _r["cerRaw"] = _r["cer"]
        _r["cer"] = cer_qc(C.LINE[_lid]["text"], _r["asr"])
ACC = {Path(k).stem: v for k, v in load("accent_opts.json").items()}
MOS = {Path(k).name: v for k, v in load("mos.json").items()}
RQA = {Path(k).stem: v for k, v in load("qa_refs.json").items()}
RACC = {Path(k).stem: v for k, v in load("accent_refs.json").items()}
RMOS = {Path(k).stem: v for k, v in load("mos_refs.json").items()}
RMETA = load("refs.json")
CEN = {k: np.array(v) for k, v in load("centroids.json").items()}
CAST_NAME = {"hugo": "Hugo", "receptionist": "receptionist", "tv": "TV", "okafor": "Dr Okafor", "odile": "Odile",
             "sami": "Sami", "radio_fishing": "radio fishing", "bastien": "Bastien", "lou": "Lou",
             "gerard": "Gérard", "radio_football": "radio football", "radio_forecast": "radio forecast",
             "benali": "Mme Benali", "durand": "Durand (9834)"}


def takes(opt, lid):
    """QA keys of an option's takes for one line. opt: ("cb", speaker prefix) or ("ky", vid)."""
    kind, v = opt
    pre = f"runs/cb/cb__{v}__{lid}." if kind == "cb" else f"runs/ky/ky__{v}__{lid}."
    return sorted(k for k in QA if k.startswith(pre))


def best(opt, lid):
    t = takes(opt, lid)
    return min(t, key=lambda k: (QA[k]["cer"], k)) if t else None


def local_wav(key):
    n = Path(key).name
    return (W / "raw" / n) if key.startswith("runs/cb/") else (W / "qa_up" / n)


def ca(scores):
    return [scores.get(m, {}).get("canada") for m, _ in MODELS] if scores else [None] * 3


def ca_halves(name):
    """Mean Canadian probability per classifier over the option's two joined clips (lines c1-c3, c4-c6)."""
    hs = [ca(ACC.get(f"{name}__{h}")) for h in "ab"]
    return [st.mean(x) if None not in x else None for x in zip(*hs)]


def votes(key):
    """Classifiers (of 3) whose top label for this single take is Canada; None under 3 s (unreliable)."""
    a = ACC.get(Path(key).stem)
    if not a or a.get("dur", 0) < 3:
        return None
    return sum(max(a[m], key=a[m].get) == "canada" for m, _ in MODELS if m in a)


def summary(opt):
    kept = [best(opt, l["id"]) for l in C.LINES]
    kept = [k for k in kept if k]
    if not kept:
        return None
    rs = [QA[k] for k in kept]
    embs = np.array([r["emb"] for r in rs])
    c = embs.mean(0)
    c /= np.linalg.norm(c)
    cen_sims = sorted(((n, float(c @ v)) for n, v in CEN.items()), key=lambda kv: -kv[1])
    mean_sims = sorted(((n, st.mean(r["ecapa"].get(n, float(np.array(r["emb"]) @ CEN[n])) for r in rs)) for n in CEN),
                       key=lambda kv: -kv[1])
    kind, v = opt
    accname = f"cb-{v}" if kind == "cb" else f"ky-{v}"
    mos = [MOS[Path(k).name] for k in kept if Path(k).name in MOS]
    s = {"kept": kept, "n": len(kept), "cer": st.mean(r["cer"] for r in rs), "maxcer": max(r["cer"] for r in rs),
         "f0": st.median(r["f0"] for r in rs), "age": st.mean(r["age"] for r in rs),
         "pFemale": st.mean(r["pFemale"] for r in rs), "near": cen_sims[:2], "nearMean": mean_sims[:2],
         "ca": ca_halves(accname), "votes": [votes(k) for k in kept], "mos": st.mean(mos) if mos else None, "centroid": c}
    if kind == "cb" and v in RQA:
        s["refSim"] = float(c @ np.array(RQA[v]["emb"]))
    s["pass"] = s["maxcer"] <= 0.12 and s["near"][0][1] < 0.40 and s["pFemale"] > 0.5
    return s


def fmt_ca(xs):
    return " · ".join("–" if x is None else f"{x:.2f}" for x in xs)


def mean_ca(xs):
    xs = [x for x in xs if x is not None]
    return st.mean(xs) if xs else 0.0


def encode_ref(src: Path, dst: Path):
    """The reference itself, loudness-matched (-19 LUFS) but without the delivery chain."""
    if dst.exists():
        return
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af", "loudnorm=I=-19:TP=-2:LRA=11", "-ar", "48000",
                    "-ac", "1", "-c:a", "libopus", "-b:a", "64k", str(dst)], check=True)


def clip_for(opt, lid):
    k = best(opt, lid)
    if not k:
        return None, None
    name = f"clone_{opt[0]}_{opt[1]}_{lid}.ogg"
    P.encode(local_wav(k), CLIPS / name)
    return f"clips/{name}", QA[k]


def opt_id(spk):
    return next(i for i, s in C.PICKS.items() if s == spk)


def metrics_line(s, kind):
    near = ", ".join(f"{CAST_NAME.get(k, k)} {v:.2f}" for k, v in s["near"])
    vs = [v for v in s["votes"] if v is not None]
    out = [f"CER mean {s['cer']:.3f} (max {s['maxcer']:.2f})", f"F0 {s['f0']:.0f} Hz",
           f"takes called Canadian by ≥ 2 of 3 classifiers: {sum(v >= 2 for v in vs)}/{len(vs)}" if vs else "",
           f"woman {s['pFemale']:.2f}", f"estimated age {s['age']:.0f}",
           f"UTMOS {s['mos']:.2f}" if s.get("mos") else "",
           f"nearest cast voice (ECAPA centroid, < 0.40 passes): {near}"]
    if kind == "cb" and "refSim" in s:
        out.append(f"likeness to the reference speaker {s['refSim']:.2f}")
    return " · ".join(x for x in out if x)


def cb_card(cid, spk, rank):
    s = summary(("cb", spk))
    meta = RMETA.get(spk, {})
    rq = RQA.get(spk, {})
    ref_src = CLIPS / f"clone_ref_{cid}.ogg"
    encode_ref(W / "refs" / f"{spk}.wav", ref_src)
    rows = [P.audio_row(f"clips/{ref_src.name}", "The reference (12–15 s, real speaker; the model hears only this)",
                        f"{REF_LICENCE} · self-reported age band « {meta.get('age', '?')} », estimated "
                        f"{rq.get('age', 0):.0f} · Canadian {fmt_ca(ca(RACC.get(spk)))} · UTMOS "
                        f"{RMOS.get(spk, 0):.2f}")]
    for l in C.LINES:
        src, r = clip_for(("cb", spk), l["id"])
        if src:
            rows.append(P.audio_row(src, l["text"], f"{l['tag']} · {l['src']} · CER {r['cer']:.2f} · F0 {r['f0']:.0f} Hz"
                                    f" · woman {r['pFemale']:.2f} · age {r['age']:.0f}"))
    reco = rank == 0
    return f"""<section class="cand clone{' reco' if reco else ''}">
<label class="pick"><input type="radio" name="jo" value="{esc(cid)}">
<span class="name">{esc(CARD_LABEL[cid])}</span>{' <span class="badge">best clone</span>' if reco else ''}
{'' if s['pass'] else ' <span class="badge warn">fails a check</span>'}</label>
<p class="v">{esc(CB_MODEL)} · licence {esc(CB_LICENCE)}</p><p>{esc(NOTES.get(cid, ''))}</p>
<p class="acc">Canadian French probability ({' · '.join(n for _, n in MODELS)}): reference <b>{fmt_ca(ca(RACC.get(spk)))}</b>,
cloned output <b>{fmt_ca(s['ca'])}</b></p>
<p class="m">{esc(metrics_line(s, 'cb'))}</p>
<table>{''.join(rows)}</table></section>"""


CARD_LABEL = {}
NOTES = {}


def compare_block():
    """Each of the six lines, every option, side by side (best take of 2 by CER, same chain and loudness)."""
    opts = [(cid, ("cb", spk)) for cid, spk in C.PICKS.items()] + [(KY_LABEL[v], ("ky", v)) for v in C.KY_OPTS]
    out = []
    for l in C.LINES:
        rows = []
        for name, opt in opts:
            src, r = clip_for(opt, l["id"])
            if src:
                rows.append(P.audio_row(src, name, f"CER {r['cer']:.2f} · F0 {r['f0']:.0f} Hz · woman {r['pFemale']:.2f}"
                                        f" · heard « {r.get('asr', '')} »"))
        out.append(f"<details{' open' if l['id'] == 'c5' else ''}><summary>{esc(l['tag'])}: {esc(l['text'])}</summary>"
                   f"<table>{''.join(rows)}</table></details>")
    return "".join(out)


def score_table():
    rows = []
    allopts = [(f"{cid}", ("cb", spk), "Chatterbox (MIT)") for cid, spk in C.PICKS.items()] + \
              [(f"cb ({spk[:4]}…, screened)", ("cb", spk), "Chatterbox (MIT)") for spk in C.SCREEN
               if spk not in C.PICKS.values()] + \
              [(KY_LABEL[v], ("ky", v), "Kyutai (CC-BY-4.0)") for v in C.KY_OPTS]
    for name, opt, model in allopts:
        s = summary(opt)
        if not s:
            continue
        near = s["near"][0]
        rows.append(f"<tr class=\"{'top' if opt[0] == 'cb' and opt[1] in C.PICKS.values() else ''}\"><td>{esc(name)}</td>"
                    f"<td>{esc(model)}</td><td>{s['cer']:.3f}</td><td>{fmt_ca(s['ca'])}</td><td>{s['pFemale']:.2f}</td>"
                    f"<td>{s['age']:.0f}</td><td>{esc(CAST_NAME.get(near[0], near[0]))} {near[1]:.2f}</td>"
                    f"<td>{'' if s.get('mos') is None else format(s['mos'], '.2f')}</td>"
                    f"<td>{'yes' if s['pass'] else 'no'}</td></tr>")
    return ("<div class=\"scroll\"><table class=\"rank\"><tr><th>option</th><th>model</th><th>CER</th><th>Canadian (3 classifiers)</th>"
            "<th>woman</th><th>age</th><th>nearest cast</th><th>UTMOS</th><th>passes</th></tr>" + "".join(rows) + "</table></div>")


CSS = """<style>.cand.clone{border-style:dashed}.badge.warn{background:#c25a6c}
.clone-intro{border-left:3px solid var(--qc);padding-left:12px}.scroll{overflow-x:auto;max-width:100%}
@media (max-width:700px){.scroll tr{display:table-row}.scroll td{display:table-cell;padding:4px 6px;white-space:nowrap}}</style>"""


def build():
    assert C.PICKS, "set clone.PICKS (cb-qc1..3 -> speaker prefix) after `clone.py qa`"
    CLIPS.mkdir(parents=True, exist_ok=True)
    ranked = sorted(C.PICKS.items(), key=lambda kv: list(C.PICKS).index(kv[0]))
    for i, (cid, spk) in enumerate(ranked):
        CARD_LABEL[cid] = f"{'FGH'[i]} · Cloned Québécoise {i + 1} ({cid})"
    NOTES.update(C.NOTES)
    cards = "".join(cb_card(cid, spk, i) for i, (cid, spk) in enumerate(ranked))
    sec = f"""{CSS}
<h2>Voix clonées — Jo from a real Québécoise voice (zero-shot cloning)</h2>
<div class="clone-intro"><p>Instead of moving a Québécois man's voice up (A, B) or giving a France-French woman
Québec words (C–E), these options let a cloning model copy a real Québécoise speaker. The model hears 12–15 s of
one Common Voice contributor (CC0, anonymous; accent « Français du Canada », self-reported age band 20s–40s;
the three accent classifiers give 0.99–1.00 Canadian on each chosen recording), then speaks Jo's lines in that
voice and accent. Seven speakers from the R4 calibration set were cloned; the three below did best on accent,
naturalness and distance from the cast. Each line: 2 takes, the better one by CER is kept; the game's « spoken »
chain and loudness (-19 LUFS) are applied, as for A–E.</p>
<p><b>Models.</b> Chatterbox Multilingual (Resemble AI, MIT), run on auriga (ROCm). Fish Audio OpenAudio S1-mini
(CC-BY-NC-SA-4.0) was not run: its weights are gated on Hugging Face and the account on this Mac has not
accepted the terms (the token on auriga is invalid).</p>
<p class="note">Scores are from auriga: Whisper large-v3 (transformers, French, greedy), the same three accent
classifiers as above (on two clips per option: lines 1–3 joined, lines 4–6 joined, ≤ 15 s each; and on every
take of 3 s or more), the audeering age/gender model, ECAPA against the cast centroids (plus Durand's 9834),
UTMOS. CER is Québec-aware: Whisper writes « Chu » as « je suis », « Y » as « il » and « Pis » as « puis », so
those spellings are mapped back before scoring (a « ne » still counts as an error). Note: on these six lines the
classifiers no longer call A (2216f) Canadian (it scored 0.82–1.00 on the screening lines above); B (2114f) and
the clones F and G are called Canadian on almost every take. Pick a clone with the same radio buttons: the line at the top then
reads « Jo = cb-qc1 ».</p></div>
{cards}
<h3>Every option, line by line</h3>
<p class="note">The same six lines for the three clones and the five Kyutai options (A–E). Kyutai's takes for
the flirty, deadpan and warm lines are the audition's own; the other three were generated for this comparison.</p>
{compare_block()}
<h3>Scores, all options</h3>
<p class="note">Means over the six kept takes. Canadian: probability from each classifier, mean of the two joined clips.
Passes = every take CER ≤ 0.12, nearest cast voice < 0.40, heard as a woman.</p>
{score_table()}
"""
    (W / "section.html").write_text(sec)
    P.build()
