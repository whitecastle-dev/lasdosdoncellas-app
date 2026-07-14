"""
Iteration 7 — Tests for new GET /api/admin/freshness endpoint.
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://docellas-shop.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@lasdosdoncellas.com"
ADMIN_PASSWORD = "Admin1234"
ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"no token in login response: {list(data.keys())}"
    return token


class TestFreshnessEndpoint:
    def test_freshness_unauth_returns_401_or_403(self):
        r = requests.get(f"{BASE_URL}/api/admin/freshness", timeout=20)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}: {r.text[:200]}"

    def test_freshness_with_admin_returns_200_and_shape(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/freshness",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=20,
        )
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:300]}"
        data = r.json()
        # Shape
        assert "latest_change_at" in data, f"missing latest_change_at: {data}"
        assert "by_entity" in data, f"missing by_entity: {data}"
        assert "now" in data, f"missing now: {data}"
        # Types
        assert isinstance(data["by_entity"], dict)
        # `now` should be ISO
        assert ISO_RE.match(str(data["now"])), f"now is not ISO: {data['now']}"
        # latest_change_at can be ISO (must be, given DB has seeded data)
        assert data["latest_change_at"] is not None
        assert ISO_RE.match(str(data["latest_change_at"])), f"latest_change_at not ISO: {data['latest_change_at']}"
        # by_entity should contain products and/or categories
        be = data["by_entity"]
        # at least one of products/categories should be present and ISO
        assert any(k in be for k in ("products", "categories")), f"by_entity empty: {be}"
        for k, v in be.items():
            if v is not None:
                assert ISO_RE.match(str(v)), f"by_entity[{k}] not ISO: {v}"
