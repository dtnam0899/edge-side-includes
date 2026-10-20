"""Model clients: the Gemini API for the demo (ADR-0007), a stub for tests and evals."""

from esi_agents.config import Settings
from esi_agents.llm.base import (
    ModelClient,
    ModelRateLimitedError,
    ModelUnavailableError,
    UnconfiguredModel,
)
from esi_agents.llm.gemini import GeminiModel
from esi_agents.llm.guard import Deadline, PromptTooLargeError, guarded_complete
from esi_agents.llm.stub import StubModel


def build_model(settings: Settings) -> GeminiModel | UnconfiguredModel:
    """The client for ``ESI_AGENTS_MODEL_PROVIDER``."""
    if settings.model_provider == "gemini":
        return GeminiModel(settings)
    return UnconfiguredModel()


__all__ = [
    "Deadline",
    "GeminiModel",
    "ModelClient",
    "ModelRateLimitedError",
    "ModelUnavailableError",
    "PromptTooLargeError",
    "StubModel",
    "UnconfiguredModel",
    "build_model",
    "guarded_complete",
]
