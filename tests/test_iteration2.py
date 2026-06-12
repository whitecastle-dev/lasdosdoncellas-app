"""Iteration 2 backend regression suite.

Covers:
- Customer accounts (register/login/me/profile/addresses/orders)
- Providers CRUD + stats + email (graceful no-op)
- Products provider_id linkage
- Excel template / export / import
- Invoice PDF with logo + Castilblanco fiscal data
- Email no-op on order pay / status change (BREVO_API_KEY empty)
- Backward compat (admin login, products, orders, dashboard)
"""
import io
import os
import uuid
import pytest
import requests
from openpyxl import Workbook, load_workbook

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://docellas-shop.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@lasdosdoncellas.com"
ADMIN_PASSWORD = "Admin1234"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def customer_ctx():
    email = f"test_customer_{uuid.uuid4().hex[:8]}@example.com"
    password = "GoodPass1"
    r = requests.post(f"{API}/customer/register", json={
        "email": email, "password": password, "name": "TEST Cliente", "phone": "+34 600 111 222"
    }, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    return {"email": email, "password": password, "token": body["access_token"], "customer": body["customer"]}


@pytest.fixture
def customer_headers(customer_ctx):
    return {"Authorization": f"Bearer {customer_ctx['token']}", "Content-Type": "application/json"}


# ============================================================
# CUSTOMER ACCOUNTS
# ============================================================
class TestCustomerAuth:
    def test_register_returns_token_and_cookie(self, customer_ctx):
        assert customer_ctx["token"] and len(customer_ctx["token"]) > 20
        assert customer_ctx["customer"]["email"] == customer_ctx["email"].lower()
        assert "password_hash" not in customer_ctx["customer"]

    def test_register_sets_httponly_cookie(self):
        email = f"test_cookie_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{API}/customer/register", json={
            "email": email, "password": "GoodPass1", "name": "Cookie Test"
        }, timeout=30)
        assert r.status_code == 200
        assert "customer_token" in {c.name for c in r.cookies}

    @pytest.mark.parametrize("bad", ["short", "lowercase1", "NOLOWER1", "NoNumber"])
    def test_register_rejects_weak_passwords(self, bad):
        email = f"weak_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{API}/customer/register", json={
            "email": email, "password": bad, "name": "weak"
        }, timeout=30)
        assert r.status_code == 400, f"password {bad!r} should be rejected, got {r.status_code}"

    def test_register_rejects_duplicate_email(self, customer_ctx):
        r = requests.post(f"{API}/customer/register", json={
            "email": customer_ctx["email"], "password": "GoodPass1", "name": "dup"
        }, timeout=30)
        assert r.status_code == 400

    def test_login_success(self, customer_ctx):
        r = requests.post(f"{API}/customer/login", json={
            "email": customer_ctx["email"], "password": customer_ctx["password"]
        }, timeout=30)
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_login_invalid(self, customer_ctx):
        r = requests.post(f"{API}/customer/login", json={
            "email": customer_ctx["email"], "password": "WrongPass1"
        }, timeout=30)
        assert r.status_code == 401

    def test_me_with_bearer(self, customer_headers, customer_ctx):
        r = requests.get(f"{API}/customer/me", headers=customer_headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == customer_ctx["email"].lower()
        assert "password_hash" not in body

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/customer/me", timeout=15)
        assert r.status_code == 401

    def test_patch_profile(self, customer_headers):
        r = requests.patch(f"{API}/customer/me", json={
            "name": "TEST Cliente Updated", "phone": "+34 611 222 333", "tax_id": "12345678Z"
        }, headers=customer_headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["name"] == "TEST Cliente Updated"
        assert body["phone"] == "+34 611 222 333"
        assert body["tax_id"] == "12345678Z"


class TestCustomerAddresses:
    def test_first_address_auto_default(self, customer_headers):
        r = requests.post(f"{API}/customer/addresses", json={
            "label": "Casa", "full_name": "TEST Cliente", "address": "C/ Falsa 1",
            "city": "Madrid", "postal_code": "28001", "country": "España"
        }, headers=customer_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["is_default_billing"] is True
        assert body["is_default_shipping"] is True
        assert body["id"]

    def test_subsequent_default_clears_previous(self, customer_headers):
        r = requests.post(f"{API}/customer/addresses", json={
            "label": "Oficina", "full_name": "TEST Cliente", "address": "Gran Vía 10",
            "city": "Madrid", "postal_code": "28013", "country": "España",
            "is_default_billing": True, "is_default_shipping": True
        }, headers=customer_headers, timeout=30)
        assert r.status_code == 200
        new_id = r.json()["id"]
        # Fetch list and ensure only the new one is default
        lst = requests.get(f"{API}/customer/addresses", headers=customer_headers, timeout=30).json()
        defaults_b = [a for a in lst if a.get("is_default_billing")]
        defaults_s = [a for a in lst if a.get("is_default_shipping")]
        assert len(defaults_b) == 1 and defaults_b[0]["id"] == new_id
        assert len(defaults_s) == 1 and defaults_s[0]["id"] == new_id

    def test_patch_address(self, customer_headers):
        lst = requests.get(f"{API}/customer/addresses", headers=customer_headers, timeout=30).json()
        aid = lst[0]["id"]
        r = requests.patch(f"{API}/customer/addresses/{aid}", json={
            "label": "Editada", "full_name": "TEST Cliente", "address": "C/ Nueva 5",
            "city": "Sevilla", "postal_code": "41001", "country": "España"
        }, headers=customer_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["label"] == "Editada"
        # verify persistence
        lst2 = requests.get(f"{API}/customer/addresses", headers=customer_headers, timeout=30).json()
        found = next(a for a in lst2 if a["id"] == aid)
        assert found["city"] == "Sevilla"

    def test_delete_address(self, customer_headers):
        lst = requests.get(f"{API}/customer/addresses", headers=customer_headers, timeout=30).json()
        aid = lst[-1]["id"]
        r = requests.delete(f"{API}/customer/addresses/{aid}", headers=customer_headers, timeout=30)
        assert r.status_code == 200
        lst2 = requests.get(f"{API}/customer/addresses", headers=customer_headers, timeout=30).json()
        assert all(a["id"] != aid for a in lst2)

    def test_my_orders_returns_list(self, customer_headers):
        r = requests.get(f"{API}/customer/orders", headers=customer_headers, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ============================================================
# PROVIDERS
# ============================================================
class TestProviders:
    @pytest.fixture(scope="class")
    def provider(self, request):
        tok = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30).json()["access_token"]
        h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
        email = f"test_provider_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/providers", json={
            "name": "TEST Proveedor", "company": "TEST SL", "email": email,
            "phone": "+34 600 000 000", "city": "Sevilla", "tax_id": "B12345678",
            "tags": ["jamón"], "is_active": True
        }, headers=h, timeout=30)
        assert r.status_code == 200, r.text
        p = r.json()

        def cleanup():
            requests.delete(f"{API}/providers/{p['id']}", headers=h, timeout=30)
        request.addfinalizer(cleanup)
        return {"prov": p, "headers": h, "email": email, "token": tok}

    def test_create_provider(self, provider):
        assert provider["prov"]["email"] == provider["email"]
        assert provider["prov"]["id"]

    def test_duplicate_email_rejected(self, provider):
        r = requests.post(f"{API}/providers", json={
            "name": "Dup", "email": provider["email"]
        }, headers=provider["headers"], timeout=30)
        assert r.status_code == 400

    def test_patch_provider(self, provider):
        pid = provider["prov"]["id"]
        r = requests.patch(f"{API}/providers/{pid}", json={
            "name": "TEST Updated", "email": provider["email"],
            "phone": "+34 611 000 000", "is_active": True
        }, headers=provider["headers"], timeout=30)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST Updated"

    def test_provider_stats(self, provider):
        pid = provider["prov"]["id"]
        r = requests.get(f"{API}/providers/{pid}/stats", headers=provider["headers"], timeout=30)
        assert r.status_code == 200
        body = r.json()
        for k in ("products_count", "revenue", "units_sold", "orders_count", "top_products"):
            assert k in body
        assert isinstance(body["top_products"], list)

    def test_provider_email_noop_when_brevo_disabled(self, provider):
        pid = provider["prov"]["id"]
        r = requests.post(f"{API}/providers/{pid}/email", json={
            "subject": "Hola", "body": "Mensaje de prueba"
        }, headers=provider["headers"], timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("sent") is False
        assert body.get("reason") == "email_disabled"

    def test_delete_blocked_when_product_references(self, provider):
        # Create a product referencing this provider, then delete attempt should fail
        sku = f"TEST-PROV-{uuid.uuid4().hex[:6].upper()}"
        cp = requests.post(f"{API}/products", json={
            "name": "TEST ProvProduct", "sku": sku, "price": 10, "vat_rate": 10,
            "stock": 1, "is_active": True, "provider_id": provider["prov"]["id"]
        }, headers=provider["headers"], timeout=30)
        assert cp.status_code == 200, cp.text
        pid_prod = cp.json()["id"]
        try:
            d = requests.delete(f"{API}/providers/{provider['prov']['id']}", headers=provider["headers"], timeout=30)
            assert d.status_code == 400
        finally:
            requests.delete(f"{API}/products/{pid_prod}", headers=provider["headers"], timeout=30)

    def test_delete_fresh_provider_succeeds(self, admin_client):
        email = f"test_provdel_{uuid.uuid4().hex[:8]}@example.com"
        c = admin_client.post(f"{API}/providers", json={"name": "ToDelete", "email": email})
        assert c.status_code == 200
        pid = c.json()["id"]
        d = admin_client.delete(f"{API}/providers/{pid}")
        assert d.status_code == 200


# ============================================================
# PRODUCTS WITH PROVIDER_ID
# ============================================================
class TestProductProviderLink:
    def test_create_product_with_provider_id(self, admin_client):
        # First create a provider
        email = f"test_pp_{uuid.uuid4().hex[:8]}@example.com"
        pv = admin_client.post(f"{API}/providers", json={"name": "PP Prov", "email": email})
        assert pv.status_code == 200
        prov_id = pv.json()["id"]
        try:
            sku = f"TEST-LINK-{uuid.uuid4().hex[:6].upper()}"
            r = admin_client.post(f"{API}/products", json={
                "name": "TEST LinkedProd", "sku": sku, "price": 20, "vat_rate": 10,
                "stock": 5, "is_active": True, "provider_id": prov_id
            })
            assert r.status_code == 200, r.text
            pid = r.json()["id"]
            assert r.json().get("provider_id") == prov_id
            # appears in list with provider_id
            g = requests.get(f"{API}/products/{pid}", timeout=30).json()
            assert g.get("provider_id") == prov_id
            # PATCH provider_id to None
            up = admin_client.patch(f"{API}/products/{pid}", json={
                "name": "TEST LinkedProd", "sku": sku, "price": 20, "vat_rate": 10,
                "stock": 5, "is_active": True, "provider_id": None
            })
            assert up.status_code == 200
            assert up.json().get("provider_id") is None
            admin_client.delete(f"{API}/products/{pid}")
        finally:
            admin_client.delete(f"{API}/providers/{prov_id}")


# ============================================================
# EXCEL
# ============================================================
class TestExcel:
    def test_template_returns_xlsx(self, admin_client):
        r = admin_client.get(f"{API}/excel/orders/template")
        assert r.status_code == 200
        assert "spreadsheetml.sheet" in r.headers.get("content-type", "")
        # XLSX is a ZIP, starts with PK
        assert r.content[:2] == b"PK"

    def test_export_all_orders(self, admin_client):
        r = admin_client.post(f"{API}/excel/orders/export", json={})
        # If there are no orders we'd get 404. Seed should usually have at least the one created in iteration1.
        # Accept either 200 with xlsx or 404 (no orders).
        assert r.status_code in (200, 404), r.text
        if r.status_code == 200:
            assert r.content[:2] == b"PK"

    def test_export_subset_with_unknown_id_404(self, admin_client):
        r = admin_client.post(f"{API}/excel/orders/export", json={"order_ids": ["nonexistent-id-xxx"]})
        assert r.status_code == 404

    def test_import_orders_from_generated_xlsx(self, admin_client):
        # Build a minimal XLSX with one order row, using a real seeded SKU if available
        prods = requests.get(f"{API}/products", timeout=30).json()
        sku = next((p["sku"] for p in prods if p.get("is_active")), None)
        assert sku, "Need at least one active seeded product"

        wb = Workbook()
        ws = wb.active
        ws.title = "Pedidos"
        headers = [
            "Nº Pedido", "Nº Factura", "Fecha", "Cliente", "Email", "Teléfono",
            "NIF/CIF", "Dirección", "CP", "Ciudad", "País",
            "Productos (SKU x cantidad; …)", "Subtotal", "IVA", "Total",
            "Estado", "Estado pago", "Notas",
        ]
        ws.append(headers)
        order_number = f"TEST-IMP-{uuid.uuid4().hex[:8].upper()}"
        ws.append([
            order_number, "F-TEST-1", "2026-01-15", "TEST Importado",
            "import@example.com", "600", "12345678A", "C/ Imp 1", "41230",
            "Castilblanco", "España", f"{sku} x 2", 20.0, 2.0, 22.0,
            "paid", "paid", "via import",
        ])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)

        files = {"file": ("orders.xlsx", buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        tok = admin_client.headers.get("Authorization")
        r = requests.post(f"{API}/excel/orders/import",
                         headers={"Authorization": tok},
                         files=files, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "imported" in body and "updated" in body and "errors" in body
        assert (body["imported"] + body["updated"]) >= 1
        assert body["errors"] == [] or len(body["errors"]) < 1, f"errors: {body['errors']}"

        # Verify items were resolved from SKU
        orders = admin_client.get(f"{API}/orders").json()
        imported_order = next((o for o in orders if o.get("order_number") == order_number), None)
        assert imported_order, "Imported order not found in /api/orders"
        assert imported_order["items"]
        assert imported_order["items"][0]["sku"] == sku
        assert imported_order["items"][0]["product_id"] is not None
        # Cleanup
        # No direct delete endpoint for orders — leave it. (out of scope)


# ============================================================
# INVOICE PDF WITH LOGO + FISCAL DATA
# ============================================================
class TestInvoice:
    def test_invoice_pdf_returned(self, admin_client):
        orders = admin_client.get(f"{API}/orders").json()
        if not orders:
            pytest.skip("No orders to test invoice")
        oid = orders[0]["id"]
        r = admin_client.get(f"{API}/orders/{oid}/invoice")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 1500  # has logo + content


# ============================================================
# EMAIL NO-OP BEHAVIOUR (BREVO empty)
# ============================================================
class TestEmailNoop:
    def test_status_update_does_not_raise_when_brevo_disabled(self, admin_client):
        orders = admin_client.get(f"{API}/orders").json()
        if not orders:
            pytest.skip("No orders to test status update")
        # Pick the first non-cancelled order
        o = next((x for x in orders if x.get("status") not in ("cancelled", "refunded")), orders[0])
        original = o["status"]
        target = "processing" if original != "processing" else "shipped"
        r = admin_client.patch(f"{API}/orders/{o['id']}/status", json={"status": target, "note": "noop email test"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == target
        # Restore
        admin_client.patch(f"{API}/orders/{o['id']}/status", json={"status": original, "note": "restore"})


# ============================================================
# BACKWARD COMPAT
# ============================================================
class TestBackwardCompat:
    def test_admin_login_still_works(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        assert r.status_code == 200

    def test_products_list(self):
        r = requests.get(f"{API}/products", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_orders_list(self, admin_client):
        r = admin_client.get(f"{API}/orders")
        assert r.status_code == 200

    def test_dashboard(self, admin_token):
        r = requests.get(f"{API}/dashboard", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200
        assert "totals" in r.json()
