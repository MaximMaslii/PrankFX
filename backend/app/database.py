import logging

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings


logger = logging.getLogger("prankfx.db")


client = AsyncIOMotorClient(
    settings.MONGO_URL,
    serverSelectionTimeoutMS=5000,
)

db = client[settings.DB_NAME]


def get_db():
    return db


async def ensure_indexes() -> None:
    """
    Create the indexes the app relies on.

    The unique index on `users.email` is the important one: `google_login` and
    `register` both do a read-then-insert, which is not atomic. Two requests
    arriving together for the same brand-new email would otherwise create two
    user documents, and every later lookup would non-deterministically return
    one or the other.
    """
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)

    await db.projects.create_index("project_id", unique=True)
    await db.projects.create_index([("user_id", 1), ("created_at", -1)])

    logger.info("MongoDB indexes are in place")


async def ping_database() -> str:
    try:
        await client.admin.command("ping")
        return "connected"
    except Exception as e:
        logger.warning("MongoDB ping failed: %s", e)
        return "unreachable"


async def close_database():
    client.close()
