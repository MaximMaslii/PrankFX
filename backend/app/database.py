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

    await db.snap_jobs.create_index("job_id", unique=True)
    await db.snap_jobs.create_index([("user_id", 1), ("created_at", -1)])

    # Sign in with Apple: the account is keyed on Apple's `sub`, because the
    # email only ever arrives on the first sign-in. Sparse, since the field
    # exists on Apple accounts only.
    await db.users.create_index("apple_sub", unique=True, sparse=True)

    # Guest accounts are keyed on the installation. Unique so that two
    # launches racing on one device cannot produce two accounts — each of
    # which would come with its own free FX. Sparse because the field is
    # removed the moment a guest becomes a real account.
    await db.users.create_index("device_id", unique=True, sparse=True)

    # The one index that keeps purchases honest: RevenueCat retries a webhook
    # until it gets a 2xx, and without this a retry would credit FX twice.
    await db.purchases.create_index("event_id", unique=True)
    await db.purchases.create_index([("app_user_id", 1), ("received_at", -1)])

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
