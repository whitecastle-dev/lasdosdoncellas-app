"""One-off seed script for demo categories + products.

Run from /app/backend:
  python seed_demo.py
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from db import db


CATEGORIES = [
    {"name": "Jamones", "slug": "jamones", "description": "Piezas enteras y cortadas"},
    {"name": "Embutidos", "slug": "embutidos", "description": "Lomo, chorizo, salchichón y más"},
    {"name": "Lotes Selectos", "slug": "lotes", "description": "Selecciones para regalo"},
]

PRODUCTS = [
    {
        "name": "Jamón Ibérico de Bellota — Pieza Entera",
        "sku": "JIB-BEL-001",
        "description": "Pieza entera de bellota 100% ibérico curada en bodega natural durante 36 meses.",
        "long_description": "Una pieza emblemática de la casa. Cerdos criados en libertad en la Sierra Norte de Sevilla, alimentados con bellotas durante la montanera. Curación lenta, tradicional, en bodega natural. Grasa infiltrada, sabor intenso, aroma a monte.",
        "price": 489.00, "compare_at_price": 549.00, "vat_rate": 10,
        "tags": ["jamones", "bellota", "regalo"], "stock": 15, "low_stock_threshold": 3,
        "weight_grams": 7500, "origin": "Sierra Norte de Sevilla", "curing_months": 36,
        "breed": "100% Ibérico", "feed": "Bellota",
        "images": [], "is_featured": True, "is_active": True,
        "category_slug": "jamones",
        "_seed_img": "https://images.unsplash.com/photo-1656423739016-5de747b2c4fb?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600",
    },
    {
        "name": "Sobre de Jamón Ibérico de Bellota 100g",
        "sku": "JIB-LON-100",
        "description": "Loncheado a cuchillo, envasado al vacío.",
        "long_description": "Loncheado a mano por nuestros maestros cortadores. Ideal para tablas y tapas. 100 g por sobre.",
        "price": 14.90, "vat_rate": 10,
        "tags": ["jamones", "loncheado"], "stock": 120, "low_stock_threshold": 20,
        "weight_grams": 100, "origin": "Sierra Norte de Sevilla", "curing_months": 36,
        "breed": "100% Ibérico", "feed": "Bellota",
        "images": [], "is_featured": True, "is_active": True,
        "category_slug": "jamones",
        "_seed_img": "https://images.unsplash.com/photo-1732565432358-a8c95bc24ea3?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600",
    },
    {
        "name": "Lomo Ibérico de Bellota",
        "sku": "EMB-LOM-001",
        "description": "Lomo curado al pimentón, aroma intenso.",
        "long_description": "Lomo embuchado, curado naturalmente con pimentón. Pieza de 500g aprox.",
        "price": 38.50, "vat_rate": 10,
        "tags": ["embutidos", "lomo", "bellota"], "stock": 45, "low_stock_threshold": 10,
        "weight_grams": 500, "origin": "Sierra Norte de Sevilla", "curing_months": 5,
        "breed": "Ibérico", "feed": "Bellota",
        "images": [], "is_featured": False, "is_active": True,
        "category_slug": "embutidos",
        "_seed_img": "https://images.unsplash.com/photo-1695606392727-d8b959879721?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600",
    },
    {
        "name": "Chorizo Ibérico de Bellota",
        "sku": "EMB-CHO-001",
        "description": "Sabor profundo, ahumado suave.",
        "long_description": "Chorizo ibérico curado con pimentón dulce y picante. Ideal para tablas o cocinado.",
        "price": 18.90, "vat_rate": 10,
        "tags": ["embutidos", "chorizo"], "stock": 80, "low_stock_threshold": 15,
        "weight_grams": 400, "origin": "Sierra Norte de Sevilla", "curing_months": 4,
        "breed": "Ibérico", "feed": "Bellota",
        "images": [], "is_featured": False, "is_active": True,
        "category_slug": "embutidos",
        "_seed_img": "https://images.unsplash.com/photo-1601314167099-fff7c4e4f50f?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600",
    },
    {
        "name": "Salchichón Ibérico",
        "sku": "EMB-SAL-001",
        "description": "Curación natural, especiado.",
        "long_description": "Salchichón ibérico curado lentamente. Sabor refinado y textura jugosa.",
        "price": 16.50, "vat_rate": 10,
        "tags": ["embutidos", "salchichon"], "stock": 60, "low_stock_threshold": 10,
        "weight_grams": 400, "origin": "Sierra Norte de Sevilla", "curing_months": 5,
        "breed": "Ibérico", "feed": "Bellota",
        "images": [], "is_featured": False, "is_active": True,
        "category_slug": "embutidos",
        "_seed_img": "https://images.unsplash.com/photo-1626776876780-92e36ce4c2dc?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600",
    },
    {
        "name": "Lote Reserva — Ibéricos Selectos",
        "sku": "LOT-RES-001",
        "description": "Selección de la casa: jamón, lomo, chorizo y salchichón.",
        "long_description": "Una caja de regalo elegante con una selección representativa de nuestros ibéricos. Acompañada de tarjeta personalizada.",
        "price": 124.00, "compare_at_price": 140.00, "vat_rate": 10,
        "tags": ["lotes", "regalo"], "stock": 25, "low_stock_threshold": 5,
        "weight_grams": 1200, "origin": "Sierra Norte de Sevilla", "curing_months": None,
        "breed": "Ibérico", "feed": "Bellota",
        "images": [], "is_featured": True, "is_active": True,
        "category_slug": "lotes",
        "_seed_img": "https://images.unsplash.com/photo-1695606392727-d8b959879721?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600",
    },
]


async def main():
    now = datetime.now(timezone.utc).isoformat()

    cat_ids: dict[str, str] = {}
    for c in CATEGORIES:
        existing = await db.categories.find_one({"slug": c["slug"]})
        if existing:
            cat_ids[c["slug"]] = existing["id"]
            continue
        doc = dict(c)
        doc["id"] = str(uuid.uuid4())
        doc["created_at"] = now
        await db.categories.insert_one(doc)
        cat_ids[c["slug"]] = doc["id"]
        print(f"+ category {c['name']}")

    for p in PRODUCTS:
        existing = await db.products.find_one({"sku": p["sku"]})
        if existing:
            print(f"= product {p['sku']} (exists)")
            continue
        slug = p.pop("category_slug")
        seed_img = p.pop("_seed_img", None)
        doc = dict(p)
        doc["id"] = str(uuid.uuid4())
        doc["category_id"] = cat_ids.get(slug)
        # store seed image URL directly (will be served as http) — frontend handles
        if seed_img:
            doc["images"] = [seed_img]
        doc["created_at"] = now
        doc["updated_at"] = now
        await db.products.insert_one(doc)
        print(f"+ product {p['name']}")

    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
