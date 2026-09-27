"""Turning RevenueCat events into FX credits and premium status.

The rule this module exists to enforce: **the client never says how much it
paid.** The app can only start a purchase; the balance moves when RevenueCat
tells the server the store confirmed money changed hands. Anything else is a
faucet — the previous `/subscription/fx/mock-purchase` endpoint granted FX to
anyone who could send an authenticated POST.

Two ways in:
  • the webhook (`handle_event`) — the source of truth for consumable FX;
  • `sync_entitlements` — a pull from RevenueCat's API, used by "Restore
    purchases" and as a safety net when a webhook was missed. It can only
    restore SUBSCRIPTIONS: consumables are spent goods, and re-granting them
    on every restore would be an infinite credit loop.
"""
import logging
from datetime import datetime, timezone

import httpx
from pymongo.errors import DuplicateKeyError

from app.config import settings
from app.database import db
from app.repositories.user_repository import UserRepository
from app.services.fx_service import FX_PACKS, plan_for_product
from app.utils.datetime import utc_now


logger = logging.getLogger("prankfx.purchases")


# Events that mean "money arrived".
CREDIT_EVENTS = {
    "INITIAL_PURCHASE",
    "NON_RENEWING_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "PRODUCT_CHANGE",
}

# Subscription events that mean the entitlement is currently ON. Wider than
# the set below, because turning auto-renew back on restores access without
# any money moving.
SUBSCRIPTION_ACTIVE_EVENTS = {
    "INITIAL_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "PRODUCT_CHANGE",
    "SUBSCRIPTION_EXTENDED",
}

# Subscription events that mean a PAYMENT happened, and therefore that this
# period's FX allowance is owed. Narrower on purpose: UNCANCELLATION is a
# settings toggle, and crediting it would let someone harvest a week of FX by
# cancelling and un-cancelling in a loop without ever paying twice.
SUBSCRIPTION_GRANT_EVENTS = {"INITIAL_PURCHASE", "RENEWAL"}

# Events that mean the entitlement is over.
EXPIRE_EVENTS = {"EXPIRATION"}


def _expires_at(event: dict) -> datetime | None:
    """When the current paid period ends, from RevenueCat's millisecond stamp."""
    raw = event.get("expiration_at_ms")

    if not raw:
        return None

    try:
        return datetime.fromtimestamp(int(raw) / 1000, tz=timezone.utc)
    except (TypeError, ValueError, OSError, OverflowError):
        logger.warning("Unreadable expiration_at_ms: %r", raw)
        return None


def fx_for_product(product_id: str | None) -> tuple[str | None, int]:
    """Map a store product id to an FX pack.

    Accepts `fx_starter`, `prankfx_fx_starter` or plain `starter`, and ignores
    the `:monthly` base-plan suffix Google appends, so the same code works
    whatever naming you settle on in the two consoles.
    """
    if not product_id:
        return None, 0

    candidate = product_id.strip().lower().split(":", 1)[0]

    for prefix in ("prankfx_", "fx_", "prankfx.", "fx."):
        if candidate.startswith(prefix):
            candidate = candidate[len(prefix):]

    pack = FX_PACKS.get(candidate)

    if not pack:
        return None, 0

    return candidate, int(pack["fx"])


class PurchaseService:

    def __init__(self):
        self.users = UserRepository()

    # ------------------------------------------------------------------
    # Webhook
    # ------------------------------------------------------------------

    async def handle_event(self, payload: dict) -> dict:
        event = (payload or {}).get("event") or {}

        event_id = event.get("id")
        event_type = (event.get("type") or "").upper()
        app_user_id = event.get("app_user_id")
        product_id = event.get("product_id")

        if not event_id:
            # Without an id there is no way to deduplicate, and RevenueCat
            # retries every non-2xx response — better to drop it loudly.
            logger.warning("RevenueCat event without an id: %s", event_type)
            return {"ok": False, "reason": "missing event id"}

        # Two layers of deduplication, because crediting a purchase twice is
        # the expensive kind of bug: a cheap read catches the ordinary retry,
        # and the unique index catches two deliveries racing each other.
        # The index alone would be enough — but `ensure_indexes` is allowed to
        # fail at startup, and this must not quietly become a faucet if it did.
        if await db.purchases.find_one({"event_id": event_id}, {"_id": 1}):
            logger.info("Duplicate RevenueCat event %s ignored", event_id)
            return {"ok": True, "duplicate": True}

        try:
            await db.purchases.insert_one(
                {
                    "event_id": event_id,
                    "type": event_type,
                    "app_user_id": app_user_id,
                    "product_id": product_id,
                    "store": event.get("store"),
                    "environment": event.get("environment"),
                    "received_at": utc_now(),
                    "processed": False,
                }
            )
        except DuplicateKeyError:
            logger.info("Duplicate RevenueCat event %s ignored", event_id)
            return {"ok": True, "duplicate": True}

        if event_type == "TEST":
            logger.info("RevenueCat test event received")
            await self._mark(event_id, {"processed": True, "note": "test"})
            return {"ok": True, "test": True}

        if not app_user_id:
            await self._mark(event_id, {"note": "no app_user_id"})
            return {"ok": False, "reason": "missing app_user_id"}

        user = await self.users.get_by_user_id(app_user_id)

        if not user:
            # Happens when the app bought under an anonymous RevenueCat id
            # before logging in. Nothing to credit; the restore flow will
            # pick it up once the ids are aliased.
            logger.warning("RevenueCat event for unknown user %s", app_user_id)
            await self._mark(event_id, {"note": "unknown user"})
            return {"ok": True, "unknown_user": True}

        pack_id, fx_amount = fx_for_product(product_id)
        plan_id, plan = plan_for_product(product_id)

        # ---- Weekly subscription ------------------------------------
        #
        # Checked before the FX packs because a plan is also a product id, and
        # because this is the branch that carries the recurring revenue: a
        # mistake here is not a missing credit, it is a subscriber who paid
        # and got nothing.
        if plan and event_type in SUBSCRIPTION_ACTIVE_EVENTS:
            expires = _expires_at(event)

            await self.users.update(
                app_user_id,
                {
                    "is_premium": True,
                    "premium_tier": plan_id,
                    "premium_product_id": product_id,
                    "premium_expires_at": expires,
                    "premium_since": user.get("premium_since") or utc_now(),
                    # Auto-renew is on for every event in this set: a purchase
                    # and a renewal both arrive with it on, and UNCANCELLATION
                    # is literally the event for "turned it back on". Without
                    # this line the flag was written once, by CANCELLATION,
                    # and never cleared — so a subscriber who cancelled and
                    # then changed their mind stayed marked as leaving.
                    "premium_auto_renew": True,
                },
            )

            granted = 0

            if event_type in SUBSCRIPTION_GRANT_EVENTS:
                allowance = int(plan["fx"])

                updated = await self.users.add_fx_credits(
                    app_user_id,
                    allowance,
                    purchased=True,
                )

                granted = allowance

                logger.info(
                    "Subscription %s for %s (%s) — granted %s FX, active until %s",
                    plan_id,
                    app_user_id,
                    event_type,
                    allowance,
                    expires.isoformat() if expires else "unknown",
                )
            else:
                updated = None

                logger.info(
                    "Subscription %s for %s reactivated by %s — no FX granted",
                    plan_id,
                    app_user_id,
                    event_type,
                )

            await self._mark(
                event_id,
                {
                    "processed": True,
                    "user_id": app_user_id,
                    "plan_id": plan_id,
                    "premium": True,
                    "fx_added": granted,
                    "expires_at": expires,
                    "balance_after": (updated or {}).get("fx_credits"),
                },
            )

            return {"ok": True, "premium": True, "plan": plan_id, "fx_added": granted}

        if plan and event_type in EXPIRE_EVENTS:
            await self.users.update(
                app_user_id,
                {
                    "is_premium": False,
                    "premium_tier": None,
                    "premium_expires_at": None,
                    "premium_auto_renew": False,
                },
            )

            logger.info("Subscription %s ended for %s", plan_id, app_user_id)

            await self._mark(
                event_id,
                {
                    "processed": True,
                    "user_id": app_user_id,
                    "plan_id": plan_id,
                    "premium": False,
                },
            )

            return {"ok": True, "premium": False, "plan": plan_id}

        # A subscription CANCELLATION is NOT a refund: it switches auto-renew
        # off and the user keeps what they paid for until EXPIRATION arrives.
        # Taking access away here would bill someone for a week and cut them
        # off on the day they cancelled.
        if plan and event_type == "CANCELLATION":
            await self.users.update(app_user_id, {"premium_auto_renew": False})

            await self._mark(
                event_id,
                {
                    "processed": True,
                    "user_id": app_user_id,
                    "plan_id": plan_id,
                    "note": "auto-renew off; access kept until expiry",
                },
            )

            return {"ok": True, "auto_renew": False}

        # ---- Consumable FX packs ------------------------------------
        if pack_id and event_type in CREDIT_EVENTS:
            updated = await self.users.add_fx_credits(
                app_user_id,
                fx_amount,
                purchased=True,
            )

            logger.info(
                "Credited %s FX to %s for %s (%s)",
                fx_amount,
                app_user_id,
                product_id,
                event_type,
            )

            await self._mark(
                event_id,
                {
                    "processed": True,
                    "user_id": app_user_id,
                    "fx_added": fx_amount,
                    "pack_id": pack_id,
                    "balance_after": (updated or {}).get("fx_credits"),
                },
            )

            return {"ok": True, "fx_added": fx_amount}

        # ---- Refund / chargeback on a consumable --------------------
        if pack_id and event_type == "CANCELLATION":
            reason = (event.get("cancel_reason") or "").upper()

            # A subscription "cancellation" only stops the next renewal, but
            # for a one-off pack it means the money went back.
            if reason in {"CUSTOMER_SUPPORT", "UNKNOWN", "DEVELOPER_INITIATED"}:
                await self.users.deduct_fx_credits(app_user_id, fx_amount)

                logger.warning(
                    "Refund on %s for %s — removed up to %s FX",
                    product_id,
                    app_user_id,
                    fx_amount,
                )

                await self._mark(
                    event_id,
                    {
                        "processed": True,
                        "user_id": app_user_id,
                        "fx_removed": fx_amount,
                        "reason": reason,
                    },
                )

                return {"ok": True, "fx_removed": fx_amount}

        # ---- Subscription entitlement -------------------------------
        if event_type in CREDIT_EVENTS:
            await self.users.update(
                app_user_id,
                {"is_premium": True, "premium_tier": product_id},
            )

            await self._mark(
                event_id,
                {"processed": True, "user_id": app_user_id, "premium": True},
            )

            return {"ok": True, "premium": True}

        if event_type in EXPIRE_EVENTS:
            await self.users.update(
                app_user_id,
                {"is_premium": False, "premium_tier": None},
            )

            await self._mark(
                event_id,
                {"processed": True, "user_id": app_user_id, "premium": False},
            )

            return {"ok": True, "premium": False}

        # Everything else (BILLING_ISSUE, TRANSFER, SUBSCRIBER_ALIAS…) is
        # recorded and acknowledged so RevenueCat stops retrying it.
        await self._mark(event_id, {"processed": True, "note": "ignored"})

        return {"ok": True, "ignored": event_type}

    @staticmethod
    async def _mark(event_id: str, values: dict) -> None:
        try:
            await db.purchases.update_one(
                {"event_id": event_id},
                {"$set": values},
            )
        except Exception:
            logger.exception("Could not update purchase record %s", event_id)

    # ------------------------------------------------------------------
    # Restore / safety net
    # ------------------------------------------------------------------

    async def sync_entitlements(self, user_id: str) -> dict:
        """Ask RevenueCat what this user is entitled to, and apply it.

        Used by "Restore purchases". Subscriptions only — see the note at the
        top of the file about why consumables are not restored.
        """
        if not settings.REVENUECAT_SECRET_KEY:
            # Not configured yet: fall back to what the database already says
            # rather than failing the button.
            user = await self.users.get_by_user_id(user_id)

            if not user:
                raise ValueError("User not found")

            return {
                "is_premium": user.get("is_premium", False),
                "premium_tier": user.get("premium_tier"),
                "synced": False,
            }

        url = f"{settings.REVENUECAT_API_URL.rstrip('/')}/v1/subscribers/{user_id}"

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.get(
                    url,
                    headers={
                        "Authorization": f"Bearer {settings.REVENUECAT_SECRET_KEY}",
                        "Accept": "application/json",
                    },
                )

            response.raise_for_status()
            data = response.json()

        except Exception as e:
            logger.warning("RevenueCat sync failed for %s: %s", user_id, e)
            raise ValueError("Could not reach the store. Try again later.")

        entitlements = (
            data.get("subscriber", {}).get("entitlements", {}) or {}
        )

        entitlement = entitlements.get(settings.PREMIUM_ENTITLEMENT_ID)

        # `expires_date` is null for a lifetime purchase; RevenueCat only
        # lists an entitlement here while it is (or was) granted, so the date
        # is what decides whether it is still active.
        is_premium = False
        expires_at = None
        product_id = None

        if entitlement:
            raw_expires = entitlement.get("expires_date")
            product_id = entitlement.get("product_identifier")

            is_premium = raw_expires is None or raw_expires > utc_now().isoformat()

            if raw_expires:
                try:
                    expires_at = datetime.fromisoformat(
                        raw_expires.replace("Z", "+00:00")
                    )
                except ValueError:
                    logger.warning("Unreadable expires_date: %r", raw_expires)

        plan_id, _plan = plan_for_product(product_id)

        # Prefer our own plan id over the raw store product id: it is what the
        # paywall and the admin console speak, and it does not change when a
        # base plan is renamed in a console.
        tier = plan_id or product_id

        await self.users.update(
            user_id,
            {
                "is_premium": is_premium,
                "premium_tier": tier if is_premium else None,
                "premium_product_id": product_id if is_premium else None,
                "premium_expires_at": expires_at if is_premium else None,
            },
        )

        return {
            "is_premium": is_premium,
            "premium_tier": tier if is_premium else None,
            "synced": True,
        }
