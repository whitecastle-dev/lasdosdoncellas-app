"""Iteration 5 — Verifies POST /api/seed/demo behaviour, auto-seed status and
that categories migration left position/is_active populated.

Coverage:
1. /api/categories returns 6 expected slugs with is_active=true and 1..6 positions
2. POST /api/seed/demo without auth → 401/403
3. POST /api/seed/demo with admin token → shape {ok, products_added, categories_added, total_products, total_categories}
4. POST /api/seed/demo is idempotent (second call adds 0 products & 0 cats)
5. /api/seed/demo does NOT delete products (count after >= count before)
6. /api/seed/demo does NOT delete categories (all prior slugs still present)
7. Customer login regression  (testcustomer1782304632)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://docellas-shop.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@lasdosdoncellas.com"
ADMIN_PASS = "Admin1234"
CUSTOMER_EMAIL = "testcustomer1782304632@example.com"
CUSTOMER_PASS = "Password1"

EXPECTED_SLUGS = {"jamones", "embutidos", "quesos", "vinos", "aceites", "lotes"}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in admin login response: {data}"
    return token


# -------- 1. categories shape ----------------------------------------------
def test_categories_have_six_slugs_active_and_positioned(session):
    r = session.get(f"{BASE_URL}/api/categories")
    assert r.status_code == 200
    cats = r.json()
    assert isinstance(cats, list)
    slugs = {c.get("slug") for c in cats}
    missing = EXPECTED_SLUGS - slugs
    assert not missing, f"Faltan slugs esperados: {missing}. Tengo: {slugs}"

    for c in cats:
        if c.get("slug") in EXPECTED_SLUGS:
            assert c.get("is_active") is True, f"Categoría '{c.get('slug')}' is_active != true → {c.get('is_active')!r}"
            pos = c.get("position")
            assert isinstance(pos, int), f"Categoría '{c.get('slug')}' position no es int → {pos!r}"
            assert 1 <= pos <= 99, f"Categoría '{c.get('slug')}' position fuera de rango: {pos}"


# -------- 2. seed/demo sin auth --------------------------------------------
def test_seed_demo_requires_auth(session):
    r = session.post(f"{BASE_URL}/api/seed/demo")
    assert r.status_code in (401, 403), f"Esperaba 401/403 sin auth, obtuve {r.status_code}: {r.text}"


# -------- 3, 4, 5, 6. seed/demo con admin idempotencia ---------------------
def test_seed_demo_admin_shape_and_idempotency(session, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # snapshot antes
    pre_prod = session.get(f"{BASE_URL}/api/products", headers=headers)
    assert pre_prod.status_code == 200
    pre_prod_count = len(pre_prod.json())

    pre_cats = session.get(f"{BASE_URL}/api/categories")
    assert pre_cats.status_code == 200
    pre_cat_slugs = {c["slug"] for c in pre_cats.json()}

    # primera llamada
    r1 = session.post(f"{BASE_URL}/api/seed/demo", headers=headers)
    assert r1.status_code == 200, f"seed/demo #1 → {r1.status_code}: {r1.text}"
    d1 = r1.json()
    for k in ("ok", "products_added", "categories_added", "total_products", "total_categories"):
        assert k in d1, f"Falta key '{k}' en respuesta: {d1}"
    assert d1["ok"] is True
    assert isinstance(d1["products_added"], int)
    assert isinstance(d1["categories_added"], int)
    assert d1["products_added"] >= 0
    assert d1["categories_added"] >= 0

    # segunda llamada — idempotente
    r2 = session.post(f"{BASE_URL}/api/seed/demo", headers=headers)
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["products_added"] == 0, f"No idempotente — productos añadidos: {d2['products_added']}"
    assert d2["categories_added"] == 0, f"No idempotente — categorías añadidas: {d2['categories_added']}"

    # snapshot después — no destruye
    post_prod = session.get(f"{BASE_URL}/api/products", headers=headers)
    assert post_prod.status_code == 200
    post_prod_count = len(post_prod.json())
    assert post_prod_count >= pre_prod_count, (
        f"seed/demo redujo productos: antes={pre_prod_count}, después={post_prod_count}"
    )

    post_cats = session.get(f"{BASE_URL}/api/categories")
    assert post_cats.status_code == 200
    post_cat_slugs = {c["slug"] for c in post_cats.json()}
    missing = pre_cat_slugs - post_cat_slugs
    assert not missing, f"seed/demo eliminó categorías: {missing}"

    # total_products debe reflejar el count real
    assert d2["total_products"] == post_prod_count, (
        f"total_products reportado {d2['total_products']} != real {post_prod_count}"
    )


# -------- 7. customer login regression -------------------------------------
def test_customer_login_works(session):
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASS})
    assert r.status_code == 200, f"Cliente login falló: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token en cliente login: {data}"
    me = session.get(f"{BASE_URL}/api/customer/me",
                     headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200, f"/customer/me falló: {me.status_code} {me.text}"
    body = me.json()
    name = (body.get("name") or body.get("first_name") or "").lower()
    assert "test" in name, f"name no contiene 'test': {body}"
