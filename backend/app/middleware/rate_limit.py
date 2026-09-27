"""Rate limiting for the authentication endpoints.

`/auth/login` accepted an unlimited number of guesses per second, which makes
every account worth exactly as much as its password. A fixed window per IP
costs nothing and turns a password list from a five-minute job into an
impossible one.

Deliberately in-memory: one small dict, no Redis to run, no network hop on the
hot path. The trade-off is that the counter is per PROCESS — with N uvicorn
workers the real limit is N times the configured one, which is still four
orders of magnitude below what a brute-force needs. Move to Redis if the API
is ever spread across several machines.
"""
import time
from collections import deque
from threading import Lock

from fastapi import HTTPException, Request, status

from app.config import settings


# key -> timestamps of recent attempts
_hits: dict[str, deque] = {}
_lock = Lock()

# Above this many tracked keys the empty ones are swept, so a flood of unique
# IPs cannot grow the dict without bound.
_MAX_KEYS = 20_000


def client_ip(request: Request) -> str:
    """The caller's address, honouring one layer of reverse proxy.

    In production the app sits behind nginx/Caddy, where `request.client.host`
    is the proxy itself — every user would share one bucket and the first
    ten sign-ins of the day would lock everyone else out.
    """
    forwarded = request.headers.get("x-forwarded-for")

    if forwarded:
        return forwarded.split(",")[0].strip()

    real_ip = request.headers.get("x-real-ip")

    if real_ip:
        return real_ip.strip()

    return request.client.host if request.client else "unknown"


class RateLimiter:
    """FastAPI dependency: allows `attempts` calls per `window` seconds."""

    def __init__(
        self,
        attempts: int | None = None,
        window_seconds: int | None = None,
        scope: str = "auth",
    ):
        self._attempts = attempts
        self._window = window_seconds
        self.scope = scope

    @property
    def attempts(self) -> int:
        return self._attempts or settings.AUTH_RATE_LIMIT_ATTEMPTS

    @property
    def window(self) -> int:
        return self._window or settings.AUTH_RATE_LIMIT_WINDOW_SECONDS

    async def __call__(self, request: Request) -> None:
        if self.attempts <= 0:
            return

        key = f"{self.scope}:{client_ip(request)}"
        now = time.monotonic()
        cutoff = now - self.window

        with _lock:
            if len(_hits) > _MAX_KEYS:
                for stale in [k for k, v in _hits.items() if not v or v[-1] < cutoff]:
                    _hits.pop(stale, None)

            bucket = _hits.setdefault(key, deque())

            while bucket and bucket[0] < cutoff:
                bucket.popleft()

            if len(bucket) >= self.attempts:
                retry_after = max(1, int(bucket[0] + self.window - now))

                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        "Too many attempts. Wait a few minutes and try again."
                    ),
                    headers={"Retry-After": str(retry_after)},
                )

            bucket.append(now)


# Sign-in and sign-up: the endpoints worth guessing at.
auth_rate_limit = RateLimiter(scope="auth")

# Password reset is cheap for us and expensive for the recipient's inbox, so
# it gets a tighter budget of its own.
forgot_rate_limit = RateLimiter(attempts=5, window_seconds=900, scope="forgot")

# Guest sessions get a looser budget than sign-in, deliberately. The call is
# idempotent per device, so one phone hits it once — but a cafe, a school or a
# mobile carrier can put thousands of people behind a single public IP, and
# the sign-in budget would lock out everyone after the tenth. It is still
# bounded, because a call that creates an account also creates free FX.
guest_rate_limit = RateLimiter(attempts=30, window_seconds=600, scope="guest")
