from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.repositories.user_repository import UserRepository
from app.security.jwt import decode_token


bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = credentials.credentials

    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    user_id = payload.get("user_id")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    user = await UserRepository.get_by_user_id(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    """The caller, if they happen to be signed in — otherwise None.

    Used by the sign-up endpoints. Someone registering is by definition not
    required to be authenticated, but they very often ARE: they have been
    using the app as a guest, and that session is the thing being upgraded.
    A stale or malformed token here means "not signed in", never an error —
    failing a registration because an old token no longer parses would strand
    the user with no way forward.
    """
    if credentials is None:
        return None

    try:
        payload = decode_token(credentials.credentials)
    except Exception:
        return None

    user_id = payload.get("user_id")

    if not user_id:
        return None

    return await UserRepository.get_by_user_id(user_id)