# syntax=docker/dockerfile:1
# Tooling image: lints and checks the specs and packs them with `npm pack`. There is no runtime service,
# so there is no HEALTHCHECK. Publishing runs in CI, not in this image.
FROM tufin/oasdiff:v1.33.0 AS oasdiff

FROM node:22.23.3-alpine3.24 AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM deps AS check
COPY .spectral.yaml ./
COPY scripts ./scripts
COPY common ./common
COPY core-api ./core-api
COPY agents-api ./agents-api
RUN npm run check

FROM check AS pack
ARG VERSION=0.0.0
ARG REVISION=unknown
LABEL org.opencontainers.image.title="esi-contracts" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.source="https://github.com/dtnam0899/edge-side-includes"
RUN mkdir /out && npm pack --pack-destination /out
COPY --from=oasdiff /usr/bin/oasdiff /usr/local/bin/oasdiff
USER node
CMD ["ls", "-l", "/out"]
