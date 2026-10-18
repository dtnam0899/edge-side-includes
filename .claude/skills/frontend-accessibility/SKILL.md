---
name: frontend-accessibility
description: Build or assess accessible web UI. Use when implementing or reviewing interaction, forms, navigation, dialogs, streaming content, keyboard support, screen-reader semantics, or accessibility tests in any frontend framework.
---

# Frontend accessibility

## Scope

Provide framework-independent accessibility requirements and verification for web UI. Angular and React skills govern framework-specific implementation patterns; `dsl-renderer-parity` adds renderer-specific checks for ESI DSL. This skill does not replace product-specific accessibility requirements or certify legal conformance.

Use the product's stated standard when present. Otherwise, use WCAG 2.2 Level AA as a design and testing target, while reporting the actual checks performed and any unverified criteria.

## Implementation checklist

- Use native semantic HTML and controls first. Ensure interactive elements have an accessible name, role, state, and value; label form fields and associate errors and help text.
- Make all functionality operable by keyboard. Preserve logical focus order, provide visible focus, avoid keyboard traps, and move/restore focus appropriately for dialogs, menus, and route changes.
- Communicate validation, status, and streaming updates to assistive technology without excessively repeating announcements; use live regions only where appropriate.
- Maintain readable contrast and do not use color alone to communicate meaning. Support zoom/reflow and respect reduced-motion preferences where motion is used.
- Provide useful alternative text for informative images; hide decorative content from assistive technology.
- Ensure custom widgets implement expected keyboard behavior and expose their current state. Prefer native controls to custom ARIA widgets.

## Verification workflow

1. Identify the critical user journeys and interactive states, including errors, loading, empty, and success states.
2. Inspect semantics and accessible names in the rendered UI; use the browser accessibility tree or equivalent tooling where available.
3. Test keyboard-only operation, focus visibility/order, dialog focus handling, and form error recovery.
4. Run automated accessibility checks as a useful filter, not proof of conformance. Pair them with manual keyboard and screen-reader checks appropriate to the changed interaction.
5. Add regression tests for accessible names, roles, states, and interaction behavior using the project's existing frontend test tools. Do not assert framework internals or rely only on snapshots.
6. Report the exact paths and states checked, tools/assistive technologies used, findings, and limitations. Do not claim full WCAG conformance from a partial or automated check.
