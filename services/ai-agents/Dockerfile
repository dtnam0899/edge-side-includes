# syntax=docker/dockerfile:1
# Stages: deps -> test (lint, unit tests, evals; CI target) -> runtime.
# `published` (scripts/sync-published.sh only) fetches the pinned packages and regenerates the vendored files.
FROM ghcr.io/astral-sh/uv:0.13.1 AS uv

FROM python:3.13.15-slim-trixie AS deps
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never UV_PROJECT_ENVIRONMENT=/app/.venv
WORKDIR /app
COPY pyproject.toml uv.lock .python-version README.md ./
RUN uv sync --frozen --no-install-project --no-dev

# Fetch the pinned published packages (published-packages.json). The token is a BuildKit secret, never ARG/ENV.
FROM node:22.23.3-alpine3.24 AS fetch
ARG ESI_CONTRACTS_VERSION
ARG DSL_SCHEMA_VERSION
WORKDIR /fetch
COPY .npmrc ./
RUN --mount=type=secret,id=npm_token,env=NODE_AUTH_TOKEN \
    npm pack --silent "@dtnam0899/esi-contracts@${ESI_CONTRACTS_VERSION}" "@dtnam0899/dsl-schema@${DSL_SCHEMA_VERSION}" \
 && mkdir contracts dsl \
 && tar -xzf dtnam0899-esi-contracts-*.tgz -C contracts \
 && tar -xzf dtnam0899-dsl-schema-*.tgz -C dsl \
 && mkdir -p /out/vendor/esi-contracts /out/src/esi_agents/dsl/schema /out/tests/fixtures/dsl-schema \
 && cp contracts/package/bundled/agents-api.yaml /out/vendor/esi-contracts/ \
 && cp dsl/package/src/a2ui/v0_9_1/*.json dsl/package/src/esi/artifact.schema.json /out/src/esi_agents/dsl/schema/ \
 && cp dsl/package/src/esi/catalog.json /out/src/esi_agents/dsl/schema/esi-catalog.json \
 && cp -r dsl/package/src/fixtures/valid dsl/package/src/fixtures/invalid dsl/package/src/fixtures/render \
      /out/tests/fixtures/dsl-schema/ \
 && for p in contracts:/out/vendor/esi-contracts dsl:/out/src/esi_agents/dsl/schema; do \
      node -e 'const p=require(process.argv[1]); console.log(JSON.stringify({package: p.name, version: p.version}, null, 2))' \
        "/fetch/${p%%:*}/package/package.json" > "${p#*:}/PUBLISHED.json"; \
    done

# Generate the pydantic models from the fetched contract.
FROM deps AS codegen
RUN uv sync --frozen --no-install-project
COPY scripts ./scripts
COPY --from=fetch /out /out
RUN uv run --no-sync python scripts/generate_contract_models.py \
      /out/vendor/esi-contracts /out/src/esi_agents/contracts/agents_api.py

FROM scratch AS published
COPY --from=codegen /out/ /

FROM deps AS test
RUN uv sync --frozen --no-install-project
COPY src ./src
COPY tests ./tests
COPY evals ./evals
COPY scripts ./scripts
COPY vendor ./vendor
COPY published-packages.json ./
RUN uv sync --frozen \
 && uv run ruff check . \
 && uv run ruff format --check . \
 && uv run pytest -q \
 && uv run python -m esi_agents.evals evals/cases

FROM deps AS build
COPY src ./src
RUN uv sync --frozen --no-dev --no-editable

FROM python:3.13.15-slim-trixie AS runtime
ARG VERSION=0.0.0
ARG REVISION=unknown
LABEL org.opencontainers.image.title="esi-agents" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.source="https://github.com/dtnam0899/edge-side-includes"
RUN useradd --system --uid 10001 --no-create-home app
WORKDIR /app
COPY --from=build --chown=app:app /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1 ESI_AGENTS_PORT=8000
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["python", "-c", "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"ESI_AGENTS_PORT\"]}/health', timeout=2)"]
CMD ["python", "-m", "esi_agents"]
