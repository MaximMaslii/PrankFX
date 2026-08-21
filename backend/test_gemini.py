import asyncio
import base64

from google import genai

from app.config import settings


async def main():
    client = genai.Client(
        api_key=settings.GEMINI_API_KEY
    )

    with open("test_photo.jpg", "rb") as f:
        image_bytes = f.read()

    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    prompt = """
Edit the provided photograph.

Add a realistic fresh black eye and bruising around the person's left eye.

IMPORTANT:
- Preserve the person's identity and facial structure.
- Preserve the hairstyle, clothing, background and camera angle.
- Preserve the original lighting and overall composition.
- Modify only the area around the left eye.
- Make the injury look photorealistic and naturally integrated into the original photograph.
- Do not change anything else in the image.
"""

    interaction = await client.aio.interactions.create(
        model="gemini-3.1-flash-image",
        input=[
            {
                "type": "image",
                "data": image_base64,
                "mime_type": "image/jpeg",
            },
            {
                "type": "text",
                "text": prompt,
            },
        ],
        response_format={
            "type": "image",
            "image_size": "1K",
        },
    )

    if not interaction.output_image:
        raise RuntimeError("Gemini did not return an image")

    result = base64.b64decode(
        interaction.output_image.data
    )

    with open("gemini_black_eye.png", "wb") as f:
        f.write(result)

    print("SUCCESS")
    print("Created: gemini_black_eye.png")


asyncio.run(main())