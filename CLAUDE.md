# <Repository name>

<!-- Keep this file concise. Fill placeholders with verified project facts and remove sections that do not apply. -->

## Overview
<One or two sentences describing what the project does and who or what it serves.>

## Projects
This repository holds several independent projects. Each has its own `CLAUDE.md` with stack and commands; work inside one project directory and run its commands from there.

| Project | Stack | Purpose |
|---------|-------|---------|
| `<dir>/` | <Angular / React / .NET / Python...> | <one line> |

How the projects relate (shared auth, APIs, deployment): <short description, or remove>.

## Commands
Per project; see its `CLAUDE.md`. A project may set the pre-commit test command in `<dir>/.esi-test-cmd`.

## Critical project context
- <Non-obvious constraints, generated files, or known pitfalls that affect most changes; link to the source of truth where possible.>

## ESI workflow
- Issues and PRs: `ESI-<number> [PROJECT] <title>`; `[PROJECT]` is the project directory code.
- Branches: `type/ESI-<number>-short-description`.
- Commits: `type(project): subject`, with `Refs: ESI-<number>`; keep one commit to one project where possible.
- PRs: keep them focused, pass CI, and request one approval before squash-merging to `main`.

## Do not
- Commit secrets, credentials, or `.env` files.
- Force-push to `main`.
- <Add only a verified, project-specific prohibition.>
