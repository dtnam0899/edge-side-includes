import { validateArtifact } from '@dtnam0899/dsl-core';
import { VALID_FIXTURES } from '@dtnam0899/dsl-schema/fixtures';

import type { ColumnDefinition, DslDocument } from '../../../core/api';
import {
  MOCK_KPI_COLUMNS,
  MOCK_KPI_SQL,
  mockDslDocument,
  mockFullQueryPage,
} from '../../../../testing/mocks/core-api.mocks';
import { toColumnType, toRendererArtifact, toSurfaceData } from './dsl-adapter';

const SQL_TYPES: Record<string, string> = {
  number: 'decimal(18,2)',
  boolean: 'bit',
  date: 'date',
  datetime: 'datetime2(7)',
  string: 'nvarchar(100)',
};

/** A shared dsl-schema fixture in the shape core returns it. */
function asCore(
  name: string,
  dslSchemaVersion = '0.2.0',
): { dsl: DslDocument; sql: string; columns: ColumnDefinition[] } {
  const artifact = VALID_FIXTURES[name].artifact as {
    catalogId: string;
    components: Record<string, unknown>[];
    query: { sql: string };
    columns: { name: string; type: string }[];
  };
  return {
    dsl: {
      catalogId: artifact.catalogId,
      protocolVersion: 'v0.9',
      dslSchemaVersion,
      components: artifact.components,
    },
    sql: artifact.query.sql,
    columns: artifact.columns.map((c) => ({
      name: c.name,
      sqlType: SQL_TYPES[c.type],
      nullable: true,
    })),
  };
}

describe('dsl adapter', () => {
  it('maps SQL Server types to DSL column types', () => {
    expect(['int', 'decimal(18,2)', 'money', 'float'].map(toColumnType)).toEqual([
      'number',
      'number',
      'number',
      'number',
    ]);
    expect(toColumnType('bit')).toBe('boolean');
    expect(toColumnType('date')).toBe('date');
    expect(['datetime2(7)', 'datetimeoffset(7)', 'smalldatetime'].map(toColumnType)).toEqual([
      'datetime',
      'datetime',
      'datetime',
    ]);
    expect(
      ['nvarchar(200)', 'uniqueidentifier', 'time(7)', 'varbinary(max)'].map(toColumnType),
    ).toEqual(['string', 'string', 'string', 'string']);
  });

  it.each(['table', 'kpi', 'chart-bar', 'chart-line', 'chart-pie'])(
    'turns the shared %s fixture, as core returns it, into an artifact dsl-core accepts',
    (name) => {
      const { dsl, sql, columns } = asCore(name);
      const renderer = toRendererArtifact(dsl, sql, columns);
      expect(renderer.status).toBe('ready');
      expect(renderer.status === 'ready' && validateArtifact(renderer.artifact).errors).toEqual([]);
      expect(renderer.status === 'ready' && renderer.artifact.columns).toEqual(
        (VALID_FIXTURES[name].artifact as { columns: unknown }).columns,
      );
    },
  );

  it('still renders tables and KPIs saved with dsl-schema 0.1.0', () => {
    const { dsl, sql, columns } = asCore('table', '0.1.0');
    expect(toRendererArtifact(dsl, sql, columns).status).toBe('ready');
  });

  it('reports a DSL version this portal cannot render instead of passing it on', () => {
    expect(
      toRendererArtifact(
        mockDslDocument({ dslSchemaVersion: '9.0.0' }),
        MOCK_KPI_SQL,
        MOCK_KPI_COLUMNS,
      ),
    ).toEqual({
      status: 'migration-required',
      dslSchemaVersion: '9.0.0',
    });
  });

  it('maps a result page to the renderer data model', () => {
    const data = toSurfaceData(mockFullQueryPage(2, 5));
    expect(data.page).toEqual({ page: 2, pageSize: 20, totalRows: 45, remaining: 5 });
    expect(data.rows).toHaveLength(20);
    expect(data.columns).toEqual([
      { name: 'Name', type: 'string' },
      { name: 'Revenue', type: 'number' },
    ]);
  });
});
