---
description: Review all working-tree changes and, only after explicit confirmation, commit and push them
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*), Bash(git push:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*)
---

# Review, Commit, and Push All Changes

Use only when the user explicitly invokes this command. This command stages every change, so never proceed if the user has not confirmed that all listed changes belong in one commit.

## 1. Inspect and summarize

Check the current branch, upstream, `git status --short`, `git diff --stat`, staged and unstaged diffs, and the latest commit message. List untracked files separately and inspect their contents as needed to check for secrets and generated artifacts. Do not stage or modify anything yet.

Stop and report if:
- The branch is `develop`, `main` or `master`, there are merge conflicts, or the repository has no appropriate upstream.
- The changes include secrets, credentials, `.env` files, build artifacts, temporary files, or unexpected large files.
- Changes appear unrelated, contain work the user may not own, or cannot be safely reviewed.
- The branch does not identify an `ESI-<number>` ticket. Ask the user for the ticket reference rather than inventing one.

Confirm that the branch follows `type/ESI-<number>-short-description`. For a sub-project ticket, preserve `[PROJECT]` in the ticket/PR title and use the lowercase project code as the commit scope when appropriate.

Present the exact files and change summary, proposed commit message (`type(scope): subject` with `Refs: ESI-<number>` footer), and push target. Ask the user to explicitly confirm staging and pushing all listed files. Wait for confirmation; do not interpret command invocation alone as confirmation to push.

## 2. Commit and push

After explicit confirmation:
1. Stage all changes with `git add -A`, then inspect `git status` and the staged diff.
2. If the staged files differ from the confirmed list or reveal a safety concern, stop and ask again.
3. Commit using the confirmed ESI ticket reference. Do not push if commit creation fails.
4. Push only the current non-protected branch to its confirmed upstream. Never force-push. If a push fails, report the error and ask before any rebase, pull, or retry.

Report the resulting commit and push status. Do not create a PR unless separately requested.
