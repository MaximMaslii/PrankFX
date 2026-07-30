from fastapi import APIRouter, HTTPException

from app.schemas.auth import RegisterIn, AuthResponse
from app.services.auth_service import AuthService

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
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )
