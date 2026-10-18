import type { ColumnDefinition, PageInfo, Row } from '../lib/artifact';
import kpi from './valid/kpi.json';
import table from './valid/table.json';
import duplicateId from './invalid/duplicate-id.json';
import htmlContent from './invalid/html-content.json';
import missingReference from './invalid/missing-reference.json';
import missingRoot from './invalid/missing-root.json';
import relativePathOutsideTemplate from './invalid/relative-path-outside-template.json';
import rowData from './invalid/row-data.json';
import schemaProperty from './invalid/schema-property.json';
import scriptUrl from './invalid/script-url.json';
import templatePath from './invalid/template-path.json';
import unknownColumnAbsolute from './invalid/unknown-column-absolute.json';
import unknownColumn from './invalid/unknown-column.json';
import unknownComponent from './invalid/unknown-component.json';
import unknownFunction from './invalid/unknown-function.json';
import unknownPath from './invalid/unknown-path.json';
import unsupportedVersion from './invalid/unsupported-version.json';
import wrongCatalogId from './invalid/wrong-catalog-id.json';
import missingColumn from './render/missing-column.json';
import untrustedRowValues from './render/untrusted-row-values.json';

/**
 * Shared DSL fixtures (the test corpus for `dsl-core`, the renderers and `core-backend`).
 * The JSON files are published with the package under `src/fixtures/`.
 */

/** A live query result: the data a surface is rendered with. */
export interface FixtureResult {
  columns: ColumnDefinition[];
  rows: Row[];
  page: PageInfo;
}

/** An artifact that must pass validation, with a sample result to render it with. */
export interface ValidFixture {
  description: string;
  artifact: unknown;
  result: FixtureResult;
}

/** An artifact that must fail validation with at least these error codes. */
export interface InvalidFixture {
  description: string;
  artifact: unknown;
  expectedErrors: string[];
}

/** A valid artifact rendered with a result that needs special handling. */
export interface RenderFixture extends ValidFixture {
  /** Bound columns absent from the result; the renderer must show an error state. */
  expectedMissingColumns?: string[];
}

// JSON imports widen literal types (e.g. column types to string); the dsl-core tests check every fixture.
const as = <T>(json: unknown): T => json as T;

export const VALID_FIXTURES: Record<string, ValidFixture> = {
  table: as<ValidFixture>(table),
  kpi: as<ValidFixture>(kpi),
};

export const INVALID_FIXTURES: Record<string, InvalidFixture> = {
  'duplicate-id': duplicateId,
  'html-content': htmlContent,
  'missing-reference': missingReference,
  'missing-root': missingRoot,
  'relative-path-outside-template': relativePathOutsideTemplate,
  'row-data': rowData,
  'schema-property': schemaProperty,
  'script-url': scriptUrl,
  'template-path': templatePath,
  'unknown-column-absolute': unknownColumnAbsolute,
  'unknown-column': unknownColumn,
  'unknown-component': unknownComponent,
  'unknown-function': unknownFunction,
  'unknown-path': unknownPath,
  'unsupported-version': unsupportedVersion,
  'wrong-catalog-id': wrongCatalogId,
};

export const RENDER_FIXTURES: Record<string, RenderFixture> = {
  'missing-column': as<RenderFixture>(missingColumn),
  'untrusted-row-values': as<RenderFixture>(untrustedRowValues),
};
