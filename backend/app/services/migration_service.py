from app.database import db


async def migrate_fx_credits():
    """
    Add fx_credits to users created before the FX system.

    Existing users receive 1 FX only if the field does not exist.
    Users who already have fx_credits are not changed.
    """

    result = await db.users.update_many(
        {
            "fx_credits": {
                "$exists": False,
            }
        },
        {
            "$set": {
                "fx_credits": 1,
            }
        },
    )

    return {
        "matched": result.matched_count,
        "modified": result.modified_count,
    }