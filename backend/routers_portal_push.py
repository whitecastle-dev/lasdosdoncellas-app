"""Reverse-direction sync: our web/TPV sales → portal's ``tienda.ventas`` table.

Whenever our MongoDB stores a new online order (Redsys success) or a new
POS ticket, we mirror it into the portal so the customer sees a single
consolidated view of ``ventas``.

This is intentionally decoupled from the read-only proxy: writes are only
performed by explicit calls (from the Redsys webhook or from the admin
"backfill" endpoint).
"""
from __future__ import annotations

import os
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException

from db import db
from auth import require_permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/portal/push", tags=["portal-push"])

PERM = "products.write"


def _config() -> tuple[str, str]:
    url = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or ""
    if not url or not key:
        raise HTTPException(status_code=500, detail="SUPABASE_URL/KEY no configurados")
    return url, key


def _headers(schema: str = "tienda") -> dict[str, str]:
    _, key = _config()
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Profile": schema,
        "Content-Type": "application/json",
        "Prefer": "return=representation,resolution=merge-duplicates",
    }


def _fecha_iso(value) -> Optional[str]:
    """Normalise a created_at (str or datetime) to a full ISO string."""
    if not value:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    s = str(value)
    return s if s else None


def _order_to_venta(order: dict) -> dict:
    """Map a MongoDB web order document → tienda.ventas row.

    Uses ``order_number`` (unique, e.g. ``P-000123``) as ``numero_venta``
    so PostgREST upsert (merge-duplicates + unique constraint on
    numero_venta) is idempotent.
    """
    return {
        "numero_venta": order.get("order_number") or f"WEB-{order.get('id')}",
        "canal": "ONLINE",
        "fecha": _fecha_iso(order.get("created_at")),
        "base_imponible": round(float(order.get("subtotal") or 0), 2),
        "iva": round(float(order.get("vat_total") or 0), 2),
        "total": round(float(order.get("total") or 0), 2),
        "forma_pago": "TARJETA",
        "estado": "COBRADO" if order.get("payment_status") == "paid" else "BORRADOR",
        "origen": "tienda_web_ldd",
        "observaciones": (
            f"Cliente: {(order.get('customer') or {}).get('email','')} · "
            f"Redsys ref: {order.get('merchant_order','')}"
        )[:250],
    }


def _ticket_to_venta(ticket: dict) -> dict:
    return {
        "numero_venta": ticket.get("number") or f"TPV-{ticket.get('id')}",
        "canal": "TIENDA",
        "fecha": _fecha_iso(ticket.get("created_at")),
        "base_imponible": round(float(ticket.get("subtotal") or 0), 2),
        "iva": round(float(ticket.get("vat_total") or 0), 2),
        "total": round(float(ticket.get("total") or 0), 2),
        "forma_pago": (ticket.get("payment_method") or "EFECTIVO").upper(),
        "estado": "COBRADO",
        "origen": "tpv_ldd",
    }


async def _upsert_venta(payload: dict) -> dict:
    """Upsert into ``tienda.ventas`` (unique on numero_venta)."""
    url, _ = _config()
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            f"{url}/ventas",
            json=[payload],
            headers={**_headers(), "Prefer": "return=representation,resolution=merge-duplicates"},
            params={"on_conflict": "numero_venta"},
        )
    if r.status_code >= 400:
        logger.error("portal push failed %s: %s", r.status_code, r.text[:400])
        raise HTTPException(status_code=502, detail=f"Supabase push: {r.status_code} · {r.text[:200]}")
    try:
        body = r.json()
        return body[0] if isinstance(body, list) and body else {}
    except Exception:
        return {}


# ---------------- Public endpoints ----------------

@router.post("/order/{order_number}")
async def push_one_order(order_number: str, _=Depends(require_permission(PERM))):
    """Push a specific web order to the portal (`tienda.ventas`)."""
    order = await db.orders.find_one({"order_number": order_number}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail=f"Pedido {order_number} no encontrado")
    row = _order_to_venta(order)
    result = await _upsert_venta(row)
    return {"pushed": row, "portal_row": result}


@router.post("/orders/backfill")
async def push_all_paid_orders(_=Depends(require_permission(PERM))):
    """Backfill: push every paid order that isn't in the portal yet."""
    pushed = failed = 0
    errors: list[str] = []
    cursor = db.orders.find({"payment_status": "paid"}, {"_id": 0})
    async for order in cursor:
        try:
            await _upsert_venta(_order_to_venta(order))
            pushed += 1
        except Exception as e:  # noqa: BLE001
            failed += 1
            errors.append(f"{order.get('order_number')}: {str(e)[:120]}")
    return {"pushed": pushed, "failed": failed, "errors": errors[:20]}


@router.post("/tpv-ticket/{ticket_id}")
async def push_one_ticket(ticket_id: str, _=Depends(require_permission(PERM))):
    ticket = await db.pos_tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} no encontrado")
    row = _ticket_to_venta(ticket)
    result = await _upsert_venta(row)
    return {"pushed": row, "portal_row": result}


@router.post("/tpv-tickets/backfill")
async def push_all_tickets(_=Depends(require_permission(PERM))):
    pushed = failed = 0
    errors: list[str] = []
    cursor = db.pos_tickets.find({"status": {"$in": ["closed", "paid"]}}, {"_id": 0})
    async for tk in cursor:
        try:
            await _upsert_venta(_ticket_to_venta(tk))
            pushed += 1
        except Exception as e:  # noqa: BLE001
            failed += 1
            errors.append(f"{tk.get('id')}: {str(e)[:120]}")
    return {"pushed": pushed, "failed": failed, "errors": errors[:20]}


# ---------------- Silent-mode helpers used internally ----------------

async def push_order_silent(order: dict) -> Optional[dict]:
    """Fire-and-forget from Redsys webhook. Never raises."""
    try:
        return await _upsert_venta(_order_to_venta(order))
    except Exception as e:  # noqa: BLE001
        logger.warning("silent push failed for %s: %s", order.get("order_number"), e)
        return None
