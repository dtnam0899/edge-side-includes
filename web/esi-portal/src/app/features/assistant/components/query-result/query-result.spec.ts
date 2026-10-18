import { TestBed } from '@angular/core/testing';

import { mockFullQueryPage, mockQueryResult } from '../../../../../testing/mocks/core-api.mocks';
import { toResultPage } from '../../helpers/query-page';
import { QueryResultView } from './query-result';

async function render(result = toResultPage(mockFullQueryPage(2, 5))) {
  const fixture = TestBed.createComponent(QueryResultView);
  fixture.componentRef.setInput('result', result);
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('QueryResultView', () => {
  it('shows a page of 20 rows with the row range and the remaining count', async () => {
    const { el } = await render();
    expect(el.querySelectorAll('tbody tr')).toHaveLength(20);
    expect(el.querySelector('.summary')?.textContent?.replace(/\s+/g, ' ')).toContain(
      'Rows 21–40. 5 more rows after this page.',
    );
    expect(
      [...el.querySelectorAll('th[scope="col"] .col-name')].map((th) => th.textContent),
    ).toEqual(['Name', 'Revenue']);
  });

  it('marks NULL and truncated cells in text', async () => {
    const { el } = await render(
      toResultPage(
        mockQueryResult({
          rows: [{ Name: 'Contoso Ltd', Revenue: null }],
          truncatedCells: [{ rowIndex: 0, column: 'Name' }],
          page: { number: 1, size: 20, remainingRows: 0 },
        }),
      ),
    );
    expect(el.querySelector('.null')?.textContent).toBe('NULL');
    expect(el.querySelector('.truncated')?.textContent).toBe('truncated');
    expect(el.textContent).toContain('1 cell was cut at 64 KB');
    expect(el.textContent).toContain('No more rows.');
  });

  it('shows a decimal cell with the scale of its column type', async () => {
    const { el } = await render(
      toResultPage(
        mockQueryResult({
          columns: [{ name: 'Revenue', sqlType: 'decimal(38,2)', nullable: true }],
          rows: [{ Revenue: 275 }],
          page: { number: 1, size: 20, remainingRows: 0 },
        }),
      ),
    );
    expect(el.querySelector('td .value')?.textContent).toBe('275.00');
  });

  it('requests another page from the paginator', async () => {
    const { fixture, el } = await render();
    const pages: number[] = [];
    fixture.componentInstance.pageChange.subscribe((page) => pages.push(page));
    [...el.querySelectorAll<HTMLButtonElement>('p-paginator button')]
      .find((b) => b.textContent?.trim() === '3')
      ?.click();
    expect(pages).toEqual([3]);
  });

  it('says an empty successful page ran and returned no rows', async () => {
    const { el } = await render(
      toResultPage(mockQueryResult({ rows: [], page: { number: 1, size: 20, remainingRows: 0 } })),
    );
    expect(el.textContent).toContain('The query ran and returned no rows');
  });
});
