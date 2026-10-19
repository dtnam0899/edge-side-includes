#!/bin/sh
# Writes /config.json from environment variables at container start (runtime config, not build time).
# Run by the nginx image entrypoint from /docker-entrypoint.d/.
# Sign-in (ADR-0006): set all three ESI_PORTAL_AUTH_* variables for Auth0, or none for sign-in off (a core in
# LocalAdmin mode). They are public SPA client settings, not secrets.
set -eu

check() {
  # shellcheck disable=SC1003 # '\' is a literal backslash pattern, not an escape
  case "$2" in
    *'"'*|*'\'*) echo "$1 must not contain quotes or backslashes" >&2; exit 1 ;;
  esac
}

api_base_url="${ESI_PORTAL_API_BASE_URL:-/api}"
auth_domain="${ESI_PORTAL_AUTH_DOMAIN:-}"
auth_client_id="${ESI_PORTAL_AUTH_CLIENT_ID:-}"
auth_audience="${ESI_PORTAL_AUTH_AUDIENCE:-}"
check ESI_PORTAL_API_BASE_URL "$api_base_url"
check ESI_PORTAL_AUTH_DOMAIN "$auth_domain"
check ESI_PORTAL_AUTH_CLIENT_ID "$auth_client_id"
check ESI_PORTAL_AUTH_AUDIENCE "$auth_audience"

if [ -z "$auth_domain$auth_client_id$auth_audience" ]; then
  echo "ESI_PORTAL_AUTH_* not set: sign-in is off" >&2
  printf '{ "apiBaseUrl": "%s" }\n' "$api_base_url" > /usr/share/nginx/html/config.json
elif [ -n "$auth_domain" ] && [ -n "$auth_client_id" ] && [ -n "$auth_audience" ]; then
  printf '{ "apiBaseUrl": "%s", "auth": { "domain": "%s", "clientId": "%s", "audience": "%s" } }\n' \
    "$api_base_url" "$auth_domain" "$auth_client_id" "$auth_audience" > /usr/share/nginx/html/config.json
else
  echo "set all of ESI_PORTAL_AUTH_DOMAIN, ESI_PORTAL_AUTH_CLIENT_ID and ESI_PORTAL_AUTH_AUDIENCE, or none" >&2
  exit 1
fi
