"""Orchestration for Snap jobs.

A Snap takes tens of seconds — far too long for a request/response cycle on a
phone, so the API hands back a job id immediately and the app polls. The job
document in Mongo is the single source of truth for progress and for the FX
refund on failure.
"""
import base64
import binascii
import io
import logging
import shutil
import tempfile
from datetime import timedelta
from pathlib import Path

from app.repositories.snap_repository import SnapRepository
from app.repositories.user_repository import UserRepository
from app.config import settings
from app.services import snap_pipeline
from app.services.decart_service import DecartError, DecartService
from app.services.pixverse_service import PixverseError, PixverseService
from app.utils.datetime import utc_now
from app.utils.ids import generate_project_id
from snap_effects import (
    ENGINE_LUCY,
    ENGINE_PIXVERSE,
    INPUT_PHOTO,
    INPUT_VIDEO,
    PIXVERSE_NEGATIVE_PROMPT,
    SNAP_TAIL_SECONDS,
    get_snap_catalog,
    get_snap_effect_by_id,
    pixverse_prompt_for,
)


logger = logging.getLogger("prankfx.snap")


STATUS_QUEUED = "queued"
STATUS_PROCESSING = "processing"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"

# Photos are shrunk to this before they go to PixVerse. The model renders
# 720p anyway; a 12-megapixel original only makes the upload slower.
PHOTO_MAX_SIDE = 1536


class SnapService:

    def __init__(self):
        self.jobs = SnapRepository()
        self.users = UserRepository()
        self.decart = DecartService()
        self.pixverse = PixverseService()

    # ------------------------------------------------------------------
    # Catalog
    # ------------------------------------------------------------------

    def catalog(self) -> list[dict]:
        engines = self.photo_engines()
        return get_snap_catalog(
            settings.SNAP_FX_COST,
            engines[0] if engines else _normalise_engine(settings.SNAP_PHOTO_ENGINE),
            settings.snap_enabled_effects,
        )

    @staticmethod
    def _ensure_enabled(effect: dict) -> None:
        enabled = settings.snap_enabled_effects
        if enabled is not None and effect["id"] not in enabled:
            raise ValueError("This effect is coming soon")

    # ------------------------------------------------------------------
    # Photo engines
    # ------------------------------------------------------------------

    def _engine_ready(self, engine: str) -> bool:
        if engine == ENGINE_LUCY:
            # Lucy edits video, so the photo has to become a clip first.
            return bool(settings.DECART_API_KEY) and snap_pipeline.ffmpeg_available()
        if engine == ENGINE_PIXVERSE:
            return self.pixverse.configured()
        return False

    def photo_engines(self) -> list[str]:
        """Engines to try for a photo Snap, main one first, ready ones only."""
        primary = _normalise_engine(settings.SNAP_PHOTO_ENGINE)
        secondary = ENGINE_PIXVERSE if primary == ENGINE_LUCY else ENGINE_LUCY

        order = [primary]

        # The other engine is tried after a FAILURE only when fallback is on —
        # but if the main one is not set up at all (no key yet), the other one
        # stands in, so photo Snaps keep working while keys are being added.
        if settings.SNAP_PHOTO_FALLBACK or not self._engine_ready(primary):
            order.append(secondary)

        return [e for e in order if self._engine_ready(e)]

    # ------------------------------------------------------------------
    # Job creation
    # ------------------------------------------------------------------

    async def create_job(
        self,
        user_id: str,
        effect_id: str,
        video_bytes: bytes,
    ) -> dict:

        effect = get_snap_effect_by_id(effect_id)

        if not effect:
            raise ValueError("Snap effect not found")

        self._ensure_enabled(effect)

        if effect.get("input", INPUT_VIDEO) != INPUT_VIDEO:
            raise ValueError("This effect is made from a photo, not a recording")

        if not video_bytes:
            raise ValueError("The uploaded clip is empty")

        if len(video_bytes) > settings.SNAP_MAX_UPLOAD_BYTES:
            raise ValueError(
                "The clip is too large — record it again at a lower quality"
            )

        if not snap_pipeline.ffmpeg_available():
            raise RuntimeError(
                "ffmpeg was not found on the server, so Snap clips cannot be "
                "assembled. Install it (Windows: winget install Gyan.FFmpeg) "
                "or set FFMPEG_BIN in backend/.env, then restart the backend."
            )

        if not settings.DECART_API_KEY:
            raise RuntimeError(
                "DECART_API_KEY is not set. Add it to backend/.env."
            )

        # Reserve the credits BEFORE any work starts, atomically. A refund
        # happens on every failure path below.
        reserved = await self.users.reserve_fx_credits(
            user_id,
            settings.SNAP_FX_COST,
        )

        if not reserved:
            raise PermissionError("Not enough FX credits")

        job_id = generate_project_id()

        source_path = self._job_dir(job_id) / "source.mp4"
        source_path.parent.mkdir(parents=True, exist_ok=True)
        source_path.write_bytes(video_bytes)

        document = {
            "job_id": job_id,
            "user_id": user_id,
            "effect_id": effect["id"],
            "effect_name": effect["name"],
            "status": STATUS_QUEUED,
            "stage": "queued",
            "error": None,
            "fx_charged": settings.SNAP_FX_COST,
            "refunded": False,
            "created_at": utc_now(),
            "updated_at": utc_now(),
        }

        await self.jobs.create(document)

        return self._public(document)

    async def create_photo_job(
        self,
        user_id: str,
        effect_id: str,
        image_base64: str,
    ) -> dict:
        """A Snap made from one photo, animated by PixVerse."""

        effect = get_snap_effect_by_id(effect_id)

        if not effect:
            raise ValueError("Snap effect not found")

        self._ensure_enabled(effect)

        if effect.get("input") != INPUT_PHOTO:
            raise ValueError("This effect needs a recording, not a photo")

        raw = _decode_base64(image_base64)

        if not raw:
            raise ValueError("The photo is empty")

        if len(raw) > settings.SNAP_MAX_PHOTO_BYTES:
            raise ValueError("The photo is too large")

        photo = _prepare_photo(raw)

        if not self.photo_engines():
            raise RuntimeError(
                "No video engine is ready for photo Snaps. Set DECART_API_KEY "
                "(and install ffmpeg) for Lucy, or FAL_KEY for PixVerse, in "
                "backend/.env."
            )

        reserved = await self.users.reserve_fx_credits(
            user_id,
            settings.SNAP_FX_COST,
        )

        if not reserved:
            raise PermissionError("Not enough FX credits")

        job_id = generate_project_id()

        source_path = self._job_dir(job_id) / "source.jpg"
        source_path.parent.mkdir(parents=True, exist_ok=True)
        source_path.write_bytes(photo)

        document = {
            "job_id": job_id,
            "user_id": user_id,
            "effect_id": effect["id"],
            "effect_name": effect["name"],
            "input": INPUT_PHOTO,
            "status": STATUS_QUEUED,
            "stage": "queued",
            "error": None,
            "fx_charged": settings.SNAP_FX_COST,
            "refunded": False,
            "created_at": utc_now(),
            "updated_at": utc_now(),
        }

        await self.jobs.create(document)

        return self._public(document)

    # ------------------------------------------------------------------
    # Worker
    # ------------------------------------------------------------------

    async def process_job(self, job_id: str) -> None:
        """Run the whole pipeline. Never raises — failures land on the job."""

        job = await self.jobs.get(job_id)

        if not job:
            logger.warning("Snap job %s vanished before processing", job_id)
            return

        effect = get_snap_effect_by_id(job["effect_id"])

        if not effect:
            await self._fail(job, "Snap effect not found")
            return

        if effect.get("input") == INPUT_PHOTO:
            await self._process_photo_job(job, effect)
            return

        job_dir = self._job_dir(job_id)
        source = job_dir / "source.mp4"

        if not source.is_file():
            await self._fail(job, "The recording was lost before processing")
            return

        work_dir = Path(tempfile.mkdtemp(prefix=f"snap_{job_id}_"))

        try:
            await self._set_stage(job_id, STATUS_PROCESSING, "cutting")

            seg_a, seg_b = await snap_pipeline.split_clip(source, work_dir)

            await self._set_stage(job_id, STATUS_PROCESSING, "generating")

            fx_bytes = await self.decart.edit_video(
                video_path=seg_b,
                prompt=effect["lucy_prompt"],
            )

            seg_b_fx = work_dir / "seg_b_fx.mp4"
            seg_b_fx.write_bytes(fx_bytes)

            await self._set_stage(job_id, STATUS_PROCESSING, "assembling")

            tail = await snap_pipeline.build_frozen_tail(seg_a, work_dir)

            # Premium buys a clean clip — the paywall says so in as many
            # words. Everyone else exports the mark, which is the only free
            # distribution this app gets.
            owner = await self.users.get_by_user_id(job["user_id"])

            watermark = not bool((owner or {}).get("is_premium"))

            video_only = await snap_pipeline.assemble_video(
                seg_a=seg_a,
                seg_b_fx=seg_b_fx,
                tail=tail,
                work_dir=work_dir,
                xfade_duration=settings.SNAP_XFADE_SECONDS or SNAP_TAIL_SECONDS,
                watermark=watermark,
            )

            result = job_dir / "result.mp4"

            await snap_pipeline.mix_audio(
                video_only=video_only,
                source=source,
                work_dir=work_dir,
                destination=result,
            )

            await snap_pipeline.build_poster(result, job_dir / "poster.jpg")

            await self.jobs.update(
                job_id,
                {
                    "status": STATUS_COMPLETED,
                    "stage": "done",
                    "error": None,
                    "updated_at": utc_now(),
                },
            )

            logger.info("Snap job %s completed", job_id)

        except DecartError as e:
            await self._fail(job, str(e))

        except snap_pipeline.FFmpegError as e:
            await self._fail(job, str(e))

        except Exception as e:
            logger.exception("Snap job %s crashed", job_id)

            # Some exceptions carry no message at all (NotImplementedError, for
            # one), and "Unexpected error:" with nothing after the colon tells
            # nobody anything — keep the class name in that case.
            detail = str(e).strip() or type(e).__name__

            await self._fail(job, f"Unexpected error: {detail}")

        finally:
            shutil.rmtree(work_dir, ignore_errors=True)

            # The raw recording is only needed for the pipeline itself.
            source.unlink(missing_ok=True)

    async def _process_photo_job(self, job: dict, effect: dict) -> None:
        job_id = job["job_id"]
        job_dir = self._job_dir(job_id)
        source = job_dir / "source.jpg"

        if not source.is_file():
            await self._fail(job, "The photo was lost before processing")
            return

        work_dir = Path(tempfile.mkdtemp(prefix=f"snap_{job_id}_"))

        try:
            await self._set_stage(job_id, STATUS_PROCESSING, "generating")

            clip, engine = await self._animate_photo(source, effect, work_dir)

            await self.jobs.update(job_id, {"engine": engine})

            raw = work_dir / "generated.mp4"
            raw.write_bytes(clip)

            await self._set_stage(job_id, STATUS_PROCESSING, "assembling")

            owner = await self.users.get_by_user_id(job["user_id"])
            watermark = not bool((owner or {}).get("is_premium"))

            result = job_dir / "result.mp4"

            await snap_pipeline.finish_photo_clip(
                raw=raw,
                destination=result,
                watermark=watermark,
            )

            # Halfway in, the transformation is under way — a far better
            # thumbnail than the untouched photo it starts from.
            await snap_pipeline.build_poster(
                result, job_dir / "poster.jpg", at_seconds=2.5,
            )

            await self.jobs.update(
                job_id,
                {
                    "status": STATUS_COMPLETED,
                    "stage": "done",
                    "error": None,
                    "updated_at": utc_now(),
                },
            )

            logger.info("Photo snap job %s completed", job_id)

        except (PixverseError, DecartError) as e:
            await self._fail(job, str(e))

        except snap_pipeline.FFmpegError as e:
            await self._fail(job, str(e))

        except Exception as e:
            logger.exception("Photo snap job %s crashed", job_id)
            detail = str(e).strip() or type(e).__name__
            await self._fail(job, f"Unexpected error: {detail}")

        finally:
            shutil.rmtree(work_dir, ignore_errors=True)
            # The face in the photo is only needed for the generation itself.
            source.unlink(missing_ok=True)

    async def _animate_photo(
        self,
        source: Path,
        effect: dict,
        work_dir: Path,
    ) -> tuple[bytes, str]:
        """Run the photo through the main engine, falling back if it fails.

        Returns (mp4 bytes, engine that made them). Raises the LAST engine's
        error when every one failed — the job is then refunded.
        """
        engines = self.photo_engines()

        if not engines:
            raise PixverseError("No video engine is configured on the server")

        last_error: Exception | None = None

        for engine in engines:
            try:
                if engine == ENGINE_LUCY:
                    still = await snap_pipeline.photo_to_clip(source, work_dir)
                    clip = await self.decart.edit_video(
                        video_path=still,
                        prompt=effect.get("lucy_prompt") or pixverse_prompt_for(effect),
                    )
                else:
                    clip = await self.pixverse.image_to_video(
                        image_bytes=source.read_bytes(),
                        prompt=pixverse_prompt_for(effect),
                        negative_prompt=PIXVERSE_NEGATIVE_PROMPT,
                    )

                return clip, engine

            except (DecartError, PixverseError, snap_pipeline.FFmpegError) as e:
                last_error = e
                logger.warning(
                    "Photo engine %s failed for %s: %s", engine, effect["id"], e,
                )

        assert last_error is not None
        raise last_error

    # ------------------------------------------------------------------
    # Stale jobs
    #
    # Work runs as a FastAPI background task, i.e. inside the server process.
    # Restart the server mid-clip and the task is simply gone: the job sat in
    # "processing" forever and its 10 FX were never returned. Anything silent
    # for longer than any real job can take is failed and refunded — at
    # startup, and whenever the app asks about it.
    # ------------------------------------------------------------------

    def _stale_cutoff(self):
        return utc_now() - timedelta(minutes=settings.SNAP_STALE_JOB_MINUTES)

    def _is_stale(self, job: dict) -> bool:
        if job.get("status") not in (STATUS_QUEUED, STATUS_PROCESSING):
            return False

        updated = job.get("updated_at") or job.get("created_at")

        if updated is None:
            return False

        cutoff = self._stale_cutoff()

        # Mongo hands datetimes back naive (UTC); compare like with like.
        if updated.tzinfo is None and cutoff.tzinfo is not None:
            cutoff = cutoff.replace(tzinfo=None)

        return updated < cutoff

    async def recover_stale_jobs(self) -> int:
        cutoff = self._stale_cutoff().replace(tzinfo=None)

        count = 0

        for job in await self.jobs.list_unfinished_before(cutoff):
            await self._fail(
                job,
                "Processing was interrupted by a server restart",
            )
            count += 1

        if count:
            logger.warning("Failed and refunded %d interrupted Snap job(s)", count)

        return count

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------

    async def get_job(self, user_id: str, job_id: str) -> dict:
        job = await self.jobs.get(job_id)

        if not job or job["user_id"] != user_id:
            raise ValueError("Snap not found")

        if self._is_stale(job):
            await self._fail(job, "Processing was interrupted — please try again")
            job = await self.jobs.get(job_id) or job

        return self._public(job)

    async def list_jobs(self, user_id: str, limit: int = 30) -> list[dict]:
        jobs = await self.jobs.list_for_user(user_id, limit=limit)
        return [self._public(job) for job in jobs]

    async def result_path(self, user_id: str, job_id: str) -> Path:
        job = await self.jobs.get(job_id)

        if not job or job["user_id"] != user_id:
            raise ValueError("Snap not found")

        if job["status"] != STATUS_COMPLETED:
            raise ValueError("This Snap is not ready yet")

        path = self._job_dir(job_id) / "result.mp4"

        if not path.is_file():
            raise ValueError("The finished clip is no longer on the server")

        return path

    async def poster_path(self, user_id: str, job_id: str) -> Path:
        job = await self.jobs.get(job_id)

        if not job or job["user_id"] != user_id:
            raise ValueError("Snap not found")

        path = self._job_dir(job_id) / "poster.jpg"

        if not path.is_file():
            raise ValueError("No poster for this Snap")

        return path

    async def delete_job(self, user_id: str, job_id: str) -> None:
        job = await self.jobs.get(job_id)

        if not job or job["user_id"] != user_id:
            raise ValueError("Snap not found")

        await self.jobs.delete(job_id)

        shutil.rmtree(self._job_dir(job_id), ignore_errors=True)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    @staticmethod
    def _job_dir(job_id: str) -> Path:
        return Path(settings.snap_media_dir) / job_id

    async def _set_stage(self, job_id: str, status: str, stage: str) -> None:
        await self.jobs.update(
            job_id,
            {
                "status": status,
                "stage": stage,
                "updated_at": utc_now(),
            },
        )

    async def _fail(self, job: dict, message: str) -> None:
        """Mark the job failed and hand the FX credits back, exactly once."""

        job_id = job["job_id"]

        # Atomic: only the caller that flips `refunded` pays the FX back.
        claimed = await self.jobs.claim_refund(job_id)

        if claimed:
            try:
                await self.users.add_fx_credits(
                    user_id=claimed["user_id"],
                    amount=int(claimed.get("fx_charged") or settings.SNAP_FX_COST),
                )
            except Exception:
                logger.exception("Could not refund FX for snap job %s", job_id)

        await self.jobs.update(
            job_id,
            {
                "status": STATUS_FAILED,
                "stage": "failed",
                "error": message,
                "refunded": True,
                "updated_at": utc_now(),
            },
        )

        logger.warning("Snap job %s failed: %s", job_id, message)

    @staticmethod
    def _public(job: dict) -> dict:
        return {
            "job_id": job["job_id"],
            "effect_id": job["effect_id"],
            "effect_name": job["effect_name"],
            "input": job.get("input") or INPUT_VIDEO,
            "status": job["status"],
            "stage": job.get("stage") or job["status"],
            "error": job.get("error"),
            "fx_charged": job.get("fx_charged", settings.SNAP_FX_COST),
            "created_at": job["created_at"],
        }


def _decode_base64(value: str) -> bytes:
    """Accepts plain base64 or a full data URI."""
    value = (value or "").strip()

    if value.startswith("data:") and "," in value:
        value = value.split(",", 1)[1]

    try:
        return base64.b64decode(value, validate=False)
    except (binascii.Error, ValueError):
        raise ValueError("The photo could not be read")


def _prepare_photo(raw: bytes) -> bytes:
    """Upright, RGB, at most PHOTO_MAX_SIDE px, as JPEG.

    Phones store rotation in EXIF instead of in the pixels; without the
    transpose a portrait selfie reaches PixVerse lying on its side, and the
    whole clip comes back sideways.
    """
    from PIL import Image, ImageOps, UnidentifiedImageError

    try:
        image = Image.open(io.BytesIO(raw))
        image = ImageOps.exif_transpose(image)
    except (UnidentifiedImageError, OSError):
        raise ValueError("The photo could not be read")

    if image.mode != "RGB":
        image = image.convert("RGB")

    width, height = image.size

    if min(width, height) < 256:
        raise ValueError("The photo is too small — use one at least 256 px wide")

    image.thumbnail((PHOTO_MAX_SIDE, PHOTO_MAX_SIDE), Image.LANCZOS)

    out = io.BytesIO()
    image.save(out, format="JPEG", quality=90)

    return out.getvalue()


def _normalise_engine(value: str) -> str:
    value = (value or "").strip().lower()
    if value in ("pixverse", "fal", "pixverse-v5.5"):
        return ENGINE_PIXVERSE
    return ENGINE_LUCY
