from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parent.parent


# The Google OAuth clients this backend accepts ID tokens from.
# Android / iOS / Web clients all issue tokens with their own `aud`, so every
# client the app can run as has to be listed here or verification fails with
# "Token has wrong audience".
DEFAULT_GOOGLE_CLIENT_IDS = ",".join(
    [
        # Android
        "917307607930-5mulp0qe4b55gvhrno6qbnvmh2a2e1sc.apps.googleusercontent.com",
        # iOS
        "917307607930-u5kaei1ktf64c8f7h5r6rq7io6hv5gbr.apps.googleusercontent.com",
        # Web
        "917307607930-q5916sbm39ga8bctlvumir4h3jmp4c34.apps.googleusercontent.com",
    ]
)


class Settings(BaseSettings):

    MONGO_URL: str = "mongodb://localhost:27017"

    DB_NAME: str = "prankfx"

    JWT_SECRET: str = "change-me-in-production"

    JWT_ALGORITHM: str = "HS256"

    # 30 days. The app has no refresh-token flow, so a 60-minute access token
    # meant users were silently signed out mid-session.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30

    # Comma-separated list of accepted Google OAuth client IDs.
    GOOGLE_CLIENT_IDS: str = DEFAULT_GOOGLE_CLIENT_IDS

    # Comma-separated CORS origins, or "*" for any.
    # A mobile app sends no Origin header, so "*" is safe here; tighten it
    # if you ever serve the web build from a known domain.
    CORS_ORIGINS: str = "*"

    # FX credits granted on sign-up.
    SIGNUP_FX_CREDITS: int = 1

    EMERGENT_LLM_KEY: str = ""

    GEMINI_API_KEY: str = ""

    @property
    def google_client_ids(self) -> list[str]:
        return [
            item.strip()
            for item in self.GOOGLE_CLIENT_IDS.split(",")
            if item.strip()
        ]

    @property
    def cors_origins(self) -> list[str]:
        return [
            item.strip()
            for item in self.CORS_ORIGINS.split(",")
            if item.strip()
        ]

    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        extra="ignore",
    )


settings = Settings()
