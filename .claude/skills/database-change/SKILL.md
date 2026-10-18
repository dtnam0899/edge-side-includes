---
name: database-change
description: Plan or implement a database schema or data migration safely. Use for DDL, ORM migrations, backfills, indexes, destructive changes, or coordinating application rollout with database versions.
---

# Database change

## Scope

Guide schema and data changes across database technologies, including rollout and recovery safety. Stack skills such as `dotnet-conventions` govern application and ORM coding conventions; this skill governs migration lifecycle and operational risk. API contract lifecycle belongs to `api-contract-change`.

## Workflow

1. Read the project instructions and inspect the current schema, migration history, deployment model, database engine, data volume where known, and dependent application versions. Do not assume migration tooling or rollback capabilities.
2. Describe the desired schema/data state, affected tables and consumers, expected locking/downtime, and whether the change is additive, backfill, or destructive. Surface unknown data volume or availability requirements.
3. Prefer expand-and-contract for changes that must coexist with old and new application versions:
   - Add compatible schema first.
   - Deploy code that can work with both states.
   - Backfill in bounded, observable, restartable batches when needed.
   - Verify data and application behavior.
   - Remove old schema only after all consumers have moved and the removal is approved.
4. Make backfills idempotent or safely resumable; bound resource use; preserve data; and define how progress, failures, and reconciliation are observed. Avoid unbounded table rewrites or long transactions without evidence they are safe.
5. Add and review the migration using the project's tool. Applied migrations are immutable. Test migration from the supported prior schema, fresh database setup, data preservation/constraints, and the intended app/schema version combinations.
6. Define recovery explicitly. Distinguish a reversible schema operation from restoring changed data; many data transformations cannot be rolled back by reversing DDL. Confirm backup/restore and recovery expectations before destructive or irreversible operations. Never assume restoring a backup is acceptable.
7. Run the project's migration, integration, and relevant performance checks. Report expected rollout order, compatibility window, recovery plan, and any manual operational step.

## Rules

- Never drop, truncate, overwrite, or irreversibly transform production data without explicit authorization and a verified recovery plan.
- Avoid edits to migrations already applied in a shared environment; create a new corrective migration.
- Do not put credentials, production data, or sensitive samples in migration files, logs, or tests.
- Do not claim zero downtime or safe rollback without validating the database engine, data shape, and deployment sequence.
