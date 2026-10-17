# services/ai-agents (Python / AI agent)

<!-- Supplements the repository root CLAUDE.md for this project. Keep only verified facts. -->

## Overview
AI agents and tools that answer user requests and emit DSL documents (validated against models generated from `lib/dsl-schema`) for the UI to render. Evaluation cases live in `evals/`.

## Stack
- Python <version>, <framework: FastAPI / LangChain / other>, <package manager: uv / pip / poetry>
- Model providers and external tools/services: <list, with config location>

## Commands (run from this directory)
- Install: `<verified command>`
- Run: `<verified command>`
- Tests: `pytest -q`
- Lint/format: `ruff check . && ruff format --check .`
- Docker: `docker compose up` (local dependencies) and `docker build -t <project>:<version> .`; see the `esi-project-standards` skill. This project must not depend on other projects' sources.

## Structure
- `<package>/` - <agents, tools, prompts, services>

## Project context
- Database safety rules (UR-1): the agent may read definitions of existing stored procedures as schema context but must never call or execute them. Any stored procedure it writes is a script only, and its body must be read-only (no INSERT/UPDATE/DELETE/DDL or other side effects). Generated SQL for execution must be a single SELECT statement. Add evals that fail when an output breaks these rules.
- Prompts, tool definitions and evaluation data: <file references>
- API keys and model settings: environment variables only; never commit keys or prompts containing secrets.
- Non-deterministic behavior: <how it is tested or evaluated>
