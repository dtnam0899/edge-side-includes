import type { ApiProblem } from '../../../core/api';
import { isConsentWithdrawn, needsTermsAcceptance, problemMessage } from './problem-message';

function problem(name: string, status = 422, detail?: string): ApiProblem {
  return { name, status, title: name, detail, issues: [], errors: [] };
}

describe('problemMessage', () => {
  it('includes the non-secret server detail for execution and connection failures', () => {
    expect(
      problemMessage(problem('execution-failed', 422, "Invalid column name 'Nope'.")),
    ).toContain("Invalid column name 'Nope'.");
    expect(problemMessage(problem('connection-failed', 422, 'Login failed.'))).toContain(
      'Login failed.',
    );
  });

  it('never presents a failure as an empty result', () => {
    expect(problemMessage(problem('execution-timeout', 504))).toMatch(/timed out/);
    expect(problemMessage(problem('execution-failed'))).toMatch(/No result was produced/);
  });

  it('explains that the AI agents are unavailable (503 agents-unavailable)', () => {
    expect(
      problemMessage(
        problem('agents-unavailable', 503, 'The AI agents service has no usable model right now.'),
      ),
    ).toBe(
      'The AI assistant is not available right now, so no SQL was generated. Try again later. The AI agents service has no usable model right now.',
    );
  });

  it('hides details of unexpected server errors', () => {
    expect(problemMessage(problem('http-500', 500, 'stack trace'))).not.toContain('stack trace');
  });

  it('classifies consent problems', () => {
    expect(isConsentWithdrawn(problem('consent-withdrawn', 403))).toBe(true);
    expect(needsTermsAcceptance(problem('consent-required', 403))).toBe(true);
    expect(needsTermsAcceptance(problem('terms-version-outdated', 409))).toBe(true);
    expect(needsTermsAcceptance(problem('not-found', 404))).toBe(false);
  });
});
