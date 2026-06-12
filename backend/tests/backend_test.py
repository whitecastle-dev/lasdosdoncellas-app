"""Backend regression test suite for Las Dos Doncellas."""
import io
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://docellas-shop.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@lasdosdoncellas.com"
ADMIN_PASSWORD = "Admin1234"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and "user" in data
    return data["access_token"]


@pytest.fixture(scope="session")
def admin_user(admin_token):
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    return r.json()


@pytest.fixture
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


# ---------- Health ----------
def test_api_health():
    r = requests.get(f"{API}", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------- Auth ----------
class TestAuth:
    def test_login_success_sets_cookies_and_returns_token(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data.get("access_token"), str) and len(data["access_token"]) > 20
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"].get("is_superadmin") is True
        # cookies set
        cookie_names = {c.name for c in r.cookies}
        assert "access_token" in cookie_names
        assert "refresh_token" in cookie_names

    def test_login_invalid_credentials(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "WrongPass1"}, timeout=30)
        assert r.status_code == 401

    def test_me_with_bearer(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == ADMIN_EMAIL
        assert body.get("is_superadmin") is True
        assert "password_hash" not in body

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401


# ---------- Users ----------
class TestUsers:
    @pytest.fixture(scope="class")
    def created_user(self, request):
        # Manual session so we can clean up at end of class
        admin = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30).json()
        token = admin["access_token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        email = f"TEST_user_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/users", json={
            "email": email, "password": "GoodPass1", "name": "TEST User",
            "role": "manager", "permissions": ["dashboard.read", "products.read"], "is_active": True,
        }, headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        user = r.json()

        def cleanup():
            requests.delete(f"{API}/users/{user['id']}", headers=headers, timeout=30)
        request.addfinalizer(cleanup)
        return {"user": user, "headers": headers, "email": email}

    @pytest.mark.parametrize("bad_pwd", ["short", "alllowercase1", "ALLUPPER1", "NoNumber"])
    def test_create_user_rejects_weak_password(self, admin_client, bad_pwd):
        r = admin_client.post(f"{API}/users", json={
            "email": f"TEST_weak_{uuid.uuid4().hex[:6]}@example.com",
            "password": bad_pwd, "name": "Weak", "role": "manager", "permissions": []
        })
        assert r.status_code == 400, f"Password '{bad_pwd}' should be rejected, got {r.status_code}"

    def test_create_user_accepts_good_password(self, created_user):
        assert created_user["user"]["email"] == created_user["email"].lower()
        assert "password_hash" not in created_user["user"]
        assert created_user["user"]["role"] == "manager"

    def test_duplicate_email_returns_400(self, created_user):
        r = requests.post(f"{API}/users", json={
            "email": created_user["email"], "password": "GoodPass1", "name": "Dup",
            "role": "manager", "permissions": []
        }, headers=created_user["headers"], timeout=30)
        assert r.status_code == 400

    def test_patch_user_updates_fields(self, created_user):
        uid = created_user["user"]["id"]
        r = requests.patch(f"{API}/users/{uid}", json={
            "name": "TEST Updated", "role": "editor",
            "permissions": ["dashboard.read"], "is_active": True, "password": "NewPass1A"
        }, headers=created_user["headers"], timeout=30)
        assert r.status_code == 200
        upd = r.json()
        assert upd["name"] == "TEST Updated"
        assert upd["role"] == "editor"
        assert upd["permissions"] == ["dashboard.read"]
        # Verify new password works
        r2 = requests.post(f"{API}/auth/login", json={"email": created_user["email"], "password": "NewPass1A"}, timeout=30)
        assert r2.status_code == 200

    def test_delete_superadmin_rejected(self, admin_client, admin_user):
        r = admin_client.delete(f"{API}/users/{admin_user['id']}")
        assert r.status_code == 400

    def test_patch_superadmin_cannot_deactivate(self, admin_client, admin_user):
        r = admin_client.patch(f"{API}/users/{admin_user['id']}", json={"is_active": False})
        assert r.status_code == 400

    def test_delete_normal_user_works(self, admin_client):
        email = f"TEST_del_{uuid.uuid4().hex[:8]}@example.com"
        c = admin_client.post(f"{API}/users", json={
            "email": email, "password": "GoodPass1", "name": "ToDelete",
            "role": "manager", "permissions": []
        })
        assert c.status_code == 200
        uid = c.json()["id"]
        d = admin_client.delete(f"{API}/users/{uid}")
        assert d.status_code == 200
        # confirm gone via list
        lst = admin_client.get(f"{API}/users").json()
        assert all(u["id"] != uid for u in lst)

    def test_non_superadmin_without_users_read_gets_403(self, admin_client):
        email = f"TEST_noperm_{uuid.uuid4().hex[:8]}@example.com"
        c = admin_client.post(f"{API}/users", json={
            "email": email, "password": "GoodPass1", "name": "NoPerm",
            "role": "viewer", "permissions": ["dashboard.read"], "is_active": True
        })
        assert c.status_code == 200, c.text
        uid = c.json()["id"]
        try:
            login = requests.post(f"{API}/auth/login", json={"email": email, "password": "GoodPass1"}, timeout=30)
            assert login.status_code == 200
            tok = login.json()["access_token"]
            r = requests.get(f"{API}/users", headers={"Authorization": f"Bearer {tok}"}, timeout=30)
            assert r.status_code == 403
        finally:
            admin_client.delete(f"{API}/users/{uid}")


# ---------- Products ----------
class TestProducts:
    @pytest.fixture(scope="class")
    def product_ctx(self, request):
        token = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30).json()["access_token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        sku = f"TEST-SKU-{uuid.uuid4().hex[:8].upper()}"
        r = requests.post(f"{API}/products", json={
            "name": "TEST Producto Ibérico", "sku": sku, "description": "test",
            "price": 49.99, "vat_rate": 10, "stock": 20, "is_active": True
        }, headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        prod = r.json()

        def cleanup():
            requests.delete(f"{API}/products/{prod['id']}", headers=headers, timeout=30)
        request.addfinalizer(cleanup)
        return {"prod": prod, "headers": headers, "sku": sku, "token": token}

    def test_list_products_includes_seed(self):
        r = requests.get(f"{API}/products", timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) > 0
        assert "image_urls" in items[0]

    def test_create_product_returned(self, product_ctx):
        assert product_ctx["prod"]["sku"] == product_ctx["sku"]
        assert product_ctx["prod"]["price"] == 49.99

    def test_duplicate_sku_rejected(self, product_ctx):
        r = requests.post(f"{API}/products", json={
            "name": "Dup SKU", "sku": product_ctx["sku"], "price": 10, "vat_rate": 10, "stock": 1
        }, headers=product_ctx["headers"], timeout=30)
        assert r.status_code == 400

    def test_patch_product(self, product_ctx):
        pid = product_ctx["prod"]["id"]
        r = requests.patch(f"{API}/products/{pid}", json={
            "name": "TEST Patched", "sku": product_ctx["sku"], "price": 59.0, "vat_rate": 10, "stock": 30, "is_active": True
        }, headers=product_ctx["headers"], timeout=30)
        assert r.status_code == 200
        assert r.json()["price"] == 59.0
        # GET to verify persistence
        g = requests.get(f"{API}/products/{pid}", timeout=30)
        assert g.status_code == 200
        assert g.json()["name"] == "TEST Patched"
        assert "image_urls" in g.json()

    def test_categories_seeded(self):
        r = requests.get(f"{API}/categories", timeout=30)
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list) and len(cats) > 0

    def test_image_upload_no_enhance(self, product_ctx):
        pid = product_ctx["prod"]["id"]
        # 1x1 PNG bytes
        png = bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
            "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
        )
        files = {"file": ("test.png", io.BytesIO(png), "image/png")}
        data = {"enhance": "false"}
        r = requests.post(
            f"{API}/products/{pid}/images",
            headers={"Authorization": f"Bearer {product_ctx['token']}"},
            files=files, data=data, timeout=60,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("storage_path") and body.get("url", "").startswith("/api/files/")
        # Verify product has new image
        g = requests.get(f"{API}/products/{pid}", timeout=30).json()
        assert body["storage_path"] in g.get("images", [])

    def test_delete_product(self, admin_client):
        sku = f"TEST-DEL-{uuid.uuid4().hex[:6].upper()}"
        c = admin_client.post(f"{API}/products", json={
            "name": "ToDelete", "sku": sku, "price": 5, "vat_rate": 10, "stock": 1
        })
        assert c.status_code == 200
        pid = c.json()["id"]
        d = admin_client.delete(f"{API}/products/{pid}")
        assert d.status_code == 200
        g = requests.get(f"{API}/products/{pid}", timeout=30)
        assert g.status_code == 404


# ---------- Checkout / Orders ----------
class TestCheckoutAndOrders:
    @pytest.fixture(scope="class")
    def checkout_session(self):
        # Pick a seeded active product with stock > 0
        prods = requests.get(f"{API}/products", timeout=30).json()
        cand = next((p for p in prods if p.get("is_active") and p.get("stock", 0) > 0), None)
        assert cand, "No suitable seed product"

        payload = {
            "items": [{"product_id": cand["id"], "qty": 1}],
            "customer": {
                "name": "TEST Cliente", "email": "test_buyer@example.com", "phone": "600000000",
                "address": "C/ Falsa 123", "city": "Madrid", "postal_code": "28001",
                "country": "España", "tax_id": "", "notes": ""
            },
            "origin_url": "https://docellas-shop.preview.emergentagent.com"
        }
        r = requests.post(f"{API}/checkout/session", json=payload, timeout=60)
        assert r.status_code == 200, r.text
        return r.json(), cand

    def test_checkout_returns_url_and_session(self, checkout_session):
        data, _ = checkout_session
        assert data.get("url", "").startswith("http")
        assert data.get("session_id")
        assert data.get("order_number", "").startswith("P-")

    def test_empty_cart_400(self):
        r = requests.post(f"{API}/checkout/session", json={
            "items": [],
            "customer": {"name": "X", "email": "x@x.com", "address": "a", "city": "M", "postal_code": "1"},
            "origin_url": "https://x.example.com"
        }, timeout=30)
        assert r.status_code in (400, 422)

    def test_checkout_status_accessible(self, checkout_session):
        data, _ = checkout_session
        r = requests.get(f"{API}/checkout/status/{data['session_id']}", timeout=60)
        assert r.status_code == 200
        body = r.json()
        assert "status" in body and "payment_status" in body

    def test_orders_listed(self, admin_client, checkout_session):
        data, _ = checkout_session
        r = admin_client.get(f"{API}/orders")
        assert r.status_code == 200
        orders = r.json()
        assert any(o.get("order_number") == data["order_number"] for o in orders)

    def test_order_patch_status_and_invoice(self, admin_client, checkout_session):
        data, _ = checkout_session
        # find order
        orders = admin_client.get(f"{API}/orders").json()
        o = next(x for x in orders if x["order_number"] == data["order_number"])
        # patch status
        r = admin_client.patch(f"{API}/orders/{o['id']}/status", json={"status": "processing", "note": "test"})
        assert r.status_code == 200
        upd = r.json()
        assert upd["status"] == "processing"
        assert any(t["status"] == "processing" for t in upd.get("tracking", []))
        # invoice PDF
        r = admin_client.get(f"{API}/orders/{o['id']}/invoice")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"


# ---------- Dashboard ----------
def test_dashboard_metrics(admin_token):
    r = requests.get(f"{API}/dashboard", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert "totals" in body
    for key in ("orders", "products", "users", "revenue_total"):
        assert key in body["totals"]
    assert "daily_revenue" in body and "top_products" in body and "low_stock" in body
