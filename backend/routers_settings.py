"""Settings del sitio (singleton). Por ahora WhatsApp + Google (Business Profile /
reseñas). Pensado para crecer."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from db import db
from auth import require_permission

router = APIRouter(prefix="/api/settings", tags=["settings"])

COLLECTION = "settings"
SINGLETON_ID = "site"


class WhatsAppSettings(BaseModel):
    enabled: bool = False
    phone: Optional[str] = None  # E.164 sin +, p.ej. 34666777888
    default_message: Optional[str] = None
    label: Optional[str] = None  # texto que sale en el botón flotante


class GoogleSettings(BaseModel):
    enabled: bool = False
    # Cualquiera de los dos vale (se usa el que exista para construir el enlace)
    place_id: Optional[str] = None            # ChIJxxxxxxxxxxxxxxx
    business_name: Optional[str] = None        # texto libre p.ej. "Las Dos Doncellas Ibéricos Sevilla"
    # Opcional: enlace directo si ya lo tienes copiado de Google
    write_review_url: Optional[str] = None


class SiteSettingsIn(BaseModel):
    whatsapp: WhatsAppSettings = WhatsAppSettings()
    google: GoogleSettings = GoogleSettings()


def _google_write_url(g: dict) -> str:
    """Prioridad: URL manual > place_id > búsqueda por nombre."""
    if not g:
        return ""
    if g.get("write_review_url"):
        return g["write_review_url"]
    if g.get("place_id"):
        # Enlace directo al formulario de "escribir reseña" de Google Maps para un place_id.
        return f"https://search.google.com/local/writereview?placeid={g['place_id']}"
    if g.get("business_name"):
        from urllib.parse import quote_plus
        # Fallback: búsqueda del negocio; el usuario debe pulsar "Escribir una reseña".
        return f"https://www.google.com/maps/search/?api=1&query={quote_plus(g['business_name'])}"
    return ""


async def _load() -> dict:
    doc = await db[COLLECTION].find_one({"id": SINGLETON_ID}, {"_id": 0})
    if not doc:
        doc = {
            "id": SINGLETON_ID,
            "whatsapp": WhatsAppSettings().model_dump(),
            "google": GoogleSettings().model_dump(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db[COLLECTION].insert_one(doc)
        doc.pop("_id", None)
    if "whatsapp" not in doc:
        doc["whatsapp"] = WhatsAppSettings().model_dump()
    if "google" not in doc:
        doc["google"] = GoogleSettings().model_dump()
    return doc


@router.get("/public")
async def get_public_settings():
    """Subset público — solo lo que el storefront necesita (no expone nada sensible)."""
    s = await _load()
    wa = s.get("whatsapp") or {}
    g = s.get("google") or {}
    write_url = _google_write_url(g) if g.get("enabled") else ""
    return {
        "whatsapp": {
            "enabled": bool(wa.get("enabled") and wa.get("phone")),
            "phone": wa.get("phone") or "",
            "default_message": wa.get("default_message") or "",
            "label": wa.get("label") or "Chatea con nosotros",
        },
        "google": {
            "enabled": bool(g.get("enabled") and write_url),
            "write_review_url": write_url,
            "business_name": g.get("business_name") or "",
        },
    }


@router.get("")
async def get_settings(_=Depends(require_permission("dashboard.read"))):
    s = await _load()
    # Añadimos meta de pagos (sólo lectura, credenciales quedan en .env)
    import os as _os
    s["payment"] = {
        "provider": _os.environ.get("PAYMENT_PROVIDER", "stripe"),
        "redsys_merchant_code": _os.environ.get("REDSYS_MERCHANT_CODE", ""),
        "redsys_terminal": _os.environ.get("REDSYS_TERMINAL", ""),
        "redsys_environment": (
            "test" if "sis-t.redsys" in _os.environ.get("REDSYS_ENDPOINT", "") else "production"
        ),
    }
    return s


@router.put("")
async def update_settings(payload: SiteSettingsIn, _=Depends(require_permission("users.write"))):
    update = {
        "whatsapp": payload.whatsapp.model_dump(),
        "google": payload.google.model_dump(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db[COLLECTION].update_one(
        {"id": SINGLETON_ID},
        {"$set": update, "$setOnInsert": {"id": SINGLETON_ID}},
        upsert=True,
    )
    return await _load()
