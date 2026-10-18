import { HttpErrorResponse } from '@angular/common/http';

import { mockProblem } from '../../../testing/mocks/core-api.mocks';
import { toApiProblem } from './api-problem';

describe('toApiProblem', () => {
  it('reads an ESI problem name, detail, issues and trace id', () => {
    const error = new HttpErrorResponse({
      status: 422,
      error: mockProblem('sql-rejected', 422, {
        detail: 'Only a single read-only SELECT statement can be executed.',
        traceId: 'trace-1',
        issues: [{ code: 'not-a-select', message: 'Only a SELECT statement is allowed.' }],
      }),
    });

    const problem = toApiProblem(error);

    expect(problem.name).toBe('sql-rejected');
    expect(problem.status).toBe(422);
    expect(problem.detail).toContain('single read-only SELECT');
    expect(problem.traceId).toBe('trace-1');
    expect(problem.issues).toEqual([
      { code: 'not-a-select', message: 'Only a SELECT statement is allowed.' },
    ]);
  });

  it('uses http-<status> for a problem that is not an ESI type', () => {
    const error = new HttpErrorResponse({
      status: 503,
      error: { type: 'about:blank', title: 'Unavailable', status: 503 },
    });
    expect(toApiProblem(error).name).toBe('http-503');
  });

  it('reports an unreachable server as network-error', () => {
    expect(toApiProblem(new HttpErrorResponse({ status: 0 })).name).toBe('network-error');
  });

  it('handles a non-problem body and unknown errors without throwing', () => {
    expect(
      toApiProblem(new HttpErrorResponse({ status: 404, statusText: 'Not Found', error: 'nope' }))
        .name,
    ).toBe('http-404');
    expect(toApiProblem(new Error('boom')).name).toBe('unknown');
  });
});
