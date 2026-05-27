from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, AnyUrl, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["local", "test", "staging", "production"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="LUMEN_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    app_name: str = "Lumen API"
    app_version: str = "0.1.0"
    environment: Environment = "local"
    api_v1_prefix: str = "/api/v1"
    docs_url: str | None = "/docs"
    redoc_url: str | None = "/redoc"
    openapi_url: str | None = "/openapi.json"

    database_url: str = "sqlite+aiosqlite:///:memory:"
    database_echo: bool = False

    allowed_origins: list[AnyUrl] = []
    trusted_proxy_headers: bool = False

    jwt_issuer: str = "lumen-api"
    jwt_audience: str = "lumen-clients"
    jwt_private_key: SecretStr | None = None
    jwt_public_key: SecretStr | None = None
    access_token_ttl_seconds: int = 900
    refresh_token_ttl_seconds: int = 2_592_000
    mfa_challenge_ttl_seconds: int = 300

    api_key_hash_pepper: SecretStr | None = None
    bootstrap_admin_api_key: SecretStr | None = None
    session_hash_pepper: SecretStr | None = None
    node_token_hash_pepper: SecretStr | None = None
    node_install_token_ttl_seconds: int = 900

    first_admin_email: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FIRST_ADMIN_EMAIL", "LUMEN_FIRST_ADMIN_EMAIL"),
    )
    first_admin_username: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FIRST_ADMIN_USERNAME", "LUMEN_FIRST_ADMIN_USERNAME"),
    )
    first_admin_password: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("FIRST_ADMIN_PASSWORD", "LUMEN_FIRST_ADMIN_PASSWORD"),
    )

    free_license_node_limit: int = 3
    central_license_sync_url: AnyUrl | None = None
    central_license_sync_secret: SecretStr | None = None
    central_license_public_key_b64: str | None = None

    log_level: str = "INFO"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
