#!/usr/bin/env bash
# Runs npm audit in the current directory, failing on advisories at or above the given level
# (low|moderate|high|critical, default low), except those allowlisted below.
set -euo pipefail

LEVEL="${1:-low}"
case "$LEVEL" in
  low|moderate|high|critical) ;;
  *) echo "Unknown audit level: $LEVEL" >&2; exit 2 ;;
esac

# picomatch ReDoS: no patched release yet, build tooling only. Remove once a fix ships.
ALLOWLIST=("GHSA-fc5q-39xc-vjpf")

# npm audit exits non-zero when it finds anything, so judge the report instead.
REPORT="$(npm audit --json || true)"
if ! jq -e '.vulnerabilities | type == "object"' >/dev/null 2>&1 <<<"$REPORT"; then
  echo "npm audit did not return a usable report:" >&2
  echo "$REPORT" >&2
  exit 2
fi

ALLOWED="$(printf '%s\n' "${ALLOWLIST[@]}" | jq -R . | jq -s .)"
ADVISORIES="$(jq --arg level "$LEVEL" '
  {info: 0, low: 1, moderate: 2, high: 3, critical: 4} as $rank
  | [.vulnerabilities[].via[] | objects
     | select($rank[.severity] >= $rank[$level])
     | {id: (.url | split("/") | last), name, severity, title, url}]
  | unique' <<<"$REPORT")"

jq -r --argjson allowed "$ALLOWED" '
  .[] | select(.id | IN($allowed[])) | "Ignoring allowlisted advisory: \(.id) (\(.name))"' <<<"$ADVISORIES"

BLOCKING="$(jq --argjson allowed "$ALLOWED" 'map(select(.id | IN($allowed[]) | not))' <<<"$ADVISORIES")"
if [ "$(jq length <<<"$BLOCKING")" -gt 0 ]; then
  echo "Vulnerabilities at or above '$LEVEL':" >&2
  jq -r '.[] | "  \(.severity): \(.name) - \(.title) - \(.url)"' <<<"$BLOCKING" >&2
  exit 1
fi

echo "npm audit passed at level '$LEVEL'."
