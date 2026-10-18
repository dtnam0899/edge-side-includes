# esi-agents

AI agents service of ESI (`services/ai-agents`). Python 3.13, FastAPI, `uv`. Implements the `agents-api` contract: SQL generation grounded in schema metadata and DSL generation from column definitions (ESI-18), each output checked before it is returned. No model provider is configured yet (ADR-0001), so generation answers `model-unavailable` outside tests and evals.

See `CLAUDE.md` for commands.
