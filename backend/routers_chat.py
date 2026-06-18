"""Chat interno entre clientes y admin. Persistencia permanente en MongoDB."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from db import db
from auth import get_current_user, require_permission

router = APIRouter(prefix="/api/chat", tags=["chat"])


class SendIn(BaseModel):
    message: str
    to_user_id: Optional[str] = None  # solo si el remitente es admin


@router.post("/send")
async def send_message(payload: SendIn, user: dict = Depends(get_current_user)):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Mensaje vacío")

    is_admin = bool(user.get("is_superadmin") or "users.read" in (user.get("permissions") or []))
    if is_admin and not payload.to_user_id:
        raise HTTPException(status_code=400, detail="Admin debe indicar to_user_id")

    thread_user_id = payload.to_user_id if is_admin else user["id"]

    doc = {
        "id": str(uuid.uuid4()),
        "thread_user_id": thread_user_id,
        "from_user_id": user["id"],
        "from_admin": is_admin,
        "from_name": f"{user.get('first_name','')} {user.get('last_name','')}".strip() or user["email"],
        "message": payload.message.strip(),
        "read_by_admin": is_admin,
        "read_by_user": not is_admin,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.chat_messages.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/my-messages")
async def my_messages(user: dict = Depends(get_current_user)):
    """Mensajes del thread del cliente actual."""
    cursor = db.chat_messages.find({"thread_user_id": user["id"]}, {"_id": 0}).sort("created_at", 1)
    msgs = [m async for m in cursor]
    # Marca todos los recibidos del admin como leídos
    await db.chat_messages.update_many(
        {"thread_user_id": user["id"], "from_admin": True, "read_by_user": False},
        {"$set": {"read_by_user": True}},
    )
    return msgs


@router.get("/threads")
async def list_threads(_=Depends(require_permission("users.read"))):
    """Admin: lista de threads agrupados por cliente con último mensaje y no leídos."""
    pipeline = [
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$thread_user_id",
            "last_message": {"$first": "$message"},
            "last_at": {"$first": "$created_at"},
            "last_from_admin": {"$first": "$from_admin"},
            "unread": {"$sum": {"$cond": [{"$and": [{"$eq": ["$from_admin", False]}, {"$eq": ["$read_by_admin", False]}]}, 1, 0]}},
            "total": {"$sum": 1},
        }},
        {"$sort": {"last_at": -1}},
    ]
    threads = []
    async for t in db.chat_messages.aggregate(pipeline):
        u = await db.users.find_one({"id": t["_id"]}, {"_id": 0, "first_name": 1, "last_name": 1, "email": 1})
        threads.append({
            "user_id": t["_id"],
            "user_name": f"{(u or {}).get('first_name','')} {(u or {}).get('last_name','')}".strip() or (u or {}).get("email", "Desconocido"),
            "user_email": (u or {}).get("email", ""),
            "last_message": t["last_message"],
            "last_at": t["last_at"],
            "last_from_admin": t["last_from_admin"],
            "unread": t["unread"],
            "total": t["total"],
        })
    return threads


@router.get("/messages/{user_id}")
async def admin_thread(user_id: str, _=Depends(require_permission("users.read"))):
    """Admin: histórico completo de un thread."""
    cursor = db.chat_messages.find({"thread_user_id": user_id}, {"_id": 0}).sort("created_at", 1)
    msgs = [m async for m in cursor]
    await db.chat_messages.update_many(
        {"thread_user_id": user_id, "from_admin": False, "read_by_admin": False},
        {"$set": {"read_by_admin": True}},
    )
    return msgs


@router.get("/unread-count")
async def unread_count(user: dict = Depends(get_current_user)):
    """Para badges: cuántos no leídos tiene el usuario actual."""
    is_admin = bool(user.get("is_superadmin") or "users.read" in (user.get("permissions") or []))
    if is_admin:
        count = await db.chat_messages.count_documents({"from_admin": False, "read_by_admin": False})
    else:
        count = await db.chat_messages.count_documents({"thread_user_id": user["id"], "from_admin": True, "read_by_user": False})
    return {"count": count}
