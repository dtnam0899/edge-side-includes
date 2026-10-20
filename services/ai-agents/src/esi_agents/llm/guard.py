"""Limits around every model call: prompt size, timeout, retries with backoff, request deadline."""

import asyncio
import logging
import time

from esi_agents.config import Settings
from esi_agents.llm.base import ModelClient, ModelUnavailableError

logger = logging.getLogger(__name__)


class PromptTooLargeError(ValueError):
    """The prompt exceeds ``max_prompt_chars`` (for example a very large schema)."""


class Deadline:
    """One time budget for a whole agents request: all candidates and all attempts (ADR-0007)."""

    def __init__(self, seconds: float) -> None:
        self._end = time.monotonic() + seconds

    def remaining(self) -> float:
        """Seconds left, never below zero."""
        return max(0.0, self._end - time.monotonic())


def _out_of_time() -> ModelUnavailableError:
    return ModelUnavailableError("the model did not answer in time", retryable=False)


async def guarded_complete(
    model: ModelClient, prompt: str, settings: Settings, deadline: Deadline | None = None
) -> str:
    """Call ``model`` within the limits; ``ModelUnavailableError`` if it keeps failing.

    With a ``deadline`` no call starts after it has passed and each call's timeout is capped by
    the time left. Errors marked not retryable (rate limit, configuration faults) end at once.
    """
    if len(prompt) > settings.max_prompt_chars:
        raise PromptTooLargeError(
            f"prompt has {len(prompt)} characters, the limit is {settings.max_prompt_chars}"
        )
    for attempt in range(settings.model_retries + 1):
        timeout = settings.model_timeout_seconds
        if deadline is not None:
            if deadline.remaining() <= 0:
                raise _out_of_time()
            timeout = min(timeout, deadline.remaining())
        try:
            async with asyncio.timeout(timeout):
                return await model.complete(prompt)
        except (TimeoutError, ModelUnavailableError) as error:
            # Never log the prompt: it holds the user's question and schema.
            logger.warning("model call failed (attempt %d): %s", attempt + 1, type(error).__name__)
            if isinstance(error, ModelUnavailableError) and not error.retryable:
                raise
            backoff = settings.model_backoff_seconds * 2**attempt
            if deadline is not None and deadline.remaining() <= backoff:
                raise _out_of_time() from error
            if attempt == settings.model_retries:
                raise ModelUnavailableError("the model did not answer") from error
            await asyncio.sleep(backoff)
    raise AssertionError("unreachable")
