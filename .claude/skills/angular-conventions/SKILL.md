---
name: angular-conventions
description: Angular implementation conventions for ESI web code. Use when creating or editing components, services, routes, or Angular tests; use frontend-accessibility for accessibility requirements and validation.
---

# Angular conventions

Commands and versions live in the project `CLAUDE.md`; general rules in `clean-code-rules.md` (claude-howto).

- Standalone components, `ChangeDetectionStrategy.OnPush`, signals for local state; RxJS for async streams, always cleaned up (`takeUntilDestroyed` or the `async` pipe).
- Structure `src/app/{core,shared,features}`: `core` for singletons (auth, interceptors), `shared` for reusable presentational components, one folder per feature with lazy-loaded routes.
- Container components fetch data; presentational components take `input()`/`output()` only.
- API access only through services (generated clients where the project has them); no hard-coded endpoint URLs in components. Auth goes through the project's Identity Server integration, never custom token handling.
- Strict TypeScript, no `any`. Templates hold no logic beyond simple conditions; use `@if`/`@for` with `track`.
- Tests: follow `testing-strategy` for test selection; cover services and component behavior, run headless (`npm test -- --watch=false --browsers=ChromeHeadless`); mock HTTP, not the unit under test.
- Accessibility: follow `frontend-accessibility` for requirements and verification; this skill covers Angular implementation patterns, not a separate accessibility standard.
- Do not hand-edit generated code listed in the project `CLAUDE.md`.
