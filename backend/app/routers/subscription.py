from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.subscription import (
    CreditsResponse,
    MockActivateIn,
    SubscriptionResponse,
)
from app.security.dependencies import get_current_user
from app.services.fx_service import FXService
from app.services.subscription_service import SubscriptionService


router = APIRouter(
    prefix="/api/subscription",
    tags=["Subscription"],
)

subscription_service = SubscriptionService()
fx_service = FXService()


# =========================================================
# LEGACY SUBSCRIPTION ENDPOINTS
# Kept temporarily for backward compatibility.
# =========================================================

@router.post(
    "/mock-activate",
)
async def mock_activate(
    body: MockActivateIn,
    current_user: dict = Depends(get_current_user),
):
    try:
        return await subscription_service.activate_mock(
            user_id=current_user["user_id"],
            tier=body.tier,
            interval=body.interval,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post(
    "/restore",
    response_model=SubscriptionResponse,
)
async def restore(
    current_user: dict = Depends(get_current_user),
):
    try:
        return await subscription_service.restore(
            current_user["user_id"]
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post(
    "/cancel",
)
async def cancel(
    current_user: dict = Depends(get_current_user),
):
    try:
        return await subscription_service.cancel(
            current_user["user_id"]
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# =========================================================
# FX CREDIT ENDPOINTS
# =========================================================

@router.get(
    "/credits",
    response_model=CreditsResponse,
)
async def credits(
    current_user: dict = Depends(get_current_user),
):
    try:
        return await subscription_service.credits(
            current_user["user_id"]
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get(
    "/fx/packs",
)
async def fx_packs():
    """
    Return all available FX credit packs.
    """
    return await fx_service.get_packs()


@router.get(
    "/fx/balance",
)
async def fx_balance(
    current_user: dict = Depends(get_current_user),
):
    """
    Return the current user's FX balance.
    """
    try:
        return await fx_service.get_balance(
            current_user["user_id"]
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post(
    "/fx/mock-purchase/{pack_id}",
)
async def fx_mock_purchase(
    pack_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Test purchase endpoint.

    This does NOT charge real money.
    It will be replaced by Apple/Google IAP
    after the FX system is fully tested.
    """
    try:
        return await fx_service.purchase_mock(
            user_id=current_user["user_id"],
            pack_id=pack_id,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )