#!/bin/sh
# Writes /config.json from environment variables at container start (runtime config, not build time).
# Run by the nginx image entrypoint from /docker-entrypoint.d/.
set -eu
api_base_url="${ESI_PORTAL_API_BASE_URL:-/api}"
case "$api_base_url" in
  *'"'*|*'\'*) echo "ESI_PORTAL_API_BASE_URL must not contain quotes or backslashes" >&2; exit 1 ;;
esac
printf '{ "apiBaseUrl": "%s" }\n' "$api_base_url" > /usr/share/nginx/html/config.json
