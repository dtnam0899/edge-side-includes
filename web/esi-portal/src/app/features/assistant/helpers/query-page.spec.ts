import { mockFullQueryPage, mockQueryResult } from '../../../../testing/mocks/core-api.mocks';
import { sqlScale, toResultPage } from './query-page';

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

  it('shows exact numeric values with the scale of their SQL Server type', () => {
    const page = toResultPage(
      mockQueryResult({
        columns: [
          { name: 'Revenue', sqlType: 'decimal(38,2)', nullable: true },
          { name: 'Rate', sqlType: 'NUMERIC(9, 4)', nullable: true },
          { name: 'Units', sqlType: 'decimal(10)', nullable: true },
          { name: 'Price', sqlType: 'money', nullable: true },
          { name: 'Ratio', sqlType: 'float', nullable: true },
          { name: 'Count', sqlType: 'int', nullable: true },
          { name: 'Label', sqlType: 'nvarchar(20)', nullable: true },
        ],
        rows: [
          { Revenue: 275, Rate: 0.5, Units: 12, Price: 1.25, Ratio: 0.5, Count: 3, Label: '275' },
        ],
        page: { number: 1, size: 20, remainingRows: 0 },
      }),
    );

    const text = Object.fromEntries(
      Object.entries(page.rows[0].cells).map(([name, cell]) => [name, cell.text]),
    );
    expect(text).toEqual({
      Revenue: '275.00',
      Rate: '0.5000',
      Units: '12',
      Price: '1.2500',
      Ratio: '0.5',
      Count: '3',
      Label: '275',
    });
  });

  it('keeps NULL, string and out-of-range decimal values as they came', () => {
    const page = toResultPage(
      mockQueryResult({
        columns: [
          { name: 'A', sqlType: 'decimal(38,2)', nullable: true },
          { name: 'B', sqlType: 'decimal(38,2)', nullable: true },
          { name: 'C', sqlType: 'decimal(38,2)', nullable: true },
        ],
        rows: [{ A: null, B: '275.00', C: 1e22 }],
        page: { number: 1, size: 20, remainingRows: 0 },
      }),
    );

    expect(page.rows[0].cells['A'].text).toBe('NULL');
    expect(page.rows[0].cells['B'].text).toBe('275.00');
    expect(page.rows[0].cells['C'].text).toBe('1e+22');
  });
});

describe('sqlScale', () => {
  it.each([
    ['decimal(38,2)', 2],
    ['numeric(18, 0)', 0],
    ['DECIMAL', 0],
    ['numeric(5)', 0],
    ['money', 4],
    ['smallmoney', 4],
    ['float', undefined],
    ['real', undefined],
    ['int', undefined],
    ['nvarchar(20)', undefined],
    ['decimalish(2,1)', undefined],
  ])('%s -> %s', (sqlType, scale) => {
    expect(sqlScale(sqlType)).toBe(scale);
  });
});
