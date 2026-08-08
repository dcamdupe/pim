#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PI_HOST="pi@192.168.68.51"
IMAGE="downloader:latest"
CONTROL_SOCKET="$(mktemp -u)"

# Single SSH connection, reused (and password-prompted) once for both steps below. Also wipes
# the plaintext .env decrypted below, so it doesn't linger on disk past this script's run.
cleanup() {
  rm -f .env
  ssh -o ControlPath="$CONTROL_SOCKET" -O exit "$PI_HOST" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Decrypting .env..."
./decrypt-env.sh

echo "Building image for linux/arm64..."
docker buildx build --platform linux/arm64 -t "$IMAGE" --load .

echo "Connecting to $PI_HOST..."
ssh -o ControlMaster=auto -o ControlPath="$CONTROL_SOCKET" -o ControlPersist=5m "$PI_HOST" true

echo "Transferring image to the Pi..."
docker save "$IMAGE" | ssh -o ControlPath="$CONTROL_SOCKET" "$PI_HOST" docker load

echo "Done: $IMAGE is loaded on $PI_HOST."
