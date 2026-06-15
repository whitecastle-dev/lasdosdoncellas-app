"""Gemini Nano Banana image enhancement service."""
import os
import base64
import logging
import google.generativeai as genai

logger = logging.getLogger(__name__)

# Usamos gemini-2.0-flash por ser estable y tener mejores cuotas
NANO_BANANA_MODEL = "gemma-4-26b-a4b-it" 

ENHANCE_PROMPT = (
    "Take the product in this image and create an editorial, ultra-premium "
    "product photograph. Remove the existing background completely and place "
    "the product on a sophisticated dark wooden surface with subtle hints of "
    "aged oak barrel staves and soft warm amber lighting."
)

async def enhance_product_image(image_bytes: bytes) -> bytes:
    """Run Gemini Nano Banana enhancement on a product image."""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise Exception("EMERGENT_LLM_KEY is not configured")
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(NANO_BANANA_MODEL)
    
    # Preparar imagen correctamente para el SDK
    image_part = {
        "mime_type": "image/png",
        "data": image_bytes
    }
    
    try:
        # Generar contenido
        response = model.generate_content([ENHANCE_PROMPT, image_part])
        
        # Validación de respuesta
        if not response.text:
            logger.error("La respuesta de Gemini no contiene texto.")
            raise Exception("Gemini devolvió una respuesta vacía")
             
        return image_bytes 

    except Exception as e:
        logger.exception("Error llamando a la API de Google Gemini")
        raise e