"""DSL generation agent (operation ``generateDsl``, UR-1 SR-5).

Input is column definitions and the visualization intent only; row values never reach the model.
A candidate is returned only after it passes the dsl-core rules and the agent rules; after the
last retry ``DslGenerationFailedError`` carries the findings (problem ``dsl-validation-failed``),
so invalid DSL is never returned as success. Charts and forms are answered with ``unsupported``.
"""

import re

from pydantic import ValidationError

from esi_agents.agents.output import ModelOutputError, describe, enum_value, parse_json_object
from esi_agents.config import Settings
from esi_agents.contracts.agents_api import DslGenerationRequest, DslGenerationResult
from esi_agents.dsl.candidate import PROTOCOL_VERSION, validate_candidate
from esi_agents.dsl.validator import DslIssue, pinned_schema
from esi_agents.llm import Deadline, ModelClient, guarded_complete
from esi_agents.prompts import DSL_GENERATION, render

CHART_REASON = (
    "Charts are not available yet: the pinned A2UI basic catalog has no chart component. "
    "I can show this result as a table or as a KPI instead."
)
FORM_REASON = (
    "Forms are not supported in this version. "
    "I can show this result as a table or as a KPI instead."
)
GENERIC_REASON = (
    "This visualization is not supported. I can show the result as a table or as a KPI."
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


def unsupported_reason(description: str | None) -> str | None:
    """The refusal for a chart or form request, ``None`` when the intent may be a table or KPI."""
    if not description:
        return None
    if _CHART.search(description):
        return CHART_REASON
    if _FORM.search(description):
        return FORM_REASON
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
        schema = pinned_schema()
        if request.catalog_id != schema.catalog_id:
            raise InvalidDslRequestError(
                f"catalogId must be the pinned catalog {schema.catalog_id}"
            )
        intent = str(enum_value(request.intent.kind))
        if (reason := unsupported_reason(request.intent.description)) is not None:
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
                catalog_id=schema.catalog_id,
                columns=columns_text,
                intent=intent_text,
                issues=_issues_text(issues),
            )
            output = await guarded_complete(self._model, prompt, self._settings, deadline)
            result, issues = self._check(output, columns, intent)
            if result is not None:
                return result
        raise DslGenerationFailedError(issues)

    def _check(
        self, output: str, columns: list[tuple[str, str]], intent: str
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
        issues = validate_candidate(components, columns, intent)
        if issues:
            return None, issues
        schema = pinned_schema()
        try:
            result = DslGenerationResult.model_validate(
                {
                    "status": "generated",
                    "dsl": {
                        "catalogId": schema.catalog_id,
                        "protocolVersion": PROTOCOL_VERSION,
                        "dslSchemaVersion": schema.package_version,
                        "components": components,
                    },
                }
            )
        except ValidationError as error:
            return None, [DslIssue("invalid-output", describe(error), "")]
        return result, []
