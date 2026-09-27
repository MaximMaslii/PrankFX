from fastapi import APIRouter, Depends, HTTPException, status

from app.middleware.rate_limit import (
    auth_rate_limit,
    forgot_rate_limit,
    guest_rate_limit,
)
from app.schemas.auth import (
    RegisterIn,
    LoginIn,
    ForgotIn,
    GoogleLoginIn,
    AppleLoginIn,
    GuestIn,
    AuthResponse,
    UserOut,
)
from app.services.auth_service import AuthService
from app.security.dependencies import get_current_user, get_optional_user


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)

auth_service = AuthService()


@router.post(
    "/guest",
    response_model=AuthResponse,
    dependencies=[Depends(guest_rate_limit)],
)
async def guest(body: GuestIn):
    """Start using the app without an account.

    Called once on first launch and on any later launch where the stored
    session is gone. The same device_id always returns the same account, so
    this is safe to call whenever the app finds itself with no session.
    """
    try:
        return await auth_service.guest_login(body.device_id)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post(
    "/register",
    response_model=AuthResponse,
    dependencies=[Depends(auth_rate_limit)],
)
async def register(
    body: RegisterIn,
    # Present when a guest is turning into a real account — their FX, their
    # history and their user_id are then kept instead of being abandoned.
    caller: dict | None = Depends(get_optional_user),
):
    try:
        return await auth_service.register(body, guest=caller)

    except ValueError as e:
        if str(e) == "User already exists":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(e),
            )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post(
    "/login",
    response_model=AuthResponse,
    dependencies=[Depends(auth_rate_limit)],
)
async def login(
    body: LoginIn,
    caller: dict | None = Depends(get_optional_user),
):
    try:
        return await auth_service.login(body, guest=caller)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )

@router.post(
    "/google",
    response_model=AuthResponse,
    dependencies=[Depends(auth_rate_limit)],
)
async def google_login(
    body: GoogleLoginIn,
    caller: dict | None = Depends(get_optional_user),
):
    """
    Sign in (or transparently sign up) with a Google ID token.

    A brand-new Google account and an existing one both come through here; the
    service creates the user on first sight, so "Use another account" works the
    same as picking an account that has signed in before.

    A guest arriving here keeps their account: it gains the Google identity
    rather than being replaced by a second one.
    """
    try:
        return await auth_service.google_login(body.token, guest=caller)

    except ValueError as e:
        # Token problems are 401; everything else is logged and re-raised by
        # the global handler so the client never sees an empty error body.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )

@router.post(
    "/apple",
    response_model=AuthResponse,
    dependencies=[Depends(auth_rate_limit)],
)
async def apple_login(
    body: AppleLoginIn,
    caller: dict | None = Depends(get_optional_user),
):
    """
    Sign in (or transparently sign up) with a Sign in with Apple token.

    App Store review requires this endpoint to exist as long as the app also
    offers Google sign-in (guideline 4.8).
    """
    try:
        return await auth_service.apple_login(
            body.token,
            body.full_name,
            guest=caller,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )


@router.post(
    "/forgot",
    dependencies=[Depends(forgot_rate_limit)],
)
async def forgot(body: ForgotIn):
    return await auth_service.forgot(body)


@router.get(
    "/me",
    response_model=UserOut,
)
async def me(
    current_user: dict = Depends(get_current_user),
):
    return await auth_service.get_current_user(current_user)


@router.post(
    "/logout",
)
async def logout(
    current_user: dict = Depends(get_current_user),
):
    # JWT is stateless. There is currently no server-side
    # session to revoke for email/password authentication.
    return {"ok": True}


@router.delete(
    "/account",
)
async def delete_account(
    current_user: dict = Depends(get_current_user),
):
    try:
        return await auth_service.delete_account(
            current_user["user_id"]
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )