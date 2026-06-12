"""Providers / proveedores CRUD + stats + send email."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from db import db
from auth import require_permission
from email_service import send_provider_message

router = APIRouter(prefix="/api/providers", tags=["providers"])

PROVIDER_PERM_READ = "products.read"
PROVIDER_PERM_WRITE = "products.write"
PROVIDER_PERM_DELETE = "products.delete"


class ProviderIn(BaseModel):
    name: str
    company: Optional[str] = ""
    contact_name: Optional[str] = ""
    email: EmailStr
    phone: Optional[str] = ""
    address: Optional[str] = ""
    city: Optional[str] = ""
    postal_code: Optional[str] = ""
    country: Optional[str] = "España"
    tax_id: Optional[str] = ""
    website: Optional[str] = ""
    payment_terms: Optional[str] = ""  # ej "30 días"
    notes: Optional[str] = ""
    tags: List[str] = Field(default_factory=list)
    is_active: bool = True


class ProviderEmailIn(BaseModel):
    subject: str
    body: str


@router.get("")
async def list_providers(
    q: Optional[str] = None,
    _=Depends(require_permission(PROVIDER_PERM_READ)),
):
    query = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"company": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"tax_id": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.providers.find(query, {"_id": 0}).sort("name", 1)
    return [p async for p in cursor]


@router.get("/{provider_id}")
async def get_provider(provider_id: str, _=Depends(require_permission(PROVIDER_PERM_READ))):
    p = await db.providers.find_one({"id": provider_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return p


@router.get("/{provider_id}/stats")
async def provider_stats(provider_id: str, _=Depends(require_permission(PROVIDER_PERM_READ))):
    p = await db.providers.find_one({"id": provider_id})
    if not p:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    products_count = await db.products.count_documents({"provider_id": provider_id})
    active_products = await db.products.count_documents({"provider_id": provider_id, "is_active": True})
    # Aggregated revenue from this provider's products through paid orders
    pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$unwind": "$items"},
        {"$lookup": {
            "from": "products",
            "localField": "items.product_id",
            "foreignField": "id",
            "as": "prod",
        }},
        {"$unwind": "$prod"},
        {"$match": {"prod.provider_id": provider_id}},
        {"$group": {
            "_id": None,
            "revenue": {"$sum": "$items.line_total"},
            "units": {"$sum": "$items.qty"},
            "orders": {"$addToSet": "$_id"},
        }},
    ]
    revenue = 0.0
    units = 0
    orders_count = 0
    async for d in db.orders.aggregate(pipeline):
        revenue = float(d.get("revenue") or 0)
        units = int(d.get("units") or 0)
        orders_count = len(d.get("orders") or [])

    # Top 5 products from this provider
    top = []
    top_cursor = db.orders.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$unwind": "$items"},
        {"$lookup": {
            "from": "products",
            "localField": "items.product_id",
            "foreignField": "id",
            "as": "prod",
        }},
        {"$unwind": "$prod"},
        {"$match": {"prod.provider_id": provider_id}},
        {"$group": {
            "_id": "$items.product_id",
            "name": {"$first": "$items.name"},
            "units": {"$sum": "$items.qty"},
            "revenue": {"$sum": "$items.line_total"},
        }},
        {"$sort": {"revenue": -1}},
        {"$limit": 5},
    ])
    async for d in top_cursor:
        top.append({
            "product_id": d["_id"], "name": d.get("name"),
            "units": int(d["units"]), "revenue": float(d["revenue"]),
        })

    return {
        "products_count": products_count,
        "active_products": active_products,
        "revenue": round(revenue, 2),
        "units_sold": units,
        "orders_count": orders_count,
        "top_products": top,
    }


@router.post("")
async def create_provider(payload: ProviderIn, _=Depends(require_permission(PROVIDER_PERM_WRITE))):
    existing = await db.providers.find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un proveedor con este email")
    now = datetime.now(timezone.utc).isoformat()
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now
    doc["updated_at"] = now
    await db.providers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/{provider_id}")
async def update_provider(provider_id: str, payload: ProviderIn, _=Depends(require_permission(PROVIDER_PERM_WRITE))):
    existing = await db.providers.find_one({"id": provider_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    if payload.email != existing.get("email"):
        other = await db.providers.find_one({"email": payload.email})
        if other:
            raise HTTPException(status_code=400, detail="Email ya usado por otro proveedor")
    updates = payload.model_dump()
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.providers.update_one({"id": provider_id}, {"$set": updates})
    updated = await db.providers.find_one({"id": provider_id}, {"_id": 0})
    return updated


@router.delete("/{provider_id}")
async def delete_provider(provider_id: str, _=Depends(require_permission(PROVIDER_PERM_DELETE))):
    # Don't delete if referenced
    in_use = await db.products.count_documents({"provider_id": provider_id})
    if in_use:
        raise HTTPException(status_code=400, detail=f"El proveedor está vinculado a {in_use} producto(s). Desactívalo en su lugar.")
    r = await db.providers.delete_one({"id": provider_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return {"ok": True}


@router.post("/{provider_id}/email")
async def email_provider(provider_id: str, payload: ProviderEmailIn, _=Depends(require_permission(PROVIDER_PERM_WRITE))):
    p = await db.providers.find_one({"id": provider_id})
    if not p:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    ok = await send_provider_message(p["email"], p.get("name", ""), payload.subject, payload.body)
    if not ok:
        # If Brevo not configured we still return 200 but flag it
        return {"sent": False, "reason": "email_disabled", "message": "Email service no configurado. Configura BREVO_API_KEY."}
    # Persist a log entry
    await db.provider_communications.insert_one({
        "id": str(uuid.uuid4()),
        "provider_id": provider_id,
        "subject": payload.subject,
        "body": payload.body,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"sent": True}
