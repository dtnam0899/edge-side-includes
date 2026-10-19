---
name: esi-release
description: Release an ESI project (contracts, lib packages, core, agents) to its registry - choose the next version, prepare the version and changelog PR, the develop to main release PR, start the release workflow or push the release tag, and verify what was published. Use when asked to release, publish, cut a version, tag a release, or publish images or packages.
---

# ESI release

How a release goes from `develop` to a published, tagged version. Rules behind it: root `CLAUDE.md` (rule 4), `esi-project-standards` (versioning), `esi-workflow` (branches, commits, PRs). Registry and tag details: `docs/process/github-setup.md`.

## Ask before every irreversible step

These steps are hard or impossible to undo, so stop and get an explicit yes from the user for each one, naming what will happen:

- merging the release PR into `main`
- pushing a release tag (`core@v…`, `agents@v…`)
- starting `release-contracts` or `release-lib` (except `release-lib` with `dry_run: true`)

Never delete, move or force-push a release tag, never unpublish or overwrite a published version, never push to `main` directly, never publish from a laptop. If a release went wrong, release a new patch version.

## What each project releases

| Project | Version source | How the release starts | Tag | Published |
|---------|----------------|------------------------|-----|-----------|
| `services/contracts` | `package.json` and every spec's `info.version`, set together with `node scripts/set-version.mjs <x.y.z>` in the PR that changes the contract | `release-contracts` workflow (manual, on `main`); it publishes and pushes the tag | `contracts@vX.Y.Z` | npm `@dtnam0899/esi-contracts` |
| `lib/*` | tags and Conventional Commits (`nx release`); source `package.json` stays `0.0.0`, never hand-edited, no changelog committed | `release-lib` workflow (manual, on `main`), inputs `projects`, optional `version`, `dry_run` | `lib-<pkg>@vX.Y.Z` (pushed by the workflow) | npm `@dtnam0899/<pkg>` |
| `services/core-backend` | `Directory.Build.props` `<Version>` + `CHANGELOG.md` | push the tag on the `main` merge commit; `release-images` runs | `core@vX.Y.Z` | GHCR `esi-core`, `esi-core-migrator` |
| `services/ai-agents` | `pyproject.toml` `version` + the `esi-agents` entry in `uv.lock` + `CHANGELOG.md` | push the tag on the `main` merge commit; `release-images` runs | `agents@vX.Y.Z` | GHCR `esi-agents` |
| `web/esi-portal` | not released | the `portal` workflow deploys `develop` to Vercel (`infra/vercel/README.md`) | none | Vercel deployment |

Order when several projects change together: producers first (`contracts`, then `lib`), then `core`, then `agents`; consumers bump the pinned version in a separate PR after the producer is published.

## Steps

### 1. Pick the version

Find the last release and what changed since:

```bash
git fetch origin --tags
git tag -l '<tag-prefix>@v*' --sort=-v:refname | head -n 1          # e.g. core@v*
git log --oneline <last-tag>..origin/develop -- <project dir>
```

SemVer from the commit types for that project: `!` or `BREAKING CHANGE:` = major, `feat` = minor, `fix`/`perf` = patch; `docs`/`test`/`chore`/`ci` alone give no release. No tag yet = first release `0.1.0`. A contract or DSL major also needs an ADR. Tell the user the version and the reason before changing files.

### 2. Version and changelog PR into `develop`

Skip for `lib` (versions come from tags) and for `contracts` when the contract PR already set the version.

- Issue `ESI-<n> [esi] Release <project> X.Y.Z` (or one issue for several projects), branch `chore/ESI-<n>-release-<project>-X.Y.Z` from the latest `develop`.
- One commit per project: `chore(<project>): release X.Y.Z`, footer `Refs: ESI-<n>`.
  - core: `<Version>` in `Directory.Build.props`.
  - agents: `version` in `pyproject.toml` and the `name = "esi-agents"` entry's `version` in `uv.lock`; check with `uv lock --check` (inside the project's `deps` Docker image if `uv` is not installed).
  - contracts: `node scripts/set-version.mjs X.Y.Z`, then `npm run check`.
  - `CHANGELOG.md`: rename `## Unreleased` to `## X.Y.Z` (summarize from the commits if the section is empty). Released sections are never edited afterwards.
- Leave the Dockerfile `ARG VERSION=0.0.0` defaults and source-tree fallbacks alone; the release workflow passes the real version.
- Run the project's Docker test target (`docker build --target test .`, contracts `npm run check`) and open the PR (`esi-workflow`), base `develop`. The PR says which tags follow and that the issue stays open until they exist.

### 3. Release PR `develop` → `main`

After step 2 is merged and `develop` CI is green: open a PR from `develop` into `main`, title `Release: <project> X.Y.Z[, <project> X.Y.Z]`, listing the versions and the changes since the last release. It needs CI and one approval and is merged with a **merge commit** (never squash), by the user or with their explicit yes.

### 4. Start the release on `main`

Confirm first (see the top), then:

```bash
git fetch origin main
git log -1 --format='%h %s' origin/main                     # must be the release merge commit
git tag core@vX.Y.Z origin/main && git push origin core@vX.Y.Z
git tag agents@vX.Y.Z origin/main && git push origin agents@vX.Y.Z
gh workflow run release-contracts --ref main
gh workflow run release-lib --ref main -f projects=<list> -f version=<x.y.z or empty> -f dry_run=true   # preview first
gh workflow run release-lib --ref main -f projects=<list> -f version=<x.y.z or empty> -f dry_run=false
```

Use only the lines for the projects being released. The workflows refuse a tag or version that already exists, a version that differs from the manifest, and a commit that is not on `main`.

### 5. Verify and close

```bash
gh run list --workflow <release-images|release-contracts|release-lib> --limit 1
gh run watch <run id> --exit-status
```

- Images: the run summary lists `<image>:X.Y.Z` and `sha-<short>`; the last step proves an anonymous pull. If it fails on a first push because the package is private, the user sets it public once (package settings → Change visibility → Public) and re-runs the job. That is a GitHub setting the user changes, not the agent.
- npm packages: `npm view @dtnam0899/<pkg> version` with a `read:packages` token shows `X.Y.Z`.
- Tags: `git ls-remote --tags origin '<prefix>@vX.Y.Z'`.
- Close the release issue with the published versions, and tell the user which consumers can now bump (for example `infra/azure` image versions, or a project's pinned contract version).

## When something fails

| Failure | Cause | Do |
|---------|-------|----|
| `tag version … != manifest version` | step 2 missing or not merged to `main` | finish steps 2–3, then tag the new merge commit; the wrong tag stays (ask the user before any tag cleanup) |
| `… is not on main` | tag pushed on a `develop` or feature commit | do not move it; tag the right `main` commit with the next patch version, or ask the user |
| `already exists` | version already published | release the next patch version |
| test stage fails in the release run | `main` differs from what was tested | fix on `develop` through a normal PR, then release a new patch version |
| anonymous pull fails | first push of a private package | user sets the package public, re-run the failed job |
