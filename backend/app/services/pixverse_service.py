"""PixVerse v5.5 image-to-video, through fal.ai's queue API.

fal's queue protocol is three calls, all authenticated with
`Authorization: Key <FAL_KEY>`:

    POST {queue}/{model}           JSON input -> {request_id, status_url, response_url}
    GET  {status_url}              poll until status == "COMPLETED"
    GET  {response_url}            {"video": {"url": ...}} — or an error body

The finished MP4 is then downloaded from fal's CDN (no auth needed there).

The photo is sent inline as a base64 data URI, which fal accepts for any
file field. It keeps the whole thing to one request: no separate upload, no
public bucket holding people's faces.
"""
import asyncio
import base64
import logging

import httpx

from app.config import settings


logger = logging.getLogger("prankfx.pixverse")


_DONE_STATES = {"COMPLETED", "OK", "SUCCEEDED", "SUCCESS"}
_FAILED_STATES = {"FAILED", "ERROR", "CANCELLED", "CANCELED"}


class PixverseError(RuntimeError):
    """Raised when PixVerse cannot produce a clip."""


class PixverseService:

    def __init__(self):
        self._queue_url = settings.FAL_QUEUE_URL.rstrip("/")

    @staticmethod
    def configured() -> bool:
        return bool(settings.FAL_KEY)

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    async def image_to_video(
        self,
        image_bytes: bytes,
        prompt: str,
        negative_prompt: str = "",
        mime: str = "image/jpeg",
    ) -> bytes:
        """Animate one photo. Returns the MP4 bytes."""

        if not settings.FAL_KEY:
            raise PixverseError("FAL_KEY is not set. Add it to backend/.env.")

        model = settings.PIXVERSE_MODEL.strip("/")

        payload = {
            "prompt": prompt,
            "image_url": _data_uri(image_bytes, mime),
            "resolution": settings.PIXVERSE_RESOLUTION,
            "duration": str(settings.PIXVERSE_DURATION),
            "negative_prompt": negative_prompt,
            # Both cost extra and neither was budgeted: $0.20 a clip is 720p,
            # 5 s, silent, single shot.
            "generate_audio_switch": False,
            "generate_multi_clip_switch": False,
        }

        timeout = httpx.Timeout(
            connect=15.0,
            read=settings.PIXVERSE_REQUEST_TIMEOUT_SECONDS,
            write=settings.PIXVERSE_REQUEST_TIMEOUT_SECONDS,
            pool=15.0,
        )

        async with httpx.AsyncClient(
            timeout=timeout,
            headers={"Authorization": f"Key {settings.FAL_KEY}"},
            follow_redirects=True,
        ) as client:

            submitted = await self._submit(client, model, payload)

            request_id = submitted["request_id"]

            logger.info("PixVerse request %s submitted", request_id)

            await self._wait(client, submitted)

            video_url = await self._result_url(client, submitted)

        # fal's CDN is public; the API key must not travel to it.
        return await _download(video_url, timeout)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    async def _submit(
        self,
        client: httpx.AsyncClient,
        model: str,
        payload: dict,
    ) -> dict:

        response = await client.post(f"{self._queue_url}/{model}", json=payload)

        if response.status_code >= 400:
            raise PixverseError(
                f"PixVerse rejected the request ({response.status_code}): "
                f"{_error_text(response)}"
            )

        data = _json(response)

        request_id = data.get("request_id")

        if not request_id:
            raise PixverseError(
                f"fal returned no request id: {_short(response.text)}"
            )

        # The URLs fal hands back are authoritative — for a model with a
        # sub-path they point at the *app* ("fal-ai/pixverse"), not at the
        # full model path, and guessing that wrong is a 404 on every poll.
        app_id = "/".join(model.split("/")[:2])
        base = f"{self._queue_url}/{app_id}/requests/{request_id}"

        return {
            "request_id": request_id,
            "status_url": data.get("status_url") or f"{base}/status",
            "response_url": data.get("response_url") or base,
        }

    async def _wait(self, client: httpx.AsyncClient, submitted: dict) -> None:
        loop = asyncio.get_running_loop()
        deadline = loop.time() + settings.PIXVERSE_JOB_TIMEOUT_SECONDS
        interval = max(0.5, settings.PIXVERSE_POLL_INTERVAL_SECONDS)

        last_status = ""

        while True:
            response = await client.get(submitted["status_url"])

            if response.status_code >= 400 and response.status_code != 202:
                raise PixverseError(
                    f"Could not read PixVerse status ({response.status_code}): "
                    f"{_error_text(response)}"
                )

            data = _json(response)
            last_status = str(data.get("status") or "").upper()

            if last_status in _DONE_STATES:
                return

            if last_status in _FAILED_STATES:
                raise PixverseError(
                    "PixVerse could not animate this photo: "
                    f"{data.get('error') or data.get('detail') or last_status}"
                )

            if loop.time() > deadline:
                raise PixverseError(
                    "PixVerse did not finish within "
                    f"{settings.PIXVERSE_JOB_TIMEOUT_SECONDS:.0f}s "
                    f"(last status: {last_status or 'unknown'})"
                )

            await asyncio.sleep(interval)

    async def _result_url(self, client: httpx.AsyncClient, submitted: dict) -> str:
        response = await client.get(submitted["response_url"])

        # A request that ran and failed still reaches COMPLETED; the error
        # only shows up here, as a 4xx/5xx body.
        if response.status_code >= 400:
            raise PixverseError(
                f"PixVerse could not animate this photo: {_error_text(response)}"
            )

        data = _json(response)

        video = data.get("video") or (data.get("response") or {}).get("video") or {}
        url = video.get("url") if isinstance(video, dict) else None

        if not url:
            raise PixverseError(
                f"PixVerse returned no video: {_short(response.text)}"
            )

        return url


async def _download(url: str, timeout: httpx.Timeout) -> bytes:
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        response = await client.get(url)

    if response.status_code >= 400:
        raise PixverseError(
            f"Could not download the PixVerse clip ({response.status_code})"
        )

    if not response.content:
        raise PixverseError("PixVerse returned an empty clip")

    return response.content


def _data_uri(data: bytes, mime: str) -> str:
    return f"data:{mime or 'image/jpeg'};base64,{base64.b64encode(data).decode('ascii')}"


def _json(response: httpx.Response) -> dict:
    try:
        payload = response.json()
    except Exception:
        return {}

    return payload if isinstance(payload, dict) else {}


def _error_text(response: httpx.Response) -> str:
    """fal puts the reason in `detail`, sometimes as a list of objects."""
    data = _json(response)
    detail = data.get("detail") or data.get("error") or data.get("message")

    if isinstance(detail, list):
        parts = []
        for item in detail:
            if isinstance(item, dict):
                parts.append(str(item.get("msg") or item.get("message") or item))
            else:
                parts.append(str(item))
        detail = "; ".join(parts)

    return _short(str(detail) if detail else response.text)


def _short(text: str, limit: int = 300) -> str:
    text = (text or "").strip().replace("\n", " ")
    return text[:limit]
