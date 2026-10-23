import { InjectionToken } from '@angular/core';
import type { ChartColors } from '@dtnam0899/ui-tokens';
import type { ChartConfiguration } from 'chart.js';
import type { ChartModel } from './chart-model';

/** A drawn chart; destroyed when the data, the view or the component goes away. */
export interface ChartHandle {
  destroy(): void;
}

/** Draws a chart on a canvas. */
export type ChartFactory = (canvas: HTMLCanvasElement, config: ChartConfiguration) => ChartHandle;

/**
 * Loads Chart.js on the first chart only (ADR-0009), so pages without charts never download it.
 * Imports `chart.js` itself, never `chart.js/auto`, and registers only what bar, line and pie
 * charts need. Tests replace it with a fake factory.
 */
export const ESI_CHART_LOADER = new InjectionToken<() => Promise<ChartFactory>>('ESI_CHART_LOADER', {
  providedIn: 'root',
  factory: () => loadChartJs,
});

let chartJs: Promise<ChartFactory> | undefined;

export function loadChartJs(): Promise<ChartFactory> {
  chartJs ??= import('chart.js').then((module) => {
    module.Chart.register(
      module.BarController,
      module.LineController,
      module.PieController,
      module.CategoryScale,
      module.LinearScale,
      module.BarElement,
      module.LineElement,
      module.PointElement,
      module.ArcElement,
      module.Legend,
      module.Tooltip,
    );
    return (canvas: HTMLCanvasElement, config: ChartConfiguration) => new module.Chart(canvas, config);
  });
  chartJs.catch(() => (chartJs = undefined));
  return chartJs;
}

// Line series differ by point style and dash pattern as well as by color ("not by color alone").
const POINT_STYLES = ['circle', 'rect', 'triangle', 'rectRot'] as const;
const DASHES = [[], [6, 4], [2, 3], [10, 3, 2, 3]];

/**
 * The Chart.js configuration for a chart model. Presentation is fixed here, never taken from the
 * DSL: no animation, the canvas legend and tooltip only (no HTML), and colors from `ui-tokens`.
 */
export function buildChartConfig(model: ChartModel, colors: ChartColors, background: string): ChartConfiguration {
  const pie = model.chartType === 'pie';
  const datasets = model.series.map((series, index) => {
    const color = colors.series[index % colors.series.length];
    if (pie) {
      return {
        label: series.label,
        data: series.values,
        backgroundColor: model.categories.map((_, slice) => colors.slices[slice % colors.slices.length]),
        borderColor: background,
        borderWidth: 2,
      };
    }
    if (model.chartType === 'line') {
      return {
        label: series.label,
        data: series.values,
        borderColor: color,
        backgroundColor: color,
        borderDash: DASHES[index % DASHES.length],
        pointStyle: POINT_STYLES[index % POINT_STYLES.length],
        pointRadius: 4,
        spanGaps: false,
      };
    }
    return { label: series.label, data: series.values, backgroundColor: color, borderColor: background, borderWidth: 1 };
  });

  const axis = { stacked: model.stacked, ticks: { color: colors.axis }, grid: { color: colors.grid }, border: { color: colors.axis } };
  return {
    type: model.chartType,
    data: { labels: model.categories, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: pie || model.series.length > 1, labels: { color: colors.text, usePointStyle: model.chartType === 'line' } },
        tooltip: { enabled: true },
      },
      ...(pie ? {} : { scales: { x: axis, y: { ...axis, beginAtZero: true } } }),
    },
  } as ChartConfiguration;
}
