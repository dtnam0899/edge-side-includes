import { HttpErrorResponse } from '@angular/common/http';

import type { FieldError, Problem, ValidationIssue } from './generated';

const ESI_PROBLEM_PREFIX = 'urn:esi:problem:';

/** A failed API call, read from RFC 9457 problem details when the server sent them. */
export interface ApiProblem {
  /** `<name>` of `urn:esi:problem:<name>`; `network-error` when the server was unreachable; `http-<status>` otherwise. */
  readonly name: string;
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly traceId?: string;
  readonly issues: readonly ValidationIssue[];
  readonly errors: readonly FieldError[];
}

function isProblem(value: unknown): value is Problem {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate['type'] === 'string' && typeof candidate['title'] === 'string';
}

/** Converts any error from `CoreApi` (or elsewhere) into an `ApiProblem`; never throws. */
export function toApiProblem(error: unknown): ApiProblem {
  if (error instanceof HttpErrorResponse) {
    if (isProblem(error.error)) {
      const problem = error.error;
      return {
        name: problem.type.startsWith(ESI_PROBLEM_PREFIX)
          ? problem.type.slice(ESI_PROBLEM_PREFIX.length)
          : `http-${problem.status ?? error.status}`,
        status: problem.status ?? error.status,
        title: problem.title,
        detail: problem.detail,
        traceId: problem.traceId,
        issues: problem.issues ?? [],
        errors: problem.errors ?? [],
      };
    }
    if (error.status === 0) {
      return {
        name: 'network-error',
        status: 0,
        title: 'The server could not be reached.',
        issues: [],
        errors: [],
      };
    }
    return {
      name: `http-${error.status}`,
      status: error.status,
      title: error.statusText || 'Request failed.',
      issues: [],
      errors: [],
    };
  }
  return { name: 'unknown', status: 0, title: 'Something went wrong.', issues: [], errors: [] };
}
