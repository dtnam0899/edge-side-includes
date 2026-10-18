---
name: dotnet-conventions
description: .NET coding conventions for ESI services. Use when implementing C# APIs, domain logic, EF Core queries, auth, or .NET tests; use database-change for schema or data migration lifecycle.
---

# .NET conventions

Commands, version and data store live in the project `CLAUDE.md`; general rules in `clean-code-rules.md` (claude-howto).

- Layers `Api -> Application -> Domain`, with `Infrastructure` implementing interfaces; Domain has no framework or database dependencies.
- Endpoints stay thin: map request, call an application handler, map result. Validate input at the boundary and return consistent problem-details errors.
- Contract-first where the repository has an OpenAPI/proto contract: change the contract first, then regenerate clients.
- EF Core query conventions: async calls with cancellation tokens and no queries in loops. For schema changes, data migrations, rollout/rollback, and migration safety, follow `database-change`; applied migrations are never edited.
- Configuration and secrets: user-secrets or environment variables only; never commit connection strings, signing keys or client secrets.
- Security-sensitive areas (authN/Z, token settings, data-access filters) need a human reviewer; use the `secure-reviewer` agent.
- Tests: use `testing-strategy` to choose test levels and cases; run `dotnet test` and follow the project's `CLAUDE.md`. Unit-test handlers and domain, integration-test the API with a real database where practical. Test names describe behavior.
