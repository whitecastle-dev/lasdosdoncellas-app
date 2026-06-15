"""Products + categories + image upload with Cloudinary transformation."""
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel, Field
from db import db
from auth import require_permission, get_current_user
from storage import upload_to_cloudinary

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["catalog"])

# ---------- Categories ----------
class CategoryIn(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None

@router.get("/categories")
async def list_categories():
    cats = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return cats

@router.post("/categories")
async def create_category(payload: CategoryIn, _=Depends(require_permission("products.write"))):
    if await db.categories.find_one({"slug": payload.slug}):
        raise HTTPException(status_code=400, detail="Slug ya existe")
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, _=Depends(require_permission("products.delete"))):
    await db.categories.delete_one({"id": cat_id})
    return {"ok": True}

# ---------- Products ----------
class ProductIn(BaseModel):
    name: str
    sku: str
    description: Optional[str] = ""
    long_description: Optional[str] = ""
    price: float
    compare_at_price: Optional[float] = None
    vat_rate: int = 10
    category_id: Optional[str] = None
    provider_id: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    stock: int = 0
    low_stock_threshold: int = 5
    weight_grams: Optional[int] = None
    origin: Optional[str] = None
    curing_months: Optional[int] = None
    breed: Optional[str] = None
    feed: Optional[str] = None
    images: List[str] = Field(default_factory=list)
    is_featured: bool = False
    is_active: bool = True

def _product_with_image_urls(prod: dict) -> dict:
    prod.pop("_id", None)
    prod["image_urls"] = prod.get("images", [])
    return prod

@router.get("/products")
async def list_products(
    q: Optional[str] = None,
    category_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    featured: Optional[bool] = None,
    sort: str = "created_desc",
    limit: int = Query(200, le=500),
):
    query = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"sku": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]
    if category_id:
        query["category_id"] = category_id
    if is_active is not None:
        query["is_active"] = is_active
    if featured is not None:
        query["is_featured"] = featured

    sort_map = {
        "created_desc": ("created_at", -1),
        "created_asc": ("created_at", 1),
        "price_asc": ("price", 1),
        "price_desc": ("price", -1),
        "name_asc": ("name", 1),
    }
    field, direction = sort_map.get(sort, ("created_at", -1))
    cursor = db.products.find(query).sort(field, direction).limit(limit)
    products = [_product_with_image_urls(p) async for p in cursor]
    return products

@router.get("/products/{product_id}")
async def get_product(product_id: str):
    prod = await db.products.find_one({"id": product_id})
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return _product_with_image_urls(prod)

@router.post("/products")
async def create_product(payload: ProductIn, _=Depends(require_permission("products.write"))):
    if await db.products.find_one({"sku": payload.sku}):
        raise HTTPException(status_code=400, detail="SKU ya existe")
    now = datetime.now(timezone.utc).isoformat()
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now
    doc["updated_at"] = now
    await db.products.insert_one(doc)
    return _product_with_image_urls(doc)

@router.patch("/products/{product_id}")
async def update_product(product_id: str, payload: ProductIn, _=Depends(require_permission("products.write"))):
    existing = await db.products.find_one({"id": product_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if payload.sku != existing.get("sku"):
        other = await db.products.find_one({"sku": payload.sku})
        if other:
            raise HTTPException(status_code=400, detail="SKU ya existe")
    updates = payload.model_dump()
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.products.update_one({"id": product_id}, {"$set": updates})
    updated = await db.products.find_one({"id": product_id})
    return _product_with_image_urls(updated)

@router.delete("/products/{product_id}")
async def delete_product(product_id: str, _=Depends(require_permission("products.delete"))):
    res = await db.products.delete_one({"id": product_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {"ok": True}

# ---------- Product image upload (Cloudinary Direct Transformation) ----------

@router.post("/products/{product_id}/images")
async def upload_product_image(
    product_id: str,
    file: UploadFile = File(...),
    user=Depends(require_permission("products.write")),
):
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    original_bytes = await file.read()
    if not original_bytes:
        raise HTTPException(status_code=400, detail="Archivo vacío")

    # Subimos a Cloudinary. Gracias a la configuración en storage.py, 
    # la imagen se transforma automáticamente al subirla.
    result = await asyncio.to_thread(upload_to_cloudinary, original_bytes, product_id)

    # Registrar en DB
    await db.product_images.insert_one({
        "id": str(uuid.uuid4()),
        "product_id": product_id,
        "storage_path": result["path"],
        "url": result["url"],
        "ai_enhanced": True, 
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    await db.products.update_one(
        {"id": product_id},
        {
            "$push": {"images": result["url"]}, 
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        },
    )

    return {
        "url": result["url"],
        "ai_enhanced": True,
        "message": "Imagen subida y procesada profesionalmente por Cloudinary."
    }

@router.delete("/products/{product_id}/images")
async def delete_product_image(
    product_id: str,
    storage_path: str = Query(...),
    _=Depends(require_permission("products.write")),
):
    await db.products.update_one({"id": product_id}, {"$pull": {"images": storage_path}})
    await db.product_images.delete_many({"url": storage_path})
    return {"ok": True}