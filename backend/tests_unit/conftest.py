"""
Offline unit tests — no running server, no real MongoDB, no network.

MongoDB is replaced with an in-memory mock and Google's token verification is
stubbed, so these run anywhere with `pytest`.
"""

import os
import sys
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "prankfx_unit_tests")
os.environ.setdefault("JWT_SECRET", "unit-test-secret-that-is-long-enough-for-hs256")
os.environ.setdefault("GEMINI_API_KEY", "unit-test")


@pytest.fixture
def auth_service(monkeypatch):
    """An AuthService wired to an in-memory database with Google stubbed out."""
    mongomock_motor = pytest.importorskip(
        "mongomock_motor",
        reason="pip install mongomock_motor to run the offline unit tests",
    )

    import app.database as database
    import app.repositories.user_repository as user_repository
    import app.services.auth_service as auth_module

    mock_client = mongomock_motor.AsyncMongoMockClient()
    mock_db = mock_client["prankfx_unit_tests"]

    monkeypatch.setattr(database, "db", mock_db)
    monkeypatch.setattr(user_repository, "db", mock_db)

    # Registry of fake ID tokens -> claims, filled in by each test.
    claims_by_token: dict[str, dict] = {}

    def fake_verify(token, request, audience=None, clock_skew_in_seconds=0):
        if token not in claims_by_token:
            raise ValueError("Invalid token signature")
        return claims_by_token[token]

    monkeypatch.setattr(
        auth_module.google_id_token,
        "verify_oauth2_token",
        fake_verify,
    )

    service = auth_module.AuthService()
    service._test_tokens = claims_by_token  # type: ignore[attr-defined]

    return service
