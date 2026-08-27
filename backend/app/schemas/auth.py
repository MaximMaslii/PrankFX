from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):

    email: EmailStr

    password: str = Field(min_length=6, max_length=128)

    name: Optional[str] = None


class LoginIn(BaseModel):

    email: EmailStr

    password: str


class ForgotIn(BaseModel):

    email: EmailStr


class GoogleSessionIn(BaseModel):

    session_id: str


class UserOut(BaseModel):

    user_id: str

    email: str

    name: Optional[str] = None

    picture: Optional[str] = None

    provider: str

    is_premium: bool = False

    premium_tier: Optional[str] = None

    # Legacy fields kept for backward compatibility.
    free_credits_used: int = 0
    free_credits_total: int = 1

    # Current PrankFX balance.
    fx_credits: int = 0

    created_at: datetime


class AuthResponse(BaseModel):

    token: str

    user: UserOut