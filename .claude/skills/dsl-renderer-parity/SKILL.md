---
name: dsl-renderer-parity
description: Keep the Angular and React DSL renderers consistent. Use when implementing or reviewing a DSL node renderer in lib/dsl-renderer-angular or lib/dsl-renderer-react, or when a DSL change must work in both apps.
---

# DSL renderer parity

Both renderers must produce the same behavior for the same DSL document.

## Checklist for each node

- [ ] Handles every field and default in `lib/dsl-schema` for the node; unknown optional fields are ignored, unknown `type` renders a visible fallback, not a crash.
- [ ] Same semantics in both: sorting, pagination, validation messages, empty/loading/error states, action dispatch and events.
- [ ] Styling comes from `lib/ui-tokens`; no per-renderer hard-coded colors or spacing.
- [ ] Accessible: roles, labels, keyboard navigation, focus handling.
- [ ] Input is validated through `dsl-core` before rendering; no `innerHTML`/`dangerouslySetInnerHTML` from DSL values.
- [ ] Shared fixtures from `dsl-schema` are rendered in both renderers' tests; assertions are on behavior (DOM roles/text/events), not framework internals.
- [ ] Behavior difference that cannot be avoided is documented in `docs/dsl/` and noted in the PR.

## Rules

- Logic that does not depend on the framework (formatting, filtering, expression evaluation, migration) belongs in `dsl-core`, not duplicated in renderers.
- Angular: standalone components, signals/OnPush. React: function components and hooks. Follow the matching conventions skill.
- Run both renderer test suites before a PR; a green single renderer is not enough.
