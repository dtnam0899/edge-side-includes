import {
  A2UI_PINS,
  type A2uiComponent,
  type CellValue,
  type ColumnDefinition,
  type DslArtifact,
  type PageInfo,
  type Row,
} from '@dtnam0899/dsl-schema';
import type { DslValidationError } from './errors';
import { validateArtifact } from './validator';

/** The live data a surface is rendered with. */
export interface SurfaceData {
  /** Columns of the current query result. */
  columns: readonly (ColumnDefinition | string)[];
  /** Rows of the current page. */
  rows: readonly Record<string, unknown>[];
  page: PageInfo;
}

export type A2uiServerMessage =
  | { version: 'v0.9'; createSurface: { surfaceId: string; catalogId: string } }
  | { version: 'v0.9'; updateComponents: { surfaceId: string; components: A2uiComponent[] } }
  | { version: 'v0.9'; updateDataModel: { surfaceId: string; path: string; value: { rows: Row[]; page: PageInfo } } }
  | { version: 'v0.9'; deleteSurface: { surfaceId: string } };

/** What a renderer should show for an artifact and its live data. */
export type SurfacePlan =
  /** The artifact failed validation; show the errors, never the artifact. */
  | { status: 'invalid'; errors: DslValidationError[] }
  /** The artifact binds columns the live result no longer has; show an error, not empty data. */
  | { status: 'missing-columns'; missingColumns: string[] }
  | { status: 'ready'; artifact: DslArtifact; messages: A2uiServerMessage[] };

/**
 * Validates an untrusted artifact against the live result and, when it can be rendered, builds the
 * A2UI message sequence for one surface: `createSurface` (stored `catalogId`), `updateComponents`
 * (stored components), `updateDataModel` (rows at `/rows`, paging at `/page`).
 */
export function planSurface(input: unknown, data: SurfaceData, surfaceId: string): SurfacePlan {
  const validation = validateArtifact(input);
  if (!validation.valid) return { status: 'invalid', errors: validation.errors };
  const missingColumns = findMissingColumns(validation.boundColumns, data.columns);
  if (missingColumns.length > 0) return { status: 'missing-columns', missingColumns };
  return { status: 'ready', artifact: validation.artifact, messages: buildSurfaceMessages(validation.artifact, data, surfaceId) };
}

/** Bound columns that the live result does not have. */
export function findMissingColumns(boundColumns: readonly string[], resultColumns: SurfaceData['columns']): string[] {
  const available = new Set(resultColumns.map((column) => (typeof column === 'string' ? column : column.name)));
  return boundColumns.filter((column) => !available.has(column));
}

/** Builds the message sequence for a validated artifact. The stored artifact is not modified. */
export function buildSurfaceMessages(artifact: DslArtifact, data: SurfaceData, surfaceId: string): A2uiServerMessage[] {
  const version = A2UI_PINS.protocolVersion;
  return [
    { version, createSurface: { surfaceId, catalogId: artifact.catalogId } },
    { version, updateComponents: { surfaceId, components: structuredClone(artifact.components) } },
    { version, updateDataModel: { surfaceId, path: '/', value: toDataModel(artifact, data) } },
  ];
}

/** The `deleteSurface` message that releases a surface. */
export function deleteSurfaceMessage(surfaceId: string): A2uiServerMessage {
  return { version: A2UI_PINS.protocolVersion, deleteSurface: { surfaceId } };
}

/**
 * The data model of a surface. Rows keep only the artifact's columns, and every cell is a plain
 * value: objects (which could look like bindings) and other non-primitive values become text.
 */
export function toDataModel(artifact: DslArtifact, data: SurfaceData): { rows: Row[]; page: PageInfo } {
  const columns = artifact.columns.map((column) => column.name);
  const rows = data.rows.map((source) => {
    const row: Row = {};
    for (const column of columns) row[column] = toCell(source[column]);
    return row;
  });
  const { page, pageSize, totalRows, remaining } = data.page;
  return { rows, page: { page, pageSize, totalRows, remaining } };
}

function toCell(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value) ?? String(value);
}
