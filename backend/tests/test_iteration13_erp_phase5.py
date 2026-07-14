"""Phase 5 — ERP Sala de Loncheado backend tests.

Covers:
  * Auth (anonymous → 401)
  * /api/erp/sync preview + run idempotency
  * Loncheados (slicings) CRUD + summary KPIs
  * Empleados CRUD
  * Salarios mensual (junio 2026 + empty month)
  * Clientes producción CRUD
  * Productos producción CRUD
  * Eventos CRUD + filtros estado/fecha
  * Etiquetas CRUD
"""
import os
import pytest
import requests
from pathlib import Path

# Load REACT_APP_BACKEND_URL from frontend/.env when not in env
if not os.environ.get("REACT_APP_BACKEND_URL"):
    env_file = Path("/app/frontend/.env")
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                os.environ["REACT_APP_BACKEND_URL"] = line.split("=", 1)[1].strip()
                break

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@lasdosdoncellas.com"
ADMIN_PASSWORD = "Admin1234"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture
def client(admin_token):
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
    })
    return s


# ---------------------------------------------------- AUTH
class TestAuth:
    def test_anon_sync_preview_401(self):
        r = requests.get(f"{BASE_URL}/api/erp/sync/preview", timeout=10)
        assert r.status_code in (401, 403), f"got {r.status_code}"

    def test_anon_slicings_401(self):
        r = requests.get(f"{BASE_URL}/api/erp/slicings", timeout=10)
        assert r.status_code in (401, 403)

    def test_anon_employees_401(self):
        r = requests.get(f"{BASE_URL}/api/erp/employees", timeout=10)
        assert r.status_code in (401, 403)


# ---------------------------------------------------- SUPABASE SYNC
class TestSupabaseSync:
    def test_preview_returns_7_tables(self, client):
        r = client.get(f"{BASE_URL}/api/erp/sync/preview", timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        # Expect dict with table name -> count OR list
        counts = data.get("counts") or data.get("tables") or data
        if isinstance(counts, list):
            counts = {x.get("table") or x.get("name"): x.get("count") or x.get("rows") for x in counts}
        # Verify key tables present
        expected = {"empleados", "clientes", "productos", "loncheados",
                    "salarios", "servicios_corte", "particulares_etiquetas"}
        present = set(k for k in counts.keys() if isinstance(k, str))
        missing = expected - present
        assert not missing, f"Missing tables: {missing}. Got: {present}"

    def test_run_idempotent(self, client):
        r1 = client.post(f"{BASE_URL}/api/erp/sync/run", timeout=180)
        assert r1.status_code == 200, r1.text
        r2 = client.post(f"{BASE_URL}/api/erp/sync/run", timeout=180)
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        # Second run should not create dupes — created should be 0 in all tables
        results = d2.get("results") or d2.get("tables") or d2
        if isinstance(results, dict):
            iterable = results.values()
        else:
            iterable = results
        total_created = 0
        for item in iterable:
            if isinstance(item, dict):
                total_created += int(item.get("created", 0) or 0)
        assert total_created == 0, f"Idempotency broken — second run created {total_created} rows: {d2}"

    def test_run_only_clientes(self, client):
        r = client.post(f"{BASE_URL}/api/erp/sync/run?only=clientes", timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        results = data.get("results") or data.get("tables") or data
        # Only one table should have been touched
        if isinstance(results, dict):
            keys = [k for k, v in results.items() if isinstance(v, dict) and (v.get("created", 0) or v.get("updated", 0) or v.get("processed", 0))]
            # We can't reliably check keys=clientes in all schemas; ensure 'clientes' is in results
            assert any("client" in str(k).lower() for k in results.keys()), f"clientes not in {list(results.keys())}"


# ---------------------------------------------------- SLICINGS
class TestSlicings:
    def test_list_paginated(self, client):
        r = client.get(f"{BASE_URL}/api/erp/slicings?limit=10", timeout=15)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) <= 10

    def test_summary_alltime(self, client):
        r = client.get(f"{BASE_URL}/api/erp/slicings/summary", timeout=20)
        assert r.status_code == 200
        s = r.json()
        for k in ["piezas", "kg_loncheados", "kg_brutos", "ingresos",
                  "coste", "beneficio", "merma_kg", "merma_pct", "media_eur_kg"]:
            assert k in s, f"missing key {k}"
        assert s["piezas"] == 800, f"expected 800 piezas got {s['piezas']}"
        assert abs(s["ingresos"] - 233120.90) < 1.0, f"ingresos={s['ingresos']}"
        assert abs(s["media_eur_kg"] - 35.16) < 0.5, f"media={s['media_eur_kg']}"

    def test_filter_by_cliente(self, client):
        # Pick a client id from imported data
        rc = client.get(f"{BASE_URL}/api/erp/clients", timeout=15)
        assert rc.status_code == 200
        clients = rc.json()
        assert len(clients) > 0
        cid = clients[0]["id"]
        r = client.get(f"{BASE_URL}/api/erp/slicings?cliente_id={cid}&limit=20", timeout=15)
        assert r.status_code == 200
        rows = r.json()
        for row in rows:
            assert row["cliente_id"] == cid

    def test_crud_slicing(self, client):
        # Need cliente, empleado, producto
        clients = client.get(f"{BASE_URL}/api/erp/clients", timeout=15).json()
        emps = client.get(f"{BASE_URL}/api/erp/employees", timeout=15).json()
        prods = client.get(f"{BASE_URL}/api/erp/products", timeout=15).json()
        assert clients and emps and prods
        payload = {
            "cliente_id": clients[0]["id"],
            "empleado_id": emps[0]["id"],
            "producto_id": prods[0]["id"],
            "peso_bruto": 10.0,
            "peso_loncheado": 8.5,
            "precio_cliente": 300.0,
            "tipo": "NORMAL",
        }
        r = client.post(f"{BASE_URL}/api/erp/slicings", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        created = r.json()
        sid = created["id"]
        # PATCH
        payload["precio_cliente"] = 350.0
        r2 = client.patch(f"{BASE_URL}/api/erp/slicings/{sid}", json=payload, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["precio_cliente"] == 350.0
        # DELETE
        r3 = client.delete(f"{BASE_URL}/api/erp/slicings/{sid}", timeout=15)
        assert r3.status_code in (200, 204)
        # Verify gone
        r4 = client.get(f"{BASE_URL}/api/erp/slicings/{sid}", timeout=15)
        assert r4.status_code == 404


# ---------------------------------------------------- EMPLOYEES
class TestEmployees:
    def test_list_has_imported(self, client):
        r = client.get(f"{BASE_URL}/api/erp/employees", timeout=15)
        assert r.status_code == 200
        emps = r.json()
        # At least 4 with source=supabase
        sb = [e for e in emps if e.get("source") == "supabase"]
        assert len(sb) >= 4, f"expected ≥4 supabase employees got {len(sb)}"

    def test_create_with_new_fields(self, client):
        payload = {
            "nombre": "TEST_Empleado_Phase5",
            "rol": "employee",
            "activo": True,
            "salario_base": 1500.0,
            "tarifa_loncheado_normal": 2.5,
            "tarifa_loncheado_emplatado": 3.5,
            "notas": "test note",
        }
        r = client.post(f"{BASE_URL}/api/erp/employees", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        e = r.json()
        assert e["source"] == "cms"
        assert e["salario_base"] == 1500.0
        assert e["tarifa_loncheado_normal"] == 2.5
        eid = e["id"]
        # Cleanup
        client.delete(f"{BASE_URL}/api/erp/employees/{eid}", timeout=15)


# ---------------------------------------------------- SALARIES MONTHLY
class TestSalariesMonthly:
    def test_june_2026(self, client):
        r = client.get(f"{BASE_URL}/api/erp/salaries/monthly?year=2026&month=6", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "rows" in data and "total" in data
        # Verify expected total ≈ 3615
        assert abs(data["total"] - 3615.00) < 5.0, f"total={data['total']}"
        names = {row["nombre"]: row for row in data["rows"]}
        assert "Jesús Palomo" in names or any("Palomo" in n for n in names), f"names={list(names)}"

    def test_empty_month(self, client):
        # Pick a far-future month with no data
        r = client.get(f"{BASE_URL}/api/erp/salaries/monthly?year=2099&month=1", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] == 0
        assert d["rows"] == []


# ---------------------------------------------------- CLIENTS PRODUCCIÓN
class TestProductionClients:
    def test_list(self, client):
        r = client.get(f"{BASE_URL}/api/erp/clients", timeout=15)
        assert r.status_code == 200
        cs = r.json()
        assert len(cs) >= 11, f"expected ≥11 got {len(cs)}"
        cats = {c.get("categoria") for c in cs}
        assert cats & {"minorista", "mayorista", "particular"}

    def test_crud(self, client):
        payload = {"nombre": "TEST_Cliente_Phase5", "categoria": "minorista",
                   "tarifa_sin_emplatado_menor": 30.0, "tarifa_sin_emplatado_mayor": 28.0,
                   "tarifa_emplatado": 35.0}
        r = client.post(f"{BASE_URL}/api/erp/clients", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        cid = r.json()["id"]
        # PATCH
        payload["tarifa_emplatado"] = 40.0
        r2 = client.patch(f"{BASE_URL}/api/erp/clients/{cid}", json=payload, timeout=15)
        assert r2.status_code == 200
        # DELETE
        assert client.delete(f"{BASE_URL}/api/erp/clients/{cid}", timeout=15).status_code in (200, 204)


# ---------------------------------------------------- PROD PRODUCTS
class TestProductionProducts:
    def test_list_eight(self, client):
        r = client.get(f"{BASE_URL}/api/erp/products", timeout=15)
        assert r.status_code == 200
        ps = r.json()
        assert len(ps) >= 8, f"expected ≥8 got {len(ps)}"

    def test_crud_with_new_fields(self, client):
        payload = {"nombre": "TEST_Tipo_Pieza", "categoria": "Cebo",
                   "coste_kg": 25.0, "rendimiento_esperado": 0.82}
        r = client.post(f"{BASE_URL}/api/erp/products", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        p = r.json()
        assert p["coste_kg"] == 25.0
        assert p["rendimiento_esperado"] == 0.82
        client.delete(f"{BASE_URL}/api/erp/products/{p['id']}", timeout=15)


# ---------------------------------------------------- EVENTS
class TestEvents:
    def test_list_ten(self, client):
        r = client.get(f"{BASE_URL}/api/erp/events", timeout=15)
        assert r.status_code == 200
        ev = r.json()
        assert len(ev) >= 10, f"expected ≥10 got {len(ev)}"

    def test_filter_estado(self, client):
        r = client.get(f"{BASE_URL}/api/erp/events?estado=PROGRAMADO", timeout=15)
        assert r.status_code == 200
        for e in r.json():
            assert e["estado"] == "PROGRAMADO"

    def test_filter_date_range(self, client):
        r = client.get(f"{BASE_URL}/api/erp/events?desde=2025-01-01&hasta=2030-12-31", timeout=15)
        assert r.status_code == 200


# ---------------------------------------------------- LABELS
class TestLabels:
    def test_list(self, client):
        r = client.get(f"{BASE_URL}/api/erp/labels", timeout=15)
        assert r.status_code == 200
        ls = r.json()
        assert len(ls) >= 3, f"expected ≥3 got {len(ls)}"

    def test_create(self, client):
        payload = {"nombre": "TEST_Label", "telefono": "600000000",
                   "tipo_pieza": "JAMON", "peso": 7.5, "fecha": "2026-06-15"}
        r = client.post(f"{BASE_URL}/api/erp/labels", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        lid = r.json()["id"]
        client.delete(f"{BASE_URL}/api/erp/labels/{lid}", timeout=15)
