# evals

Eval cases for the agents, one JSON file per topic under `cases/` (a case object or a list of them):
`sql-generation.json` (SQL safety and grounding), `dsl-generation.json` (DSL output, refusals, retries),
`harness-smoke.json` (proves the runner only). Schema-metadata fixtures live in `fixtures/`, in the shape of
the pinned `agents-api` contract; `contract.version` records the version (checked against
`published-packages.json` by `tests/test_contract_models.py`).

The stub model returns `stub_outputs` in order, so a case scripts what a model answers on each attempt
(for example three unsafe answers in a row) and checks what the agent returns. These evals prove the
deterministic checks, refusals and retries around the model; they do not measure a real model.

Case fields:
- `id` (unique), `checks` (at least one).
- Prompt case: `prompt`, `stub_output`; the outcome is the output string.
- Agent case: `agent` (`sql` | `dsl`), `request` (contract-shaped body), optional `schema_fixture` (path
  relative to the case file, fills `request.schema`), `stub_outputs` (strings or JSON values). The outcome
  is `{"status", "response", "modelCalls", "prompts"}`: `status` 200 or 422 (`dsl-validation-failed`, with
  `response.issueCodes`), `prompts` all prompts joined (to check what would reach a model).

Check fields: `kind` (`equals` | `contains` | `not_contains` | `absent` | `valid_dsl`), `path` (JSON Pointer
into the outcome, `""` for all of it), `value`. `contains` is a substring for strings and membership for
lists; `valid_dsl` re-validates the document at `path` against the request columns and intent.

Run from `services/ai-agents`: `uv run python -m esi_agents.evals evals/cases`. Exit code 0 = all pass, 1 = a case failed, 2 = no cases.

## Real-model evals (ADR-0007)

An agent case with `real_checks` also runs against the Gemini API:
`ESI_AGENTS_GEMINI_API_KEY=... uv run python -m esi_agents.evals evals/cases --model gemini`. Only those cases run,
`real_checks` replace `checks` (the answers vary, so they check the kind, referenced tables, `valid_dsl`, refusals and
what reached the model, never exact text), and `stub_outputs` are ignored. The demo limits apply (deadline 50 s,
model timeout 25 s, 1 model retry, 1 SQL/DSL retry) unless an `ESI_AGENTS_*` variable overrides one; a 503 outcome
(`model-unavailable`: rate limit, deadline) is a failed case. It prints the model, prompt versions, model calls per
case, total calls and the slowest request.

Run it by hand when prompts, the model code or the client change, never in CI (free quota, secret), and paste the
summary into the PR. Target before the demo: every safety case passes and at least 80% of the SQL and DSL cases
produce a checked result. Free-tier prompts may be read by Google: only the fixtures in `fixtures/` go through it.
