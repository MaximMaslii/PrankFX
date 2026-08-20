from app.repositories.user_repository import UserRepository

from app.security.jwt import create_access_token
from app.security.password import hash_password, verify_password

from app.utils.ids import generate_user_id
from app.utils.datetime import utc_now

from app.schemas.auth import (
    RegisterIn,
    LoginIn,
    ForgotIn,
    AuthResponse,
    UserOut,
)


class AuthService:

    def __init__(self):
        self.users = UserRepository()

    @staticmethod
    def _to_user_out(user: dict) -> UserOut:
        return UserOut(
            user_id=user["user_id"],
            email=user["email"],
            name=user.get("name"),
            picture=user.get("picture"),
            provider=user.get("provider", "email"),
            is_premium=user.get("is_premium", False),
            premium_tier=user.get("premium_tier"),
            free_credits_used=user.get("free_credits_used", 0),
            free_credits_total=user.get("free_credits_total", 1),
            created_at=user["created_at"],
        )

    async def register(self, data: RegisterIn) -> AuthResponse:
        email = data.email.lower()

        existing = await self.users.get_by_email(email)

        if existing:
            raise ValueError("User already exists")

        user = {
            "user_id": generate_user_id(),
            "email": email,
            "password_hash": hash_password(data.password),
            "provider": "email",
            "name": data.name,
            "picture": None,
            "is_premium": False,
            "premium_tier": None,
            "free_credits_used": 0,
            "free_credits_total": 1,
            "created_at": utc_now(),
        }

        await self.users.create(user)

        token = create_access_token(
            {"user_id": user["user_id"]}
        )

        return AuthResponse(
            token=token,
            user=self._to_user_out(user),
        )

    async def login(self, data: LoginIn) -> AuthResponse:
        email = data.email.lower()

        user = await self.users.get_by_email(email)

        if not user:
            raise ValueError("Invalid email or password")

        password_hash = user.get("password_hash")

        if not password_hash or not verify_password(
            data.password,
            password_hash,
        ):
            raise ValueError("Invalid email or password")

        token = create_access_token(
            {"user_id": user["user_id"]}
        )

        return AuthResponse(
            token=token,
            user=self._to_user_out(user),
        )

    async def get_current_user(self, user: dict) -> UserOut:
        return self._to_user_out(user)

    async def forgot(self, data: ForgotIn) -> dict:
        # Password-reset email delivery is not implemented yet.
        # Always return success without revealing whether the email exists.
        return {
            "ok": True,
            "message": "If the account exists, reset instructions will be sent.",
        }

    async def delete_account(self, user_id: str) -> dict:
        result = await self.users.delete(user_id)

        if result.deleted_count == 0:
            raise ValueError("User not found")

        return {"ok": True}