"""Manual end-to-end check of the purchase webhook, restore and rate limits.

Money code, so it gets a test that does not need a real Mongo or a real
RevenueCat account:

    pip install mongomock-motor
    cd backend && python tests_unit/manual_purchase_check.py

It asserts the things that would actually cost money if they broke: a retried
webhook must not credit twice, a refund must not push the balance negative,
an unauthenticated webhook must be refused, and login must start answering 429.
"""
import os
os.environ["REVENUECAT_WEBHOOK_AUTH"] = "test-secret"
os.environ["AUTH_RATE_LIMIT_ATTEMPTS"] = "3"
os.environ["AUTH_RATE_LIMIT_WINDOW_SECONDS"] = "60"

from mongomock_motor import AsyncMongoMockClient

import app.database as database

mock = AsyncMongoMockClient()["prankfx_test"]
database.db = mock

# Repositories bound `db` at import time, so point them at the mock too.
import app.repositories.user_repository as ur
import app.repositories.project_repository as pr
import app.repositories.snap_repository as sr
ur.db = mock; pr.db = mock; sr.db = mock

import app.services.purchase_service as ps
ps.db = mock

from fastapi.testclient import TestClient
from app.main import app
from app.security.jwt import create_access_token

client = TestClient(app)

import asyncio
from app.utils.datetime import utc_now

USER = {
    "user_id": "u_test", "email": "t@example.com", "password_hash": None,
    "provider": "apple", "name": "T", "picture": None, "is_premium": False,
    "premium_tier": None, "free_credits_used": 0, "free_credits_total": 1,
    "fx_credits": 2, "created_at": utc_now(),
}
asyncio.get_event_loop().run_until_complete(mock.users.insert_one(dict(USER)))

def balance():
    doc = asyncio.get_event_loop().run_until_complete(
        mock.users.find_one({"user_id": "u_test"}, {"_id": 0, "fx_credits": 1}))
    return doc["fx_credits"]

def event(eid, etype, product, reason=None):
    e = {"id": eid, "type": etype, "app_user_id": "u_test",
         "product_id": product, "store": "PLAY_STORE", "environment": "PRODUCTION"}
    if reason: e["cancel_reason"] = reason
    return {"event": e, "api_version": "1.0"}

fails = []
def check(name, cond, extra=""):
    print(("PASS  " if cond else "FAIL  ") + name + (f"  {extra}" if extra else ""))
    if not cond: fails.append(name)

# --- webhook auth ----------------------------------------------------
r = client.post("/api/purchases/revenuecat", json=event("e0", "TEST", None))
check("webhook without Authorization → 401", r.status_code == 401, r.status_code)

r = client.post("/api/purchases/revenuecat", json=event("e0", "TEST", None),
                headers={"Authorization": "wrong"})
check("webhook with wrong secret → 401", r.status_code == 401, r.status_code)

H = {"Authorization": "test-secret"}

r = client.post("/api/purchases/revenuecat", json=event("e0", "TEST", None), headers=H)
check("TEST event accepted", r.status_code == 200 and r.json().get("test") is True, r.text)

# --- crediting -------------------------------------------------------
start = balance()
r = client.post("/api/purchases/revenuecat",
                json=event("e1", "NON_RENEWING_PURCHASE", "fx_popular"), headers=H)
check("purchase credits 40 FX", r.json().get("fx_added") == 40 and balance() == start + 40,
      f"{r.text} balance={balance()}")

# --- idempotency (RevenueCat retries) --------------------------------
before = balance()
r = client.post("/api/purchases/revenuecat",
                json=event("e1", "NON_RENEWING_PURCHASE", "fx_popular"), headers=H)
check("duplicate event is ignored", r.json().get("duplicate") is True and balance() == before,
      f"{r.text} balance={balance()}")

# --- product id variants ---------------------------------------------
before = balance()
client.post("/api/purchases/revenuecat",
            json=event("e2", "NON_RENEWING_PURCHASE", "prankfx_fx_starter:monthly"), headers=H)
check("id variant 'prankfx_fx_starter:monthly' → 5 FX", balance() == before + 5, balance())

# --- refund ----------------------------------------------------------
before = balance()
r = client.post("/api/purchases/revenuecat",
                json=event("e3", "CANCELLATION", "fx_popular", reason="CUSTOMER_SUPPORT"),
                headers=H)
check("refund removes 40 FX", balance() == before - 40, f"{r.text} balance={balance()}")

# --- refund cannot go negative ---------------------------------------
client.post("/api/purchases/revenuecat",
            json=event("e4", "CANCELLATION", "fx_ultimate", reason="CUSTOMER_SUPPORT"), headers=H)
check("balance never goes negative", balance() >= 0, balance())

# --- subscription ----------------------------------------------------
client.post("/api/purchases/revenuecat",
            json=event("e5", "INITIAL_PURCHASE", "prankfx_premium_monthly"), headers=H)
u = asyncio.get_event_loop().run_until_complete(mock.users.find_one({"user_id": "u_test"}))
check("subscription sets premium", u["is_premium"] is True, u.get("premium_tier"))

client.post("/api/purchases/revenuecat",
            json=event("e6", "EXPIRATION", "prankfx_premium_monthly"), headers=H)
u = asyncio.get_event_loop().run_until_complete(mock.users.find_one({"user_id": "u_test"}))
check("expiration clears premium", u["is_premium"] is False)

# --- unknown user ----------------------------------------------------
r = client.post("/api/purchases/revenuecat",
                json={"event": {"id": "e7", "type": "NON_RENEWING_PURCHASE",
                                "app_user_id": "nobody", "product_id": "fx_basic"}}, headers=H)
check("unknown user → 200, no crash", r.status_code == 200 and r.json().get("unknown_user") is True, r.text)

# --- restore requires auth -------------------------------------------
r = client.post("/api/purchases/restore")
check("restore without token → 401", r.status_code == 401, r.status_code)

token = create_access_token({"user_id": "u_test"})
r = client.post("/api/purchases/restore", headers={"Authorization": f"Bearer {token}"})
check("restore without RC key falls back", r.status_code == 200 and r.json()["synced"] is False, r.text)

# --- rate limiting ---------------------------------------------------
codes = [client.post("/api/auth/login",
                     json={"email": "x@y.com", "password": "nope"}).status_code
         for _ in range(5)]
check("login rate-limited after 3 tries", codes.count(429) == 2, codes)

r = client.post("/api/auth/login", json={"email": "x@y.com", "password": "nope"})
check("429 carries Retry-After", "retry-after" in {k.lower() for k in r.headers}, dict(r.headers))

# --- apple endpoint exists and rejects junk --------------------------
r = client.post("/api/auth/apple", json={"token": "not-a-token"},
                headers={"X-Forwarded-For": "9.9.9.9"})
check("apple endpoint rejects a bad token", r.status_code == 401, r.text[:120])

print()
print("FAILURES:", fails if fails else "none")
