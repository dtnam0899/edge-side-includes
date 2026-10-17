# web/esi-assistant (React)

<!-- Supplements the repository root CLAUDE.md for this project. Keep only verified facts. -->

## Overview
React AI chat assistant; streams agent responses and renders DSL through `lib/dsl-renderer-react`.

## Stack
- React <version>, TypeScript/JavaScript, <bundler: Vite/CRA/Next>, <state and routing libraries>
- Backend/API it talks to: <project or URL config location>

## Commands (run from this directory)
- Install: `npm ci`
- Dev server: `npm run dev`
- Tests: `CI=true npm test`
- Lint: `npm run lint`
- Build: `npm run build`
- Docker: `docker compose up` (local dependencies) and `docker build -t <project>:<version> .`; see the `esi-project-standards` skill. This project must not depend on other projects' sources.

## Structure
- `src/` - <components, hooks, pages, services>

## Project context
- Environment variables and API base URLs: <file reference>
- Auth integration (Identity Server): <file reference>
- <Generated code or files not to edit by hand>
