# @dtnam0899/dsl-core

Framework-independent validation and rendering preparation for ESI DSL artifacts.

- `validateArtifact(input)`: validates untrusted input with the A2UI v0.9.1 JSON Schema (through the ESI envelope schema) and then the ESI rules; returns every error with a code, a JSON Pointer and the component id. Artifacts on the ESI catalog also get the chart rules of ADR-0009 (`chart-column-type`, `chart-series`; `unknown-column` and `unknown-path` for chart keys and `data`). Codes are listed in `src/lib/errors.ts` and `docs/dsl/README.md`.
- `planSurface(input, data, surfaceId)`: validation plus a check of the bound columns against the live result, then the A2UI messages `createSurface`, `updateComponents`, `updateDataModel` (rows at `/rows`, paging at `/page`).
- `validateServerMessage(message, catalogId?)`: checks a message against the pinned `server_to_client.json`, with the components of the given catalog (basic by default).

Validation uses Ajv, which compiles schemas with `new Function`; a page with a Content Security Policy needs `'unsafe-eval'` until validators are precompiled.

Commands (from `lib/`): `npx nx build dsl-core`, `npx nx test dsl-core`.
