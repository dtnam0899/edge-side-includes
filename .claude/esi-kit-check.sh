#!/bin/bash
# ESI kit gate: require developers to have esi-team-claude-kit cloned locally.
# Usage (from .claude/settings.json hooks):
#   esi-kit-check.sh session   SessionStart     -> inject an instruction for Claude
#   esi-kit-check.sh prompt    UserPromptSubmit -> block prompts until the kit is installed
# Config: .claude/esi-kit.conf (KIT_REPO_URL, KIT_MIN_VERSION). Kit location: $ESI_KIT_DIR
# (default ~/esi-team-claude-kit). Bypass for one shell: export ESI_KIT_SKIP=1
set -u

MODE="${1:-session}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
[ -f "$HERE/esi-kit.conf" ] && source "$HERE/esi-kit.conf"
KIT_REPO_URL="${KIT_REPO_URL:-https://github.com/dtnam0899/esi-team-claude-kit.git}"
KIT_MIN_VERSION="${KIT_MIN_VERSION:-0.1.0}"
KIT_DIR="${ESI_KIT_DIR:-$HOME/esi-team-claude-kit}"
PROJECT_DIR="$(cd "$HERE/.." && pwd)"

[ "${ESI_KIT_SKIP:-0}" = "1" ] && exit 0

kit_version() {
  sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$KIT_DIR/.claude-plugin/plugin.json" 2>/dev/null | head -1
}

PROBLEM=""
if [ ! -f "$KIT_DIR/scripts/bootstrap.sh" ]; then
  PROBLEM="esi-team-claude-kit is not installed at $KIT_DIR."
  FIX="git clone $KIT_REPO_URL \"$KIT_DIR\" && \"$KIT_DIR/scripts/bootstrap.sh\" --update \"$PROJECT_DIR\""
else
  CURRENT="$(kit_version)"
  if [ -z "$CURRENT" ] || [ "$(printf '%s\n%s\n' "$KIT_MIN_VERSION" "$CURRENT" | sort -V | head -1)" != "$KIT_MIN_VERSION" ]; then
    PROBLEM="esi-team-claude-kit at $KIT_DIR is ${CURRENT:-of unknown version}; this repository requires >= $KIT_MIN_VERSION."
    FIX="git -C \"$KIT_DIR\" pull && \"$KIT_DIR/scripts/bootstrap.sh\" --update \"$PROJECT_DIR\""
  fi
fi

[ -z "$PROBLEM" ] && exit 0

MSG="ESI standard setup is required. $PROBLEM Run in a terminal: $FIX (then restart Claude Code). To bypass temporarily: export ESI_KIT_SKIP=1."

json_escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }

case "$MODE" in
  session)
    CTX="REQUIRED BEFORE ANY OTHER WORK: $MSG Tell the developer this first and show the exact command; further prompts are blocked until the kit is installed."
    printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$(json_escape "$CTX")"
    ;;
  prompt)
    printf '{"decision":"block","reason":"%s"}\n' "$(json_escape "$MSG")"
    ;;
esac
exit 0
