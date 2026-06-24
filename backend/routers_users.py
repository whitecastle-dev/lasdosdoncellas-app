"""User management routes (admin only)."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from db import db
from auth import (
    hash_password, validate_password, PASSWORD_RULES_MSG,
    require_permission, ALL_PERMISSIONS,
)
router = APIRouter(prefix="/api/users", tags=["users"])


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "manager"
    permissions: List[str] = Field(default_factory=list)
    is_active: bool = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


@router.get("/permissions")
async def list_permissions(_=Depends(require_permission("users.read"))):
    return {"permissions": ALL_PERMISSIONS}


@router.get("")
async def list_users(_=Depends(require_permission("users.read"))):
    # Solo usuarios CMS: tienen rol distinto de "customer" o son superadmin
    users = await db.users.find(
        {"$or": [{"role": {"$ne": "customer"}}, {"is_superadmin": True}]},
        {"_id": 0, "password_hash": 0}
    ).sort("created_at", 1).to_list(1000)
    return users


@router.get("/web")
async def list_web_users(_=Depends(require_permission("customers.read"))):
    """Usuarios de la tienda (clientes registrados via storefront).
    Viven en `db.customers` — colección separada de los usuarios CMS."""
    cursor = db.customers.find(
        {},
        {"_id": 0, "password_hash": 0, "verification_token": 0, "reset_token": 0,
         "reset_token_expires": 0, "verification_expires": 0}
    ).sort("created_at", -1)
    items = []
    async for c in cursor:
        # Normaliza campos para la UI (el modelo guarda 'name', la UI espera
        # first_name/last_name — partimos del 'name' completo)
        full_name = c.get("name") or ""
        if " " in full_name and not c.get("first_name"):
            parts = full_name.split(" ", 1)
            c.setdefault("first_name", parts[0])
            c.setdefault("last_name", parts[1] if len(parts) > 1 else "")
        else:
            c.setdefault("first_name", full_name)
            c.setdefault("last_name", "")
        c.setdefault("is_verified", bool(c.get("verified", False)))
        # Aplana la dirección por defecto (envío, o billing, o la primera)
        addrs = c.get("addresses") or []
        default = next((a for a in addrs if a.get("is_default_shipping")), None) or \
                  next((a for a in addrs if a.get("is_default_billing")), None) or \
                  (addrs[0] if addrs else {})
        c["address"] = default.get("address", "")
        c["city"] = default.get("city", "")
        c["postal_code"] = default.get("postal_code", "")
        c["country"] = default.get("country", "España")
        items.append(c)
    return items


class WebUserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    password: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None


@router.patch("/web/{customer_id}")
async def update_web_user(customer_id: str, payload: WebUserUpdate,
                          _=Depends(require_permission("customers.write"))):
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if payload.first_name is not None or payload.last_name is not None:
        fn = payload.first_name if payload.first_name is not None else (customer.get("first_name") or "")
        ln = payload.last_name if payload.last_name is not None else (customer.get("last_name") or "")
        updates["first_name"] = fn
        updates["last_name"] = ln
        updates["name"] = (fn + " " + ln).strip() or (payload.name or customer.get("name", ""))
    elif payload.name is not None:
        updates["name"] = payload.name
    if payload.phone is not None:
        updates["phone"] = payload.phone
    if payload.is_active is not None:
        updates["is_active"] = payload.is_active
    if payload.is_verified is not None:
        updates["is_verified"] = payload.is_verified
        updates["verified"] = payload.is_verified
    if payload.password is not None:
        if not validate_password(payload.password):
            raise HTTPException(status_code=400, detail=PASSWORD_RULES_MSG)
        updates["password_hash"] = hash_password(payload.password)

    # Actualiza/crea la dirección por defecto si llega algún campo de dirección
    addr_keys = ("address", "city", "postal_code", "country")
    addr_payload = {k: getattr(payload, k) for k in addr_keys}
    if any(v is not None for v in addr_payload.values()):
        addresses = list(customer.get("addresses") or [])
        idx = next((i for i, a in enumerate(addresses) if a.get("is_default_shipping")), -1)
        cur = addresses[idx] if idx >= 0 else {}
        new_addr = {
            "label": cur.get("label", "Principal"),
            "full_name": updates.get("name") or customer.get("name", ""),
            "address": addr_payload["address"] if addr_payload["address"] is not None else cur.get("address", ""),
            "city": addr_payload["city"] if addr_payload["city"] is not None else cur.get("city", ""),
            "postal_code": addr_payload["postal_code"] if addr_payload["postal_code"] is not None else cur.get("postal_code", ""),
            "country": addr_payload["country"] if addr_payload["country"] is not None else cur.get("country", "España"),
            "phone": customer.get("phone", ""),
            "is_default_billing": True,
            "is_default_shipping": True,
        }
        if idx >= 0:
            addresses[idx] = new_addr
        else:
            addresses.insert(0, new_addr)
        updates["addresses"] = addresses

    await db.customers.update_one({"id": customer_id}, {"$set": updates})
    updated = await db.customers.find_one(
        {"id": customer_id},
        {"_id": 0, "password_hash": 0, "verification_token": 0, "reset_token": 0}
    )
    return updated


@router.delete("/web/{customer_id}")
async def delete_web_user(customer_id: str,
                          _=Depends(require_permission("customers.delete"))):
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    await db.customers.delete_one({"id": customer_id})
    return {"ok": True}


@router.post("")
async def create_user(payload: UserCreate, _=Depends(require_permission("users.write"))):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Ya existe un usuario con este email")
    if not validate_password(payload.password):
        raise HTTPException(status_code=400, detail=PASSWORD_RULES_MSG)
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "role": payload.role,
        "permissions": payload.permissions,
        "is_active": payload.is_active,
        "is_superadmin": False,
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


@router.patch("/{user_id}")
async def update_user(user_id: str, payload: UserUpdate, current=Depends(require_permission("users.write"))):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.role is not None and not user.get("is_superadmin"):
        updates["role"] = payload.role
    if payload.permissions is not None and not user.get("is_superadmin"):
        updates["permissions"] = payload.permissions
    if payload.is_active is not None:
        if user.get("is_superadmin") and payload.is_active is False:
            raise HTTPException(status_code=400, detail="No se puede desactivar al superadmin")
        updates["is_active"] = payload.is_active
    if payload.password is not None:
        if not validate_password(payload.password):
            raise HTTPException(status_code=400, detail=PASSWORD_RULES_MSG)
        updates["password_hash"] = hash_password(payload.password)

    await db.users.update_one({"id": user_id}, {"$set": updates})
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return updated


@router.delete("/{user_id}")
async def delete_user(user_id: str, current=Depends(require_permission("users.delete"))):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.get("is_superadmin"):
        raise HTTPException(status_code=400, detail="El superadmin no puede ser eliminado")
    if user["id"] == current["id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")
    await db.users.delete_one({"id": user_id})
    return {"ok": True}
