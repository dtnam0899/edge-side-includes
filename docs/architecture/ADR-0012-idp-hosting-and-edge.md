---
id: ADR-0012
type: adr
status: Proposed
date: 2026-10-24
projects: [idp, grants, edge, portal, esi]
issues: [ESI-140]
keywords: [hosting, oracle cloud, always free, ampere, docker compose, cloudflare, workers, workers kv, tunnel, edge, jwt, pep, vercel rewrite, free tier, backup]
---

# ADR-0012 IdP hosting on Oracle Always Free and token checks in a Cloudflare Worker

## Context
- [ADR-0011](./ADR-0011-identity-provider-keycloak.md) adds Keycloak; [ADR-0013](./ADR-0013-role-grant-service.md) adds Role Grant Service. Both need PostgreSQL and must stay up, unlike core and agents, which scale to zero on Azure Container Apps ([ADR-0005](./ADR-0005-hosting-target.md)).
- The ACA free grant is about 66 h a month at demo size (ADR-0005), too little for an always-on IdP.
- Oracle Cloud Always Free Ampere A1: 1,500 OCPU-hours and 9,000 GB-hours a month (about 2 OCPU and 12 GB running all month) after a 2026 cut without public announcement; instances above the entitlement can be terminated ([InfoQ](https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/), [terminalbytes](https://terminalbytes.com/oracle-cloud-free-tier-changes-2026/), third-party reports checked 2026-10-24; confirm in Oracle's docs).
- Cloudflare Workers Free: 100,000 requests a day, 10 ms CPU per request, 128 MB memory ([Cloudflare pricing](https://developers.cloudflare.com/workers/platform/pricing/), [limits](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/workers/platform/limits.mdx), checked 2026-10-24).
- The portal reaches core through a Vercel rewrite of `/api/*` (`infra/vercel/build-output.sh`, variable `ESI_DEMO_CORE_URL`); core keeps no CORS.
- Product owner decisions 2026-10-24: only the IdP stack moves to Oracle; token checks at the real edge in a Cloudflare Worker; no Varnish (UR-140 Decisions 2, 3, 5).

## Options
1. **IdP stack on one Oracle A1 VM (docker compose of published images), Worker in front of core through the Vercel rewrite.** Pros: free, always on, enough RAM; no custom domain needed for the API path; core and portal hosting unchanged. Cons: one VM is a single point of failure; Oracle can change limits again.
2. **Everything on the Oracle VM.** Pros: one host. Cons: replaces ADR-0005 work that is done and works; loses scale-to-zero.
3. **Keycloak on a free PaaS container tier.** Pros: managed. Cons: free tiers found offer about 512 MB and sleep when idle, which breaks sessions and token refresh.

## Decision
Take option 1.

Oracle VM (`infra/oracle/`)
- One Always Free A1 VM (ARM64), sized within the current entitlement, running `docker compose` that references only published images: `ghcr.io/dtnam0899/esi-idp:<version>`, `ghcr.io/dtnam0899/esi-role-grant:<version>`, and a pinned `postgres` image. Images are built multi-arch (amd64 and arm64) by the release workflow.
- One PostgreSQL instance, separate databases or schemas and users for Keycloak and Role Grant Service.
- Keycloak runs in production mode with a pre-built (`kc.sh build`) image, heap limited by environment variables, health and metrics enabled on the management port only.
- Exposure: only Keycloak's public endpoints are reachable from the Internet, over TLS. The mechanism (Cloudflare named tunnel with a domain, or a reverse proxy with a certificate for a free hostname) is Open question 1; no port other than TLS is open.
- Secrets (database passwords, Keycloak admin bootstrap, Role Grant service-account secret, Cloudflare API token for KV writes) live in an env file on the VM outside the repo, written from GitHub environment secrets or by hand; never committed.
- Daily `pg_dump` to free object storage (OCI Object Storage or Cloudflare R2), with a restore test; fallback: the same compose file runs on a laptop behind a tunnel.

Edge (`services/edge-gateway`, Cloudflare Worker)
- The Vercel rewrite for `/api/*` points at the Worker (`workers.dev` URL); the Worker forwards to core (`ESI_DEMO_CORE_URL` moves into the Worker's settings). The browser still sees one origin and core keeps no CORS.
- The Worker verifies the JWT (signature with a cached JWKS, `iss`, `aud`, `exp`, `tenant_id`), checks route rules (route prefix -> required roles, config deployed with the Worker), checks the revocation list in Workers KV, strips client-sent `X-User-*`/`X-Tenant-*` headers, and forwards the original `Authorization` header. It never calls Keycloak per request.
- Core keeps validating the token itself (defense in depth); it does not trust Worker headers in this ADR.
- Errors are problem+json: 401 `urn:esi:problem:unauthenticated`, 403 `urn:esi:problem:forbidden`.
- Deployed by `wrangler` from CI on an `edge@vX.Y.Z` tag; secrets through `wrangler secret`, not in `wrangler.toml`.

## Consequences
- The demo becomes two hosts: Azure (core, agents, scale to zero) and Oracle (IdP stack, always on). `demo-up`/`demo-down` (ADR-0005) still control core; the IdP stays up.
- Every API request also counts against the Worker's 100,000 a day; well above demo load.
- Revocation through KV takes about a minute to propagate (UR-140 Finding 7).
- A single VM means no HA (NFR-04 best effort); RPO 24 h and RTO 4 h for the demo.
- If Oracle reclaims or terminates the VM, restore from the latest dump onto another host with the same compose file.

## Verification
- `infra/oracle` smoke check: Keycloak `/health/ready` and the Role Grant Service health endpoint answer through the public URL; no other port answers from outside.
- Worker tests (vitest with the Workers runtime): expired, wrong-audience, wrong-issuer, tampered and revoked tokens -> 401; missing role -> 403; spoofed headers removed; valid token forwarded unchanged.
- Backup job writes a dump daily; a restore into a fresh container passes the realm smoke test.

## Open questions
- Public hostname and TLS mechanism for Keycloak: buy a domain, or use a free hostname service (UR-140 Open question 1).
- Region of the Oracle VM relative to Azure (latency of token refresh is not critical; JWKS is cached).
