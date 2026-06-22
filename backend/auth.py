"""Authentication helpers: password hashing, JWT, email verification, and user management."""
import os
import re
import uuid
import bcrypt
import jwt
import secrets
import resend
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Request, Depends
from db import db

JWT_ALGORITHM = "HS256"

# Configuración de Resend
resend.api_key = os.environ.get("RESEND_API_KEY")

# Permission catalog
ALL_PERMISSIONS = [
    "dashboard.read",
    "products.read", "products.write", "products.delete",
    "orders.read", "orders.write", "orders.delete",
    "users.read", "users.write", "users.delete",
    "customers.read", "customers.write", "customers.delete",
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

def generate_verification_token() -> str:
    return secrets.token_urlsafe(32)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def send_verification_email(email_to: str, token: str):
    api_base = os.environ.get("API_BASE_URL", "https://lasdosdoncellas-api.onrender.com")
    sender = os.environ.get("RESEND_FROM_EMAIL", "Las Dos Doncellas <onboarding@resend.dev>")
    verify_url = f"{api_base}/api/auth/verify?token={token}"
    params = {
        "from": sender,
        "to": [email_to],
        "subject": "Verifica tu cuenta en Las Dos Doncellas",
        "html": (
            "<div style='font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:24px;background:#FAF8F5;'>"
            "<h2 style='font-weight:normal;color:#0A0A0A;'>Las Dos Doncellas</h2>"
            "<p style='color:#3B2B20;'>Gracias por registrarte. Pulsa el botón para verificar tu cuenta:</p>"
            f"<p style='margin:24px 0;'><a href='{verify_url}' style='background:#C5A059;color:#0A0A0A;padding:12px 24px;text-decoration:none;letter-spacing:0.1em;'>VERIFICAR CUENTA</a></p>"
            f"<p style='color:#666;font-size:12px;'>O copia este enlace: {verify_url}</p>"
            "</div>"
        ),
    }
    try:
        resend.Emails.send(params)
    except Exception as e:
        print(f"Error enviando correo de verificación: {e}")

async def send_password_reset_email(email_to: str, token: str):
    front = os.environ.get("FRONTEND_URL", "https://lasdosdoncellas-web.onrender.com")
    sender = os.environ.get("RESEND_FROM_EMAIL", "Las Dos Doncellas <onboarding@resend.dev>")
    reset_url = f"{front}/cuenta/restablecer?token={token}"
    params = {
        "from": sender,
        "to": [email_to],
        "subject": "Restablece tu contraseña - Las Dos Doncellas",
        "html": (
            "<div style='font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:24px;background:#FAF8F5;'>"
            "<h2 style='font-weight:normal;color:#0A0A0A;'>Las Dos Doncellas</h2>"
            "<p style='color:#3B2B20;'>Has solicitado restablecer tu contraseña. Pulsa el botón para crear una nueva:</p>"
            f"<p style='margin:24px 0;'><a href='{reset_url}' style='background:#C5A059;color:#0A0A0A;padding:12px 24px;text-decoration:none;letter-spacing:0.1em;'>RESTABLECER CONTRASEÑA</a></p>"
            "<p style='color:#666;font-size:12px;'>Si no lo solicitaste, ignora este correo.</p>"
            "</div>"
        ),
    }
    try:
        resend.Emails.send(params)
    except Exception as e:
        print(f"Error enviando correo de reseteo: {e}")

PASSWORD_RULES_MSG = "La contraseña debe tener mínimo 8 caracteres y contener al menos una mayúscula, una minúscula y un número."

def validate_password(password: str) -> bool:
    if not password or len(password) < 8: return False
    if not re.search(r"[A-Z]", password): return False
    if not re.search(r"[a-z]", password): return False
    if not re.search(r"[0-9]", password): return False
    return True

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
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
        if auth_header.startswith("Bearer "): token = auth_header[7:]
    if not token: raise HTTPException(status_code=401, detail="No autenticado")
    
    payload = decode_token(token)
    if payload.get("type") != "access": raise HTTPException(status_code=401, detail="Tipo de token inválido")
    
    user = await db.users.find_one({"id": payload["sub"]}, {"password_hash": 0})
    if not user: raise HTTPException(status_code=401, detail="Usuario no encontrado")
    
    if not user.get("is_verified", False):
        raise HTTPException(status_code=403, detail="Cuenta no verificada. Por favor, revisa tu correo.")
    if user.get("is_active") is False:
        raise HTTPException(status_code=403, detail="Usuario inactivo")
        
    user.pop("_id", None)
    return user

def require_permission(permission: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if not user.get("is_superadmin") and permission not in (user.get("permissions") or []):
            raise HTTPException(status_code=403, detail=f"Permiso requerido: {permission}")
        return user
    return dep

async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@lasdosdoncellas.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin1234")
    existing = await db.users.find_one({"email": admin_email})
    now = datetime.now(timezone.utc).isoformat()
    
    if existing is None:
        doc = {
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "first_name": "Super",
            "last_name": "Administrador",
            "role": "superadmin",
            "is_superadmin": True,
            "is_active": True,
            "is_verified": True,
            "permissions": ALL_PERMISSIONS,
            "created_at": now,
            "updated_at": now,
        }
        await db.users.insert_one(doc)
    else:
        updates = {"is_superadmin": True, "is_active": True, "is_verified": True, "role": "superadmin", "permissions": ALL_PERMISSIONS}
        if not verify_password(admin_password, existing.get("password_hash", "")):
            updates["password_hash"] = hash_password(admin_password)
        await db.users.update_one({"email": admin_email}, {"$set": updates})