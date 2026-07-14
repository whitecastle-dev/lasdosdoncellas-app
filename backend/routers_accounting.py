"""Contabilidad analítica — Phase 9.

Collections:
  accounts             plan contable (PGC español simplificado)
  journal_entries      asientos: {fecha, concepto, source_ref, lines[{account_code, debit, credit}]}

El módulo genera asientos automáticamente a partir de:
  · pos_tickets                 (venta al contado)
  · issued_invoices status=paid (venta a crédito + cobro)
  · issued_invoices status=issued (venta a crédito, pendiente)
  · supplier_invoices           (compra pendiente + pago)
  · production_salaries status=pagado (nómina)
  · treasury_movements manuales (gastos varios por categoría)

Cada asiento tiene un `source_ref = "<coll>:<id>:<subtype>"` único que permite idempotencia:
al reejecutar el backfill NO duplica.

Plan contable simplificado (grupos 4/5/6/7):
  400  Proveedores
  430  Clientes
  465  Remuneraciones pendientes
  472  IVA soportado (deducible)
  476  Organismos SS acreedores
  477  IVA repercutido
  570  Caja
  572  Bancos
  600  Compras de mercaderías
  621  Alquileres
  628  Suministros
  629  Otros gastos
  640  Sueldos y salarios
  642  Seguridad Social a cargo empresa
  700  Ventas de mercaderías
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db import db
from auth import require_permission

router = APIRouter(prefix="/api/accounting", tags=["accounting"])

PERM_READ = "products.read"
PERM_WRITE = "products.write"


def _now(): return datetime.now(timezone.utc).isoformat()
def _today(): return datetime.now(timezone.utc).date().isoformat()


# ================================================================ Chart of accounts

DEFAULT_ACCOUNTS = [
    ("400", "Proveedores", "acreedor", 4),
    ("430", "Clientes", "deudor", 4),
    ("465", "Remuneraciones pendientes", "acreedor", 4),
    ("472", "IVA soportado (deducible)", "activo", 4),
    ("476", "Organismos SS acreedores", "acreedor", 4),
    ("477", "IVA repercutido", "acreedor", 4),
    ("570", "Caja, efectivo", "activo", 5),
    ("572", "Bancos", "activo", 5),
    ("600", "Compras de mercaderías", "gasto", 6),
    ("621", "Alquileres", "gasto", 6),
    ("628", "Suministros", "gasto", 6),
    ("629", "Otros servicios / gastos", "gasto", 6),
    ("640", "Sueldos y salarios", "gasto", 6),
    ("642", "Seguridad Social a cargo empresa", "gasto", 6),
    ("700", "Ventas de mercaderías", "ingreso", 7),
]


async def _ensure_accounts():
    for code, name, tipo, grupo in DEFAULT_ACCOUNTS:
        await db.accounting_accounts.update_one(
            {"code": code},
            {"$setOnInsert": {
                "id": str(uuid.uuid4()), "code": code, "name": name,
                "tipo": tipo, "grupo": grupo, "created_at": _now(),
            }},
            upsert=True,
        )


@router.get("/accounts")
async def list_accounts(_=Depends(require_permission(PERM_READ))):
    await _ensure_accounts()
    return [a async for a in db.accounting_accounts.find({}, {"_id": 0}).sort("code", 1)]


# ================================================================ Journal helpers

async def _post_entry(fecha: str, concepto: str, source_ref: str, lines: List[Dict[str, Any]],
                      extras: Optional[Dict[str, Any]] = None):
    """Idempotent: upsert by source_ref. Lines: {account_code, debit, credit}."""
    total_d = round(sum(l.get("debit", 0) for l in lines), 2)
    total_h = round(sum(l.get("credit", 0) for l in lines), 2)
    if abs(total_d - total_h) > 0.02:
        raise HTTPException(400, f"Asiento descuadrado: D={total_d} vs H={total_h} ({source_ref})")
    doc = {
        "id": str(uuid.uuid4()),
        "fecha": fecha,
        "concepto": concepto,
        "source_ref": source_ref,
        "lines": [{"account_code": l["account_code"], "debit": round(l.get("debit", 0), 2),
                   "credit": round(l.get("credit", 0), 2)} for l in lines],
        "total": total_d,
        **(extras or {}),
        "created_at": _now(),
    }
    r = await db.journal_entries.update_one(
        {"source_ref": source_ref},
        {"$setOnInsert": doc},
        upsert=True,
    )
    return r.upserted_id is not None


# ================================================================ Backfill from source docs

@router.post("/backfill")
async def backfill(_=Depends(require_permission(PERM_WRITE))):
    """Escanea documentos fuente y genera asientos idempotentes."""
    await _ensure_accounts()
    created = {"tickets": 0, "issued_invoices_issued": 0, "issued_invoices_paid": 0,
               "supplier_invoices_issued": 0, "supplier_invoices_paid": 0,
               "salaries_paid": 0, "manual_movements": 0}

    # ---- POS tickets: (D) 570/572 total / (H) 700 subtotal + 477 IVA
    async for t in db.pos_tickets.find({}):
        fecha = (t.get("created_at") or _today())[:10]
        # 570 (efectivo) o 572 (tarjeta). Si mixto → dividir
        efectivo = float(t.get("efectivo", 0) or 0)
        tarjeta = float(t.get("tarjeta", 0) or 0)
        total = float(t.get("total", 0))
        vat_amount = float(t.get("vat_amount", 0))
        subtotal = float(t.get("subtotal", 0))
        # Como el pago puede exceder el total (cambio), el debe real es total, y
        # el reparto entre 570/572 se hace por el peso de efectivo/tarjeta
        pagado = max(efectivo + tarjeta, 0.01)
        d570 = round(total * (efectivo / pagado), 2) if pagado > 0 else 0
        d572 = round(total - d570, 2)
        lines = []
        if d570 > 0: lines.append({"account_code": "570", "debit": d570, "credit": 0})
        if d572 > 0: lines.append({"account_code": "572", "debit": d572, "credit": 0})
        if subtotal > 0: lines.append({"account_code": "700", "debit": 0, "credit": subtotal})
        if vat_amount > 0: lines.append({"account_code": "477", "debit": 0, "credit": vat_amount})
        if await _post_entry(fecha, f"Venta TPV {t['numero']}", f"pos_ticket:{t['id']}",
                             lines, {"reference_type": "pos_ticket", "reference_id": t["id"]}):
            created["tickets"] += 1

    # ---- Issued invoices — devengo (issue) y cobro (paid)
    async for inv in db.issued_invoices.find({}):
        subtotal = float(inv.get("subtotal", 0))
        vat_amount = float(inv.get("vat_amount", 0))
        total = float(inv.get("total", 0))
        # 1) Devengo (H 700 + H 477 / D 430)
        lines = [
            {"account_code": "430", "debit": total, "credit": 0},
            {"account_code": "700", "debit": 0, "credit": subtotal},
        ]
        if vat_amount > 0:
            lines.append({"account_code": "477", "debit": 0, "credit": vat_amount})
        if await _post_entry(inv["issue_date"], f"Emisión factura {inv['invoice_number']} — {inv['client_name']}",
                             f"issued_invoice_issue:{inv['id']}", lines,
                             {"reference_type": "issued_invoice", "reference_id": inv["id"]}):
            created["issued_invoices_issued"] += 1
        # 2) Cobro (D 572 / H 430) si está pagada
        if inv.get("status") == "paid" and inv.get("paid_at"):
            if await _post_entry(inv["paid_at"], f"Cobro factura {inv['invoice_number']}",
                                 f"issued_invoice_paid:{inv['id']}",
                                 [{"account_code": "572", "debit": total, "credit": 0},
                                  {"account_code": "430", "debit": 0, "credit": total}],
                                 {"reference_type": "issued_invoice", "reference_id": inv["id"]}):
                created["issued_invoices_paid"] += 1

    # ---- Supplier invoices — devengo y pago
    async for inv in db.supplier_invoices.find({}):
        subtotal = float(inv.get("subtotal", 0))
        vat_amount = float(inv.get("vat_amount", 0))
        total = float(inv.get("total", 0))
        # 1) Devengo: (D 600 subtotal + D 472 IVA) / (H 400 total)
        lines = [
            {"account_code": "600", "debit": subtotal, "credit": 0},
        ]
        if vat_amount > 0:
            lines.append({"account_code": "472", "debit": vat_amount, "credit": 0})
        lines.append({"account_code": "400", "debit": 0, "credit": total})
        provider_name = (inv.get("provider") or {}).get("name", "Proveedor")
        if await _post_entry(inv.get("issue_date") or inv.get("created_at", "")[:10] or _today(),
                             f"Factura proveedor {inv['invoice_number']} — {provider_name}",
                             f"supplier_invoice_issue:{inv['id']}", lines,
                             {"reference_type": "supplier_invoice", "reference_id": inv["id"]}):
            created["supplier_invoices_issued"] += 1
        # 2) Pago: (D 400) / (H 572)
        if inv.get("status") == "paid" and inv.get("paid_at"):
            if await _post_entry(inv["paid_at"], f"Pago factura {inv['invoice_number']}",
                                 f"supplier_invoice_paid:{inv['id']}",
                                 [{"account_code": "400", "debit": total, "credit": 0},
                                  {"account_code": "572", "debit": 0, "credit": total}],
                                 {"reference_type": "supplier_invoice", "reference_id": inv["id"]}):
                created["supplier_invoices_paid"] += 1

    # ---- Salaries paid — (D 640 bruto + D 642 SS emp) / (H 465 neto + H 476 SS)
    async for s in db.production_salaries.find({"estado": {"$in": ["pagado", "paid"]}}):
        bruto = float(s.get("bruto", s.get("importe", 0)) or 0)
        neto = float(s.get("neto", bruto * 0.8) or 0)
        ss_emp = float(s.get("ss_empresa", bruto * 0.3) or 0)
        ret = round(bruto - neto, 2)  # retenciones + SS trabajador van a 476
        lines = [
            {"account_code": "640", "debit": bruto, "credit": 0},
        ]
        if ss_emp > 0:
            lines.append({"account_code": "642", "debit": ss_emp, "credit": 0})
        lines.append({"account_code": "465", "debit": 0, "credit": neto})
        if ret + ss_emp > 0:
            lines.append({"account_code": "476", "debit": 0, "credit": round(ret + ss_emp, 2)})
        fecha = s.get("mes") or s.get("fecha") or _today()
        if len(fecha) == 7:
            fecha = fecha + "-01"
        if await _post_entry(fecha, f"Nómina {s.get('empleado_nombre', 'empleado')} {s.get('mes', '')}",
                             f"salary:{s['id']}", lines,
                             {"reference_type": "salary", "reference_id": s["id"]}):
            created["salaries_paid"] += 1

    # ---- Manual treasury movements NOT already covered by another engranaje
    #      (i.e. sin reference_type entre pos_ticket / issued_invoice / supplier_invoice)
    COVERED = {"pos_ticket", "issued_invoice", "supplier_invoice"}
    CATEGORY_MAP = {
        "venta": "700", "compra": "600", "salario": "640",
        "impuestos": "629", "gasto": "629", "otros": "629",
    }
    async for m in db.treasury_movements.find({}):
        ref_type = m.get("reference_type") or "manual"
        if ref_type in COVERED:
            continue
        importe = float(m.get("importe", 0))
        tipo = m.get("tipo", "income")
        acc = await db.bank_accounts.find_one({"id": m.get("account_id")})
        acc_code = "570" if (acc and acc.get("tipo") == "cash") else "572"
        cat_code = CATEGORY_MAP.get(m.get("categoria"), "629" if tipo == "expense" else "700")
        if tipo == "income":
            lines = [{"account_code": acc_code, "debit": importe, "credit": 0},
                     {"account_code": cat_code, "debit": 0, "credit": importe}]
        else:
            lines = [{"account_code": cat_code, "debit": importe, "credit": 0},
                     {"account_code": acc_code, "debit": 0, "credit": importe}]
        if await _post_entry(m.get("fecha", _today()), m.get("concepto", "Movimiento"),
                             f"movement:{m['id']}", lines,
                             {"reference_type": "movement", "reference_id": m["id"]}):
            created["manual_movements"] += 1

    total_new = sum(created.values())
    return {"created": created, "total_new_entries": total_new}


# ================================================================ Journal & ledger

@router.get("/journal")
async def journal(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    account_code: Optional[str] = None,
    limit: int = 500,
    _=Depends(require_permission(PERM_READ)),
):
    q: Dict[str, Any] = {}
    if from_date or to_date:
        q["fecha"] = {}
        if from_date: q["fecha"]["$gte"] = from_date
        if to_date: q["fecha"]["$lte"] = to_date
    if account_code:
        q["lines.account_code"] = account_code
    cursor = db.journal_entries.find(q, {"_id": 0}).sort("fecha", -1).limit(limit)
    return [e async for e in cursor]


@router.get("/ledger/{account_code}")
async def ledger(
    account_code: str,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    _=Depends(require_permission(PERM_READ)),
):
    q: Dict[str, Any] = {"lines.account_code": account_code}
    if from_date or to_date:
        q["fecha"] = {}
        if from_date: q["fecha"]["$gte"] = from_date
        if to_date: q["fecha"]["$lte"] = to_date
    rows = []
    saldo = 0.0
    async for e in db.journal_entries.find(q, {"_id": 0}).sort("fecha", 1):
        for l in e["lines"]:
            if l["account_code"] != account_code:
                continue
            d = l.get("debit", 0)
            c = l.get("credit", 0)
            saldo = round(saldo + d - c, 2)
            rows.append({
                "fecha": e["fecha"], "concepto": e["concepto"], "source_ref": e["source_ref"],
                "debit": d, "credit": c, "saldo": saldo,
            })
    acc = await db.accounting_accounts.find_one({"code": account_code}, {"_id": 0})
    return {"account": acc, "rows": rows, "saldo_final": saldo}


# ================================================================ Reports

@router.get("/vat")
async def vat_report(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    _=Depends(require_permission(PERM_READ)),
):
    """IVA repercutido (477) - IVA soportado (472)."""
    q: Dict[str, Any] = {}
    if from_date or to_date:
        q["fecha"] = {}
        if from_date: q["fecha"]["$gte"] = from_date
        if to_date: q["fecha"]["$lte"] = to_date
    rep = sop = 0.0
    async for e in db.journal_entries.find(q):
        for l in e["lines"]:
            if l["account_code"] == "477":
                rep += l.get("credit", 0) - l.get("debit", 0)
            elif l["account_code"] == "472":
                sop += l.get("debit", 0) - l.get("credit", 0)
    liquidacion = round(rep - sop, 2)
    return {
        "repercutido": round(rep, 2),
        "soportado": round(sop, 2),
        "liquidacion": liquidacion,
        "a_ingresar": max(0, liquidacion),
        "a_compensar": abs(min(0, liquidacion)),
    }


@router.get("/pnl")
async def pnl(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    _=Depends(require_permission(PERM_READ)),
):
    """Cuenta de resultados: grupo 7 (ingresos) - grupo 6 (gastos)."""
    q: Dict[str, Any] = {}
    if from_date or to_date:
        q["fecha"] = {}
        if from_date: q["fecha"]["$gte"] = from_date
        if to_date: q["fecha"]["$lte"] = to_date
    by_code: Dict[str, float] = {}
    async for e in db.journal_entries.find(q):
        for l in e["lines"]:
            code = l["account_code"]
            if code[0] in ("6", "7"):
                # Ingresos (7): saldo = credit - debit
                # Gastos (6):   saldo = debit - credit
                delta = (l.get("credit", 0) - l.get("debit", 0)) if code[0] == "7" \
                    else (l.get("debit", 0) - l.get("credit", 0))
                by_code[code] = round(by_code.get(code, 0) + delta, 2)
    accounts = {a["code"]: a async for a in db.accounting_accounts.find({}, {"_id": 0})}
    ingresos = [{"code": c, "name": accounts.get(c, {}).get("name", c), "amount": v}
                for c, v in by_code.items() if c.startswith("7")]
    gastos = [{"code": c, "name": accounts.get(c, {}).get("name", c), "amount": v}
              for c, v in by_code.items() if c.startswith("6")]
    total_ingresos = round(sum(x["amount"] for x in ingresos), 2)
    total_gastos = round(sum(x["amount"] for x in gastos), 2)
    return {
        "ingresos": sorted(ingresos, key=lambda x: -x["amount"]),
        "gastos": sorted(gastos, key=lambda x: -x["amount"]),
        "total_ingresos": total_ingresos,
        "total_gastos": total_gastos,
        "resultado": round(total_ingresos - total_gastos, 2),
    }


@router.get("/analytical")
async def analytical(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    _=Depends(require_permission(PERM_READ)),
):
    """Margen bruto por producto: ventas (TPV + facturadas) - coste medio × unidades."""
    q: Dict[str, Any] = {}
    if from_date or to_date:
        q["created_at"] = {}
        if from_date: q["created_at"]["$gte"] = from_date
        if to_date: q["created_at"]["$lte"] = to_date + "T23:59:59"

    by_product: Dict[str, Dict[str, float]] = {}
    products = {p["id"]: p async for p in db.products.find({}, {"_id": 0, "id": 1, "name": 1, "average_cost": 1, "price": 1})}

    async for t in db.pos_tickets.find(q, {"_id": 0}):
        for it in t.get("items", []):
            pid = it.get("product_id")
            if not pid: continue
            row = by_product.setdefault(pid, {"name": products.get(pid, {}).get("name", "—"),
                                              "qty": 0, "revenue": 0, "cost": 0})
            row["qty"] += it["qty"]
            row["revenue"] += it["line_total"]
            row["cost"] += it["qty"] * products.get(pid, {}).get("average_cost", 0)

    async for inv in db.issued_invoices.find(q, {"_id": 0}):
        for it in inv.get("lines", []):
            pid = it.get("product_id")
            if not pid: continue
            row = by_product.setdefault(pid, {"name": products.get(pid, {}).get("name", "—"),
                                              "qty": 0, "revenue": 0, "cost": 0})
            row["qty"] += it.get("qty", 0)
            row["revenue"] += it.get("line_total", 0)
            row["cost"] += it.get("qty", 0) * products.get(pid, {}).get("average_cost", 0)

    rows = []
    for pid, r in by_product.items():
        margen = round(r["revenue"] - r["cost"], 2)
        pct = round((margen / r["revenue"] * 100), 1) if r["revenue"] > 0 else 0
        rows.append({
            "product_id": pid, "name": r["name"], "qty": round(r["qty"], 2),
            "revenue": round(r["revenue"], 2), "cost": round(r["cost"], 2),
            "margin": margen, "margin_pct": pct,
        })
    rows.sort(key=lambda x: -x["revenue"])
    return {"rows": rows, "total_revenue": round(sum(r["revenue"] for r in rows), 2),
            "total_cost": round(sum(r["cost"] for r in rows), 2),
            "total_margin": round(sum(r["margin"] for r in rows), 2)}


@router.get("/summary")
async def summary(_=Depends(require_permission(PERM_READ))):
    total = await db.journal_entries.count_documents({})
    first = await db.journal_entries.find_one({}, {"_id": 0, "fecha": 1}, sort=[("fecha", 1)])
    last = await db.journal_entries.find_one({}, {"_id": 0, "fecha": 1}, sort=[("fecha", -1)])
    return {
        "entries": total,
        "first_date": first["fecha"] if first else None,
        "last_date": last["fecha"] if last else None,
    }
