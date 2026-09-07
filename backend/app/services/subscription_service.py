from app.repositories.user_repository import UserRepository


class SubscriptionService:

    def __init__(self):
        self.users = UserRepository()

    async def get_subscription(self, user_id: str) -> dict:
        user = await self.users.get_by_user_id(user_id)

        if not user:
            raise ValueError("User not found")

        return {
            "is_premium": user.get("is_premium", False),
            "premium_tier": user.get("premium_tier"),
        }

    async def activate_mock(
        self,
        user_id: str,
        tier: str,
        interval: str,
    ) -> dict:

        # Legacy endpoint kept temporarily for compatibility.
        # New PrankFX monetization uses FX credit packs.

        if tier not in ("face_effects", "ultimate"):
            raise ValueError("Invalid subscription tier")

        if interval not in ("month", "year"):
            raise ValueError("Invalid subscription interval")

        user = await self.users.get_by_user_id(user_id)

        if not user:
            raise ValueError("User not found")

        await self.users.update(
            user_id,
            {
                "is_premium": True,
                "premium_tier": tier,
            },
        )

        return {
            "ok": True,
            "tier": tier,
            "interval": interval,
        }

    async def restore(self, user_id: str) -> dict:
        user = await self.users.get_by_user_id(user_id)

        if not user:
            raise ValueError("User not found")

        return {
            "is_premium": user.get("is_premium", False),
            "premium_tier": user.get("premium_tier"),
        }

    async def cancel(self, user_id: str) -> dict:
        user = await self.users.get_by_user_id(user_id)

        if not user:
            raise ValueError("User not found")

        await self.users.update(
            user_id,
            {
                "is_premium": False,
                "premium_tier": None,
            },
        )

        return {
            "ok": True,
        }

    async def credits(self, user_id: str) -> dict:
        user = await self.users.get_by_user_id(user_id)

        if not user:
            raise ValueError("User not found")

        free_credits_used = user.get(
            "free_credits_used",
            0,
        )

        free_credits_total = user.get(
            "free_credits_total",
            1,
        )

        return {
            "is_premium": user.get(
                "is_premium",
                False,
            ),
            "premium_tier": user.get(
                "premium_tier",
            ),

            "free_credits_used": free_credits_used,
            "free_credits_total": free_credits_total,
            "free_credits_remaining": max(
                free_credits_total - free_credits_used,
                0,
            ),

            "fx_credits": user.get(
                "fx_credits",
                0,
            ),
        }