---
id: ADR-0011
type: adr
status: Proposed
date: 2026-10-24
projects: [idp, core, portal, esi]
issues: [ESI-140]
keywords: [identity provider, keycloak, oidc, sso, multi-tenant, organizations, shared realm, realm per tenant, roles, claims, supersedes ADR-0006, auth0]
---

# ADR-0011 Identity provider: self-hosted Keycloak with a shared realm and Organizations

Supersedes [ADR-0006](./ADR-0006-authentication-provider.md) once accepted.

## Context
- [UR-140](../requirements/UR-140-keycloak-idp-sso.md) asks for one IdP for every ESI system and later partner systems: SSO and single logout, tenant isolation, rich role grants (SR-1..SR-11).
- ADR-0006 (Proposed, implemented by ESI-85..ESI-87) uses Auth0 Free with no tenants or roles. Core depends only on standard OIDC/JWT (`ESI_CORE_Auth__Authority`, `ESI_CORE_Auth__Audience`); the portal hides the Auth0 SDK behind `AuthSession` in `src/app/core/auth/`.
- The product owner decided on 2026-10-24: Keycloak replaces Auth0; one shared realm with Keycloak Organizations; a dedicated realm only for a tenant that needs strong isolation; no LDAP/AD federation (UR-140 Decisions 1, 4, 6).
- Keycloak is free, open-source software and must be self-hosted (JVM and its own database). Organizations are a Keycloak feature for grouping users, identity providers and email domains inside one realm (supported in Keycloak 26; exact version pinned in the scaffold, `TBD`).
- ESI is a personal, non-commercial demo that must stay on free tiers (ADR-0005).

## Options
1. **Keycloak, one shared realm + Organizations (realm per tenant only as an exception).** Pros: one place for clients, flows and keys; cheap per tenant; SSO across the tenant's applications; standard OIDC. Cons: per-tenant customization is limited to what Organizations, themes and flows allow; isolation is logical, so every admin path must enforce the tenant.
2. **Keycloak, one realm per tenant.** Pros: strong isolation of users, keys and policies. Cons: memory and startup cost grow with tenants; clients and roles are duplicated per realm; cross-realm SSO is not native.
3. **Keep Auth0 and add tenants with Auth0 Organizations.** Pros: no hosting. Cons: free-plan limits on organizations and roles (not verified here); vendor lock-in for the role-grant features; the product owner chose self-hosting.

## Decision
Take option 1.

- Realm `esi` holds every tenant as an Organization. A tenant is created only through Role Grant Service (ADR-0013), never by hand.
- Clients: `esi-portal` (public, Authorization Code + PKCE, refresh token rotation), a confidential client per backend that needs one, service accounts for machine calls. Core is an audience (`esi-core`) added by an audience mapper; requesting it is mandatory, as with ADR-0006.
- Token contract (claims every consumer may rely on): `iss`, `sub`, `aud`, `exp`, `tenant_id` (the Organization id; one active tenant per token), `roles` (flat list of `<client>:<role>` and realm roles relevant to the audience), `scope_ids` only when a role is scoped below the tenant (ADR-0013). Signed RS256; keys rotate with overlap.
- Short access tokens (5 minutes, `TBD` per tenant policy within limits) so revocation takes effect quickly (SR-5); SSO session idle and max lifetimes per tenant policy.
- Realm configuration is code in `services/idp` (applied by `keycloak-config-cli` or the Keycloak import, chosen in the scaffold), reviewed in PRs; no console-only changes except emergencies.
- Platform admins and tenant admins are separate roles; Keycloak fine-grained admin permissions limit console use to platform admins (tenant admins work through the portal and Role Grant Service).
- Core and portal stay provider-neutral: core keeps the generic JWT bearer handler; the portal implements `AuthSession` with a standards OIDC client library (pinned in D4), not a vendor SDK.

## Consequences
- ADR-0006 becomes `Superseded by ADR-0011`; `infra/auth0` and Auth0 settings are removed after core and portal switch (D3, D4, D5).
- Users get new (issuer, subject) pairs, so core creates new `users` rows; the demo database starts empty again (as ADR-0006 already accepted for its switch).
- One more service to run, patch and back up (ADR-0012 covers hosting).
- Tenant isolation is logical; Role Grant Service, the portal and the edge must all enforce `tenant_id` (UR-140 Finding 11).
- Moving a large tenant to its own realm later is possible but means a new issuer for that tenant's users.

## Verification
- Realm config applies cleanly to an empty Keycloak in CI (`services/idp` tests) and is idempotent on re-apply.
- Token tests: issued tokens carry `tenant_id`, `roles` and audience `esi-core`; core's existing Oidc tests pass against Keycloak-shaped tokens.
- Cross-tenant tests in Role Grant Service and the edge (ADR-0012, ADR-0013).

## Open questions
- Keycloak version to pin and whether Organizations need a feature flag in it (UR-140 Open question 3).
- Whether a user may belong to several tenants and switch without signing in again (MT-04, Should); the token carries one active tenant either way.
