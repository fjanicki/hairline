#!/usr/bin/env bash
# Run Kyutai TTS (candidate A) generation on auriga (RX 9070 XT, ROCm) and fetch the WAVs.
#
# usage: scripts/voice/remote/auriga_gen.sh <jobs.json> <local_out_dir> [options]
#   --name NAME     remote run name (default: basename of jobs.json without .json)
#   --batch N       items per GPU batch (default 32; ~9.4 GB VRAM)
#   --procs P       generator processes sharing the GPU (default 1; 2 only with --batch <=16)
#   --detach        start (or resume) the remote run and return immediately
#   --fetch         only rsync back what exists so far (no launch)
#   --status        print remote status + progress and exit
#   --host HOST     ssh host (default auriga)
# Re-running the same command is safe: the remote side skips keys whose WAV exists, a run that is
# still in progress is not started twice (flock), and the rsync back is incremental.
set -euo pipefail

HOST=auriga BATCH=32 PROCS=1 MODE=run NAME=""
POS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) NAME="$2"; shift 2 ;;
    --batch) BATCH="$2"; shift 2 ;;
    --procs) PROCS="$2"; shift 2 ;;
    --host) HOST="$2"; shift 2 ;;
    --detach) MODE=detach; shift ;;
    --fetch) MODE=fetch; shift ;;
    --status) MODE=status; shift ;;
    -h|--help) sed -n 2,16p "$0"; exit 0 ;;
    *) POS+=("$1"); shift ;;
  esac
done
[[ ${#POS[@]} -eq 2 ]] || { sed -n 2,16p "$0" >&2; exit 2; }
JOBS="${POS[0]}" OUT="${POS[1]}"
[[ -f "$JOBS" ]] || { echo "no such jobs file: $JOBS" >&2; exit 2; }
NAME="${NAME:-$(basename "$JOBS" .json)}"
HERE="$(cd "$(dirname "$0")" && pwd)"
RROOT="hairline-tts"            # relative to remote $HOME
RRUN="$RROOT/runs/$NAME"
mkdir -p "$OUT"

status() {
  ssh "$HOST" "cd $RRUN 2>/dev/null || { echo 'no remote run $NAME'; exit 0; }
    echo \"status: \$(cat status 2>/dev/null || echo none)\"
    echo \"wavs:   \$(ls out/*.wav 2>/dev/null | grep -vc tmp.wav)\"
    tail -n 2 gen_*.log 2>/dev/null | grep -v '^\$' | tail -n 4"
}
fetch() {
  rsync -a --exclude '*.tmp.wav' "$HOST:$RRUN/out/" "$OUT/"
  scp -q "$HOST:$RRUN/status" "$OUT/_auriga_status.txt" 2>/dev/null || true
  echo "fetched $(ls "$OUT"/*.wav 2>/dev/null | wc -l | tr -d ' ') wavs into $OUT"
}

case "$MODE" in
  status) status; exit 0 ;;
  fetch) fetch; exit 0 ;;
esac

# 1. Validate jobs, collect local voice embeddings (.safetensors paths on this Mac) to upload.
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
python3 - "$JOBS" "$STAGE" <<'PY'
import json, os, shutil, sys
jobs_p, stage = sys.argv[1], sys.argv[2]
jobs = json.load(open(jobs_p))
assert isinstance(jobs, list), "jobs.json must be a list"
keys = set()
os.makedirs(f"{stage}/voices", exist_ok=True)
for j in jobs:
    for f in ("key", "text"):
        assert j.get(f), f"job missing {f}: {j}"
    assert j.get("model", "A") == "A", f"only model A is supported on auriga: {j['key']}"
    assert j["key"] not in keys, f"duplicate key {j['key']}"
    assert "/" not in j["key"], f"key must be a file name: {j['key']}"
    keys.add(j["key"])
    assert j.get("voice") or j.get("speaker"), f"job needs speaker or voice: {j['key']}"
    v = j.get("voice")
    if v and os.path.isfile(os.path.expanduser(v)):        # local embedding -> upload
        assert v.endswith(".safetensors"), f"local voice must be a .safetensors embedding: {v}"
        dst = os.path.basename(v)
        shutil.copy(os.path.expanduser(v), f"{stage}/voices/{dst}")
        j["voice"] = "@RUN@/voices/" + dst
json.dump(jobs, open(f"{stage}/jobs.json", "w"), ensure_ascii=False, indent=1)
print(f"{len(jobs)} jobs, {sum(int(j.get('takes', 1)) for j in jobs)} wavs")
PY

# 2. Sync worker code + jobs (+ uploaded voices) to auriga.
ssh "$HOST" "mkdir -p $RROOT/worker $RRUN/out $RRUN/voices"
rsync -a "$HERE/auriga/" "$HOST:$RROOT/worker/"
RHOME="$(ssh "$HOST" 'echo $HOME')"
sed -i '' "s#@RUN@#$RHOME/$RRUN#g" "$STAGE/jobs.json"
rsync -a "$STAGE/jobs.json" "$HOST:$RRUN/jobs.json"
rsync -a "$STAGE/voices/" "$HOST:$RRUN/voices/"

# 3. Start (or join) the remote run, detached from this ssh session.
ssh "$HOST" "cd $RRUN && if flock -n .lock true; then
    setsid nohup bash \$HOME/$RROOT/worker/run_jobs.sh '$NAME' $BATCH $PROCS > run.log 2>&1 < /dev/null &
    echo started run $NAME on \$(hostname) batch=$BATCH procs=$PROCS
  else echo run $NAME already in progress, joining; fi"

[[ "$MODE" == detach ]] && { echo "detached; later: $0 $JOBS $OUT [--status|--fetch]"; exit 0; }

# 4. Wait, fetching incrementally, until DONE/FAILED.
# The waiting happens on auriga (rwait), not in a local `sleep`: a local sleep in a background job on the Mac can be
# held for 10-15 minutes by macOS timer coalescing (seen 2026-10-09: `sleep 30` alive for 15 min).
rwait() { ssh "$HOST" "cd $RRUN 2>/dev/null || exit 0; for i in \$(seq 1 $1); do grep -qE '^(DONE|FAILED)' status 2>/dev/null && break; sleep 1; done" || true; }
rwait 5
while :; do
  st="$(ssh "$HOST" "cat $RRUN/status 2>/dev/null" || echo "ssh-error")"
  fetch >/dev/null 2>&1 || true
  echo "$(date +%H:%M:%S) $st | local wavs: $(ls "$OUT"/*.wav 2>/dev/null | wc -l | tr -d ' ')"
  case "$st" in
    DONE*) fetch; exit 0 ;;
    FAILED*) fetch; status; echo "remote run failed; re-run the same command to resume" >&2; exit 1 ;;
  esac
  rwait 30
done
