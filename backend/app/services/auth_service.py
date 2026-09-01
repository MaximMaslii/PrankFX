from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
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
    async def google_login(self, token: str) -> AuthResponse:
        try:
            google_user = google_id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                audience=[
                    "917307607930-5mulp0qe4b55gvhrno6qbnvmh2a2e1sc.apps.googleusercontent.com",
                    "917307607930-u5kaei1ktf64c8f7h5r6rq7io6hv5gbr.apps.googleusercontent.com",
                    "917307607930-q5916sbm39ga8bctlvumir4h3jmp4c34.apps.googleusercontent.com",
                ],
            )

        except ValueError:
            raise ValueError("Invalid Google token")

        email = google_user.get("email")

        if not email:
            raise ValueError("Google account email is unavailable")

        if not google_user.get("email_verified", False):
            raise ValueError("Google email is not verified")

        email = email.lower()

        existing = await self.users.get_by_email(email)

        if existing:
            user = existing

        else:
            user = {
                "user_id": generate_user_id(),
                "email": email,
                "password_hash": None,
                "provider": "google",
                "name": google_user.get("name"),
                "picture": google_user.get("picture"),
                "is_premium": False,
                "premium_tier": None,
                "free_credits_used": 0,
                "free_credits_total": 1,
                "fx_credits": 1,
                "created_at": utc_now(),
            }

            await self.users.create(user)

        access_token = create_access_token({"user_id": user["user_id"]})

        return AuthResponse(
            token=access_token,
            user=self._to_user_out(user),
        )

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
            fx_credits=user.get("fx_credits", 0),
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
            # Legacy free-credit fields.
            # Kept for backward compatibility.
            "free_credits_used": 0,
            "free_credits_total": 1,
            # New PrankFX FX balance.
            # Every new user gets 1 free FX.
            "fx_credits": 1,
            "created_at": utc_now(),
        }

        await self.users.create(user)

        token = create_access_token({"user_id": user["user_id"]})

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

        token = create_access_token({"user_id": user["user_id"]})

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
