# UR-1 issue drafts (phase 1 filed on 2026-10-18; phase 2 filed earlier)

Parent: [UR-1](./UR-1-bi-ai-assistant-web-application.md), ticket #1. Each draft touches one project (`esi-workflow`), uses the label `System Requirement`, and the title `ESI-<n> [PROJECT] <title>`. Acceptance criteria are summarized; the full text is in the SR sections of the UR file.

## Filing status (checked against GitHub on 2026-10-18)

| Draft | Issue | Note |
|-------|-------|------|
| D1 | ESI-13 | Filed |
| D2 | ESI-14 | Filed |
| D3 | ESI-15 | Filed |
| D4 | ESI-16 | Filed |
| D5 | ESI-17 | Filed |
| D6 | ESI-18 | Filed |
| D7 | ESI-19 | Filed |
| D8 | ESI-20 | Filed |
| D9 | ESI-10 | Filed earlier (2026-10-17), still valid |
| D10 | ESI-11 (agents), ESI-12 (portal) | Filed earlier; ESI-12 retitled to `[portal]` on 2026-10-18 |

ESI-2..ESI-9 are duplicates of D1..D8 filed before the structure change (`[assistant]`, React renderer in ESI-3). They were closed as superseded by ESI-13..ESI-20 on 2026-10-18. `scripts/create-ur1-issues.sh --apply` has already been run for phase 1; running it again creates duplicates.

## Release order

1. `contracts` (API specs) and `lib` (DSL and renderer) first.
2. `core`, then `agents`.
3. `portal` (assistant module) last, consuming the published contracts and `lib` versions.

ADRs needed before or alongside: A2UI adoption and storage model, key management, SQL validation approach, chart component (phase 2).

## Phase 1

### D1 `[contracts]` Define core-api and agents-api for BI assistant (SR-1..SR-9)
- Operations (names TBD in the spec): connections (create/test/update/delete, list), consent (accept/withdraw), schema metadata, chat sessions, SQL generate request, SQL execute with paging (page size 20, remaining count), saved artifacts, dashboards with layout; agents-api: generate SQL, generate DSL from column definitions (no row values).
- Error format `problem+json`; consent-withdrawn and validation errors are distinct, documented errors.
- No connection string or secret in any response. Additive minor version, first release.
- Done when: specs lint, are published, and consumers can pin the version.

### D2 `[lib]` DSL: pin A2UI v0.9.1, validator, and Angular renderer wrapper (SR-5, SR-6)
- Pin the A2UI v0.9.1 basic catalog and `@a2ui/angular` at a fixed version; record the protocol/renderer pair. Use the exact `catalogId` from the pinned catalog file (test it).
- `dsl-core`: schema validation plus ESI checks (unique ids, `root` exists, bound paths exist in column definitions, no unknown component/function).
- `dsl-renderer-angular`: wraps `@a2ui/angular`; builds the message sequence (`createSurface`, `updateComponents`, `updateDataModel` with rows at `/rows` and paging at `/page`).
- Fixtures and tests: table (List template with relative paths) and KPI (Card, Text, `formatNumber`).
- Not in scope: Angular renderer, forms, charts.
- Update `docs/dsl/` (component selection rules) and the `dsl-authoring`/`dsl-renderer-parity` skills per the ADR.

### D3 `[core]` Connections, consent and encrypted storage (SR-1, SR-9)
- CRUD of the user's own SQL Server connections; connection test returns a non-secret error.
- Consent: required before adding; recorded (user, terms version, time); withdraw hides all data of that database; consent again restores it.
- Envelope encryption (per-secret AES-256-GCM data key, master key from environment, key version for rotation); decrypt only at the moment of use.
- Local test mode assumes an admin user; production requires real auth (tracked separately).
- Tests: no secret in responses or logs; owner isolation; withdrawn consent blocks every operation on that connection.

### D4 `[core]` Schema discovery and read-only SQL execution (SR-1, SR-4)
- Schema metadata (schemas, tables/views, columns, types, existing procedure definitions as read-only context).
- Statement validation: a single SELECT only; reject writes, DDL, `EXEC`, multiple statements, `SELECT ... INTO`, `OPENROWSET`/linked-server constructs. Allow-list parser, with a test corpus of bypass attempts.
- Configurable timeout (default 30s). Paged execution: 20 rows per page with the remaining count; never load the whole result.
- Inline log of executed SQL (user, connection id, time, duration, outcome, statement); no results or secrets.
- Recommend a read-only database login in the connection UI/API docs.

### D5 `[core]` Sessions, saved artifacts and dashboards (SR-2, SR-7, SR-8)
- Persist chat sessions per user and connection, artifacts (components, SELECT, column definitions, catalogId, schema version), and dashboards with item layout (position/size).
- Owner isolation; items of a connection with withdrawn consent are hidden and restored with consent.
- Opening a dashboard returns layout and artifacts; each saved SELECT runs through D4 with the same policy; one item failing does not block others.

### D6 `[agents]` SQL and DSL generation with safety rules and evals (SR-3, SR-5)
- Generate SQL Server SELECT from the question and schema; output type: query or procedure script.
- Rules: may read existing procedure definitions but never execute them; new procedures are scripts only with read-only bodies; a SELECT must be a single statement. Rules are in the prompt and checked on the output.
- DSL generation from column definitions only (never row values), using only the pinned A2UI basic catalog; refuse forms and charts (phase 1) with a clear message.
- Retry on validation errors at most 2 times (configurable), then fail clearly.
- Evals (`evals/`): grounded identifiers, write/DDL/EXEC refusals, no executed procedures, invalid-DSL handling, form and chart refusal.

### D7 `[portal]` Assistant module: chat, connection and consent UI, SQL review and paged results (SR-1, SR-2, SR-4)
- Selecting a connected database shows chat session history and the dashboards list; withdrawn-consent databases are not accessible.
- Add/edit/delete connection with consent step; recommend a read-only login.
- Chat with progress and error states; show generated SQL; explicit user action to execute; page of 20 rows with the remaining count; procedure scripts are saved automatically and can be deleted.

### D8 `[portal]` Render DSL, save artifacts, dashboards with drag-and-drop (SR-6, SR-7, SR-8)
- Render DSL via `lib/dsl-renderer-angular` with live rows; error state when a bound column is missing (user re-prompts).
- Save artifact explicitly; add to dashboard; draggable/resizable wrapper around each item with its own surface; layout persisted.
- Dashboards only here (not in the portal).

## Phase 2 (after phase 1)

### D9 `[lib]` Custom A2UI catalog with Chart.js chart (follow-up)
- Custom catalog extending the basic catalog with its own `catalogId`; `EsiChart` as in the chart proposal in the UR file (bar, line, pie; `categoryKey`, `series`; accessibility fallback table).
- Needs the chart ADR first.

### D10 `[agents]` and `[portal]` chart support (follow-up)
- Agent: allow `EsiChart` with validation of numeric `valueKey` columns; portal: render and "view as table".

## Cross-cutting before production (no issue filed yet)
- Admin approval of consent terms; real authentication replacing the assumed admin; key-management review; read-only login recommendation shown to users.
