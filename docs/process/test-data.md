---
id: test-data-policy
type: process
status: Active
updated: 2026-10-18
projects: [core, agents, portal, contracts, lib]
issues: [ESI-34]
keywords: [test data, fixtures, mocks, sample schema, esi_target, evals, contract examples, P0-14]
---

# Test data policy

Each project owns its test data and keeps it inside its own directory. No project reads another project's fixtures, sources or database by path; shared shapes come only from published, pinned artifacts (the contracts package, `lib` packages). Source of truth for task P0-14 ([phase 0](../plan/phase-0-foundation.md)); test levels are chosen with the `testing-strategy` skill.

| Project | Test data | Location | Status |
|---------|-----------|----------|--------|
| `services/core-backend` | SQL Server container (compose `sqlserver`) with the app database `esi_core` (EF Core migrations) and `esi_target`, the stand-in for a user's target database, recreated from a sample schema script before each integration run | `tests/Esi.Core.IntegrationTests/Fixtures/target-sample-schema.sql` | In place: related tables `Customers`, `Products`, `Orders`, `OrderLines` with rows, and `dbo.usp_GetCustomerOrders` whose definition tests read and nothing executes |
| `services/ai-agents` | Static schema-metadata fixtures (tables, columns, keys, procedure definitions as text) in the shape of the published `agents-api` contract, used by evals with `StubModel` | `evals/fixtures/` | Added with the first contract version that defines schema metadata (ESI-13, ESI-18); never read from core or a database |
| `web/esi-portal` | Mocked HTTP responses generated from the `examples` of the pinned contract version | `src/testing/mocks/` | Added with the first API operations the portal calls (ESI-13, ESI-19) |
| `services/contracts` | Field-level `example`s in the specs (operation examples where a shape is not obvious); they are the source for consumer mocks and fixtures | in each spec (`core-api/`, `common/`, `agents-api/`) | In place for 0.1.0 |
| `lib` | Per-package unit-test fixtures (DSL documents, schema samples) | next to each package's tests (`<package>/src/**`) | Added with the DSL packages' first real tests (ESI-14); scaffold specs need none |

## Rules

- Fixtures that mirror another project's data (agents schema metadata, portal mocks) are regenerated from a pinned published contract version and record that version in the fixture or its README. Bumping the contract version regenerates them in the same PR.
- The same sample business domain (customers, products, orders) is used across projects so evals, mocks and core tests describe the same data, but each project keeps its own copy.
- Fixtures contain no real customer data, credentials or connection strings with real passwords.
- Database safety (UR-1): fixtures may contain stored procedure definitions as text; tests read definitions (`OBJECT_DEFINITION`) and never execute procedures of the target database.
