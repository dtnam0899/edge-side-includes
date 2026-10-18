"""Limits around every model call: prompt size, timeout and retries with backoff."""

import asyncio
import logging

from esi_agents.config import Settings
from esi_agents.llm.base import ModelClient, ModelUnavailableError

logger = logging.getLogger(__name__)


class PromptTooLargeError(ValueError):
    """The prompt exceeds ``max_prompt_chars`` (for example a very large schema)."""


async def guarded_complete(model: ModelClient, prompt: str, settings: Settings) -> str:
    """Call ``model`` within the limits; ``ModelUnavailableError`` if it keeps failing."""
    if len(prompt) > settings.max_prompt_chars:
        raise PromptTooLargeError(
            f"prompt has {len(prompt)} characters, the limit is {settings.max_prompt_chars}"
        )
    for attempt in range(settings.model_retries + 1):
        try:
            async with asyncio.timeout(settings.model_timeout_seconds):
                return await model.complete(prompt)
        except (TimeoutError, ModelUnavailableError) as error:
            # Never log the prompt: it holds the user's question and schema.
            logger.warning("model call failed (attempt %d): %s", attempt + 1, type(error).__name__)
            if attempt == settings.model_retries:
                raise ModelUnavailableError("the model did not answer") from error
            await asyncio.sleep(settings.model_backoff_seconds * 2**attempt)
    raise AssertionError("unreachable")
