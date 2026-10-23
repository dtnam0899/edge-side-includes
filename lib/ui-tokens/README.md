# @dtnam0899/ui-tokens

Design tokens shared by ESI renderers. Framework free.

- Chart colors (ADR-0009): `CHART_COLORS` (light and dark defaults), `CHART_COLOR_PROPERTIES` (CSS custom properties a host page may set, `--esi-chart-series-1..4`, `--esi-chart-axis`, `--esi-chart-grid`, `--esi-chart-text`) and `contrastRatio`. Series (4), pie slice (8), axis and text colors have at least 3:1 contrast against `CHART_BACKGROUNDS`; a test checks it.

Commands (from `lib/`): `npx nx build ui-tokens`, `npx nx test ui-tokens`.
