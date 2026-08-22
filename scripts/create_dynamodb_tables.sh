#!/usr/bin/env bash
# Creates the DynamoDB Local tables the Api needs (User, TransactionMonth,
# TransactionDescriptions, DescriptionMapping) if they don't already exist - shared between
# scripts/setup_local.sh (local dev) and the GitHub Actions integration-test job (UBE-17), so both
# provision the exact same schema from one place.
# Idempotent: safe to re-run, skips any table that already exists.
#
# Waits up to 30s for DynamoDB Local to become reachable at DYNAMO_ENDPOINT before creating tables.
# Endpoint/region default to match Api/appsettings.Local.json; override via env vars if needed.
#
# Usage: scripts/create_dynamodb_tables.sh
set -euo pipefail

DYNAMO_ENDPOINT="${DYNAMO_ENDPOINT:-http://localhost:8000}"
DYNAMO_REGION="${DYNAMO_REGION:-us-east-1}"
TABLES=(User TransactionMonth TransactionDescriptions DescriptionMapping)

export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local

command -v aws >/dev/null 2>&1 || { echo "error: aws CLI is required but was not found on PATH" >&2; exit 1; }

for attempt in $(seq 1 30); do
  aws dynamodb list-tables --endpoint-url "$DYNAMO_ENDPOINT" --region "$DYNAMO_REGION" >/dev/null 2>&1 && break
  if [ "$attempt" -eq 30 ]; then
    echo "error: dynamodb-local did not become ready on $DYNAMO_ENDPOINT" >&2
    exit 1
  fi
  sleep 1
done

for table_name in "${TABLES[@]}"; do
  if aws dynamodb describe-table --table-name "$table_name" --endpoint-url "$DYNAMO_ENDPOINT" --region "$DYNAMO_REGION" >/dev/null 2>&1; then
    echo "Table \"$table_name\" already exists, skipping."
    continue
  fi

  echo "Creating DynamoDB Local \"$table_name\" table..."
  aws dynamodb create-table \
    --table-name "$table_name" \
    --attribute-definitions AttributeName=id,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --endpoint-url "$DYNAMO_ENDPOINT" \
    --region "$DYNAMO_REGION" >/dev/null
done
