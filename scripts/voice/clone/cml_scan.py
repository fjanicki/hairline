"""Round 2 (cleaner references): every French reader of CML-TTS (LibriVox audiobooks, 24 kHz; dataset CC BY 4.0,
recordings public domain), screened for adult women with a Québec accent and ranked by recording quality.
Runs on auriga in ~/hairline-clone/venv-qa; reads ylacombe/cml-tts (Hugging Face) by HTTP range requests, so only
the needed parquet row groups are downloaded (row groups of 100 rows, readers mixed in every group).

  venv-qa/bin/python bin/cml_scan.py inventory   # speaker_id, duration, levenshtein of every French row
  venv-qa/bin/python bin/cml_scan.py sample      # up to 4 clips (6-20 s, best wav2vec match) per reader
                                                 #   -> data/cml/<spk>/<file>.<rg>.<i>.wav (24 kHz)
  venv-qa/bin/python bin/cml_scan.py screen      # gender/age (audeering) per reader; women -> 15 s screen clip
                                                 #   data/cml_screen/<spk>.wav for the accent classifiers
  venv-qa/bin/python bin/cml_scan.py more SPK..  # 16 more clips for the shortlisted readers, quality-measured
  venv-qa/bin/python bin/cml_scan.py refs SPK..  # reference from a reader's best clips -> refs2/cml_<spk>.wav
  venv-qa/bin/python bin/cml_scan.py orig SPK [N] # the same segments cut from LibriVox's original MP3s on
                                                 #   archive.org (128 kbps, 44.1 kHz; CML-TTS used the 64 kbps
                                                 #   derivative), N per chapter file -> data/lv/<spk>/, quality-measured
  venv-qa/bin/python bin/cml_scan.py lvrefs SPK [MATCH TAG] # reference from the best original segments (chapter
                                                 #   files containing MATCH) -> refs2/lv_<spk><TAG>.wav
Segment times: CML-TTS's cml_tts_dataset_segments_v0.1 (data/cml_segments/cml_*_segments_fr.txt, from the
dataset repo's cml_tts_dataset_segments_v0.1.tar.bz): <spk>_<LibriVox book id>_<n> <64 kbps url> <start> <end>.

CML-TTS speaker ids are the LibriVox reader ids (as in MLS), so a reader is credited by her LibriVox name.
"""
import io
import json
import sys
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
import quality as Q  # noqa: E402

D = Path.home() / "hairline-clone"
WORK = D / "work/cml"
WORK.mkdir(parents=True, exist_ok=True)
REPO = "datasets/ylacombe/cml-tts/french"
SR = 24000


def fs():
    from huggingface_hub import HfFileSystem
    return HfFileSystem()


def cmd_inventory():
    h = fs()
    files = sorted(h.glob(f"{REPO}/*.parquet"))
    out = WORK / "inventory.json"
    inv = json.loads(out.read_text()) if out.exists() else {}
    for f in files:
        name = f.split("/")[-1]
        if name in inv:
            continue
        pf = pq.ParquetFile(h.open(f, block_size=2 ** 20))
        rows = []
        for rg in range(pf.num_row_groups):
            t = pf.read_row_group(rg, columns=["speaker_id", "duration", "levenshtein"]).to_pylist()
            rows += [[r["speaker_id"], rg, i, round(r["duration"], 2), round(r["levenshtein"], 3)] for i, r in enumerate(t)]
        inv[name] = rows
        out.write_text(json.dumps(inv))
        print(name, len(rows), len({r[0] for r in rows}), flush=True)
    spk = {}
    for name, rows in inv.items():
        for s, rg, i, d, lv in rows:
            spk.setdefault(s, [0, 0.0])
            spk[s][0] += 1
            spk[s][1] += d
    print(f"{len(spk)} readers, {sum(v[1] for v in spk.values()) / 3600:.0f} h")


def plan(per_spk=4, only=None, skip=()):
    """Greedy choice of row groups so that every reader gets per_spk good clips (6-20 s, wav2vec match >= 0.9)."""
    inv = json.loads((WORK / "inventory.json").read_text())
    groups = {}
    for name, rows in inv.items():
        for s, rg, i, d, lv in rows:
            if 6 <= d <= 20 and lv >= 0.9 and (only is None or s in only) and f"{name}.{rg}.{i}" not in skip:
                groups.setdefault((name, rg), []).append((s, i, d))
    need = {}
    for g in groups.values():
        for s, _, _ in g:
            need[s] = per_spk
    chosen = []
    while any(v > 0 for v in need.values()):
        if not groups:
            break
        best = max(groups, key=lambda g: sum(1 for s, _, _ in groups[g] if need[s] > 0))
        take = []
        for s, i, d in groups[best]:
            if need[s] > 0:
                take.append((s, i))
                need[s] -= 1
        if not take:
            break
        chosen.append((best, take))
        del groups[best]
    return chosen


def fetch(chosen, dst_root):
    h = fs()
    files = {f.split("/")[-1]: f for f in h.glob(f"{REPO}/*.parquet")}
    for n, ((name, rg), take) in enumerate(chosen):
        want = [(s, i) for s, i in take if not (dst_root / str(s) / f"{name[:22]}.{rg}.{i}.wav").exists()]
        if not want:
            continue
        pf = pq.ParquetFile(h.open(files[name], block_size=2 ** 22))
        t = pf.read_row_group(rg, columns=["audio"]).to_pylist()
        for s, i in want:
            y, sr = sf.read(io.BytesIO(t[i]["audio"]["bytes"]), dtype="float32", always_2d=True)
            d = dst_root / str(s)
            d.mkdir(parents=True, exist_ok=True)
            sf.write(d / f"{name[:22]}.{rg}.{i}.wav", y.mean(1), sr, subtype="PCM_16")
        print(f"[{n + 1}/{len(chosen)}] {name} rg {rg}: {len(want)} clips", flush=True)


def cmd_sample():
    chosen = plan(4)
    print(f"{len(chosen)} row groups to read", flush=True)
    fetch(chosen, D / "data/cml")


def cmd_screen():
    import librosa
    from agegender import AgeGender
    ag = AgeGender(device="cuda")
    out = WORK / "screen.json"
    res = json.loads(out.read_text()) if out.exists() else {}
    scr = D / "data/cml_screen"
    scr.mkdir(exist_ok=True)
    for d in sorted((D / "data/cml").iterdir()):
        if d.name in res:
            continue
        ests, ys = [], []
        for f in sorted(d.glob("*.wav")):
            y, sr = sf.read(f, dtype="float32")
            y16 = librosa.resample(y, orig_sr=sr, target_sr=16000)
            ests.append(ag(y16))
            yt, _ = librosa.effects.trim(y16, top_db=40)
            ys += [yt, np.zeros(4000, np.float32)]
        if not ests:
            continue
        r = {"n": len(ests), "pFemale": round(float(np.mean([e["p_female"] for e in ests])), 3),
             "age": round(float(np.mean([e["age"] for e in ests])), 1)}
        if r["pFemale"] > 0.5:
            sf.write(scr / f"{d.name}.wav", np.concatenate(ys)[: 16000 * 15], 16000, subtype="PCM_16")
        res[d.name] = r
        print(d.name, r, flush=True)
    out.write_text(json.dumps(res, indent=1))


def cmd_more(*spks):
    only = {int(s) for s in spks}
    have = set()
    for s in only:
        have |= {p.stem for p in (D / "data/cml" / str(s)).glob("*.wav")}
    inv = json.loads((WORK / "inventory.json").read_text())
    full = {n[:22]: n for n in inv}
    skip = {f"{full[h.split('.')[0]]}.{h.split('.', 1)[1]}" for h in have}
    fetch(plan(16, only, skip), D / "data/cml")
    cmd_quality(*spks)


def cmd_quality(*spks):
    out = WORK / "clips.json"
    res = json.loads(out.read_text()) if out.exists() else {}
    for s in spks:
        for f in sorted((D / "data/cml" / str(s)).glob("*.wav")):
            k = f"{s}/{f.stem}"
            if k in res:
                continue
            y, sr = sf.read(f, dtype="float32")
            m = Q.measure(y, sr)
            m["q"] = Q.qscore(m)
            res[k] = m
        out.write_text(json.dumps(res))
        cs = sorted((m["q"], k) for k, m in res.items() if k.startswith(f"{s}/"))
        print(s, len(cs), "q top4", round(float(np.mean([q for q, _ in cs[-4:]])), 3), flush=True)


def cmd_refs(*spks, min_s=12.0, max_s=15.0):
    import librosa
    res = json.loads((WORK / "clips.json").read_text())
    out = D / "refs2"
    out.mkdir(exist_ok=True)
    for s in spks:
        cs = sorted(((m["q"], k) for k, m in res.items() if k.startswith(f"{s}/")), reverse=True)
        parts, tot = [], 0.0
        for q, k in cs:
            y, sr = sf.read(D / "data/cml" / f"{k}.wav", dtype="float32")
            y, _ = librosa.effects.trim(y, top_db=35, frame_length=1024, hop_length=256)
            d = len(y) / sr
            if tot + d > max_s + 2:
                continue
            parts += [y, np.zeros(int(sr * 0.3), np.float32)]
            tot += d + 0.3
            if tot >= min_s:
                break
        if not parts:  # every clip is longer than max_s: cut the best one
            y, sr = sf.read(D / "data/cml" / f"{cs[0][1]}.wav", dtype="float32")
            parts = [y]
        y = np.concatenate(parts)[: int(sr * max_s)]
        y = y * (10 ** (-20 / 20) / (np.sqrt(np.mean(y ** 2)) + 1e-9))
        sf.write(out / f"cml_{s}.wav", np.clip(y, -0.99, 0.99), sr, subtype="PCM_16")
        print(s, round(len(y) / sr, 2), "s from", len(parts) // 2 or 1, "clips")


def cmd_orig(spk, n_per_file=12):
    """Re-cut a reader's CML-TTS segments from LibriVox's original MP3 (the 64 kbps file CML-TTS used has an
    MP3 low-pass; the original upload is 128 kbps). Public Domain Mark (archive.org licenseurl)."""
    import subprocess
    import urllib.request
    segs = {}
    for f in sorted((D / "data/cml_segments").glob("cml_*_segments_fr.txt")):
        for line in f.read_text().splitlines():
            p = line.split("\t")
            if p[0].split("_")[0] == str(spk):
                segs.setdefault(p[1], []).append((p[0], float(p[2]), float(p[3])))
    dst = D / "data/lv" / str(spk)
    dst.mkdir(parents=True, exist_ok=True)
    mp3d = D / "data/lv_mp3"
    mp3d.mkdir(parents=True, exist_ok=True)
    res_p = WORK / "lv_clips.json"
    res = json.loads(res_p.read_text()) if res_p.exists() else {}
    for url, ss in sorted(segs.items()):
        orig = url.replace("http://", "https://").replace("_64kb.mp3", ".mp3")
        mp3 = mp3d / orig.split("/")[-1]
        if not mp3.exists():
            try:
                urllib.request.urlretrieve(orig, mp3.with_suffix(".part"))
                mp3.with_suffix(".part").rename(mp3)
            except Exception as e:
                print("skip", orig, e, flush=True)
                continue
        info = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=sample_rate,bit_rate", "-of",
                               "csv=p=0", str(mp3)], capture_output=True, text=True).stdout.strip()
        step = max(1, len(ss) // int(n_per_file))
        for name, a, b in sorted(ss)[::step][: int(n_per_file)]:
            w = dst / f"{name}.wav"
            if not w.exists():
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a:.3f}", "-to", f"{b:.3f}", "-i", str(mp3),
                                "-ac", "1", str(w)], check=True)
            k = f"{spk}/{name}"
            if k not in res:
                y, sr = sf.read(w, dtype="float32")
                m = Q.measure(y, sr)
                m["q"] = Q.qscore(m)
                m["src"] = orig
                m["mp3"] = info
                res[k] = m
        res_p.write_text(json.dumps(res))
        print(spk, mp3.name, info, len(ss), "segments", flush=True)
    cs = sorted((m["q"], k) for k, m in res.items() if k.startswith(f"{spk}/"))
    print(spk, len(cs), "q top4", round(float(np.mean([q for q, _ in cs[-4:]])), 3))


def cmd_lvrefs(s, match="", tag="", min_s=12.0, max_s=15.0):
    """Reference from reader s's best original segments; `match` keeps only chapter files containing it."""
    import librosa
    res = json.loads((WORK / "lv_clips.json").read_text())
    out = D / "refs2"
    for s in [s]:
        cs = sorted(((m["q"], k) for k, m in res.items() if k.startswith(f"{s}/") and match in m["src"]), reverse=True)
        parts, tot, used = [], 0.0, []
        for q, k in cs:
            y, sr = sf.read(D / "data/lv" / f"{k}.wav", dtype="float32")
            y, _ = librosa.effects.trim(y, top_db=35, frame_length=2048, hop_length=512)
            d = len(y) / sr
            if tot + d > max_s + 2:
                continue
            parts += [y, np.zeros(int(sr * 0.3), np.float32)]
            tot += d + 0.3
            used.append(k)
            if tot >= min_s:
                break
        y = np.concatenate(parts)[: int(sr * max_s)]
        y = y * (10 ** (-20 / 20) / (np.sqrt(np.mean(y ** 2)) + 1e-9))
        sf.write(out / f"lv_{s}{tag}.wav", np.clip(y, -0.99, 0.99), sr, subtype="PCM_16")
        (out / f"lv_{s}{tag}.json").write_text(json.dumps({"segments": used, "src": [res[k]["src"] for k in used]}, indent=1))
        print(s, round(len(y) / sr, 2), "s from", used)


if __name__ == "__main__":
    {"inventory": cmd_inventory, "sample": cmd_sample, "screen": cmd_screen, "more": cmd_more,
     "quality": cmd_quality, "refs": cmd_refs, "orig": cmd_orig, "lvrefs": cmd_lvrefs}[sys.argv[1]](*sys.argv[2:])
