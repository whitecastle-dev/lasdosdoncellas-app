"""Orders + Stripe Checkout + Invoice."""
import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field
from db import db
from auth import require_permission
from invoice_pdf import generate_invoice_pdf
from email_service import send_order_confirmation, send_status_update

router = APIRouter(prefix="/api", tags=["orders"])

STATUS_FLOW = ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"]


# ---------------- Models ----------------
class CartItemIn(BaseModel):
    product_id: str
    qty: int = Field(ge=1)


class CustomerIn(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = ""
    address: str
    city: str
    postal_code: str
    country: str = "España"
    tax_id: Optional[str] = ""
    notes: Optional[str] = ""


class CheckoutIn(BaseModel):
    items: List[CartItemIn]
    customer: CustomerIn
    origin_url: str


# ---------------- Helpers ----------------
async def _next_number(name: str, prefix: str) -> str:
    counter = await db.counters.find_one_and_update(
        {"_id": name}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
    )
    seq = (counter or {}).get("seq") or 1
    year = datetime.now(timezone.utc).year
    return f"{prefix}-{year}-{seq:05d}"


async def _build_order_from_items(items: List[CartItemIn]):
    """Compute server-side totals based on products in DB."""
    if not items:
        raise HTTPException(status_code=400, detail="Carrito vacío")

    order_items = []
    subtotal = 0.0
    vat_breakdown: dict = {}

    for it in items:
        prod = await db.products.find_one({"id": it.product_id})
        if not prod:
            raise HTTPException(status_code=400, detail=f"Producto no disponible: {it.product_id}")
        if not prod.get("is_active", True):
            raise HTTPException(status_code=400, detail=f"Producto inactivo: {prod.get('name')}")
        if prod.get("stock", 0) < it.qty:
            raise HTTPException(status_code=400, detail=f"Stock insuficiente para {prod.get('name')}")
        price = float(prod["price"])
        vat_rate = int(prod.get("vat_rate", 10))
        # The displayed price is IVA included; split out base
        base_unit = price / (1 + vat_rate / 100)
        line_base = base_unit * it.qty
        line_total = price * it.qty
        line_vat = line_total - line_base
        subtotal += line_base
        vat_breakdown[str(vat_rate)] = round(vat_breakdown.get(str(vat_rate), 0.0) + line_vat, 2)
        order_items.append({
            "product_id": prod["id"],
            "sku": prod.get("sku"),
            "name": prod["name"],
            "qty": it.qty,
            "unit_price": round(price, 2),  # IVA included
            "base_unit_price": round(base_unit, 2),
            "vat_rate": vat_rate,
            "line_total": round(line_total, 2),
            "image": (prod.get("images") or [None])[0],
        })

    vat_total = sum(vat_breakdown.values())
    total = round(subtotal + vat_total, 2)
    return order_items, round(subtotal, 2), {k: round(v, 2) for k, v in vat_breakdown.items()}, round(vat_total, 2), total


# ---------------- Checkout ----------------
# NOTE: The Stripe checkout flow was removed when we migrated to CaixaBank / Redsys
# in Feb 2026. See routers_payments_redsys.py for the current payment path.
# The dead endpoints (/checkout/session, /checkout/status/{session_id}, /webhook/stripe)
# were removed to unbreak lint after `stripe` was dropped from requirements.txt.


@router.get("/checkout/status/{session_id}")
async def checkout_status_legacy(session_id: str):
    """Legacy Stripe status polling — returns 410 Gone.

    Kept only so old success-URL bookmarks don't 404. Redsys does not need this.
    """
    raise HTTPException(status_code=410, detail="Stripe checkout ha sido reemplazado por Redsys (CaixaBank). Vuelve a iniciar el pedido.")


# ---------------- Orders admin ----------------
@router.get("/orders")
async def list_orders(
    status: Optional[str] = None,
    q: Optional[str] = None,
    _=Depends(require_permission("orders.read")),
):
    query: dict = {}
    if status:
        query["status"] = status
    if q:
        query["$or"] = [
            {"order_number": {"$regex": q, "$options": "i"}},
            {"invoice_number": {"$regex": q, "$options": "i"}},
            {"customer.email": {"$regex": q, "$options": "i"}},
            {"customer.name": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.orders.find(query, {"_id": 0}).sort("created_at", -1).limit(500)
    return [o async for o in cursor]


@router.get("/orders/{order_id}")
async def get_order(order_id: str, _=Depends(require_permission("orders.read"))):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return o


class StatusUpdate(BaseModel):
    status: str
    note: Optional[str] = ""


@router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, payload: StatusUpdate, _=Depends(require_permission("orders.write"))):
    if payload.status not in STATUS_FLOW:
        raise HTTPException(status_code=400, detail="Estado inválido")
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    now = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {"status": payload.status, "updated_at": now},
            "$push": {"tracking": {"status": payload.status, "at": now, "note": payload.note or ""}},
        },
    )
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    try:
        await send_status_update(updated)
    except Exception:
        pass
    return updated


@router.get("/orders/{order_id}/invoice")
async def download_invoice(order_id: str, _=Depends(require_permission("orders.read"))):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    pdf = generate_invoice_pdf(o)
    filename = f"factura_{o.get('invoice_number','LDD')}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# Public success — get order by session id (no auth needed)
@router.get("/orders/by-session/{session_id}")
async def order_by_session(session_id: str):
    o = await db.orders.find_one({"session_id": session_id}, {"_id": 0, "tracking": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return o


# Public success — Redsys: fetch order by merchant_order
@router.get("/orders/by-merchant/{merchant_order}")
async def order_by_merchant(merchant_order: str):
    o = await db.orders.find_one({"merchant_order": merchant_order}, {"_id": 0, "tracking": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return o
