import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { SurfaceData } from '@dtnam0899/dsl-core';
import { BASIC_CATALOG_COMPONENTS, ESI_CATALOG_ID } from '@dtnam0899/dsl-schema';
import { RENDER_FIXTURES, VALID_FIXTURES } from '@dtnam0899/dsl-schema/fixtures';
import type { ChartConfiguration } from 'chart.js';
import { DslSurface } from '../dsl-surface/dsl-surface';
import { type ChartFactory, ESI_CHART_LOADER } from './chart-config';
import { EsiCatalog } from './esi-catalog';

/** Stands in for Chart.js, which jsdom cannot draw: records every chart and whether it was destroyed. */
class FakeCharts {
  readonly drawn: { canvas: HTMLCanvasElement; config: ChartConfiguration; destroyed: boolean }[] = [];
  loads = 0;
  readonly factory: ChartFactory = (canvas, config) => {
    const chart = { canvas, config, destroyed: false };
    this.drawn.push(chart);
    return { destroy: () => (chart.destroyed = true) };
  };
  get live() {
    return this.drawn.filter((chart) => !chart.destroyed);
  }
}

let charts: FakeCharts;

async function render(artifact: unknown, data: SurfaceData): Promise<ComponentFixture<DslSurface>> {
  const fixture = TestBed.createComponent(DslSurface);
  fixture.componentRef.setInput('artifact', artifact);
  fixture.componentRef.setInput('data', data);
  fixture.componentRef.setInput('surfaceId', 'chart-surface');
  await settle(fixture);
  return fixture;
}

async function settle(fixture: ComponentFixture<DslSurface>): Promise<void> {
  for (let i = 0; i < 4; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
  }
}

const element = (fixture: ComponentFixture<DslSurface>) => fixture.nativeElement as HTMLElement;
const text = (fixture: ComponentFixture<DslSurface>) => element(fixture).textContent?.replace(/\s+/g, ' ').trim() ?? '';
const toggle = (fixture: ComponentFixture<DslSurface>) => element(fixture).querySelector<HTMLButtonElement>('button.esi-chart-toggle');

describe('EsiChart', () => {
  beforeEach(() => {
    charts = new FakeCharts();
    TestBed.configureTestingModule({
      imports: [DslSurface],
      providers: [{ provide: ESI_CHART_LOADER, useValue: () => (charts.loads++, Promise.resolve(charts.factory)) }],
    });
  });

  it('is in the ESI catalog together with every basic component', () => {
    const catalog = TestBed.inject(EsiCatalog);
    expect(catalog.id).toBe(ESI_CATALOG_ID);
    expect([...catalog.components.keys()].sort()).toEqual([...BASIC_CATALOG_COMPONENTS, 'EsiChart'].sort());
  });

  it('draws the bar fixture with its title, caption, text alternative and a canvas', async () => {
    const { artifact, result } = VALID_FIXTURES['chart-bar'];
    const fixture = await render(artifact, result);

    expect(element(fixture).querySelector('[role="alert"]')).toBeNull();
    expect(element(fixture).querySelector('figcaption')?.textContent).toBe('Revenue and cost by region');
    expect(text(fixture)).toContain('All 3 rows');
    const canvas = element(fixture).querySelector('canvas');
    expect(canvas?.getAttribute('role')).toBe('img');
    expect(canvas?.getAttribute('aria-label')).toMatch(/^Revenue and cost by region\. Bar chart of 3 values by region\. Revenue: from .+ Cost: from /);

    expect(charts.live).toHaveLength(1);
    const { config } = charts.live[0];
    expect(config.type).toBe('bar');
    expect(config.data.labels).toEqual(['North', 'South', 'West']);
    expect(config.data.datasets.map((dataset) => dataset.label)).toEqual(['Revenue', 'Cost']);
    expect(config.data.datasets[0].data).toEqual([1234.5, 987, 456.75]);
    expect(config.options?.scales?.['x']?.stacked).toBe(true);
    expect(charts.live[0].canvas).toBe(canvas);
  });

  it('says that a line chart shows the first 20 of 45 rows, and draws inside a basic Column', async () => {
    const { artifact, result } = VALID_FIXTURES['chart-line'];
    const fixture = await render(artifact, result);

    expect(text(fixture)).toContain('Monthly revenue');
    expect(text(fixture)).toContain('First 20 of 45 rows');
    expect(charts.live[0].config.type).toBe('line');
    expect(charts.live[0].config.data.labels).toHaveLength(20);
  });

  it('toggles between the chart and a text table with the same rows', async () => {
    const { artifact, result } = VALID_FIXTURES['chart-pie'];
    const fixture = await render(artifact, result);
    expect(toggle(fixture)?.getAttribute('aria-pressed')).toBe('false');

    toggle(fixture)?.click();
    await settle(fixture);
    expect(toggle(fixture)?.getAttribute('aria-pressed')).toBe('true');
    expect(element(fixture).querySelector('canvas')).toBeNull();
    expect(charts.live).toHaveLength(0);
    const cells = [...element(fixture).querySelectorAll('tbody tr')].map((row) => [...row.children].map((cell) => cell.textContent?.trim()));
    expect(cells).toEqual([['Retail', '31'], ['Wholesale', '17'], ['Online', '9'], ['Partner', '3']]);
    expect([...element(fixture).querySelectorAll('thead th')].map((cell) => cell.textContent?.trim())).toEqual(['segment', 'Customers']);

    toggle(fixture)?.click();
    await settle(fixture);
    expect(element(fixture).querySelector('canvas')).not.toBeNull();
    expect(charts.live).toHaveLength(1);
  });

  it('aligns each series header with its numbers and keeps the category column as text', async () => {
    const { artifact, result } = VALID_FIXTURES['chart-bar'];
    const fixture = await render(artifact, result);
    toggle(fixture)?.click();
    await settle(fixture);
    const numeric = (cells: NodeListOf<Element>) => [...cells].map((cell) => cell.classList.contains('esi-chart-number'));
    expect(numeric(element(fixture).querySelectorAll('thead th'))).toEqual([false, true, true]);
    expect(numeric(element(fixture).querySelectorAll('tbody tr:first-child > *'))).toEqual([false, true, true]);
  });

  it.each([
    ['chart-pie-too-many-slices', 'more than a pie chart can show'],
    ['chart-pie-negative', 'cannot show negative values'],
  ])('shows the table instead of a pie that cannot be drawn (%s)', async (name, message) => {
    const fixture_ = RENDER_FIXTURES[name];
    expect(fixture_.expectedChartFallback).toBeDefined();
    const fixture = await render(fixture_.artifact, fixture_.result);

    expect(element(fixture).querySelector('[role="status"]')?.textContent).toContain(message);
    expect(element(fixture).querySelector('canvas')).toBeNull();
    expect(element(fixture).querySelector('table')).not.toBeNull();
    expect(toggle(fixture)).toBeNull();
    expect(charts.drawn).toHaveLength(0);
    expect(charts.loads).toBe(0);
  });

  it('draws gaps for nulls and non-numbers and leaves their table cells empty', async () => {
    const { artifact, result } = RENDER_FIXTURES['chart-gaps'];
    const fixture = await render(artifact, result);

    const { config } = charts.live[0];
    expect(config.data.labels).toEqual(['North', 'South', '']);
    expect(config.data.datasets[0].data).toEqual([1234.5, null, 456.75]);
    expect(config.data.datasets[1].data).toEqual([null, 700.25, 300]);
    toggle(fixture)?.click();
    await settle(fixture);
    const firstRow = element(fixture).querySelector('tbody tr');
    expect([...(firstRow?.children ?? [])].map((cell) => cell.textContent?.trim())).toEqual(['North', '1,234.5', '']);
  });

  it('shows untrusted category values as text in the chart, its text alternative and the table', async () => {
    const { artifact, result } = RENDER_FIXTURES['chart-untrusted-category'];
    const fixture = await render(artifact, result);

    expect(charts.live[0].config.data.labels).toEqual(['<img src=x onerror=alert(1)>', '**bold** [link](javascript:alert(1))']);
    toggle(fixture)?.click();
    await settle(fixture);
    expect(element(fixture).querySelector('img')).toBeNull();
    expect(element(fixture).querySelector('a')).toBeNull();
    expect(element(fixture).querySelector('strong')).toBeNull();
    expect(text(fixture)).toContain('<img src=x onerror=alert(1)>');
  });

  it('redraws with new data and destroys the chart with the surface', async () => {
    const { artifact, result } = VALID_FIXTURES['chart-bar'];
    const fixture = await render(artifact, result);
    fixture.componentRef.setInput('data', { ...result, rows: result.rows.slice(0, 1), page: { ...result.page, totalRows: 1 } });
    await settle(fixture);

    expect(charts.live).toHaveLength(1);
    expect(charts.live[0].config.data.labels).toEqual(['North']);
    expect(text(fixture)).toContain('All 1 row');

    fixture.destroy();
    expect(charts.live).toHaveLength(0);
  });

  it('shows the table when Chart.js cannot be loaded', async () => {
    TestBed.overrideProvider(ESI_CHART_LOADER, { useValue: () => Promise.reject(new Error('offline')) });
    const { artifact, result } = VALID_FIXTURES['chart-bar'];
    const fixture = await render(artifact, result);

    expect(element(fixture).querySelector('[role="status"]')?.textContent).toContain('could not be drawn');
    expect(element(fixture).querySelector('table')).not.toBeNull();
  });
});
