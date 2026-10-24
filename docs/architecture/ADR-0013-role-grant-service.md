---
id: ADR-0013
type: adr
status: Proposed
date: 2026-10-24
projects: [grants, idp, contracts, portal]
issues: [ESI-140]
keywords: [role grant, rbac, grants, time-bound, approval, delegation, tenant onboarding, keycloak admin api, event listener spi, reconciliation, idempotency, grants-api, dotnet]
---

# ADR-0013 Role Grant Service: a separate .NET service that writes to Keycloak

## Context
- [UR-140](../requirements/UR-140-keycloak-idp-sso.md) SR-2, SR-4..SR-8 need tenant onboarding and grants with validity, reason, approvals, delegation, bulk operations, no privilege escalation and an audit trail. Keycloak natively offers realm/client/composite roles, groups and fine-grained admin permissions, but no grant records, expiry, approval or delegation.
- Product owner decision 2026-10-24: Role Grant Service is a separate service, written in .NET (same stack as `services/core-backend`, ADR-0001), plus a thin Keycloak event-listener SPI (UR-140 Decision 7).
- Hosting: the Oracle VM next to Keycloak and PostgreSQL ([ADR-0012](./ADR-0012-idp-hosting-and-edge.md)).

## Options
1. **Separate .NET service, own schema, writes through the Keycloak Admin REST API; thin event-listener SPI reports manual changes.** Pros: a bug or heavy job cannot slow sign-in; depends only on the Admin REST API and the event-listener SPI, which change little between Keycloak releases; independent releases. Cons: two sources of truth that must be kept consistent; one more container.
2. **Full Keycloak SPI (custom JPA entities, REST resources, scheduler inside Keycloak).** Pros: grant and role mapping in one transaction; one process. Cons: runs inside the IdP JVM (stability), relies on less stable SPIs, Liquibase migrations in Keycloak's database, cluster-safe scheduling to build, Java only. Rejected; comparison in the product owner's requirements doc, section 5.0.

## Decision
Take option 1.

Project and data
- New project `services/role-grant` (project code `grants`, image `esi-role-grant`), .NET minimal API, EF Core on PostgreSQL schema `grants` (own database user). Follows `dotnet-conventions` and the Docker and versioning rules.
- It owns: tenant registry (tenant id = Keycloak Organization id, status, quotas), role catalog metadata (templates, sensitive flag, separation-of-duties pairs), grants (grantor, grantee, role, scope id, reason, ticket, `valid_from`, `valid_to`, state `pending|active|expired|revoked`), grant requests and approvals, delegations, and an append-only audit log.
- Keycloak stays the source of truth for users and effective role mappings; the service is the source of truth for grant records. It is the only writer of role mappings for tenants; console changes are emergencies by platform admins.

API
- Design-first contract `grants-api` in `services/contracts` (published with the contracts package, additive = minor). Every endpoint requires a Keycloak access token; authorization is checked in the service by role and `tenant_id` (tenant admin, app owner, platform admin).

Writing to Keycloak
- A confidential client with a service account holding only the `realm-management` roles needed for users, roles, groups and organizations.
- Write order: save the grant as `pending` -> call the Admin API -> mark `active`; failures retry with an idempotency key and never leave a grant half-applied without a pending record.
- Expiry scheduler: removes the role mapping, logs out the user's sessions, writes the user and time to the Workers KV revocation list through the Cloudflare API (ADR-0012), marks the grant `expired`. Runs as a single instance (one replica on the VM); a database lock guards it if replicas are added.

Consistency
- `services/idp` ships a thin event-listener SPI that posts admin events about role, group and organization membership changes to the service asynchronously (signed webhook); it never blocks a Keycloak request.
- A reconciliation job compares Keycloak role mappings with active grants on a schedule and reports or reverts drift; events make drift visible at once, the job is the safety net.
- The service emits `role.granted`, `role.revoked`, `grant.expired`, `tenant.created` events to subscribers (webhooks) and the audit log.

## Consequences
- Keycloak keeps signing users in while the service is down; only granting and revoking pause (expiry catches up on restart).
- Drift is possible between a Keycloak write and the grant state; retries, events and reconciliation bound it.
- The event-listener SPI is Java code inside `services/idp`, rebuilt and tested on every Keycloak upgrade (small surface).
- The portal identity-admin module calls `grants-api` through a generated client, never Keycloak directly.

## Verification
- Integration tests against a Keycloak container (Testcontainers): grant -> role in token; expiry -> role gone and user in the revocation list; Keycloak down -> grant stays pending, then applies.
- Cross-tenant tests: a tenant admin of tenant A cannot list, grant, approve or revoke in tenant B; no-escalation tests for every grant path (direct, approval, bulk, delegation).
- Reconciliation test: a role added by hand in Keycloak is detected and reported or reverted.
- Contract lint and `oasdiff` for `grants-api`.

## Open questions
- Default approvers and which roles are sensitive (UR-140 Open question 4).
- Revert or only report drift by default.
