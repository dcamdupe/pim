#!/usr/bin/env bash
# Stops the local dev stack (Api + FrontEnd) started by scripts/run_local.sh, for when it was
# started in the background (e.g. run_in_background) rather than via Ctrl+C in its own terminal.
# Safe to re-run: reports "not running" for any port with nothing bound to it.
set -euo pipefail

API_HTTPS_PORT=7010
FRONTEND_PORT=5173

kill_port() {
  local port="$1"
  local name="$2"
  local pids
  pids="$(lsof -ti "tcp:$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "Stopping $name (port $port): $pids"
    kill -9 $pids 2>/dev/null || true
  else
    echo "$name (port $port) not running."
  fi
}

kill_port "$API_HTTPS_PORT" "Api"
kill_port "$FRONTEND_PORT" "FrontEnd"
