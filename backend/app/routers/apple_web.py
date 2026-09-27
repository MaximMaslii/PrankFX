"""Sign in with Apple on Android — Apple's web flow.

    app ──open browser──▶ GET  /api/auth/apple/start?state=…
                              302 → appleid.apple.com/auth/authorize
    Apple ──form_post──▶  POST /api/auth/apple/callback  (id_token, state, user)
                              302 → prankfx://apple-callback?id_token=…&state=…
    app ──────────────▶  POST /api/auth/apple   (the existing endpoint)

The callback does not sign anyone in by itself: it only hands Apple's
identity token back to the app, which then goes through the same
/api/auth/apple verification as the native iOS sheet — one code path for
guest upgrades, account merging and the rest. The redirect target is fixed to
the app's own scheme, so this can never be turned into an open redirect.
"""
import json
import secrets
from urllib.parse import urlencode

from fastapi import APIRouter, Form, HTTPException, Request, status
from fastapi.responses import RedirectResponse

from app.config import settings


router = APIRouter(prefix="/api/auth/apple", tags=["Authentication"])

APPLE_AUTHORIZE_URL = "https://appleid.apple.com/auth/authorize"


def web_flow_enabled() -> bool:
    return bool(settings.APPLE_SERVICE_ID.strip())


def _redirect_uri(request: Request) -> str:
    if settings.APPLE_REDIRECT_URI.strip():
        return settings.APPLE_REDIRECT_URI.strip()

    return str(request.url_for("apple_web_callback"))


def _back_to_app(**params: str) -> RedirectResponse:
    query = urlencode({k: v for k, v in params.items() if v})
    return RedirectResponse(
        f"{settings.APP_SCHEME}://apple-callback?{query}",
        status_code=status.HTTP_303_SEE_OTHER,
    )


@router.get("/start")
async def apple_web_start(request: Request, state: str = ""):
    if not web_flow_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sign in with Apple is not configured for Android yet "
            "(APPLE_SERVICE_ID is empty).",
        )

    # The app sends its own random state and checks it on return; fall back
    # to a fresh one so the parameter is never empty.
    state = (state or secrets.token_urlsafe(16))[:128]

    query = urlencode(
        {
            "client_id": settings.APPLE_SERVICE_ID.strip(),
            "redirect_uri": _redirect_uri(request),
            "response_type": "code id_token",
            # Asking for name/email forces response_mode=form_post.
            "scope": "name email",
            "response_mode": "form_post",
            "state": state,
        }
    )

    return RedirectResponse(f"{APPLE_AUTHORIZE_URL}?{query}")


@router.post("/callback", name="apple_web_callback")
async def apple_web_callback(
    id_token: str = Form(default=""),
    state: str = Form(default=""),
    user: str = Form(default=""),
    error: str = Form(default=""),
):
    if error or not id_token:
        # "user_cancelled_authorize" when the person closed Apple's page.
        return _back_to_app(error=error or "no_token", state=state)

    # Apple sends the name as JSON on the FIRST sign-in only.
    full_name = ""
    try:
        name = (json.loads(user) or {}).get("name") or {} if user else {}
        full_name = " ".join(
            part for part in (name.get("firstName"), name.get("lastName")) if part
        ).strip()
    except (ValueError, AttributeError):
        full_name = ""

    return _back_to_app(id_token=id_token, state=state, name=full_name[:120])
