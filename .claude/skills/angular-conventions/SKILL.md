---
name: angular-conventions
description: Angular implementation conventions for ESI web code. Use when creating or editing components, services, routes, or Angular tests; use frontend-accessibility for accessibility requirements and validation.
---

# Angular conventions

Commands, Angular/PrimeNG versions, and project-specific authentication and generated-code rules live in the project's `CLAUDE.md`.

## UI and component responsibilities

- Use PrimeNG as the portal's default component library. Prefer its accessible, themed controls over introducing a second UI library or hand-building a control that PrimeNG already provides. Follow the project's theme, design tokens, and pinned PrimeNG version; do not guess APIs from another release.
- Use standalone components and `ChangeDetectionStrategy.OnPush`. Use signals for local synchronous UI state and RxJS for asynchronous streams; clean up subscriptions with `takeUntilDestroyed` or the `async` pipe.
- Follow the dumb/presentational component pattern for reusable UI: components receive typed data and callbacks/state through `input()` and emit user intent through `output()`. They render PrimeNG/project UI and handle presentation only; they do not call APIs, own business rules, or transform domain data.
- Container/feature components connect routes and user interactions to feature services, expose view state to presentational components, and delegate data processing. Keep them focused on orchestration rather than business logic.
- Templates contain simple presentation logic only; prefer `@if`/`@for` with `track`. Keep strict TypeScript and avoid `any`.

## Feature isolation and data flow

- Organize the app into `core`, `shared`, and `features`. Each feature is a cohesive, independently understandable unit with its own routes, components, APIs, services, models/types, constants, and tests as needed. Lazy-load feature routes where appropriate.
- Put HTTP endpoint calls in that feature's `apis/` folder. An API class is the feature's HTTP boundary: use the project's configured/generated client, define endpoint calls, and map transport-level details only. Components must never call `HttpClient` or endpoint APIs directly.
- Put feature data access coordination, state, business rules, and domain/view-model transformations in feature services. Services call that feature's API layer and expose typed results/state to feature components.
- Extract cohesive pure transformations into feature-local `helpers/` or `utils/` when that keeps services focused and reasonably sized. Helpers must not become a second service layer or perform hidden HTTP/I/O.
- Keep shared infrastructure (for example auth, interceptors, and genuinely cross-feature UI) in `core` or `shared`. Do not reach into another feature's internals; promote a deliberately reusable contract to `shared` rather than importing across feature boundaries.
- Do not hard-code endpoint URLs in components or duplicate endpoint calls across layers. Use the project's Identity Server integration; never implement custom token handling.

## Verification

- Follow `testing-strategy` to select tests. Cover feature service data transformations and behavior, API boundary behavior where useful, and component presentation/interaction. Mock HTTP at the API boundary, not the unit under test's own logic.
- Run the commands documented by the project `CLAUDE.md`; do not assume a test runner or command.
- Follow `frontend-accessibility` for accessibility requirements and verification. PrimeNG usage does not by itself guarantee that the composed UI is accessible.
- Do not hand-edit generated code listed in the project `CLAUDE.md`.
