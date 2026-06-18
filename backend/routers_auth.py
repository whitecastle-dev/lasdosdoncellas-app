"""Auth routes with registration, email verification, and name/last name fields."""
import uuid
import secrets
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field, ConfigDict
import os
from db import db
from auth import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    decode_token, get_current_user, generate_verification_token, validate_password, 
    PASSWORD_RULES_MSG, send_verification_email, send_password_reset_email
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    first_name: str = Field(..., min_length=2)
    last_name: str = Field(..., min_length=2)

class ForgotPasswordIn(BaseModel):
    email: EmailStr

class ResetPasswordIn(BaseModel):
    model_config = ConfigDict(extra='ignore')  # Ignora campos extras enviados por el frontend
    token: str
    new_password: str
    email: str = None  # Opcional para compatibilidad

@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Ruta para obtener los datos del usuario actual."""
    return user

@router.post("/register")
async def register(payload: RegisterIn):
    if not validate_password(payload.password):
        raise HTTPException(status_code=400, detail=PASSWORD_RULES_MSG)
    
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    now = datetime.now(timezone.utc).isoformat()
    verification_token = generate_verification_token()
    
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(payload.password),
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "role": "customer",
        "is_superadmin": False,
        "permissions": [],
        "addresses": [],
        "is_active": True,
        "is_verified": False,
        "verification_token": verification_token,
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(user_doc)
    
    async def run_email_task():
        try:
            await send_verification_email(email, verification_token)
        except Exception as e:
            print(f"Error crítico enviando correo: {e}")

    asyncio.create_task(run_email_task())
    return {"message": "Usuario registrado. Por favor, verifica tu correo."}

@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordIn):
    user = await db.users.find_one({"email": payload.email.lower().strip()})
    if user:
        token = secrets.token_urlsafe(32)
        await db.users.update_one({"id": user["id"]}, {"$set": {"reset_token": token}})
        asyncio.create_task(send_password_reset_email(user["email"], token))
    return {"message": "Si el email existe, se ha enviado un enlace."}

@router.post("/reset-password")
async def reset_password(payload: ResetPasswordIn):
    if not validate_password(payload.new_password):
        raise HTTPException(status_code=400, detail=PASSWORD_RULES_MSG)
    
    # Buscamos al usuario por el token recibido
    token_to_verify = payload.token.strip()
    user = await db.users.find_one({"reset_token": token_to_verify})
    
    if not user:
        print(f"DEBUG: Intento de reset fallido con token: {token_to_verify}")
        raise HTTPException(status_code=400, detail="El enlace ha expirado o es inválido.")
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": hash_password(payload.new_password)}, "$unset": {"reset_token": ""}}
    )
    return {"message": "Contraseña actualizada exitosamente."}

@router.get("/verify")
async def verify_email(token: str):
    front = os.environ.get("FRONTEND_URL", "https://lasdosdoncellas-web.onrender.com")
    user = await db.users.find_one({"verification_token": token})
    if not user:
        return RedirectResponse(url=f"{front}/cuenta/login?verified=invalid", status_code=302)

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"is_verified": True}, "$unset": {"verification_token": ""}}
    )
    return RedirectResponse(url=f"{front}/cuenta/login?verified=ok", status_code=302)

@router.post("/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    # Superadmin queda exento de la verificación de email
    if not user.get("is_verified", False) and not user.get("is_superadmin", False):
        raise HTTPException(status_code=403, detail="Debes verificar tu correo antes de iniciar sesión.")
    if user.get("is_active") is False:
        raise HTTPException(status_code=403, detail="Usuario inactivo")

    access = create_access_token(user["id"], user["email"])
    refresh = create_refresh_token(user["id"])

    # SameSite=none + Secure es REQUERIDO cuando front y back viven en
    # subdominios distintos (lasdosdoncellas-web vs lasdosdoncellas-api).
    # Con samesite="lax" el navegador descarta la cookie en cross-site fetches.
    cookie_kwargs = {"httponly": True, "secure": True, "samesite": "none", "path": "/"}
    response.set_cookie(key="access_token", value=access, max_age=12 * 3600, **cookie_kwargs)
    response.set_cookie(key="refresh_token", value=refresh, max_age=7 * 86400, **cookie_kwargs)

    # Devolvemos también access_token + user en el body para que el frontend
    # tenga fallback con Authorization: Bearer cuando las cookies cross-site
    # sean bloqueadas (Safari, modo incógnito, algunas configuraciones de Chrome).
    user.pop("_id", None)
    user.pop("password_hash", None)
    user.pop("verification_token", None)
    user.pop("reset_token", None)

    return {
        "message": "Inicio de sesión exitoso",
        "user": user,
        "access_token": access,
    }


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Devuelve los datos del usuario autenticado (cliente o admin)."""
    return user


@router.get("/orders")
async def my_orders(user: dict = Depends(get_current_user)):
    """Pedidos del usuario autenticado (búsqueda por email — case insensitive)."""
    import re as _re
    email_regex = f"^{_re.escape(user['email'])}$"
    cursor = db.orders.find(
        {"customer.email": {"$regex": email_regex, "$options": "i"}},
        {"_id": 0},
    ).sort("created_at", -1).limit(100)
    return [o async for o in cursor]