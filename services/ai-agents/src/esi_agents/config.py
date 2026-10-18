"""Service settings, read from environment variables only (prefix ``ESI_AGENTS_``)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. No secrets have defaults; model keys arrive with the provider ADR."""

    model_config = SettingsConfigDict(env_prefix="ESI_AGENTS_", env_file=None, extra="ignore")

    log_level: str = "INFO"
    host: str = "0.0.0.0"  # noqa: S104 - container binds all interfaces; override via env
    port: int = 8000


@lru_cache
def get_settings() -> Settings:
    """Return the cached settings instance."""
    return Settings()
