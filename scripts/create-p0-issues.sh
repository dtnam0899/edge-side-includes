#!/usr/bin/env bash
# Creates the Phase 0 foundation issues (P0-01..P0-14) from docs/plan/phase-0-foundation.md.
# Default is a dry run. Use --apply to create issues. Needs: gh (authenticated, repo scope), jq.
# Safe to re-run: a task whose "(P0-NN)" tag already appears in an existing issue title is skipped.
# Usage: scripts/create-p0-issues.sh [--apply]
# Note: project code "esi" means the whole repository (work outside a single project).
set -euo pipefail

REPO="dtnam0899/edge-side-includes"
PARENT=1
LABEL="Foundation Task"
APPLY=0
for a in "$@"; do
  case "$a" in
    --apply) APPLY=1 ;;
    *) echo "Unknown option: $a" >&2; exit 2 ;;
  esac
done

EXISTING=""
if [ "$APPLY" -eq 1 ]; then
  command -v gh >/dev/null || { echo "gh is not installed" >&2; exit 1; }
  command -v jq >/dev/null || { echo "jq is not installed" >&2; exit 1; }
  gh auth status >/dev/null || { echo "Run 'gh auth login' first" >&2; exit 1; }
  gh label create "$LABEL" --repo "$REPO" --color 5319e7 \
    --description "Phase 0 foundation work (decisions, scaffolds, CI, publishing)" 2>/dev/null || true
  EXISTING=$(gh issue list --repo "$REPO" --state all --limit 1000 --json title --jq '.[].title')
fi

# create_issue <task id> <project code> <title> <body>
create_issue() {
  local id="$1" project="$2" title="$3" body="$4"
  body="$body

---
Task: $id in docs/plan/phase-0-foundation.md. Plan: docs/plan/README.md. Parent: #$PARENT. Definition of done for every Phase 0 task: branch \`type/ESI-<n>-short-description\`, commit \`type(project): subject\` with \`Refs: ESI-<n>\`; documented commands work from the project directory and in Docker; no cross-project paths or references; no secrets, \`.env\` files or invented versions committed."
  if [ "$APPLY" -eq 0 ]; then
    printf '\n=== [%s] %s (%s) ===\n%s\n' "$project" "$title" "$id" "$body"
    return
  fi
  if printf '%s\n' "$EXISTING" | grep -qF "($id)"; then
    echo "Skipped $id: an issue with this tag already exists"
    return
  fi
  local url num gid
  url=$(gh issue create --repo "$REPO" --label "$LABEL" --title "[$project] $title ($id)" --body "$body")
  num="${url##*/}"
  gh issue edit "$num" --repo "$REPO" --title "ESI-$num [$project] $title ($id)" >/dev/null
  gid=$(gh api "repos/$REPO/issues/$num" --jq .id)
  gh api -X POST "repos/$REPO/issues/$PARENT/sub_issues" -F sub_issue_id="$gid" >/dev/null \
    || echo "Could not link #$num as a sub-issue of #$PARENT; link it manually." >&2
  echo "Created ESI-$num [$project] $title ($id) -> $url"
}

create_issue P0-01 esi "Clean up superseded GitHub issues" "$(cat <<'EOF'
No dependencies.

## Scope
- Close ESI-2..ESI-9 with the comment "superseded by ESI-13..ESI-20" (they were filed before the structure change; ESI-3 still mentions `@a2ui/react`).
- Retitle ESI-12 from `[assistant]` to `[portal]`; keep ESI-10 and ESI-11 open (phase 7, charts).
- Update the "Filed issues" table in docs/requirements/UR-1-bi-ai-assistant-web-application.md and docs/requirements/UR-1-issue-drafts.md.

## Acceptance criteria
- [ ] GitHub shows ESI-10..ESI-20 as the open UR-1 sub-issues.
- [ ] The requirement docs match GitHub.
EOF
)"

create_issue P0-02 esi "Review and accept ADR-0001 technology baseline" "$(cat <<'EOF'
No dependencies. Blocks the scaffold tasks P0-06..P0-10 and P0-13.

## Scope
- Review docs/architecture/ADR-0001-technology-baseline.md.
- Verify every version in its table against official release pages (.NET LTS, Angular 21 or newer for `@a2ui/angular` peers, Nx compatible with that Angular, Python, SQL Server image, code generators).
- Answer its open questions (model provider and agent framework, app database engine, hosting) or record them as deferred.
- Set the status to Accepted in a PR and update the ADR index in docs/architecture/README.md.

## Acceptance criteria
- [ ] No unverified version remains in the accepted ADR.
- [ ] The ADR index shows Accepted.
EOF
)"

create_issue P0-03 esi "Review and accept ADR-0002 A2UI adoption and DSL storage" "$(cat <<'EOF'
No dependencies. Blocks P0-13 and the DSL issues (ESI-14, ESI-17, ESI-18, ESI-20).

## Scope
- Review docs/architecture/ADR-0002-a2ui-dsl-adoption-and-storage.md.
- Decide whether `core-backend` validates DSL itself or stores DSL validated by the producer (AI output is untrusted per SR-9).
- Decide the A2UI upgrade policy.
- Set the status to Accepted in a PR and update the ADR index.

## Acceptance criteria
- [ ] Open questions are answered or explicitly deferred.
- [ ] The ADR index shows Accepted.
EOF
)"

create_issue P0-04 esi "Review and accept ADR-0003 connection secret key management" "$(cat <<'EOF'
No dependencies. Blocks P0-13 and ESI-15.

## Scope
- Review docs/architecture/ADR-0003-connection-secret-key-management.md.
- Decide where wrapped data keys are stored, name the master key environment variables, and assign master key backup ownership.
- Confirm that a managed key store is reconsidered in the production readiness phase.
- Set the status to Accepted in a PR and update the ADR index.

## Acceptance criteria
- [ ] Open questions are answered or explicitly deferred.
- [ ] The ADR index shows Accepted.
EOF
)"

create_issue P0-05 esi "Review and accept ADR-0004 SQL validation and execution policy" "$(cat <<'EOF'
No dependencies. Blocks P0-13, ESI-16 and ESI-18.

## Scope
- Review docs/architecture/ADR-0004-sql-validation-and-execution-policy.md.
- Decide the allow-list of functions, whether user-defined functions are allowed, whether logged SQL literals are masked, and any maximum cell or result size.
- Set the status to Accepted in a PR and update the ADR index.

## Acceptance criteria
- [ ] Open questions are answered or explicitly deferred.
- [ ] The ADR index shows Accepted.
EOF
)"

create_issue P0-06 contracts "Scaffold contracts project" "$(cat <<'EOF'
Depends on P0-02.

## Scope
- `core-api/` and `agents-api/` OpenAPI 3.x skeletons (title, `info.version` 0.0.0, no paths), shared `problem+json`, paging and error schemas, Spectral ruleset.
- `package.json` for `@dtnam0899/esi-contracts`, `.npmrc` reading `NODE_AUTH_TOKEN`, `Dockerfile`, `.dockerignore`, `CHANGELOG.md`.
- Document verified lint, breaking-change check (oasdiff) and `docker build` commands in services/contracts/CLAUDE.md.
- CI with a path filter on `services/contracts/**` running the Docker build.
- Out of scope: any real API operation (ESI-13).

## Acceptance criteria
- [ ] Lint and pack pass in Docker.
- [ ] No placeholders remain in services/contracts/CLAUDE.md.
EOF
)"

create_issue P0-07 lib "Scaffold Nx workspace and packages" "$(cat <<'EOF'
Depends on P0-02.

## Scope
- Packages `dsl-schema`, `dsl-core`, `dsl-renderer-angular`, `api-client`, `ui-tokens`, each with a manifest, a placeholder export and a unit test.
- Nx module-boundary tags as in lib/CLAUDE.md (`scope:schema` <- `scope:core` <- `scope:renderer`, `scope:tokens`, `scope:api`, `framework:angular`).
- `nx release` with independent versions, conventional commits, tags `lib-<package>@vX.Y.Z`, registry https://npm.pkg.github.com; `.npmrc` reads `NODE_AUTH_TOKEN`.
- `Dockerfile` that builds and tests the workspace without other projects.
- Out of scope: DSL logic (ESI-14).

## Acceptance criteria
- [ ] `nx run-many -t build test lint` passes in Docker.
- [ ] A deliberately forbidden import fails lint (kept as a test).
- [ ] `nx release --dry-run` works.
EOF
)"

create_issue P0-08 core "Scaffold core-backend with test SQL Server" "$(cat <<'EOF'
Depends on P0-02.

## Scope
- API, domain/application and test projects (layout from ADR-0001), `Directory.Build.props` `<Version>`, `CHANGELOG.md`.
- Health endpoint, structured logging with a redaction filter, configuration only from environment variables, user-secrets for local use.
- EF Core migrations folder and an application database (separate from the target databases of users).
- `compose.yaml` with the application database and a pinned SQL Server container that stands in for the target database of a user in integration tests.
- `Dockerfile`: sdk -> aspnet, non-root user, HEALTHCHECK, `dotnet restore --locked-mode`.
- Out of scope: connections, consent, SQL execution (ESI-15, ESI-16).

## Acceptance criteria
- [ ] `dotnet build`, `dotnet test` and `docker compose up` work from services/core-backend.
- [ ] The health endpoint returns 200 in the container.
- [ ] No placeholders remain in services/core-backend/CLAUDE.md.
EOF
)"

create_issue P0-09 agents "Scaffold ai-agents with eval harness" "$(cat <<'EOF'
Depends on P0-02.

## Scope
- Python project from ADR-0001: `pyproject.toml` with a lock file, package layout (agents, tools, prompts), health endpoint, configuration from environment variables.
- `pytest` and `ruff` set up.
- `evals/` runner skeleton: loads cases from files, runs a deterministic stub model, reports pass/fail per case, exits non-zero on failure.
- `Dockerfile` (slim image installed from the lock file) and `compose.yaml` if needed.
- Out of scope: prompts, SQL or DSL generation (ESI-18). The model provider is decided in ADR-0001.

## Acceptance criteria
- [ ] `pytest -q`, `ruff check . && ruff format --check .` and the Docker build pass.
- [ ] The eval runner executes with the stub model.
- [ ] No placeholders remain in services/ai-agents/CLAUDE.md.
EOF
)"

create_issue P0-10 portal "Scaffold Angular portal and module boundaries" "$(cat <<'EOF'
Depends on P0-02.

## Scope
- Angular app (version from ADR-0001, 21 or newer) with `core` and `shared` folders and a lazy-loaded `assistant` feature module that exposes only its routes.
- Lint rule restricting imports between feature folders (module rules in web/esi-portal/CLAUDE.md); a check fails if one feature imports the internals of another.
- `.npmrc` for the registry, runtime configuration injected at start (not at build), `Dockerfile` (Node build, small web server runtime), `compose.yaml`.
- Write the chosen folder layout into web/esi-portal/CLAUDE.md.
- Out of scope: chat, connections, DSL rendering (ESI-19, ESI-20).

## Acceptance criteria
- [ ] `npm ci`, `npm test -- --watch=false --browsers=ChromeHeadless`, `npm run lint`, `npm run build` and the Docker build pass.
- [ ] A cross-feature import fails lint.
- [ ] No placeholders remain in web/esi-portal/CLAUDE.md.
EOF
)"

create_issue P0-11 esi "Configure GitHub registry, secrets and branch protection" "$(cat <<'EOF'
No dependencies. Blocks P0-12.

## Scope
- Confirm GitHub Packages permissions for the `@dtnam0899` scope; define `ESI_PACKAGE_REGISTRY_URL`, `ESI_IMAGE_REGISTRY` and `NODE_AUTH_TOKEN` handling in CI (`GITHUB_TOKEN` in CI, a PAT with `read:packages` locally). Document it; never commit tokens.
- Branch protection on `main`: pull request required, one approval, required CI, no force push.
- Labels `User Requirement`, `System Requirement` and `Foundation Task` exist; issue and PR templates follow `ESI-<n> [PROJECT] <title>`.
- Create no master key now; the ADR-0003 master key is created later for deployment environments only.

## Acceptance criteria
- [ ] A test PR cannot be merged without approval and passing CI.
- [ ] Registry and token setup is documented without any secret value.
EOF
)"

create_issue P0-12 esi "Prove publish and pinned-install flow with a prerelease" "$(cat <<'EOF'
Depends on P0-06, P0-07 and P0-11.

## Scope
- Publish a prerelease of `@dtnam0899/esi-contracts` and one `lib` package from CI (`nx release --preid` for lib).
- Install them at a pinned version in a throwaway portal step and in a Docker build stage (as contracts consumers will), with no path references.
- Write the verified process into the project CLAUDE.md files; then deprecate or remove the prerelease.

## Acceptance criteria
- [ ] Both packages install by version from the registry in a clean container.
- [ ] The process is documented and the prerelease is cleaned up.
EOF
)"

create_issue P0-13 esi "Update skills and project docs after the ADRs" "$(cat <<'EOF'
Depends on P0-02, P0-03, P0-04 and P0-05.

## Scope
- Replace every placeholder in the project CLAUDE.md files with verified facts from ADR-0001 and the scaffolds.
- Update .claude/skills/dsl-authoring/SKILL.md and dsl-renderer-parity/SKILL.md to match ADR-0002 (A2UI basic catalog, stored `updateComponents`, no custom table/chart/form nodes).
- Create docs/dsl/README.md with component selection rules (table = `List` with template, KPI = `Card` + `Text`).
- Update the docs index if folders change.

## Acceptance criteria
- [ ] No `<verified command>` or `<version>` placeholder remains in scaffolded projects.
- [ ] The DSL skills and docs/dsl/ agree with the accepted ADR-0002.
EOF
)"

create_issue P0-14 esi "Define test data policy per project" "$(cat <<'EOF'
Depends on P0-08 and P0-09.

## Scope
- Core owns the SQL Server test container and a sample schema script (related tables, plus one stored procedure to exercise "read the definition, never execute it").
- Agents do not depend on core: their evals use a static schema-metadata fixture committed inside services/ai-agents/evals/ and regenerated from the published contract.
- Portal uses mocked API responses generated from the contract examples.
- The CLAUDE.md of each project states its fixture location; no project reads files of another project.

## Acceptance criteria
- [ ] Fixture locations are documented in each project.
- [ ] No project reads fixtures from another project by path.
EOF
)"

[ "$APPLY" -eq 1 ] || echo; [ "$APPLY" -eq 1 ] || echo "Dry run only. Re-run with --apply to create the issues."
