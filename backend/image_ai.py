"""Gemini Nano Banana image enhancement — direct Google API (no Emergent).

Uses the gemini-2.5-flash-image model (a.k.a. Nano Banana) which natively
returns image bytes via inline_data parts.

Required env var: GOOGLE_API_KEY  (get one at https://aistudio.google.com/apikey)

If the key is missing or the call fails, returns the original bytes so the
upload flow never breaks.
"""
import os
import logging
import base64
from typing import Optional

import google.generativeai as genai

logger = logging.getLogger(__name__)

# Nano Banana — el único modelo de Gemini que devuelve imágenes generadas.
MODEL_NAME = "gemini-2.5-flash-image"

ENHANCE_PROMPT = (
    "Take the product in this image and create an editorial, ultra-premium "
    "product photograph. Remove the existing background completely and place "
    "the product on a sophisticated dark wooden surface with subtle hints of "
    "aged oak barrel staves and soft warm amber lighting. Enhance sharpness, "
    "color accuracy, texture and natural shadows so it feels cinematic and "
    "luxurious — perfect for a high-end Spanish iberico charcuterie brand "
    "called 'Las Dos Doncellas'. Keep the product centered, preserving its "
    "original shape, color and proportions. Ultra HD, 4K, magazine quality. "
    "Return ONLY the enhanced image."
)


def _detect_mime(image_bytes: bytes) -> str:
    if image_bytes.startswith(b"\x89PNG"):
        return "image/png"
    if image_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
        return "image/webp"
    return "image/jpeg"


async def enhance_product_image(image_bytes: bytes) -> bytes:
    """Returns the AI-enhanced PNG/JPG bytes, or the original if anything fails."""
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        logger.warning("GOOGLE_API_KEY no configurada — saltando mejora con IA.")
        return image_bytes

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(MODEL_NAME)

        image_part = {
            "mime_type": _detect_mime(image_bytes),
            "data": image_bytes,
        }

        response = await model.generate_content_async([ENHANCE_PROMPT, image_part])

        # Buscar la parte que es una imagen (Nano Banana devuelve un Part con inline_data)
        for cand in response.candidates or []:
            content = getattr(cand, "content", None)
            if not content:
                continue
            for part in content.parts or []:
                inline = getattr(part, "inline_data", None)
                if inline and getattr(inline, "data", None):
                    data = inline.data
                    # SDK puede devolver bytes o str base64
                    if isinstance(data, bytes):
                        logger.info("Nano Banana devolvió imagen (%d bytes).", len(data))
                        return data
                    try:
                        decoded = base64.b64decode(data)
                        logger.info("Nano Banana devolvió imagen base64 (%d bytes).", len(decoded))
                        return decoded
                    except Exception:
                        continue

        logger.warning("Nano Banana no devolvió imagen, usando original.")
        return image_bytes

    except Exception as e:
        logger.error("La mejora con IA falló: %s. Continuando con imagen original.", e)
        return image_bytes
