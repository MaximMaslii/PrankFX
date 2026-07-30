from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class User:
    user_id: str
    email: str
    password_hash: Optional[str]
    provider: str
    name: str
    picture: Optional[str]
    is_premium: bool
    premium_tier: Optional[str]
    free_credits_used: int
    free_credits_total: int
    created_at: datetime
