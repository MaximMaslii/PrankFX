from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.auth import (
    RegisterIn,
    LoginIn,
    ForgotIn,
    AuthResponse,
    UserOut,
)
from app.services.auth_service import AuthService
from app.security.dependencies import get_current_user


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)

auth_service = AuthService()


@router.post(
    "/register",
    response_model=AuthResponse,
)
async def register(body: RegisterIn):
    try:
        return await auth_service.register(body)

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
)
async def login(body: LoginIn):
    try:
        return await auth_service.login(body)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )


@router.post(
    "/forgot",
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