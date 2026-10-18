---
name: portal-ui-design
description: Design, implement, redesign, critique, audit, or polish user-facing screens in the ESI Angular management portal. Use for feature pages, dashboards, data views, forms, onboarding, empty states, and interaction flows; not for API/service architecture or standalone accessibility audits.
---

# ESI portal UI design

## Scope

Use this skill for the visual hierarchy, layout, content, and interaction design of ESI portal screens. It complements `angular-conventions` (PrimeNG and component architecture) and `frontend-accessibility` (accessibility requirements). It does not define API/data-layer architecture, change product requirements, or replace accessibility validation.

The ESI portal is a data-heavy management application. Treat portal screens as **Operate** surfaces: prioritize task completion, scanability, consistency, clear feedback, and the actual usage context. Do not import prescriptive marketing-page rules, visual bans, image quotas, motion requirements, or scripts/assets from other design skills when they conflict with the product, PrimeNG, or ESI accessibility requirements.

## Choose the design operation

Match the user's request rather than running every step for every task:

- **Shape** — clarify the user task, page hierarchy, interaction states, and a concise visual direction before implementation. Use when the user asks to plan or design a new screen.
- **Critique** — evaluate the existing UI's hierarchy, clarity, density, consistency, and user flow; report prioritized, evidence-based findings without changing it unless asked.
- **Audit** — check technical UX concerns such as keyboard interaction, responsive behavior, loading/error/empty states, and visible failures. Use `frontend-accessibility` for a focused accessibility audit.
- **Polish / distill / bolder / quieter** — refine within the existing visual identity. A polish or distill request preserves product behavior, factual copy, and established design language; bolder/quieter requests adjust emphasis without inventing a new product direction.
- **Redesign** — preserve product truth, requirements, content, and user capabilities, but treat the incumbent visual treatment as evidence rather than a constraint. Ask before materially changing established identity, factual content, or behavior.
- **Harden / onboard** — improve edge states, validation/recovery, first-run guidance, and empty states without inventing product rules.
- **Extract / document** — identify reusable portal tokens/components or document the implemented design system; do not introduce new shared abstractions without evidence they are reused.
- **Live variants** — when requested, explore alternatives for a named element using browser tooling if available. Keep alternatives within ESI's product and PrimeNG constraints; do not silently replace the selected design with speculative variants.

## Workflow

1. **Load product truth.** Read the relevant requirement, route/feature `CLAUDE.md`, nearby screens, current theme/tokens/components, and pinned PrimeNG version. Identify the user role, primary task, data, actions, permissions, and loading/empty/error/success states. If ESI has not recorded a product/design brief, derive only verifiable facts from these sources; do not block a narrow refinement on a missing design document.
2. **Inspect the incumbent.** For a refinement, examine the current implementation and rendered UI first. For a new screen, inspect neighboring features and shared patterns. Distinguish deliberate visual language from accidental inconsistency; do not infer that missing documentation means there is no established design.
3. **Set a direction proportional to the task.** State the user goal, information hierarchy, and one visual/layout choice grounded in the real workflow. For routine management surfaces, express craft through precise hierarchy, density, grouping, and feedback rather than novelty. Reuse the portal visual system. Ask before choices that materially change established identity or usability.
4. **Design the whole task.** Include primary and secondary actions, useful content, permissions, validation, confirmations for consequential actions, and recovery from empty/error states. Make data units, time ranges, filters, sorting, and paging understandable where applicable. Prefer appropriate PrimeNG components and supported theming APIs.
5. **Implement through the established architecture.** Follow `angular-conventions`: presentational components remain dumb, feature components orchestrate, data processing stays in feature services, and endpoint calls stay in that feature's `apis/` layer. This skill guides design outcomes, not data-flow architecture.
6. **Verify in the browser.** Run the portal using documented project commands. Use available browser tooling to inspect the rendered screen at relevant desktop and narrow/mobile widths; capture screenshots when possible. Check actual content, visual hierarchy, density, alignment, clipping/overflow, responsive behavior, and relevant interaction states. A successful build or a screenshot of only the initial viewport is not sufficient visual verification.
7. **Iterate in batches.** Group the most important observed issues, fix the highest-impact ones, and inspect again. Prioritize task clarity, readable information, layout coherence, responsive behavior, and consistency over decorative novelty. Do not screenshot after every minor edit.
8. **Report accurately.** Summarize the design operation, key decisions, browser widths/states inspected, iteration results, and anything not verified. Never claim browser or responsive validation that was not performed.

## Design guardrails

- Keep PrimeNG and ESI tokens as the source of visual primitives. Avoid raw overrides of internal PrimeNG selectors when a supported component input, pass-through API, or theme token exists.
- Give tables, charts, and dashboards a clear purpose: surface decision-relevant information, label units and time ranges, and make filtering/sorting/paging states understandable.
- Use realistic, complete content for the interface being designed. Avoid filler copy, unexplained metrics, fake controls, and placeholder charts presented as functional.
- Keep motion optional, brief, and useful for state or continuity; respect `prefers-reduced-motion`. Do not add animation merely to make a screen feel designed.
- Apply `frontend-accessibility` to keyboard use, semantics, focus, contrast, forms, and announcements. PrimeNG components still require verification in the composed screen.
- For DSL-rendered UI, follow `dsl-authoring` and `dsl-renderer-parity`; do not bypass schema/catalog constraints to achieve a visual design.

## Source inspiration

This workflow is an ESI-specific adaptation of high-level design-process ideas from [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (MIT License) and [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0): ground decisions in product truth, select an operation appropriate to the request, and inspect/iterate on the rendered UI. Their frameworks, command implementations, scripts, assets, rulesets, and substantial text are not copied. The Taste Skill targets marketing pages; Impeccable covers multiple surface modes. ESI uses the Operate mode for management screens and retains PrimeNG, ESI product requirements, and accessibility as the governing constraints.
