#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE=".env"
ENCRYPTED_FILE=".env.age"

rm -f "$ENCRYPTED_FILE"
age -p -o "$ENCRYPTED_FILE" "$ENV_FILE"

echo "Encrypted $ENV_FILE -> $ENCRYPTED_FILE"
