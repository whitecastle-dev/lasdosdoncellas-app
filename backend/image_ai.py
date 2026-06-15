"""Gemini Nano Banana image enhancement service."""
import os
import base64
import logging
import google.generativeai as genai
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

# He seleccionado el modelo que aparecía en tu lista y que encaja con el nombre que usabas
NANO_BANANA_MODEL = "gemini-2.0-flash"

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
        raise Exception("EMERGENT_LLM_KEY is not configured")
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(NANO_BANANA_MODEL)
    
    # Preparar imagen para el SDK
    image_part = {
        "mime_type": "image/png",
        "data": image_bytes
    }
    
    try:
        # Nota: Al usar un modelo de 'image-preview', la API espera que el formato de 
        # respuesta sea manejado como contenido multimodal.
        response = model.generate_content([ENHANCE_PROMPT, image_part])
        
        # Intentamos extraer los datos de la imagen generada
        if response.candidates and response.candidates[0].content.parts:
            # Los modelos de generación de imagen suelen devolver los bytes 
            # en la respuesta de la parte 'inline_data'
            part = response.candidates[0].content.parts[0]
            if hasattr(part, 'inline_data'):
                return part.inline_data.data
            
        # Si el modelo solo devolvió texto (o falló en generar imagen), lanzamos error
        raise Exception("El modelo no devolvió una imagen válida")

    except Exception as e:
        logger.exception("Error en la mejora de imagen con Gemini")
        raise e

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
async def enhance_product_image(image_bytes: bytes) -> bytes: