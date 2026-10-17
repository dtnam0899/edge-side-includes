#!/bin/bash
# Run tests of the sub-projects touched by a commit
# Hook: PreToolUse (matcher: Bash) - only acts on `git commit`
#
# Works for a single project and for a multi-project root (e.g. edge-side-includes/<project>/):
# every top-level directory with changed files is treated as a project and tested with the
# command detected from its manifest. Override per project with a `.esi-test-cmd` file
# (one shell command, run from the project directory); an empty file skips that project.
#
# Exit code 2 blocks the commit; any other non-zero code would NOT block it.
# Opt out: export ESI_SKIP_PRECOMMIT_TESTS=1

INPUT=$(cat)
# shellcheck source=_json.sh
source "$(dirname "${BASH_SOURCE[0]}")/_json.sh"
COMMAND=$(json_get command)
printf '%s\n' "$COMMAND" | grep -qE '(^|[;&|[:space:]])git[[:space:]]+commit([[:space:]]|$)' || exit 0
[ "${ESI_SKIP_PRECOMMIT_TESTS:-0}" = "1" ] && exit 0

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$ROOT" || exit 0

# Files that will be committed: staged, plus tracked changes when `commit -a`/`--all` is used
FILES=$(git diff --cached --name-only)
if printf '%s\n' "$COMMAND" | grep -qE 'git[[:space:]]+commit[^;&|]*[[:space:]](-[a-zA-Z]*a[a-zA-Z]*|--all)([[:space:]]|$)'; then
  FILES=$(printf '%s\n%s\n' "$FILES" "$(git diff --name-only)")
fi
[ -z "$(printf '%s' "$FILES" | tr -d '[:space:]')" ] && exit 0

# Project directories: first path segment for nested files, "." for files at the repo root
PROJECTS=$(printf '%s\n' "$FILES" | grep -v '^$' | awk -F/ 'NF>1{print $1; next}{print "."}' | sort -u)

detect_test_cmd() { # echoes the test command for the current directory, empty if none
  if [ -f .esi-test-cmd ]; then cat .esi-test-cmd; return; fi
  if [ -f package.json ] && grep -q '"test"[[:space:]]*:' package.json; then
    if [ -f angular.json ]; then
      echo "npm test -- --watch=false --browsers=ChromeHeadless"
    else
      echo "CI=true npm test"
    fi
  elif ls ./*.sln ./*.csproj >/dev/null 2>&1; then
    echo "dotnet test --nologo"
  elif [ -f go.mod ]; then
    echo "go test ./..."
  elif [ -f Cargo.toml ]; then
    echo "cargo test"
  elif [ -f pytest.ini ] || [ -f pyproject.toml ] || [ -f setup.py ] || [ -f requirements.txt ]; then
    if command -v pytest >/dev/null 2>&1 && { [ -d tests ] || [ -d test ] || [ -f pytest.ini ]; }; then
      echo "pytest -q"
    fi
  fi
}

RAN=0
for P in $PROJECTS; do
  [ -d "$ROOT/$P" ] || continue
  cd "$ROOT/$P" || continue
  CMD=$(detect_test_cmd)
  [ -z "$CMD" ] && { echo "ℹ️  [$P] no test command detected, skipping" >&2; continue; }
  echo "🧪 [$P] $CMD" >&2
  RAN=1
  if ! bash -c "$CMD" >&2; then
    echo "❌ [$P] tests failed! Commit blocked. (Skip once with ESI_SKIP_PRECOMMIT_TESTS=1, or set the command in $P/.esi-test-cmd)" >&2
    exit 2
  fi
done

[ "$RAN" = "1" ] && echo "✅ Tests passed. Proceeding with commit." >&2
exit 0
