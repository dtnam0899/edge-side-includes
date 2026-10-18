# Changelog

All notable changes are generated from Conventional Commits by the release flow. Do not edit released sections by hand.

## Unreleased

- Scaffold: Angular 21.2 app shell (`core/`, `shared/`, `features/`), lazy-loaded `assistant` module exposing only its routes, runtime `/config.json` loaded before bootstrap, PrimeNG 21 with the Aura preset, ESLint with a local `esi/feature-boundaries` rule and a test proving it, Vitest unit tests, multi-stage Dockerfile serving the build from nginx-unprivileged, compose file.
