"""Parsing of structured model output (untrusted text)."""

import json
from enum import Enum
from typing import Any

from pydantic import ValidationError

_FENCE = "```"


class ModelOutputError(ValueError):
    """The model output is not the expected JSON object."""


def parse_json_object(output: str) -> dict[str, Any]:
    """Parse one JSON object, tolerating a surrounding Markdown code fence."""
    text = output.strip()
    if text.startswith(_FENCE):
        text = text.removeprefix(_FENCE).removeprefix("json").strip()
        text = text.removesuffix(_FENCE).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as error:
        raise ModelOutputError(f"the answer is not valid JSON ({error.msg})") from error
    if not isinstance(data, dict):
        raise ModelOutputError("the answer must be a JSON object")
    return data


def describe(error: ModelOutputError | ValidationError) -> str:
    """Short, model-readable description of why the output was rejected."""
    if isinstance(error, ValidationError):
        text = "; ".join(f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in error.errors())
    else:
        text = str(error)
    return text[:500]


def enum_value(value: object) -> object:
    """The plain value of a generated enum member (or the value itself)."""
    return value.value if isinstance(value, Enum) else value
