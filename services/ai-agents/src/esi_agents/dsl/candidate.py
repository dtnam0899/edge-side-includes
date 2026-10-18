"""Agent rules for DSL candidates, on top of the dsl-core rules in ``validator``.

Phase 1 (UR-1 SR-5) supports a table or a KPI built from display components only. The agent never
emits input components (forms are out of scope) and wraps the components in the stored artifact
envelope to validate them exactly like core-backend will.
"""

import re
from typing import Any

from esi_agents.dsl.validator import (
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


def build_artifact(components: Json, columns: list[tuple[str, str]]) -> dict[str, Json]:
    """The stored artifact envelope around ``components`` (columns as ``(name, sqlType)``)."""
    return {
        "dslSchemaVersion": ARTIFACT_FORMAT,
        "protocolVersion": PROTOCOL_VERSION,
        "catalogId": pinned_schema().catalog_id,
        "columns": [{"name": name, "type": column_type(sql_type)} for name, sql_type in columns],
        "query": {"sql": QUERY_PLACEHOLDER},
        "components": components,
    }


def validate_candidate(
    components: Json, columns: list[tuple[str, str]], intent: str
) -> list[DslIssue]:
    """dsl-core rules on the wrapped components, then the agent rules for ``intent`` (table|kpi)."""
    issues = validate_artifact(build_artifact(components, columns))
    if isinstance(components, list):
        dicts = [c for c in components if isinstance(c, dict)]
        issues += _agent_rules(dicts) + _intent_rules(dicts, intent)
    return issues


def _agent_rules(components: list[dict[str, Json]]) -> list[DslIssue]:
    issues: list[DslIssue] = []
    catalog = pinned_schema()
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
        elif name in catalog.components and name not in AGENT_COMPONENTS:
            issues.append(
                DslIssue(
                    "component-not-allowed",
                    f"{name} is not used for tables or KPIs; use "
                    f"{', '.join(sorted(AGENT_COMPONENTS))}",
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
    """A table iterates ``/rows`` with a List template; a KPI is a Card without a row template."""
    root = next((c for c in components if c.get("id") == ROOT_COMPONENT_ID), None)
    templates = [ref for c in components for ref in child_references(c) if ref.is_template]
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
