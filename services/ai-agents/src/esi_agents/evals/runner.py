"""Eval runner core. Cases are JSON files; the real cases arrive with ESI-18."""

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from esi_agents.llm.base import ModelClient


class Check(BaseModel):
    """One assertion on the model output."""

    kind: Literal["equals", "contains", "not_contains"]
    value: str

    def passes(self, output: str) -> bool:
        """Return whether ``output`` satisfies this check."""
        match self.kind:
            case "equals":
                return output == self.value
            case "contains":
                return self.value in output
            case "not_contains":
                return self.value not in output


class Case(BaseModel):
    """An eval case. ``stub_output`` is what the stub model answers for this case's prompt."""

    id: str
    prompt: str
    stub_output: str = ""
    checks: list[Check] = Field(min_length=1)


class CaseResult(BaseModel):
    """Outcome of one case."""

    id: str
    passed: bool
    failed_checks: list[Check] = Field(default_factory=list)


def load_cases(path: Path) -> list[Case]:
    """Load one case file, or every ``*.json`` file under a directory (sorted, recursive)."""
    files = sorted(path.rglob("*.json")) if path.is_dir() else [path]
    cases: list[Case] = []
    for file in files:
        data = json.loads(file.read_text(encoding="utf-8"))
        items = data if isinstance(data, list) else [data]
        cases.extend(Case.model_validate(item) for item in items)
    ids = [case.id for case in cases]
    duplicates = sorted({i for i in ids if ids.count(i) > 1})
    if duplicates:
        raise ValueError(f"duplicate case ids: {', '.join(duplicates)}")
    return cases


async def run_cases(cases: list[Case], model: ModelClient) -> list[CaseResult]:
    """Run every case against ``model`` and collect results."""
    results: list[CaseResult] = []
    for case in cases:
        output = await model.complete(case.prompt)
        failed = [check for check in case.checks if not check.passes(output)]
        results.append(CaseResult(id=case.id, passed=not failed, failed_checks=failed))
    return results
