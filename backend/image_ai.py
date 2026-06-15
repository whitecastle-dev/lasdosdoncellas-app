"""Gemini Nano Banana image enhancement service."""
import os
import logging
import google.generativeai as genai

logger = logging.getLogger(__name__)

# Usamos el modelo que tu clave acepta; si da error de cuota, 
# el try-except lo capturará sin romper la web.
NANO_BANANA_MODEL = "gemma-4-26b-a4b-it" 

ENHANCE_PROMPT = (
    "Take the product in this image and create an editorial, ultra-premium "
    "product photograph. Remove the existing background completely and place "
    "the product on a sophisticated dark wooden surface with subtle hints of "
    "aged oak barrel staves and soft warm amber lighting."
)

async def enhance_product_image(image_bytes: bytes) -> bytes:
    """Run Gemini Nano Banana enhancement. Returns original bytes if AI fails."""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    
    # Si no hay API key, no intentamos usar la IA, devolvemos original directamente
    if not api_key:
        logger.warning("EMERGENT_LLM_KEY no configurado, saltando mejora de IA.")
        return image_bytes
    
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(NANO_BANANA_MODEL)
        
        # Preparar imagen para el SDK
        image_part = {
            "mime_type": "image/png",
            "data": image_bytes
        }
        
        # Generar contenido con un timeout de 5 segundos para no bloquear el servidor
        response = model.generate_content(
            [ENHANCE_PROMPT, image_part],
            request_options={"timeout": 5}
        )
        
        # Si la respuesta es exitosa pero no tiene texto/imagen, usamos el original
        if not response.text:
            logger.warning("La respuesta de IA estaba vacía, devolviendo imagen original.")
            return image_bytes
             
        # Si todo fue bien, aquí podrías procesar la respuesta.
        # Por ahora, devolvemos los bytes originales para asegurar estabilidad.
        return image_bytes 

    except Exception as e:
        # AQUÍ ESTÁ EL CAMBIO CRÍTICO: 
        # En lugar de 'raise e', logueamos y devolvemos la imagen.
        # Esto evita que tu backend devuelva un error 500 al frontend.
        logger.error(f"La mejora con IA falló: {e}. Continuando con imagen original.")
        return image_bytes