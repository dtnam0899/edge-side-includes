import json
from pathlib import Path

import pytest

from esi_agents.dsl.candidate import build_artifact, catalog_id_for, column_type, validate_candidate
from esi_agents.dsl.validator import pinned_schema, validate_artifact

# Shared corpus, vendored from the published @dtnam0899/dsl-schema (scripts/sync-published.sh).
FIXTURES = Path(__file__).parent / "fixtures" / "dsl-schema"


def load(kind: str) -> list[tuple[str, dict]]:
    files = sorted((FIXTURES / kind).glob("*.json"))
    return [(f.stem, json.loads(f.read_text(encoding="utf-8"))) for f in files]


def test_corpus_is_present() -> None:
    assert load("valid") and load("invalid") and load("render")


@pytest.mark.parametrize(("name", "fixture"), load("valid") + load("render"))
def test_valid_fixtures_pass(name: str, fixture: dict) -> None:
    assert validate_artifact(fixture["artifact"]) == []


@pytest.mark.parametrize(("name", "fixture"), load("invalid"))
def test_invalid_fixtures_report_expected_codes(name: str, fixture: dict) -> None:
    found = {issue.code for issue in validate_artifact(fixture["artifact"])}
    assert set(fixture["expectedErrors"]) <= found, found


def test_catalog_id_is_taken_verbatim_from_the_pinned_catalog() -> None:
    assert (
        pinned_schema().catalog_id
        == "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"
    )


def test_non_object_artifact_is_a_schema_error() -> None:
    assert [i.code for i in validate_artifact([])] == ["schema"]


@pytest.mark.parametrize(
    ("sql_type", "expected"),
    [
        ("int", "number"),
        ("decimal(18,2)", "number"),
        ("MONEY", "number"),
        ("bit", "boolean"),
        ("date", "date"),
        ("datetime2(7)", "datetime"),
        ("datetimeoffset", "datetime"),
        ("nvarchar(200)", "string"),
        ("uniqueidentifier", "string"),
        ("time(7)", "string"),
    ],
)
def test_column_type_mapping(sql_type: str, expected: str) -> None:
    assert column_type(sql_type) == expected


def _valid_table() -> tuple[list[dict], list[tuple[str, str]]]:
    fixture = dict(load("valid"))["table"]["artifact"]
    columns = [("region", "nvarchar(50)"), ("revenue", "decimal(18,2)")]
    return fixture["components"], columns


def test_candidate_from_fixture_components_is_valid() -> None:
    components, columns = _valid_table()
    assert validate_candidate(components, columns, "table") == []
    assert validate_artifact(build_artifact(components, columns)) == []


def test_kpi_fixture_components_are_a_valid_kpi() -> None:
    components = dict(load("valid"))["kpi"]["artifact"]["components"]
    assert validate_candidate(components, [("total_revenue", "money")], "kpi") == []


def test_table_components_do_not_satisfy_a_kpi_intent() -> None:
    components, columns = _valid_table()
    assert "intent-mismatch" in {i.code for i in validate_candidate(components, columns, "kpi")}


def test_input_components_are_refused_as_forms() -> None:
    components, columns = _valid_table()
    components = [
        *components,
        {
            "id": "f",
            "component": "TextField",
            "label": "Region",
            "value": {"path": "/rows/0/region"},
        },
    ]
    assert "form-not-supported" in {
        i.code for i in validate_candidate(components, columns, "table")
    }


def test_catalog_components_outside_the_agent_set_are_refused() -> None:
    components, columns = _valid_table()
    components = [
        *components,
        {"id": "img", "component": "Image", "url": "https://example.com/a.png"},
    ]
    assert "component-not-allowed" in {
        i.code for i in validate_candidate(components, columns, "table")
    }


def test_non_list_components_fail_the_schema() -> None:
    assert "schema" in {i.code for i in validate_candidate("nope", [("a", "int")], "table")}


def chart(chart_type: str, category: str = "Month", **extra: object) -> list[dict]:
    component = {
        "id": "root",
        "component": "EsiChart",
        "chartType": chart_type,
        "title": "Revenue",
        "categoryKey": category,
        "series": [{"valueKey": "Revenue"}],
        "data": {"path": "/rows"},
        **extra,
    }
    return [component]


MONTHS = [("Month", "date"), ("Segment", "nvarchar(50)"), ("Revenue", "decimal(18,2)")]


def codes(
    components: list[dict], description: str | None = None, intent: str = "chart"
) -> set[str]:
    return {i.code for i in validate_candidate(components, MONTHS, intent, description)}


def test_charts_use_the_esi_catalog_and_tables_the_basic_one() -> None:
    schema = pinned_schema()
    assert (
        catalog_id_for("chart")
        == schema.chart_catalog_id
        == "dtnam0899.github.io:esi-catalog-v0_9-1"
    )
    assert catalog_id_for("table") == catalog_id_for("kpi") == schema.catalog_id
    assert build_artifact(chart("line"), MONTHS, "chart")["catalogId"] == schema.chart_catalog_id


def test_an_esi_chart_is_not_a_component_of_a_table_or_kpi() -> None:
    assert "unknown-component" in codes(chart("bar", "Segment"), intent="table")


def test_the_chart_type_follows_the_wording_then_the_category() -> None:
    assert codes(chart("line"), "revenue per month") == set()
    assert codes(chart("bar"), "revenue per month") == {"intent-mismatch"}
    assert codes(chart("bar"), "revenue per month as bars") == set()
    assert codes(chart("bar", "Segment"), "revenue per segment") == set()
    assert codes(chart("pie", "Segment"), "revenue per segment") == {"intent-mismatch"}
    assert codes(chart("pie", "Segment"), "share of revenue by segment") == set()
    assert codes(chart("line", "Segment"), "segment share as a line chart") == set()
    assert codes(chart("bar", "Segment"), "revenue in the Revenue column by segment") == set()


def test_chart_rules_of_dsl_core_apply_to_candidates() -> None:
    assert "chart-column-type" in codes(chart("bar", "Segment", series=[{"valueKey": "Segment"}]))
    assert "chart-series" in codes(chart("line", stacked=True), "revenue per month")
    two_charts = [*chart("line"), {**chart("line")[0], "id": "second"}]
    assert "intent-mismatch" in codes(two_charts, "revenue per month")
