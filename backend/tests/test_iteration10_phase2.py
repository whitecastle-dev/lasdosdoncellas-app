"""Iteration 10 — Fase 2: variantes + atributos + related + pairing-cheeses."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://docellas-shop.preview.emergentagent.com").rstrip("/")
DEMO_PRODUCT_ID = "893b190e-b94b-4a26-be91-8f4969b197f3"
ADMIN_EMAIL = "admin@lasdosdoncellas.com"
ADMIN_PASSWORD = "Admin1234"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


# -------- Variantes / atributos del producto demo --------
def test_demo_product_has_variants():
    r = requests.get(f"{BASE_URL}/api/products/{DEMO_PRODUCT_ID}")
    assert r.status_code == 200, r.text
    d = r.json()
    assert "variants" in d, "campo variants ausente"
    variants = d["variants"]
    assert len(variants) >= 2, f"se esperaban >=2 variants, hay {len(variants)}"
    labels = [v["label"] for v in variants]
    assert "Pack 100g" in labels and "Pack 200g" in labels
    by_label = {v["label"]: v for v in variants}
    assert float(by_label["Pack 100g"]["price"]) == 4.5
    assert float(by_label["Pack 200g"]["price"]) == 8.5


def test_patch_variants_add_third_then_clear(admin_client):
    # GET full doc para reenviar como ProductIn
    r = admin_client.get(f"{BASE_URL}/api/products/{DEMO_PRODUCT_ID}")
    assert r.status_code == 200
    prod = r.json()
    orig_variants = prod["variants"]

    # 1) Añadir Pack 500g
    new_variants = list(orig_variants) + [{"label": "Pack 500g", "price": 18.0}]
    payload = _to_product_in(prod, variants=new_variants)
    rp = admin_client.patch(f"{BASE_URL}/api/products/{DEMO_PRODUCT_ID}", json=payload)
    assert rp.status_code == 200, rp.text
    # Verificar GET posterior
    g = requests.get(f"{BASE_URL}/api/products/{DEMO_PRODUCT_ID}").json()
    labels = [v["label"] for v in g["variants"]]
    assert "Pack 500g" in labels, f"Pack 500g no persistió. labels={labels}"
    p500 = next(v for v in g["variants"] if v["label"] == "Pack 500g")
    assert float(p500["price"]) == 18.0

    # 2) Limpiar variants → []
    payload2 = _to_product_in(prod, variants=[])
    rp2 = admin_client.patch(f"{BASE_URL}/api/products/{DEMO_PRODUCT_ID}", json=payload2)
    assert rp2.status_code == 200, rp2.text
    g2 = requests.get(f"{BASE_URL}/api/products/{DEMO_PRODUCT_ID}").json()
    assert g2["variants"] == [], f"variants debería estar vacío, hay {g2['variants']}"

    # 3) Restaurar las originales (Pack 100g + 200g)
    payload3 = _to_product_in(prod, variants=orig_variants)
    rp3 = admin_client.patch(f"{BASE_URL}/api/products/{DEMO_PRODUCT_ID}", json=payload3)
    assert rp3.status_code == 200
    g3 = requests.get(f"{BASE_URL}/api/products/{DEMO_PRODUCT_ID}").json()
    assert len(g3["variants"]) == len(orig_variants)


def test_patch_attributes_persist_and_clear(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/products/{DEMO_PRODUCT_ID}")
    prod = r.json()
    orig_attrs = prod.get("attributes") or {}

    new_attrs = {"denominacion_origen": "Payoyo", "milk_origin": "Oveja", "milk_type": "Cruda"}
    payload = _to_product_in(prod, attributes=new_attrs)
    rp = admin_client.patch(f"{BASE_URL}/api/products/{DEMO_PRODUCT_ID}", json=payload)
    assert rp.status_code == 200, rp.text
    g = requests.get(f"{BASE_URL}/api/products/{DEMO_PRODUCT_ID}").json()
    for k, v in new_attrs.items():
        assert g["attributes"].get(k) == v, f"attr {k} no persistió: {g['attributes']}"

    # Limpiar
    payload2 = _to_product_in(prod, attributes={})
    rp2 = admin_client.patch(f"{BASE_URL}/api/products/{DEMO_PRODUCT_ID}", json=payload2)
    assert rp2.status_code == 200
    g2 = requests.get(f"{BASE_URL}/api/products/{DEMO_PRODUCT_ID}").json()
    assert g2["attributes"] == {}, f"attributes debería estar vacío: {g2['attributes']}"

    # Restaurar
    payload3 = _to_product_in(prod, attributes=orig_attrs)
    admin_client.patch(f"{BASE_URL}/api/products/{DEMO_PRODUCT_ID}", json=payload3)


def test_related_endpoint():
    r = requests.get(f"{BASE_URL}/api/products/{DEMO_PRODUCT_ID}/related?limit=6")
    assert r.status_code == 200, r.text
    items = r.json()
    assert isinstance(items, list)
    ids = [p["id"] for p in items]
    assert DEMO_PRODUCT_ID not in ids, "el producto solicitado no debe aparecer"
    assert len(items) <= 6


def test_pairing_cheeses_empty_then_assigned(admin_client):
    # Producto demo no tiene paired_cheese_ids
    r = requests.get(f"{BASE_URL}/api/products/{DEMO_PRODUCT_ID}/pairing-cheeses")
    assert r.status_code == 200
    base = r.json()
    assert isinstance(base, list)

    # Buscar un queso real
    cats = requests.get(f"{BASE_URL}/api/categories").json()
    cheese_cat = next((c for c in cats if c.get("slug") == "quesos"), None)
    if not cheese_cat:
        pytest.skip("No hay categoría 'quesos' en la BD")
    prods = requests.get(f"{BASE_URL}/api/products?category_id={cheese_cat['id']}&limit=1").json()
    if not prods:
        pytest.skip("No hay quesos en la BD")
    cheese_id = prods[0]["id"]

    # Buscar un vino para asignarle ese queso como maridaje
    vino_cat = next((c for c in cats if c.get("slug") == "vinos"), None)
    if not vino_cat:
        pytest.skip("No hay categoría 'vinos'")
    vinos = requests.get(f"{BASE_URL}/api/products?category_id={vino_cat['id']}&limit=1").json()
    if not vinos:
        pytest.skip("No hay vinos")
    vino = requests.get(f"{BASE_URL}/api/products/{vinos[0]['id']}").json()

    orig_attrs = vino.get("attributes") or {}
    payload = _to_product_in(vino, attributes={**orig_attrs, "paired_cheese_ids": [cheese_id]})
    rp = admin_client.patch(f"{BASE_URL}/api/products/{vino['id']}", json=payload)
    assert rp.status_code == 200, rp.text

    r2 = requests.get(f"{BASE_URL}/api/products/{vino['id']}/pairing-cheeses")
    assert r2.status_code == 200
    cheeses = r2.json()
    assert any(c["id"] == cheese_id for c in cheeses), f"queso {cheese_id} no devuelto en pairing"

    # Restaurar
    admin_client.patch(f"{BASE_URL}/api/products/{vino['id']}", json=_to_product_in(vino, attributes=orig_attrs))


# -------- Helper --------
def _to_product_in(prod: dict, **overrides) -> dict:
    """Convierte un producto leído del backend en payload válido para PATCH (ProductIn)."""
    allowed = {
        "name", "sku", "description", "long_description", "price", "compare_at_price",
        "vat_rate", "category_id", "provider_id", "tags", "stock", "low_stock_threshold",
        "weight_grams", "origin", "curing_months", "breed", "feed", "images",
        "is_featured", "is_active", "variants", "attributes",
    }
    payload = {k: prod.get(k) for k in allowed if k in prod}
    # Required defaults
    payload.setdefault("tags", [])
    payload.setdefault("images", [])
    payload.setdefault("variants", [])
    payload.setdefault("attributes", {})
    payload.update(overrides)
    return payload
