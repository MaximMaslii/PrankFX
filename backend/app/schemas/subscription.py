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

    premium_tier: str | None = None

    # Legacy fields kept for backward compatibility.
    free_credits_used: int = 0
    free_credits_total: int = 1
    free_credits_remaining: int = 0

    # Current PrankFX FX balance.
    fx_credits: int = 0