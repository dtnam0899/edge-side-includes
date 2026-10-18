#!/usr/bin/env bash
# Phase 5 end-to-end scenario: fresh stack, Playwright scenario, logs on failure, stack removed.
# Needs the images esi-core:dev, esi-core-migrator:dev, esi-agents:dev and esi-portal:dev (README.md).
# Set ESI_E2E_KEEP=1 to leave the stack running afterwards (portal on http://localhost:${ESI_E2E_PORT:-4300}).
set -euo pipefail
cd "$(dirname "$0")"

for image in "${ESI_E2E_CORE_IMAGE:-esi-core:dev}" "${ESI_E2E_CORE_MIGRATOR_IMAGE:-esi-core-migrator:dev}" \
  "${ESI_E2E_AGENTS_IMAGE:-esi-agents:dev}" "${ESI_E2E_PORTAL_IMAGE:-esi-portal:dev}"; do
  docker image inspect "$image" >/dev/null 2>&1 || { echo "missing image $image; build it first (README.md)" >&2; exit 2; }
done

cleanup() {
  if [[ "${ESI_E2E_KEEP:-0}" != "1" ]]; then docker compose --profile test down -v --remove-orphans >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

docker compose --profile test down -v --remove-orphans >/dev/null 2>&1 || true
rm -rf results
docker compose up -d --wait gateway
status=0
docker compose --profile test run --rm --build scenario || status=$?
if [[ $status -ne 0 ]]; then
  mkdir -p results
  docker compose logs --no-color api agents target-seed migrate > results/services.log 2>&1 || true
  echo "scenario failed ($status); report in results/report, service logs in results/services.log" >&2
fi
exit $status
