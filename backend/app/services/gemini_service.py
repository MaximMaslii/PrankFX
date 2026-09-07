import base64
import logging

from google import genai
from google.genai import types

from app.config import settings


logger = logging.getLogger("prankfx.gemini")


class GeminiService:
    """
    Image editing through Gemini.

    Tries the newer `interactions` surface first and falls back to
    `generate_content`, because which of the two exists depends on the
    installed google-genai version — the previous code assumed `interactions`
    and raised an unhelpful AttributeError when it was absent.
    """

    MODEL = "gemini-3.1-flash-image"
    FALLBACK_MODEL = "gemini-2.5-flash-image"

    def __init__(self):
        self._client: genai.Client | None = None

    @property
    def client(self) -> genai.Client:
        if self._client is None:
            if not settings.GEMINI_API_KEY:
                raise RuntimeError(
                    "GEMINI_API_KEY is not set. Add it to backend/.env."
                )

            self._client = genai.Client(api_key=settings.GEMINI_API_KEY)

        return self._client

    @staticmethod
    def _split_data_uri(image_base64: str) -> tuple[str, str]:
        """Return (mime_type, raw_base64) for a data URI or a bare base64 string."""
        mime_type = "image/jpeg"

        if image_base64.startswith("data:"):
            header, image_base64 = image_base64.split(",", 1)
            mime_type = header[5:].split(";", 1)[0] or mime_type

        return mime_type, image_base64

    async def edit_image(self, image_base64: str, prompt: str) -> str:
        mime_type, raw_base64 = self._split_data_uri(image_base64)

        try:
            image_bytes = base64.b64decode(raw_base64, validate=True)
        except Exception as e:
            raise ValueError("The uploaded image is not valid base64 data") from e

        if not image_bytes:
            raise ValueError("The uploaded image is empty")

        # ---------------------------------------------------------------
        # Preferred path: the `interactions` API.
        # ---------------------------------------------------------------
        interactions = getattr(getattr(self.client, "aio", None), "interactions", None)

        if interactions is not None:
            try:
                interaction = await interactions.create(
                    model=self.MODEL,
                    input=[
                        {"type": "text", "text": prompt},
                        {
                            "type": "image",
                            "mime_type": mime_type,
                            "data": raw_base64,
                        },
                    ],
                    response_format={
                        "type": "image",
                        "mime_type": mime_type,
                        "image_size": "1K",
                    },
                )

                if getattr(interaction, "output_image", None):
                    return interaction.output_image.data

                logger.warning(
                    "Gemini interactions returned no image; falling back to generate_content"
                )

            except Exception:
                logger.exception(
                    "Gemini interactions call failed; falling back to generate_content"
                )

        # ---------------------------------------------------------------
        # Fallback path: generate_content, available on every recent version.
        # ---------------------------------------------------------------
        last_error: Exception | None = None

        for model in (self.MODEL, self.FALLBACK_MODEL):
            try:
                response = await self.client.aio.models.generate_content(
                    model=model,
                    contents=[
                        types.Part.from_text(text=prompt),
                        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    ],
                )

                image = self._extract_image(response)

                if image:
                    return image

                last_error = RuntimeError(
                    f"{model} returned no image (the prompt may have been blocked)"
                )

            except Exception as e:
                logger.warning("Gemini model %s failed: %s", model, e)
                last_error = e

        raise RuntimeError(
            f"Image generation failed: {last_error}"
            if last_error
            else "Image generation failed"
        )

    @staticmethod
    def _extract_image(response) -> str | None:
        """Pull the first inline image out of a generate_content response."""
        for candidate in getattr(response, "candidates", None) or []:
            content = getattr(candidate, "content", None)

            for part in getattr(content, "parts", None) or []:
                inline = getattr(part, "inline_data", None)

                if inline and getattr(inline, "data", None):
                    data = inline.data

                    if isinstance(data, bytes):
                        return base64.b64encode(data).decode("utf-8")

                    return data

        return None
