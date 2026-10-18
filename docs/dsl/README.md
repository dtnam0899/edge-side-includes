---
id: dsl-readme
type: reference
status: Accepted
updated: 2026-10-18
projects: [lib, agents, core, portal]
keywords: [dsl, a2ui, basic catalog, table, kpi, list, card, text, formatNumber, catalogId, artifact, updateComponents]
---

# UI DSL

The ESI DSL is **A2UI protocol v0.9 with its basic catalog**, stored as documents. Decision and rationale: [ADR-0002](../architecture/ADR-0002-a2ui-dsl-adoption-and-storage.md). The source of truth for schemas is `lib/dsl-schema`; this page is the human-readable guide. Detailed schemas and fixtures are added here when `lib` publishes them (tasks ESI-14 and ESI-17).

## Pinned versions

| Item | Value |
|------|-------|
| Protocol | A2UI v0.9 |
| Renderer | `@a2ui/angular` 0.13.0, import only from `@a2ui/angular/v0_9` (the package root is protocol v1.0) |
| Core dependency | `@a2ui/web_core` 0.14.0 |
| Basic catalog id | `https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json`, taken verbatim from the pinned catalog file and covered by a test |

Pins are exact. Changing any of them is a breaking DSL change (new `dslSchemaVersion`, migration, ADR).

## Stored artifact

An artifact contains the `updateComponents` payload (component list with `root`), `catalogId`, protocol version, `dslSchemaVersion`, the column definitions it expects, and the bound SELECT. It has no row values and no layout; layout is stored with the dashboard in core.

At render time the renderer sends `createSurface` (stored `catalogId`), `updateComponents` (stored payload) and `updateDataModel` (rows at `/rows`, paging at `/page`), one surface per dashboard item.

## Component selection

The basic catalog has 18 components and no Table, Chart or dashboard-layout component.

| Need | Build it with |
|------|---------------|
| Table | `Column` containing a header `Row` and a `List` whose template `Row` iterates the bound rows with relative column paths; one `Text` per column |
| KPI | `Card` containing `Text` bound to the value, with `formatNumber` or `formatCurrency`; a second `Text` for the label |
| Layout inside one widget | `Row`, `Column`, `Divider` |
| Chart | not available in phase 1; phase 7 adds a custom `EsiChart` in a custom catalog with its own `catalogId` |
| Form / input | out of scope; agents refuse |

Bound paths must refer to columns present in the artifact's column definitions; a missing column shows an error state.

## Validation order

1. A2UI JSON Schema for the pinned version.
2. ESI rules: unique component ids, `root` exists, only components and functions from the pinned catalog, bound paths exist in the column definitions, no HTML or script content, no row data.

`lib/dsl-core` (TypeScript) and `core-backend` (.NET) implement the same rules and must pass the same fixtures. AI output is untrusted, so validation also happens where the artifact is saved.

## Related

- Skills: `dsl-authoring`, `dsl-renderer-parity`.
- Requirements: [UR-1](../requirements/UR-1-bi-ai-assistant-web-application.md) (SR-5, SR-6, SR-8).
