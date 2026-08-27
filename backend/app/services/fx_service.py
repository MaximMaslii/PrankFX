from app.repositories.user_repository import UserRepository


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