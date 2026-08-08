#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE=".env"
ENCRYPTED_FILE=".env.age"

rm -f "$ENV_FILE"
age -d -o "$ENV_FILE" "$ENCRYPTED_FILE"

echo "Decrypted $ENCRYPTED_FILE -> $ENV_FILE"
