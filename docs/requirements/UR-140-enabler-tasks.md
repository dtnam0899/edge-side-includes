---
id: UR-140-enablers
type: issue-drafts
status: Filed
updated: 2026-10-24
projects: [esi, idp, grants, edge]
issues: [ESI-140]
keywords: [UR-140, enabler, scaffold, adr acceptance, oracle, infra, keycloak, role-grant, edge-gateway]
---

# UR-140 enabler tasks (E1..E5)

Enablers for [UR-140](./UR-140-keycloak-idp-sso.md): ADR acceptance, new project scaffolds and the Oracle wiring. Filed with label `Foundation Task` by:

```bash
scripts/file-issues.sh --file docs/requirements/UR-140-enabler-tasks.md --parent 140 --label "Foundation Task"          # dry run
scripts/file-issues.sh --file docs/requirements/UR-140-enabler-tasks.md --parent 140 --label "Foundation Task" --apply
```

| ID | Project | Title | Priority | Size | Depends on | Issue |
|----|---------|-------|----------|------|------------|-------|
| E1 | esi | Review and accept ADR-0011..ADR-0013, register new project codes | P0 | S | - | ESI-141 |
| E2 | idp | Scaffold services/idp: Keycloak image, compose, CI | P0 | M | E1 | ESI-142 |
| E3 | grants | Scaffold services/role-grant: .NET service, compose, CI | P0 | M | E1 | ESI-143 |
| E4 | edge | Scaffold services/edge-gateway: Cloudflare Worker, tests, CI | P0 | M | E1 | ESI-144 |
| E5 | esi | Wire the IdP stack on the Oracle Always Free VM | P0 | M | E2, E3 | ESI-145 |

Release order: E1, then E2/E3/E4 in parallel, then E5. Everything below the first task heading is filed as issue bodies.

## E1 | esi | Review and accept ADR-0011..ADR-0013, register new project codes
Covers UR-140 Decisions 1-7. Depends on: none. ADRs: ADR-0011, ADR-0012, ADR-0013.

## Scope
- Tech lead reviews and accepts (or amends) ADR-0011 (Keycloak, shared realm + Organizations), ADR-0012 (Oracle VM, Cloudflare Worker), ADR-0013 (Role Grant Service) by changing their status in a PR.
- Mark ADR-0006 `Superseded by ADR-0011`; update the ADR index.
- Root `CLAUDE.md`: add `services/idp` (`idp`), `services/role-grant` (`grants`), `services/edge-gateway` (`edge`) to the project table and the project codes.
- UR-140 Open question 1 (public hostname) is resolved by Decision 10: free DuckDNS hostname with Caddy.

## Out of scope
- Any code or infra change.

## Acceptance criteria
- [ ] ADR-0011..ADR-0013 are `Accepted` (or rewritten and accepted) in a merged PR.
- [ ] ADR-0006 is marked superseded; the ADR index matches.
- [ ] Root `CLAUDE.md` lists the three new projects and codes.
- [ ] The gate is recorded as a comment on ESI-140.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## E2 | idp | Scaffold services/idp: Keycloak image, compose, CI
Covers SR-1, SR-13 (OPS-01, OPS-02, OPS-08). Depends on: E1. ADRs: ADR-0011, ADR-0012.

## Scope
- `services/idp/` with its own `CLAUDE.md`, `CHANGELOG.md`, version file, `.dockerignore`.
- Multi-stage `Dockerfile`: Maven stage that builds the provider JAR (empty event-listener SPI module, filled in D16) -> Keycloak build stage (`kc.sh build` with Postgres, health and metrics on) -> runtime image on a pinned Keycloak version, non-root, `HEALTHCHECK`. Builds for amd64 and arm64.
- `compose.yaml`: Keycloak + pinned PostgreSQL for local development; documented admin bootstrap through environment variables only.
- Realm-as-code skeleton (tool chosen here: `keycloak-config-cli` or Keycloak import), applied by a compose service or job.
- CI workflow `idp.yml` (path filter `services/idp/**`): build image, run the realm smoke test; release `idp@vX.Y.Z` pushes `ghcr.io/dtnam0899/esi-idp`.

## Out of scope
- Realm content (D1), themes (D21), SPI logic (D16).

## Acceptance criteria
- [ ] `docker compose up` in `services/idp` gives a working Keycloak on Postgres; `/health/ready` on the management port answers.
- [ ] The image builds from the project directory only, pinned base images, non-root, both architectures.
- [ ] CI builds and smoke-tests on PRs touching `services/idp/**` and needs no other project.
- [ ] Keycloak version pinned and recorded (resolves UR-140 Open question 3, including any Organizations feature flag).

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## E3 | grants | Scaffold services/role-grant: .NET service, compose, CI
Covers SR-4, SR-13. Depends on: E1. ADRs: ADR-0013, ADR-0001.

## Scope
- `services/role-grant/` .NET minimal API following `dotnet-conventions`: solution, `Directory.Build.props` version, central package management, unit and integration test projects, `CLAUDE.md`, `CHANGELOG.md`.
- EF Core on PostgreSQL, schema `grants`, migrations bundle (`migrator` Docker target, as core).
- Configuration only by `ESI_GRANTS_*` environment variables; `/health` and `/health/ready`.
- JWT bearer authentication against Keycloak (authority, audience) with a startup check like core's `Oidc` mode.
- `Dockerfile` (sdk -> aspnet, non-root, amd64 and arm64), `compose.yaml` (Postgres, plus Keycloak from the published `esi-idp` image when available).
- CI workflow `grants.yml` with path filter; release `grants@vX.Y.Z` pushes `ghcr.io/dtnam0899/esi-role-grant`.

## Out of scope
- Business endpoints (D8, D11..D17).

## Acceptance criteria
- [ ] Builds, tests and runs from its own directory and in Docker; no reference to `services/core-backend`.
- [ ] No token -> 401 on every endpoint except health; a valid Keycloak test token is accepted.
- [ ] Migrations bundle runs against an empty database.
- [ ] CI runs only on `services/role-grant/**` changes.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## E4 | edge | Scaffold services/edge-gateway: Cloudflare Worker, tests, CI
Covers SR-3. Depends on: E1. ADRs: ADR-0012.

## Scope
- `services/edge-gateway/` TypeScript Worker with pinned `wrangler`, `package-lock.json`, `vitest` with the Workers runtime pool, ESLint, `CLAUDE.md`, `CHANGELOG.md`, version in `package.json`.
- A pass-through handler that forwards to an origin URL from settings (`ESI_EDGE_ORIGIN_URL`).
- `Dockerfile` with a `check` stage (install, lint, test, `wrangler deploy --dry-run`) so CI runs the documented commands in a container.
- CI workflow `edge.yml` with path filter; on `edge@vX.Y.Z` deploy with `wrangler deploy` using `CLOUDFLARE_API_TOKEN` from GitHub environment secrets.

## Out of scope
- Token verification (D2), revocation (D13).

## Acceptance criteria
- [ ] `npm test` and the Docker `check` stage pass from the project directory.
- [ ] A local `wrangler dev` request is forwarded to the configured origin unchanged.
- [ ] No secret in `wrangler.toml` or the repo; the deploy uses environment secrets.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.

## E5 | esi | Wire the IdP stack on the Oracle Always Free VM
Covers SR-13 (NFR-04, NFR-05, NFR-13, OPS-02, OPS-05, OPS-10). Depends on: E2, E3. ADRs: ADR-0012 (hostname: UR-140 Decision 10).

## Scope
- `infra/oracle/README.md`: create the Always Free A1 VM within the current entitlement, Docker install, firewall (only TLS open), how to check the monthly OCPU and memory hours.
- `infra/oracle/compose.yaml` referencing only published images (`esi-idp`, `esi-role-grant`, pinned `postgres`), env file outside the repo, volumes.
- Public TLS endpoint: DuckDNS subdomain, Caddy reverse proxy with Let's Encrypt through the DuckDNS DNS-01 challenge (custom Caddy build with the DuckDNS plugin, certificate storage on a persistent volume, DuckDNS token in the VM env file); only port 443 open; `KC_HOSTNAME` set to the public URL.
- Daily `pg_dump` to free object storage and a documented restore.
- Laptop fallback: the same compose file behind a tunnel.

## Out of scope
- Building images (project CI does that); Keycloak realm content (D1).

## Acceptance criteria
- [ ] Keycloak and Role Grant Service health answer through the public URL over TLS; no other port answers from outside.
- [ ] Containers restart after a VM reboot.
- [ ] A backup is written daily and a restore into a fresh container passes the realm smoke test.
- [ ] No secret is committed; secrets come from an env file or GitHub environment secrets.

Analysis: docs/requirements/UR-140-keycloak-idp-sso.md. Plan: docs/plan/README.md.
