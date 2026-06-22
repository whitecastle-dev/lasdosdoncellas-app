"""Reviews 5 estrellas para productos.

Modelo:
- id (uuid)
- product_id
- customer_id  (referencia al cliente autenticado)
- customer_name
- rating (1..5)
- comment (string, opcional)
- approved (bool, default True — moderación opcional)
- created_at
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, conint
from db import db
from auth import require_permission
from routers_customers import get_current_customer

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reviews", tags=["reviews"])


# ---------- helpers ----------
def _clean(r: dict) -> dict:
    r.pop("_id", None)
    return r


async def recompute_product_rating(product_id: str) -> None:
    """Recalcula avg_rating y review_count del producto en la colección products."""
    cursor = db.reviews.aggregate([
        {"$match": {"product_id": product_id, "approved": True}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "n": {"$sum": 1}}},
    ])
    avg = 0.0
    n = 0
    async for doc in cursor:
        avg = round(float(doc.get("avg", 0)), 2)
        n = int(doc.get("n", 0))
    await db.products.update_one(
        {"id": product_id},
        {"$set": {"avg_rating": avg, "review_count": n}},
    )


# ---------- models ----------
class ReviewIn(BaseModel):
    product_id: str
    rating: conint(ge=1, le=5)
    comment: Optional[str] = Field(default="", max_length=1500)


# ---------- endpoints ----------
@router.get("/product/{product_id}")
async def list_reviews_for_product(product_id: str, limit: int = Query(50, le=200)):
    cursor = db.reviews.find({"product_id": product_id, "approved": True}).sort("created_at", -1).limit(limit)
    items = [_clean(r) async for r in cursor]
    # Aggregate stats
    agg = db.reviews.aggregate([
        {"$match": {"product_id": product_id, "approved": True}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "n": {"$sum": 1}}},
    ])
    avg = 0.0
    n = 0
    async for d in agg:
        avg = round(float(d.get("avg", 0)), 2)
        n = int(d.get("n", 0))
    # Distribution 1..5
    dist_cur = db.reviews.aggregate([
        {"$match": {"product_id": product_id, "approved": True}},
        {"$group": {"_id": "$rating", "count": {"$sum": 1}}},
    ])
    dist = {str(i): 0 for i in range(1, 6)}
    async for d in dist_cur:
        dist[str(int(d["_id"]))] = int(d["count"])
    return {"items": items, "avg_rating": avg, "review_count": n, "distribution": dist}


@router.post("")
async def create_review(payload: ReviewIn, customer: dict = Depends(get_current_customer)):
    prod = await db.products.find_one({"id": payload.product_id})
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    # Una reseña por cliente y producto: si ya existe, la actualizamos
    existing = await db.reviews.find_one({
        "product_id": payload.product_id,
        "customer_id": customer["id"],
    })
    now = datetime.now(timezone.utc).isoformat()
    name = f"{customer.get('first_name','')} {customer.get('last_name','')}".strip() \
        or customer.get("name") or customer.get("email", "Cliente")

    if existing:
        await db.reviews.update_one(
            {"id": existing["id"]},
            {"$set": {"rating": int(payload.rating), "comment": (payload.comment or "").strip(),
                      "updated_at": now, "customer_name": name}}
        )
        doc = await db.reviews.find_one({"id": existing["id"]})
    else:
        doc = {
            "id": str(uuid.uuid4()),
            "product_id": payload.product_id,
            "customer_id": customer["id"],
            "customer_name": name,
            "rating": int(payload.rating),
            "comment": (payload.comment or "").strip(),
            "approved": True,
            "created_at": now,
        }
        await db.reviews.insert_one(doc)

    await recompute_product_rating(payload.product_id)
    return _clean(doc)


@router.delete("/{review_id}")
async def delete_review(review_id: str, _=Depends(require_permission("products.write"))):
    r = await db.reviews.find_one({"id": review_id})
    if not r:
        raise HTTPException(status_code=404, detail="Reseña no encontrada")
    await db.reviews.delete_one({"id": review_id})
    await recompute_product_rating(r["product_id"])
    return {"ok": True}


@router.get("")
async def list_all_reviews(limit: int = Query(50, le=200), _=Depends(require_permission("products.read"))):
    cursor = db.reviews.find({}).sort("created_at", -1).limit(limit)
    items = [_clean(r) async for r in cursor]
    return items
