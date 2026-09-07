"""
Regression tests for the reported bug:

    "Signing in with a Google account from the list works, but 'Use another
     account' with a brand-new email does not open the app."

The decisive case is `test_brand_new_google_account_is_created`: an email the
database has never seen must produce a user and a token, exactly like an
existing one does.
"""

import pytest

from helpers import google_claims

from app.schemas.auth import LoginIn, RegisterIn
from app.security.jwt import decode_token


pytestmark = pytest.mark.asyncio


async def test_brand_new_google_account_is_created(auth_service):
    """'Use another account' with an unknown email must sign in, not fail."""
    auth_service._test_tokens["tok"] = google_claims("Brand.New@Gmail.com")

    result = await auth_service.google_login("tok")

    assert result.user.email == "brand.new@gmail.com"  # normalised
    assert result.user.provider == "google"
    assert result.user.fx_credits == 1
    assert decode_token(result.token)["user_id"] == result.user.user_id


async def test_existing_google_account_signs_in_again(auth_service):
    """An account from the chooser list keeps working (no regression)."""
    auth_service._test_tokens["tok"] = google_claims("repeat@gmail.com")

    first = await auth_service.google_login("tok")
    second = await auth_service.google_login("tok")

    assert first.user.user_id == second.user.user_id


async def test_repeat_sign_in_does_not_duplicate_the_user(auth_service):
    import app.repositories.user_repository as user_repository

    auth_service._test_tokens["tok"] = google_claims("once@gmail.com")

    await auth_service.google_login("tok")
    await auth_service.google_login("tok")

    count = await user_repository.db.users.count_documents(
        {"email": "once@gmail.com"}
    )
    assert count == 1


async def test_email_account_is_linked_to_google(auth_service):
    """Registering by email then signing in with Google keeps ONE account."""
    registered = await auth_service.register(
        RegisterIn(email="both@example.com", password="secret123", name=None)
    )

    auth_service._test_tokens["tok"] = google_claims(
        "both@example.com", name="Real Name"
    )
    linked = await auth_service.google_login("tok")

    assert linked.user.user_id == registered.user.user_id
    assert linked.user.name == "Real Name"      # profile backfilled
    assert linked.user.picture is not None


async def test_unverified_google_email_is_rejected(auth_service):
    auth_service._test_tokens["tok"] = google_claims(
        "shady@example.com", email_verified=False
    )

    with pytest.raises(ValueError, match="not verified"):
        await auth_service.google_login("tok")


async def test_email_verified_as_string_is_accepted(auth_service):
    """Some clients stringify the claim; a bool-only check would reject it."""
    auth_service._test_tokens["tok"] = google_claims(
        "stringy@example.com", email_verified="true"
    )

    result = await auth_service.google_login("tok")
    assert result.user.email == "stringy@example.com"


async def test_google_token_without_email_gives_a_readable_error(auth_service):
    claims = google_claims("x@example.com")
    claims.pop("email")
    auth_service._test_tokens["tok"] = claims

    with pytest.raises(ValueError, match="email"):
        await auth_service.google_login("tok")


async def test_wrong_issuer_is_rejected(auth_service):
    auth_service._test_tokens["tok"] = google_claims(
        "spoof@example.com", iss="https://evil.example.com"
    )

    with pytest.raises(ValueError, match="issuer"):
        await auth_service.google_login("tok")


async def test_invalid_token_is_rejected(auth_service):
    with pytest.raises(ValueError, match="Invalid Google token"):
        await auth_service.google_login("never-registered-token")


async def test_password_login_on_google_account_explains_itself(auth_service):
    auth_service._test_tokens["tok"] = google_claims("gonly@example.com")
    await auth_service.google_login("tok")

    with pytest.raises(ValueError, match="Google"):
        await auth_service.login(
            LoginIn(email="gonly@example.com", password="anything")
        )


async def test_email_password_flow_still_works(auth_service):
    await auth_service.register(
        RegisterIn(email="classic@example.com", password="secret123", name="Classic")
    )

    result = await auth_service.login(
        LoginIn(email="classic@example.com", password="secret123")
    )

    assert result.user.email == "classic@example.com"
    assert result.user.provider == "email"


async def test_wrong_password_is_rejected(auth_service):
    await auth_service.register(
        RegisterIn(email="pw@example.com", password="secret123", name=None)
    )

    with pytest.raises(ValueError, match="Invalid email or password"):
        await auth_service.login(
            LoginIn(email="pw@example.com", password="wrong-password")
        )


async def test_duplicate_registration_is_rejected(auth_service):
    await auth_service.register(
        RegisterIn(email="dupe@example.com", password="secret123", name=None)
    )

    with pytest.raises(ValueError, match="already exists"):
        await auth_service.register(
            RegisterIn(email="DUPE@example.com", password="secret123", name=None)
        )
