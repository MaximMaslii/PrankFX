import logging

from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from pymongo.errors import DuplicateKeyError

from app.config import settings
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


logger = logging.getLogger("prankfx.auth")


# Google always issues its ID tokens from one of these two issuers.
_GOOGLE_ISSUERS = (
    "accounts.google.com",
    "https://accounts.google.com",
)


class AuthService:

    def __init__(self):
        self.users = UserRepository()

    # =====================================================
    # HELPERS
    # =====================================================

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

    @staticmethod
    def _new_user_document(
        email: str,
        provider: str,
        password_hash: str | None = None,
        name: str | None = None,
        picture: str | None = None,
    ) -> dict:
        return {
            "user_id": generate_user_id(),
            "email": email,
            "password_hash": password_hash,
            "provider": provider,
            "name": name,
            "picture": picture,
            "is_premium": False,
            "premium_tier": None,
            # Legacy free-credit fields, kept for backward compatibility.
            "free_credits_used": 0,
            "free_credits_total": 1,
            # Current PrankFX FX balance: every new user gets 1 free FX.
            "fx_credits": settings.SIGNUP_FX_CREDITS,
            "created_at": utc_now(),
        }

    # =====================================================
    # GOOGLE LOGIN
    # =====================================================

    def _verify_google_token(self, token: str) -> dict:
        """
        Validate a Google ID token and return its claims.

        Every failure mode is turned into a ValueError with a message that says
        what actually went wrong, so the app can show it instead of a bare 401.
        """
        if not token or not isinstance(token, str):
            raise ValueError("Google token is missing")

        audience = settings.google_client_ids

        if not audience:
            raise ValueError(
                "No Google client IDs are configured on the server "
                "(GOOGLE_CLIENT_IDS)."
            )

        try:
            claims = google_id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                audience=audience,
                # Phones drift by a few seconds; without this an otherwise valid
                # token is rejected with "Token used too early".
                clock_skew_in_seconds=60,
            )

        except ValueError as e:
            # Raised for malformed tokens, wrong audience, expiry, etc.
            message = str(e)

            if "Token used too early" in message or "Token expired" in message:
                raise ValueError(
                    "The Google token is outside its validity window. "
                    "Check that the device clock is set automatically."
                ) from e

            if "audience" in message.lower():
                raise ValueError(
                    "This Google token was issued for a different OAuth client. "
                    "Make sure the app's Android/iOS/Web client IDs are all listed "
                    "in GOOGLE_CLIENT_IDS on the server."
                ) from e

            raise ValueError(f"Invalid Google token: {message}") from e

        except GoogleAuthError as e:
            # Transport problems reaching Google's certificate endpoint.
            logger.exception("Google token verification transport error")
            raise ValueError(
                "Could not reach Google to verify the token. Try again."
            ) from e

        except Exception as e:
            logger.exception("Unexpected Google token verification failure")
            raise ValueError("Google token verification failed") from e

        if claims.get("iss") not in _GOOGLE_ISSUERS:
            raise ValueError("Google token has an unexpected issuer")

        return claims

    async def google_login(self, token: str) -> AuthResponse:
        claims = self._verify_google_token(token)

        email = claims.get("email")

        if not email:
            raise ValueError(
                "This Google account did not share an email address. "
                "Grant the email permission and try again."
            )

        email = email.strip().lower()

        # Google sends this as a real bool, but some clients stringify it.
        email_verified = claims.get("email_verified", False)

        if isinstance(email_verified, str):
            email_verified = email_verified.lower() == "true"

        if not email_verified:
            raise ValueError("This Google email address is not verified.")

        name = claims.get("name") or claims.get("given_name")
        picture = claims.get("picture")

        user = await self.users.get_by_email(email)

        if user is None:
            # ---------------------------------------------------------
            # First time we see this Google account -> create it.
            #
            # Two rapid taps could previously create two accounts for the
            # same email. The unique index on `email` now makes that
            # impossible, and the duplicate is resolved by re-reading.
            # ---------------------------------------------------------
            document = self._new_user_document(
                email=email,
                provider="google",
                name=name,
                picture=picture,
            )

            try:
                await self.users.create(document)
                user = document

            except DuplicateKeyError:
                user = await self.users.get_by_email(email)

                if user is None:
                    raise ValueError("Could not create the account. Try again.")

        else:
            # ---------------------------------------------------------
            # Existing account (possibly created with email + password).
            # Link it to Google and backfill the profile.
            # ---------------------------------------------------------
            updates: dict = {}

            if not user.get("name") and name:
                updates["name"] = name

            if not user.get("picture") and picture:
                updates["picture"] = picture

            if not user.get("password_hash") and user.get("provider") != "google":
                updates["provider"] = "google"

            if "fx_credits" not in user:
                updates["fx_credits"] = settings.SIGNUP_FX_CREDITS

            if updates:
                await self.users.update(user["user_id"], updates)
                user = {**user, **updates}

        access_token = create_access_token({"user_id": user["user_id"]})

        return AuthResponse(
            token=access_token,
            user=self._to_user_out(user),
        )

    # =====================================================
    # EMAIL REGISTER / LOGIN
    # =====================================================

    async def register(self, data: RegisterIn) -> AuthResponse:
        email = data.email.strip().lower()

        existing = await self.users.get_by_email(email)

        if existing:
            raise ValueError("User already exists")

        user = self._new_user_document(
            email=email,
            provider="email",
            password_hash=hash_password(data.password),
            name=(data.name or None),
        )

        try:
            await self.users.create(user)
        except DuplicateKeyError:
            raise ValueError("User already exists")

        token = create_access_token({"user_id": user["user_id"]})

        return AuthResponse(
            token=token,
            user=self._to_user_out(user),
        )

    async def login(self, data: LoginIn) -> AuthResponse:
        email = data.email.strip().lower()

        user = await self.users.get_by_email(email)

        if not user:
            raise ValueError("Invalid email or password")

        password_hash = user.get("password_hash")

        if not password_hash:
            # The account exists but was created through Google.
            raise ValueError(
                "This account was created with Google. Use 'Continue with Google'."
            )

        if not verify_password(data.password, password_hash):
            raise ValueError("Invalid email or password")

        token = create_access_token({"user_id": user["user_id"]})

        return AuthResponse(
            token=token,
            user=self._to_user_out(user),
        )

    # =====================================================
    # MISC
    # =====================================================

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
