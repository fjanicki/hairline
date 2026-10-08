"""Generate bake-off takes with Chatterbox Multilingual V3 via mlx-audio (MLX port, Apple GPU).

usage: mlxvenv/bin/python -I gen_mlx.py <plan.json> <out_raw_dir> [--takes N] [--only n,n] [--model repo]
Same plan format as gen.py (voices: ref / gen_ref / exaggeration / cfg_weight / temperature).
"""
import sys, os, json, time, argparse, re
import numpy as np, soundfile as sf
import mlx.core as mx

ap = argparse.ArgumentParser()
ap.add_argument("plan"); ap.add_argument("out")
ap.add_argument("--takes", type=int, default=3)
ap.add_argument("--only", default="")
ap.add_argument("--model", default="mlx-community/chatterbox-multilingual-v3")
ap.add_argument("--seed0", type=int, default=0)
ap.add_argument("--raw_text", action="store_true", help="feed text without guillemet/markup cleanup")
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)

from mlx_audio.tts.utils import load_model
from mlx_audio.tts.models.chatterbox.chatterbox import Conditionals

def model_text(t):
    t = re.sub(r"\*[^*]*\*", " ", t)
    t = re.sub(r"<[^>]+>", " ", t)
    t = t.replace("« ", "\"").replace(" »", "\"").replace("«", "\"").replace("»", "\"")
    t = t.replace("’", "'").replace(" ", " ")
    return re.sub(r"\s+", " ", t).strip()

plan = json.load(open(a.plan))
only = set(x for x in a.only.split(",") if x)
t0 = time.time(); m = load_model(a.model); load_s = time.time() - t0
SR = m.sample_rate
tim_path = os.path.join(a.out, "timings.json")
timings = json.load(open(tim_path)) if os.path.exists(tim_path) else {}
timings["_load_s"] = load_s
cache = {}
def conds_for(v):
    key = (v["ref"], v.get("gen_ref"), v.get("exaggeration", 0.5))
    if key not in cache:
        y, sr = sf.read(v["ref"], dtype="float32")
        c = m.prepare_conditionals(mx.array(y), sr, v.get("exaggeration", 0.5))
        if v.get("gen_ref"):
            # split conditioning: T3 (tokens: language/prosody/accent) from the French ref,
            # S3Gen (waveform/timbre) from another ref (e.g. a real child's voice).
            y2, sr2 = sf.read(v["gen_ref"], dtype="float32")
            c2 = m.prepare_conditionals(mx.array(y2), sr2, v.get("exaggeration", 0.5))
            c = Conditionals(c.t3, c2.gen)
        cache[key] = c
    return cache[key]

for ln in plan["lines"]:
    key = str(ln["n"])
    if only and key not in only:
        continue
    v = plan["voices"][ln.get("voice", ln["character"])]
    c = conds_for(v)
    for k in range(a.takes):
        name = f"{key}-{ln['character']}-t{k}"
        mx.random.seed(a.seed0 + 1000 * int(re.sub(r"\D", "", key) or 0) + k)
        t = time.time()
        segs = list(m.generate(ln["text"] if a.raw_text else model_text(ln["text"]), conds=c, lang_code="fr",
                               exaggeration=v.get("exaggeration", 0.5), cfg_weight=v.get("cfg_weight", 0.5),
                               temperature=v.get("temperature", 0.8),
                               repetition_penalty=v.get("repetition_penalty", 1.2), verbose=False))
        w = np.concatenate([np.array(s.audio, dtype=np.float32) for s in segs])
        dt = time.time() - t; dur = len(w) / SR
        sf.write(os.path.join(a.out, name + ".wav"), w, SR)
        timings[name] = {"gen_s": dt, "dur_s": dur}
        print(f"{name}: {dur:.2f}s audio in {dt:.1f}s (rtf {dt/dur:.2f})", flush=True)
        json.dump(timings, open(tim_path, "w"), indent=1)
