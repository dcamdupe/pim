#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# dd/MM/yyyy - end date is today, start date 5 days earlier.
EndDate="$(date +%d/%m/%Y)"
StartDate="$(date -v-5d +%d/%m/%Y)"

StartDate="$StartDate" EndDate="$EndDate" npx tsx download.ts
