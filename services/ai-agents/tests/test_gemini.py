import asyncio
import json
import logging
from collections.abc import Callable
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from esi_agents.app import create_app
from esi_agents.config import Settings
from esi_agents.llm import (
    GeminiModel,
    ModelRateLimitedError,
    ModelUnavailableError,
    UnconfiguredModel,
    build_model,
    guarded_complete,
)

KEY = "test-key-NOT-A-REAL-SECRET"
PROMPT = "PROMPT-SENTINEL question"
FIXTURE = Path(__file__).resolve().parents[1] / "evals" / "fixtures" / "sales-schema.json"


def settings(**values) -> Settings:
    return Settings(model_provider="gemini", gemini_api_key=KEY, model_backoff_seconds=0, **values)


def answer(text: str, **candidate) -> dict:
    return {"candidates": [{"content": {"role": "model", "parts": [{"text": text}]}, **candidate}]}


class Recorder:
    """MockTransport handler: answers each request with the next scripted response."""

    def __init__(self, *responses: httpx.Response | Callable[[httpx.Request], httpx.Response]):
        self.responses = list(responses)
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        response = self.responses.pop(0) if len(self.responses) > 1 else self.responses[0]
        return response(request) if callable(response) else response


def model(handler: Recorder, **values) -> GeminiModel:
    return GeminiModel(settings(**values), transport=httpx.MockTransport(handler))


def complete(client: GeminiModel, **values) -> str:
    return asyncio.run(guarded_complete(client, PROMPT, settings(**values)))


def test_request_shape_and_key_header() -> None:
    handler = Recorder(httpx.Response(200, json=answer('{"kind": "none"}')))
    assert complete(model(handler, gemini_max_output_tokens=4096)) == '{"kind": "none"}'
    [request] = handler.requests
    assert request.method == "POST"
    assert str(request.url) == (
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"
    )
    assert request.headers["x-goog-api-key"] == KEY
    assert KEY not in str(request.url)
    body = json.loads(request.content)
    assert body == {
        "contents": [{"role": "user", "parts": [{"text": PROMPT}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2,
            "maxOutputTokens": 4096,
            "thinkingConfig": {"thinkingLevel": "LOW"},
        },
    }


def test_model_and_base_url_come_from_settings() -> None:
    handler = Recorder(httpx.Response(200, json=answer("{}")))
    client = model(
        handler, gemini_model="gemini-3.5-flash-lite", gemini_base_url="https://example.test/"
    )
    complete(client)
    assert str(handler.requests[0].url) == (
        "https://example.test/v1beta/models/gemini-3.5-flash-lite:generateContent"
    )


def test_text_parts_are_joined_and_thoughts_skipped() -> None:
    parts = [{"text": "thinking...", "thought": True}, {"text": '{"a":'}, {"text": " 1}"}]
    data = {"candidates": [{"content": {"parts": parts}, "finishReason": "STOP"}]}
    assert complete(model(Recorder(httpx.Response(200, json=data)))) == '{"a": 1}'


def test_truncated_output_is_returned_for_the_agent_to_reject() -> None:
    data = answer('{"kind": "qu', finishReason="MAX_TOKENS")
    assert complete(model(Recorder(httpx.Response(200, json=data)))) == '{"kind": "qu'


def test_rate_limit_is_not_retried() -> None:
    error = {"error": {"code": 429, "message": "quota", "status": "RESOURCE_EXHAUSTED"}}
    handler = Recorder(httpx.Response(429, json=error))
    with pytest.raises(ModelRateLimitedError, match="rate limited"):
        complete(model(handler), model_retries=3)
    assert len(handler.requests) == 1


@pytest.mark.parametrize(
    ("status", "google"),
    [
        (400, "INVALID_ARGUMENT"),
        (403, "PERMISSION_DENIED"),
        (404, "NOT_FOUND"),
        (401, "UNAUTHENTICATED"),
    ],
)
def test_configuration_faults_are_not_retried(status: int, google: str) -> None:
    error = {"error": {"code": status, "message": f"bad {KEY}", "status": google}}
    handler = Recorder(httpx.Response(status, json=error))
    with pytest.raises(ModelUnavailableError) as raised:
        complete(model(handler), model_retries=3)
    assert len(handler.requests) == 1
    assert str(raised.value) == f"the model provider rejected the call ({status} {google})"


@pytest.mark.parametrize("status", [500, 503, 504])
def test_server_errors_are_retried(status: int) -> None:
    handler = Recorder(httpx.Response(status), httpx.Response(200, json=answer("ok")))
    assert complete(model(handler), model_retries=1) == "ok"
    assert len(handler.requests) == 2


def test_connection_errors_and_timeouts_are_retried() -> None:
    def fail(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    def slow(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    handler = Recorder(fail, slow, httpx.Response(200, json=answer("ok")))
    assert complete(model(handler), model_retries=2) == "ok"
    assert len(handler.requests) == 3


@pytest.mark.parametrize(
    "data",
    [
        {"promptFeedback": {"blockReason": "SAFETY"}},
        {"candidates": []},
        {"candidates": [{"content": {"parts": []}, "finishReason": "PROHIBITED_CONTENT"}]},
    ],
)
def test_blocked_or_empty_answers_are_not_retried(data: dict) -> None:
    handler = Recorder(httpx.Response(200, json=data))
    with pytest.raises(ModelUnavailableError, match="gave no answer"):
        complete(model(handler), model_retries=2)
    assert len(handler.requests) == 1


def test_unreadable_body_is_unavailable() -> None:
    with pytest.raises(ModelUnavailableError):
        complete(model(Recorder(httpx.Response(200, text="<html>"))), model_retries=0)


def test_key_and_prompt_are_never_logged(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.DEBUG)
    error = {"error": {"code": 403, "message": f"key {KEY} prompt {PROMPT}", "status": "X"}}
    for response in (httpx.Response(403, json=error), httpx.Response(429, json=error)):
        with pytest.raises(ModelUnavailableError) as raised:
            complete(model(Recorder(response)))
        assert KEY not in str(raised.value)
        assert "PROMPT-SENTINEL" not in str(raised.value)
    assert KEY not in caplog.text
    assert "PROMPT-SENTINEL" not in caplog.text


def test_settings_require_a_key_for_gemini() -> None:
    with pytest.raises(ValueError, match="GEMINI_API_KEY is required"):
        Settings(model_provider="gemini")
    with pytest.raises(ValueError, match="GEMINI_API_KEY is required"):
        Settings(model_provider="gemini", gemini_api_key="  ")


def test_settings_never_show_the_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ESI_AGENTS_MODEL_PROVIDER", "gemini")
    monkeypatch.setenv("ESI_AGENTS_GEMINI_API_KEY", KEY)
    monkeypatch.setenv("ESI_AGENTS_GEMINI_MODEL", "gemini-3.5-flash-lite")
    loaded = Settings()
    assert loaded.gemini_model == "gemini-3.5-flash-lite"
    assert KEY not in repr(loaded)
    assert KEY not in str(loaded.model_dump())


def test_provider_selects_the_client() -> None:
    assert isinstance(build_model(Settings()), UnconfiguredModel)
    assert isinstance(build_model(settings()), GeminiModel)


def _api(handler: Recorder, **values) -> TestClient:
    return TestClient(create_app(model(handler, **values), settings(**values)))


def _sql_request() -> dict:
    schema = json.loads(FIXTURE.read_text(encoding="utf-8"))["schema"]
    return {"question": PROMPT, "schema": schema}


def test_api_returns_generated_sql_from_gemini() -> None:
    sql = "SELECT c.Name FROM dbo.Customers AS c"
    output = json.dumps({"kind": "query", "sql": sql, "explanation": "All customer names."})
    handler = Recorder(httpx.Response(200, json=answer(output)))
    with _api(handler) as api:
        response = api.post("/sql-generations", json=_sql_request())
    assert response.status_code == 200
    assert response.json()["sql"] == sql


def test_api_rate_limit_is_model_unavailable_without_retries() -> None:
    error = {"error": {"code": 429, "message": KEY, "status": "RESOURCE_EXHAUSTED"}}
    handler = Recorder(httpx.Response(429, json=error))
    with _api(handler, model_retries=2, sql_max_retries=2) as api:
        response = api.post("/sql-generations", json=_sql_request())
    assert response.status_code == 503
    problem = response.json()
    assert problem["type"] == "urn:esi:problem:model-unavailable"
    assert problem["detail"] == "the model is rate limited, try again later"
    assert KEY not in response.text
    assert "PROMPT-SENTINEL" not in response.text
    assert len(handler.requests) == 1
