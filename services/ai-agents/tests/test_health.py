from fastapi.testclient import TestClient

from esi_agents import __version__
from esi_agents.app import create_app


def test_health_returns_ok() -> None:
    response = TestClient(create_app()).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": __version__}
