#!/usr/bin/env bash
# Seeds the shared test login (testuser@example.com / TestPassword123!) with its default
# categories into the DynamoDB Local "User" table, if it doesn't already exist - shared between
# scripts/setup_local.sh (local dev) and the GitHub Actions functional-test job (UBE-18), so both
# seed the exact same login/categories from one place.
# Idempotent: safe to re-run, skips if the login already exists.
#
# Requires the "User" table to already exist (see scripts/create_dynamodb_tables.sh) and the aws
# CLI, jq, and htpasswd to be on PATH.
# Endpoint/region default to match Api/appsettings.Local.json; override via env vars if needed.
#
# Usage: scripts/seed_test_login.sh
set -euo pipefail

DYNAMO_ENDPOINT="${DYNAMO_ENDPOINT:-http://localhost:8000}"
DYNAMO_REGION="${DYNAMO_REGION:-us-east-1}"
TEST_EMAIL="testuser@example.com"
TEST_PASSWORD="TestPassword123!"

export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local

command -v aws >/dev/null 2>&1 || { echo "error: aws CLI is required but was not found on PATH" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "error: jq is required but was not found on PATH" >&2; exit 1; }
command -v htpasswd >/dev/null 2>&1 || { echo "error: htpasswd is required but was not found on PATH" >&2; exit 1; }

if aws dynamodb get-item --table-name User --key "{\"id\":{\"S\":\"$TEST_EMAIL\"}}" \
     --endpoint-url "$DYNAMO_ENDPOINT" --region "$DYNAMO_REGION" 2>/dev/null | jq -e '.Item' >/dev/null 2>&1; then
  echo "Test login \"$TEST_EMAIL\" already exists, skipping."
  exit 0
fi

password_hash="$(htpasswd -bnBC 10 "$TEST_EMAIL" "$TEST_PASSWORD" | cut -d: -f2)"

# Type set "based on the original meaning" (UBE-75): every spend category is an Expense; Income
# is Income; Internal Transfer is the Ignore type (UBE-76) so its transactions still drop out of
# dashboard sums once stamped, replacing the old hardcoded category-name check.
default_categories='[
  {"Name": "Housing", "Colour": "#2a78d6", "Type": "Expense"},
  {"Name": "Groceries", "Colour": "#eb6834", "Type": "Expense"},
  {"Name": "Transport", "Colour": "#1baf7a", "Type": "Expense"},
  {"Name": "Dining", "Colour": "#eda100", "Type": "Expense"},
  {"Name": "Shopping", "Colour": "#e87ba4", "Type": "Expense"},
  {"Name": "Utilities", "Colour": "#008300", "Type": "Expense"},
  {"Name": "Entertainment", "Colour": "#4a3aa7", "Type": "Expense"},
  {"Name": "Medical", "Colour": "#0891b2", "Type": "Expense"},
  {"Name": "Subscriptions", "Colour": "#c026d3", "Type": "Expense"},
  {"Name": "Income", "Colour": "#0f766e", "Type": "Income"},
  {"Name": "Other", "Colour": "#e34948", "Type": "Expense"},
  {"Name": "Internal Transfer", "Colour": "#6b7280", "Type": "Ignore"}
]'

# A fresh user with no MinTransactionDate makes GetTransactionsAsync's null-startDate fallback
# (used by account/category deletion cascades and description-mapping bulk-apply) return no
# transactions at all until their first upload sets it - seeding a far-past date here avoids
# that cold-start gap for local dev/testing.
user_data="$(jq -nc --arg email "$TEST_EMAIL" --arg hash "$password_hash" --argjson categories "$default_categories" \
  '{Email: $email, PasswordHash: $hash, Accounts: [], Categories: $categories, MinTransactionDate: "2020-01-01"}')"
item="$(jq -nc --arg id "$TEST_EMAIL" --arg data "$user_data" \
  '{id: {S: $id}, data: {S: $data}}')"

aws dynamodb put-item --table-name User --item "$item" \
  --endpoint-url "$DYNAMO_ENDPOINT" --region "$DYNAMO_REGION"
echo "Inserted test login \"$TEST_EMAIL\"."
echo "Test login: $TEST_EMAIL / $TEST_PASSWORD"
