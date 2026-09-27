"""Sign in with Apple on Android (web flow) — the two redirect endpoints."""
from urllib.parse import parse_qs, urlparse

import pytest


@pytest.fixture
def client(monkeypatch):
    from fastapi.testclient import TestClient

    from app.config import settings
    from app.main import app

    monkeypatch.setattr(settings, "APPLE_SERVICE_ID", "com.prankfx.app.signin")
    monkeypatch.setattr(settings, "APPLE_REDIRECT_URI", "https://api.example.com/api/auth/apple/callback")

    # No lifespan: these endpoints never touch the database.
    return TestClient(app)


def test_start_redirects_to_apple(client):
    r = client.get("/api/auth/apple/start?state=abc123", follow_redirects=False)
    assert r.status_code in (302, 307)

    url = urlparse(r.headers["location"])
    q = parse_qs(url.query)

    assert url.netloc == "appleid.apple.com"
    assert q["client_id"] == ["com.prankfx.app.signin"]
    assert q["redirect_uri"] == ["https://api.example.com/api/auth/apple/callback"]
    assert q["response_mode"] == ["form_post"]
    assert q["state"] == ["abc123"]


def test_start_is_503_when_not_configured(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "APPLE_SERVICE_ID", "")
    assert client.get("/api/auth/apple/start", follow_redirects=False).status_code == 503


def test_callback_hands_token_back_to_the_app(client):
    r = client.post(
        "/api/auth/apple/callback",
        data={
            "id_token": "header.payload.sig",
            "state": "abc123",
            "user": '{"name":{"firstName":"Maxim","lastName":"M"},"email":"x@y.z"}',
        },
        follow_redirects=False,
    )
    assert r.status_code == 303

    url = urlparse(r.headers["location"])
    q = parse_qs(url.query)

    assert url.scheme == "prankfx" and url.netloc == "apple-callback"
    assert q["id_token"] == ["header.payload.sig"]
    assert q["state"] == ["abc123"]
    assert q["name"] == ["Maxim M"]


def test_callback_reports_cancel(client):
    r = client.post(
        "/api/auth/apple/callback",
        data={"error": "user_cancelled_authorize", "state": "s"},
        follow_redirects=False,
    )
    q = parse_qs(urlparse(r.headers["location"]).query)
    assert q["error"] == ["user_cancelled_authorize"]
    assert "id_token" not in q


def test_service_id_is_an_accepted_audience(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "APPLE_SERVICE_ID", "com.prankfx.app.signin")
    assert "com.prankfx.app.signin" in settings.apple_client_ids
    assert "com.prankfx.app" in settings.apple_client_ids
