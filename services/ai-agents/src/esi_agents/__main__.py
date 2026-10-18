"""Run the service: ``python -m esi_agents``."""

import uvicorn

from esi_agents.config import get_settings


def main() -> None:
    """Start uvicorn with settings from the environment."""
    settings = get_settings()
    uvicorn.run("esi_agents.app:app", host=settings.host, port=settings.port)


if __name__ == "__main__":
    main()
