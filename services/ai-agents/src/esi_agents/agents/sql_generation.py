"""SQL generation agent (operation ``generateSql``, UR-1 SR-3).

The model proposes; this agent checks every candidate with the SQL policy and the schema metadata
and retries with the findings. SQL that breaks a rule is never returned: after the last retry the
answer is ``kind: none`` with the reasons. Nothing is executed here or anywhere in this service.
"""

from pydantic import ValidationError

from esi_agents.agents.output import ModelOutputError, describe, enum_value, parse_json_object
from esi_agents.config import Settings
from esi_agents.contracts.agents_api import (
    SchemaMetadata,
    SqlGenerationRequest,
    SqlGenerationResult,
)
from esi_agents.llm import ModelClient, guarded_complete
from esi_agents.prompts import SQL_GENERATION, render
from esi_agents.sql import SchemaIndex, SqlIssue, check_procedure_script, check_query
from esi_agents.sql.tokens import TokenizeError, TokenKind, tokenize


def schema_index(metadata: SchemaMetadata) -> SchemaIndex:
    """Index the tables, views and procedures the SQL may use."""
    index = SchemaIndex()
    for schema in metadata.schemas:
        for table in schema.tables:
            index.add_table(schema.name, table.name, (c.name for c in table.columns))
        for procedure in schema.procedures:
            index.add_procedure(schema.name, procedure.name)
    return index


def mask_literals(sql: str) -> str:
    """Replace string literals with ``'?'``; procedure definitions may embed values (ADR-0004)."""
    try:
        tokens = tokenize(sql)
    except TokenizeError:
        return "-- definition omitted: it could not be read safely"
    out, last = [], 0
    for token in tokens:
        if token.kind is TokenKind.STRING:
            out.append(sql[last : token.offset])
            out.append("'?'")
            last = token.offset + len(token.value)
    out.append(sql[last:])
    return "".join(out)


def describe_schema(metadata: SchemaMetadata) -> str:
    """Schema context for the prompt: structure and procedure definitions, never row values."""
    lines: list[str] = []
    for schema in metadata.schemas:
        for table in schema.tables:
            columns = ", ".join(
                f"{c.name} {c.sql_type}{'' if c.nullable else ' NOT NULL'}" for c in table.columns
            )
            lines.append(f"{enum_value(table.kind)} {schema.name}.{table.name} ({columns})")
            if table.primary_key:
                lines.append(f"  primary key ({', '.join(table.primary_key)})")
            for fk in table.foreign_keys or []:
                lines.append(
                    f"  foreign key ({', '.join(fk.columns)}) references "
                    f"{fk.referenced_schema}.{fk.referenced_table} "
                    f"({', '.join(fk.referenced_columns)})"
                )
        for procedure in schema.procedures:
            lines.append(f"existing procedure {schema.name}.{procedure.name} (never execute):")
            lines.append(mask_literals(procedure.definition))
    return "\n".join(lines) or "(no tables)"


def _issues_text(issues: list[SqlIssue]) -> str:
    if not issues:
        return ""
    found = "\n".join(f"- {issue.code}: {issue.message}" for issue in issues)
    return f"\nYOUR PREVIOUS ANSWER WAS REJECTED\n{found}\nFix every finding."


class SqlGenerationAgent:
    """Generate a checked SQL candidate for a question."""

    def __init__(self, model: ModelClient, settings: Settings) -> None:
        self._model = model
        self._settings = settings

    async def generate(self, request: SqlGenerationRequest) -> SqlGenerationResult:
        """Return a query, a read-only procedure script, or ``none`` with an explanation."""
        index = schema_index(request.schema_)
        schema_text = describe_schema(request.schema_)
        history = "\n".join(f"{enum_value(m.role)}: {m.text}" for m in request.history or [])
        issues: list[SqlIssue] = []
        for _ in range(self._settings.sql_max_retries + 1):
            prompt = render(
                SQL_GENERATION,
                schema=schema_text,
                history=history or "(none)",
                question=request.question,
                issues=_issues_text(issues),
            )
            output = await guarded_complete(self._model, prompt, self._settings)
            result, issues = self._check(output, index)
            if result is not None:
                return result
        reasons = "; ".join(f"{issue.code}: {issue.message}" for issue in issues)
        return SqlGenerationResult.model_validate(
            {
                "kind": "none",
                "sql": "",
                "explanation": "No SQL was produced because no candidate passed the checks "
                f"({reasons}).",
                "referencedTables": [],
            }
        )

    def _check(
        self, output: str, index: SchemaIndex
    ) -> tuple[SqlGenerationResult | None, list[SqlIssue]]:
        try:
            data = parse_json_object(output)
            candidate = SqlGenerationResult.model_validate({"referencedTables": [], **data})
        except (ModelOutputError, ValidationError) as error:
            return None, [SqlIssue("invalid-output", describe(error))]
        kind = enum_value(candidate.kind)
        if not candidate.explanation.strip():
            return None, [SqlIssue("missing-explanation", "explain the assumptions or the refusal")]
        if kind == "none":
            return _result("none", "", candidate.explanation, [], None), []
        analysis = (
            check_query(candidate.sql, index)
            if kind == "query"
            else check_procedure_script(candidate.sql, index)
        )
        if not analysis.ok:
            return None, analysis.issues
        return (
            _result(
                kind,
                candidate.sql,
                candidate.explanation,
                analysis.referenced_tables,
                analysis.procedure_name,
            ),
            [],
        )


def _result(
    kind: str, sql: str, explanation: str, tables: list[str], procedure: str | None
) -> SqlGenerationResult:
    data: dict[str, object] = {
        "kind": kind,
        "sql": sql,
        "explanation": explanation,
        "referencedTables": tables,
    }
    if procedure is not None:
        data["procedureName"] = procedure
    return SqlGenerationResult.model_validate(data)
