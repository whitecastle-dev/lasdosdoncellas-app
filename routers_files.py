"""File serving from Object Storage (public for product images)."""
import asyncio
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from storage import get_object

router = APIRouter(prefix="/api", tags=["files"])


@router.get("/files/{path:path}")
async def get_file(path: str):
    try:
        data, content_type = await asyncio.to_thread(get_object, path)
    except Exception:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return Response(content=data, media_type=content_type, headers={
        "Cache-Control": "public, max-age=86400"
    })
