"""CORS + Redsys regression tests (iteration 23)."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://docellas-shop.preview.emergentagent.com").rstrip("/")
# CORS tests must hit the app directly (K8s ingress rewrites CORS headers in preview).
LOCAL_URL = "http://127.0.0.1:8001"

# --- CORS preflight tests -------------------------------------------------

def _preflight(origin):
    return requests.options(
        f"{LOCAL_URL}/api/checkout/redsys",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
        timeout=15,
    )


@pytest.mark.parametrize("origin", [
    "https://lasdosdoncellas-web.onrender.com",
    "https://lasdosdoncellasibericos.es",
    "https://www.lasdosdoncellasibericos.es",
    "https://random-preview-abc.onrender.com",
    "https://foo.emergentagent.com",
    "http://localhost:3000",
])
def test_cors_allowed_origin(origin):
    r = _preflight(origin)
    assert r.status_code in (200, 204), f"status={r.status_code} for {origin}"
    aco = r.headers.get("access-control-allow-origin")
    assert aco == origin, f"expected {origin}, got {aco}"
    methods = r.headers.get("access-control-allow-methods", "")
    assert "POST" in methods or "*" in methods


def test_cors_rejects_malicious_origin():
    r = _preflight("https://malicious.example.com")
    aco = r.headers.get("access-control-allow-origin")
    assert aco != "https://malicious.example.com", f"malicious origin should NOT be echoed, got {aco}"


# --- Redsys regression ----------------------------------------------------

def _get_a_product_id():
    r = requests.get(f"{BASE_URL}/api/products", timeout=15)
    assert r.status_code == 200
    data = r.json()
    items = data if isinstance(data, list) else data.get("items") or data.get("products") or []
    assert items, "No products returned by /api/products"
    return items[0]["id"]


def test_checkout_redsys_regression():
    pid = _get_a_product_id()
    payload = {
        "items": [{"product_id": pid, "qty": 1}],
        "customer": {
            "name": "TEST User",
            "email": "test_iter23@example.com",
            "phone": "600000000",
            "address": "Calle Falsa 123",
            "city": "Madrid",
            "postal_code": "28001",
            "country": "España",
            "tax_id": "",
            "notes": "",
        },
        "origin_url": "https://lasdosdoncellas-web.onrender.com",
    }
    r = requests.post(f"{BASE_URL}/api/checkout/redsys", json=payload, timeout=20)
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:400]}"
    data = r.json()
    for k in ("Ds_MerchantParameters", "Ds_Signature", "endpoint", "order_number", "merchant_order"):
        assert k in data, f"Missing key {k} in response: {list(data.keys())}"
    assert data["endpoint"].startswith("http")


# --- Requirements sanity --------------------------------------------------

def test_requirements_no_emergentintegrations():
    path = "/app/backend/requirements.txt"
    with open(path) as f:
        content = f.read()
    assert "emergentintegrations" not in content.lower(), "requirements.txt must not contain emergentintegrations"
    assert "pycryptodome" in content.lower(), "requirements.txt must contain pycryptodome"
