from datetime import datetime

from pydantic import BaseModel


class ProjectListItem(BaseModel):
    project_id: str
    effect_id: str
    effect_name: str
    category: str
    thumbnail: str
    is_favorite: bool
    created_at: datetime


class ProjectFull(BaseModel):
    project_id: str
    effect_id: str
    effect_name: str
    category: str
    original_image: str
    result_image: str
    is_favorite: bool
    created_at: datetime


class ProjectListResponse(BaseModel):
    items: list[ProjectListItem]


class FavoriteIn(BaseModel):
    is_favorite: bool