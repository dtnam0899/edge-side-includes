# contracts

OpenAPI contracts between ESI components, published as the npm package `@dtnam0899/esi-contracts` (specs only). Rules and workflow: [CLAUDE.md](./CLAUDE.md). Repo-wide docs: [docs/README.md](../../docs/README.md).

## Layout

| Path | Content |
|------|---------|
| `core-api/openapi.yaml` | API of `services/core-backend` (no operations yet) |
| `agents-api/openapi.yaml` | API of `services/ai-agents` (no operations yet) |
| `common/components.yaml` | Shared `Problem` (RFC 9457), `FieldError`, `PageInfo`, `ProblemResponse`; re-exported by each spec under its own `components` |

## Commands

Everything runs in Docker; nothing needs to be installed on the host.

```bash
docker build -t contracts:dev .      # lint + version check + npm pack
docker run --rm contracts:dev        # lists the packed tarball in /out
docker compose run --rm contracts    # same, through compose
```

Breaking-change check against the previous release (CI installs the last published package into a directory first, here `.base`):

```bash
docker run --rm -v "$(pwd)/.base:/base:ro" --entrypoint scripts/check-breaking.sh contracts:dev /base
```

Without a previous release the script prints a message and exits 0.

## Notes

- OpenAPI 3.0.3 is used for the widest code generator support. Moving to 3.1 needs a test against every generator in use (ADR-0001) and a decision.
- `info.version` of each spec must equal the `package.json` version (`npm run check:versions`). The release flow bumps both; do not edit by hand.
- `oasdiff` is the Go binary copied from the pinned `tufin/oasdiff` image. The npm package named `oasdiff` is not the tool.
- Dev tooling (`@stoplight/spectral-cli`) reports transitive `npm audit` findings; the published package has no dependencies and `npm audit --omit=dev` is clean.
- Publishing runs in CI from `main` with `NODE_AUTH_TOKEN`; the repo never contains a token (`.npmrc` reads the variable).
