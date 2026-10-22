# @dtnam0899/dsl-schema

Source of truth for the ESI UI DSL (ADR-0002). No runtime dependencies.

- `src/a2ui/v0_9_1/`: the pinned A2UI v0.9.1 JSON Schemas (`catalog.json` basic catalog, `common_types.json`, `server_to_client.json`), copied verbatim; provenance in `PROVENANCE.md`.
- `src/esi/artifact.schema.json`: the stored artifact envelope (`dslSchemaVersion`, `protocolVersion`, `catalogId`, `columns`, `query`, `components`). With the basic catalog id its components are basic catalog components; with the ESI catalog id they are ESI catalog components and include at least one `EsiChart`.
- `src/esi/catalog.json`: the ESI catalog (ADR-0009): every basic component and function by `$ref`, unchanged, plus the `EsiChart` schema; `catalogId` `dtnam0899.github.io:esi-catalog-v0_9-1`.
- `src/lib/versions.ts`: the protocol/renderer pair (`A2UI_PINS`), `BASIC_CATALOG_ID` and `ESI_CATALOG_ID` (read from the catalog files), `CATALOG_IDS` and `DSL_SCHEMA_VERSIONS`. `src/lib/artifact.ts` also holds the chart constants (`ESI_CHART_COMPONENT`, `CHART_TYPES`, `MAX_CHART_SERIES` = 4, `MAX_PIE_SLICES` = 8).
- `@dtnam0899/dsl-schema/fixtures`: the shared fixture corpus (`src/fixtures/{valid,invalid,render}/*.json`), used by `dsl-core`, the renderer and `core-backend`. Invalid fixtures list the error codes they must produce; render fixtures may name a missing column or a chart fallback (`expectedChartFallback`).

Raw files are exported as `@dtnam0899/dsl-schema/schemas/<path under src>`, for example `schemas/a2ui/v0_9_1/catalog.json`.

Commands (from `lib/`): `npx nx build dsl-schema`, `npx nx test dsl-schema`.
