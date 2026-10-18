# syntax=docker/dockerfile:1
# Tooling image: builds, tests and lints the workspace and checks the module boundaries.
# There is no runtime service, so there is no HEALTHCHECK. Publishing runs in CI, not in this image.
FROM node:22.23.3-alpine3.24 AS deps
WORKDIR /app
ENV NX_DAEMON=false CI=true NX_NO_CLOUD=true
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM deps AS check
ARG VERSION=0.0.0
ARG REVISION=unknown
LABEL org.opencontainers.image.title="esi-lib" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.source="https://github.com/dtnam0899/edge-side-includes"
COPY . .
RUN npm run check && npm run test:boundaries
USER node
CMD ["ls", "-l", "dist"]
