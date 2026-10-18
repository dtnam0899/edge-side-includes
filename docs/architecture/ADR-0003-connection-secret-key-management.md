---
id: ADR-0003
type: adr
status: Accepted
date: 2026-10-18
projects: [core]
issues: [ESI-15]
keywords: [encryption, envelope encryption, aes-256-gcm, master key, key rotation, connection string, secrets, github secret, key version]
---

# ADR-0003 Connection secret encryption and key management

## Context
- SR-1 and SR-9 ([UR-1](../requirements/UR-1-bi-ai-assistant-web-application.md)): connection strings are encrypted at rest with envelope encryption (per-secret AES-256-GCM data key wrapped by a master key); the master key is supplied to `core-backend` as an environment variable from a GitHub secret; keys are versioned for rotation. Decisions 11 and 17.
- A GitHub secret is a deployment input, not a runtime key store: no per-use audit, no managed rotation (UR-1 finding "GitHub secret scope").
- Connection strings are decrypted only inside `core-backend` at the moment of use and never reach the browser, the AI agent or logs.

## Options
1. **Master key in an environment variable (decided for now).** Simple; no audit or hardware protection; rotation requires a redeploy.
2. **Managed key service (cloud KMS or key vault).** Per-use audit and managed rotation; adds infrastructure and a vendor.
3. **Single key encrypting all secrets directly.** Simplest; rotation requires re-encrypting everything.

## Decision
Take option 1 for the first version, designed so option 2 can replace the key-wrapping step without data changes.

- Each secret is encrypted with a fresh random 256-bit data key using AES-256-GCM (random 96-bit nonce, the authentication tag stored with the ciphertext).
- The data key is wrapped (encrypted) by the master key identified by `keyVersion`, using AES-256-GCM with its own random nonce (.NET has no built-in AES key wrap, so GCM is used for wrapping too). The wrapped key is stored in the same table row as the connection record (decided 2026-10-18). The stored record contains: `ciphertext`, `nonce`, `tag`, `wrappedDataKey`, `keyVersion`, `algorithm`.
- Associated data binds the ciphertext to the record (connection id and owner id), so a copied blob cannot be used for another connection.
- Master keys come from environment variables (for example `ESI_MASTER_KEY_V1`, `ESI_MASTER_KEY_V2`, plus `ESI_MASTER_KEY_ACTIVE`); names are TBD in the scaffold. New secrets use the active version; older versions stay available for decryption.
- Rotation: add a new version, deploy, then re-wrap data keys in a background job (the secret ciphertext itself is not re-encrypted); retire the old key after all records moved.
- The master key and decrypted values are never logged, never returned by an API, never in exceptions or telemetry. The connection string type has a redacting `ToString`.
- Decrypt only at use, keep the plaintext in memory for the shortest time (no caching).
- The `compose.yaml` and tests use a throwaway dummy key; no real key is ever committed.

## Consequences
- ESI-15 needs a crypto service with an interface that hides key lookup, so a KMS can be introduced later (production review, Phase 6).
- Losing the master key makes all stored connections unrecoverable; users would have to re-enter them. Document the backup responsibility.
- Rotation needs an operational procedure and a migration job.

## Verification
- Unit tests: round trip, tamper detection (modified ciphertext, nonce, tag, associated data fails), wrong key version fails, rotation re-wrap keeps decryption working.
- Test that no API response, log line or exception message contains a seeded secret value.
- CI secret scan runs on the repo (`security-scan.sh` hook).

## Open questions
- Resolved 2026-10-18: wrapped data keys live in the same table as the connection record.
- Open (human, before production): master key backup and ownership process.
- Open: moving to a managed key store before production (Phase 6 review).
