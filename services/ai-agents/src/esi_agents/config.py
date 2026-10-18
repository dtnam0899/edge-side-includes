"""Service settings, read from environment variables only (prefix ``ESI_AGENTS_``)."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. No secrets have defaults; model keys arrive with the provider ADR."""

    model_config = SettingsConfigDict(env_prefix="ESI_AGENTS_", env_file=None, extra="ignore")

    log_level: str = "INFO"
    host: str = "0.0.0.0"  # noqa: S104 - container binds all interfaces; override via env
    port: int = 8000
    # Generation (ESI-18): retries after a candidate fails the agent's checks (UR-1 SR-5: 2).
    sql_max_retries: int = Field(default=2, ge=0, le=5)
    dsl_max_retries: int = Field(default=2, ge=0, le=5)
    # Every model call: timeout, retries with exponential backoff, prompt size limit.
    model_timeout_seconds: float = Field(default=60.0, gt=0)
    model_retries: int = Field(default=1, ge=0, le=5)
    model_backoff_seconds: float = Field(default=0.5, ge=0)
    max_prompt_chars: int = Field(default=200_000, gt=0)


@lru_cache
def get_settings() -> Settings:
    """Return the cached settings instance."""
    return Settings()
