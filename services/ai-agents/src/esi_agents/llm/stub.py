"""Deterministic stub model for tests and evals. Never calls the network."""

from collections.abc import Mapping, Sequence


class StubModel:
    """Returns a canned response per prompt, the next scripted output, or a fixed default.

    ``prompts`` records every prompt, so tests and evals can check what would reach a real model.
    """

    def __init__(
        self,
        responses: Mapping[str, str] | None = None,
        default: str = "",
        script: Sequence[str] | None = None,
    ) -> None:
        self._responses = dict(responses or {})
        self._default = default
        self._script = list(script or [])
        self.prompts: list[str] = []

    async def complete(self, prompt: str) -> str:
        """Return the canned response for ``prompt``, else the next scripted output."""
        self.prompts.append(prompt)
        if prompt in self._responses:
            return self._responses[prompt]
        return self._script.pop(0) if self._script else self._default
