---
name: react-conventions
description: React conventions for ESI web code. Use when creating or editing React components, hooks, streaming UI, or tests.
---

# React conventions

Commands and versions live in the project `CLAUDE.md`; general rules in `clean-code-rules.md` (claude-howto).

- Function components and hooks only. Keep components small and rendering pure; move logic into custom hooks.
- Group by feature (`src/features/<name>/` with its components, hooks and state); keep API access in one `api` layer.
- Streaming (SSE/WebSocket): consume in a hook, append chunks immutably, support abort, show error and retry states, clean up on unmount.
- Model/AI output is untrusted: render as text, never `dangerouslySetInnerHTML`; render generated UI only from schema-validated data.
- State: local first, lift or use the project's store only when shared; derive values instead of syncing state with effects.
- Strict TypeScript, no `any`; stable `key`s; memoize only after measuring.
- Accessibility: semantic elements, labels, `aria-live` for streaming content, focus management.
- Tests: Vitest or Jest with React Testing Library, query by role/text, mock the stream source; use the project's test command.
