---
name: dsl-renderer-parity
description: Keep DSL rendering correct and consistent. Only lib/dsl-renderer-angular exists (a wrapper over @a2ui/angular/v0_9), so use this skill for the renderer checklist, and for parity if a second renderer is added.
---

# DSL renderer parity

Every renderer must produce the same behavior for the same DSL document. Only `lib/dsl-renderer-angular` exists now; it wraps `@a2ui/angular/v0_9` (ADR-0002) and builds the message sequence from a stored artifact: `createSurface` (stored `catalogId`), `updateComponents` (stored payload), `updateDataModel` (rows at `/rows`, paging at `/page`). The parity items below apply once another renderer is added.

## Checklist for each component

- [ ] Handles every field and default of the pinned A2UI basic catalog component; unknown optional fields are ignored, an unknown component renders a visible fallback, not a crash.
- [ ] Tables are `List` with a template over bound rows; KPIs are `Card` plus `Text` with `formatNumber` (see `docs/dsl/README.md`). A bound path that is not in the column definitions shows an error state.
- [ ] Same semantics in all renderers: paging (20 rows, remaining count), validation messages, empty/loading/error states, action dispatch and events.
- [ ] Styling comes from `lib/ui-tokens`; no per-renderer hard-coded colors or spacing.
- [ ] Accessible: roles, labels, keyboard navigation, focus handling.
- [ ] Input is validated through `dsl-core` before rendering; no `innerHTML`/`dangerouslySetInnerHTML` from DSL values.
- [ ] Shared fixtures from `dsl-schema` are rendered in each renderer's tests; assertions are on behavior (DOM roles/text/events), not framework internals.
- [ ] Behavior difference that cannot be avoided is documented in `docs/dsl/` and noted in the PR.

## Rules

- Logic that does not depend on the framework (formatting, filtering, expression evaluation, migration) belongs in `dsl-core`, not duplicated in renderers.
- Angular: standalone components, signals/OnPush; follow the `angular-conventions` skill. For another framework, follow its conventions skill.
- With more than one renderer, run all renderer test suites before a PR; a green single renderer is not enough.
