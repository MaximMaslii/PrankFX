from app.database import db


class ProjectRepository:

    @staticmethod
    async def create(document: dict):
        return await db.projects.insert_one(document)

    @staticmethod
    async def get_by_id(project_id: str, user_id: str):
        return await db.projects.find_one(
            {
                "project_id": project_id,
                "user_id": user_id,
            },
            {"_id": 0},
        )

    @staticmethod
    async def list(
        user_id: str,
        favorites: bool = False,
        search: str | None = None,
    ):
        query = {"user_id": user_id}

        if favorites:
            query["is_favorite"] = True

        if search:
            query["effect_name"] = {
                "$regex": search,
                "$options": "i",
            }

        cursor = db.projects.find(
            query,
            {"_id": 0},
        ).sort("created_at", -1)

        return await cursor.to_list(length=100)

    @staticmethod
    async def update_favorite(
        project_id: str,
        user_id: str,
        is_favorite: bool,
    ):
        return await db.projects.update_one(
            {
                "project_id": project_id,
                "user_id": user_id,
            },
            {
                "$set": {
                    "is_favorite": is_favorite,
                }
            },
        )

    @staticmethod
    async def delete(
        project_id: str,
        user_id: str,
    ):
        return await db.projects.delete_one(
            {
                "project_id": project_id,
                "user_id": user_id,
            }
        )

    @staticmethod
    async def reassign_user(from_user_id: str, to_user_id: str):
        """Move a guest's photo history onto the account they just signed into.

        Without this, the picture someone made thirty seconds before tapping
        "Continue with Google" would vanish at the moment they created the
        account — which reads as the app losing their work.
        """
        return await db.projects.update_many(
            {"user_id": from_user_id},
            {"$set": {"user_id": to_user_id}},
        )

    @staticmethod
    async def delete_for_user(user_id: str):
        """Erase a user's whole history — used when the account is deleted.

        A project document holds BOTH the original photo and the result as
        base64, so without this the user's images outlived their owner and the
        privacy policy's promise about deletion would not have been true.
        """
        return await db.projects.delete_many({"user_id": user_id})