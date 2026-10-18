---
name: unit-test-expand
description: Add and run focused tests for uncovered behavior, defects, and edge cases
---

# Expand Tests

Add or improve tests for the requested behavior using the project's existing test framework and conventions.

1. Read the project `CLAUDE.md`, relevant implementation, and nearby tests. Use `testing-strategy` to choose appropriate test levels and identify meaningful gaps.
2. Inspect an existing coverage report only when available and useful; do not add tooling solely to produce one or chase a universal coverage target.
3. Write tests using the project's existing framework:
   - Jest/Vitest/Mocha (JavaScript/TypeScript)
   - pytest/unittest (Python)
   - Go testing/testify (Go)
   - Rust test framework (Rust)
4. Prioritize behavior-based scenarios:
   - Error handling and exceptions
   - Boundary values (min/max, empty, null)
   - Relevant edge cases and regression cases
   - State transitions and side effects
5. Run the narrowest relevant tests, then any required checks documented by the project. Report commands and results accurately; never claim unrun checks passed.

Do not return code blocks instead of making requested repository changes. Do not impose a fixed coverage percentage or claim that more coverage necessarily means better tests. Follow existing patterns and name tests for the behavior they verify.

---
**Last Updated**: August 4, 2026
**Claude Code Version**: 2.1.220
**Sources**:
- https://code.claude.com/docs/en/commands
**Compatible Models**: Claude Fable 5, Claude Opus 5, Claude Sonnet 5, Claude Sonnet 4.6, Claude Opus 4.8, Claude Haiku 4.5
