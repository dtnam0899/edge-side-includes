---
name: dotnet-conventions
description: .NET conventions for ESI services. Use when creating or editing C# APIs, domain logic, EF Core data access, migrations, auth code, or .NET tests.
---

# .NET conventions

Commands, version and data store live in the project `CLAUDE.md`; general rules in `clean-code-rules.md` (claude-howto).

- Layers `Api -> Application -> Domain`, with `Infrastructure` implementing interfaces; Domain has no framework or database dependencies.
- Endpoints stay thin: map request, call an application handler, map result. Validate input at the boundary and return consistent problem-details errors.
- Contract-first where the repository has an OpenAPI/proto contract: change the contract first, then regenerate clients.
- EF Core: async calls with cancellation tokens, no queries in loops; migrations are reviewed by a human and applied ones are never edited.
- Configuration and secrets: user-secrets or environment variables only; never commit connection strings, signing keys or client secrets.
- Security-sensitive areas (authN/Z, token settings, data-access filters) need a human reviewer; use the `secure-reviewer` agent.
- Tests: `dotnet test`; unit-test handlers and domain, integration-test the API with a real database where practical. Test names describe behavior.
