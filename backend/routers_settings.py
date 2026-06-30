"""Settings del sitio (singleton). Por ahora solo WhatsApp; pensado para crecer."""
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


class SiteSettingsIn(BaseModel):
    whatsapp: WhatsAppSettings = WhatsAppSettings()


async def _load() -> dict:
    doc = await db[COLLECTION].find_one({"id": SINGLETON_ID}, {"_id": 0})
    if not doc:
        doc = {
            "id": SINGLETON_ID,
            "whatsapp": WhatsAppSettings().model_dump(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db[COLLECTION].insert_one(doc)
        doc.pop("_id", None)
    # Asegura todas las keys nuevas que vayamos añadiendo
    if "whatsapp" not in doc:
        doc["whatsapp"] = WhatsAppSettings().model_dump()
    return doc


@router.get("/public")
async def get_public_settings():
    """Subset público — solo lo que el storefront necesita (no expone nada sensible)."""
    s = await _load()
    wa = s.get("whatsapp") or {}
    return {
        "whatsapp": {
            "enabled": bool(wa.get("enabled") and wa.get("phone")),
            "phone": wa.get("phone") or "",
            "default_message": wa.get("default_message") or "",
            "label": wa.get("label") or "Chatea con nosotros",
        }
    }


@router.get("")
async def get_settings(_=Depends(require_permission("dashboard.read"))):
    return await _load()


@router.put("")
async def update_settings(payload: SiteSettingsIn, _=Depends(require_permission("users.write"))):
    update = {
        "whatsapp": payload.whatsapp.model_dump(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db[COLLECTION].update_one(
        {"id": SINGLETON_ID},
        {"$set": update, "$setOnInsert": {"id": SINGLETON_ID}},
        upsert=True,
    )
    return await _load()
