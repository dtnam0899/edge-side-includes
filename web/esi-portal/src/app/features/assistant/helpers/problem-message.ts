import type { ApiProblem } from '../../../core/api';

/** User-facing explanation of a problem. Server `detail` is shown only for problem types the contract defines as non-secret. */
export function problemMessage(problem: ApiProblem): string {
  switch (problem.name) {
    case 'consent-required':
      return 'Accept the current consent terms before using this connection.';
    case 'consent-withdrawn':
      return 'Consent for this database was withdrawn. Grant consent again to use it.';
    case 'terms-version-outdated':
      return 'The consent terms changed while you were reading them. Review the new version and accept again.';
    case 'connection-failed':
      return withDetail('The database connection failed.', problem.detail);
    case 'sql-rejected':
      return 'The statement was not run: only a single read-only SELECT can be executed.';
    case 'execution-failed':
      return withDetail('SQL Server returned an error. No result was produced.', problem.detail);
    case 'execution-timeout':
      return 'The query timed out before it returned a result.';
    case 'invalid-result-columns':
      return withDetail('The query result has empty or duplicate column names.', problem.detail);
    case 'agents-unavailable':
      return withDetail(
        'The AI assistant is not available right now, so no SQL was generated. Try again later.',
        problem.detail,
      );
    case 'visualization-not-supported':
      return 'Charts and forms are not supported yet. Ask for a table or a KPI instead.';
    case 'dsl-validation-failed':
      return 'The assistant could not produce a valid visualization. Try again, or describe the table or KPI differently.';
    case 'artifact-unavailable':
      return 'This saved visualization cannot run: its connection was deleted or its consent withdrawn.';
    case 'not-found':
      return 'This item no longer exists or is not yours.';
    case 'network-error':
      return 'The ESI server could not be reached. Check your network and try again.';
    case 'http-404':
      return 'This feature is not available on the server yet.';
    default:
      return problem.status >= 500
        ? 'The server could not complete the request. Try again later.'
        : withDetail(problem.title, problem.detail);
  }
}

function withDetail(message: string, detail: string | undefined): string {
  return detail ? `${message} ${detail}` : message;
}

/** True when a problem means the connection's consent is gone (the connection must be shown as locked). */
export function isConsentWithdrawn(problem: ApiProblem): boolean {
  return problem.name === 'consent-withdrawn';
}

/** True when the user must (re-)accept the consent terms. */
export function needsTermsAcceptance(problem: ApiProblem): boolean {
  return problem.name === 'consent-required' || problem.name === 'terms-version-outdated';
}
