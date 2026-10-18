import { mockFullQueryPage, mockQueryResult } from '../../../../testing/mocks/core-api.mocks';
import { toResultPage } from './query-page';

describe('toResultPage', () => {
  it('numbers the rows of a later page and counts what remains', () => {
    const page = toResultPage(mockFullQueryPage(2, 5));

    expect(page.rows).toHaveLength(20);
    expect(page.firstRow).toBe(21);
    expect(page.lastRow).toBe(40);
    expect(page.remainingRows).toBe(5);
    expect(page.knownTotalRows).toBe(45);
  });

  it('marks NULL and truncated cells and keeps values as text', () => {
    const page = toResultPage(
      mockQueryResult({
        rows: [{ Name: '<b>Contoso</b>', Revenue: null }],
        truncatedCells: [{ rowIndex: 0, column: 'Name' }],
        page: { number: 1, size: 20, remainingRows: 0 },
      }),
    );

    expect(page.rows[0].cells['Name']).toEqual({
      text: '<b>Contoso</b>',
      isNull: false,
      truncated: true,
    });
    expect(page.rows[0].cells['Revenue']).toEqual({ text: 'NULL', isNull: true, truncated: false });
    expect(page.truncatedCount).toBe(1);
  });

  it('describes an empty successful page without inventing rows', () => {
    const page = toResultPage(
      mockQueryResult({ rows: [], page: { number: 1, size: 20, remainingRows: 0 } }),
    );
    expect(page.firstRow).toBe(0);
    expect(page.lastRow).toBe(0);
    expect(page.knownTotalRows).toBe(0);
  });
});
