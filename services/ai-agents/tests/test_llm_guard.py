import asyncio

import pytest

from esi_agents.config import Settings
from esi_agents.llm import (
    Deadline,
    ModelRateLimitedError,
    ModelUnavailableError,
    PromptTooLargeError,
    StubModel,
    guarded_complete,
)


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


class FailingModel:
    def __init__(self, error: ModelUnavailableError) -> None:
        self.error = error
        self.calls = 0

    async def complete(self, prompt: str) -> str:
        self.calls += 1
        raise self.error


@pytest.mark.parametrize(
    "error",
    [ModelRateLimitedError(), ModelUnavailableError("bad key", retryable=False)],
)
def test_non_retryable_failures_end_at_once(error: ModelUnavailableError) -> None:
    model = FailingModel(error)
    with pytest.raises(ModelUnavailableError) as raised:
        asyncio.run(guarded_complete(model, "p", settings(model_retries=3)))
    assert raised.value is error
    assert model.calls == 1


def test_deadline_caps_the_call_timeout() -> None:
    model = SlowModel()

    async def run() -> None:
        await guarded_complete(
            model, "p", settings(model_timeout_seconds=30, model_retries=3), Deadline(0.05)
        )

    with pytest.raises(ModelUnavailableError, match="in time"):
        asyncio.run(run())
    assert model.calls == 1


def test_no_call_starts_after_the_deadline() -> None:
    model = StubModel(default="x")
    with pytest.raises(ModelUnavailableError, match="in time"):
        asyncio.run(guarded_complete(model, "p", settings(), Deadline(0)))
    assert model.prompts == []
