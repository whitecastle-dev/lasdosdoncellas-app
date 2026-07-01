"""Tesorería + Facturación emitida — Phase 7.

Collections:
  bank_accounts        cuentas bancarias + cajas (con saldo actual)
  treasury_movements   movimientos: cobros / pagos, con account_id + reference
  issued_invoices      facturas emitidas manualmente (B2B) — las de tienda
                       web se leen de orders

Engranajes:
  · PATCH supplier_invoice → paid + account_id  ⇒ genera movimiento salida y
    resta saldo automáticamente.
  · PATCH issued_invoice   → paid + account_id  ⇒ genera movimiento entrada y
    suma saldo.
  · Cash-flow forecast 30d = saldos + AR (cobros pendientes) - AP (pagos pendientes)
    con vencimiento <= hoy+30.
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from db import db
from auth import require_permission

router = APIRouter(prefix="/api/treasury", tags=["treasury"])
inv_router = APIRouter(prefix="/api/issued-invoices", tags=["issued-invoices"])

PERM_READ = "products.read"    # reutiliza — permiso de gerente
PERM_WRITE = "products.write"


def _now() -> str: return datetime.now(timezone.utc).isoformat()
def _today() -> str: return datetime.now(timezone.utc).date().isoformat()


async def _next_seq(prefix: str, collection: str, field: str) -> str:
    year = datetime.now(timezone.utc).year
    count = await db[collection].count_documents({field: {"$regex": f"^{prefix}-{year}-"}})
    return f"{prefix}-{year}-{(count + 1):05d}"


# ================================================================ Accounts

class BankAccountIn(BaseModel):
    nombre: str
    tipo: str = "bank"  # bank | cash
    banco: Optional[str] = ""
    iban: Optional[str] = ""
    saldo_inicial: float = 0.0
    moneda: str = "EUR"
    activo: bool = True
    notas: Optional[str] = ""


@router.get("/accounts")
async def list_accounts(_=Depends(require_permission(PERM_READ))):
    accounts = [a async for a in db.bank_accounts.find({}, {"_id": 0}).sort("nombre", 1)]
    # Compute live balance from movements
    for a in accounts:
        pipe = [
            {"$match": {"account_id": a["id"]}},
            {"$group": {"_id": None, "in": {"$sum": {"$cond": [{"$eq": ["$tipo", "income"]}, "$importe", 0]}},
                        "out": {"$sum": {"$cond": [{"$eq": ["$tipo", "expense"]}, "$importe", 0]}}}},
        ]
        r = [x async for x in db.treasury_movements.aggregate(pipe)]
        totals = r[0] if r else {"in": 0, "out": 0}
        a["saldo"] = round(a.get("saldo_inicial", 0) + (totals["in"] or 0) - (totals["out"] or 0), 2)
    return accounts


@router.post("/accounts")
async def create_account(payload: BankAccountIn, _=Depends(require_permission(PERM_WRITE))):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4()); doc["created_at"] = _now()
    await db.bank_accounts.insert_one(doc); doc.pop("_id", None)
    return doc


@router.patch("/accounts/{aid}")
async def update_account(aid: str, payload: BankAccountIn, _=Depends(require_permission(PERM_WRITE))):
    if not await db.bank_accounts.find_one({"id": aid}):
        raise HTTPException(404, "Cuenta no encontrada")
    await db.bank_accounts.update_one({"id": aid}, {"$set": payload.model_dump()})
    return await db.bank_accounts.find_one({"id": aid}, {"_id": 0})


@router.delete("/accounts/{aid}")
async def delete_account(aid: str, _=Depends(require_permission(PERM_WRITE))):
    # Prevent delete if there are movements
    n = await db.treasury_movements.count_documents({"account_id": aid})
    if n > 0:
        raise HTTPException(400, f"La cuenta tiene {n} movimientos. Márcala inactiva en su lugar.")
    r = await db.bank_accounts.delete_one({"id": aid})
    if r.deleted_count == 0: raise HTTPException(404, "Cuenta no encontrada")
    return {"ok": True}


# ================================================================ Movements

class MovementIn(BaseModel):
    account_id: str
    tipo: str  # income | expense
    importe: float = Field(gt=0)
    fecha: str  # YYYY-MM-DD
    concepto: str
    categoria: Optional[str] = ""  # venta | compra | salario | gasto | otros
    metodo: Optional[str] = "transferencia"
    reference_type: Optional[str] = None  # order | supplier_invoice | issued_invoice | manual
    reference_id: Optional[str] = None
    conciliado: bool = False
    notas: Optional[str] = ""


async def _create_movement(payload: MovementIn) -> dict:
    if payload.tipo not in ("income", "expense"):
        raise HTTPException(400, "Tipo debe ser 'income' o 'expense'")
    if not await db.bank_accounts.find_one({"id": payload.account_id}):
        raise HTTPException(400, "Cuenta no encontrada")
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["numero"] = await _next_seq("MOV", "treasury_movements", "numero")
    doc["created_at"] = _now()
    await db.treasury_movements.insert_one(doc); doc.pop("_id", None)
    return doc


@router.get("/movements")
async def list_movements(
    account_id: Optional[str] = None,
    tipo: Optional[str] = None,
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    limit: int = 500,
    _=Depends(require_permission(PERM_READ)),
):
    q = {}
    if account_id: q["account_id"] = account_id
    if tipo: q["tipo"] = tipo
    if desde or hasta:
        rng = {}
        if desde: rng["$gte"] = desde
        if hasta: rng["$lte"] = hasta
        q["fecha"] = rng
    cursor = db.treasury_movements.find(q, {"_id": 0}).sort("fecha", -1).limit(limit)
    return [m async for m in cursor]


@router.post("/movements")
async def create_movement(payload: MovementIn, _=Depends(require_permission(PERM_WRITE))):
    return await _create_movement(payload)


@router.patch("/movements/{mid}")
async def update_movement(mid: str, payload: MovementIn, _=Depends(require_permission(PERM_WRITE))):
    if not await db.treasury_movements.find_one({"id": mid}):
        raise HTTPException(404, "Movimiento no encontrado")
    await db.treasury_movements.update_one({"id": mid}, {"$set": payload.model_dump()})
    return await db.treasury_movements.find_one({"id": mid}, {"_id": 0})


@router.delete("/movements/{mid}")
async def delete_movement(mid: str, _=Depends(require_permission(PERM_WRITE))):
    r = await db.treasury_movements.delete_one({"id": mid})
    if r.deleted_count == 0: raise HTTPException(404, "Movimiento no encontrado")
    return {"ok": True}


# ================================================================ Cashflow

@router.get("/cashflow")
async def cashflow_forecast(days: int = 30, _=Depends(require_permission(PERM_READ))):
    """Predicción de flujo de caja a N días."""
    today = _today()
    horizon = (datetime.now(timezone.utc) + timedelta(days=days)).date().isoformat()

    # Saldo actual (todas las cuentas)
    accounts = await list_accounts(_=None)
    saldo_actual = round(sum(a["saldo"] for a in accounts), 2)

    # AR = cobros pendientes (issued_invoices status != paid con due_date en el rango)
    ar_pipe = [
        {"$match": {"status": {"$in": ["issued", "sent", "overdue"]},
                    "due_date": {"$ne": None, "$lte": horizon}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
    ]
    ar = [x async for x in db.issued_invoices.aggregate(ar_pipe)]
    ar_total = round(ar[0]["total"], 2) if ar else 0
    ar_count = ar[0]["count"] if ar else 0

    # AP = supplier_invoices status pending con due_date en el rango
    ap_pipe = [
        {"$match": {"status": "pending_payment", "due_date": {"$ne": None, "$lte": horizon}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
    ]
    ap = [x async for x in db.supplier_invoices.aggregate(ap_pipe)]
    ap_total = round(ap[0]["total"], 2) if ap else 0
    ap_count = ap[0]["count"] if ap else 0

    # Vencidos hoy (overdue)
    overdue_ap = [x async for x in db.supplier_invoices.aggregate([
        {"$match": {"status": "pending_payment", "due_date": {"$ne": None, "$lt": today}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
    ])]
    overdue_ar = [x async for x in db.issued_invoices.aggregate([
        {"$match": {"status": {"$in": ["issued", "sent", "overdue"]}, "due_date": {"$ne": None, "$lt": today}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
    ])]

    proyectado = round(saldo_actual + ar_total - ap_total, 2)

    return {
        "hoy": today,
        "horizon": horizon,
        "dias": days,
        "saldo_actual": saldo_actual,
        "por_cobrar": {"total": ar_total, "count": ar_count},
        "por_pagar": {"total": ap_total, "count": ap_count},
        "vencidos_cobro": {"total": round(overdue_ar[0]["total"], 2) if overdue_ar else 0,
                          "count": overdue_ar[0]["count"] if overdue_ar else 0},
        "vencidos_pago": {"total": round(overdue_ap[0]["total"], 2) if overdue_ap else 0,
                         "count": overdue_ap[0]["count"] if overdue_ap else 0},
        "saldo_proyectado": proyectado,
        "cuentas": accounts,
    }


# ================================================================ Issued invoices (B2B / manual)

class InvoiceLine(BaseModel):
    concepto: str
    qty: float = Field(gt=0)
    unit_price: float = Field(ge=0)


class IssuedInvoiceIn(BaseModel):
    client_type: str = "business"  # business | web | manual
    client_id: Optional[str] = None
    client_name: str
    client_tax_id: Optional[str] = ""
    client_email: Optional[str] = ""
    lines: List[InvoiceLine]
    vat_pct: float = 21.0
    issue_date: str  # YYYY-MM-DD
    due_date: Optional[str] = None
    notes: Optional[str] = ""


@inv_router.get("")
async def list_issued(status: Optional[str] = None, _=Depends(require_permission(PERM_READ))):
    q = {}
    if status: q["status"] = status
    return [i async for i in db.issued_invoices.find(q, {"_id": 0}).sort("issue_date", -1)]


@inv_router.get("/summary")
async def issued_summary(_=Depends(require_permission(PERM_READ))):
    today = _today()
    pipe = [{"$group": {"_id": "$status", "total": {"$sum": "$total"}, "count": {"$sum": 1}}}]
    rows = [r async for r in db.issued_invoices.aggregate(pipe)]
    stats = {r["_id"]: {"total": round(r["total"], 2), "count": r["count"]} for r in rows}
    ov = [r async for r in db.issued_invoices.aggregate([
        {"$match": {"status": {"$in": ["issued", "sent"]}, "due_date": {"$ne": None, "$lt": today}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
    ])]
    stats["overdue"] = {"total": round(ov[0]["total"], 2), "count": ov[0]["count"]} if ov else {"total": 0, "count": 0}
    return stats


@inv_router.post("")
async def create_issued(payload: IssuedInvoiceIn, _=Depends(require_permission(PERM_WRITE))):
    subtotal = sum(l.qty * l.unit_price for l in payload.lines)
    vat_amount = subtotal * (payload.vat_pct / 100.0)
    total = subtotal + vat_amount
    lines = [{"concepto": l.concepto, "qty": l.qty, "unit_price": l.unit_price,
              "line_total": round(l.qty * l.unit_price, 2)} for l in payload.lines]
    doc = {
        "id": str(uuid.uuid4()),
        "invoice_number": await _next_seq("EMIT", "issued_invoices", "invoice_number"),
        "client_type": payload.client_type,
        "client_id": payload.client_id,
        "client_name": payload.client_name,
        "client_tax_id": payload.client_tax_id or "",
        "client_email": payload.client_email or "",
        "lines": lines,
        "subtotal": round(subtotal, 2),
        "vat_pct": payload.vat_pct,
        "vat_amount": round(vat_amount, 2),
        "total": round(total, 2),
        "status": "issued",  # issued | sent | paid | overdue | cancelled
        "issue_date": payload.issue_date,
        "due_date": payload.due_date,
        "paid_at": None,
        "payment_movement_id": None,
        "notes": payload.notes or "",
        "created_at": _now(),
    }
    await db.issued_invoices.insert_one(doc); doc.pop("_id", None)
    return doc


class InvoicePayAction(BaseModel):
    account_id: str
    payment_date: Optional[str] = None
    notes: Optional[str] = ""


@inv_router.post("/{iid}/mark-paid")
async def mark_issued_paid(iid: str, payload: InvoicePayAction, _=Depends(require_permission(PERM_WRITE))):
    """ENGRANAJE: marca la factura como pagada Y crea el movimiento de tesorería (income)."""
    inv = await db.issued_invoices.find_one({"id": iid})
    if not inv: raise HTTPException(404, "Factura no encontrada")
    if inv["status"] == "paid":
        raise HTTPException(400, "Ya está marcada como pagada")

    mov = await _create_movement(MovementIn(
        account_id=payload.account_id,
        tipo="income",
        importe=inv["total"],
        fecha=payload.payment_date or _today(),
        concepto=f"Cobro factura {inv['invoice_number']} — {inv['client_name']}",
        categoria="venta",
        metodo="transferencia",
        reference_type="issued_invoice",
        reference_id=iid,
        conciliado=False,
        notas=payload.notes or "",
    ))
    await db.issued_invoices.update_one({"id": iid}, {"$set": {
        "status": "paid", "paid_at": mov["fecha"], "payment_movement_id": mov["id"],
    }})
    return {"invoice": await db.issued_invoices.find_one({"id": iid}, {"_id": 0}), "movement": mov}


# ================================================================ Supplier invoice pay (engranaje)

class SupplierPayIn(BaseModel):
    account_id: str
    payment_date: Optional[str] = None
    notes: Optional[str] = ""


@router.post("/pay-supplier-invoice/{sid}")
async def pay_supplier_invoice(sid: str, payload: SupplierPayIn, _=Depends(require_permission(PERM_WRITE))):
    """ENGRANAJE: paga una factura de proveedor y crea el movimiento (expense)."""
    inv = await db.supplier_invoices.find_one({"id": sid})
    if not inv: raise HTTPException(404, "Factura de proveedor no encontrada")
    if inv["status"] == "paid":
        raise HTTPException(400, "Ya está pagada")

    mov = await _create_movement(MovementIn(
        account_id=payload.account_id,
        tipo="expense",
        importe=inv["total"],
        fecha=payload.payment_date or _today(),
        concepto=f"Pago factura proveedor {inv['invoice_number']} — {inv['provider']['name']}",
        categoria="compra",
        metodo="transferencia",
        reference_type="supplier_invoice",
        reference_id=sid,
        conciliado=False,
        notas=payload.notes or "",
    ))
    await db.supplier_invoices.update_one({"id": sid}, {"$set": {
        "status": "paid", "paid_at": mov["fecha"], "payment_movement_id": mov["id"],
    }})
    return {"invoice": await db.supplier_invoices.find_one({"id": sid}, {"_id": 0}), "movement": mov}


# ================================================================ Reminders

@router.get("/reminders")
async def reminders(_=Depends(require_permission(PERM_READ))):
    """Facturas vencidas o próximas a vencer (7 días) — cobrar y pagar."""
    today = _today()
    horizon_7 = (datetime.now(timezone.utc) + timedelta(days=7)).date().isoformat()

    cobrar_pronto = [i async for i in db.issued_invoices.find({
        "status": {"$in": ["issued", "sent"]},
        "due_date": {"$ne": None, "$gte": today, "$lte": horizon_7},
    }, {"_id": 0}).sort("due_date", 1)]

    cobrar_vencidas = [i async for i in db.issued_invoices.find({
        "status": {"$in": ["issued", "sent"]},
        "due_date": {"$ne": None, "$lt": today},
    }, {"_id": 0}).sort("due_date", 1)]

    pagar_pronto = [i async for i in db.supplier_invoices.find({
        "status": "pending_payment",
        "due_date": {"$ne": None, "$gte": today, "$lte": horizon_7},
    }, {"_id": 0}).sort("due_date", 1)]

    pagar_vencidas = [i async for i in db.supplier_invoices.find({
        "status": "pending_payment",
        "due_date": {"$ne": None, "$lt": today},
    }, {"_id": 0}).sort("due_date", 1)]

    return {
        "cobrar": {"vencidas": cobrar_vencidas, "proximas": cobrar_pronto},
        "pagar": {"vencidas": pagar_vencidas, "proximas": pagar_pronto},
    }
