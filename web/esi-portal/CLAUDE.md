# web/esi-portal (Angular)

<!-- Supplements the repository root CLAUDE.md for this project. Keep only verified facts. -->

## Overview
Angular management web app; renders DSL through `lib/dsl-renderer-angular`. It hosts large features as independent modules, including the AI assistant (chat, database connections, DSL dashboards).

## Stack
- Angular 21 line (`@angular/core` 21.2.25, CLI/build 21.2.27, CDK 21.2.14; exact pins in `package.json`), TypeScript 5.9.3 strict, zoneless, standalone components, lazy-loaded feature modules, Angular CDK drag-drop. Not Angular 22: `@a2ui/angular` peers require `^21.2.5` (ADR-0001).
- DSL rendering: `@dtnam0899/dsl-renderer-angular` 0.2.2 (`<esi-dsl-surface [artifact] [data]>`, wraps `@a2ui/angular/v0_9`; ADR-0002) with `@dtnam0899/dsl-core` and `@dtnam0899/dsl-schema` 0.2.0, exact pins. Renderer 0.2.1 was published with uninstallable `0.0.0` dependencies and removed (ESI-136); never pin it. core-api returns a `DslDocument` whose `dslSchemaVersion` is the dsl-schema package version; `features/assistant/helpers/dsl-adapter.ts` maps it, the SELECT and the SQL Server column types to the renderer's artifact format (`dslSchemaVersion` 1) and `QueryResult` pages to `/rows` + `/page`. Package versions 0.1.0 and 0.2.0 both map to format 1; unknown versions are shown as "migration required", never rendered. The lib packages (and `@dtnam0899/ui-tokens`, pulled in by the renderer) are CommonJS, listed in `allowedCommonJsDependencies`.
- Charts (ADR-0009, ESI-12): the visualization panel sends `intent.kind` `chart`; the renderer draws `EsiChart` with its own caption and "View as table" toggle, and loads Chart.js lazily (never import Chart.js in the portal). `DslView` leaves out its paging caption for ESI-catalog documents and styles the toggle. Charts are saved as artifacts with `kind: chart` (core-api 0.4.0, ADR-0010, ESI-119). The artifact `kind` in responses is an open set (generated as `string`): show it only through `helpers/artifact-kind.ts` (`artifactKindLabel`, generic "Visualization" for unknown kinds) and never branch rendering on it. On dashboards a chart tile sets `--esi-chart-height` from its grid height (`DashboardPage.chartHeight`) so the caption and toggle stay visible; `nextLayout` gives charts and unknown kinds the table size (6 x 5). Tests replace Chart.js with the `ESI_CHART_LOADER` token (jsdom has no canvas).
- UI library: PrimeNG 21.1.10 with `@primeuix/themes` 2.0.3, Aura preset in `app.config.ts` (PrimeNG 22 needs Angular 22). See the `angular-conventions` skill.
- Tests: Vitest 4.0.18 with jsdom through `@angular/build:unit-test` (no Karma, no browser). Vitest 4.1.x crashes npm 10 during install (ADR-0001).
- Screen hierarchy, visual direction, and rendered-browser iteration: follow `portal-ui-design`; accessibility requirements and checks: follow `frontend-accessibility`.
- State management: use Angular signals for local synchronous UI state and RxJS for asynchronous streams by default; add a shared state library only if a verified project requirement justifies it.
- Backend/API: `services/core-backend` through the core-api client in `src/app/core/api` (generated here from the pinned contract until `lib/api-client` is published, ESI-19); base URL from the runtime `APP_CONFIG` (`apiBaseUrl`).

## Commands (run from this directory)
- Install: `npm ci`
- Dev server: `npm start` (proxies `/api` to core-backend on `http://localhost:8080`, `proxy.conf.json`)
- Unit tests: `npm test` (single run; also the pre-commit command in `.esi-test-cmd`)
- Lint: `npm run lint`; feature-boundary rule test: `npm run test:boundaries`
- Everything CI runs: `npm run check` (lint, boundary test, unit tests, build)
- Build: `npm run build`
- Regenerate the core-api client: `npm run generate:api` (needs `NODE_AUTH_TOKEN`; see Project context)
- Docker (needs `NODE_AUTH_TOKEN` for `@dtnam0899/*`, passed as a BuildKit secret): `docker build --secret id=npm_token,env=NODE_AUTH_TOKEN --target check .` (same as `npm run check`), `docker build --secret id=npm_token,env=NODE_AUTH_TOKEN -t esi-portal:<version> .` (nginx-unprivileged, port 8080, `HEALTHCHECK` on `/healthz`), `docker compose up --build` (secret from `NODE_AUTH_TOKEN`; portal on http://localhost:4200). Build context is this directory only.

## Structure
- `src/main.ts` - loads `/config.json`, then bootstraps `core/layout/Shell` with `createAppConfig(config)`
- `src/app/app.routes.ts` - shell routes; lazy-loads each `features/<name>/<name>.routes.ts`
- `src/app/core/` - `config/` (runtime config token and loader), `layout/` (app shell with the signed-in user and sign-out), `auth/` (sign-in, see Project context), `api/` (core-api client: `generated/`, the `CoreApi` sender and `toApiProblem`); app-wide services and interceptors go here
- `src/app/shared/` - deliberately reusable UI and helpers (empty)
- `src/app/features/assistant/` - AI assistant module; only `assistant.routes.ts` is public. Inside: `apis/` (HTTP boundary per resource), `services/` (state and rules; route-level `ConsentService`, `ConnectionsService`, `ConnectionEditorService`; component-level `ChatService`, `ScriptsService`, `SchemaService`), `helpers/` (pure mapping), `components/` (presentational), `containers/` (chat, scripts, saved-visualization, dashboard-list and schema panels), `pages/` (routed: workspace with `?tab=` chat|dashboards|artifacts|scripts|schema, artifact page, dashboard page). Dashboards use `components/dashboard-grid` (Angular CDK drag, pointer resize, arrow / Shift+arrow keys on a 12-column grid; private to the module); `DashboardService` runs each item separately and saves the layout (every item once) after each change. The schema tab draws an ERD with `components/erd-diagram` (SVG) laid out by the pure `helpers/erd-layout.ts`; no diagram library
- `src/testing/` - test helpers (`provideCoreApiTesting`, `auth-testing`) and `mocks/` (contract-based HTTP mocks)
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
- Test data (P0-14, `docs/process/test-data.md`): mocked HTTP responses live in `src/testing/mocks/core-api.mocks.ts`, built from the field `example`s of the pinned contract version and typed with the generated client (it records `CORE_API_CONTRACT_VERSION`); never read other projects' files.
- Installing `@dtnam0899/*` packages needs `NODE_AUTH_TOKEN` (CI: `GITHUB_TOKEN` with `packages: read`, passed to `docker build` as the `npm_token` BuildKit secret in `.github/workflows/portal.yml`; locally: `docs/process/github-setup.md`); the project `.npmrc` only references it. Packages are added at an exact version (`npm install --save-exact`); the `prerelease` workflow proved this install path with a throwaway `--no-save` install.
- Demo deployment (ESI-72, ADR-0005): the `portal` workflow deploys the static files of the Docker `check` stage to Vercel (`infra/vercel/`, `vercel deploy --prebuilt`; `develop` → production, same-repo PRs → preview). Vercel does not build this project, so there is no `vercel.json` here; routing (`/api/*` to core, SPA fallback, cache headers) lives in `infra/vercel/build-output.sh` and must stay in step with `docker/nginx.conf`.
- Environments and API base URLs: runtime only. `public/config.json` is the dev default (`/api`, no `auth`); the container writes it at start from `ESI_PORTAL_API_BASE_URL` and the optional `ESI_PORTAL_AUTH_DOMAIN`, `ESI_PORTAL_AUTH_CLIENT_ID`, `ESI_PORTAL_AUTH_AUDIENCE` (all or none; `docker/40-esi-config.sh`), and on Vercel `infra/vercel/build-output.sh` writes it. There are no build-time `environment.ts` files; add new settings to `AppConfig` and the start script.
- Auth (ESI-87, ADR-0006 Proposed): Auth0 through `@auth0/auth0-angular` 2.13.0 in `src/app/core/auth/` (`provideAuth`, `authInterceptors`, `authGuard`, `AuthSession`, the open `/signed-out` page). `AppConfig.auth` (`domain`, `clientId`, `audience`) is optional: absent means sign-in off (`LocalAuthSession`: no guard, no token), for `npm start` against a core in `LocalAdmin` mode; present means every feature route is guarded and the SDK interceptor adds the token only to `apiBaseUrl/*` requests. Tokens stay in memory with rotating refresh tokens, so a reload goes through Auth0 again. Features never import `core/auth` or `@auth0/*` (`esi/feature-boundaries`). Tests use `src/testing/auth-testing.ts` (`FakeAuthSession`, `fakeAuth0Client`). Tenant setup: `infra/auth0/README.md`. The SDK (~220 kB) is in the initial bundle, so the initial budget warning is 900 kB.
- Generated code: `src/app/core/api/generated/` (never edit; lint-ignored). `npm run generate:api` (`scripts/generate-api.mjs`, `@hey-api/openapi-ts` 0.99.0, `openapi-ts.config.mjs`) fetches `@dtnam0899/esi-contracts` at the version in `package.json` `esi.coreApiContract` (0.4.0) and writes `contract-version.gen.ts`. The contract is not a dependency, so `npm ci` and the Docker build need no token. Stand-in until `lib/api-client` is published (ADR-0001); then replace `generated/` with that package.
