---
id: feature-security-and-privacy
type: feature
status: Implemented for local use; production prerequisites open
updated: 2026-10-18
projects: [core, agents, portal]
issues: [ESI-15, ESI-16, ESI-17, ESI-18, ESI-19]
keywords: [security, privacy, authentication, local admin, owner isolation, encryption, consent, logging, redaction, untrusted input, SR-9, ADR-0003, ADR-0004]
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

## Authentication: local stand-in only

No identity provider exists yet (ADR-0001). Core runs only when `ESI_CORE_Auth__Mode=LocalAdmin` is set explicitly; every request then acts as one local admin user. This setting must never reach a deployment. Real authentication and authorization are a production prerequisite (phase 6).

## Before production (phase 6 checklist)

- Real authentication (identity provider decision and implementation in core and the portal's `core/`).
- Administrator (and legal) approval of the consent terms; the current text is an AI-drafted draft.
- Master key backup and ownership; review of moving to a managed key store (ADR-0003).
- Show the read-only database login recommendation (done in the portal) and confirm it in the release notes.
- Add `agents-unavailable` to the contract and decide the model provider.
- Required CI status checks on `develop` and `main` (the rulesets require one approval and block force pushes today).
