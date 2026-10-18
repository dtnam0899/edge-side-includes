# Pinned A2UI v0.9.1 files

Copied verbatim (byte for byte) from the A2UI specification. Do not edit these files; to change the pin, replace them from a new upstream ref, update `src/lib/versions.ts`, and follow the `dsl-authoring` skill (new `dslSchemaVersion`, migration, ADR).

| File | Upstream path |
|------|---------------|
| `catalog.json` | `specification/v0_9_1/catalogs/basic/catalog.json` |
| `common_types.json` | `specification/v0_9_1/json/common_types.json` |
| `server_to_client.json` | `specification/v0_9_1/json/server_to_client.json` |

- Repository: https://github.com/google/A2UI
- Fetched at commit `cbaa5ee62c737b50d0695c1e5794d0f648b61dca` (2026-10-18); the last upstream change to `specification/v0_9_1` is `c07134caf2f63e3356c4439d248afc9eb04f310e`.
- License: Apache-2.0 (Google LLC).
- `catalog.json` and `common_types.json` are the same JSON as the copies inside `@a2ui/web_core` 0.14.0 (`src/v0_9/schemas/`), which the pinned renderer `@a2ui/angular` 0.13.0 uses; a test in this package checks that. `server_to_client.json` from the v0.9.1 spec also accepts the message version `"v0.9.1"`, while the renderer accepts only `"v0.9"`, so ESI emits `"v0.9"`.
