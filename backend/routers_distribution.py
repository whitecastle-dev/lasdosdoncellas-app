"""Distribución + TPV Tienda Física — Phase 8.

Collections:
  delivery_notes         albaranes (nº, cliente, items, estado)
  delivery_routes        rutas de reparto (fecha, repartidor, albaranes[])
  pos_tickets            tickets de venta en tienda física
  pos_cash_sessions      apertura/cierre de caja diaria

Engranajes:
  · POS ticket con `close=true` descuenta stock por FIFO y crea movimiento
    de tesorería (entrada) en la cuenta ligada a la sesión de caja.
  · Delivery note con action=deliver descuenta stock. Con action=invoice
    genera un issued_invoice pending.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from db import db
from auth import require_permission

router = APIRouter(prefix="/api", tags=["distribution-pos"])

PERM_READ = "products.read"
PERM_WRITE = "products.write"


def _now(): return datetime.now(timezone.utc).isoformat()
def _today(): return datetime.now(timezone.utc).date().isoformat()

async def _next_seq(prefix: str, coll: str, field: str) -> str:
    y = datetime.now(timezone.utc).year
    n = await db[coll].count_documents({field: {"$regex": f"^{prefix}-{y}-"}})
    return f"{prefix}-{y}-{(n + 1):05d}"


# =================== Delivery notes (albaranes) ===================

class DeliveryItem(BaseModel):
    product_id: Optional[str] = None
    sku: str = ""
    name: str
    qty: float = Field(gt=0)
    unit_price: float = Field(ge=0)


class DeliveryNoteIn(BaseModel):
    client_name: str
    client_id: Optional[str] = None
    client_address: Optional[str] = ""
    items: List[DeliveryItem]
    fecha: str  # YYYY-MM-DD
    notas: Optional[str] = ""


@router.get("/delivery-notes")
async def list_notes(estado: Optional[str] = None, _=Depends(require_permission(PERM_READ))):
    q = {}
    if estado: q["estado"] = estado
    return [n async for n in db.delivery_notes.find(q, {"_id": 0}).sort("fecha", -1)]


@router.post("/delivery-notes")
async def create_note(payload: DeliveryNoteIn, _=Depends(require_permission(PERM_WRITE))):
    items = [{**i.model_dump(), "line_total": round(i.qty * i.unit_price, 2)} for i in payload.items]
    subtotal = sum(i["line_total"] for i in items)
    doc = {
        "id": str(uuid.uuid4()),
        "numero": await _next_seq("ALB", "delivery_notes", "numero"),
        "client_name": payload.client_name, "client_id": payload.client_id,
        "client_address": payload.client_address or "",
        "items": items, "subtotal": round(subtotal, 2), "total": round(subtotal, 2),
        "fecha": payload.fecha, "notas": payload.notas or "",
        "estado": "pendiente",  # pendiente | en_ruta | entregado | incidencia | facturado
        "route_id": None, "invoice_id": None,
        "created_at": _now(),
    }
    await db.delivery_notes.insert_one(doc); doc.pop("_id", None)
    return doc


class NoteAction(BaseModel):
    action: str  # deliver | invoice | incident | reset
    reason: Optional[str] = ""
    vat_pct: float = 10.0


@router.post("/delivery-notes/{nid}/action")
async def act_on_note(nid: str, payload: NoteAction, _=Depends(require_permission(PERM_WRITE))):
    n = await db.delivery_notes.find_one({"id": nid})
    if not n: raise HTTPException(404, "Albarán no encontrado")

    if payload.action == "deliver":
        # Descontar stock por FIFO si el item tiene product_id
        from routers_inventory import _consume_fifo
        for it in n["items"]:
            if it.get("product_id"):
                try: await _consume_fifo(it["product_id"], it["qty"], reference=f"delivery:{nid}")
                except Exception: pass
        await db.delivery_notes.update_one({"id": nid}, {"$set": {"estado": "entregado", "delivered_at": _now()}})

    elif payload.action == "invoice":
        # Generar issued_invoice pending
        subtotal = n["subtotal"]
        vat_amount = subtotal * (payload.vat_pct / 100)
        inv = {
            "id": str(uuid.uuid4()),
            "invoice_number": await _next_seq("EMIT", "issued_invoices", "invoice_number"),
            "client_type": "manual", "client_id": n.get("client_id"),
            "client_name": n["client_name"], "client_tax_id": "", "client_email": "",
            "lines": [{"concepto": i["name"], "qty": i["qty"], "unit_price": i["unit_price"],
                       "line_total": i["line_total"]} for i in n["items"]],
            "subtotal": round(subtotal, 2), "vat_pct": payload.vat_pct,
            "vat_amount": round(vat_amount, 2), "total": round(subtotal + vat_amount, 2),
            "status": "issued", "issue_date": _today(), "due_date": None,
            "paid_at": None, "payment_movement_id": None,
            "notes": f"Generada desde albarán {n['numero']}", "created_at": _now(),
        }
        await db.issued_invoices.insert_one(inv)
        await db.delivery_notes.update_one({"id": nid}, {"$set": {
            "estado": "facturado", "invoice_id": inv["id"],
        }})

    elif payload.action == "incident":
        await db.delivery_notes.update_one({"id": nid}, {"$set": {
            "estado": "incidencia", "incident_reason": payload.reason or "",
        }})
    elif payload.action == "reset":
        await db.delivery_notes.update_one({"id": nid}, {"$set": {"estado": "pendiente"}})
    else:
        raise HTTPException(400, "Acción inválida")
    return await db.delivery_notes.find_one({"id": nid}, {"_id": 0})


# =================== Routes ===================

class RouteIn(BaseModel):
    fecha: str
    repartidor_id: Optional[str] = None
    repartidor_nombre: Optional[str] = ""
    delivery_note_ids: List[str] = Field(default_factory=list)
    notas: Optional[str] = ""


@router.get("/delivery-routes")
async def list_routes(_=Depends(require_permission(PERM_READ))):
    return [r async for r in db.delivery_routes.find({}, {"_id": 0}).sort("fecha", -1)]


@router.post("/delivery-routes")
async def create_route(payload: RouteIn, _=Depends(require_permission(PERM_WRITE))):
    doc = {
        "id": str(uuid.uuid4()),
        "numero": await _next_seq("RUT", "delivery_routes", "numero"),
        **payload.model_dump(),
        "estado": "planificada",
        "created_at": _now(),
    }
    await db.delivery_routes.insert_one(doc); doc.pop("_id", None)
    # Marcar albaranes en_ruta
    if payload.delivery_note_ids:
        await db.delivery_notes.update_many(
            {"id": {"$in": payload.delivery_note_ids}},
            {"$set": {"estado": "en_ruta", "route_id": doc["id"]}},
        )
    return doc


# =================== POS cash session ===================

class CashSessionIn(BaseModel):
    account_id: str  # cuenta caja
    saldo_apertura: float = 0.0
    empleado_nombre: Optional[str] = ""


@router.get("/pos/sessions")
async def list_sessions(estado: Optional[str] = None, _=Depends(require_permission(PERM_READ))):
    q = {}
    if estado: q["estado"] = estado
    return [s async for s in db.pos_cash_sessions.find(q, {"_id": 0}).sort("opened_at", -1)]


@router.get("/pos/sessions/active")
async def active_session(_=Depends(require_permission(PERM_READ))):
    s = await db.pos_cash_sessions.find_one({"estado": "abierta"}, {"_id": 0}, sort=[("opened_at", -1)])
    return s or {}


@router.post("/pos/sessions/open")
async def open_session(payload: CashSessionIn, _=Depends(require_permission(PERM_WRITE))):
    # Solo una sesión abierta
    existing = await db.pos_cash_sessions.find_one({"estado": "abierta"})
    if existing:
        raise HTTPException(400, "Ya hay una sesión de caja abierta. Ciérrala antes de abrir otra.")
    if not await db.bank_accounts.find_one({"id": payload.account_id}):
        raise HTTPException(400, "Cuenta no encontrada")
    doc = {
        "id": str(uuid.uuid4()),
        "numero": await _next_seq("SES", "pos_cash_sessions", "numero"),
        **payload.model_dump(),
        "opened_at": _now(), "closed_at": None,
        "saldo_cierre": None, "diferencia": None,
        "estado": "abierta",  # abierta | cerrada
        "total_ventas": 0.0, "num_tickets": 0,
    }
    await db.pos_cash_sessions.insert_one(doc); doc.pop("_id", None)
    return doc


class CloseSessionIn(BaseModel):
    saldo_cierre_contado: float


@router.post("/pos/sessions/{sid}/close")
async def close_session(sid: str, payload: CloseSessionIn, _=Depends(require_permission(PERM_WRITE))):
    s = await db.pos_cash_sessions.find_one({"id": sid})
    if not s: raise HTTPException(404, "Sesión no encontrada")
    if s["estado"] == "cerrada": raise HTTPException(400, "Ya cerrada")
    saldo_esperado = round((s.get("saldo_apertura") or 0) + (s.get("total_ventas") or 0), 2)
    diferencia = round(payload.saldo_cierre_contado - saldo_esperado, 2)
    await db.pos_cash_sessions.update_one({"id": sid}, {"$set": {
        "estado": "cerrada", "closed_at": _now(),
        "saldo_cierre": payload.saldo_cierre_contado,
        "saldo_esperado": saldo_esperado, "diferencia": diferencia,
    }})
    return await db.pos_cash_sessions.find_one({"id": sid}, {"_id": 0})


# =================== POS tickets ===================

class TicketItem(BaseModel):
    product_id: Optional[str] = None
    sku: str = ""
    name: str
    qty: float = Field(gt=0)
    unit_price: float = Field(ge=0)


class TicketIn(BaseModel):
    items: List[TicketItem]
    metodo_pago: str = "efectivo"  # efectivo | tarjeta | mixto | bizum
    efectivo: float = 0.0
    tarjeta: float = 0.0
    vat_pct: float = 10.0
    cliente_nombre: Optional[str] = ""
    cliente_id: Optional[str] = None


@router.get("/pos/tickets")
async def list_tickets(session_id: Optional[str] = None, limit: int = 100,
                      _=Depends(require_permission(PERM_READ))):
    q = {}
    if session_id: q["session_id"] = session_id
    cursor = db.pos_tickets.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    return [t async for t in cursor]


@router.post("/pos/tickets")
async def create_ticket(payload: TicketIn, _=Depends(require_permission(PERM_WRITE))):
    # Debe existir una sesión abierta
    session = await db.pos_cash_sessions.find_one({"estado": "abierta"})
    if not session:
        raise HTTPException(400, "Abre primero una sesión de caja")

    items = [{**i.model_dump(), "line_total": round(i.qty * i.unit_price, 2)} for i in payload.items]
    subtotal = sum(i["line_total"] for i in items)
    vat_amount = subtotal * (payload.vat_pct / 100)
    total = subtotal + vat_amount

    ticket = {
        "id": str(uuid.uuid4()),
        "numero": await _next_seq("TCK", "pos_tickets", "numero"),
        "session_id": session["id"], "session_numero": session["numero"],
        "account_id": session["account_id"],
        "items": items, "subtotal": round(subtotal, 2),
        "vat_pct": payload.vat_pct, "vat_amount": round(vat_amount, 2),
        "total": round(total, 2),
        "metodo_pago": payload.metodo_pago,
        "efectivo": round(payload.efectivo, 2), "tarjeta": round(payload.tarjeta, 2),
        "cambio": round((payload.efectivo + payload.tarjeta) - total, 2),
        "cliente_nombre": payload.cliente_nombre or "", "cliente_id": payload.cliente_id,
        "movement_id": None,
        "created_at": _now(),
    }

    # ENGRANAJE: descontar stock por FIFO
    from routers_inventory import _consume_fifo
    for it in items:
        if it.get("product_id"):
            try: await _consume_fifo(it["product_id"], it["qty"], reference=f"ticket:{ticket['id']}")
            except Exception: pass

    # ENGRANAJE: crear movimiento de tesorería
    mov = {
        "id": str(uuid.uuid4()),
        "numero": await _next_seq("MOV", "treasury_movements", "numero"),
        "account_id": session["account_id"],
        "tipo": "income", "importe": ticket["total"],
        "fecha": _today(),
        "concepto": f"Venta TPV ticket {ticket['numero']}",
        "categoria": "venta", "metodo": payload.metodo_pago,
        "reference_type": "pos_ticket", "reference_id": ticket["id"],
        "conciliado": False, "notas": "",
        "created_at": _now(),
    }
    await db.treasury_movements.insert_one(mov)
    ticket["movement_id"] = mov["id"]

    await db.pos_tickets.insert_one(ticket)

    # Update session totals
    await db.pos_cash_sessions.update_one({"id": session["id"]}, {"$inc": {
        "total_ventas": ticket["total"], "num_tickets": 1,
    }})

    ticket.pop("_id", None)
    mov.pop("_id", None)
    return {"ticket": ticket, "movement": mov}


@router.get("/pos/summary")
async def pos_summary(_=Depends(require_permission(PERM_READ))):
    """Resumen del día actual."""
    today = _today()
    pipe = [
        {"$match": {"created_at": {"$regex": f"^{today}"}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
    ]
    r = [x async for x in db.pos_tickets.aggregate(pipe)]
    hoy = r[0] if r else {"total": 0, "count": 0}
    return {"hoy": {"total": round(hoy["total"], 2), "tickets": hoy["count"]}}
