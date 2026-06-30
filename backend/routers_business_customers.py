"""B2B / Usuarios Empresa CRUD — clientes recurrentes (HORECA, distribución).

Modelo separado de los usuarios web (`db.customers`) porque tienen lógica
distinta: descuento personalizado, condiciones de pago, límite de crédito,
notas internas del comercial.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from db import db
from auth import require_permission

router = APIRouter(prefix="/api/business-customers", tags=["business-customers"])

PERM_READ = "customers.read"
PERM_WRITE = "customers.write"
PERM_DELETE = "customers.delete"


class BusinessCustomerIn(BaseModel):
    company_name: str
    tax_id: str  # CIF/NIF
    contact_name: Optional[str] = ""
    email: EmailStr
    phone: Optional[str] = ""
    address: Optional[str] = ""
    city: Optional[str] = ""
    postal_code: Optional[str] = ""
    country: Optional[str] = "España"
    discount_pct: float = 0.0  # 0-100
    payment_terms: Optional[str] = "Contado"  # "15 días", "30 días", "60 días", "Contado"
    credit_limit: float = 0.0  # 0 = sin límite explícito
    notes: Optional[str] = ""
    tags: List[str] = Field(default_factory=list)
    is_active: bool = True


@router.get("")
async def list_business_customers(
    q: Optional[str] = None,
    _=Depends(require_permission(PERM_READ)),
):
    query = {}
    if q:
        query["$or"] = [
            {"company_name": {"$regex": q, "$options": "i"}},
            {"tax_id": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"contact_name": {"$regex": q, "$options": "i"}},
            {"city": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.business_customers.find(query, {"_id": 0}).sort("company_name", 1)
    return [b async for b in cursor]


@router.get("/{customer_id}")
async def get_business_customer(customer_id: str, _=Depends(require_permission(PERM_READ))):
    b = await db.business_customers.find_one({"id": customer_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Cliente empresa no encontrado")
    return b


@router.post("")
async def create_business_customer(payload: BusinessCustomerIn, _=Depends(require_permission(PERM_WRITE))):
    email = payload.email.lower().strip()
    existing = await db.business_customers.find_one({"$or": [
        {"email": email},
        {"tax_id": payload.tax_id.strip().upper()},
    ]})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un cliente empresa con ese email o CIF/NIF")
    if payload.discount_pct < 0 or payload.discount_pct > 100:
        raise HTTPException(status_code=400, detail="Descuento debe estar entre 0 y 100")
    if payload.credit_limit < 0:
        raise HTTPException(status_code=400, detail="Límite de crédito no puede ser negativo")

    now = datetime.now(timezone.utc).isoformat()
    doc = payload.model_dump()
    doc["email"] = email
    doc["tax_id"] = payload.tax_id.strip().upper()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now
    doc["updated_at"] = now
    await db.business_customers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/{customer_id}")
async def update_business_customer(customer_id: str, payload: BusinessCustomerIn, _=Depends(require_permission(PERM_WRITE))):
    existing = await db.business_customers.find_one({"id": customer_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Cliente empresa no encontrado")

    email = payload.email.lower().strip()
    tax_id = payload.tax_id.strip().upper()
    if email != existing.get("email") or tax_id != existing.get("tax_id"):
        other = await db.business_customers.find_one({
            "$or": [{"email": email}, {"tax_id": tax_id}],
            "id": {"$ne": customer_id},
        })
        if other:
            raise HTTPException(status_code=400, detail="Email o CIF/NIF ya usado por otro cliente empresa")
    if payload.discount_pct < 0 or payload.discount_pct > 100:
        raise HTTPException(status_code=400, detail="Descuento debe estar entre 0 y 100")
    if payload.credit_limit < 0:
        raise HTTPException(status_code=400, detail="Límite de crédito no puede ser negativo")

    updates = payload.model_dump()
    updates["email"] = email
    updates["tax_id"] = tax_id
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.business_customers.update_one({"id": customer_id}, {"$set": updates})
    updated = await db.business_customers.find_one({"id": customer_id}, {"_id": 0})
    return updated


@router.delete("/{customer_id}")
async def delete_business_customer(customer_id: str, _=Depends(require_permission(PERM_DELETE))):
    r = await db.business_customers.delete_one({"id": customer_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cliente empresa no encontrado")
    return {"ok": True}
