"""FastAPI application. Feature routes come from the agents-api contract (ESI-13, ESI-18)."""

import logging

from fastapi import FastAPI
from pydantic import BaseModel

from esi_agents import __version__
from esi_agents.config import get_settings


class Health(BaseModel):
    """Liveness response. Operational endpoint, not part of the agents-api contract."""

    status: str
    version: str


def create_app() -> FastAPI:
    """Build the application."""
    settings = get_settings()
    logging.basicConfig(level=settings.log_level)
    app = FastAPI(title="esi-agents", version=__version__)

    @app.get("/health", response_model=Health)
    async def health() -> Health:
        return Health(status="ok", version=__version__)

    return app


app = create_app()
