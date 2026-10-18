"""Model client interface shared by agents and the eval runner."""

from typing import Protocol


class ModelUnavailableError(RuntimeError):
    """The model provider failed, timed out or is not configured (problem ``model-unavailable``)."""


class ModelClient(Protocol):
    """Minimal async completion interface; ``guarded_complete`` adds timeouts and limits."""

    async def complete(self, prompt: str) -> str:
        """Return the model output for ``prompt``; raise ``ModelUnavailableError`` on failure."""
        ...


class UnconfiguredModel:
    """Used until the provider ADR is accepted: every call reports the model as unavailable."""

    async def complete(self, prompt: str) -> str:
        """Always fail; no provider is configured."""
        raise ModelUnavailableError("no model provider is configured")
