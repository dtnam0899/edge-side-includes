import type { SurfaceData } from '@dtnam0899/dsl-core';
import {
  DSL_SCHEMA_VERSION,
  type ColumnDefinition as DslColumn,
  type ColumnType,
  type DslArtifact,
} from '@dtnam0899/dsl-schema';

import type { ColumnDefinition, DslDocument, QueryResult } from '../../../core/api';

/**
 * core-api carries a `DslDocument` whose `dslSchemaVersion` is the `@dtnam0899/dsl-schema` package version
 * that validated it; the renderer validates the stored artifact format (`DSL_SCHEMA_VERSION`). This maps the
 * package versions this portal can render to their artifact format.
 */
const ARTIFACT_FORMAT_BY_PACKAGE_VERSION: Readonly<Record<string, typeof DSL_SCHEMA_VERSION>> = {
  '0.1.0': DSL_SCHEMA_VERSION,
};

export type RendererArtifact =
  | { readonly status: 'ready'; readonly artifact: DslArtifact }
  /** Written for a DSL version this portal cannot render; never pass it to the renderer. */
  | { readonly status: 'migration-required'; readonly dslSchemaVersion: string };

const NUMBER_TYPES =
  /^(tinyint|smallint|int|bigint|decimal|numeric|money|smallmoney|float|real)\b/i;
const DATETIME_TYPES = /^(datetime|datetime2|smalldatetime|datetimeoffset)\b/i;

/** SQL Server type name (with length/precision) to the DSL column type. */
export function toColumnType(sqlType: string): ColumnType {
  const type = sqlType.trim();
  if (NUMBER_TYPES.test(type)) return 'number';
  if (/^bit\b/i.test(type)) return 'boolean';
  if (/^date$/i.test(type)) return 'date';
  if (DATETIME_TYPES.test(type)) return 'datetime';
  return 'string';
}

export function toDslColumns(columns: readonly ColumnDefinition[]): DslColumn[] {
  return columns.map((column) => ({ name: column.name, type: toColumnType(column.sqlType) }));
}

/**
 * Builds the renderer's artifact from what core returns (a visualization or a saved artifact): the DSL
 * document, the SELECT it is bound to and the columns it expects. The renderer validates the result again.
 */
export function toRendererArtifact(
  dsl: DslDocument,
  sql: string,
  columns: readonly ColumnDefinition[],
): RendererArtifact {
  const format = ARTIFACT_FORMAT_BY_PACKAGE_VERSION[dsl.dslSchemaVersion];
  if (format === undefined) {
    return { status: 'migration-required', dslSchemaVersion: dsl.dslSchemaVersion };
  }
  return {
    status: 'ready',
    artifact: {
      dslSchemaVersion: format,
      protocolVersion: dsl.protocolVersion as DslArtifact['protocolVersion'],
      catalogId: dsl.catalogId,
      columns: toDslColumns(columns),
      query: { sql },
      components: dsl.components as DslArtifact['components'],
    },
  };
}

/** Maps one page of core's `QueryResult` to the renderer's data model (`/rows`, `/page`). */
export function toSurfaceData(result: QueryResult): SurfaceData {
  const { number, size, remainingRows } = result.page;
  return {
    columns: toDslColumns(result.columns),
    rows: result.rows,
    page: {
      page: number,
      pageSize: size,
      totalRows: (number - 1) * size + result.rows.length + remainingRows,
      remaining: remainingRows,
    },
  };
}
