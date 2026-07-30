from fastapi import FastAPI

from app.routers.auth import router as auth_router
from app.routers.generate import router as generate_router
from app.routers.projects import router as projects_router
from app.routers.subscription import router as subscription_router
from app.routers.effects import router as effects_router

from app.database import close_database

app = FastAPI(title="PrankFX API")

app.include_router(auth_router)
app.include_router(generate_router)
app.include_router(projects_router)
app.include_router(subscription_router)
app.include_router(effects_router)

@app.on_event("shutdown")
async def shutdown():
    await close_database()
