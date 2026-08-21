from app.repositories.project_repository import ProjectRepository
from app.schemas.project import (
    ProjectFull,
    ProjectListItem,
    ProjectListResponse,
)


class ProjectService:

    def __init__(self):
        self.projects = ProjectRepository()

    @staticmethod
    def _to_full(project: dict) -> ProjectFull:
        return ProjectFull(
            project_id=project["project_id"],
            effect_id=project["effect_id"],
            effect_name=project["effect_name"],
            category=project["category"],
            original_image=project["original_image"],
            result_image=project["result_image"],
            is_favorite=project.get("is_favorite", False),
            created_at=project["created_at"],
        )

    @staticmethod
    def _to_list_item(project: dict) -> ProjectListItem:
        return ProjectListItem(
            project_id=project["project_id"],
            effect_id=project["effect_id"],
            effect_name=project["effect_name"],
            category=project["category"],
            thumbnail=project["result_image"],
            is_favorite=project.get("is_favorite", False),
            created_at=project["created_at"],
        )

    async def list_projects(
        self,
        user_id: str,
        favorites: bool = False,
        search: str | None = None,
    ) -> ProjectListResponse:

        projects = await self.projects.list(
            user_id=user_id,
            favorites=favorites,
            search=search,
        )

        return ProjectListResponse(
            items=[
                self._to_list_item(project)
                for project in projects
            ]
        )

    async def get_project(
        self,
        project_id: str,
        user_id: str,
    ) -> ProjectFull | None:

        project = await self.projects.get_by_id(
            project_id=project_id,
            user_id=user_id,
        )

        if not project:
            return None

        return self._to_full(project)

    async def set_favorite(
        self,
        project_id: str,
        user_id: str,
        is_favorite: bool,
    ) -> dict | None:

        project = await self.projects.get_by_id(
            project_id=project_id,
            user_id=user_id,
        )

        if not project:
            return None

        await self.projects.update_favorite(
            project_id=project_id,
            user_id=user_id,
            is_favorite=is_favorite,
        )

        return {
            "ok": True,
            "is_favorite": is_favorite,
        }

    async def delete_project(
        self,
        project_id: str,
        user_id: str,
    ) -> bool:

        result = await self.projects.delete(
            project_id=project_id,
            user_id=user_id,
        )

        return result.deleted_count > 0