"""Model client interface shared by agents and the eval runner."""

from typing import Protocol


class ModelClient(Protocol):
    """Minimal async completion interface; real clients add timeouts, retries and token limits."""

    async def complete(self, prompt: str) -> str:
        """Return the model output for ``prompt``."""
        ...
