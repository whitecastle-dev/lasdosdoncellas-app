"""Phase 8 — POS (TPV Tienda Física) + Distribución (Albaranes + Rutas).

Covers:
- POS: session open/close, ticket cobro engranaje (treasury movement + FIFO)
- Distribution: albaran create, deliver (FIFO), invoice engranaje (issued_invoice)
- Delivery routes: create + notes flip to en_ruta
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://docellas-shop.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@lasdosdoncellas.com"
ADMIN_PASSWORD = "Admin1234"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ----- Ensure a fresh state: close any open session before starting -----
@pytest.fixture(scope="session", autouse=True)
def _cleanup_open_session(h):
    r = requests.get(f"{BASE_URL}/api/pos/sessions/active", headers=h, timeout=30)
    if r.status_code == 200 and r.json() and r.json().get("id"):
        sid = r.json()["id"]
        requests.post(f"{BASE_URL}/api/pos/sessions/{sid}/close",
                      headers=h, json={"saldo_cierre_contado": 0}, timeout=30)
    yield


@pytest.fixture(scope="session")
def cash_account(h):
    r = requests.get(f"{BASE_URL}/api/treasury/accounts", headers=h, timeout=30)
    assert r.status_code == 200
    accts = r.json()
    caja = [a for a in accts if a.get("tipo") == "cash" and a.get("activo")]
    if caja:
        return caja[0]
    # fallback: any active
    act = [a for a in accts if a.get("activo")]
    assert act, "No active bank accounts"
    return act[0]


# ============ POS ============

class TestPos:
    _state = {}

    def test_01_open_session(self, h, cash_account):
        r = requests.post(f"{BASE_URL}/api/pos/sessions/open", headers=h, json={
            "account_id": cash_account["id"],
            "saldo_apertura": 50.0,
            "empleado_nombre": "TEST_pytest"
        }, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["estado"] == "abierta"
        assert d["saldo_apertura"] == 50.0
        assert d["numero"].startswith("SES-")
        TestPos._state["session"] = d

    def test_02_open_session_duplicate_fails(self, h, cash_account):
        r = requests.post(f"{BASE_URL}/api/pos/sessions/open", headers=h, json={
            "account_id": cash_account["id"], "saldo_apertura": 0
        }, timeout=30)
        assert r.status_code == 400

    def test_03_active_session_returns_open(self, h):
        r = requests.get(f"{BASE_URL}/api/pos/sessions/active", headers=h, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d.get("id") == TestPos._state["session"]["id"]

    def test_04_create_ticket_engranaje(self, h, cash_account):
        # Ticket with two items (no product_id, so no FIFO needed)
        payload = {
            "items": [
                {"product_id": None, "sku": "TEST-A", "name": "TEST_Item A", "qty": 2, "unit_price": 10.0},
                {"product_id": None, "sku": "TEST-B", "name": "TEST_Item B", "qty": 1, "unit_price": 5.0},
            ],
            "metodo_pago": "efectivo",
            "efectivo": 30.0,
            "tarjeta": 0.0,
            "vat_pct": 10.0,
        }
        r = requests.post(f"{BASE_URL}/api/pos/tickets", headers=h, json=payload, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        t = d["ticket"]
        m = d["movement"]
        # 25 subtotal + 10% vat = 27.50
        assert t["subtotal"] == 25.0
        assert t["vat_amount"] == 2.5
        assert t["total"] == 27.5
        assert t["cambio"] == 2.5
        assert t["numero"].startswith("TCK-")
        # ENGRANAJE
        assert m["tipo"] == "income"
        assert m["importe"] == 27.5
        assert m["reference_type"] == "pos_ticket"
        assert m["reference_id"] == t["id"]
        assert m["account_id"] == cash_account["id"]
        TestPos._state["ticket"] = t
        TestPos._state["movement"] = m

    def test_05_movement_persisted_in_treasury(self, h, cash_account):
        r = requests.get(f"{BASE_URL}/api/treasury/movements?account_id={cash_account['id']}",
                        headers=h, timeout=30)
        assert r.status_code == 200
        mid = TestPos._state["movement"]["id"]
        assert any(m["id"] == mid for m in r.json()), "Ticket movement missing"

    def test_06_ticket_in_list(self, h):
        r = requests.get(f"{BASE_URL}/api/pos/tickets", headers=h, timeout=30)
        assert r.status_code == 200
        tid = TestPos._state["ticket"]["id"]
        assert any(t["id"] == tid for t in r.json())

    def test_07_session_totals_updated(self, h):
        sid = TestPos._state["session"]["id"]
        r = requests.get(f"{BASE_URL}/api/pos/sessions", headers=h, timeout=30)
        assert r.status_code == 200
        s = next((x for x in r.json() if x["id"] == sid), None)
        assert s
        assert s["num_tickets"] >= 1
        assert s["total_ventas"] >= 27.5

    def test_08_close_session(self, h):
        sid = TestPos._state["session"]["id"]
        r = requests.post(f"{BASE_URL}/api/pos/sessions/{sid}/close", headers=h,
                         json={"saldo_cierre_contado": 77.5}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["estado"] == "cerrada"
        assert d["saldo_esperado"] == 77.5
        assert abs(d["diferencia"]) < 0.01

    def test_09_no_ticket_without_session(self, h):
        r = requests.post(f"{BASE_URL}/api/pos/tickets", headers=h, json={
            "items": [{"name": "x", "qty": 1, "unit_price": 1.0}],
            "vat_pct": 10.0
        }, timeout=30)
        assert r.status_code == 400


# ============ Distribution ============

class TestDistribution:
    _state = {}

    def test_10_create_delivery_note(self, h):
        r = requests.post(f"{BASE_URL}/api/delivery-notes", headers=h, json={
            "client_name": "TEST_Cliente Distribución",
            "client_address": "C/ Test 1",
            "fecha": "2026-01-15",
            "items": [
                {"product_id": None, "sku": "DN-A", "name": "TEST_Jamón bellota",
                 "qty": 2, "unit_price": 45.0}
            ],
            "notas": "TEST"
        }, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["estado"] == "pendiente"
        assert d["subtotal"] == 90.0
        assert d["numero"].startswith("ALB-")
        TestDistribution._state["note"] = d

    def test_11_list_delivery_notes(self, h):
        r = requests.get(f"{BASE_URL}/api/delivery-notes", headers=h, timeout=30)
        assert r.status_code == 200
        nid = TestDistribution._state["note"]["id"]
        assert any(n["id"] == nid for n in r.json())

    def test_12_deliver_action(self, h):
        nid = TestDistribution._state["note"]["id"]
        r = requests.post(f"{BASE_URL}/api/delivery-notes/{nid}/action",
                         headers=h, json={"action": "deliver"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["estado"] == "entregado"

    def test_13_invoice_action_engranaje(self, h):
        nid = TestDistribution._state["note"]["id"]
        r = requests.post(f"{BASE_URL}/api/delivery-notes/{nid}/action",
                         headers=h, json={"action": "invoice", "vat_pct": 10.0}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["estado"] == "facturado"
        assert d["invoice_id"]
        TestDistribution._state["invoice_id"] = d["invoice_id"]

    def test_14_issued_invoice_created(self, h):
        inv_id = TestDistribution._state["invoice_id"]
        r = requests.get(f"{BASE_URL}/api/issued-invoices", headers=h, timeout=30)
        assert r.status_code == 200
        inv = next((x for x in r.json() if x["id"] == inv_id), None)
        assert inv, "Issued invoice not created from albaran"
        assert "albarán" in (inv.get("notes") or "").lower() or "albaran" in (inv.get("notes") or "").lower()
        # Total = 90 + 9 = 99
        assert abs(inv["total"] - 99.0) < 0.01

    def test_15_action_invalid(self, h):
        nid = TestDistribution._state["note"]["id"]
        r = requests.post(f"{BASE_URL}/api/delivery-notes/{nid}/action",
                         headers=h, json={"action": "bogus"}, timeout=30)
        assert r.status_code == 400


class TestRoutes:
    _state = {}

    def test_16_create_pending_note_for_route(self, h):
        r = requests.post(f"{BASE_URL}/api/delivery-notes", headers=h, json={
            "client_name": "TEST_Cliente Ruta",
            "fecha": "2026-01-16",
            "items": [{"name": "TEST_Item R", "qty": 1, "unit_price": 20.0}],
        }, timeout=30)
        assert r.status_code == 200
        TestRoutes._state["note"] = r.json()

    def test_17_create_route(self, h):
        nid = TestRoutes._state["note"]["id"]
        r = requests.post(f"{BASE_URL}/api/delivery-routes", headers=h, json={
            "fecha": "2026-01-16",
            "repartidor_nombre": "TEST_Repartidor",
            "delivery_note_ids": [nid],
        }, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["numero"].startswith("RUT-")
        assert d["estado"] == "planificada"
        TestRoutes._state["route"] = d

    def test_18_note_flipped_to_en_ruta(self, h):
        nid = TestRoutes._state["note"]["id"]
        r = requests.get(f"{BASE_URL}/api/delivery-notes", headers=h, timeout=30)
        n = next((x for x in r.json() if x["id"] == nid), None)
        assert n
        assert n["estado"] == "en_ruta"
        assert n["route_id"] == TestRoutes._state["route"]["id"]

    def test_19_list_routes(self, h):
        r = requests.get(f"{BASE_URL}/api/delivery-routes", headers=h, timeout=30)
        assert r.status_code == 200
        rid = TestRoutes._state["route"]["id"]
        assert any(x["id"] == rid for x in r.json())


def test_20_anonymous_denied():
    r = requests.get(f"{BASE_URL}/api/pos/sessions", timeout=30)
    assert r.status_code in (401, 403)
