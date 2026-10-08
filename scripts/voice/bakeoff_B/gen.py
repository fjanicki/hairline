"""Generate bake-off takes with Chatterbox Multilingual (fr) on MPS.

usage: venv/bin/python -I gen.py <B_dir> <plan.json> <out_raw_dir> [--takes N] [--only n,n] [--device mps]
plan.json: {"voices": {character: {"ref": wav, "exaggeration": x, "cfg_weight": y, "temperature": t}},
            "lines": [{"n", "character", "text", ...}]}
writes <out_raw_dir>/<n>-<character>-t<k>.wav (24 kHz) and timings.json
"""
import sys, os, json, time, argparse, re
import torch, torchaudio

ap = argparse.ArgumentParser()
ap.add_argument("bdir"); ap.add_argument("plan"); ap.add_argument("out")
ap.add_argument("--takes", type=int, default=3)
ap.add_argument("--only", default="")
ap.add_argument("--device", default="mps")
ap.add_argument("--threads", type=int, default=4)
ap.add_argument("--t3", default="")
a = ap.parse_args()
torch.set_num_threads(a.threads)
os.makedirs(a.out, exist_ok=True)

from chatterbox.mtl_tts import ChatterboxMultilingualTTS
plan = json.load(open(a.plan))
only = set(x for x in a.only.split(",") if x)

def model_text(t):
    # what the generator feeds the model: same normalisation as voiceKey.normalize (stage markup out),
    # guillemets -> plain quotes (the model's tokenizer has rarely seen « »), ellipsis handled by punc_norm.
    t = re.sub(r"\*[^*]*\*", " ", t)
    t = re.sub(r"<[^>]+>", " ", t)
    t = t.replace("« ", "\"").replace(" »", "\"").replace("«", "\"").replace("»", "\"")
    t = t.replace("’", "'").replace(" ", " ")
    return re.sub(r"\s+", " ", t).strip()

t0 = time.time()
m = (ChatterboxMultilingualTTS.from_pretrained(device=a.device, t3_model=a.t3) if a.t3
     else ChatterboxMultilingualTTS.from_pretrained(device=a.device))
load_s = time.time() - t0
tim_path = os.path.join(a.out, "timings.json")
timings = json.load(open(tim_path)) if os.path.exists(tim_path) else {}
timings["_load_s"] = load_s
cur_ref = None
for ln in plan["lines"]:
    key = str(ln["n"])
    if only and key not in only:
        continue
    v = plan["voices"][ln.get("voice", ln["character"])]
    vid = (v["ref"], v.get("gen_ref"))
    if vid != cur_ref:
        if v.get("gen_ref"):
            # split conditioning: T3 (text->speech tokens: language, prosody, accent) from a French
            # reference, S3Gen (tokens->waveform: timbre) from a different reference (e.g. a real child).
            m.prepare_conditionals(v["gen_ref"], exaggeration=v.get("exaggeration", 0.5))
            gen = m.conds.gen
            m.prepare_conditionals(v["ref"], exaggeration=v.get("exaggeration", 0.5))
            m.conds.gen = gen
        else:
            m.prepare_conditionals(v["ref"], exaggeration=v.get("exaggeration", 0.5))
        cur_ref = vid
    for k in range(a.takes):
        torch.manual_seed(1000 * int(re.sub(r"\D", "", key) or 0) + k)
        t = time.time()
        w = m.generate(model_text(ln["text"]), language_id="fr",
                       exaggeration=v.get("exaggeration", 0.5), cfg_weight=v.get("cfg_weight", 0.5),
                       temperature=v.get("temperature", 0.8))
        dt = time.time() - t
        dur = w.shape[-1] / m.sr
        name = f"{key}-{ln['character']}-t{k}"
        torchaudio.save(os.path.join(a.out, name + ".wav"), w, m.sr)
        timings[name] = {"gen_s": dt, "dur_s": dur}
        print(f"{name}: {dur:.2f}s audio in {dt:.1f}s (rtf {dt/dur:.2f})", flush=True)
        json.dump(timings, open(tim_path, "w"), indent=1)
