import os
import uuid
import cloudinary
import cloudinary.uploader

cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True,
)


LOCAL_DIR = os.path.join(os.path.dirname(__file__), "uploads")


def _cloudinary_ready():
    return bool(os.environ.get("CLOUDINARY_CLOUD_NAME") and os.environ.get("CLOUDINARY_API_KEY") and os.environ.get("CLOUDINARY_API_SECRET"))


def _upload_local(file_bytes, product_id):
    """Fallback sin Cloudinary (entorno de desarrollo): guarda en backend/uploads
    y sirve desde /api/uploads/<archivo>."""
    os.makedirs(LOCAL_DIR, exist_ok=True)
    name = f"{product_id}-{uuid.uuid4().hex[:10]}.jpg"
    with open(os.path.join(LOCAL_DIR, name), "wb") as f:
        f.write(file_bytes)
    return {"url": f"/api/uploads/{name}", "path": f"local/{name}"}


def upload_to_cloudinary(file_bytes, product_id):
    """Sube la imagen a Cloudinary en carpeta products/<id>.

    Genera un `public_id` único garantizado (UUID) para que CADA imagen subida
    quede como un objeto distinto — antes el endpoint bulk solo guardaba la
    última imagen porque Cloudinary podía deduplicar por content-hash.

    Aplica optimización ligera: calidad auto y formato auto (webp/avif).
    No usa `background_removal` (add-on de pago) ni `sharpen` (la nitidez la
    aplica ya nuestro pipeline `image_ai.py`).
    """
    if not _cloudinary_ready():
        return _upload_local(file_bytes, product_id)
    public_id = f"{product_id}-{uuid.uuid4().hex[:10]}"
    try:
        response = cloudinary.uploader.upload(
            file_bytes,
            folder=f"products/{product_id}",
            public_id=public_id,
            overwrite=False,
            unique_filename=False,
            quality="auto:good",
            fetch_format="auto",
        )
        return {"url": response["secure_url"], "path": response["public_id"]}
    except Exception as e:
        raise Exception(f"Error en Cloudinary: {e}")


def init_storage():
    pass
