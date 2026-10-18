# web/esi-portal (Angular)

<!-- Supplements the repository root CLAUDE.md for this project. Keep only verified facts. -->

## Overview
Angular management web app; renders DSL through `lib/dsl-renderer-angular`. It hosts large features as independent modules, including the AI assistant (chat, database connections, DSL dashboards).

## Stack
- Angular 21 line (`@angular/core` 21.2.25, CLI/build 21.2.27, CDK 21.2.14; exact pins in `package.json`), TypeScript 5.9.3 strict, zoneless, standalone components, lazy-loaded feature modules, Angular CDK drag-drop. Not Angular 22: `@a2ui/angular` peers require `^21.2.5` (ADR-0001).
- DSL rendering: `lib/dsl-renderer-angular`, which wraps `@a2ui/angular/v0_9` (never the package root, which is protocol v1.0; ADR-0002).
- UI library: PrimeNG 21.1.10 with `@primeuix/themes` 2.0.3, Aura preset in `app.config.ts` (PrimeNG 22 needs Angular 22). See the `angular-conventions` skill.
- Tests: Vitest 4.0.18 with jsdom through `@angular/build:unit-test` (no Karma, no browser). Vitest 4.1.x crashes npm 10 during install (ADR-0001).
- Screen hierarchy, visual direction, and rendered-browser iteration: follow `portal-ui-design`; accessibility requirements and checks: follow `frontend-accessibility`.
- State management: use Angular signals for local synchronous UI state and RxJS for asynchronous streams by default; add a shared state library only if a verified project requirement justifies it.
- Backend/API: `services/core-backend` through the published `lib/api-client` package; base URL from the runtime `APP_CONFIG` (`apiBaseUrl`).

## Commands (run from this directory)
- Install: `npm ci`
- Dev server: `npm start`
- Unit tests: `npm test` (single run; also the pre-commit command in `.esi-test-cmd`)
- Lint: `npm run lint`; feature-boundary rule test: `npm run test:boundaries`
- Everything CI runs: `npm run check` (lint, boundary test, unit tests, build)
- Build: `npm run build`
- Docker: `docker build --target check .` (same as `npm run check`), `docker build -t esi-portal:<version> .` (nginx-unprivileged, port 8080, `HEALTHCHECK` on `/healthz`), `docker compose up` (portal on http://localhost:4200). Build context is this directory only.

## Structure
- `src/main.ts` - loads `/config.json`, then bootstraps `core/layout/Shell` with `createAppConfig(config)`
- `src/app/app.routes.ts` - shell routes; lazy-loads each `features/<name>/<name>.routes.ts`
- `src/app/core/` - `config/` (runtime config token and loader), `layout/` (app shell); app-wide services, interceptors and auth go here
- `src/app/shared/` - deliberately reusable UI and helpers (empty)
- `src/app/features/assistant/` - AI assistant module; only `assistant.routes.ts` is public
- `eslint/feature-boundaries.mjs` - local lint rule for the module rules below; `scripts/test-boundaries.mjs` proves it rejects forbidden imports
- `docker/` - nginx config and the start script that writes `/config.json`
- `src/app/` - `core/`, `shared/`, and isolated `features/<feature>/` folders. Each feature owns its routes, components, `apis/` (HTTP endpoint calls), services (data processing and business logic), types/models, constants, and tests as needed. Keep pure transformations in feature-local `helpers/` or `utils/` when useful.

## Module rules
- A large feature (for example the AI assistant, dashboards) is an independent module: it owns its routes, components, state, services and tests, and is lazy-loaded.
- Use dumb/presentational components for reusable UI: typed inputs and outputs, PrimeNG/project UI for rendering, no HTTP/API calls or business data processing. Feature/container components orchestrate interactions through feature services.
- All HTTP endpoint calls belong in the corresponding feature's `apis/` layer. Feature services use those APIs and own business rules, state coordination, and data transformations; components do not call endpoints directly.
- Modules must not depend on each other at the component level: no importing, selecting or templating another feature's components, directives or pipes, and no reaching into another module's files.
- A module may use `core` and `shared` and the project's published packages (`lib/*`, API client). Anything that two modules need goes to `shared` or `core`, not into one of the modules.
- If modules must interact, do it through navigation (routes and URL parameters) or a small public API exposed from `core` (service, injection token, typed event), never through component references.
- Each module exposes only its routes to the app shell; its internals stay private.
- Removing or disabling a module must not break the build of the others.
- Enforced by the `esi/feature-boundaries` lint rule: a feature must not import another feature; `core/` and `shared/` must not import features; the app root may import only `features/<name>/<name>.routes`.

## Project context
- Environments and API base URLs: runtime only. `public/config.json` is the dev default (`/api`); the container writes it at start from `ESI_PORTAL_API_BASE_URL` (`docker/40-esi-config.sh`). There are no build-time `environment.ts` files; add new settings to `AppConfig` and the start script.
- Auth integration: not chosen yet (ADR-0001, no identity provider); goes in `core/` when decided.
- Generated code: none yet; the API client comes from the published `lib/api-client` package, never generated or edited here.
