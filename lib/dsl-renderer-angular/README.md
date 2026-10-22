# @dtnam0899/dsl-renderer-angular

Angular renderer for stored ESI DSL artifacts, wrapping `@a2ui/angular` 0.13.0 (imported only from `@a2ui/angular/v0_9`). Requires Angular 21.2+.

```html
<esi-dsl-surface [artifact]="artifact" [data]="{ columns, rows, page }" />
```

- Validates the artifact with `dsl-core` before rendering; an invalid artifact, or a bound column missing from `data.columns`, shows an error state (`role="alert"`), never the surface.
- One A2UI surface per instance, with its own `A2uiRendererService` configured with the pinned basic catalog and the ESI catalog, so no app-level provider is needed. A data change sends only `updateDataModel`; a new artifact creates the surface again.
- All text is shown as plain text: `PlainTextMarkdownRenderer` replaces the A2UI Markdown renderer and HTML-escapes text, so DSL and row values are never parsed as Markdown or HTML.
- Charts (ADR-0009): artifacts on the ESI catalog render `EsiChart` (`EsiCatalog` = the basic catalog unchanged plus `EsiChart`). Chart.js 4.5.1 is loaded with a dynamic `import('chart.js')` on the first chart only, with only the bar, line and pie pieces registered (never `chart.js/auto`); replace the loader with the `ESI_CHART_LOADER` token in tests. The component draws a canvas with a text alternative, a caption from `/page` ("First 20 of 45 rows", "All 3 rows"), a "View as table" toggle, and shows the table instead of a pie with more than 8 rows or a negative value. No animation; colors come from `@dtnam0899/ui-tokens` and can be overridden with `--esi-chart-series-1..4`, `--esi-chart-axis`, `--esi-chart-grid`, `--esi-chart-text` and `--esi-chart-height`.
- `zod` 3.25.76 is pinned only to type the `EsiChart` component API; it is the version `@a2ui/angular` already depends on.
- No upstream code is copied.

Commands (from `lib/`): `npx nx build dsl-renderer-angular`, `npx nx test dsl-renderer-angular`.
