"""Storefront aggregate endpoints — one round-trip for the home page."""
import asyncio
from fastapi import APIRouter, Query
from db import db
from routers_products import _product_with_image_urls

router = APIRouter(prefix="/api/storefront", tags=["storefront"])


async def _categories() -> list:
    cats = await db.categories.find({}, {"_id": 0}).to_list(1000)
    cats = [c for c in cats if c.get("is_active") is not False]
    cats.sort(key=lambda c: (c.get("position") if c.get("position") is not None else 999, c.get("name", "")))
    return cats


async def _by_slug(cats: list, per_category: int) -> dict:
    async def one(c):
        cursor = db.products.find({"category_id": c["id"], "is_active": True}).sort("created_at", -1).limit(per_category)
        return c["slug"], [_product_with_image_urls(p) async for p in cursor]
    pairs = await asyncio.gather(*(one(c) for c in cats))
    return dict(pairs)


async def _featured(limit: int = 6) -> list:
    items = [_product_with_image_urls(p) async for p in
             db.products.find({"is_active": True, "featured": True}).sort("created_at", -1).limit(limit)]
    if len(items) < limit:
        ids = {p["id"] for p in items}
        async for p in db.products.find({"is_active": True}).sort("created_at", -1).limit(limit * 2):
            if len(items) >= limit:
                break
            if p["id"] not in ids:
                items.append(_product_with_image_urls(p))
    return items


async def _reviews(limit: int = 6, min_rating: int = 4) -> list:
    out = []
    async for r in db.reviews.find({"approved": True, "rating": {"$gte": min_rating}}).sort("created_at", -1).limit(limit):
        r.pop("_id", None)
        prod = await db.products.find_one({"id": r.get("product_id")}, {"_id": 0, "name": 1})
        if prod:
            r["product_name"] = prod.get("name")
        out.append(r)
    return out


@router.get("/home")
async def home(per_category: int = Query(6, ge=1, le=24)):
    cats = await _categories()
    by_slug, featured, reviews = await asyncio.gather(_by_slug(cats, per_category), _featured(), _reviews())
    return {"categories": cats, "by_slug": by_slug, "featured": featured, "reviews": reviews}
