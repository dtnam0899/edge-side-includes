import { buildChartModel, fallbackMessage } from './chart-model';

const page = (totalRows: number, pageNumber = 1) => ({
  page: pageNumber,
  pageSize: 20,
  totalRows,
  remaining: Math.max(0, totalRows - pageNumber * 20),
});

describe('buildChartModel', () => {
  const bar = { chartType: 'bar' as const, title: 'Revenue', categoryKey: 'region', series: [{ valueKey: 'revenue', label: 'Revenue' }] };
  const rows = [
    { region: 'North', revenue: 1234.5 },
    { region: 'South', revenue: 987 },
  ];

  it('builds categories, series values, the table and the text alternative', () => {
    const model = buildChartModel(bar, rows, page(2), 'en-US');
    expect(model.categories).toEqual(['North', 'South']);
    expect(model.series).toEqual([{ label: 'Revenue', values: [1234.5, 987] }]);
    expect(model.table).toEqual({ headers: ['region', 'Revenue'], rows: [['North', '1,234.5'], ['South', '987']] });
    expect(model.summary).toBe('Revenue. Bar chart of 2 values by region. Revenue: from 987 to 1,234.5.');
  });

  it.each([
    [page(3), 3, 'All 3 rows'],
    [page(45), 20, 'First 20 of 45 rows'],
    [page(45, 2), 20, 'Rows 21–40 of 45'],
    [page(1), 1, 'All 1 row'],
    [undefined, 2, '2 rows'],
  ])('captions the rows it shows (%o)', (pageInfo, count, caption) => {
    const many = Array.from({ length: count }, (_, index) => ({ region: `R${index}`, revenue: index }));
    expect(buildChartModel(bar, many, pageInfo, 'en-US').caption).toBe(caption);
  });

  it('turns nulls and non-numbers into gaps and empty cells, and keeps category text as text', () => {
    const model = buildChartModel(
      bar,
      [
        { region: '<b>North</b>', revenue: null },
        { region: null, revenue: 'n/a' },
        { region: 7, revenue: Number.NaN },
      ],
      undefined,
      'en-US',
    );
    expect(model.categories).toEqual(['<b>North</b>', '', '7']);
    expect(model.series[0].values).toEqual([null, null, null]);
    expect(model.table.rows.map((row) => row[1])).toEqual(['', '', '']);
    expect(model.summary).toContain('Revenue: no values.');
  });

  it('uses the column name when a series has no label, and stacks only bar charts', () => {
    const line = { ...bar, chartType: 'line' as const, series: [{ valueKey: 'revenue' }], stacked: true };
    const model = buildChartModel(line, rows, undefined, 'en-US');
    expect(model.series[0].label).toBe('revenue');
    expect(model.stacked).toBe(false);
    expect(buildChartModel({ ...bar, stacked: true }, rows, undefined).stacked).toBe(true);
  });

  it('falls back to the table for a pie with more than 8 slices or a negative value', () => {
    const pie = { ...bar, chartType: 'pie' as const };
    const nine = Array.from({ length: 9 }, (_, index) => ({ region: `R${index}`, revenue: index + 1 }));
    expect(buildChartModel(pie, nine.slice(0, 8), undefined).fallback).toBeUndefined();
    expect(buildChartModel(pie, nine, undefined).fallback).toBe('too-many-slices');
    expect(buildChartModel(pie, [...rows, { region: 'West', revenue: -1 }], undefined).fallback).toBe('negative-values');
    expect(buildChartModel(bar, [...rows, { region: 'West', revenue: -1 }], undefined).fallback).toBeUndefined();
    expect(fallbackMessage('too-many-slices', 9)).toContain('9 rows');
  });
});
