---
id: ADR-0002
type: adr
status: Proposed
date: 2026-10-18
projects: [lib, agents, core, portal]
issues: [ESI-14, ESI-17, ESI-18, ESI-20]
keywords: [a2ui, dsl, catalog, catalogId, updateComponents, createSurface, updateDataModel, artifact storage, renderer, angular]
---

# ADR-0002 A2UI adoption and DSL storage model

## Context
- Product decisions 5, 18, 19, 24, 25, 27-29 in [UR-1](../requirements/UR-1-bi-ai-assistant-web-application.md): DSL is the core, reuse A2UI first, the DSL carries only column keys (no data), pin A2UI v0.9.1 with its basic catalog, render with `@a2ui/angular` wrapped by `lib/dsl-renderer-angular`.
- A2UI v0.9.1 basic catalog (verified in the UR-1 findings): 18 components, no Table, Chart or dashboard-layout component. Tables use `List` with a template over bound rows; KPIs use `Card` plus `Text` with `formatNumber`.
- A2UI is stream-based (`createSurface`, `updateComponents`, `updateDataModel`), while ESI stores artifacts and dashboards as documents.
- The v0.9.1 `catalog.json` `catalogId` (`.../v0_9/...`) differs from the v0.9.1 spec examples (`.../v0_9_1/...`).
- `lib/dsl-schema` is the source of truth for the DSL schema, and `lib` packages are consumed only as published versions.

## Options
1. **Store the full A2UI message stream.** Simple replay; but bakes transient data-model messages and surface IDs into storage.
2. **Store only the component definitions plus metadata and rebuild the messages at render time.** Smaller, data-free, easier to migrate.
3. **Define a custom ESI DSL and convert to A2UI.** Maximum control; contradicts "A2UI first" and doubles the schema surface.

## Decision (proposed)
Take option 2.

- A stored DSL artifact is the A2UI `updateComponents` payload (component list with a `root`), plus: `catalogId`, A2UI protocol version, the column definitions it expects, and the SELECT it is bound to. It never contains row values.
- At render time `lib/dsl-renderer-angular` builds the sequence `createSurface` (with the stored `catalogId`), `updateComponents` (stored payload), `updateDataModel` (rows at `/rows`, paging at `/page`). One surface per dashboard item.
- Data binding uses relative paths in a `List` template; bound paths must reference columns present in the column definitions.
- `lib/dsl-core` validates, in this order: A2UI JSON Schema for the pinned version, then ESI rules (unique component ids, `root` exists, only components and functions from the pinned catalog, bound paths exist in the column definitions, no HTML or script content, no row data).
- The `catalogId` string is taken verbatim from the pinned catalog file and covered by a test, so an upstream mismatch fails the build.
- Pin the protocol/renderer pair (`v0.9.1` / `@a2ui/angular` exact version) in one file inside `lib` and record the pair in every stored artifact (`dslSchemaVersion`).
- Stored artifacts are migrated by `dsl-core` when the pinned version changes (migration function per version step); old artifacts remain readable until migrated.
- Custom components are allowed only when the basic catalog cannot express the need (charts, phase 7) and live in a custom catalog with its own `catalogId`.
- Layout (position/size) is not part of the DSL; it is stored with the dashboard (core), see SR-8.

## Consequences
- The `dsl-authoring` and `dsl-renderer-parity` skills assumed custom `table/chart/dashboard/form` nodes and must be updated when this ADR is accepted.
- Core stores DSL as opaque, versioned JSON plus metadata and validates through a published `dsl-core` version or treats it as opaque (TBD, see open questions).
- Agents must emit only components from the pinned catalog; validation errors drive at most 2 retries (ESI-18).

## Verification
- Fixture tests for table and KPI in `dsl-core` and the Angular renderer; test of exact `catalogId`; test that a missing bound column yields an error state.
- Eval in agents: output validates against `dsl-core`; forms and charts are refused.

## Open questions
- Does `core-backend` validate DSL itself (needs a .NET implementation of the rules) or only stores it as validated by the producer (agents + lib)? SR-9 says AI output is untrusted, which favors validation at the boundary where it is saved.
- Upgrade policy for A2UI patch and minor releases.
