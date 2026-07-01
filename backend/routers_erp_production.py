"""ERP — Sala de loncheado (Phase 5).

Single router file that bundles all the production-side collections imported
from the legacy Supabase portal:
  - production_employees  (empleados de la sala)
  - production_clients    (minoristas/mayoristas de jamón cortado)
  - production_products   (tipos de pieza: ibérico cebo 50%, bellota, etc.)
  - production_slicings   (loncheados — entrada/salida con merma)
  - production_salaries   (salarios diarios vinculados a loncheados)
  - production_events     (servicios de corte / eventos privados)
  - production_labels     (etiquetas para envío de particulares)

Each entity uses the original Supabase UUIDs so that re-syncs are idempotent.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db import db
from auth import require_permission

router = APIRouter(prefix="/api/erp", tags=["erp-production"])

PERM_READ = "products.read"   # cualquier admin de productos puede mirar
PERM_WRITE = "products.write"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------- Empleados

class EmployeeIn(BaseModel):
    nombre: str
    contacto: Optional[str] = ""
    rol: str = "employee"  # employee | admin | manager
    activo: bool = True
    user_id: Optional[str] = None   # ref a Supabase auth
    salario_base: Optional[float] = 0.0
    tarifa_loncheado_normal: Optional[float] = 0.0   # €/kg
    tarifa_loncheado_emplatado: Optional[float] = 0.0
    notas: Optional[str] = ""


@router.get("/employees")
async def list_employees(activo: Optional[bool] = None, _=Depends(require_permission(PERM_READ))):
    q = {} if activo is None else {"activo": activo}
    cursor = db.production_employees.find(q, {"_id": 0}).sort("nombre", 1)
    return [e async for e in cursor]


@router.get("/employees/{eid}")
async def get_employee(eid: str, _=Depends(require_permission(PERM_READ))):
    e = await db.production_employees.find_one({"id": eid}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Empleado no encontrado")
    return e


@router.post("/employees")
async def create_employee(payload: EmployeeIn, _=Depends(require_permission(PERM_WRITE))):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = _now()
    doc["updated_at"] = _now()
    doc["source"] = "cms"
    await db.production_employees.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/employees/{eid}")
async def update_employee(eid: str, payload: EmployeeIn, _=Depends(require_permission(PERM_WRITE))):
    existing = await db.production_employees.find_one({"id": eid})
    if not existing:
        raise HTTPException(404, "Empleado no encontrado")
    updates = payload.model_dump()
    updates["updated_at"] = _now()
    await db.production_employees.update_one({"id": eid}, {"$set": updates})
    return await db.production_employees.find_one({"id": eid}, {"_id": 0})


@router.delete("/employees/{eid}")
async def delete_employee(eid: str, _=Depends(require_permission(PERM_WRITE))):
    r = await db.production_employees.delete_one({"id": eid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Empleado no encontrado")
    return {"ok": True}


# ---------------------------------------------------------- Clientes producción

class ProductionClientIn(BaseModel):
    nombre: str
    contacto: Optional[str] = ""
    categoria: str = "minorista"  # minorista | mayorista | particular
    tarifa_sin_emplatado_menor: float = 0.0  # €/kg para pedidos pequeños
    tarifa_sin_emplatado_mayor: float = 0.0
    tarifa_emplatado: float = 0.0
    direccion: Optional[str] = ""
    cif_nif: Optional[str] = ""
    email: Optional[str] = ""
    activo: bool = True
    notas: Optional[str] = ""


@router.get("/clients")
async def list_prod_clients(activo: Optional[bool] = None, categoria: Optional[str] = None,
                            _=Depends(require_permission(PERM_READ))):
    q = {}
    if activo is not None: q["activo"] = activo
    if categoria: q["categoria"] = categoria
    cursor = db.production_clients.find(q, {"_id": 0}).sort("nombre", 1)
    return [c async for c in cursor]


@router.get("/clients/{cid}")
async def get_prod_client(cid: str, _=Depends(require_permission(PERM_READ))):
    c = await db.production_clients.find_one({"id": cid}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Cliente no encontrado")
    return c


@router.post("/clients")
async def create_prod_client(payload: ProductionClientIn, _=Depends(require_permission(PERM_WRITE))):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = _now()
    doc["updated_at"] = _now()
    doc["source"] = "cms"
    await db.production_clients.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/clients/{cid}")
async def update_prod_client(cid: str, payload: ProductionClientIn, _=Depends(require_permission(PERM_WRITE))):
    existing = await db.production_clients.find_one({"id": cid})
    if not existing:
        raise HTTPException(404, "Cliente no encontrado")
    updates = payload.model_dump()
    updates["updated_at"] = _now()
    await db.production_clients.update_one({"id": cid}, {"$set": updates})
    return await db.production_clients.find_one({"id": cid}, {"_id": 0})


@router.delete("/clients/{cid}")
async def delete_prod_client(cid: str, _=Depends(require_permission(PERM_WRITE))):
    r = await db.production_clients.delete_one({"id": cid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Cliente no encontrado")
    return {"ok": True}


# ---------------------------------------------------------- Productos corte

class ProductionProductIn(BaseModel):
    nombre: str
    categoria: Optional[str] = ""  # Bellota | Cebo | Cebo 50% | etc.
    activo: bool = True
    coste_kg: Optional[float] = 0.0  # coste medio del jamón (€/kg)
    rendimiento_esperado: Optional[float] = 0.85  # % aprovechamiento esperado
    notas: Optional[str] = ""


@router.get("/products")
async def list_prod_products(activo: Optional[bool] = None, _=Depends(require_permission(PERM_READ))):
    q = {} if activo is None else {"activo": activo}
    cursor = db.production_products.find(q, {"_id": 0}).sort("nombre", 1)
    return [p async for p in cursor]


@router.post("/products")
async def create_prod_product(payload: ProductionProductIn, _=Depends(require_permission(PERM_WRITE))):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = _now()
    doc["updated_at"] = _now()
    doc["source"] = "cms"
    await db.production_products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/products/{pid}")
async def update_prod_product(pid: str, payload: ProductionProductIn, _=Depends(require_permission(PERM_WRITE))):
    existing = await db.production_products.find_one({"id": pid})
    if not existing:
        raise HTTPException(404, "Producto no encontrado")
    updates = payload.model_dump()
    updates["updated_at"] = _now()
    await db.production_products.update_one({"id": pid}, {"$set": updates})
    return await db.production_products.find_one({"id": pid}, {"_id": 0})


@router.delete("/products/{pid}")
async def delete_prod_product(pid: str, _=Depends(require_permission(PERM_WRITE))):
    r = await db.production_products.delete_one({"id": pid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Producto no encontrado")
    return {"ok": True}


# ---------------------------------------------------------- Loncheados

class SlicingIn(BaseModel):
    cliente_id: str
    empleado_id: str
    producto_id: str
    peso_bruto: Optional[float] = 0.0   # entrada (kg)
    peso_loncheado: float = 0.0          # salida (kg)
    precio_cliente: float = 0.0
    tipo: str = "NORMAL"                 # NORMAL | EMPLATADO
    emplatado: bool = False
    coste: Optional[float] = 0.0
    observaciones: Optional[str] = ""
    fecha: Optional[str] = None  # ISO date
    # Engranaje 3: si se indica, descuenta peso_bruto (o peso_loncheado si no) del stock
    producto_inventario_id: Optional[str] = None


@router.get("/slicings")
async def list_slicings(
    cliente_id: Optional[str] = None,
    empleado_id: Optional[str] = None,
    desde: Optional[str] = None, hasta: Optional[str] = None,
    limit: int = Query(200, le=2000),
    _=Depends(require_permission(PERM_READ)),
):
    q = {}
    if cliente_id: q["cliente_id"] = cliente_id
    if empleado_id: q["empleado_id"] = empleado_id
    if desde or hasta:
        rng = {}
        if desde: rng["$gte"] = desde
        if hasta: rng["$lte"] = hasta
        q["created_at"] = rng
    cursor = db.production_slicings.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    return [s async for s in cursor]


@router.get("/slicings/summary")
async def slicings_summary(
    desde: Optional[str] = None, hasta: Optional[str] = None,
    _=Depends(require_permission(PERM_READ)),
):
    """KPI summary: piezas, kg, ingresos, coste, beneficio, merma."""
    q = {}
    if desde or hasta:
        rng = {}
        if desde: rng["$gte"] = desde
        if hasta: rng["$lte"] = hasta
        q["created_at"] = rng
    pipe = [
        {"$match": q},
        {"$group": {
            "_id": None,
            "piezas": {"$sum": 1},
            "kg_loncheados": {"$sum": "$peso_loncheado"},
            "kg_brutos": {"$sum": {"$ifNull": ["$peso_bruto", 0]}},
            "ingresos": {"$sum": "$precio_cliente"},
            "coste": {"$sum": {"$ifNull": ["$coste", 0]}},
        }},
    ]
    res = [r async for r in db.production_slicings.aggregate(pipe)]
    if not res:
        return {"piezas": 0, "kg_loncheados": 0, "kg_brutos": 0, "ingresos": 0, "coste": 0,
                "beneficio": 0, "merma_kg": 0, "merma_pct": 0, "media_eur_kg": 0}
    r = res[0]
    kg_lon = float(r.get("kg_loncheados") or 0)
    kg_bru = float(r.get("kg_brutos") or 0)
    merma_kg = max(kg_bru - kg_lon, 0)
    merma_pct = round((merma_kg / kg_bru) * 100, 2) if kg_bru > 0 else 0
    beneficio = round((r.get("ingresos") or 0) - (r.get("coste") or 0), 2)
    media = round((r.get("ingresos") or 0) / kg_lon, 2) if kg_lon > 0 else 0
    return {
        "piezas": r.get("piezas") or 0,
        "kg_loncheados": round(kg_lon, 2),
        "kg_brutos": round(kg_bru, 2),
        "ingresos": round(r.get("ingresos") or 0, 2),
        "coste": round(r.get("coste") or 0, 2),
        "beneficio": beneficio,
        "merma_kg": round(merma_kg, 2),
        "merma_pct": merma_pct,
        "media_eur_kg": media,
    }


@router.get("/slicings/{sid}")
async def get_slicing(sid: str, _=Depends(require_permission(PERM_READ))):
    s = await db.production_slicings.find_one({"id": sid}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Loncheado no encontrado")
    return s


@router.post("/slicings")
async def create_slicing(payload: SlicingIn, _=Depends(require_permission(PERM_WRITE))):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = doc.get("fecha") or _now()
    doc["updated_at"] = _now()
    doc["source"] = "cms"
    doc["stock_consumed"] = None

    # ENGRANAJE 3: descontar del inventario si se enlaza un producto de stock (FIFO por lote)
    if payload.producto_inventario_id:
        qty_to_consume = payload.peso_bruto or payload.peso_loncheado or 0
        if qty_to_consume > 0:
            from routers_inventory import _consume_fifo
            try:
                result = await _consume_fifo(
                    payload.producto_inventario_id, qty_to_consume,
                    reference=f"slicing:{doc['id']}",
                )
                doc["stock_consumed"] = result
                total_cost = sum((l["qty_consumed"] or 0) * (l["unit_cost"] or 0) for l in result.get("lots", []))
                if total_cost > 0 and not doc.get("coste"):
                    doc["coste"] = round(total_cost, 2)
            except Exception as e:
                doc["stock_consumed"] = {"error": str(e)[:200]}

    await db.production_slicings.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/slicings/{sid}")
async def update_slicing(sid: str, payload: SlicingIn, _=Depends(require_permission(PERM_WRITE))):
    existing = await db.production_slicings.find_one({"id": sid})
    if not existing:
        raise HTTPException(404, "Loncheado no encontrado")
    updates = payload.model_dump()
    updates["updated_at"] = _now()
    if updates.get("fecha"):
        updates["created_at"] = updates["fecha"]
    await db.production_slicings.update_one({"id": sid}, {"$set": updates})
    return await db.production_slicings.find_one({"id": sid}, {"_id": 0})


@router.delete("/slicings/{sid}")
async def delete_slicing(sid: str, _=Depends(require_permission(PERM_WRITE))):
    r = await db.production_slicings.delete_one({"id": sid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Loncheado no encontrado")
    return {"ok": True}


# ---------------------------------------------------------- Salarios

class SalaryIn(BaseModel):
    empleado_id: str
    tipo: str = "NORMAL"
    peso_loncheado: float = 0.0
    importe: float = 0.0
    loncheado_id: Optional[str] = None
    fecha: Optional[str] = None


@router.get("/salaries")
async def list_salaries(
    empleado_id: Optional[str] = None,
    desde: Optional[str] = None, hasta: Optional[str] = None,
    limit: int = Query(500, le=5000),
    _=Depends(require_permission(PERM_READ)),
):
    q = {}
    if empleado_id: q["empleado_id"] = empleado_id
    if desde or hasta:
        rng = {}
        if desde: rng["$gte"] = desde
        if hasta: rng["$lte"] = hasta
        q["created_at"] = rng
    cursor = db.production_salaries.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    return [s async for s in cursor]


@router.get("/salaries/monthly")
async def salaries_monthly(
    year: Optional[int] = None, month: Optional[int] = None,
    _=Depends(require_permission(PERM_READ)),
):
    """Resumen por empleado en un mes (año/mes en UTC)."""
    now = datetime.now(timezone.utc)
    year = year or now.year
    month = month or now.month
    next_year, next_month = (year + 1, 1) if month == 12 else (year, month + 1)
    start = f"{year:04d}-{month:02d}-01"
    end = f"{next_year:04d}-{next_month:02d}-01"
    pipe = [
        {"$match": {"created_at": {"$gte": start, "$lt": end}}},
        {"$group": {
            "_id": "$empleado_id",
            "total_importe": {"$sum": "$importe"},
            "total_kg": {"$sum": "$peso_loncheado"},
            "loncheados": {"$sum": 1},
        }},
    ]
    rows = [r async for r in db.production_salaries.aggregate(pipe)]
    employees = {e["id"]: e async for e in db.production_employees.find({}, {"_id": 0})}
    out = []
    for r in rows:
        emp = employees.get(r["_id"], {})
        out.append({
            "empleado_id": r["_id"],
            "nombre": emp.get("nombre", "—"),
            "rol": emp.get("rol", ""),
            "total_importe": round(r["total_importe"] or 0, 2),
            "total_kg": round(r["total_kg"] or 0, 2),
            "loncheados": r["loncheados"],
        })
    out.sort(key=lambda x: x["total_importe"], reverse=True)
    return {"year": year, "month": month, "rows": out, "total": round(sum(r["total_importe"] for r in out), 2)}


@router.post("/salaries")
async def create_salary(payload: SalaryIn, _=Depends(require_permission(PERM_WRITE))):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = doc.get("fecha") or _now()
    doc["source"] = "cms"
    await db.production_salaries.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/salaries/{sid}")
async def update_salary(sid: str, payload: SalaryIn, _=Depends(require_permission(PERM_WRITE))):
    existing = await db.production_salaries.find_one({"id": sid})
    if not existing:
        raise HTTPException(404, "Salario no encontrado")
    updates = payload.model_dump()
    if updates.get("fecha"):
        updates["created_at"] = updates["fecha"]
    await db.production_salaries.update_one({"id": sid}, {"$set": updates})
    return await db.production_salaries.find_one({"id": sid}, {"_id": 0})


@router.delete("/salaries/{sid}")
async def delete_salary(sid: str, _=Depends(require_permission(PERM_WRITE))):
    r = await db.production_salaries.delete_one({"id": sid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Salario no encontrado")
    return {"ok": True}


# ---------------------------------------------------------- Eventos / Servicios

class EventIn(BaseModel):
    fecha: str  # YYYY-MM-DD
    hora_inicio: Optional[str] = ""
    hora_fin: Optional[str] = ""
    cliente: str
    ubicacion: Optional[str] = ""
    tipo_servicio: str = "PRIVADO"  # PRIVADO | EVENTO | CATERING
    empleado_id: Optional[str] = None
    num_piezas: int = 1
    descripcion_piezas: Optional[str] = ""
    precio_servicio: float = 0.0
    gastos: float = 0.0
    observaciones: Optional[str] = ""
    estado: str = "PROGRAMADO"  # PROGRAMADO | CONFIRMADO | COMPLETADO | CANCELADO


@router.get("/events")
async def list_events(
    desde: Optional[str] = None, hasta: Optional[str] = None,
    estado: Optional[str] = None,
    _=Depends(require_permission(PERM_READ)),
):
    q = {}
    if desde or hasta:
        rng = {}
        if desde: rng["$gte"] = desde
        if hasta: rng["$lte"] = hasta
        q["fecha"] = rng
    if estado: q["estado"] = estado
    cursor = db.production_events.find(q, {"_id": 0}).sort("fecha", 1)
    return [e async for e in cursor]


@router.post("/events")
async def create_event(payload: EventIn, _=Depends(require_permission(PERM_WRITE))):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = _now()
    doc["updated_at"] = _now()
    doc["source"] = "cms"
    await db.production_events.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/events/{eid}")
async def update_event(eid: str, payload: EventIn, _=Depends(require_permission(PERM_WRITE))):
    existing = await db.production_events.find_one({"id": eid})
    if not existing:
        raise HTTPException(404, "Evento no encontrado")
    updates = payload.model_dump()
    updates["updated_at"] = _now()
    await db.production_events.update_one({"id": eid}, {"$set": updates})
    return await db.production_events.find_one({"id": eid}, {"_id": 0})


@router.delete("/events/{eid}")
async def delete_event(eid: str, _=Depends(require_permission(PERM_WRITE))):
    r = await db.production_events.delete_one({"id": eid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Evento no encontrado")
    return {"ok": True}


# ---------------------------------------------------------- Etiquetas particulares

class LabelIn(BaseModel):
    nombre: str
    telefono: Optional[str] = ""
    tipo_pieza: str = "JAMON"
    peso: float = 0.0
    fecha: str  # YYYY-MM-DD


@router.get("/labels")
async def list_labels(_=Depends(require_permission(PERM_READ))):
    cursor = db.production_labels.find({}, {"_id": 0}).sort("fecha", -1)
    return [l async for l in cursor]


@router.post("/labels")
async def create_label(payload: LabelIn, _=Depends(require_permission(PERM_WRITE))):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = _now()
    doc["source"] = "cms"
    await db.production_labels.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/labels/{lid}")
async def delete_label(lid: str, _=Depends(require_permission(PERM_WRITE))):
    r = await db.production_labels.delete_one({"id": lid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Etiqueta no encontrada")
    return {"ok": True}
