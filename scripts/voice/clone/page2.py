"""« Voix clonées · 2ᵉ tour » section of the R4 audition page (.cache/tts/audition-r4/index.html), then the page
rebuild. Called by `round2.py page`. Reads the auriga scores fetched into .cache/tts/audition-r4/work/clone2/ and
encodes the kept takes with the audition's own encode() (the game's « spoken » chain, -19 LUFS, Opus), so every
option on the page is loudness-matched. Radio buttons share name="jo" with the rest of the page, so the « Your
choice » line reads « Jo = cb-qc4 » etc. audition_r4_page.py puts this section at the top (work/clone2/section.html)."""
import html
import json
import re
import statistics as st
import subprocess
from pathlib import Path

import numpy as np

import audition_r4_page as P
import clone as C
import round2 as R2
from score import cer_qc

W2 = R2.W2
CLIPS = P.CLIPS
MODELS = P.MODELS
CAST_NAME = {"hugo": "Hugo", "receptionist": "receptionist", "tv": "TV", "okafor": "Dr Okafor", "odile": "Odile",
             "sami": "Sami", "radio_fishing": "radio fishing", "bastien": "Bastien", "lou": "Lou",
             "gerard": "Gérard", "radio_football": "radio football", "radio_forecast": "radio forecast",
             "benali": "Mme Benali", "durand": "Durand (9834)"}


def esc(s):
    return html.escape(str(s), quote=True)


def load(name):
    p = W2 / name
    return json.loads(p.read_text()) if p.exists() else {}


QA = load("qa2.json")
for _k, _r in QA.items():
    if "asr" in _r:
        _lid = Path(_k).name.split("__")[1].split(".")[0]
        _r["cerRaw"] = _r["cer"]
        _r["cer"] = cer_qc(C.LINE[_lid]["text"], _r["asr"])
ACC = {Path(k).stem: v for k, v in load("accent2.json").items()}
MOS = {Path(k).name: v for k, v in load("mos2.json").items()}
QK = {Path(k).name: v for k, v in load("q_kept2.json").items()}
RQ = {Path(k).stem: v for k, v in load("q_refs2.json").items()}
RQA = {Path(k).stem: v for k, v in load("qa_refs2.json").items()}
RACC = {Path(k).stem: v for k, v in load("accent_refs2.json").items()}
RMOS = {Path(k).stem: v for k, v in load("mos_refs2.json").items()}
CEN = {k: np.array(v) for k, v in json.loads((C.W / "centroids.json").read_text()).items()}


def ca(scores):
    return [scores.get(m, {}).get("canada") for m, _ in MODELS] if scores else [None] * 3


def fmt_ca(xs):
    return " · ".join("–" if x is None else f"{x:.2f}" for x in xs)


def best(oid, lid):
    t = sorted(k for k in QA if k.startswith(f"runs/cb2/{oid}__{lid}."))
    return min(t, key=lambda k: (QA[k]["cer"], k)) if t else None


def votes(key):
    a = ACC.get(Path(key).stem)
    if not a or a.get("dur", 0) < 3:
        return None
    return sum(max(a[m], key=a[m].get) == "canada" for m, _ in MODELS if m in a)


def ref_stem(oid):
    return Path(R2.OPTS[oid]["ref"]).stem


def summary(oid):
    kept = [k for k in (best(oid, l["id"]) for l in C.LINES) if k]
    if not kept:
        return None
    rs = [QA[k] for k in kept]
    c = np.array([r["emb"] for r in rs]).mean(0)
    c /= np.linalg.norm(c)
    near = sorted(((n, float(c @ v)) for n, v in CEN.items()), key=lambda kv: -kv[1])
    qk = [QK[Path(k).name] for k in kept if Path(k).name in QK]
    mos = [MOS[Path(k).name] for k in kept if Path(k).name in MOS]
    hs = [ca(ACC.get(f"{oid}__{h}")) for h in "ab"]
    s = {"kept": kept, "cer": st.mean(r["cer"] for r in rs), "maxcer": max(r["cer"] for r in rs),
         "f0": st.median(r["f0"] for r in rs), "age": st.mean(r["age"] for r in rs),
         "pFemale": st.mean(r["pFemale"] for r in rs), "near": near[:2],
         "ca": [st.mean(x) if None not in x else None for x in zip(*hs)],
         "votes": [v for v in (votes(k) for k in kept) if v is not None],
         "mos": st.mean(mos) if mos else None,
         "dns": st.mean(q["dnsmos"]["ovr"] for q in qk) if qk else None,
         "sig": st.mean(q["dnsmos"]["sig"] for q in qk) if qk else None,
         "bak": st.mean(q["dnsmos"]["bak"] for q in qk) if qk else None,
         "bw": st.mean(q["bw"] for q in qk) if qk else None,
         "pres": st.mean(q["presence"] for q in qk) if qk else None,
         "air": st.mean(q["air"] for q in qk if q.get("air") is not None) if qk else None}
    rq = RQA.get(ref_stem(oid))
    if rq:
        s["refSim"] = float(c @ np.array(rq["emb"]))
    s["pass"] = s["maxcer"] <= 0.12 and near[0][1] < 0.40 and s["pFemale"] > 0.5
    s["score"] = (mean_ca(s["ca"]) + (sum(v >= 2 for v in s["votes"]) / max(len(s["votes"]), 1))
                  + (s["mos"] or 0) / 2 + (s["dns"] or 0) / 2)
    return s


def mean_ca(xs):
    xs = [x for x in xs if x is not None]
    return st.mean(xs) if xs else 0.0


def lufs(ogg: Path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(ogg), "-af", "ebur128", "-f", "null", "-"],
                       capture_output=True, text=True)
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    return float(m[-1]) if m else None


def clip_for(oid, lid):
    k = best(oid, lid)
    if not k:
        return None, None
    name = f"clone2_{oid}_{lid}.ogg"
    P.encode(W2 / "raw" / Path(k).name, CLIPS / name)
    return f"clips/{name}", QA[k]


def encode_ref(src: Path, dst: Path):
    if dst.exists():
        return
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af", "loudnorm=I=-19:TP=-2:LRA=11", "-ar", "48000",
                    "-ac", "1", "-c:a", "libopus", "-b:a", "96k", str(dst)], check=True)


def ref_local(oid):
    rel = R2.OPTS[oid]["ref"]
    return W2 / rel


def ref_line(oid):
    n = ref_stem(oid)
    q, r, a, u = RQ.get(n, {}), RQA.get(n, {}), RACC.get(n), RMOS.get(n)
    d = q.get("dnsmos", {})
    return (f"DNSMOS {d.get('ovr', 0):.2f} (speech {d.get('sig', 0):.2f}, background {d.get('bak', 0):.2f}) · "
            f"bandwidth {q.get('bw', 0) / 1000:.1f} kHz · presence {q.get('presence', 0):+.1f} dB · "
            f"Canadian {fmt_ca(ca(a))} · estimated age {r.get('age', 0):.0f} · UTMOS {u or 0:.2f}")


def metrics_line(s):
    vs = s["votes"]
    near = ", ".join(f"{CAST_NAME.get(k, k)} {v:.2f}" for k, v in s["near"])
    out = [f"UTMOS {s['mos']:.2f}" if s.get("mos") else "",
           f"DNSMOS {s['dns']:.2f}" if s.get("dns") else "",
           f"bandwidth {s['bw'] / 1000:.1f} kHz" if s.get("bw") else "",
           f"presence {s['pres']:+.1f} dB" if s.get("pres") is not None else "",
           f"Canadian {fmt_ca(s['ca'])}",
           f"takes Canadian (≥ 2 of 3): {sum(v >= 2 for v in vs)}/{len(vs)}" if vs else "",
           f"CER {s['cer']:.3f} (max {s['maxcer']:.2f})", f"F0 {s['f0']:.0f} Hz", f"woman {s['pFemale']:.2f}",
           f"age {s['age']:.0f}", f"nearest cast (< 0.40 passes): {near}",
           f"page loudness {s['lufs']:.1f} LUFS" if s.get("lufs") is not None else ""]
    return " · ".join(x for x in out if x)


def card(c, s, first):
    oid = c["oid"]
    ref_ogg = CLIPS / f"clone2_ref_{c['id']}.ogg"
    encode_ref(ref_local(oid), ref_ogg)
    rows = [P.audio_row(f"clips/{ref_ogg.name}", "The reference (what the model hears)",
                        f"{c['source']} · {ref_line(oid)}")]
    louds = []
    for l in C.LINES:
        src, r = clip_for(oid, l["id"])
        if src:
            louds.append(lufs(CLIPS / Path(src).name))
            rows.append(P.audio_row(src, l["text"], f"{l['tag']} · CER {r['cer']:.2f} · F0 {r['f0']:.0f} Hz · "
                                                    f"woman {r['pFemale']:.2f} · age {r['age']:.0f}"))
    s["lufs"] = st.mean(x for x in louds if x is not None) if louds else None
    badge = ' <span class="badge">recommended</span>' if c.get("reco") else ""
    warn = "" if s["pass"] else ' <span class="badge warn">fails a check</span>'
    return f"""<section class="cand clone2{' reco' if c.get('reco') else ''}">
<label class="pick"><input type="radio" name="jo" value="{esc(c['id'])}">
<span class="name">{esc(c['label'])}</span>{badge}{warn}</label>
<p><b>What was done:</b> {esc(c['done'])}</p><p>{esc(c.get('note', ''))}</p>
<p class="m">{esc(metrics_line(s))}</p>
<table>{''.join(rows)}</table></section>"""


def round1_baseline():
    """cb-qc1 round 1, measured the same way (kept takes from round 1's raw folder)."""
    return {k: v for k, v in QK.items() if k.startswith("r1-")}


def table(sums):
    rows = []
    for oid, s in sorted(sums.items(), key=lambda kv: -kv[1]["score"]):
        o = R2.OPTS[oid]
        near = s["near"][0]
        vs = s["votes"]
        rows.append(f"<tr><td>{esc(oid)}</td><td>{esc(o['note'])}</td><td>{s['mos'] or 0:.2f}</td>"
                    f"<td>{s['dns'] or 0:.2f}</td><td>{(s['bw'] or 0) / 1000:.1f}</td><td>{s['pres'] or 0:+.1f}</td>"
                    f"<td>{fmt_ca(s['ca'])}</td><td>{sum(v >= 2 for v in vs)}/{len(vs)}</td><td>{s['cer']:.3f}</td>"
                    f"<td>{s['pFemale']:.2f}</td><td>{s['age']:.0f}</td>"
                    f"<td>{esc(CAST_NAME.get(near[0], near[0]))} {near[1]:.2f}</td><td>{'yes' if s['pass'] else 'no'}</td></tr>")
    return ("<div class=\"scroll\"><table class=\"rank\"><tr><th>option</th><th>reference</th><th>UTMOS</th><th>DNSMOS</th>"
            "<th>bw kHz</th><th>presence</th><th>Canadian (3)</th><th>takes CA</th><th>CER</th><th>woman</th><th>age</th>"
            "<th>nearest cast</th><th>passes</th></tr>" + "".join(rows) + "</table></div>")


CSS = """<style>.cand.clone2{border-color:var(--qc)}.cand.clone2.reco{border-color:var(--acc)}.badge.warn{background:#c25a6c}
.clone-intro{border-left:3px solid var(--qc);padding-left:12px}.scroll{overflow-x:auto;max-width:100%}
.diag td{font-size:13px}
@media (max-width:700px){.scroll tr{display:table-row}.scroll td,.scroll th{display:table-cell;padding:4px 6px;white-space:nowrap}}</style>"""


def build():
    sums = {oid: s for oid in R2.OPTS if (s := summary(oid))}
    (W2 / "summary.json").write_text(json.dumps({k: {kk: vv for kk, vv in v.items() if kk not in ("kept",)}
                                                 for k, v in sums.items()}, indent=1, default=float))
    cards = "".join(card(c, sums[c["oid"]], i == 0) for i, c in enumerate(R2.CARDS) if c["oid"] in sums)
    sec = f"""{CSS}
<h2>Voix clonées · 2ᵉ tour — Jo from cleaner recordings</h2>
<div class="clone-intro">{R2.INTRO}</div>
{cards}
<h3>Every round-2 option, scored</h3>
<p class="note">All generated options (2 takes per line, the better one kept by the Québec-aware CER), ranked by
accent + naturalness. UTMOS and DNSMOS: predicted naturalness / audio quality (1–5) of the kept takes. Bandwidth and
presence (2–5 kHz against 100–1000 Hz) are measured on the raw takes; low presence sounds dull. Canadian: the three
accent classifiers (Voxlect Whisper · Voxlect MMS · XLSR CommonAccent) on lines 1–3 and 4–6 joined.
Passes = every take CER ≤ 0.12, nearest cast voice < 0.40, heard as a woman.</p>
{table(sums)}
"""
    (W2 / "section.html").write_text(sec)
    P.build()
