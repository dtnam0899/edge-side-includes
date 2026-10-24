---
id: UR-140-drafts
type: issue-drafts
status: Filed
updated: 2026-10-24
projects: [idp, grants, edge, contracts, core, portal, esi]
issues: [ESI-140]
keywords: [UR-140, issue drafts, keycloak, sso, multi-tenant, role grant, edge, auth0 replacement, mfa, brokering, branding, backup, e2e]
---

# UR-140 issue drafts (D1..D23)

Drafts for [UR-140](./UR-140-keycloak-idp-sso.md); enablers E1..E5 are in [UR-140-enabler-tasks.md](./UR-140-enabler-tasks.md). Each task heading below is one issue (one project, one PR). Filed with label `System Requirement` as sub-issues of #140:

```bash
scripts/file-issues.sh --file docs/requirements/UR-140-issue-drafts.md --parent 140 --label "System Requirement"          # dry run
scripts/file-issues.sh --file docs/requirements/UR-140-issue-drafts.md --parent 140 --label "System Requirement" --apply
```

Release order inside a phase: `contracts` first, then `idp`, `grants`, `edge`, `core`, then `portal`, then `esi`. All phases are filed now (UR-140 Decision 8).

| ID | Phase | Project | Title | Priority | Size | Depends on | Issue |
|----|-------|---------|-------|----------|------|------------|-------|
| D1 | I2 SSO baseline | idp | Realm as code: realm, Organizations, clients, token policy | P0 | M | E2 | ESI-146 |
| D2 | I2 SSO baseline | edge | Verify JWT at the edge and enforce route roles | P0 | M | E4, D1 | ESI-147 |
| D3 | I2 SSO baseline | core | Sign in through Keycloak instead of Auth0 | P0 | S | D1 | ESI-148 |
| D4 | I2 SSO baseline | portal | Replace the Auth0 SDK with a standards OIDC client for Keycloak | P0 | M | D1 | ESI-149 |
| D5 | I2 SSO baseline | esi | Route /api through the edge Worker and retire Auth0 | P0 | S | D2, D3, D4, E5 | ESI-150 |
| D6 | I3 Multi-tenant | contracts | grants-api 0.1: tenants, members and invitations | P1 | M | E1 | ESI-151 |
| D7 | I3 Multi-tenant | idp | Tenant and role claims in tokens | P1 | S | D1 | ESI-152 |
| D8 | I3 Multi-tenant | grants | Tenant onboarding, suspension and member invitations | P1 | L | E3, D6, D7 | ESI-153 |
| D9 | I3 Multi-tenant | portal | Identity admin module: tenants, members and invitations | P1 | M | D6, D8 | ESI-154 |
| D10 | I4 Rich grants | contracts | grants-api: role catalog, grants, requests and approvals | P1 | M | D6 | ESI-155 |
| D11 | I4 Rich grants | grants | Role catalog and direct grants with no privilege escalation | P1 | L | D8, D10 | ESI-156 |
| D12 | I4 Rich grants | grants | Grant expiry scheduler and revocation | P1 | M | D11, D13 | ESI-157 |
| D13 | I4 Rich grants | edge | Check the revocation list in Workers KV | P1 | S | D2 | ESI-158 |
| D14 | I4 Rich grants | grants | Grant requests and approvals | P1 | M | D11 | ESI-159 |
| D15 | I4 Rich grants | grants | Bulk grants with dry-run and time-limited delegation | P2 | M | D11 | ESI-160 |
| D16 | I4 Rich grants | idp | Event-listener SPI for role and membership changes | P1 | M | E2, D11 | ESI-161 |
| D17 | I4 Rich grants | grants | Event intake, reconciliation job and outgoing events | P1 | M | D11, D16 | ESI-162 |
| D18 | I4 Rich grants | portal | Identity admin module: role matrix, grants and approvals | P1 | L | D10, D11, D14 | ESI-163 |
| D19 | I5 Hardening | idp | MFA, step-up, password and brute-force policies per tenant | P2 | M | D7 | ESI-164 |
| D20 | I5 Hardening | idp | Identity brokering per tenant and home-realm discovery | P2 | M | D7 | ESI-165 |
| D21 | I5 Hardening | idp | Login theme, languages and emails per tenant | P2 | M | D1 | ESI-166 |
| D22 | I6 Operations | esi | Observability, audit retention and IdP runbook | P2 | M | E5 | ESI-167 |
| D23 | I6 Operations | esi | End-to-end scenario: sign-in, tenant isolation, grant expiry | P2 | M | D5, D12, D13 | ESI-168 |

Everything below the first task heading is filed as issue bodies.

## D1 | idp | Realm as code: realm, Organizations, clients, token policy
Covers SR-1 (SSO-01, 03, 04, 05, 06, 12). Depends on: E2. ADRs: ADR-0011.

## Scope
- Realm `esi` with Organizations enabled, defined as code in `services/idp` and applied idempotently.
- Clients: `esi-portal` (public, Authorization Code + PKCE, refresh token rotation, redirect and web-origin URLs for local, Vercel production and previews), audience `esi-core` through an audience mapper, a confidential client with service account for Role Grant Service (roles limited to what ADR-0013 needs).
- Token and session policy: access token 5 minutes, SSO idle and max lifetimes, front- and back-channel logout enabled, RS256 key with rotation settings.
- Brute-force detection on, sign-up off (invite-only), as ADR-0006 had for Auth0.

## Out of scope
- Tenant claims (D7), MFA policy (D19), brokering (D20), themes (D21).

## Version impact
- `idp` minor.

## Acceptance criteria
- [ ] Applying the config to an empty Keycloak twice gives the same realm (idempotent).
- [ ] A PKCE sign-in for `esi-portal` returns an access token with `aud` containing `esi-core`.
- [ ] Signing out ends the SSO session for every client of the realm (back-channel logout test).
- [ ] Self-registration is off; implicit flow and direct grant are off for `esi-portal`.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D2 | edge | Verify JWT at the edge and enforce route roles
Covers SR-3 (INT-01, INT-03, INT-04, RG-33, MT-03). Depends on: E4, D1. ADRs: ADR-0012, ADR-0011.

## Scope
- Verify RS256 signature with the realm JWKS cached in the Worker (refresh on unknown `kid`, bounded rate), check `iss`, `aud`, `exp`, `nbf`.
- Route rules file deployed with the Worker: route prefix -> required roles; default deny for unknown `/api` routes is configurable.
- Remove client-sent `X-User-*` and `X-Tenant-*` headers; forward the original `Authorization` header and body to `ESI_EDGE_ORIGIN_URL`.
- problem+json errors: 401 `urn:esi:problem:unauthenticated`, 403 `urn:esi:problem:forbidden`; health route passes without a token.

## Out of scope
- Revocation list (D13); tenant claim check (enabled when D7 lands, behind a setting).

## Version impact
- `edge` minor.

## Acceptance criteria
- [ ] Expired, wrong-issuer, wrong-audience, tampered and unsigned (`alg: none`) tokens -> 401.
- [ ] A valid token without the route's role -> 403; with it -> forwarded unchanged.
- [ ] No request to Keycloak per API call (only JWKS refresh); CPU per request stays within the free-plan limit in a benchmark test.
- [ ] Spoofed identity headers never reach the origin.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D3 | core | Sign in through Keycloak instead of Auth0
Covers SR-12, SR-1. Depends on: D1. ADRs: ADR-0011 (supersedes ADR-0006).

## Scope
- Keep the generic JWT bearer handler; update the `Oidc` mode docs, startup error text and examples from Auth0 to Keycloak issuer URLs (`https://<host>/realms/esi`).
- Update test tokens and Oidc tests to Keycloak-shaped tokens (issuer, audience `esi-core`, `azp`, `roles`, `tenant_id`), plus one integration test against a Keycloak container if practical.
- `services/core-backend/CLAUDE.md` and compose examples use Keycloak (the published `esi-idp` image for local runs).

## Out of scope
- Tenant scoping of core data (UR-140 Open question 2); roles in core authorization.

## Version impact
- `core` patch (configuration and docs only); no contract change.

## Acceptance criteria
- [ ] A Keycloak-issued token for audience `esi-core` is accepted; one without that audience -> 401.
- [ ] A new (issuer, subject) creates one `users` row, as before.
- [ ] No Auth0 mention remains in core code, tests or docs.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D4 | portal | Replace the Auth0 SDK with a standards OIDC client for Keycloak
Covers SR-12, SR-1. Depends on: D1. ADRs: ADR-0011.

## Scope
- Replace `@auth0/auth0-angular` with a standards OIDC/PKCE client library (exact pin, chosen in this issue) behind the existing `AuthSession` abstraction in `src/app/core/auth/`.
- `AppConfig.auth` becomes `{ issuer, clientId, audience? }`, validated by `parseAppConfig`; `docker/40-esi-config.sh`, the Vercel config writer and `compose.yaml` use `ESI_PORTAL_AUTH_*` with Keycloak values.
- Interceptor attaches the token only to `apiBaseUrl`; sign-out calls the Keycloak end-session endpoint (single logout); tokens stay in memory with refresh token rotation.

## Out of scope
- Identity admin screens (D9, D18).

## Version impact
- `portal` minor.

## Acceptance criteria
- [ ] Sign-in, guarded routes, sign-out and the signed-out error page work against a local Keycloak.
- [ ] `parseAppConfig` rejects a missing or non-URL `auth.issuer`.
- [ ] The token is sent only to `apiBaseUrl` requests (unit test).
- [ ] No Auth0 package or mention remains in the portal.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D5 | esi | Route /api through the edge Worker and retire Auth0
Covers SR-12, SR-3. Depends on: D2, D3, D4, E5. ADRs: ADR-0012, ADR-0011.

## Scope
- `infra/vercel/build-output.sh`: the `/api/*` rewrite targets the Worker URL; the core URL moves to the Worker's settings.
- Demo settings: core `ESI_CORE_Auth__Authority`/`Audience` and portal `ESI_PORTAL_AUTH_*` point at the Oracle Keycloak.
- Remove `infra/auth0/`; update `infra/azure/README.md`, `infra/vercel/README.md`, `docs/onboarding` for Keycloak; record how demo users are created (UR-140 Open question 5).

## Out of scope
- Edge features beyond D2.

## Version impact
- none (infra and docs).

## Acceptance criteria
- [ ] Demo sign-in goes through Keycloak; the portal reaches core only through the Worker.
- [ ] A request with a bad token is stopped at the Worker (core logs show no request).
- [ ] No Auth0 setting, doc or secret remains in the repo or the GitHub environments.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D6 | contracts | grants-api 0.1: tenants, members and invitations
Covers SR-2 (MT-01, 02, 05, 08, 09). Depends on: E1. ADRs: ADR-0013.

## Scope
- New design-first spec `grants-api` in `services/contracts`: tenants (create, get, list for platform admins, suspend, resume, delete with export), members (list, remove), invitations (create, resend, revoke), quotas.
- `bearerAuth` security on every operation, problem+json errors (400, 401, 403, 404, 409), pagination like core-api.
- Lint (Spectral) and publish with the contracts package.

## Out of scope
- Roles and grants (D10).

## Version impact
- contracts minor (new spec, additive).

## Acceptance criteria
- [ ] Spectral passes; the spec is in the published package.
- [ ] Every operation states which role may call it (platform admin, tenant admin) and that it is tenant-scoped.
- [ ] Examples for each request and error response.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D7 | idp | Tenant and role claims in tokens
Covers SR-3, SR-2 (MT-03, RG-30, RG-31). Depends on: D1. ADRs: ADR-0011.

## Scope
- Protocol mappers: `tenant_id` from the user's active Organization, flat `roles` claim (`<client>:<role>` and relevant realm roles) for the requested audience, `scope_ids` when a scoped role exists.
- Keep tokens small: only roles of the token's audience; a size check in tests.
- Behavior for a user in several organizations: one active tenant per token (selection rule documented).

## Out of scope
- Role catalog content (D11).

## Version impact
- `idp` minor (token contract additions).

## Acceptance criteria
- [ ] Tokens of an organization member carry `tenant_id` and `roles`; a user without an organization gets no `tenant_id`.
- [ ] A token for audience `esi-core` does not carry roles of other clients.
- [ ] A user with 50 roles produces a token under the documented size limit.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D8 | grants | Tenant onboarding, suspension and member invitations
Covers SR-2 (MT-01, 02, 05, 07, 08, 09, 10). Depends on: E3, D6, D7. ADRs: ADR-0013, ADR-0011.

## Scope
- Implement D6's endpoints: create tenant = Keycloak Organization + domain + default roles/clients from templates + first admin invitation, in one call with rollback on failure; suspend/resume (disable members' sign-in); delete with data export.
- Tenant registry table, quotas (users, clients), per-tenant policy record (password, MFA required, session timeouts) applied to the Organization where Keycloak supports it.
- Authorization: platform admin for tenant lifecycle, tenant admin for own members only; every query filtered by tenant; audit log entries.

## Out of scope
- Roles and grants (D11), UI (D9).

## Version impact
- `grants` minor; pins contracts with grants-api 0.1.

## Acceptance criteria
- [ ] One API call creates a working tenant whose admin can accept the invitation and sign in.
- [ ] A failure mid-creation leaves no half-created Organization (compensation test).
- [ ] Tenant admin of A cannot list, invite or remove members of B (cross-tenant tests on every endpoint).
- [ ] Logs and audit entries carry `tenant_id` and never tokens.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D9 | portal | Identity admin module: tenants, members and invitations
Covers SR-7, SR-2 (MT-05, MT-09). Depends on: D6, D8. ADRs: ADR-0013.

## Scope
- New independent feature module `identity-admin` in `web/esi-portal` (rules in `web/esi-portal/CLAUDE.md`), generated `grants-api` client pinned to the published contracts version.
- Platform admin: tenant list, create, suspend, resume. Tenant admin: members list, invite, resend, revoke, remove.
- Visible only to users with the matching roles; follows `portal-ui-design` and `frontend-accessibility`.

## Out of scope
- Grants and approvals screens (D18).

## Version impact
- `portal` minor.

## Acceptance criteria
- [ ] A platform admin creates a tenant and the invitation reaches the first admin.
- [ ] A tenant admin sees only their own tenant's members.
- [ ] Users without admin roles do not see the module (route guard and menu).
- [ ] Accessibility checks pass for the new screens.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D10 | contracts | grants-api: role catalog, grants, requests and approvals
Covers SR-4, SR-6 (RG-01..05, 10..16). Depends on: D6. ADRs: ADR-0013.

## Scope
- Add to `grants-api`: role catalog per tenant and application (templates, composites, sensitive flag, separation-of-duties pairs), grants (create with scope id, reason, ticket, `valid_from`, `valid_to`; revoke; list with effective source), grant requests and approvals, bulk grant with `dryRun`, delegations, effective roles of a user, audit query.
- Idempotency key header on create operations.

## Out of scope
- Implementation (D11, D14, D15).

## Version impact
- contracts minor (additive to grants-api).

## Acceptance criteria
- [ ] Spectral and `oasdiff` pass (non-breaking vs 0.1).
- [ ] Each operation documents the caller roles and the no-escalation rule.
- [ ] Examples include a refused escalation (403) and a separation-of-duties conflict (409).

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D11 | grants | Role catalog and direct grants with no privilege escalation
Covers SR-4 (RG-01..05, 10, 11, 16, 40, 41, 42, 45). Depends on: D8, D10. ADRs: ADR-0013.

## Scope
- Role catalog endpoints mapped to Keycloak client/realm roles, composites and groups; templates copied to a tenant at onboarding.
- Direct grant: checks grantor scope and no escalation, separation-of-duties pairs, saves `pending`, writes the role mapping through the Admin API, marks `active`; retries with idempotency key; revoke removes the mapping.
- Effective roles endpoint (direct, group, composite source) and audit log entries.

## Out of scope
- Expiry (D12), approvals (D14), bulk and delegation (D15).

## Version impact
- `grants` minor.

## Acceptance criteria
- [ ] A granted role appears in the grantee's next token; a revoked one disappears.
- [ ] Granting a role outside the grantor's scope or above their own rights -> 403 (tests for each path).
- [ ] Keycloak unavailable -> grant stays `pending` and applies on retry, never duplicated.
- [ ] Cross-tenant tests on every endpoint.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D12 | grants | Grant expiry scheduler and revocation
Covers SR-5 (RG-10, RG-17, RG-43, NFR-03). Depends on: D11, D13. ADRs: ADR-0013, ADR-0012.

## Scope
- Single-instance scheduler (database lock) that expires grants past `valid_to`: removes the role mapping, logs out the user's sessions, writes the revocation entry to Workers KV through the Cloudflare API, marks `expired`, audits.
- Grants with a future `valid_from` are applied when they start.
- Scan interval configurable (default 1 minute).

## Out of scope
- Edge reading of the list (D13).

## Version impact
- `grants` minor.

## Acceptance criteria
- [ ] An expired grant's role is gone from new tokens within one scan interval.
- [ ] The revocation entry exists in KV with the user and time (test against a KV fake).
- [ ] After a service restart, missed expiries are processed.
- [ ] A future-dated grant becomes active at `valid_from`.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D13 | edge | Check the revocation list in Workers KV
Covers SR-5 (RG-17). Depends on: D2. ADRs: ADR-0012.

## Scope
- Read the revocation entry for the token subject from Workers KV; reject with 401 when the token's `iat` is earlier than the revocation time.
- Entries expire after the maximum access-token lifetime plus a margin.

## Out of scope
- Writing entries (D12).

## Version impact
- `edge` minor.

## Acceptance criteria
- [ ] A token issued before the revocation time -> 401; one issued after -> allowed.
- [ ] KV unavailable -> documented behavior (fail open or closed, chosen and tested).
- [ ] CPU per request stays within the free-plan limit.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D14 | grants | Grant requests and approvals
Covers SR-6 (RG-12). Depends on: D11. ADRs: ADR-0013.

## Scope
- A user requests a role with a reason and validity; approvers of the tenant approve or reject; sensitive roles need two distinct approvers; the requester cannot approve their own request.
- On final approval the grant is created through D11's path; notifications by email through Keycloak or a simple mail provider (decided here, free tier).

## Out of scope
- UI (D18).

## Version impact
- `grants` minor.

## Acceptance criteria
- [ ] A sensitive role is granted only after two different approvers approve.
- [ ] Self-approval and approval by a user outside the tenant -> 403.
- [ ] Rejected and expired requests create no grant; every step is audited.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D15 | grants | Bulk grants with dry-run and time-limited delegation
Covers SR-6 (RG-14, RG-15). Depends on: D11. ADRs: ADR-0013.

## Scope
- Bulk grant and bulk revoke by group, list or CSV with `dryRun` returning what would change; each item follows the D11 checks.
- Delegation: a user delegates a subset of their roles to another user for a period; never more than the delegator holds; ends at its end date or when the delegator loses the role.

## Out of scope
- UI (D18).

## Version impact
- `grants` minor.

## Acceptance criteria
- [ ] Dry-run changes nothing and lists every planned change and refusal.
- [ ] A delegation of a role the delegator lacks -> 403; it ends automatically at the end date.
- [ ] Partial failures in a bulk run are reported per item and audited.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D16 | idp | Event-listener SPI for role and membership changes
Covers SR-8 (RG-47). Depends on: E2, D11. ADRs: ADR-0013.

## Scope
- Java event-listener provider in `services/idp`: on admin events for role mappings, group membership and organization membership, post a signed (HMAC) webhook to Role Grant Service asynchronously with a bounded queue and retries; never block or fail the Keycloak request.
- Enabled for realm `esi` through the realm config; secret from environment.

## Out of scope
- Handling the events (D17).

## Version impact
- `idp` minor.

## Acceptance criteria
- [ ] A role mapped in the console produces one webhook with the event details within seconds.
- [ ] Role Grant Service down -> Keycloak operations still succeed; events retry and are logged when dropped.
- [ ] Integration test with the built image and a fake receiver.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D17 | grants | Event intake, reconciliation job and outgoing events
Covers SR-8 (RG-44, RG-46, INT-08). Depends on: D11, D16. ADRs: ADR-0013.

## Scope
- Webhook endpoint for D16 events (HMAC check, idempotent by event id) that flags changes not made by the service.
- Scheduled reconciliation comparing Keycloak role mappings with active grants per tenant; reports drift and optionally reverts (setting).
- Outgoing webhooks `role.granted`, `role.revoked`, `grant.expired`, `tenant.created` with signed payloads and retries.

## Out of scope
- UI for drift reports (can show in D18).

## Version impact
- `grants` minor.

## Acceptance criteria
- [ ] A role added by hand in Keycloak is reported (event) and found by reconciliation.
- [ ] An unsigned or replayed webhook is rejected.
- [ ] Subscribers receive each event at least once with a stable event id.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D18 | portal | Identity admin module: role matrix, grants and approvals
Covers SR-7, SR-4, SR-6 (RG-20, 21, 22). Depends on: D10, D11, D14. ADRs: ADR-0013.

## Scope
- User x role matrix with effective roles and their source; grant form with scope, reason, validity; revoke; approvals inbox; request-a-role form for end users; app owners see only their application's roles.
- Uses the pinned generated `grants-api` client.

## Out of scope
- Bulk and delegation screens (later, after D15 if needed).

## Version impact
- `portal` minor.

## Acceptance criteria
- [ ] A tenant admin grants a time-limited role and sees it in the matrix with its end date.
- [ ] An approver approves a request from the inbox; the requester sees the new role after re-sign-in.
- [ ] An app owner cannot see or grant other applications' roles.
- [ ] Accessibility checks pass for the new screens.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D19 | idp | MFA, step-up, password and brute-force policies per tenant
Covers SR-9 (IAM-03, IAM-04, IAM-07). Depends on: D7. ADRs: ADR-0011.

## Scope
- Authentication flows with TOTP and WebAuthn/passkeys; MFA required per tenant (from D8's policy record) and step-up for sensitive roles.
- Password policy (length, history, blacklist) and brute-force lockout thresholds; account console for devices, sessions and MFA.

## Out of scope
- Passwordless magic links (not filed).

## Version impact
- `idp` minor.

## Acceptance criteria
- [ ] A tenant with mandatory MFA forces enrollment at the next sign-in.
- [ ] Five wrong passwords (configurable) lock the account temporarily.
- [ ] A sensitive-role action requests step-up when the session has no second factor.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D20 | idp | Identity brokering per tenant and home-realm discovery
Covers SR-10 (SSO-09, SSO-11). Depends on: D7. ADRs: ADR-0011.

## Scope
- Identity providers per Organization (Google, Microsoft Entra ID; generic OIDC/SAML for enterprise tenants), first-login flow (link or create by policy) and mappers for name and email.
- Home-realm discovery by email domain linked to the Organization.
- Client secrets for providers from environment, never committed.

## Out of scope
- LDAP/AD federation (UR-140 Decision 6).

## Version impact
- `idp` minor.

## Acceptance criteria
- [ ] A user with a tenant's email domain is sent to that tenant's provider and lands in the tenant.
- [ ] First login links to an existing invited account instead of creating a duplicate.
- [ ] A provider of tenant A cannot sign a user into tenant B.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D21 | idp | Login theme, languages and emails per tenant
Covers SR-11 (MT-06, IAM-06, IAM-11). Depends on: D1. ADRs: ADR-0011.

## Scope
- ESI login theme (Keycloak theme in `services/idp`), Vietnamese and English messages, responsive, WCAG 2.1 AA.
- Per-organization logo and colors where Keycloak supports it; email templates (invite, verify, reset) in both languages.

## Out of scope
- Custom domains per tenant.

## Version impact
- `idp` minor.

## Acceptance criteria
- [ ] Login, reset and invite pages render in vi and en with the ESI theme.
- [ ] A tenant's logo shows on its users' login page.
- [ ] Accessibility check of the login page passes.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D22 | esi | Observability, audit retention and IdP runbook
Covers SR-13 (NFR-10, NFR-11, OPS-07, OPS-09). Depends on: E5. ADRs: ADR-0012.

## Scope
- Collect Keycloak and Role Grant Service metrics and JSON logs with `tenant_id` on the Oracle VM within free limits; health checks with an alert (email) when Keycloak is down.
- Keycloak events and admin events stored 90 days (demo); Role Grant audit log retention.
- Runbook in `infra/oracle/`: sign-in incidents, key rotation, restore, suspend a tenant, emergency revocation, Keycloak upgrade steps.

## Out of scope
- Paid monitoring services.

## Version impact
- none (infra and docs).

## Acceptance criteria
- [ ] Stopping Keycloak triggers an alert email.
- [ ] Logs for a sign-in show `tenant_id` and no token.
- [ ] A dry-run of the restore and key-rotation runbook steps succeeds.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## D23 | esi | End-to-end scenario: sign-in, tenant isolation, grant expiry
Covers SR-1, SR-2, SR-3, SR-5. Depends on: D5, D12, D13. ADRs: ADR-0011, ADR-0012, ADR-0013.

## Scope
- Extend `infra/e2e` (or add an IdP scenario) wiring published images: Keycloak, Role Grant Service, edge Worker (local `wrangler dev` or Miniflare), core, portal.
- Scripted flow: create two tenants, invite users, sign in, call core through the Worker, cross-tenant call denied, grant a time-limited role, wait for expiry, access denied.

## Out of scope
- Load testing.

## Version impact
- none.

## Acceptance criteria
- [ ] The scenario passes in CI or by one documented command.
- [ ] Cross-tenant access is denied at the edge and in Role Grant Service.
- [ ] An expired grant blocks access within the configured interval.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.
