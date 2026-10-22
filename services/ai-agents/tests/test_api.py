import asyncio
import json
from pathlib import Path

from fastapi.testclient import TestClient

from esi_agents.app import create_app
from esi_agents.config import Settings
from esi_agents.llm import StubModel

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = json.loads(
    (ROOT / "evals" / "fixtures" / "sales-schema.json").read_text(encoding="utf-8")
)["schema"]
CATALOG_ID = "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"
KPI = {
    "status": "generated",
    "components": [
        {"id": "root", "component": "Card", "child": "value"},
        {
            "id": "value",
            "component": "Text",
            "text": {
                "call": "formatNumber",
                "args": {"value": {"path": "/rows/0/Total"}},
                "returnType": "string",
            },
        },
    ],
}


def client(*outputs: object, **settings: object) -> tuple[TestClient, StubModel]:
    model = StubModel(script=[o if isinstance(o, str) else json.dumps(o) for o in outputs])
    app = create_app(model, Settings(model_backoff_seconds=0, **settings))
    return TestClient(app), model


def dsl_request(**intent: object) -> dict:
    return {
        "columns": [{"name": "Total", "sqlType": "money", "nullable": False}],
        "intent": {"kind": "kpi", **intent},
        "catalogId": CATALOG_ID,
    }


def test_generate_sql_returns_a_checked_query() -> None:
    sql = "SELECT COUNT(*) AS Total FROM dbo.Orders AS o"
    api, _ = client({"kind": "query", "sql": sql, "explanation": "Counts orders."})
    response = api.post("/sql-generations", json={"question": "How many orders?", "schema": SCHEMA})
    assert response.status_code == 200
    assert response.json() == {
        "kind": "query",
        "sql": sql,
        "explanation": "Counts orders.",
        "referencedTables": ["dbo.Orders"],
    }


def test_generate_sql_never_returns_a_write() -> None:
    write = {"kind": "query", "sql": "DELETE FROM dbo.Orders", "explanation": "Deletes."}
    api, model = client(write, write, write, sql_max_retries=2)
    body = api.post("/sql-generations", json={"question": "Delete orders", "schema": SCHEMA}).json()
    assert body["kind"] == "none"
    assert body["sql"] == ""
    assert "write-statement" in body["explanation"]
    assert len(model.prompts) == 3


def test_generate_sql_retries_a_view_with_the_finding() -> None:
    view = {
        "kind": "query",
        "sql": "SELECT cr.Name, cr.Revenue FROM dbo.vw_CustomerRevenue AS cr;",
        "explanation": "Reads the revenue view.",
    }
    sql = (
        "SELECT c.Name AS Customer, SUM(ol.Quantity * ol.UnitPrice) AS Revenue "
        "FROM dbo.Customers AS c JOIN dbo.Orders AS o ON o.CustomerId = c.CustomerId "
        "JOIN dbo.OrderLines AS ol ON ol.OrderId = o.OrderId GROUP BY c.Name"
    )
    table = {"kind": "query", "sql": sql, "explanation": "Joins the tables."}
    api, model = client(view, table)
    body = api.post("/sql-generations", json={"question": "Revenue per customer", "schema": SCHEMA})
    assert body.json()["sql"] == sql
    assert body.json()["referencedTables"] == ["dbo.Customers", "dbo.OrderLines", "dbo.Orders"]
    assert "view dbo.vw_CustomerRevenue (" in model.prompts[0]
    assert "context only, never query a view" in model.prompts[0]
    assert "view-not-allowed" in model.prompts[1]


def test_generate_dsl_returns_a_valid_document() -> None:
    api, _ = client(KPI)
    response = api.post("/dsl-generations", json=dsl_request(description="total as a KPI"))
    assert response.status_code == 200
    dsl = response.json()["dsl"]
    assert dsl["catalogId"] == CATALOG_ID
    assert dsl["protocolVersion"] == "v0.9"
    assert dsl["components"] == KPI["components"]


def test_generate_dsl_refuses_charts() -> None:
    api, model = client(KPI)
    body = api.post(
        "/dsl-generations", json=dsl_request(description="a line chart of totals")
    ).json()
    assert body["status"] == "unsupported"
    assert "dsl" not in body
    assert model.prompts == []


def test_invalid_dsl_after_retries_is_a_problem_not_a_success() -> None:
    bad = {"status": "generated", "components": [{"id": "root", "component": "Chart"}]}
    api, model = client(bad, bad, dsl_max_retries=1)
    response = api.post("/dsl-generations", json=dsl_request())
    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")
    body = response.json()
    assert body["type"] == "urn:esi:problem:dsl-validation-failed"
    assert "unknown-component" in {issue["code"] for issue in body["issues"]}
    assert len(model.prompts) == 2


def test_wrong_catalog_is_an_invalid_request() -> None:
    api, _ = client(KPI)
    response = api.post(
        "/dsl-generations", json={**dsl_request(), "catalogId": "https://example.com/c.json"}
    )
    assert response.status_code == 400
    assert response.json()["type"] == "urn:esi:problem:invalid-request"


def test_contract_violations_are_invalid_requests() -> None:
    api, _ = client()
    response = api.post("/dsl-generations", json={"columns": [], "intent": {"kind": "chart"}})
    assert response.status_code == 400
    body = response.json()
    assert body["type"] == "urn:esi:problem:invalid-request"
    assert {"columns", "intent/kind", "catalogId"} <= {e["field"] for e in body["errors"]}


def test_without_a_model_provider_generation_is_unavailable() -> None:
    api = TestClient(create_app(settings=Settings(model_backoff_seconds=0)))
    response = api.post("/sql-generations", json={"question": "How many orders?", "schema": SCHEMA})
    assert response.status_code == 503
    assert response.json()["type"] == "urn:esi:problem:model-unavailable"


def test_oversized_prompts_are_rejected() -> None:
    api, model = client(KPI, max_prompt_chars=100)
    response = api.post("/sql-generations", json={"question": "How many orders?", "schema": SCHEMA})
    assert response.status_code == 400
    assert model.prompts == []


class SlowModel:
    def __init__(self) -> None:
        self.calls = 0

    async def complete(self, prompt: str) -> str:
        self.calls += 1
        await asyncio.sleep(0.04)
        return "not json"


def test_request_deadline_covers_every_candidate() -> None:
    model = SlowModel()
    settings = Settings(
        model_backoff_seconds=0, request_deadline_seconds=0.1, sql_max_retries=5, model_retries=0
    )
    api = TestClient(create_app(model, settings))
    response = api.post("/sql-generations", json={"question": "Orders?", "schema": SCHEMA})
    assert response.status_code == 503
    assert response.json()["detail"] == "the model did not answer in time"
    assert model.calls < 6
