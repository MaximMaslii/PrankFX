from app.database import db


class UserRepository:

    @staticmethod
    async def get_by_email(email: str):
        return await db.users.find_one(
            {"email": email},
            {"_id": 0}
        )

    @staticmethod
    async def get_by_user_id(user_id: str):
        return await db.users.find_one(
            {"user_id": user_id},
            {"_id": 0}
        )

    @staticmethod
    async def create(user: dict):
        return await db.users.insert_one(user)

    @staticmethod
    async def delete(user_id: str):
        await db.users.delete_one(
            {"user_id": user_id}
        )
