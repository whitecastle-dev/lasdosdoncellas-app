"""Iteration 19 — UX Polish + Engranaje (slicing→salary) + Analytics + Settings Google.

Covers:
- /api/settings/public (whatsapp + google, write_review_url derived)
- PUT /api/settings persists google block
- POST /api/erp/slicings auto-creates salary line (source=auto:slicing)
- DELETE /api/erp/slicings/{id} removes linked auto salary
- /api/erp/analytics/{evolution,top-employees,top-clients,top-products}
- /api/products/by-categories bulk endpoint
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://docellas-shop.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@lasdosdoncellas.com"
ADMIN_PASS = "Admin1234"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    r = sess.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    if tok:
        sess.headers.update({"Authorization": f"Bearer {tok}"})
    return sess


# ------------------------------------------------------------------ SETTINGS
class TestSettings:
    def test_public_shape(self):
        r = requests.get(f"{API}/settings/public", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "whatsapp" in d and "google" in d
        assert set(d["google"].keys()) >= {"enabled", "write_review_url", "business_name"}

    def test_put_google_persists_and_public_reflects(self, s):
        payload = {
            "whatsapp": {"enabled": True, "phone": "34666777888", "default_message": "Hola", "label": "WA"},
            "google": {
                "enabled": True,
                "place_id": "ChIJTESTPLACEID12345",
                "business_name": "Las Dos Doncellas TEST",
                "write_review_url": "",
            },
        }
        r = s.put(f"{API}/settings", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        got = r.json()
        assert got["google"]["place_id"] == "ChIJTESTPLACEID12345"

        pub = requests.get(f"{API}/settings/public", timeout=10).json()
        assert pub["google"]["enabled"] is True
        assert "writereview" in pub["google"]["write_review_url"]
        assert "ChIJTESTPLACEID12345" in pub["google"]["write_review_url"]


# ------------------------------------------------------- BY-CATEGORIES BULK
class TestByCategories:
    def test_bulk_returns_by_slug(self):
        r = requests.get(f"{API}/products/by-categories", params={"slugs": "jamones,quesos", "per_category": 6}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "by_slug" in d
        assert "jamones" in d["by_slug"] and "quesos" in d["by_slug"]
        for slug, items in d["by_slug"].items():
            assert isinstance(items, list)
            assert len(items) <= 6


# ------------------------------------------------------ ANALYTICS ENDPOINTS
class TestAnalytics:
    def test_evolution_30_days(self, s):
        r = s.get(f"{API}/erp/analytics/evolution", params={"days": 30}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["days"] == 30
        assert len(d["rows"]) == 30
        row = d["rows"][0]
        for k in ("day", "kg", "ingresos", "coste", "count"):
            assert k in row

    def test_top_employees(self, s):
        r = s.get(f"{API}/erp/analytics/top-employees", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "rows" in d
        # sort desc by kg
        kgs = [row["kg"] for row in d["rows"]]
        assert kgs == sorted(kgs, reverse=True)

    def test_top_clients(self, s):
        r = s.get(f"{API}/erp/analytics/top-clients", timeout=15)
        assert r.status_code == 200
        d = r.json()
        ings = [row["ingresos"] for row in d["rows"]]
        assert ings == sorted(ings, reverse=True)

    def test_top_products(self, s):
        r = s.get(f"{API}/erp/analytics/top-products", timeout=15)
        assert r.status_code == 200


# ------------------------------------- ENGRANAJE: SLICING → SALARY (AUTO)
class TestSlicingEngranaje:
    created_slicing_id = None
    created_salary_id = None
    emp_id = None

    def _ensure_employee(self, s, tarifa=0.60):
        # Try get existing employee
        r = s.get(f"{API}/erp/employees", timeout=15)
        assert r.status_code == 200, r.text
        emps = r.json() if isinstance(r.json(), list) else r.json().get("rows", [])
        emp = None
        for e in emps:
            if "TEST" in (e.get("nombre") or "").upper():
                emp = e
                break
        if not emp:
            r = s.post(f"{API}/erp/employees", json={"nombre": "TEST_Engranaje", "activo": True}, timeout=15)
            assert r.status_code in (200, 201), r.text
            emp = r.json()
        # Update tarifa
        eid = emp["id"]
        r = s.patch(f"{API}/erp/employees/{eid}", json={"nombre": emp.get("nombre") or "TEST_Engranaje", "tarifa_loncheado_normal": tarifa, "activo": True}, timeout=15)
        assert r.status_code == 200, r.text
        return eid

    def _ensure_client(self, s):
        r = s.get(f"{API}/erp/clients", timeout=15)
        if r.status_code == 200:
            rows = r.json() if isinstance(r.json(), list) else r.json().get("rows", [])
            for c in rows:
                if "TEST" in (c.get("nombre") or "").upper():
                    return c["id"]
        r = s.post(f"{API}/erp/clients", json={"nombre": "TEST_Cliente_Engranaje", "activo": True}, timeout=15)
        assert r.status_code in (200, 201), r.text
        return r.json()["id"]

    def _ensure_product(self, s):
        r = s.get(f"{API}/erp/products", timeout=15)
        if r.status_code == 200:
            rows = r.json() if isinstance(r.json(), list) else r.json().get("rows", [])
            for p in rows:
                if "TEST" in (p.get("nombre") or "").upper():
                    return p["id"]
        r = s.post(f"{API}/erp/products", json={"nombre": "TEST_Producto_Engranaje", "activo": True}, timeout=15)
        assert r.status_code in (200, 201), r.text
        return r.json()["id"]

    def test_a_create_slicing_auto_salary(self, s):
        eid = self._ensure_employee(s, tarifa=0.60)
        cid = self._ensure_client(s)
        pid = self._ensure_product(s)
        TestSlicingEngranaje.emp_id = eid
        payload = {
            "empleado_id": eid,
            "cliente_id": cid,
            "producto_id": pid,
            "peso_loncheado": 10.0,
            "peso_bruto": 10.0,
            "tipo": "NORMAL",
        }
        r = s.post(f"{API}/erp/slicings", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        doc = r.json()
        assert doc.get("salary_line_id"), f"salary_line_id missing: {doc}"
        # importe = 10 * 0.60 = 6.00
        assert abs(float(doc.get("salary_importe", 0)) - 6.0) < 0.01
        # created_at has hour timestamp (T..)
        assert "T" in (doc.get("created_at") or ""), f"created_at not ISO with time: {doc.get('created_at')}"
        TestSlicingEngranaje.created_slicing_id = doc["id"]
        TestSlicingEngranaje.created_salary_id = doc["salary_line_id"]

    def test_b_salary_line_exists(self, s):
        assert TestSlicingEngranaje.created_salary_id
        r = s.get(f"{API}/erp/salaries", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        rows = data if isinstance(data, list) else data.get("rows", [])
        match = [x for x in rows if x.get("id") == TestSlicingEngranaje.created_salary_id]
        assert match, "auto-created salary line not found in /erp/salaries"
        row = match[0]
        assert row.get("source") == "auto:slicing"
        assert abs(float(row.get("tarifa_kg", 0)) - 0.60) < 0.01
        assert abs(float(row.get("importe", 0)) - 6.0) < 0.01

    def test_c_delete_slicing_removes_salary(self, s):
        sid = TestSlicingEngranaje.created_slicing_id
        assert sid
        r = s.delete(f"{API}/erp/slicings/{sid}", timeout=15)
        assert r.status_code == 200, r.text
        # Verify salary gone
        r = s.get(f"{API}/erp/salaries", timeout=15)
        rows = r.json() if isinstance(r.json(), list) else r.json().get("rows", [])
        match = [x for x in rows if x.get("id") == TestSlicingEngranaje.created_salary_id]
        assert not match, "salary line was NOT deleted after slicing DELETE"
