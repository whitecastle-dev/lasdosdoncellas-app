"""File serving redirected to Cloudinary (External Storage)."""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

router = APIRouter(prefix="/api", tags=["files"])

@router.get("/files/{path:path}")
async def get_file(path: str, request: Request):
    """
    Las imágenes ahora se sirven desde Cloudinary. 
    Este endpoint redirige las peticiones antiguas a la URL de Cloudinary 
    o simplemente indica que el archivo debe gestionarse desde la URL absoluta.
    """
    # Si intentan acceder a un archivo vía /api/files/..., 
    # la forma correcta es que el frontend use directamente la URL de Cloudinary.
    # Aquí lanzamos un 404 para que el cliente busque la URL correcta en MongoDB.
    raise HTTPException(
        status_code=404, 
        detail="Los archivos ahora se sirven desde un almacenamiento externo (Cloudinary). Por favor, usa la URL almacenada en el producto."
    )