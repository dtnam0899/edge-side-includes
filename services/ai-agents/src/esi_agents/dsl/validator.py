"""Validation of ESI DSL artifacts, mirroring ``@dtnam0899/dsl-core`` (ADR-0002).

Order: the A2UI v0.9.1 JSON Schema through the ESI artifact envelope schema, then the ESI rules
(unique ids, ``root``, catalog components and functions only, child references exist, bound paths
name given columns, no HTML or script URLs, no row data). Error codes are those of ``dsl-core``;
the published fixtures in ``tests/fixtures/dsl-schema`` (the shared corpus) prove that both agree.
"""

import json
import re
from collections.abc import Iterator
from dataclasses import dataclass
from functools import cache
from importlib.resources import files
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError
from referencing import Registry, Resource

type Json = Any
type Segments = list[str | int]

SCHEMA_FILES = (
    "catalog.json",
    "common_types.json",
    "server_to_client.json",
    "artifact.schema.json",
)
# common_types.json and server_to_client.json refer to the catalog as `catalog.json` next to them.
CATALOG_ALIAS_ID = "https://a2ui.org/specification/v0_9/catalog.json"
ROOT_COMPONENT_ID = "root"
ROWS_PATH = "/rows"
PAGE_PATH = "/page"
PAGE_FIELDS = ("page", "pageSize", "totalRows", "remaining")
ROW_DATA_KEYS = ("rows", "data", "dataModel", "values", "updateDataModel")
_UNSAFE_CONTENT = (
    re.compile(r"<\s*[a-z!/?]", re.IGNORECASE),
    re.compile(r"\b(?:javascript|vbscript)\s*:", re.IGNORECASE),
    re.compile(r"\bdata\s*:\s*text/html", re.IGNORECASE),
)
_INTERPOLATION = re.compile(r"(?<!\\)\$\{([^}]*)\}")
_PLAIN_PATH = re.compile(r"^[^\s(){}$,'\"]+$")
_COMPONENT_PATH = re.compile(r"^/components/(\d+)(?:/|$)")


@dataclass(frozen=True)
class DslIssue:
    """One validation error. ``path`` is a JSON Pointer into the artifact."""

    code: str
    message: str
    path: str
    component_id: str | None = None


@dataclass(frozen=True)
class PinnedSchema:
    """The vendored ``@dtnam0899/dsl-schema`` files."""

    package_version: str
    catalog_id: str
    artifact_id: str
    components: frozenset[str]
    functions: frozenset[str]
    registry: Registry


def pointer(*segments: str | int) -> str:
    """Build a JSON Pointer from segments."""
    return "".join("/" + str(s).replace("~", "~0").replace("/", "~1") for s in segments)


@cache
def pinned_schema() -> PinnedSchema:
    """Load the vendored schemas once."""
    root = files("esi_agents.dsl") / "schema"
    docs = {name: json.loads((root / name).read_text(encoding="utf-8")) for name in SCHEMA_FILES}
    published = json.loads((root / "PUBLISHED.json").read_text(encoding="utf-8"))
    catalog = docs["catalog.json"]
    resources = [(doc["$id"], Resource.from_contents(doc)) for doc in docs.values()]
    resources.append(
        (CATALOG_ALIAS_ID, Resource.from_contents({**catalog, "$id": CATALOG_ALIAS_ID}))
    )
    return PinnedSchema(
        package_version=published["version"],
        catalog_id=catalog["catalogId"],
        artifact_id=docs["artifact.schema.json"]["$id"],
        components=frozenset(catalog["components"]),
        functions=frozenset(catalog["functions"]),
        registry=Registry().with_resources(resources),
    )


@cache
def _validator(ref: str) -> Draft202012Validator:
    # Formats are not checked (as in dsl-core); literal content is checked by the ESI rules.
    return Draft202012Validator({"$ref": ref}, registry=pinned_schema().registry)


def validate_artifact(artifact: Json) -> list[DslIssue]:
    """Every error of an untrusted artifact; an empty list means it may be rendered or saved."""
    if not isinstance(artifact, dict):
        return [DslIssue("schema", "The artifact must be a JSON object", "")]
    raw_components = artifact.get("components")
    components = (
        [c for c in raw_components if isinstance(c, dict)]
        if isinstance(raw_components, list)
        else []
    )
    raw_columns = artifact.get("columns")
    columns = [
        c["name"]
        for c in (raw_columns if isinstance(raw_columns, list) else [])
        if isinstance(c, dict) and isinstance(c.get("name"), str)
    ]
    esi = [*_row_data(artifact), *_component_rules(components), *_unsafe_content(components)]
    return [*_schema_errors(artifact, components), *esi, *_bindings(components, columns)]


def _schema_errors(artifact: dict[str, Json], components: list[dict[str, Json]]) -> list[DslIssue]:
    schema = pinned_schema()
    issues: list[DslIssue] = []
    reported: set[int] = set()
    for error in _validator(schema.artifact_id).iter_errors(artifact):
        path = pointer(*error.absolute_path)
        match = _COMPONENT_PATH.match(path)
        if not match:
            if error.validator == "additionalProperties" and not _extra_keys(error):
                continue  # row data keys get their own, clearer error
            issues.append(DslIssue("schema", f"{path or 'artifact'} {error.message}", path))
            continue
        # The catalog's oneOf reports every branch; validate the component against its own schema.
        index = int(match.group(1))
        if index in reported:
            continue
        reported.add(index)
        component = components[index] if index < len(components) else {}
        name = component.get("component")
        if (
            not isinstance(name, str)
            or name not in schema.components
            or _has_unknown_function(component)
        ):
            continue  # reported by the ESI rules
        ref = f"{schema.catalog_id}#/components/{name}"
        for inner in _validator(ref).iter_errors(component):
            at = f"/components/{index}" + pointer(*inner.absolute_path)
            issues.append(DslIssue("schema", f"{at} {inner.message}", at, str(component.get("id"))))
    return issues


def _extra_keys(error: ValidationError) -> list[str]:
    allowed = error.schema.get("properties", {}) if isinstance(error.schema, dict) else {}
    instance = error.instance if isinstance(error.instance, dict) else {}
    return [k for k in instance if k not in allowed and k not in ROW_DATA_KEYS]


def _row_data(artifact: dict[str, Json]) -> list[DslIssue]:
    return [
        DslIssue(
            "row-data",
            f'The artifact must not carry row data ("{key}"); bind components to columns instead',
            pointer(key),
        )
        for key in ROW_DATA_KEYS
        if key in artifact
    ]


def walk(value: Json, segments: Segments | None = None) -> Iterator[tuple[Json, Segments]]:
    """Every value below ``value``, depth first, with its path segments."""
    segments = segments or []
    yield value, segments
    if isinstance(value, list):
        for index, item in enumerate(value):
            yield from walk(item, [*segments, index])
    elif isinstance(value, dict):
        for key, item in value.items():
            yield from walk(item, [*segments, key])


def _calls(component: dict[str, Json]) -> Iterator[tuple[str, Segments]]:
    for node, segments in walk(component):
        if isinstance(node, dict) and isinstance(node.get("call"), str):
            yield node["call"], segments


def _has_unknown_function(component: dict[str, Json]) -> bool:
    return any(call not in pinned_schema().functions for call, _ in _calls(component))


@dataclass(frozen=True)
class ChildReference:
    """A reference to another component; ``template_path`` is set for a ``ChildList`` template."""

    id: str
    segments: Segments
    template_path: str | None = None
    is_template: bool = False


def child_references(component: dict[str, Json]) -> list[ChildReference]:
    """``child``, ``trigger``, ``content``, ``children`` (ids or template), ``tabs[].child``."""
    refs = [
        ChildReference(component[key], [key])
        for key in ("child", "trigger", "content")
        if isinstance(component.get(key), str)
    ]
    children = component.get("children")
    if isinstance(children, list):
        refs += [
            ChildReference(cid, ["children", i])
            for i, cid in enumerate(children)
            if isinstance(cid, str)
        ]
    elif isinstance(children, dict) and isinstance(children.get("componentId"), str):
        path = children.get("path")
        refs.append(
            ChildReference(
                children["componentId"],
                ["children", "componentId"],
                path if isinstance(path, str) else None,
                is_template=True,
            )
        )
    tabs = component.get("tabs")
    if isinstance(tabs, list):
        refs += [
            ChildReference(tab["child"], ["tabs", i, "child"])
            for i, tab in enumerate(tabs)
            if isinstance(tab, dict) and isinstance(tab.get("child"), str)
        ]
    return refs


def _component_rules(components: list[dict[str, Json]]) -> list[DslIssue]:
    schema = pinned_schema()
    issues: list[DslIssue] = []
    ids: set[str] = set()
    for index, component in enumerate(components):
        cid = component.get("id")
        if isinstance(cid, str):
            if cid in ids:
                issues.append(
                    DslIssue(
                        "duplicate-id",
                        f'Component id "{cid}" is used more than once',
                        pointer("components", index, "id"),
                        cid,
                    )
                )
            ids.add(cid)
        name = component.get("component")
        if isinstance(name, str) and name not in schema.components:
            issues.append(
                DslIssue(
                    "unknown-component",
                    f'"{name}" is not a component of the pinned basic catalog',
                    pointer("components", index, "component"),
                    str(cid),
                )
            )
        for call, segments in _calls(component):
            if call not in schema.functions:
                issues.append(
                    DslIssue(
                        "unknown-function",
                        f'"{call}" is not a function of the pinned basic catalog',
                        pointer("components", index, *segments, "call"),
                        str(cid),
                    )
                )
    if ROOT_COMPONENT_ID not in ids:
        issues.append(
            DslIssue(
                "missing-root",
                f'No component has the id "{ROOT_COMPONENT_ID}"',
                pointer("components"),
            )
        )
    for index, component in enumerate(components):
        for ref in child_references(component):
            if ref.id not in ids:
                cid = str(component.get("id"))
                issues.append(
                    DslIssue(
                        "missing-reference",
                        f'Component "{cid}" refers to "{ref.id}", which does not exist',
                        pointer("components", index, *ref.segments),
                        cid,
                    )
                )
    return issues


def _unsafe_content(components: list[dict[str, Json]]) -> list[DslIssue]:
    return [
        DslIssue(
            "unsafe-content",
            "Literal text must not contain HTML or script URLs",
            pointer("components", index, *segments),
            str(component.get("id")),
        )
        for index, component in enumerate(components)
        for node, segments in walk(component)
        if isinstance(node, str) and any(p.search(node) for p in _UNSAFE_CONTENT)
    ]


def _bound_paths(
    component: dict[str, Json], index: int, issues: list[DslIssue]
) -> list[tuple[str, Segments]]:
    """Every ``{path}`` binding, plus plain paths interpolated by ``formatString``."""
    bindings: list[tuple[str, Segments]] = []
    for node, segments in walk(component):
        if segments and segments[0] == "children":
            continue  # template path, checked with the template
        if not isinstance(node, dict):
            continue
        if isinstance(node.get("path"), str) and len(node) == 1:
            bindings.append((node["path"], [*segments, "path"]))
        args = node.get("args")
        if node.get("call") == "formatString" and isinstance(args, dict):
            value = args.get("value")
            if isinstance(value, str):
                for match in _INTERPOLATION.finditer(value):
                    expression = match.group(1).strip()
                    at: Segments = [*segments, "args", "value"]
                    if _PLAIN_PATH.match(expression):
                        bindings.append((expression, at))
                    else:
                        issues.append(
                            DslIssue(
                                "unsupported-expression",
                                f'formatString interpolation "${{{expression}}}" is not a plain '
                                "data path",
                                pointer("components", index, *at),
                                str(component.get("id")),
                            )
                        )
    return bindings


def _decode(segment: str) -> str:
    return segment.replace("~1", "/").replace("~0", "~")


def _resolve_column(path: str, in_row: bool) -> str | bool | None:
    """The column a path names, ``None`` for a valid ``/page/<field>``, ``False`` if invalid."""
    if not path.startswith("/"):
        if not in_row or path == "" or "/" in path:
            return False
        return _decode(path)
    root, *rest = [_decode(s) for s in path.split("/")[1:]]
    if f"/{root}" == ROWS_PATH:
        valid = len(rest) == 2 and re.fullmatch(r"0|[1-9]\d*", rest[0]) and rest[1] != ""
        return rest[1] if valid else False
    if f"/{root}" == PAGE_PATH:
        return None if len(rest) == 1 and rest[0] in PAGE_FIELDS else False
    return False


def _bindings(components: list[dict[str, Json]], columns: list[str]) -> list[DslIssue]:
    issues: list[DslIssue] = []
    by_id: dict[str, dict[str, Json]] = {}
    for component in components:
        if isinstance(component.get("id"), str):
            by_id.setdefault(component["id"], component)

    in_row: set[int] = set()

    def mark_row(cid: str) -> None:
        component = by_id.get(cid)
        if component is None or id(component) in in_row:
            return
        in_row.add(id(component))
        for ref in child_references(component):
            mark_row(ref.id)

    for index, component in enumerate(components):
        for ref in child_references(component):
            if not ref.is_template:
                continue
            if ref.template_path == ROWS_PATH:
                mark_row(ref.id)
            else:
                issues.append(
                    DslIssue(
                        "unknown-path",
                        f'A list template must iterate "{ROWS_PATH}", not "{ref.template_path}"',
                        pointer("components", index, "children", "path"),
                        str(component.get("id")),
                    )
                )

    column_set = set(columns)
    for index, component in enumerate(components):
        cid = str(component.get("id"))
        row = id(component) in in_row
        if row and any(ref.is_template for ref in child_references(component)):
            issues.append(
                DslIssue(
                    "unknown-path",
                    "A list template cannot be nested inside a row template; rows are flat",
                    pointer("components", index, "children", "path"),
                    cid,
                )
            )
        for path, segments in _bound_paths(component, index, issues):
            at = pointer("components", index, *segments)
            column = _resolve_column(path, row)
            if column is False:
                hint = (
                    "inside a row template use a relative column name, /rows/<index>/<column> or "
                    "/page/<field>"
                    if row
                    else "use /rows/<index>/<column> or /page/<field>, or a relative column name "
                    f"inside a {ROWS_PATH} template"
                )
                issues.append(
                    DslIssue("unknown-path", f'"{path}" is not a valid path; {hint}', at, cid)
                )
            elif isinstance(column, str) and column not in column_set:
                issues.append(
                    DslIssue(
                        "unknown-column",
                        f'"{path}" refers to column "{column}", which is not in the column '
                        "definitions",
                        at,
                        cid,
                    )
                )
    return issues
