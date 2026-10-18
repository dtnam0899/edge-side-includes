import { TestBed } from '@angular/core/testing';

import {
  MOCK_KPI_COLUMNS,
  MOCK_KPI_SQL,
  mockDslDocument,
  mockKpiResult,
  mockProblem,
  mockQueryResult,
} from '../../../../../testing/mocks/core-api.mocks';
import { toApiProblem } from '../../../../core/api';
import { HttpErrorResponse } from '@angular/common/http';
import { toRendererArtifact, toSurfaceData } from '../../helpers/dsl-adapter';
import type { LiveData } from '../../services/live-data';
import { DslView } from './dsl-view';

const KPI = toRendererArtifact(mockDslDocument(), MOCK_KPI_SQL, MOCK_KPI_COLUMNS);

async function render(live: LiveData | null, renderer = KPI) {
  const fixture = TestBed.createComponent(DslView);
  fixture.componentRef.setInput('renderer', renderer);
  fixture.componentRef.setInput('live', live);
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('DslView', () => {
  it('renders the DSL with live rows through esi-dsl-surface', async () => {
    const result = mockKpiResult();
    const el = await render({ status: 'ready', result, data: toSurfaceData(result) });
    expect(el.querySelector('esi-dsl-surface')).not.toBeNull();
    expect(el.textContent).toContain('Total revenue');
    expect(el.textContent).toContain('156.5');
    expect(el.querySelector('.live-caption')?.textContent).toContain('rows 1–1 of 1');
  });

  it('shows the renderer error, not data, when a bound column is missing', async () => {
    const result = mockQueryResult({
      columns: [{ name: 'Other', sqlType: 'int', nullable: false }],
      rows: [{ Other: 1 }],
    });
    const el = await render({ status: 'ready', result, data: toSurfaceData(result) });
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Revenue');
    expect(el.querySelector('.live-caption')).toBeNull();
  });

  it('shows a failed execution as a failure, never an empty surface', async () => {
    const problem = toApiProblem(
      new HttpErrorResponse({ status: 409, error: mockProblem('artifact-unavailable', 409) }),
    );
    const el = await render({ status: 'failure', problem });
    expect(el.querySelector('esi-dsl-surface')).toBeNull();
    expect(el.textContent).toContain('its connection was deleted or its consent withdrawn');
  });

  it('does not render a DSL version this portal cannot handle', async () => {
    const result = mockKpiResult();
    const el = await render(
      { status: 'ready', result, data: toSurfaceData(result) },
      toRendererArtifact(
        mockDslDocument({ dslSchemaVersion: '9.0.0' }),
        MOCK_KPI_SQL,
        MOCK_KPI_COLUMNS,
      ),
    );
    expect(el.querySelector('esi-dsl-surface')).toBeNull();
    expect(el.textContent).toContain('DSL version 9.0.0');
  });
});
