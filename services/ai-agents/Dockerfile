# syntax=docker/dockerfile:1
# Stages: deps -> test (lint, unit tests, evals; CI target) -> runtime.
FROM ghcr.io/astral-sh/uv:0.13.1 AS uv

FROM python:3.13.15-slim-trixie AS deps
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never UV_PROJECT_ENVIRONMENT=/app/.venv
WORKDIR /app
COPY pyproject.toml uv.lock .python-version README.md ./
RUN uv sync --frozen --no-install-project --no-dev

FROM deps AS test
RUN uv sync --frozen --no-install-project
COPY src ./src
COPY tests ./tests
COPY evals ./evals
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
