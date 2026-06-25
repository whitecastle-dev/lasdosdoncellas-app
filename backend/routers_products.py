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
from image_ai import enhance_product_image

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["catalog"])

# ---------- Categories ----------
class CategoryIn(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    position: Optional[int] = None
    is_active: bool = True


class CategoryPatch(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    position: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("/categories")
async def list_categories():
    cats = await db.categories.find({}, {"_id": 0}).to_list(1000)
    # Orden por position si está definido, luego por nombre
    cats.sort(key=lambda c: (c.get("position") if c.get("position") is not None else 999, c.get("name", "")))
    return cats


@router.get("/categories/{cat_id}")
async def get_category(cat_id: str):
    cat = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    if not cat:
        # también buscar por slug (DX)
        cat = await db.categories.find_one({"slug": cat_id}, {"_id": 0})
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return cat


@router.post("/categories")
async def create_category(payload: CategoryIn, _=Depends(require_permission("products.write"))):
    if await db.categories.find_one({"slug": payload.slug}):
        raise HTTPException(status_code=400, detail="Slug ya existe")
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    # Asigna position al final si no se especifica
    if doc.get("position") is None:
        total = await db.categories.count_documents({})
        doc["position"] = total + 1
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/categories/{cat_id}")
async def update_category(cat_id: str, payload: CategoryPatch, _=Depends(require_permission("products.write"))):
    existing = await db.categories.find_one({"id": cat_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None or k == "image_url" or k == "description"}
    # Si cambia el slug, verifica unicidad
    if "slug" in update and update["slug"] != existing.get("slug"):
        if await db.categories.find_one({"slug": update["slug"], "id": {"$ne": cat_id}}):
            raise HTTPException(status_code=400, detail="El slug ya existe en otra categoría")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.categories.update_one({"id": cat_id}, {"$set": update})
    updated = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    return updated


@router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, _=Depends(require_permission("products.delete"))):
    # Desvincula los productos para no dejarlos con un category_id colgante.
    await db.products.update_many({"category_id": cat_id}, {"$set": {"category_id": None}})
    await db.categories.delete_one({"id": cat_id})
    return {"ok": True}


@router.post("/categories/{cat_id}/image")
async def upload_category_image(
    cat_id: str,
    file: UploadFile = File(...),
    _=Depends(require_permission("products.write")),
):
    cat = await db.categories.find_one({"id": cat_id})
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Archivo vacío")
    result = await asyncio.to_thread(upload_to_cloudinary, raw, f"category-{cat_id}")
    await db.categories.update_one(
        {"id": cat_id},
        {"$set": {"image_url": result["url"], "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"url": result["url"]}


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
    # Asegura campos de reseñas siempre presentes para que el front no rompa
    prod.setdefault("avg_rating", 0.0)
    prod.setdefault("review_count", 0)
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


@router.post("/products/admin/seed-demo")
async def force_seed_demo(_=Depends(require_permission("products.write"))):
    """Endpoint admin para forzar la inyección de los 15 productos demo cuando
    la BD está vacía. Idempotente: salta los SKUs que ya existen."""
    try:
        try:
            from scripts.seed_products import seed as seed_products
        except ImportError:
            import importlib.util as _u
            import pathlib
            _here = pathlib.Path(__file__).parent
            _spec = _u.spec_from_file_location("seed_products", _here / "scripts" / "seed_products.py")
            _mod = _u.module_from_spec(_spec)
            _spec.loader.exec_module(_mod)
            seed_products = _mod.seed
        before = await db.products.count_documents({})
        await seed_products()
        after = await db.products.count_documents({})
        return {"inserted": after - before, "total": after}
    except Exception as e:
        logger.exception("Seed demo failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Seed falló: {e}")

# ---------- Product image upload (Cloudinary Direct Transformation) ----------

@router.post("/products/{product_id}/images")
async def upload_product_image(
    product_id: str,
    file: UploadFile = File(...),
    enhance: bool = Query(True, description="Aplicar mejora IA antes de subir"),
    user=Depends(require_permission("products.write")),
):
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    original_bytes = await file.read()
    if not original_bytes:
        raise HTTPException(status_code=400, detail="Archivo vacío")

    # 1) Pasamos la imagen por Gemini Nano Banana — fondo de madera + nitidez.
    #    Si la IA falla o no hay GOOGLE_API_KEY, devuelve los bytes originales.
    final_bytes = original_bytes
    ai_applied = False
    if enhance:
        try:
            enhanced = await enhance_product_image(original_bytes)
            if enhanced and enhanced != original_bytes:
                final_bytes = enhanced
                ai_applied = True
                logger.info("Imagen mejorada por IA (%d → %d bytes)", len(original_bytes), len(final_bytes))
        except Exception as e:
            logger.exception("Fallo en mejora IA, usando original: %s", e)

    # 2) Subimos a Cloudinary (ya sea la mejorada o la original).
    result = await asyncio.to_thread(upload_to_cloudinary, final_bytes, product_id)

    # Registrar en DB
    await db.product_images.insert_one({
        "id": str(uuid.uuid4()),
        "product_id": product_id,
        "storage_path": result["path"],
        "url": result["url"],
        "ai_enhanced": ai_applied,
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


# ---------- BULK image import by SKU ----------
import re as _re


def _parse_sku_from_filename(filename: str):
    """Extrae (sku, order) del nombre de archivo.

    - "JAM-BEL-50-5J.jpg"      -> ("JAM-BEL-50-5J", 1)
    - "JAM-BEL-50-5J-2.png"    -> ("JAM-BEL-50-5J", 2)
    - "EMB-CHO-PIC-200-3.webp" -> ("EMB-CHO-PIC-200", 3)
    - "lote_corp_empresa.jpg"  -> ("lote_corp_empresa", 1)  (sin sufijo)
    Acepta extensiones .jpg/.jpeg/.png/.webp y separador final guion (-N).
    """
    base = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    name, _, _ext = base.rpartition(".")
    if not name:
        name = base
    m = _re.match(r"^(.+?)-(\d+)$", name)
    if m:
        return m.group(1), int(m.group(2))
    return name, 1


@router.post("/products/images/bulk-import")
async def bulk_import_images(
    files: List[UploadFile] = File(...),
    enhance: bool = Query(True, description="Aplicar IA antes de subir"),
    _=Depends(require_permission("products.write")),
):
    """Importa múltiples imágenes a la vez, asociándolas por SKU.

    Convención de nombrado:
      - `<SKU>.jpg`        → imagen principal del producto con ese SKU
      - `<SKU>-2.jpg`      → segunda imagen
      - `<SKU>-3.png`      → tercera (etc.)

    Cada archivo pasa por la IA (vignette dorado, marco barrica, realce) si
    `enhance=true` (por defecto). Se devuelven estadísticas y errores.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No se han enviado archivos")

    # Pre-carga todos los SKU activos para mapear sin hacer N queries
    skus_map = {}
    async for p in db.products.find({}, {"_id": 0, "id": 1, "sku": 1}):
        if p.get("sku"):
            skus_map[p["sku"].upper()] = p["id"]

    results = {"imported": 0, "skipped_no_sku_match": [], "errors": [], "by_sku": {}}

    # Ordena los archivos por (sku, order) para garantizar el orden de inserción
    parsed = []
    for f in files:
        sku, order = _parse_sku_from_filename(f.filename or "")
        parsed.append((sku.upper(), order, f))
    parsed.sort(key=lambda x: (x[0], x[1]))

    for sku, order, file in parsed:
        product_id = skus_map.get(sku)
        if not product_id:
            results["skipped_no_sku_match"].append({"filename": file.filename, "sku": sku})
            continue

        try:
            raw = await file.read()
            if not raw:
                results["errors"].append({"filename": file.filename, "error": "vacío"})
                continue

            final_bytes = raw
            ai_applied = False
            if enhance:
                try:
                    enhanced = await enhance_product_image(raw)
                    if enhanced and enhanced != raw:
                        final_bytes = enhanced
                        ai_applied = True
                except Exception as e:
                    logger.warning("IA falló en %s: %s — uso original", file.filename, e)

            result = await asyncio.to_thread(upload_to_cloudinary, final_bytes, product_id)

            await db.product_images.insert_one({
                "id": str(uuid.uuid4()),
                "product_id": product_id,
                "storage_path": result["path"],
                "url": result["url"],
                "ai_enhanced": ai_applied,
                "source_filename": file.filename,
                "order": order,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            await db.products.update_one(
                {"id": product_id},
                {"$push": {"images": result["url"]},
                 "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
            )

            results["imported"] += 1
            results["by_sku"].setdefault(sku, []).append(result["url"])
        except Exception as e:
            logger.exception("Error procesando %s: %s", file.filename, e)
            results["errors"].append({"filename": file.filename, "error": str(e)[:200]})

    return results


# ---------- Force seed (admin) ----------
@router.post("/seed/demo")
async def force_seed_demo(_=Depends(require_permission("products.write"))):
    """Re-inyecta el seed de demo. Idempotente: los productos con SKU ya
    existente se saltan; las categorías ya existentes se mantienen. Útil
    cuando un nuevo deploy de Render trae categorías/productos nuevos pero
    la BD de producción todavía no los tiene."""
    try:
        from scripts.seed_products import seed as seed_products
    except ImportError:
        from pathlib import Path as _P
        import importlib.util as _u
        _spec = _u.spec_from_file_location(
            "seed_products",
            _P(__file__).resolve().parent / "scripts" / "seed_products.py",
        )
        _mod = _u.module_from_spec(_spec)
        _spec.loader.exec_module(_mod)
        seed_products = _mod.seed

    before_prod = await db.products.count_documents({})
    before_cat = await db.categories.count_documents({})
    await seed_products()
    after_prod = await db.products.count_documents({})
    after_cat = await db.categories.count_documents({})
    return {
        "ok": True,
        "products_added": after_prod - before_prod,
        "categories_added": after_cat - before_cat,
        "total_products": after_prod,
        "total_categories": after_cat,
    }
