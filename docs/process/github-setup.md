---
id: github-setup
type: process
status: Active
updated: 2026-10-18
projects: [esi]
issues: [ESI-31]
keywords: [github, registry, github packages, npm, ghcr, token, NODE_AUTH_TOKEN, secrets, variables, branch protection, labels, templates, P0-11]
---

# GitHub setup

Repository: `dtnam0899/edge-side-includes` (private, GitHub Free). Default branch `develop`; `main` is production (see `esi-workflow`). Source of truth for task P0-11 ([phase 0](../plan/phase-0-foundation.md)).

## Repository variables

Set under Settings → Secrets and variables → Actions → Variables (`gh variable list`). They hold no secrets; workflows read them as `${{ vars.NAME }}`.

| Variable | Value | Used by |
|----------|-------|---------|
| `ESI_PACKAGE_REGISTRY_URL` | `https://npm.pkg.github.com` | npm publish/install of `@dtnam0899/*` (contracts, lib) |
| `ESI_IMAGE_REGISTRY` | `ghcr.io/dtnam0899` | Docker image tags `${ESI_IMAGE_REGISTRY}/<project>:<version>` |
| `ESI_RELEASE_TAG_FORMAT` | `<project>@v<version>` | Release tags; `lib` packages use `lib-<package>@v<version>` (see `lib/CLAUDE.md`) |

## Package registry (GitHub Packages, npm)

- Scope `@dtnam0899` maps to `https://npm.pkg.github.com` in each consuming or publishing project's own `.npmrc` (`services/contracts`, `lib`, `web/esi-portal`). The `.npmrc` contains only `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN-}`; no token is ever committed.
- Packages published from this repository are linked to it and inherit its (private) visibility. Installing them needs a token with `read:packages` even for public consumers.
- GitHub Free includes 500 MB of private package storage; remove or deprecate prereleases that only proved a flow (P0-12).

### Tokens

| Where | `NODE_AUTH_TOKEN` comes from | Permissions |
|-------|------------------------------|-------------|
| CI (GitHub Actions) | `${{ secrets.GITHUB_TOKEN }}` | job-level `permissions`: `packages: read` to install, `packages: write` (plus `contents: read`) to publish. No repository secret is needed. |
| Docker builds | `docker build --secret id=npm_token,env=NODE_AUTH_TOKEN ...`, mounted only in the install step (`RUN --mount=type=secret,...`) | never an `ARG` or `ENV`, so it is not stored in image layers |
| Local machine | `gh auth refresh -h github.com -s read:packages` once, then `export NODE_AUTH_TOKEN=$(gh auth token)` per shell | the GitHub npm registry accepts classic tokens only (gh OAuth token or a classic PAT with `read:packages`); fine-grained PATs do not work |

Publishing from a laptop is not part of the workflow: releases and prereleases run in CI (see [Release flow](#release-flow)).

## Image registry (GHCR)

`ghcr.io/dtnam0899/<project>`. CI pushes with `GITHUB_TOKEN` and `packages: write` when a deployment needs images; until then images are built and checked in CI but not pushed.

## Secrets

- None are required today. CI generates throwaway values (for example the SQL Server `sa` password in the `core` workflow) at run time.
- The ADR-0003 master key is created later, per deployment environment (GitHub environment secret), never in the repository or in repository-level secrets.

## Release flow

- Stable releases: after the `develop` → `main` release PR is merged, CI on `main` publishes (`esi-project-standards`).
- Prereleases (decided 2026-10-18): a manually started workflow may publish from `develop`, and only versions with a prerelease identifier (for example `0.1.0-rc.0`). Stable versions are refused outside `main`.

## Labels and templates

- Labels: `User Requirement`, `System Requirement`, `Foundation Task`, `Task` (plus GitHub defaults).
- Issue templates in `.github/ISSUE_TEMPLATE/` (user requirement, system requirement, foundation task) and `.github/pull_request_template.md` use the `ESI-<n> [PROJECT] <title>` format.

## Branch protection: not available

Branch protection rules and rulesets are not available for private repositories on GitHub Free (`GET /repos/.../branches/develop/protection` returns 403 "Upgrade to GitHub Pro or make this repository public"). Until that changes:

- The rules in `esi-workflow` (PR into `develop`, CI green, one approval, squash-merge; release PR `develop` → `main`; no direct commits or force-push to `develop`/`main`) are a team convention, not enforced by GitHub.
- Reviewers check CI and the approval before merging; agents never merge without an explicit request.
- The P0-11 acceptance criterion "a test PR cannot be merged without approval and passing CI" is deferred.

To enforce it after upgrading to GitHub Pro (or making the repository public), add a ruleset for `develop` and `main`:

- Require a pull request with 1 approval; dismiss stale approvals on new commits.
- Require status checks to pass (the `build` job of the project workflows that the PR touches) and branches to be up to date.
- Block force pushes and deletions; allow only squash merges into `develop` and merge commits for `develop` → `main`.

Then open a test PR without approval to confirm it cannot be merged, and close P0-11's deferred criterion.
