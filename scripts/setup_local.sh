#!/usr/bin/env bash
# Seeds the local MongoDB instance with a test login for the Login API (UBE-10),
# and copies the local FrontEnd .env template into place (UBE-26).
# Safe to re-run: skips the login insert if it already exists (the .env copy
# always overwrites, to keep FrontEnd/.env in sync with the template).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cp "$REPO_ROOT/FrontEnd/.env.local" "$REPO_ROOT/FrontEnd/.env"
echo "Copied FrontEnd/.env.local to FrontEnd/.env."

MONGO_URI="${MONGO_URI:-mongodb://localhost:27017}"
MONGO_DB="${MONGO_DB:-pim}"
TEST_EMAIL="testuser@example.com"
TEST_PASSWORD="TestPassword123!"

command -v mongosh >/dev/null 2>&1 || { echo "error: mongosh is required but was not found on PATH" >&2; exit 1; }
command -v htpasswd >/dev/null 2>&1 || { echo "error: htpasswd is required but was not found on PATH" >&2; exit 1; }

PASSWORD_HASH="$(htpasswd -bnBC 10 "$TEST_EMAIL" "$TEST_PASSWORD" | cut -d: -f2)"

TEST_EMAIL="$TEST_EMAIL" PASSWORD_HASH="$PASSWORD_HASH" \
  mongosh "$MONGO_URI/$MONGO_DB" --quiet --eval '
    const email = process.env.TEST_EMAIL;
    const existing = db.User.findOne({ _id: email });
    if (existing) {
      print("Test login \"" + email + "\" already exists, skipping.");
    } else {
      db.User.insertOne({ _id: email, PasswordHash: process.env.PASSWORD_HASH });
      print("Inserted test login \"" + email + "\".");
    }
  '

echo "Test login: $TEST_EMAIL / $TEST_PASSWORD"
