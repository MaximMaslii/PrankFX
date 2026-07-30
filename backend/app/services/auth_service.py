from app.repositories.user_repository import UserRepository
from app.security.jwt import (
    create_access_token,
    create_refresh_token,
)
from app.security.password import (
    hash_password,
)
from app.utils.ids import generate_user_id
from app.utils.datetime import utc_now

from app.schemas.auth import (
    RegisterIn,
    AuthResponse,
    UserOut,
)


class AuthService:

    def __init__(self):
        self.users = UserRepository()

    async def register(self, data: RegisterIn) -> AuthResponse:

        existing = await self.users.get_by_email(data.email)

        if existing:
            raise ValueError("User already exists")

        user = {
            "user_id": generate_user_id(),
            "email": data.email.lower(),
            "password_hash": hash_password(data.password),
            "provider": "email",
            "name": "",
            "picture": None,
            "is_premium": False,
            "premium_tier": None,
            "free_credits_used": 0,
            "free_credits_total": 5,
            "created_at": utc_now(),
        }

        await self.users.create(user)

        access_token = create_access_token(
            {"user_id": user["user_id"]}
        )

        refresh_token = create_refresh_token(
            {"user_id": user["user_id"]}
        )

        return AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserOut(
                user_id=user["user_id"],
                email=user["email"],
                is_premium=False,
            ),
        )
