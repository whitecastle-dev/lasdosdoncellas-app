"""Executive Dashboard — Phase 10.

Consolidated KPIs from all ERP modules:
  · Revenue streams: online orders + POS tickets + B2B issued invoices
  · Treasury: cash balances + 30d cashflow projection
  · Inventory: stock valuation + low-stock + expiring lots (30d)
  · Accounting: PnL (this month), VAT liquidation
  · Production: slicings this month
  · Alerts: stock alerts pending, invoices overdue
  · Top: best selling products + top B2B customers
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query

from db import db
from auth import require_permission

router = APIRouter(prefix="/api/executive", tags=["executive-dashboard"])
PERM = "products.read"


def _iso(d): return d.isoformat()
def _today(): return datetime.now(timezone.utc).date().isoformat()


@router.get("/kpis")
async def kpis(days: int = Query(30, ge=1, le=365), _=Depends(require_permission(PERM))):
    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=days))
    since_iso = _iso(since)
    since_date = since.date().isoformat()
    today = now.date().isoformat()
    month_start = f"{today[:7]}-01"

    # -------- REVENUE STREAMS (last `days`) --------
    # 1) Online orders (paid)
    online_agg = db.orders.aggregate([
        {"$match": {"payment_status": "paid", "created_at": {"$gte": since_iso}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
    ])
    online = {"total": 0.0, "count": 0}
    async for d in online_agg:
        online = {"total": round(float(d["total"]), 2), "count": int(d["count"])}

    # 2) POS tickets
    tpv_agg = db.pos_tickets.aggregate([
        {"$match": {"created_at": {"$gte": since_iso}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
    ])
    tpv = {"total": 0.0, "count": 0}
    async for d in tpv_agg:
        tpv = {"total": round(float(d["total"]), 2), "count": int(d["count"])}

    # 3) B2B issued invoices (facturated)
    b2b_agg = db.issued_invoices.aggregate([
        {"$match": {"issue_date": {"$gte": since_date}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1},
                    "paid": {"$sum": {"$cond": [{"$eq": ["$status", "paid"]}, "$total", 0]}}}},
    ])
    b2b = {"total": 0.0, "count": 0, "paid": 0.0}
    async for d in b2b_agg:
        b2b = {"total": round(float(d["total"]), 2), "count": int(d["count"]),
               "paid": round(float(d.get("paid", 0)), 2)}

    revenue_total = round(online["total"] + tpv["total"] + b2b["total"], 2)

    # -------- DAILY SERIES (last 30d, all 3 streams stacked) --------
    days_map = {}
    for i in range(days):
        d = (now - timedelta(days=days - 1 - i)).date().isoformat()
        days_map[d] = {"day": d, "online": 0.0, "tpv": 0.0, "b2b": 0.0}

    async for o in db.orders.find(
        {"payment_status": "paid", "created_at": {"$gte": since_iso}},
        {"_id": 0, "created_at": 1, "total": 1},
    ):
        d = o["created_at"][:10]
        if d in days_map:
            days_map[d]["online"] = round(days_map[d]["online"] + float(o["total"]), 2)

    async for t in db.pos_tickets.find(
        {"created_at": {"$gte": since_iso}},
        {"_id": 0, "created_at": 1, "total": 1},
    ):
        d = t["created_at"][:10]
        if d in days_map:
            days_map[d]["tpv"] = round(days_map[d]["tpv"] + float(t["total"]), 2)

    async for inv in db.issued_invoices.find(
        {"issue_date": {"$gte": since_date}},
        {"_id": 0, "issue_date": 1, "total": 1},
    ):
        d = inv["issue_date"]
        if d in days_map:
            days_map[d]["b2b"] = round(days_map[d]["b2b"] + float(inv["total"]), 2)

    daily = list(days_map.values())

    # -------- TREASURY --------
    # Balances por cuenta
    accounts = [a async for a in db.bank_accounts.find({"activo": True}, {"_id": 0}).sort("nombre", 1)]
    # calcular saldo actual sumando movimientos
    for a in accounts:
        pipe = [
            {"$match": {"account_id": a["id"]}},
            {"$group": {"_id": "$tipo", "sum": {"$sum": "$importe"}}},
        ]
        income = expense = 0.0
        async for d in db.treasury_movements.aggregate(pipe):
            if d["_id"] == "income": income = float(d["sum"])
            elif d["_id"] == "expense": expense = float(d["sum"])
        a["saldo"] = round((a.get("saldo_inicial", 0) or 0) + income - expense, 2)
    saldo_total = round(sum(a["saldo"] for a in accounts), 2)

    # Cobros pendientes (issued_invoices status != paid)
    pending_income_agg = db.issued_invoices.aggregate([
        {"$match": {"status": {"$in": ["issued", "sent", "overdue"]}}},
        {"$group": {"_id": None, "sum": {"$sum": "$total"}, "count": {"$sum": 1}}},
    ])
    pending_income = {"sum": 0.0, "count": 0}
    async for d in pending_income_agg:
        pending_income = {"sum": round(float(d["sum"]), 2), "count": int(d["count"])}

    # Pagos pendientes (supplier_invoices pending)
    pending_expense_agg = db.supplier_invoices.aggregate([
        {"$match": {"status": {"$in": ["pending_payment", "overdue"]}}},
        {"$group": {"_id": None, "sum": {"$sum": "$total"}, "count": {"$sum": 1}}},
    ])
    pending_expense = {"sum": 0.0, "count": 0}
    async for d in pending_expense_agg:
        pending_expense = {"sum": round(float(d["sum"]), 2), "count": int(d["count"])}

    # -------- INVENTORY --------
    stock_valuation_agg = db.products.aggregate([
        {"$match": {"is_active": True}},
        {"$project": {"value": {"$multiply": [
            {"$ifNull": ["$stock", 0]}, {"$ifNull": ["$average_cost", "$price"]}
        ]}}},
        {"$group": {"_id": None, "total": {"$sum": "$value"}}},
    ])
    stock_value = 0.0
    async for d in stock_valuation_agg:
        stock_value = round(float(d.get("total", 0)), 2)

    low_stock_count = await db.products.count_documents({
        "$expr": {"$lte": ["$stock", "$low_stock_threshold"]}, "is_active": True
    })
    stock_alerts_pending = await db.stock_alerts.count_documents({
        "status": {"$in": ["pending_approval", "approved", "sent"]}
    })

    # Lotes que caducan en 30 días
    limit_date = (now + timedelta(days=30)).date().isoformat()
    expiring_lots = await db.stock_lots.count_documents({
        "expires_at": {"$lte": limit_date, "$gte": today}, "qty_remaining": {"$gt": 0}
    })

    # -------- ACCOUNTING --------
    # PnL this month
    pnl_ingresos = pnl_gastos = 0.0
    async for e in db.journal_entries.find({"fecha": {"$gte": month_start}}):
        for l in e["lines"]:
            code = l["account_code"]
            if code.startswith("7"):
                pnl_ingresos += l.get("credit", 0) - l.get("debit", 0)
            elif code.startswith("6"):
                pnl_gastos += l.get("debit", 0) - l.get("credit", 0)
    resultado_mes = round(pnl_ingresos - pnl_gastos, 2)

    # VAT liquidation this quarter
    q_start_month = ((now.month - 1) // 3) * 3 + 1
    q_start = f"{now.year}-{q_start_month:02d}-01"
    rep = sop = 0.0
    async for e in db.journal_entries.find({"fecha": {"$gte": q_start}}):
        for l in e["lines"]:
            if l["account_code"] == "477":
                rep += l.get("credit", 0) - l.get("debit", 0)
            elif l["account_code"] == "472":
                sop += l.get("debit", 0) - l.get("credit", 0)
    vat_liq = round(rep - sop, 2)

    # -------- PRODUCTION --------
    slicings_mes_agg = db.production_slicings.aggregate([
        {"$match": {"fecha": {"$gte": month_start}}},
        {"$group": {"_id": None, "kilos": {"$sum": "$kilos"}, "count": {"$sum": 1}}},
    ])
    slicings = {"kilos": 0.0, "count": 0}
    async for d in slicings_mes_agg:
        slicings = {"kilos": round(float(d.get("kilos", 0)), 2), "count": int(d["count"])}

    # -------- TOP PRODUCTS (last `days`, combined online + TPV + B2B) --------
    top: dict = {}
    async for o in db.orders.find(
        {"payment_status": "paid", "created_at": {"$gte": since_iso}},
        {"_id": 0, "items": 1},
    ):
        for it in (o.get("items") or []):
            pid = it.get("product_id")
            if not pid: continue
            r = top.setdefault(pid, {"name": it.get("name"), "units": 0, "revenue": 0.0})
            r["units"] += it.get("qty", 0)
            r["revenue"] += it.get("line_total", 0)

    async for t in db.pos_tickets.find(
        {"created_at": {"$gte": since_iso}},
        {"_id": 0, "items": 1},
    ):
        for it in (t.get("items") or []):
            pid = it.get("product_id")
            if not pid: continue
            r = top.setdefault(pid, {"name": it.get("name"), "units": 0, "revenue": 0.0})
            r["units"] += it.get("qty", 0)
            r["revenue"] += it.get("line_total", 0)

    async for inv in db.issued_invoices.find(
        {"issue_date": {"$gte": since_date}},
        {"_id": 0, "lines": 1},
    ):
        for it in (inv.get("lines") or []):
            pid = it.get("product_id")
            if not pid: continue
            r = top.setdefault(pid, {"name": it.get("concepto") or it.get("name"), "units": 0, "revenue": 0.0})
            r["units"] += it.get("qty", 0)
            r["revenue"] += it.get("line_total", 0)

    top_products = sorted(
        [{"product_id": k, **v, "revenue": round(v["revenue"], 2), "units": round(v["units"], 2)}
         for k, v in top.items()],
        key=lambda x: -x["revenue"],
    )[:8]

    # -------- TOP B2B CUSTOMERS (last `days`) --------
    b2b_top_agg = db.issued_invoices.aggregate([
        {"$match": {"issue_date": {"$gte": since_date}}},
        {"$group": {"_id": "$client_name", "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
        {"$limit": 5},
    ])
    top_b2b = [{"name": d["_id"], "total": round(float(d["total"]), 2), "count": int(d["count"])}
               async for d in b2b_top_agg]

    # -------- ORDERS PIPELINE --------
    orders_pending = await db.orders.count_documents({"status": "pending_payment"})
    orders_paid = await db.orders.count_documents({"payment_status": "paid",
                                                    "status": {"$in": ["confirmed", "processing"]}})
    orders_shipped = await db.orders.count_documents({"status": "shipped"})

    # Total pedidos hoy (todos los canales)
    orders_today = await db.orders.count_documents({"created_at": {"$gte": today}})
    tickets_today = await db.pos_tickets.count_documents({"created_at": {"$gte": today}})

    return {
        "range_days": days,
        "revenue": {
            "total": revenue_total,
            "online": online,
            "tpv": tpv,
            "b2b": b2b,
        },
        "daily": daily,
        "treasury": {
            "accounts": accounts,
            "saldo_total": saldo_total,
            "pending_income": pending_income,
            "pending_expense": pending_expense,
            "saldo_proyectado": round(saldo_total + pending_income["sum"] - pending_expense["sum"], 2),
        },
        "inventory": {
            "stock_value": stock_value,
            "low_stock_count": low_stock_count,
            "expiring_lots_30d": expiring_lots,
            "stock_alerts_pending": stock_alerts_pending,
        },
        "accounting": {
            "pnl_month": {
                "ingresos": round(pnl_ingresos, 2),
                "gastos": round(pnl_gastos, 2),
                "resultado": resultado_mes,
            },
            "vat_quarter": {
                "repercutido": round(rep, 2),
                "soportado": round(sop, 2),
                "liquidacion": vat_liq,
                "quarter_start": q_start,
            },
        },
        "production": {
            "slicings_month": slicings,
        },
        "orders_pipeline": {
            "pending_payment": orders_pending,
            "paid": orders_paid,
            "shipped": orders_shipped,
            "today": orders_today,
            "tpv_today": tickets_today,
        },
        "top_products": top_products,
        "top_b2b_customers": top_b2b,
    }
