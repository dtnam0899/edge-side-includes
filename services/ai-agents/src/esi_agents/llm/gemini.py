"""Gemini API client over plain ``httpx`` (ADR-0007: free tier, demo data only).

One ``generateContent`` call per ``complete``; timeouts and retries stay in ``guarded_complete``.
The key travels only in the ``x-goog-api-key`` header. Prompts, outputs and the key are never
logged or put into an error message.
"""

import logging
from typing import Any

import httpx

from esi_agents.config import Settings
from esi_agents.llm.base import ModelRateLimitedError, ModelUnavailableError

logger = logging.getLogger(__name__)

# Transient on Google's side: retried by ``guarded_complete`` (Gemini troubleshooting guide).
_TRANSIENT = {500, 502, 503, 504}


def _error_status(response: httpx.Response) -> str:
    """Google's error ``status`` field (for example ``PERMISSION_DENIED``); never the message."""
    try:
        status = response.json().get("error", {}).get("status")
    except (ValueError, AttributeError):
        return "unknown"
    return status if isinstance(status, str) and status.isupper() else "unknown"


class GeminiModel:
    """``ModelClient`` for the Gemini API ``generateContent`` endpoint."""

    def __init__(
        self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None
    ) -> None:
        if settings.gemini_api_key is None:
            raise ValueError("ESI_AGENTS_GEMINI_API_KEY is required for the Gemini model")
        self._settings = settings
        self._model = settings.gemini_model
        # Per-call timeouts come from guarded_complete; this only bounds a stuck connection.
        self._client = httpx.AsyncClient(
            base_url=settings.gemini_base_url.rstrip("/"),
            headers={"x-goog-api-key": settings.gemini_api_key.get_secret_value()},
            timeout=httpx.Timeout(settings.model_timeout_seconds + 5),
            transport=transport,
        )

    def _body(self, prompt: str) -> dict[str, Any]:
        settings = self._settings
        return {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": settings.gemini_temperature,
                "maxOutputTokens": settings.gemini_max_output_tokens,
                "thinkingConfig": {"thinkingLevel": settings.gemini_thinking_level.upper()},
            },
        }

    async def complete(self, prompt: str) -> str:
        """Return the text of the first candidate; ``ModelUnavailableError`` on any failure."""
        try:
            response = await self._client.post(
                f"/v1beta/models/{self._model}:generateContent", json=self._body(prompt)
            )
        except httpx.TimeoutException as error:
            raise ModelUnavailableError("the model did not answer in time") from error
        except httpx.HTTPError as error:
            raise ModelUnavailableError(
                f"the model could not be reached ({type(error).__name__})"
            ) from error
        if response.status_code == 429:
            logger.warning("gemini rate limited: %s", _error_status(response))
            raise ModelRateLimitedError()
        if response.status_code in _TRANSIENT:
            raise ModelUnavailableError(f"the model provider failed ({response.status_code})")
        if response.status_code != 200:
            status = _error_status(response)
            logger.error("gemini rejected the call: %d %s", response.status_code, status)
            raise ModelUnavailableError(
                f"the model provider rejected the call ({response.status_code} {status})",
                retryable=False,
            )
        return _text(response)

    async def aclose(self) -> None:
        """Close the HTTP client (app shutdown)."""
        await self._client.aclose()


def _text(response: httpx.Response) -> str:
    """Concatenated non-thought text parts of the first candidate."""
    try:
        data = response.json()
    except ValueError as error:
        raise ModelUnavailableError("the model answer could not be read") from error
    if not isinstance(data, dict):
        raise ModelUnavailableError("the model answer could not be read")
    candidates = data.get("candidates") or []
    if not candidates:
        reason = (data.get("promptFeedback") or {}).get("blockReason") or "no candidate"
        raise ModelUnavailableError(f"the model gave no answer ({reason})", retryable=False)
    candidate = candidates[0] if isinstance(candidates[0], dict) else {}
    parts = (candidate.get("content") or {}).get("parts") or []
    text = "".join(
        part["text"]
        for part in parts
        if isinstance(part, dict) and isinstance(part.get("text"), str) and not part.get("thought")
    )
    if not text and candidate.get("finishReason") not in (None, "STOP", "MAX_TOKENS"):
        raise ModelUnavailableError(
            f"the model gave no answer ({candidate.get('finishReason')})", retryable=False
        )
    # MAX_TOKENS or non-JSON text is returned as is: the agent's checks reject it and retry.
    return text
