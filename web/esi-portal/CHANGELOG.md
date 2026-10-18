# Changelog

All notable changes are generated from Conventional Commits by the release flow. Do not edit released sections by hand.

## Unreleased

- Assistant (ESI-20): DSL rendering with `@dtnam0899/dsl-renderer-angular` 0.1.0 and live rows (invalid DSL, a missing bound column and failed executions are error states, never empty data); table/KPI visualization requests after a query ran (refusals and validation failures explained) with preview and save as artifact; saved visualizations list, live page view with paging, delete, and `connection-unavailable` / `migration-required` / `artifact-unavailable` states; dashboards list, create, rename, delete, add and remove items, each item in its own surface inside a drag-and-resize wrapper (Angular CDK, keyboard operable) that loads on its own, with the layout saved after each change and restored on reopen.
- Docker builds take the GitHub Packages token as the BuildKit secret `npm_token`.
- Assistant (ESI-19): consent terms with explicit acceptance (draft badge, re-accept when outdated), connection list/add/edit/delete/test with a masked write-only connection string and the read-only login recommendation, per-connection consent withdraw/grant that hides chats and scripts at once, chat sessions with in-progress/success/failure states, generated SQL as copyable text labelled "Not run" until an explicit Run succeeds, paged results (20 rows, remaining count, NULL and truncated cells marked, failures never shown as empty results), saved stored-procedure scripts with delete.
- core-api client generated from `@dtnam0899/esi-contracts` 0.1.0 into `src/app/core/api/generated` (`npm run generate:api`) until `lib/api-client` is published; contract-based mocks in `src/testing/mocks/`; dev-server proxy `/api` -> `http://localhost:8080`.
- Scaffold: Angular 21.2 app shell (`core/`, `shared/`, `features/`), lazy-loaded `assistant` module exposing only its routes, runtime `/config.json` loaded before bootstrap, PrimeNG 21 with the Aura preset, ESLint with a local `esi/feature-boundaries` rule and a test proving it, Vitest unit tests, multi-stage Dockerfile serving the build from nginx-unprivileged, compose file.
