# services/core-backend (.NET)

<!-- Supplements the repository root CLAUDE.md for this project. Keep only verified facts. -->

## Overview
Core API, domain logic and auth for ESI; consumed by `web/esi-portal` (including its AI assistant module) and `services/ai-agents`.

## Stack
- .NET 10 (LTS, supported to 2028-11-14), ASP.NET Core (ADR-0001). SDK pinned in `global.json` (10.0.402, runtime 10.0.13). Identity provider: not chosen yet (Duende was only a template mention).
- Data store: SQL Server for the app's own data (separate from users' target databases), EF Core 10.0.13 with migrations.
- Libraries decided by ADR: `Microsoft.SqlServer.TransactSql.ScriptDom` for SQL validation (ADR-0004), `System.Security.Cryptography.AesGcm` for envelope encryption (ADR-0003). Core also validates DSL itself when saving (ADR-0002).
- Packages: versions only in `Directory.Packages.props` (central management with transitive pinning); `packages.lock.json` per project, restored with `--locked-mode` in Docker.
- Tests: xUnit v3 on Microsoft.Testing.Platform (`global.json` `test.runner`), so `dotnet test` takes `--project <path>`.

## Commands (run from this directory)
- Restore/build: `dotnet build` (needs the .NET 10 SDK; otherwise use the Docker commands)
- Unit tests: `dotnet test --project tests/Esi.Core.UnitTests`
- Format check: `dotnet format --verify-no-changes --exclude src/Esi.Core.Infrastructure/Persistence/Migrations`
- Run: `dotnet run --project src/Esi.Core.Api` (set `ESI_CORE_AppDb__ConnectionString` first)
- Add a migration: `dotnet tool restore && dotnet ef migrations add <Name> --project src/Esi.Core.Infrastructure --startup-project src/Esi.Core.Infrastructure --output-dir Persistence/Migrations`
- Apply migrations: `dotnet ef database update --project src/Esi.Core.Infrastructure --startup-project src/Esi.Core.Infrastructure` (locally); in containers the `migrate` compose service runs the EF Core migrations bundle.
- Docker: `docker build --target test .` (format, build, unit tests; also the pre-commit command in `.esi-test-cmd`), `docker build -t esi-core:<version> --build-arg VERSION=<version> .` (runtime, non-root, `HEALTHCHECK` on `/health`).
- Compose (settings from the shell or a git-ignored `.env`, see `.env.example`; without them a local-only sa password is used): `docker compose up` (SQL Server, migrations, API on http://localhost:8080), `docker compose --profile integration run --rm integration-tests` (integration tests). Build context is this directory only.
- One SQL Server container (`sqlserver`, memory capped by `ESI_CORE_SQL_MEMORY_LIMIT_MB`, default 2048) holds two separate databases: `esi_core` (app) and `esi_target` (stand-in for a user's target database, created by the integration tests).
- SQL Server images are amd64 only and need at least 2000 MB: on Apple silicon enable Rosetta emulation in Docker Desktop (SQL Server fails under QEMU) and give the Docker VM 4 GB or more.

## Structure
- `src/Esi.Core.Api/` - ASP.NET Core host: `Program.cs` (configuration, logging, `/health` liveness and `/health/ready` readiness), `Logging/RedactingJsonConsoleFormatter.cs`
- `src/Esi.Core.Application/` - use cases and application services; `Logging/SensitiveDataRedactor.cs` masks secrets in log text
- `src/Esi.Core.Domain/` - domain model; no framework or database dependencies
- `src/Esi.Core.Infrastructure/` - EF Core `AppDbContext`, design-time factory, `Persistence/Migrations/`, `DependencyInjection.AddInfrastructure`
- `tests/Esi.Core.UnitTests/` - unit tests and in-memory API tests (`WebApplicationFactory`, no database)
- `tests/Esi.Core.IntegrationTests/` - tests against the compose SQL Server: `esi_core` and `esi_target` (fail, not skip, without `ESI_CORE_TEST_APPDB` / `ESI_CORE_TEST_TARGETDB`)

## Project context
- Configuration: environment variables only (`ESI_CORE_` prefix, `__` for sections, e.g. `ESI_CORE_AppDb__ConnectionString`, `ESI_CORE_Logging__LogLevel__Default`) and `dotnet user-secrets` (`UserSecretsId` `esi-core-backend`) in Development; appsettings files are not loaded. The API fails at startup if the app database connection string is missing.
- Never commit connection strings, passwords, signing keys or client secrets; `.env` is git-ignored.
- Logging: JSON lines on stdout through `RedactingJsonConsoleFormatter`; messages, state values and exceptions pass through `SensitiveDataRedactor`. Add new secret key names there rather than bypassing it (ADR-0003 requires that no log contains a secret).
- `esi_target` stands in for a user's target database; never point the app database at it.
- Security-sensitive areas that need a human reviewer: `SensitiveDataRedactor`, connection/secret handling (ESI-15), SQL execution (ESI-16), and authentication once an identity provider is chosen.
