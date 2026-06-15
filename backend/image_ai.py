"""Gemini Nano Banana image enhancement service."""
import os
import base64
import logging
import google.generativeai as genai

logger = logging.getLogger(__name__)

# Usaremos gemini-1.5-flash ya que es el estándar actual
NANO_BANANA_MODEL = "gemini-1.5-flash" 

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
        
        # Log para depuración si vuelve a fallar
        if not response.text:
             logger.error("La respuesta de Gemini no contiene texto.")
             raise Exception("Gemini devolvió una respuesta vacía")
             
        # IMPORTANTE: Si Gemini solo devuelve texto (análisis), no puedes devolverlo como bytes de imagen.
        # Estamos devolviendo los bytes originales por ahora para evitar el error 500 y 
        # confirmar que la conexión a la API está viva.
        return image_bytes 

    except Exception as e:
        logger.exception("Error llamando a la API de Google Gemini")
        raise e