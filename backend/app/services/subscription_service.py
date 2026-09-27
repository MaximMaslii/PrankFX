from app.repositories.user_repository import UserRepository
from app.services.purchase_service import PurchaseService


class SubscriptionService:

    def __init__(self):
        self.users = UserRepository()
        self.purchases = PurchaseService()

    async def get_subscription(self, user_id: str) -> dict:
        user = await self.users.get_by_user_id(user_id)

        if not user:
            raise ValueError("User not found")

        return {
            "is_premium": user.get("is_premium", False),
            "premium_tier": user.get("premium_tier"),
        }

    async def restore(self, user_id: str) -> dict:
        """Restore purchases.

        This used to read the database back and call that a restore, so the
        button in Settings always answered "no active subscription" no matter
        what the account had bought. It now asks RevenueCat what the user is
        actually entitled to and applies the answer.
        """
        user = await self.users.get_by_user_id(user_id)

        if not user:
            raise ValueError("User not found")

        try:
            result = await self.purchases.sync_entitlements(user_id)

            return {
                "is_premium": result["is_premium"],
                "premium_tier": result["premium_tier"],
            }

        except ValueError:
            # Store unreachable — answer with what we already know rather
            # than failing a button that is usually a no-op anyway.
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