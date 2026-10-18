"""Generate the pydantic models for the pinned agents-api contract.

Usage: ``python scripts/generate_contract_models.py <vendor/esi-contracts> <output.py>``.
Run through ``scripts/sync-published.sh``; ``tests/test_contract_models.py`` reruns it to prove
the committed file is unedited. Generator: datamodel-code-generator (see ``CLAUDE.md``).
"""

import json
import sys
from pathlib import Path

from datamodel_code_generator import DataModelType, InputFileType, PythonVersion, generate
from datamodel_code_generator.format import Formatter

SPEC_FILE = "agents-api.yaml"


def header(vendor_dir: Path) -> str:
    """File header recording the package and contract version the models come from."""
    published = json.loads((vendor_dir / "PUBLISHED.json").read_text(encoding="utf-8"))
    return (
        f"# Generated from {published['package']} {published['version']} (bundled/{SPEC_FILE})\n"
        "# by datamodel-code-generator. Do not edit: run scripts/sync-published.sh."
    )


def render(vendor_dir: Path) -> str:
    """Return the generated module source for the contract in ``vendor_dir``."""
    output = generate(
        (vendor_dir / SPEC_FILE).read_text(encoding="utf-8"),
        input_file_type=InputFileType.OpenAPI,
        output_model_type=DataModelType.PydanticV2BaseModel,
        target_python_version=PythonVersion.PY_313,
        custom_file_header=header(vendor_dir),
        disable_timestamp=True,
        snake_case_field=True,
        allow_population_by_field_name=True,
        use_standard_collections=True,
        use_union_operator=True,
        use_schema_description=True,
        field_constraints=True,
        use_double_quotes=True,
        formatters=[Formatter.BLACK, Formatter.ISORT],
    )
    if not isinstance(output, str):
        raise TypeError("expected a single generated module")
    return output


def main(argv: list[str]) -> int:
    """Write the generated module to the output path."""
    vendor_dir, target = Path(argv[0]), Path(argv[1])
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(render(vendor_dir), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
