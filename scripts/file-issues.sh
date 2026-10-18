#!/usr/bin/env bash
# Files GitHub issues from a tasks file as sub-issues of a parent UR.
# Dry run by default; --apply creates issues. Needs: gh (authenticated), jq, awk.
# Safe to re-run: a task whose "(<ID>)" tag already appears in an issue title is skipped.
#
# Tasks file format (see docs/process/templates.md):
#   ## <ID> | <project> | <title>
#   <markdown body until the next "## " task heading>
# Lines before the first task heading are ignored. Task headings are lines starting with "## " that match the format.
#
# Usage: scripts/file-issues.sh --file <tasks.md> --parent <ur-issue-number> --label "<label>" [--repo owner/name] [--apply]
set -euo pipefail

REPO="dtnam0899/edge-side-includes"
FILE="" PARENT="" LABEL="" APPLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --file) FILE="$2"; shift 2 ;;
    --parent) PARENT="$2"; shift 2 ;;
    --label) LABEL="$2"; shift 2 ;;
    --repo) REPO="$2"; shift 2 ;;
    --apply) APPLY=1; shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done
[ -f "$FILE" ] && [ -n "$PARENT" ] && [ -n "$LABEL" ] || { echo "Usage: $0 --file <tasks.md> --parent <n> --label <label> [--repo owner/name] [--apply]" >&2; exit 2; }

EXISTING=""
if [ "$APPLY" -eq 1 ]; then
  command -v gh >/dev/null || { echo "gh is not installed" >&2; exit 1; }
  command -v jq >/dev/null || { echo "jq is not installed" >&2; exit 1; }
  gh auth status >/dev/null || { echo "Run 'gh auth login' first" >&2; exit 1; }
  gh label list --repo "$REPO" --limit 200 --json name --jq '.[].name' | grep -qxF "$LABEL" \
    || { echo "Label '$LABEL' does not exist in $REPO; create it first" >&2; exit 1; }
  EXISTING=$(gh issue list --repo "$REPO" --state all --limit 1000 --json title --jq '.[].title')
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
awk -v dir="$TMP" '
  /^## [^|]+\|[^|]+\|.+/ { n++; out = sprintf("%s/%03d.md", dir, n); print substr($0, 4) > (out ".head"); next }
  n > 0 { print > out }
' "$FILE"

count=0
for head in "$TMP"/*.md.head; do
  [ -e "$head" ] || { echo "No tasks found in $FILE" >&2; exit 1; }
  count=$((count + 1))
  IFS='|' read -r id project title < "$head"
  id=$(echo "$id" | xargs); project=$(echo "$project" | xargs); title=$(echo "$title" | xargs)
  body="$(cat "${head%.head}")

---
Task: $id in $FILE. Parent: #$PARENT. Follow docs/process/README.md; branch \`type/ESI-<n>-short-description\`, commit \`type(project): subject\` with \`Refs: ESI-<n>\`."
  if [ "$APPLY" -eq 0 ]; then
    printf '\n=== [%s] %s (%s) ===\n%s\n' "$project" "$title" "$id" "$body"
    continue
  fi
  if printf '%s\n' "$EXISTING" | grep -qF "($id)"; then
    echo "Skipped $id: an issue with this tag already exists"
    continue
  fi
  url=$(gh issue create --repo "$REPO" --label "$LABEL" --title "[$project] $title ($id)" --body "$body")
  num="${url##*/}"
  gh issue edit "$num" --repo "$REPO" --title "ESI-$num [$project] $title ($id)" >/dev/null
  gid=$(gh api "repos/$REPO/issues/$num" --jq .id)
  gh api -X POST "repos/$REPO/issues/$PARENT/sub_issues" -F sub_issue_id="$gid" >/dev/null \
    || echo "Could not link #$num as a sub-issue of #$PARENT; link it manually." >&2
  echo "Created ESI-$num [$project] $title ($id) -> $url"
done
echo "Processed $count task(s) from $FILE"
