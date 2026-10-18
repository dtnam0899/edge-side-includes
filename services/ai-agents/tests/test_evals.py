import asyncio
import json
from pathlib import Path

import pytest

from esi_agents.evals import load_cases, run_cases
from esi_agents.evals.__main__ import main
from esi_agents.llm import StubModel


def _write(path: Path, cases: list[dict]) -> Path:
    path.write_text(json.dumps(cases), encoding="utf-8")
    return path


def _case(case_id: str, output: str, kind: str = "contains", value: str = "SELECT") -> dict:
    return {
        "id": case_id,
        "prompt": f"prompt {case_id}",
        "stub_output": output,
        "checks": [{"kind": kind, "value": value}],
    }


def test_stub_model_is_deterministic() -> None:
    model = StubModel({"a": "1"}, default="?")
    assert asyncio.run(model.complete("a")) == "1"
    assert asyncio.run(model.complete("b")) == "?"


def test_run_cases_reports_failed_checks(tmp_path: Path) -> None:
    cases = load_cases(_write(tmp_path / "c.json", [_case("ok", "SELECT 1"), _case("bad", "DROP")]))
    model = StubModel({c.prompt: c.stub_output for c in cases})
    results = {r.id: r for r in asyncio.run(run_cases(cases, model))}
    assert results["ok"].passed
    assert not results["bad"].passed
    assert results["bad"].failed_checks[0].value == "SELECT"


def test_load_cases_rejects_duplicate_ids(tmp_path: Path) -> None:
    _write(tmp_path / "a.json", [_case("same", "x")])
    _write(tmp_path / "b.json", [_case("same", "y")])
    with pytest.raises(ValueError, match="duplicate"):
        load_cases(tmp_path)


def test_cli_exit_codes(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    passing = _write(tmp_path / "pass.json", [_case("p", "SELECT 1")])
    failing = _write(tmp_path / "fail.json", [_case("f", "DELETE FROM t")])
    empty = tmp_path / "empty"
    empty.mkdir()
    assert main([str(passing)]) == 0
    assert main([str(failing)]) == 1
    assert main([str(empty)]) == 2
    assert "FAIL f" in capsys.readouterr().out


def test_committed_cases_pass() -> None:
    root = Path(__file__).resolve().parents[1]
    assert main([str(root / "evals" / "cases")]) == 0


def test_agent_case_fails_when_unsafe_sql_would_be_returned(tmp_path: Path) -> None:
    fixture = Path(__file__).resolve().parents[1] / "evals" / "fixtures" / "sales-schema.json"
    case = {
        "id": "expects-query",
        "agent": "sql",
        "schema_fixture": str(fixture),
        "request": {"question": "Delete orders"},
        "stub_outputs": [{"kind": "query", "sql": "DELETE FROM dbo.Orders", "explanation": "x"}]
        * 3,
        "checks": [
            {"kind": "equals", "path": "/response/kind", "value": "query"},
            {"kind": "absent", "path": "/response/procedureName"},
        ],
    }
    cases = load_cases(_write(tmp_path / "agent.json", [case]))
    [result] = asyncio.run(run_cases(cases, StubModel()))
    assert not result.passed
    assert [c.path for c in result.failed_checks] == ["/response/kind"]
