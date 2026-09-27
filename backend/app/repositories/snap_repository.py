from app.database import db


class SnapRepository:

    @staticmethod
    async def create(document: dict):
        return await db.snap_jobs.insert_one(document)

    @staticmethod
    async def get(job_id: str):
        return await db.snap_jobs.find_one(
            {"job_id": job_id},
            {"_id": 0},
        )

    @staticmethod
    async def update(job_id: str, values: dict):
        return await db.snap_jobs.update_one(
            {"job_id": job_id},
            {"$set": values},
        )

    @staticmethod
    async def claim_refund(job_id: str):
        """Flip `refunded` to True exactly once.

        Returns the job when THIS call flipped it, None when it was already
        refunded. Two paths can fail a job (the worker, and the stale-job
        sweep), and a plain read-then-write would let both hand the FX back.
        """
        return await db.snap_jobs.find_one_and_update(
            {"job_id": job_id, "refunded": {"$ne": True}},
            {"$set": {"refunded": True}},
            projection={"_id": 0},
        )

    @staticmethod
    async def list_unfinished_before(cutoff):
        cursor = db.snap_jobs.find(
            {
                "status": {"$in": ["queued", "processing"]},
                "updated_at": {"$lt": cutoff},
            },
            {"_id": 0},
        )

        return await cursor.to_list(length=500)

    @staticmethod
    async def list_for_user(user_id: str, limit: int = 30):
        cursor = (
            db.snap_jobs.find(
                {"user_id": user_id},
                {"_id": 0},
            )
            .sort("created_at", -1)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)

    @staticmethod
    async def delete(job_id: str):
        return await db.snap_jobs.delete_one({"job_id": job_id})

    @staticmethod
    async def reassign_user(from_user_id: str, to_user_id: str):
        """Move a guest's clips onto the account they just signed into."""
        return await db.snap_jobs.update_many(
            {"user_id": from_user_id},
            {"$set": {"user_id": to_user_id}},
        )

    @staticmethod
    async def delete_for_user(user_id: str):
        return await db.snap_jobs.delete_many({"user_id": user_id})
