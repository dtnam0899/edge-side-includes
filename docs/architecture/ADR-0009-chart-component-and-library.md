---
id: ADR-0009
type: adr
status: Proposed
date: 2026-10-23
projects: [lib, contracts, core, agents, portal]
issues: [ESI-111, ESI-10, ESI-11, ESI-12]
keywords: [chart, charts, esichart, chart.js, custom catalog, catalogId, bar, line, pie, view as table, first 20 of n rows, accessibility, ui-tokens, lazy load, bundle budget, phase 7]
---

# ADR-0009 Chart component and library: `EsiChart` on Chart.js in a custom A2UI catalog

## Context
- UR-1 decisions 12, 28 and 31 ([UR-1](../requirements/UR-1-bi-ai-assistant-web-application.md)): charts are a follow-up with a custom component; they use Chart.js, wrapped as an ESI component in a custom A2UI catalog; a chart uses only the current 20-row page and must say so. The "Chart proposal" section of UR-1 suggests `bar`, `line`, `pie`, one component `EsiChart` and its properties; open question 2 asks to confirm it in this ADR.
- [ADR-0002](./ADR-0002-a2ui-dsl-adoption-and-storage.md): the DSL is A2UI v0.9.1 with the basic catalog, stored as the `updateComponents` payload plus `catalogId`, protocol version, `dslSchemaVersion`, column definitions and the SELECT; no row values. Custom components are allowed only when the basic catalog cannot express the need (charts) and live in a custom catalog with its own `catalogId`. The basic catalog (18 components, 14 functions) has no chart.
- Today the envelope schema (`lib/dsl-schema/src/esi/artifact.schema.json`) fixes `catalogId` to the basic catalog id with `const`. The same rules are implemented three times and must give the same error codes on the shared fixtures: `@dtnam0899/dsl-core` (portal), the Python mirror (agents) and `DslValidator` (core). `VisualizationIntent.kind` in `services/contracts` is `table | kpi`; charts and forms answer 422 `visualization-not-supported`.
- A2UI v0.9.1 `createSurface.catalogId` is a free string; the spec recommends prefixing it with a domain you own (for example `mycompany.com:somecatalog`).
- `@a2ui/angular` 0.13.0 (`/v0_9` entry point) builds catalogs with `new AngularCatalog(id, protocolVersion, components, functions)` and exports `BASIC_COMPONENTS`; a custom component is registered with `createComponentImplementation(api, component)`. `lib/dsl-renderer-angular` today provides `A2UI_RENDERER_CONFIG` with `catalogs: [BasicCatalog]` per `<esi-dsl-surface>`.
- Query pages have 20 rows (`QueryService.PageSize`); the data model is `{ rows, page: { page, pageSize, totalRows, remaining } }`. Number cells are JSON numbers (decimals included, ESI-66). `lib/ui-tokens` is still a stub (no colors).
- Portal bundle (ESI-87, PR #92): initial bundle 814 kB, warning budget 900 kB, error budget 1 MB.
- Chart.js, verified on npm on 2026-10-23: latest `4.5.1` (published 2025-10-13), MIT, one runtime dependency `@kurkle/color` `^0.3.0`. It draws on `<canvas>`; labels, legend and default tooltips are canvas text, not HTML. It is tree-shakable: only registered controllers, elements, scales and plugins are bundled (`chart.js/auto` registers everything).

## Options
Library
1. **Chart.js 4** - pros: product-owner choice (decision 31); small and tree-shakable; canvas text only, so no HTML injection path in its default legend and tooltip; MIT; mature and stable API. Cons: canvas is invisible to screen readers (needs our own text alternative and table); no built-in pattern fills for "not by color alone".
2. **Apache ECharts** - pros: many chart types, built-in `aria` description and decal patterns. Cons: much larger bundle, rich-text formatters and HTML tooltips that we would have to lock down; more than the three types we need.
3. **D3 / hand-written SVG** - pros: SVG is accessible and fully controlled. Cons: we write and maintain axes, scales, layout and interaction ourselves.
4. **Vega-Lite** - pros: declarative and accessible. Cons: it is a second DSL with expressions and data transforms; putting it inside A2UI doubles the schema surface that ADR-0002 option 3 rejected.

Catalog
- a. **One ESI catalog = basic catalog + `EsiChart`**, used only by documents that contain a chart; tables and KPIs keep the basic catalog id. No migration of stored artifacts.
- b. **Move every document to the ESI catalog.** One id everywhere, but every stored artifact needs a migration and a new `dslSchemaVersion`, for no gain.

## Decision
Take library option 1 and catalog option a. Charts are one custom component `EsiChart` in an ESI catalog that contains the 18 basic components and 14 basic functions unchanged plus `EsiChart`. It is rendered by `lib/dsl-renderer-angular` with Chart.js `4.5.1`. Types are `bar`, `line` and `pie`, as proposed in UR-1.

Catalog
- `catalogId`: `dtnam0899.github.io:esi-catalog-v0_9-1` (A2UI's domain-prefix advice; `dtnam0899.github.io` is the owner's GitHub Pages domain). It is a name, not a URL to fetch. The catalog file is `lib/dsl-schema/src/esi/catalog.json`: it references the vendored basic catalog's components and functions and adds the `EsiChart` schema, so the basic definitions exist only once.
- The envelope accepts exactly two `catalogId` values: the basic id and the ESI id. A document with the basic id may contain only basic components (as today). A document with the ESI id must contain at least one `EsiChart`; otherwise it is invalid (`schema`), so tables and KPIs never drift to the ESI id.
- `dslSchemaVersion` stays `1`: the protocol/renderer pair does not change, and stored table and KPI artifacts stay valid without migration. Changing the ESI catalog later (a new property, a new chart type) is a new catalog id suffix (`-2`) plus a `dsl-core` migration, as ADR-0002 requires for pins.

`EsiChart` properties (all required unless marked)
- `chartType`: `bar` | `line` | `pie`.
- `title`: a literal string (no binding), shown above the chart and used in the text alternative; the usual `unsafe-content` check applies.
- `categoryKey`: a column name for the x axis (bar, line) or the slice labels (pie). Column type `string`, `date`, `datetime` or `number`.
- `series`: 1 to 4 items `{ valueKey, label }`; `valueKey` is a column of type `number`, unique within the list; `label` is a literal string (default: the column name). Pie allows exactly 1 series.
- `data`: exactly `{ "path": "/rows" }`. No other path, no literal data.
- `stacked` (optional, bar only, default `false`).
- No colors, fonts, sizes, animation or Chart.js options in the DSL: the renderer owns presentation.

Validation (all three implementations, same codes)
- Reuse `unknown-column` for a `categoryKey` or `valueKey` that is not in `columns`, and `unknown-path` for a `data` binding other than `/rows`.
- New `chart-column-type`: a `valueKey` column that is not `number`, or a `categoryKey` column of type `boolean`.
- New `chart-series`: no series, more than 4, a duplicate `valueKey`, a pie with more than one series, or `stacked` on a type other than bar.
- An `EsiChart` under the basic catalog id is `unknown-component` (as today); an ESI-id document without an `EsiChart` is `schema`.
- Shared fixtures in `@dtnam0899/dsl-schema`: valid bar, line and pie; one invalid fixture per new rule; render fixtures for a pie with too many rows, null and non-finite values, and untrusted text in category values.

Rendering (`lib/dsl-renderer-angular`)
- `<esi-dsl-surface>` registers both catalogs: `BasicCatalog` and an `AngularCatalog` built from `BASIC_COMPONENTS`, the basic functions and the `EsiChart` implementation. `EsiChart` is an Angular standalone component.
- Chart.js is a dependency of `@dtnam0899/dsl-renderer-angular` at exactly `4.5.1`. Import from `chart.js` and register only `BarController`, `LineController`, `PieController`, `CategoryScale`, `LinearScale`, `BarElement`, `LineElement`, `PointElement`, `ArcElement`, `Legend` and `Tooltip`; never `chart.js/auto`. Load it with a dynamic `import()` on the first chart render, so the portal's initial bundle does not grow.
- Data: the current page's rows only (decision 12). The component always shows a caption it builds itself, not from the DSL: "First 20 of N rows" when `totalRows` > `pageSize`, otherwise "All N rows" (localized in the renderer, from `/page`). Category values are turned into text; a `null`, non-number or non-finite value is drawn as a gap and shown as empty in the table. Pie: negative values are invalid at render time, and more than 8 rows cannot be drawn as a pie; in both cases the component opens the table view with a short message instead of drawing a wrong chart.
- Safety: Chart.js default canvas legend and tooltip only; no HTML legend or tooltip, no plugins that render HTML, no `innerHTML`. All text (title, labels, category values) is plain text.
- Accessibility: the canvas has `role="img"` and an `aria-label` built from the title, chart type, series labels, the row count and, per series, the min and max. A "View as table" toggle (a real `<button>` with `aria-pressed`) shows the same rows and columns as a plain text table in the component's own template. Series are told apart without color: line series get different point styles and dash patterns; bar series keep a fixed order matching the legend; pie slices show their category text in the legend and table. Animation is off (`animation: false`), which also covers reduced-motion users and keeps tests deterministic.
- Colors: a categorical palette of 4 colors plus axis, grid and text colors comes from `lib/ui-tokens` (new tokens, light and dark), checked for 3:1 contrast against the background. The renderer reads them; the DSL never names a color.

Contracts, core, agents, portal
- `services/contracts`: `VisualizationIntent.kind` adds `chart` (additive, minor version). `DslDocument.catalogId` documents both ids. The agents request's `catalogId` may be either id; core sends the ESI id for `chart`, the basic id otherwise.
- `services/core-backend`: `DslValidator` loads both catalogs and the new rules from the pinned `@dtnam0899/dsl-schema` fixtures; `chart` intents are forwarded to agents instead of answering `visualization-not-supported`. Forms stay refused. Saved artifacts and dashboards need no change (the document carries its catalog id).
- `services/ai-agents`: the DSL prompt (`dsl_generation` v2) may use `EsiChart` for `chart` intents. Type choice: `line` when the category is a date or datetime; `pie` only when the user asks for shares of a whole with one series; otherwise `bar`. Aggregation belongs in the SQL; the agent explains that a chart shows the current page only. The Python mirror implements the new rules.
- `web/esi-portal`: the assistant module sends `kind: chart` when the user asks for a chart and renders the result through `<esi-dsl-surface>`, in chat and on dashboards; no Chart.js import in the portal itself.
- Release order (producer first): `lib-dsl-schema` 0.2.0 -> `lib-dsl-core` 0.2.0 -> `lib-dsl-renderer-angular` 0.2.0 and `contracts` 0.3.0 -> core and agents (pin both) -> portal (pin both).

## Consequences
- Charts arrive without migrating any stored artifact, and older consumers keep working for tables and KPIs. A consumer still on dsl-schema 0.1.0 rejects chart documents (`schema`), which is the intended fail-safe until it bumps.
- One more runtime dependency (Chart.js plus `@kurkle/color`) in the renderer package. With tree-shaking and lazy loading it does not touch the portal's initial bundle; the lazy chunk size is recorded in the ESI-10 PR.
- The three validators gain two error codes and the fixture corpus grows; parity is enforced by the shared fixtures as today.
- Charts on 20 rows can mislead; the fixed caption and the table view make the limit visible, and the agent pushes aggregation into SQL. Charts over the whole result need a later ADR (server-side aggregation or a larger chart page).
- `lib/ui-tokens` stops being a stub: it gets its first real tokens (chart palette), which other UI can reuse.
- Follow-up issues: ESI-10 `[lib]` (catalog, schema, fixtures, `EsiChart`, tokens, dsl-core rules), ESI-11 `[agents]` (prompt, mirror rules, evals), ESI-12 `[portal]` (intent, rendering in chat and dashboards). Not filed yet: `[contracts]` (`kind: chart`, catalog ids) and `[core]` (`DslValidator` and visualization flow).

## Verification
- lib: fixture tests for the three valid charts and every invalid fixture with the exact codes; a test that the ESI catalog contains every basic component and function unchanged and that its id matches the envelope; renderer tests for the caption (`First 20 of N` / `All N`), the text alternative, the table toggle, null and non-finite values, the pie fallbacks, untrusted text, and that Chart.js is loaded only when a chart renders; a check that `chart.js/auto` is never imported.
- core: `DslValidatorTests` pass all `@dtnam0899/dsl-schema` 0.2.0 fixtures with the same codes as dsl-core; integration test for a `chart` visualization end to end with a scripted agent.
- agents: evals for bar, line and pie choices, numeric-only series, pie limited to one series, refusal of forms, and prompts with column definitions only; the real-model evals of ADR-0007 include chart cases.
- portal: unit tests for the `chart` intent and rendering in chat and on a dashboard; a browser check against the local stack; `infra/e2e` gets one chart step.

## Open questions
- Product owner: confirm the 4-series limit and the 8-slice pie limit, and whether a "stacked" bar is needed in the first version.
- Whether pattern fills for multi-series bars are needed for "not by color alone" beyond the legend order and the table view (Chart.js has no built-in patterns; it would mean a small own plugin).
- Locale of the caption and number formatting in the chart (renderer default vs a portal setting).
