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
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", 1).to_list(1000)
    return users


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
