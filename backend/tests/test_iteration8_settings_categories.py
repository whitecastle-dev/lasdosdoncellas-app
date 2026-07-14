"""Iteration 8 — Settings (WhatsApp singleton) + 16 categorias definitivas."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://docellas-shop.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "admin@lasdosdoncellas.com"
ADMIN_PASS = "Admin1234"

EXPECTED_CATEGORIES = [
    ("jamones", "Jamones", 1, False),
    ("paletillas", "Paletillas", 2, False),
    ("quesos", "Quesos", 3, False),
    ("loncheados", "Loncheados", 4, False),
    ("embutidos", "Embutidos", 5, False),
    ("cortes", "Cortes", 6, False),
    ("aceites", "Aceites", 7, False),
    ("conservas", "Conservas", 8, False),
    ("aceitunas", "Aceitunas", 9, False),
    ("miel", "Miel", 10, False),
    ("sal", "Sal", 11, False),
    ("bebidas", "Bebidas", 12, False),
    ("vinos", "Vinos", 13, False),
    ("vino-granel", "Vino Granel", 14, False),
    ("bebidas-alcoholicas", "Bebidas Alcohólicas", 15, True),
    ("varios", "Varios", 16, False),
]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"Login admin fail: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"No token in response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# === Settings public ===
def test_settings_public_no_auth():
    r = requests.get(f"{BASE_URL}/api/settings/public", timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "whatsapp" in data
    wa = data["whatsapp"]
    for k in ("enabled", "phone", "default_message", "label"):
        assert k in wa, f"missing key {k} in {wa}"
    assert isinstance(wa["enabled"], bool)


# === Settings admin GET / PUT ===
def test_settings_get_requires_auth():
    r = requests.get(f"{BASE_URL}/api/settings", timeout=10)
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


def test_settings_get_with_admin(admin_headers):
    r = requests.get(f"{BASE_URL}/api/settings", headers=admin_headers, timeout=10)
    assert r.status_code == 200, r.text
    assert "whatsapp" in r.json()


def test_settings_put_updates_and_public_reflects(admin_headers):
    payload = {
        "whatsapp": {
            "enabled": True,
            "phone": "34666123456",
            "default_message": "Hola test",
            "label": "Chatea ahora",
        }
    }
    r = requests.put(f"{BASE_URL}/api/settings", headers=admin_headers, json=payload, timeout=10)
    assert r.status_code == 200, r.text
    saved = r.json()["whatsapp"]
    assert saved["enabled"] is True
    assert saved["phone"] == "34666123456"
    assert saved["label"] == "Chatea ahora"

    # Public refleja
    r2 = requests.get(f"{BASE_URL}/api/settings/public", timeout=10)
    assert r2.status_code == 200
    pub = r2.json()["whatsapp"]
    assert pub["enabled"] is True
    assert pub["phone"] == "34666123456"
    assert pub["default_message"] == "Hola test"
    assert pub["label"] == "Chatea ahora"


def test_settings_put_unauth():
    r = requests.put(
        f"{BASE_URL}/api/settings",
        json={"whatsapp": {"enabled": False, "phone": "", "default_message": "", "label": ""}},
        timeout=10,
    )
    assert r.status_code in (401, 403)


# === Categorias: 16 definitivas ===
def test_categories_contain_all_16():
    r = requests.get(f"{BASE_URL}/api/categories", timeout=10)
    assert r.status_code == 200, r.text
    cats = r.json()
    assert isinstance(cats, list), cats
    by_slug = {c.get("slug"): c for c in cats}
    missing = [s for s, _, _, _ in EXPECTED_CATEGORIES if s not in by_slug]
    assert not missing, f"missing slugs: {missing}. got: {list(by_slug.keys())}"

    for slug, name, pos, age in EXPECTED_CATEGORIES:
        c = by_slug[slug]
        assert c.get("name") == name, f"slug={slug} name expected {name!r}, got {c.get('name')!r}"
        assert c.get("position") == pos, f"slug={slug} position expected {pos}, got {c.get('position')}"
        assert c.get("is_active") is True, f"slug={slug} is_active expected True, got {c.get('is_active')}"
        if age:
            assert c.get("age_restricted") is True, f"slug={slug} age_restricted expected True, got {c.get('age_restricted')}"


def test_vinos_renamed_no_generosos():
    r = requests.get(f"{BASE_URL}/api/categories", timeout=10)
    assert r.status_code == 200
    cats = r.json()
    vinos = next((c for c in cats if c.get("slug") == "vinos"), None)
    assert vinos is not None
    assert vinos.get("name") == "Vinos"
    assert "Generosos" not in (vinos.get("name") or "")


# Hardened check (iter 9): exactamente 16 categorias ACTIVAS y legacy 'lotes' debe estar inactiva
def test_exactly_16_active_categories():
    r = requests.get(f"{BASE_URL}/api/categories", timeout=10)
    assert r.status_code == 200, r.text
    cats = r.json()
    active = [c for c in cats if c.get("is_active") is True]
    assert len(active) == 16, f"expected 16 active, got {len(active)}: {[c['slug'] for c in active]}"
    expected_slugs = {s for s, _, _, _ in EXPECTED_CATEGORIES}
    active_slugs = {c["slug"] for c in active}
    assert active_slugs == expected_slugs, f"active slugs diff: extra={active_slugs - expected_slugs}, missing={expected_slugs - active_slugs}"


def test_legacy_lotes_is_inactive():
    r = requests.get(f"{BASE_URL}/api/categories", timeout=10)
    assert r.status_code == 200
    cats = r.json()
    lotes = next((c for c in cats if c.get("slug") == "lotes"), None)
    # Either inactive or removed - both acceptable
    if lotes is not None:
        assert lotes.get("is_active") is False, f"legacy 'lotes' should be is_active=false, got {lotes}"
