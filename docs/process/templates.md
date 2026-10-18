---
id: process-templates
type: process
status: Proposed
updated: 2026-10-18
projects: [esi]
keywords: [templates, ur, sr, issue draft, task, plan, ids, naming, checklist]
---

# Templates and naming

Used by the [process](./README.md). GitHub issue and PR forms live in `.github/` and follow these templates.

## IDs and names

| Thing | Format | Example |
|-------|--------|---------|
| UR issue title | `ESI-<n> [UR] <title>` | `ESI-1 [UR] BI AI Assistant web application` |
| UR doc | `docs/requirements/UR-<n>-<slug>.md` | `UR-1-bi-ai-assistant-web-application.md` |
| System requirement (analysis unit) | `SR-<k>`, local to a UR doc | `SR-4` |
| Draft | `D<k>` in the drafts file; cite as `UR-<n>/D<k>` | `UR-1/D4` |
| Enabler draft | `E<k>`, cite as `UR-<n>/E<k>` | `UR-2/E1` |
| Foundation task (first UR only) | `P0-NN` | `P0-08` |
| Filed SR issue | `ESI-<n> [project] <title>` | `ESI-16 [core] Schema discovery and read-only SQL execution` |
| Project codes | `core`, `agents`, `contracts`, `portal`, `lib`, `esi` | |
| ADR | `ADR-NNNN-short-title.md` | `ADR-0004` |
| Labels | `User Requirement`, `System Requirement`, `Foundation Task` | |
| Branch / commit / PR | see `esi-workflow` | |

Document front matter (all docs): `id`, `type`, `status`, `updated`, `projects`, `issues`, `keywords`. Always cite IDs so `grep` finds every mention.

## UR issue body

```markdown
## Goal
As <user or role>, I want <capability> so that <benefit>.

## Problem
<what is wrong or missing today, in user terms>

## Scope (rough)
- In: ...
- Out (if known): ...

## Notes
<links, examples, references; open questions are welcome here>
```

## UR analysis doc

Use the template in [requirements/README.md](../requirements/README.md): header, SR table (with "Filed in"), flows (swimlane and sequence, as-is and to-be), findings, numbered decisions, open questions.

Add a "Status" line at the top: date verified against GitHub, commit, which issues are filed.

## Issue draft (in `UR-<n>-issue-drafts.md`)

```markdown
### D<k> `[project]` <title> (SR-x, SR-y)
- Depends on: D<j>, ADR-NNNN
- Scope: <bullets of behavior and files/areas>
- Out of scope: <bullets>
- Version impact: <none | contract minor | contract major + ADR | DSL ...>
- Acceptance criteria:
  - [ ] <testable statement>
  - [ ] <security or failure case>
- Tests/evals: <what proves it>
```

Also in the drafts file: release order, filing status table (draft, issue, note), phases, cross-cutting items not yet filed.

## SR issue body (as filed)

```markdown
Covers SR-x, SR-y. Depends on ESI-<n> (<short name>). ADRs: ADR-NNNN.

## Scope
- ...

## Out of scope
- ...

## Acceptance criteria
- [ ] ...

---
Parent: #<UR>. Draft: UR-<n>/D<k>. Analysis: docs/requirements/UR-<n>-<slug>.md. Plan: docs/plan/README.md.
```

## Plan (`docs/plan/README.md`)

Phase table (goal, issues, needs, exit gate), a Mermaid dependency graph, "how an agent picks the next task", out-of-scope list. One plan per repo; each UR adds its phases to the table.

## PR description

```markdown
Closes ESI-<n>.
Project: <code>. Release impact: <none | contract/DSL/package version>.

## What changed
## How it was tested
## Acceptance criteria
- [ ] ...
## Checklist
- [ ] Independence checklist (no cross-project paths or references)
- [ ] Docs and project CLAUDE.md updated if needed
- [ ] No secrets committed
```

## Tasks file for the filing script

`scripts/file-issues.sh` reads a markdown file where each task starts with a heading `## <ID> | <project> | <title>`. Everything until the next task heading is the issue body. The ID (`D<k>`, `E<k>`, `P<n>-NN`) becomes the `(<ID>)` tag in the title, which makes re-runs skip filed tasks.

```markdown
## D3 | core | Add consent endpoints
Depends on D1.

## Scope
- ...

## Acceptance criteria
- [ ] ...
```

Only headings of the form `## a | b | c` start a new task, so ordinary `## Scope` lines inside a body are fine.

```bash
scripts/file-issues.sh --file docs/requirements/UR-2-tasks.md --parent 40 --label "System Requirement"          # dry run
scripts/file-issues.sh --file docs/requirements/UR-2-tasks.md --parent 40 --label "System Requirement" --apply
```
