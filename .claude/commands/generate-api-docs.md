---
description: Create comprehensive API documentation from source code
---

# API Documentation Generator

Generate API documentation by:

Arguments: `$ARGUMENTS` = `[source-dir] [output-file]`. Defaults: find the API directory from the project's `CLAUDE.md` or code structure (ask if unclear); output `docs/api.md`.

1. Scanning all files in the API source directory
2. Extracting function signatures and JSDoc comments
3. Organizing by endpoint/module
4. Creating markdown with examples
5. Including request/response schemas
6. Adding error documentation

Output format:
- Markdown file at the output path (default `docs/api.md`)
- Include curl examples for all endpoints
- Add types in the project's language
- Document only what the code does; never invent endpoints or fields

---
**Last Updated**: August 4, 2026
**Claude Code Version**: 2.1.220
**Sources**:
- https://code.claude.com/docs/en/commands
**Compatible Models**: Claude Fable 5, Claude Opus 5, Claude Sonnet 5, Claude Sonnet 4.6, Claude Opus 4.8, Claude Haiku 4.5
