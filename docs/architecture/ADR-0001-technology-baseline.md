---
id: ADR-0001
type: adr
status: Accepted
date: 2026-10-18
projects: [core, agents, portal, lib, contracts]
issues: [ESI-1]
keywords: [stack, versions, dotnet, angular, python, nx, sql server, orm, package manager, docker, baseline]
---

# ADR-0001 Technology baseline and versions

> The "core data store" row and the 2026-10-18 app-database answer below are **superseded by [ADR-0008](./ADR-0008-app-database-postgresql.md)** (app database on PostgreSQL; target databases stay SQL Server). The rest of this ADR stands.

## Context
- The root `CLAUDE.md` fixes the stack per project: `core-backend` .NET, `ai-agents` Python, `contracts` OpenAPI, `esi-portal` Angular, `lib` TypeScript with Nx. The versions, frameworks, ORM, package managers and test tools are placeholders (`<version>`) in the project `CLAUDE.md` files.
- `@a2ui/angular` 0.13.0 has peer dependencies on Angular `^21.2.5` (see [UR-1](../requirements/UR-1-bi-ai-assistant-web-application.md), findings), so the portal and `lib/dsl-renderer-angular` need Angular 21 or newer.
- The only supported database engine is SQL Server (SR-1). Identity Server (Duende) is mentioned in the portal and core templates but no identity provider exists yet.
- Each project must build in Docker with pinned base images and frozen installs (`esi-project-standards`).

## Options
1. **Pin latest stable at scaffold time, record exact versions here.** Pros: current; cons: must verify availability and support dates when scaffolding.
2. **Pin older LTS versions.** Pros: stability; cons: may conflict with the Angular 21 requirement.

## Decision
Take option 1 with one constraint: the portal and `lib/dsl-renderer-angular` stay on the **Angular 21 line**, even though Angular 22 is the latest, because `@a2ui/angular` 0.13.0 only accepts Angular `^21.2.5`. Move to Angular 22 only after `@a2ui/angular` publishes support for it (re-check at each upgrade).

Versions verified on 2026-10-18 against official sources (dotnet releases-index, npm registry, NuGet, PyPI, endoflife.date, MCR). Pin exact patch versions at scaffold time; the "Verified" column is what exists today.

| Area | Decision | Verified (2026-10-18) |
|------|----------|-----------------------|
| core runtime | .NET 10 (LTS), ASP.NET Core | .NET 10.0, LTS, active, support to 2028-11-14, latest 10.0.13. Not .NET 9 or 8 (both end support 2026-11-10); .NET 11 is still RC |
| core data store | SQL Server for the app's own data, separate from users' target DBs; EF Core 10 with migrations | `Microsoft.EntityFrameworkCore.SqlServer` 10.0.13. App database engine decided: SQL Server (2026-10-18) |
| core SQL parsing | `Microsoft.SqlServer.TransactSql.ScriptDom` for statement validation (see ADR-0004) | NuGet latest 180.140.0 (major 180 corresponds to SQL Server 2025). Check that it parses SQL Server 2019/2022 syntax in the ADR-0004 corpus |
| core crypto | `System.Security.Cryptography.AesGcm` (see ADR-0003) | built into .NET, no package |
| agents runtime | Python 3.13 (or 3.14), FastAPI, `uv` with lock file, `pytest`, `ruff` | Python 3.13 support to 2029-10-31, 3.14 to 2030-10-31; FastAPI 0.143.3, uv 0.13.1, pytest 9.1.1, ruff 0.17.1. Model provider and agent framework not chosen |
| portal | Angular 21 line (21.2.x), standalone components, lazy-loaded feature modules, Angular CDK drag-drop (21.x) | Angular 21 latest 21.2.25, support to 2027-06-30; Angular 22 (22.2.3) is excluded by `@a2ui/angular` peers `^21.2.5`. `@a2ui/angular` 0.13.0 also needs `@a2ui/markdown-it` `^0.2.2` |
| lib | Nx 23 workspace, TypeScript strict, `nx release` independent versions, registry `https://npm.pkg.github.com` | nx 23.3.0; `@nx/angular` tooling peers accept Angular `>=20 <23`, so Nx 23 works with Angular 21. Scaffold findings (2026-10-18): TypeScript is pinned to 5.9.3 because `@angular/build` 21.2.x needs `>=5.9 <6.0`; vitest is pinned to 4.0.18 because 4.1.x crashes npm 10 during install |
| contracts | OpenAPI 3.x YAML, Spectral (`@stoplight/spectral-cli` 6.17.0) for lint, `oasdiff` for breaking-change checks, packaged with `npm pack` as `@dtnam0899/esi-contracts` | Install `oasdiff` as the Go binary or its official Docker image. **Do not** `npm install oasdiff`: the npm package `oasdiff` is a 0.0.1-security placeholder, not the tool |
| code generation | TS client in `lib/api-client` with `@hey-api/openapi-ts` (0.99.0); .NET and Python DTOs generated inside their own projects (tool per language: .NET uses NSwag 14.7.1 for DTOs only, decided 2026-10-18 in ESI-15; Python decided in ESI-18) | Spec version 3.0 vs 3.1 must be tested against each generator before the contract is frozen |
| test SQL Server | `mcr.microsoft.com/mssql/server` pinned to `2025-RTM-ubuntu-24.04`-style tag (never `latest`), or 2022 if 2025 syntax is not needed | Tags `2025-RTM-*` exist on MCR; SQL Server 2025 (17.0) supported to 2036, 2022 (16.0) to 2033. Dev-use license (Developer edition) to be confirmed on the image page at scaffold time |

## Consequences
- Placeholders in the `CLAUDE.md` files can be filled with verified facts once this ADR is accepted.
- The portal cannot move to Angular 22 until `@a2ui/angular` supports it. This is a known upgrade blocker and should be re-checked when planning upgrades.
- Several versions move fast (FastAPI, ruff, uv, Nx). Treat the table as the baseline at 2026-10-18 and rely on lock files for exact versions.
- Choosing generators and an agent framework are separate, smaller decisions; record them here or in a new ADR if they become contentious.

## Verification
- Each scaffold task runs its documented build, test and lint commands in Docker in CI.
- A dependency-check step flags unpinned base images (`latest`) and unlocked installs.

## Open questions
- Resolved 2026-10-18 (product owner): the app's own database is SQL Server (same engine as the target DBs, one image and one ORM provider). Superseded by [ADR-0008](./ADR-0008-app-database-postgresql.md).
- Deferred: model provider and agent framework for `services/ai-agents`. A separate ADR must be accepted before the agents feature work starts (P0-07 scaffolds the service without choosing one). Model provider proposed in [ADR-0007](./ADR-0007-model-provider.md) (Gemini API free tier for the demo, plain `httpx`, no agent framework).
- Deferred: hosting target (affects `infra/` only). Proposed in [ADR-0005](./ADR-0005-hosting-target.md).
