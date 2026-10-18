---
name: dsl-authoring
description: Change how ESI stores or validates UI DSL (A2UI v0.9 basic catalog payloads and the ESI artifact envelope) in lib/dsl-schema and lib/dsl-core. Use when a task changes artifact fields, validation rules, the pinned A2UI version or catalog, or adds a custom component.
---

# DSL authoring

The DSL is **A2UI v0.9 with its basic catalog** (ADR-0002). ESI does not define its own `table`, `chart`, `dashboard` or `form` nodes. `lib/dsl-schema` is the source of truth for the pinned A2UI schema and the ESI artifact envelope; `lib/dsl-core` holds framework-agnostic validation and migration. The renderer is `lib/dsl-renderer-angular`, which wraps `@a2ui/angular/v0_9`. Read `docs/architecture/ADR-0002-a2ui-dsl-adoption-and-storage.md` and `docs/dsl/README.md` first.

## What is stored

A stored artifact = the A2UI `updateComponents` payload (component list with a `root`) + `catalogId` + A2UI protocol version + `dslSchemaVersion` + column definitions + the bound SELECT. It never contains row values and never contains layout (layout belongs to the dashboard, in core).

## Workflow

1. Read `lib/CLAUDE.md` and `docs/dsl/README.md` for the pinned versions.
2. Change `dsl-schema` first (envelope fields, pinned catalog file). Everything is serializable JSON with documented defaults.
3. Update validation in `dsl-core` in this order: A2UI JSON Schema for the pinned version, then ESI rules (unique component ids, `root` exists, only components and functions from the pinned catalog, bound paths exist in the column definitions, no HTML or script content, no row data). Add valid and invalid fixtures.
4. Core also validates on save, with a .NET implementation of the ESI rules. The fixtures from `dsl-core` are the shared corpus; both implementations must pass them.
5. Update the renderer (see `dsl-renderer-parity`).
6. Release `dsl-schema` first (Nx release). Consumers (`lib` packages, `services/core-backend`, `services/ai-agents`) bump to the published version and regenerate models inside their own project; they never read `lib/` by path. Never edit generated files by hand.
7. Update `docs/dsl/`; a breaking change needs an ADR (`docs/architecture/`).

## Rules

- Pin `@a2ui/angular` and `@a2ui/web_core` to exact versions and import only from `@a2ui/angular/v0_9`; the package root is protocol v1.0.
- The `catalogId` is taken verbatim from the pinned catalog file and covered by a test, so an upstream mismatch fails the build.
- Use only components and functions from the basic catalog. A custom component (for example charts in phase 7) needs its own custom catalog with its own `catalogId`, and an ADR.
- Additive changes keep the version. Removing, renaming or tightening a field, or changing the pinned A2UI version, is breaking: bump `dslSchemaVersion` and add a migration function per version step in `dsl-core`. Old artifacts stay readable until migrated.
- Treat DSL from AI agents or users as untrusted: validate before rendering; no raw HTML, scripts or arbitrary URLs. Forms are out of scope for now; agents refuse them.
- Test: schema fixtures (valid/invalid), `catalogId` test, migration round-trips, missing bound column yields an error state.
