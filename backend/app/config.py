from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "EIS Dashboard"
    ENVIRONMENT: str = "development"

    # PostgreSQL
    DATABASE_URL: str = "postgresql+asyncpg://eis_user:eis_secret@postgres:5432/eis_dashboard"
    DATABASE_URL_SYNC: str = "postgresql://eis_user:eis_secret@postgres:5432/eis_dashboard"

    # Redis
    REDIS_URL: str = "redis://:eis_redis@redis:6379/0"
    CELERY_BROKER_URL: str = "redis://:eis_redis@redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://:eis_redis@redis:6379/2"

    # Oracle EBS
    ORACLE_HOST: str = "172.21.2.201"
    ORACLE_PORT: int = 1521
    ORACLE_SERVICE: str = "PROD"
    ORACLE_USER: str = "apps"
    ORACLE_PASSWORD: str = ""
    ORACLE_INSTANT_CLIENT: str = "/opt/oracle/instantclient_23_4"

    # Keycloak
    KEYCLOAK_URL: str = "http://localhost:8080/auth"
    KEYCLOAK_REALM: str = "ckdo"
    KEYCLOAK_CLIENT_ID: str = "eis-dashboard"

    # JWT
    SECRET_KEY: str = "changeme"
    ALLOWED_ORIGINS: str = "http://localhost:3001,http://localhost:8080"

    @property
    def oracle_dsn(self) -> str:
        return f"{self.ORACLE_HOST}:{self.ORACLE_PORT}/{self.ORACLE_SERVICE}"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
