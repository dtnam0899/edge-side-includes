import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import {
  MOCK_KPI_COLUMNS,
  MOCK_KPI_SQL,
  mockKpiResult,
  mockProblem,
  mockVisualization,
} from '../../../../../testing/mocks/core-api.mocks';
import { toApiProblem, type VisualizationIntent } from '../../../../core/api';
import { toRendererArtifact } from '../../helpers/dsl-adapter';
import type { VisualizationState } from '../../services/chat.service';
import { VisualizationPanel } from './visualization-panel';

async function render(state?: VisualizationState) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(VisualizationPanel);
  fixture.componentRef.setInput('key', 'm1');
  fixture.componentRef.setInput('result', mockKpiResult());
  fixture.componentRef.setInput('state', state);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  return { fixture, el, button };
}

describe('VisualizationPanel', () => {
  it('asks for a table or KPI with the optional wording', async () => {
    const { fixture, el, button } = await render();
    const asked: VisualizationIntent[] = [];
    fixture.componentInstance.visualize.subscribe((intent) => asked.push(intent));
    const input = el.querySelector('input')!;
    input.value = 'total revenue';
    input.dispatchEvent(new Event('input'));
    button('KPI')!.click();
    button('Table')!.click();
    expect(asked).toEqual([
      { kind: 'kpi', description: 'total revenue' },
      { kind: 'table', description: 'total revenue' },
    ]);
  });

  it('explains a refused chart and still offers a table or KPI', async () => {
    const problem = toApiProblem(
      new HttpErrorResponse({
        status: 422,
        error: mockProblem('visualization-not-supported', 422),
      }),
    );
    const { el, button } = await render({
      status: 'failure',
      intent: { kind: 'table', description: 'pie chart' },
      problem,
    });
    expect(el.textContent).toContain(
      'Charts and forms are not supported yet. Ask for a table or a KPI instead.',
    );
    expect(button('Table')?.disabled).toBe(false);
    expect(button('KPI')?.disabled).toBe(false);
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
});
