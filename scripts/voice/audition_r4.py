"""Revision 4 casting: Jo (Québécoise, 34) and M. Durand (81). Builds the audition takes, scores them and writes
the audition page (.cache/tts/audition-r4/index.html). Nothing here touches the game's clips or manifest.

  python3 scripts/voice/audition_r4.py jobs        # work/jobs.json for scripts/voice/remote/auriga_gen.sh
  scripts/voice/remote/auriga_gen.sh .cache/tts/audition-r4/work/jobs.json .cache/tts/audition-r4/work/raw --name hl-r4-audition
  .cache/tts/A/evalvenv/bin/python scripts/voice/audition_r4.py analyse   # F0, Whisper CER, age/gender, ECAPA vs the cast
  python3 scripts/voice/audition_r4.py accent      # concatenated clips -> work/accent/, scored on auriga (accent_id.py)
  python3 scripts/voice/audition_r4.py page        # clips/*.ogg + index.html

Jo's accent: the 35 CML-TTS French readers carry no accent label, so every French voice in kyutai/tts-voices is
scored with three French dialect classifiers (accent_id.py) on its reference recording and on the TTS output.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / ".cache/tts/audition-r4"
WORK = OUT / "work"
RAW = WORK / "raw"
CAST = json.load(open(ROOT / "scripts/voice/cast.json"))
NB = " "  # narrow no-break space (docs/i18n-fr.md)

# ---------------------------------------------------------------- lines
# Screening lines (accent): short, Québécois-flavoured. Audition lines: from docs/SCRIPT-R4.md (2026-10-08 draft),
# keys there in the comment. `tts` only where the spoken form differs from the text.
JO_LINES = [
    {"id": "s1", "text": f"Ben là, t’es sérieux{NB}? C’est vraiment le fun.", "screen": True},
    {"id": "s2", "text": "Câline, t’es cute quand tu te concentres.", "screen": True},
    {"id": "s3", "text": f"Deux cent douze{NB}? Ok. Pis{NB}? Tu sais faire quoi d’autre{NB}?", "screen": True},
    {"id": "s4", "text": "Pantoute. Chu pas fâchée, t’sais. Chu juste fatiguée.", "screen": True},
    {"id": "j1", "text": f"Hey, le grand avec la botte{NB}! C’est-tu droit{NB}?", "src": "ch2.jo.call"},
    {"id": "j2", "text": "Chaque affaire, c’est quelque chose que j’ai appris. Le fouet, c’est l’année où j’ai réussi "
                         "la tourtière de ma grand-mère. L’engrenage, c’est le char manuel.", "src": "ch5.week3.jo"},
    {"id": "j3", "text": f"Attends. Tu répares sa roue en l’écoutant{NB}? Ok. C’est hot.", "src": "ch5.week4 truing"},
    {"id": "j4", "text": f"Tu me dois un souper. Tu sais cuisiner{NB}? Ben, tu vas apprendre.", "src": "ch7.wall"},
    # added after the script's 2026-10-08 edit (« Chaque affaire » became « Chaque tattoo »); j2 stays for the screen
    {"id": "j5", "text": "Chaque tattoo, c’est quelque chose que j’ai appris. Le fouet, c’est l’année où j’ai réussi "
                         "la tourtière de ma grand-mère. L’engrenage, c’est le char manuel.", "src": "ch5.week3.jo",
     "late": True},
]
DURAND_LINES = [
    {"id": "d1", "text": "Cinquante-deux ans, j’ai ouvert à huit heures. Maintenant j’ouvre à trois heures, pour "
                         "personne. C’est les mêmes heures. Il fait juste noir.", "src": "ch6.week9.reveal"},
    {"id": "d2", "text": "Vous faites un bruit d’armoire, jeune homme.", "src": "ch6.week9.reveal"},
    {"id": "d3", "text": "Ah. Celle-là, je l’ai gardée trois jours. Je l’ai faite en 1971, pour le père Marchal.",
     "tts": "Ah. Celle-là, je l'ai gardée trois jours. Je l'ai faite en mille neuf cent soixante et onze, pour le père Marchal.",
     "src": "ch6.week9.reveal"},
    {"id": "d4", "text": "Bonjour, jeune homme. J’ai dormi jusqu’à huit heures et demie. J’ai cru que j’étais mort.",
     "src": "ch7.durand.meet"},
    {"id": "d5", "text": f"Elles sont droites, hein. À mon âge, on remarque ce qui est droit.", "src": "ch5.week3.bench (oldman)"},
    # added after the script's edit: the reveal line now keeps Durand's proper grammar (« Ce sont », « Seulement »)
    {"id": "d6", "text": "Cinquante-deux ans, j’ai ouvert à huit heures. Maintenant, j’ouvre à trois heures, pour "
                         "personne. Ce sont les mêmes heures. Seulement, il fait nuit.", "src": "ch6.week9.reveal",
     "late": True},
    {"id": "d7", "text": "Je vous connais. Le grand qui partait courir à quatre heures. On s’est croisés cent vingt-trois "
                         "fois. J’ai compté.", "src": "ch6.week9.reveal", "late": True},
]
# The four lines each audition card plays (current script text); `late` lines are not in the accent clips.
CARD = {"jo": ["j1", "j5", "j3", "j4"], "durand": ["d6", "d2", "d7", "d3"]}

# ---------------------------------------------------------------- voice pools
# Every French voice of kyutai/tts-voices (Whisper LID p_fr > 0.3 in .cache/tts/A/screen.json): 19 women, 22 men.
# Enhanced embedding where one exists (the cast uses those, except Odile).
FEMALE = ["10087", "10177", "10179", "12080", "12205", "12977", "1591", "2154", "2465", "3267", "5207", "5476",
          "577", "579", "5830", "7400", "7591", "7762", "6318"]
FEMALE_X = ["unmute-prod-website/developpeuse-3.wav"]
# Men the classifiers call Canadian on their reference: tried for Jo through Praat "Change gender" (male -> female).
QC_MALE = ["2216", "2114", "296", "4193"]
# Durand: every French man not already cast (Hugo 1406, Gérard 4724, Bastien 7142, TV 5790, radio 7601/8128, Erick).
MALE = ["9834", "928", "4937", "4482", "4193", "2114", "2216", "296", "1770", "2223", "6318"]
MALE_X = ["voice-donations/2181_enhanced.wav", "voice-donations/SSA150803_enhanced.wav",
          "unmute-prod-website/fabieng-enhanced-v2.wav"]
TAKES = 2
PAD = CAST["model"]["defaults"]["initialPadding"]  # 6, as the game's clips

VOICE_ROOT = next((Path.home() / ".cache/huggingface/hub/models--kyutai--tts-voices/snapshots").iterdir())


def cml(spk: str, enhanced=True) -> str:
    fr = VOICE_ROOT / "cml-tts/fr"
    names = sorted(p.name for p in fr.glob(f"{spk}_*.wav"))
    name = next((n for n in names if n.endswith("_enhanced.wav")), None) if enhanced else None
    return "cml-tts/fr/" + (name or next(n for n in names if not n.endswith("_enhanced.wav")))


def vid(voice: str) -> str:  # short id: "7762", "developpeuse-3", "2181"
    stem = Path(voice).name.split(".")[0]
    return stem.split("_")[0] if voice.startswith("cml-tts") or voice.startswith("voice-donations") else \
        stem.replace("-enhanced-v2", "")


def pools():
    jo = [cml(s) for s in FEMALE] + FEMALE_X + [cml(s) for s in QC_MALE]
    du = [cml(s) for s in MALE] + MALE_X
    return jo, du


# ---------------------------------------------------------------- jobs
def cmd_jobs():
    jo, du = pools()
    jobs = []
    for role, voices, lines in (("jo", jo, JO_LINES), ("durand", du, DURAND_LINES)):
        for v in voices:
            for l in lines:
                jobs.append({"key": f"{role}__{vid(v)}__{l['id']}", "model": "A", "voice": v, "speaker": role,
                             "text": l.get("tts", l["text"]), "seed": 1, "takes": TAKES, "initial_padding": PAD})
    # Durand slower, natively: one articulated take per line (padding_between 1) for every candidate
    for v in du:
        for l in DURAND_LINES:
            jobs.append({"key": f"durand__{vid(v)}__{l['id']}__slow", "model": "A", "voice": v, "speaker": "durand",
                         "text": l.get("tts", l["text"]), "seed": 1, "takes": 1, "padding_between": 1,
                         "initial_padding": PAD})
    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / "jobs.json").write_text(json.dumps(jobs, ensure_ascii=False, indent=1))
    print(f"{len(jobs)} jobs ({sum(j['takes'] for j in jobs)} takes) -> {WORK / 'jobs.json'}")


# ---------------------------------------------------------------- analyse (evalvenv: mlx-whisper, speechbrain, parselmouth)
def takes():
    """{(role, vid, line, variant): [wav paths]} from work/raw."""
    out = {}
    for p in sorted(RAW.glob("*.wav")):
        m = re.match(r"(jo|durand)__(.+?)__([a-z]\d)(__slow)?(?:\.t(\d))?\.wav$", p.name)
        if m:
            out.setdefault((m[1], m[2], m[3], "slow" if m[4] else "plain"), []).append(p)
    return out


def line_of(role, lid):
    return next(x for x in (JO_LINES if role == "jo" else DURAND_LINES) if x["id"] == lid)


def text_of(role, lid):
    l = line_of(role, lid)
    return l.get("tts", l["text"])


def cmd_analyse():
    import numpy as np
    import librosa
    sys.path.insert(0, str(ROOT / "scripts/voice"))
    sys.path.insert(0, str(ROOT / ".cache/tts/A/tools"))
    import qa
    from agegender import AgeGender
    res_p = WORK / "analysis.json"
    res = json.loads(res_p.read_text()) if res_p.exists() else {}
    ag = AgeGender()
    # cast centroids from the dry kept takes of the game's 301 clips
    cen_p = WORK / "cast_centroids.json"
    if cen_p.exists():
        cen = {k: np.array(v) for k, v in json.loads(cen_p.read_text()).items()}
    else:
        st = json.load(open(ROOT / ".cache/tts/gen/state.json"))
        lines = {Path(l["file"]).stem: l for l in json.load(open(ROOT / "scripts/voice/lines.fr.json"))["lines"]}
        acc = {}
        for i, s in st.items():
            b = s.get("best") or {}
            if i in lines and b.get("proc") and Path(b["proc"]).exists():
                acc.setdefault(lines[i]["speaker"], []).append(b["proc"])
        cen = {}
        for spk, files in acc.items():
            es = [qa.ecapa(librosa.load(f, sr=16000)[0]) for f in files[:12]]
            c = np.mean(es, 0)
            cen[spk] = c / np.linalg.norm(c)
        cen_p.write_text(json.dumps({k: v.tolist() for k, v in cen.items()}))
    for (role, v, lid, var), files in sorted(takes().items()):
        for f in files:
            if str(f.name) in res:
                continue
            y, sr = librosa.load(f, sr=24000)
            y16 = librosa.resample(y, orig_sr=sr, target_sr=16000)
            hyp = qa.asr(str(f))
            e = qa.ecapa(y16)
            sims = {k: round(float(e @ c), 3) for k, c in cen.items()}
            a = ag(y16)
            res[f.name] = {"role": role, "voice": v, "line": lid, "variant": var, "dur": round(len(y) / sr, 2),
                           "f0": round(qa.f0_median(y, sr, 60, 500), 1), "asr": hyp,
                           "cer": round(qa.cer(qa.norm(text_of(role, lid)), qa.norm(hyp)), 3),
                           "age": round(a["age"], 1), "pFemale": round(a["p_female"], 3),
                           "pChild": round(a["p_child"], 3), "ecapa": sims, "emb": [round(float(x), 5) for x in e]}
            print(f.name, res[f.name]["f0"], res[f.name]["cer"], res[f.name]["age"])
        res_p.write_text(json.dumps(res, ensure_ascii=False))
    res_p.write_text(json.dumps(res, ensure_ascii=False))


# ---------------------------------------------------------------- accent clips (sent to auriga, accent_id.py)
def cmd_accent():
    """One clip per Jo candidate: take 0 of every plain line, 0.25 s apart, cut at 15 s (Voxlect's limit), plus the
    gender-shifted version for the Québécois men. Durand candidates get one too (France expected)."""
    import numpy as np
    import soundfile as sf
    import librosa
    d = WORK / "accent"
    d.mkdir(parents=True, exist_ok=True)
    by = {}
    for (role, v, lid, var), files in sorted(takes().items()):
        if var == "plain" and not line_of(role, lid).get("late"):
            by.setdefault((role, v), []).append(sorted(files)[0])
    for (role, v), files in by.items():
        ys = []
        for f in files:
            y, _ = librosa.load(f, sr=16000)
            y, _ = librosa.effects.trim(y, top_db=40)
            ys += [y, np.zeros(4000, np.float32)]
        y = np.concatenate(ys)[:16000 * 15]
        sf.write(d / f"{role}__{v}.wav", y, 16000)
        if role == "jo" and v in QC_MALE and not v.endswith("f"):
            shift(d / f"{role}__{v}.wav", d / f"{role}__{v}__fem.wav")
    print(len(list(d.glob("*.wav"))), "clips in", d)


def shift(src: Path, dst: Path, f0=205.0, formant=1.18, rng=1.1):
    """Male -> female with Praat Change gender (PSOLA, formant-aware): the accent stays, the voice moves. Same call
    and pitch range (75-600 Hz) as generate.py speaker_post(), so the audition sounds like the game would."""
    import parselmouth
    from parselmouth.praat import call
    snd = parselmouth.Sound(str(src))
    call(snd, "Change gender", 75, 600, formant, f0, rng, 1.0).save(str(dst), "WAV")


# Jo from a Québécois man: chosen from a 3 x 3 grid (F0 190/205/220 Hz x formants 1.12/1.18/1.24) on age/gender
# (audeering), the three accent classifiers and UTMOS; see docs/voice.md "R4 casting".
SHIFTED = {"2216": {"targetF0": 195, "formantRatio": 1.24, "pitchRange": 1.1},
           "2114": {"targetF0": 190, "formantRatio": 1.12, "pitchRange": 1.1}}


def cmd_shift():
    """work/raw/jo__<spk>__*.wav -> work/raw/jo__<spk>f__*.wav (the post the game would apply)."""
    n = 0
    for spk, p in SHIFTED.items():
        for f in sorted(RAW.glob(f"jo__{spk}__*.wav")):
            dst = RAW / f.name.replace(f"jo__{spk}__", f"jo__{spk}f__")
            if not dst.exists():
                shift(f, dst, p["targetF0"], p["formantRatio"], p["pitchRange"])
                n += 1
    print(n, "shifted takes")


# ---------------------------------------------------------------- page
def cmd_page():
    from audition_r4_page import build  # kept apart: it is mostly HTML
    build()


if __name__ == "__main__":
    {"jobs": cmd_jobs, "shift": cmd_shift, "analyse": cmd_analyse, "accent": cmd_accent, "page": cmd_page}[sys.argv[1]]()
