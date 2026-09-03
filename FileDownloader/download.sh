#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# dd/MM/yyyy - end date is today, start date 5 days earlier. BSD date (macOS, local dev) uses
# -v-5d; GNU date (this container's Linux base) uses -d '-5 days' - detect which one works.
EndDate="$(date +%d/%m/%Y)"
if date -v-5d +%d/%m/%Y >/dev/null 2>&1; then
  StartDate="$(date -v-5d +%d/%m/%Y)"
else
  StartDate="$(date -d '-20 days' +%d/%m/%Y)"
fi

StartDate="$StartDate" EndDate="$EndDate" npx tsx download.ts
