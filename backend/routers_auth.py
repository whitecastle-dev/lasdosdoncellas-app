"""Auth routes with registration, email verification, and name/last name fields."""
import uuid
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field
from db import db
from auth import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    decode_token, get_current_user, generate_verification_token, validate_password, PASSWORD_RULES_MSG
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

@router.post("/register")
async def register(payload: RegisterIn):
    if not validate_password(payload.password):
        raise HTTPException(status_code=400, detail=PASSWORD_RULES_MSG)
    
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    # Crear usuario con estado no verificado
    now = datetime.now(timezone.utc).isoformat()
    verification_token = generate_verification_token()
    
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(payload.password),
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "is_active": True,
        "is_verified": False,
        "verification_token": verification_token,
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(user_doc)
    
    # AQUÍ DEBES LLAMAR A TU FUNCIÓN DE ENVÍO DE EMAIL
    # send_verification_email(email, verification_token)
    
    return {"message": "Usuario registrado. Por favor, verifica tu correo."}

@router.get("/verify")
async def verify_email(token: str):
    user = await db.users.find_one({"verification_token": token})
    if not user:
        raise HTTPException(status_code=400, detail="Token de verificación inválido")
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"is_verified": True}, "$unset": {"verification_token": ""}}
    )
    return {"message": "Cuenta verificada correctamente. Ya puedes iniciar sesión."}

@router.post("/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    
    # Validar verificación
    if not user.get("is_verified", False):
        raise HTTPException(status_code=403, detail="Debes verificar tu correo antes de iniciar sesión.")
    
    if user.get("is_active") is False:
        raise HTTPException(status_code=403, detail="Usuario inactivo")

    access = create_access_token(user["id"], user["email"])
    refresh = create_refresh_token(user["id"])
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none",
                        max_age=12 * 3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none",
                        max_age=7 * 86400, path="/")
    
    user_data = user.copy()
    user_data.pop("_id", None)
    user_data.pop("password_hash", None)
    return {"user": user_data, "access_token": access}

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}

@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Tipo de token inválido")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    access = create_access_token(user["id"], user["email"])
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none",
                        max_age=12 * 3600, path="/")
    return {"ok": True}