import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import close_database, ensure_indexes
from app.routers.auth import router as auth_router
from app.routers.effects import router as effects_router
from app.routers.projects import router as projects_router
from app.routers.generate import router as generate_router
from app.routers.subscription import router as subscription_router
from app.services.migration_service import migrate_fx_credits


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

logger = logging.getLogger("prankfx")


@asynccontextmanager
async def lifespan(app: FastAPI):
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


app.include_router(auth_router)
app.include_router(effects_router)
app.include_router(projects_router)
app.include_router(generate_router)
app.include_router(subscription_router)


@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "PrankFX API",
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

    return {
        "status": "ok",
        "database": await ping_database(),
        "google_clients": len(settings.google_client_ids),
    }
