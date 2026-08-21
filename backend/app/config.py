from pathlib import Path
from pydantic_settings import BaseSettings


ROOT_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):

    MONGO_URL: str

    DB_NAME: str

    JWT_SECRET: str

    JWT_ALGORITHM: str = "HS256"

    EMERGENT_LLM_KEY: str = ""

    GEMINI_API_KEY: str

    class Config:
        env_file = ROOT_DIR / ".env"


settings = Settings()