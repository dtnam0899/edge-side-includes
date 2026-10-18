---
id: adr-index
type: index
updated: 2026-10-18
keywords: [adr, architecture decision record, decisions, template]
---

# Architecture decision records

One decision per file: `ADR-NNNN-short-title.md`. Breaking changes to a contract or the DSL, and any decision touching more than one project, need an ADR (root `CLAUDE.md`, rule 4).

## Index

| ADR | Title | Status | Projects | Needed by |
|-----|-------|--------|----------|-----------|
| [ADR-0001](./ADR-0001-technology-baseline.md) | Technology baseline and versions | Accepted | all | P0-06..P0-10 (scaffolds) |
| [ADR-0002](./ADR-0002-a2ui-dsl-adoption-and-storage.md) | A2UI adoption and DSL storage model | Proposed | lib, agents, core, portal | ESI-14, ESI-17, ESI-18, ESI-20 |
| [ADR-0003](./ADR-0003-connection-secret-key-management.md) | Connection secret encryption and key management | Proposed | core | ESI-15 |
| [ADR-0004](./ADR-0004-sql-validation-and-execution-policy.md) | SQL validation and execution policy | Proposed | core, agents | ESI-16, ESI-18 |

Planned, not written yet: chart component and library (phase 7, before ESI-10); authentication provider (phase 6).

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
