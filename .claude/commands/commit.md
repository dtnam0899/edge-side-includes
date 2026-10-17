---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*)
argument-hint: [message]
description: Create a Conventional Commits git commit
---

## Context

- Current git status: !`git status`
- Current git diff: !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -10`

## Your task

Create a single git commit from the changes above. If a message was provided, use it: $ARGUMENTS

Format: `type(scope): subject`

- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`
- `scope`: the module or area changed (optional but preferred)
- Subject: imperative mood, max 72 characters, no trailing period
- Body (optional): explain why, not what
- Breaking change: add `!` after the scope and a `BREAKING CHANGE:` footer
- Ticket: every commit needs `Refs: ESI-<n>` as a footer (take it from the branch name, e.g. `feat/ESI-123-login`); ask the user if missing
- Sub-project: if the ticket belongs to a sub-project (title like `ESI-123 [CORE] ...`), use its lowercase code as scope, e.g. `feat(core): add login`
- Stage only files relevant to the change; never commit secrets or `.env` files
- Do not push
