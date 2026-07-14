"""Phase 9 — Contabilidad analítica tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://docellas-shop.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@lasdosdoncellas.com"
ADMIN_PASSWORD = "Admin1234"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token") or r.json().get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ------ Chart of accounts

def test_accounts_seed(client):
    r = client.get(f"{BASE_URL}/api/accounting/accounts", timeout=15)
    assert r.status_code == 200, r.text
    accs = r.json()
    codes = [a["code"] for a in accs]
    expected = ["400", "430", "465", "472", "476", "477", "570", "572",
                "600", "621", "628", "629", "640", "642", "700"]
    for c in expected:
        assert c in codes, f"missing account {c}"
    # sorted
    assert codes == sorted(codes)
    for a in accs:
        assert "grupo" in a and "tipo" in a


# ------ Backfill + idempotency + balanced entries

def test_backfill_and_idempotency(client):
    r1 = client.post(f"{BASE_URL}/api/accounting/backfill", timeout=60)
    assert r1.status_code == 200, r1.text
    body1 = r1.json()
    assert "created" in body1 and "total_new_entries" in body1
    keys = {"tickets", "issued_invoices_issued", "issued_invoices_paid",
            "supplier_invoices_issued", "supplier_invoices_paid",
            "salaries_paid", "manual_movements"}
    assert keys.issubset(body1["created"].keys())

    # Second call must be idempotent
    r2 = client.post(f"{BASE_URL}/api/accounting/backfill", timeout=60)
    assert r2.status_code == 200
    body2 = r2.json()
    assert body2["total_new_entries"] == 0, f"non-idempotent: {body2}"


def test_all_entries_balanced(client):
    r = client.get(f"{BASE_URL}/api/accounting/journal?limit=1000", timeout=30)
    assert r.status_code == 200
    entries = r.json()
    assert isinstance(entries, list)
    assert len(entries) > 0, "no journal entries found — did backfill run?"
    for e in entries:
        d = round(sum(l.get("debit", 0) for l in e["lines"]), 2)
        c = round(sum(l.get("credit", 0) for l in e["lines"]), 2)
        assert abs(d - c) < 0.02, f"unbalanced entry {e['source_ref']}: D={d} H={c}"


# ------ Journal filters

def test_journal_filter_by_account(client):
    r = client.get(f"{BASE_URL}/api/accounting/journal?account_code=572", timeout=20)
    assert r.status_code == 200
    entries = r.json()
    for e in entries:
        codes = [l["account_code"] for l in e["lines"]]
        assert "572" in codes


# ------ Ledger

def test_ledger_572(client):
    r = client.get(f"{BASE_URL}/api/accounting/ledger/572", timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert "rows" in body and "saldo_final" in body and "account" in body
    # rolling saldo consistency
    saldo = 0
    for row in body["rows"]:
        saldo = round(saldo + row["debit"] - row["credit"], 2)
        assert abs(saldo - row["saldo"]) < 0.02
    assert abs(saldo - body["saldo_final"]) < 0.02


# ------ VAT report

def test_vat_report(client):
    r = client.get(f"{BASE_URL}/api/accounting/vat", timeout=20)
    assert r.status_code == 200
    body = r.json()
    for k in ("repercutido", "soportado", "liquidacion", "a_ingresar", "a_compensar"):
        assert k in body
    # sanity
    assert round(body["liquidacion"], 2) == round(body["repercutido"] - body["soportado"], 2)


# ------ PnL

def test_pnl(client):
    r = client.get(f"{BASE_URL}/api/accounting/pnl", timeout=20)
    assert r.status_code == 200
    body = r.json()
    for k in ("ingresos", "gastos", "total_ingresos", "total_gastos", "resultado"):
        assert k in body
    assert round(body["resultado"], 2) == round(body["total_ingresos"] - body["total_gastos"], 2)
    for i in body["ingresos"]:
        assert i["code"].startswith("7")
    for g in body["gastos"]:
        assert g["code"].startswith("6")


# ------ Analytical

def test_analytical(client):
    r = client.get(f"{BASE_URL}/api/accounting/analytical", timeout=30)
    assert r.status_code == 200
    body = r.json()
    for k in ("rows", "total_revenue", "total_cost", "total_margin"):
        assert k in body
    for row in body["rows"]:
        for k in ("product_id", "name", "qty", "revenue", "cost", "margin", "margin_pct"):
            assert k in row


# ------ Summary

def test_summary(client):
    r = client.get(f"{BASE_URL}/api/accounting/summary", timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert "entries" in body and body["entries"] > 0
