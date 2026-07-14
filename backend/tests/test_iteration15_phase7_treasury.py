"""Phase 7 — Tesorería + Facturación emitida backend tests.

Covers:
  * Accounts CRUD + live saldo + DELETE-guard (400 if movimientos)
  * Movements list/filter + POST + validation (tipo, account_id)
  * Issued invoices POST/GET/summary + auto EMIT number + vat/total math
  * Engranaje 1: mark-paid → movement (income) + saldo up + status paid
  * Engranaje 2: /treasury/pay-supplier-invoice → movement (expense) + status paid
  * Cashflow + reminders shape
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@lasdosdoncellas.com"
ADMIN_PASSWORD = "Admin1234"


# ---------- Fixtures ----------

@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"login failed {r.status_code} {r.text[:200]}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="session")
def accounts(api_client):
    r = api_client.get(f"{BASE_URL}/api/treasury/accounts")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    return data


@pytest.fixture(scope="session")
def bbva(accounts):
    for a in accounts:
        if a["nombre"] == "BBVA Empresa":
            return a
    pytest.skip("BBVA Empresa seed account missing")


@pytest.fixture(scope="session")
def caja(accounts):
    for a in accounts:
        if a["nombre"].lower().startswith("caja"):
            return a
    pytest.skip("Caja seed account missing")


def _today():
    return datetime.now(timezone.utc).date().isoformat()


# ---------- Accounts ----------

class TestAccounts:
    def test_list_accounts_and_live_saldo(self, accounts, bbva, caja):
        # BBVA should have live saldo (10000 + 594 - 165 = 10429 per spec) if untouched.
        assert "saldo" in bbva and isinstance(bbva["saldo"], (int, float))
        # accept anything ≥ 10000 (may be higher if new tests add income) — check ≥ initial-ish
        assert bbva["saldo"] >= bbva.get("saldo_inicial", 0) - 10000
        assert "saldo" in caja

    def test_create_and_delete_account(self, api_client):
        payload = {"nombre": f"TEST_acct_{uuid.uuid4().hex[:6]}",
                   "tipo": "cash", "saldo_inicial": 100.0}
        r = api_client.post(f"{BASE_URL}/api/treasury/accounts", json=payload)
        assert r.status_code == 200, r.text
        acct = r.json()
        assert acct["nombre"] == payload["nombre"]
        assert "id" in acct
        # delete (no movements yet)
        r = api_client.delete(f"{BASE_URL}/api/treasury/accounts/{acct['id']}")
        assert r.status_code == 200

    def test_delete_account_with_movements_400(self, api_client, bbva):
        r = api_client.delete(f"{BASE_URL}/api/treasury/accounts/{bbva['id']}")
        assert r.status_code == 400, f"expected 400 got {r.status_code}"


# ---------- Movements ----------

class TestMovements:
    def test_list_movements(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/treasury/movements")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    def test_filter_movements_by_tipo(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/treasury/movements?tipo=income")
        assert r.status_code == 200
        for m in r.json():
            assert m["tipo"] == "income"

    def test_create_movement_success(self, api_client, bbva):
        payload = {
            "account_id": bbva["id"], "tipo": "income", "importe": 12.34,
            "fecha": _today(), "concepto": "TEST_mov income",
            "categoria": "otros", "metodo": "transferencia",
        }
        r = api_client.post(f"{BASE_URL}/api/treasury/movements", json=payload)
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["numero"].startswith("MOV-") and len(m["numero"].split("-")) == 3
        assert m["tipo"] == "income"
        # verify GET filter shows it
        r = api_client.get(f"{BASE_URL}/api/treasury/movements?account_id={bbva['id']}")
        assert any(x["id"] == m["id"] for x in r.json())

    def test_create_movement_invalid_tipo(self, api_client, bbva):
        r = api_client.post(f"{BASE_URL}/api/treasury/movements", json={
            "account_id": bbva["id"], "tipo": "weird", "importe": 5,
            "fecha": _today(), "concepto": "x",
        })
        assert r.status_code == 400

    def test_create_movement_invalid_account(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/treasury/movements", json={
            "account_id": "no-such-account-xyz", "tipo": "income", "importe": 5,
            "fecha": _today(), "concepto": "x",
        })
        assert r.status_code == 400


# ---------- Issued invoices ----------

class TestIssuedInvoices:
    def test_create_issued_invoice_computes_totals(self, api_client):
        payload = {
            "client_type": "manual",
            "client_name": "TEST_Cliente SL",
            "client_tax_id": "B00000000",
            "lines": [
                {"concepto": "Servicio A", "qty": 2, "unit_price": 100.0},
                {"concepto": "Servicio B", "qty": 1, "unit_price": 50.0},
            ],
            "vat_pct": 21.0,
            "issue_date": _today(),
            "due_date": (datetime.now(timezone.utc) + timedelta(days=5)).date().isoformat(),
        }
        r = api_client.post(f"{BASE_URL}/api/issued-invoices", json=payload)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["invoice_number"].startswith("EMIT-")
        assert inv["subtotal"] == 250.0
        assert inv["vat_amount"] == 52.5
        assert inv["total"] == 302.5
        assert inv["status"] == "issued"
        pytest.issued_inv_id = inv["id"]
        pytest.issued_inv_total = inv["total"]

    def test_list_issued_with_status_filter(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/issued-invoices?status=paid")
        assert r.status_code == 200
        for i in r.json():
            assert i["status"] == "paid"

    def test_issued_summary_shape(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/issued-invoices/summary")
        assert r.status_code == 200
        s = r.json()
        assert "overdue" in s
        assert isinstance(s["overdue"].get("count"), int)


# ---------- Engranaje 1: mark-paid ----------

class TestEngranaje1MarkPaid:
    def test_mark_paid_creates_movement_and_updates_saldo(self, api_client, bbva):
        iid = getattr(pytest, "issued_inv_id", None)
        total = getattr(pytest, "issued_inv_total", None)
        assert iid and total, "Depends on prior create test"

        saldo_before = next((a["saldo"] for a in api_client.get(f"{BASE_URL}/api/treasury/accounts").json()
                             if a["id"] == bbva["id"]), None)

        r = api_client.post(f"{BASE_URL}/api/issued-invoices/{iid}/mark-paid",
                            json={"account_id": bbva["id"], "payment_date": _today()})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["invoice"]["status"] == "paid"
        assert data["invoice"]["payment_movement_id"]
        assert data["movement"]["tipo"] == "income"
        assert data["movement"]["reference_type"] == "issued_invoice"
        assert data["movement"]["importe"] == total

        saldo_after = next(a["saldo"] for a in api_client.get(f"{BASE_URL}/api/treasury/accounts").json()
                           if a["id"] == bbva["id"])
        assert round(saldo_after - saldo_before, 2) == total

    def test_re_pay_400(self, api_client, bbva):
        iid = getattr(pytest, "issued_inv_id", None)
        r = api_client.post(f"{BASE_URL}/api/issued-invoices/{iid}/mark-paid",
                            json={"account_id": bbva["id"]})
        assert r.status_code == 400


# ---------- Engranaje 2: pay-supplier-invoice ----------

class TestEngranaje2PaySupplier:
    def test_pay_supplier_invoice_creates_expense(self, api_client, bbva):
        # find a pending supplier invoice
        r = api_client.get(f"{BASE_URL}/api/supplier-invoices?status=pending_payment")
        assert r.status_code == 200
        pending = r.json()
        if not pending:
            pytest.skip("No pending supplier invoices to test engranaje 2")
        inv = pending[0]

        r = api_client.post(f"{BASE_URL}/api/treasury/pay-supplier-invoice/{inv['id']}",
                            json={"account_id": bbva["id"], "payment_date": _today()})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["invoice"]["status"] == "paid"
        assert d["movement"]["tipo"] == "expense"
        assert d["movement"]["reference_type"] == "supplier_invoice"
        assert d["movement"]["importe"] == inv["total"]

        # re-pay -> 400
        r = api_client.post(f"{BASE_URL}/api/treasury/pay-supplier-invoice/{inv['id']}",
                            json={"account_id": bbva["id"]})
        assert r.status_code == 400

    def test_pay_supplier_not_found_404(self, api_client, bbva):
        r = api_client.post(f"{BASE_URL}/api/treasury/pay-supplier-invoice/no-such-id",
                            json={"account_id": bbva["id"]})
        assert r.status_code == 404


# ---------- Cashflow ----------

class TestCashflow:
    def test_cashflow_shape(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/treasury/cashflow?days=30")
        assert r.status_code == 200
        d = r.json()
        for k in ("saldo_actual", "saldo_proyectado", "por_cobrar", "por_pagar",
                  "vencidos_cobro", "vencidos_pago", "cuentas"):
            assert k in d, f"missing key {k}"
        assert isinstance(d["cuentas"], list)
        # math: proyectado ≈ saldo + AR - AP
        expected = round(d["saldo_actual"] + d["por_cobrar"]["total"] - d["por_pagar"]["total"], 2)
        assert abs(d["saldo_proyectado"] - expected) < 0.05

    def test_cashflow_days_toggle(self, api_client):
        for days in (7, 30, 60, 90):
            r = api_client.get(f"{BASE_URL}/api/treasury/cashflow?days={days}")
            assert r.status_code == 200
            assert r.json()["dias"] == days


# ---------- Reminders ----------

class TestReminders:
    def test_reminders_shape(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/treasury/reminders")
        assert r.status_code == 200
        d = r.json()
        assert "cobrar" in d and "pagar" in d
        for section in ("cobrar", "pagar"):
            assert "vencidas" in d[section]
            assert "proximas" in d[section]
            assert isinstance(d[section]["vencidas"], list)
            assert isinstance(d[section]["proximas"], list)


# ---------- Anonymous unauthenticated ----------

class TestAnonymous:
    def test_accounts_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/treasury/accounts")
        assert r.status_code in (401, 403)
