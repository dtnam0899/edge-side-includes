# Changelog

All notable changes are generated from Conventional Commits by the release flow. Do not edit released sections by hand.

## Unreleased

- Assistant (ESI-19): consent terms with explicit acceptance (draft badge, re-accept when outdated), connection list/add/edit/delete/test with a masked write-only connection string and the read-only login recommendation, per-connection consent withdraw/grant that hides chats and scripts at once, chat sessions with in-progress/success/failure states, generated SQL as copyable text labelled "Not run" until an explicit Run succeeds, paged results (20 rows, remaining count, NULL and truncated cells marked, failures never shown as empty results), saved stored-procedure scripts with delete.
- core-api client generated from `@dtnam0899/esi-contracts` 0.1.0 into `src/app/core/api/generated` (`npm run generate:api`) until `lib/api-client` is published; contract-based mocks in `src/testing/mocks/`; dev-server proxy `/api` -> `http://localhost:8080`.
- Scaffold: Angular 21.2 app shell (`core/`, `shared/`, `features/`), lazy-loaded `assistant` module exposing only its routes, runtime `/config.json` loaded before bootstrap, PrimeNG 21 with the Aura preset, ESLint with a local `esi/feature-boundaries` rule and a test proving it, Vitest unit tests, multi-stage Dockerfile serving the build from nginx-unprivileged, compose file.
