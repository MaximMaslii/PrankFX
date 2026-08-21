from typing import Literal

from pydantic import BaseModel


class MockActivateIn(BaseModel):
    tier: Literal["face_effects", "ultimate"]
    interval: Literal["month", "year"]


class SubscriptionResponse(BaseModel):
    is_premium: bool
    premium_tier: str | None = None


class CreditsResponse(BaseModel):
    is_premium: bool
    premium_tier: str | None
    free_credits_used: int
    free_credits_total: int
    free_credits_remaining: int