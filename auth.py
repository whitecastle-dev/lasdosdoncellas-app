"""Authentication helpers: password hashing, JWT, current user dependency."""
import os
import re
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Request, Depends
from db import db

JWT_ALGORITHM = "HS256"

# Permission catalog
ALL_PERMISSIONS = [
    "dashboard.read",
    "products.read", "products.write", "products.delete",
    "orders.read", "orders.write", "orders.delete",
    "users.read", "users.write", "users.delete",
    "settings.write",
]


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


PASSWORD_RULES_MSG = "La contraseña debe tener mínimo 8 caracteres y contener al menos una mayúscula, una minúscula y un número."


def validate_password(password: str) -> bool:
    if not password or len(password) < 8:
        return False
    if not re.search(r"[A-Z]", password):
        return False
    if not re.search(r"[a-z]", password):
        return False
    if not re.search(r"[0-9]", password):
        return False
    return True


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Tipo de token inválido")
    user = await db.users.find_one({"id": payload["sub"]}, {"password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    if user.get("is_active") is False:
        raise HTTPException(status_code=403, detail="Usuario inactivo")
    user.pop("_id", None)
    return user


def user_has_permission(user: dict, permission: str) -> bool:
    if user.get("is_superadmin"):
        return True
    return permission in (user.get("permissions") or [])


def require_permission(permission: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if not user_has_permission(user, permission):
            raise HTTPException(status_code=403, detail=f"Permiso requerido: {permission}")
        return user
    return dep


async def seed_admin():
    """Seed the non-deletable superadmin user."""
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@lasdosdoncellas.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin1234")
    existing = await db.users.find_one({"email": admin_email})
    now = datetime.now(timezone.utc).isoformat()
    if existing is None:
        doc = {
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Super Administrador",
            "role": "superadmin",
            "is_superadmin": True,
            "is_active": True,
            "permissions": ALL_PERMISSIONS,
            "created_at": now,
            "updated_at": now,
        }
        await db.users.insert_one(doc)
    else:
        # ensure flag and password are aligned with current env
        updates = {"is_superadmin": True, "is_active": True, "role": "superadmin", "permissions": ALL_PERMISSIONS}
        if not verify_password(admin_password, existing["password_hash"]):
            updates["password_hash"] = hash_password(admin_password)
        await db.users.update_one({"email": admin_email}, {"$set": updates})
