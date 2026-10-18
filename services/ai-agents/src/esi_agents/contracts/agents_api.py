# Generated from @dtnam0899/esi-contracts 0.1.0 (bundled/agents-api.yaml)
# by datamodel-code-generator. Do not edit: run scripts/sync-published.sh.

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class FieldError(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
    )
    field: str = Field(..., description="Name or JSON pointer of the invalid field.")
    message: str


class ValidationIssue(BaseModel):
    """
    One DSL or SQL validation finding.
    """

    model_config = ConfigDict(
        populate_by_name=True,
    )
    code: str = Field(..., examples=["unknown-bound-column"])
    message: str
    path: str | None = Field(
        None,
        description="JSON pointer into the validated document, when it applies.",
        examples=["/components/3/text"],
    )


class PageInfo(BaseModel):
    """
    Paging of a query result. Pages are numbered from 1 and hold at most `size` rows (20). Paging is stateless: every page re-runs the statement, so live data may shift between pages.
    """

    model_config = ConfigDict(
        populate_by_name=True,
    )
    number: int = Field(..., examples=[1], ge=1)
    size: int = Field(..., examples=[20], ge=1)
    remaining_rows: int = Field(
        ...,
        alias="remainingRows",
        description="Rows after this page.",
        examples=[42],
        ge=0,
    )


class ColumnDefinition(BaseModel):
    """
    One column of a query result or table. Names are unique within a result.
    """

    model_config = ConfigDict(
        populate_by_name=True,
    )
    name: str = Field(..., examples=["CustomerName"])
    sql_type: str = Field(
        ...,
        alias="sqlType",
        description="SQL Server type name with length/precision where it applies.",
        examples=["nvarchar(200)"],
    )
    nullable: bool


class SqlOutputKind(StrEnum):
    """
    What generated SQL is: `query` (a single SELECT that may be executed after review), `stored-procedure` (a script the user runs themselves; never executed or created by the system), or `none` (no SQL; the explanation says why, for example missing schema information or a refused request).
    """

    query = "query"
    stored_procedure = "stored-procedure"
    none = "none"


class Kind(StrEnum):
    table = "table"
    kpi = "kpi"


class VisualizationIntent(BaseModel):
    """
    What the user wants to see. Only `table` and `kpi` exist in this version; charts and forms are refused with a `visualization-not-supported` problem.
    """

    model_config = ConfigDict(
        populate_by_name=True,
    )
    kind: Kind
    description: str | None = Field(
        None,
        description='The user\'s wording, for example "total revenue as a KPI".',
        max_length=2000,
    )


class DslDocument(BaseModel):
    """
    A UI DSL document: the A2UI `updateComponents` payload plus the metadata needed to render it later (ADR-0002). It holds column keys only, never row values. The authoritative schema and validator are the published `@dtnam0899/dsl-schema` and `@dtnam0899/dsl-core` packages; this contract only carries the document.
    """

    model_config = ConfigDict(
        populate_by_name=True,
    )
    catalog_id: str = Field(
        ...,
        alias="catalogId",
        description="Exact catalogId of the pinned A2UI catalog.",
        examples=["https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"],
    )
    protocol_version: str = Field(..., alias="protocolVersion", examples=["0.9.1"])
    dsl_schema_version: str = Field(
        ...,
        alias="dslSchemaVersion",
        description="Version of `@dtnam0899/dsl-schema` the document was validated with.",
        examples=["0.1.0"],
    )
    components: list[dict[str, Any]] = Field(
        ...,
        description="A2UI component definitions; exactly one has the id `root`.",
        min_length=1,
    )


class Role(StrEnum):
    user = "user"
    assistant = "assistant"


class ConversationMessage(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
    )
    role: Role
    text: str


class SqlGenerationResult(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
    )
    kind: SqlOutputKind
    sql: str = Field(..., description="Empty when `kind` is `none`.")
    explanation: str = Field(
        ...,
        description="Assumptions, tables and joins used, or why no SQL was produced.",
    )
    referenced_tables: list[str] = Field(..., alias="referencedTables")
    procedure_name: str | None = Field(
        None,
        alias="procedureName",
        description="Name of the generated procedure when `kind` is `stored-procedure`.",
        examples=["usp_RevenuePerCustomer"],
    )


class DslGenerationRequest(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
    )
    columns: list[ColumnDefinition] = Field(..., min_length=1)
    intent: VisualizationIntent
    catalog_id: str = Field(
        ...,
        alias="catalogId",
        description="The pinned A2UI catalog the DSL must use.",
        examples=["https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"],
    )
    previous_issues: list[ValidationIssue] | None = Field(
        None,
        alias="previousIssues",
        description="Validation findings of the previous attempt (retry only).",
    )


class Status(StrEnum):
    generated = "generated"
    unsupported = "unsupported"


class DslGenerationResult(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
    )
    status: Status
    dsl: DslDocument | None = None
    reason: str | None = Field(
        None,
        description='Why the request is unsupported (for example "charts are not available yet").',
    )


class ForeignKey(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
    )
    name: str = Field(..., examples=["FK_Orders_Customers"])
    columns: list[str]
    referenced_schema: str = Field(..., alias="referencedSchema")
    referenced_table: str = Field(..., alias="referencedTable")
    referenced_columns: list[str] = Field(..., alias="referencedColumns")


class Kind1(StrEnum):
    table = "table"
    view = "view"


class TableMetadata(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
    )
    name: str = Field(..., examples=["Orders"])
    kind: Kind1
    columns: list[ColumnDefinition]
    primary_key: list[str] | None = Field(
        None,
        alias="primaryKey",
        description="Column names of the primary key, in key order.",
    )
    foreign_keys: list[ForeignKey] | None = Field(None, alias="foreignKeys")


class ProcedureMetadata(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
    )
    name: str = Field(..., examples=["usp_GetCustomerOrders"])
    definition: str = Field(
        ..., description="The CREATE PROCEDURE text as stored by SQL Server."
    )


class DatabaseSchema(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
    )
    name: str = Field(..., examples=["dbo"])
    tables: list[TableMetadata]
    procedures: list[ProcedureMetadata] = Field(
        ...,
        description="Existing stored procedures. Their definitions may be read as context; nothing executes them.",
    )


class Problem(BaseModel):
    """
    Error body, RFC 9457 problem details (application/problem+json).
    """

    model_config = ConfigDict(
        populate_by_name=True,
    )
    type: str = Field(
        ...,
        description="URI that identifies the problem type: `urn:esi:problem:<name>` for the documented ESI problems, or about:blank when there is nothing more specific.",
        examples=["urn:esi:problem:consent-withdrawn"],
    )
    title: str = Field(
        ..., description="Short, human-readable summary of the problem type."
    )
    status: int = Field(..., description="HTTP status code.")
    detail: str | None = Field(
        None, description="Explanation specific to this occurrence."
    )
    instance: str | None = Field(
        None, description="URI that identifies this occurrence."
    )
    trace_id: str | None = Field(
        None, alias="traceId", description="Correlation id to find the request in logs."
    )
    errors: list[FieldError] | None = Field(
        None, description="Field-level validation errors."
    )
    issues: list[ValidationIssue] | None = Field(
        None,
        description="DSL or SQL validation findings (problem types `dsl-validation-failed` and `sql-rejected`).",
    )


class SchemaMetadata(BaseModel):
    """
    Schema of a SQL Server database as read by core-backend. Contains structure and stored procedure definitions as text; never row values or connection details.
    """

    model_config = ConfigDict(
        populate_by_name=True,
    )
    schemas: list[DatabaseSchema]


class SqlGenerationRequest(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
    )
    question: str = Field(
        ...,
        examples=["Total revenue per customer in 2026"],
        max_length=4000,
        min_length=1,
    )
    schema_: SchemaMetadata = Field(..., alias="schema")
    history: list[ConversationMessage] | None = Field(
        None,
        description="Earlier messages of the chat session, oldest first, for follow-up questions.",
    )