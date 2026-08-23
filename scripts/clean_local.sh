#!/usr/bin/env bash
# Deletes all items from the DescriptionMapping, TransactionMonth, and TransactionDescriptions
# tables, leaving the User table untouched. Requires the local DynamoDB emulator to be running.
set -euo pipefail

DYNAMO_ENDPOINT="http://localhost:8000"
DYNAMO_REGION="us-east-1"
TABLES=(DescriptionMapping TransactionMonth TransactionDescriptions)

export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local

command -v aws >/dev/null 2>&1 || { echo "error: aws CLI is required but was not found on PATH" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "error: jq is required but was not found on PATH" >&2; exit 1; }

clean_table() {
  local table_name="$1"
  local deleted=0

  if ! aws dynamodb describe-table --table-name "$table_name" \
      --endpoint-url "$DYNAMO_ENDPOINT" --region "$DYNAMO_REGION" >/dev/null 2>&1; then
    echo "Table \"$table_name\" does not exist, skipping."
    return 0
  fi

  while true; do
    local ids
    ids="$(aws dynamodb scan --table-name "$table_name" --projection-expression id \
      --endpoint-url "$DYNAMO_ENDPOINT" --region "$DYNAMO_REGION" \
      --query 'Items[].id.S' --output json)"

    local count
    count="$(echo "$ids" | jq 'length')"
    if [ "$count" -eq 0 ]; then
      break
    fi

    echo "$ids" | jq -c '_nwise(25)' 2>/dev/null | while read -r batch; do
      local requests
      requests="$(echo "$batch" | jq -c '{ ($tbl): map({DeleteRequest: {Key: {id: {S: .}}}}) }' --arg tbl "$table_name")"
      aws dynamodb batch-write-item --request-items "$requests" \
        --endpoint-url "$DYNAMO_ENDPOINT" --region "$DYNAMO_REGION" >/dev/null
    done

    deleted=$((deleted + count))
  done

  echo "Cleaned \"$table_name\" ($deleted item(s) deleted)."
}

for table in "${TABLES[@]}"; do
  clean_table "$table"
done
