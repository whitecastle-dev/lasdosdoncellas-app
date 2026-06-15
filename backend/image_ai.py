"""Gemini Diagnosis Service."""
import os
import logging
import google.generativeai as genai

logger = logging.getLogger(__name__)

async def enhance_product_image(image_bytes: bytes) -> bytes:
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    genai.configure(api_key=api_key)
    
    # Esto listará en los logs de Render exactamente qué modelos reconoce TU clave
    models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
    logger.error(f"--- MODELOS DISPONIBLES PARA TU KEY: {models} ---")
    
    # Forzamos un error descriptivo para verlo en los logs de Render
    raise Exception(f"DEBUG: Tu clave solo ve estos modelos: {models}")