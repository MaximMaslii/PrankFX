from app.models.project import create_project_document
from app.repositories.project_repository import ProjectRepository
from app.schemas.generate import GenerateIn
from app.schemas.project import ProjectFull
from app.utils.datetime import utc_now
from app.utils.ids import generate_project_id
from effects import get_effect_by_id
from app.repositories.user_repository import UserRepository


class GenerateService:

    def __init__(self):
        self.projects = ProjectRepository()
        self.users = UserRepository()

    async def generate(
        self,
        user_id: str,
        data: GenerateIn,
    ) -> ProjectFull:

        effect = get_effect_by_id(data.effect_id)

        if not effect:
            raise ValueError("Effect not found")
        user = await self.users.get_by_user_id(user_id)

        if not user:
            raise ValueError("User not found")

        is_premium = user.get("is_premium", False)
        premium_tier = user.get("premium_tier")

        required_tier = effect["premium_tier"]

        if is_premium:
            if premium_tier == "face_effects" and required_tier == "ultimate":
                raise PermissionError("Premium tier required: ultimate")
        else:
            free_used = user.get("free_credits_used", 0)
            free_total = user.get("free_credits_total", 1)

            if free_used >= free_total:
                raise PermissionError("Free credits exhausted")

            await self.users.update(
                user_id,
                {
                    "free_credits_used": free_used + 1,
                },
            )
        project_id = generate_project_id()

        created_at = utc_now()

        project = create_project_document(
            project_id=project_id,
            user_id=user_id,
            effect_id=effect["id"],
            effect_name=effect["name"],
            category=effect["category"],
            original_image=data.image_base64,
            result_image=data.image_base64,
            created_at=created_at,
            is_favorite=False,
        )

        if data.save_to_history:
            await self.projects.create(project)

        return ProjectFull(
            project_id=project["project_id"],
            effect_id=project["effect_id"],
            effect_name=project["effect_name"],
            category=project["category"],
            original_image=project["original_image"],
            result_image=project["result_image"],
            is_favorite=project["is_favorite"],
            created_at=project["created_at"],
        )