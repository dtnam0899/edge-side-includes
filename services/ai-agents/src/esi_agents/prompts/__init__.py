"""Versioned prompt templates (``<name>.v<N>.md``, ``string.Template`` placeholders)."""

from importlib.resources import files
from string import Template

SQL_GENERATION = "sql_generation.v2"
DSL_GENERATION = "dsl_generation.v2"


def render(name: str, **values: str) -> str:
    """Fill the prompt ``name`` with ``values``; substituted text is never re-interpreted."""
    template = (files("esi_agents.prompts") / f"{name}.md").read_text(encoding="utf-8")
    return Template(template).substitute(values)
