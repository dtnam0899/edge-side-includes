---
name: setup-ci-cd
description: Implement pre-commit hooks and GitHub Actions for quality assurance
---

# Setup CI/CD Pipeline

Set up or update CI and local quality gates for the selected project. Read its `CLAUDE.md` and existing workflows/configuration first; preserve working conventions and avoid duplicating existing checks.

1. **Analyze project**: Detect language(s), framework, build system, and existing tooling
2. **Configure local checks only when needed** with existing language-specific tools:
   - Formatting: Prettier/Black/gofmt/rustfmt/etc.
   - Linting: ESLint/Ruff/golangci-lint/Clippy/etc.
   - Security: Bandit/gosec/cargo-audit/npm audit/etc.
   - Type checking: TypeScript/mypy/flow (if applicable)
   - Tests: Run relevant test suites
3. **Update CI workflows** to verify the project's install/build/lint/typecheck/test commands on relevant pull requests. Add a matrix only when supported versions or platforms require it.
4. **Verify the workflow** with the repository's available local validation and report any checks that require a hosted CI run.

For ESI multi-project repositories, follow `esi-project-standards`: keep build/test scopes and Docker contexts inside the individual project, use path filters so unrelated projects do not need to be checked out, and do not introduce a repository-wide workspace or build tool. `lib/` may use its existing Nx workspace only. Deployment infrastructure should wire already-built images; do not add deployment or publishing steps without explicit project requirements and authorization.

Use existing tools and configuration where practical; keep CI focused and avoid adding dependencies or duplicate gates without a demonstrated need.

---
**Last Updated**: August 4, 2026
**Claude Code Version**: 2.1.220
**Sources**:
- https://code.claude.com/docs/en/commands
**Compatible Models**: Claude Fable 5, Claude Opus 5, Claude Sonnet 5, Claude Sonnet 4.6, Claude Opus 4.8, Claude Haiku 4.5
