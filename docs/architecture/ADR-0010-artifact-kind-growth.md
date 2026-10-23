---
id: ADR-0010
type: adr
status: Proposed
date: 2026-10-23
projects: [contracts, core, portal]
issues: [ESI-119]
keywords: [artifact, artifact kind, chart, enum, x-extensible-enum, oasdiff, breaking change, contract version, dashboard, save chart, phase 7]
---

# ADR-0010 Artifact `kind` grows through `x-extensible-enum` in responses (charts can be saved)

## Context
- core-api 0.3.0 has `kind: string, enum: [table, kpi]` in two places: `ArtifactSummary` (responses: artifact list, get and create, and every dashboard response through `DashboardItem.artifact`) and `CreateArtifactRequest`. So a chart preview (ESI-12) cannot be saved or put on a dashboard: core answers 400 for `kind: chart`. ADR-0009's consequence "saved artifacts and dashboards need no change" missed this enum (ESI-119).
- Contract rules: additive = minor; removal, rename or tightening = major plus an ADR (`esi-project-standards`, `services/contracts/CLAUDE.md`). `release-contracts` runs `oasdiff breaking --fail-on ERR` (oasdiff v1.33.0) against the latest published version.
- Measured with oasdiff v1.33.0 against the 0.3.0 specs on 2026-10-23:
  - Adding `chart` to both `enum`s: 1 error (`response-property-enum-value-added` on `GET /connections/{connectionId}/artifacts`) and 7 warnings (every other artifact and dashboard response). oasdiff's message suggests `x-extensible-enum` "if the value set is meant to grow".
  - Replacing both `enum`s with `x-extensible-enum: [table, kpi, chart]`: 2 errors (`request-property-enum-value-removed` for `table` and `kpi` on `POST /connections/{connectionId}/artifacts`).
  - Responses with `x-extensible-enum: [table, kpi, chart]` and the request with `enum: [table, kpi, chart]`: no breaking change. Adding a fourth value to both afterwards: no breaking change.
- Generators on that last variant: `@hey-api/openapi-ts` 0.99.0 (portal) types the response `kind` as `string` and the request `kind` as `'table' | 'kpi' | 'chart'`. core generates its DTOs with NSwag 14.7.1; today it maps them with two-way ternaries (`ArtifactEndpoints`: a request kind that is not `Kpi` becomes `"table"`, a domain kind that is not `Kpi` becomes `Table`), so a regenerated `Chart` would be saved and returned as a table without a code change. ESI-114 fixed the same pattern for `VisualizationIntent`.
- Consumers of core-api responses: only `web/esi-portal` (the agents never call core). core stores `Artifact.Kind` as a string column (`HasConversion<string>()`, `varchar(20)`), so a new value needs no database migration. The portal uses the response `kind` for a label (`'kpi' ? 'KPI' : 'Table'` in the artifact list and page) and for the default dashboard size (`nextLayout`, `table | kpi`); rendering depends only on the DSL (`catalogId`, `dslSchemaVersion`).
- A saved chart carries `catalogId` `dtnam0899.github.io:esi-catalog-v0_9-1` and `dslSchemaVersion` `0.2.0` (ADR-0009). A portal on `@dtnam0899/dsl-*` 0.1.0 shows such a document as "migration required" (unknown package version) and never renders it.

## Options
1. **Add `chart` to both `enum`s, major version 1.0.0.** Pros: the type stays a closed union everywhere; honest about the old promise. Cons: `release-contracts` fails on the error, so the check needs an exception for this release; 1.0.0 signals a stability the contract does not have yet; every future kind (forms) is another major.
2. **Add `chart` to both `enum`s as minor 0.4.0, accepting the error ("0.x may break").** Pros: smallest diff. Cons: breaks our own rule (breaking = major) and needs the same check exception; nothing changes for the next kind.
3. **`x-extensible-enum` in responses, `enum` plus `chart` in the request, minor 0.4.0.** Pros: passes the existing breaking-change check now and for later kinds; states in the contract that clients must accept unknown kinds; the request stays strictly validated. Cons: the response type becomes `string` in generated TypeScript, so the portal owns its handling of unknown kinds; switching the response from `enum` is a real (if harmless here) widening that oasdiff does not report, so it must be called out in the changelog.
4. **Derive the kind from the DSL and stop sending it** (drop it from the request, keep or drop it in responses). Pros: one source of truth (`catalogId` and the root component). Cons: removing a response field is breaking; core must parse the DSL to fill summaries; the list endpoint would need the DSL or a stored derived value anyway, so it only moves the enum.

## Decision
Take option 3, released as `@dtnam0899/esi-contracts` 0.4.0. Response kinds that may grow are open sets; the request stays a closed set of what core accepts today.

- `ArtifactSummary.kind`: `type: string` with `x-extensible-enum: [table, kpi, chart]` and a description that clients must handle values they do not know (show a generic label, render from the DSL). `CreateArtifactRequest.kind`: `enum: [table, kpi, chart]`.
- Rule for the contract from now on: a response property whose value set is expected to grow is declared with `x-extensible-enum` when it is introduced; closed sets (for example `ArtifactStatus`) keep `enum`. Adding a value to a request `enum` is additive.
- The 0.4.0 changelog says explicitly that `ArtifactSummary.kind` changed from a closed `enum` to `x-extensible-enum`, that oasdiff does not report it, and what an old client sees (below).
- `chart` means "the document's root component is an `EsiChart`" (ESI catalog id). core rejects a create request whose `kind` does not match its DSL: `chart` needs the ESI catalog id, `table` and `kpi` need the basic catalog id (`400`, field error on `kind`).
- core: `ArtifactKind.Chart`; every mapping between generated and domain kinds is an explicit switch that throws on an unknown value (no two-way ternaries), as ESI-114 did for intents. Dashboards need no other change: items reference artifacts.
- portal: send `kind: chart` when saving a chart preview; labels and the default dashboard size come from one helper that knows `table`, `kpi` and `chart` and falls back to a generic label and the table size for any other value; rendering stays driven by the DSL.
- Release order: contracts 0.4.0 -> core (pins 0.4.0, accepts and returns `chart`) -> portal (pins 0.4.0, saves charts). core must be deployed before the portal offers saving.

## Consequences
- Charts can be saved, listed, opened and put on dashboards without a major contract version or an exception in the breaking-change check, and the next kind (forms, if they come) is a minor change.
- Old clients: a portal generated from 0.3.0 that receives `kind: chart` shows the label "Table" for it (its ternary), sizes a new dashboard item as a table, and renders it if it has `@dtnam0899/dsl-*` 0.2.0 (portal since ESI-12), or shows "migration required" with 0.1.0. Nothing crashes and no wrong data is shown. The only such client is the portal in this repository, updated in the same phase.
- The generated TypeScript type for the response `kind` is `string`; the portal keeps its own union and fallback instead of relying on exhaustiveness checks from the generator.
- core gains a DSL/kind consistency check on create, so a stored kind always matches what the document renders.
- ADR-0009 stays as written; this ADR records what it missed.

## Verification
- contracts: `scripts/check-breaking.sh` against 0.3.0 passes; Spectral lint passes with the `x-extensible-enum` extension; the changelog entry describes the widening.
- core: unit tests for the kind mappings (including an unknown value), the DSL/kind consistency check, and an integration test that saves a chart, lists it, gets it, adds it to a dashboard and reads the dashboard back.
- portal: unit tests for saving a chart preview, the kind label and default size helper (including an unknown kind), and a chart on a dashboard; a browser check against the local stack.

## Open questions
- Product owner: confirm the default dashboard size for a chart (proposal: the table size, 6 x 5 grid cells).
