#!/bin/bash
# Shared helper, sourced by the hooks (not a hook itself).
# json_get KEY: print the first string value of KEY found in $INPUT (hook JSON from stdin).
# Uses jq when available; falls back to sed, which cannot handle escaped quotes.
json_get() {
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r --arg k "$1" \
      '[.. | objects | select(has($k)) | .[$k] | select(type == "string")] | first // empty' 2>/dev/null
  else
    printf '%s' "$INPUT" | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -1
  fi
}
