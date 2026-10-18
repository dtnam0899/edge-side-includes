import importlib.util
import json
from pathlib import Path

from esi_agents.contracts.agents_api import SchemaMetadata
from esi_agents.dsl.validator import pinned_schema

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "vendor" / "esi-contracts"
PINS = json.loads((ROOT / "published-packages.json").read_text(encoding="utf-8"))


def _generator():
    spec = importlib.util.spec_from_file_location(
        "generate_contract_models", ROOT / "scripts" / "generate_contract_models.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_committed_models_match_the_generator() -> None:
    committed = (ROOT / "src" / "esi_agents" / "contracts" / "agents_api.py").read_text(
        encoding="utf-8"
    )
    assert committed == _generator().render(VENDOR), "regenerate with scripts/sync-published.sh"


def test_vendored_files_match_the_pins() -> None:
    contracts = json.loads((VENDOR / "PUBLISHED.json").read_text(encoding="utf-8"))
    assert contracts == {
        "package": "@dtnam0899/esi-contracts",
        "version": PINS["@dtnam0899/esi-contracts"],
    }
    assert pinned_schema().package_version == PINS["@dtnam0899/dsl-schema"]


def test_eval_fixtures_have_the_contract_shape_and_version() -> None:
    fixtures = sorted((ROOT / "evals" / "fixtures").glob("*.json"))
    assert fixtures
    for file in fixtures:
        data = json.loads(file.read_text(encoding="utf-8"))
        assert data["contract"]["version"] == PINS["@dtnam0899/esi-contracts"], file.name
        SchemaMetadata.model_validate(data["schema"])
