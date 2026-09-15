from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.schemas.subscription import (
    CreditsResponse,
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
# SUBSCRIPTION STATUS
#
# There is no activation endpoint here on purpose. The former
# /mock-activate set is_premium=True for any authenticated caller with no
# payment involved, which made a paid tier free to anyone who read the
# network traffic. Premium must only ever be granted from a verified
# App Store / Google Play receipt.
# =========================================================

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
    Development-only credit top-up. Charges nothing.

    Disabled unless ALLOW_MOCK_PURCHASES is set, because an authenticated
    but unpaid endpoint that grants FX is an unlimited free balance — and
    every FX spent costs real money at the Gemini and Decart end.

    Replace with receipt verification (App Store Server API / Google Play
    Developer API) before shipping, and make it idempotent on
    transaction_id so one receipt cannot be redeemed twice.
    """
    if not settings.ALLOW_MOCK_PURCHASES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )

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