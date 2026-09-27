from datetime import datetime

from pydantic import BaseModel, Field


class SnapEffectOut(BaseModel):
    id: str
    name: str
    emoji: str
    age_restricted: bool
    fx_cost: int
    # "lucy" (recorded clip) or "pixverse" (animated photo).
    engine: str = "lucy"
    # What the app has to collect first: "video" or "photo".
    input: str = "video"
    # "hit" / "new" / None — a label on the card, nothing more.
    badge: str | None = None
    # {"en": ..., "ru": ..., "de": ...} — the app prefers these over its own
    # bundled strings, so new effects need no app update.
    title: dict[str, str] = {}
    tagline: dict[str, str] = {}
    # Listed but not yet available — the app shows it locked, "Coming soon".
    coming_soon: bool = False


class SnapPhotoJobIn(BaseModel):
    effect_id: str
    # Plain base64 or a data URI. JSON rather than multipart because the
    # photo flow already holds the picture as base64 (see /api/generate).
    image_base64: str = Field(min_length=16)


class SnapCatalogOut(BaseModel):
    effects: list[SnapEffectOut]

    # The recorder reads its metronome from the server so the cut points can
    # never drift apart from the pipeline's.
    total_seconds: float
    snap_at_seconds: float
    return_hint_seconds: float
    fx_cost: int


class SnapJobOut(BaseModel):
    job_id: str
    effect_id: str
    effect_name: str
    input: str = "video"
    status: str
    stage: str
    error: str | None = None
    fx_charged: int
    created_at: datetime


class SnapJobListOut(BaseModel):
    items: list[SnapJobOut]
