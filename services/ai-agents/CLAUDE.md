# services/ai-agents (Python / AI agent)

<!-- Supplements the repository root CLAUDE.md for this project. Keep only verified facts. -->

## Overview
AI agents and tools that answer user requests and emit DSL documents (validated against models generated from `lib/dsl-schema`) for the UI to render. Evaluation cases live in `evals/`.

## Stack
- Python 3.13 (`.python-version`; `requires-python >=3.13,<3.15`), FastAPI, `uv` with `uv.lock`, `pytest`, `ruff` (ADR-0001). Locked at scaffold: fastapi 0.143.3, pydantic-settings 2.16.0, uvicorn 0.54.0, pytest 9.1.1, ruff 0.17.1, httpx 0.28.1 (test client only).
- Model provider and agent framework: not chosen yet; a separate ADR must be accepted before agent feature work starts. Code depends only on the `ModelClient` protocol.

## Commands (run from this directory)
- Install: `uv sync --frozen` (uv downloads Python 3.13 if missing)
- Run: `uv run python -m esi_agents` (listens on `ESI_AGENTS_PORT`, default 8000; `GET /health`)
- Tests: `uv run pytest -q` (also the pre-commit command in `.esi-test-cmd`)
- Lint/format: `uv run ruff check . && uv run ruff format --check .`
- Evals: `uv run python -m esi_agents.evals evals/cases` (exit 0 all pass, 1 a case failed, 2 no cases)
- Docker: `docker build --target test .` (lint, tests, evals), `docker build -t esi-agents:<version> .` (runtime, non-root, `HEALTHCHECK` on `/health`), `docker compose up`. Build context is this directory only.

## Structure
- `src/esi_agents/app.py` - FastAPI app factory; `/health` is operational, feature routes come from the `agents-api` contract
- `src/esi_agents/config.py` - `Settings` from `ESI_AGENTS_*` environment variables
- `src/esi_agents/llm/` - `ModelClient` protocol and deterministic `StubModel`
- `src/esi_agents/agents/`, `tools/`, `prompts/` - empty until ESI-18 (prompts as versioned files, not inline strings)
- `src/esi_agents/evals/` - eval runner (load JSON cases, run against a model, report)
- `evals/cases/` - eval case files (format in `evals/README.md`); `harness-smoke.json` only proves the runner
- `tests/` - unit tests

## Project context
- Database safety rules (UR-1): the agent may read definitions of existing stored procedures as schema context but must never call or execute them. Any stored procedure it writes is a script only, and its body must be read-only (no INSERT/UPDATE/DELETE/DDL or other side effects). Generated SQL for execution must be a single SELECT statement. Add evals that fail when an output breaks these rules.
- Test data (P0-14, `docs/process/test-data.md`): evals use static schema-metadata fixtures in `evals/fixtures/`, in the shape of the pinned `agents-api` contract and regenerated when that version changes; never core's files or database. The folder is created with the first contract version that defines schema metadata (ESI-13/ESI-18).
- API keys and model settings: environment variables only (`ESI_AGENTS_*`); never commit keys or prompts containing secrets.
- Non-deterministic behavior: unit tests and evals use `StubModel`; evals against the real model are added with the provider ADR and rerun when prompts or models change.
- Known: Starlette warns that `httpx` in `TestClient` is deprecated in favour of `httpx2`; harmless for now, revisit when bumping FastAPI.
