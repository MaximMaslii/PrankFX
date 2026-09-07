from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.schemas.project import (
    FavoriteIn,
    ProjectFull,
    ProjectListResponse,
)
from app.security.dependencies import get_current_user
from app.services.project_service import ProjectService


router = APIRouter(
    prefix="/api/projects",
    tags=["Projects"],
)

project_service = ProjectService()


@router.get(
    "",
    response_model=ProjectListResponse,
)
async def list_projects(
    favorites: bool = Query(False),
    search: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
):
    return await project_service.list_projects(
        user_id=current_user["user_id"],
        favorites=favorites,
        search=search,
    )


@router.get(
    "/{project_id}",
    response_model=ProjectFull,
)
async def get_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    project = await project_service.get_project(
        project_id=project_id,
        user_id=current_user["user_id"],
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return project

@router.patch(
    "/{project_id}/favorite",
)
async def set_favorite(
    project_id: str,
    body: FavoriteIn,
    current_user: dict = Depends(get_current_user),
):
    result = await project_service.set_favorite(
        project_id=project_id,
        user_id=current_user["user_id"],
        is_favorite=body.is_favorite,
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return result


@router.delete(
    "/{project_id}",
)
async def delete_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    deleted = await project_service.delete_project(
        project_id=project_id,
        user_id=current_user["user_id"],
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return {"ok": True}