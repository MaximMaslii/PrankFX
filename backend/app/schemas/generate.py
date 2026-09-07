from pydantic import BaseModel


class GenerateIn(BaseModel):
    image_base64: str
    effect_id: str
    save_to_history: bool = True