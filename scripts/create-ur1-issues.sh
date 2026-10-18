#!/usr/bin/env bash
# Creates the UR-1 system requirement issues (D1..D8, phase 1) from docs/requirements/UR-1-issue-drafts.md.
# Default is a dry run. Use --apply to create issues. Needs: gh (authenticated, repo scope), jq.
# Phase 1 (ESI-13..ESI-20) is already filed; --apply again would create duplicates.
# Usage: scripts/create-ur1-issues.sh [--apply] [--with-phase2]
set -euo pipefail

REPO="dtnam0899/edge-side-includes"
PARENT=1
LABEL="System Requirement"
APPLY=0
PHASE2=0
for a in "$@"; do
  case "$a" in
    --apply) APPLY=1 ;;
    --with-phase2) PHASE2=1 ;;
    *) echo "Unknown option: $a" >&2; exit 2 ;;
  esac
done

if [ "$APPLY" -eq 1 ]; then
  command -v gh >/dev/null || { echo "gh is not installed" >&2; exit 1; }
  command -v jq >/dev/null || { echo "jq is not installed" >&2; exit 1; }
  gh auth status >/dev/null || { echo "Run 'gh auth login' first" >&2; exit 1; }
  gh label create "$LABEL" --repo "$REPO" --color 1d76db \
    --description "A User Requirement analyzed into a concrete technical feature" 2>/dev/null || true
  PARENT_ID=$(gh api "repos/$REPO/issues/$PARENT" --jq .id)
fi

# create_issue <project code> <title> <body>
create_issue() {
  local project="$1" title="$2" body="$3"
  body="$body

---
Parent: #$PARENT. Analysis: docs/requirements/UR-1-bi-ai-assistant-web-application.md. Drafts: docs/requirements/UR-1-issue-drafts.md."
  if [ "$APPLY" -eq 0 ]; then
    printf '\n=== [%s] %s ===\n%s\n' "$project" "$title" "$body"
    return
  fi
  local url num id
  url=$(gh issue create --repo "$REPO" --label "$LABEL" --title "[$project] $title" --body "$body")
  num="${url##*/}"
  gh issue edit "$num" --repo "$REPO" --title "ESI-$num [$project] $title" >/dev/null
  id=$(gh api "repos/$REPO/issues/$num" --jq .id)
  gh api -X POST "repos/$REPO/issues/$PARENT/sub_issues" -F sub_issue_id="$id" >/dev/null \
    || echo "Could not link #$num as a sub-issue of #$PARENT; link it manually." >&2
  echo "Created ESI-$num [$project] $title -> $url"
}

create_issue contracts "Define core-api and agents-api for the BI assistant" "$(cat <<'EOF'
Covers SR-1..SR-9 (API surface). Release first; consumers pin the published version.

## Scope
- core-api operations (names set in the spec): connections (create/test/update/delete/list), consent (accept/withdraw), schema metadata, chat sessions, SQL generation request, SQL execution with paging (page size 20, remaining count), saved artifacts, dashboards with item layout.
- agents-api operations: generate SQL, generate DSL from column definitions (no row values).
- Errors use problem+json; "consent withdrawn" and "DSL validation failed" are distinct documented errors.
- No connection string or secret appears in any response.

## Acceptance criteria
- [ ] Specs lint and are published as the first minor version.
- [ ] Consumers (`lib/api-client`, `core`, `agents`) can pin and generate from it.
- [ ] Execution response includes columns, page rows, page number and remaining row count.
EOF
)"

create_issue lib "Pin A2UI v0.9.1, add DSL validator and Angular renderer wrapper" "$(cat <<'EOF'
Covers SR-5 and SR-6. Release before core, agents and portal.

## Scope
- Pin the A2UI v0.9.1 basic catalog and `@a2ui/angular` at a fixed version; record the protocol/renderer version pair. Use the exact `catalogId` string from the pinned catalog file, covered by a test.
- `dsl-core`: validate against the A2UI JSON Schema plus ESI checks: unique component ids, a `root` component, bound paths exist in the column definitions, no unknown component or function.
- `dsl-renderer-angular`: wrap `@a2ui/angular`; build the message sequence `createSurface`, stored `updateComponents`, `updateDataModel` (rows at `/rows`, paging at `/page`). Copy upstream code only when a patch is unavoidable, recording version/commit and keeping edits separate.
- Fixtures/tests: table (List template with relative paths) and KPI (Card, Text, formatNumber).
- Out of scope: forms, charts. Requires Angular 21+ in the portal (peer dependency of `@a2ui/angular`).
- Document component selection rules in `docs/dsl/`; update the `dsl-authoring` and `dsl-renderer-parity` skills after the A2UI ADR.

## Acceptance criteria
- [ ] Invalid DSL is rejected before rendering; DSL values are never interpreted as HTML or code.
- [ ] Table and KPI fixtures render and are tested by behavior.
- [ ] A missing bound column renders an error state, not empty data.
EOF
)"

create_issue core "Connections, consent and encrypted storage" "$(cat <<'EOF'
Covers SR-1 and SR-9. Depends on the contracts issue.

## Scope
- Users manage only their own SQL Server connections (add/test/update/delete/list); other users cannot see or use them.
- Consent is required before a connection string can be added; record user, terms version, time. Withdrawing consent for a database hides all its data (chat history, scripts, artifacts, dashboards) and disables its features; consenting again restores them.
- Envelope encryption: per-secret AES-256-GCM data key wrapped by a master key supplied from the environment (GitHub secret at deploy time); key version for rotation; decrypt only at the moment of use.
- Local test mode assumes an admin user. Real authentication is a production prerequisite, tracked separately.

## Acceptance criteria
- [ ] No connection string, key or secret appears in responses, errors or logs.
- [ ] Owner isolation and withdrawn-consent blocking are covered by tests for every operation.
- [ ] Connection test returns a useful non-secret error.
EOF
)"

create_issue core "Schema discovery and read-only SQL execution" "$(cat <<'EOF'
Covers SR-1 and SR-4. Depends on the connections/consent issue.

## Scope
- Schema metadata: schemas, tables/views, columns, types, and existing stored procedure definitions as read-only context.
- Statement validation: only a single SELECT is accepted. Reject writes, DDL, EXEC/procedure calls, multiple statements, SELECT ... INTO, OPENROWSET/linked-server constructs. Use an allow-list parser.
- Configurable command timeout (default 30s); a timeout is an error.
- Paged execution: 20 rows per page with the remaining count; never load the whole result.
- Inline application log of executed SQL (user, connection id, time, duration, outcome, statement); no results or secrets.
- Recommend a read-only database login in the connection documentation.

## Acceptance criteria
- [ ] A test corpus of bypass attempts is rejected; valid SELECTs run.
- [ ] Execution needs an explicit user request and a connection with active consent.
- [ ] Failures are returned as errors, never as empty successful results.
EOF
)"

create_issue core "Chat sessions, saved artifacts and dashboards" "$(cat <<'EOF'
Covers SR-2, SR-7 and SR-8. Depends on the SQL execution issue.

## Scope
- Persist chat sessions per user and connection.
- Persist artifacts: DSL components, the SELECT, expected column definitions, catalogId, DSL schema version. No row data, no secrets.
- Persist dashboards with item layout (position, size), private to the owner.
- Opening a dashboard returns layout and artifacts; each saved SELECT is executed through the same policy and paging as the SQL execution issue; one failing item does not block others.
- Items of a database with withdrawn consent are hidden and restored with consent.

## Acceptance criteria
- [ ] Other users cannot read or modify sessions, artifacts or dashboards.
- [ ] A deleted connection or withdrawn consent gives an unavailable state, never stale data.
- [ ] Layout changes are saved and restored.
EOF
)"

create_issue agents "SQL and DSL generation with safety rules and evals" "$(cat <<'EOF'
Covers SR-3 and SR-5. Depends on the contracts and lib issues.

## Scope
- Generate SQL Server SQL from the question and schema; output is either a query or a procedure script, with assumptions explained.
- Rules (prompt and output check): may read existing procedure definitions but never execute them; new procedures are scripts only with read-only bodies; SQL for execution is a single SELECT.
- Generate DSL from column definitions only (never row values), using only the pinned A2UI basic catalog. Refuse forms and charts in phase 1 with a clear message and offer a table or KPI.
- On validation errors, retry at most 2 times (configurable), then fail clearly; invalid DSL is never returned as success.
- Evals in `evals/`.

## Acceptance criteria
- [ ] Evals cover grounded identifiers, write/DDL/EXEC refusals, no executed procedures, invalid-DSL handling, form and chart refusal.
- [ ] No row values or secrets are sent to the model.
EOF
)"

create_issue portal "Chat, connection and consent UI, SQL review and paged results" "$(cat <<'EOF'
Covers SR-1, SR-2 and SR-4. Depends on the contracts and core issues.

## Scope
- Selecting a connected database shows the user's chat sessions and the list of dashboards; a database with withdrawn consent is not accessible.
- Add/edit/delete a connection with the consent step; show the read-only login recommendation.
- Chat with progress, success and error states; show generated SQL; executing requires an explicit user action.
- Results: 20 rows per page with pagination and the remaining count.
- Generated procedure scripts are saved automatically and can be deleted by the user.

## Acceptance criteria
- [ ] The UI never presents generated SQL as executed unless it ran.
- [ ] Withdrawing consent removes access to the database's chat history and features at once.
EOF
)"

create_issue portal "Render DSL, save artifacts and drag-and-drop dashboards" "$(cat <<'EOF'
Covers SR-6, SR-7 and SR-8. Depends on the lib and core issues.

## Scope
- Render DSL through `lib/dsl-renderer-angular` with live rows; show an error state when a bound column is missing (the user prompts again; no regeneration).
- Save an artifact explicitly; add saved artifacts to a personal dashboard.
- Each item renders in its own surface inside a draggable and resizable wrapper; layout is persisted. Dashboards appear only inside the assistant module; it stays independent of other portal modules (see web/esi-portal/CLAUDE.md).
- KPI totals come from SQL aggregates, not from the visible page.

## Acceptance criteria
- [ ] One failing item does not affect the others.
- [ ] Moving or resizing an item survives reopening the dashboard.
EOF
)"

if [ "$PHASE2" -eq 1 ]; then
create_issue lib "Custom A2UI catalog with Chart.js chart component" "$(cat <<'EOF'
Phase 2. Needs the chart ADR first.

## Scope
- Custom catalog extending the basic catalog with its own catalogId; `EsiChart` wrapping Chart.js.
- Types: bar, line, pie (pie: one series, about 8 categories maximum).
- Properties: chartType, title, categoryKey, series [{valueKey, label}], data bound to /rows. No data values in the DSL.
- Validation: keys exist in the column definitions, value columns are numeric.
- Accessibility: text alternative, "view as table" toggle, series distinguishable without color alone; colors from `lib/ui-tokens`; labels drawn as text only.
- Chart uses the current 20-row page and says "first 20 of N rows".
EOF
)"

create_issue agents "Generate chart DSL with EsiChart" "$(cat <<'EOF'
Phase 2. Depends on the chart catalog issue in lib.

## Scope
- Allow the EsiChart component; validate that value columns are numeric; prefer SQL aggregates; fall back to a bar chart when pie limits are exceeded.
- Add evals for chart generation and refusal cases.
EOF
)"

create_issue portal "Render charts and view-as-table" "$(cat <<'EOF'
Phase 2. Depends on the chart catalog issue in lib.

## Scope
- Render EsiChart in chat and dashboards, with the "first 20 of N rows" caption and the view-as-table toggle.
EOF
)"
fi

[ "$APPLY" -eq 1 ] || echo; [ "$APPLY" -eq 1 ] || echo "Dry run only. Re-run with --apply to create the issues."
