# Code Review Checklist

Review only the change and directly affected behavior. Treat these as prompts, not blanket requirements; report findings only when supported by evidence in the diff and relevant context.

## Correctness and maintainability
- [ ] Does the change preserve intended behavior and handle important errors?
- [ ] Are inputs validated at the appropriate boundary?
- [ ] Are authorization and ownership checks preserved where relevant?
- [ ] Are dependencies, types, and generated files used consistently with project rules?
- [ ] Are there concrete regressions, unnecessary complexity, or maintainability issues?

## Tests
- [ ] Is the changed behavior covered by relevant tests?
- [ ] Are important error cases and regression cases covered?
- [ ] Are there test gaps worth reporting?

Use `testing-strategy` to decide what tests to add. Do not require a fixed coverage percentage or test level for every change.

## Security and performance
- [ ] Is there concrete evidence of a security or performance problem in the change?

Do not treat this checklist as an exhaustive security audit or performance profile. Use the dedicated security-review workflow for explicit vulnerability audits and the performance optimizer for measured optimization work.
