---
id: github-setup
type: process
status: Active
updated: 2026-10-19
projects: [esi]
issues: [ESI-31, ESI-78]
keywords: [github, registry, github packages, npm, ghcr, token, NODE_AUTH_TOKEN, secrets, variables, branch protection, labels, templates, P0-11]
---

# GitHub setup

Repository: `dtnam0899/edge-side-includes` (public since 2026-10-18). Default branch `develop`; `main` is production (see `esi-workflow`). Source of truth for task P0-11 ([phase 0](../plan/phase-0-foundation.md)).

## Repository variables

Set under Settings → Secrets and variables → Actions → Variables (`gh variable list`). They hold no secrets; workflows read them as `${{ vars.NAME }}`.

| Variable | Value | Used by |
|----------|-------|---------|
| `ESI_PACKAGE_REGISTRY_URL` | `https://npm.pkg.github.com` | npm publish/install of `@dtnam0899/*` (contracts, lib) |
| `ESI_IMAGE_REGISTRY` | `ghcr.io/dtnam0899` | Docker image tags `${ESI_IMAGE_REGISTRY}/<project>:<version>` |
| `ESI_RELEASE_TAG_FORMAT` | `<project>@v<version>` | Release tags; `lib` packages use `lib-<package>@v<version>` (see `lib/CLAUDE.md`) |

## Package registry (GitHub Packages, npm)

- Scope `@dtnam0899` maps to `https://npm.pkg.github.com` in each consuming or publishing project's own `.npmrc` (`services/contracts`, `lib`, `web/esi-portal`). The `.npmrc` contains only `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}`; no token is ever committed. Use exactly `${NAME}`: npm 10 does not support shell defaults such as `${NAME-}` and would send that text as the token (401).
- Packages published from this repository are linked to it and inherit its visibility (public). The GitHub npm registry still needs a token with `read:packages` to install, even for public packages.
- Remove prereleases that only proved a flow (P0-12 did, with the `prerelease` workflow's `cleanup` mode).

### Tokens

| Where | `NODE_AUTH_TOKEN` comes from | Permissions |
|-------|------------------------------|-------------|
| CI (GitHub Actions) | `${{ secrets.GITHUB_TOKEN }}` | job-level `permissions`: `packages: read` to install, `packages: write` (plus `contents: read`) to publish. No repository secret is needed. |
| Docker builds | `docker build --secret id=npm_token,env=NODE_AUTH_TOKEN ...`, mounted only in the install step (`RUN --mount=type=secret,...`) | never an `ARG` or `ENV`, so it is not stored in image layers |
| Local machine | `gh auth refresh -h github.com -s read:packages` once, then `export NODE_AUTH_TOKEN=$(gh auth token)` per shell | the GitHub npm registry accepts classic tokens only (gh OAuth token or a classic PAT with `read:packages`); fine-grained PATs do not work |

Publishing from a laptop is not part of the workflow: releases and prereleases run in CI (see [Release flow](#release-flow)).

## Image registry (GHCR)

`${ESI_IMAGE_REGISTRY}/<image>` = `ghcr.io/dtnam0899/<image>`. The `release-images` workflow pushes them when a release tag is pushed; project workflows only build and check images.

| Release tag | Images | Dockerfile target |
|-------------|--------|-------------------|
| `core@vX.Y.Z` | `esi-core:X.Y.Z`, `esi-core-migrator:X.Y.Z` | `services/core-backend` `runtime`, `migrator` |
| `agents@vX.Y.Z` | `esi-agents:X.Y.Z` | `services/ai-agents` `runtime` |

- **Tags:** `<version>` and `sha-<short commit>`, linux/amd64 only. Never `latest`; deployments pin a version. A version that already exists in the registry is not overwritten (the run fails): release a new version instead.
- **Checks before pushing:** the tag matches `ESI_RELEASE_TAG_FORMAT` with a stable `X.Y.Z`, equals the manifest version (`Directory.Build.props` `<Version>` / `pyproject.toml` `version`), and the tagged commit is on `main`; the project's `test` stage passes.
- **Auth:** `GITHUB_TOKEN` with `packages: write`; no repository secret. The agents runtime image does not need `NODE_AUTH_TOKEN` (only its `published` target fetches packages).
- **Visibility:** images must be public, because the Azure demo pulls them without credentials (`infra/azure/README.md`). Packages pushed from this repository with `GITHUB_TOKEN` are linked to it (`org.opencontainers.image.source`); the workflow's last step pulls each image anonymously and fails if one is not public. If that happens after the first push of an image, set it once under the package's settings (`https://github.com/users/dtnam0899/packages/container/package/<image>/settings` → Change visibility → Public); later versions keep it.
- **Releasing:** after the `develop` → `main` release merge, with the manifest already at the new version, a maintainer tags the merge commit and pushes the tag:

```bash
git tag core@v0.1.0 origin/main && git push origin core@v0.1.0
```

## Secrets

- None are required today. CI generates throwaway values (for example the SQL Server `sa` password in the `core` workflow) at run time.
- The ADR-0003 master key is created later, per deployment environment (GitHub environment secret), never in the repository or in repository-level secrets.

## Release flow

- Stable releases: after the `develop` → `main` release PR is merged, start the release workflow on `main`: `release-contracts` (version committed in `services/contracts`, tag `contracts@v<version>`) or `release-lib` (versions from tags and conventional commits or an explicit input, tags `lib-<package>@v<version>`). See each project's `CLAUDE.md`.
- Service images: pushing the release tag `core@v<version>` or `agents@v<version>` on `main` starts `release-images` (see [Image registry](#image-registry-ghcr)).
- Prereleases (decided 2026-10-18): a manually started workflow may publish from `develop`, and only versions with a prerelease identifier (for example `0.1.0-rc.0`). Stable versions are refused outside `main`.

## Labels and templates

- Labels: `User Requirement`, `System Requirement`, `Foundation Task`, `Task` (plus GitHub defaults).
- Issue templates in `.github/ISSUE_TEMPLATE/` (user requirement, system requirement, foundation task) and `.github/pull_request_template.md` use the `ESI-<n> [PROJECT] <title>` format.

## Branch protection

Verified 2026-10-18 (`gh api repos/dtnam0899/edge-side-includes/rulesets`, `.../branches/<branch>/protection`):

| Branch | Rule | Source |
|--------|------|--------|
| `develop` | Deletion and force push (non-fast-forward) blocked | ruleset `develop-1` |
| `develop` | Pull request required with 1 approving review; merge methods merge, squash, rebase; the Admin repository role may always bypass | ruleset `develop-2` (plus a classic protection rule with the same review count) |
| `main` | Deletion and force push blocked | ruleset `main-1` |
| `main` | Pull request required with 1 approving review; only actors with bypass (Admin role) may update `main` (`update` rule), so release PRs are merged by an admin | ruleset `main-2` (plus a classic protection rule with the same review count) |

Not enforced yet, so still team convention (`esi-workflow`):

- **CI before merge:** no required status checks are configured, so a PR with failing or pending CI can be merged once approved.
- **Release merge method:** a merge commit for `develop` → `main` is a convention; the ruleset also allows squash and rebase.
- **Merge method:** squash into `develop` is a convention; the ruleset also allows merge and rebase.
- **Admin bypass:** admins (the repository owner) can merge without an approval (`gh pr merge --admin`). With a single maintainer, the owner cannot approve their own PRs, so the bypass is the way to merge them. Use it only when CI is green, and say so in the PR.

To finish enforcement:

- Add the `build` job of each project workflow as a required status check on `develop` (path-filtered workflows do not report on unrelated PRs, so require only checks that always run, or add an always-running aggregate job first).
- Restrict `main` to merge commits.
- Restrict `develop` to squash merges.
