# services/core-backend (.NET)

<!-- Supplements the repository root CLAUDE.md for this project. Keep only verified facts. -->

## Overview
Core API, domain logic and auth for ESI; consumed by `web/esi-portal` (including its AI assistant module) and `services/ai-agents`.

## Stack
- .NET <version>, <ASP.NET Core / Duende IdentityServer / other>
- Data store: <database and ORM>

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
