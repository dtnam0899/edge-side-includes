---
name: testing-strategy
description: Plan and assess tests for a software change. Use when defining acceptance tests, choosing unit/integration/contract/end-to-end coverage, assessing test gaps, or preventing flaky tests across any stack.
---

# Testing strategy

## Scope

Choose what behavior to test, at which level, and what evidence is sufficient. This skill provides cross-stack strategy; stack skills and each project's `CLAUDE.md` provide framework-specific conventions and commands. It does not perform code review, dictate a universal coverage percentage, or replace a specialist agent that writes and runs tests.

## Workflow

1. Read the requirement, changed behavior, project `CLAUDE.md`, and existing nearby tests. Identify user-visible behavior, important boundaries, failure modes, and risk.
2. Map each acceptance criterion to one or more observable assertions. Prefer the lowest-cost test level that gives reliable evidence.
3. Choose levels deliberately:
   - **Unit:** deterministic domain logic, parsers, transformations, validation, and error mapping.
   - **Integration:** persistence, framework wiring, service boundaries, queues, and external adapters with realistic dependencies.
   - **Contract:** API/schema compatibility, generated clients, and shared fixtures between independent implementations.
   - **End-to-end:** a small number of critical user journeys whose correctness depends on several components.
   - **Evaluation:** non-deterministic AI behavior, using fixed regression cases and explicit quality/safety criteria alongside deterministic tests for tools and validation.
4. Cover success, invalid input, boundary conditions, authorization/ownership where relevant, and important downstream failures. Include an explicit regression test for the reported defect.
5. Keep tests deterministic: control time, randomness, external I/O, and model calls; avoid sleeps and brittle implementation-detail assertions. Do not mock the behavior or boundary the test is intended to verify.
6. Run the narrowest relevant tests, then the project's documented required checks. Report commands, results, skipped checks, and remaining risk; never state that unrun tests passed.

## Cross-project considerations

- For API changes, follow `api-contract-change` for compatibility and consumer verification; contract tests are part of that workflow.
- For schema or data migrations, follow `database-change` and test both migration behavior and supported rollout states.
- For accessible UI behavior, follow `frontend-accessibility`; assert semantics and keyboard/focus behavior where automated tests support it.
- For ESI DSL, use the same valid/invalid fixtures across TypeScript and .NET validators, then verify renderer behavior. See `dsl-authoring` and `dsl-renderer-parity`.
- For AI agents, unit-test tools and parsing without a live model where possible, and keep model-dependent evals separate and reproducible.

## Guidance

- Set coverage goals based on risk and critical behavior; do not impose a repository-independent percentage.
- A passing test suite is evidence only for the behavior it exercises. Call out uncovered acceptance criteria and environmental limitations.
- When asked to implement tests, follow the project's existing test style and tools; do not add a new test framework without need.
