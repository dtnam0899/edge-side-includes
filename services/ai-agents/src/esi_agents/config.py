"""Service settings, read from environment variables only (prefix ``ESI_AGENTS_``)."""

from functools import lru_cache
from typing import Literal, Self

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. Secrets have no defaults and are ``SecretStr`` (never logged)."""

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
    # One deadline for a whole agents request (all candidates, all attempts); below core's 120 s.
    request_deadline_seconds: float = Field(default=80.0, gt=0)
    # Model provider (ADR-0007): ``none`` answers every generation with ``model-unavailable``.
    model_provider: Literal["none", "gemini"] = "none"
    gemini_api_key: SecretStr | None = None
    gemini_model: str = Field(default="gemini-3.8-flash", min_length=1)
    gemini_thinking_level: Literal["minimal", "low", "medium", "high"] = "low"
    gemini_temperature: float = Field(default=0.2, ge=0, le=2)
    gemini_max_output_tokens: int = Field(default=8192, ge=256, le=65_536)
    gemini_base_url: str = "https://generativelanguage.googleapis.com"

    @model_validator(mode="after")
    def _provider_is_complete(self) -> Self:
        """Fail at startup when the chosen provider has no key."""
        key = self.gemini_api_key.get_secret_value().strip() if self.gemini_api_key else ""
        if self.model_provider == "gemini" and not key:
            raise ValueError("ESI_AGENTS_GEMINI_API_KEY is required when MODEL_PROVIDER=gemini")
        return self


@lru_cache
def get_settings() -> Settings:
    """Return the cached settings instance."""
    return Settings()
