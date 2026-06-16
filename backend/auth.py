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
    verify_url = f"https://lasdosdoncellas-api.onrender.com/api/auth/verify?token={token}"
    params = {
        "from": "Las Dos Doncellas <onboarding@resend.dev>",
        "to": [email_to],
        "subject": "Verifica tu cuenta en Las Dos Doncellas",
        "html": f"<p>Hola,</p><p>Gracias por registrarte. Haz clic aquí para verificar tu cuenta:</p><a href='{verify_url}'>Verificar cuenta</a>"
    }
    try:
        resend.Emails.send(params)
    except Exception as e:
        print(f"Error enviando correo de verificación: {e}")

async def send_password_reset_email(email_to: str, token: str):
    # Ajusta esta URL a la ruta de tu frontend
    reset_url = f"https://lasdosdoncellas.com/cuenta/restablecer?token={token}"
    params = {
        "from": "Las Dos Doncellas <onboarding@resend.dev>",
        "to": [email_to],
        "subject": "Restablece tu contraseña - Las Dos Doncellas",
        "html": f"<p>Hola,</p><p>Has solicitado restablecer tu contraseña. Haz clic aquí:</p><a href='{reset_url}'>Restablecer contraseña</a><p>Si no lo solicitaste, ignora este correo.</p>"
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
            "password_hash