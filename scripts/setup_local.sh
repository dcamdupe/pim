#!/usr/bin/env bash
# Starts (or reuses) the local DynamoDB Local emulator, creates the User, TransactionMonth,
# UniqueDescriptions, and CreditDescriptionMapping tables if they don't already exist, and
# seeds a test login for the
# Login API (UBE-10) - also copies the local FrontEnd .env template into place (UBE-26),
# and sets ASPNETCORE_ENVIRONMENT=Local for the Api (UBE-23).
# Safe to re-run: reuses an already-running/existing container, skips table creation
# and the login insert if they already exist (the .env copy always overwrites, to keep
# FrontEnd/.env in sync with the template).
#
# Must be sourced, not executed, for the ASPNETCORE_ENVIRONMENT export to
# persist in your shell - works from bash or zsh:
#   source scripts/setup_local.sh

create_table_if_missing() {
  local table_name="$1"
  local dynamo_endpoint="$2"
  local dynamo_region="$3"

  if AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local \
     aws dynamodb describe-table --table-name "$table_name" --endpoint-url "$dynamo_endpoint" --region "$dynamo_region" >/dev/null 2>&1; then
    return 0
  fi

  echo "Creating DynamoDB Local \"$table_name\" table..."
  AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local \
    aws dynamodb create-table \
      --table-name "$table_name" \
      --attribute-definitions AttributeName=id,AttributeType=S \
      --key-schema AttributeName=id,KeyType=HASH \
      --billing-mode PAY_PER_REQUEST \
      --endpoint-url "$dynamo_endpoint" \
      --region "$dynamo_region" >/dev/null
}

setup_local() {
  local repo_root
  repo_root="$(git rev-parse --show-toplevel)" || return 1

  cp "$repo_root/FrontEnd/.env.local" "$repo_root/FrontEnd/.env" || return 1
  echo "Copied FrontEnd/.env.local to FrontEnd/.env."

  command -v docker >/dev/null 2>&1 || { echo "error: docker is required but was not found on PATH" >&2; return 1; }
  command -v aws >/dev/null 2>&1 || { echo "error: aws CLI is required but was not found on PATH" >&2; return 1; }
  command -v jq >/dev/null 2>&1 || { echo "error: jq is required but was not found on PATH" >&2; return 1; }
  command -v htpasswd >/dev/null 2>&1 || { echo "error: htpasswd is required but was not found on PATH" >&2; return 1; }

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

  local attempt
  for attempt in $(seq 1 30); do
    AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local \
      aws dynamodb list-tables --endpoint-url "$dynamo_endpoint" --region "$dynamo_region" >/dev/null 2>&1 && break
    if [ "$attempt" -eq 30 ]; then
      echo "error: dynamodb-local did not become ready on $dynamo_endpoint" >&2
      return 1
    fi
    sleep 1
  done

  create_table_if_missing User "$dynamo_endpoint" "$dynamo_region" || return 1
  create_table_if_missing TransactionMonth "$dynamo_endpoint" "$dynamo_region" || return 1
  create_table_if_missing UniqueDescriptions "$dynamo_endpoint" "$dynamo_region" || return 1
  create_table_if_missing CreditDescriptionMapping "$dynamo_endpoint" "$dynamo_region" || return 1

  local test_email="testuser@example.com"
  local test_password="TestPassword123!"

  local password_hash
  password_hash="$(htpasswd -bnBC 10 "$test_email" "$test_password" | cut -d: -f2)" || return 1

  if AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local \
     aws dynamodb get-item --table-name User --key "{\"id\":{\"S\":\"$test_email\"}}" \
       --endpoint-url "$dynamo_endpoint" --region "$dynamo_region" 2>/dev/null | jq -e '.Item' >/dev/null 2>&1; then
    echo "Test login \"$test_email\" already exists, skipping."
  else
    local user_data item
    user_data="$(jq -nc --arg email "$test_email" --arg hash "$password_hash" \
      '{Email: $email, PasswordHash: $hash, Accounts: []}')"
    item="$(jq -nc --arg id "$test_email" --arg data "$user_data" \
      '{id: {S: $id}, data: {S: $data}}')"

    AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local \
      aws dynamodb put-item --table-name User --item "$item" \
        --endpoint-url "$dynamo_endpoint" --region "$dynamo_region" || return 1
    echo "Inserted test login \"$test_email\"."
  fi

  echo "Test login: $test_email / $test_password"
}

if setup_local; then
  export ASPNETCORE_ENVIRONMENT=Local
  echo "Set ASPNETCORE_ENVIRONMENT=Local"
else
  echo "setup_local.sh failed - ASPNETCORE_ENVIRONMENT was not set" >&2
fi
unset -f setup_local
unset -f create_table_if_missing

if (return 0 2>/dev/null); then
  : # sourced - the export above will persist in this shell
else
  echo "warning: run this with 'source scripts/setup_local.sh', not directly - otherwise the ASPNETCORE_ENVIRONMENT export above doesn't persist in your shell" >&2
fi
