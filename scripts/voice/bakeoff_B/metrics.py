"""Shared measurement helpers for the TTS bake-off (candidate B: Chatterbox Multilingual).

Run with the eval venv: .cache/tts/B/evalvenv/bin/python -I <script>
Everything here only *reads* audio files; no code from downloaded archives is executed.
"""
import os, re, unicodedata
import numpy as np
import soundfile as sf
import librosa

HF_CACHE = os.path.expanduser("~/.cache/huggingface")

# ---------------------------------------------------------------- audio io
def load(path, sr=16000):
    y, s = sf.read(path, always_2d=True)
    y = y.mean(axis=1).astype(np.float32)
    if s != sr:
        y = librosa.resample(y, orig_sr=s, target_sr=sr)
    return y

# ---------------------------------------------------------------- pitch / voice quality
def voice_stats(path):
    import parselmouth
    from parselmouth.praat import call
    snd = parselmouth.Sound(path)
    if snd.n_channels > 1:
        snd = snd.convert_to_mono()
    pitch = snd.to_pitch_ac(time_step=0.01, pitch_floor=60, pitch_ceiling=600)
    f0 = pitch.selected_array["frequency"]
    f0 = f0[f0 > 0]
    out = {"f0_mean_semitone_sd": float(np.std(12 * np.log2(f0 / np.median(f0)))) if len(f0) else 0.0,
           "f0_med": float(np.median(f0)) if len(f0) else 0.0,
           "f0_p10": float(np.percentile(f0, 10)) if len(f0) else 0.0,
           "f0_p90": float(np.percentile(f0, 90)) if len(f0) else 0.0,
           "voiced_frac": float(len(f0) / max(1, pitch.get_number_of_frames()))}
    try:
        pp = call(snd, "To PointProcess (periodic, cc)", 60, 600)
        out["jitter"] = float(call(pp, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3))
        out["shimmer"] = float(call([snd, pp], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6))
        harm = snd.to_harmonicity_cc(0.01, 60, 0.1, 1.0)
        v = harm.values[harm.values != -200]
        out["hnr"] = float(np.mean(v)) if len(v) else 0.0
    except Exception:
        pass
    return out

# ---------------------------------------------------------------- MOS (UTMOSv2, English-trained)
_utmos = None
def mos(path):
    global _utmos
    import torch
    if _utmos is None:
        import utmosv2
        _utmos = utmosv2.create_model(pretrained=True, device="cpu")
    y = load(path, 16000)
    torch.manual_seed(0)
    return float(_utmos.predict(data=torch.from_numpy(y), sr=16000, device="cpu", verbose=False, num_repetitions=5))

# ---------------------------------------------------------------- speaker embedding (ECAPA, VoxCeleb)
_ecapa = None
def spk_emb(path):
    global _ecapa
    import torch
    if _ecapa is None:
        from speechbrain.inference.speaker import EncoderClassifier
        _ecapa = EncoderClassifier.from_hparams(
            source="speechbrain/spkrec-ecapa-voxceleb",
            savedir=os.path.join(os.path.dirname(__file__), "../../../.cache/tts/B/models/ecapa"),
            run_opts={"device": "cpu"})
    y = load(path, 16000)
    with torch.no_grad():
        e = _ecapa.encode_batch(torch.from_numpy(y)[None])[0, 0].numpy()
    return e / np.linalg.norm(e)

# ---------------------------------------------------------------- ASR (Whisper large-v3-turbo via MLX)
ASR_MODEL = "mlx-community/whisper-large-v3-turbo"
def asr(path, language="fr"):
    """Whisper on the clip padded with 0.4 s of silence each side (Whisper tends to drop the
    first word of band-limited clips that start immediately)."""
    import mlx_whisper
    y = load(path, 16000)
    y = np.concatenate([np.zeros(6400, np.float32), y, np.zeros(6400, np.float32)])
    r = mlx_whisper.transcribe(y, path_or_hf_repo=ASR_MODEL, language=language,
                               temperature=0.0, condition_on_previous_text=False, verbose=None)
    return r["text"].strip(), r.get("language")

# ---------------------------------------------------------------- text normalisation for CER
def _num_fr(m):
    from num2words import num2words
    return " " + num2words(int(m.group(0)), lang="fr") + " "

def norm_cer(t):
    t = unicodedata.normalize("NFC", t)
    t = re.sub(r"\*[^*]*\*", " ", t)
    t = t.replace("’", "'").replace("‘", "'").replace("`", "'")
    t = t.lower()
    t = re.sub(r"(\d+)\s*h\s*(\d+)", r"\1 heures \2", t)
    t = re.sub(r"(\d+),(\d+)", r"\1 virgule \2", t)
    t = re.sub(r"\bkm\b", " kilomètres ", t)
    t = re.sub(r"\bdr\b\.?", " docteur ", t)
    t = re.sub(r"\bm\.\s", " monsieur ", t)
    t = re.sub(r"\d+", _num_fr, t)
    t = t.replace("-", " ")
    t = re.sub(r"[^\w' ]+", " ", t)
    t = t.replace("'", " ")
    t = re.sub(r"\s+", " ", t).strip()
    return t

def cer(ref, hyp):
    import jiwer
    r, h = norm_cer(ref), norm_cer(hyp)
    if not r:
        return 0.0
    return float(jiwer.cer(r, h))

def wer(ref, hyp):
    import jiwer
    return float(jiwer.wer(norm_cer(ref), norm_cer(hyp)))

# ---------------------------------------------------------------- vocal-tract length proxy
def formant_spacing(path, max_formant=None):
    """Median formant spacing dF (Hz) from F1..F4 on voiced frames, via the uniform-tube fit
    Fi = (2i-1)/2 * dF.  Apparent vocal-tract length VTL = c / (2 dF) (c = 35000 cm/s).
    Typical: adult male ~1000 Hz (17.5 cm), adult female ~1150-1200 Hz (~15 cm), child 10-12y ~1300+ Hz (<13.5 cm)."""
    import parselmouth
    snd = parselmouth.Sound(path)
    if snd.n_channels > 1:
        snd = snd.convert_to_mono()
    pitch = snd.to_pitch_ac(0.01, 60, 600)
    f0 = pitch.selected_array["frequency"]; med = np.median(f0[f0 > 0]) if np.any(f0 > 0) else 150
    mf = max_formant or (5000 if med < 160 else 5500 if med < 230 else 6500)
    fm = snd.to_formant_burg(time_step=0.01, max_number_of_formants=5, maximum_formant=mf)
    ds = []
    for t, f in zip(pitch.xs(), f0):
        if f <= 0:
            continue
        F = [fm.get_value_at_time(i, t) for i in range(1, 5)]
        if any(np.isnan(F)):
            continue
        k = np.array([0.5, 1.5, 2.5, 3.5]); F = np.array(F)
        ds.append(float(np.dot(k, F) / np.dot(k, k)))
    d = float(np.median(ds)) if ds else 0.0
    return {"dF": d, "vtl_cm": 35000 / (2 * d) if d else 0.0}
