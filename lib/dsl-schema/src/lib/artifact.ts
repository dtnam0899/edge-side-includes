import { DSL_SCHEMA_VERSION } from './versions';

/** Column types an artifact may declare. */
export type ColumnType = 'string' | 'number' | 'boolean' | 'date' | 'datetime';

/** One column of the query result the artifact is bound to. */
export interface ColumnDefinition {
  name: string;
  type: ColumnType;
}

/** A data binding: a JSON Pointer into the surface data model (absolute) or the current row (relative). */
export interface DataBinding {
  path: string;
}

/** An A2UI v0.9 function call, for example `formatNumber`. */
export interface FunctionCall {
  call: string;
  args?: Record<string, unknown>;
  returnType?: string;
}

/** An A2UI v0.9 component from the basic catalog. Properties are checked by the catalog schema. */
export interface A2uiComponent {
  id: string;
  component: string;
  [property: string]: unknown;
}

/**
 * A stored ESI DSL artifact (ADR-0002): the A2UI `updateComponents` component list plus the
 * metadata needed to render it again. It never contains row values or layout.
 */
export interface DslArtifact {
  dslSchemaVersion: typeof DSL_SCHEMA_VERSION;
  protocolVersion: 'v0.9';
  catalogId: string;
  /** Columns the components are bound to. */
  columns: ColumnDefinition[];
  /** The SELECT the artifact is bound to. */
  query: { sql: string };
  /** The `updateComponents.components` payload; one component has the id `root`. */
  components: A2uiComponent[];
}

/** A cell value as it is placed in the data model. */
export type CellValue = string | number | boolean | null;

/** One result row, keyed by column name. */
export type Row = Record<string, CellValue>;

/** Paging information placed at `/page` in the data model. */
export interface PageInfo {
  /** 1-based page number. */
  page: number;
  pageSize: number;
  totalRows: number;
  /** Rows after the current page. */
  remaining: number;
}

/** Fields of {@link PageInfo}, the only valid paths under `/page`. */
export const PAGE_FIELDS: readonly (keyof PageInfo)[] = ['page', 'pageSize', 'totalRows', 'remaining'];

/** Data model locations used by every ESI surface. */
export const DATA_MODEL_PATHS = {
  rows: '/rows',
  page: '/page',
} as const;

/** Id of the component every surface renders first. */
export const ROOT_COMPONENT_ID = 'root';
