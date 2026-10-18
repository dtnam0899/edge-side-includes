# edge-side-includes (ESI)

<!-- Keep this file concise. Fill placeholders with verified project facts and remove sections that do not apply. -->

## Overview
ESI platform: a core backend, AI agents and an Angular management portal, sharing a DSL that describes UI (tables, charts, dashboards, widgets, forms) rendered in the portal. The AI assistant is an independent feature module inside the portal.

## Projects
This repository holds several independent projects. Each has its own `CLAUDE.md` with stack and commands; work inside one project directory and run its commands from there.

| Project | Stack | Purpose |
|---------|-------|---------|
| `services/core-backend/` | .NET | Core API, domain, auth |
| `services/ai-agents/` | Python | AI agents, tools, prompts, evals |
| `services/contracts/` | OpenAPI | Design-first API contracts (core-api, agents-api); published as an npm package, no runtime code |
| `web/esi-portal/` | Angular | Management web app; large features (e.g. the AI assistant) are independent modules inside it |
| `lib/` | TypeScript workspace | DSL schema/core, Angular renderer, API client, UI tokens |

How the projects relate: only through published, versioned artifacts and network APIs (see Architecture rules). `services/contracts` publishes the API contracts; `lib/dsl-schema` publishes the UI DSL schema; `lib/*` packages and the contracts package are published to GitHub Packages (npm) and consumed by version. The AI agents emit DSL, the portal renders it through `lib/dsl-renderer-angular`. Other top-level dirs: `docs/` (start at `docs/README.md`: requirements, build plan, ADRs, DSL spec, API docs), `infra/` (deployment wiring only), `scripts/`.

Commit/PR `[PROJECT]` codes: `core`, `agents`, `contracts`, `portal`, `lib`, and `esi` for work that spans or is outside any single project (repo-wide docs, ADRs, CI, GitHub settings, cross-project tasks). Work on the assistant module uses `portal`.

## Architecture rules
Applies to every project; details and templates in the `esi-project-standards` skill.

1. **Independence.** Each project (`services/*`, `web/*`, `lib`) must install, build, test and run on its own, from its own directory, using only its own manifests and Docker. It must not import, reference by path (`../`, `file:`, `link:`, project references, symlinks, shared build files) or build from another project. Do not add a repo-wide build tool, workspace or solution; Nx exists only inside `lib/`.
2. **Integration only through artifacts and APIs.** Other projects are used by pinned version: lib packages and the contracts package from GitHub Packages (npm), contracts and DSL schema as published versions (generated code is committed inside the consumer and records the version it came from), services over HTTP/gRPC with the contract. A change that needs two projects is released in order: producer first, then consumers bump the version.
3. **Docker everywhere.** Every project has a multi-stage `Dockerfile`, `.dockerignore`, and a `compose.yaml` for its own local dependencies. Build context is the project directory only. The documented commands must work in the container (CI builds the image). `infra/` only wires already-built images; it never builds from project sources.
4. **Versioning.** SemVer per project, independent of the others, with the native manifest as the source (`package.json`, `Directory.Build.props`, `pyproject.toml`) and a per-project `CHANGELOG.md`. Release tags are `<project>@vX.Y.Z`; Docker images and published packages use the same version. Versions are derived from Conventional Commits; breaking changes need `!`/`BREAKING CHANGE:` and an ADR when they touch a contract or the DSL.
5. **lib uses Nx** for build, test, affected runs, module-boundary lint and independent per-package versioning and publishing (`nx release`) to GitHub Packages. Nx is not used outside `lib/`.

## Requirements
Tickets are labelled `User Requirement` (UR, user-level feature request) and `System Requirement` (SR, a UR analyzed into technical features). The standard process from a new UR to filed tasks (stages, gates, roles, templates, change handling) is `docs/process/README.md`. When asked to read, analyze or sync requirement tickets, follow the `requirement-review` skill: read tickets read-only, review them against the project skills, then update `docs/requirements/` and, for reusable knowledge, the skills. Never modify tickets unless asked.

## Commands
Per project; see its `CLAUDE.md`. A project may set the pre-commit test command in `<dir>/.esi-test-cmd`.

## Critical project context
- Generated code (API clients, DSL models) is never edited by hand; regenerate it from the pinned contract or schema version.

## ESI workflow
- Issues and PRs: `ESI-<number> [PROJECT] <title>`; `[PROJECT]` is the project directory code.
- Branches: `type/ESI-<number>-short-description`.
- Commits: `type(project): subject`, with `Refs: ESI-<number>`; keep one commit to one project where possible.
- PRs: keep them focused, pass CI, and request one approval before squash-merging to `main`.

## Do not
- Commit secrets, credentials, or `.env` files.
- Force-push to `main`.
- Add cross-project imports, path dependencies or a shared build between projects.
