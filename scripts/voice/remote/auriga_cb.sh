#!/usr/bin/env bash
# Chatterbox Multilingual takes for the engine=chatterbox speakers of generate.py (Jo), on auriga, plus their
# Whisper transcripts (also on auriga), then fetch both. Called by generate.py's chatterbox worker.
#
# usage: scripts/voice/remote/auriga_cb.sh <jobs.json> <local_out_dir> [--name NAME] [--host HOST] [--t3 v3]
#   jobs.json: scripts/voice/clone/cb_worker.py jobs, except that "refLocal" (the reference wav on this Mac) replaces
#   "ref". Each reference is synced to auriga:~/hairline-clone/refs/game/<basename> and the job pointed at it.
#   Output: <local_out_dir>/<key>.t0.wav ... (24 kHz mono) and <local_out_dir>/asr.json {"<file>": transcript}.
# Remote: ~/hairline-clone (venv-cb: Chatterbox, torch ROCm; venv-qa: transformers Whisper), run dir
# runs/game/<NAME>. Re-running the same command is safe: existing takes / transcripts are skipped, a run still in
# progress is joined (flock), the rsync back is incremental.
set -euo pipefail

HOST=auriga NAME="" T3=v3
POS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) NAME="$2"; shift 2 ;;
    --host) HOST="$2"; shift 2 ;;
    --t3) T3="$2"; shift 2 ;;
    -h|--help) sed -n 2,12p "$0"; exit 0 ;;
    *) POS+=("$1"); shift ;;
  esac
done
[[ ${#POS[@]} -eq 2 ]] || { sed -n 2,12p "$0" >&2; exit 2; }
JOBS="${POS[0]}" OUT="${POS[1]}"
[[ -f "$JOBS" ]] || { echo "no such jobs file: $JOBS" >&2; exit 2; }
NAME="${NAME:-$(basename "$JOBS" .json)}"
HERE="$(cd "$(dirname "$0")" && pwd)"
RROOT="hairline-clone"          # relative to remote $HOME
RRUN="runs/game/$NAME"          # relative to $RROOT
mkdir -p "$OUT"

# 1. Validate the jobs; stage the references under their base names.
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
python3 - "$JOBS" "$STAGE" <<'PY'
import json, os, shutil, sys
jobs = json.load(open(sys.argv[1]))
stage = sys.argv[2]
os.makedirs(f"{stage}/refs", exist_ok=True)
keys = set()
for j in jobs:
    for f in ("key", "text", "refLocal"):
        assert j.get(f), f"job missing {f}: {j}"
    assert j["key"] not in keys and "/" not in j["key"], f"bad or duplicate key {j['key']}"
    keys.add(j["key"])
    src = j.pop("refLocal")
    base = os.path.basename(src)
    shutil.copy(src, f"{stage}/refs/{base}")
    j["ref"] = "refs/game/" + base
json.dump(jobs, open(f"{stage}/jobs.json", "w"), ensure_ascii=False, indent=1)
print(f"{len(jobs)} jobs, {sum(int(j.get('takes', 1)) for j in jobs)} takes")
PY

# 2. Sync the worker code, the references and the jobs.
ssh "$HOST" "mkdir -p $RROOT/bin $RROOT/refs/game $RROOT/$RRUN/out"
rsync -a "$HERE/../clone/cb_worker.py" "$HERE/asr_remote.py" "$HOST:$RROOT/bin/"
rsync -a "$STAGE/refs/" "$HOST:$RROOT/refs/game/"
rsync -a "$STAGE/jobs.json" "$HOST:$RROOT/$RRUN/jobs.json"

# 3. Start (or join) the run, detached from this ssh session: generation, then Whisper on the takes.
ssh "$HOST" "cd $RROOT && if flock -n $RRUN/.lock true; then rm -f $RRUN/status;
    setsid nohup flock $RRUN/.lock bash -c 'echo RUNNING > $RRUN/status;
      nice -n 10 venv-cb/bin/python bin/cb_worker.py $RRUN/jobs.json $RRUN/out --t3 $T3 &&
      nice -n 10 venv-qa/bin/python bin/asr_remote.py $RRUN/out $RRUN/out/asr.json &&
      echo DONE > $RRUN/status || echo FAILED > $RRUN/status' > $RRUN/run.log 2>&1 < /dev/null &
    echo started chatterbox run $NAME on \$(hostname)
  else echo run $NAME already in progress, joining; fi"

# 4. Wait on auriga (not with a local sleep: macOS timer coalescing can hold it for minutes), fetching as we go.
fetch() { rsync -a --exclude '*.tmp.wav' "$HOST:$RROOT/$RRUN/out/" "$OUT/"; }
rwait() { ssh "$HOST" "cd $RROOT/$RRUN 2>/dev/null || exit 0; for i in \$(seq 1 $1); do grep -qE '^(DONE|FAILED)' status 2>/dev/null && break; sleep 1; done" || true; }
rwait 5
while :; do
  st="$(ssh "$HOST" "cat $RROOT/$RRUN/status 2>/dev/null; tail -n 1 $RROOT/$RRUN/run.log 2>/dev/null" | tr '\n' ' ' || echo "ssh-error")"
  fetch >/dev/null 2>&1 || true
  echo "$(date +%H:%M:%S) $st| local wavs: $(ls "$OUT"/*.wav 2>/dev/null | wc -l | tr -d ' ')"
  case "$st" in
    DONE*) fetch; exit 0 ;;
    FAILED*) fetch; ssh "$HOST" "tail -n 20 $RROOT/$RRUN/run.log" >&2; echo "remote run failed; re-run to resume" >&2; exit 1 ;;
  esac
  rwait 30
done
