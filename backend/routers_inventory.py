"""Inventory / Compras / Recepciones — Phase 6 (the "engranaje").

Wires purchases → stock → invoices → production in one integrated flow:

  1) A pending stock_alert (Fase 4) can be CONVERTED into a purchase_order.
  2) A purchase_order gets a goods_receipt when the merchandise arrives:
     - creates a stock_lot per product with expiry + location
     - increments products.stock
     - recomputes products.average_cost (weighted)
     - stores last_cost
  3) The goods_receipt can automatically generate a supplier_invoice
     in status='pending_payment'.
  4) A production_slicing that links to a product via `producto_inventario_id`
     will FIFO-consume from the earliest expiring active lot to keep stock
     accurate. (Optional, opt-in per slicing.)

Collections:
  warehouse_locations, stock_lots, purchase_orders, goods_receipts,
  supplier_invoices
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from db import db
from auth import require_permission, get_current_user

router = APIRouter(prefix="/api", tags=["inventory"])

PERM_READ = "products.read"
PERM_WRITE = "products.write"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _next_seq(prefix: str, collection_name: str, field: str) -> str:
    year = datetime.now(timezone.utc).year
    count = await db[collection_name].count_documents({field: {"$regex": f"^{prefix}-{year}-"}})
    return f"{prefix}-{year}-{(count + 1):05d}"


# ============================================================ Locations

class LocationIn(BaseModel):
    nombre: str
    tipo: str = "almacen"  # almacen | camara_frigorifica | sala_loncheado | tienda
    direccion: Optional[str] = ""
    temperatura: Optional[str] = ""  # ej "4°C" / "ambiente"
    activo: bool = True
    notas: Optional[str] = ""


@router.get("/inventory/locations")
async def list_locations(_=Depends(require_permission(PERM_READ))):
    return [l async for l in db.warehouse_locations.find({}, {"_id": 0}).sort("nombre", 1)]


@router.post("/inventory/locations")
async def create_location(payload: LocationIn, _=Depends(require_permission(PERM_WRITE))):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4()); doc["created_at"] = _now()
    await db.warehouse_locations.insert_one(doc); doc.pop("_id", None); return doc


@router.patch("/inventory/locations/{lid}")
async def update_location(lid: str, payload: LocationIn, _=Depends(require_permission(PERM_WRITE))):
    if not await db.warehouse_locations.find_one({"id": lid}):
        raise HTTPException(404, "Ubicación no encontrada")
    await db.warehouse_locations.update_one({"id": lid}, {"$set": payload.model_dump()})
    return await db.warehouse_locations.find_one({"id": lid}, {"_id": 0})


@router.delete("/inventory/locations/{lid}")
async def delete_location(lid: str, _=Depends(require_permission(PERM_WRITE))):
    r = await db.warehouse_locations.delete_one({"id": lid})
    if r.deleted_count == 0: raise HTTPException(404, "Ubicación no encontrada")
    return {"ok": True}


# ============================================================ Stock lots

class StockLotIn(BaseModel):
    product_id: str
    lot_number: Optional[str] = ""
    location_id: Optional[str] = None
    qty_received: float = Field(ge=0)
    qty_available: float = Field(ge=0)
    unit_cost: float = Field(ge=0)
    expires_at: Optional[str] = None  # YYYY-MM-DD
    received_at: Optional[str] = None
    receipt_id: Optional[str] = None
    notes: Optional[str] = ""


@router.get("/inventory/lots")
async def list_lots(
    product_id: Optional[str] = None,
    active_only: bool = True,
    expiring_days: Optional[int] = None,
    _=Depends(require_permission(PERM_READ)),
):
    q = {}
    if product_id: q["product_id"] = product_id
    if active_only: q["qty_available"] = {"$gt": 0}
    if expiring_days is not None:
        from datetime import timedelta
        limit_date = (datetime.now(timezone.utc) + timedelta(days=expiring_days)).date().isoformat()
        q["expires_at"] = {"$ne": None, "$lte": limit_date}
    cursor = db.stock_lots.find(q, {"_id": 0}).sort([("expires_at", 1), ("received_at", 1)])
    return [l async for l in cursor]


@router.post("/inventory/lots")
async def create_lot(payload: StockLotIn, _=Depends(require_permission(PERM_WRITE))):
    if not await db.products.find_one({"id": payload.product_id}):
        raise HTTPException(400, "Producto no encontrado")
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["received_at"] = doc.get("received_at") or _now()
    doc["created_at"] = _now()
    if not doc.get("lot_number"):
        doc["lot_number"] = await _next_seq("LOT", "stock_lots", "lot_number")
    await db.stock_lots.insert_one(doc); doc.pop("_id", None); return doc


@router.delete("/inventory/lots/{lot_id}")
async def delete_lot(lot_id: str, _=Depends(require_permission(PERM_WRITE))):
    r = await db.stock_lots.delete_one({"id": lot_id})
    if r.deleted_count == 0: raise HTTPException(404, "Lote no encontrado")
    return {"ok": True}


@router.get("/inventory/valuation")
async def inventory_valuation(_=Depends(require_permission(PERM_READ))):
    """Valor total del stock por producto + total."""
    pipe = [
        {"$match": {"qty_available": {"$gt": 0}}},
        {"$group": {
            "_id": "$product_id",
            "qty_total": {"$sum": "$qty_available"},
            "valor": {"$sum": {"$multiply": ["$qty_available", "$unit_cost"]}},
            "lotes": {"$sum": 1},
        }},
        {"$sort": {"valor": -1}},
    ]
    rows = [r async for r in db.stock_lots.aggregate(pipe)]
    # enrich with product names
    ids = [r["_id"] for r in rows if r["_id"]]
    products = {p["id"]: p async for p in db.products.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "name": 1, "sku": 1})}
    out = []
    total_valor = 0
    for r in rows:
        p = products.get(r["_id"], {})
        out.append({
            "product_id": r["_id"],
            "product_name": p.get("name", "?"),
            "sku": p.get("sku", ""),
            "qty_total": round(r["qty_total"], 2),
            "valor": round(r["valor"], 2),
            "lotes": r["lotes"],
        })
        total_valor += r["valor"]
    return {"rows": out, "total_valor": round(total_valor, 2), "productos": len(out)}


# ============================================================ Purchase Orders

class PurchaseItem(BaseModel):
    product_id: str
    sku: str
    name: str
    qty: float = Field(ge=0)
    unit_cost: float = Field(ge=0)


class PurchaseOrderIn(BaseModel):
    provider_id: str
    items: List[PurchaseItem]
    notes: Optional[str] = ""
    expected_at: Optional[str] = None


@router.get("/purchase-orders")
async def list_pos(status: Optional[str] = None, _=Depends(require_permission(PERM_READ))):
    q = {}
    if status: q["status"] = status
    return [p async for p in db.purchase_orders.find(q, {"_id": 0}).sort("created_at", -1)]


@router.get("/purchase-orders/{po_id}")
async def get_po(po_id: str, _=Depends(require_permission(PERM_READ))):
    p = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    if not p: raise HTTPException(404, "Pedido no encontrado")
    return p


@router.post("/purchase-orders")
async def create_po(payload: PurchaseOrderIn, _=Depends(require_permission(PERM_WRITE))):
    prov = await db.providers.find_one({"id": payload.provider_id}, {"_id": 0})
    if not prov: raise HTTPException(400, "Proveedor no encontrado")
    items = [i.model_dump() for i in payload.items]
    for it in items:
        it["line_total"] = round(it["qty"] * it["unit_cost"], 2)
    subtotal = sum(it["line_total"] for it in items)
    doc = {
        "id": str(uuid.uuid4()),
        "po_number": await _next_seq("PO", "purchase_orders", "po_number"),
        "provider_id": payload.provider_id,
        "provider": {k: prov.get(k) for k in ("id", "name", "company", "email", "phone")},
        "items": items,
        "subtotal": round(subtotal, 2),
        "total": round(subtotal, 2),
        "status": "pending",  # pending | partial | received | cancelled
        "notes": payload.notes or "",
        "expected_at": payload.expected_at,
        "source_alert_id": None,
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db.purchase_orders.insert_one(doc); doc.pop("_id", None); return doc


@router.post("/stock-alerts/{alert_id}/convert-to-po")
async def stock_alert_to_po(alert_id: str, user: dict = Depends(get_current_user)):
    """ENGRANAJE 1: convierte una alerta aprobada en un pedido a proveedor."""
    if not user.get("is_superadmin") and PERM_WRITE not in (user.get("permissions") or []):
        raise HTTPException(403, "Sin permiso")
    a = await db.stock_alerts.find_one({"id": alert_id})
    if not a: raise HTTPException(404, "Alerta no encontrada")
    if a["status"] not in ("approved", "sent"):
        raise HTTPException(400, "Solo alertas aprobadas/enviadas pueden convertirse en PO")

    prov = await db.providers.find_one({"id": a["provider_id"]}, {"_id": 0}) or a.get("provider", {})
    items = []
    for it in a.get("items", []):
        items.append({
            "product_id": it["product_id"],
            "sku": it["sku"], "name": it["name"],
            "qty": it["qty"], "unit_cost": it["unit_cost"],
            "line_total": round(it["qty"] * it["unit_cost"], 2),
        })
    subtotal = sum(i["line_total"] for i in items)
    doc = {
        "id": str(uuid.uuid4()),
        "po_number": await _next_seq("PO", "purchase_orders", "po_number"),
        "provider_id": a["provider_id"],
        "provider": {k: prov.get(k) for k in ("id", "name", "company", "email", "phone") if isinstance(prov, dict)},
        "items": items,
        "subtotal": round(subtotal, 2),
        "total": round(subtotal, 2),
        "status": "pending",
        "notes": f"Generado desde proforma {a.get('proforma_number') or a['id']}",
        "source_alert_id": alert_id,
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db.purchase_orders.insert_one(doc); doc.pop("_id", None)
    return doc


# ============================================================ Goods Receipts

class ReceiptItem(BaseModel):
    product_id: str
    sku: str
    name: str
    qty_received: float = Field(gt=0)
    unit_cost: float = Field(ge=0)
    lot_number: Optional[str] = ""
    location_id: Optional[str] = None
    expires_at: Optional[str] = None


class ReceiptIn(BaseModel):
    provider_id: str
    purchase_order_id: Optional[str] = None
    items: List[ReceiptItem]
    notes: Optional[str] = ""
    generate_invoice: bool = True


@router.get("/goods-receipts")
async def list_receipts(_=Depends(require_permission(PERM_READ))):
    return [r async for r in db.goods_receipts.find({}, {"_id": 0}).sort("created_at", -1)]


@router.get("/goods-receipts/{rid}")
async def get_receipt(rid: str, _=Depends(require_permission(PERM_READ))):
    r = await db.goods_receipts.find_one({"id": rid}, {"_id": 0})
    if not r: raise HTTPException(404, "Recepción no encontrada")
    return r


@router.post("/goods-receipts")
async def create_receipt(payload: ReceiptIn, user: dict = Depends(get_current_user)):
    """ENGRANAJE 2: recibir mercancía → crear lotes, actualizar stock y coste medio ponderado
    del producto, y (opcional) generar factura de proveedor pendiente."""
    if not user.get("is_superadmin") and PERM_WRITE not in (user.get("permissions") or []):
        raise HTTPException(403, "Sin permiso")
    prov = await db.providers.find_one({"id": payload.provider_id}, {"_id": 0})
    if not prov: raise HTTPException(400, "Proveedor no encontrado")

    po = None
    if payload.purchase_order_id:
        po = await db.purchase_orders.find_one({"id": payload.purchase_order_id})
        if not po: raise HTTPException(400, "Pedido no encontrado")

    now = _now()
    receipt_id = str(uuid.uuid4())
    receipt_number = await _next_seq("REC", "goods_receipts", "receipt_number")
    receipt_items = []
    total = 0.0

    for it in payload.items:
        product = await db.products.find_one({"id": it.product_id})
        if not product:
            raise HTTPException(400, f"Producto {it.product_id} no encontrado")

        # Lot
        lot_id = str(uuid.uuid4())
        lot_number = it.lot_number or await _next_seq("LOT", "stock_lots", "lot_number")
        lot_doc = {
            "id": lot_id, "product_id": it.product_id,
            "lot_number": lot_number, "location_id": it.location_id,
            "qty_received": it.qty_received, "qty_available": it.qty_received,
            "unit_cost": it.unit_cost,
            "expires_at": it.expires_at, "received_at": now,
            "receipt_id": receipt_id, "created_at": now, "notes": "",
        }
        await db.stock_lots.insert_one(lot_doc)

        # Update product stock + average cost (weighted)
        current_stock = float(product.get("stock") or 0)
        current_avg = float(product.get("average_cost") or 0)
        new_stock = current_stock + it.qty_received
        # weighted average
        if new_stock > 0:
            new_avg = ((current_stock * current_avg) + (it.qty_received * it.unit_cost)) / new_stock
        else:
            new_avg = it.unit_cost
        await db.products.update_one({"id": it.product_id}, {"$set": {
            "stock": new_stock,
            "average_cost": round(new_avg, 4),
            "last_cost": it.unit_cost,
            "updated_at": now,
        }})

        line_total = round(it.qty_received * it.unit_cost, 2)
        total += line_total
        receipt_items.append({
            **it.model_dump(),
            "lot_id": lot_id, "lot_number": lot_number,
            "line_total": line_total,
        })

    receipt = {
        "id": receipt_id,
        "receipt_number": receipt_number,
        "provider_id": payload.provider_id,
        "provider": {k: prov.get(k) for k in ("id", "name", "company", "email", "phone")},
        "purchase_order_id": payload.purchase_order_id,
        "po_number": po.get("po_number") if po else None,
        "items": receipt_items,
        "total": round(total, 2),
        "notes": payload.notes or "",
        "invoice_id": None,
        "created_by": user.get("id"),
        "created_at": now,
    }
    await db.goods_receipts.insert_one(receipt)

    # Update PO status
    if po:
        await db.purchase_orders.update_one({"id": po["id"]}, {"$set": {
            "status": "received", "updated_at": now,
        }})

    # Optional: auto-generate supplier invoice
    invoice = None
    if payload.generate_invoice:
        inv_id = str(uuid.uuid4())
        invoice = {
            "id": inv_id,
            "invoice_number": await _next_seq("FAC", "supplier_invoices", "invoice_number"),
            "provider_id": payload.provider_id,
            "provider": {k: prov.get(k) for k in ("id", "name", "company", "email", "phone")},
            "receipt_id": receipt_id,
            "po_number": po.get("po_number") if po else None,
            "items": [{"name": i["name"], "qty": i["qty_received"], "unit_cost": i["unit_cost"], "line_total": i["line_total"]} for i in receipt_items],
            "subtotal": round(total, 2),
            "vat_pct": 10.0,
            "vat_amount": round(total * 0.10, 2),
            "total": round(total * 1.10, 2),
            "status": "pending_payment",  # pending_payment | paid | overdue | cancelled
            "issue_date": now[:10],
            "due_date": None,
            "paid_at": None,
            "created_at": now,
        }
        await db.supplier_invoices.insert_one(invoice)
        await db.goods_receipts.update_one({"id": receipt_id}, {"$set": {"invoice_id": inv_id}})
        receipt["invoice_id"] = inv_id

    receipt.pop("_id", None)
    if invoice: invoice.pop("_id", None)
    return {"receipt": receipt, "invoice": invoice}


# ============================================================ Supplier Invoices

class SupplierInvoicePatch(BaseModel):
    status: Optional[str] = None  # pending_payment | paid | overdue | cancelled
    due_date: Optional[str] = None
    paid_at: Optional[str] = None
    notes: Optional[str] = None


@router.get("/supplier-invoices")
async def list_supplier_invoices(status: Optional[str] = None, _=Depends(require_permission(PERM_READ))):
    q = {}
    if status: q["status"] = status
    return [i async for i in db.supplier_invoices.find(q, {"_id": 0}).sort("created_at", -1)]


@router.patch("/supplier-invoices/{iid}")
async def patch_invoice(iid: str, payload: SupplierInvoicePatch, _=Depends(require_permission(PERM_WRITE))):
    existing = await db.supplier_invoices.find_one({"id": iid})
    if not existing: raise HTTPException(404, "Factura no encontrada")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates.get("status") == "paid" and not updates.get("paid_at"):
        updates["paid_at"] = _now()
    await db.supplier_invoices.update_one({"id": iid}, {"$set": updates})
    return await db.supplier_invoices.find_one({"id": iid}, {"_id": 0})


@router.get("/supplier-invoices/summary")
async def supplier_invoices_summary(_=Depends(require_permission(PERM_READ))):
    """Totales pendiente/pagado/vencido para el dashboard."""
    today = datetime.now(timezone.utc).date().isoformat()
    pipe = [{"$group": {"_id": "$status", "total": {"$sum": "$total"}, "count": {"$sum": 1}}}]
    rows = [r async for r in db.supplier_invoices.aggregate(pipe)]
    stats = {r["_id"]: {"total": round(r["total"], 2), "count": r["count"]} for r in rows}
    # overdue = pending with due_date < today
    overdue_pipe = [
        {"$match": {"status": "pending_payment", "due_date": {"$ne": None, "$lt": today}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
    ]
    ov = [r async for r in db.supplier_invoices.aggregate(overdue_pipe)]
    stats["overdue"] = {"total": round(ov[0]["total"], 2), "count": ov[0]["count"]} if ov else {"total": 0, "count": 0}
    return stats


# ============================================================ FIFO consume (ENGRANAJE 3)

class ConsumeIn(BaseModel):
    product_id: str
    qty: float = Field(gt=0)
    reference: Optional[str] = ""  # ej "slicing:<id>"


async def _consume_fifo(product_id: str, qty: float, reference: str = "") -> dict:
    """Internal FIFO consumer. Called both from the /inventory/consume endpoint
    and from other routers (slicings) to keep stock in sync."""
    if not await db.products.find_one({"id": product_id}):
        raise HTTPException(400, "Producto no encontrado")

    remaining = qty
    consumed = []
    lots = db.stock_lots.find({
        "product_id": product_id,
        "qty_available": {"$gt": 0},
    }).sort([("expires_at", 1), ("received_at", 1)])
    async for lot in lots:
        if remaining <= 0: break
        take = min(remaining, lot["qty_available"])
        new_avail = lot["qty_available"] - take
        await db.stock_lots.update_one({"id": lot["id"]}, {"$set": {"qty_available": round(new_avail, 4)}})
        consumed.append({
            "lot_id": lot["id"], "lot_number": lot.get("lot_number"),
            "qty_consumed": round(take, 4), "unit_cost": lot.get("unit_cost", 0),
            "expires_at": lot.get("expires_at"),
        })
        remaining -= take

    total_available = 0
    async for lot in db.stock_lots.find({"product_id": product_id, "qty_available": {"$gt": 0}}):
        total_available += lot["qty_available"]
    await db.products.update_one({"id": product_id}, {"$set": {
        "stock": round(total_available, 2), "updated_at": _now(),
    }})

    await db.stock_movements.insert_one({
        "id": str(uuid.uuid4()),
        "product_id": product_id,
        "qty": -qty,
        "reference": reference,
        "lots_affected": consumed,
        "created_at": _now(),
    })
    return {
        "requested": qty,
        "consumed_total": round(qty - remaining, 4),
        "unmet": round(remaining, 4),
        "lots": consumed,
    }


@router.post("/inventory/consume")
async def consume_stock(payload: ConsumeIn, _=Depends(require_permission(PERM_WRITE))):
    """ENGRANAJE 3: descontar qty del producto usando FIFO (lote más antiguo por caducidad
    y fecha de recepción). Devuelve los lotes afectados. Usado desde loncheados u otras
    operaciones que reducen inventario."""
    return await _consume_fifo(payload.product_id, payload.qty, payload.reference or "")
