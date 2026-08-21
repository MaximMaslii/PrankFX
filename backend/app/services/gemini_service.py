import base64

from google import genai

from app.config import settings


class GeminiService:

    MODEL = "gemini-3.1-flash-image"

    def __init__(self):
        self.client = genai.Client(
            api_key=settings.GEMINI_API_KEY
        )

    async def edit_image(
        self,
        image_base64: str,
        prompt: str,
    ) -> str:

        mime_type = "image/jpeg"

        if image_base64.startswith("data:"):
            header, image_base64 = image_base64.split(",", 1)

            mime_type = header[5:].split(";", 1)[0]

        image_bytes = base64.b64decode(image_base64)

        interaction = await self.client.aio.interactions.create(
            model=self.MODEL,
            input=[
                {
                    "type": "text",
                    "text": prompt,
                },
                {
                    "type": "image",
                    "mime_type": mime_type,
                    "data": image_base64,
                },
            ],
            response_format={
                "type": "image",
                "mime_type": mime_type,
                "image_size": "1K",
            },
        )

        if not interaction.output_image:
            raise RuntimeError(
                "Gemini did not return an image"
            )

        return interaction.output_image.data