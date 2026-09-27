"""Remote configuration for the installed app.

Everything here can be changed in backend/.env and takes effect on the next
app launch — no store release, no over-the-air update:

  * APP_MIN_VERSION   — below it the app shows a blocking "update" screen.
                        Only needed after a NATIVE change (a new native
                        module, a new permission) that an OTA update cannot
                        carry.
  * APP_MAINTENANCE   — a friendly "back soon" screen while the server is
                        being worked on.

Public on purpose: the app asks before anyone is signed in.
"""
from fastapi import APIRouter

from app.config import settings
from app.routers.apple_web import web_flow_enabled


router = APIRouter(prefix="/api/app", tags=["App config"])


@router.get("/config")
async def app_config():
    return {
        "min_version": settings.APP_MIN_VERSION.strip() or None,
        "latest_version": settings.APP_LATEST_VERSION.strip() or None,
        "maintenance": bool(settings.APP_MAINTENANCE),
        "maintenance_message": {
            "en": settings.APP_MAINTENANCE_MESSAGE_EN,
            "ru": settings.APP_MAINTENANCE_MESSAGE_RU,
            "de": settings.APP_MAINTENANCE_MESSAGE_DE,
        },
        "store_url": {
            "android": settings.APP_STORE_URL_ANDROID or None,
            "ios": settings.APP_STORE_URL_IOS or None,
        },
        "snap_fx_cost": settings.SNAP_FX_COST,
        # Show "Continue with Apple" on Android (web flow) — iOS always has it.
        "apple_web_sign_in": web_flow_enabled(),
    }
