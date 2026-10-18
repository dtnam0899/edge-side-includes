import type { ColumnDefinition, QueryResult } from '../../../core/api';

export interface ResultCell {
  readonly text: string;
  readonly isNull: boolean;
  readonly truncated: boolean;
}

export interface ResultRow {
  readonly index: number;
  readonly cells: Readonly<Record<string, ResultCell>>;
}

/** One page of a query result, ready for display. */
export interface ResultPage {
  readonly columns: readonly ColumnDefinition[];
  readonly rows: readonly ResultRow[];
  readonly pageNumber: number;
  readonly pageSize: number;
  /** 1-based number of the first row on this page (0 when the page is empty). */
  readonly firstRow: number;
  /** 1-based number of the last row on this page (0 when the page is empty). */
  readonly lastRow: number;
  readonly remainingRows: number;
  /** Rows up to the end of the result as known now (live data may shift between pages). */
  readonly knownTotalRows: number;
  readonly truncatedCount: number;
  readonly durationMs: number;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/** Maps a `QueryResult` page to display rows; values are always text, never markup. */
export function toResultPage(result: QueryResult): ResultPage {
  const truncated = new Set(
    result.truncatedCells.map((cell) => `${cell.rowIndex}\u0000${cell.column}`),
  );
  const { number, size, remainingRows } = result.page;
  const offset = (number - 1) * size;
  const rows = result.rows.map((row, index) => {
    const cells: Record<string, ResultCell> = {};
    for (const column of result.columns) {
      const value = row[column.name];
      cells[column.name] = {
        text: cellText(value),
        isNull: value === null || value === undefined,
        truncated: truncated.has(`${index}\u0000${column.name}`),
      };
    }
    return { index, cells };
  });
  return {
    columns: result.columns,
    rows,
    pageNumber: number,
    pageSize: size,
    firstRow: rows.length ? offset + 1 : 0,
    lastRow: offset + rows.length,
    remainingRows,
    knownTotalRows: offset + rows.length + remainingRows,
    truncatedCount: truncated.size,
    durationMs: result.durationMs,
  };
}
