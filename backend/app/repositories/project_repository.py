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