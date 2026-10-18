---
description: Verify, summarize and prepare a pull request
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*)
---

# Pull Request Preparation

1. Read the project's `CLAUDE.md` and run its lint, typecheck and test commands. Stop and report if any fail.
2. Confirm the branch was created from `develop`, then review `git diff develop...HEAD` and `git log develop..HEAD --oneline`.
3. Check the branch name follows `type/ESI-<n>-short-description` (e.g. `feat/ESI-123-user-login`).
   The PR title must follow the ticket title format: `ESI-<n> [PROJECT] <summary>`, e.g. `ESI-1 [CORE] Add login`.
   The `ESI-` prefix is mandatory; the `[PROJECT]` tag is mandatory whenever the ticket belongs to a sub-project of the ESI platform.
4. Do not push or create the PR unless the user asks.
5. Write the PR description:

```markdown
## Summary
What changed and why (link the ticket, e.g. ESI-123).

## Changes
- Bullet list of notable changes

## How to test
Exact steps or commands

## Screenshots
Only for UI changes

## Checklist
- [ ] Tests added or updated
- [ ] Docs updated
- [ ] Migrations / config changes noted
- [ ] No secrets committed
```

PRs target `develop` (never `main`), stay small, and are squash-merged into `develop` after CI passes and one approval. Production releases are a separate PR from `develop` into `main`, merged with a merge commit.
