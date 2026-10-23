---
id: ADR-0007
type: adr
status: Accepted
date: 2026-10-19
projects: [agents]
issues: [ESI-88, ESI-89]
keywords: [model provider, llm, gemini, gemini api, free tier, rate limit, 429, model-unavailable, httpx, timeout, retries, deadline, api key, container apps secret, data use, evals, demo]
---

# ADR-0007 Model provider for the agents: Gemini API free tier (demo)

## Context
- ADR-0001 deferred the model provider for `services/ai-agents` ("a separate ADR must be accepted before the agents feature work starts"). The agents code depends only on the `ModelClient` protocol (`src/esi_agents/llm/base.py`: `async complete(prompt) -> str`, raising `ModelUnavailableError`). Every call goes through `guarded_complete` (`llm/guard.py`): prompt size limit `ESI_AGENTS_MAX_PROMPT_CHARS` (200,000), per-call timeout `MODEL_TIMEOUT_SECONDS` (60), `MODEL_RETRIES` (1) with exponential backoff `MODEL_BACKOFF_SECONDS` (0.5). Without a provider, `UnconfiguredModel` makes every generation answer 503 `model-unavailable`; that is the last gap for using the demo online after sign-in (ADR-0006).
- The agents check every candidate themselves and retry with the findings: `SqlGenerationAgent` up to `SQL_MAX_RETRIES` + 1 model calls (default 3), `DslGenerationAgent` up to `DSL_MAX_RETRIES` + 1 (default 3). Prompts ask for one JSON object (`prompts/*.v1.md`); `agents/output.py` parses it and tolerates a Markdown fence.
- Time limits in the demo (ADR-0005, `infra/azure/README.md`): Vercel waits at most 120 s for the first byte; core calls agents with `ESI_CORE_Agents__TimeoutSeconds=90` and `ESI_CORE_Visualization__MaxRetries=1`. Chat makes one agents call per question; a visualization makes up to 2 `generateDsl` calls in one portal request. Today one agents request can take (3 candidates) × (2 attempts) × 60 s = 360 s, far beyond both limits.
- What reaches the model is already restricted (`services/ai-agents/CLAUDE.md`): the question, history, schema structure and procedure definitions with string literals masked, or column names/types and the intent. Prompts are built from typed contract fields only, evals assert this, and prompts are never logged. No row values reach the model.
- The demo is free only (ADR-0005; personal, non-commercial project). It connects only to `esi_demo_target`, a sample database; no real user data and no real target databases. Sign-in is invite-only (ADR-0006).
- The product owner chose the Gemini API free tier for the demo (2026-10-19).
- Gemini API facts verified on 2026-10-19 (page "last updated" dates in brackets):
  - [Pricing](https://ai.google.dev/gemini-api/docs/pricing) [2026-10-16]: a free tier exists for, among others, `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-2.5-pro`, `gemini-2.5-flash`. The free tier needs no card. On the free tier, content **is** used to improve Google's products; on the paid tier it is not.
  - [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) [2026-10-15]: limits are **per project, not per API key**; requests per day reset at midnight Pacific time; the page no longer lists free-tier numbers, it points to "active rate limits" in AI Studio; "specified rate limits are not guaranteed and actual capacity may vary". Google has lowered free-tier limits before. Exceeding a limit is `429 RESOURCE_EXHAUSTED`.
  - [Terms](https://ai.google.dev/gemini-api/terms) [2026-04-28, effective 2026-03-23]: for unpaid services, Google uses submitted content and responses to improve its products and machine learning; human reviewers may read, annotate and process inputs and outputs (disconnected from the account, key and project first); do not submit sensitive, confidential or personal information. Users must be 18 or older. When making API clients available to users in the EEA, Switzerland or the UK, only paid services may be used.
  - [Logs policy](https://ai.google.dev/gemini-api/docs/logs-policy) [2026-10-14]: opt-in request logging (default retention 55 days) exists for billing-enabled projects only; it does not change free-tier data use above.
  - [Models](https://ai.google.dev/gemini-api/docs/models) [2026-10-13] and [deprecations](https://ai.google.dev/gemini-api/docs/deprecations) [2026-10-12]: `gemini-3.8-flash` (stable, released 2026-09-02) and `gemini-3.5-flash-lite` (stable, released 2026-07-21) have no shutdown date; both have a 1,048,576-token input and 65,536-token output limit, structured output and thinking; `gemini-3.8-flash` supports thinking levels `low`, `medium`, `high`. Stable codes "usually don't change"; `-latest` aliases are hot-swapped with two weeks' notice. `gemini-3.1-flash-lite` shuts down on 2027-05-07; `gemini-2.5-*` is limited to earlier users.
  - REST: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, key in the `x-goog-api-key` header ([API reference](https://ai.google.dev/api/generate-content), [structured output](https://ai.google.dev/gemini-api/docs/structured-output)). JSON output mode returns syntactically valid JSON, but Google says to validate the values. [Troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting) [2026-10-13]: retry 429 and 5xx with exponential backoff; do not retry 400/403. The official Python SDK retries 429 and 5xx on its own (up to 4 times, up to 60 s apart).
  - Official SDK: `google-genai` 2.31.0 on PyPI (2026-10-14); it depends on `httpx`, `requests`, `google-auth`, `tenacity`, `websockets`, `anyio`, `pydantic`.
- GitHub Models, a free option considered earlier, was [retired on 2026-07-30](https://github.blog/changelog/2026-07-30-github-models-is-now-retired/).

## Options
1. **Gemini API free tier.** Pros: no cost and no card; stable Flash models with a 1M-token context, JSON output and good code/SQL ability; one HTTPS endpoint with an API key. Cons: low, unpublished and changing rate limits (per project, best effort, no SLA); free-tier prompts may be used to improve Google products and read by humans, so only demo data may pass; not allowed for users in the EEA, Switzerland or the UK; a production use needs a paid tier or another provider anyway.
2. **Claude API (Anthropic, paid).** Pros: strong at SQL and structured JSON; commercial terms suited to real data. Cons: pay per token and a payment method from day one, which breaks the free-demo goal (ADR-0005).
3. **OpenAI API (paid).** Pros and cons as option 2: good models, commercial terms, but pay per token and a payment method from the start.
4. **GitHub Models.** Not available: retired on 2026-07-30.
5. **Self-hosted open model** (for example on Container Apps). Cons: a model that writes reliable T-SQL needs far more than the 0.25 vCPU / 0.5 GiB free allowance and a GPU is paid; quality is lower. Not pursued.

For the client:
- a. **Official SDK `google-genai`.** Pros: maintained by Google, typed. Cons: about seven extra runtime dependencies (including `requests` and `websockets`) for one endpoint; built-in retries that would stack on `guarded_complete` and must be turned off; a faster-moving API surface to pin and follow.
- b. **Plain HTTP with `httpx`.** Pros: `httpx` 0.28.1 is already in `uv.lock`; one request and one response shape to map; retries and timeouts stay in `guarded_complete` only; easy to test with `httpx.MockTransport`. Cons: we map the REST shape ourselves and follow API changes by reading the docs.

## Decision
Take option 1 for the **demo only**, with client b: a `GeminiModel` class in `src/esi_agents/llm/gemini.py` that implements `ModelClient` over plain `httpx`, calling the stable model `gemini-3.8-flash`. Only demo data (the `esi_demo_target` sample database and the eval fixtures) may go through the free tier. Any use with real data, or by users in the EEA, Switzerland or the UK, needs a paid provider and a new ADR.

Model
- Default `gemini-3.8-flash` (stable code, never a `-latest` alias), thinking level `low` to keep latency and token use down. It is the strongest free-tier Flash model for code and SQL.
- Fallback `gemini-3.5-flash-lite` (stable): switch by configuration only, if the free quota of 3.8 Flash is too small or its latency breaks the time budget. The real-model evals decide; record the result in the PR that changes it.
- Changing the model code is a configuration change plus a real-model eval run (see Verification).

Client (`GeminiModel`)
- `httpx.AsyncClient` created once per app (closed on shutdown), `POST {base}/v1beta/models/{model}:generateContent`, key in the `x-goog-api-key` header, never in the URL. One user turn with the prompt as text. Generation config: JSON output (`application/json` MIME type), low temperature, a `maxOutputTokens` cap (the token/cost limit required by `python-agent-conventions`), thinking level from settings. No tools, no grounding, no code execution, no file upload, no caching, no streaming.
- No JSON schema is sent in phase 1: the agents already parse and check every candidate, and sending the schema adds a second place to keep in sync. Revisit if JSON errors are frequent in evals.
- Returns the concatenated text parts of the first candidate. Exact request and response field names are taken from the API reference at implementation time (ESI-89) and covered by `MockTransport` tests.
- Dependencies: move `httpx` from the dev group to runtime dependencies (`httpx>=0.28.1` in `pyproject.toml`, exact 0.28.1 in `uv.lock`, as ADR-0001 pins via lock files). No `google-genai`. Silence `httpx`/`httpcore` INFO logs (they print request lines).

Errors (all become 503 `model-unavailable` through the existing exception handler; the problem detail names the cause, never the prompt or the key)
- Timeouts, connection errors, 500, 503, 504: `ModelUnavailableError`, retried by `guarded_complete` as today.
- 429 `RESOURCE_EXHAUSTED`: a new `ModelRateLimitedError(ModelUnavailableError)` that `guarded_complete` does **not** retry and the agents do not retry: a free quota does not come back within one request, and retrying spends more of it. Detail: "the model is rate limited, try again later".
- 400, 401, 403, 404 (bad key, unknown model, bad request): `ModelUnavailableError` without retry, logged at ERROR with the status and Google's error `status` field only (a configuration fault).
- Prompt blocked or no candidate (`promptFeedback.blockReason`, empty candidates): `ModelUnavailableError` without retry.
- Output cut off (`MAX_TOKENS`) or not JSON: returned as text; the agent's parser rejects it and the existing retry-with-findings loop handles it.
- `guarded_complete` gains the non-retryable path (a flag or exception type checked before the backoff); the retry loop otherwise stays as is.

Time budget
- New setting `ESI_AGENTS_REQUEST_DEADLINE_SECONDS`: one deadline for the whole agents request (all candidates and all attempts). When it expires, the request ends with `model-unavailable` ("the model did not answer in time"). The agents stop starting new model calls when the deadline has passed and each call's timeout is capped by the time left.
- Defaults stay generous for local use (deadline 80, below core's default 120). Demo values, set in `infra/azure/README.md`: `REQUEST_DEADLINE_SECONDS=50`, `MODEL_TIMEOUT_SECONDS=25`, `MODEL_RETRIES=1`, `SQL_MAX_RETRIES=1`, `DSL_MAX_RETRIES=1`. Then chat needs at most 50 s of the 90 s core timeout, and a visualization (2 agents calls with `ESI_CORE_Visualization__MaxRetries=1`) at most about 100 s, under Vercel's 120 s.
- With these values one question uses at most 2 model calls for SQL and up to 4 for a visualization; low enough for a free per-minute limit with a few demo users.

Configuration (environment variables only, `ESI_AGENTS_*`)
- `MODEL_PROVIDER`: `none` (default, `UnconfiguredModel`) or `gemini`. The app factory picks the client; with `gemini` and no key the service fails at startup.
- `GEMINI_API_KEY`: a pydantic `SecretStr`, no default; never logged or put in problem details. In Azure a Container Apps secret (`--secrets gemini-api-key=...`, `ESI_AGENTS_GEMINI_API_KEY=secretref:gemini-api-key`), set from a GitHub environment secret as ADR-0005 describes; locally from the shell or a git-ignored `.env`.
- `GEMINI_MODEL` (default `gemini-3.8-flash`), `GEMINI_THINKING_LEVEL` (default `low`), `GEMINI_MAX_OUTPUT_TOKENS`, `GEMINI_BASE_URL` (default `https://generativelanguage.googleapis.com`).
- The key belongs to a Google Cloud project used only for the ESI demo, created in AI Studio without billing, so the free tier and its data terms apply and nothing can be charged. Since limits are per project, a separate key in the same project does not add quota.

Data rules (free tier)
- Only demo data goes through the free tier: the `esi_demo_target` sample schema in the demo, the `evals/fixtures/` schemas in evals, and a developer's own sample database locally. Never a real customer or company database, real personal data or secrets, also not in a question typed into the chat.
- What reaches the model stays as today (schema structure, masked procedure definitions, question, history, column names and intent; never rows or connection strings). Any change to that list needs an eval that asserts it and a note in this ADR's successor.
- Demo invitations (ADR-0006) go only to adults outside the EEA, Switzerland and the UK, and the invitation says that questions are sent to Google's free Gemini API, may be read by Google reviewers, and must not contain personal or confidential data. The portal does not show a notice in phase 1 (see Open questions).

## Consequences
- The demo works end to end at no cost. The first Gemini call after idle adds no cold start of its own.
- Rate limits are unknown in advance and can drop: a busy demo can return 503 `model-unavailable` until the quota recovers (per minute) or the next day (midnight Pacific). Check the project's active limits in AI Studio when setting up and record them in `infra/azure/README.md`; show the demo to few people at a time.
- Free-tier prompts (schema of the sample database, questions) may be stored and read by Google. Acceptable only because the data is sample data; this is why the demo must never point at a real database.
- Lower retry counts in the demo mean more `dsl-validation-failed` / no-SQL answers than with defaults; the real-model evals show the rate.
- One more runtime dependency (`httpx`) and one more secret to manage. Moving to a paid tier (Gemini paid, Claude, OpenAI) later means a new `ModelClient` implementation and settings, not changes to the agents or the contract.
- Production, real data or users in the EEA/CH/UK need a new ADR choosing a paid provider; this ADR then becomes superseded for those environments.
- Follow-up work (ESI-89): `GeminiModel`, `ModelRateLimitedError`, the non-retryable path and request deadline in `guarded_complete`/agents, settings and app wiring, `MockTransport` tests, real-model eval mode, `services/ai-agents/CLAUDE.md` (stack and settings) and `infra/azure/README.md` (agents secret and demo values) updates. Core needs no change: it already maps agents' 503 to `agents-unavailable`.

## Verification
- Unit tests with `httpx.MockTransport` (no network): request URL, `x-goog-api-key` header (and no key in the URL), generation config; text extraction; each error mapping above (429 not retried, 400/403 not retried, 5xx and timeouts retried, blocked prompt); the deadline stops further calls; the key never appears in logs, exceptions or problem details.
- Existing stub evals and the "what reaches the model" evals keep passing unchanged.
- Real-model evals: an opt-in mode of the eval runner (`uv run python -m esi_agents.evals evals/cases --model gemini`, needs `ESI_AGENTS_GEMINI_API_KEY`) runs the agent cases that make sense against a real model (SQL generation and DSL generation on `evals/fixtures/`), not the scripted-output cases. It never runs in CI (free quota, secret). Run it by hand when prompts, the model code or the client change, and paste in the PR: model code, prompt versions, cases passed, model calls, slowest request. Target before the demo: every safety case passes (the deterministic checks make an unsafe output impossible to return; the eval shows how often the model needs a retry) and at least 80% of the SQL and DSL cases produce a checked result within the demo retry counts and the 50 s deadline.
- After deploying with the key: the `infra/e2e` scenario against the demo (ADR-0005) passes, and a chat question returns SQL instead of 503.

## Open questions
- Product owner: confirm that no demo viewer is in the EEA, Switzerland or the UK. If one is, the free tier is not allowed for them and the demo needs the Gemini paid tier (or another paid provider), which is not free.
- Product owner: whether the portal should show a one-line notice in the chat that questions go to Google's free Gemini API (a small portal change), or whether the invitation text is enough for the demo.
- After the first real-model eval run: keep `gemini-3.8-flash` or switch to `gemini-3.5-flash-lite` (quota and latency).
