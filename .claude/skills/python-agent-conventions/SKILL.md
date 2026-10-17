---
name: python-agent-conventions
description: Python conventions for ESI AI agents and services. Use when creating or editing agents, tools, prompts, LLM calls, evals, or Python tests.
---

# Python agent conventions

Package manager, commands and model providers live in the project `CLAUDE.md`; general rules in `clean-code-rules.md` (claude-howto).

- Full type hints; `ruff check . && ruff format --check .`; tests with `pytest -q`.
- Separate agents, tools, prompts and LLM clients into modules. Tools are small typed functions with docstrings; prompts live in versioned files, not inline strings.
- Pydantic models for tool inputs/outputs and structured LLM output; validate generated output against its schema before returning it.
- Async I/O; set timeouts, retries with backoff and token/cost limits on every model call.
- Treat user input, retrieved documents and tool results as untrusted (prompt injection): least-privilege tools, no secrets in prompts, validate tool arguments, never log sensitive data.
- Secrets and model settings come from environment variables only.
- Non-determinism: unit-test tools and parsing with a mocked LLM; keep regression cases in an `evals/` set and rerun it when prompts or models change, noting the result in the PR.
