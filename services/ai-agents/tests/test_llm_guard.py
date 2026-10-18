import asyncio

import pytest

from esi_agents.config import Settings
from esi_agents.llm import ModelUnavailableError, PromptTooLargeError, StubModel, guarded_complete


class SlowModel:
    def __init__(self) -> None:
        self.calls = 0

    async def complete(self, prompt: str) -> str:
        self.calls += 1
        await asyncio.sleep(1)
        return "late"


class FlakyModel:
    def __init__(self) -> None:
        self.calls = 0

    async def complete(self, prompt: str) -> str:
        self.calls += 1
        if self.calls == 1:
            raise ModelUnavailableError("boom")
        return "ok"


def settings(**values) -> Settings:
    return Settings(model_backoff_seconds=0, **values)


def test_timeouts_are_retried_then_reported() -> None:
    model = SlowModel()
    with pytest.raises(ModelUnavailableError):
        asyncio.run(
            guarded_complete(model, "p", settings(model_timeout_seconds=0.01, model_retries=1))
        )
    assert model.calls == 2


def test_a_transient_failure_is_retried() -> None:
    model = FlakyModel()
    assert asyncio.run(guarded_complete(model, "p", settings(model_retries=1))) == "ok"
    assert model.calls == 2


def test_prompt_size_is_limited() -> None:
    model = StubModel(default="x")
    with pytest.raises(PromptTooLargeError):
        asyncio.run(guarded_complete(model, "p" * 11, settings(max_prompt_chars=10)))
    assert model.prompts == []
