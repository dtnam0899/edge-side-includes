---
id: ADR-0004
type: adr
status: Proposed
date: 2026-10-18
projects: [core, agents]
issues: [ESI-16, ESI-18]
keywords: [sql validation, select only, tsql parser, scriptdom, read-only, timeout, paging, stored procedure, exec, openrowset, select into, allow-list, readonly login]
---

# ADR-0004 SQL validation and execution policy

## Context
- Decisions 6, 10, 15 and SR-3, SR-4, SR-9 in [UR-1](../requirements/UR-1-bi-ai-assistant-web-application.md): the assistant is read-only; only a single SELECT may run; stored procedures are never executed or created; timeout is configurable (default 30 s); results are paged by 20 rows with the remaining count; executed SQL is logged inline.
- AI-generated SQL is untrusted input (SR-9). The product owner chose statement validation as the guarantee, with a recommendation to connect through a read-only database login as defense in depth.
- UR-1 finding: T-SQL is hard to validate completely (`SELECT ... INTO`, `OPENROWSET`/linked servers, functions with side effects).

## Options
1. **Regex or keyword blocklist.** Cheap; easy to bypass (comments, encodings, whitespace); rejected.
2. **Parse with a real T-SQL parser and allow-list the syntax tree.** Robust against formatting tricks; needs maintenance as constructs appear.
3. **Rely only on a read-only login.** Strong at the database, but not under our control and not required by the product owner.

## Decision (proposed)
Take option 2 as the enforced layer and recommend option 3 to users.

- Parse with a T-SQL parser (proposal: ScriptDom, see ADR-0001). Reject on any parse error.
- Accept exactly one batch with exactly one statement, and that statement must be a plain `SELECT` query expression (CTEs allowed only when every part is a query).
- Reject: INSERT, UPDATE, DELETE, MERGE, DDL, `EXEC`/`EXECUTE`, `SELECT ... INTO`, multiple statements or batches (`GO`), `OPENROWSET`, `OPENQUERY`, `OPENDATASOURCE`, linked-server four-part names, `xp_`/`sp_` procedure references, `WAITFOR`, variable assignment, `INTO`, `OPTION` hints that change behavior, and any function call not on the allow-list (system functions are allowed by explicit allow-list; user-defined functions are rejected until a review decides otherwise).
- The allow-list is data in code (not config the user edits). Unknown node types are rejected by default.
- Execution: command timeout from configuration (default 30 s); open the connection with `ApplicationIntent=ReadOnly` where supported; execute within a read-only intent and never in a transaction that commits changes; fetch page by page (20 rows) plus a count of the remaining rows without loading the entire result set; stream and dispose the reader.
- Procedure handling: the agent may read definitions of existing procedures as context; nothing in the system executes a procedure; generated procedure scripts are stored as text and checked read-only (no write or DDL statements in the body) before saving.
- Logging: inline application log with user, connection id, time, duration, outcome and the statement; no result rows, no connection string. Consider masking literals (open question).
- UI and docs recommend a read-only database login.

## Consequences
- ESI-16 owns the validator; the agent (ESI-18) runs its own cheaper checks, but the backend check is the one that enforces the rule.
- A rejected statement is a user-facing validation error with a reason, not a silent empty result.
- Each new SQL Server construct we want to allow requires a test and an allow-list entry.

## Verification
- A corpus of bypass attempts (comments, mixed case, `/**/` between keywords, unicode whitespace, batches, nested EXEC, string concatenation with EXEC, `SELECT INTO`, OPENROWSET, linked server) that must all be rejected; a corpus of valid SELECTs that must pass.
- Integration test on a real SQL Server container proving that a rejected statement never reaches the database.
- Agent evals include prompts that ask for writes, DDL and EXEC and expect refusal.

## Open questions
- Allow-list of functions and whether user-defined functions or views with side effects are accepted.
- Whether to log literals or mask them.
- Maximum result size or cell size, even though no row limit was decided.
