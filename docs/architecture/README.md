---
id: adr-index
type: index
updated: 2026-10-23
keywords: [adr, architecture decision record, decisions, template]
---

# Architecture decision records

One decision per file: `ADR-NNNN-short-title.md`. Breaking changes to a contract or the DSL, and any decision touching more than one project, need an ADR (root `CLAUDE.md`, rule 4).

## Index

| ADR | Title | Status | Projects | Needed by |
|-----|-------|--------|----------|-----------|
| [ADR-0001](./ADR-0001-technology-baseline.md) | Technology baseline and versions (app database row superseded by ADR-0008) | Accepted | all | P0-06..P0-10 (scaffolds) |
| [ADR-0002](./ADR-0002-a2ui-dsl-adoption-and-storage.md) | A2UI adoption and DSL storage model | Accepted | lib, agents, core, portal | ESI-14, ESI-17, ESI-18, ESI-20 |
| [ADR-0003](./ADR-0003-connection-secret-key-management.md) | Connection secret encryption and key management | Accepted | core | ESI-15 |
| [ADR-0004](./ADR-0004-sql-validation-and-execution-policy.md) | SQL validation and execution policy | Accepted | core, agents | ESI-16, ESI-18 |
| [ADR-0005](./ADR-0005-hosting-target.md) | Hosting target for the demo: Vercel Hobby, Azure Container Apps, Azure SQL free offer | Proposed | portal, core, agents | demo deployment |
| [ADR-0006](./ADR-0006-authentication-provider.md) | Authentication provider: Auth0 through standard OIDC | Proposed | contracts, core, portal | demo deployment (ADR-0005) |
| [ADR-0007](./ADR-0007-model-provider.md) | Model provider for the agents: Gemini API free tier (demo) | Accepted | agents | ESI-89, demo deployment (ADR-0005) |
| [ADR-0008](./ADR-0008-app-database-postgresql.md) | App database on PostgreSQL (target databases stay SQL Server) | Proposed | core | ESI-94 |
| [ADR-0009](./ADR-0009-chart-component-and-library.md) | Chart component and library: `EsiChart` on Chart.js in a custom A2UI catalog | Proposed | lib, contracts, core, agents, portal | ESI-10, ESI-11, ESI-12 |

ADR-0005, ADR-0006 and ADR-0008 are still `Proposed` although ESI-72, ESI-85..ESI-87 and ESI-94 implement them (each PR says so); a human accepts them by changing the status in a PR.

## Rules

- An ADR is `Proposed` until a human accepts it (change status in a PR). Do not implement against a `Proposed` ADR without saying so in the PR.
- Never edit an accepted ADR's decision; write a new ADR and mark the old one `Superseded by ADR-NNNN`.
- Cite ADRs by ID in code comments, PRs and issues.

## Template

```markdown
---
id: ADR-NNNN
type: adr
status: Proposed
date: YYYY-MM-DD
projects: [..]
issues: [ESI-n]
keywords: [..]
---

# ADR-NNNN <title>

## Context
Facts and constraints, with links to requirements and rules. No opinions.

## Options
1. <option> - pros, cons
2. <option> - pros, cons

## Decision
What we do, in one short paragraph, then bullet details others must follow.

## Consequences
Positive, negative, follow-up work, what becomes harder.

## Verification
How we know it holds: tests, checks, evals, lint rules.

## Open questions
Anything a human must still decide.
```
