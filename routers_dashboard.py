"""Dashboard metrics."""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from db import db
from auth import require_permission

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
async def dashboard(_=Depends(require_permission("dashboard.read"))):
    now = datetime.now(timezone.utc)
    last_30 = (now - timedelta(days=30)).isoformat()

    # Totals
    total_orders = await db.orders.count_documents({})
    paid_orders = await db.orders.count_documents({"payment_status": "paid"})
    pending_orders = await db.orders.count_documents({"status": "pending_payment"})
    total_products = await db.products.count_documents({})
    active_products = await db.products.count_documents({"is_active": True})
    total_users = await db.users.count_documents({})

    # Revenue
    revenue_cursor = db.orders.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ])
    revenue_total = 0.0
    async for doc in revenue_cursor:
        revenue_total = float(doc.get("total", 0))

    rev_30_cursor = db.orders.aggregate([
        {"$match": {"payment_status": "paid", "created_at": {"$gte": last_30}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
    ])
    revenue_30 = 0.0
    orders_30 = 0
    async for doc in rev_30_cursor:
        revenue_30 = float(doc.get("total", 0))
        orders_30 = int(doc.get("count", 0))

    # Daily revenue series (last 14d)
    series_cursor = db.orders.aggregate([
        {"$match": {"payment_status": "paid", "created_at": {"$gte": (now - timedelta(days=14)).isoformat()}}},
        {"$project": {
            "day": {"$substr": ["$created_at", 0, 10]},
            "total": 1,
        }},
        {"$group": {"_id": "$day", "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ])
    daily = [{"day": d["_id"], "total": float(d["total"]), "count": int(d["count"])} async for d in series_cursor]

    # Top products
    top_cursor = db.orders.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.product_id",
            "name": {"$first": "$items.name"},
            "units": {"$sum": "$items.qty"},
            "revenue": {"$sum": "$items.line_total"},
        }},
        {"$sort": {"units": -1}},
        {"$limit": 5},
    ])
    top_products = [
        {"product_id": d["_id"], "name": d.get("name"), "units": int(d["units"]), "revenue": float(d["revenue"])}
        async for d in top_cursor
    ]

    # Recent orders
    recent_cursor = db.orders.find({}, {"_id": 0}).sort("created_at", -1).limit(8)
    recent = [r async for r in recent_cursor]

    # Low stock
    low_stock_cursor = db.products.find(
        {"$expr": {"$lte": ["$stock", "$low_stock_threshold"]}, "is_active": True},
        {"_id": 0, "id": 1, "name": 1, "stock": 1, "sku": 1, "low_stock_threshold": 1},
    ).limit(20)
    low_stock = [p async for p in low_stock_cursor]

    return {
        "totals": {
            "orders": total_orders,
            "paid_orders": paid_orders,
            "pending_orders": pending_orders,
            "products": total_products,
            "active_products": active_products,
            "users": total_users,
            "revenue_total": round(revenue_total, 2),
            "revenue_30d": round(revenue_30, 2),
            "orders_30d": orders_30,
        },
        "daily_revenue": daily,
        "top_products": top_products,
        "recent_orders": recent,
        "low_stock": low_stock,
    }
