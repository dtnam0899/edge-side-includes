---
name: dsl-authoring
description: Add or change UI DSL nodes (table, chart, dashboard, widget, form, layout, action) in lib/dsl-schema and lib/dsl-core. Use when a task adds a DSL field or node type, changes its validation, or bumps the DSL version.
---

# DSL authoring

The DSL describes UI as data. `lib/dsl-schema` is the single source of truth; `lib/dsl-core` holds framework-agnostic parsing and validation. The renderer (`lib/dsl-renderer-angular`) and the backend/AI agents consume it. If a renderer for another framework is added later, apply the `dsl-renderer-parity` skill.

## Workflow

1. Read the project `CLAUDE.md` of `lib/` and `docs/dsl/` for the current spec and version.
2. Change the schema first (`lib/dsl-schema/src/<node>/`). Every node has a `type` discriminator, is serializable JSON only (no functions or framework types), and has documented defaults.
3. Update validation and type guards in `dsl-core`; add valid and invalid fixtures.
4. Update the renderer(s) (see the `dsl-renderer-parity` skill). While only the Angular renderer exists, parity does not apply; if more renderers exist, do not merge a node supported by only one unless the schema marks it as such.
5. Release `dsl-schema` first (Nx release, new version). Consumers (renderers in `lib`, `services/core-backend`, `services/ai-agents`) then bump to that version and regenerate their models (TS, C#, Pydantic) inside their own project; they never read `lib/` by path. Never edit generated files by hand.
6. Update `docs/dsl/` and record breaking changes in an ADR (`docs/architecture/`).

## Rules

- Additive changes (new optional field, new node) keep the version. Removing, renaming or tightening a field is breaking: bump the DSL version and provide a migration in `dsl-core`.
- Treat DSL from AI agents or users as untrusted: validate before rendering; no raw HTML, scripts or arbitrary URLs in nodes. Actions reference named handlers, never code.
- Prefer composition (small nodes combined in layouts) over one large node with many flags.
- Test: schema fixtures (valid/invalid), migration round-trips, and that generated models match the schema.
