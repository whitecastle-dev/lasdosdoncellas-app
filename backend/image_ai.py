"""Gemini Nano Banana image enhancement service."""
import os
import base64
import logging
import uuid
from llm_utils import LlmChat, UserMessage, ImageContent # Asegúrate de que estas importaciones sean correctas para tu entorno

logger = logging.getLogger(__name__)

NANO_BANANA_MODEL = "gemini-3.1-flash-image-preview"

ENHANCE_PROMPT = (
    "Take the product in this image and create an editorial, ultra-premium "
    "product photograph. Remove the existing background completely and place "
    "the product on a sophisticated dark wooden surface with subtle hints of "
    "aged oak barrel staves and soft warm amber lighting. Enhance the sharpness, "
    "color accuracy, texture detail, and natural shadows so it feels cinematic "
    "and luxurious — perfect for a high-end Spanish iberico charcuterie store "
    "called 'Las Dos Doncellas'. Keep the product perfectly centered, true to "
    "its original shape, color and proportions. Ultra HD, 4K, crisp, magazine quality."
)

async def enhance_product_image(image_bytes: bytes) -> bytes:
    """Run Gemini Nano Banana enhancement on a product image."""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise Exception("EMERGENT_LLM_KEY is not configured in environment variables")
    
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    chat = LlmChat(
        api_key=api_key,
        session_id=f"product-{uuid.uuid4()}",
        system_message="You are an expert food product photographer creating editorial images for a luxury Spanish iberico brand.",
    ).with_model("gemini", NANO_BANANA_MODEL).with_params(modalities=["image", "text"])

    msg = UserMessage(
        text=ENHANCE_PROMPT,
        file_contents=[ImageContent(image_b64)],
    )
    
    _text, images = await chat.send_message_multimodal_response(msg)
    
    if not images:
        raise Exception("Nano Banana failed to return an enhanced image")
        
    return base64.b64decode(images[0]["data"])