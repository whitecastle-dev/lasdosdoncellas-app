"""Seed de productos: 5 productos en cada categoría (Jamones, Embutidos, Lotes).

Uso:
    cd /app/backend && python scripts/seed_products.py
    # o en Render shell:
    cd /opt/render/project/src/backend && python scripts/seed_products.py

NO duplica: si el SKU ya existe, lo salta.
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv

# Permitir importar desde /backend y cargar .env
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from db import db


PRODUCTS = {
    "jamones": [
        dict(sku="JAM-BEL-50-5J",  name="Jamón de Bellota 100% Ibérico — 5J", price=620.00, compare_at_price=720.00,
             weight_grams=8500, stock=8, origin="Sierra de Aracena", curing_months=48, breed="100% Ibérico",
             feed="Bellota",
             description="Pieza emblemática curada durante 48 meses. Bouquet a frutos secos y monte bajo.",
             long_description="Jamón 100% Ibérico de bellota etiqueta negra (5 Jotas). Curado lento en cava natural durante un mínimo de 48 meses. Cerdo nacido y criado en libertad en dehesas extremeñas, alimentado a base de bellota y hierbas silvestres durante la última montanera. Veteado marfil, aroma intenso y final largo.",
             is_featured=True),
        dict(sku="JAM-BEL-75-4J",  name="Jamón de Bellota 75% Ibérico — 4J", price=380.00, compare_at_price=440.00,
             weight_grams=8000, stock=12, origin="Salamanca", curing_months=36, breed="75% Ibérico",
             feed="Bellota",
             description="36 meses de curación, sabor profundo y graso óptimo para corte fino.",
             long_description="Jamón ibérico de bellota etiqueta roja procedente de cerdos cruzados (75% raza ibérica). 36 meses de curación tradicional. Pieza con grasa infiltrada y aroma característico de la dehesa salmantina."),
        dict(sku="JAM-CEB-IBE",    name="Jamón de Cebo Ibérico", price=189.00, compare_at_price=220.00,
             weight_grams=7500, stock=20, origin="Castilblanco de los Arroyos", curing_months=24, breed="50% Ibérico",
             feed="Cebo",
             description="Equilibrio perfecto entre precio y calidad. 24 meses de cura.",
             long_description="Cerdo ibérico de cebo criado en granja con piensos seleccionados. Tras el sacrificio, salado artesanal y curación natural durante 24 meses en bodegas con microclima controlado."),
        dict(sku="JAM-BEL-100-RES",name="Jamón Reserva Familia — Edición Limitada", price=890.00, compare_at_price=999.00,
             weight_grams=9200, stock=3, origin="Jabugo", curing_months=60, breed="100% Ibérico puro",
             feed="Bellota pura",
             description="Edición limitada de la añada 2020. Sólo 50 piezas al año.",
             long_description="Pieza de coleccionista. Cerdo de raza ibérica pura criado en exclusiva en la dehesa familiar. Curación de 60 meses en bodegas centenarias. Cada jamón lleva número de serie y certificado de autenticidad firmado.",
             is_featured=True),
        dict(sku="JAM-DES-BEL-1KG",name="Jamón de Bellota Deshuesado — 1kg", price=92.00, compare_at_price=110.00,
             weight_grams=1000, stock=30, origin="Sierra Norte de Sevilla", curing_months=36, breed="75% Ibérico",
             feed="Bellota",
             description="Pieza deshuesada lista para fetear. Perfecta para regalo.",
             long_description="Jamón de bellota ibérico deshuesado por nuestros maestros cortadores y envasado al vacío en porciones de 1kg. Conservación 6 meses sin abrir."),
    ],
    "embutidos": [
        dict(sku="EMB-CHO-BEL-200",name="Chorizo Ibérico de Bellota — 200g", price=14.50,
             weight_grams=200, stock=80, origin="Salamanca", breed="Ibérico bellota",
             description="Pimentón de la Vera y curado natural. Picante suave.",
             long_description="Chorizo elaborado con magro de cerdo ibérico de bellota, pimentón de la Vera (mezcla de dulce y picante), ajo y sal marina. Curación natural en secadero durante 8 semanas."),
        dict(sku="EMB-SAL-BEL-200",name="Salchichón Ibérico de Bellota — 200g", price=15.20,
             weight_grams=200, stock=70, origin="Extremadura", breed="Ibérico bellota",
             description="Aromatizado con pimienta negra molida en mortero.",
             long_description="Salchichón premium de magro ibérico de bellota. Especiado únicamente con pimienta negra, nuez moscada y sal. Sin colorantes ni conservantes añadidos."),
        dict(sku="EMB-LOM-BEL-300",name="Lomo Ibérico de Bellota — 300g", price=32.00,
             weight_grams=300, stock=45, origin="Guijuelo", breed="Ibérico bellota",
             description="Cinta de lomo curada en su justa medida. Untuosidad excepcional.",
             long_description="Caña de lomo entera procedente de cerdo ibérico de bellota. Marinada con pimentón, ajo y orégano, curada de forma natural durante 4 meses. Color cereza profundo y veta blanca de grasa intermuscular."),
        dict(sku="EMB-MOR-BEL-250",name="Morcón Ibérico — 250g", price=18.00,
             weight_grams=250, stock=35, origin="Huelva", breed="Ibérico",
             description="Pieza noble del ciego del cerdo. Sabor concentrado e intenso.",
             long_description="Morcón embutido en tripa natural de ciego, elaborado con la mejor pieza del ibérico de bellota. Adobo de pimentón, ajo y orégano. Curación lenta de 5 meses."),
        dict(sku="EMB-PAP-BEL-200",name="Papada de Ibérico — 200g", price=12.50,
             weight_grams=200, stock=60, origin="Sevilla", breed="Ibérico",
             description="Para tostas, mojos y aliños. Untuosa y aromática.",
             long_description="Papada curada de cerdo ibérico, ligeramente salada y curada al aire de la Sierra Norte. Ideal para tostas calientes, aderezar guisos o como base de mojos andaluces."),
    ],
    "lotes": [
        dict(sku="LOT-DEG-CLA",    name="Lote Degustación Clásica", price=72.00, compare_at_price=85.00,
             weight_grams=1300, stock=40,
             description="200g jamón + 200g chorizo + 200g salchichón + 200g lomo + queso de oveja 500g.",
             long_description="Selección esencial de la casa: jamón ibérico de bellota, chorizo, salchichón y lomo (todo deshuesado y envasado al vacío) más un queso de oveja curado de la sierra. Caja regalo con cuchillo jamonero incluido.",
             is_featured=True),
        dict(sku="LOT-RES-NEG",    name="Lote Reserva Etiqueta Negra", price=210.00, compare_at_price=245.00,
             weight_grams=2200, stock=15,
             description="Pieza estrella: 500g jamón 5J + 250g lomo + 250g chorizo + 200g queso curado + AOVE.",
             long_description="Caja de regalo en madera con jamón de bellota 100% ibérico etiqueta negra (5J) en lonchas, lomo ibérico de bellota, chorizo y queso curado de oveja, además de una botella de AOVE picual de la cooperativa local.",
             is_featured=True),
        dict(sku="LOT-NAV-FAM",    name="Lote Navidad Familiar", price=325.00, compare_at_price=389.00,
             weight_grams=4500, stock=10,
             description="Para 6 personas. Jamón entero deshuesado + embutidos surtidos + dulces.",
             long_description="Pensado para celebraciones: jamón de bellota deshuesado en pieza completa, surtido de embutidos ibéricos, queso, AOVE, vino tinto crianza y dulces navideños artesanos."),
        dict(sku="LOT-COR-EMP",    name="Lote Corporativo — Empresa", price=145.00, compare_at_price=165.00,
             weight_grams=1800, stock=25,
             description="Regalo corporativo personalizable con tu logo en la caja.",
             long_description="Caja serigrafiada con su logotipo (mínimo 10 unidades). Contenido: jamón en lonchas 250g, chorizo, salchichón, lomo y queso curado. Acompañado de tarjeta personalizada."),
        dict(sku="LOT-DUO-LOV",    name="Lote Dúo de Enamorados", price=58.00, compare_at_price=68.00,
             weight_grams=900, stock=30,
             description="Cesta romántica: jamón, queso, AOVE y dulces para dos.",
             long_description="Una experiencia gastronómica completa pensada para regalar: 150g jamón de bellota, 200g queso de oveja curado, AOVE picual 250ml, mermelada artesana y tabla de madera para servir."),
    ],
}


async def _ensure_categories() -> dict:
    """Crea las categorías base si no existen. Devuelve {slug: id}."""
    CATS = [
        {"slug": "jamones", "name": "Jamones", "position": 1},
        {"slug": "embutidos", "name": "Embutidos", "position": 2},
        {"slug": "lotes", "name": "Lotes Selectos", "position": 3},
    ]
    result = {}
    for c in CATS:
        existing = await db.categories.find_one({"slug": c["slug"]})
        if existing:
            result[c["slug"]] = existing["id"]
            continue
        cat_id = str(uuid.uuid4())
        await db.categories.insert_one({
            "id": cat_id,
            "slug": c["slug"],
            "name": c["name"],
            "position": c["position"],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        result[c["slug"]] = cat_id
        print(f"  + categoría creada: {c['slug']}")
    return result


async def seed():
    cats = await _ensure_categories()
    print(f"Categorías listas: {list(cats.keys())}")

    inserted = skipped = 0
    for slug, items in PRODUCTS.items():
        cat_id = cats[slug]
        for raw in items:
            if await db.products.find_one({"sku": raw["sku"]}):
                skipped += 1
                continue
            now = datetime.now(timezone.utc).isoformat()
            doc = {
                "id": str(uuid.uuid4()),
                "name": raw["name"],
                "sku": raw["sku"],
                "description": raw.get("description", ""),
                "long_description": raw.get("long_description", ""),
                "price": float(raw["price"]),
                "compare_at_price": raw.get("compare_at_price"),
                "vat_rate": 10,
                "category_id": cat_id,
                "provider_id": None,
                "tags": ["ibérico"] if slug in ("jamones", "embutidos") else ["lote", "regalo"],
                "stock": int(raw.get("stock", 10)),
                "low_stock_threshold": 5,
                "weight_grams": raw.get("weight_grams"),
                "origin": raw.get("origin"),
                "curing_months": raw.get("curing_months"),
                "breed": raw.get("breed"),
                "feed": raw.get("feed"),
                "images": [],
                "is_featured": raw.get("is_featured", False),
                "is_active": True,
                "avg_rating": 0.0,
                "review_count": 0,
                "created_at": now,
                "updated_at": now,
            }
            await db.products.insert_one(doc)
            inserted += 1
            print(f"  ✓ {raw['sku']:<18} {raw['name']}")

    print(f"\nResultado: {inserted} insertados · {skipped} ya existían (saltados).")


if __name__ == "__main__":
    asyncio.run(seed())
