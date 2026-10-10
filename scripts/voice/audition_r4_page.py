"""Audition page for the R4 casting (Jo, M. Durand): .cache/tts/audition-r4/index.html plus clips/*.ogg.
Called by `audition_r4.py page`; reads work/analysis.json (Mac) and the accent / UTMOS scores fetched from auriga
(work/ref_scores.json, gen_scores.json, calib_scores.json, mos.json)."""
import html
import json
import statistics as st
import subprocess
from pathlib import Path

import audition_r4 as A

W = A.WORK
CLIPS = A.OUT / "clips"
MODELS = [("vx_whisper", "Voxlect Whisper"), ("vx_mms", "Voxlect MMS"), ("ca_xlsr", "XLSR CommonAccent")]

# Shortlists, from the numbers on the page (see docs/voice.md "R4 casting"). First of each list is pre-selected.
JO = [
    {"vid": "2216f", "label": "A · Québécois (2216, voice shifted)", "kind": "qc",
     "note": "A Montréal-sounding LibriVox reader (a man), moved to a woman's register with Praat « Change gender »: "
             "F0 195 Hz, formants ×1.24, the same tool as Sami's child voice. The accent survives the shift. Listen "
             "for a « pitched-up man » quality."},
    {"vid": "2114f", "label": "B · Québécois (2114, voice shifted)", "kind": "qc",
     "note": "The strongest Canadian score of all 41 French voices, before and after the shift. Lighter shift "
             "(F0 190 Hz, formants ×1.12), so it reads younger and less processed in places, more male in others."},
    {"vid": "2154", "label": "C · Standard French (2154)", "kind": "std",
     "note": "Natural woman's voice, no processing, the best predicted naturalness of the women. Warm and low; "
             "France accent, so her Québécois comes from the words only."},
    {"vid": "12977", "label": "D · Standard French (12977)", "kind": "std",
     "note": "Natural woman's voice, estimated age 35, the closest to Jo's. Mid pitch; farthest of the three from "
             "every cast voice (nearest Odile, 0.28)."},
    {"vid": "5830", "label": "E · Standard French (5830)", "kind": "std",
     "note": "Natural woman's voice with more grain; reads a little older (estimated mid-40s); "
             "Mme Benali is her nearest (0.30)."},
]
DURAND = [
    {"vid": "9834", "label": "A · 9834", "note": "Low (F0 ~90 Hz) and the oldest-sounding of the free men "
                                                 "(estimated 57, against 22–49 for the others)."},
    {"vid": "4193", "label": "B · 4193", "note": "The lowest and darkest voice in the model (F0 ~76 Hz), some "
                                                 "gravel; the TV voice is his nearest (0.37)."},
    {"vid": "SSA150803", "label": "C · SSA150803", "note": "A Kyutai voice donation (CC0): mid-low, clear, "
                                                           "courteous. Younger by nature, so it leans on the slower post."},
]
LENGTHEN = 1.12  # Durand's slower delivery in post (Praat Lengthen (overlap-add), pitch kept)


def esc(s):
    return html.escape(str(s), quote=True)


def load(name, default=None):
    p = W / name
    return json.loads(p.read_text()) if p.exists() else (default if default is not None else {})


AN = load("analysis.json")
REF = {Path(k).name.split("_")[0].split(".")[0].replace("-enhanced-v2", ""): v for k, v in load("ref_scores.json").items()}
GEN = {Path(k).stem: v for k, v in load("gen_scores.json").items()}
MOS = {Path(k).stem: v for k, v in load("mos.json").items() if "/gen/" in "/" + k}
CAL = load("calib_scores.json")


def ca(scores):
    return [scores.get(m, {}).get("canada") for m, _ in MODELS] if scores else [None] * 3


def fmt_ca(xs):
    return " · ".join("–" if x is None else f"{x:.2f}" for x in xs)


def takes_of(role, vid, line, variant="plain"):
    return sorted((f, r) for f, r in AN.items()
                  if r["role"] == role and r["voice"] == vid and r["line"] == line and r["variant"] == variant)


def best(role, vid, line, variant="plain"):
    t = takes_of(role, vid, line, variant)
    return min(t, key=lambda fr: (fr[1]["cer"], fr[0])) if t else (None, None)


def summary(role, vid, variant="plain"):
    rs = [r for r in AN.values() if r["role"] == role and r["voice"] == vid and r["variant"] == variant]
    if not rs:
        return {}
    ec = {}
    for r in rs:
        for k, v in r["ecapa"].items():
            ec.setdefault(k, []).append(v)
    ec = sorted(((k, st.mean(v)) for k, v in ec.items()), key=lambda kv: -kv[1])
    return {"f0": st.median(r["f0"] for r in rs), "cer": st.mean(r["cer"] for r in rs),
            "age": st.mean(r["age"] for r in rs), "pFemale": st.mean(r["pFemale"] for r in rs),
            "near": ec[:2], "n": len(rs)}


def encode(src: Path, dst: Path, lengthen=None):
    """Dry take -> roughly the game's 'spoken' sound: delivery chain, -19 LUFS, Opus 64k."""
    if dst.exists():
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    if lengthen:
        import parselmouth
        from parselmouth.praat import call
        tmp = dst.with_suffix(".tmp.wav")
        call(parselmouth.Sound(str(src)), "Lengthen (overlap-add)", 75, 600, lengthen).save(str(tmp), "WAV")
        src = tmp
    chain = A.CAST["deliveries"]["spoken"]["ffmpeg"] + ",loudnorm=I=-19:TP=-2:LRA=11"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af", chain, "-ar", "48000", "-ac", "1",
                    "-c:a", "libopus", "-b:a", "64k", str(dst)], check=True)
    if lengthen:
        src.unlink()


def clip(role, vid, line, variant="plain", lengthen=None):
    f, r = best(role, vid, line, variant)
    if not f:
        return None, None
    name = f"{role}_{vid}_{line}{'' if variant == 'plain' else '_' + variant}{'_post' if lengthen else ''}.ogg"
    encode(A.RAW / f, CLIPS / name, lengthen)
    return f"clips/{name}", r


def line_text(role, lid):
    return next(l for l in (A.JO_LINES if role == "jo" else A.DURAND_LINES) if l["id"] == lid)


def audio_row(src, text, sub=""):
    return (f'<tr><td class="txt">{esc(text)}<small>{esc(sub)}</small></td>'
            f'<td><audio controls preload="none" src="{esc(src)}"></audio></td></tr>')


def base_vid(vid):
    return vid[:-1] if vid.endswith("f") and vid[:-1].isdigit() else vid


def card(role, c, checked):
    vid = c["vid"]
    s = summary(role, vid)
    gen = GEN.get(f"{role}__{vid}") or {}
    ref = REF.get(base_vid(vid), {})
    rows = []
    for l in (A.line_of(role, lid) for lid in A.CARD[role]):
        src, r = clip(role, vid, l["id"])
        if src:
            rows.append(audio_row(src, l["text"], f"{l.get('src', '')} · CER {r['cer']:.2f} · F0 {r['f0']:.0f} Hz"))
    extra = ""
    if role == "durand":
        l = A.line_of(role, A.CARD[role][0])
        s1, _ = clip(role, vid, l["id"], "slow")
        s2, _ = clip(role, vid, l["id"], "plain", LENGTHEN)
        extra = ('<p class="sub">Slower? The same reveal line three ways:</p><table>'
                 + (audio_row(s2, l["text"], f"post: Praat lengthen ×{LENGTHEN} (pitch kept) — the proposed setting") if s2 else "")
                 + (audio_row(s1, l["text"], "Kyutai: one pause token between words (auriga only today)") if s1 else "")
                 + "</table>")
    else:
        sc = [l for l in A.JO_LINES if l.get("screen")]
        srows = "".join(audio_row(clip(role, vid, l["id"])[0], l["text"], "accent screening line")
                        for l in sc if clip(role, vid, l["id"])[0])
        extra = f'<details><summary>The four accent-screening lines</summary><table>{srows}</table></details>'
    near = ", ".join(f"{k} {v:.2f}" for k, v in s.get("near", []))
    mos = MOS.get(f"{role}__{vid}")
    metrics = [f"F0 {s['f0']:.0f} Hz" if s else "",
               f"estimated age {s['age']:.0f}" if s else "",
               f"female {s['pFemale']:.2f}" if s and role == "jo" else "",
               f"CER {s['cer']:.3f}" if s else "",
               f"UTMOS {mos:.2f}" if mos else "",
               f"nearest cast voice (ECAPA, < 0.40 passes): {near}" if near else ""]
    acc = ""
    if role == "jo":
        acc = (f'<p class="acc">Canadian French probability ({" · ".join(n for _, n in MODELS)}): '
               f'reference recording <b>{fmt_ca(ca(ref))}</b>, TTS output <b>{fmt_ca(ca(gen))}</b></p>')
    voice = A.cml(base_vid(vid)) if base_vid(vid).isdigit() else vid
    return f"""<section class="cand{' reco' if checked else ''}">
<label class="pick"><input type="radio" name="{role}" value="{esc(vid)}"{' checked' if checked else ''}>
<span class="name">{esc(c['label'])}</span>{' <span class="badge">recommended</span>' if checked else ''}</label>
<p class="v">{esc(voice)}</p><p>{esc(c['note'])}</p>{acc}
<p class="m">{esc(' · '.join(m for m in metrics if m))}</p>
<table>{''.join(rows)}</table>{extra}</section>"""


def ranking_table():
    """Every French voice ranked by mean Canadian probability over the 3 models x (reference, TTS output)."""
    rows = []
    for v, r in REF.items():
        g = GEN.get(f"jo__{v}") or GEN.get(f"durand__{v}") or {}
        allp = [x for x in ca(r) + ca(g) if x is not None]
        rows.append((st.mean(allp) if allp else 0, v, ca(r), ca(g)))
    for v in A.SHIFTED:
        g = GEN.get(f"jo__{v}f", {})
        allp = [x for x in ca(REF.get(v, {})) + ca(g) if x is not None]
        rows.append((st.mean(allp), v + "f", ca(REF.get(v, {})), ca(g)))
    rows.sort(key=lambda x: -x[0])
    cast = {Path(sp["voice"]).name.split("_")[0]: k for k, sp in A.CAST["speakers"].items() if sp.get("voice")}
    out = []
    for i, (m, v, r, g) in enumerate(rows):
        sex = "F" if v in A.FEMALE or v.endswith("f") or v == "developpeuse-3" else "M"
        who = cast.get(v, "")
        out.append(f'<tr class="{"top" if i < 6 else ""}"><td>{i + 1}</td><td>{esc(v)}{" (shifted)" if v.endswith("f") else ""}</td>'
                   f'<td>{sex}</td><td>{esc(who)}</td><td>{fmt_ca(r)}</td><td>{fmt_ca(g)}</td><td><b>{m:.2f}</b></td></tr>')
    return ("<table class=\"rank\"><tr><th>#</th><th>voice</th><th></th><th>cast as</th><th>reference</th>"
            "<th>TTS output</th><th>mean</th></tr>" + "".join(out) + "</table>")


def calib_line():
    out = []
    for g, name in (("f", "women"), ("m", "men")):
        rs = [v for k, v in CAL.items() if Path(k).name.startswith(g + "_")]
        top1 = [sum(max(r[m], key=r[m].get) == "canada" for r in rs) for m, _ in MODELS]
        out.append(f"{name}: " + ", ".join(f"{n} {t}/{len(rs)}" for (_, n), t in zip(MODELS, top1)))
    return "; ".join(out)


def cast_refs():
    """One existing clip per voice Jo / Durand must not sound like, copied next to the page."""
    lines = {Path(l["file"]).stem: l for l in json.load(open(A.ROOT / "scripts/voice/lines.fr.json"))["lines"]}
    want = {"odile": "Odile", "lou": "Lou", "benali": "Mme Benali", "receptionist": "Receptionist (voicemail)",
            "radio_forecast": "Radio forecast", "hugo": "Hugo", "gerard": "Gérard", "bastien": "Bastien",
            "okafor": "Dr Okafor", "tv": "TV", "radio_fishing": "Radio fishing man"}
    rows = []
    for spk, label in want.items():
        cand = sorted((l for l in lines.values() if l["speaker"] == spk and l["delivery"] != "inner"),
                      key=lambda l: -len(l["text"]))
        if not cand:
            continue
        l = cand[min(1, len(cand) - 1)]
        src = A.ROOT / "public/assets/voice/fr" / Path(l["file"]).name
        if src.exists():
            dst = CLIPS / f"cast_{spk}.ogg"
            CLIPS.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(src.read_bytes())
            rows.append(audio_row(f"clips/{dst.name}", l["text"], label))
    return "<table>" + "".join(rows) + "</table>"


CSS = """:root{--bg:#141210;--fg:#e9e2d6;--dim:#9a9184;--line:#2c2823;--acc:#d9a441;--card:#1b1916;--qc:#c25a6c}
body{margin:0;padding:24px 16px;background:var(--bg);color:var(--fg);font:15px/1.45 -apple-system,system-ui,sans-serif;max-width:1100px}
h1{font-weight:300;letter-spacing:.2em;margin:0 0 4px} h2{margin:32px 0 6px;color:var(--acc);font-weight:500}
a{color:var(--acc)} .note,.v,.m,.sub,small{color:var(--dim)} .v,.m{font-size:12px;margin:2px 0} small{display:block;font-size:12px}
table{border-collapse:collapse;width:100%} td,th{border-bottom:1px solid var(--line);padding:6px 8px;vertical-align:middle;text-align:left}
th{color:var(--dim);font-weight:500;font-size:12px} .txt{max-width:560px} audio{width:240px;height:32px;display:block}
.cand{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:12px 0}
.cand.reco{border-color:var(--acc)} .pick{display:flex;gap:10px;align-items:center;cursor:pointer;font-size:17px}
.pick input{width:20px;height:20px;accent-color:var(--acc)} .badge{font-size:11px;color:var(--bg);background:var(--acc);border-radius:9px;padding:1px 8px}
.acc{font-size:13px} .acc b{color:var(--qc)} details{margin:6px 0} summary{cursor:pointer;color:var(--dim)}
.choice{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 0;z-index:2}
.choice code{background:var(--card);padding:4px 8px;border-radius:6px;font-size:14px} button{background:var(--acc);color:var(--bg);border:0;border-radius:6px;padding:5px 12px;font:inherit;cursor:pointer}
.rank td{font-size:13px} .rank tr.top td{color:var(--fg)} .rank td{color:var(--dim)}
@media (max-width:700px){.choice{position:static} td{display:block;border:0;padding:3px 0} tr{display:block;border-bottom:1px solid var(--line);padding:6px 0} audio{width:100%}}"""

JS = """const KEY='hl-r4-cast';
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
function save(o){try{localStorage.setItem(KEY,JSON.stringify(o))}catch{}}
const st=load();
for(const r of document.querySelectorAll('input[type=radio]')){
  if(st[r.name]) r.checked = r.value===st[r.name];
  r.addEventListener('change',()=>{const o=load();o[r.name]=r.value;save(o);show();});
}
function pick(n){const r=document.querySelector('input[name='+n+']:checked');return r?r.value:'?'}
function show(){document.getElementById('msg').textContent='Casting R4: Jo = '+pick('jo')+', Durand = '+pick('durand');}
document.getElementById('copy').addEventListener('click',async()=>{
  const t=document.getElementById('msg').textContent;
  try{await navigator.clipboard.writeText(t);document.getElementById('copy').textContent='Copied';}catch{}
});
show();"""


def build():
    CLIPS.mkdir(parents=True, exist_ok=True)
    jo_cards = "".join(card("jo", c, i == 0) for i, c in enumerate(JO))
    du_cards = "".join(card("durand", c, i == 0) for i, c in enumerate(DURAND))
    # « Voix clonées »: written by scripts/voice/clone/page.py (zero-shot cloning audition), when it has run
    sec = W / "clone" / "section.html"
    clone_section = sec.read_text() if sec.exists() else ""
    # « Voix clonées · 2ᵉ tour »: written by scripts/voice/clone/page2.py (cleaner references), shown first
    sec2 = W / "clone2" / "section.html"
    clone2_section = sec2.read_text() if sec2.exists() else ""
    n_fr = len(REF)
    page = f"""<!doctype html><html lang="en"><meta charset="utf-8"><title>HAIRLINE R4 casting</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><style>{CSS}</style>
<h1>HAIRLINE · R4 casting</h1>
<p class="note">Two new voices for Revision 4: <b>Jo</b> (Josianne Lavoie, 34, Montréal) and <b>M. Durand</b> (81).
Kyutai TTS 1.6B en_fr, generated on auriga, with the game's « spoken » delivery chain applied (the game adds nothing
else). Lines are from docs/SCRIPT-R4.md. Nothing in the game has changed yet.</p>
<div class="choice"><b>Your choice:</b> <code id="msg"></code> <button id="copy">Copy</button>
<div class="note">Pick one voice for each role (the radio buttons; kept in this browser only). To confirm, paste the line
into the Claude session, e.g. « Casting R4: Jo = 2216f, Durand = 9834 » (a cloned voice reads « Jo = cb-qc1 »), or just say « keep the recommendations ».
The recommendation is already written into scripts/voice/cast.json, so if it is right you need do nothing.</div></div>
{clone2_section}

<h2>What the accent screen found</h2>
<p>No woman's voice in the model has a Québec accent. All {n_fr} French voices of kyutai/tts-voices
(35 LibriVox readers from CML-TTS, plus 6 Kyutai recordings) were scored by three French accent classifiers trained on
Common Voice accents (France, Canada, Belgium/Switzerland, Africa). They were scored on the voice's own recording and
on eight Jo lines the model spoke with it. The classifiers agree that 3 men are clearly Canadian (2114, 2216, and
7142, Bastien's voice). <b>Every woman scores 0.00–0.03 Canadian</b> on the model's output. Check: on 60 real
Québec Common Voice speakers the classifiers put Canada first for {esc(calib_line())}. Those speakers may overlap
their training data, so the real accuracy is probably lower.</p>
<p>Kyutai keeps the accent of the voice it copies, and it cannot clone a new voice. So the only way to get a Québec
Jo is to take a Québécois man's voice and move it into a woman's register. The pitch and formant shift is the same
Praat tool that makes Sami's child voice. It still scores Canadian (0.8–1.0), and an age/gender model hears a
woman (0.94–0.99) aged about 31–35. It costs some naturalness: UTMOS (a predicted 1–5 naturalness score) is
about 2.5, against 2.6–3.8 (mostly above 3) for the natural women, and 2.4 for Sami's processed voice in the game. Candidates
A and B are those two. C, D and E are natural standard-French voices, whose Québec flavour comes only from the
words (« pantoute », « ben là », « c'est-tu »).</p>

<h2>Jo — Josianne « Jo » Lavoie, 34</h2>
<p class="note">Loud, blunt, flirty, very kind. Slightly husky is good. She must not sound like Odile, Lou,
Mme Benali, the receptionist or the forecast radio (reference clips at the bottom).</p>
{jo_cards}
{clone_section}

<h2>M. Durand — Albert Durand, 81</h2>
<p class="note">Slow, courteous, a bit of gravel. He must not sound like Hugo, Gérard, Bastien, Dr Okafor, the TV
or the radio men. The model has no voice older than about 60–65 except the radio fishing man (already cast), so
age comes from the slowest, lowest readers plus slower delivery in post. 4482 and 928 also sound old, but they
sit at ECAPA 0.48 from Hugo, too close to share a scene with him.</p>
{du_cards}

<h2>The existing cast, for comparison</h2>
{cast_refs()}

<h2>Accent ranking: every French voice</h2>
<p class="note">Canadian probability per classifier ({' · '.join(n for _, n in MODELS)}), on the reference
recording and on the TTS output (eight Jo lines or five Durand lines, joined, ≤ 15 s). The top 6 are highlighted.
« f » = the gender-shifted take. Cast voices are included for reference only.</p>
{ranking_table()}
<p class="note">Built by scripts/voice/audition_r4.py (generation jobs, analysis, page) and
scripts/voice/accent_id.py (classifiers, run on auriga).</p>
<script>{JS}</script></html>"""
    (A.OUT / "index.html").write_text(page)
    print("wrote", A.OUT / "index.html", len(list(CLIPS.glob("*.ogg"))), "clips")
