# services/contracts

<!-- Supplements the repository root CLAUDE.md for this project. Keep only verified facts. -->

## Role
Design-first source of truth for the network APIs between ESI components. It is a project of its own (spec files, no runtime code), so it does not depend on any service, and services do not depend on it by path.

- Holds: OpenAPI specs (`core-api/`, `agents-api/`), later AsyncAPI/proto for events if needed, shared error/pagination schemas, examples.
- Does not hold: the UI DSL (owned by `lib/dsl-schema`), service code, or generated clients/servers.
- Consumers (each pins a published contract version and generates code inside its own project): `lib/api-client` (TS client), `services/core-backend` and `services/ai-agents` (server stubs/DTOs), `web/*` via `lib/api-client`.
- Workflow: change the spec in a PR -> lint and breaking-change check pass -> release a new version -> consumers bump the version and regenerate. Additive = minor; remove/rename/tighten = major plus an ADR in `docs/architecture/`.

## Stack
- OpenAPI 3.0.3 YAML; Spectral 6.17.0 (npm, pinned) for lint, oasdiff v1.33.0 (binary from the `tufin/oasdiff` image) for breaking-change diff; everything runs in Docker, no host install needed

## Commands (run from this directory)
- Lint: `npm run lint` (Spectral, warnings fail); version consistency: `npm run check:versions`; bundle: `npm run bundle`; all three: `npm run check`
- Breaking-change check against the last release: `scripts/check-breaking.sh <dir with last released specs>` (needs `oasdiff`; available in the Docker image, see README)
- Docker: `docker build -t contracts:dev .` runs `npm run check` and `npm pack` (tarball in `/out`); `docker compose run --rm contracts` does the same; publishing runs in CI (see the `esi-project-standards` skill)

## Structure
- `core-api/` - OpenAPI spec of `services/core-backend`
- `agents-api/` - OpenAPI spec of `services/ai-agents`; internal, called only by `services/core-backend` (the portal never calls agents directly)
- `common/components.yaml` - shared schemas (`Problem` with `issues`, `PageInfo`, `ColumnDefinition`, `SchemaMetadata`, `SqlOutputKind`, `VisualizationIntent`, `DslDocument`, `ValidationIssue`) and `ProblemResponse`; each spec re-exports them under its own `components` via `$ref`
- `bundled/` - generated at pack time (`npm run bundle`, Redocly CLI 2.57.0), git-ignored; one self-contained file per API in the package
- `scripts/` - `check-versions.mjs` (spec `info.version` equals `package.json` version), `set-version.mjs` (release tooling used by CI: sets the package and spec versions together), `check-breaking.sh`

## Project context
- Design decisions for 0.1.0 (2026-10-18): chat is synchronous JSON (streaming may come as a minor addition); paging is stateless by page number (each page re-runs the SELECT); no security scheme until the authentication ADR (local admin assumed); agents-api is internal. Problem types are `urn:esi:problem:<name>` and listed in each spec's `info.description`.
- Since 0.2.0 (ESI-85, ADR-0006): core-api has a global `bearerAuth` (HTTP bearer, JWT) and every operation references `UnauthenticatedResponse` (401); a new core-api operation must reference it too. Health endpoints are not in the contract; if one is added, give it `security: []`. agents-api has no security scheme (internal ingress).
- Schemas carry field-level `example`s; consumers generate their mocks and fixtures from them (P0-14, `docs/process/test-data.md`). Add an operation-level example when a shape is not obvious from field examples.
- Generators: use the `bundled/*.yaml` files from the package. Verified for 0.1.0: `@hey-api/openapi-ts` 0.99.0 (TS, compiles with `strict`), NSwag 14.7.1 (C#, compiles), datamodel-code-generator (Python pydantic v2). NSwag cannot follow the cross-file `$ref`s of the source specs. Decided for .NET (2026-10-18, ESI-15): NSwag, DTOs only, from `bundled/core-api.yaml`, inside `services/core-backend`. The Python generator is decided in ESI-18.
- `info.version` in each spec is the contract version and the release version. Bump it in the PR that changes the contract, together with `package.json` and the changelog, using `node scripts/set-version.mjs <x.y.z>` (never by hand).
- Published as an npm package (`@dtnam0899/esi-contracts`, one package, `info.version` of each spec kept in sync with the package version) to GitHub Packages (`$ESI_PACKAGE_REGISTRY_URL`), tag `contracts@vX.Y.Z`. The package contains the spec files only.
- Consumers get the specs by installing that package at a pinned version (in a Docker build stage or CI step, e.g. `npm pack`/`npm install` into a temp dir), which also works for .NET and Python projects; nobody reads this directory by path.
- Auth: `NODE_AUTH_TOKEN` env var referenced from this project's `.npmrc`; no token in the repo.
- Prerelease (proven in P0-12): the `prerelease` workflow (Actions, manual, from `develop` or `main`, version must have a `-<preid>`) runs `node scripts/set-version.mjs <version>`, `npm run check` and `npm publish --tag rc` with `GITHUB_TOKEN`; it commits nothing and creates no tag. The same workflow with `mode=cleanup` deletes that version. Stable releases: after the `develop` -> `main` release merge, start the `release-contracts` workflow on `main`; it lints, runs the breaking-change check against the latest published version, publishes the committed version and pushes the tag `contracts@v<version>`.
- Consuming a version in Docker: `.npmrc` with the `@dtnam0899` registry line and `_authToken=${NODE_AUTH_TOKEN}`, then `RUN --mount=type=secret,id=npm_token,env=NODE_AUTH_TOKEN npm install --save-exact @dtnam0899/esi-contracts@<version>` built with `docker build --secret id=npm_token,env=NODE_AUTH_TOKEN`; never pass the token as `ARG`/`ENV`. Token setup: `docs/process/github-setup.md`.
