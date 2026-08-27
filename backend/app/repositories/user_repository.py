from app.database import db


class UserRepository:

    @staticmethod
    async def get_by_email(email: str):
        return await db.users.find_one(
            {"email": email},
            {"_id": 0},
        )

    @staticmethod
    async def get_by_user_id(user_id: str):
        return await db.users.find_one(
            {"user_id": user_id},
            {"_id": 0},
        )

    @staticmethod
    async def create(document: dict):
        return await db.users.insert_one(document)

    @staticmethod
    async def update(user_id: str, values: dict):
        return await db.users.update_one(
            {"user_id": user_id},
            {"$set": values},
        )

    @staticmethod
    async def reserve_fx_credit(user_id: str):
        """
        Atomically reserve exactly 1 FX credit.

        Returns the updated user document when successful.
        Returns None when the user has no FX credits.
        """
        return await db.users.find_one_and_update(
            {
                "user_id": user_id,
                "fx_credits": {"$gt": 0},
            },
            {
                "$inc": {
                    "fx_credits": -1,
                }
            },
            projection={"_id": 0},
            return_document=True,
        )

    @staticmethod
    async def refund_fx_credit(user_id: str):
        """
        Return exactly 1 FX credit after a failed generation.
        """
        return await db.users.find_one_and_update(
            {
                "user_id": user_id,
            },
            {
                "$inc": {
                    "fx_credits": 1,
                }
            },
            projection={"_id": 0},
            return_document=True,
        )

    @staticmethod
    async def add_fx_credits(user_id: str, amount: int):
        """
        Add purchased FX credits to the user's balance.
        """
        if amount <= 0:
            raise ValueError("FX credit amount must be positive")

        return await db.users.find_one_and_update(
            {
                "user_id": user_id,
            },
            {
                "$inc": {
                    "fx_credits": amount,
                }
            },
            projection={"_id": 0},
            return_document=True,
        )

    @staticmethod
    async def get_fx_credits(user_id: str):
        """
        Return the current FX balance.
        """
        user = await db.users.find_one(
            {"user_id": user_id},
            {
                "_id": 0,
                "fx_credits": 1,
            },
        )

        if not user:
            return None

        return user.get("fx_credits", 0)

    @staticmethod
    async def delete(user_id: str):
        return await db.users.delete_one(
            {"user_id": user_id},
        )

    @staticmethod
    async def email_exists(email: str):
        user = await db.users.find_one(
            {"email": email},
            {"_id": 1},
        )

        return user is not None