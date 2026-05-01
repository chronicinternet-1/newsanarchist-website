#!/usr/bin/env bash
# cron-runner.sh — Priority-aware cron job runner with concurrency limit.
#
# Prevents memory crashes by ensuring only MAX_PARALLEL jobs run at once.
# Higher-priority jobs always get a slot; lower-priority ones back off.
#
# Usage (in crontab):
#   0 */6 * * *  ~/.openclaw/scripts/cron-runner.sh 1 newsanarchist "node ~/.openclaw/workspace/scripts/newsanarchist-content.mjs"
#   5 */6 * * *  ~/.openclaw/scripts/cron-runner.sh 2 crosspost     "node ~/newsanarchist-website/scripts/crosspost.mjs"
#   10 */6 * * * ~/.openclaw/scripts/cron-runner.sh 3 backfill      "node ~/newsanarchist-website/scripts/backfill-images.mjs"
#   15 */6 * * * ~/.openclaw/scripts/cron-runner.sh 3 blog          "node ~/.openclaw/workspace/scripts/generate-blog-posts.mjs"
#   0  7  * * *  ~/.openclaw/scripts/cron-runner.sh 4 pnl-report    "node ~/newsanarchist-website/scripts/daily-pnl-report.mjs"
#   */15 * * * * ~/.openclaw/scripts/cron-runner.sh 1 watchdog      "node ~/newsanarchist-website/scripts/watchdog.mjs"
#
# Arguments:
#   $1  PRIORITY   — 1 (highest) to 5 (lowest). Priority 1 always runs.
#   $2  JOB_NAME   — unique name for this job (used for lock file)
#   $3  COMMAND    — the command to run (quote it)

set -euo pipefail

PRIORITY="${1:?Usage: cron-runner.sh <priority 1-5> <job-name> <command>}"
JOB_NAME="${2:?}"
COMMAND="${3:?}"

MAX_PARALLEL=2          # max jobs running at once (tune for your VPS RAM)
LOCK_DIR="/tmp/cron-locks"
LOG_DIR="${HOME}/.openclaw/logs"
LOG_FILE="${LOG_DIR}/cron-runner.log"

mkdir -p "$LOCK_DIR" "$LOG_DIR"

# ── Logging ───────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$JOB_NAME] $*" | tee -a "$LOG_FILE"; }

# ── Lock file for this job ────────────────────────────────────────────────────
LOCK_FILE="${LOCK_DIR}/${JOB_NAME}.lock"

# Clean up stale locks (process no longer running)
if [[ -f "$LOCK_FILE" ]]; then
  OLD_PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
  if [[ -n "$OLD_PID" ]] && ! kill -0 "$OLD_PID" 2>/dev/null; then
    log "Removing stale lock (PID $OLD_PID no longer running)"
    rm -f "$LOCK_FILE"
  else
    log "Already running (PID $OLD_PID) — skipping"
    exit 0
  fi
fi

# ── Concurrency check ─────────────────────────────────────────────────────────
count_running() {
  local count=0
  for lf in "$LOCK_DIR"/*.lock; do
    [[ -f "$lf" ]] || continue
    local pid
    pid=$(cat "$lf" 2>/dev/null || echo "")
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      (( count++ )) || true
    else
      rm -f "$lf"   # clean stale lock opportunistically
    fi
  done
  echo "$count"
}

RUNNING=$(count_running)

if (( RUNNING >= MAX_PARALLEL )); then
  if (( PRIORITY == 1 )); then
    # Priority 1 always runs — find lowest-priority running job and note it
    log "WARN: At limit ($RUNNING/$MAX_PARALLEL) but priority=1, proceeding anyway"
  else
    log "Concurrency limit reached ($RUNNING/$MAX_PARALLEL running), priority=$PRIORITY — skipping this run"
    exit 0
  fi
fi

# ── Acquire lock and run ──────────────────────────────────────────────────────
echo $$ > "$LOCK_FILE"
log "Starting (priority=$PRIORITY, slot $(( RUNNING + 1 ))/$MAX_PARALLEL)"

JOB_LOG="${LOG_DIR}/${JOB_NAME}.log"

cleanup() {
  rm -f "$LOCK_FILE"
  log "Finished (exit $?)"
}
trap cleanup EXIT

START=$(date +%s)
eval "$COMMAND" >> "$JOB_LOG" 2>&1
EXIT_CODE=$?
ELAPSED=$(( $(date +%s) - START ))

if (( EXIT_CODE == 0 )); then
  log "OK — completed in ${ELAPSED}s"
else
  log "ERROR — exit code $EXIT_CODE after ${ELAPSED}s (see $JOB_LOG)"
fi

exit $EXIT_CODE
