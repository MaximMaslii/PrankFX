"""Verification of Sign in with Apple identity tokens.

App Store Review guideline 4.8 requires Sign in with Apple wherever a
third-party sign-in is offered, so this sits next to the Google verifier and
works the same way: the client performs the native flow, hands us the identity
token, and the server decides whether to believe it.

What Apple gives and what it withholds:
  • `sub` — a stable id for this user *in this app*. It is the only field
    guaranteed to come back on every sign-in, which is why the account is
    keyed on it rather than on the email.
  • `email` — present on the FIRST sign-in only, and it may be a private
    relay address (…@privaterelay.appleid.com). A returning user often
    arrives with no email at all.
  • the display name — never in the token. The client sends it separately,
    also only the first time.
"""
import asyncio
import logging

import jwt
from jwt import PyJWKClient

from app.config import settings


logger = logging.getLogger("prankfx.auth.apple")


# PyJWKClient caches the fetched keys, so this is created once rather than
# per request — otherwise every sign-in would hit Apple for the key set.
_jwk_client: PyJWKClient | None = None


def _client() -> PyJWKClient:
    global _jwk_client

    if _jwk_client is None:
        _jwk_client = PyJWKClient(settings.APPLE_KEYS_URL, cache_keys=True)

    return _jwk_client


def _verify_sync(token: str) -> dict:
    """Blocking verification — Apple's key fetch uses urllib under the hood."""

    audience = settings.apple_client_ids

    if not audience:
        raise ValueError(
            "No Apple client IDs are configured on the server "
            "(APPLE_CLIENT_IDS)."
        )

    signing_key = _client().get_signing_key_from_jwt(token)

    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=audience,
        issuer=settings.APPLE_ISSUER,
        # Phones drift by a few seconds; without this an otherwise valid
        # token is rejected as "not yet valid".
        leeway=60,
        options={"require": ["exp", "iat", "sub"]},
    )


async def verify_apple_token(token: str) -> dict:
    """Return the token's claims, or raise ValueError with a readable reason."""

    if not token or not isinstance(token, str):
        raise ValueError("Apple token is missing")

    try:
        claims = await asyncio.to_thread(_verify_sync, token)

    except jwt.ExpiredSignatureError as e:
        raise ValueError(
            "The Apple token has expired. Try signing in again."
        ) from e

    except jwt.InvalidAudienceError as e:
        raise ValueError(
            "This Apple token was issued for a different app. Check that "
            "APPLE_CLIENT_IDS on the server matches the app's bundle id."
        ) from e

    except jwt.InvalidIssuerError as e:
        raise ValueError("The Apple token has an unexpected issuer.") from e

    except jwt.PyJWTError as e:
        raise ValueError(f"Invalid Apple token: {e}") from e

    except Exception as e:
        # Network trouble reaching Apple's key endpoint lands here.
        logger.exception("Unexpected Apple token verification failure")
        raise ValueError(
            "Could not verify the Apple token. Try again."
        ) from e

    if not claims.get("sub"):
        raise ValueError("The Apple token carries no user identifier.")

    return claims
