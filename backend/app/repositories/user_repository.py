from app.database import db


class UserRepository:

    @staticmethod
    async def get_by_email(email: str):
        return await db.users.find_one(
            {"email": email},
            {"_id": 0},
        )

    @staticmethod
    async def get_by_user_id(user_id: str):
        return await db.users.find_one(
            {"user_id": user_id},
            {"_id": 0},
        )

    @staticmethod
    async def get_by_apple_sub(apple_sub: str):
        """Look a user up by their Apple account id.

        Apple sends the email address on the FIRST sign-in only, so on every
        later one this is the only way to recognise a returning user.
        """
        return await db.users.find_one(
            {"apple_sub": apple_sub},
            {"_id": 0},
        )

    @staticmethod
    async def get_by_device_id(device_id: str):
        """The guest account belonging to one installation.

        This is what stops the free FX grant from being a tap-to-repeat
        faucet: the same device always lands on the same guest account, so
        reopening the app does not mint another one.

        The field is UNSET the moment a guest turns into a real account, so
        this can never hand someone else's finished account to whoever holds
        the phone next.
        """
        return await db.users.find_one(
            {"device_id": device_id, "is_guest": True},
            {"_id": 0},
        )

    @staticmethod
    async def create(document: dict):
        return await db.users.insert_one(document)

    @staticmethod
    async def claim_guest(user_id: str, values: dict):
        """Turn a guest document into a real account, in place.

        In place matters: the user_id is what RevenueCat, the photo history
        and the Snap clips are all keyed on. Creating a new account and
        copying rows across would mean a purchase made minutes earlier pays
        into an id nobody is using any more.

        `device_id` is removed in the same operation — an account that has a
        password or a Google identity must never be reachable again by simply
        asking for "the guest on this device".
        """
        return await db.users.find_one_and_update(
            {"user_id": user_id, "is_guest": True},
            {
                "$set": {**values, "is_guest": False},
                "$unset": {"device_id": ""},
            },
            projection={"_id": 0},
            return_document=True,
        )

    @staticmethod
    async def update(user_id: str, values: dict):
        return await db.users.update_one(
            {"user_id": user_id},
            {"$set": values},
        )

    @staticmethod
    async def reserve_fx_credit(user_id: str):
        """
        Atomically reserve exactly 1 FX credit.

        Returns the updated user document when successful.
        Returns None when the user has no FX credits.
        """
        return await db.users.find_one_and_update(
            {
                "user_id": user_id,
                "fx_credits": {"$gt": 0},
            },
            {
                "$inc": {
                    "fx_credits": -1,
                }
            },
            projection={"_id": 0},
            return_document=True,
        )

    @staticmethod
    async def reserve_fx_credits(user_id: str, amount: int):
        """
        Atomically reserve `amount` FX credits.

        A Snap costs ten, so reserving them one at a time would leave a user
        half-charged whenever the balance ran out mid-loop. The filter on
        `fx_credits` makes the whole reservation succeed or fail as one.

        Returns the updated user document, or None when the balance is short.
        """
        if amount <= 0:
            raise ValueError("FX credit amount must be positive")

        return await db.users.find_one_and_update(
            {
                "user_id": user_id,
                "fx_credits": {"$gte": amount},
            },
            {
                "$inc": {
                    "fx_credits": -amount,
                }
            },
            projection={"_id": 0},
            return_document=True,
        )

    @staticmethod
    async def refund_fx_credit(user_id: str):
        """
        Return exactly 1 FX credit after a failed generation.
        """
        return await db.users.find_one_and_update(
            {
                "user_id": user_id,
            },
            {
                "$inc": {
                    "fx_credits": 1,
                }
            },
            projection={"_id": 0},
            return_document=True,
        )

    @staticmethod
    async def add_fx_credits(user_id: str, amount: int, purchased: bool = False):
        """
        Add purchased FX credits to the user's balance.

        `purchased` also bumps a lifetime counter. It never affects the
        balance; it is there so support can answer "has this person ever paid
        us anything?" without reading the whole purchase log.
        """
        if amount <= 0:
            raise ValueError("FX credit amount must be positive")

        increments = {"fx_credits": amount}

        if purchased:
            increments["fx_purchased_total"] = amount

        return await db.users.find_one_and_update(
            {
                "user_id": user_id,
            },
            {
                "$inc": increments,
            },
            projection={"_id": 0},
            return_document=True,
        )

    @staticmethod
    async def deduct_fx_credits(user_id: str, amount: int):
        """Take FX back after a refund, never below zero.

        A refunded pack may already be spent, and a negative balance would
        silently swallow the user's next legitimate purchase — so the floor
        is zero and the loss is ours.
        """
        if amount <= 0:
            raise ValueError("FX credit amount must be positive")

        user = await db.users.find_one(
            {"user_id": user_id},
            {"_id": 0, "fx_credits": 1},
        )

        if not user:
            return None

        current = int(user.get("fx_credits", 0) or 0)

        return await db.users.find_one_and_update(
            {"user_id": user_id},
            {"$set": {"fx_credits": max(0, current - amount)}},
            projection={"_id": 0},
            return_document=True,
        )

    @staticmethod
    async def get_fx_credits(user_id: str):
        """
        Return the current FX balance.
        """
        user = await db.users.find_one(
            {"user_id": user_id},
            {
                "_id": 0,
                "fx_credits": 1,
            },
        )

        if not user:
            return None

        return user.get("fx_credits", 0)

    @staticmethod
    async def delete(user_id: str):
        return await db.users.delete_one(
            {"user_id": user_id},
        )

    @staticmethod
    async def email_exists(email: str):
        user = await db.users.find_one(
            {"email": email},
            {"_id": 1},
        )

        return user is not None