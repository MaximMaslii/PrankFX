"""PrankFX / FX Vision AI backend server."""
import os
import uuid
import base64
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal

import bcrypt
import jwt as pyjwt
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

from effects import get_effect_by_id, get_public_catalog, CATEGORIES

# --- Setup ---
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("prankfx")

app = FastAPI(title="PrankFX API")
api = APIRouter(prefix="/api")


# --- Utilities ---
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def ensure_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def make_user_id() -> str:
    return f"user_{uuid.uuid4().hex[:12]}"


def make_project_id() -> str:
    return f"proj_{uuid.uuid4().hex[:16]}"


def make_session_token() -> str:
    return uuid.uuid4().hex + uuid.uuid4().hex


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_jwt(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "iat": int(now_utc().timestamp()),
        "exp": int((now_utc() + timedelta(days=30)).timestamp()),
        "type": "jwt",
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# --- Models ---
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class GoogleSessionIn(BaseModel):
    session_id: str


class UserOut(BaseModel):
    user_id: str
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    provider: str
    is_premium: bool = False
    premium_tier: Optional[str] = None
    created_at: datetime


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class GenerateIn(BaseModel):
    image_base64: str  # raw base64 (no data: prefix)
    effect_id: str
    save_to_history: bool = True


class ProjectOut(BaseModel):
    project_id: str
    effect_id: str
    effect_name: str
    category: str
    original_image: str  # base64
    result_image: str    # base64
    is_favorite: bool
    created_at: datetime


class ProjectListItem(BaseModel):
    project_id: str
    effect_id: str
    effect_name: str
    category: str
    thumbnail: str  # base64 of result
    is_favorite: bool
    created_at: datetime


class SetFavoriteIn(BaseModel):
    is_favorite: bool


class MockSubscribeIn(BaseModel):
    tier: Literal["face_effects", "ultimate"]
    interval: Literal["month", "year"] = "month"


# --- Auth dependency ---
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()

    # 1) Try JWT (email/password auth)
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if user_id:
            user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
            if user:
                return user
    except pyjwt.PyJWTError:
        pass

    # 2) Try Emergent Google session token
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if session:
        exp = ensure_aware(session["expires_at"])
        if exp > now_utc():
            user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
            if user:
                return user

    raise HTTPException(status_code=401, detail="Invalid or expired token")


def user_to_out(u: dict) -> UserOut:
    return UserOut(
        user_id=u["user_id"],
        email=u["email"],
        name=u.get("name"),
        picture=u.get("picture"),
        provider=u.get("provider", "email"),
        is_premium=bool(u.get("is_premium", False)),
        premium_tier=u.get("premium_tier"),
        created_at=ensure_aware(u.get("created_at", now_utc())),
    )


# --- Startup: indexes & seed ---
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.projects.create_index([("user_id", 1), ("created_at", -1)])
    logger.info("PrankFX backend started")


@app.on_event("shutdown")
async def shutdown():
    client.close()


# --- Health ---
@api.get("/")
async def root():
    return {"service": "PrankFX API", "status": "ok"}


# --- Auth: Email / Password ---
@api.post("/auth/register", response_model=AuthResponse)
async def register(body: RegisterIn):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = make_user_id()
    doc = {
        "user_id": user_id,
        "email": email,
        "name": body.name or email.split("@")[0],
        "picture": None,
        "provider": "email",
        "password_hash": hash_password(body.password),
        "is_premium": False,
        "premium_tier": None,
        "created_at": now_utc(),
    }
    await db.users.insert_one(doc)
    token = create_jwt(user_id)
    return AuthResponse(token=token, user=user_to_out(doc))


@api.post("/auth/login", response_model=AuthResponse)
async def login(body: LoginIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or user.get("provider") != "email" or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_jwt(user["user_id"])
    return AuthResponse(token=token, user=user_to_out(user))


@api.post("/auth/forgot")
async def forgot(body: ForgotIn):
    # Preview stub: never leak whether the account exists.
    logger.info(f"Forgot password requested for {body.email}")
    return {"ok": True, "message": "If the account exists, reset instructions have been sent."}


# --- Auth: Emergent Google Session ---
@api.post("/auth/google/session", response_model=AuthResponse)
async def google_session(body: GoogleSessionIn):
    async with httpx.AsyncClient(timeout=15.0) as http:
        try:
            r = await http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": body.session_id},
            )
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Auth provider unreachable: {e}")
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google session")
    data = r.json()
    email = (data.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="No email in session")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name") or existing.get("name"),
                       "picture": data.get("picture") or existing.get("picture")}},
        )
        user_doc = {**existing, "name": data.get("name") or existing.get("name"),
                    "picture": data.get("picture") or existing.get("picture")}
    else:
        user_id = make_user_id()
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": data.get("name") or email.split("@")[0],
            "picture": data.get("picture"),
            "provider": "google",
            "password_hash": None,
            "is_premium": False,
            "premium_tier": None,
            "created_at": now_utc(),
        }
        await db.users.insert_one(user_doc)

    session_token = data.get("session_token") or make_session_token()
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": now_utc(),
        "expires_at": now_utc() + timedelta(days=7),
    })
    return AuthResponse(token=session_token, user=user_to_out(user_doc))


@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return user_to_out(user)


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


@api.delete("/auth/account")
async def delete_account(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    await db.projects.delete_many({"user_id": uid})
    await db.user_sessions.delete_many({"user_id": uid})
    await db.users.delete_one({"user_id": uid})
    return {"ok": True}


# --- Effects catalog ---
@api.get("/effects")
async def effects_catalog():
    return {"categories": get_public_catalog()}


# --- AI Generation via Nano Banana ---
async def _run_nano_banana(image_base64: str, prompt: str) -> str:
    """Run Gemini Nano Banana. Returns base64 of the generated image."""
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"prankfx-{uuid.uuid4().hex[:8]}",
        system_message=(
            "You are a Hollywood-grade VFX artist that edits photos with "
            "photorealistic cinematic effects. You always preserve the subject's "
            "identity, pose, background, camera angle and lighting. Only apply "
            "the requested effect. This is fictional and for entertainment."
        ),
    ).with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])

    msg = UserMessage(text=prompt, file_contents=[ImageContent(image_base64)])
    _, images = await chat.send_message_multimodal_response(msg)
    if not images:
        raise HTTPException(status_code=502, detail="AI did not return an image")
    return images[0]["data"]


def _is_effect_allowed(effect_premium_tier: str, user: dict) -> bool:
    """Face effects require face_effects tier or ultimate. Vehicle/House/Object require ultimate."""
    tier = user.get("premium_tier")
    if effect_premium_tier == "face_effects":
        return tier in ("face_effects", "ultimate")
    if effect_premium_tier == "ultimate":
        return tier == "ultimate"
    return True


@api.post("/generate", response_model=ProjectOut)
async def generate(body: GenerateIn, user: dict = Depends(get_current_user)):
    effect = get_effect_by_id(body.effect_id)
    if not effect:
        raise HTTPException(status_code=404, detail="Unknown effect")

    if not _is_effect_allowed(effect["premium_tier"], user):
        raise HTTPException(status_code=402, detail=f"Premium required: {effect['premium_tier']}")

    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI key not configured")

    # Strip data URI prefix if present
    img_b64 = body.image_base64
    if img_b64.startswith("data:"):
        img_b64 = img_b64.split(",", 1)[-1]

    try:
        result_b64 = await _run_nano_banana(img_b64, effect["prompt"])
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Nano banana failure")
        raise HTTPException(status_code=502, detail=f"AI generation failed: {e}")

    project_id = make_project_id()
    doc = {
        "project_id": project_id,
        "user_id": user["user_id"],
        "effect_id": effect["id"],
        "effect_name": effect["name"],
        "category": effect["category"],
        "original_image": img_b64,
        "result_image": result_b64,
        "is_favorite": False,
        "created_at": now_utc(),
    }
    if body.save_to_history:
        await db.projects.insert_one(dict(doc))
    return ProjectOut(**{k: v for k, v in doc.items() if k != "user_id"})


# --- Projects / History ---
@api.get("/projects")
async def list_projects(
    user: dict = Depends(get_current_user),
    favorites: bool = Query(False),
    search: Optional[str] = Query(None),
    limit: int = Query(100, le=200),
):
    q: dict = {"user_id": user["user_id"]}
    if favorites:
        q["is_favorite"] = True
    if search:
        q["effect_name"] = {"$regex": search, "$options": "i"}

    docs = await db.projects.find(
        q, {"_id": 0, "original_image": 0}
    ).sort("created_at", -1).to_list(limit)

    items = [
        ProjectListItem(
            project_id=d["project_id"],
            effect_id=d["effect_id"],
            effect_name=d["effect_name"],
            category=d["category"],
            thumbnail=d["result_image"],
            is_favorite=bool(d.get("is_favorite", False)),
            created_at=ensure_aware(d["created_at"]),
        )
        for d in docs
    ]
    return {"items": items}


@api.get("/projects/{project_id}", response_model=ProjectOut)
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    d = await db.projects.find_one(
        {"project_id": project_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not d:
        raise HTTPException(status_code=404, detail="Not found")
    return ProjectOut(
        project_id=d["project_id"], effect_id=d["effect_id"],
        effect_name=d["effect_name"], category=d["category"],
        original_image=d["original_image"], result_image=d["result_image"],
        is_favorite=bool(d.get("is_favorite", False)),
        created_at=ensure_aware(d["created_at"]),
    )


@api.patch("/projects/{project_id}/favorite")
async def set_favorite(project_id: str, body: SetFavoriteIn, user: dict = Depends(get_current_user)):
    r = await db.projects.update_one(
        {"project_id": project_id, "user_id": user["user_id"]},
        {"$set": {"is_favorite": body.is_favorite}},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True, "is_favorite": body.is_favorite}


@api.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(get_current_user)):
    r = await db.projects.delete_one({"project_id": project_id, "user_id": user["user_id"]})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# --- Subscription (Mock for preview) ---
@api.post("/subscription/mock-activate")
async def mock_activate(body: MockSubscribeIn, user: dict = Depends(get_current_user)):
    """Preview-only mock activation. Real production uses Stripe checkout."""
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "is_premium": True,
            "premium_tier": body.tier,
            "premium_interval": body.interval,
            "premium_activated_at": now_utc(),
        }},
    )
    return {"ok": True, "tier": body.tier, "interval": body.interval}


@api.post("/subscription/restore")
async def restore(user: dict = Depends(get_current_user)):
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return {"is_premium": bool(fresh.get("is_premium")), "premium_tier": fresh.get("premium_tier")}


@api.post("/subscription/cancel")
async def cancel(user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"is_premium": False, "premium_tier": None}},
    )
    return {"ok": True}


# Include router and CORS
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
