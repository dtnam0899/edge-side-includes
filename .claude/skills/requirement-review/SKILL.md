---
name: requirement-review
description: Read and review GitHub requirement tickets (labels "User Requirement" and "System Requirement") against the project skills, then update docs/requirements and the project skills. Use when the user asks to read, analyze, review or sync tickets related to requirements.
---

# Requirement review

Ticket hierarchy in GitHub (repo `dtnam0899/edge-side-includes`). The full lifecycle (intake, clarify, analyze, ADRs, breakdown, filing, execution, change handling, gates and roles) is in `docs/process/README.md`; this skill covers the analysis steps of that process (stages 2-3, the sync check, and drafting in stage 5).

| Level | Label | Meaning |
|-------|-------|---------|
| 1 | `User Requirement` (UR) | What users want from the product, in user terms |
| 2 | `System Requirement` (SR) | A UR analyzed into concrete technical features; belongs to one UR |

If the real label names differ from the above (e.g. prefixes, casing), use the actual ones and fix this table. Do not assume other labels; list the labels you found in the report.

## Workflow

1. **Read (read-only).** Use the GitHub issue tools to list issues by label, then read each body, comments, and sub-issue/parent links. Follow UR -> SR links; an SR without a UR, or a UR without any SR, is a finding. Never edit, close or comment on tickets unless the user asks.
2. **Map** each SR to the affected project(s) using the root `CLAUDE.md` project table (`core`, `agents`, `portal`, `lib`, `contracts`; the assistant is a module of `portal`).
3. **Review** each SR against the existing skills; record only real findings:
   - `esi-project-standards`: does it force a cross-project dependency, shared build, or path link? Propose an artifact/API-based alternative and the release order (producer first).
   - Contracts: does it change an API? Mark the `services/contracts` spec and version impact (additive = minor, breaking = major + ADR).
   - `dsl-authoring` / `dsl-renderer-parity`: does it add or change DSL nodes, and does it need renderer changes and generated models in consumers?
   - Stack skills (`angular-`, `react-`, `dotnet-`, `python-agent-conventions`): are there conflicts, missing conventions or security aspects (untrusted AI output, secrets, auth)?
   - `esi-workflow`: can it be split so each ticket/PR touches one project?
   - Quality of the ticket: testable acceptance criteria, ambiguity, missing non-functional needs (security, performance, accessibility), duplicates.
4. **Update docs** under `docs/requirements/` (see its README): one file per UR (`UR-<issue number>-<slug>.md`) with its SRs, affected projects, flow diagrams (swimlane + sequence), findings, decisions and open questions; keep the traceability table in `docs/requirements/README.md` current. Link tickets by number; do not copy long ticket text. Record architecture decisions in `docs/architecture/` as ADRs, API changes in `docs/api/`, DSL changes in `docs/dsl/`.
   **Diagrams first.** Describe each feature flow and every API call between services with diagrams, not prose (Mermaid in fenced `mermaid` blocks, so they render on GitHub). For each UR/SR include:
   - a **swimlane flowchart**: one `subgraph` lane per actor/project (User, `web/esi-portal`, `core-backend`, `ai-agents`, external systems) showing who does which step and the hand-offs;
   - a **sequence diagram** of the service interactions: participants grouped with `box` by project, each message labelled with `METHOD /path` (or event name) and the contract (`core-api`/`agents-api` and version), plus auth, errors (`alt`/`opt`), async/streaming (`-->>`, `loop`) and DSL payloads returned to the UI.
   Mark current behavior and new/changed behavior separately (e.g. "As-is" and "To-be" sections) and keep both consistent with `services/contracts`. Keep diagrams small; split by flow rather than one huge diagram. Templates are in `docs/requirements/README.md`.
5. **Update skills only for reusable knowledge** (a convention, pitfall or checklist item that will apply to future work, not facts about one feature):
   - ESI-specific (DSL, project map, this workflow): edit `.claude/skills/<skill>/SKILL.md` in this repo.
   - Generic across repos (stack conventions, Docker, versioning): propose the change for `esi-team-claude-kit/skills/` and sync back with `scripts/bootstrap.sh --update`; do not edit kit-owned skills only locally.
   - Keep each skill short; move detail to `references/`.
   Show the user the proposed skill and doc changes before writing them when a change alters an existing rule.
6. **Report** concisely: tickets read (numbers), hierarchy, findings per ticket, what was updated, and open questions for the user.

## Rules

- Do not invent requirements, acceptance criteria or labels; mark gaps as open questions.
- Ask the product owner in one batch (with recommended answers) before analyzing ambiguous scope; record answers as numbered decisions.
- Run the sync check (sub-issues on GitHub vs the "Filed issues" table) at the start and before reporting; docs that disagree with GitHub are a defect.
- Do not file issues, accept ADRs or approve gates; follow `docs/process/README.md`.
- Never record secrets or personal data from tickets in docs or skills.
- Use ESI conventions when proposing follow-up work: branch `type/ESI-<n>-...`, commit `type(project): ...` with `Refs: ESI-<n>` (see `esi-workflow`).
