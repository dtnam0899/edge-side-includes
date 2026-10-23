# Changelog

All notable changes are generated from Conventional Commits by the release flow. Do not edit released sections by hand.

## 0.4.0

- core-api: artifacts can be charts (ADR-0010, ESI-119). `CreateArtifactRequest.kind` adds `chart` (additive); core rejects a `kind` that does not match the DSL's catalog with 400 (`chart` = ESI catalog, `table`/`kpi` = basic catalog).
- core-api: `ArtifactSummary.kind` (artifact list, get, create and every dashboard item's `artifact`) changes from the closed `enum: [table, kpi]` to the open set `x-extensible-enum: [table, kpi, chart]`. **Widening that oasdiff does not report:** a client generated from 0.3.0 may now receive `chart` and must not assume only `table` or `kpi`. Clients must handle unknown values (generic label; render from `dsl`). Generated TypeScript (`@hey-api/openapi-ts`) types the response field as `string`.

## 0.3.0

- Shared: `VisualizationIntent.kind` adds `chart` (additive). The agent picks bar, line or pie from the columns and the wording (ADR-0009); forms are still refused with `visualization-not-supported`.
- Shared: `DslDocument.catalogId` documents both catalog ids: the basic catalog for tables and KPIs, and the ESI catalog `dtnam0899.github.io:esi-catalog-v0_9-1` (basic catalog plus `EsiChart`) for documents with a chart. The allowed values come from `@dtnam0899/dsl-schema` 0.2.0; the field stays a free string.
- agents-api: `generateDsl` generates charts; `DslGenerationRequest.catalogId` is the ESI catalog id for `chart`. core-api: `visualization-not-supported` now covers forms only.

## 0.2.0

- core-api: global `bearerAuth` security scheme (HTTP bearer, JWT; ADR-0006, status Proposed). Every operation documents 401 `unauthenticated` (shared `UnauthenticatedResponse`, RFC 9457 `Problem`). Health endpoints are not in the contract, so no operation opts out of security.
- core-api: `sendChatMessage` and `createVisualization` document 503 `agents-unavailable` (shared `AgentsUnavailableResponse`), which core already returns; the problem type is listed in `info.description`.

## 0.1.0

- core-api: consent terms and acceptance, per-connection consent (grant, withdraw), connections (create, list, get, update, delete, test; connection strings write-only), schema metadata, chat sessions with synchronous SQL generation, visualizations (validated DSL from column definitions), paged SELECT execution (20 rows, remaining count, truncated cells), stored-procedure scripts, saved artifacts (with execution), dashboards with items and layout. No security scheme yet (local admin assumed).
- agents-api: `generateSql` and `generateDsl` (column definitions only, retry with previous validation issues, `unsupported` for charts and forms).
- Shared: `ColumnDefinition`, `SchemaMetadata`, `SqlOutputKind`, `VisualizationIntent`, `DslDocument`, `ValidationIssue`; `Problem` gains `issues`; `PageInfo` is now page number, size and remaining rows. Documented problem types `urn:esi:problem:*`.
- Package: adds single-file bundles `bundled/core-api.yaml` and `bundled/agents-api.yaml` (built at pack time with Redocly CLI) for generators that cannot follow cross-file `$ref`s.

## 0.0.0

- Scaffold: empty `core-api` and `agents-api` OpenAPI 3.0.3 specs at `0.0.0`, shared RFC 9457 `Problem`, `FieldError`, `PageInfo` schemas and `ProblemResponse`, Spectral lint, version check, breaking-change check.
