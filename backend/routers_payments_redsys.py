"""Endpoints de checkout con Redsys / CaixaBank TPV Virtual.

Flujo:
  1. Frontend hace POST /api/checkout/redsys con items + customer + origin_url.
  2. Backend crea el pedido y devuelve {endpoint, Ds_MerchantParameters,
     Ds_Signature, Ds_SignatureVersion}. El frontend auto-envía un <form> a
     `endpoint` con esos 3 campos ocultos → el navegador acaba en Redsys.
  3. Redsys redirige al cliente a Ds_Merchant_UrlOK / UrlKO (informativo).
  4. Redsys hace POST server-to-server a Ds_Merchant_MerchantURL con la
     confirmación firmada. El endpoint /api/payments/redsys/notify verifica
     la firma y marca el pedido `paid` sólo si Ds_Response ∈ 0000..0099.
"""
import os
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request

from db import db
from redsys import (
    build_merchant_parameters,
    create_signature,
    decode_merchant_parameters,
    verify_signature,
)
from routers_orders import (
    _build_order_from_items,
    _next_number,
    CheckoutIn,
)

logger = logging.getLogger("redsys")
router = APIRouter(tags=["redsys-payments"])


def _cfg():
    required = ["REDSYS_MERCHANT_CODE", "REDSYS_SECRET_KEY"]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        # 503: no romper con un KeyError; permite que el middleware CORS añada
        # las cabeceras y que el frontend muestre un mensaje entendible.
        logger.error("redsys _cfg falta env vars: %s", missing)
        raise HTTPException(
            status_code=503,
            detail=(
                "La pasarela de pago no está configurada en el servidor. "
                f"Faltan variables de entorno: {', '.join(missing)}. "
                "Contacta con el administrador."
            ),
        )
    return {
        "merchant_code": os.environ["REDSYS_MERCHANT_CODE"],
        "terminal": os.environ.get("REDSYS_TERMINAL", "1"),
        "currency": os.environ.get("REDSYS_CURRENCY", "978"),
        "secret_key": os.environ["REDSYS_SECRET_KEY"],
        "endpoint": os.environ.get("REDSYS_ENDPOINT", "https://sis-t.redsys.es:25443/sis/realizarPago"),
    }


@router.get("/payments/redsys/health")
async def redsys_health():
    """Diagnóstico rápido para confirmar si la pasarela está configurada.
    Devuelve 200 aunque falte configuración — el body indica qué falta."""
    required = ["REDSYS_MERCHANT_CODE", "REDSYS_SECRET_KEY"]
    missing = [k for k in required if not os.environ.get(k)]
    endpoint = os.environ.get("REDSYS_ENDPOINT", "https://sis-t.redsys.es:25443/sis/realizarPago")
    return {
        "configured": len(missing) == 0,
        "missing": missing,
        "environment": "test" if "sis-t.redsys" in endpoint else "production",
        "merchant_code": os.environ.get("REDSYS_MERCHANT_CODE", "")[:4] + "..." if os.environ.get("REDSYS_MERCHANT_CODE") else "",
        "terminal": os.environ.get("REDSYS_TERMINAL", "1"),
    }


def _merchant_order(order_number: str) -> str:
    """Redsys exige Ds_Merchant_Order: 4-12 chars, [A-Za-z0-9], primeros 4 dígitos.
    Nuestros números son P00013 → prefijo P + dígitos. Redsys es estricto.
    Estrategia: coger sólo dígitos y padd por delante con un tail de tiempo."""
    digits = "".join(c for c in order_number if c.isdigit())
    # Prefijo 4 dígitos (por convención Redsys). Si no hay 4, rellenamos.
    if len(digits) < 4:
        digits = digits.zfill(4)
    # Añadimos sufijo de segundos del día para evitar colisiones
    now = datetime.now(timezone.utc)
    tail = f"{now.hour:02d}{now.minute:02d}{now.second:02d}"
    # Redsys admite hasta 12 chars. Componemos: digits(≥4) + tail(6)
    return (digits + tail)[:12]


@router.post("/checkout/redsys")
async def create_redsys_checkout(payload: CheckoutIn, request: Request):
    """Crea un pedido y devuelve los parámetros para enviar al TPV Redsys."""
    items, subtotal, vat_breakdown, vat_total, total = await _build_order_from_items(payload.items)

    if not items or float(total) <= 0:
        raise HTTPException(400, "No hay items válidos en la cesta o el importe total es 0.")

    order_number = await _next_number("order", "P")
    invoice_number = await _next_number("invoice", "F")
    now = datetime.now(timezone.utc).isoformat()
    merchant_order = _merchant_order(order_number)

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
        "payment_provider": "redsys",
        "merchant_order": merchant_order,
        "session_id": merchant_order,  # compatibilidad con el flujo Stripe
        "tracking": [{"status": "pending_payment", "at": now, "note": "Pedido creado (Redsys)"}],
        "created_at": now,
        "updated_at": now,
    }
    await db.orders.insert_one(order_doc)

    cfg = _cfg()
    # Redsys quiere el importe en céntimos como string
    amount_cents = str(int(round(float(total) * 100)))

    host_url = str(request.base_url).rstrip("/")
    origin = payload.origin_url.rstrip("/")

    merchant_params = {
        "Ds_Merchant_Amount": amount_cents,
        "Ds_Merchant_Order": merchant_order,
        "Ds_Merchant_MerchantCode": cfg["merchant_code"],
        "Ds_Merchant_Terminal": cfg["terminal"],
        "Ds_Merchant_Currency": cfg["currency"],
        "Ds_Merchant_TransactionType": "0",  # autorización
        "Ds_Merchant_ProductDescription": f"Pedido {order_number} - Las Dos Doncellas",
        "Ds_Merchant_Titular": payload.customer.name[:60],
        "Ds_Merchant_MerchantName": "Las Dos Doncellas",
        "Ds_Merchant_ConsumerLanguage": "001",  # ES
        "Ds_Merchant_UrlOK": f"{origin}/checkout/success?order={merchant_order}",
        "Ds_Merchant_UrlKO": f"{origin}/cart?redsys_error=1&order={merchant_order}",
        "Ds_Merchant_MerchantURL": f"{host_url}/api/payments/redsys/notify",
    }

    merchant_parameters = build_merchant_parameters(merchant_params)
    signature = create_signature(cfg["secret_key"], merchant_parameters, merchant_order)

    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "provider": "redsys",
        "session_id": merchant_order,
        "merchant_order": merchant_order,
        "order_number": order_number,
        "amount": float(total),
        "amount_cents": amount_cents,
        "currency": "eur",
        "payment_status": "initiated",
        "metadata": {"customer_email": payload.customer.email},
        "created_at": now,
        "updated_at": now,
    })

    return {
        "provider": "redsys",
        "endpoint": cfg["endpoint"],
        "Ds_SignatureVersion": "HMAC_SHA256_V1",
        "Ds_MerchantParameters": merchant_parameters,
        "Ds_Signature": signature,
        "order_number": order_number,
        "merchant_order": merchant_order,
    }


@router.post("/payments/redsys/notify")
async def redsys_notify(request: Request):
    """Notificación server-to-server firmada por Redsys. Fuente única de verdad."""
    form = await request.form()
    merchant_parameters = form.get("Ds_MerchantParameters")
    received_sig = form.get("Ds_Signature")
    version = form.get("Ds_SignatureVersion") or "HMAC_SHA256_V1"

    if not merchant_parameters or not received_sig:
        raise HTTPException(400, "invalid notification payload")

    if version != "HMAC_SHA256_V1":
        raise HTTPException(400, f"unsupported signature version {version}")

    try:
        data = decode_merchant_parameters(merchant_parameters)
    except Exception as e:  # noqa: BLE001
        logger.exception("cannot decode merchant_parameters: %s", e)
        raise HTTPException(400, "bad merchant_parameters")

    merchant_order = data.get("Ds_Order") or data.get("Ds_Merchant_Order")
    if not merchant_order:
        raise HTTPException(400, "missing Ds_Order")

    cfg = _cfg()
    if not verify_signature(cfg["secret_key"], merchant_parameters, merchant_order, received_sig):
        logger.warning("redsys signature mismatch for order %s", merchant_order)
        raise HTTPException(400, "bad signature")

    ds_response = str(data.get("Ds_Response", "9999"))
    # 0000-0099 = aceptado
    try:
        paid = 0 <= int(ds_response) <= 99
    except ValueError:
        paid = False

    now = datetime.now(timezone.utc).isoformat()
    status = "confirmed" if paid else "pending_payment"
    payment_status = "paid" if paid else "failed"

    # Actualiza pedido
    result = await db.orders.update_one(
        {"merchant_order": merchant_order},
        {"$set": {
            "status": status,
            "payment_status": payment_status,
            "ds_response": ds_response,
            "authorization_code": data.get("Ds_AuthorisationCode"),
            "updated_at": now,
        },
         "$push": {"tracking": {"status": status, "at": now,
                                "note": f"Redsys Ds_Response={ds_response}"}}},
    )

    # Actualiza transacción
    await db.payment_transactions.update_one(
        {"merchant_order": merchant_order},
        {"$set": {"payment_status": payment_status, "ds_response": ds_response,
                  "authorization_code": data.get("Ds_AuthorisationCode"),
                  "raw_notification": data, "updated_at": now}},
    )

    logger.info("redsys notify order=%s status=%s Ds_Response=%s", merchant_order, payment_status, ds_response)

    if paid and result.modified_count > 0:
        # Enviar email de confirmación en un fire-and-forget para no bloquear a Redsys
        try:
            from email_service import send_order_confirmation  # noqa: WPS433
            order = await db.orders.find_one({"merchant_order": merchant_order})
            if order:
                await send_order_confirmation(order)
        except Exception as e:  # noqa: BLE001
            logger.warning("post-payment email failed: %s", e)

        # Espejo en el portal (tienda.ventas) — silencioso, no bloqueante
        try:
            from routers_portal_push import push_order_silent  # noqa: WPS433
            order = order or await db.orders.find_one({"merchant_order": merchant_order}, {"_id": 0})
            if order:
                await push_order_silent(order)
        except Exception as e:  # noqa: BLE001
            logger.warning("portal push failed: %s", e)

    # Redsys sólo requiere HTTP 200; el cuerpo se ignora
    return {"ok": True}


@router.get("/checkout/redsys/status/{merchant_order}")
async def redsys_status(merchant_order: str):
    """El frontend consulta este endpoint tras volver de Redsys para saber si
    el pago se ha confirmado (la notificación server-to-server llegó)."""
    order = await db.orders.find_one({"merchant_order": merchant_order}, {"_id": 0})
    if not order:
        raise HTTPException(404, "order not found")
    return {
        "order_number": order.get("order_number"),
        "payment_status": order.get("payment_status"),
        "status": order.get("status"),
        "total": order.get("total"),
        "ds_response": order.get("ds_response"),
        "authorization_code": order.get("authorization_code"),
    }
