"""Orders + Stripe Checkout + Invoice."""
import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest,
)
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
@router.post("/checkout/session")
async def create_checkout(payload: CheckoutIn, request: Request):
    items, subtotal, vat_breakdown, vat_total, total = await _build_order_from_items(payload.items)

    order_number = await _next_number("order", "P")
    invoice_number = await _next_number("invoice", "F")
    now = datetime.now(timezone.utc).isoformat()

    order_doc = {
        "id": str(uuid.uuid4()),
        "order_number": order_number,
        "invoice_number": invoice_number,
        "invoice_date": datetime.now(timezone.utc).strftime("%d/%m/%Y"),
        "items": items,
        "customer": payload.customer.model_dump(),
        "subtotal": subtotal,
        "vat_breakdown": vat_breakdown,
        "vat_total": vat_total,
        "shipping": 0.0,
        "total": total,
        "currency": "eur",
        "status": "pending_payment",
        "payment_status": "pending",
        "session_id": None,
        "tracking": [{"status": "pending_payment", "at": now, "note": "Pedido creado"}],
        "created_at": now,
        "updated_at": now,
    }

    # Stripe
    api_key = os.environ["STRIPE_API_KEY"]
    host_url = str(request.base_url)
    webhook_url = f"{host_url.rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/cart"

    checkout_req = CheckoutSessionRequest(
        amount=float(total),
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "order_number": order_number,
            "invoice_number": invoice_number,
            "customer_email": payload.customer.email,
        },
    )
    session = await stripe_checkout.create_checkout_session(checkout_req)

    order_doc["session_id"] = session.session_id

    # Record payment transaction
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "order_number": order_number,
        "amount": float(total),
        "currency": "eur",
        "payment_status": "initiated",
        "metadata": {"customer_email": payload.customer.email},
        "created_at": now,
        "updated_at": now,
    })

    await db.orders.insert_one(order_doc)
    return {"url": session.url, "session_id": session.session_id, "order_number": order_number}


@router.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, request: Request):
    api_key = os.environ["STRIPE_API_KEY"]
    host_url = str(request.base_url)
    webhook_url = f"{host_url.rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    status = await stripe_checkout.get_checkout_status(session_id)

    tx = await db.payment_transactions.find_one({"session_id": session_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    # Only process if not already finalized
    if tx.get("payment_status") in ("paid", "expired", "failed"):
        return {"status": status.status, "payment_status": status.payment_status, "order_number": tx.get("order_number")}

    now = datetime.now(timezone.utc).isoformat()
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"payment_status": status.payment_status, "updated_at": now}},
    )

    if status.payment_status == "paid":
        order = await db.orders.find_one({"session_id": session_id})
        if order and order.get("status") == "pending_payment":
            # decrement stock and mark paid
            for it in order["items"]:
                await db.products.update_one(
                    {"id": it["product_id"]},
                    {"$inc": {"stock": -int(it["qty"])}},
                )
            await db.orders.update_one(
                {"session_id": session_id},
                {
                    "$set": {"status": "paid", "payment_status": "paid", "updated_at": now},
                    "$push": {"tracking": {"status": "paid", "at": now, "note": "Pago confirmado"}},
                },
            )
            # Email confirmations
            try:
                refreshed = await db.orders.find_one({"session_id": session_id}, {"_id": 0})
                if refreshed:
                    await send_order_confirmation(refreshed)
            except Exception:
                pass
    elif status.status == "expired":
        await db.orders.update_one(
            {"session_id": session_id},
            {"$set": {"status": "cancelled", "payment_status": "expired", "updated_at": now}},
        )

    return {"status": status.status, "payment_status": status.payment_status, "order_number": tx.get("order_number")}


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    api_key = os.environ["STRIPE_API_KEY"]
    host_url = str(request.base_url)
    webhook_url = f"{host_url.rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    body = await request.body()
    sig = request.headers.get("Stripe-Signature")
    try:
        event = await stripe_checkout.handle_webhook(body, sig)
    except Exception:
        raise HTTPException(status_code=400, detail="Webhook inválido")
    # Re-use the polling path
    if event.session_id:
        # No-op response — frontend polls
        pass
    return {"ok": True}


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
