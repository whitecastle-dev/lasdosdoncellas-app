"""Customer accounts (storefront): register, login, profile + addresses."""
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
from db import db
from auth import (
    hash_password, verify_password, create_access_token, validate_password,
    PASSWORD_RULES_MSG, decode_token,
)

router = APIRouter(prefix="/api/customer", tags=["customer"])

CUSTOMER_COLLECTION = "customers"


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class AddressIn(BaseModel):
    label: Optional[str] = "Principal"  # "Casa", "Oficina"
    full_name: str
    address: str
    city: str
    postal_code: str
    country: str = "España"
    phone: Optional[str] = ""
    tax_id: Optional[str] = ""
    is_default_billing: bool = False
    is_default_shipping: bool = False


class ProfileIn(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    tax_id: Optional[str] = None


async def get_current_customer(request: Request) -> dict:
    token = request.cookies.get("customer_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    payload = decode_token(token)
    if payload.get("type") != "customer":
        raise HTTPException(status_code=401, detail="Tipo de token inválido")
    customer = await db[CUSTOMER_COLLECTION].find_one({"id": payload["sub"]}, {"password_hash": 0})
    if not customer:
        raise HTTPException(status_code=401, detail="Cliente no encontrado")
    customer.pop("_id", None)
    return customer


def _create_customer_token(customer_id: str, email: str) -> str:
    """Same shape as admin token but type='customer'."""
    import jwt
    import os
    from datetime import timedelta
    payload = {
        "sub": customer_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "type": "customer",
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm="HS256")


@router.post("/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    existing = await db[CUSTOMER_COLLECTION].find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una cuenta con este email")
    if not validate_password(payload.password):
        raise HTTPException(status_code=400, detail=PASSWORD_RULES_MSG)
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "phone": payload.phone or "",
        "tax_id": "",
        "addresses": [],
        "stripe_customer_id": None,
        "google_id": None,
        "created_at": now,
        "updated_at": now,
    }
    await db[CUSTOMER_COLLECTION].insert_one(doc)
    token = _create_customer_token(doc["id"], email)
    response.set_cookie("customer_token", token, httponly=True, secure=True, samesite="none", max_age=30 * 86400, path="/")
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return {"customer": doc, "access_token": token}


@router.post("/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    c = await db[CUSTOMER_COLLECTION].find_one({"email": email})
    if not c or not verify_password(payload.password, c.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    token = _create_customer_token(c["id"], c["email"])
    response.set_cookie("customer_token", token, httponly=True, secure=True, samesite="none", max_age=30 * 86400, path="/")
    c.pop("_id", None)
    c.pop("password_hash", None)
    return {"customer": c, "access_token": token}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("customer_token", path="/")
    return {"ok": True}


@router.get("/me")
async def me(customer: dict = Depends(get_current_customer)):
    return customer


@router.patch("/me")
async def update_profile(payload: ProfileIn, customer: dict = Depends(get_current_customer)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db[CUSTOMER_COLLECTION].update_one({"id": customer["id"]}, {"$set": updates})
    updated = await db[CUSTOMER_COLLECTION].find_one({"id": customer["id"]}, {"_id": 0, "password_hash": 0})
    return updated


# ---------- Addresses ----------
@router.get("/addresses")
async def list_addresses(customer: dict = Depends(get_current_customer)):
    return customer.get("addresses", [])


@router.post("/addresses")
async def add_address(payload: AddressIn, customer: dict = Depends(get_current_customer)):
    new_addr = payload.model_dump()
    new_addr["id"] = str(uuid.uuid4())
    addresses = customer.get("addresses", []) or []

    # If marked default, clear others
    if new_addr.get("is_default_billing"):
        for a in addresses:
            a["is_default_billing"] = False
    if new_addr.get("is_default_shipping"):
        for a in addresses:
            a["is_default_shipping"] = False
    # First address auto-default
    if not addresses:
        new_addr["is_default_billing"] = True
        new_addr["is_default_shipping"] = True

    addresses.append(new_addr)
    await db[CUSTOMER_COLLECTION].update_one(
        {"id": customer["id"]},
        {"$set": {"addresses": addresses, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return new_addr


@router.patch("/addresses/{address_id}")
async def update_address(address_id: str, payload: AddressIn, customer: dict = Depends(get_current_customer)):
    addresses = customer.get("addresses", []) or []
    found = None
    for a in addresses:
        if a.get("id") == address_id:
            found = a
            break
    if not found:
        raise HTTPException(status_code=404, detail="Dirección no encontrada")
    updates = payload.model_dump()
    # Clear defaults on others if this becomes default
    if updates.get("is_default_billing"):
        for a in addresses:
            a["is_default_billing"] = False
    if updates.get("is_default_shipping"):
        for a in addresses:
            a["is_default_shipping"] = False
    for k, v in updates.items():
        found[k] = v
    await db[CUSTOMER_COLLECTION].update_one(
        {"id": customer["id"]},
        {"$set": {"addresses": addresses, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return found


@router.delete("/addresses/{address_id}")
async def delete_address(address_id: str, customer: dict = Depends(get_current_customer)):
    addresses = [a for a in (customer.get("addresses") or []) if a.get("id") != address_id]
    await db[CUSTOMER_COLLECTION].update_one(
        {"id": customer["id"]},
        {"$set": {"addresses": addresses, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True}


# ---------- Customer's own orders ----------
@router.get("/orders")
async def my_orders(customer: dict = Depends(get_current_customer)):
    import re as _re
    email_regex = f"^{_re.escape(customer['email'])}$"
    cursor = db.orders.find(
        {"customer.email": {"$regex": email_regex, "$options": "i"}},
        {"_id": 0},
    ).sort("created_at", -1).limit(50)
    return [o async for o in cursor]
