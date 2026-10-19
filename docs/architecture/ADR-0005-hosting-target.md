---
id: ADR-0005
type: adr
status: Proposed
date: 2026-10-18
projects: [portal, core, agents]
issues: [ESI-70]
keywords: [hosting, auth0, budget, demo-up, demo-down, deployment, demo, free tier, vercel, hobby, azure, container apps, azure sql, free offer, ghcr, infra, rewrites, cold start]
---

# ADR-0005 Hosting target for the demo environment

## Context
- ADR-0001 deferred the hosting target ("affects `infra/` only"). Root `CLAUDE.md` rule 3: every project ships a Docker image; `infra/` only wires already-built images (`ghcr.io/dtnam0899/<project>:<version>`, `docs/process/github-setup.md`; the repository and its packages are public).
- The current goal is a **demo**, not production. The product owner asked to prefer free tiers and free services (2026-10-18).
- ESI is a personal, non-commercial project (product owner, 2026-10-18), so the Vercel Hobby fair-use restriction is met.
- `web/esi-portal` is a static Angular build. It reads `/config.json` at start (`apiBaseUrl`, default `/api`) and expects core on the same origin: core has no CORS by design (`infra/e2e/gateway/nginx.conf` proxies `/api/*` to core with the prefix removed). Installing `@dtnam0899/*` packages during the build needs `NODE_AUTH_TOKEN` (classic token with `read:packages`).
- `services/core-backend` is .NET 10, configured only by `ESI_CORE_*` environment variables, with an EF Core migrations bundle (`migrator` Docker target) and `/health`, `/health/ready`. It connects out to users' SQL Server target databases (SR-1, ADR-0004).
- The app's own database is SQL Server (ADR-0001). Master keys for connection secrets come from environment variables (ADR-0003, option 1).
- `services/ai-agents` is Python 3.13 / FastAPI, called only by core (`ESI_CORE_Agents__BaseUrl`), with no authentication of its own. Model provider not chosen yet (ADR-0001).
- Core calls agents with a 120 s default timeout (`ESI_CORE_Agents__TimeoutSeconds`) and retries visualization generation up to 2 times (`ESI_CORE_Visualization__MaxRetries`).
- Authentication (SR-9) is Auth0 through standard OIDC ([ADR-0006](./ADR-0006-authentication-provider.md)); `LocalAdmin` stays local-only and must never be set in a deployment.
- Free offers verified on 2026-10-18:
  - **Vercel Hobby:** free; restricted to non-commercial personal use ([fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines)). Includes Vercel Authentication and Shareable Links for deployments; Password Protection needs Pro ([deployment protection](https://vercel.com/docs/deployment-protection)). Rewrites to an external origin wait at most 120 s for the first byte on every plan ([limits](https://vercel.com/docs/limits)).
  - **Azure Container Apps, consumption plan:** per subscription and calendar month, the first 180,000 vCPU-seconds, 360,000 GiB-seconds and 2 million requests are free; an app scaled to zero is not charged; only requests from outside the environment count ([billing](https://learn.microsoft.com/en-us/azure/container-apps/billing)).
  - **Azure SQL Database free offer:** up to 10 General Purpose serverless databases per subscription, each with 100,000 vCore-seconds, 32 GB data and 32 GB backup per month; when the allowance runs out the database can auto-pause until the next month instead of billing; no SLA, meant for development and proof of concept ([free offer](https://learn.microsoft.com/en-us/azure/azure-sql/database/free-offer)).
  - Vercel does not run .NET or arbitrary containers; it runs static sites and JavaScript/Python functions only.

## Options
1. **Vercel Hobby for the portal, Azure Container Apps (consumption) for core and agents, Azure SQL Database free offer.** Pros: all three are free at demo load; runs the existing images unchanged; managed SQL Server, the same engine and EF Core provider; scale to zero. Cons: two vendors; cold starts; Vercel Hobby is non-commercial only; the 120 s rewrite limit.
2. **Everything on Azure (Static Web Apps free plan for the portal).** Pros: one vendor, free plan exists. Cons: no Vercel preview workflow; the Static Web Apps linked-backend feature needs its paid plan, so the portal would call core cross-origin and core would need CORS.
3. **Portal on Vercel, agents as Vercel Python functions.** Pros: one container fewer. Cons: agents would need a public endpoint and their own auth; function duration limits; breaks rule 3 for agents. Core still needs a container host.
4. **Portal on Vercel, core and agents on a free PaaS tier (for example Render free web services), SQL Server elsewhere.** Pros: no Azure account. Cons: there is no free managed SQL Server outside Azure; a self-run SQL Server needs at least 2 GB RAM, which no free container tier offers.
5. **Option 1, but agents as a sidecar container inside the core app.** Pros: one cold start instead of two; core calls agents on `localhost`. Cons: both projects share one revision and one scale rule, so an agents release redeploys core and the projects' independent versioning (root `CLAUDE.md` rule 4) blurs; the sidecar's resources count even when only core is busy. The second cold start of separate apps costs about 5–10 s, which is acceptable.

## Decision
Take option 1, scoped to **one demo environment**. Production hosting is a later ADR (see Consequences).

Portal on Vercel Hobby
- Vercel does not build the portal. The `portal` GitHub workflow builds and tests it in Docker as today, exports the static files of the `check` stage and deploys them with `vercel deploy --prebuilt` (Build Output API). The deployed files are exactly the ones CI tested, rule 3 holds, and the npm token for `@dtnam0899/*` stays in GitHub (`GITHUB_TOKEN`), not in Vercel.
- The Vercel project is not connected to the Git repository. Pushes to `develop` deploy Vercel production (the demo shows the integration build); PRs from this repository get previews that use the same demo core. Fork PRs and `main` do not deploy.
- Routing lives in the Build Output API config written by `infra/vercel/build-output.sh`: `/api/*` is proxied to the demo core URL (GitHub variable `ESI_DEMO_CORE_URL`, prefix removed, as in `proxy.conf.json` and the e2e gateway), then static files with the portal nginx cache headers, then an SPA fallback to `/index.html`. `/config.json` stays the committed `{ "apiBaseUrl": "/api" }`, so the browser sees one origin and core keeps no CORS.
- Vercel Authentication is on for preview deployments only; the production (demo) deployment is protected by Auth0 sign-in (ADR-0006), so demo viewers need only their invited Auth0 account.

Core and agents on Azure Container Apps (consumption plan)
- One consumption-only Container Apps environment (no workload profiles, no VNet, no NAT gateway), in one resource group `esi-demo` so the whole demo can be deleted at once.
- `esi-core`: public image `ghcr.io/dtnam0899/esi-core:<version>` (no registry credentials needed), external HTTPS ingress, 0.5 vCPU / 1 GiB, min replicas 0, max 1, readiness `/health/ready`.
- `esi-agents`: `ghcr.io/dtnam0899/esi-agents:<version>`, **internal ingress only**, 0.25 vCPU / 0.5 GiB, min replicas 0, max 1. `ESI_CORE_Agents__BaseUrl` points at its internal FQDN.
- Migrations: a manually triggered Container Apps Job runs the `migrator` image of the same core version before each core update.
- Secrets (app DB connection string, `ESI_CORE_Encryption__MasterKeys__1`, model API key) are Container Apps secrets, set by the deploy workflow from GitHub environment secrets. No Key Vault for the demo (ADR-0003 option 1 as decided).
- Logs: no Log Analytics workspace (`--logs-destination none`, no cost); live logs through `az containerapp logs show`. Add a workspace with a daily cap only if history is needed.

Database: Azure SQL Database free offer
- One logical server with two free-offer databases: `esi_core` (the app database) and `esi_demo_target` (a sample target database for the demo, seeded from a script owned by `infra/azure/`, not read from core's test fixtures).
- Free-limit behavior **auto-pause until next month** (never bill), minimum vCores 0.5, shortest allowed auto-pause delay.
- Public endpoint with the firewall rule "Allow Azure services and resources" (no private endpoint, which is paid), SQL authentication with a contained user per database: core's app user owns only `esi_core`; the demo connection uses a read-only login on `esi_demo_target`, as the consent terms require.

Free-tier limits and on/off use
- Goal: no charge, kept simple. The demo is **off by default**: it is switched on only when it is used and switched off right after.
- Nothing paid is created: no VNet, NAT gateway, private endpoint, Key Vault, dedicated workload profile, container registry or Azure Monitor alert rules. The subscription holds only `esi-demo`, because the Container Apps free grant is per subscription.
- Monthly allowance vs. use: Container Apps 180,000 vCPU-s / 360,000 GiB-s is about 66 h with both apps running (0.75 vCPU / 1.5 GiB); each Azure SQL free database is about 55 h at 0.5 vCore. Switched-off demos use none of it.
- Built-in limits: Azure SQL free-limit behavior `AutoPause` (never bills); Container Apps min replicas 0, max 1.
- On/off: two manual GitHub Actions workflows (or the same `az` commands by hand):
  - `demo-up`: enables external ingress of `esi-core` (`az containerapp ingress enable`), then calls `/api/health/ready` until it answers, which also wakes the database and agents.
  - `demo-down`: disables external ingress of `esi-core` (`az containerapp ingress disable`). No request can reach core, so core and agents scale to zero and stay there; the databases auto-pause on their own after the idle delay. Data is untouched.
- Backstop: an Azure budget on `esi-demo` (free) with an email alert at 0.01 USD actual cost, in case the demo is left on. It only alerts and can lag up to about a day.

Authentication in the demo
- Core runs with `ESI_CORE_Auth__Mode=Oidc` against the Auth0 demo tenant, invite-only (ADR-0006). The demo is deployed only after ADR-0006 is implemented; there is no `LocalAdmin` exception.

Rules others must follow
- Azure resources live in `infra/azure/` (Bicep or Terraform); infra code only references published image tags and never builds from project sources.
- Deploy by version: a `<project>@vX.Y.Z` tag pushes the image to GHCR, then the deploy workflow updates the matching app. Never deploy `latest`.
- No real user data and no real target databases in the demo environment.

## Consequences
- Cold starts: after idle time both core (scale to zero) and the database (auto-pause) must start; the first request can take about a minute or more and may hit the Vercel 120 s limit. Run `demo-up`, which waits until `/api/health/ready` answers, before showing the demo.
- The 120 s Vercel first-byte limit is shorter than core's worst case (agent timeout 120 s plus up to 2 visualization retries). Set `ESI_CORE_Agents__TimeoutSeconds` to about 90 and `ESI_CORE_Visualization__MaxRetries` to 1 in the demo, or move long calls to an async or streaming endpoint later (contract change).
- Core's URL is public, but every request needs a valid Auth0 token of an invited user (ADR-0006). An invited user can still add a connection to any SQL Server reachable from Azure's outbound IPs; invite only people you trust.
- Free tiers have no SLA, limited monthly compute (100,000 vCore-seconds is about 55 hours of activity per database at 0.5 vCore) and can pause until the next month. Acceptable for demos, not for users.
- Vercel Hobby forbids commercial use. ESI is non-commercial today; if that changes (paid work, an employer or a client), the portal moves to Vercel Pro or option 2.
- Outbound IPs of a consumption environment are not fixed, so external target databases cannot reliably allow-list the demo; the demo uses `esi_demo_target` only.
- The model provider is not free in general and is chosen in its own ADR; its key goes into the Container Apps secrets.
- Going to production needs a new ADR that revisits: Vercel Pro, an identity provider, Key Vault (ADR-0003 Phase 6), private endpoint, a static outbound IP for users' firewalls, min replicas 1 and no auto-pause, separate staging and production.
- Idle SQL connections block auto-pause and keep consuming vCore-seconds. Core's connection pool closes when core scales to zero; never leave a query tool (SSMS, Azure Data Studio, the portal query editor) connected to the demo databases.
- Forgetting `demo-down` leaves core reachable but still costs nothing until someone uses it (scale to zero); the risk is only heavy use while it is on, which the budget email backstops.
- Follow-up work: `infra/azure` IaC and demo-target seed script; Vercel project setup (`infra/vercel/README.md`, ESI-72); deploy workflows (GHCR push on release tag, migration job, Container Apps update); `demo-up` / `demo-down` workflows; budget alert.

## Verification
- After each demo deploy, run the `infra/e2e` scenario against the deployed URLs (connection → chat → visualization → dashboard).
- The deploy workflow checks `/health/ready` on the new core revision and fails on a failed migration job.
- A post-deploy probe from outside the environment to `esi-agents` must fail (internal ingress only).
- The Azure budget alert, the SQL free-limit behavior (`AutoPause`) and max replicas 1 are checked in the IaC or, until IaC exists, by following `infra/azure/README.md`.
- After setup, run `demo-down` and confirm core is unreachable, then `demo-up` and confirm the e2e scenario passes.

## Open questions
- Product owner: the demo period end date (when the `esi-demo` resource group is deleted).
- Resolved 2026-10-18 (product owner): ESI is a personal, non-commercial project; Vercel Hobby is allowed. The demo must stay within free allowances.
- Azure region; IaC tool (Bicep or Terraform); who owns the Azure subscription (a payment method is required even for free services) and the Vercel account.
- Model provider for the demo (separate ADR; a free, rate-limited provider tier may be enough for demos).
