---
name: esi-project-standards
description: ESI-wide standards for project independence, Docker, versioning and Nx workspaces. Use when creating a project, adding a dependency between projects, writing a Dockerfile or compose file, releasing or bumping versions, or setting up CI.
---

# ESI project standards

Generic rules for repositories made of independent projects. Project names, package names, ports and registry hosts are not defined here: take them from the project's `CLAUDE.md` or from these environment variables (set in CI and the developer shell, never hard-coded):

| Variable | Meaning |
|----------|---------|
| `ESI_PACKAGE_REGISTRY_URL` | Registry where reusable packages are published and installed from |
| `NODE_AUTH_TOKEN` | npm registry auth token, read from the environment by `.npmrc` (`${NODE_AUTH_TOKEN}`); never committed |
| `ESI_IMAGE_REGISTRY` | Registry/namespace for Docker images |
| `ESI_RELEASE_TAG_FORMAT` | Git tag pattern, default `<project>@v<version>` |

If a variable is needed and unset, ask the user instead of guessing.

## 1. Independence checklist (review every PR against it)

- [ ] The project installs, builds, tests and runs from its own directory with only its own manifest and Docker.
- [ ] No `../` paths, `file:`/`link:`/`workspace:` specs pointing outside the project, .NET `ProjectReference` or Python path installs to another project, symlinks, or shared lockfiles/build config.
- [ ] Other projects are used only as pinned versions (packages from `ESI_PACKAGE_REGISTRY_URL`, published contract/schema versions) or over network APIs.
- [ ] Generated code (API clients, schema models) is committed inside the consumer with a header or version file stating the source version and the regeneration command.
- [ ] Docker build context is the project directory; the Dockerfile does not `COPY ../`.
- [ ] CI for a project runs on changes under its directory (path filter) and needs no other project checked out.

Cross-project releases: the producer releases first, consumers bump the version in a separate commit/PR. Keep old API versions working until all consumers moved; breaking changes need a new major version and an ADR.

## 2. Docker standard

Every project has `Dockerfile`, `.dockerignore` and `compose.yaml` (its own dependencies only).

- Multi-stage: `deps` -> `build` -> `test` (optional target) -> `runtime`. Pin base images to an explicit version (digest where practical); never `latest`.
- Runtime image: minimal, non-root user, `HEALTHCHECK`, configuration only through environment variables, no secrets or `.env` baked in.
- Layer cache: copy manifests and lockfiles first, install, then copy sources. Use frozen installs (`npm ci`, `uv sync --frozen` or a locked pip install, `dotnet restore --locked-mode`).
- Labels `org.opencontainers.image.{title,version,revision,source}`; tag `${ESI_IMAGE_REGISTRY}/<project>:<version>` plus the short commit SHA, never only `latest`.
- Stack notes: .NET `sdk` -> `aspnet`; web apps build with Node and serve static files from a small web server image, with runtime config injected at start, not at build time; Python slim image installed from the lock file.
- Deployment wiring (compose/k8s) only references already-built images (`image:`), never `build:` from project sources.
- `docker compose up` inside a project directory must give a working dev setup; document exact commands in the project `CLAUDE.md`.

## 3. Versioning standard

- SemVer per project and per published package, independent of other projects.
- Source of truth is the stack's native manifest: `package.json`, `Directory.Build.props` `<Version>`, `pyproject.toml`, or `info.version` for API/schema contracts.
- Each project has its own `CHANGELOG.md`, generated from Conventional Commits (`feat` = minor, `fix`/`perf` = patch, `!` or `BREAKING CHANGE:` = major).
- Release tag follows `ESI_RELEASE_TAG_FORMAT`; docker image tag, package version and tag always carry the same version. Release and publish run in CI from `main`; do not bump versions by hand in feature branches unless the project's `CLAUDE.md` says so.
- Contracts and schemas: additive = minor, removal/rename/tightening = major plus an ADR.

## 4. Nx workspaces (TypeScript multi-package projects)

Applies only to a project that is a multi-package TS workspace; Nx stays inside that project and is never a repo-wide build tool.

- CI runs `nx affected -t build test lint`; use the Nx cache; never commit build output.
- Enforce architecture with `@nx/enforce-module-boundaries` and tags (e.g. a no-dependency base scope, higher layers depending only downwards, framework scopes that cannot import each other). The concrete tags are listed in the project `CLAUDE.md`.
- Versioning and publishing use `nx release` (conventional commits, per-package changelog, git tags, publish to `ESI_PACKAGE_REGISTRY_URL`). Do not hand-edit package versions.
- Consumers use registry versions with a committed lockfile. To try unreleased code, publish a prerelease (`nx release --preid`), not a path link.
