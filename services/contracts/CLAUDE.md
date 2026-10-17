# services/contracts

<!-- Supplements the repository root CLAUDE.md for this project. Keep only verified facts. -->

## Role
Design-first source of truth for the network APIs between ESI components. It is a project of its own (spec files, no runtime code), so it does not depend on any service, and services do not depend on it by path.

- Holds: OpenAPI specs (`core-api/`, `agents-api/`), later AsyncAPI/proto for events if needed, shared error/pagination schemas, examples.
- Does not hold: the UI DSL (owned by `lib/dsl-schema`), service code, or generated clients/servers.
- Consumers (each pins a published contract version and generates code inside its own project): `lib/api-client` (TS client), `services/core-backend` and `services/ai-agents` (server stubs/DTOs), `web/*` via `lib/api-client`.
- Workflow: change the spec in a PR -> lint and breaking-change check pass -> release a new version -> consumers bump the version and regenerate. Additive = minor; remove/rename/tighten = major plus an ADR in `docs/architecture/`.

## Stack
- OpenAPI 3.x YAML; lint with Spectral and breaking-change diff with oasdiff (both run in Docker, no host install)

## Commands (run from this directory)
- Lint: `<verified command>`
- Breaking-change check against the last release: `<verified command>`
- Docker: `docker build -t contracts:<version> .` lints, checks and packs the specs (`npm pack`); publishing runs in CI (see the `esi-project-standards` skill)

## Structure
- `core-api/` - OpenAPI spec of `services/core-backend`
- `agents-api/` - OpenAPI spec of `services/ai-agents` (including streaming endpoints used by `web/esi-assistant`)

## Project context
- `info.version` in each spec is the contract version and the release version; never edit it by hand outside the release flow.
- Published as an npm package (`@dtnam0899/esi-contracts`, one package, `info.version` of each spec kept in sync with the package version) to GitHub Packages (`$ESI_PACKAGE_REGISTRY_URL`), tag `contracts@vX.Y.Z`. The package contains the spec files only.
- Consumers get the specs by installing that package at a pinned version (in a Docker build stage or CI step, e.g. `npm pack`/`npm install` into a temp dir), which also works for .NET and Python projects; nobody reads this directory by path.
- Auth: `NODE_AUTH_TOKEN` env var referenced from this project's `.npmrc`; no token in the repo.
