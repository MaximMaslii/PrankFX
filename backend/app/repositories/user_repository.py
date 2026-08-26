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
    async def reserve_free_credit(user_id: str):
        return await db.users.find_one_and_update(
            {
                "user_id": user_id,
                "$expr": {
                    "$lt": [
                        "$free_credits_used",
                        "$free_credits_total",
                    ]
                },
            },
            {
                "$inc": {
                    "free_credits_used": 1,
                }
            },
            projection={"_id": 0},
            return_document=True,
        )

    @staticmethod
    async def refund_free_credit(user_id: str):
        return await db.users.find_one_and_update(
            {
                "user_id": user_id,
                "free_credits_used": {"$gt": 0},
            },
            {
                "$inc": {
                    "free_credits_used": -1,
                }
            },
            projection={"_id": 0},
            return_document=True,
        )

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
