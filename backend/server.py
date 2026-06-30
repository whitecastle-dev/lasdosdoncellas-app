"""Main FastAPI app for Las Dos Doncellas."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from db import db
from auth import seed_admin
from storage import init_storage

from routers_auth import router as auth_router
from routers_users import router as users_router
from routers_products import router as products_router
from routers_orders import router as orders_router
from routers_dashboard import router as dashboard_router
from routers_files import router as files_router
from routers_providers import router as providers_router
from routers_customers import router as customers_router
from routers_business_customers import router as business_customers_router
from routers_stock_alerts import router as stock_alerts_router
from routers_excel import router as excel_router
from routers_excel_all import router as excel_all_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Las Dos Doncellas API")

# --- CORS: incluye SIEMPRE los dominios conocidos del front + custom domain ---
_default_origins = [
    "https://lasdosdoncellas-web.onrender.com",
    "https://lasdosdoncellasibericos.es",
    "https://www.lasdosdoncellasibericos.es",
    "http://localhost:3000",
]
_env_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
_all_origins = list(dict.fromkeys(_default_origins + _env_origins))
logger.info("CORS allow_origins: %s", _all_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_all_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api")
async def root():
    return {"status": "ok", "name": "Las Dos Doncellas API"}


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(products_router)
app.include_router(orders_router)
app.include_router(dashboard_router)
app.include_router(files_router)
app.include_router(providers_router)
app.include_router(customers_router)
app.include_router(business_customers_router)
app.include_router(stock_alerts_router)
app.include_router(excel_router)
app.include_router(excel_all_router)
from routers_chat import router as chat_router
app.include_router(chat_router)
from routers_reviews import router as reviews_router
app.include_router(reviews_router)
from routers_settings import router as settings_router
app.include_router(settings_router)


@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.customers.create_index("email", unique=True)
        await db.products.create_index("sku", unique=True)
        await db.products.create_index("created_at")
        await db.orders.create_index("created_at")
        await db.orders.create_index("session_id")
        await db.orders.create_index("order_number", unique=True)
        await db.payment_transactions.create_index("session_id")
        await db.categories.create_index("slug", unique=True)
        await db.providers.create_index("email", unique=True)
        await db.business_customers.create_index("email", unique=True)
        await db.business_customers.create_index("tax_id", unique=True)
        await db.stock_alerts.create_index([("provider_id", 1), ("status", 1)])
        await db.stock_alerts.create_index("created_at")
        await db.reviews.create_index([("product_id", 1), ("created_at", -1)])
        await db.reviews.create_index([("product_id", 1), ("customer_id", 1)], unique=True)
        logger.info("Indexes ensured")
    except Exception as e:
        logger.warning(f"Index creation issue: {e}")

    try:
        await seed_admin()
        logger.info("Superadmin seeded")
    except Exception as e:
        logger.exception(f"Admin seed failed: {e}")

    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.warning(f"Storage init failed (will retry per request): {e}")

    # Auto-seed idempotente. Cubre 2 casos:
    #   1) BD totalmente vacía → inyecta los 30+ productos demo.
    #   2) BD ya tiene productos pero le faltan categorías nuevas (quesos,
    #      vinos, aceites) → vuelve a correr el seed; los SKUs ya existentes
    #      se saltan automáticamente (idempotente). Esto soluciona el caso
    #      "después de un deploy nuevo no salen los demos de quesos/vinos/aceites".
    #   3) Migración: rellena position e is_active en categorías legacy que
    #      tenían esos campos a null (necesario para que se ordenen y aparezcan
    #      en el storefront).
    try:
        # 1) Migración de categorías legacy ---------------------------------
        POS_DEFAULTS = {"jamones": 1, "embutidos": 2, "quesos": 3,
                        "vinos": 4, "aceites": 5, "lotes": 6}
        legacy = db.categories.find({"$or": [{"position": None},
                                              {"is_active": None},
                                              {"position": {"$exists": False}},
                                              {"is_active": {"$exists": False}}]})
        async for c in legacy:
            updates = {}
            if c.get("position") is None:
                updates["position"] = POS_DEFAULTS.get(c.get("slug"), 99)
            if c.get("is_active") is None:
                updates["is_active"] = True
            if updates:
                await db.categories.update_one({"_id": c["_id"]}, {"$set": updates})
                logger.info("Migración categoría '%s' → %s", c.get("slug"), updates)

        # 2) Auto-seed: vacía o faltan categorías clave ---------------------
        prod_count = await db.products.count_documents({})
        missing_cats = []
        for s in ("jamones", "paletillas", "quesos", "loncheados", "embutidos",
                  "aceites", "conservas", "aceitunas", "miel", "sal", "bebidas",
                  "vinos", "vino-granel", "bebidas-alcoholicas", "cortes", "varios"):
            if not await db.categories.find_one({"slug": s}):
                missing_cats.append(s)
        should_seed = prod_count == 0 or len(missing_cats) > 0

        if should_seed:
            if prod_count == 0:
                logger.info("BD sin productos — auto-seed inyectando los 30+ productos demo…")
            else:
                logger.info("Faltan categorías %s — re-ejecutando seed (idempotente por SKU)…", missing_cats)
            try:
                from scripts.seed_products import seed as seed_products
            except ImportError:
                # Fallback: import directo del archivo
                import importlib.util as _u
                _spec = _u.spec_from_file_location("seed_products", ROOT_DIR / "scripts" / "seed_products.py")
                _mod = _u.module_from_spec(_spec)
                _spec.loader.exec_module(_mod)
                seed_products = _mod.seed
            await seed_products()
            new_count = await db.products.count_documents({})
            logger.info("Auto-seed completado. Productos en BD: %d", new_count)
        else:
            logger.info("BD ya tiene %d productos y todas las categorías clave — no se hace auto-seed.", prod_count)
    except Exception as e:
        logger.exception("Auto-seed de productos falló: %s", e)


@app.on_event("shutdown")
async def on_shutdown():
    pass