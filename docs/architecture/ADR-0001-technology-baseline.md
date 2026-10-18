---
id: ADR-0001
type: adr
status: Proposed
date: 2026-10-18
projects: [core, agents, portal, lib, contracts]
issues: [ESI-1]
keywords: [stack, versions, dotnet, angular, python, nx, sql server, orm, package manager, docker, baseline]
---

# ADR-0001 Technology baseline and versions

## Context
- The root `CLAUDE.md` fixes the stack per project: `core-backend` .NET, `ai-agents` Python, `contracts` OpenAPI, `esi-portal` Angular, `lib` TypeScript with Nx. The versions, frameworks, ORM, package managers and test tools are placeholders (`<version>`) in the project `CLAUDE.md` files.
- `@a2ui/angular` 0.13.0 has peer dependencies on Angular `^21.2.5` (see [UR-1](../requirements/UR-1-bi-ai-assistant-web-application.md), findings), so the portal and `lib/dsl-renderer-angular` need Angular 21 or newer.
- The only supported database engine is SQL Server (SR-1). Identity Server (Duende) is mentioned in the portal and core templates but no identity provider exists yet.
- Each project must build in Docker with pinned base images and frozen installs (`esi-project-standards`).

## Options
1. **Pin latest stable at scaffold time, record exact versions here.** Pros: current; cons: must verify availability and support dates when scaffolding.
2. **Pin older LTS versions.** Pros: stability; cons: may conflict with the Angular 21 requirement.

## Decision (proposed)
Take option 1. Fill the table at scaffold time (task P0-06..P0-10) from the official release pages, then change the status to Accepted. Nothing below is verified yet.

| Area | Proposal | Verify before accepting |
|------|----------|-------------------------|
| core runtime | current .NET LTS, ASP.NET Core minimal or controller API | LTS version and end-of-support date |
| core data store | SQL Server for the app's own data (artifacts, sessions, connections); EF Core as ORM with migrations | Whether the app DB is separate from users' target DBs (it must be) |
| core SQL parsing | `Microsoft.SqlServer.TransactSql.ScriptDom` for statement validation (see ADR-0004) | License and supported SQL Server syntax versions |
| core crypto | `System.Security.Cryptography.AesGcm` (see ADR-0003) | none |
| agents runtime | Python 3.12 or newer, FastAPI, `uv` with a lock file, `pytest`, `ruff` | Model provider and agent framework (TBD, not chosen) |
| portal | Angular 21 or newer, standalone components, lazy-loaded feature modules, Angular CDK drag-drop | Exact patch compatible with `@a2ui/angular` peers |
| lib | Nx workspace, TypeScript strict, `nx release` independent versions, registry `https://npm.pkg.github.com` | Nx version compatible with the Angular version |
| contracts | OpenAPI 3.x YAML, Spectral, oasdiff, packaged with `npm pack` as `@dtnam0899/esi-contracts` | Spec version (3.0 vs 3.1) supported by the code generators |
| code generation | TS client from the contract in `lib/api-client`; .NET and Python DTO/stubs generated inside their own projects | Generator tool per language (TBD) |
| test SQL Server | SQL Server container image pinned by version in `core-backend/compose.yaml` | Image license terms for dev use |

## Consequences
- Placeholders in the `CLAUDE.md` files can be filled with verified facts once this ADR is accepted.
- Choosing generators and an agent framework are separate, smaller decisions; record them here or in a new ADR if they become contentious.

## Verification
- Each scaffold task runs its documented build, test and lint commands in Docker in CI.
- A dependency-check step flags unpinned base images (`latest`) and unlocked installs.

## Open questions
- Model provider and agent framework for `services/ai-agents` (the UR does not name one).
- Whether the app's own database is SQL Server or another engine (UR-1 only fixes the engine of the user's target database).
- Hosting target (affects `infra/` only; deferred).
