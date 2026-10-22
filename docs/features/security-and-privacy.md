---
id: feature-security-and-privacy
type: feature
status: Implemented for local use and the free demo; production prerequisites open
updated: 2026-10-23
projects: [core, agents, portal]
issues: [ESI-15, ESI-16, ESI-17, ESI-18, ESI-19, ESI-85, ESI-86, ESI-87, ESI-89]
keywords: [security, privacy, authentication, auth0, oidc, jwt, bearer, local admin, owner isolation, encryption, consent, logging, redaction, untrusted input, SR-9, ADR-0003, ADR-0004]
---

# Security and privacy (cross-cutting)

How the assistant protects connections, the user's data and their saved assets. Requirement: SR-9 in [UR-1](../requirements/UR-1-bi-ai-assistant-web-application.md).

## Guarantees in place

| Concern | How it is handled |
|---------|-------------------|
| Connection strings | Encrypted at rest with AES-256-GCM envelope encryption under versioned master keys from environment variables; bound to connection and owner; decrypted only during a call; never in responses, errors or logs ([connections and consent](./connections-and-consent.md)) |
| Ownership | Every connection, session, script, artifact and dashboard belongs to one user; any other user gets 404 on every operation |
| Consent | Current terms must be accepted; per-database withdrawal hides all related data (403) until granted again; nothing is deleted |
| Writes to user databases | Impossible through the assistant: a single SELECT on user tables only, allow-list validation before the database, read-only intent in an always rolled-back transaction ([query execution](./query-execution.md)) |
| Stored procedures | Definitions are read as text; procedures are never executed or created; generated ones are scripts only |
| AI inputs | Only the question, history, schema structure (procedure string literals masked) and column definitions; never row values or connection strings; prompts are not logged |
| AI outputs | Treated as untrusted: SQL is validated again by core before running; DSL is validated by core and by the renderer; text is rendered as plain text, never HTML |
| Logs | JSON lines through a redacting formatter (passwords, keys and tokens masked); executed statements logged with literals replaced by `?` plus a hash; no result data |
| Errors | `application/problem+json`; unexpected errors become a generic 500 without the exception message |

## Authentication: Auth0 through OIDC

Decision: [ADR-0006](../architecture/ADR-0006-authentication-provider.md) (still `Proposed`). Contract: `bearerAuth` and 401 `unauthenticated` on every core-api operation since 0.2.0 (ESI-85).

- **Core** (ESI-86): `ESI_CORE_Auth__Mode=Oidc` with `ESI_CORE_Auth__Authority` (issuer URL) and `ESI_CORE_Auth__Audience`; JWT bearer tokens, RS256 only, keys from the issuer's discovery document. Every endpoint needs a signed-in user except `/health` and `/health/ready`. A missing or invalid token answers 401 `unauthenticated` with `WWW-Authenticate: Bearer`. The token's issuer and subject map to an internal user id (`Users` table), created on first sight; ownership checks use that id. `Authorization` values are masked in logs.
- **Portal** (ESI-87): `@auth0/auth0-angular` with Universal Login; every feature route is behind a guard; the token is sent only to the core API base URL; tokens stay in memory. Sign-in is invite-only for the demo (ADR-0006).
- **Local development:** `ESI_CORE_Auth__Mode=LocalAdmin` (one local admin user) is accepted only with `ASPNETCORE_ENVIRONMENT=Development`; core refuses to start with it anywhere else. A portal without `auth` settings has sign-in off and works only against such a core.

## Before production (phase 6 checklist)

- Accept ADR-0006 (authentication is implemented, the ADR is still `Proposed`).
- Administrator (and legal) approval of the consent terms; the current text is an AI-drafted draft.
- Master key backup and ownership; review of moving to a managed key store (ADR-0003).
- Show the read-only database login recommendation (done in the portal) and confirm it in the release notes.
- A paid model provider (new ADR) before any real data: the Gemini free tier (ADR-0007) allows demo data only.
- Required CI status checks on `develop` and `main` (the rulesets require one approval and block force pushes today).
