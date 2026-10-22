import { type ColumnDefinition, DATA_MODEL_PATHS, ESI_CHART_COMPONENT, MAX_CHART_SERIES } from '@dtnam0899/dsl-schema';
import { type DslValidationError, pointer } from './errors';
import { isObject, type JsonObject } from './json';

export interface ChartAnalysis {
  errors: DslValidationError[];
  /** Columns the charts bind to (category and series columns). */
  boundColumns: string[];
}

/**
 * Checks every `EsiChart` of an ESI catalog artifact (ADR-0009): `data` is `{ "path": "/rows" }`,
 * the category and series columns exist, series columns are numeric and the category is not
 * boolean, 1 to 4 unique series, one series for pie, and `stacked` only on a bar chart.
 * Shapes that the catalog schema rejects (a missing or non-string key) are left to the schema.
 */
export function analyzeCharts(components: JsonObject[], columns: readonly ColumnDefinition[]): ChartAnalysis {
  const errors: DslValidationError[] = [];
  const bound = new Set<string>();
  const types = new Map(columns.map((column) => [column.name, column.type]));

  components.forEach((component, index) => {
    if (component['component'] !== ESI_CHART_COMPONENT) return;
    const componentId = String(component['id']);
    const error = (code: DslValidationError['code'], message: string, ...segments: (string | number)[]) =>
      errors.push({ code, message, path: pointer('components', index, ...segments), componentId });

    const data = component['data'];
    if (isObject(data) && typeof data['path'] === 'string' && data['path'] !== DATA_MODEL_PATHS.rows) {
      error('unknown-path', `Chart data must be bound to "${DATA_MODEL_PATHS.rows}", not "${data['path']}"`, 'data', 'path');
    }

    const column = (name: string, ...segments: (string | number)[]) => {
      const type = types.get(name);
      if (type === undefined) {
        error('unknown-column', `Chart column "${name}" is not in the column definitions`, ...segments);
      } else {
        bound.add(name);
      }
      return type;
    };

    const categoryKey = component['categoryKey'];
    if (typeof categoryKey === 'string' && column(categoryKey, 'categoryKey') === 'boolean') {
      error('chart-column-type', `The category column "${categoryKey}" is boolean; use a string, date, datetime or number column`, 'categoryKey');
    }

    const chartType = component['chartType'];
    const series = component['series'];
    if (Array.isArray(series)) {
      if (series.length === 0 || series.length > MAX_CHART_SERIES) {
        error('chart-series', `A chart has 1 to ${MAX_CHART_SERIES} series, not ${series.length}`, 'series');
      } else if (chartType === 'pie' && series.length > 1) {
        error('chart-series', `A pie chart has exactly one series, not ${series.length}`, 'series');
      }
      const seen = new Set<string>();
      series.forEach((item, seriesIndex) => {
        const valueKey = isObject(item) ? item['valueKey'] : undefined;
        if (typeof valueKey !== 'string') return;
        if (seen.has(valueKey)) {
          error('chart-series', `The column "${valueKey}" is used by more than one series`, 'series', seriesIndex, 'valueKey');
        }
        seen.add(valueKey);
        const type = column(valueKey, 'series', seriesIndex, 'valueKey');
        if (type !== undefined && type !== 'number') {
          error('chart-column-type', `The series column "${valueKey}" is ${type}; series must be number columns`, 'series', seriesIndex, 'valueKey');
        }
      });
    }

    if ('stacked' in component && chartType !== 'bar') {
      error('chart-series', `"stacked" is only for bar charts, not ${String(chartType)}`, 'stacked');
    }
  });

  return { errors, boundColumns: [...bound] };
}
