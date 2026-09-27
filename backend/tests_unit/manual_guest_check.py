"""Manual end-to-end check of guest mode and the weekly subscription.

Runs against a fake Mongo, so it needs neither a database nor a RevenueCat
account:

    pip install mongomock-motor
    cd backend && python tests_unit/manual_guest_check.py

What it is actually protecting:

  * the free grant must happen once per device, not once per app launch —
    otherwise the free tier is a tap-to-repeat faucet and every FX costs us
    real money at the Gemini end;
  * a guest who signs up must keep the SAME user_id, because that id is what
    their photos, their clips and RevenueCat's `app_user_id` all point at;
  * a device id must never reopen an account that has since gained a
    password — that would hand the phone's next owner someone's account;
  * a weekly subscription must grant its FX on payment and only on payment,
    exactly once per event, and must not cut someone off on the day they
    cancel.
"""
import os

os.environ["REVENUECAT_WEBHOOK_AUTH"] = "test-secret"
os.environ["AUTH_RATE_LIMIT_ATTEMPTS"] = "50"

import asyncio  # noqa: E402

from mongomock_motor import AsyncMongoMockClient, AsyncMongoMockCollection  # noqa: E402

import app.database as database  # noqa: E402

mock = AsyncMongoMockClient()["prankfx_test"]
database.db = mock

import app.repositories.user_repository as ur  # noqa: E402
import app.repositories.project_repository as pr  # noqa: E402
import app.repositories.snap_repository as sr  # noqa: E402

ur.db = mock
pr.db = mock
sr.db = mock

import app.services.purchase_service as ps  # noqa: E402

ps.db = mock

# mongomock-motor returns None from find_one_and_update when a projection is
# passed; real MongoDB returns the updated document. The fake driver is
# patched rather than the app, and at class level because `db.users` hands out
# a new wrapper object on every access.
_orig_fou = AsyncMongoMockCollection.find_one_and_update


async def _fou(self, *args, **kwargs):
    kwargs.pop("projection", None)
    return await _orig_fou(self, *args, **kwargs)


AsyncMongoMockCollection.find_one_and_update = _fou

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.utils.datetime import utc_now  # noqa: E402

client = TestClient(app, raise_server_exceptions=False)

loop = asyncio.get_event_loop()

fails = []


def check(name, cond, extra=""):
    print(("PASS  " if cond else "FAIL  ") + name + (f"  {extra}" if extra else ""))
    if not cond:
        fails.append(name)


def user_doc(user_id):
    return loop.run_until_complete(mock.users.find_one({"user_id": user_id}))


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# =====================================================================
# GUEST SESSIONS
# =====================================================================

DEVICE = "device-aaaaaaaaaaaaaaaa"

r = client.post("/api/auth/guest", json={"device_id": DEVICE})
first = r.json() if r.status_code == 200 else {}

check(
    "guest sign-in returns a session",
    r.status_code == 200 and bool(first.get("token")),
    r.text[:160],
)

guest_user = first.get("user", {})
guest_id = guest_user.get("user_id")
guest_token = first.get("token")

check("guest is flagged as a guest", guest_user.get("is_guest") is True, guest_user)
check("guest gets the sign-up FX grant", guest_user.get("fx_credits") == 1, guest_user)
check("guest email is not exposed", guest_user.get("email") == "", guest_user.get("email"))
check("guest provider is 'guest'", guest_user.get("provider") == "guest", guest_user)

# The one that matters: calling it again must not mint a second account.
r = client.post("/api/auth/guest", json={"device_id": DEVICE})
again = r.json()

check(
    "same device returns the same account",
    again["user"]["user_id"] == guest_id,
    f"{again['user']['user_id']} vs {guest_id}",
)

check(
    "reopening does not grant more FX",
    again["user"]["fx_credits"] == 1,
    again["user"]["fx_credits"],
)

r = client.post("/api/auth/guest", json={"device_id": "device-bbbbbbbbbbbbbbbb"})
check(
    "a different device gets its own account",
    r.json()["user"]["user_id"] != guest_id,
)

r = client.post("/api/auth/guest", json={"device_id": "short"})
check("a too-short device id is rejected", r.status_code == 422, r.status_code)

# The guest's own session works like any other.
r = client.get("/api/auth/me", headers=auth(guest_token))
check("guest can call /auth/me", r.status_code == 200 and r.json()["is_guest"] is True, r.text[:120])


# =====================================================================
# GUEST -> REAL ACCOUNT
# =====================================================================

# Give the guest something to lose, so the promotion is worth testing.
loop.run_until_complete(
    mock.users.update_one({"user_id": guest_id}, {"$set": {"fx_credits": 7}})
)
loop.run_until_complete(
    mock.projects.insert_one(
        {
            "project_id": "p_guest",
            "user_id": guest_id,
            "effect_id": "e",
            "effect_name": "E",
            "category": "c",
            "original_image": "x",
            "result_image": "y",
            "is_favorite": False,
            "created_at": utc_now(),
        }
    )
)

r = client.post(
    "/api/auth/register",
    json={"email": "grown.up@example.com", "password": "hunter2secret", "name": "Grown"},
    headers=auth(guest_token),
)

promoted = r.json() if r.status_code == 200 else {}

check("guest can register", r.status_code == 200, r.text[:160])

check(
    "registering keeps the same user_id",
    promoted.get("user", {}).get("user_id") == guest_id,
    f"{promoted.get('user', {}).get('user_id')} vs {guest_id}",
)

check(
    "registering keeps the FX balance",
    promoted.get("user", {}).get("fx_credits") == 7,
    promoted.get("user", {}).get("fx_credits"),
)

check(
    "the account is no longer a guest",
    promoted.get("user", {}).get("is_guest") is False,
    promoted.get("user"),
)

check(
    "the promoted account now has its email",
    promoted.get("user", {}).get("email") == "grown.up@example.com",
    promoted.get("user", {}).get("email"),
)

promoted_doc = user_doc(guest_id)

check(
    "the history survived the sign-up",
    loop.run_until_complete(mock.projects.count_documents({"user_id": guest_id})) == 1,
)

check(
    "the device id is detached from the account",
    "device_id" not in promoted_doc or promoted_doc.get("device_id") is None,
    promoted_doc.get("device_id"),
)

# Security: the next person holding this phone must not get that account back.
r = client.post("/api/auth/guest", json={"device_id": DEVICE})

check(
    "the device id no longer reopens the real account",
    r.json()["user"]["user_id"] != guest_id,
    r.json()["user"]["user_id"],
)

check(
    "the fresh guest starts from the sign-up grant",
    r.json()["user"]["fx_credits"] == 1,
    r.json()["user"]["fx_credits"],
)


# =====================================================================
# GUEST SIGNING INTO AN ACCOUNT THAT ALREADY EXISTS
# =====================================================================

r = client.post("/api/auth/guest", json={"device_id": "device-cccccccccccccccc"})
second_guest = r.json()["user"]["user_id"]
second_token = r.json()["token"]

loop.run_until_complete(
    mock.users.update_one({"user_id": second_guest}, {"$set": {"fx_credits": 9}})
)
loop.run_until_complete(
    mock.projects.insert_one(
        {
            "project_id": "p_second",
            "user_id": second_guest,
            "effect_id": "e",
            "effect_name": "E",
            "category": "c",
            "original_image": "x",
            "result_image": "y",
            "is_favorite": False,
            "created_at": utc_now(),
        }
    )
)

before_fx = user_doc(guest_id)["fx_credits"]

r = client.post(
    "/api/auth/login",
    json={"email": "grown.up@example.com", "password": "hunter2secret"},
    headers=auth(second_token),
)

check("guest can sign into an existing account", r.status_code == 200, r.text[:160])

check(
    "signing in lands on the existing account",
    r.json()["user"]["user_id"] == guest_id,
)

check(
    "the guest's work moves across",
    loop.run_until_complete(
        mock.projects.count_documents({"user_id": guest_id})
    ) == 2,
)

check(
    "the abandoned guest document is removed",
    user_doc(second_guest) is None,
)

# Deliberate: free FX must not be harvestable by making a guest, signing in,
# clearing the app and repeating.
check(
    "free FX does NOT transfer to an existing account",
    user_doc(guest_id)["fx_credits"] == before_fx,
    user_doc(guest_id)["fx_credits"],
)


# =====================================================================
# WEEKLY SUBSCRIPTION
# =====================================================================

H = {"Authorization": "test-secret"}

WEEK_MS = 7 * 24 * 60 * 60 * 1000


def event(eid, etype, product, expires_in_ms=WEEK_MS, reason=None):
    e = {
        "id": eid,
        "type": etype,
        "app_user_id": guest_id,
        "product_id": product,
        "store": "PLAY_STORE",
        "environment": "PRODUCTION",
    }

    if expires_in_ms is not None:
        e["expiration_at_ms"] = int(utc_now().timestamp() * 1000) + expires_in_ms

    if reason:
        e["cancel_reason"] = reason

    return {"event": e, "api_version": "1.0"}


r = client.get("/api/subscription/plans")
plans = r.json() if r.status_code == 200 else []

check(
    "the plan catalogue is public and lists the weekly plan",
    r.status_code == 200 and any(p["id"] == "weekly" and p["fx"] == 50 for p in plans),
    r.text[:160],
)

fx_before = user_doc(guest_id)["fx_credits"]

r = client.post(
    "/api/purchases/revenuecat",
    json=event("s1", "INITIAL_PURCHASE", "prankfx_weekly"),
    headers=H,
)

doc = user_doc(guest_id)

check(
    "subscribing turns premium on",
    doc["is_premium"] is True and doc["premium_tier"] == "weekly",
    f"{r.text[:140]} tier={doc.get('premium_tier')}",
)

check(
    "subscribing grants the weekly FX",
    doc["fx_credits"] == fx_before + 50,
    doc["fx_credits"],
)

check(
    "the paid period is recorded",
    doc.get("premium_expires_at") is not None,
    doc.get("premium_expires_at"),
)

check(
    "subscribing turns auto-renew on",
    doc.get("premium_auto_renew") is True,
    doc.get("premium_auto_renew"),
)

# RevenueCat retries until it gets a 2xx.
fx_before = user_doc(guest_id)["fx_credits"]

r = client.post(
    "/api/purchases/revenuecat",
    json=event("s1", "INITIAL_PURCHASE", "prankfx_weekly"),
    headers=H,
)

check(
    "a retried subscription event does not grant twice",
    r.json().get("duplicate") is True and user_doc(guest_id)["fx_credits"] == fx_before,
    f"{r.text[:120]} balance={user_doc(guest_id)['fx_credits']}",
)

# Renewal is a payment, so it pays out again.
client.post(
    "/api/purchases/revenuecat",
    json=event("s2", "RENEWAL", "prankfx_weekly:weekly-base-plan"),
    headers=H,
)

check(
    "renewal grants another week of FX",
    user_doc(guest_id)["fx_credits"] == fx_before + 50,
    user_doc(guest_id)["fx_credits"],
)

# Un-cancelling is a settings toggle, not a payment.
fx_before = user_doc(guest_id)["fx_credits"]

client.post(
    "/api/purchases/revenuecat",
    json=event("s3", "UNCANCELLATION", "weekly"),
    headers=H,
)

doc = user_doc(guest_id)

check(
    "un-cancelling keeps premium but grants no FX",
    doc["is_premium"] is True and doc["fx_credits"] == fx_before,
    doc["fx_credits"],
)

check(
    "un-cancelling turns auto-renew back on",
    doc.get("premium_auto_renew") is True,
    doc.get("premium_auto_renew"),
)

# Cancelling stops the next charge; it does not take away the week just paid.
client.post(
    "/api/purchases/revenuecat",
    json=event("s4", "CANCELLATION", "prankfx_weekly", reason="UNSUBSCRIBE"),
    headers=H,
)

doc = user_doc(guest_id)

check(
    "cancelling does not revoke the paid week",
    doc["is_premium"] is True and doc.get("premium_auto_renew") is False,
    f"premium={doc['is_premium']} auto_renew={doc.get('premium_auto_renew')}",
)

# Expiry does.
client.post(
    "/api/purchases/revenuecat",
    json=event("s5", "EXPIRATION", "prankfx_weekly", expires_in_ms=None),
    headers=H,
)

doc = user_doc(guest_id)

check(
    "expiry ends premium",
    doc["is_premium"] is False and doc["premium_tier"] is None,
    doc,
)


# =====================================================================
# THE BACKSTOP FOR A LOST EXPIRATION WEBHOOK
# =====================================================================

loop.run_until_complete(
    mock.users.update_one(
        {"user_id": guest_id},
        {
            "$set": {
                "is_premium": True,
                "premium_tier": "weekly",
                # Yesterday: the webhook that should have ended this never came.
                "premium_expires_at": utc_now().replace(microsecond=0).fromtimestamp(
                    utc_now().timestamp() - 86400, tz=utc_now().tzinfo
                ),
            }
        },
    )
)

r = client.post(
    "/api/auth/login",
    json={"email": "grown.up@example.com", "password": "hunter2secret"},
)

token = r.json()["token"]

r = client.get("/api/auth/me", headers=auth(token))

check(
    "an expired subscription is dropped on the next /auth/me",
    r.status_code == 200 and r.json()["is_premium"] is False,
    r.text[:160],
)

check(
    "the expiry is written back, not just hidden",
    user_doc(guest_id)["is_premium"] is False,
    user_doc(guest_id)["is_premium"],
)


print()
print("FAILURES:", fails if fails else "none")

raise SystemExit(1 if fails else 0)
