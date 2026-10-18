#!/usr/bin/env bash
# Refresh the vendored files from the published packages pinned in published-packages.json:
# vendor/esi-contracts (bundled agents-api spec), src/esi_agents/contracts/agents_api.py (generated models),
# src/esi_agents/dsl/schema (A2UI + ESI artifact schemas) and tests/fixtures/dsl-schema (shared DSL fixtures).
# Needs Docker and NODE_AUTH_TOKEN with read:packages (`export NODE_AUTH_TOKEN=$(gh auth token)`).
set -euo pipefail
cd "$(dirname "$0")/.."
: "${NODE_AUTH_TOKEN:?export NODE_AUTH_TOKEN with read:packages, see docs/process/github-setup.md}"

pin() { sed -n "s|.*\"@dtnam0899/$1\": *\"\([^\"]*\)\".*|\1|p" published-packages.json; }
contracts="$(pin esi-contracts)"
dsl_schema="$(pin dsl-schema)"

rm -rf vendor/esi-contracts src/esi_agents/dsl/schema tests/fixtures/dsl-schema src/esi_agents/contracts/agents_api.py
docker build --target published \
  --build-arg ESI_CONTRACTS_VERSION="$contracts" \
  --build-arg DSL_SCHEMA_VERSION="$dsl_schema" \
  --secret id=npm_token,env=NODE_AUTH_TOKEN \
  --output type=local,dest=. .
echo "synced esi-contracts $contracts, dsl-schema $dsl_schema"
