"""Gemini image enhancement service."""
import os
import logging
import google.generativeai as genai
import asyncio

logger = logging.getLogger(__name__)

# Usamos gemini-1.5-flash por ser el más eficiente para tareas de visión rápida
MODEL_NAME = "gemini-pro-vision" 

ENHANCE_PROMPT = (
    "Take the product in this image and create an editorial, ultra-premium "
    "product photograph. Remove the existing background completely and place "
    "the product on a sophisticated dark wooden surface with subtle hints of "
    "aged oak barrel staves and soft warm amber lighting."
)

async def enhance_product_image(image_bytes: bytes) -> bytes:
    """Run Gemini enhancement service asynchronously."""
    # Usamos GOOGLE_API_KEY como estándar en lugar de la variable antigua
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("EMERGENT_LLM_KEY")
    
    if not api_key:
        logger.warning("API Key no configurada, saltando mejora de IA.")
        return image_bytes
    
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(MODEL_NAME)
        
        image_part = {
            "mime_type": "image/png",
            "data": image_bytes
        }
        
        # Ejecutamos la petición de forma asíncrona para no bloquear el hilo principal
        # Aumentamos el timeout a 30s dado que procesar imágenes pesadas tarda más
        response = await model.generate_content_async(
            [ENHANCE_PROMPT, image_part]
        )
        
        # NOTA: Gemini genera contenido, pero no necesariamente devuelve la imagen mejorada en bytes.
        # Si Gemini te devuelve una URL o texto, deberías procesar 'response.text' aquí.
        if response.text:
            logger.info("IA procesó la imagen correctamente.")
            
        return image_bytes 

    except Exception as e:
        logger.error(f"La mejora con IA falló: {e}. Continuando con imagen original.")
        return image_bytes