# lib

<!-- Supplements the repository root CLAUDE.md for this project. Keep only verified facts. -->

## Overview
Shared TypeScript workspace used by the portal. Packages: `dsl-schema` (source of truth, no framework deps: the pinned A2UI v0.9 schema/catalog plus the ESI artifact envelope, see ADR-0002), `dsl-core` (parse, validate, migrate), `dsl-renderer-angular`, `api-client` (generated from a pinned published `services/contracts` version), `ui-tokens`. See the `dsl-authoring` and `dsl-renderer-parity` skills.

## Stack
- TypeScript strict, Nx 23 workspace (works with Angular 21; ADR-0001) (build, test, lint, affected, `nx release` with independent per-package versions)
- Registry: GitHub Packages (npm registry `https://npm.pkg.github.com`, so `ESI_PACKAGE_REGISTRY_URL` is that URL). Packages are scoped to the GitHub owner (`@dtnam0899/<name>`); auth is a `NODE_AUTH_TOKEN` env var (`GITHUB_TOKEN` in CI, a PAT with `read:packages` locally), configured through a project-level `.npmrc` that references the variable and never contains a token.
- Each package has its own version (`projectsRelationship: independent`); `nx release` bumps only affected packages, and dependents bump the changed dependency via `updateDependents`. Never hand-edit versions; a change in `dsl-schema` is released before its dependents.
- `web/*` consume packages by registry version, never by path

## Commands (run from this directory)
- Install: `npm ci` (lockfile is committed; all dependencies are pinned exactly)
- Build/test/lint: `npm run check` (= `nx run-many -t build test lint`; affected only: `nx affected -t build test lint`). Set `NX_DAEMON=false CI=true` in scripts and CI.
- Module boundaries: `npm run test:boundaries` (proves a forbidden import fails lint)
- Release: `nx release` (independent per package; do not hand-edit versions). Stable releases run only in CI: after a `develop` -> `main` release merge, start the `release-lib` workflow on `main` with the projects (default `dsl-schema,dsl-core,dsl-renderer-angular`), an optional explicit version (empty = from conventional commits) and `dry_run` to preview. It runs `check` and `test:boundaries`, `nx release version ... --first-release --git-commit=false --git-tag=false` (writes `dist/<pkg>/package.json`, including exact versions of internal dependencies), `nx release publish`, pushes `lib-<pkg>@v<version>` tags, then installs the published versions in a clean container. Versions live in the tags and the published packages, not in committed manifests (source `package.json` files stay `0.0.0`; `main` accepts only admin updates), and no changelog is committed.
- Local preview: `npx nx release version <x.y.z> --first-release --projects=<list> --git-commit=false --git-tag=false --stage-changes=false --dry-run`. Conventional commits alone give `0.0.1` for the first release, so the first release passes `0.1.0` explicitly. Do not publish from a laptop.
- Prerelease of one package (what the `prerelease` workflow runs in CI, from `develop` or `main`): `npx nx release version <x.y.z-rc.n> --projects=<pkg> --git-commit=false --git-tag=false --stage-changes=false` (builds first, writes the version into `dist/<pkg>/package.json` only) then `npx nx release publish --projects=<pkg> --tag=rc`. `nx affected` compares against `develop` (`defaultBase`).
- Docker: `docker build -t lib:dev .` (or `docker compose build`); the image runs `check` and `test:boundaries` without access to other projects

## Structure
- `dsl-schema/`, `dsl-core/`, `dsl-renderer-angular/`, `api-client/`, `ui-tokens/` - one package each; no package imports from `web/` or `services/`. Nx module-boundary tags: `scope:schema` (`dsl-schema`, no deps) <- `scope:core` (`dsl-core`) <- `scope:renderer` (+ `scope:tokens` = `ui-tokens`); framework tags (`framework:angular`, and e.g. `framework:react` if another renderer is added) must not import each other; `api-client` is `scope:api`.
- Release tags: `lib-<package>@vX.Y.Z`, published to GitHub Packages (`$ESI_PACKAGE_REGISTRY_URL`).

## Project context
- Test data (P0-14, `docs/process/test-data.md`): fixtures live next to each package's tests; DSL fixtures come from the package's own schema, never from other projects.
- Pins that look odd but are required: TypeScript 5.9.3 (`@angular/build` 21.2.x needs `>=5.9 <6.0`), vitest and `@vitest/*` 4.0.18 (4.1.x triggers an npm 10 Arborist crash on install). Do not bump them without rerunning `npm ci` and `npm run check`.
- `tsconfig.base.json` must keep `module`/`moduleResolution` = `nodenext` and must not set `emitDeclarationOnly` (breaks `@nx/js:tsc` and ng-packagr).
- `dsl-renderer-angular/vite.config.mts` passes `tsconfig.spec.json` to the Analog plugin; otherwise components with `templateUrl` fail in tests. It also inlines `@a2ui/*` (`server.deps.inline`); otherwise the tests fail with "Linked modules must use the same context".
- A2UI pins (ADR-0002): `@a2ui/angular` 0.13.0 and `@a2ui/web_core` 0.14.0, exact, in the root `package.json` and `dsl-renderer-angular/package.json`, and named in `dsl-schema/src/lib/versions.ts`; a `dsl-schema` test fails if they disagree or if the vendored v0.9.1 catalog differs from the one in `@a2ui/web_core`. Import only from `@a2ui/angular/v0_9`.
- `dsl-core` validates with Ajv (runtime-compiled, needs `'unsafe-eval'` under a CSP until validators are precompiled).
- Each package declares `publishConfig.registry` (GitHub Packages); `.npmrc` only references `NODE_AUTH_TOKEN`.
- Known warnings: `nxViteTsPaths`/`nxCopyAssetsPlugin` deprecations (removed in Nx 24) and the legacy `@nx/eslint:lint` executor on the Angular package.
