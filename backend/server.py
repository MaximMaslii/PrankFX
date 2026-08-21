from contextlib import asynccontextmanager
from app.routers.projects import router as projects_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.generate import router as generate_router
from app.database import close_database
from app.routers.auth import router as auth_router
from app.routers.effects import router as effects_router
from app.routers.subscription import router as subscription_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_database()


app = FastAPI(
    title="PrankFX API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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