---
name: claude-md
description: Create, update, or audit CLAUDE.md and related agent instruction files. Use when onboarding a repository or project, reviewing instruction scope, reducing stale/redundant context, or validating documented commands and structure.
---

# CLAUDE.md authoring and audit

## Scope

Use this skill for durable repository or directory context: purpose, verified architecture, project boundaries, commands, critical constraints, and links to sources of truth. Put task-specific procedures in skills or commands, stack rules in stack skills, and enforceable checks in linters or hooks. Do not turn CLAUDE.md into a general style guide or duplicate detailed documentation.

For multi-project repositories, the root file explains the project map and cross-project invariants; each project-level file contains only verified stack, local commands, structure, and project-specific gotchas. Directory-specific files should add context, not silently contradict higher-level rules.

## Workflow

1. Read the existing instruction files from the target directory up through the repository root, including applicable `AGENTS.md`, project documentation, and linked sources of truth. Identify the requested operation: create, update, or audit.
2. Verify facts against manifests, source layout, CI, Docker files, tests, and canonical architecture/contract documents. Never infer commands, versions, project dependencies, or runtime behavior from a template.
3. Classify each instruction:
   - Always-relevant repository invariants belong in the root context.
   - Stack/project-specific facts belong in that project's `CLAUDE.md`.
   - Task workflows belong in a skill or command.
   - Deterministic style and quality rules belong in tools/configuration where available.
   - Long-form explanations belong in canonical docs, linked from the instructions.
4. Keep guidance concise and actionable. Remove stale, duplicated, generic, or task-specific text; prefer a link to the canonical source over copied detail. Keep examples and placeholders clearly marked and remove unused placeholders.
5. Preserve existing architecture and project-owner decisions. Flag contradictions or missing facts; ask before changing a policy or inventing a replacement.
6. For ESI multi-project repositories, check each proposal against `esi-project-standards`: projects remain independently buildable, cross-project integration uses published artifacts or APIs, and project commands/build contexts stay local. Keep Nx scoped to `lib/` where that repository rule applies. Do not create shared workspaces or cross-project path dependencies.
7. Verify every command and path changed. Review links, instruction hierarchy, and whether each rule belongs at that scope. Summarize additions, removals, facts that remain unverified, and any owner decisions needed.

## Review checklist

- [ ] Each instruction applies to the scope where it is written.
- [ ] Commands, versions, paths, and project relationships are verified.
- [ ] No duplicate policy conflicts with a skill, project doc, manifest, or tool configuration.
- [ ] Project-level guidance supplements rather than contradicts repository invariants.
- [ ] The file is concise and points to canonical detailed documentation.
- [ ] ESI project independence and release boundaries are preserved when applicable.
