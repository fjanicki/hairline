#!/usr/bin/env bash
# Remote side (runs on auriga). Started by auriga_gen.sh under nohup/setsid.
# usage: run_jobs.sh <run_name> [batch=32] [procs=1]
# Layout: ~/hairline-tts/runs/<run_name>/{jobs.json,out/,run.log,status}
set -u
ROOT="$HOME/hairline-tts"
RUN="$ROOT/runs/$1"
BATCH="${2:-32}"
PROCS="${3:-1}"
PY="$ROOT/venv-kyutai/bin/python"
cd "$RUN" || exit 2

exec 9>"$RUN/.lock"
if ! flock -n 9; then echo "run $1 already in progress" >&2; exit 3; fi

echo "RUNNING $(date -Is) pid=$$ batch=$BATCH procs=$PROCS" > status
rm -f DONE FAILED
export HF_HUB_OFFLINE="${HF_HUB_OFFLINE:-0}"
export PYTORCH_CUDA_ALLOC_CONF="${PYTORCH_CUDA_ALLOC_CONF:-expandable_segments:True}"
# ROCm notes: see README. hipBLASLt is fine on gfx1201 with torch 2.11+rocm7.2; CUDA(HIP) graphs on.
pids=()
for ((i = 0; i < PROCS; i++)); do
  nice -n 5 "$PY" "$ROOT/worker/kyutai_gen.py" jobs.json out --batch "$BATCH" --shard "$i/$PROCS" \
    >> "gen_$i.log" 2>&1 &
  pids+=($!)
done
rc=0
for p in "${pids[@]}"; do wait "$p" || rc=$?; done

n_jobs=$("$PY" -c "import json;print(sum(int(j.get('takes',1)) for j in json.load(open('jobs.json')) if j.get('model','A')=='A'))")
n_out=$(find out -maxdepth 1 -name '*.wav' ! -name '*.tmp.wav' | wc -l)
if [[ $rc -eq 0 && $n_out -ge $n_jobs ]]; then
  echo "DONE $(date -Is) wavs=$n_out/$n_jobs" | tee status > DONE
else
  echo "FAILED $(date -Is) rc=$rc wavs=$n_out/$n_jobs" | tee status > FAILED
fi
