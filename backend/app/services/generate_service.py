from app.models.project import create_project_document
from app.repositories.project_repository import ProjectRepository
from app.repositories.user_repository import UserRepository
from app.schemas.generate import GenerateIn
from app.schemas.project import ProjectFull
from app.services.gemini_service import GeminiService
from app.utils.datetime import utc_now
from app.utils.ids import generate_project_id
from effects import get_effect_by_id


class GenerateService:

    def __init__(self):
        self.projects = ProjectRepository()
        self.users = UserRepository()
        self.gemini = GeminiService()

    async def generate(
        self,
        user_id: str,
        data: GenerateIn,
    ) -> ProjectFull:

        # -------------------------------------------------
        # 1. Find effect
        # -------------------------------------------------
        effect = get_effect_by_id(data.effect_id)

        if not effect:
            raise ValueError("Effect not found")

        # -------------------------------------------------
        # 2. Find user
        # -------------------------------------------------
        user = await self.users.get_by_user_id(user_id)

        if not user:
            raise ValueError("User not found")

        # -------------------------------------------------
        # 3. Check subscription / credits
        # -------------------------------------------------
        is_premium = user.get("is_premium", False)
        premium_tier = user.get("premium_tier")

        required_tier = effect["premium_tier"]

        if is_premium:
            if (
                premium_tier == "face_effects"
                and required_tier == "ultimate"
            ):
                raise PermissionError(
                    "Premium tier required: ultimate"
                )

        else:
            # Free users can only use effects explicitly marked as free.
            if required_tier != "free":
                raise PermissionError(
                    "Premium subscription required"
                )

        reserved_credit = await self.users.reserve_free_credit(user_id)

        if not reserved_credit:
            raise PermissionError(
                "Free credits exhausted"
            )

        # -------------------------------------------------
        # 4. Generate image with Gemini
        # -------------------------------------------------
        try:
            result_image = await self.gemini.edit_image(
                image_base64=data.image_base64,
                prompt=effect["prompt"],
            )
        except Exception:
            if not is_premium:
                await self.users.refund_free_credit(user_id)
            raise

        # -------------------------------------------------
        # 5. Create project
        # -------------------------------------------------
        project_id = generate_project_id()
        created_at = utc_now()

        project = create_project_document(
            project_id=project_id,
            user_id=user_id,
            effect_id=effect["id"],
            effect_name=effect["name"],
            category=effect["category"],
            original_image=data.image_base64,
            result_image=result_image,
            created_at=created_at,
            is_favorite=False,
        )

        # -------------------------------------------------
        # 6. Save to history
        # -------------------------------------------------
        if data.save_to_history:
            await self.projects.create(project)

        # -------------------------------------------------
        # 7. Return result
        # -------------------------------------------------
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