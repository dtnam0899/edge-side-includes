---
name: code-review-specialist
description: Review a code change or pull request for correctness, maintainability, and test gaps. Use when asked to review code or assess a diff; use the focused security-review workflow for an explicit vulnerability audit.
---

# Code Review Skill

## Scope

- Review the changed code and its directly affected behavior. Report actionable findings with impact, severity, evidence, and location.
- This skill reviews; it does not implement fixes, create a general test plan, or perform a dedicated security audit.
- For test strategy or test-case design, use `testing-strategy`. For an explicit security audit, use the repository's security-review workflow/agent. For measured performance optimization, use the performance optimizer.
- Use `esi-project-standards` for project-independence, Docker, and versioning compliance, and `esi-workflow` for branch/commit/PR conventions; those policy checks are not this skill's primary review scope.
- Mention security or performance concerns only when they are evidenced in the reviewed change; do not claim an exhaustive audit.

## Review focus

- Correctness, regressions, error handling, and compatibility.
- Maintainability and type safety where they materially affect the change.
- Whether the changed behavior has appropriate tests; use `testing-strategy` for deciding which tests to add.
- Security and performance only where the diff provides concrete evidence. Avoid speculative findings and arbitrary function-length limits.

## Reference Files

This skill includes supporting files that you should read when performing reviews:

- **`templates/review-checklist.md`** — Structured checklist covering security, performance, quality, and testing. Read this file and use it as a guide to ensure no category is missed during review.
- **`templates/finding-template.md`** — Standard template for documenting individual findings with severity, location, code examples, and impact analysis. Read this file and use its format when reporting issues.
- **`scripts/analyze-metrics.py`** — Optional metrics aid when quantitative context helps a specific finding; metrics alone are not review findings.
- **`scripts/compare-complexity.py`** — Optional comparison aid when reviewing a refactoring change; use it only when the comparison is relevant.

## Review Template

For each change reviewed, provide:

### Summary
- Key findings count
- Review limitations, if any

### Findings (highest severity first)
- **Issue**: Clear description
- **Location**: File and line number
- **Impact**: Why this matters
- **Severity**: Critical/High/Medium/Low
- **Recommendation**: Minimal direction to resolve

Do not prescribe a code example unless it clarifies the finding. If there are no actionable findings, say so and note any review limitations.

## Version History

- v1.0.0 (2024-12-10): Initial release with security, performance, quality, and maintainability analysis

---

**Last Updated**: August 4, 2026
**Claude Code Version**: 2.1.220
**Sources**:
- https://code.claude.com/docs/en/skills
**Compatible Models**: Claude Fable 5, Claude Opus 5, Claude Sonnet 5, Claude Sonnet 4.6, Claude Opus 4.8, Claude Haiku 4.5
