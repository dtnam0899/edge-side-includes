---
id: ADR-0008
type: adr
status: Proposed
date: 2026-10-20
projects: [core]
issues: [ESI-93, ESI-94]
keywords: [app database, postgresql, postgres, npgsql, ef core, sql server, target database, migrations, compose, hosting, neon, free tier]
---

# ADR-0008 App database on PostgreSQL

Supersedes the "core data store" row of [ADR-0001](./ADR-0001-technology-baseline.md) and its open question resolved on 2026-10-18 (app database on SQL Server). Users' target databases stay SQL Server; [ADR-0004](./ADR-0004-sql-validation-and-execution-policy.md) is unchanged.

## Context
- `services/core-backend` has two kinds of database: its own **app database** `esi_core` (users, connections with encrypted secrets, consent, chat, saved SQL scripts, artifacts, dashboards), reached only through EF Core 10 (`AppDbContext`, migrations bundle in the `migrator` image), and the users' **target databases** (SR-1), reached only through `Microsoft.Data.SqlClient` (`SqlConnectionProbe`, `SqlConnectionStringInspector`, `SqlTargetDatabase`) and validated with ScriptDom (ADR-0004).
- ADR-0001 chose SQL Server for the app database so that one engine and one image serve both. SR-1 limits the **target** engine to SQL Server; nothing in the requirements fixes the app database engine.
- The entity configurations use no SQL Server specific column types, default SQL or raw SQL; the app database is provider-neutral apart from the generated migrations.
- No production data exists (ESI is a personal, non-commercial demo, ADR-0005), so the migrations can be reset to one new `InitialCreate`.
- A spike on 2026-10-20 swapped the provider to `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3, regenerated the migrations and added a Postgres compose service: 122 unit tests and 44 integration tests passed with no other code changes (target-database tests still run against the compose SQL Server `esi_target`).
- Free hosting (verified 2026-10-20): Neon Free gives 1 GB storage (20 GB per account), 100 CU-hours and 5 GB transfer per project and month, and suspends compute after 5 minutes idle, which cannot be turned off ([pricing](https://neon.com/pricing)); Azure Database for PostgreSQL flexible server is free only for the first 12 months of an Azure free account (750 h B1MS, 32 GB) ([free account](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-deploy-on-azure-free-account)); the Azure SQL Database free offer used by ADR-0005 has no time limit.

## Options
1. **Keep SQL Server for the app database (ADR-0001).** Pros: one engine, nothing to change. Cons: local and CI need a 2 GB amd64-only SQL Server even for app-only work (Rosetta on Apple silicon); hosting the app database is tied to Azure SQL.
2. **PostgreSQL for the app database, SQL Server only for targets.** Pros: a small multi-arch Postgres container for the app database; many free managed Postgres offers; the app database no longer depends on the engine users connect to, which keeps the boundary between "our data" and "their data" visible. Cons: two engines to run locally (the SQL Server container stays for `esi_target` in integration tests); one more NuGet provider.
3. **SQLite for the app database.** Pros: no container. Cons: no managed hosting for a scaled-to-zero container app; file storage on Container Apps is not durable without a paid volume.

## Decision
Take option 2: the core app database is **PostgreSQL** through EF Core 10 with `Npgsql.EntityFrameworkCore.PostgreSQL` (10.0.x). Target databases remain SQL Server only, through `Microsoft.Data.SqlClient` and the ADR-0004 policy.

- `Microsoft.Data.SqlClient` becomes a direct, centrally pinned package (it was only transitive through the EF SqlServer provider).
- The existing migrations are deleted and replaced by one `InitialCreate` generated with the Npgsql provider. From then on migrations are additive as before.
- `ESI_CORE_AppDb__ConnectionString` takes an Npgsql connection string (`Host=...;Database=esi_core;Username=...;Password=...`). Nothing else in the configuration changes.
- compose: a pinned `postgres:17.x-alpine` service holds `esi_core`; the `sqlserver` service stays only for `esi_target` (integration tests). The app database must never be pointed at a target database, and target connections must never be pointed at the app database.
- No SQL Server specific EF features in the app model (and no Postgres specific ones without a reason recorded in the code), so the provider stays a configuration choice.

## Consequences
- ADR-0005 (Proposed) is affected only in its database part: the demo target `esi_demo_target` stays on the Azure SQL Database free offer; the app database `esi_core` moves to a free managed Postgres. Proposed default for the demo: **Neon Free** (no time limit, scale to zero fits the demo's on/off model; cold start of a few seconds). Azure Database for PostgreSQL is an alternative only while the 12-month free account lasts. The choice and setup belong to the `infra/azure` follow-up; until then `infra/azure/README.md` still describes `esi_core` on Azure SQL.
- An external Postgres means the Container Apps secret for the app database holds a Neon (or other) connection string; the connection uses TLS (`SSL Mode=Require`).
- Local and CI runs still need SQL Server for the target-database integration tests, so the SQL Server memory and Rosetta notes stay.
- Existing local volumes with an `esi_core` on SQL Server are simply unused; `docker compose down -v` cleans them.
- Going back to SQL Server later would again be a provider swap plus a migration reset (or a data migration once real data exists).

## Verification
- `docker build --target test .` (format, build, unit tests) and `docker compose --profile integration run --rm integration-tests` pass with the app database on Postgres and `esi_target` on SQL Server.
- `TargetDatabaseTests` asserts that the app database and the target database have different names.
- CI's compose health check `/health/ready` checks the app database on Postgres.

## Open questions
- Product owner: confirm Neon Free for the demo app database (or another free Postgres) when the `infra/azure` work resumes.
