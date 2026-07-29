#!/usr/bin/env bash
# Builds and starts the whole local dev stack (Api + FrontEnd) in one
# terminal. Kills anything already bound to their ports first, so it's
# always safe to re-run - no manual cleanup needed if a previous run wasn't
# stopped cleanly. Ctrl+C stops both.
#
# Requires `source scripts/setup_local.sh` already done at least once (starts the local
# DynamoDB emulator, seeds the test login, creates FrontEnd/.env).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

API_HTTPS_PORT=7010
FRONTEND_PORT=5173

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti "tcp:$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "Killing existing process(es) on port $port: $pids"
    kill -9 $pids 2>/dev/null || true
  fi
}

cleanup() {
  echo
  echo "Stopping..."
  kill_port "$API_HTTPS_PORT"
  kill_port "$FRONTEND_PORT"
}
trap cleanup EXIT

kill_port "$API_HTTPS_PORT"
kill_port "$FRONTEND_PORT"

# This machine's nvm defaults to a very old Node (v11) - too old for Vite.
# Switch to 22 if nvm is available; harmless no-op otherwise (e.g. node is
# already on PATH at a suitable version some other way).
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh"
  nvm use 22
fi

echo "Building Api..."
dotnet build "$REPO_ROOT/Api/Pim.Api.csproj"

if [ ! -d "$REPO_ROOT/FrontEnd/node_modules" ]; then
  echo "Installing FrontEnd dependencies..."
  (cd "$REPO_ROOT/FrontEnd" && npm install)
fi

echo "Starting Api on https://localhost:$API_HTTPS_PORT ..."
(cd "$REPO_ROOT" && dotnet run --project Api --urls "https://localhost:$API_HTTPS_PORT") &

echo "Starting FrontEnd on http://localhost:$FRONTEND_PORT ..."
(cd "$REPO_ROOT/FrontEnd" && npm run dev) &

echo
echo "Api:      https://localhost:$API_HTTPS_PORT"
echo "FrontEnd: http://localhost:$FRONTEND_PORT"
echo "Press Ctrl+C to stop both."

wait
