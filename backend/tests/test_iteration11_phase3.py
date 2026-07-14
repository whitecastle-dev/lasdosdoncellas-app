"""Iteration 11 — Phase 3 backend tests.

Tests:
- /api/business-customers full CRUD + validation
- /api/users/web/{id} and /api/users/web/by-email/{email}
- 401 on unauthenticated requests
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open(
    "/app/frontend/.env"
).read().split("REACT_APP_BACKEND_URL=")[1].splitlines()[0].strip()
BASE_URL = BASE_URL.rstrip("/")

ADMIN_EMAIL = "admin@lasdosdoncellas.com"
ADMIN_PASSWORD = "Admin1234"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"no token in response: {r.json()}"
    return tok


@pytest.fixture(scope="session")
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
    })
    return s


@pytest.fixture(scope="session")
def created_biz_ids():
    return []


# ---------- 1) Auth gating ----------
class TestAuthGate:
    def test_list_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/business-customers", timeout=10)
        assert r.status_code in (401, 403)

    def test_create_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/business-customers",
            json={
                "company_name": "X",
                "tax_id": "X00000000",
                "email": "x@x.com",
            },
            timeout=10,
        )
        assert r.status_code in (401, 403)

    def test_web_lookup_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/users/web/by-email/foo@bar.com", timeout=10)
        assert r.status_code in (401, 403)


# ---------- 2) Business customers CRUD ----------
class TestBusinessCustomerCRUD:
    def test_create_business_customer(self, admin_client, created_biz_ids):
        uniq = str(int(time.time()))[-6:] + uuid.uuid4().hex[:4]
        payload = {
            "company_name": f"TEST_Restaurante {uniq}",
            "tax_id": f"B{uniq}9",  # unique
            "contact_name": "Test Contact",
            "email": f"TEST_biz_{uniq}@example.com",
            "phone": "+34 600 111 222",
            "address": "Calle Falsa 123",
            "city": "Madrid",
            "postal_code": "28001",
            "country": "España",
            "discount_pct": 10.0,
            "payment_terms": "30 días",
            "credit_limit": 3000.0,
            "notes": "Cliente HORECA preferente",
            "tags": ["horeca", "premium"],
            "is_active": True,
        }
        r = admin_client.post(f"{BASE_URL}/api/business-customers", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["company_name"] == payload["company_name"]
        assert data["email"] == payload["email"].lower()
        assert data["tax_id"] == payload["tax_id"].upper()
        assert data["discount_pct"] == 10.0
        assert data["payment_terms"] == "30 días"
        assert data["credit_limit"] == 3000.0
        assert "id" in data
        created_biz_ids.append(data["id"])

    def test_list_and_filter(self, admin_client, created_biz_ids):
        assert created_biz_ids, "must run after create"
        r = admin_client.get(f"{BASE_URL}/api/business-customers")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert any(b["id"] == created_biz_ids[0] for b in items)

        r2 = admin_client.get(f"{BASE_URL}/api/business-customers?q=TEST_Restaurante")
        assert r2.status_code == 200
        items2 = r2.json()
        assert any(b["id"] == created_biz_ids[0] for b in items2)

    def test_get_one(self, admin_client, created_biz_ids):
        bid = created_biz_ids[0]
        r = admin_client.get(f"{BASE_URL}/api/business-customers/{bid}")
        assert r.status_code == 200
        assert r.json()["id"] == bid

    def test_get_one_404(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/business-customers/{uuid.uuid4()}")
        assert r.status_code == 404

    def test_patch_change_discount(self, admin_client, created_biz_ids):
        bid = created_biz_ids[0]
        # PATCH requires full payload (same model as POST)
        cur = admin_client.get(f"{BASE_URL}/api/business-customers/{bid}").json()
        cur["discount_pct"] = 20.0
        r = admin_client.patch(f"{BASE_URL}/api/business-customers/{bid}", json=cur)
        assert r.status_code == 200, r.text
        assert r.json()["discount_pct"] == 20.0

        # Verify persisted
        g = admin_client.get(f"{BASE_URL}/api/business-customers/{bid}").json()
        assert g["discount_pct"] == 20.0

    def test_duplicate_email_400(self, admin_client, created_biz_ids):
        bid = created_biz_ids[0]
        existing = admin_client.get(f"{BASE_URL}/api/business-customers/{bid}").json()
        uniq = uuid.uuid4().hex[:6]
        dup = {
            "company_name": f"TEST_Dup {uniq}",
            "tax_id": f"Z{uniq}",
            "email": existing["email"],  # same email
            "discount_pct": 0,
            "credit_limit": 0,
        }
        r = admin_client.post(f"{BASE_URL}/api/business-customers", json=dup)
        assert r.status_code == 400, r.text

    def test_duplicate_taxid_400(self, admin_client, created_biz_ids):
        bid = created_biz_ids[0]
        existing = admin_client.get(f"{BASE_URL}/api/business-customers/{bid}").json()
        uniq = uuid.uuid4().hex[:6]
        dup = {
            "company_name": f"TEST_Dup2 {uniq}",
            "tax_id": existing["tax_id"],  # same CIF
            "email": f"TEST_biz_dup_{uniq}@example.com",
            "discount_pct": 0,
            "credit_limit": 0,
        }
        r = admin_client.post(f"{BASE_URL}/api/business-customers", json=dup)
        assert r.status_code == 400, r.text

    def test_invalid_discount_400(self, admin_client):
        uniq = uuid.uuid4().hex[:6]
        bad = {
            "company_name": f"TEST_BadDisc {uniq}",
            "tax_id": f"BD{uniq}",
            "email": f"TEST_baddisc_{uniq}@example.com",
            "discount_pct": 150.0,  # > 100
            "credit_limit": 0,
        }
        r = admin_client.post(f"{BASE_URL}/api/business-customers", json=bad)
        assert r.status_code == 400

        bad["discount_pct"] = -5.0
        r2 = admin_client.post(f"{BASE_URL}/api/business-customers", json=bad)
        assert r2.status_code == 400

    def test_negative_credit_limit_400(self, admin_client):
        uniq = uuid.uuid4().hex[:6]
        bad = {
            "company_name": f"TEST_BadCred {uniq}",
            "tax_id": f"BC{uniq}",
            "email": f"TEST_badcred_{uniq}@example.com",
            "discount_pct": 0.0,
            "credit_limit": -100.0,
        }
        r = admin_client.post(f"{BASE_URL}/api/business-customers", json=bad)
        assert r.status_code == 400

    def test_delete_and_verify_removed(self, admin_client, created_biz_ids):
        bid = created_biz_ids[0]
        r = admin_client.delete(f"{BASE_URL}/api/business-customers/{bid}")
        assert r.status_code == 200
        g = admin_client.get(f"{BASE_URL}/api/business-customers/{bid}")
        assert g.status_code == 404


# ---------- 3) Web user lookups (for relational modals) ----------
class TestWebUserLookups:
    def test_lookup_by_email_404(self, admin_client):
        r = admin_client.get(
            f"{BASE_URL}/api/users/web/by-email/nonexistent_{uuid.uuid4().hex}@nope.com"
        )
        assert r.status_code == 404

    def test_lookup_by_id_404(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/users/web/{uuid.uuid4()}")
        assert r.status_code == 404

    def test_lookup_existing_customer(self, admin_client):
        # Try to find at least one web customer via the list endpoint
        listing = admin_client.get(f"{BASE_URL}/api/users/web")
        assert listing.status_code == 200
        customers = listing.json()
        if not customers:
            pytest.skip("No web customers seeded — skipping positive lookup")
        c0 = customers[0]
        cid = c0["id"]
        email = c0.get("email")

        rid = admin_client.get(f"{BASE_URL}/api/users/web/{cid}")
        assert rid.status_code == 200
        assert rid.json()["id"] == cid

        if email:
            rem = admin_client.get(f"{BASE_URL}/api/users/web/by-email/{email}")
            assert rem.status_code == 200
            assert rem.json()["id"] == cid


# ---------- 4) Regression smoke ----------
class TestRegressionSmoke:
    def test_dashboard_loads(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/dashboard")
        assert r.status_code == 200

    def test_products_list(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_categories_active_count(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/categories")
        assert r.status_code == 200
        cats = r.json()
        active = [c for c in cats if c.get("is_active", True)]
        # Phase 1 promised 16 active categories
        assert len(active) >= 16, f"expected >=16 active categories, got {len(active)}"

    def test_orders_list(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/orders")
        assert r.status_code == 200
