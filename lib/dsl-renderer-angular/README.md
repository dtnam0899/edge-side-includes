# @dtnam0899/dsl-renderer-angular

Angular renderer for stored ESI DSL artifacts, wrapping `@a2ui/angular` 0.13.0 (imported only from `@a2ui/angular/v0_9`). Requires Angular 21.2+.

```html
<esi-dsl-surface [artifact]="artifact" [data]="{ columns, rows, page }" />
```

- Validates the artifact with `dsl-core` before rendering; an invalid artifact, or a bound column missing from `data.columns`, shows an error state (`role="alert"`), never the surface.
- One A2UI surface per instance, with its own `A2uiRendererService` configured with the pinned basic catalog, so no app-level provider is needed. A data change sends only `updateDataModel`; a new artifact creates the surface again.
- All text is shown as plain text: `PlainTextMarkdownRenderer` replaces the A2UI Markdown renderer and HTML-escapes text, so DSL and row values are never parsed as Markdown or HTML.
- No upstream code is copied.

Commands (from `lib/`): `npx nx build dsl-renderer-angular`, `npx nx test dsl-renderer-angular`.
