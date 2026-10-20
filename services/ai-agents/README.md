# esi-agents

AI agents service of ESI (`services/ai-agents`). Python 3.13, FastAPI, `uv`. Implements the `agents-api` contract: SQL generation grounded in schema metadata and DSL generation from column definitions (ESI-18), each output checked before it is returned. The model is the Gemini API free tier for the demo (ADR-0007, demo data only), enabled with `ESI_AGENTS_MODEL_PROVIDER=gemini` and `ESI_AGENTS_GEMINI_API_KEY`; without a provider generation answers `model-unavailable`. Tests and evals use a deterministic stub.

See `CLAUDE.md` for commands.
