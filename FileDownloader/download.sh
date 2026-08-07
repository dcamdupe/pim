#!/usr/bin/env bash
# Runs the Westpac transaction export for 1 Aug 2026 - 5 Aug 2026.
# Requires WestpacCustomerId/WestpacPassword/WestpacAccount in FileDownloader/.env (see .env).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

StartDate="01/08/2026" EndDate="05/08/2026" npx tsx download.ts
