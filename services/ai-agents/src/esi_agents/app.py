"""FastAPI application: ``/health`` plus the agents-api operations (contract in ``vendor/``)."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from esi_agents import __version__
from esi_agents.agents import (
    DslGenerationAgent,
    DslGenerationFailedError,
    InvalidDslRequestError,
    SqlGenerationAgent,
)
from esi_agents.config import Settings, get_settings
from esi_agents.contracts.agents_api import (
    DslGenerationRequest,
    DslGenerationResult,
    SqlGenerationRequest,
    SqlGenerationResult,
)
from esi_agents.llm import (
    ModelClient,
    ModelUnavailableError,
    PromptTooLargeError,
    UnconfiguredModel,
)

PROBLEM_JSON = "application/problem+json"


class Health(BaseModel):
    """Liveness response. Operational endpoint, not part of the agents-api contract."""

    status: str
    version: str


def problem(status: int, name: str, title: str, detail: str, **extra: object) -> JSONResponse:
    """An RFC 9457 problem response of type ``urn:esi:problem:<name>``."""
    body = {"type": f"urn:esi:problem:{name}", "title": title, "status": status, "detail": detail}
    return JSONResponse({**body, **extra}, status_code=status, media_type=PROBLEM_JSON)


def create_app(model: ModelClient | None = None, settings: Settings | None = None) -> FastAPI:
    """Build the application. Without a model every generation answers ``model-unavailable``."""
    settings = settings or get_settings()
    logging.basicConfig(level=settings.log_level)
    model = model or UnconfiguredModel()
    sql_agent = SqlGenerationAgent(model, settings)
    dsl_agent = DslGenerationAgent(model, settings)
    app = FastAPI(title="esi-agents", version=__version__)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_: Request, error: RequestValidationError) -> JSONResponse:
        errors = [
            {"field": "/".join(str(p) for p in e["loc"][1:]), "message": e["msg"]}
            for e in error.errors()
        ]
        return problem(
            400,
            "invalid-request",
            "Invalid request",
            "The body does not match the contract",
            errors=errors,
        )

    @app.exception_handler(InvalidDslRequestError)
    @app.exception_handler(PromptTooLargeError)
    async def unusable_request(_: Request, error: Exception) -> JSONResponse:
        return problem(400, "invalid-request", "Invalid request", str(error))

    @app.exception_handler(ModelUnavailableError)
    async def model_unavailable(_: Request, error: ModelUnavailableError) -> JSONResponse:
        return problem(503, "model-unavailable", "Model unavailable", str(error))

    @app.exception_handler(DslGenerationFailedError)
    async def dsl_failed(_: Request, error: DslGenerationFailedError) -> JSONResponse:
        issues = [
            {"code": i.code, "message": i.message, **({"path": i.path} if i.path else {})}
            for i in error.issues
        ]
        return problem(
            422,
            "dsl-validation-failed",
            "No valid DSL could be generated",
            f"Every attempt failed validation ({settings.dsl_max_retries} retries)",
            issues=issues,
        )

    @app.get("/health", response_model=Health)
    async def health() -> Health:
        return Health(status="ok", version=__version__)

    @app.post(
        "/sql-generations", response_model=SqlGenerationResult, response_model_exclude_none=True
    )
    async def generate_sql(request: SqlGenerationRequest) -> SqlGenerationResult:
        return await sql_agent.generate(request)

    @app.post(
        "/dsl-generations", response_model=DslGenerationResult, response_model_exclude_none=True
    )
    async def generate_dsl(request: DslGenerationRequest) -> DslGenerationResult:
        return await dsl_agent.generate(request)

    return app


app = create_app()
