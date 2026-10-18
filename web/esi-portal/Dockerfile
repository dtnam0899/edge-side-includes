# syntax=docker/dockerfile:1
# Stages: deps -> check (lint, boundary test, unit tests, build; CI target) -> runtime (static nginx).
FROM node:22.23.3-alpine3.24 AS deps
WORKDIR /app
ENV CI=true NG_CLI_ANALYTICS=false
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM deps AS check
COPY angular.json tsconfig.json tsconfig.app.json tsconfig.spec.json eslint.config.js ./
COPY eslint ./eslint
COPY scripts ./scripts
COPY public ./public
COPY src ./src
RUN npm run check

FROM nginxinc/nginx-unprivileged:1.30.6-alpine3.24 AS runtime
ARG VERSION=0.0.0
ARG REVISION=unknown
LABEL org.opencontainers.image.title="esi-portal" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.source="https://github.com/dtnam0899/edge-side-includes"
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 docker/40-esi-config.sh /docker-entrypoint.d/40-esi-config.sh
COPY --from=check --chown=101:101 /app/dist/esi-portal/browser /usr/share/nginx/html
ENV ESI_PORTAL_API_BASE_URL=/api
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
