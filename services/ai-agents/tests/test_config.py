import pytest

from esi_agents.config import Settings


def test_settings_read_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ESI_AGENTS_PORT", "9001")
    monkeypatch.setenv("ESI_AGENTS_LOG_LEVEL", "DEBUG")
    settings = Settings()
    assert settings.port == 9001
    assert settings.log_level == "DEBUG"
