"""Purchase endpoints: the RevenueCat webhook and the restore pull."""
import hmac
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from app.config import settings
from app.middleware.rate_limit import RateLimiter
from app.security.dependencies import get_current_user
from app.services.purchase_service import PurchaseService


logger = logging.getLogger("prankfx.purchases")

router = APIRouter(
    prefix="/api/purchases",
    tags=["Purchases"],
)

purchase_service = PurchaseService()

# Restore is a network call to RevenueCat; a few per minute per address is
# plenty for a button people press when something went wrong.
restore_rate_limit = RateLimiter(attempts=20, window_seconds=300, scope="restore")


def _authorised(header_value: str | None) -> bool:
    """Constant-time check of RevenueCat's Authorization header."""

    expected = settings.REVENUECAT_WEBHOOK_AUTH

    if not expected:
        # Unconfigured means closed. An open endpoint that adds FX to
        # accounts is the single most valuable thing to find in this API.
        return False

    if not header_value:
        return False

    return hmac.compare_digest(header_value.strip(), expected.strip())


@router.post("/revenuecat", include_in_schema=False)
async def revenuecat_webhook(
    request: Request,
    authorization: str | None = Header(default=None),
):
    """Receive purchase events from RevenueCat.

    Returns 200 for anything it has understood — including duplicates and
    events it deliberately ignores — because RevenueCat retries on every
    non-2xx and a permanent error would queue forever.
    """
    if not _authorised(authorization):
        logger.warning("Rejected RevenueCat webhook with a bad Authorization header")

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed JSON",
        )

    try:
        return await purchase_service.handle_event(payload)

    except Exception:
        # A 500 here makes RevenueCat retry, which is what we want for a
        # transient database problem — but log it so it is not silent.
        logger.exception("Failed to process a RevenueCat event")
        raise


@router.post(
    "/restore",
    dependencies=[Depends(restore_rate_limit)],
)
async def restore(current_user: dict = Depends(get_current_user)):
    """Re-apply whatever this account is entitled to.

    Subscriptions only: consumable FX are spent goods, and re-granting them
    on every restore would be an endless supply of free credits.
    """
    try:
        return await purchase_service.sync_entitlements(current_user["user_id"])

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
