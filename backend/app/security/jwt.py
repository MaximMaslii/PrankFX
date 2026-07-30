from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from app.config import settings


ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 30


def _create_token(data: dict[str, Any], expires_delta: timedelta, token_type: str) -> str:
    payload = data.copy()
    now = datetime.now(timezone.utc)

    payload.update(
        {
            "type": token_type,
            "iat": now,
            "exp": now + expires_delta,
        }
    )

    return jwt.encode(
        payload,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


def create_access_token(data: dict[str, Any]) -> str:
    return _create_token(
        data,
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "access",
    )


def create_refresh_token(data: dict[str, Any]) -> str:
    return _create_token(
        data,
        timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "refresh",
    )


def decode_token(token: str) -> dict:
    return jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
    )
