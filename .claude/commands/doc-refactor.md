---
description: Restructure project documentation while preserving verified ESI and project-specific conventions
---

# Documentation Refactor

1. Read the project's `CLAUDE.md`, root README, contribution guidance, and relevant documentation before proposing changes.
2. Identify the project type, architecture, key audiences, and authoritative sources for technical facts.
3. Propose a documentation structure that fits the project; do not move or rewrite files solely to match a generic layout.
4. Keep the root README as an entry point with project purpose, verified setup and usage, major components, and links to focused guides.
5. Add or update component-level guides only where they help contributors or users. Keep API, architecture, deployment, and troubleshooting docs scoped to actual project needs.
6. Preserve ESI conventions where relevant: ticket IDs use `ESI-<number>`, and sub-project work retains its `[PROJECT]` tag.
7. Prefer concise, scannable prose and link to implementation or canonical sources rather than duplicating them. Use Mermaid when a diagram materially improves understanding.
8. Verify all commands, paths, and links against the repository. Never invent behavior, API contracts, or project policies.

Summarize the changes and list any documentation gaps that require project-owner input.
