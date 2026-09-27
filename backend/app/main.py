import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import close_database, ensure_indexes
from app.routers.app_config import router as app_config_router
from app.routers.apple_web import router as apple_web_router
from app.routers.auth import router as auth_router
from app.routers.effects import router as effects_router
from app.routers.projects import router as projects_router
from app.routers.purchases import router as purchases_router
from app.routers.generate import router as generate_router
from app.routers.legal import router as legal_router
from app.routers.snap import router as snap_router
from app.routers.subscription import router as subscription_router
from app.services.migration_service import migrate_fx_credits


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

logger = logging.getLogger("prankfx")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # /subscription/fx/mock-purchase hands out FX for free to anyone with a
    # valid token. Shipping with it on is the difference between selling
    # credits and giving them away, so it is impossible to miss in the log.
    if settings.ALLOW_MOCK_PURCHASES:
        logger.warning(
            "ALLOW_MOCK_PURCHASES is ON — free FX top-ups are enabled. "
            "Never run a production server with this setting.",
        )

    # Unique index on email — without it two concurrent sign-ins with the same
    # new Google account could create two separate user documents.
    try:
        await ensure_indexes()
    except Exception:
        logger.exception("Could not create MongoDB indexes")

    try:
        await migrate_fx_credits()
    except Exception:
        logger.exception("FX credit migration failed")

    # Snap jobs run inside this process. Any that were mid-flight when it
    # last stopped will never finish — fail them and give the FX back.
    try:
        from app.routers.snap import snap_service

        await snap_service.recover_stale_jobs()
    except Exception:
        logger.exception("Could not recover interrupted Snap jobs")

    yield

    await close_database()


app = FastAPI(
    title="PrankFX API",
    version="1.1.0",
    lifespan=lifespan,
)


# A mobile app sends no Origin header, so "*" costs nothing here. The previous
# hard-coded localhost:8081 list broke the web build and any LAN dev client.
_allow_all = settings.cors_origins == ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # Credentials cannot be combined with a wildcard origin.
    allow_credentials=not _allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Never let a raw traceback reach the client as an empty 500 — log it and
    return a JSON body the app can actually display.
    """
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)

    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


app.include_router(app_config_router)
app.include_router(apple_web_router)
app.include_router(auth_router)
app.include_router(effects_router)
app.include_router(projects_router)
app.include_router(generate_router)
app.include_router(snap_router)
app.include_router(subscription_router)
app.include_router(purchases_router)

# Public pages (privacy, terms, support, data deletion). Google Play requires
# the first and the last of those to be reachable at a stable public URL.
app.include_router(legal_router)


@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "PrankFX API",
        "legal": "/legal",
    }


@app.get("/api/")
async def api_root():
    return {
        "status": "ok",
        "service": "PrankFX API",
    }


@app.get("/api/health")
async def health():
    """Quick check that the phone can actually reach this server."""
    from app.database import ping_database

    from app.routers.snap import snap_service
    from app.services.snap_pipeline import ffmpeg_path, ffprobe_path

    ffmpeg = ffmpeg_path()
    ffprobe = ffprobe_path()

    return {
        "status": "ok",
        "database": await ping_database(),
        "google_clients": len(settings.google_client_ids),
        # Snap needs both of these; without either, /api/snap/jobs answers 503
        # rather than charging FX for a clip it cannot build.
        "ffmpeg": ffmpeg or "missing",
        # Optional: without ffprobe the audio track is detected through ffmpeg
        # itself, so a clip still keeps its voice.
        "ffprobe": ffprobe or "missing",
        "decart": "configured" if settings.DECART_API_KEY else "missing",
        # Photo Snaps (PixVerse v5.5 via fal.ai).
        "pixverse": "configured" if settings.FAL_KEY else "missing",
        # Which engine animates photos right now, in the order they are
        # tried. Empty means photo Snaps answer 503.
        "photo_engines": snap_service.photo_engines(),
        # Purchases only work once the webhook secret is set — until then the
        # endpoint refuses every delivery and no FX is ever credited.
        "revenuecat_webhook": (
            "configured" if settings.REVENUECAT_WEBHOOK_AUTH else "missing"
        ),
        "apple_sign_in": (
            "configured" if settings.apple_client_ids else "missing"
        ),
        # Android uses Apple's web flow, which needs a Services ID.
        "apple_sign_in_android": (
            "configured" if settings.APPLE_SERVICE_ID else "missing"
        ),
        # Guest mode: the app opens straight into the camera instead of a
        # registration form. Turning it off puts the login wall back.
        "guest_mode": "on" if settings.GUEST_MODE_ENABLED else "off",
        # Must read "off" on anything the public can reach.
        "mock_purchases": (
            "ENABLED — NOT FOR PRODUCTION"
            if settings.ALLOW_MOCK_PURCHASES
            else "off"
        ),
    }
