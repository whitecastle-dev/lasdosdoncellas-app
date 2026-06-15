import os
import cloudinary
import cloudinary.uploader
from fastapi import HTTPException

# Configuración única
cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET")
)

def upload_to_cloudinary(file_bytes, product_id):
    try:
        # Subir a carpeta de productos
        response = cloudinary.uploader.upload(
            file_bytes, 
            folder=f"products/{product_id}"
        )
        # Devolvemos un formato compatible con lo que tu app espera
        return {
            "url": response["secure_url"],
            "path": response["public_id"]
        }
    except Exception as e:
        raise Exception(f"Error en Cloudinary: {str(e)}")

# Esta función ya no es necesaria, puedes dejarla vacía para no romper imports
def init_storage():
    pass