# Changelog

All notable changes are generated from Conventional Commits by the release flow. Do not edit released sections by hand.

## Unreleased

- Scaffold: .NET 10 solution (`Api`, `Application`, `Domain`, `Infrastructure`, unit and integration tests), `/health` liveness and `/health/ready` app-database readiness, environment-only configuration with user-secrets for local use, JSON console logging with secret redaction, EF Core `AppDbContext` with an initial migration and a migrations bundle, multi-stage Dockerfile (non-root, `HEALTHCHECK`, locked restore) and compose file with one SQL Server holding the app database and a separate target database for integration tests.
