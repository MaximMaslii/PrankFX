from app.repositories.user_repository import UserRepository


# =====================================================================
# SUBSCRIPTION PLANS
#
# The weekly plan is the headline offer and the FX packs are the top-up.
# The reason for that ordering is arithmetic, not fashion: a pack is bought
# once and then the app is silent until the user happens to want something,
# whereas a subscription is bought once and charged every week. The same
# person is worth several times more on a plan than on packs, and the price
# per FX is better for them — which is what makes the offer honest rather
# than merely profitable.
#
# `fx` is granted on the first payment and again on every renewal. Credits do
# not expire; there is no clock running down on something the user paid for.
# =====================================================================

SUBSCRIPTION_PLANS = {
    "weekly": {
        # Product id to create in Play Console / App Store Connect. The
        # matcher below also accepts `prankfx_weekly` and plain `weekly`.
        "product_id": "prankfx_weekly",
        "fx": 50,
        "price": 6.99,
        "period": "week",
        "period_days": 7,
    },
}

DEFAULT_PLAN_ID = "weekly"


def plan_for_product(product_id: str | None) -> tuple[str | None, dict | None]:
    """Map a store product id to a subscription plan.

    Accepts `prankfx_weekly`, `fx_weekly` or plain `weekly`, and ignores the
    `:weekly-base-plan` suffix Google appends — the same normalisation the FX
    packs use, so one naming mistake in a console cannot silently mean "this
    payment matched nothing".
    """
    if not product_id:
        return None, None

    candidate = product_id.strip().lower().split(":", 1)[0]

    for prefix in ("prankfx_", "fx_", "prankfx.", "fx."):
        if candidate.startswith(prefix):
            candidate = candidate[len(prefix):]

    plan = SUBSCRIPTION_PLANS.get(candidate)

    if not plan:
        return None, None

    return candidate, plan


FX_PACKS = {
    "starter": {
        "fx": 5,
        "price": 0.99,
    },
    "basic": {
        "fx": 15,
        "price": 2.49,
    },
    "popular": {
        "fx": 40,
        "price": 6.99,
    },
    "pro": {
        "fx": 100,
        "price": 14.99,
    },
    "ultimate": {
        "fx": 250,
        "price": 34.99,
    },
}


class FXService:

    def __init__(self):
        self.users = UserRepository()

    async def get_balance(self, user_id: str) -> dict:
        user = await self.users.get_by_user_id(user_id)

        if not user:
            raise ValueError("User not found")

        return {
            "fx_credits": user.get("fx_credits", 0),
        }

    async def get_plans(self) -> list[dict]:
        """Subscription catalogue for the paywall.

        The prices here are a fallback only. The paywall shows what the store
        reports, in the user's own currency — a hard-coded "$6.99" shown to
        someone paying in zlotys is both wrong and, on iOS, a review finding.
        """
        return [
            {
                "id": plan_id,
                "product_id": plan["product_id"],
                "fx": plan["fx"],
                "price": plan["price"],
                "period": plan["period"],
                "period_days": plan["period_days"],
            }
            for plan_id, plan in SUBSCRIPTION_PLANS.items()
        ]

    async def get_packs(self) -> list[dict]:
        return [
            {
                "id": pack_id,
                "fx": pack["fx"],
                "price": pack["price"],
            }
            for pack_id, pack in FX_PACKS.items()
        ]

    async def purchase_mock(
        self,
        user_id: str,
        pack_id: str,
    ) -> dict:

        pack = FX_PACKS.get(pack_id)

        if not pack:
            raise ValueError("Invalid FX pack")

        user = await self.users.get_by_user_id(user_id)

        if not user:
            raise ValueError("User not found")

        updated_user = await self.users.add_fx_credits(
            user_id=user_id,
            amount=pack["fx"],
        )

        if not updated_user:
            raise ValueError("Failed to add FX credits")

        return {
            "ok": True,
            "pack_id": pack_id,
            "fx_added": pack["fx"],
            "fx_credits": updated_user.get(
                "fx_credits",
                0,
            ),
        }