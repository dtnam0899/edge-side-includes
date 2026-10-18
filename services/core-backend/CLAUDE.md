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
- Run: `dotnet run --project src/Esi.Core.Api` (set `ESI_CORE_AppDb__ConnectionString`, `ESI_CORE_Auth__Mode=LocalAdmin` and the master key variables first; compose sets local values)
- Regenerate contract DTOs: `NODE_AUTH_TOKEN=$(gh auth token) scripts/generate-contracts.sh <contract version>` (Docker; downloads `@dtnam0899/esi-contracts`, runs NSwag 14.7.1 from the tool manifest, writes `src/Esi.Core.Api/Contracts/CoreApi.g.cs` and `CONTRACT_VERSION`)
- Add a migration: `dotnet tool restore && dotnet ef migrations add <Name> --project src/Esi.Core.Infrastructure --startup-project src/Esi.Core.Infrastructure --output-dir Persistence/Migrations`
- Apply migrations: `dotnet ef database update --project src/Esi.Core.Infrastructure --startup-project src/Esi.Core.Infrastructure` (locally); in containers the `migrate` compose service runs the EF Core migrations bundle.
- Docker: `docker build --target test .` (format, build, unit tests; also the pre-commit command in `.esi-test-cmd`), `docker build -t esi-core:<version> --build-arg VERSION=<version> .` (runtime, non-root, `HEALTHCHECK` on `/health`).
- Compose (settings from the shell or a git-ignored `.env`, see `.env.example`; without them a local-only sa password is used): `docker compose up` (SQL Server, migrations, API on http://localhost:8080), `docker compose --profile integration run --rm integration-tests` (integration tests). Build context is this directory only.
- One SQL Server container (`sqlserver`, memory capped by `ESI_CORE_SQL_MEMORY_LIMIT_MB`, default 2048) holds two separate databases: `esi_core` (app) and `esi_target` (stand-in for a user's target database, recreated by the integration tests).
- SQL Server images are amd64 only and need at least 2000 MB: on Apple silicon enable Rosetta emulation in Docker Desktop (SQL Server fails under QEMU) and give the Docker VM 4 GB or more.

## Structure
- `src/Esi.Core.Api/` - ASP.NET Core host: `Program.cs` (configuration, logging, `/health` liveness and `/health/ready` readiness), `Logging/RedactingJsonConsoleFormatter.cs`, `Endpoints/` (minimal API per contract tag, mapping to the generated DTOs), `Problems/EsiProblemHandler.cs` (problem+json, `urn:esi:problem:<name>`), `Auth/` (local admin stand-in), `Contracts/` (generated, never edited; `CONTRACT_VERSION` records the pinned contract)
- `src/Esi.Core.Application/` - use cases and application services: `Consent/` (terms as embedded Markdown `Consent/Terms/<version>.md`, acceptance), `Connections/` (`ConnectionService`, and `ConnectionAccess`, the single owner + consent check every connection-using feature must call), `Security/` (`SecretValue`, `ISecretProtector`), `Problems/EsiProblem`; `Logging/SensitiveDataRedactor.cs` masks secrets in log text
- `src/Esi.Core.Domain/` - domain model (`Connections/Connection`, `EncryptedSecret`, `Consent/ConsentAcceptance`); no framework or database dependencies
- `src/Esi.Core.Infrastructure/` - EF Core `AppDbContext`, entity configurations, repositories, design-time factory, `Persistence/Migrations/`; `Security/` (`MasterKeyRing`, `AesGcmSecretProtector`); `Connections/` (connection string inspector, `SqlConnectionProbe`); `DependencyInjection.AddInfrastructure`
- `tests/Esi.Core.UnitTests/` - unit tests and in-memory API tests (`WebApplicationFactory`, no database)
- `tests/Esi.Core.IntegrationTests/` - tests against the compose SQL Server: `esi_core` and `esi_target` (fail, not skip, without `ESI_CORE_TEST_APPDB` / `ESI_CORE_TEST_TARGETDB`)

## Project context
- Configuration: environment variables only (`ESI_CORE_` prefix, `__` for sections, e.g. `ESI_CORE_AppDb__ConnectionString`, `ESI_CORE_Logging__LogLevel__Default`) and `dotnet user-secrets` (`UserSecretsId` `esi-core-backend`) in Development; appsettings files are not loaded. The API fails at startup if the app database connection string is missing.
- Never commit connection strings, passwords, signing keys or client secrets; `.env` is git-ignored.
- Authentication: none yet (SR-9). `ESI_CORE_Auth__Mode=LocalAdmin` must be set explicitly, otherwise the API does not start; every request then acts as one local admin (`ESI_CORE_Auth__LocalUserId`, default `00000000-0000-0000-0000-000000000001`). Never set it in a deployment. Integration tests switch users with a test-only `X-Test-User` header registered in the test host, not in the application.
- Connection strings (ADR-0003): envelope encryption with AES-256-GCM; master keys from `ESI_CORE_Encryption__MasterKeys__<version>` (base64, 32 bytes) and `ESI_CORE_Encryption__ActiveKeyVersion`; the API fails at startup without a valid active key. Associated data binds each secret to its connection and owner. Plaintext exists only as `SecretValue` inside a call (`ToString` prints `***`); responses use generated DTOs that have no secret field; connection test failures map SQL Server error numbers to fixed messages. compose and tests use dummy keys only. Losing the master key makes stored connections unrecoverable.
- Consent (SR-1): users accept the current terms version before adding a connection; a new terms version (new embedded file + `EmbeddedConsentTermsProvider.CurrentVersion`) requires accepting again. Withdrawn consent: operations that use the connection answer 403 `consent-withdrawn`; listing, reading, granting again and deleting still work. Other users' connections answer 404 on every operation.
- Contract DTOs: generated with NSwag (DTOs only, System.Text.Json; the script maps enum strings with `JsonStringEnumMemberName`); endpoints are written by hand and must match the pinned contract version.
- Logging: JSON lines on stdout through `RedactingJsonConsoleFormatter`; messages, state values and exceptions pass through `SensitiveDataRedactor`. Add new secret key names there rather than bypassing it (ADR-0003 requires that no log contains a secret).
- `esi_target` stands in for a user's target database; never point the app database at it.
- Test data (P0-14, `docs/process/test-data.md`): integration tests recreate `esi_target` from `tests/Esi.Core.IntegrationTests/Fixtures/target-sample-schema.sql` (customers/products/orders with foreign keys and rows, plus `dbo.usp_GetCustomerOrders`, whose definition tests read and nothing executes). Change the schema there; other projects never read it.
- Security-sensitive areas that need a human reviewer: `SensitiveDataRedactor`, `AesGcmSecretProtector`/`MasterKeyRing` and connection handling (ESI-15), the consent text (`Consent/Terms/*.md`, AI-drafted, needs admin/legal approval before production), SQL execution (ESI-16), and authentication once an identity provider is chosen.
