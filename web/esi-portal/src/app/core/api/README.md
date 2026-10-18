# core/api

Typed client for `services/core-backend` (core-api).

- `generated/` is produced by `npm run generate:api` (`scripts/generate-api.mjs`, `@hey-api/openapi-ts` 0.99.0 with
  `openapi-ts.config.mjs`) from the pinned contract package `@dtnam0899/esi-contracts`, version
  `esi.coreApiContract` in `package.json` (now **0.1.0**, also in `generated/contract-version.gen.ts`). Never edit
  it by hand. To move to a new contract version: change the pin, run the script (needs `NODE_AUTH_TOKEN`), and
  update `src/testing/mocks/` in the same PR.
- The contract package is fetched only by the script, so `npm ci`, the build and the Docker image need no registry
  token.
- `core-api.ts` sends the generated `HttpRequest`s through Angular `HttpClient` with the runtime `apiBaseUrl`.
- `api-problem.ts` turns error responses (`application/problem+json`, `urn:esi:problem:<name>`) into `ApiProblem`.

This is a stand-in: the client belongs in `lib/api-client` (ADR-0001). When that package is published, replace
`generated/` with it and keep `core-api.ts` / `api-problem.ts` as the portal's adapter.
