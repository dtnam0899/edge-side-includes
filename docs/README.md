---
id: docs-index
type: index
updated: 2026-10-18
keywords: [docs, index, map, where to find, agents, adr, requirements, plan]
---

# ESI documentation index

Entry point for humans and AI agents. Read this first, then open only the file you need.

## Where to find what

| Question | Go to |
|----------|-------|
| What does the assistant do today, feature by feature (flows, API, rules, status)? | [features/](./features/README.md) |
| What does the user want and what was decided? | [requirements/](./requirements/README.md) (UR-1 analysis, decisions, filed issues) |
| How do we go from a new UR to analyzed SRs and tasks? | [process/](./process/README.md) (stages, gates, roles, change handling) and [process/templates.md](./process/templates.md) |
| In which order do we build it? What is the next task? | [plan/](./plan/README.md) (roadmap, phases, dependencies) |
| Which tasks make up the foundation phase? | [plan/phase-0-foundation.md](./plan/phase-0-foundation.md) |
| Why was a technical choice made? | [architecture/](./architecture/README.md) (ADR index and template) |
| What is the HTTP API? | `api/` (empty until the contracts project publishes; the source of truth is `services/contracts`) |
| What is the UI DSL? | [dsl/](./dsl/README.md) (A2UI v0.9 basic catalog, pinned versions, component selection; source of truth is `lib/dsl-schema`) |
| Registry, tokens, repository variables, branch protection? | [process/github-setup.md](./process/github-setup.md) |
| Where does test data live? | [process/test-data.md](./process/test-data.md) |
| How do I work in one project? | that project's `CLAUDE.md` (`services/*`, `web/esi-portal`, `lib`) |
| Repo-wide rules (independence, Docker, versioning, workflow) | root [CLAUDE.md](../CLAUDE.md) and `.claude/skills/esi-project-standards/SKILL.md` |

## Folder map

```
docs/
  README.md            this file
  features/            implemented features: flows, API, rules, verification, status
  requirements/        UR/SR analysis, flows, decisions, issue drafts (source: GitHub tickets)
  process/             standard process from UR to tasks, gates, templates
  plan/                roadmap and per-phase task lists with dependencies
  architecture/        ADRs (one decision per file, numbered ADR-NNNN)
  api/                 API docs (generated or summarized from published contracts)
  dsl/                 DSL docs (component selection rules, catalog notes)
```

## Conventions for documents (so agents can search them)

- Every doc starts with front matter: `id`, `type` (`index`, `plan`, `adr`, `requirement`, ...), `status`, `projects`, `issues`, `keywords`.
- Stable IDs: ADRs are `ADR-NNNN`, foundation tasks are `P0-NN`, filed issues are `ESI-<n>`, system requirements are `SR-n`. Always cite these IDs instead of paraphrasing, so one `grep` finds every mention.
- One topic per file; link to the neighbor instead of copying text. GitHub tickets are the source of truth for wording, `docs/` holds the analysis and decisions.
- Statuses: ADRs use `Proposed | Accepted | Superseded by ADR-NNNN | Rejected`; tasks use `Draft | Filed (ESI-n) | Done`.
- Facts that were not verified are marked `TBD` or listed under "Open questions"; never invent versions, routes or package names.

## Quick lookups

- Find a decision: `grep -rn "ADR-0003" docs`
- Find everything about an issue: `grep -rn "ESI-15" docs`
- Find a foundation task: `grep -rn "P0-" docs/plan`
