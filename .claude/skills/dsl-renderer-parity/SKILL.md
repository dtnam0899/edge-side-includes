---
name: dsl-renderer-parity
description: Keep DSL renderers consistent. Today only lib/dsl-renderer-angular exists, so use this skill for the renderer checklist, and for parity when a second renderer (for example React) is added.
---

# DSL renderer parity

Every renderer must produce the same behavior for the same DSL document. Only `lib/dsl-renderer-angular` exists now; the parity items below apply once another renderer is added.

## Checklist for each node

- [ ] Handles every field and default in `lib/dsl-schema` for the node; unknown optional fields are ignored, unknown `type` renders a visible fallback, not a crash.
- [ ] Same semantics in both: sorting, pagination, validation messages, empty/loading/error states, action dispatch and events.
- [ ] Styling comes from `lib/ui-tokens`; no per-renderer hard-coded colors or spacing.
- [ ] Accessible: roles, labels, keyboard navigation, focus handling.
- [ ] Input is validated through `dsl-core` before rendering; no `innerHTML`/`dangerouslySetInnerHTML` from DSL values.
- [ ] Shared fixtures from `dsl-schema` are rendered in each renderer's tests; assertions are on behavior (DOM roles/text/events), not framework internals.
- [ ] Behavior difference that cannot be avoided is documented in `docs/dsl/` and noted in the PR.

## Rules

- Logic that does not depend on the framework (formatting, filtering, expression evaluation, migration) belongs in `dsl-core`, not duplicated in renderers.
- Angular: standalone components, signals/OnPush; follow the `angular-conventions` skill. For another framework, follow its conventions skill.
- With more than one renderer, run all renderer test suites before a PR; a green single renderer is not enough.
