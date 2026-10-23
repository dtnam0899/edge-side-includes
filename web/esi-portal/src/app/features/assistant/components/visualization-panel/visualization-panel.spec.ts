import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ESI_CHART_LOADER, type ChartFactory } from '@dtnam0899/dsl-renderer-angular';

import {
  MOCK_KPI_COLUMNS,
  MOCK_KPI_SQL,
  mockChartVisualization,
  mockFullQueryPage,
  mockKpiResult,
  mockProblem,
  mockVisualization,
} from '../../../../../testing/mocks/core-api.mocks';
import { toApiProblem, type QueryResult, type VisualizationIntent } from '../../../../core/api';
import { toRendererArtifact } from '../../helpers/dsl-adapter';
import type { VisualizationState } from '../../services/chat.service';
import { VisualizationPanel } from './visualization-panel';

/** Stands in for Chart.js (jsdom has no canvas); records what was drawn. */
const drawn: unknown[] = [];
const fakeChart: ChartFactory = (_canvas, config) => {
  drawn.push(config);
  return { destroy: () => undefined };
};

async function render(state?: VisualizationState, result: QueryResult = mockKpiResult()) {
  drawn.length = 0;
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ESI_CHART_LOADER, useValue: () => Promise.resolve(fakeChart) },
    ],
  });
  const fixture = TestBed.createComponent(VisualizationPanel);
  fixture.componentRef.setInput('key', 'm1');
  fixture.componentRef.setInput('result', result);
  fixture.componentRef.setInput('state', state);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  return { fixture, el, button };
}

describe('VisualizationPanel', () => {
  it('asks for a table, KPI or chart with the optional wording', async () => {
    const { fixture, el, button } = await render();
    const asked: VisualizationIntent[] = [];
    fixture.componentInstance.visualize.subscribe((intent) => asked.push(intent));
    const input = el.querySelector('input')!;
    input.value = 'total revenue';
    input.dispatchEvent(new Event('input'));
    button('KPI')!.click();
    button('Table')!.click();
    button('Chart')!.click();
    expect(asked).toEqual([
      { kind: 'kpi', description: 'total revenue' },
      { kind: 'table', description: 'total revenue' },
      { kind: 'chart', description: 'total revenue' },
    ]);
  });

  it('explains a refused form and still offers a table, KPI or chart', async () => {
    const problem = toApiProblem(
      new HttpErrorResponse({
        status: 422,
        error: mockProblem('visualization-not-supported', 422),
      }),
    );
    const { el, button } = await render({
      status: 'failure',
      intent: { kind: 'table', description: 'an input form' },
      problem,
    });
    expect(el.textContent).toContain(
      'Forms are not supported yet. Ask for a table, a KPI or a chart instead.',
    );
    expect(button('Table')?.disabled).toBe(false);
    expect(button('KPI')?.disabled).toBe(false);
    expect(button('Chart')?.disabled).toBe(false);
  });

  it('lists the findings when the DSL stayed invalid', async () => {
    const problem = toApiProblem(
      new HttpErrorResponse({
        status: 422,
        error: mockProblem('dsl-validation-failed', 422, {
          issues: [{ code: 'unknown-column', message: 'Unknown column Total' }],
        }),
      }),
    );
    const { el } = await render({ status: 'failure', intent: { kind: 'kpi' }, problem });
    expect(el.textContent).toContain('could not produce a valid visualization');
    expect(el.textContent).toContain('unknown-column');
  });

  it('shows the preview with a save action once ready', async () => {
    const { el, button } = await render({
      status: 'ready',
      intent: { kind: 'kpi' },
      visualization: mockVisualization(),
      renderer: toRendererArtifact(mockVisualization().dsl, MOCK_KPI_SQL, MOCK_KPI_COLUMNS),
    });
    expect(el.querySelector('[aria-label="Visualization preview"] app-dsl-view')).not.toBeNull();
    expect(button('Save as artifact')).toBeDefined();
  });

  it('renders a chart preview with the page caption and a table view, and offers saving', async () => {
    const result = mockFullQueryPage();
    const visualization = mockChartVisualization();
    const { fixture, el, button } = await render(
      {
        status: 'ready',
        intent: { kind: 'chart', description: 'revenue per customer' },
        visualization,
        renderer: toRendererArtifact(
          visualization.dsl,
          'SELECT Name, Revenue FROM dbo.Customers',
          visualization.columns,
        ),
      },
      result,
    );
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(el.querySelector('esi-chart canvas[role="img"]')).not.toBeNull();
    });
    expect(el.textContent).toContain('Revenue per customer');
    expect(el.textContent).toContain('First 20 of 62 rows');
    // The chart's caption replaces the portal's paging caption.
    expect(el.querySelector('.live-caption')).toBeNull();
    await vi.waitFor(() => expect(drawn).toHaveLength(1));

    const toggle = button('View as table')!;
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    const table = el.querySelector('esi-chart table')!;
    expect(table.querySelectorAll('tbody tr')).toHaveLength(20);
    expect(table.textContent).toContain('Customer 1');

    expect(button('Save as artifact')).toBeDefined();
  });

  it('names the chart while it is being created', async () => {
    const { el } = await render({ status: 'pending', intent: { kind: 'chart' } });
    expect(el.textContent).toContain('Creating the chart');
  });
});
