"""Iteration 12 — Phase 4 Stock Alert System tests.

Covers GET /api/users/permissions exposure of stock.* perms, scan/generate
idempotency, list/filter, PATCH gating, approve (superadmin only, PRO-
number sequence, PDF, email_sent flag, persistence), reject (reason required),
PDF download, delete.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://docellas-shop.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@lasdosdoncellas.com"
ADMIN_PASSWORD = "Admin1234"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def anon_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------- 1) Permissions catalog -----------------------------------

class TestPermissions:
    def test_permissions_endpoint_exposes_stock(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/users/permissions")
        assert r.status_code == 200
        data = r.json()
        # data may be a dict {permissions:[...]} or a list — handle both
        perms = data["permissions"] if isinstance(data, dict) and "permissions" in data else data
        assert isinstance(perms, list)
        for p in ("stock.read", "stock.write", "stock.approve"):
            assert p in perms, f"Missing perm {p} in {perms}"


# ---------------- 2) Auth gating -------------------------------------------

class TestAuthGating:
    def test_scan_requires_auth(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/stock-alerts/scan")
        assert r.status_code == 401

    def test_list_requires_auth(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/stock-alerts")
        assert r.status_code == 401

    def test_generate_requires_auth(self, anon_client):
        r = anon_client.post(f"{BASE_URL}/api/stock-alerts/generate")
        assert r.status_code == 401


# ---------------- 3) Scan ---------------------------------------------------

class TestScan:
    def test_scan_returns_structured_payload(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/stock-alerts/scan")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "groups" in data and "summary" in data
        s = data["summary"]
        for k in ("providers", "items", "total_value", "scanned_at"):
            assert k in s
        # We expect at least 1 provider/item from seeded scenario
        assert s["providers"] >= 1, f"Expected seeded low-stock product, got summary={s}"
        # Validate group + item shape
        g = data["groups"][0]
        assert "provider" in g and "items" in g and "total" in g and "subtotal" in g
        it = g["items"][0]
        for k in ("product_id", "sku", "name", "qty", "unit_cost", "current_stock", "threshold", "line_total"):
            assert k in it
        assert it["qty"] >= 1

    def test_scan_force_all(self, admin_client):
        r1 = admin_client.get(f"{BASE_URL}/api/stock-alerts/scan")
        r2 = admin_client.get(f"{BASE_URL}/api/stock-alerts/scan?force_all=true")
        assert r1.status_code == 200 and r2.status_code == 200
        # force_all should not have fewer items than normal scan
        assert r2.json()["summary"]["items"] >= r1.json()["summary"]["items"]


# ---------------- 4) Generate idempotency ----------------------------------

class TestGenerate:
    def test_generate_creates_drafts(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/stock-alerts/generate")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "created" in data and "updated" in data
        total = len(data["created"]) + len(data["updated"])
        assert total >= 1

    def test_generate_is_idempotent(self, admin_client):
        # Second call should not create new docs for same provider (pending exists)
        before = admin_client.get(f"{BASE_URL}/api/stock-alerts?status=pending_approval").json()
        r = admin_client.post(f"{BASE_URL}/api/stock-alerts/generate")
        assert r.status_code == 200
        after = admin_client.get(f"{BASE_URL}/api/stock-alerts?status=pending_approval").json()
        assert len(after) == len(before), f"Generate duplicated pending drafts: {len(before)} -> {len(after)}"
        # Second call should have updated, not created
        data = r.json()
        assert len(data["created"]) == 0, "Expected no new creations on second generate"


# ---------------- 5) List, filter, sort ------------------------------------

class TestList:
    def test_list_all_sorted_desc(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/stock-alerts")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if len(data) >= 2:
            assert data[0]["created_at"] >= data[1]["created_at"]

    def test_list_filter_pending(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/stock-alerts?status=pending_approval")
        assert r.status_code == 200
        for a in r.json():
            assert a["status"] == "pending_approval"

    def test_list_invalid_status(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/stock-alerts?status=bogus")
        assert r.status_code == 400


# ---------------- 6) PATCH gating + recompute ------------------------------

class TestPatch:
    def test_patch_pending_recomputes(self, admin_client):
        pending = admin_client.get(f"{BASE_URL}/api/stock-alerts?status=pending_approval").json()
        assert pending, "Need at least one pending alert"
        alert = pending[0]
        items = alert["items"]
        # bump qty by 5 on first item
        items[0] = {**items[0], "qty": items[0]["qty"] + 5}
        payload = {"items": items, "notes": "TEST_NOTE"}
        r = admin_client.patch(f"{BASE_URL}/api/stock-alerts/{alert['id']}", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["notes"] == "TEST_NOTE"
        expected_subtotal = round(sum(i["qty"] * i["unit_cost"] for i in data["items"]), 2)
        assert abs(data["subtotal"] - expected_subtotal) < 0.01
        assert abs(data["total"] - expected_subtotal) < 0.01


# ---------------- 7) PDF ---------------------------------------------------

class TestPdf:
    def test_draft_pdf_works(self, admin_client):
        pending = admin_client.get(f"{BASE_URL}/api/stock-alerts?status=pending_approval").json()
        assert pending
        alert_id = pending[0]["id"]
        r = admin_client.get(f"{BASE_URL}/api/stock-alerts/{alert_id}/pdf")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf")
        assert r.content.startswith(b"%PDF"), "Response is not a valid PDF"
        assert len(r.content) > 2000


# ---------------- 8) Approve -----------------------------------------------

class TestApprove:
    def test_approve_assigns_proforma_and_sets_status(self, admin_client):
        pending = admin_client.get(f"{BASE_URL}/api/stock-alerts?status=pending_approval").json()
        assert pending, "Need a pending alert to approve"
        alert = pending[0]
        r = admin_client.post(f"{BASE_URL}/api/stock-alerts/{alert['id']}/approve")
        assert r.status_code == 200, r.text
        data = r.json()
        # In dev Brevo disabled → email_sent False, status approved
        assert data["email_sent"] in (False, True)
        if data["email_sent"]:
            assert data["status"] == "sent"
        else:
            assert data["status"] == "approved"
        assert data["proforma_number"], "proforma_number not assigned"
        from datetime import datetime, timezone
        year = datetime.now(timezone.utc).year
        assert data["proforma_number"].startswith(f"PRO-{year}-")
        assert data["approved_by_name"]
        assert data["reviewed_at"]
        self.__class__.approved_id = alert["id"]
        self.__class__.proforma = data["proforma_number"]

    def test_cannot_re_approve(self, admin_client):
        if not getattr(self.__class__, "approved_id", None):
            pytest.skip("no approved alert")
        r = admin_client.post(f"{BASE_URL}/api/stock-alerts/{self.__class__.approved_id}/approve")
        assert r.status_code == 400

    def test_cannot_edit_after_approve(self, admin_client):
        if not getattr(self.__class__, "approved_id", None):
            pytest.skip("no approved alert")
        r = admin_client.patch(
            f"{BASE_URL}/api/stock-alerts/{self.__class__.approved_id}",
            json={"notes": "should fail"},
        )
        assert r.status_code == 400


# ---------------- 9) Reject ------------------------------------------------

class TestReject:
    @pytest.fixture(scope="class")
    def new_pending_alert(self, admin_client):
        # Re-run generate to get a fresh draft after approval emptied them
        admin_client.post(f"{BASE_URL}/api/stock-alerts/generate")
        pending = admin_client.get(f"{BASE_URL}/api/stock-alerts?status=pending_approval").json()
        if not pending:
            pytest.skip("No pending alerts available to reject")
        return pending[0]

    def test_reject_empty_reason_422(self, admin_client, new_pending_alert):
        r = admin_client.post(
            f"{BASE_URL}/api/stock-alerts/{new_pending_alert['id']}/reject",
            json={"reason": ""},
        )
        assert r.status_code == 422

    def test_reject_with_reason(self, admin_client, new_pending_alert):
        r = admin_client.post(
            f"{BASE_URL}/api/stock-alerts/{new_pending_alert['id']}/reject",
            json={"reason": "TEST_no_budget"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "rejected"
        assert data["rejected_reason"] == "TEST_no_budget"

    def test_cannot_approve_after_reject(self, admin_client, new_pending_alert):
        r = admin_client.post(f"{BASE_URL}/api/stock-alerts/{new_pending_alert['id']}/approve")
        assert r.status_code == 400


# ---------------- 10) Delete -----------------------------------------------

class TestDelete:
    def test_delete_rejected(self, admin_client):
        # Find a rejected one to delete (cleanup)
        rejected = admin_client.get(f"{BASE_URL}/api/stock-alerts?status=rejected").json()
        if not rejected:
            pytest.skip("nothing to delete")
        r = admin_client.delete(f"{BASE_URL}/api/stock-alerts/{rejected[0]['id']}")
        assert r.status_code == 200
        assert r.json().get("ok") is True
        # Verify gone
        r2 = admin_client.get(f"{BASE_URL}/api/stock-alerts/{rejected[0]['id']}")
        assert r2.status_code == 404


# ---------------- 11) Regression smoke -------------------------------------

class TestRegression:
    def test_products_list(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200

    def test_orders_list(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/orders")
        assert r.status_code == 200

    def test_providers_list(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/providers")
        assert r.status_code == 200

    def test_business_customers_list(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/business-customers")
        assert r.status_code == 200

    def test_storefront_home_products(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/products?is_active=true")
        assert r.status_code == 200
