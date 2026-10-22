/** Why an artifact was rejected. Codes are shared with the `core-backend` implementation. */
export type DslErrorCode =
  /** Fails the A2UI v0.9.1 JSON Schema or the ESI envelope schema. */
  | 'schema'
  /** Two components share an id. */
  | 'duplicate-id'
  /** No component has the id `root`. */
  | 'missing-root'
  /** A component that is not in the artifact's catalog (basic, or ESI for charts). */
  | 'unknown-component'
  /** A function call that is not in the pinned catalog. */
  | 'unknown-function'
  /** A child reference to a component id that does not exist. */
  | 'missing-reference'
  /** A bound path names a column that is not in the column definitions. */
  | 'unknown-column'
  /** A bound path outside `/rows/<n>/<column>`, `/page/<field>`, or a relative column path in a `/rows` template. */
  | 'unknown-path'
  /** A `formatString` interpolation that is not a plain path. */
  | 'unsupported-expression'
  /** A literal string that contains HTML or a script URL. */
  | 'unsafe-content'
  /** The artifact carries row values. */
  | 'row-data'
  /** An `EsiChart` series column that is not numeric, or a boolean category column (ADR-0009). */
  | 'chart-column-type'
  /** `EsiChart` series: none, more than 4, a duplicate, more than one for pie, or `stacked` on a chart other than bar (ADR-0009). */
  | 'chart-series';

export interface DslValidationError {
  code: DslErrorCode;
  message: string;
  /** JSON Pointer to the offending value inside the artifact (`''` for the whole artifact). */
  path: string;
  /** Id of the component the error belongs to, when there is one. */
  componentId?: string;
}

/** Builds a JSON Pointer from segments. */
export function pointer(...segments: (string | number)[]): string {
  return segments.map((s) => '/' + String(s).replace(/~/g, '~0').replace(/\//g, '~1')).join('');
}
