"""Agent rules for DSL candidates, on top of the dsl-core rules in ``validator``.

UR-1 SR-5 supports a table or a KPI built from display components only, and a chart (``EsiChart``
on the ESI catalog, ADR-0009). The agent never emits input components (forms are out of scope) and
wraps the components in the stored artifact envelope to validate them exactly like core-backend
will.
"""

import re
from typing import Any

from esi_agents.dsl.validator import (
    CHART_COMPONENT,
    ROOT_COMPONENT_ID,
    ROWS_PATH,
    DslIssue,
    child_references,
    pinned_schema,
    pointer,
    validate_artifact,
    walk,
)

type Json = Any

PROTOCOL_VERSION = "v0.9"  # A2UI message version the renderer accepts (dsl-schema A2UI_PINS)
ARTIFACT_FORMAT = 1  # dsl-schema DSL_SCHEMA_VERSION of the pinned package
# The agent does not see the SELECT; core-backend binds it when it stores the artifact.
QUERY_PLACEHOLDER = "SELECT /* bound by core-backend */ 1"

# Display components a table or KPI needs. Inputs, buttons, media, tabs and modals are not emitted.
AGENT_COMPONENTS = frozenset({"Column", "Row", "List", "Card", "Text", "Divider"})
AGENT_FUNCTIONS = frozenset({"formatNumber", "formatCurrency", "formatDate", "formatString"})
INPUT_COMPONENTS = frozenset(
    {"TextField", "CheckBox", "ChoicePicker", "Slider", "DateTimeInput", "Button"}
)

_NUMBER = re.compile(
    r"^(bigint|int|smallint|tinyint|decimal|numeric|money|smallmoney|float|real)\b"
)
_DATETIME = re.compile(r"^(datetime|datetime2|smalldatetime|datetimeoffset)\b")

# Chart types the user named (ADR-0009); a named type wins over wording about shares. "column"
# alone is a result column, so only "column chart" names a bar chart.
_NAMES_PIE = re.compile(r"\b(pie|donut|doughnut)s?\b", re.IGNORECASE)
_NAMES_LINE = re.compile(r"\b(lines?|trends?|over time)\b", re.IGNORECASE)
_NAMES_BAR = re.compile(r"\b(bars?|column charts?)\b", re.IGNORECASE)
_ASKS_SHARE = re.compile(
    r"\b(shares?|proportions?|percent(age)? of (the )?total|breakdown)\b", re.IGNORECASE
)


def column_type(sql_type: str) -> str:
    """Map a SQL Server type name to the artifact column type."""
    name = sql_type.strip().lower()
    if _NUMBER.match(name):
        return "number"
    if name == "bit":
        return "boolean"
    if _DATETIME.match(name):
        return "datetime"
    if re.match(r"^date\b", name):
        return "date"
    return "string"


def catalog_id_for(intent: str) -> str:
    """The catalog a document for ``intent`` uses: ESI for charts, basic for tables and KPIs."""
    schema = pinned_schema()
    return schema.chart_catalog_id if intent == "chart" else schema.catalog_id


def build_artifact(
    components: Json, columns: list[tuple[str, str]], intent: str = "table"
) -> dict[str, Json]:
    """The stored artifact envelope around ``components`` (columns as ``(name, sqlType)``)."""
    return {
        "dslSchemaVersion": ARTIFACT_FORMAT,
        "protocolVersion": PROTOCOL_VERSION,
        "catalogId": catalog_id_for(intent),
        "columns": [{"name": name, "type": column_type(sql_type)} for name, sql_type in columns],
        "query": {"sql": QUERY_PLACEHOLDER},
        "components": components,
    }


def validate_candidate(
    components: Json,
    columns: list[tuple[str, str]],
    intent: str,
    description: str | None = None,
) -> list[DslIssue]:
    """dsl-core rules on the wrapped components, then the agent rules for ``intent``."""
    issues = validate_artifact(build_artifact(components, columns, intent))
    if isinstance(components, list):
        dicts = [c for c in components if isinstance(c, dict)]
        issues += _agent_rules(dicts, intent) + _intent_rules(dicts, intent)
        if intent == "chart":
            issues += _chart_choice(dicts, columns, description)
    return issues


def _agent_rules(components: list[dict[str, Json]], intent: str) -> list[DslIssue]:
    issues: list[DslIssue] = []
    schema = pinned_schema()
    catalog = schema.catalog_of({"catalogId": catalog_id_for(intent)})
    allowed = AGENT_COMPONENTS | {CHART_COMPONENT} if intent == "chart" else AGENT_COMPONENTS
    for index, component in enumerate(components):
        name, cid = component.get("component"), str(component.get("id"))
        if name in INPUT_COMPONENTS:
            issues.append(
                DslIssue(
                    "form-not-supported",
                    f"{name} is an input component; forms are not supported in this version",
                    pointer("components", index, "component"),
                    cid,
                )
            )
        elif name in catalog.components and name not in allowed:
            issues.append(
                DslIssue(
                    "component-not-allowed",
                    f"{name} is not used for a {intent}; use {', '.join(sorted(allowed))}",
                    pointer("components", index, "component"),
                    cid,
                )
            )
        for node, segments in walk(component):
            call = node.get("call") if isinstance(node, dict) else None
            if isinstance(call, str) and call in catalog.functions and call not in AGENT_FUNCTIONS:
                issues.append(
                    DslIssue(
                        "function-not-allowed",
                        f"{call} is not used for display; use {', '.join(sorted(AGENT_FUNCTIONS))}",
                        pointer("components", index, *segments, "call"),
                        cid,
                    )
                )
    return issues


def _intent_rules(components: list[dict[str, Json]], intent: str) -> list[DslIssue]:
    """A table iterates ``/rows`` with a List template; a KPI is a Card without a row template; a
    chart has exactly one ``EsiChart`` and no row template."""
    root = next((c for c in components if c.get("id") == ROOT_COMPONENT_ID), None)
    templates = [ref for c in components for ref in child_references(c) if ref.is_template]
    charts = [c for c in components if c.get("component") == CHART_COMPONENT]
    if intent == "chart" and (len(charts) != 1 or templates):
        return [
            DslIssue(
                "intent-mismatch",
                f"A chart is exactly one {CHART_COMPONENT} (alone or in a Column with a heading "
                "Text), without a List",
                pointer("components"),
            )
        ]
    if intent == "table" and not any(ref.template_path == ROWS_PATH for ref in templates):
        return [
            DslIssue(
                "intent-mismatch",
                f"A table needs a List whose template iterates {ROWS_PATH}",
                pointer("components"),
            )
        ]
    if intent == "kpi" and (root is None or root.get("component") != "Card" or templates):
        return [
            DslIssue(
                "intent-mismatch",
                "A KPI is a Card root with Text values bound to /rows/0/<column>, without a List",
                pointer("components"),
            )
        ]
    return []


def _chart_choice(
    components: list[dict[str, Json]], columns: list[tuple[str, str]], description: str | None
) -> list[DslIssue]:
    """ADR-0009 type choice: the type the user named; pie only for shares of a whole; otherwise a
    line over a date or datetime category and a bar for anything else."""
    chart = next((c for c in components if c.get("component") == CHART_COMPONENT), None)
    if chart is None:
        return []
    index = components.index(chart)
    chosen = chart.get("chartType")
    wording = description or ""
    named = next(
        (
            name
            for name, pattern in (
                ("pie", _NAMES_PIE),
                ("line", _NAMES_LINE),
                ("bar", _NAMES_BAR),
                ("pie", _ASKS_SHARE),
            )
            if pattern.search(wording)
        ),
        None,
    )
    types = {name: column_type(sql_type) for name, sql_type in columns}
    by_date = types.get(chart.get("categoryKey")) in ("date", "datetime")
    expected = named or ("line" if by_date else "bar")
    if chosen == expected or chosen not in ("bar", "line", "pie"):
        return []  # an invalid chartType is a schema error already
    reason = (
        f"the user asked for a {named} chart"
        if named
        else "the category is a date, so use a line chart"
        if by_date
        else "use a bar chart; a pie is only for shares of a whole when the user asks for it"
    )
    return [
        DslIssue(
            "intent-mismatch",
            f"chartType {chosen} does not fit: {reason}",
            pointer("components", index, "chartType"),
            str(chart.get("id")),
        )
    ]
