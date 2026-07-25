#!/usr/bin/env bash
# Seeds the local MongoDB instance with a test login for the Login API (UBE-10).
# Safe to re-run: skips the insert if the test login already exists.
set -euo pipefail

MONGO_URI="${MONGO_URI:-mongodb://localhost:27017}"
MONGO_DB="${MONGO_DB:-pim}"
TEST_LOGIN="testuser"
TEST_PASSWORD="TestPassword123!"

command -v mongosh >/dev/null 2>&1 || { echo "error: mongosh is required but was not found on PATH" >&2; exit 1; }
command -v htpasswd >/dev/null 2>&1 || { echo "error: htpasswd is required but was not found on PATH" >&2; exit 1; }

PASSWORD_HASH="$(htpasswd -bnBC 10 "$TEST_LOGIN" "$TEST_PASSWORD" | cut -d: -f2)"

TEST_LOGIN="$TEST_LOGIN" PASSWORD_HASH="$PASSWORD_HASH" \
  mongosh "$MONGO_URI/$MONGO_DB" --quiet --eval '
    const login = process.env.TEST_LOGIN;
    const existing = db.User.findOne({ _id: login });
    if (existing) {
      print("Test login \"" + login + "\" already exists, skipping.");
    } else {
      db.User.insertOne({ _id: login, PasswordHash: process.env.PASSWORD_HASH });
      print("Inserted test login \"" + login + "\".");
    }
  '

echo "Test login: $TEST_LOGIN / $TEST_PASSWORD"
