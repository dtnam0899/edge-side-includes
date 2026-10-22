import { type ChartSeries, type ChartType, MAX_PIE_SLICES, type PageInfo } from '@dtnam0899/dsl-schema';

/** The `EsiChart` properties the model needs, already checked by `dsl-core`. */
export interface ChartInput {
  chartType: ChartType;
  title: string;
  categoryKey: string;
  series: readonly ChartSeries[];
  stacked?: boolean;
}

/** Why a chart cannot be drawn with the current rows; the table is shown instead. */
export type ChartFallback = 'too-many-slices' | 'negative-values';

/** Everything the chart component shows, derived from the DSL properties and the current page. */
export interface ChartModel {
  chartType: ChartType;
  title: string;
  stacked: boolean;
  /** Category labels as text, one per row. */
  categories: string[];
  /** One entry per series; a value that is not a finite number is `null` (a gap). */
  series: { label: string; values: (number | null)[] }[];
  fallback?: ChartFallback;
  /** "First 20 of 45 rows", "All 3 rows" or "Rows 21–40 of 45": built from `/page`, never from the DSL. */
  caption: string;
  /** Text alternative of the canvas. */
  summary: string;
  /** The same rows as text, for the table view. */
  table: { headers: string[]; rows: string[][] };
}

const TYPE_NAMES: Record<ChartType, string> = { bar: 'Bar', line: 'Line', pie: 'Pie' };

/**
 * Builds what a chart shows from its properties and the rows of the current page (ADR-0009). All
 * values become plain text or numbers here; nothing from the rows is interpreted as markup.
 */
export function buildChartModel(
  input: ChartInput,
  rows: readonly Record<string, unknown>[],
  page: PageInfo | undefined,
  locale?: string,
): ChartModel {
  const numbers = new Intl.NumberFormat(locale);
  const categories = rows.map((row) => categoryText(row[input.categoryKey], numbers));
  const series = input.series.map((item) => ({
    label: item.label ?? item.valueKey,
    values: rows.map((row) => toNumber(row[item.valueKey])),
  }));

  let fallback: ChartFallback | undefined;
  if (input.chartType === 'pie') {
    if (rows.length > MAX_PIE_SLICES) fallback = 'too-many-slices';
    else if (series.some((item) => item.values.some((value) => value !== null && value < 0))) fallback = 'negative-values';
  }

  return {
    chartType: input.chartType,
    title: input.title,
    stacked: input.chartType === 'bar' && input.stacked === true,
    categories,
    series,
    fallback,
    caption: caption(rows.length, page, numbers),
    summary: summary(input, categories.length, series, numbers),
    table: {
      headers: [input.categoryKey, ...series.map((item) => item.label)],
      rows: categories.map((category, index) => [
        category,
        ...series.map((item) => {
          const value = item.values[index];
          return value === null ? '' : numbers.format(value);
        }),
      ]),
    },
  };
}

/** The message shown instead of a chart that cannot be drawn. */
export function fallbackMessage(fallback: ChartFallback, rowCount: number): string {
  return fallback === 'too-many-slices'
    ? `This result has ${rowCount} rows, more than a pie chart can show (${MAX_PIE_SLICES}). Showing the table instead.`
    : 'A pie chart cannot show negative values. Showing the table instead.';
}

function categoryText(value: unknown, numbers: Intl.NumberFormat): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? numbers.format(value) : String(value);
  return String(value);
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function caption(rowCount: number, page: PageInfo | undefined, numbers: Intl.NumberFormat): string {
  const rows = (count: number) => `${numbers.format(count)} ${count === 1 ? 'row' : 'rows'}`;
  if (!page) return rows(rowCount);
  if (page.page <= 1) {
    return page.totalRows > rowCount ? `First ${numbers.format(rowCount)} of ${rows(page.totalRows)}` : `All ${rows(page.totalRows)}`;
  }
  const start = (page.page - 1) * page.pageSize + 1;
  return `Rows ${numbers.format(start)}–${numbers.format(start + rowCount - 1)} of ${numbers.format(page.totalRows)}`;
}

function summary(input: ChartInput, count: number, series: ChartModel['series'], numbers: Intl.NumberFormat): string {
  const parts = [`${input.title}.`, `${TYPE_NAMES[input.chartType]} chart of ${count} ${count === 1 ? 'value' : 'values'} by ${input.categoryKey}.`];
  for (const item of series) {
    const values = item.values.filter((value): value is number => value !== null);
    parts.push(
      values.length === 0
        ? `${item.label}: no values.`
        : `${item.label}: from ${numbers.format(Math.min(...values))} to ${numbers.format(Math.max(...values))}.`,
    );
  }
  return parts.join(' ');
}
