import { TestBed } from '@angular/core/testing';

import { mockFullQueryPage, mockGeneratedSql } from '../../../../../testing/mocks/core-api.mocks';
import { toResultPage } from '../../helpers/query-page';
import type { ExecutionState } from '../../services/chat.service';
import { GeneratedSqlView } from './generated-sql';

async function render(sql = mockGeneratedSql(), execution?: ExecutionState) {
  const fixture = TestBed.createComponent(GeneratedSqlView);
  fixture.componentRef.setInput('sql', sql);
  fixture.componentRef.setInput('execution', execution);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const buttons = () => [...el.querySelectorAll('button')].map((b) => b.textContent?.trim());
  return { fixture, el, tag: () => el.querySelector('p-tag')?.textContent?.trim(), buttons };
}

describe('GeneratedSqlView', () => {
  it('shows generated SQL as text labelled "Not run" with an explicit Run action', async () => {
    const { el, tag, buttons } = await render();
    expect(el.querySelector('pre')?.textContent).toContain('SELECT c.Name');
    expect(tag()).toBe('Not run');
    expect(buttons()).toEqual(['Copy SQL', 'Run query']);
  });

  it('says "Ran" only after an execution succeeded', async () => {
    expect((await render(mockGeneratedSql(), { status: 'running', pageNumber: 1 })).tag()).toBe(
      'Running…',
    );
    expect(
      (
        await render(mockGeneratedSql(), {
          status: 'failure',
          pageNumber: 1,
          problem: { name: 'execution-failed', status: 422, title: 'x', issues: [], errors: [] },
        })
      ).tag(),
    ).toBe('Run failed');
    expect(
      (
        await render(mockGeneratedSql(), {
          status: 'success',
          result: toResultPage(mockFullQueryPage()),
          raw: mockFullQueryPage(),
        })
      ).tag(),
    ).toBe('Ran, page 1');
  });

  it('emits run only when the user clicks Run', async () => {
    const { fixture, el } = await render();
    let runs = 0;
    fixture.componentInstance.run.subscribe(() => runs++);
    expect(runs).toBe(0);
    [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Run query')?.click();
    expect(runs).toBe(1);
  });

  it('offers no Run action for a stored-procedure script', async () => {
    const { el, tag, buttons } = await render(
      mockGeneratedSql({ kind: 'stored-procedure', sql: 'CREATE PROCEDURE dbo.p AS SELECT 1' }),
    );
    expect(buttons()).toEqual(['Copy SQL']);
    expect(tag()).toBe('Script only, never run');
    expect(el.textContent).toContain('never creates or runs stored procedures');
  });
});
