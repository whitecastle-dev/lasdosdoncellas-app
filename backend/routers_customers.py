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
    """Obtiene al cliente autenticado. Soporta DOS flujos:

    1) Flujo unificado (actual): el cliente vive en `db.users` con role='customer'.
       El token es type='access' y se envía vía Bearer (preferente) o cookie
       `access_token`.
    2) Flujo legacy: el cliente vive en `db.customers` con token type='customer'
       y cookie `customer_token`.

    Esto es necesario porque /api/auth/register/login (sistema unificado) escribe
    en db.users, pero las reseñas / direcciones / pedidos del storefront se
    diseñaron originalmente contra /api/customer/*. Si solo aceptásemos el
    flujo legacy, los clientes registrados por el sistema unificado no podrían
    reseñar ni gestionar direcciones.
    """
    # 1) Bearer header tiene prioridad (no se ve afectado por cookies del admin)
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    # 2) Si no hay Bearer, probamos cookies — primero la nueva (access_token),
    #    luego la legacy (customer_token)
    if not token:
        token = request.cookies.get("access_token") or request.cookies.get("customer_token")
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")

    payload = decode_token(token)
    ttype = payload.get("type")

    # --- Flujo unificado ---
    if ttype == "access":
        user = await db.users.find_one({"id": payload["sub"]}, {"password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Cuenta no encontrada")
        if user.get("is_superadmin"):
            raise HTTPException(status_code=403, detail="Esta acción requiere una cuenta de cliente")
        if user.get("is_active") is False:
            raise HTTPException(status_code=403, detail="Cuenta inactiva")
        user.pop("_id", None)
        # Normaliza el campo name (auth-system guarda first_name/last_name)
        if not user.get("name"):
            fn = user.get("first_name", "") or ""
            ln = user.get("last_name", "") or ""
            user["name"] = f"{fn} {ln}".strip() or user.get("email", "")
        user["_source"] = "users"
        return user

    # --- Flujo legacy ---
    if ttype == "customer":
        customer = await db[CUSTOMER_COLLECTION].find_one({"id": payload["sub"]}, {"password_hash": 0})
        if not customer:
            raise HTTPException(status_code=401, detail="Cliente no encontrado")
        customer.pop("_id", None)
        customer["_source"] = CUSTOMER_COLLECTION
        return customer

    raise HTTPException(status_code=401, detail="Tipo de token inválido")


def _coll(customer: dict):
    """Colección real donde vive el cliente autenticado (users o customers)."""
    return db[customer.get("_source") or CUSTOMER_COLLECTION]


def _public(doc: dict) -> dict:
    for k in ("_id", "password_hash", "verification_token", "reset_token", "_source"):
        doc.pop(k, None)
    return doc


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
    return _public(dict(customer))


@router.patch("/me")
async def update_profile(payload: ProfileIn, customer: dict = Depends(get_current_customer)):
    updates = {k: v.strip() if isinstance(v, str) else v for k, v in payload.model_dump().items() if v is not None}
    if "name" in updates and customer.get("_source") == "users":
        parts = updates["name"].split(" ", 1)
        updates["first_name"] = parts[0]
        updates["last_name"] = parts[1] if len(parts) > 1 else ""
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    coll = _coll(customer)
    await coll.update_one({"id": customer["id"]}, {"$set": updates})
    updated = await coll.find_one({"id": customer["id"]})
    return _public(updated)


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
    await _coll(customer).update_one(
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
    await _coll(customer).update_one(
        {"id": customer["id"]},
        {"$set": {"addresses": addresses, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return found


@router.delete("/addresses/{address_id}")
async def delete_address(address_id: str, customer: dict = Depends(get_current_customer)):
    addresses = [a for a in (customer.get("addresses") or []) if a.get("id") != address_id]
    await _coll(customer).update_one(
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
        {"$or": [{"user_id": customer["id"]}, {"customer.email": {"$regex": email_regex, "$options": "i"}}]},
        {"_id": 0},
    ).sort("created_at", -1).limit(50)
    return [o async for o in cursor]


# ---------- Saved payment methods (alias de tarjeta, sin PAN) ----------
# Versión ligera: guardamos solo marca + últimos 4 + caducidad + titular.
# El campo `redsys_token` queda reservado para "Pago por referencia" (COF)
# cuando CaixaBank lo active en el contrato TPV.
CARD_BRANDS = {"visa", "mastercard", "amex", "maestro", "otra"}


class PaymentMethodIn(BaseModel):
    brand: str
    last4: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$")
    exp_month: int = Field(..., ge=1, le=12)
    exp_year: int = Field(..., ge=2024, le=2060)
    holder: str = Field(..., min_length=2, max_length=80)
    label: Optional[str] = ""
    is_default: bool = False


class PaymentMethodPatch(BaseModel):
    label: Optional[str] = None
    is_default: Optional[bool] = None


def _check_not_expired(month: int, year: int):
    now = datetime.now(timezone.utc)
    if (year, month) < (now.year, now.month):
        raise HTTPException(status_code=400, detail="La tarjeta está caducada")


@router.get("/payment-methods")
async def list_payment_methods(customer: dict = Depends(get_current_customer)):
    return customer.get("payment_methods", []) or []


@router.post("/payment-methods")
async def add_payment_method(payload: PaymentMethodIn, customer: dict = Depends(get_current_customer)):
    brand = payload.brand.lower().strip()
    if brand not in CARD_BRANDS:
        raise HTTPException(status_code=400, detail="Marca de tarjeta no soportada")
    _check_not_expired(payload.exp_month, payload.exp_year)
    methods = customer.get("payment_methods", []) or []
    pm = payload.model_dump()
    pm.update({"id": str(uuid.uuid4()), "brand": brand, "redsys_token": None,
               "created_at": datetime.now(timezone.utc).isoformat()})
    if pm["is_default"] or not methods:
        for m in methods:
            m["is_default"] = False
        pm["is_default"] = True
    methods.append(pm)
    await _coll(customer).update_one({"id": customer["id"]}, {"$set": {
        "payment_methods": methods, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return pm


@router.patch("/payment-methods/{pm_id}")
async def update_payment_method(pm_id: str, payload: PaymentMethodPatch, customer: dict = Depends(get_current_customer)):
    methods = customer.get("payment_methods", []) or []
    found = next((m for m in methods if m.get("id") == pm_id), None)
    if not found:
        raise HTTPException(status_code=404, detail="Forma de pago no encontrada")
    if payload.label is not None:
        found["label"] = payload.label
    if payload.is_default:
        for m in methods:
            m["is_default"] = False
        found["is_default"] = True
    await _coll(customer).update_one({"id": customer["id"]}, {"$set": {
        "payment_methods": methods, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return found


@router.delete("/payment-methods/{pm_id}")
async def delete_payment_method(pm_id: str, customer: dict = Depends(get_current_customer)):
    methods = [m for m in (customer.get("payment_methods") or []) if m.get("id") != pm_id]
    if methods and not any(m.get("is_default") for m in methods):
        methods[0]["is_default"] = True
    await _coll(customer).update_one({"id": customer["id"]}, {"$set": {
        "payment_methods": methods, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True}


# ---------- Baja de la cuenta (reversible, 30 días) ----------
DELETION_GRACE_DAYS = 30


class DeleteAccountIn(BaseModel):
    password: str
    reason: Optional[str] = ""


@router.post("/account/delete")
async def request_account_deletion(payload: DeleteAccountIn, customer: dict = Depends(get_current_customer)):
    full = await _coll(customer).find_one({"id": customer["id"]})
    if not full or not verify_password(payload.password, full.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Contraseña incorrecta")
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    due = now + timedelta(days=DELETION_GRACE_DAYS)
    await _coll(customer).update_one({"id": customer["id"]}, {"$set": {
        "pending_deletion": True,
        "deletion_requested_at": now.isoformat(),
        "deletion_due_at": due.isoformat(),
        "deletion_reason": (payload.reason or "")[:500],
        "updated_at": now.isoformat(),
    }})
    return {"ok": True, "deletion_due_at": due.isoformat(), "grace_days": DELETION_GRACE_DAYS}


@router.post("/account/cancel-deletion")
async def cancel_account_deletion(customer: dict = Depends(get_current_customer)):
    await _coll(customer).update_one({"id": customer["id"]}, {
        "$set": {"pending_deletion": False, "updated_at": datetime.now(timezone.utc).isoformat()},
        "$unset": {"deletion_requested_at": "", "deletion_due_at": "", "deletion_reason": ""},
    })
    return {"ok": True}


async def purge_due_accounts() -> int:
    """Borra definitivamente las cuentas cuyo plazo de 30 días ha vencido.
    Los pedidos se conservan anonimizados (obligación fiscal)."""
    now_iso = datetime.now(timezone.utc).isoformat()
    purged = 0
    for coll in (db.users, db[CUSTOMER_COLLECTION]):
        async for u in coll.find({"pending_deletion": True, "deletion_due_at": {"$lte": now_iso}}, {"id": 1, "email": 1}):
            anon = f"baja-{u['id'][:8]}@anonimizado.local"
            await db.orders.update_many(
                {"$or": [{"user_id": u["id"]}, {"customer.email": u.get("email", "")}]},
                {"$set": {"customer.email": anon, "customer.name": "Cliente dado de baja", "customer.phone": "",
                          "customer_anonymized_at": now_iso}},
            )
            await db.reviews.update_many({"customer_id": u["id"]}, {"$set": {"customer_name": "Cliente"}})
            await coll.delete_one({"id": u["id"]})
            purged += 1
    return purged
