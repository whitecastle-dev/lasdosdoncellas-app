"""Phase 6 Inventory / Compras / Recepciones / Facturas Proveedor — end-to-end backend tests.

Covers the "engranaje" flow:
  - Locations CRUD
  - Purchase Orders CRUD + auto-number
  - stock-alert → PO conversion (ENGRANAJE 1)
  - Goods receipts + stock/avg-cost/invoice side-effects (ENGRANAJE 2)
  - FIFO consume from slicings (ENGRANAJE 3)
  - Valuation aggregation
  - Lots filters
  - Supplier invoices status/summary/paid transition
"""
import os
from pathlib import Path
import pytest
import requests


def _load_env():
    """Load REACT_APP_BACKEND_URL from /app/frontend/.env if not in env."""
    if os.environ.get("REACT_APP_BACKEND_URL"):
        return
    envf = Path("/app/frontend/.env")
    if envf.exists():
        for line in envf.read_text().splitlines():
            if line.strip().startswith("REACT_APP_BACKEND_URL="):
                os.environ["REACT_APP_BACKEND_URL"] = line.split("=", 1)[1].strip()
                return


_load_env()
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@lasdosdoncellas.com"
ADMIN_PASSWORD = "Admin1234"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def admin(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}",
                      "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def any_provider(admin):
    r = admin.get(f"{BASE_URL}/api/providers", timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert items, "No providers seeded"
    return items[0]


@pytest.fixture(scope="session")
def any_product(admin):
    r = admin.get(f"{BASE_URL}/api/products", timeout=20)
    assert r.status_code == 200
    items = r.json()
    # find inventory product with stock
    for p in items:
        if p.get("name") and "Loncheado" in p["name"]:
            return p
    return items[0]


# ---------- Anonymous 401 ----------
class TestAnonymous:
    def test_locations_anon_401(self):
        r = requests.get(f"{BASE_URL}/api/inventory/locations", timeout=10)
        assert r.status_code in (401, 403)

    def test_pos_anon_401(self):
        r = requests.get(f"{BASE_URL}/api/purchase-orders", timeout=10)
        assert r.status_code in (401, 403)

    def test_receipts_anon_401(self):
        r = requests.get(f"{BASE_URL}/api/goods-receipts", timeout=10)
        assert r.status_code in (401, 403)

    def test_supplier_invoices_anon_401(self):
        r = requests.get(f"{BASE_URL}/api/supplier-invoices", timeout=10)
        assert r.status_code in (401, 403)

    def test_valuation_anon_401(self):
        r = requests.get(f"{BASE_URL}/api/inventory/valuation", timeout=10)
        assert r.status_code in (401, 403)


# ---------- Locations CRUD ----------
class TestLocations:
    def test_locations_list(self, admin):
        r = admin.get(f"{BASE_URL}/api/inventory/locations")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_locations_crud_flow(self, admin):
        # CREATE
        payload = {"nombre": "TEST_Almacen_QA", "tipo": "almacen",
                   "temperatura": "ambiente", "direccion": "QA St 1", "activo": True}
        r = admin.post(f"{BASE_URL}/api/inventory/locations", json=payload)
        assert r.status_code == 200, r.text
        loc = r.json()
        assert loc["id"] and loc["nombre"] == "TEST_Almacen_QA"
        assert loc["tipo"] == "almacen"
        lid = loc["id"]

        # PATCH
        payload["nombre"] = "TEST_Almacen_QA_v2"
        payload["temperatura"] = "4°C"
        r = admin.patch(f"{BASE_URL}/api/inventory/locations/{lid}", json=payload)
        assert r.status_code == 200
        assert r.json()["nombre"] == "TEST_Almacen_QA_v2"
        assert r.json()["temperatura"] == "4°C"

        # LIST contains
        r = admin.get(f"{BASE_URL}/api/inventory/locations")
        assert any(x["id"] == lid for x in r.json())

        # DELETE
        r = admin.delete(f"{BASE_URL}/api/inventory/locations/{lid}")
        assert r.status_code == 200
        # gone
        r = admin.delete(f"{BASE_URL}/api/inventory/locations/{lid}")
        assert r.status_code == 404


# ---------- Purchase Orders ----------
class TestPurchaseOrders:
    def test_list_pos_seeded(self, admin):
        r = admin.get(f"{BASE_URL}/api/purchase-orders")
        assert r.status_code == 200
        pos = r.json()
        assert len(pos) >= 2, f"Expected at least 2 seeded POs, got {len(pos)}"
        numbers = [p["po_number"] for p in pos]
        assert any("PO-" in n for n in numbers)

    def test_create_po_invalid_provider(self, admin):
        r = admin.post(f"{BASE_URL}/api/purchase-orders",
                       json={"provider_id": "does-not-exist",
                             "items": [{"product_id": "x", "sku": "SKU", "name": "n",
                                        "qty": 1, "unit_cost": 1}]})
        assert r.status_code == 400

    def test_create_po_ok(self, admin, any_provider, any_product):
        payload = {
            "provider_id": any_provider["id"],
            "items": [{"product_id": any_product["id"],
                       "sku": any_product.get("sku", "SKU"),
                       "name": any_product["name"],
                       "qty": 2, "unit_cost": 10}],
            "notes": "TEST_ PO",
        }
        r = admin.post(f"{BASE_URL}/api/purchase-orders", json=payload)
        assert r.status_code == 200, r.text
        po = r.json()
        assert po["po_number"].startswith("PO-"), po["po_number"]
        assert po["status"] == "pending"
        assert po["subtotal"] == 20
        # GET
        r = admin.get(f"{BASE_URL}/api/purchase-orders/{po['id']}")
        assert r.status_code == 200
        assert r.json()["id"] == po["id"]


# ---------- ENGRANAJE 1: stock-alert → PO ----------
class TestAlertToPo:
    def test_convert_invalid_status_rejected(self, admin):
        # Find any alert NOT in approved/sent — must be rejected with 400.
        r = admin.get(f"{BASE_URL}/api/stock-alerts")
        if r.status_code != 200:
            pytest.skip("stock-alerts endpoint not exposed")
        alerts = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        target = next((a for a in alerts if a.get("status") not in ("approved", "sent")), None)
        if not target:
            pytest.skip("No stock-alert in non-approved status available")
        r = admin.post(f"{BASE_URL}/api/stock-alerts/{target['id']}/convert-to-po")
        assert r.status_code == 400, f"Expected 400 got {r.status_code} — {r.text}"

    def test_convert_not_found(self, admin):
        r = admin.post(f"{BASE_URL}/api/stock-alerts/does-not-exist/convert-to-po")
        assert r.status_code == 404


# ---------- ENGRANAJE 2: goods receipt ----------
class TestGoodsReceipt:
    def test_receipt_creates_lot_stock_invoice(self, admin, any_provider, any_product):
        # Snapshot product stock and average_cost
        pr = admin.get(f"{BASE_URL}/api/products/{any_product['id']}").json()
        old_stock = float(pr.get("stock") or 0)
        old_avg = float(pr.get("average_cost") or 0)

        payload = {
            "provider_id": any_provider["id"],
            "items": [{"product_id": any_product["id"],
                       "sku": any_product.get("sku", "SKU"),
                       "name": any_product["name"],
                       "qty_received": 5.0,
                       "unit_cost": 30.0,
                       "expires_at": "2027-01-01"}],
            "notes": "TEST_ receipt",
            "generate_invoice": True,
        }
        r = admin.post(f"{BASE_URL}/api/goods-receipts", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "receipt" in body and "invoice" in body
        rec = body["receipt"]; inv = body["invoice"]
        assert rec["receipt_number"].startswith("REC-")
        assert rec["total"] == 150.0
        # lot created
        assert rec["items"][0]["lot_id"]
        assert rec["items"][0]["lot_number"].startswith("LOT-")

        # Invoice
        assert inv is not None
        assert inv["invoice_number"].startswith("FAC-")
        assert inv["status"] == "pending_payment"
        assert inv["vat_pct"] == 10.0
        assert inv["vat_amount"] == 15.0
        assert inv["total"] == 165.0

        # product stock & average
        pr2 = admin.get(f"{BASE_URL}/api/products/{any_product['id']}").json()
        new_stock = float(pr2["stock"])
        assert round(new_stock, 4) == round(old_stock + 5.0, 4)
        # weighted avg
        expected_avg = ((old_stock * old_avg) + (5.0 * 30.0)) / new_stock if new_stock else 0
        assert abs(float(pr2["average_cost"]) - round(expected_avg, 4)) < 0.01
        assert float(pr2["last_cost"]) == 30.0

    def test_receipt_no_invoice_when_flag_false(self, admin, any_provider, any_product):
        payload = {
            "provider_id": any_provider["id"],
            "items": [{"product_id": any_product["id"],
                       "sku": any_product.get("sku", "SKU"),
                       "name": any_product["name"],
                       "qty_received": 1.0, "unit_cost": 10.0}],
            "generate_invoice": False,
        }
        r = admin.post(f"{BASE_URL}/api/goods-receipts", json=payload)
        assert r.status_code == 200
        assert r.json()["invoice"] is None


# ---------- Inventory Lots / Valuation ----------
class TestLotsValuation:
    def test_valuation_shape(self, admin):
        r = admin.get(f"{BASE_URL}/api/inventory/valuation")
        assert r.status_code == 200
        d = r.json()
        assert "rows" in d and "total_valor" in d
        assert isinstance(d["rows"], list)
        # sorted valor desc
        if len(d["rows"]) >= 2:
            assert d["rows"][0]["valor"] >= d["rows"][1]["valor"]

    def test_lots_list_and_expiring_filter(self, admin, any_product):
        r = admin.get(f"{BASE_URL}/api/inventory/lots",
                      params={"product_id": any_product["id"], "active_only": "true"})
        assert r.status_code == 200
        lots = r.json()
        assert isinstance(lots, list)
        # sort check
        if len(lots) >= 2:
            e1 = lots[0].get("expires_at") or ""
            e2 = lots[1].get("expires_at") or ""
            assert e1 <= e2

        # expiring filter
        r = admin.get(f"{BASE_URL}/api/inventory/lots",
                      params={"expiring_days": 30})
        assert r.status_code == 200


# ---------- Supplier Invoices ----------
class TestSupplierInvoices:
    def test_list_and_filter(self, admin):
        r = admin.get(f"{BASE_URL}/api/supplier-invoices")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

        r2 = admin.get(f"{BASE_URL}/api/supplier-invoices",
                       params={"status": "pending_payment"})
        assert r2.status_code == 200
        for inv in r2.json():
            assert inv["status"] == "pending_payment"

    def test_summary_shape(self, admin):
        r = admin.get(f"{BASE_URL}/api/supplier-invoices/summary")
        assert r.status_code == 200
        d = r.json()
        assert "overdue" in d
        for k in ("total", "count"):
            assert k in d["overdue"]

    def test_mark_paid(self, admin, any_provider, any_product):
        # Create a receipt with invoice
        r = admin.post(f"{BASE_URL}/api/goods-receipts", json={
            "provider_id": any_provider["id"],
            "items": [{"product_id": any_product["id"], "sku": "SKU",
                       "name": "TEST", "qty_received": 1.0, "unit_cost": 1.0}],
            "generate_invoice": True,
        })
        assert r.status_code == 200
        inv_id = r.json()["invoice"]["id"]
        # PATCH to paid
        r = admin.patch(f"{BASE_URL}/api/supplier-invoices/{inv_id}",
                        json={"status": "paid"})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "paid"
        assert d["paid_at"] is not None


# ---------- ENGRANAJE 3: FIFO consume via slicings ----------
class TestFifoSlicing:
    def test_slicing_with_inventory_link_consumes_fifo(self, admin, any_product):
        # Snapshot stock
        pr = admin.get(f"{BASE_URL}/api/products/{any_product['id']}").json()
        old_stock = float(pr.get("stock") or 0)
        if old_stock < 1.0:
            pytest.skip("Not enough stock for FIFO test")

        # Fetch required foreign keys from ERP
        cli = admin.get(f"{BASE_URL}/api/erp/clients").json()
        emp = admin.get(f"{BASE_URL}/api/erp/employees").json()
        prod = admin.get(f"{BASE_URL}/api/erp/products").json()
        if not (cli and emp and prod):
            pytest.skip("ERP seed missing")

        payload = {
            "cliente_id": cli[0]["id"],
            "empleado_id": emp[0]["id"],
            "producto_id": prod[0]["id"],
            "producto_inventario_id": any_product["id"],
            "peso_bruto": 1.0,
            "peso_loncheado": 0.9,
            "precio_cliente": 20.0,
            "coste": 0,
            "observaciones": "TEST_ FIFO consume",
        }
        r = admin.post(f"{BASE_URL}/api/erp/slicings", json=payload)
        assert r.status_code == 200, r.text
        sl = r.json()
        assert sl.get("stock_consumed") is not None
        sc = sl["stock_consumed"]
        assert "lots" in sc or "error" in sc, sc
        if "lots" in sc:
            assert sc["consumed_total"] <= 1.0 + 1e-6
            if sc.get("consumed_total", 0) > 0:
                pr2 = admin.get(f"{BASE_URL}/api/products/{any_product['id']}").json()
                new_stock = float(pr2["stock"])
                assert new_stock <= old_stock, f"Stock did not decrease: old={old_stock} new={new_stock}"
                # coste auto-set if lots contributed cost
                total_cost = sum((l.get("qty_consumed") or 0) * (l.get("unit_cost") or 0)
                                 for l in sc["lots"])
                if total_cost > 0:
                    assert sl.get("coste", 0) > 0, "coste should be auto-set from consumed lots"

        # cleanup
        admin.delete(f"{BASE_URL}/api/erp/slicings/{sl['id']}")

    def test_direct_consume_endpoint(self, admin, any_product):
        r = admin.get(f"{BASE_URL}/api/products/{any_product['id']}").json()
        stock = float(r.get("stock") or 0)
        if stock < 0.1:
            pytest.skip("No stock")
        r = admin.post(f"{BASE_URL}/api/inventory/consume",
                       json={"product_id": any_product["id"], "qty": 0.1,
                             "reference": "TEST_direct"})
        assert r.status_code == 200
        d = r.json()
        assert "consumed_total" in d and "unmet" in d and "lots" in d
