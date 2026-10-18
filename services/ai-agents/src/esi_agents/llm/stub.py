"""Deterministic stub model for tests and evals. Never calls the network."""

from collections.abc import Mapping


class StubModel:
    """Returns a canned response per prompt, or a fixed default."""

    def __init__(self, responses: Mapping[str, str] | None = None, default: str = "") -> None:
        self._responses = dict(responses or {})
        self._default = default

    async def complete(self, prompt: str) -> str:
        """Return the canned response for ``prompt``."""
        return self._responses.get(prompt, self._default)
