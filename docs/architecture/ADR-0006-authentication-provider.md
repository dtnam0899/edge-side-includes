---
id: ADR-0006
type: adr
status: Proposed
date: 2026-10-18
projects: [contracts, core, portal]
issues: [ESI-70]
keywords: [authentication, identity provider, auth0, oidc, jwt, bearer token, pkce, current user, local admin, sr-9, invite-only, free tier]
---

# ADR-0006 Authentication provider

## Context
- SR-9 ([UR-1](../requirements/UR-1-bi-ai-assistant-web-application.md)): every API operation checks that the authenticated user owns the referenced connection and saved assets. The single local admin stand-in must not reach production; real authentication is a release prerequisite. The ADR index lists "authentication provider" as a planned ADR.
- Core today: `ICurrentUser` exposes one `Guid UserId`; `AddCurrentUser` accepts only `ESI_CORE_Auth__Mode=LocalAdmin` and otherwise refuses to start (`src/Esi.Core.Api/Auth/`). Every owner-scoped feature (connections, consent, chat, scripts, artifacts, dashboards) already filters by `ICurrentUser.UserId`.
- The core-api contract (`@dtnam0899/esi-contracts` 0.1.0) declares no security scheme and no 401 responses.
- The portal reads runtime settings from `/config.json` (`AppConfig`, `parseAppConfig`; no build-time `environment.ts`); auth belongs in `src/app/core/` (`web/esi-portal/CLAUDE.md`).
- The demo runs on Vercel Hobby with core behind a Vercel rewrite on the same origin (ADR-0005). Until this ADR, the demo needed a `LocalAdmin` exception on a public core URL.
- ESI is a personal, non-commercial project; the demo must stay free (ADR-0005). The product owner chose Auth0 (2026-10-18).
- Free tiers checked on 2026-10-18: Auth0 Free, up to 25,000 MAU, no credit card ([Auth0](https://auth0.com/llms-full.txt)); Microsoft Entra External ID, first 50,000 MAU ([pricing](https://azure.microsoft.com/en-us/pricing/details/microsoft-entra-external-id)); Clerk Hobby, 50,000 monthly retained users, no official Angular SDK ([Clerk](https://clerk.com/articles/clerk-pricing-explained)); Keycloak, free software but self-hosted (JVM, its own database).
- `@auth0/auth0-angular` 2.13.0 has peer dependencies `@angular/core|common|router >=13` (npm, 2026-10-18), so it installs with the portal's Angular 21.

## Options
1. **Auth0 Free, integrated through standard OIDC/OAuth 2.0.** Pros: free at demo scale, fastest setup, sign-ups can be disabled, maintained Angular SDK, core needs only the standard JWT bearer handler. Cons: one more vendor; the free tenant has no SLA.
2. **Microsoft Entra External ID.** Pros: same cloud as core (ADR-0005), larger free allowance. Cons: external tenant and user flows take more setup.
3. **Clerk.** Pros: generous free tier. Cons: no official Angular SDK.
4. **Self-hosted Keycloak.** Pros: no vendor. Cons: another service to run, patch and back up; does not fit the free compute allowance well.

## Decision
Take option 1. Core depends only on standard OIDC/JWT, so moving to option 2 or another provider later is a configuration change plus a user re-link, not a code rewrite.

Auth0 tenant
- One free tenant for the demo (for example `esi-demo`), region close to the Azure region of ADR-0005.
- An **API** with identifier (audience) `https://api.esi.demo` (a logical name, not a URL that must resolve), RS256, access token lifetime 1 hour. Requesting tokens with this audience is mandatory: without it Auth0 issues opaque tokens that core cannot validate.
- A **Single Page Application** client for the portal: Authorization Code with PKCE, refresh token rotation on, callback, logout and web-origin URLs set to the Vercel production URL, `http://localhost:4200`, and the Vercel preview URL pattern of this project.
- **Invite-only:** the Username-Password database connection has "Disable Sign Ups" on; demo users are created or invited by the owner. No social connections in the demo (Auth0 developer keys for social logins are not meant for real use).
- Secrets: none in the portal (public client). Core needs no client secret either, only the issuer and audience.

Core (`services/core-backend`)
- New mode `ESI_CORE_Auth__Mode=Oidc` with `ESI_CORE_Auth__Authority` (`https://<tenant>.<region>.auth0.com/`) and `ESI_CORE_Auth__Audience`. Uses `Microsoft.AspNetCore.Authentication.JwtBearer` (version pinned in `Directory.Packages.props`), which validates issuer, audience, lifetime and signature from the provider's discovery document. No Auth0 SDK in core.
- Every endpoint requires an authenticated user (fallback authorization policy), except `/health` and `/health/ready`. A missing or invalid token answers 401 as problem+json (`urn:esi:problem:unauthenticated`).
- User mapping: a new `users` table (`id` GUID, `issuer`, `subject`, `created_at`, unique on `issuer` + `subject`). The first authenticated request of a new (issuer, subject) creates the row; `ICurrentUser.UserId` is that `id`. Domain code keeps using the GUID; no provider ids leak into other tables. Email and name are not stored (not needed yet).
- `LocalAdmin` stays for local development and the integration tests only. Startup refuses `LocalAdmin` when the host environment (`ASPNETCORE_ENVIRONMENT`, default `Production`) is not `Development`, so a hosted environment cannot run it by mistake. Core's `compose.yaml`, its integration-test host and `infra/e2e` then set `ASPNETCORE_ENVIRONMENT=Development` explicitly.
- Logs record the internal user id, never tokens or the `Authorization` header (add `authorization` to `SensitiveDataRedactor`).

Contract (`services/contracts`)
- core-api adds a `bearerAuth` security scheme (HTTP bearer, JWT) applied globally, `security: []` on the health endpoints if they are in the contract, and a shared 401 problem response on every operation. This is additive (minor version). Released before core and portal adopt it (root `CLAUDE.md` rule 2).

Portal (`web/esi-portal`)
- `@auth0/auth0-angular` (exact pin) configured in `src/app/core/auth/`; `AppConfig` gains `auth.domain`, `auth.clientId`, `auth.audience`, validated by `parseAppConfig`, written by `docker/40-esi-config.sh` from `ESI_PORTAL_AUTH_*` variables and, on Vercel, by a build step that writes `public/config.json` from the same variables (these values are public client settings, not secrets).
- The SDK's HTTP interceptor attaches the access token only to `apiBaseUrl` requests. Routes are guarded; an unauthenticated user goes to the Auth0 Universal Login page. Tokens stay in memory (default cache), refreshed with rotating refresh tokens.
- The feature modules do not see auth details; they keep calling their `apis/` layer.

Agents (`services/ai-agents`)
- Unchanged. Agents stay on internal ingress and receive no user tokens (ADR-0005).

## Consequences
- ADR-0005 no longer needs the `LocalAdmin` exception: the demo core validates tokens, so its public URL is no longer an open admin endpoint.
- Release order: contracts (security scheme, 401) → core (Oidc mode, users table migration) → portal (login, interceptor, config). Each is its own PR.
- Existing data created as the local admin GUID does not belong to any Auth0 user. The demo database starts empty; local data stays local.
- One more vendor and dashboard. Auth0 free tenants can be deleted or changed by Auth0's plan terms; the generic OIDC integration limits the cost of moving.
- No roles yet. The SR-9 "admin" (who reviews consent terms) is out of scope; when needed, use an Auth0 role surfaced as a namespaced claim, decided then.
- Integration tests keep `LocalAdmin` plus the test-only `X-Test-User` header; one new test host configuration runs the Oidc mode against locally signed test tokens.

## Verification
- Core unit and in-memory API tests: no token → 401; wrong audience, wrong issuer, expired or tampered token → 401; valid token → the mapped user id; same (issuer, subject) twice → one `users` row; another user's connection still → 404.
- Core startup test: `LocalAdmin` outside `Development` fails to start.
- Contract lint (Spectral) and `oasdiff`: the change is non-breaking.
- Portal unit tests: `parseAppConfig` rejects missing auth settings; the interceptor adds the token only for `apiBaseUrl`; the route guard redirects when signed out.
- Demo smoke run (ADR-0005 verification) signs in with a demo user before the e2e scenario.

## Open questions
- Auth0 tenant region and the final audience string.
- Whether the demo needs self-service sign-up later (then: sign-up on, plus an allow-list Action or email verification).
- Session lifetime for demo users (Auth0 defaults unless decided).
