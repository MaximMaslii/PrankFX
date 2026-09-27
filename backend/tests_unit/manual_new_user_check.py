"""The whole journey of a brand-new user, on a fake database and a fake model.

    pip install mongomock-motor
    cd backend && python tests_unit/manual_new_user_check.py

Covers registration, the free credit, spending it, the paywall, the refund on
a failed generation, history, and account deletion taking the content with it.
No Mongo, no Gemini bill, no network.
"""
import os, asyncio, base64
os.environ["AUTH_RATE_LIMIT_ATTEMPTS"] = "100"
os.environ["SIGNUP_FX_CREDITS"] = "1"

from mongomock_motor import AsyncMongoMockClient
import app.database as database
mock = AsyncMongoMockClient()["prankfx_test"]
database.db = mock
import app.repositories.user_repository as ur, app.repositories.project_repository as pr, app.repositories.snap_repository as sr
ur.db = mock; pr.db = mock; sr.db = mock
import app.services.purchase_service as ps; ps.db = mock

# mongomock-motor returns None from find_one_and_update when a projection is
# passed, while real MongoDB returns the updated document. That would make the
# FX reservation look like a failure here even though the production code is
# correct — so the fake driver is patched, not the app. (A new wrapper object
# is handed out on every `db.users` access, hence patching the class.)
from mongomock_motor import AsyncMongoMockCollection
_orig_fou = AsyncMongoMockCollection.find_one_and_update
async def _fou(self, *args, **kwargs):
    kwargs.pop("projection", None)
    return await _orig_fou(self, *args, **kwargs)
AsyncMongoMockCollection.find_one_and_update = _fou

# Fake the AI so the test costs nothing and is deterministic.
import app.services.gemini_service as gs
PIXEL = base64.b64encode(b"\xff\xd8\xff\xe0fake-jpeg").decode()
async def fake_edit(self, image_base64, prompt): return PIXEL
gs.GeminiService.edit_image = fake_edit

from fastapi.testclient import TestClient
from app.main import app
# raise_server_exceptions=False: behave like a real server and return the 500
# response instead of blowing up the test when a handler raises.
client = TestClient(app, raise_server_exceptions=False)

loop = asyncio.get_event_loop()
fails = []
def check(name, cond, extra=""):
    print(("PASS  " if cond else "FAIL  ") + name + (f"  {extra}" if extra else ""))
    if not cond: fails.append(name)

EMAIL = "newbie@example.com"
PW = "hunter2secret"

# 1. Register
r = client.post("/api/auth/register", json={"email": EMAIL, "password": PW, "name": "Newbie"})
body = r.json() if r.status_code == 200 else {}
check("register → 200 + token", r.status_code == 200 and bool(body.get("token")), r.text[:200])
user = body.get("user", {})
check("new user starts with 1 FX", user.get("fx_credits") == 1, user.get("fx_credits"))
check("provider is 'email'", user.get("provider") == "email", user.get("provider"))
check("not premium by default", user.get("is_premium") is False)
token = body.get("token", "")
AUTH = {"Authorization": f"Bearer {token}"}

# 2. Password is hashed, never stored raw
doc = loop.run_until_complete(mock.users.find_one({"email": EMAIL}))
check("password stored as bcrypt hash", doc["password_hash"].startswith("$2") and PW not in doc["password_hash"])

# 3. Duplicate registration
r = client.post("/api/auth/register", json={"email": EMAIL, "password": PW})
check("duplicate email → 409", r.status_code == 409, r.status_code)

# 4. Login
r = client.post("/api/auth/login", json={"email": EMAIL, "password": "wrong-password"})
check("wrong password → 401", r.status_code == 401, r.status_code)
r = client.post("/api/auth/login", json={"email": EMAIL.upper(), "password": PW})
check("login is case-insensitive on email", r.status_code == 200, r.text[:120])

# 5. Session
r = client.get("/api/auth/me", headers=AUTH)
check("/auth/me returns the user", r.status_code == 200 and r.json()["email"] == EMAIL, r.text[:120])
r = client.get("/api/auth/me")
check("/auth/me without token → 401", r.status_code == 401)

# 6. Catalogue + balance
r = client.get("/api/effects")
check("effects catalogue loads", r.status_code == 200 and len(r.json()["categories"]) > 0)
r = client.get("/api/subscription/credits", headers=AUTH)
check("credits endpoint shows 1 FX", r.json().get("fx_credits") == 1, r.text[:120])

# 7. Generate — spends the free credit
r = client.post("/api/generate", headers=AUTH,
                json={"image_base64": PIXEL, "effect_id": "movie_bruises", "save_to_history": True})
check("first generation succeeds", r.status_code == 200, r.text[:200])
r2 = client.get("/api/subscription/credits", headers=AUTH)
check("FX went 1 → 0", r2.json().get("fx_credits") == 0, r2.json().get("fx_credits"))

# 8. Out of credits
r = client.post("/api/generate", headers=AUTH,
                json={"image_base64": PIXEL, "effect_id": "movie_bruises", "save_to_history": True})
check("second generation → 402 (paywall)", r.status_code == 402, r.status_code)

# 9. Failed generation refunds
async def boom(self, image_base64, prompt): raise RuntimeError("model exploded")
gs.GeminiService.edit_image = boom
loop.run_until_complete(mock.users.update_one({"email": EMAIL}, {"$set": {"fx_credits": 3}}))
r = client.post("/api/generate", headers=AUTH,
                json={"image_base64": PIXEL, "effect_id": "movie_bruises", "save_to_history": True})
after = client.get("/api/subscription/credits", headers=AUTH).json()["fx_credits"]
check("failed generation refunds the FX", after == 3, f"balance={after}")
check("failed generation → readable 502", r.status_code == 502 and "FX credit has been returned" in r.text, f"{r.status_code} {r.text[:90]}")
gs.GeminiService.edit_image = fake_edit

# 10. History
r = client.get("/api/projects", headers=AUTH)
check("project is in history", r.status_code == 200 and len(r.json()["items"]) == 1, r.text[:120])

# 11. Snap catalogue reachable for a new user
r = client.get("/api/snap/effects")
check("snap catalogue loads", r.status_code == 200 and len(r.json()["effects"]) > 0, r.text[:120])

# 12. Delete account — must take the content with it
uid = loop.run_until_complete(mock.users.find_one({"email": EMAIL}))["user_id"]
loop.run_until_complete(mock.snap_jobs.insert_one({"job_id": "j1", "user_id": uid, "status": "completed"}))
r = client.delete("/api/auth/account", headers=AUTH)
check("delete account → 200", r.status_code == 200, r.text[:120])
check("user row gone", loop.run_until_complete(mock.users.find_one({"email": EMAIL})) is None)
check("projects gone", loop.run_until_complete(mock.projects.count_documents({"user_id": uid})) == 0)
check("snap jobs gone", loop.run_until_complete(mock.snap_jobs.count_documents({"user_id": uid})) == 0)

# 13. The old token is dead
r = client.get("/api/auth/me", headers=AUTH)
check("token invalid after deletion", r.status_code == 401, r.status_code)

# 14. Same email can register again
r = client.post("/api/auth/register", json={"email": EMAIL, "password": PW})
check("email is free again after deletion", r.status_code == 200, r.status_code)

print()
print("FAILURES:", fails if fails else "none")
