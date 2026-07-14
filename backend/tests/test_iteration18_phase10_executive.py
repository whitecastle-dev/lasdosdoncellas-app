"""Phase 10 — Executive Dashboard 360º KPIs endpoint tests."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://docellas-shop.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@lasdosdoncellas.com"
ADMIN_PASSWORD = "Admin1234"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"No token in login response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


class TestExecutiveKpis:
    def test_kpis_default_30d_shape(self, headers):
        t0 = time.time()
        r = requests.get(f"{BASE_URL}/api/executive/kpis?days=30", headers=headers, timeout=15)
        dur = time.time() - t0
        assert r.status_code == 200, r.text
        assert dur < 5.0, f"KPIs endpoint too slow: {dur:.2f}s"
        d = r.json()
        # Top-level shape
        for k in ["range_days", "revenue", "daily", "treasury", "inventory",
                  "accounting", "production", "orders_pipeline", "top_products",
                  "top_b2b_customers"]:
            assert k in d, f"Missing top-level key: {k}"
        assert d["range_days"] == 30
        assert isinstance(d["daily"], list) and len(d["daily"]) == 30
        # Revenue structure
        rev = d["revenue"]
        for k in ["total", "online", "tpv", "b2b"]:
            assert k in rev
        for stream in ["online", "tpv", "b2b"]:
            assert "total" in rev[stream] and "count" in rev[stream]
        # Treasury
        tr = d["treasury"]
        for k in ["accounts", "saldo_total", "pending_income", "pending_expense", "saldo_proyectado"]:
            assert k in tr, f"treasury missing {k}"
        assert isinstance(tr["accounts"], list)
        assert "sum" in tr["pending_income"] and "count" in tr["pending_income"]
        assert "sum" in tr["pending_expense"] and "count" in tr["pending_expense"]
        # Inventory
        inv = d["inventory"]
        for k in ["stock_value", "low_stock_count", "expiring_lots_30d", "stock_alerts_pending"]:
            assert k in inv, f"inventory missing {k}"
        # Accounting
        acc = d["accounting"]
        assert "pnl_month" in acc and "vat_quarter" in acc
        for k in ["ingresos", "gastos", "resultado"]:
            assert k in acc["pnl_month"]
        for k in ["repercutido", "soportado", "liquidacion", "quarter_start"]:
            assert k in acc["vat_quarter"]
        # Production
        assert "slicings_month" in d["production"]
        for k in ["kilos", "count"]:
            assert k in d["production"]["slicings_month"]
        # Orders pipeline
        op = d["orders_pipeline"]
        for k in ["pending_payment", "paid", "shipped", "today", "tpv_today"]:
            assert k in op

    def test_kpis_days_7(self, headers):
        r = requests.get(f"{BASE_URL}/api/executive/kpis?days=7", headers=headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["range_days"] == 7
        assert len(d["daily"]) == 7

    def test_kpis_days_90(self, headers):
        r = requests.get(f"{BASE_URL}/api/executive/kpis?days=90", headers=headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["range_days"] == 90
        assert len(d["daily"]) == 90

    def test_revenue_math(self, headers):
        r = requests.get(f"{BASE_URL}/api/executive/kpis?days=30", headers=headers, timeout=15)
        d = r.json()
        rev = d["revenue"]
        summed = rev["online"]["total"] + rev["tpv"]["total"] + rev["b2b"]["total"]
        assert abs(rev["total"] - summed) < 0.02, f"total {rev['total']} != sum {summed}"

    def test_treasury_math(self, headers):
        r = requests.get(f"{BASE_URL}/api/executive/kpis?days=30", headers=headers, timeout=15)
        d = r.json()
        tr = d["treasury"]
        expected = tr["saldo_total"] + tr["pending_income"]["sum"] - tr["pending_expense"]["sum"]
        assert abs(tr["saldo_proyectado"] - expected) < 0.02, \
            f"saldo_proyectado {tr['saldo_proyectado']} != {expected}"

    def test_daily_stream_keys(self, headers):
        r = requests.get(f"{BASE_URL}/api/executive/kpis?days=7", headers=headers, timeout=15)
        d = r.json()
        for day in d["daily"]:
            for k in ["day", "online", "tpv", "b2b"]:
                assert k in day, f"daily item missing {k}"

    def test_kpis_unauthorized(self):
        r = requests.get(f"{BASE_URL}/api/executive/kpis?days=30", timeout=10)
        assert r.status_code in (401, 403), f"Expected 401/403 unauthenticated, got {r.status_code}"
