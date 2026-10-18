# services/core-backend (.NET)

<!-- Supplements the repository root CLAUDE.md for this project. Keep only verified facts. -->

## Overview
Core API, domain logic and auth for ESI; consumed by `web/esi-portal` (including its AI assistant module) and `services/ai-agents`.

## Stack
- .NET 10 (LTS, supported to 2028-11-14), ASP.NET Core (ADR-0001). Identity provider: not chosen yet (Duende was only a template mention).
- Data store: SQL Server for the app's own data (separate from users' target databases), EF Core 10 with migrations.
- Libraries decided by ADR: `Microsoft.SqlServer.TransactSql.ScriptDom` for SQL validation (ADR-0004), `System.Security.Cryptography.AesGcm` for envelope encryption (ADR-0003). Core also validates DSL itself when saving (ADR-0002).

## Commands (run from this directory)
- Restore/build: `dotnet build`
- Tests: `dotnet test`
- Run: `dotnet run --project <path>`
- Migrations: `<verified command>`
- Docker: `docker compose up` (local dependencies) and `docker build -t <project>:<version> .`; see the `esi-project-standards` skill. This project must not depend on other projects' sources.

## Structure
- `<src/Project>/` - <purpose>
- `<tests/Project.Tests>/` - <test projects>

## Project context
- Configuration and secrets: user-secrets / environment variables only; never commit connection strings, signing keys or client secrets.
- Clients, scopes and token settings: <file reference>
- <Security-sensitive areas that need a human reviewer>
