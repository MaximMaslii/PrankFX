"""End-to-end Snap tests against the real FastAPI app.

MongoDB is in-memory (mongomock_motor), Decart / PixVerse / Gemini are
stubbed, and ffmpeg is the real binary — so the actual clip assembly, the
watermark and the FX accounting are all exercised.

    pip install mongomock_motor imageio-ffmpeg
    pytest tests_unit/test_snap_flow.py
"""
import base64
import io
import subprocess
from datetime import timedelta
from pathlib import Path

import httpx
import pytest


mongomock_motor = pytest.importorskip("mongomock_motor")


# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------


@pytest.fixture
def env(monkeypatch, tmp_path):
    import app.database as database
    import app.repositories.project_repository as project_repository
    import app.repositories.snap_repository as snap_repository
    import app.repositories.user_repository as user_repository
    import app.services.migration_service as migration_service
    import app.services.purchase_service as purchase_service
    from app.config import settings
    from app.services import snap_pipeline

    if not snap_pipeline.ffmpeg_available():
        pytest.skip("ffmpeg not available (pip install imageio-ffmpeg)")

    import uuid

    # mongomock shares its store between clients, so every test gets its own
    # database name.
    mock_db = mongomock_motor.AsyncMongoMockClient()[f"snap_{uuid.uuid4().hex}"]

    for module in (
        database,
        project_repository,
        snap_repository,
        user_repository,
        migration_service,
        purchase_service,
    ):
        monkeypatch.setattr(module, "db", mock_db)

    async def _ping():
        return "connected"

    monkeypatch.setattr(database, "ping_database", _ping)

    monkeypatch.setattr(settings, "SNAP_MEDIA_DIR", str(tmp_path / "snaps"))
    monkeypatch.setattr(settings, "FAL_KEY", "test-fal-key")
    monkeypatch.setattr(settings, "DECART_API_KEY", "test-decart-key")
    monkeypatch.setattr(settings, "SNAP_PHOTO_ENGINE", "lucy")
    monkeypatch.setattr(settings, "SNAP_PHOTO_FALLBACK", True)
    monkeypatch.setattr(settings, "SNAP_ENABLED_EFFECTS", "all")

    # No test may reach the real Decart API; tests that need Lucy to work
    # patch this again.
    from app.services.decart_service import DecartError, DecartService

    async def _decart_not_mocked(self, video_path, prompt, model=None):
        raise DecartError("decart not mocked in this test")

    monkeypatch.setattr(DecartService, "edit_video", _decart_not_mocked)

    from fastapi.testclient import TestClient

    from app.main import app

    from app.middleware import rate_limit

    # The limiter is process-wide; tests would share one budget otherwise.
    rate_limit._hits.clear()

    with TestClient(app) as client:
        yield client, mock_db, tmp_path


def _guest(client, device="device-snap-tests-1"):
    response = client.post("/api/auth/guest", json={"device_id": device})
    assert response.status_code == 200, response.text
    body = response.json()
    return {"Authorization": f"Bearer {body['token']}"}, body["user"]["user_id"]


# NB: mongomock's find_one_and_update(return_document=AFTER) re-applies the
# filter AFTER the update, so a reservation that brings the balance to exactly
# below the amount comes back as None there (real MongoDB returns the
# document). Tests therefore always leave at least 10 FX behind.
async def _set_fx(db, user_id, amount, premium=False):
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"fx_credits": amount, "is_premium": premium}},
    )


def _run(coro):
    import asyncio

    return asyncio.run(coro)


def _photo_b64(width=800, height=1000) -> str:
    from PIL import Image

    image = Image.new("RGB", (width, height), (120, 80, 200))
    out = io.BytesIO()
    image.save(out, format="JPEG")
    return base64.b64encode(out.getvalue()).decode()


def _make_clip(path: Path, width=720, height=1280, seconds=5, audio=False):
    from app.services.snap_pipeline import ffmpeg_path

    cmd = [
        ffmpeg_path(), "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", f"testsrc=size={width}x{height}:rate=30:duration={seconds}",
    ]
    if audio:
        cmd += ["-f", "lavfi", "-i", f"sine=frequency=440:duration={seconds}"]
    cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p"]
    if audio:
        cmd += ["-c:a", "aac", "-shortest"]
    cmd += [str(path)]
    subprocess.run(cmd, check=True)
    return path


def _balance(client, headers):
    return client.get("/api/subscription/fx/balance", headers=headers).json()["fx_credits"]


# --------------------------------------------------------------------------
# Catalog
# --------------------------------------------------------------------------


def test_catalog_has_fire_and_eight_photo_effects(env):
    client, _, _ = env

    body = client.get("/api/snap/effects").json()
    ids = [e["id"] for e in body["effects"]]

    assert ids[0] == "snap_fire"
    assert "snap_bruise" not in ids and "snap_zombie" not in ids

    photo = [e for e in body["effects"] if e["input"] == "photo"]
    assert len(photo) == 8
    assert all(e["engine"] == "lucy" and e["fx_cost"] == 10 for e in photo)
    assert body["fx_cost"] == 10


def test_prompts_fit_pixverse_byte_limit():
    from snap_effects import SNAP_EFFECTS, pixverse_prompt_for, PIXVERSE_NEGATIVE_PROMPT

    for effect in SNAP_EFFECTS:
        if effect["engine"] == "pixverse":
            assert len(pixverse_prompt_for(effect).encode()) < 2048
    assert len(PIXVERSE_NEGATIVE_PROMPT.encode()) < 2048


# --------------------------------------------------------------------------
# Photo Snaps
# --------------------------------------------------------------------------


def test_photo_snap_needs_ten_fx(env):
    client, _, _ = env
    headers, _ = _guest(client)

    response = client.post(
        "/api/snap/photo-jobs",
        headers=headers,
        json={"effect_id": "snap_portal", "image_base64": _photo_b64()},
    )

    assert response.status_code == 402
    assert _balance(client, headers) == 1  # nothing was taken


def test_photo_snap_happy_path(env, monkeypatch):
    client, db, tmp_path = env
    headers, user_id = _guest(client)
    _run(_set_fx(db, user_id, 25))

    clip = _make_clip(tmp_path / "pixverse.mp4", 720, 960)
    seen = {}

    async def fake_i2v(self, image_bytes, prompt, negative_prompt="", mime="image/jpeg"):
        seen["prompt"] = prompt
        seen["size"] = len(image_bytes)
        return clip.read_bytes()

    from app.config import settings
    from app.services.pixverse_service import PixverseService

    monkeypatch.setattr(settings, "SNAP_PHOTO_ENGINE", "pixverse")
    monkeypatch.setattr(PixverseService, "image_to_video", fake_i2v)

    response = client.post(
        "/api/snap/photo-jobs",
        headers=headers,
        json={
            "effect_id": "snap_liquid_metal",
            "image_base64": "data:image/jpeg;base64," + _photo_b64(),
        },
    )
    assert response.status_code == 202, response.text
    job = response.json()
    assert job["input"] == "photo"

    status = client.get(f"/api/snap/jobs/{job['job_id']}", headers=headers).json()
    assert status["status"] == "completed", status
    assert "mercury" in seen["prompt"]
    assert _balance(client, headers) == 15

    video = client.get(f"/api/snap/jobs/{job['job_id']}/video", headers=headers)
    assert video.status_code == 200 and len(video.content) > 1000

    poster = client.get(f"/api/snap/jobs/{job['job_id']}/poster", headers=headers)
    assert poster.status_code == 200 and poster.headers["content-type"] == "image/jpeg"

    # The source photo is deleted once the clip exists.
    job_dir = Path(tmp_path / "snaps" / job["job_id"])
    assert not (job_dir / "source.jpg").exists()

    listed = client.get("/api/snap/jobs", headers=headers).json()["items"]
    assert listed[0]["job_id"] == job["job_id"]


def test_photo_snap_failure_refunds_once(env, monkeypatch):
    client, db, _ = env
    headers, user_id = _guest(client)
    _run(_set_fx(db, user_id, 21))

    from app.services.pixverse_service import PixverseError, PixverseService

    async def boom(self, **kwargs):
        raise PixverseError("content policy")

    monkeypatch.setattr(PixverseService, "image_to_video", boom)

    response = client.post(
        "/api/snap/photo-jobs",
        headers=headers,
        json={"effect_id": "snap_origami", "image_base64": _photo_b64()},
    )
    assert response.status_code == 202, response.text
    job = response.json()

    status = client.get(f"/api/snap/jobs/{job['job_id']}", headers=headers).json()
    assert status["status"] == "failed"
    assert "content policy" in status["error"]
    assert _balance(client, headers) == 21

    # A second failure path must not pay out again.
    from app.routers.snap import snap_service

    stored = _run(db.snap_jobs.find_one({"job_id": job["job_id"]}, {"_id": 0}))
    _run(snap_service._fail(stored, "again"))
    assert _balance(client, headers) == 21


def test_wrong_input_kind_is_rejected(env):
    client, db, tmp_path = env
    headers, user_id = _guest(client)
    _run(_set_fx(db, user_id, 50))

    response = client.post(
        "/api/snap/photo-jobs",
        headers=headers,
        json={"effect_id": "snap_fire", "image_base64": _photo_b64()},
    )
    assert response.status_code == 400

    clip = _make_clip(tmp_path / "rec.mp4")
    with clip.open("rb") as handle:
        response = client.post(
            "/api/snap/jobs",
            headers=headers,
            data={"effect_id": "snap_portal"},
            files={"video": ("snap.mp4", handle, "video/mp4")},
        )
    assert response.status_code == 400
    assert _balance(client, headers) == 50


def test_bad_photo_is_rejected_before_charging(env):
    client, db, _ = env
    headers, user_id = _guest(client)
    _run(_set_fx(db, user_id, 10))

    response = client.post(
        "/api/snap/photo-jobs",
        headers=headers,
        json={"effect_id": "snap_portal", "image_base64": base64.b64encode(b"not an image at all").decode()},
    )
    assert response.status_code == 400
    assert _balance(client, headers) == 10


def test_stale_job_is_failed_and_refunded(env):
    client, db, _ = env
    headers, user_id = _guest(client)
    _run(_set_fx(db, user_id, 0))

    from app.utils.datetime import utc_now

    old = (utc_now() - timedelta(hours=2)).replace(tzinfo=None)

    _run(db.snap_jobs.insert_one({
        "job_id": "stale-1",
        "user_id": user_id,
        "effect_id": "snap_portal",
        "effect_name": "Portal",
        "status": "processing",
        "stage": "generating",
        "error": None,
        "fx_charged": 10,
        "refunded": False,
        "created_at": old,
        "updated_at": old,
    }))

    status = client.get("/api/snap/jobs/stale-1", headers=headers).json()
    assert status["status"] == "failed"
    assert _balance(client, headers) == 10

    client.get("/api/snap/jobs/stale-1", headers=headers)
    assert _balance(client, headers) == 10


# --------------------------------------------------------------------------
# The original recorded Snap, through the real ffmpeg pipeline
# --------------------------------------------------------------------------


def test_recorded_fire_snap_pipeline(env, monkeypatch):
    client, db, tmp_path = env
    headers, user_id = _guest(client)
    _run(_set_fx(db, user_id, 21))

    from app.services.decart_service import DecartService

    async def fake_edit(self, video_path, prompt, model=None):
        return Path(video_path).read_bytes()

    monkeypatch.setattr(DecartService, "edit_video", fake_edit)

    clip = _make_clip(tmp_path / "take.mp4", 1080, 1920, audio=True)

    with clip.open("rb") as handle:
        response = client.post(
            "/api/snap/jobs",
            headers=headers,
            data={"effect_id": "snap_fire"},
            files={"video": ("snap.mp4", handle, "video/mp4")},
        )

    assert response.status_code == 202, response.text
    job = response.json()

    status = client.get(f"/api/snap/jobs/{job['job_id']}", headers=headers).json()
    assert status["status"] == "completed", status
    assert _balance(client, headers) == 11


# --------------------------------------------------------------------------
# fal.ai queue protocol
# --------------------------------------------------------------------------


def test_pixverse_service_speaks_fal_queue(monkeypatch):
    from app.config import settings
    from app.services import pixverse_service

    monkeypatch.setattr(settings, "FAL_KEY", "k")
    monkeypatch.setattr(settings, "PIXVERSE_POLL_INTERVAL_SECONDS", 0.5)

    calls = {"status": 0}
    submitted = {}

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)

        if request.method == "POST":
            assert request.headers["authorization"] == "Key k"
            assert url == "https://queue.fal.run/fal-ai/pixverse/v5.5/image-to-video"
            import json

            submitted.update(json.loads(request.content))
            return httpx.Response(200, json={
                "request_id": "r1",
                "status_url": "https://queue.fal.run/fal-ai/pixverse/requests/r1/status",
                "response_url": "https://queue.fal.run/fal-ai/pixverse/requests/r1",
            })

        if url.endswith("/status"):
            calls["status"] += 1
            state = "IN_PROGRESS" if calls["status"] < 2 else "COMPLETED"
            return httpx.Response(200, json={"status": state})

        if url.endswith("/requests/r1"):
            return httpx.Response(200, json={"video": {"url": "https://v3.fal.media/out.mp4"}})

        if url == "https://v3.fal.media/out.mp4":
            assert "authorization" not in request.headers
            return httpx.Response(200, content=b"MP4DATA")

        return httpx.Response(404)

    real_client = httpx.AsyncClient

    def client_factory(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_client(*args, **kwargs)

    monkeypatch.setattr(pixverse_service.httpx, "AsyncClient", client_factory)

    result = _run(pixverse_service.PixverseService().image_to_video(b"jpeg", "prompt", "neg"))

    assert result == b"MP4DATA"
    assert submitted["resolution"] == "720p"
    assert submitted["duration"] == "5"
    assert submitted["image_url"].startswith("data:image/jpeg;base64,")
    assert submitted["generate_audio_switch"] is False


def test_pixverse_service_reports_model_errors(monkeypatch):
    from app.config import settings
    from app.services import pixverse_service

    monkeypatch.setattr(settings, "FAL_KEY", "k")

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if request.method == "POST":
            return httpx.Response(200, json={"request_id": "r2"})
        if url.endswith("/status"):
            return httpx.Response(200, json={"status": "COMPLETED"})
        return httpx.Response(422, json={"detail": [{"msg": "Image violates content policy"}]})

    real_client = httpx.AsyncClient

    def client_factory(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_client(*args, **kwargs)

    monkeypatch.setattr(pixverse_service.httpx, "AsyncClient", client_factory)

    with pytest.raises(pixverse_service.PixverseError, match="content policy"):
        _run(pixverse_service.PixverseService().image_to_video(b"jpeg", "p"))


# --------------------------------------------------------------------------
# Lucy 2.5 as the main photo engine
# --------------------------------------------------------------------------


def test_photo_snap_uses_lucy_first(env, monkeypatch):
    client, db, tmp_path = env
    headers, user_id = _guest(client)
    _run(_set_fx(db, user_id, 25))

    from app.services.decart_service import DecartService
    from app.services.pixverse_service import PixverseService

    seen = {}

    async def fake_lucy(self, video_path, prompt, model=None):
        seen["prompt"] = prompt
        seen["still"] = Path(video_path).stat().st_size
        return Path(video_path).read_bytes()  # the still clip, "edited"

    async def must_not_run(self, **kwargs):
        raise AssertionError("PixVerse must not run when Lucy succeeds")

    monkeypatch.setattr(DecartService, "edit_video", fake_lucy)
    monkeypatch.setattr(PixverseService, "image_to_video", must_not_run)

    assert client.get("/api/snap/effects").json()["effects"][1]["engine"] == "lucy"

    job = client.post(
        "/api/snap/photo-jobs",
        headers=headers,
        json={"effect_id": "snap_portal", "image_base64": _photo_b64()},
    ).json()

    status = client.get(f"/api/snap/jobs/{job['job_id']}", headers=headers).json()
    assert status["status"] == "completed", status
    assert "portal" in seen["prompt"] and seen["still"] > 0

    stored = _run(db.snap_jobs.find_one({"job_id": job["job_id"]}))
    assert stored["engine"] == "lucy"
    assert _balance(client, headers) == 15


def test_lucy_failure_falls_back_to_pixverse(env, monkeypatch, tmp_path):
    client, db, _ = env
    headers, user_id = _guest(client)
    _run(_set_fx(db, user_id, 25))

    from app.services.pixverse_service import PixverseService

    clip = _make_clip(tmp_path / "pv.mp4", 720, 960)

    async def fake_i2v(self, **kwargs):
        return clip.read_bytes()

    monkeypatch.setattr(PixverseService, "image_to_video", fake_i2v)

    job = client.post(
        "/api/snap/photo-jobs",
        headers=headers,
        json={"effect_id": "snap_origami", "image_base64": _photo_b64()},
    ).json()

    status = client.get(f"/api/snap/jobs/{job['job_id']}", headers=headers).json()
    assert status["status"] == "completed", status

    stored = _run(db.snap_jobs.find_one({"job_id": job["job_id"]}))
    assert stored["engine"] == "pixverse"


def test_no_fallback_means_refund(env, monkeypatch):
    client, db, _ = env
    headers, user_id = _guest(client)
    _run(_set_fx(db, user_id, 25))

    from app.config import settings

    monkeypatch.setattr(settings, "SNAP_PHOTO_FALLBACK", False)

    job = client.post(
        "/api/snap/photo-jobs",
        headers=headers,
        json={"effect_id": "snap_eraser", "image_base64": _photo_b64()},
    ).json()

    status = client.get(f"/api/snap/jobs/{job['job_id']}", headers=headers).json()
    assert status["status"] == "failed"
    assert "decart" in status["error"]
    assert _balance(client, headers) == 25


def test_catalog_carries_localised_copy(env):
    client, _, _ = env
    effects = client.get("/api/snap/effects").json()["effects"]

    for effect in effects:
        assert set(effect["title"]) == {"en", "ru", "de"}, effect["id"]
        assert set(effect["tagline"]) == {"en", "ru", "de"}, effect["id"]


def test_app_config_endpoint(env, monkeypatch):
    client, _, _ = env

    from app.config import settings

    monkeypatch.setattr(settings, "APP_MIN_VERSION", "1.2.0")
    monkeypatch.setattr(settings, "APP_MAINTENANCE", True)
    monkeypatch.setattr(settings, "APP_MAINTENANCE_MESSAGE_RU", "Скоро вернёмся")

    body = client.get("/api/app/config").json()

    assert body["min_version"] == "1.2.0"
    assert body["maintenance"] is True
    assert body["maintenance_message"]["ru"] == "Скоро вернёмся"
    assert client.get("/api/health").json()["photo_engines"] == ["lucy", "pixverse"]


def test_missing_fal_key_lets_lucy_stand_in(env, monkeypatch):
    client, _, _ = env

    from app.config import settings

    monkeypatch.setattr(settings, "SNAP_PHOTO_ENGINE", "pixverse")
    monkeypatch.setattr(settings, "SNAP_PHOTO_FALLBACK", False)
    monkeypatch.setattr(settings, "FAL_KEY", "")

    assert client.get("/api/health").json()["photo_engines"] == ["lucy"]

    monkeypatch.setattr(settings, "FAL_KEY", "k")
    assert client.get("/api/health").json()["photo_engines"] == ["pixverse"]


def test_coming_soon_effects_are_listed_but_refused(env, monkeypatch):
    client, db, _ = env
    headers, user_id = _guest(client)
    _run(_set_fx(db, user_id, 25))

    from app.config import settings

    monkeypatch.setattr(settings, "SNAP_ENABLED_EFFECTS", "snap_fire")

    effects = client.get("/api/snap/effects").json()["effects"]
    assert effects[0]["id"] == "snap_fire" and effects[0]["coming_soon"] is False
    assert all(e["coming_soon"] for e in effects[1:])
    assert len(effects) == 9

    r = client.post(
        "/api/snap/photo-jobs",
        headers=headers,
        json={"effect_id": "snap_portal", "image_base64": _photo_b64()},
    )
    assert r.status_code == 400 and "coming soon" in r.json()["detail"]
    assert _balance(client, headers) == 25
