# evals

Eval cases for the agents, one JSON file per topic under `cases/` (a case object or a list of them).
`harness-smoke.json` only proves the runner works; the real cases (SQL safety, DSL output) are added by ESI-18.

Case fields: `id` (unique), `prompt`, `stub_output` (answer of the deterministic stub model), `checks`
(`equals` | `contains` | `not_contains` with a `value`).

Run from `services/ai-agents`: `uv run python -m esi_agents.evals evals/cases`. Exit code 0 = all pass, 1 = a case failed, 2 = no cases.
