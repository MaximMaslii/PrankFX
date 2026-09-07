from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.generate import GenerateIn
from app.schemas.project import ProjectFull
from app.security.dependencies import get_current_user
from app.services.generate_service import GenerateService


router = APIRouter(
    prefix="/api/generate",
    tags=["Generate"],
)

generate_service = GenerateService()


@router.post(
    "",
    response_model=ProjectFull,
)
async def generate(
    body: GenerateIn,
    current_user: dict = Depends(get_current_user),
):
    try:
        return await generate_service.generate(
            user_id=current_user["user_id"],
            data=body,
        )

    except ValueError as e:
        if str(e) == "Effect not found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e),
            )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=str(e),
        )