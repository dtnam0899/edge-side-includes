import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CHART_BACKGROUNDS, CHART_COLORS } from '@dtnam0899/ui-tokens';
import { buildChartConfig, loadChartJs } from './chart-config';
import { buildChartModel } from './chart-model';

const rows = [
  { region: 'North', revenue: 10, cost: 4 },
  { region: 'South', revenue: 20, cost: 8 },
];
const series = [{ valueKey: 'revenue' }, { valueKey: 'cost' }];
const config = (chartType: 'bar' | 'line' | 'pie', stacked?: boolean) =>
  buildChartConfig(
    buildChartModel({ chartType, title: 'T', categoryKey: 'region', series: chartType === 'pie' ? [series[0]] : series, stacked }, rows, undefined),
    CHART_COLORS.light,
    CHART_BACKGROUNDS.light,
  ) as unknown as {
    type: string;
    data: { labels: string[]; datasets: Record<string, unknown>[] };
    options: { animation: boolean; plugins: { legend: { display: boolean } }; scales?: { x: { stacked: boolean }; y: { stacked: boolean; beginAtZero: boolean } } };
  };

describe('buildChartConfig', () => {
  it('draws a bar chart with fixed presentation: no animation, series colors, stacked axes', () => {
    const bar = config('bar', true);
    expect(bar.type).toBe('bar');
    expect(bar.data.labels).toEqual(['North', 'South']);
    expect(bar.data.datasets.map((dataset) => dataset['backgroundColor'])).toEqual(CHART_COLORS.light.series.slice(0, 2));
    expect(bar.options.animation).toBe(false);
    expect(bar.options.scales?.x.stacked).toBe(true);
    expect(bar.options.scales?.y).toMatchObject({ stacked: true, beginAtZero: true });
    expect(bar.options.plugins.legend.display).toBe(true);
  });

  it('tells line series apart by point style and dash pattern, not by color alone', () => {
    const [first, second] = config('line').data.datasets;
    expect(first['pointStyle']).not.toBe(second['pointStyle']);
    expect(first['borderDash']).not.toEqual(second['borderDash']);
    expect(first['spanGaps']).toBe(false);
  });

  it('colors pie slices from the slice palette, without axes', () => {
    const pie = config('pie');
    expect(pie.data.datasets[0]['backgroundColor']).toEqual(CHART_COLORS.light.slices.slice(0, 2));
    expect(pie.options.scales).toBeUndefined();
    expect(pie.options.plugins.legend.display).toBe(true);
  });
});

describe('loadChartJs', () => {
  it('registers only the bar, line and pie pieces of Chart.js', async () => {
    await loadChartJs();
    const { Chart } = await import('chart.js');
    for (const id of ['bar', 'line', 'pie']) expect(Chart.registry.controllers.get(id), id).toBeDefined();
    // `doughnut` is registered as the parent class of the pie controller.
    for (const id of ['radar', 'polarArea', 'bubble', 'scatter']) expect(Chart.registry.controllers.get(id), id).toBeUndefined();
    for (const id of ['category', 'linear']) expect(Chart.registry.scales.get(id), id).toBeDefined();
    for (const id of ['logarithmic', 'time', 'radialLinear']) expect(Chart.registry.scales.get(id), id).toBeUndefined();
  });

  it('is the only place that loads Chart.js, and never chart.js/auto or a static import', () => {
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? files(path) : path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
      });
    for (const file of files(join(import.meta.dirname, '../..'))) {
      const source = readFileSync(file, 'utf8');
      // Import statements only; comments may name the module.
      expect(source, file).not.toMatch(/(?:from |import\()'chart\.js\/auto'/);
      expect(source, file).not.toMatch(/^import (?!type )[^;]*from 'chart\.js'/m);
    }
  });
});
