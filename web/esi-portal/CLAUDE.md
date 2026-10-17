# web/esi-portal (Angular)

<!-- Supplements the repository root CLAUDE.md for this project. Keep only verified facts. -->

## Overview
Angular management web app; renders DSL through `lib/dsl-renderer-angular`.

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
- `src/app/` - <feature modules, shared, core layout>

## Project context
- Environments and API base URLs: <file reference>
- Auth integration (Identity Server): <file reference>
- <Generated code or files not to edit by hand>
