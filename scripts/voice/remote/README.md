# auriga remote TTS worker (candidate A: Kyutai TTS 1.6B en_fr)

## Recommendation: generate all lines on auriga

**Send every line and every retake to auriga.** On the Mac, use only Whisper QA, post-processing
(childify, loudness and trimming) and the manifest.

- **Speed.** Batched on the RX 9070 XT (ROCm), auriga runs at **RTF ≈ 0.04–0.07**, i.e. 15–25x
  faster than real time. The Mac MLX runs at RTF ≈ 3–8 (≈ 8 under load). That is about **100x faster**.
  At this speed, all ~300 lines × 3 takes (~70 min of audio at ~4.7 s per line) take about **3–6 minutes** of wall time.
- **Recommended setting.** Use the defaults: **one process, `--batch 32`**. Peak VRAM is 9.3 GB of
  16 GB, and the KDE desktop uses another ~0.8 GB. If something else is using the GPU (ComfyUI),
  use `--batch 16` (6.8 GB). Do **not** run 2 processes with batch 32: the run fails with an
  out-of-memory error. `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True` is set by `run_jobs.sh`.
- **Quality matches the Mac.** The check used the same Whisper large-v3, the same French
  normalisation and the same 12-line test set:

  | outputs | mean CER | max CER |
  |---|---|---|
  | Mac MLX bf16 (`.cache/tts/A/final_raw`), measured with auriga's ASR | 0.0197 | 0.105 |
  | auriga PyTorch/ROCm, batch 1, seed 1 (`.cache/tts/auriga/A`) | 0.0186 | 0.105 |
  | auriga 48 takes, batch 1 | 0.034 | 0.46 |
  | auriga 48 takes, batch 16 | 0.020 | 0.38 |
  | auriga 96 takes, batch 32 | 0.028 (median 0) | 0.54 |

  Batching does not lower quality. Occasional bad takes (a dropped first word, or a 1-word line
  misread) happen at the same rate as without batching. This is sampling variance, so **generate
  ≥ 2–3 takes and pick takes by CER on the Mac**.

  Speaker similarity used ECAPA cosine similarity, comparing each auriga line with the Mac version
  of the same line:
  - auriga vs Mac, same line: **0.85** (min 0.57, on Lou's (then Ines's) 1.4 s line, which is too short for a
    stable embedding).
  - Mac vs Mac, same character on different lines: 0.82.
  - Different characters: 0.10.

  So the voices are the same.

  The ASR and CER parts of the Mac's `evaluate.py` were reproduced in `auriga/eval_cer.py`. Results
  are in `.cache/tts/auriga/bench/`.

## Measured performance (auriga, torch 2.11.0+rocm7.2, bf16, HIP graphs on)

| setting | steady-state RTF per batch | wall RTF incl. load + warm-up | peak VRAM |
|---|---|---|---|
| batch 1 | 0.66–0.89 (median 0.70) | — | 4.3 GB |
| batch 8 | 0.105–0.11 | 0.20 (48 items) | 5.5 GB |
| batch 16, 1 process | 0.06–0.07 | 0.100 (96 items) | 6.8 GB |
| batch 32, 1 process | **0.037–0.043** | 0.092 (96 items) | 9.3 GB |
| batch 16, 2 processes | 0.076–0.083 each | 0.090 (96 items) | 2 × 6.8 GB |
| batch 32, 2 processes | out of memory | — | — |

Fixed overhead per run is about 20 s: about 10 s for imports and model load, and about 10 s for
the first batch (Triton kernel build and HIP-graph capture). Larger jobs amortise it, so 300+
items run close to the steady-state RTF. A batch runs until its longest item is finished, so
items are sorted by text length before batching.

## Commands (run on the Mac, from the project root)

```bash
# run, wait, and fetch the raw WAVs (blocking; prints progress every 30 s)
scripts/voice/remote/auriga_gen.sh jobs.json out_dir/

# fire-and-forget, then check status / pull results later
scripts/voice/remote/auriga_gen.sh jobs.json out_dir/ --detach
scripts/voice/remote/auriga_gen.sh jobs.json out_dir/ --status
scripts/voice/remote/auriga_gen.sh jobs.json out_dir/ --fetch

# options: --batch N (default 32)  --procs P (default 1)  --name RUN (default: jobs file basename)
```

- **Resumable and idempotent.** Re-running the same command:
  - skips keys whose WAV already exists on auriga;
  - joins a run that is still in progress, using a `flock` on the remote side;
  - fetches incrementally.

  WAVs are written to `.tmp.wav` and then renamed, so a killed run never leaves a truncated file.
  To force a key to be regenerated, delete `~/hairline-tts/runs/<name>/out/<key>*.wav` on auriga.
- **Safe to close the terminal.** The remote run is started with `setsid nohup`, so closing the
  terminal or losing ssh does not stop it. Use `--status` and `--fetch` afterwards.
- **Exit codes.** 0 means DONE, with all WAVs present. 1 means FAILED; see `--status` and
  `~/hairline-tts/runs/<name>/gen_*.log`, then re-run to resume.

## Job format (`jobs.json`: a JSON list)

```json
[
  {"key": "odile_017", "model": "A", "speaker": "odile",
   "text": "Plus fine qu'un cheveu. On la tire jusqu'au bout.",
   "seed": 1, "takes": 3},
  {"key": "tv_003", "model": "A", "speaker": "tv",
   "voice": "cml-tts/fr/5790_4893_000052-0001_enhanced.wav", "cfg": 2.0,
   "text": "…et c'est terminé pour les équipiers."}
]
```

| field | required | meaning |
|---|---|---|
| `key` | yes | output file stem; must be unique and must not contain `/` |
| `model` | no (default `"A"`) | only `"A"` is supported; anything else is rejected |
| `speaker` | yes, unless `voice` is given | looked up in `auriga/voices_A.json` (the final A voices) |
| `text` | yes | raw French line. The A text prep (`’`→`'`, `…`→`... `, ALL-CAPS→Capitalised) is applied unless `"prep": false` |
| `voice` | no | overrides the speaker voice. Either a path in `kyutai/tts-voices` (e.g. `cml-tts/fr/....wav`), or a local `.safetensors` voice embedding on the Mac, which is uploaded automatically |
| `cfg` | no (2.0) | CFG-distilled conditioning: 1.0–4.0 in 0.5 steps |
| `temp` | no (0.6) | sampling temperature. Items with different `temp`/`padding_bonus` go in separate batches |
| `padding_bonus` | no (0.0) | > 0 gives slower speech |
| `padding_between` | no (0) | forced padding between words; 1 gives more articulated speech |
| `seed` | no (1) | `torch.manual_seed` per batch (seed of the batch's first item + 7919 × take) |
| `takes` | no (1) | if `takes` > 1, outputs are `<key>.t0.wav` … `<key>.t{N-1}.wav` |

**Output.** Files are 24 kHz mono 16-bit WAVs: `<key>.wav`, or `<key>.t<k>.wav` when there are
several takes. There is no post-processing (raw). `_stats.jsonl` has one line per WAV:

- `dur_s`
- batch `rtf_batch`
- `finished`: false means the line hit the 60 s cap
- `peak_reserved_gb`

Generation settings match the Mac A driver (`.cache/tts/A/tools/gen.py`): temp 0.6, cfg 2.0,
n_q 32, `initial_padding` 2, `max_padding` 8, `final_padding` 2, bf16 weights (the Mac `final_raw`
run was not quantised). Different seeds/RNG mean takes are not bit-identical to the Mac's.

## Layout

- On the Mac: `scripts/voice/remote/auriga_gen.sh`, plus `auriga/`. That folder is rsynced to
  auriga as `~/hairline-tts/worker/` on every run and contains:
  - `kyutai_gen.py`: batched generator
  - `run_jobs.sh`: remote runner
  - `voices_A.json`
  - `eval_cer.py`: Whisper-large-v3 CER
- On auriga, under `~/hairline-tts/`:
  - `venv-kyutai`: Python 3.12, torch 2.11.0+rocm7.2, moshi 0.2.13
  - `venv-eval`: same torch, plus transformers, jiwer and speechbrain
  - `runs/<name>/`: `jobs.json`, `out/`, `gen_*.log`, `status`
  - `bench/`
- Models are in the HF cache on auriga: `kyutai/tts-1.6b-en_fr`, plus voices fetched on demand from
  `kyutai/tts-voices`.

QA on auriga (optional, but faster than the Mac):

```bash
ssh auriga 'cd ~/hairline-tts && venv-eval/bin/python worker/eval_cer.py <testset.json> runs/<name>/out out.json'
```

The test set files are named `<n>-<character>.wav`.

## ROCm notes / caveats

- The PyTorch wheel is the official `download.pytorch.org/whl/rocm7.2` build of torch 2.11.0 (it
  includes the gfx1201 kernels). bf16 matmul measures ~96 TFLOPS.
- `moshi` pins `torch<2.10`. It is installed with a uv override (`overrides.txt`) and works
  unchanged on 2.11.
- No ROCm workarounds were needed:
  - HIP graphs (moshi's `CUDAGraphed`) and the Triton kernels work;
  - attention uses PyTorch SDPA;
  - there is no `torch.compile` or flash-attn dependency.
- If a future driver update breaks graph capture, set `NO_CUDA_GRAPH=1` (it will be slower).
- `torchaudio` must come from the rocm7.2 index. A CUDA build gets pulled in by
  `pip install speechbrain` and fails with `libcudart.so.13`.
- auriga is also a desktop and ComfyUI box. If VRAM is tight, lower `--batch`. Check free VRAM with
  `cat /sys/class/drm/card1/device/mem_info_vram_used`.
- Candidate C (Fish S2 Pro) was not set up. It was dropped on request, and the worker rejects
  `model != "A"`.

## Chatterbox (engine=chatterbox speakers: Jo)

`auriga_cb.sh <jobs.json> <out_dir> [--name N] [--host H] [--t3 v3]` is called by `generate.py` for the speakers
whose `cast.json` entry has `"engine": "chatterbox"` (docs/voice.md §15). It uses `~/hairline-clone` on auriga, set up
for the cloning audition (`scripts/voice/clone/remote/setup_auriga.sh`: `venv-cb` = Chatterbox on torch ROCm,
`venv-qa` = transformers Whisper). It syncs `scripts/voice/clone/cb_worker.py` and `asr_remote.py` to
`~/hairline-clone/bin/`, the reference to `refs/game/<name>-<sha12>.wav`, and the jobs to `runs/game/<run>/`. It
generates the takes, transcribes them on auriga, and waits on auriga (not with a local `sleep`). Re-running it is safe.
