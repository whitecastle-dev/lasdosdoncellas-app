"""Bulk sync from the legacy Supabase portal into our MongoDB collections.

Reads tables via the PostgREST endpoint using the service_role key from .env.
Sync is **idempotent** (uses upsert by Supabase id) and **non-destructive**
(does not delete CMS-side records that aren't in Supabase).

Tables imported:
  clientes              → production_clients
  empleados             → production_employees
  productos             → production_products
  loncheados            → production_slicings  (peso_loncheado mapped; peso_bruto left null)
  salarios              → production_salaries
  servicios_corte       → production_events
  particulares_etiquetas→ production_labels
"""
import os
import logging
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException

from db import db
from auth import require_permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/erp/sync", tags=["erp-sync"])

PERM = "products.write"


def _supabase_config():
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        raise HTTPException(status_code=400,
            detail="SUPABASE_URL y SUPABASE_SERVICE_KEY no están configurados en el backend (.env).")
    return url, key


async def _fetch_all(table: str, url: str, key: str, page_size: int = 1000) -> list:
    """Fetch every row from a Supabase table using range pagination."""
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    rows = []
    offset = 0
    async with httpx.AsyncClient(timeout=60.0) as client:
        while True:
            range_end = offset + page_size - 1
            r = await client.get(
                f"{url}/{table}?select=*",
                headers={**headers, "Range-Unit": "items", "Range": f"{offset}-{range_end}"},
            )
            if r.status_code not in (200, 206):
                raise HTTPException(status_code=502,
                    detail=f"Supabase {table} error {r.status_code}: {r.text[:200]}")
            batch = r.json()
            rows.extend(batch)
            if len(batch) < page_size:
                break
            offset += page_size
    return rows


async def _upsert(coll, doc: dict, key: str = "id") -> str:
    """Upsert by `key`. Returns 'created' | 'updated'."""
    existing = await coll.find_one({key: doc[key]})
    if existing:
        await coll.update_one({key: doc[key]}, {"$set": doc})
        return "updated"
    await coll.insert_one(doc)
    return "created"


def _map_employee(r: dict) -> dict:
    return {
        "id": r["id"],
        "nombre": r.get("nombre", ""),
        "contacto": r.get("contacto") or "",
        "rol": r.get("rol") or "employee",
        "activo": bool(r.get("activo", True)),
        "user_id": r.get("user_id"),
        "salario_base": 0.0,
        "tarifa_loncheado_normal": 0.0,
        "tarifa_loncheado_emplatado": 0.0,
        "notas": "",
        "created_at": r.get("created_at"),
        "source": "supabase",
    }


def _map_client(r: dict) -> dict:
    return {
        "id": r["id"],
        "nombre": r.get("nombre", ""),
        "contacto": r.get("contacto") or "",
        "categoria": r.get("categoria") or "minorista",
        "tarifa_sin_emplatado_menor": float(r.get("tarifa_sin_emplatado_menor") or 0),
        "tarifa_sin_emplatado_mayor": float(r.get("tarifa_sin_emplatado_mayor") or 0),
        "tarifa_emplatado": float(r.get("tarifa_emplatado") or 0),
        "direccion": r.get("direccion") or "",
        "cif_nif": r.get("cif_nif") or "",
        "email": r.get("email") or "",
        "activo": bool(r.get("activo", True)),
        "notas": r.get("notas") or "",
        "created_at": r.get("created_at"),
        "source": "supabase",
    }


def _map_product(r: dict) -> dict:
    return {
        "id": r["id"],
        "nombre": r.get("nombre", ""),
        "categoria": r.get("categoria") or "",
        "activo": bool(r.get("activo", True)),
        "coste_kg": 0.0,
        "rendimiento_esperado": 0.85,
        "notas": "",
        "created_at": r.get("created_at"),
        "source": "supabase",
    }


def _map_slicing(r: dict) -> dict:
    return {
        "id": r["id"],
        "cliente_id": r.get("cliente_id"),
        "empleado_id": r.get("empleado_id"),
        "producto_id": r.get("producto_id"),
        "peso_bruto": 0.0,  # not present in legacy table
        "peso_loncheado": float(r.get("peso_loncheado") or r.get("peso") or 0),
        "precio_cliente": float(r.get("precio_cliente") or 0),
        "tipo": r.get("tipo") or "NORMAL",
        "emplatado": bool(r.get("emplatado", False)),
        "coste": float(r.get("coste") or 0),
        "observaciones": r.get("observaciones") or "",
        "fecha": (r.get("created_at") or "")[:10],
        "created_at": r.get("created_at"),
        "source": "supabase",
    }


def _map_salary(r: dict) -> dict:
    return {
        "id": r["id"],
        "empleado_id": r.get("empleado_id"),
        "tipo": r.get("tipo") or "NORMAL",
        "peso_loncheado": float(r.get("peso_loncheado") or 0),
        "importe": float(r.get("importe") or 0),
        "loncheado_id": r.get("loncheado_id"),
        "fecha": (r.get("created_at") or "")[:10],
        "created_at": r.get("created_at"),
        "source": "supabase",
    }


def _map_event(r: dict) -> dict:
    return {
        "id": r["id"],
        "fecha": r.get("fecha") or "",
        "hora_inicio": r.get("hora_inicio") or "",
        "hora_fin": r.get("hora_fin") or "",
        "cliente": r.get("cliente") or "",
        "ubicacion": r.get("ubicacion") or "",
        "tipo_servicio": r.get("tipo_servicio") or "PRIVADO",
        "empleado_id": r.get("empleado_id"),
        "num_piezas": int(r.get("num_piezas") or 0),
        "descripcion_piezas": r.get("descripcion_piezas") or "",
        "precio_servicio": float(r.get("precio_servicio") or 0),
        "gastos": float(r.get("gastos") or 0),
        "observaciones": r.get("observaciones") or "",
        "estado": r.get("estado") or "PROGRAMADO",
        "created_at": r.get("created_at"),
        "source": "supabase",
    }


def _map_label(r: dict) -> dict:
    return {
        "id": r["id"],
        "nombre": r.get("nombre", ""),
        "telefono": r.get("telefono") or "",
        "tipo_pieza": r.get("tipo_pieza") or "JAMON",
        "peso": float(r.get("peso") or 0),
        "fecha": r.get("fecha") or "",
        "created_at": r.get("created_at"),
        "source": "supabase",
    }


PIPELINES = [
    ("empleados", "production_employees", _map_employee),
    ("clientes", "production_clients", _map_client),
    ("productos", "production_products", _map_product),
    ("loncheados", "production_slicings", _map_slicing),
    ("salarios", "production_salaries", _map_salary),
    ("servicios_corte", "production_events", _map_event),
    ("particulares_etiquetas", "production_labels", _map_label),
]


@router.get("/preview")
async def preview(_=Depends(require_permission(PERM))):
    """Count rows in each Supabase table (no data fetched). Quick sanity."""
    url, key = _supabase_config()
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Prefer": "count=exact", "Range": "0-0"}
    out = []
    async with httpx.AsyncClient(timeout=20.0) as client:
        for table, _, _ in PIPELINES:
            try:
                r = await client.get(f"{url}/{table}?select=id", headers=headers)
                content_range = r.headers.get("content-range", "")
                count = content_range.split("/")[-1] if "/" in content_range else "?"
                out.append({"table": table, "count": int(count) if count.isdigit() else 0,
                            "status": r.status_code})
            except Exception as e:
                out.append({"table": table, "count": 0, "status": "error", "error": str(e)[:200]})
    return {"tables": out}


@router.post("/run")
async def run_sync(
    only: Optional[str] = None,
    _=Depends(require_permission(PERM)),
):
    """Idempotent full sync from Supabase. Pass ?only=clientes,loncheados to
    restrict to specific tables."""
    url, key = _supabase_config()
    selected = set((only or "").split(",")) if only else None
    out = []
    for src_table, dst_coll_name, mapper in PIPELINES:
        if selected and src_table not in selected:
            continue
        try:
            rows = await _fetch_all(src_table, url, key)
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("fetch %s: %s", src_table, e)
            out.append({"table": src_table, "error": str(e)[:200]})
            continue

        coll = db[dst_coll_name]
        created = updated = errors = 0
        for r in rows:
            try:
                doc = mapper(r)
                if not doc.get("id"):
                    errors += 1
                    continue
                kind = await _upsert(coll, doc)
                if kind == "created": created += 1
                else: updated += 1
            except Exception as e:
                errors += 1
                logger.exception("upsert %s.%s: %s", src_table, r.get("id"), e)
        out.append({
            "table": src_table, "destination": dst_coll_name,
            "fetched": len(rows), "created": created, "updated": updated, "errors": errors,
        })
    return {"results": out}
