from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://dominator:dominator_dev@localhost:5432/dominator"
    DATABASE_URL_SYNC: str = "postgresql://dominator:dominator_dev@localhost:5432/dominator"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ARTIFACTS_DIR: str = "./data/artifacts"
    CORS_ORIGINS: str = "http://localhost:3000"
    OLLAMA_URL: str = "http://100.89.134.116:11434"
    OLLAMA_MODEL: str = "llama3.2"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()