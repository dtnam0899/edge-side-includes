# services/ai-agents (Python / AI agent)

<!-- Supplements the repository root CLAUDE.md for this project. Keep only verified facts. -->

## Overview
AI agents behind the `agents-api` contract: `generateSql` (SQL Server SQL grounded in schema metadata, UR-1 SR-3) and `generateDsl` (A2UI DSL from column definitions, SR-5). Every model candidate passes deterministic checks before it is returned. Evaluation cases live in `evals/`.

## Stack
- Python 3.13 (`.python-version`; `requires-python >=3.13,<3.15`), FastAPI, `uv` with `uv.lock`, `pytest`, `ruff` (ADR-0001). Locked at scaffold: fastapi 0.143.3, pydantic-settings 2.16.0, uvicorn 0.54.0, pytest 9.1.1, ruff 0.17.1, httpx 0.28.1 (test client only).
- Model provider and agent framework: not chosen yet (ADR-0001); code depends only on the `ModelClient` protocol. Without a provider the service answers generation calls with `model-unavailable` (503); tests and evals use `StubModel`.
- Published artifacts, pinned in `published-packages.json` (ESI-18): `@dtnam0899/esi-contracts` 0.1.0 (`bundled/agents-api.yaml`) and `@dtnam0899/dsl-schema` 0.1.0 (A2UI v0.9.1 schemas, artifact schema, shared fixtures). `scripts/sync-published.sh` fetches them (Docker target `published`, token as BuildKit secret) into `vendor/esi-contracts/`, `src/esi_agents/dsl/schema/` and `tests/fixtures/dsl-schema/`, each with a `PUBLISHED.json`; never edit those files.
- Python model generator (decided in ESI-18, ADR-0001 left it open): `datamodel-code-generator` (dev dependency) builds `src/esi_agents/contracts/agents_api.py` from the bundled spec via `scripts/generate_contract_models.py`; the header records the contract version, `tests/test_contract_models.py` fails if the file differs from the generator output. DSL validation uses `jsonschema` with the vendored schemas plus a Python mirror of the `dsl-core` rules, tested against the published fixtures.

## Commands (run from this directory)
- Install: `uv sync --frozen` (uv downloads Python 3.13 if missing)
- Run: `uv run python -m esi_agents` (listens on `ESI_AGENTS_PORT`, default 8000; `GET /health`)
- Tests: `uv run pytest -q` (also the pre-commit command in `.esi-test-cmd`)
- Lint/format: `uv run ruff check . && uv run ruff format --check .`
- Evals: `uv run python -m esi_agents.evals evals/cases` (exit 0 all pass, 1 a case failed, 2 no cases)
- Refresh published artifacts after bumping `published-packages.json`: `export NODE_AUTH_TOKEN=$(gh auth token)` (needs `read:packages`), then `scripts/sync-published.sh`; commit the regenerated files in the same PR.
- Docker: `docker build --target test .` (lint, tests, evals), `docker build -t esi-agents:<version> .` (runtime, non-root, `HEALTHCHECK` on `/health`), `docker compose up`. Build context is this directory only.

## Structure
- `src/esi_agents/app.py` - FastAPI app factory; `/health` is operational, feature routes come from the `agents-api` contract
- `src/esi_agents/config.py` - `Settings` from `ESI_AGENTS_*` environment variables
- `src/esi_agents/llm/` - `ModelClient` protocol, `StubModel` (records prompts), `UnconfiguredModel`, `guarded_complete` (timeout, retries with backoff, prompt size limit)
- `src/esi_agents/agents/` - `SqlGenerationAgent`, `DslGenerationAgent` (check candidate, retry with findings, never return a failing candidate)
- `src/esi_agents/sql/` - T-SQL tokenizer, statement policy (single SELECT; read-only procedure scripts) and schema grounding
- `src/esi_agents/dsl/` - `validator.py` (mirror of `dsl-core`), `candidate.py` (agent rules: display components only, table/KPI shape, artifact envelope), `schema/` (vendored)
- `src/esi_agents/contracts/agents_api.py` - generated models (vendored contract in `vendor/esi-contracts/`)
- `src/esi_agents/prompts/` - versioned prompt templates (`<name>.v<N>.md`)
- `src/esi_agents/tools/` - empty (no model tools yet)
- `src/esi_agents/evals/` - eval runner (prompt cases and agent cases, format in `evals/README.md`)
- `evals/cases/` - `sql-generation.json`, `dsl-generation.json`, `harness-smoke.json`; `evals/fixtures/` - schema metadata in the contract shape
- `tests/` - unit tests; `tests/fixtures/dsl-schema/` - published DSL fixtures (vendored)

## Project context
- Database safety rules (UR-1): the agent may read definitions of existing stored procedures as schema context but must never call or execute them. Any stored procedure it writes is a script only, and its body must be read-only (no INSERT/UPDATE/DELETE/DDL or other side effects). Generated SQL for execution must be a single SELECT statement. Add evals that fail when an output breaks these rules.
- Test data (P0-14, `docs/process/test-data.md`): evals use static schema-metadata fixtures in `evals/fixtures/` (`sales-schema.json`: customers, products, orders, order lines, `dbo.usp_GetCustomerOrders` as text), in the shape of the pinned `agents-api` contract; each records the contract version in `contract.version` and a test fails when it differs from the pin. Never core's files or database.
- What reaches the model: the question, history, schema structure and procedure definitions with string literals masked (`SqlGenerationAgent`), or column names/types and the intent (`DslGenerationAgent`). Prompts are built from typed contract fields only, so extra request fields (rows, connection strings) cannot leak; evals assert this. Prompts are never logged.
- DSL output (phase 1): table or KPI only, components `Column Row List Card Text Divider`, functions `formatNumber formatCurrency formatDate formatString`; chart and form wording in the intent is refused before the model is called. The emitted `DslDocument` uses `protocolVersion` `v0.9` (the renderer's message version, as in the dsl-schema artifact) and `dslSchemaVersion` = the dsl-schema package version. A candidate that fails after `ESI_AGENTS_DSL_MAX_RETRIES` (default 2) is a 422 `dsl-validation-failed` problem with the issues.
- API keys and model settings: environment variables only (`ESI_AGENTS_*`); never commit keys or prompts containing secrets.
- Non-deterministic behavior: unit tests and evals use `StubModel` with scripted outputs, so evals prove the checks and retries around the model, not model quality; evals against the real model are added with the provider ADR and rerun when prompts or models change.
- Settings (`ESI_AGENTS_*`): `SQL_MAX_RETRIES`, `DSL_MAX_RETRIES` (default 2), `MODEL_TIMEOUT_SECONDS` (60), `MODEL_RETRIES` (1), `MODEL_BACKOFF_SECONDS` (0.5), `MAX_PROMPT_CHARS` (200000).
- Known: Starlette warns that `httpx` in `TestClient` is deprecated in favour of `httpx2`; harmless for now, revisit when bumping FastAPI.
