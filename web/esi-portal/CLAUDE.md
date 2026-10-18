# web/esi-portal (Angular)

<!-- Supplements the repository root CLAUDE.md for this project. Keep only verified facts. -->

## Overview
Angular management web app; renders DSL through `lib/dsl-renderer-angular`. It hosts large features as independent modules, including the AI assistant (chat, database connections, DSL dashboards).

## Stack
- Angular 21 line (21.2.x; exact patch pinned at scaffold), TypeScript strict, standalone components, lazy-loaded feature modules, Angular CDK drag-drop. Not Angular 22: `@a2ui/angular` peers require `^21.2.5` (ADR-0001).
- DSL rendering: `lib/dsl-renderer-angular`, which wraps `@a2ui/angular/v0_9` (never the package root, which is protocol v1.0; ADR-0002).
- UI library: PrimeNG (use the pinned version and project theme/design tokens; see the `angular-conventions` skill).
- State management: use Angular signals for local synchronous UI state and RxJS for asynchronous streams by default; add a shared state library only if a verified project requirement justifies it.
- Backend/API: `services/core-backend` through the published `lib/api-client` package; the base URL config location is set in the scaffold task.

## Commands (run from this directory)
- Install: `npm ci`
- Dev server: `npm start`
- Unit tests: `npm test -- --watch=false --browsers=ChromeHeadless`
- Lint: `npm run lint`
- Build: `npm run build`
- Docker: `docker compose up` (local dependencies) and `docker build -t <project>:<version> .`; see the `esi-project-standards` skill. This project must not depend on other projects' sources.

## Structure
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
- Enforce the boundaries with lint rules (for example restricted imports between feature folders) once the folder layout is decided.

## Project context
- Environments and API base URLs: <file reference>
- Auth integration (Identity Server): <file reference>
- <Generated code or files not to edit by hand>
