# web/esi-portal (Angular)

<!-- Supplements the repository root CLAUDE.md for this project. Keep only verified facts. -->

## Overview
Angular management web app; renders DSL through `lib/dsl-renderer-angular`. It hosts large features as independent modules, including the AI assistant (chat, database connections, DSL dashboards).

## Stack
- Angular <version>, TypeScript, <state management / UI library>
- Backend/API it talks to: <project or URL config location>

## Commands (run from this directory)
- Install: `npm ci`
- Dev server: `npm start`
- Unit tests: `npm test -- --watch=false --browsers=ChromeHeadless`
- Lint: `npm run lint`
- Build: `npm run build`
- Docker: `docker compose up` (local dependencies) and `docker build -t <project>:<version> .`; see the `esi-project-standards` skill. This project must not depend on other projects' sources.

## Structure
- `src/app/` - <feature modules, shared, core layout>. The exact folder layout is not decided yet; add it here when it is. Until then keep each feature module in its own folder and follow the module rules below.

## Module rules
- A large feature (for example the AI assistant, dashboards) is an independent module: it owns its routes, components, state, services and tests, and is lazy-loaded.
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
