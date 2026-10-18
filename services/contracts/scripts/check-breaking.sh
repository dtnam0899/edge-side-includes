#!/bin/sh
# Compares the specs in this directory with a previously released copy and fails on breaking changes.
# Usage: scripts/check-breaking.sh <dir with the last released specs>   (needs the oasdiff binary on PATH)
# The last release is installed by CI: npm pack @dtnam0899/esi-contracts@<last> and extract it.
set -eu

BASE="${1:-}"
if [ -z "$BASE" ]; then
  echo "No previous release given: nothing to compare (first release)."
  exit 0
fi

status=0
for api in core-api agents-api; do
  if [ ! -f "$BASE/$api/openapi.yaml" ]; then
    echo "$api: not in the previous release, skipping"
    continue
  fi
  echo "== $api"
  oasdiff breaking "$BASE/$api/openapi.yaml" "$api/openapi.yaml" --fail-on ERR || status=1
done
exit "$status"
