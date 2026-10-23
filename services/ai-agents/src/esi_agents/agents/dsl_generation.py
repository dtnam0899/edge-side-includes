"""DSL generation agent (operation ``generateDsl``, UR-1 SR-5).

Input is column definitions and the visualization intent only; row values never reach the model.
A candidate is returned only after it passes the dsl-core rules and the agent rules; after the
last retry ``DslGenerationFailedError`` carries the findings (problem ``dsl-validation-failed``),
so invalid DSL is never returned as success. Charts are ``EsiChart`` documents on the ESI catalog
(ADR-0009); forms are answered with ``unsupported``.
"""

import re

from pydantic import ValidationError

from esi_agents.agents.output import ModelOutputError, describe, enum_value, parse_json_object
from esi_agents.config import Settings
from esi_agents.contracts.agents_api import DslGenerationRequest, DslGenerationResult
from esi_agents.dsl.candidate import (
    PROTOCOL_VERSION,
    catalog_id_for,
    column_type,
    validate_candidate,
)
from esi_agents.dsl.validator import DslIssue, pinned_schema
from esi_agents.llm import Deadline, ModelClient, guarded_complete
from esi_agents.prompts import DSL_GENERATION, render

CHART_REASON = (
    "This asks for a chart, but a {intent} was requested. "
    "Ask for a chart, or describe the table or KPI you want."
)
NO_NUMBER_REASON = (
    "A chart needs at least one numeric column to plot. Aggregate in the SQL (for example COUNT or "
    "SUM per category), or show this result as a table."
)
FORM_REASON = (
    "Forms are not supported in this version. "
    "I can show this result as a table, a KPI or a chart instead."
)
GENERIC_REASON = (
    "This visualization is not supported. I can show the result as a table, a KPI or a chart."
)
# Deterministic backstop for the model's own refusal (docs: README "DSL generation rules").
_CHART = re.compile(
    r"\b(charts?|graphs?|plots?|pie|histograms?|scatter|heat ?maps?|sparklines?|donuts?|"
    r"doughnuts?|gauges?|treemaps?)\b",
    re.IGNORECASE,
)
_FORM = re.compile(
    r"\b(forms?|input fields?|text fields?|checkbox(es)?|dropdowns?|submit|data entry)\b",
    re.IGNORECASE,
)


class InvalidDslRequestError(ValueError):
    """The request cannot be served as asked (problem ``invalid-request``)."""


class DslGenerationFailedError(RuntimeError):
    """No candidate passed validation within the retry budget (``dsl-validation-failed``)."""

    def __init__(self, issues: list[DslIssue]) -> None:
        super().__init__(f"{len(issues)} validation issue(s) after the last retry")
        self.issues = issues


def unsupported_reason(
    description: str | None, intent: str = "table", sql_types: list[str] | None = None
) -> str | None:
    """The refusal decided before the model is called, ``None`` when the request can be served.

    Forms are never served; chart wording on a table or KPI intent is sent back so the caller asks
    for a chart; a chart needs a numeric column to plot (ADR-0009).
    """
    if description and _FORM.search(description):
        return FORM_REASON
    if intent == "chart":
        if sql_types is not None and "number" not in {column_type(t) for t in sql_types}:
            return NO_NUMBER_REASON
        return None
    if description and _CHART.search(description):
        return CHART_REASON.format(intent="KPI" if intent == "kpi" else intent)
    return None


def _issues_text(issues: list[DslIssue]) -> str:
    if not issues:
        return ""
    found = "\n".join(
        f"- {issue.code} at {issue.path or '/'}: {issue.message}" for issue in issues[:50]
    )
    return f"\nTHE PREVIOUS ATTEMPT WAS REJECTED\n{found}\nFix every finding."


class DslGenerationAgent:
    """Generate a validated DSL document for a query result."""

    def __init__(self, model: ModelClient, settings: Settings) -> None:
        self._model = model
        self._settings = settings

    async def generate(self, request: DslGenerationRequest) -> DslGenerationResult:
        """Return ``generated`` with a valid document, or ``unsupported`` with a reason."""
        intent = str(enum_value(request.intent.kind))
        catalog_id = catalog_id_for(intent)
        if request.catalog_id != catalog_id:
            raise InvalidDslRequestError(f"catalogId for a {intent} must be {catalog_id}")
        description = request.intent.description
        sql_types = [c.sql_type for c in request.columns]
        if (reason := unsupported_reason(description, intent, sql_types)) is not None:
            return DslGenerationResult.model_validate({"status": "unsupported", "reason": reason})

        # Only names and types are used from the request: nothing else can reach the prompt.
        columns = [(c.name, c.sql_type) for c in request.columns]
        columns_text = "\n".join(f"{name}: {sql_type}" for name, sql_type in columns)
        intent_text = intent + (
            f" ({request.intent.description})" if request.intent.description else ""
        )
        issues = [DslIssue(i.code, i.message, i.path or "") for i in request.previous_issues or []]
        deadline = Deadline(self._settings.request_deadline_seconds)
        for _ in range(self._settings.dsl_max_retries + 1):
            prompt = render(
                DSL_GENERATION,
                catalog_id=catalog_id,
                columns=columns_text,
                intent=intent_text,
                issues=_issues_text(issues),
            )
            output = await guarded_complete(self._model, prompt, self._settings, deadline)
            result, issues = self._check(output, columns, intent, description)
            if result is not None:
                return result
        raise DslGenerationFailedError(issues)

    def _check(
        self, output: str, columns: list[tuple[str, str]], intent: str, description: str | None
    ) -> tuple[DslGenerationResult | None, list[DslIssue]]:
        try:
            data = parse_json_object(output)
        except ModelOutputError as error:
            return None, [DslIssue("invalid-output", describe(error), "")]
        status = data.get("status")
        if status == "unsupported":
            reason = data.get("reason")
            text = reason if isinstance(reason, str) and reason.strip() else GENERIC_REASON
            return DslGenerationResult.model_validate({"status": "unsupported", "reason": text}), []
        if status != "generated":
            return None, [
                DslIssue("invalid-output", 'status must be "generated" or "unsupported"', "/status")
            ]
        components = data.get("components")
        issues = validate_candidate(components, columns, intent, description)
        if issues:
            return None, issues
        schema = pinned_schema()
        try:
            result = DslGenerationResult.model_validate(
                {
                    "status": "generated",
                    "dsl": {
                        "catalogId": catalog_id_for(intent),
                        "protocolVersion": PROTOCOL_VERSION,
                        "dslSchemaVersion": schema.package_version,
                        "components": components,
                    },
                }
            )
        except ValidationError as error:
            return None, [DslIssue("invalid-output", describe(error), "")]
        return result, []
