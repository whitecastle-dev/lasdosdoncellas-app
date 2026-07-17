"""ContaSimple bulk sync (production accounting portal).

Mirrors the design of ``routers_supabase_sync``: idempotent upserts keyed by
the ContaSimple record id, non-destructive, and paginated via the API's
``page`` / ``pageSize`` parameters.

Endpoints
    GET  /api/contasimple/status
    GET  /api/contasimple/preview
    POST /api/contasimple/run?only=customers,providers,...

Authentication
    OAuth2 via the "authentication_key" grant. Access tokens are cached in
    memory for their reported ``expires_in`` (typically 1h) minus a 60s
    safety margin.

Endpoints imported (each into a dedicated Mongo collection):
    entities/customers                    → contasimple_customers
    entities/providers                    → contasimple_providers
    accounting/invoices/issued/from       → contasimple_invoices_issued
    accounting/invoices/received/from     → contasimple_invoices_received
    accounting/expenses/from              → contasimple_expenses
    banks/treasury/movements              → contasimple_treasury_movements
    banks/treasury/payments               → contasimple_treasury_payments
    configuration/paymentmethods          → contasimple_payment_methods
"""
from __future__ import annotations

import os
import time
import logging
from typing import Optional, Any
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from db import db
from auth import require_permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/contasimple", tags=["contasimple-sync"])

PERM = "products.write"

# Sentinel start date to trigger "all history" behaviour on the /from endpoints
HISTORY_START = "1900-01-01"

# Token cache
_TOKEN: dict[str, Any] = {"access_token": None, "expires_at": 0}


def _config() -> tuple[str, str]:
    url = (os.environ.get("CONTASIMPLE_API_URL") or "").rstrip("/")
    key = os.environ.get("CONTASIMPLE_AUTH_KEY") or ""
    if not url or not key:
        raise HTTPException(
            status_code=400,
            detail="CONTASIMPLE_API_URL y CONTASIMPLE_AUTH_KEY no están configurados en el backend (.env).",
        )
    return url, key


async def _get_token(force: bool = False) -> str:
    """Return a live access token, requesting a new one when expired."""
    now = time.time()
    if not force and _TOKEN["access_token"] and _TOKEN["expires_at"] > now + 30:
        return _TOKEN["access_token"]
    url, key = _config()
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(
            f"{url}/oauth/token",
            data={"key": key, "grant_type": "authentication_key"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"ContaSimple oauth error {r.status_code}: {r.text[:200]}")
    body = r.json()
    _TOKEN["access_token"] = body["access_token"]
    _TOKEN["expires_at"] = now + int(body.get("expires_in") or 3600) - 60
    return _TOKEN["access_token"]


async def _api_get(path: str, params: Optional[dict] = None) -> dict:
    url, _ = _config()
    token = await _get_token()
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(f"{url}/{path.lstrip('/')}", params=params or {},
                             headers={"Authorization": f"Bearer {token}"})
    if r.status_code == 401:
        token = await _get_token(force=True)
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.get(f"{url}/{path.lstrip('/')}", params=params or {},
                                 headers={"Authorization": f"Bearer {token}"})
    if r.status_code >= 400:
        raise HTTPException(status_code=502,
            detail=f"ContaSimple {path} {r.status_code}: {r.text[:200]}")
    try:
        return r.json()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"ContaSimple {path} non-JSON: {e}") from e


async def _fetch_paged(path: str, base_params: Optional[dict] = None, page_size: int = 200) -> list[dict]:
    """Iterate pages using ContaSimple's ``startIndex`` / ``numRows`` convention.

    ContaSimple caps most endpoints at 50 rows per call regardless of ``numRows``,
    so we always advance by the actual batch length.
    """
    rows: list[dict] = []
    start = 0
    while True:
        params = {**(base_params or {}), "startIndex": start, "numRows": page_size}
        payload = await _api_get(path, params)
        batch = payload.get("data") or []
        if not batch:
            break
        rows.extend(batch)
        total = int(payload.get("totalCount") or 0)
        if len(rows) >= total:
            break
        start += len(batch)
        if start > 100000:  # safety cap
            break
    return rows


async def _upsert(coll, doc: dict, key: str = "id") -> str:
    existing = await coll.find_one({key: doc[key]})
    if existing:
        await coll.update_one({key: doc[key]}, {"$set": doc})
        return "updated"
    await coll.insert_one(doc)
    return "created"


# ---------------- Mappers (normalise ContaSimple payloads before storage) ----------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _map_entity(r: dict) -> dict:
    return {
        "id": r["id"],
        "company_id": r.get("companyId"),
        "type": r.get("type"),  # Target = customer, Issuer = provider
        "organization": r.get("organization") or "",
        "name": r.get("name") or "",
        "firstname": r.get("firstname") or "",
        "lastname": r.get("lastname") or "",
        "nif": r.get("nif") or "",
        "address": r.get("address") or "",
        "province": r.get("province") or "",
        "city": r.get("city") or "",
        "country": r.get("country") or "",
        "postal_code": r.get("postalCode") or "",
        "phone": r.get("phone") or "",
        "mobile": r.get("mobile") or "",
        "email": r.get("email") or "",
        "notes": r.get("notes") or "",
        "discount_percentage": float(r.get("discountPercentage") or 0),
        "bank_accounts": r.get("bankAccounts") or [],
        "source": "contasimple",
        "synced_at": _now_iso(),
    }


def _map_invoice(r: dict) -> dict:
    def _party(p: Optional[dict]) -> dict:
        p = p or {}
        return {
            "id": p.get("id"),
            "organization": p.get("organization") or "",
            "nif": p.get("nif") or "",
            "email": p.get("email") or "",
            "city": p.get("city") or "",
            "postal_code": p.get("postalCode") or "",
        }
    return {
        "id": r["id"],
        "period": r.get("period"),
        "type": r.get("type"),  # Issued / Received / Amortized
        "number": r.get("number") or "",
        "notes": r.get("notes") or "",
        "invoice_date": r.get("invoiceDate"),
        "expiration_date": r.get("expirationDate"),
        "creation_date": r.get("creationDate"),
        "last_update_date": r.get("lastUpdateDate"),
        "status": r.get("status"),
        "total_taxable_amount": float(r.get("totalTaxableAmount") or 0),
        "total_vat_amount": float(r.get("totalVatAmount") or 0),
        "total_amount": float(r.get("totalAmount") or 0),
        "total_payed_amount": float(r.get("totalPayedAmount") or 0),
        "retention_amount": float(r.get("retentionAmount") or 0),
        "retention_percentage": float(r.get("retentionPercentage") or 0),
        "invoice_class": r.get("invoiceClass"),
        "invoice_class_description": r.get("invoiceClassDescription") or "",
        "operation_type": r.get("operationType"),
        "operation_type_description": r.get("operationTypeDescription") or "",
        "issuer": _party(r.get("issuer")),
        "target": _party(r.get("target")),
        "lines": [
            {
                "id": ln.get("id"),
                "concept": ln.get("concept") or "",
                "quantity": float(ln.get("quantity") or 0),
                "unit_taxable_amount": float(ln.get("unitTaxableAmount") or 0),
                "vat_percentage": float(ln.get("vatPercentage") or 0),
                "vat_amount": float(ln.get("vatAmount") or 0),
                "total_taxable_amount": float(ln.get("totalTaxableAmount") or 0),
            }
            for ln in (r.get("lines") or [])
        ],
        "source": "contasimple",
        "synced_at": _now_iso(),
    }


def _map_expense(r: dict) -> dict:
    d = _map_invoice(r)
    d["expense"] = True
    return d


def _map_treasury_movement(r: dict) -> dict:
    return {
        "id": r["id"],
        "account_id": r.get("treasuryAccountId") or (r.get("account") or {}).get("id"),
        "date": r.get("date"),
        "amount": float(r.get("amount") or 0),
        "balance": float(r.get("balance") or 0),
        "concept": r.get("concept") or r.get("description") or "",
        "reconciliation_status": r.get("reconciliationStatus"),
        "notes": r.get("notes") or "",
        "source": "contasimple",
        "synced_at": _now_iso(),
    }


def _map_treasury_payment(r: dict) -> dict:
    return {
        "id": r["id"],
        "date": r.get("date"),
        "amount": float(r.get("amount") or 0),
        "payment_method_id": r.get("paymentMethodId"),
        "payment_method_type": r.get("paymentMethodType"),
        "payment_method_name": r.get("paymentMethodName") or "",
        "description": r.get("description") or "",
        "related_document_id": r.get("relatedDocumentId"),
        "related_document_number": r.get("relatedDocumentNumber") or "",
        "related_document_type": r.get("relatedDocumentType"),
        "related_document_date": r.get("relatedDocumentDate"),
        "reconciliation_status": r.get("reconciliationStatus"),
        "reconciled_amount": float(r.get("reconciledAmount") or 0),
        "pending_amount_to_reconcile": float(r.get("pendingAmountToReconcile") or 0),
        "source": "contasimple",
        "synced_at": _now_iso(),
    }


def _map_payment_method(r: dict) -> dict:
    ta = r.get("treasuryAccount") or {}
    return {
        "id": r["id"],
        "type": r.get("type"),
        "name": r.get("name") or "",
        "number": r.get("number") or "",
        "active": bool(r.get("active", True)),
        "is_default": bool(r.get("isDefault", False)),
        "treasury_account": {
            "id": ta.get("id"),
            "type": ta.get("type"),
            "name": ta.get("name") or "",
            "balance": float(ta.get("balance") or 0),
        },
        "source": "contasimple",
        "synced_at": _now_iso(),
    }


# ---------------- Pipelines ----------------

# (label, source path, params, dest collection, mapper, paginated?)
PIPELINES: list[dict] = [
    {
        "label": "Clientes",  "src": "entities/customers", "params": {},
        "dest": "contasimple_customers", "mapper": _map_entity, "paged": True,
    },
    {
        "label": "Proveedores", "src": "entities/providers", "params": {},
        "dest": "contasimple_providers", "mapper": _map_entity, "paged": True,
    },
    {
        "label": "Facturas emitidas", "src": "accounting/invoices/issued/from",
        "params": {"date": HISTORY_START},
        "dest": "contasimple_invoices_issued", "mapper": _map_invoice, "paged": True,
    },
    {
        "label": "Facturas recibidas", "src": "accounting/invoices/received/from",
        "params": {"date": HISTORY_START},
        "dest": "contasimple_invoices_received", "mapper": _map_invoice, "paged": True,
    },
    {
        "label": "Gastos", "src": "accounting/expenses/from",
        "params": {"date": HISTORY_START},
        "dest": "contasimple_expenses", "mapper": _map_expense, "paged": True,
    },
    {
        "label": "Movimientos bancarios", "src": "banks/treasury/movements", "params": {},
        "dest": "contasimple_treasury_movements", "mapper": _map_treasury_movement, "paged": True,
    },
    {
        "label": "Cobros / Pagos", "src": "banks/treasury/payments", "params": {},
        "dest": "contasimple_treasury_payments", "mapper": _map_treasury_payment, "paged": True,
    },
    {
        "label": "Formas de pago", "src": "configuration/paymentmethods", "params": {},
        "dest": "contasimple_payment_methods", "mapper": _map_payment_method, "paged": True,
    },
]

SYNC_META_ID = "contasimple"


# ---------------- Endpoints ----------------

@router.get("/status")
async def status_(_=Depends(require_permission(PERM))):
    """Company info + last sync metadata."""
    try:
        me = await _api_get("me")
        company = (me.get("data") or {}).get("company") or {}
    except HTTPException as e:
        raise e
    meta = await db.sync_metadata.find_one({"id": SYNC_META_ID}) or {}
    counts = {}
    for p in PIPELINES:
        counts[p["dest"]] = await db[p["dest"]].count_documents({})
    return {
        "company": {
            "id": company.get("id"),
            "organization": company.get("organizationName"),
            "nif": company.get("nif"),
            "email": company.get("email"),
            "type": company.get("type"),
        },
        "last_sync_at": meta.get("last_sync_at"),
        "last_results": meta.get("last_results") or [],
        "collections": counts,
    }


@router.get("/preview")
async def preview(_=Depends(require_permission(PERM))):
    """Ping every source with numRows=1 to fetch its ``totalCount``."""
    out = []
    for p in PIPELINES:
        try:
            payload = await _api_get(p["src"], {**p["params"], "startIndex": 0, "numRows": 1})
            total = payload.get("totalCount") if isinstance(payload, dict) else None
            if total is None:
                total = len(payload.get("data") or []) if isinstance(payload, dict) else 0
            out.append({
                "label": p["label"], "src": p["src"],
                "dest": p["dest"], "count": int(total or 0), "status": 200,
            })
        except HTTPException as e:
            out.append({
                "label": p["label"], "src": p["src"], "dest": p["dest"],
                "count": 0, "status": e.status_code, "error": str(e.detail)[:200],
            })
        except Exception as e:  # noqa: BLE001
            out.append({
                "label": p["label"], "src": p["src"], "dest": p["dest"],
                "count": 0, "status": "error", "error": str(e)[:200],
            })
    return {"pipelines": out}


@router.post("/run")
async def run_sync(only: Optional[str] = None, _=Depends(require_permission(PERM))):
    """Full idempotent sync from ContaSimple.

    ``?only=customers,invoices_issued`` restricts to specific collections
    (matched against the ``dest`` collection suffix).
    """
    selected: Optional[set[str]] = None
    if only:
        selected = {s.strip() for s in only.split(",") if s.strip()}
    results = []
    for p in PIPELINES:
        suffix = p["dest"].removeprefix("contasimple_")
        if selected and suffix not in selected:
            continue
        try:
            rows = await _fetch_paged(p["src"], p["params"])
        except HTTPException as e:
            results.append({"label": p["label"], "dest": p["dest"], "error": str(e.detail)[:200]})
            continue
        except Exception as e:  # noqa: BLE001
            logger.exception("fetch %s", p["src"])
            results.append({"label": p["label"], "dest": p["dest"], "error": str(e)[:200]})
            continue

        coll = db[p["dest"]]
        created = updated = errors = 0
        for row in rows:
            try:
                doc = p["mapper"](row)
                if not doc.get("id"):
                    errors += 1
                    continue
                kind = await _upsert(coll, doc)
                if kind == "created":
                    created += 1
                else:
                    updated += 1
            except Exception as e:  # noqa: BLE001
                errors += 1
                logger.exception("upsert %s.%s: %s", p["dest"], row.get("id"), e)
        results.append({
            "label": p["label"], "dest": p["dest"],
            "fetched": len(rows), "created": created, "updated": updated, "errors": errors,
        })

    meta = {
        "id": SYNC_META_ID,
        "last_sync_at": _now_iso(),
        "last_results": results,
    }
    await db.sync_metadata.update_one(
        {"id": SYNC_META_ID}, {"$set": meta}, upsert=True,
    )
    return {"results": results, "last_sync_at": meta["last_sync_at"]}


# ---------------- Read-only helpers for the CMS UI ----------------

def _clean(doc: dict) -> dict:
    d = dict(doc)
    d.pop("_id", None)
    return d


@router.get("/customers")
async def list_customers(q: Optional[str] = None, limit: int = 200,
                         _=Depends(require_permission(PERM))):
    filt: dict = {}
    if q:
        filt["$or"] = [
            {"organization": {"$regex": q, "$options": "i"}},
            {"nif": {"$regex": q, "$options": "i"}},
            {"city": {"$regex": q, "$options": "i"}},
        ]
    cur = db.contasimple_customers.find(filt).sort("organization", 1).limit(limit)
    return {"items": [_clean(d) async for d in cur]}


@router.get("/providers")
async def list_providers(_=Depends(require_permission(PERM))):
    cur = db.contasimple_providers.find({}).sort("organization", 1)
    return {"items": [_clean(d) async for d in cur]}


@router.get("/invoices/issued")
async def list_issued(limit: int = 200, _=Depends(require_permission(PERM))):
    cur = db.contasimple_invoices_issued.find({}).sort("invoice_date", -1).limit(limit)
    return {"items": [_clean(d) async for d in cur]}


@router.get("/invoices/received")
async def list_received(limit: int = 200, _=Depends(require_permission(PERM))):
    cur = db.contasimple_invoices_received.find({}).sort("invoice_date", -1).limit(limit)
    return {"items": [_clean(d) async for d in cur]}


@router.get("/treasury/payments")
async def list_treasury_payments(limit: int = 200, _=Depends(require_permission(PERM))):
    cur = db.contasimple_treasury_payments.find({}).sort("date", -1).limit(limit)
    return {"items": [_clean(d) async for d in cur]}


@router.get("/summary")
async def summary(_=Depends(require_permission(PERM))):
    """Consolidated totals to power the ContaSimple dashboard tab."""
    async def _sum(coll: str, field: str) -> float:
        pipe = [{"$group": {"_id": None, "t": {"$sum": f"${field}"}}}]
        agg = await db[coll].aggregate(pipe).to_list(1)
        return round(float(agg[0]["t"]), 2) if agg else 0.0

    issued_total = await _sum("contasimple_invoices_issued", "total_amount")
    received_total = await _sum("contasimple_invoices_received", "total_amount")
    issued_vat = await _sum("contasimple_invoices_issued", "total_vat_amount")
    received_vat = await _sum("contasimple_invoices_received", "total_vat_amount")
    payments_total = await _sum("contasimple_treasury_payments", "amount")

    n_customers = await db.contasimple_customers.count_documents({})
    n_providers = await db.contasimple_providers.count_documents({})
    n_issued = await db.contasimple_invoices_issued.count_documents({})
    n_received = await db.contasimple_invoices_received.count_documents({})
    n_payments = await db.contasimple_treasury_payments.count_documents({})

    # Pending amount
    pending_pipe = [
        {"$project": {"pending": {"$subtract": ["$total_amount", "$total_payed_amount"]}, "status": 1}},
        {"$match": {"status": {"$ne": "Payed"}}},
        {"$group": {"_id": None, "t": {"$sum": "$pending"}}},
    ]
    agg = await db.contasimple_invoices_issued.aggregate(pending_pipe).to_list(1)
    pending_to_collect = round(float(agg[0]["t"]), 2) if agg else 0.0

    return {
        "issued_total": issued_total,
        "received_total": received_total,
        "issued_vat": issued_vat,
        "received_vat": received_vat,
        "vat_balance": round(issued_vat - received_vat, 2),
        "payments_total": payments_total,
        "pending_to_collect": pending_to_collect,
        "counts": {
            "customers": n_customers,
            "providers": n_providers,
            "invoices_issued": n_issued,
            "invoices_received": n_received,
            "treasury_payments": n_payments,
        },
    }


# ---------------- Item detail views (drill-down drawers) ----------------


async def _find_invoice(invoice_id: int) -> Optional[dict]:
    """Search the invoice in every relevant collection."""
    for coll in ("contasimple_invoices_issued",
                 "contasimple_invoices_received",
                 "contasimple_expenses"):
        doc = await db[coll].find_one({"id": invoice_id})
        if doc:
            doc["_collection"] = coll
            return doc
    return None


@router.get("/invoices/{invoice_id}")
async def get_invoice_detail(invoice_id: int, _=Depends(require_permission(PERM))):
    """Full detail of a single invoice + related payments (from local db)."""
    doc = await _find_invoice(invoice_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Factura no encontrada. Ejecuta 'Sincronizar ahora' primero.")
    inv = _clean(doc)
    coll = inv.pop("_collection")

    # Related payments from local treasury collection
    doc_type = "IssuedInvoice" if coll == "contasimple_invoices_issued" else "ReceivedInvoice"
    pays_cur = db.contasimple_treasury_payments.find({
        "related_document_id": invoice_id,
        "related_document_type": doc_type,
    }).sort("date", 1)
    payments = [_clean(p) async for p in pays_cur]

    return {"invoice": inv, "payments": payments, "collection": coll}


@router.get("/invoices/{invoice_id}/pdf")
async def download_invoice_pdf(invoice_id: int, _=Depends(require_permission(PERM))):
    """Proxy the official ContaSimple PDF of an invoice.

    Endpoint used: ``GET /accounting/invoices/{invoiceId}/pdf`` — returns
    ``application/pdf`` bytes exactly as ContaSimple / AEAT format them.
    """
    url, _key = _config()
    token = await _get_token()
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(
            f"{url}/accounting/invoices/{invoice_id}/pdf",
            headers={"Authorization": f"Bearer {token}"},
        )
    if r.status_code == 401:
        token = await _get_token(force=True)
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.get(
                f"{url}/accounting/invoices/{invoice_id}/pdf",
                headers={"Authorization": f"Bearer {token}"},
            )
    if r.status_code != 200:
        raise HTTPException(status_code=502,
            detail=f"ContaSimple no ha devuelto PDF ({r.status_code}): {r.text[:200]}")

    # Try to derive a filename from the invoice number
    inv = await _find_invoice(invoice_id) or {}
    number = (inv.get("number") or f"factura-{invoice_id}").replace("/", "-")
    filename = f"{number}.pdf"

    return Response(
        content=r.content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, max-age=60",
        },
    )


async def _entity_invoice_stats(entity: dict, coll_name: str,
                                party_field: str) -> dict:
    """Aggregate KPIs + top products for an entity across its invoices.

    Invoices store an embedded snapshot of issuer/target (its own snapshot id
    ≠ the CS entity id). We therefore match by **NIF**, which is stable,
    with organization name as a fallback.
    """
    nif = (entity.get("nif") or "").strip()
    org = (entity.get("organization") or "").strip()
    if nif:
        match_expr: dict = {f"{party_field}.nif": nif}
    elif org:
        match_expr = {f"{party_field}.organization": org}
    else:
        match_expr = {"_never_matches_": True}
    match_stage = {"$match": match_expr}

    totals = await db[coll_name].aggregate([
        match_stage,
        {"$group": {
            "_id": None,
            "n_invoices": {"$sum": 1},
            "total_amount": {"$sum": "$total_amount"},
            "total_taxable_amount": {"$sum": "$total_taxable_amount"},
            "total_vat_amount": {"$sum": "$total_vat_amount"},
            "total_payed_amount": {"$sum": "$total_payed_amount"},
            "min_date": {"$min": "$invoice_date"},
            "max_date": {"$max": "$invoice_date"},
        }},
    ]).to_list(1)
    kpis = totals[0] if totals else None

    invoices_cur = db[coll_name].find(match_expr).sort("invoice_date", -1).limit(500)
    invoices = [_clean(d) async for d in invoices_cur]

    # Top products (concept aggregation over lines)
    top_products = await db[coll_name].aggregate([
        match_stage,
        {"$unwind": "$lines"},
        {"$group": {
            "_id": "$lines.concept",
            "quantity": {"$sum": "$lines.quantity"},
            "amount": {"$sum": "$lines.total_taxable_amount"},
            "occurrences": {"$sum": 1},
        }},
        {"$sort": {"amount": -1}},
        {"$limit": 10},
    ]).to_list(10)

    # Monthly evolution
    monthly = await db[coll_name].aggregate([
        match_stage,
        {"$group": {
            "_id": {"$substr": ["$invoice_date", 0, 7]},  # YYYY-MM
            "amount": {"$sum": "$total_amount"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]).to_list(120)

    result = {
        "kpis": {
            "n_invoices": int(kpis["n_invoices"]) if kpis else 0,
            "total_amount": round(float(kpis["total_amount"]), 2) if kpis else 0.0,
            "total_taxable_amount": round(float(kpis["total_taxable_amount"]), 2) if kpis else 0.0,
            "total_vat_amount": round(float(kpis["total_vat_amount"]), 2) if kpis else 0.0,
            "total_payed_amount": round(float(kpis["total_payed_amount"]), 2) if kpis else 0.0,
            "pending_amount": round(float(kpis["total_amount"] - kpis["total_payed_amount"]), 2) if kpis else 0.0,
            "average_ticket": round(float(kpis["total_amount"] / kpis["n_invoices"]), 2) if kpis and kpis["n_invoices"] else 0.0,
            "first_invoice_date": kpis["min_date"] if kpis else None,
            "last_invoice_date": kpis["max_date"] if kpis else None,
        },
        "invoices": invoices,
        "top_products": [
            {"concept": r["_id"] or "(sin concepto)", "quantity": round(float(r["quantity"]), 2),
             "amount": round(float(r["amount"]), 2), "occurrences": int(r["occurrences"])}
            for r in top_products
        ],
        "monthly": [
            {"month": r["_id"], "amount": round(float(r["amount"]), 2), "count": int(r["count"])}
            for r in monthly if r["_id"]
        ],
    }
    return result


@router.get("/customers/{customer_id}/detail")
async def get_customer_detail(customer_id: int, _=Depends(require_permission(PERM))):
    """Customer 360º view: profile + KPIs + invoices + top products + monthly."""
    doc = await db.contasimple_customers.find_one({"id": customer_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    stats = await _entity_invoice_stats(doc, "contasimple_invoices_issued", "target")
    return {"customer": _clean(doc), **stats}


@router.get("/providers/{provider_id}/detail")
async def get_provider_detail(provider_id: int, _=Depends(require_permission(PERM))):
    """Provider 360º view: profile + KPIs + received invoices + top products."""
    doc = await db.contasimple_providers.find_one({"id": provider_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    stats = await _entity_invoice_stats(doc, "contasimple_invoices_received", "issuer")
    return {"provider": _clean(doc), **stats}
