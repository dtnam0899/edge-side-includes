# Changelog

All notable changes are generated from Conventional Commits by the release flow. Do not edit released sections by hand.

## Unreleased

- Connections and consent (ESI-15, core-api 0.1.0): consent terms (AI-drafted draft `2026-10-18.1`) and acceptance, per-connection grant/withdraw, connections create/list/get/update/delete/test with envelope encryption (AES-256-GCM, versioned master keys, rotation re-wrap), owner isolation (404) and consent checks for every operation, problem+json errors, local admin stand-in that must be enabled explicitly, contract DTOs generated with NSwag from `@dtnam0899/esi-contracts` 0.1.0, migration `AddConnectionsAndConsent`.
- Scaffold: .NET 10 solution (`Api`, `Application`, `Domain`, `Infrastructure`, unit and integration tests), `/health` liveness and `/health/ready` app-database readiness, environment-only configuration with user-secrets for local use, JSON console logging with secret redaction, EF Core `AppDbContext` with an initial migration and a migrations bundle, multi-stage Dockerfile (non-root, `HEALTHCHECK`, locked restore) and compose file with one SQL Server holding the app database and a separate target database for integration tests.
