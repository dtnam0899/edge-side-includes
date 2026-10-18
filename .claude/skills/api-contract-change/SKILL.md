---
name: api-contract-change
description: Design, change, version, publish, or consume an API contract. Use when editing OpenAPI/proto schemas, assessing compatibility, regenerating clients, or coordinating API changes across independent projects.
---

# API contract change

## Scope

Own the lifecycle of an API contract change: contract source, compatibility decision, validation, version impact, publication, and consumer adoption. This skill does not implement endpoint/domain behavior (`dotnet-conventions` or the relevant stack skill), generate API reference documentation (`doc-generator`), or decide database schema migration safety (`database-change`).

## Workflow

1. Identify the authoritative contract (for example OpenAPI or proto), its published version, affected operations/schemas, consumers, and the repository's release policy. Read project instructions; never guess routes, versioning rules, registry, or commands.
2. Define the intended change from requirements. Update the contract first. Keep unrelated operations and generated artifacts out of the contract source.
3. Assess compatibility for existing requests and responses, including required fields, enum values, status/error responses, auth, and semantics. Treat removal, rename, narrowing, or making optional data required as potentially breaking. If compatibility is uncertain, report the case and ask for a decision rather than silently classifying it.
4. Run the repository's contract lint, validation, and compatibility/diff checks. Add or update examples and contract tests for success and error cases without including secrets or sensitive sample data.
5. For a breaking change, follow the project's major-version and deprecation policy; document migration steps and any required architecture decision. Do not hide a breaking change in a patch/minor release.
6. Publish/release the producer before changing consumers. Consumers pin the published artifact, update their dependency, regenerate generated clients/models using the documented generator, and commit generated output with its source version/regeneration record where required. Never hand-edit generated code or introduce cross-project path dependencies.
7. Verify affected consumers against the new version: compile/type-check, contract/integration tests, and relevant compatibility scenarios. Report release order, versions, checks run, and consumers still needing migration.

## Rules

- The contract is the source of truth for API shape when the repository is contract-first.
- Keep old behavior available during the agreed migration window unless an explicitly approved breaking release says otherwise.
- Separate contract design/versioning from endpoint implementation and API documentation; coordinate those changes but use their dedicated workflows.
- Do not publish, deploy, or migrate consumers unless requested and authorized by the project's release process.
