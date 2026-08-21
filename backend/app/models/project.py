from datetime import datetime
from typing import Optional


def create_project_document(
    project_id: str,
    user_id: str,
    effect_id: str,
    effect_name: str,
    category: str,
    original_image: str,
    result_image: str,
    created_at: datetime,
    is_favorite: bool = False,
) -> dict:
    return {
        "project_id": project_id,
        "user_id": user_id,
        "effect_id": effect_id,
        "effect_name": effect_name,
        "category": category,
        "original_image": original_image,
        "result_image": result_image,
        "is_favorite": is_favorite,
        "created_at": created_at,
    }