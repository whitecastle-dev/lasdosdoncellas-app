"""Read-only proxy to the Supabase project that powers the customer's
external portal (lasdosdoncellasapp.es).

The portal is a React SPA that talks to Supabase PostgREST directly. We
mirror every table/RPC the portal uses so our CRM shows the exact same
data with **zero sync delay** and no local storage.

Design
------
* One generic endpoint per read type (``/rows``, ``/rpc``). Callers pass
  the Supabase query string almost verbatim (whitelisted for safety).
* Two schemas are exposed by the Supabase project: ``public`` and
  ``tienda``. The header ``Accept-Profile`` routes cross-schema.
* Writes are exceptional (``/orders/push``, ``/tpv-online/push``) and
  only invoked when our web store needs to inform the portal.
"""
from __future__ import annotations

import os
import logging
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from auth import require_permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/portal", tags=["portal-proxy"])

PERM_READ = "products.read"   # anyone with CRM read access can see the portal data
PERM_WRITE = "products.write"

ALLOWED_SCHEMAS = {"public", "tienda"}

# Whitelist of tables we allow the CRM to query. Prevents typos and
# accidental exposure of internal supabase tables. Values = schema name.
TABLES: dict[str, str] = {
    # public schema
    "empleados": "public",
    "clientes": "public",
    "productos": "public",
    "loncheados": "public",
    "salarios": "public",
    "servicios_corte": "public",
    "particulares_etiquetas": "public",
    "fin_facturas": "public",
    "fin_gastos": "public",
    "fin_gastos_recurrentes": "public",
    "fin_movimientos_tesoreria": "public",
    "fin_cuentas": "public",
    "fin_centros_coste": "public",
    "fin_config_apertura": "public",
    "ldd_rentabilidad_control": "public",
    "user_profiles": "public",
    "notifications": "public",
    # tienda schema
    "facturas_compra": "tienda",
    "ventas": "tienda",
    "inventario_actual": "tienda",
    "familias_producto": "tienda",
    "proveedores": "tienda",
    "compras": "tienda",
    "movimientos_stock": "tienda",
    "precios": "tienda",
    "caja_diaria": "tienda",
    "tpv_ventas": "tienda",
    "tpv_tickets": "tienda",
    "pedidos_web": "tienda",
}

# Whitelist of RPC functions callable via the proxy
RPCS = {"get_kpis_por_departamento"}


def _config() -> tuple[str, str]:
    url = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or ""
    if not url or not key:
        raise HTTPException(status_code=500,
            detail="SUPABASE_URL / SUPABASE_SERVICE_KEY no configurados en el backend.")
    return url, key


def _headers(schema: Optional[str] = None) -> dict[str, str]:
    _, key = _config()
    h = {"apikey": key, "Authorization": f"Bearer {key}"}
    if schema and schema != "public":
        h["Accept-Profile"] = schema
    return h


@router.get("/tables")
async def list_tables(_=Depends(require_permission(PERM_READ))):
    """Return the whitelisted tables grouped by schema (for the UI to introspect)."""
    grouped: dict[str, list[str]] = {}
    for tbl, schema in TABLES.items():
        grouped.setdefault(schema, []).append(tbl)
    return {"schemas": grouped, "rpcs": sorted(RPCS)}


@router.get("/rows/{table}")
async def get_rows(
    table: str,
    request: Request,
    _=Depends(require_permission(PERM_READ)),
):
    """Passthrough SELECT to Supabase PostgREST.

    Every query-string parameter is forwarded verbatim so the caller can
    use PostgREST operators (``eq.``, ``gte.``, ``in.``, ``order``,
    ``limit``, ``select`` with embedded FK, etc.). Example::

        /api/portal/rows/fin_gastos?select=*&estado=eq.PENDIENTE&order=fecha.desc&limit=100
    """
    if table not in TABLES:
        raise HTTPException(status_code=404, detail=f"Tabla '{table}' no permitida.")
    schema = TABLES[table]
    url, _key = _config()

    # Forward query params verbatim
    params = dict(request.query_params)
    # If caller wants total count via Prefer header
    prefer = request.headers.get("prefer")
    headers = _headers(schema)
    if prefer:
        headers["Prefer"] = prefer

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(f"{url}/{table}", params=params, headers=headers)
    if r.status_code >= 400:
        detail = r.text[:400]
        raise HTTPException(status_code=r.status_code, detail=f"Supabase {table}: {detail}")

    payload: Any
    try:
        payload = r.json()
    except Exception:
        payload = []
    return {
        "table": table,
        "schema": schema,
        "rows": payload if isinstance(payload, list) else [payload],
        "content_range": r.headers.get("content-range"),
    }


@router.get("/rows/{table}/count")
async def count_rows(
    table: str,
    request: Request,
    _=Depends(require_permission(PERM_READ)),
):
    """Return only the total row count (uses ``Prefer: count=exact`` + head)."""
    if table not in TABLES:
        raise HTTPException(status_code=404, detail=f"Tabla '{table}' no permitida.")
    schema = TABLES[table]
    url, _key = _config()

    params = {**request.query_params, "select": "id"}
    headers = {**_headers(schema), "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"}
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(f"{url}/{table}", params=params, headers=headers)
    if r.status_code >= 400 and r.status_code != 206:
        raise HTTPException(status_code=r.status_code, detail=r.text[:200])
    cr = r.headers.get("content-range", "0-0/0")
    total = cr.split("/")[-1]
    try:
        return {"table": table, "count": int(total)}
    except ValueError:
        return {"table": table, "count": 0}


@router.get("/rpc/{name}")
async def call_rpc_get(name: str, request: Request, _=Depends(require_permission(PERM_READ))):
    """GET-based RPC (Supabase supports GET or POST). We accept both."""
    if name not in RPCS:
        raise HTTPException(status_code=404, detail=f"RPC '{name}' no permitida.")
    url, _key = _config()
    params = dict(request.query_params)
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(f"{url}/rpc/{name}", params=params, headers=_headers())
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.text[:400])
    try:
        return {"rpc": name, "result": r.json()}
    except Exception:
        return {"rpc": name, "result": None}


@router.post("/rpc/{name}")
async def call_rpc_post(name: str, request: Request, _=Depends(require_permission(PERM_READ))):
    if name not in RPCS:
        raise HTTPException(status_code=404, detail=f"RPC '{name}' no permitida.")
    url, _key = _config()
    body = await request.json() if await request.body() else {}
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(f"{url}/rpc/{name}", json=body, headers=_headers())
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.text[:400])
    try:
        return {"rpc": name, "result": r.json()}
    except Exception:
        return {"rpc": name, "result": None}
