"""Model client interface shared by agents and the eval runner."""

from typing import Protocol


class ModelUnavailableError(RuntimeError):
    """The model provider failed, timed out or is not configured (problem ``model-unavailable``).

    ``retryable`` is false when another attempt cannot help (bad key, unknown model, blocked
    prompt, exhausted quota); ``guarded_complete`` then reports it at once.
    """

    def __init__(self, message: str, *, retryable: bool = True) -> None:
        super().__init__(message)
        self.retryable = retryable


class ModelRateLimitedError(ModelUnavailableError):
    """The provider rejected the call for its quota (HTTP 429); never retried (ADR-0007)."""

    def __init__(self, message: str = "the model is rate limited, try again later") -> None:
        super().__init__(message, retryable=False)


class ModelClient(Protocol):
    """Minimal async completion interface; ``guarded_complete`` adds timeouts and limits."""

    async def complete(self, prompt: str) -> str:
        """Return the model output for ``prompt``; raise ``ModelUnavailableError`` on failure."""
        ...


class UnconfiguredModel:
    """Used when ``ESI_AGENTS_MODEL_PROVIDER`` is ``none``: every call reports no model."""

    async def complete(self, prompt: str) -> str:
        """Always fail; no provider is configured."""
        raise ModelUnavailableError("no model provider is configured", retryable=False)
