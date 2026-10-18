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
- Release: `nx release` (independent per package; do not hand-edit versions). Preview with `nx release --dry-run --first-release --skip-publish`.
- Prerelease of one package (what the `prerelease` workflow runs in CI, from `develop` or `main`): `npx nx release version <x.y.z-rc.n> --projects=<pkg> --git-commit=false --git-tag=false --stage-changes=false` (builds first, writes the version into `dist/<pkg>/package.json` only) then `npx nx release publish --projects=<pkg> --tag=rc`. `nx affected` compares against `develop` (`defaultBase`).
- Docker: `docker build -t lib:dev .` (or `docker compose build`); the image runs `check` and `test:boundaries` without access to other projects

## Structure
- `dsl-schema/`, `dsl-core/`, `dsl-renderer-angular/`, `api-client/`, `ui-tokens/` - one package each; no package imports from `web/` or `services/`. Nx module-boundary tags: `scope:schema` (`dsl-schema`, no deps) <- `scope:core` (`dsl-core`) <- `scope:renderer` (+ `scope:tokens` = `ui-tokens`); framework tags (`framework:angular`, and e.g. `framework:react` if another renderer is added) must not import each other; `api-client` is `scope:api`.
- Release tags: `lib-<package>@vX.Y.Z`, published to GitHub Packages (`$ESI_PACKAGE_REGISTRY_URL`).

## Project context
- Pins that look odd but are required: TypeScript 5.9.3 (`@angular/build` 21.2.x needs `>=5.9 <6.0`), vitest and `@vitest/*` 4.0.18 (4.1.x triggers an npm 10 Arborist crash on install). Do not bump them without rerunning `npm ci` and `npm run check`.
- `tsconfig.base.json` must keep `module`/`moduleResolution` = `nodenext` and must not set `emitDeclarationOnly` (breaks `@nx/js:tsc` and ng-packagr).
- `dsl-renderer-angular/vite.config.mts` passes `tsconfig.spec.json` to the Analog plugin; otherwise components with `templateUrl` fail in tests.
- Each package declares `publishConfig.registry` (GitHub Packages); `.npmrc` only references `NODE_AUTH_TOKEN`.
- Known warnings: `nxViteTsPaths`/`nxCopyAssetsPlugin` deprecations (removed in Nx 24) and the legacy `@nx/eslint:lint` executor on the Angular package.
