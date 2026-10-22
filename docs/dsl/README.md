---
id: dsl-readme
type: reference
status: Accepted
updated: 2026-10-23
projects: [lib, agents, core, portal]
keywords: [dsl, a2ui, basic catalog, esi catalog, esichart, chart, chart.js, table, kpi, list, card, text, formatNumber, catalogId, artifact, updateComponents]
---

# UI DSL

The ESI DSL is **A2UI protocol v0.9 with its basic catalog**, stored as documents. Decision and rationale: [ADR-0002](../architecture/ADR-0002-a2ui-dsl-adoption-and-storage.md). The source of truth for schemas is `lib/dsl-schema` (pinned A2UI files, the artifact envelope schema `src/esi/artifact.schema.json` and the shared fixtures in `src/fixtures/`); this page is the human-readable guide.

## Pinned versions

| Item | Value |
|------|-------|
| Protocol | A2UI v0.9 |
| Renderer | `@a2ui/angular` 0.13.0, import only from `@a2ui/angular/v0_9` (the package root is protocol v1.0) |
| Core dependency | `@a2ui/web_core` 0.14.0 |
| Spec files | A2UI `specification/v0_9_1` (basic catalog, common types, server-to-client), vendored in `lib/dsl-schema/src/a2ui/v0_9_1/`; messages use `"version": "v0.9"`, the only value the renderer accepts |
| Basic catalog id | `https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json`, taken verbatim from the pinned catalog file and covered by a test |
| ESI catalog id | `dtnam0899.github.io:esi-catalog-v0_9-1` (ADR-0009): the basic catalog unchanged plus `EsiChart`, in `lib/dsl-schema/src/esi/catalog.json`; used only by artifacts with a chart |
| Chart library | Chart.js 4.5.1, loaded by the renderer on the first chart only |
| `dslSchemaVersion` | `1` = A2UI v0.9.1 with `@a2ui/angular` 0.13.0 (`DSL_SCHEMA_VERSIONS` in `lib/dsl-schema`) |

Pins are exact. Changing any of them is a breaking DSL change (new `dslSchemaVersion`, migration, ADR).

## Stored artifact

An artifact contains the `updateComponents` payload (component list with `root`), `catalogId`, protocol version, `dslSchemaVersion`, the column definitions it expects, and the bound SELECT. It has no row values and no layout; layout is stored with the dashboard in core.

```json
{
  "dslSchemaVersion": 1,
  "protocolVersion": "v0.9",
  "catalogId": "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json",
  "columns": [{ "name": "total_revenue", "type": "number" }],
  "query": { "sql": "SELECT SUM(amount) AS total_revenue FROM sales" },
  "components": [
    { "id": "root", "component": "Card", "child": "kpi-column" },
    { "id": "kpi-column", "component": "Column", "children": ["kpi-label", "kpi-value"] },
    { "id": "kpi-label", "component": "Text", "text": "Total revenue", "variant": "caption" },
    { "id": "kpi-value", "component": "Text", "variant": "h2",
      "text": { "call": "formatNumber", "args": { "value": { "path": "/rows/0/total_revenue" } }, "returnType": "string" } }
  ]
}
```

Column types are `string`, `number`, `boolean`, `date`, `datetime`; a column name cannot contain `/` or `~`. Full examples: `lib/dsl-schema/src/fixtures/valid/` (table, KPI).

At render time the renderer sends `createSurface` (stored `catalogId`), `updateComponents` (stored payload) and one `updateDataModel` at `/` with `{ "rows": [...], "page": { "page", "pageSize", "totalRows", "remaining" } }`, one surface per dashboard item. Rows keep only the artifact's columns, and a cell that is not a string, number, boolean or null is turned into text.

## Data binding

| Path | Meaning |
|------|---------|
| `<column>` (relative) | The column of the current row; only inside a `List` template that iterates `/rows` |
| `/rows/<index>/<column>` | The column of one row, for example `/rows/0/total` for a KPI |
| `/page/<field>` | `page` (1-based), `pageSize`, `totalRows` or `remaining` |
| `/rows` | Only as the `path` of a `List` template; templates cannot be nested |

Any other path is rejected. `formatString` interpolations (`${/page/remaining}`) follow the same rules; an interpolation that is not a plain path (for example a nested function call) is rejected.

## Component selection

The basic catalog has 18 components and no Table, Chart or dashboard-layout component.

| Need | Build it with |
|------|---------------|
| Table | `Column` containing a header `Row` and a `List` whose template `Row` iterates the bound rows with relative column paths; one `Text` per column |
| KPI | `Card` containing `Text` bound to the value, with `formatNumber` or `formatCurrency`; a second `Text` for the label |
| Layout inside one widget | `Row`, `Column`, `Divider` |
| Chart | `EsiChart` on the ESI catalog id (ADR-0009, see [Charts](#charts)); lib support from ESI-10 (to be released as `@dtnam0899/dsl-*` 0.2.0); agents, core and portal follow (ESI-11, ESI-113, ESI-114, ESI-12) |
| Form / input | out of scope; agents refuse |

Bound paths must refer to columns present in the artifact's column definitions; if the live query result no longer has a bound column, the renderer shows an error state and the user starts over with a new prompt.

## Charts

`EsiChart` (ADR-0009) is the only ESI component. An artifact with a chart names the ESI catalog id; it may also use every basic component (for example a `Column` with a heading `Text` and the chart). An ESI catalog artifact without an `EsiChart` is invalid (`schema`), so tables and KPIs keep the basic catalog id.

```json
{ "id": "root", "component": "EsiChart", "chartType": "bar", "title": "Revenue by region",
  "categoryKey": "region", "series": [{ "valueKey": "revenue", "label": "Revenue" }],
  "data": { "path": "/rows" } }
```

| Property | Rule |
|----------|------|
| `chartType` | `bar`, `line` or `pie` |
| `title` | Literal string (no binding) |
| `categoryKey` | A column of the artifact; not `boolean` |
| `series` | 1 to 4 `{ valueKey, label? }`; each `valueKey` a unique `number` column; pie exactly 1 |
| `data` | Exactly `{ "path": "/rows" }` |
| `stacked` | Optional, bar only |

No colors, sizes or Chart.js options are part of the DSL. The renderer draws the rows of the current page, always captions it ("First 20 of 45 rows", "All 3 rows"), offers "View as table", draws nulls and non-numbers as gaps, and shows the table with a message instead of a pie with more than 8 rows or a negative value. Fixtures: `valid/chart-*.json`, `invalid/chart-*.json`, `render/chart-*.json`.

## Validation order

1. A2UI JSON Schema for the pinned version (the envelope schema, whose components are components of the artifact's catalog: basic, or ESI for charts).
2. ESI rules: unique component ids, `root` exists, only components and functions from the pinned catalog, child references exist, bound paths follow the binding rules and exist in the column definitions, no HTML or script content, no row data.

All errors are returned together, each with a code, a JSON Pointer into the artifact and the component id:

| Code | Rule |
|------|------|
| `schema` | Fails the A2UI or envelope schema (wrong `catalogId`, `dslSchemaVersion` or property value) |
| `duplicate-id` | Two components share an id |
| `missing-root` | No component has the id `root` |
| `unknown-component` / `unknown-function` | Not in the pinned basic catalog |
| `missing-reference` | A `child`/`children`/`trigger`/`content` id that does not exist |
| `unknown-column` | A bound column not in `columns` |
| `unknown-path` | A path outside the binding rules |
| `unsupported-expression` | A `formatString` interpolation that is not a plain path |
| `unsafe-content` | A literal string with HTML tags or a `javascript:`/`vbscript:`/`data:text/html` URL |
| `row-data` | Row values in the artifact (`rows`, `data`, `dataModel`, `values`, `updateDataModel`) |
| `chart-column-type` | An `EsiChart` series column that is not `number`, or a `boolean` category column |
| `chart-series` | `EsiChart` with no series, more than 4, a duplicate `valueKey`, more than one series in a pie, or `stacked` on a chart other than bar |

`lib/dsl-core` (TypeScript) and `core-backend` (.NET) implement the same rules and must pass the same fixtures (`lib/dsl-schema/src/fixtures/`, published with `@dtnam0899/dsl-schema`). AI output is untrusted, so validation also happens where the artifact is saved.

## Rendering

`lib/dsl-renderer-angular` (`<esi-dsl-surface [artifact] [data]>`) validates before rendering and shows an error state (`role="alert"`) for an invalid artifact or a missing column. All text is plain text: the A2UI `Text` component renders Markdown as HTML for its `body` variant, so ESI replaces the Markdown renderer with one that HTML-escapes the text. Markdown in DSL or row values is therefore shown literally.

## Related

- Skills: `dsl-authoring`, `dsl-renderer-parity`.
- Requirements: [UR-1](../requirements/UR-1-bi-ai-assistant-web-application.md) (SR-5, SR-6, SR-8).
