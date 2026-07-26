#!/usr/bin/env bash
# Seeds the local MongoDB instance with a test login for the Login API (UBE-10),
# copies the local FrontEnd .env template into place (UBE-26), and sets
# ASPNETCORE_ENVIRONMENT=Local for the Api (UBE-23).
# Safe to re-run: skips the login insert if it already exists (the .env copy
# always overwrites, to keep FrontEnd/.env in sync with the template).
#
# Must be sourced, not executed, for the ASPNETCORE_ENVIRONMENT export to
# persist in your shell - works from bash or zsh:
#   source scripts/setup_local.sh

setup_local() {
  local repo_root
  repo_root="$(git rev-parse --show-toplevel)" || return 1

  cp "$repo_root/FrontEnd/.env.local" "$repo_root/FrontEnd/.env" || return 1
  echo "Copied FrontEnd/.env.local to FrontEnd/.env."

  command -v mongosh >/dev/null 2>&1 || { echo "error: mongosh is required but was not found on PATH" >&2; return 1; }
  command -v htpasswd >/dev/null 2>&1 || { echo "error: htpasswd is required but was not found on PATH" >&2; return 1; }

  local mongo_uri="${MONGO_URI:-mongodb://localhost:27017}"
  local mongo_db="${MONGO_DB:-pim}"
  local test_email="testuser@example.com"
  local test_password="TestPassword123!"

  local password_hash
  password_hash="$(htpasswd -bnBC 10 "$test_email" "$test_password" | cut -d: -f2)" || return 1

  TEST_EMAIL="$test_email" PASSWORD_HASH="$password_hash" \
    mongosh "$mongo_uri/$mongo_db" --quiet --eval '
      const email = process.env.TEST_EMAIL;
      const existing = db.User.findOne({ _id: email });
      if (existing) {
        print("Test login \"" + email + "\" already exists, skipping.");
      } else {
        db.User.insertOne({ _id: email, PasswordHash: process.env.PASSWORD_HASH });
        print("Inserted test login \"" + email + "\".");
      }
    ' || return 1

  echo "Test login: $test_email / $test_password"
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
