from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database import close_database
from app.routers.auth import router as auth_router
from app.routers.effects import router as effects_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_database()


app = FastAPI(
    title="PrankFX API",
    lifespan=lifespan,
)


app.include_router(auth_router)
app.include_router(effects_router)


@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "PrankFX API",
    }