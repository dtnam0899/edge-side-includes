---
name: esi-workflow
description: ESI ticket, branch, commit and PR conventions. Use when naming a branch, writing a commit message, opening or describing a PR, or deciding which sub-project a change belongs to.
---

# ESI workflow

Mirrors `.claude/commands/commit.md` and `pr.md`; if they disagree, the commands win.

## Rules

- Branch: `type/ESI-<n>-short-description`, e.g. `feat/ESI-123-table-sorting`.
- Commit: `type(project): subject` (imperative, max 72 chars, no trailing period) plus footer `Refs: ESI-<n>`.
  Types: `feat fix docs refactor test chore perf ci`. Breaking change: `!` after scope and a `BREAKING CHANGE:` footer.
- Scope and `[PROJECT]` tag: the project directory code listed in the root `CLAUDE.md` project table (e.g. ticket `ESI-123 [CORE] ...` gives scope `core`). Work that spans or sits outside any single project uses the code `esi` in titles (`ESI-<n> [esi] ...`); for commit scopes use `docs`, `infra`, `scripts` or `esi`.
- PR title: `ESI-<n> [PROJECT] <summary>`. One approval, CI green, squash-merge to `main`.
- One commit and one PR touch one project where possible; if a change must span projects (e.g. a shared contract plus its consumers), say so in the PR description.
- Before a PR, run the lint, typecheck and test commands from the project's own `CLAUDE.md`.
- Never commit secrets or `.env`; never force-push `main`; do not push unless asked.
