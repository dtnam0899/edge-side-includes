#!/bin/sh
# Turns the portal's built static files into a Vercel Build Output API (v3) directory for `vercel deploy --prebuilt`.
# Nothing is built here: the static files come from the portal's Docker `check` stage (root CLAUDE.md, rule 3).
#   build-output.sh <static-dir> <output-dir> [core-url]
# <output-dir> is replaced. With a core URL, /api/* is proxied to it with the prefix removed (as in the portal's
# proxy.conf.json and infra/e2e/gateway); without one, /api/* answers 503 so API calls never get index.html.
# Cache headers match web/esi-portal/docker/nginx.conf; the long asset cache is set in the `hit` phase, so only
# files that exist get it and a missing asset's 404 is not cached.
# /config.json is written here like web/esi-portal/docker/40-esi-config.sh does at container start: `apiBaseUrl`
# `/api` plus Auth0 sign-in from ESI_PORTAL_AUTH_DOMAIN, ESI_PORTAL_AUTH_CLIENT_ID and ESI_PORTAL_AUTH_AUDIENCE
# (all three, or none for sign-in off; public SPA client settings, not secrets; infra/auth0/README.md).
set -eu

static_dir=${1:?usage: build-output.sh <static-dir> <output-dir> [core-url]}
output_dir=${2:?usage: build-output.sh <static-dir> <output-dir> [core-url]}
core_url=${3:-}

[ -f "$static_dir/index.html" ] || { echo "$static_dir has no index.html" >&2; exit 1; }

no_quotes() {
  # shellcheck disable=SC1003 # '\' is a literal backslash pattern, not an escape
  case "$2" in
    *'"'*|*'\'*|*' '*) echo "$1 must not contain quotes, backslashes or spaces" >&2; exit 1 ;;
  esac
}

auth_domain=${ESI_PORTAL_AUTH_DOMAIN:-}
auth_client_id=${ESI_PORTAL_AUTH_CLIENT_ID:-}
auth_audience=${ESI_PORTAL_AUTH_AUDIENCE:-}
no_quotes ESI_PORTAL_AUTH_DOMAIN "$auth_domain"
no_quotes ESI_PORTAL_AUTH_CLIENT_ID "$auth_client_id"
no_quotes ESI_PORTAL_AUTH_AUDIENCE "$auth_audience"
if [ -z "$auth_domain$auth_client_id$auth_audience" ]; then
  echo "warning: no ESI_PORTAL_AUTH_*; sign-in is off" >&2
  portal_config='{ "apiBaseUrl": "/api" }'
elif [ -n "$auth_domain" ] && [ -n "$auth_client_id" ] && [ -n "$auth_audience" ]; then
  portal_config="{ \"apiBaseUrl\": \"/api\", \"auth\": { \"domain\": \"$auth_domain\", \"clientId\": \"$auth_client_id\", \"audience\": \"$auth_audience\" } }"
else
  echo "set all of ESI_PORTAL_AUTH_DOMAIN, ESI_PORTAL_AUTH_CLIENT_ID and ESI_PORTAL_AUTH_AUDIENCE, or none" >&2
  exit 1
fi

if [ -n "$core_url" ]; then
  # shellcheck disable=SC1003 # '\' is a literal backslash pattern, not an escape
  case "$core_url" in
    *'"'*|*'\'*|*' '*) echo "core URL must not contain quotes, backslashes or spaces" >&2; exit 1 ;;
    https://*) ;;
    *) echo "core URL must start with https://" >&2; exit 1 ;;
  esac
  core_url=${core_url%/}
  api_route="{ \"src\": \"^/api(/.*)?\$\", \"dest\": \"$core_url\$1\" }"
else
  echo "warning: no core URL; /api/* answers 503" >&2
  api_route='{ "src": "^/api(/.*)?$", "status": 503 }'
fi

rm -rf "$output_dir"
mkdir -p "$output_dir/static"
cp -R "$static_dir"/. "$output_dir/static/"
printf '%s\n' "$portal_config" > "$output_dir/static/config.json"

cat > "$output_dir/config.json" <<EOF
{
  "version": 3,
  "routes": [
    $api_route,
    { "src": "^/config\\\\.json\$", "headers": { "Cache-Control": "no-store" }, "continue": true },
    { "src": "^/(index\\\\.html)?\$", "headers": { "Cache-Control": "no-cache" }, "continue": true },
    { "handle": "filesystem" },
    { "src": "^/.*\\\\.(?:js|css|woff2?|ico|svg|png)\$", "status": 404 },
    { "src": "^/.*\$", "dest": "/index.html", "headers": { "Cache-Control": "no-cache" } },
    { "handle": "hit" },
    { "src": "^/.*\\\\.(?:js|css|woff2?|ico|svg|png)\$", "headers": { "Cache-Control": "public, max-age=31536000, immutable" }, "continue": true }
  ]
}
EOF
