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
from routers_excel import router as excel_router
from routers_excel_all import router as excel_all_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Las Dos Doncellas API")

# --- CORS CONFIGURATION (Mover arriba para que procese bien las peticiones) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "https://lasdosdoncellas-web.onrender.com").split(","),
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
app.include_router(excel_router)
app.include_router(excel_all_router)
from routers_chat import router as chat_router
app.include_router(chat_router)
from routers_reviews import router as reviews_router
app.include_router(reviews_router)


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


@app.on_event("shutdown")
async def on_shutdown():
    pass