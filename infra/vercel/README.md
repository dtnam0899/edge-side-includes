---
id: vercel-portal-deploy
type: process
status: Active
updated: 2026-10-19
projects: [portal]
issues: [ESI-72, ESI-87]
keywords: [vercel, deploy, portal, demo, prebuilt, build output api, rewrites, github actions, config.json, auth0]
---

# Portal on Vercel (demo)

Deploys `web/esi-portal` to Vercel Hobby for the demo environment ([ADR-0005](../../docs/architecture/ADR-0005-hosting-target.md), Proposed). Vercel never builds the portal: the `portal` workflow builds and tests it in Docker as usual, exports the static files of the `check` stage, and `build-output.sh` wraps them in a [Build Output API](https://vercel.com/docs/build-output-api) directory that `vercel deploy --prebuilt` uploads.

| Event | Deployment |
|-------|------------|
| Push to `develop` | Vercel production (the demo URL) |
| PR from this repository | Preview, behind Vercel Authentication |
| PR from a fork, push to `main` | None |

Routing (`build-output.sh`): `/api/*` is proxied to `ESI_DEMO_CORE_URL` with the prefix removed, like `proxy.conf.json` and `infra/e2e/gateway`, so the portal keeps `apiBaseUrl` `/api` and core needs no CORS. Without the variable, `/api/*` answers 503. Other paths are static files with the cache headers of `web/esi-portal/docker/nginx.conf`, and unknown non-asset paths fall back to `index.html`. Vercel waits at most 120 s for the first byte from core.

Runtime config: `build-output.sh` replaces the built `/config.json` with `apiBaseUrl` `/api` plus the Auth0 settings from `ESI_PORTAL_AUTH_DOMAIN`, `ESI_PORTAL_AUTH_CLIENT_ID` and `ESI_PORTAL_AUTH_AUDIENCE` (the workflow fills them from the `ESI_DEMO_AUTH_*` variables), the same file `web/esi-portal/docker/40-esi-config.sh` writes in the container. All three or none: none means sign-in is off (with a warning), some fail the deploy. `/config.json` keeps `Cache-Control: no-store`, so a changed variable takes effect on the next deploy without stale copies.

## One-time setup

The deploy job is skipped until `VERCEL_PROJECT_ID` is set, so CI passes before this is done.

1. In Vercel (Hobby), create a project named `esi-portal` **without connecting the Git repository** (deployments come only from the workflow). Framework preset: Other. Leave Deployment Protection at Standard (previews need Vercel sign-in).
2. Copy the IDs: run `npx vercel@62.2.0 link` in an empty folder and read `.vercel/project.json`, or take them from Project Settings → General (Project ID) and Team/Account Settings (ID).
3. Create a token in Vercel Account Settings → Tokens, scoped to that account, with an expiry date.
4. In GitHub → Settings → Secrets and variables → Actions:
   - secret `VERCEL_TOKEN`
   - variables `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
   - variable `ESI_DEMO_CORE_URL` (the `esi-core` Container Apps URL, `https://…`) once core is deployed; until then `/api/*` answers 503.
   - variables `ESI_DEMO_AUTH_DOMAIN`, `ESI_DEMO_AUTH_CLIENT_ID`, `ESI_DEMO_AUTH_AUDIENCE` from the Auth0 tenant ([infra/auth0](../auth0/README.md), part 6); until then sign-in is off.
5. Push to `develop` (or re-run the latest `portal` workflow on `develop`); the job summary prints the deployment URL.

No npm token is stored in Vercel: packages are installed in the GitHub workflow with `GITHUB_TOKEN`.

## Try it locally

```bash
ESI_PORTAL_AUTH_DOMAIN=esi-demo.jp.auth0.com ESI_PORTAL_AUTH_CLIENT_ID=test-client ESI_PORTAL_AUTH_AUDIENCE=https://api.esi.demo infra/vercel/build-output.sh web/esi-portal/dist/esi-portal/browser /tmp/esi-vercel/.vercel/output https://core.example.test
```

Then inspect `/tmp/esi-vercel/.vercel/output/config.json` (routes) and `/tmp/esi-vercel/.vercel/output/static/config.json` (the portal's runtime config). Deploying by hand works the same way: in `/tmp/esi-vercel`, with `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` set, run `npx vercel@62.2.0 deploy --prebuilt`.
