"""Eval runner core. Cases are JSON files; the format is described in ``evals/README.md``."""

import json
import time
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field

from esi_agents.agents import DslGenerationAgent, DslGenerationFailedError, SqlGenerationAgent
from esi_agents.config import Settings
from esi_agents.contracts.agents_api import DslGenerationRequest, SqlGenerationRequest
from esi_agents.dsl.candidate import validate_candidate
from esi_agents.llm.base import ModelClient, ModelUnavailableError
from esi_agents.llm.stub import StubModel

_MISSING = object()


class Check(BaseModel):
    """One assertion. ``path`` is a JSON Pointer into the outcome (``""`` is the whole outcome).

    Prompt cases: the outcome is the model output string. Agent cases: the outcome is
    ``{"status", "response", "modelCalls", "prompts"}`` (``prompts`` joined into one string).
    """

    kind: Literal["equals", "contains", "not_contains", "absent", "valid_dsl"]
    path: str = ""
    value: Any = None

    def passes(self, outcome: object, case: "Case") -> bool:
        """Return whether ``outcome`` satisfies this check."""
        target = resolve(outcome, self.path)
        match self.kind:
            case "absent":
                return target is _MISSING
            case "equals":
                return target == self.value
            case "contains":
                return target is not _MISSING and _contains(target, self.value)
            case "not_contains":
                return target is _MISSING or not _contains(target, self.value)
            case "valid_dsl":
                return target is not _MISSING and _valid_dsl(target, case)


def _contains(target: object, value: object) -> bool:
    if isinstance(target, str):
        return isinstance(value, str) and value in target
    if isinstance(target, list):
        return value in target
    return False


def _valid_dsl(document: object, case: "Case") -> bool:
    """Independent re-validation of a returned document against the request columns."""
    request = case.request or {}
    columns = [(c["name"], c["sqlType"]) for c in request.get("columns", [])]
    intent = request.get("intent", {}).get("kind", "")
    description = request.get("intent", {}).get("description")
    components = document.get("components") if isinstance(document, dict) else None
    return not validate_candidate(components, columns, intent, description)


def resolve(value: object, path: str) -> object:
    """Follow a JSON Pointer; ``_MISSING`` when it does not exist."""
    if path == "":
        return value
    for raw in path.split("/")[1:]:
        segment = raw.replace("~1", "/").replace("~0", "~")
        if isinstance(value, dict) and segment in value:
            value = value[segment]
        elif isinstance(value, list) and segment.isdigit() and int(segment) < len(value):
            value = value[int(segment)]
        else:
            return _MISSING
    return value


class Case(BaseModel):
    """An eval case.

    Prompt case (harness only): ``prompt`` and ``stub_output``. Agent case: ``agent`` with a
    contract-shaped ``request`` (``schema_fixture`` fills ``request.schema`` from a fixture file)
    and ``stub_outputs``, the successive answers of the stub model (strings or JSON values).
    ``real_checks`` (agent cases only) marks a case that also runs against a real model
    (``--model gemini``); those checks replace ``checks`` there, since the answers vary.
    """

    id: str
    prompt: str = ""
    stub_output: str = ""
    agent: Literal["sql", "dsl"] | None = None
    request: dict[str, Any] | None = None
    schema_fixture: str | None = None
    stub_outputs: list[Any] = Field(default_factory=list)
    checks: list[Check] = Field(min_length=1)
    real_checks: list[Check] = Field(default_factory=list)


class CaseResult(BaseModel):
    """Outcome of one case. ``model_calls`` and ``seconds`` are filled for agent cases."""

    id: str
    passed: bool
    failed_checks: list[Check] = Field(default_factory=list)
    model_calls: int = 0
    seconds: float = 0.0


class RecordingModel:
    """Wraps a real model and records the prompts it was sent, like ``StubModel`` does."""

    def __init__(self, model: ModelClient) -> None:
        self._model = model
        self.prompts: list[str] = []

    async def complete(self, prompt: str) -> str:
        """Record ``prompt`` and forward it."""
        self.prompts.append(prompt)
        return await self._model.complete(prompt)


def load_cases(path: Path) -> list[Case]:
    """Load one case file, or every ``*.json`` file under a directory (sorted, recursive)."""
    files = sorted(path.rglob("*.json")) if path.is_dir() else [path]
    cases: list[Case] = []
    for file in files:
        data = json.loads(file.read_text(encoding="utf-8"))
        items = data if isinstance(data, list) else [data]
        for item in items:
            case = Case.model_validate(item)
            if case.schema_fixture is not None:
                fixture = json.loads(
                    (file.parent / case.schema_fixture).read_text(encoding="utf-8")
                )
                case.request = {**(case.request or {}), "schema": fixture["schema"]}
            cases.append(case)
    ids = [case.id for case in cases]
    duplicates = sorted({i for i in ids if ids.count(i) > 1})
    if duplicates:
        raise ValueError(f"duplicate case ids: {', '.join(duplicates)}")
    return cases


async def run_agent_case(
    case: Case, settings: Settings, real_model: ModelClient | None = None
) -> dict[str, Any]:
    """Run one agent case with ``real_model``, else a stub scripted with ``stub_outputs``."""
    model: StubModel | RecordingModel
    if real_model is not None:
        model = RecordingModel(real_model)
    else:
        outputs = [o if isinstance(o, str) else json.dumps(o) for o in case.stub_outputs]
        model = StubModel(script=outputs, default="")
    status, response = 200, None
    try:
        if case.agent == "sql":
            result = await SqlGenerationAgent(model, settings).generate(
                SqlGenerationRequest.model_validate(case.request)
            )
            response = result.model_dump(mode="json", by_alias=True, exclude_none=True)
        else:
            result = await DslGenerationAgent(model, settings).generate(
                DslGenerationRequest.model_validate(case.request)
            )
            response = result.model_dump(mode="json", by_alias=True, exclude_none=True)
    except DslGenerationFailedError as error:
        status = 422
        response = {
            "type": "urn:esi:problem:dsl-validation-failed",
            "issues": [{"code": i.code, "message": i.message} for i in error.issues],
            "issueCodes": sorted({i.code for i in error.issues}),
        }
    except ModelUnavailableError as error:
        status = 503
        response = {"type": "urn:esi:problem:model-unavailable", "detail": str(error)}
    return {
        "status": status,
        "response": response,
        "modelCalls": len(model.prompts),
        "prompts": "\n\n".join(model.prompts),
    }


async def run_cases(
    cases: list[Case], model: ModelClient, settings: Settings | None = None
) -> list[CaseResult]:
    """Run every case: prompt cases against ``model``, agent cases against their own stub."""
    settings = settings or Settings(model_backoff_seconds=0)
    results: list[CaseResult] = []
    for case in cases:
        if case.agent:
            started = time.monotonic()
            outcome: Any = await run_agent_case(case, settings)
            result = _result(case, case.checks, outcome, time.monotonic() - started)
        else:
            outcome = await model.complete(case.prompt)
            result = _result(case, case.checks, outcome, 0.0)
        results.append(result)
    return results


async def run_real_cases(
    cases: list[Case], model: ModelClient, settings: Settings
) -> list[CaseResult]:
    """Run the agent cases that have ``real_checks`` against a real ``model`` (never in CI)."""
    results: list[CaseResult] = []
    for case in cases:
        if not (case.agent and case.real_checks):
            continue
        started = time.monotonic()
        outcome = await run_agent_case(case, settings, real_model=model)
        results.append(_result(case, case.real_checks, outcome, time.monotonic() - started))
    return results


def _result(case: Case, checks: list[Check], outcome: object, seconds: float) -> CaseResult:
    failed = [check for check in checks if not check.passes(outcome, case)]
    calls = outcome.get("modelCalls", 0) if isinstance(outcome, dict) and case.agent else 0
    return CaseResult(
        id=case.id, passed=not failed, failed_checks=failed, model_calls=calls, seconds=seconds
    )
