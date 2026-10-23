"""Agent-side SQL checks (UR-1 SR-3, ADR-0004).

Cheaper than core-backend's ScriptDom validator, which is the enforcing layer; these checks stop the
agent from returning SQL that core would reject or that is not grounded in the given schema:

- ``query``: one SELECT statement (CTEs allowed), no writes, DDL, EXEC, ``SELECT ... INTO``,
  external data access, variables, hints or batches.
- ``stored-procedure``: one ``CREATE [OR ALTER] PROCEDURE`` script whose body only reads; never a
  procedure that already exists, never a call to any procedure.
- Grounding: every table, qualified column and bare identifier must exist in the schema metadata,
  and FROM/JOIN may read only tables: views are schema context, core executes only user tables.
"""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field

from esi_agents.sql.tokens import Token, TokenizeError, TokenKind, tokenize


@dataclass(frozen=True)
class SqlIssue:
    """One finding. Codes are stable: evals and retries depend on them."""

    code: str
    message: str


@dataclass(frozen=True)
class TableInfo:
    """A table or view of the schema metadata."""

    schema: str
    name: str
    columns: frozenset[str]  # lower-case names
    is_view: bool = False

    @property
    def qualified(self) -> str:
        """``schema.Table`` as listed in ``referencedTables``."""
        return f"{self.schema}.{self.name}"


@dataclass
class SchemaIndex:
    """Lookup of the schema metadata the SQL must be grounded in (names are case-insensitive)."""

    tables: dict[tuple[str, str], TableInfo] = field(default_factory=dict)
    procedures: set[str] = field(default_factory=set)  # lower-case names, with and without schema

    def add_table(
        self, schema: str, name: str, columns: Iterable[str], *, is_view: bool = False
    ) -> None:
        """Register a table or view."""
        info = TableInfo(schema, name, frozenset(c.lower() for c in columns), is_view)
        self.tables[(schema.lower(), name.lower())] = info

    def add_procedure(self, schema: str, name: str) -> None:
        """Register an existing stored procedure."""
        self.procedures.update({name.lower(), f"{schema}.{name}".lower()})

    def resolve(self, parts: Sequence[str]) -> TableInfo | None:
        """Resolve ``Table`` or ``schema.Table``; a bare name prefers ``dbo``, else one match."""
        if len(parts) == 2:
            return self.tables.get((parts[0].lower(), parts[1].lower()))
        if len(parts) != 1:
            return None
        name = parts[0].lower()
        if (dbo := self.tables.get(("dbo", name))) is not None:
            return dbo
        matches = [t for (_, n), t in self.tables.items() if n == name]
        return matches[0] if len(matches) == 1 else None


@dataclass
class SqlAnalysis:
    """Outcome of a check: issues (empty means accepted) and the tables the SQL reads."""

    issues: list[SqlIssue] = field(default_factory=list)
    referenced_tables: list[str] = field(default_factory=list)
    procedure_name: str | None = None

    @property
    def ok(self) -> bool:
        """Whether the SQL passed every check."""
        return not self.issues


_WRITE = {"INSERT", "UPDATE", "DELETE", "MERGE", "TRUNCATE", "BULK", "UPDATETEXT", "WRITETEXT"}
_DDL = {"CREATE", "ALTER", "DROP", "GRANT", "REVOKE", "DENY", "RENAME"}
_EXEC = {"EXEC", "EXECUTE"}
_EXTERNAL = {"OPENROWSET", "OPENQUERY", "OPENDATASOURCE", "OPENXML"}
_INTO = {"INTO"}
_OTHER = {
    "WAITFOR", "BACKUP", "RESTORE", "DBCC", "SHUTDOWN", "KILL", "USE", "RECONFIGURE", "CHECKPOINT",
    "COMMIT", "ROLLBACK", "SAVE", "TRAN", "TRANSACTION", "RAISERROR", "THROW", "PRINT", "READTEXT",
    "OPTION", "CURSOR", "OPEN", "FETCH", "CLOSE", "DEALLOCATE", "GOTO", "ENABLE", "DISABLE", "GO",
}  # fmt: skip
_FORBIDDEN = _WRITE | _DDL | _EXEC | _EXTERNAL | _INTO | _OTHER
# Only in a query; a procedure body may declare and set local variables and use blocks.
_QUERY_ONLY = {"DECLARE", "SET", "BEGIN", "IF", "WHILE", "RETURN"}

# Words that are never column names. Type names, date parts and keywords used in SELECT statements.
_KEYWORDS = {
    "SELECT", "FROM", "WHERE", "GROUP", "BY", "ORDER", "HAVING", "TOP", "DISTINCT", "AS", "ON",
    "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "OUTER", "CROSS", "APPLY", "UNION", "ALL", "EXCEPT",
    "INTERSECT", "AND", "OR", "NOT", "IN", "IS", "NULL", "LIKE", "BETWEEN", "EXISTS", "CASE",
    "WHEN", "THEN", "ELSE", "END", "ASC", "DESC", "WITH", "OVER", "PARTITION", "ROWS", "RANGE",
    "UNBOUNDED", "PRECEDING", "FOLLOWING", "CURRENT", "ROW", "OFFSET", "NEXT", "ONLY", "FIRST",
    "PERCENT", "TIES", "ANY", "SOME", "ESCAPE", "COLLATE", "FOR", "XML", "JSON", "PATH", "AUTO",
    "RAW", "NOLOCK", "VALUES", "WITHIN", "CURRENT_TIMESTAMP", "INT", "BIGINT", "SMALLINT",
    "TINYINT", "DECIMAL", "NUMERIC", "MONEY", "SMALLMONEY", "FLOAT", "REAL", "BIT", "DATE",
    "DATETIME", "DATETIME2", "SMALLDATETIME", "DATETIMEOFFSET", "TIME", "CHAR", "NCHAR", "VARCHAR",
    "NVARCHAR", "MAX", "VARBINARY", "BINARY", "UNIQUEIDENTIFIER", "YEAR", "QUARTER", "MONTH",
    "DAYOFYEAR", "DAY", "WEEK", "WEEKDAY", "HOUR", "MINUTE", "SECOND", "MILLISECOND",
    "MICROSECOND", "NANOSECOND", "ISO_WEEK", "YY", "YYYY", "QQ", "MM", "DY", "DD", "WK", "WW",
    "DW", "HH", "MI", "SS", "MS", "MCS", "NS",
    # procedure scripts
    "PROC", "PROCEDURE", "NOCOUNT", "OUTPUT", "OUT", "READONLY", "DECLARE", "SET", "BEGIN", "IF",
    "WHILE", "RETURN", "OFF",
}  # fmt: skip
# System functions an agent may call (ADR-0004: user-defined functions are rejected).
_FUNCTIONS = {
    "COUNT", "COUNT_BIG", "SUM", "AVG", "MIN", "MAX", "STDEV", "STDEVP", "VAR", "VARP",
    "STRING_AGG", "GROUPING", "ROW_NUMBER", "RANK", "DENSE_RANK", "NTILE", "LAG", "LEAD",
    "FIRST_VALUE", "LAST_VALUE", "PERCENTILE_CONT", "PERCENTILE_DISC", "CAST", "CONVERT",
    "TRY_CAST", "TRY_CONVERT", "COALESCE", "ISNULL", "NULLIF", "IIF", "CHOOSE", "YEAR", "MONTH",
    "DAY", "DATEPART", "DATENAME", "DATEADD", "DATEDIFF", "DATEDIFF_BIG", "EOMONTH",
    "DATEFROMPARTS", "DATETRUNC", "GETDATE", "GETUTCDATE", "SYSDATETIME", "SYSUTCDATETIME",
    "FORMAT", "UPPER", "LOWER", "LTRIM", "RTRIM", "TRIM", "LEN", "DATALENGTH", "SUBSTRING", "LEFT",
    "RIGHT", "REPLACE", "CONCAT", "CONCAT_WS", "CHARINDEX", "PATINDEX", "STUFF", "REPLICATE",
    "REVERSE", "ROUND", "FLOOR", "CEILING", "ABS", "POWER", "SQRT", "SIGN", "EXP", "LOG", "LOG10",
    "SQUARE", "PI",
}  # fmt: skip
_JOIN_STARTS = {"FROM", "JOIN", "APPLY"}


def check_query(sql: str, schema: SchemaIndex) -> SqlAnalysis:
    """Check SQL meant for execution: exactly one grounded SELECT statement."""
    tokens, analysis = _tokens(sql)
    if tokens is None:
        return analysis
    if not (tokens[0].is_word("SELECT", "WITH")):
        analysis.issues.append(
            SqlIssue("not-select", "SQL for execution must be a SELECT statement")
        )
    _statement_rules(tokens, schema, analysis, forbidden=_FORBIDDEN)
    for token in tokens:
        if token.kind is TokenKind.VARIABLE:
            analysis.issues.append(
                SqlIssue("variable", f"variables are not allowed: {token.value}")
            )
        elif token.is_word(*_QUERY_ONLY):
            analysis.issues.append(SqlIssue("forbidden-construct", f"{token.upper} is not allowed"))
    _ground(tokens, schema, analysis)
    return analysis


def check_procedure_script(sql: str, schema: SchemaIndex) -> SqlAnalysis:
    """Check a stored-procedure script: one new procedure whose body only reads grounded data."""
    tokens, analysis = _tokens(sql)
    if tokens is None:
        return analysis
    body_start = _procedure_header(tokens, schema, analysis)
    if body_start is None:
        return analysis
    body = tokens[body_start:]
    _statement_rules(body, schema, analysis, forbidden=_FORBIDDEN, script=True)
    if not any(t.is_word("SELECT") for t in body):
        analysis.issues.append(
            SqlIssue("no-select", "the procedure body must read data with SELECT")
        )
    for index, token in enumerate(body):
        if token.is_word("SET") and not _allowed_set(body, index):
            analysis.issues.append(
                SqlIssue("forbidden-construct", "only SET NOCOUNT ON and SET @variable are allowed")
            )
    _ground(body, schema, analysis)
    return analysis


def _tokens(sql: str) -> tuple[list[Token] | None, SqlAnalysis]:
    analysis = SqlAnalysis()
    try:
        tokens = tokenize(sql)
    except TokenizeError as error:
        analysis.issues.append(SqlIssue("parse-error", str(error)))
        return None, analysis
    if not tokens:
        analysis.issues.append(SqlIssue("empty", "no SQL text"))
        return None, analysis
    return tokens, analysis


def _statement_rules(
    tokens: list[Token],
    schema: SchemaIndex,
    analysis: SqlAnalysis,
    *,
    forbidden: set[str],
    script: bool = False,
) -> None:
    """Rules shared by queries and procedure bodies."""
    for index, token in enumerate(tokens):
        upper = token.upper
        if token.kind is TokenKind.WORD and upper in forbidden:
            analysis.issues.append(_forbidden_issue(upper))
        if token.is_punct(";") and not script and index != len(tokens) - 1:
            analysis.issues.append(SqlIssue("multiple-statements", "only one statement is allowed"))
        if token.is_identifier and upper.startswith(("SP_", "XP_")):
            analysis.issues.append(
                SqlIssue("system-procedure", f"system procedures are not allowed: {token.value}")
            )
        if token.is_identifier and _is_procedure_reference(tokens, index, schema):
            analysis.issues.append(
                SqlIssue(
                    "procedure-reference",
                    f"existing procedure {token.value} may be read as context but never called",
                )
            )
    for parts, _ in _dotted_names(tokens):
        if len(parts) >= 4:
            analysis.issues.append(
                SqlIssue("linked-server", f"linked-server names are not allowed: {'.'.join(parts)}")
            )


def _forbidden_issue(word: str) -> SqlIssue:
    if word in _WRITE:
        return SqlIssue("write-statement", f"{word} changes data and is not allowed")
    if word in _DDL:
        return SqlIssue("ddl", f"{word} is a DDL or permission statement and is not allowed")
    if word in _EXEC:
        return SqlIssue(
            "exec", f"{word} runs code and is not allowed; procedures are never executed"
        )
    if word in _EXTERNAL:
        return SqlIssue("external-data", f"{word} reads external data and is not allowed")
    if word in _INTO:
        return SqlIssue("select-into", "SELECT ... INTO creates a table and is not allowed")
    return SqlIssue("forbidden-construct", f"{word} is not allowed")


def _is_procedure_reference(tokens: list[Token], index: int, schema: SchemaIndex) -> bool:
    """A name of an existing procedure used anywhere outside a dotted column reference."""
    name = tokens[index].value.lower()
    if index >= 2 and tokens[index - 1].is_punct(".") and tokens[index - 2].is_identifier:
        name = f"{tokens[index - 2].value}.{tokens[index].value}".lower()
        return name in schema.procedures
    after_dot = index + 1 < len(tokens) and tokens[index + 1].is_punct(".")
    return not after_dot and name in schema.procedures


def _allowed_set(tokens: list[Token], index: int) -> bool:
    nxt = tokens[index + 1] if index + 1 < len(tokens) else None
    if nxt is None:
        return False
    if nxt.kind is TokenKind.VARIABLE:
        return True
    return nxt.is_word("NOCOUNT") and index + 2 < len(tokens) and tokens[index + 2].is_word("ON")


def _procedure_header(
    tokens: list[Token], schema: SchemaIndex, analysis: SqlAnalysis
) -> int | None:
    """Validate ``CREATE [OR ALTER] PROC[EDURE] name ... AS``; return where the body starts."""
    i = 0
    if not tokens[i].is_word("CREATE"):
        analysis.issues.append(
            SqlIssue("not-procedure", "a procedure script must start with CREATE PROCEDURE")
        )
        return None
    i += 1
    if i + 1 < len(tokens) and tokens[i].is_word("OR") and tokens[i + 1].is_word("ALTER"):
        i += 2
    if i >= len(tokens) or not tokens[i].is_word("PROC", "PROCEDURE"):
        analysis.issues.append(
            SqlIssue("not-procedure", "a procedure script must start with CREATE PROCEDURE")
        )
        return None
    i += 1
    names = _dotted_names(tokens[i:])
    if not names or names[0][1] != 0:
        analysis.issues.append(SqlIssue("not-procedure", "the procedure has no name"))
        return None
    parts, _ = names[0]
    i += 2 * len(parts) - 1
    analysis.procedure_name = ".".join(parts)
    if ".".join(parts).lower() in schema.procedures or parts[-1].lower() in schema.procedures:
        analysis.issues.append(
            SqlIssue(
                "procedure-exists",
                f"{analysis.procedure_name} already exists; a script must not replace it",
            )
        )
    while i < len(tokens):
        token = tokens[i]
        if token.is_word("AS") and tokens[i - 1].kind is not TokenKind.VARIABLE:
            return i + 1
        if token.is_word("WITH", *_EXEC):
            analysis.issues.append(
                SqlIssue("forbidden-construct", "procedure options (WITH ...) are not allowed")
            )
        i += 1
    analysis.issues.append(SqlIssue("not-procedure", "the procedure has no AS body"))
    return None


def _dotted_names(tokens: list[Token]) -> list[tuple[list[str], int]]:
    """Every maximal ``a.b.c`` identifier chain with the index of its first token."""
    chains: list[tuple[list[str], int]] = []
    i = 0
    while i < len(tokens):
        if tokens[i].is_identifier and not (i > 0 and tokens[i - 1].is_punct(".")):
            parts, j = [tokens[i].value], i
            while (
                j + 2 < len(tokens) and tokens[j + 1].is_punct(".") and tokens[j + 2].is_identifier
            ):
                parts.append(tokens[j + 2].value)
                j += 2
            chains.append((parts, i))
            i = j + 1
        else:
            i += 1
    return chains


def _ground(tokens: list[Token], schema: SchemaIndex, analysis: SqlAnalysis) -> None:
    """Tables, qualified columns and bare identifiers must exist in the schema metadata."""
    ctes = _cte_names(tokens)
    aliases: dict[str, TableInfo | None] = {}  # alias -> table, None for a derived table or CTE
    referenced: dict[str, TableInfo] = {}
    table_positions: set[int] = set()
    other_names: set[str] = set()  # column aliases

    for index, token in enumerate(tokens):
        if token.is_word("AS") and index + 1 < len(tokens) and tokens[index + 1].is_identifier:
            if not (index + 2 < len(tokens) and tokens[index + 2].is_punct("(")):
                other_names.add(tokens[index + 1].value.lower())
        if not token.is_word(*_JOIN_STARTS):
            continue
        i = index + 1
        while i < len(tokens):
            if tokens[i].is_punct("("):  # derived table: its alias is resolved like a CTE
                i = _skip_parens(tokens, i)
                i = _alias(tokens, i, None, aliases, table_positions)
            elif tokens[i].is_identifier:
                parts, _ = _dotted_names(tokens[i:])[0]
                end = i + 2 * len(parts) - 1
                table_positions.update(range(i, end))
                if end < len(tokens) and tokens[end].is_punct("("):
                    analysis.issues.append(
                        SqlIssue("unknown-function", f"table-valued function {'.'.join(parts)}")
                    )
                    end = _skip_parens(tokens, end)
                    table = None
                elif len(parts) == 1 and parts[0].lower() in ctes:
                    table = None
                elif (table := schema.resolve(parts)) is None:
                    analysis.issues.append(
                        SqlIssue(
                            "unknown-table", f"{'.'.join(parts)} is not in the schema metadata"
                        )
                    )
                else:
                    if table.is_view:
                        analysis.issues.append(
                            SqlIssue(
                                "view-not-allowed",
                                f"{table.qualified} is a view; views are context only, "
                                "read the tables it is built on",
                            )
                        )
                    referenced[table.qualified] = table
                    aliases[table.name.lower()] = table
                i = _alias(tokens, end, table, aliases, table_positions)
            else:
                break
            if i < len(tokens) and tokens[i].is_punct(",") and token.is_word("FROM"):
                i += 1
                continue
            break

    analysis.referenced_tables = sorted(referenced)
    known_columns = set().union(*(t.columns for t in referenced.values())) if referenced else set()
    names = ctes | other_names | set(aliases)

    for parts, start in _dotted_names(tokens):
        if start in table_positions:
            continue
        follows_paren = start + 2 * len(parts) - 1 < len(tokens) and tokens[
            start + 2 * len(parts) - 1
        ].is_punct("(")
        if len(parts) == 1:
            _ground_bare(tokens[start], follows_paren, known_columns, names, ctes, analysis)
        elif len(parts) == 2:
            qualifier, column = parts[0].lower(), parts[1]
            table = aliases.get(qualifier)
            if table is None and qualifier not in aliases and qualifier not in ctes:
                analysis.issues.append(
                    SqlIssue("unknown-table", f"{parts[0]} is not a table or alias in this query")
                )
            elif table is not None and column != "*" and column.lower() not in table.columns:
                analysis.issues.append(
                    SqlIssue("unknown-column", f"{table.qualified} has no column {column}")
                )
        # Longer chains are reported as linked-server names or resolved as tables.


def _ground_bare(
    token: Token,
    follows_paren: bool,
    known_columns: set[str],
    names: set[str],
    ctes: set[str],
    analysis: SqlAnalysis,
) -> None:
    upper, lower = token.upper, token.value.lower()
    if follows_paren and token.kind is TokenKind.WORD:
        if upper not in _FUNCTIONS and upper not in _KEYWORDS and lower not in ctes:
            analysis.issues.append(
                SqlIssue("unknown-function", f"{token.value} is not an allowed system function")
            )
        return
    if token.kind is TokenKind.WORD and (upper in _KEYWORDS or upper in _FUNCTIONS):
        return
    if lower in known_columns or lower in names:
        return
    analysis.issues.append(
        SqlIssue("unknown-column", f"{token.value} is not a column of the referenced tables")
    )


def _cte_names(tokens: list[Token]) -> set[str]:
    """Names defined as ``name AS (`` or ``name (columns) AS (``, plus their column lists."""
    names: set[str] = set()
    for i, token in enumerate(tokens):
        if not token.is_identifier:
            continue
        j = i + 1
        columns: list[str] = []
        if j < len(tokens) and tokens[j].is_punct("("):
            end = _skip_parens(tokens, j)
            columns = [t.value.lower() for t in tokens[j + 1 : end - 1] if t.is_identifier]
            j = end
        if j + 1 < len(tokens) and tokens[j].is_word("AS") and tokens[j + 1].is_punct("("):
            if token.is_word("CAST", "CONVERT", "TRY_CAST", "TRY_CONVERT"):
                continue
            names.add(token.value.lower())
            names.update(columns)
    return names


def _alias(
    tokens: list[Token],
    i: int,
    table: TableInfo | None,
    aliases: dict[str, TableInfo | None],
    positions: set[int],
) -> int:
    """Consume an optional ``[AS] alias`` after a table reference."""
    if i < len(tokens) and tokens[i].is_word("AS"):
        i += 1
    if i < len(tokens) and tokens[i].is_identifier and not _is_clause_word(tokens[i]):
        aliases[tokens[i].value.lower()] = table
        positions.add(i)
        i += 1
    if i < len(tokens) and tokens[i].is_word("WITH") and i + 1 < len(tokens):
        if tokens[i + 1].is_punct("("):  # table hint, e.g. WITH (NOLOCK)
            i = _skip_parens(tokens, i + 1)
    return i


def _is_clause_word(token: Token) -> bool:
    return token.kind is TokenKind.WORD and token.upper in _KEYWORDS | {"GO"}


def _skip_parens(tokens: list[Token], i: int) -> int:
    """Index after the parenthesis group that opens at ``i``."""
    depth = 0
    while i < len(tokens):
        if tokens[i].is_punct("("):
            depth += 1
        elif tokens[i].is_punct(")"):
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return i
