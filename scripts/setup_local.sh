#!/usr/bin/env bash
# Starts (or reuses) the local DynamoDB Local emulator, creates its tables via
# scripts/create_dynamodb_tables.sh, and seeds a test login via scripts/seed_test_login.sh (both
# shared with the CI jobs added in UBE-17/UBE-18) - also copies the local FrontEnd .env template
# into place (UBE-26), and sets ASPNETCORE_ENVIRONMENT=Local for the Api (UBE-23).
# Safe to re-run: reuses an already-running/existing container, skips table creation
# and the login insert if they already exist (the .env copy always overwrites, to keep
# FrontEnd/.env in sync with the template).
#
# Requires docker, the aws CLI, jq, and htpasswd on PATH (jq/htpasswd used by
# seed_test_login.sh).
#
# Must be sourced, not executed, for the ASPNETCORE_ENVIRONMENT export to
# persist in your shell - works from bash or zsh:
#   source scripts/setup_local.sh

setup_local() {
  local repo_root
  repo_root="$(git rev-parse --show-toplevel)" || return 1

  cp "$repo_root/FrontEnd/.env.local" "$repo_root/FrontEnd/.env" || return 1
  echo "Copied FrontEnd/.env.local to FrontEnd/.env."

  command -v docker >/dev/null 2>&1 || { echo "error: docker is required but was not found on PATH" >&2; return 1; }
  command -v aws >/dev/null 2>&1 || { echo "error: aws CLI is required but was not found on PATH" >&2; return 1; }

  local dynamo_container="dynamodb-local"
  local dynamo_port=8000
  local dynamo_endpoint="http://localhost:${dynamo_port}"
  local dynamo_region="us-east-1"

  if docker ps --filter "name=^${dynamo_container}$" --filter "status=running" --format '{{.Names}}' | grep -qx "$dynamo_container"; then
    echo "dynamodb-local already running."
  elif docker ps -a --filter "name=^${dynamo_container}$" --format '{{.Names}}' | grep -qx "$dynamo_container"; then
    echo "Starting existing dynamodb-local container..."
    docker start "$dynamo_container" >/dev/null || return 1
  else
    echo "Starting dynamodb-local container..."
    docker run -d --name "$dynamo_container" -p "${dynamo_port}:8000" amazon/dynamodb-local:latest \
      -jar DynamoDBLocal.jar -sharedDb -inMemory >/dev/null || return 1
  fi

  DYNAMO_ENDPOINT="$dynamo_endpoint" DYNAMO_REGION="$dynamo_region" \
    "$repo_root/scripts/create_dynamodb_tables.sh" || return 1

  DYNAMO_ENDPOINT="$dynamo_endpoint" DYNAMO_REGION="$dynamo_region" \
    "$repo_root/scripts/seed_test_login.sh" || return 1
}

if setup_local; then
  export ASPNETCORE_ENVIRONMENT=Local
  echo "Set ASPNETCORE_ENVIRONMENT=Local"
else
  echo "setup_local.sh failed - ASPNETCORE_ENVIRONMENT was not set" >&2
fi
unset -f setup_local

if (return 0 2>/dev/null); then
  : # sourced - the export above will persist in this shell
else
  echo "warning: run this with 'source scripts/setup_local.sh', not directly - otherwise the ASPNETCORE_ENVIRONMENT export above doesn't persist in your shell" >&2
fi
