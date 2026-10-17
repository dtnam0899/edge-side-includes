#!/bin/bash
# Auto-format code after writing
# Hook: PostToolUse (matcher: Write|Edit)
#
# Reads the target file path from stdin JSON and runs the appropriate formatter
# in-place on the file after Claude writes it.
#
# Compatible with: macOS, Linux, Windows (Git Bash)

# Read JSON input from stdin (Claude Code hook protocol)
INPUT=$(cat)
# shellcheck source=_json.sh
source "$(dirname "${BASH_SOURCE[0]}")/_json.sh"

# Extract file_path using sed (compatible with all platforms)
FILE_PATH=$(json_get file_path)

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Detect file type and format accordingly
case "$FILE_PATH" in
  *.js|*.jsx|*.ts|*.tsx|*.html|*.css|*.scss|*.json)
    # Prefer the project's own prettier (node_modules/.bin) over a global one
    DIR=$(dirname "$FILE_PATH")
    PRETTIER=""
    while [ "$DIR" != "/" ] && [ "$DIR" != "." ]; do
      if [ -x "$DIR/node_modules/.bin/prettier" ]; then PRETTIER="$DIR/node_modules/.bin/prettier"; break; fi
      DIR=$(dirname "$DIR")
    done
    [ -z "$PRETTIER" ] && command -v prettier &> /dev/null && PRETTIER=prettier
    [ -n "$PRETTIER" ] && "$PRETTIER" --write "$FILE_PATH" 2>/dev/null
    ;;
  *.cs)
    if command -v dotnet &> /dev/null; then
      dotnet format --include "$FILE_PATH" 2>/dev/null
    fi
    ;;
  *.py)
    if command -v ruff &> /dev/null; then
      ruff check --fix --quiet "$FILE_PATH" 2>/dev/null
      ruff format --quiet "$FILE_PATH" 2>/dev/null
    fi
    ;;
  *.go)
    if command -v gofmt &> /dev/null; then
      gofmt -w "$FILE_PATH" 2>/dev/null
    fi
    ;;
  *.rs)
    if command -v rustfmt &> /dev/null; then
      rustfmt "$FILE_PATH" 2>/dev/null
    fi
    ;;
  *.java)
    if command -v google-java-format &> /dev/null; then
      google-java-format -i "$FILE_PATH" 2>/dev/null
    fi
    ;;
esac

exit 0
