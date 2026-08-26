"""Shared fixtures for PrankFX backend tests."""
import os
import io
import base64
import time
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv
from PIL import Image

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").strip().rstrip("/")
)

if not BASE_URL:
    # Fallback to frontend .env
    project_root = Path(__file__).resolve().parents[2]
    fe_env = project_root / "frontend" / ".env"

    if fe_env.exists():
        for line in fe_env.read_text(encoding="utf-8").splitlines():
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = (
                    line.split("=", 1)[1]
                    .strip()
                    .strip('"')
                    .strip("'")
                    .rstrip("/")
                )
                break

if not BASE_URL:
    raise RuntimeError(
        "EXPO_PUBLIC_BACKEND_URL is not configured. "
        "Set it in backend/.env or frontend/.env."
    )

API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_url():
    return API


@pytest.fixture()
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def demo_credentials():
    return {"email": "demo@prankfx.app", "password": "demo1234"}


@pytest.fixture(scope="session")
def demo_token(demo_credentials):
    r = requests.post(f"{API}/auth/login", json=demo_credentials, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"demo login failed: {r.status_code} {r.text}")
    return r.json()["token"]


@pytest.fixture(scope="session")
def unique_email():
    return f"test_user_{int(time.time()*1000)}@prankfxtest.com"


@pytest.fixture(scope="session")
def small_image_b64():
    """Generate a tiny in-memory PNG (~a few KB) as base64 - enough for AI test."""
    img = Image.new("RGB", (256, 256), (200, 160, 140))
    # Add a simple face-like pattern
    for x in range(60, 100):
        for y in range(80, 120):
            img.putpixel((x, y), (30, 30, 30))
    for x in range(156, 196):
        for y in range(80, 120):
            img.putpixel((x, y), (30, 30, 30))
    for x in range(100, 156):
        for y in range(160, 175):
            img.putpixel((x, y), (60, 20, 20))
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode("utf-8")
