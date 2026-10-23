# Changelog

All notable changes are generated from Conventional Commits by the release flow. Do not edit released sections by hand.

## Unreleased

- Chart DSL (ADR-0009, ESI-11, agents-api 0.3.0): `generateDsl` serves `intent.kind` `chart` with one `EsiChart` on the ESI catalog (`dtnam0899.github.io:esi-catalog-v0_9-1`); the request's `catalogId` must match the intent (ESI for charts, basic for tables and KPIs, otherwise 400). The `dsl-core` mirror checks both catalogs and the chart rules `chart-column-type` / `chart-series`. Agent rules pick the chart type: the type the user names, pie only for shares of a whole, otherwise line over a date or datetime category and bar for anything else. A chart without a numeric column, and chart wording on a table or KPI intent, are answered `unsupported` before any model call; forms are still refused. Prompt `dsl_generation.v2`; nine new evals.
- Pinned `@dtnam0899/esi-contracts` 0.3.0 and `@dtnam0899/dsl-schema` 0.2.0 (documents now carry `dslSchemaVersion` `0.2.0`); `scripts/sync-published.sh` also vendors the ESI catalog (`dsl/schema/esi-catalog.json`).

## 0.1.0

- SQL and DSL generation (ESI-18): `POST /sql-generations` and `POST /dsl-generations` from the pinned `agents-api` 0.1.0 contract (generated pydantic models); agent-side SQL policy (single SELECT, read-only procedure scripts, no EXEC, grounding in schema metadata); DSL validation mirroring `dsl-core` 0.1.0 with the published fixtures; chart and form refusals; retries with validation findings (default 2); timeouts, retries and prompt limits on model calls; evals for refusals, grounding, invalid DSL and prompt contents.
- Scaffold: FastAPI service with `/health`, settings from `ESI_AGENTS_*` environment variables, `ModelClient` interface and deterministic `StubModel`, eval runner (`python -m esi_agents.evals`) with a harness smoke case, pytest and ruff, multi-stage Dockerfile and compose file.
