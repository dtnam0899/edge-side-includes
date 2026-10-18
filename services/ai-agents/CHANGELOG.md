# Changelog

All notable changes are generated from Conventional Commits by the release flow. Do not edit released sections by hand.

## Unreleased

- SQL and DSL generation (ESI-18): `POST /sql-generations` and `POST /dsl-generations` from the pinned `agents-api` 0.1.0 contract (generated pydantic models); agent-side SQL policy (single SELECT, read-only procedure scripts, no EXEC, grounding in schema metadata); DSL validation mirroring `dsl-core` 0.1.0 with the published fixtures; chart and form refusals; retries with validation findings (default 2); timeouts, retries and prompt limits on model calls; evals for refusals, grounding, invalid DSL and prompt contents.
- Scaffold: FastAPI service with `/health`, settings from `ESI_AGENTS_*` environment variables, `ModelClient` interface and deterministic `StubModel`, eval runner (`python -m esi_agents.evals`) with a harness smoke case, pytest and ruff, multi-stage Dockerfile and compose file.
