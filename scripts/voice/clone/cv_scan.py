"""Round 2 (cleaner references): every adult woman with a Canadian / Québec accent tag in Mozilla Common Voice
Scripted Speech 25.0 French (CC0), ranked by recording quality. Runs on auriga in ~/hairline-clone/venv-qa.

Source: thomasgauthier/common-voice-scripted-speech-quebec on Hugging Face (CC0; a filter of Common Voice 25.0 fr
on variant « Français d'Amérique du Nord » or a Canadian / Québécois accent tag; 25,198 clips, 3 parquet shards in
~/hairline-clone/data/cv/qc{0,1,2}.parquet). Round 1 read only shard 0 and at most 40 clips per speaker.
The shards repeat some rows (same recording in two shards): ranking keeps one entry per recording.

  venv-qa/bin/python bin/cv_scan.py screen   # speakers: tagged women 20s-40s, plus untagged speakers the
                                             # audeering model hears as adult women (3 clips each, GPU)
  venv-qa/bin/python bin/cv_scan.py clips    # every validated clip of those speakers: quality.measure (CPU)
  venv-qa/bin/python bin/cv_scan.py refs     # per speaker, the reference from her best clips -> refs2/cv_<id>.wav

Speakers stay anonymous: only the hashed speaker prefix (10 hex) is kept, never a sentence or any metadata beyond
age band / accent tag. « Français des États-Unis »-only speakers are left out (not Québec).
"""
import io
import json
import sys
from pathlib import Path

import librosa
import numpy as np
import pyarrow.parquet as pq
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
import quality as Q  # noqa: E402

D = Path.home() / "hairline-clone"
SHARDS = [D / f"data/cv/qc{i}.parquet" for i in range(3)]
WORK = D / "work/cv"
WORK.mkdir(parents=True, exist_ok=True)
AGES = {"twenties", "thirties", "fourties"}
META_COLS = ["speaker_id", "gender", "age", "accents", "up_votes", "down_votes", "split"]


def rows_meta():
    out = []
    for si, s in enumerate(SHARDS):
        pf = pq.ParquetFile(s)
        n = 0
        for rg in range(pf.num_row_groups):
            for i, r in enumerate(pf.read_row_group(rg, columns=META_COLS).to_pylist()):
                r.update(shard=si, rg=rg, i=i)
                out.append(r)
            n += 1
    return out


def ok_clip(r):
    return r["split"] != "invalidated" and (r["up_votes"] or 0) > (r["down_votes"] or 0)


def ok_accent(a):
    a = a or ""
    return not (("États-Unis" in a) and ("Canada" not in a) and ("Québ" not in a))


def decode(shard, rg, idxs):
    t = pq.ParquetFile(SHARDS[shard]).read_row_group(rg, columns=["audio"]).to_pylist()
    for i in idxs:
        try:
            y, sr = sf.read(io.BytesIO(t[i]["audio"]["bytes"]), dtype="float32", always_2d=True)
        except Exception:
            continue
        y = y.mean(1)
        y, _ = librosa.effects.trim(y, top_db=35, frame_length=1024, hop_length=256)
        yield i, y, sr


def by_rowgroup(rs):
    g = {}
    for r in rs:
        g.setdefault((r["shard"], r["rg"]), []).append(r)
    return g


def cmd_screen():
    meta = rows_meta()
    spk = {}
    for r in meta:
        spk.setdefault(r["speaker_id"][:10], []).append(r)
    tagged = {s for s, rs in spk.items() if rs[0]["gender"] == "female_feminine" and rs[0]["age"] in AGES
              and ok_accent(rs[0]["accents"])}
    untagged = {s for s, rs in spk.items() if not rs[0]["gender"] and ok_accent(rs[0]["accents"])
                and rs[0]["age"] in AGES | {None, ""} and sum(ok_clip(r) for r in rs) >= 5}
    print(f"tagged women 20s-40s: {len(tagged)}; untagged speakers with >= 5 clips: {len(untagged)}", flush=True)
    from agegender import AgeGender
    ag = AgeGender(device="cuda")
    res = {}
    for s in sorted(untagged):
        rs = [r for r in spk[s] if ok_clip(r)][:3]
        ests = []
        for (sh, rg), grp in by_rowgroup(rs).items():
            for _, y, sr in decode(sh, rg, [r["i"] for r in grp]):
                ests.append(ag(librosa.resample(y, orig_sr=sr, target_sr=16000)))
        if ests:
            res[s] = {"pFemale": float(np.mean([e["p_female"] for e in ests])),
                      "age": float(np.mean([e["age"] for e in ests]))}
            print(s, res[s], flush=True)
    found = {s for s, v in res.items() if v["pFemale"] > 0.8 and 22 <= v["age"] <= 50}
    keep = sorted(tagged | found)
    sel = {s: {"tag": "tagged" if s in tagged else "untagged", "age": spk[s][0]["age"],
               "accents": spk[s][0]["accents"], "clips": sum(ok_clip(r) for r in spk[s]),
               **({"est": res[s]} if s in res else {})} for s in keep}
    (WORK / "speakers.json").write_text(json.dumps(sel, ensure_ascii=False, indent=1))
    (WORK / "untagged_screen.json").write_text(json.dumps(res, indent=1))
    print(f"{len(keep)} speakers ({len(found)} found among untagged)")


def cmd_clips(cap=200):
    sel = json.loads((WORK / "speakers.json").read_text())
    out = WORK / "clips.json"
    res = json.loads(out.read_text()) if out.exists() else {}
    meta = [r for r in rows_meta() if r["speaker_id"][:10] in sel and ok_clip(r)]
    per = {}
    for r in meta:
        per.setdefault(r["speaker_id"][:10], []).append(r)
    todo = [r for s, rs in per.items() for r in rs[:cap] if f"{s}/{r['shard']}.{r['rg']}.{r['i']}" not in res]
    print(f"clips to measure: {len(todo)}", flush=True)
    n = 0
    for (sh, rg), grp in sorted(by_rowgroup(todo).items()):
        ids = {r["i"]: r for r in grp}
        for i, y, sr in decode(sh, rg, list(ids)):
            if len(y) < sr * 1.5:
                continue
            m = Q.measure(y, sr)
            m["q"] = Q.qscore(m)
            res[f"{ids[i]['speaker_id'][:10]}/{sh}.{rg}.{i}"] = m
            n += 1
        if n and n % 200 < len(grp):
            out.write_text(json.dumps(res))
            print(n, flush=True)
    out.write_text(json.dumps(res))
    print("measured", len(res))


def speaker_rank():
    sel = json.loads((WORK / "speakers.json").read_text())
    clips = json.loads((WORK / "clips.json").read_text())
    per, seen = {}, set()
    for k, m in clips.items():  # the HF shards repeat some rows: one entry per distinct recording
        sig = (k.split("/")[0], m["dur"], m["q"], m["bw"], m["snr"])
        if sig in seen:
            continue
        seen.add(sig)
        per.setdefault(k.split("/")[0], []).append((k, m))
    rank = {}
    for s, cs in per.items():
        cs.sort(key=lambda km: -km[1]["q"])
        top = cs[:4]
        rank[s] = {**sel[s], "n": len(cs), "q_top4": round(float(np.mean([m["q"] for _, m in top])), 3),
                   "dnsmos_ovr_top4": round(float(np.mean([m["dnsmos"]["ovr"] for _, m in top])), 3),
                   "bw_top4": round(float(np.mean([m["bw"] for _, m in top]))),
                   "q_median": round(float(np.median([m["q"] for _, m in cs])), 3), "best": [k for k, _ in cs[:12]]}
    return dict(sorted(rank.items(), key=lambda kv: -kv[1]["q_top4"]))


def build_ref(keys, dst, min_s=12.0, max_s=15.0, sr_out=24000):
    """Join the given clips (best first: Chatterbox conditions on the first 6 s / 10 s) to min_s..max_s."""
    parts, tot = [], 0.0
    for k in keys:
        sh, rg, i = map(int, k.split("/")[1].split("."))
        for _, y, sr in decode(sh, rg, [i]):
            y = librosa.resample(y, orig_sr=sr, target_sr=sr_out)
            d = len(y) / sr_out
            if tot + d > max_s + 2:
                continue
            parts += [y, np.zeros(int(sr_out * 0.3), np.float32)]
            tot += d + 0.3
        if tot >= min_s:
            break
    y = np.concatenate(parts)[: int(sr_out * max_s)]
    y = y * (10 ** (-20 / 20) / (np.sqrt(np.mean(y ** 2)) + 1e-9))
    sf.write(dst, np.clip(y, -0.99, 0.99), sr_out, subtype="PCM_16")
    return round(len(y) / sr_out, 2)


def cmd_refs(n=None):
    rank = speaker_rank()
    out = D / "refs2"
    out.mkdir(exist_ok=True)
    for s, v in list(rank.items())[: int(n) if n else None]:
        v["dur"] = build_ref(v["best"], out / f"cv_{s}.wav")
    (WORK / "rank.json").write_text(json.dumps(rank, ensure_ascii=False, indent=1))
    print(json.dumps({s: {k: v[k] for k in ("tag", "age", "n", "q_top4", "dnsmos_ovr_top4", "bw_top4")}
                      for s, v in rank.items()}, indent=0))


if __name__ == "__main__":
    {"screen": cmd_screen, "clips": cmd_clips, "refs": cmd_refs}[sys.argv[1]](*sys.argv[2:])
