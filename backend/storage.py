import os
import cloudinary
import cloudinary.uploader
from fastapi import HTTPException

# Configuración de Cloudinary
cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET")
)

def upload_to_cloudinary(file_bytes, product_id):
    """
    Sube la imagen a Cloudinary aplicando una transformación editorial premium:
    - Eliminación de fondo automática.
    - Mejora de nitidez y calidad.
    - Centrado y ajuste a fondo blanco.
    """
    try:
        # Configuración de Transformación Editorial Premium
        transformations = {
            # 1. Calidad y Nitidez
            "quality": "auto:best",         # Optimización inteligente de peso vs calidad
            "fetch_format": "auto",         # Entrega en WebP/AVIF (mejor para web)
            "e_sharpen": 100,               # Nitidez extrema para resaltar detalles
            
            # 2. Fondo y Estética
            "background": "white",          # Fondo limpio y profesional
            "e_background_removal": "true", # Quita el fondo original
            
            # 3. Composición profesional
            "crop": "pad",                  # 'pad' coloca el producto centrado en el lienzo
            "width": 1000,
            "height": 1000,
            "gravity": "center"             # Asegura que el producto esté en el medio
        }

        # Subir a carpeta de productos con las transformaciones aplicadas
        response = cloudinary.uploader.upload(
            file_bytes, 
            folder=f"products/{product_id}",
            transformation=transformations
        )
        
        return {
            "url": response["secure_url"],
            "path": response["public_id"]
        }
    except Exception as e:
        # Registramos el error y lanzamos excepción para que la API responda correctamente
        raise Exception(f"Error en Cloudinary: {str(e)}")

def init_storage():
    """Función de compatibilidad para evitar errores de importación."""
    pass