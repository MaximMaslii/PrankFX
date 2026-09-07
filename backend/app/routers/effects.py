from fastapi import APIRouter

from effects import get_public_catalog


router = APIRouter(
    prefix="/api/effects",
    tags=["Effects"],
)


@router.get("")
async def get_effects():
    return {
        "categories": get_public_catalog(),
    }