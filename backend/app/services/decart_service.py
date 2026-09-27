"""Decart (Lucy) video-to-video client.

Decart's job API is three calls:

    POST /v1/jobs/{model}            multipart: data=<video>, prompt=<text>
    GET  /v1/jobs/{job_id}           poll until the status settles
    GET  /v1/jobs/{job_id}/content   the finished MP4, as bytes

Authentication is the `X-API-KEY` header — not a bearer token.

Lucy 2.5's *realtime* surface is WebRTC only and is useless from a worker, so
this client talks to the non-realtime job endpoint, which is what the two-pass
pipeline needs: hand it 3.8 seconds, get 3.8 edited seconds back.
"""
import asyncio
import logging
from pathlib import Path

import httpx

from app.config import settings


logger = logging.getLogger("prankfx.decart")


# The API returns a status string; different model generations have used
# slightly different vocabularies, so match on a set rather than one value.
_DONE_STATES = {"completed", "complete", "succeeded", "success", "done", "finished"}
_FAILED_STATES = {"failed", "error", "cancelled", "canceled", "rejected"}


class DecartError(RuntimeError):
    """Raised when Lucy cannot produce a clip."""


class DecartService:

    def __init__(self):
        self._base_url = settings.DECART_API_URL.rstrip("/")

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    async def edit_video(
        self,
        video_path: Path,
        prompt: str,
        model: str | None = None,
    ) -> bytes:
        """Submit a clip, wait for the job, return the edited MP4 bytes."""

        if not settings.DECART_API_KEY:
            raise DecartError(
                "DECART_API_KEY is not set. Add it to backend/.env."
            )

        model = model or settings.DECART_MODEL

        timeout = httpx.Timeout(
            connect=15.0,
            read=settings.DECART_REQUEST_TIMEOUT_SECONDS,
            write=settings.DECART_REQUEST_TIMEOUT_SECONDS,
            pool=15.0,
        )

        async with httpx.AsyncClient(
            base_url=self._base_url,
            timeout=timeout,
            headers={"X-API-KEY": settings.DECART_API_KEY},
        ) as client:

            job_id = await self._submit(client, model, video_path, prompt)

            logger.info("Decart job %s submitted (model=%s)", job_id, model)

            await self._wait_for_job(client, job_id)

            return await self._download(client, job_id)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    async def _submit(
        self,
        client: httpx.AsyncClient,
        model: str,
        video_path: Path,
        prompt: str,
    ) -> str:

        with video_path.open("rb") as handle:
            response = await client.post(
                f"/v1/jobs/{model}",
                files={
                    "data": (
                        video_path.name,
                        handle,
                        "video/mp4",
                    ),
                },
                data={"prompt": prompt},
            )

        if response.status_code >= 400:
            raise DecartError(
                f"Decart rejected the job ({response.status_code}): "
                f"{_short(response.text)}"
            )

        payload = _json(response)

        job_id = (
            payload.get("job_id")
            or payload.get("id")
            or (payload.get("job") or {}).get("id")
        )

        if not job_id:
            raise DecartError(
                f"Decart returned no job id: {_short(response.text)}"
            )

        return str(job_id)

    async def _wait_for_job(
        self,
        client: httpx.AsyncClient,
        job_id: str,
    ) -> None:

        deadline = (
            asyncio.get_running_loop().time()
            + settings.DECART_JOB_TIMEOUT_SECONDS
        )

        interval = settings.DECART_POLL_INTERVAL_SECONDS

        while True:
            response = await client.get(f"/v1/jobs/{job_id}")

            if response.status_code >= 400:
                raise DecartError(
                    f"Could not read job {job_id} "
                    f"({response.status_code}): {_short(response.text)}"
                )

            payload = _json(response)

            status = str(
                payload.get("status")
                or payload.get("state")
                or ""
            ).lower()

            if status in _DONE_STATES:
                return

            if status in _FAILED_STATES:
                raise DecartError(
                    "Lucy could not process the clip: "
                    f"{payload.get('error') or payload.get('message') or status}"
                )

            if asyncio.get_running_loop().time() > deadline:
                raise DecartError(
                    f"Lucy did not finish within "
                    f"{settings.DECART_JOB_TIMEOUT_SECONDS:.0f}s "
                    f"(last status: {status or 'unknown'})"
                )

            await asyncio.sleep(interval)

    async def _download(
        self,
        client: httpx.AsyncClient,
        job_id: str,
    ) -> bytes:

        response = await client.get(f"/v1/jobs/{job_id}/content")

        if response.status_code >= 400:
            raise DecartError(
                f"Could not download job {job_id} "
                f"({response.status_code}): {_short(response.text)}"
            )

        content = response.content

        if not content:
            raise DecartError(f"Job {job_id} returned an empty clip")

        return content


def _json(response: httpx.Response) -> dict:
    try:
        payload = response.json()
    except Exception:
        return {}

    return payload if isinstance(payload, dict) else {}


def _short(text: str, limit: int = 300) -> str:
    text = (text or "").strip().replace("\n", " ")
    return text[:limit]
