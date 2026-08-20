from fastapi import APIRouter

from effects import get_public_catalog


router = APIRouter(
    tags=["Effects"],
)


@router.get("/effects")
async def get_effects():
    return {
        "categories": get_public_catalog(),
    }