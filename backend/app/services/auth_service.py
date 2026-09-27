import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path

from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from pymongo.errors import DuplicateKeyError

from app.config import settings
from app.repositories.project_repository import ProjectRepository
from app.repositories.snap_repository import SnapRepository
from app.repositories.user_repository import UserRepository
from app.services.apple_auth import verify_apple_token

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


# A guest still needs a value in the unique `email` index. `.invalid` is the
# TLD reserved by RFC 2606 for exactly this: it can never be registered, so
# nothing here can ever collide with, or be mistaken for, a real address.
GUEST_EMAIL_DOMAIN = "guest.invalid"


logger = logging.getLogger("prankfx.auth")


# Google always issues its ID tokens from one of these two issuers.
_GOOGLE_ISSUERS = (
    "accounts.google.com",
    "https://accounts.google.com",
)


class AuthService:

    def __init__(self):
        self.users = UserRepository()
        self.projects = ProjectRepository()
        self.snaps = SnapRepository()

    # =====================================================
    # HELPERS
    # =====================================================

    @staticmethod
    def _to_user_out(user: dict) -> UserOut:
        is_guest = bool(user.get("is_guest"))

        return UserOut(
            user_id=user["user_id"],
            # A guest's stored address is a placeholder for the unique index,
            # not something a person ever typed. Sending it would put
            # "guest.7f3c…@guest.invalid" in the Settings screen.
            email="" if is_guest else user["email"],
            name=user.get("name"),
            picture=user.get("picture"),
            provider=user.get("provider", "email"),
            is_guest=is_guest,
            is_premium=user.get("is_premium", False),
            premium_tier=user.get("premium_tier"),
            premium_expires_at=user.get("premium_expires_at"),
            premium_auto_renew=bool(user.get("premium_auto_renew")),
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
            "is_guest": False,
            "is_premium": False,
            "premium_tier": None,
            "premium_expires_at": None,
            # Legacy free-credit fields, kept for backward compatibility.
            "free_credits_used": 0,
            "free_credits_total": 1,
            # Current PrankFX FX balance: every new user gets 1 free FX.
            "fx_credits": settings.SIGNUP_FX_CREDITS,
            "fx_purchased_total": 0,
            "created_at": utc_now(),
        }

    # =====================================================
    # GUESTS
    #
    # The app used to put a registration form between a person and the thing
    # they downloaded it for. Most of them left there — it is the single most
    # expensive screen in an app like this, because it asks for commitment
    # before it has shown anything worth committing to.
    #
    # A guest is a real account with a real user_id from the first launch. It
    # simply has no way to sign in from a second device until the person
    # attaches an identity to it, which they are asked to do at the two
    # moments where it actually matters: buying something, and keeping their
    # work.
    # =====================================================

    @staticmethod
    def _is_guest(user: dict | None) -> bool:
        return bool(user and user.get("is_guest"))

    def _new_guest_document(self, device_id: str) -> dict:
        user_id = generate_user_id()

        document = self._new_user_document(
            email=f"guest.{user_id}@{GUEST_EMAIL_DOMAIN}",
            provider="guest",
        )

        document["user_id"] = user_id
        document["is_guest"] = True
        document["device_id"] = device_id

        return document

    async def guest_login(self, device_id: str) -> AuthResponse:
        """Sign in as the guest belonging to this installation, creating it
        on first launch.

        Deliberately idempotent: the same device_id always resolves to the
        same account. If it minted a new guest per call, every restart would
        hand out another free FX and the free tier would cost real money at
        the Gemini end, on repeat, forever.
        """
        device_id = (device_id or "").strip()

        if not device_id:
            raise ValueError("Missing device id")

        user = await self.users.get_by_device_id(device_id)

        if user is None:
            document = self._new_guest_document(device_id)

            try:
                await self.users.create(document)
                user = document

            except DuplicateKeyError:
                # Two launches racing each other on the same device.
                user = await self.users.get_by_device_id(device_id)

                if user is None:
                    raise ValueError("Could not start a guest session. Try again.")

            else:
                logger.info("Created guest account %s", user["user_id"])

        token = create_access_token({"user_id": user["user_id"]})

        return AuthResponse(
            token=token,
            user=self._to_user_out(user),
        )

    async def _claim(self, guest: dict, values: dict) -> dict | None:
        """Promote the guest in place. Returns None if it could not be done.

        In place, keeping the same user_id, because that id is what the photo
        history, the Snap clips and RevenueCat's `app_user_id` all point at.
        """
        try:
            promoted = await self.users.claim_guest(guest["user_id"], values)

        except DuplicateKeyError:
            # Someone registered that address in the gap between the lookup
            # and this update.
            return None

        if promoted:
            logger.info(
                "Guest %s became a %s account",
                guest["user_id"],
                values.get("provider"),
            )

        return promoted

    async def _absorb_guest(self, guest: dict, target_user_id: str) -> None:
        """The person signed into an account that already existed.

        Their guest session cannot be promoted — the destination is already
        there — so its CONTENT moves across and the empty guest document is
        deleted. FX does not move: a free grant that could be harvested by
        making a guest, signing in, and clearing the app would stop being a
        free tier and start being an exploit.
        """
        guest_id = guest["user_id"]

        if guest_id == target_user_id:
            return

        try:
            await self.projects.reassign_user(guest_id, target_user_id)
            await self.snaps.reassign_user(guest_id, target_user_id)
        except Exception:
            logger.exception("Could not move guest content from %s", guest_id)

        try:
            await self.users.delete(guest_id)
        except Exception:
            logger.exception("Could not remove guest document %s", guest_id)

        logger.info("Merged guest %s into existing account %s", guest_id, target_user_id)

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

    async def google_login(
        self,
        token: str,
        guest: dict | None = None,
    ) -> AuthResponse:
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

        # ---------------------------------------------------------
        # Guest signing up: keep the account they already have.
        #
        # Their free FX, the picture they made two minutes ago and any
        # purchase they made all hang off the guest's user_id, so the
        # document is promoted rather than replaced.
        # ---------------------------------------------------------
        promoted = None

        if user is None and self._is_guest(guest):
            promoted = await self._claim(
                guest,
                {
                    "email": email,
                    "provider": "google",
                    "name": name or guest.get("name"),
                    "picture": picture,
                },
            )

            if promoted:
                user = promoted

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

        elif promoted is None:
            if self._is_guest(guest):
                await self._absorb_guest(guest, user["user_id"])

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
    # APPLE LOGIN
    # =====================================================

    async def apple_login(
        self,
        token: str,
        full_name: str | None = None,
        guest: dict | None = None,
    ) -> AuthResponse:
        """Sign in (or sign up) with an Apple identity token.

        Keyed on Apple's `sub`, not on the email: the email arrives only on
        the first sign-in and may be a private relay address. Looking users up
        by email alone would create a second account for every returning user.
        """
        claims = await verify_apple_token(token)

        apple_sub = claims["sub"]

        email = (claims.get("email") or "").strip().lower() or None

        user = await self.users.get_by_apple_sub(apple_sub)

        # First sign-in, or an account that was created with the same address
        # through email or Google — link it rather than duplicating it.
        if user is None and email:
            user = await self.users.get_by_email(email)

        # Guest attaching an Apple identity: promote the document they are
        # already using, so their FX and their history survive the sign-up.
        promoted = None

        if user is None and email and self._is_guest(guest):
            promoted = await self._claim(
                guest,
                {
                    "email": email,
                    "provider": "apple",
                    "apple_sub": apple_sub,
                    "name": full_name or guest.get("name"),
                },
            )

            if promoted:
                user = promoted

        if user is None:
            if not email:
                raise ValueError(
                    "Apple did not share an email address for this account. "
                    "Sign out of PrankFX in Settings → Apple ID → Sign in "
                    "with Apple, then try again."
                )

            document = self._new_user_document(
                email=email,
                provider="apple",
                name=(full_name or None),
            )

            document["apple_sub"] = apple_sub

            try:
                await self.users.create(document)
                user = document

            except DuplicateKeyError:
                user = await self.users.get_by_email(email)

                if user is None:
                    raise ValueError("Could not create the account. Try again.")

        elif promoted is None:
            if self._is_guest(guest):
                await self._absorb_guest(guest, user["user_id"])

            updates: dict = {}

            if not user.get("apple_sub"):
                updates["apple_sub"] = apple_sub

            if not user.get("name") and full_name:
                updates["name"] = full_name

            # An account with no password that has only ever signed in with
            # Apple is an Apple account; one with a password keeps its own
            # provider so the password still works.
            if not user.get("password_hash") and user.get("provider") == "email":
                updates["provider"] = "apple"

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

    async def register(
        self,
        data: RegisterIn,
        guest: dict | None = None,
    ) -> AuthResponse:
        email = data.email.strip().lower()

        existing = await self.users.get_by_email(email)

        if existing:
            raise ValueError("User already exists")

        # A guest filling in the sign-up form keeps their account and their
        # balance; they are only adding a way to sign back in.
        if self._is_guest(guest):
            promoted = await self._claim(
                guest,
                {
                    "email": email,
                    "provider": "email",
                    "password_hash": hash_password(data.password),
                    "name": (data.name or guest.get("name")),
                },
            )

            if promoted:
                return AuthResponse(
                    token=create_access_token({"user_id": promoted["user_id"]}),
                    user=self._to_user_out(promoted),
                )

            # The claim lost a race — either the address was taken in the
            # meantime or this guest was promoted from another device.
            if await self.users.get_by_email(email):
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

    async def login(
        self,
        data: LoginIn,
        guest: dict | None = None,
    ) -> AuthResponse:
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

        # Signing into an account that already exists, from a guest session:
        # the guest cannot be promoted, but whatever they made in it comes
        # with them rather than being orphaned.
        if self._is_guest(guest):
            await self._absorb_guest(guest, user["user_id"])

        token = create_access_token({"user_id": user["user_id"]})

        return AuthResponse(
            token=token,
            user=self._to_user_out(user),
        )

    # =====================================================
    # MISC
    # =====================================================

    async def get_current_user(self, user: dict) -> UserOut:
        return self._to_user_out(await self.expire_premium_if_due(user))

    async def expire_premium_if_due(self, user: dict) -> dict:
        """Drop premium once the paid period has run out.

        The RevenueCat EXPIRATION webhook is the normal way this happens. This
        is the backstop for the day it does not arrive — a webhook lost to a
        deploy, a DNS blip, a 500 from us. Without it a cancelled subscriber
        would keep an unwatermarked export forever, and the only person who
        could notice is the one who benefits.
        """
        if not user.get("is_premium"):
            return user

        expires = user.get("premium_expires_at")

        if not expires:
            # No end date: a lifetime entitlement, or a grant made by hand
            # from the admin console. Neither expires on a clock.
            return user

        if isinstance(expires, str):
            try:
                expires = datetime.fromisoformat(expires.replace("Z", "+00:00"))
            except ValueError:
                return user

        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)

        if expires > datetime.now(timezone.utc):
            return user

        await self.users.update(
            user["user_id"],
            {"is_premium": False, "premium_tier": None},
        )

        logger.info(
            "Premium expired for %s at %s",
            user["user_id"],
            expires.isoformat(),
        )

        return {**user, "is_premium": False, "premium_tier": None}

    async def forgot(self, data: ForgotIn) -> dict:
        # Password-reset email delivery is not implemented yet.
        # Always return success without revealing whether the email exists.
        return {
            "ok": True,
            "message": "If the account exists, reset instructions will be sent.",
        }

    async def delete_account(self, user_id: str) -> dict:
        """Delete the account AND everything that belonged to it.

        Deleting only the user document left the photo history and the Snap
        clips — the actual personal content — sitting in the database and on
        disk under a user id that no longer existed. Nobody could reach them
        afterwards, including the person entitled to have them erased, so the
        data simply became undeletable. Everything now goes at once.
        """

        # Read the job list BEFORE the records are gone: it is the only way to
        # find the directories that hold the finished clips.
        try:
            jobs = await self.snaps.list_for_user(user_id, limit=1000)
        except Exception:
            logger.exception("Could not list snap jobs for user %s", user_id)
            jobs = []

        result = await self.users.delete(user_id)

        if result.deleted_count == 0:
            raise ValueError("User not found")

        # A failure below must not leave the caller thinking the account
        # survived — the account is already gone. Log and keep going.
        try:
            await self.projects.delete_for_user(user_id)
        except Exception:
            logger.exception("Could not delete projects of user %s", user_id)

        try:
            await self.snaps.delete_for_user(user_id)
        except Exception:
            logger.exception("Could not delete snap jobs of user %s", user_id)

        media_root = Path(settings.snap_media_dir)

        for job in jobs:
            job_id = job.get("job_id")

            if not job_id:
                continue

            shutil.rmtree(media_root / job_id, ignore_errors=True)

        logger.info(
            "Deleted account %s along with its history and %d snap clips",
            user_id,
            len(jobs),
        )

        return {"ok": True}
