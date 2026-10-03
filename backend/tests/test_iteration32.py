"""Iteration 32: Storefront /home aggregate, customer profile/addresses/payment-methods,
account deletion flow, checkout saved_payment_method, portal /health and whitelist.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://docellas-shop.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@lasdosdoncellas.com"
ADMIN_PASSWORD = "Admin1234"
CUST_EMAIL = "testcustomer1782304632@example.com"
CUST_PASSWORD = "Password1"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def customer_token():
    r = requests.post(f"{API}/auth/login", json={"email": CUST_EMAIL, "password": CUST_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture
def cust_headers(customer_token):
    return {"Authorization": f"Bearer {customer_token}"}


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- 1) Storefront /home ----------
class TestStorefrontHome:
    def test_home_aggregate(self):
        r = requests.get(f"{API}/storefront/home?per_category=6", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(["categories", "by_slug", "featured", "reviews"]).issubset(data.keys())
        cats = data["categories"]
        assert isinstance(cats, list)
        # Only active cats
        for c in cats:
            assert c.get("is_active") is not False
        # Ordered by position
        positions = [(c.get("position") if c.get("position") is not None else 999) for c in cats]
        assert positions == sorted(positions)
        # by_slug keyed by slug
        for c in cats:
            assert c["slug"] in data["by_slug"]
        # featured <= 6
        assert isinstance(data["featured"], list)
        assert len(data["featured"]) <= 6


# ---------- 2) Customer profile ----------
class TestCustomerProfile:
    def test_patch_me_persists(self, cust_headers):
        payload = {"name": "Ana María López", "phone": "600000001", "tax_id": "12345678Z"}
        r = requests.patch(f"{API}/customer/me", json=payload, headers=cust_headers, timeout=30)
        assert r.status_code == 200, r.text
        # Verify via /api/auth/me
        me = requests.get(f"{API}/auth/me", headers=cust_headers, timeout=30)
        assert me.status_code == 200, me.text
        data = me.json()
        assert data.get("first_name") == "Ana"
        assert data.get("last_name") == "María López"
        assert data.get("phone") == "600000001"
        assert data.get("tax_id") == "12345678Z"


# ---------- 3) Addresses ----------
class TestAddresses:
    def test_crud_address(self, cust_headers):
        addr_payload = {
            "label": "TEST_Casa",
            "full_name": "Ana López",
            "address": "C/ Test 1",
            "city": "Sevilla",
            "postal_code": "41001",
            "country": "España",
            "phone": "600000001",
            "tax_id": "12345678Z",
            "is_default_billing": True,
            "is_default_shipping": True,
        }
        r = requests.post(f"{API}/customer/addresses", json=addr_payload, headers=cust_headers, timeout=30)
        assert r.status_code == 200, r.text
        addr = r.json()
        aid = addr["id"]

        me = requests.get(f"{API}/auth/me", headers=cust_headers, timeout=30).json()
        assert any(a.get("id") == aid for a in (me.get("addresses") or []))

        # PATCH
        addr_payload["label"] = "TEST_Oficina"
        r = requests.patch(f"{API}/customer/addresses/{aid}", json=addr_payload, headers=cust_headers, timeout=30)
        assert r.status_code == 200, r.text
        me = requests.get(f"{API}/auth/me", headers=cust_headers, timeout=30).json()
        patched = next(a for a in me["addresses"] if a["id"] == aid)
        assert patched["label"] == "TEST_Oficina"

        # DELETE
        r = requests.delete(f"{API}/customer/addresses/{aid}", headers=cust_headers, timeout=30)
        assert r.status_code == 200, r.text
        me = requests.get(f"{API}/auth/me", headers=cust_headers, timeout=30).json()
        assert not any(a.get("id") == aid for a in (me.get("addresses") or []))


# ---------- 4) Payment methods ----------
class TestPaymentMethods:
    def test_payment_methods_crud(self, cust_headers):
        # Clean up any existing TEST payment methods first
        existing = requests.get(f"{API}/customer/payment-methods", headers=cust_headers, timeout=30).json()
        for m in existing:
            if (m.get("label") or "").startswith("TEST_"):
                requests.delete(f"{API}/customer/payment-methods/{m['id']}", headers=cust_headers, timeout=30)

        # Invalid last4 -> 422
        bad = {"brand": "visa", "last4": "abcd", "exp_month": 12, "exp_year": 2027, "holder": "Test", "label": "TEST_bad"}
        r = requests.post(f"{API}/customer/payment-methods", json=bad, headers=cust_headers, timeout=30)
        assert r.status_code == 422

        # Expired card -> 400
        expired = {"brand": "visa", "last4": "0003", "exp_month": 1, "exp_year": 2024, "holder": "Test", "label": "TEST_exp"}
        r = requests.post(f"{API}/customer/payment-methods", json=expired, headers=cust_headers, timeout=30)
        assert r.status_code == 400, r.text

        # First card default
        card1 = {"brand": "visa", "last4": "0003", "exp_month": 12, "exp_year": 2027, "holder": "TEST Holder1", "label": "TEST_c1", "is_default": True}
        r = requests.post(f"{API}/customer/payment-methods", json=card1, headers=cust_headers, timeout=30)
        assert r.status_code == 200, r.text
        pm1 = r.json()
        assert pm1["is_default"] is True
        assert pm1["brand"] == "visa"
        assert pm1["last4"] == "0003"

        # Second card default -> deselects first
        card2 = {"brand": "mastercard", "last4": "4444", "exp_month": 11, "exp_year": 2028, "holder": "TEST Holder2", "label": "TEST_c2", "is_default": True}
        r = requests.post(f"{API}/customer/payment-methods", json=card2, headers=cust_headers, timeout=30)
        assert r.status_code == 200, r.text
        pm2 = r.json()
        all_cards = requests.get(f"{API}/customer/payment-methods", headers=cust_headers, timeout=30).json()
        test_cards = [c for c in all_cards if (c.get("label") or "").startswith("TEST_")]
        defaults = [c for c in test_cards if c["is_default"]]
        assert len(defaults) == 1
        assert defaults[0]["id"] == pm2["id"]

        # PATCH set pm1 default
        r = requests.patch(f"{API}/customer/payment-methods/{pm1['id']}", json={"is_default": True}, headers=cust_headers, timeout=30)
        assert r.status_code == 200
        all_cards = requests.get(f"{API}/customer/payment-methods", headers=cust_headers, timeout=30).json()
        defaults = [c for c in all_cards if c["is_default"]]
        assert len(defaults) == 1 and defaults[0]["id"] == pm1["id"]

        # DELETE pm1 -> some remaining card becomes default (first in list)
        r = requests.delete(f"{API}/customer/payment-methods/{pm1['id']}", headers=cust_headers, timeout=30)
        assert r.status_code == 200
        all_cards = requests.get(f"{API}/customer/payment-methods", headers=cust_headers, timeout=30).json()
        assert any(c["is_default"] for c in all_cards), "At least one remaining card should be default"

        # Cleanup pm2
        requests.delete(f"{API}/customer/payment-methods/{pm2['id']}", headers=cust_headers, timeout=30)


# ---------- 5) Checkout saves user_id + payment_method ----------
class TestCheckoutRedsys:
    def test_checkout_saves_user_and_payment_method(self, cust_headers):
        # Ensure the test customer has at least one card
        cards = requests.get(f"{API}/customer/payment-methods", headers=cust_headers, timeout=30).json()
        if not cards:
            pytest.skip("Customer has no saved payment methods; skipping checkout test")
        pm = cards[0]

        # Need a product id — fetch one from storefront
        home = requests.get(f"{API}/storefront/home", timeout=30).json()
        prod = None
        if home.get("featured"):
            prod = home["featured"][0]
        if not prod:
            pytest.skip("No products available")

        me = requests.get(f"{API}/auth/me", headers=cust_headers, timeout=30).json()
        payload = {
            "items": [{"product_id": prod["id"], "qty": 1}],
            "customer": {"name": me.get("first_name", "Test") + " " + me.get("last_name", "User"),
                         "email": CUST_EMAIL.upper(),  # Uppercase to check normalization
                         "phone": "600000001",
                         "address": "C/ Test 1",
                         "city": "Sevilla",
                         "postal_code": "41001"},
            "origin_url": BASE_URL,
            "payment_method_id": pm["id"],
        }
        r = requests.post(f"{API}/checkout/redsys", json=payload, headers=cust_headers, timeout=30)
        assert r.status_code == 200, r.text
        resp = r.json()
        order_number = resp.get("order_number")
        assert order_number
        # Fetch via /api/auth/orders — email was uppercase, should still match
        orders = requests.get(f"{API}/auth/orders", headers=cust_headers, timeout=30).json()
        matched = [o for o in orders if o.get("order_number") == order_number]
        assert len(matched) == 1, f"Order not found via /auth/orders for order_number={order_number}"
        order = matched[0]
        assert order.get("user_id") == me["id"]
        spm = order.get("saved_payment_method") or {}
        assert spm.get("brand") == pm["brand"]
        assert spm.get("last4") == pm["last4"]
        # Email stored lowercase
        assert (order.get("customer") or {}).get("email", "").islower()


# ---------- 6) Account deletion / reactivation ----------
class TestAccountDeletion:
    @pytest.fixture(scope="class")
    def throwaway_user(self):
        """Create a disposable user via /api/auth/register (verified via Mongo)."""
        from pymongo import MongoClient
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "lasdosdoncellas")
        email = f"test_del_{uuid.uuid4().hex[:8]}@example.com"
        password = "Password1"
        reg = requests.post(f"{API}/auth/register", json={
            "first_name": "Test", "last_name": "Delete",
            "email": email, "password": password,
        }, timeout=30)
        assert reg.status_code in (200, 201), reg.text
        # Mark verified in DB
        client = MongoClient(mongo_url)
        client[db_name].users.update_one({"email": email}, {"$set": {"is_verified": True}})
        client.close()
        yield {"email": email, "password": password}
        # Cleanup: hard delete via Mongo
        client = MongoClient(mongo_url)
        client[db_name].users.delete_one({"email": email})
        client.close()

    def test_delete_and_reactivate(self, throwaway_user):
        login = requests.post(f"{API}/auth/login", json=throwaway_user, timeout=30)
        assert login.status_code == 200, login.text
        tok = login.json()["access_token"]
        H = {"Authorization": f"Bearer {tok}"}

        # Wrong password -> 400
        r = requests.post(f"{API}/customer/account/delete", json={"password": "wrong"}, headers=H, timeout=30)
        assert r.status_code == 400

        # Correct password -> 200
        r = requests.post(f"{API}/customer/account/delete", json={"password": throwaway_user["password"]}, headers=H, timeout=30)
        assert r.status_code == 200, r.text
        due = r.json().get("deletion_due_at")
        assert due
        from datetime import datetime, timezone
        due_dt = datetime.fromisoformat(due.replace("Z", "+00:00"))
        delta_days = (due_dt - datetime.now(timezone.utc)).days
        assert 28 <= delta_days <= 31

        # Re-login reactivates
        login2 = requests.post(f"{API}/auth/login", json=throwaway_user, timeout=30)
        assert login2.status_code == 200, login2.text
        assert login2.json().get("reactivated") is True
        tok2 = login2.json()["access_token"]
        H2 = {"Authorization": f"Bearer {tok2}"}
        me = requests.get(f"{API}/auth/me", headers=H2, timeout=30).json()
        assert me.get("pending_deletion") in (False, None)

        # Explicit cancel-deletion also works
        r = requests.post(f"{API}/customer/account/cancel-deletion", json={}, headers=H2, timeout=30)
        assert r.status_code == 200


# ---------- 7) Portal /health + whitelist ----------
class TestPortalProxy:
    def test_portal_health_service_role(self, admin_headers):
        r = requests.get(f"{API}/portal/health", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("configured") is True
        assert data.get("role") == "service_role"
        assert data.get("ok") is True

    @pytest.mark.parametrize("table", [
        "tienda_productos", "v_inventario_valorado", "epelsa_tickets",
        "historico_cambios_pvp", "pedidos", "clientes_b2b",
        "distribucion_facturas_borrador", "caja_diaria", "ventas",
        "pagos_facturas_compra",
    ])
    def test_whitelisted_tables(self, admin_headers, table):
        r = requests.get(f"{API}/portal/rows/{table}?select=id&limit=1", headers=admin_headers, timeout=30)
        assert r.status_code == 200, f"{table}: {r.status_code} {r.text[:200]}"

    def test_non_whitelisted_table(self, admin_headers):
        r = requests.get(f"{API}/portal/rows/compras?select=id&limit=1", headers=admin_headers, timeout=30)
        assert r.status_code == 404
