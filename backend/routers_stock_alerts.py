"""Stock Alerts — auto-generated proforma orders for low-stock products.

Flow:
  1) Scan products with stock <= low_stock_threshold and provider_id set.
  2) Group items by provider_id → create draft proforma documents
     with status `pending_approval`.
  3) Superadmin reviews on /admin/stock-alerts, can edit suggested qty &
     unit cost, add notes.
  4) Superadmin APPROVES → PDF generated, emailed to provider, status `sent`.
     OR REJECTS with reason → status `rejected`.
"""
import io
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from db import db
from auth import require_permission, get_current_user
from proforma_pdf import generate_proforma_pdf
from email_service import send_proforma_to_provider

router = APIRouter(prefix="/api/stock-alerts", tags=["stock-alerts"])

STATUSES = ("pending_approval", "approved", "sent", "rejected")


# ------------------------------------------------------------------ helpers

def _suggested_qty(current_stock: int, threshold: int) -> int:
    """Default reorder qty so that final stock ~ 2 × threshold."""
    target = max(threshold * 2, 1)
    need = target - max(current_stock, 0)
    return max(need, 1)


def _items_total(items: list) -> dict:
    subtotal = sum((it.get("qty") or 0) * (it.get("unit_cost") or 0) for it in items)
    return {"subtotal": round(subtotal, 2), "total": round(subtotal, 2)}


async def _next_proforma_number() -> str:
    year = datetime.now(timezone.utc).year
    # Count existing proformas this year to assign next sequence
    count = await db.stock_alerts.count_documents({
        "proforma_number": {"$regex": f"^PRO-{year}-"}
    })
    return f"PRO-{year}-{(count + 1):05d}"


async def _build_groups(force_all: bool = False) -> List[dict]:
    """Scan products with low stock + provider_id set. Returns list grouped
    by provider with normalized items (NOT persisted)."""
    query = {
        "is_active": True,
        "provider_id": {"$nin": [None, ""]},
        "$expr": {"$lte": ["$stock", "$low_stock_threshold"]},
    }
    if force_all:
        query.pop("$expr", None)
    products = [p async for p in db.products.find(query, {"_id": 0})]

    # Filter out products with threshold = 0 if not force_all
    if not force_all:
        products = [p for p in products if (p.get("low_stock_threshold") or 0) > 0]

    groups = defaultdict(list)
    for p in products:
        threshold = int(p.get("low_stock_threshold") or 0)
        current = int(p.get("stock") or 0)
        qty = _suggested_qty(current, threshold)
        unit_cost = float(p.get("cost_price") or p.get("price") or 0)
        groups[p["provider_id"]].append({
            "product_id": p["id"],
            "sku": p.get("sku", ""),
            "name": p.get("name", ""),
            "current_stock": current,
            "threshold": threshold,
            "qty": qty,
            "unit_cost": round(unit_cost, 2),
            "line_total": round(qty * unit_cost, 2),
        })

    out = []
    for provider_id, items in groups.items():
        provider = await db.providers.find_one({"id": provider_id}, {"_id": 0})
        if not provider:
            continue
        totals = _items_total(items)
        out.append({
            "provider_id": provider_id,
            "provider": {
                "id": provider.get("id"),
                "name": provider.get("name"),
                "company": provider.get("company"),
                "contact_name": provider.get("contact_name"),
                "email": provider.get("email"),
                "phone": provider.get("phone"),
                "address": provider.get("address"),
                "city": provider.get("city"),
                "postal_code": provider.get("postal_code"),
                "country": provider.get("country"),
                "tax_id": provider.get("tax_id"),
            },
            "items": items,
            **totals,
        })
    return out


# ------------------------------------------------------------------ models

class ItemEdit(BaseModel):
    product_id: str
    sku: str
    name: str
    current_stock: int = 0
    threshold: int = 0
    qty: int = Field(ge=0)
    unit_cost: float = Field(ge=0)


class AlertUpdate(BaseModel):
    items: Optional[List[ItemEdit]] = None
    notes: Optional[str] = None


class RejectIn(BaseModel):
    reason: str = Field(min_length=1, max_length=400)


# ------------------------------------------------------------------ endpoints

@router.get("/scan")
async def scan_low_stock(
    force_all: bool = False,
    _=Depends(require_permission("stock.read")),
):
    """Live preview — no DB writes. Returns proforma groups for products
    currently at or below threshold. If `force_all` is true, returns
    every active product with a provider (useful for manual ordering)."""
    groups = await _build_groups(force_all=force_all)
    total_items = sum(len(g["items"]) for g in groups)
    total_value = sum(g["total"] for g in groups)
    return {
        "groups": groups,
        "summary": {
            "providers": len(groups),
            "items": total_items,
            "total_value": round(total_value, 2),
            "scanned_at": datetime.now(timezone.utc).isoformat(),
        },
    }


@router.post("/generate")
async def generate_drafts(
    force_all: bool = False,
    user: dict = Depends(require_permission("stock.write")),
):
    """Persist proformas as drafts (status `pending_approval`).

    De-dupes: if a pending_approval draft already exists for a provider,
    it is updated rather than duplicated. Returns the list of created/updated
    drafts.
    """
    groups = await _build_groups(force_all=force_all)
    if not groups:
        return {"created": [], "updated": [], "message": "No hay productos con stock bajo en este momento."}

    now = datetime.now(timezone.utc).isoformat()
    created, updated = [], []
    for g in groups:
        existing = await db.stock_alerts.find_one({
            "provider_id": g["provider_id"], "status": "pending_approval",
        })
        if existing:
            await db.stock_alerts.update_one(
                {"id": existing["id"]},
                {"$set": {
                    "items": g["items"],
                    "subtotal": g["subtotal"],
                    "total": g["total"],
                    "provider": g["provider"],
                    "updated_at": now,
                    "regenerated_at": now,
                }},
            )
            doc = await db.stock_alerts.find_one({"id": existing["id"]}, {"_id": 0})
            updated.append(doc)
        else:
            doc = {
                "id": str(uuid.uuid4()),
                "provider_id": g["provider_id"],
                "provider": g["provider"],
                "items": g["items"],
                "subtotal": g["subtotal"],
                "total": g["total"],
                "status": "pending_approval",
                "proforma_number": None,
                "notes": "",
                "rejected_reason": None,
                "approved_by_id": None,
                "approved_by_name": None,
                "created_at": now,
                "updated_at": now,
                "reviewed_at": None,
                "sent_at": None,
                "email_sent": False,
                "created_by_id": user.get("id"),
            }
            await db.stock_alerts.insert_one(doc)
            doc.pop("_id", None)
            created.append(doc)
    return {"created": created, "updated": updated}


@router.get("")
async def list_alerts(
    status: Optional[str] = None,
    _=Depends(require_permission("stock.read")),
):
    query = {}
    if status:
        if status not in STATUSES:
            raise HTTPException(status_code=400, detail=f"Estado inválido. Usa uno de: {', '.join(STATUSES)}")
        query["status"] = status
    cursor = db.stock_alerts.find(query, {"_id": 0}).sort("created_at", -1)
    return [a async for a in cursor]


@router.get("/{alert_id}")
async def get_alert(alert_id: str, _=Depends(require_permission("stock.read"))):
    a = await db.stock_alerts.find_one({"id": alert_id}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    return a


@router.patch("/{alert_id}")
async def update_alert(
    alert_id: str,
    payload: AlertUpdate,
    _=Depends(require_permission("stock.write")),
):
    existing = await db.stock_alerts.find_one({"id": alert_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    if existing["status"] not in ("pending_approval",):
        raise HTTPException(status_code=400, detail="Solo se pueden editar alertas pendientes de aprobación")

    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if payload.items is not None:
        items = []
        for it in payload.items:
            d = it.model_dump()
            d["line_total"] = round(d["qty"] * d["unit_cost"], 2)
            items.append(d)
        totals = _items_total(items)
        updates["items"] = items
        updates.update(totals)
    if payload.notes is not None:
        updates["notes"] = payload.notes

    await db.stock_alerts.update_one({"id": alert_id}, {"$set": updates})
    return await db.stock_alerts.find_one({"id": alert_id}, {"_id": 0})


@router.post("/{alert_id}/approve")
async def approve_alert(
    alert_id: str,
    user: dict = Depends(get_current_user),
):
    """SUPERADMIN ONLY. Approve the proforma, assign a number, generate the
    PDF, email it to the provider, log the communication, and update
    product stock will NOT happen here — stock is updated only when the
    provider confirms (manual process)."""
    if not user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Solo el superadministrador puede aprobar proformas")

    a = await db.stock_alerts.find_one({"id": alert_id})
    if not a:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    if a["status"] not in ("pending_approval",):
        raise HTTPException(status_code=400, detail="Solo se pueden aprobar alertas pendientes")
    if not a.get("items"):
        raise HTTPException(status_code=400, detail="La proforma no tiene productos")
    if not (a.get("provider") or {}).get("email"):
        raise HTTPException(status_code=400, detail="El proveedor no tiene email configurado")

    now = datetime.now(timezone.utc)
    proforma_number = await _next_proforma_number()
    approver_name = f"{user.get('first_name','')} {user.get('last_name','')}".strip() or user.get("email", "")

    proforma_data = {
        **a,
        "proforma_number": proforma_number,
        "created_at_date": now.strftime("%d/%m/%Y"),
        "approved_by_name": approver_name,
    }

    # 1) Generate PDF
    try:
        pdf_bytes = generate_proforma_pdf(proforma_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {e}")

    # 2) Send to provider
    email_ok = False
    try:
        email_ok = await send_proforma_to_provider(a["provider"], proforma_data, pdf_bytes)
    except Exception as e:
        email_ok = False
        # We don't abort — the admin can re-send from the UI.
        # The PDF is generated successfully.
        _ = e

    # 3) Persist final state
    await db.stock_alerts.update_one({"id": alert_id}, {"$set": {
        "status": "sent" if email_ok else "approved",
        "proforma_number": proforma_number,
        "approved_by_id": user.get("id"),
        "approved_by_name": approver_name,
        "reviewed_at": now.isoformat(),
        "sent_at": now.isoformat() if email_ok else None,
        "email_sent": email_ok,
        "updated_at": now.isoformat(),
    }})

    # 4) Log into provider_communications collection (existing)
    try:
        await db.provider_communications.insert_one({
            "id": str(uuid.uuid4()),
            "provider_id": a["provider_id"],
            "type": "proforma",
            "subject": f"Pedido proforma {proforma_number}",
            "body": f"Pedido proforma con {len(a['items'])} productos · Total {a['total']:.2f} €",
            "proforma_number": proforma_number,
            "alert_id": alert_id,
            "email_sent": email_ok,
            "sent_at": now.isoformat(),
        })
    except Exception:
        pass

    return await db.stock_alerts.find_one({"id": alert_id}, {"_id": 0})


@router.post("/{alert_id}/reject")
async def reject_alert(
    alert_id: str,
    payload: RejectIn,
    user: dict = Depends(get_current_user),
):
    if not user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Solo el superadministrador puede rechazar proformas")

    a = await db.stock_alerts.find_one({"id": alert_id})
    if not a:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    if a["status"] not in ("pending_approval",):
        raise HTTPException(status_code=400, detail="Solo se pueden rechazar alertas pendientes")

    now = datetime.now(timezone.utc).isoformat()
    await db.stock_alerts.update_one({"id": alert_id}, {"$set": {
        "status": "rejected",
        "rejected_reason": payload.reason,
        "reviewed_at": now,
        "updated_at": now,
        "approved_by_id": user.get("id"),
        "approved_by_name": f"{user.get('first_name','')} {user.get('last_name','')}".strip() or user.get("email", ""),
    }})
    return await db.stock_alerts.find_one({"id": alert_id}, {"_id": 0})


@router.delete("/{alert_id}")
async def delete_alert(alert_id: str, _=Depends(require_permission("stock.write"))):
    r = await db.stock_alerts.delete_one({"id": alert_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    return {"ok": True}


@router.get("/{alert_id}/pdf")
async def download_alert_pdf(alert_id: str, _=Depends(require_permission("stock.read"))):
    a = await db.stock_alerts.find_one({"id": alert_id}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    proforma_number = a.get("proforma_number") or "BORRADOR"
    created_at = a.get("created_at") or datetime.now(timezone.utc).isoformat()
    proforma_data = {
        **a,
        "proforma_number": proforma_number,
        "created_at_date": created_at[:10],
    }
    pdf_bytes = generate_proforma_pdf(proforma_data)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="proforma_{proforma_number}.pdf"'},
    )
