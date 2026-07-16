"""Tests para integración Redsys / CaixaBank TPV Virtual."""
import base64
import json
import os
import sys
import pytest
import requests

# Añadimos el path del backend para poder importar redsys.py
sys.path.insert(0, "/app/backend")
from redsys import (  # noqa: E402
    build_merchant_parameters,
    create_signature,
    verify_signature,
    decode_merchant_parameters,
)

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://docellas-shop.preview.emergentagent.com").rstrip("/")
SECRET = "sq7HjrUOBfKmC576ILgskD5srU870gJ7"
ADMIN_EMAIL = "admin@lasdosdoncellas.com"
ADMIN_PASSWORD = "Admin1234"


@pytest.fixture(scope="module")
def product_id():
    r = requests.get(f"{BASE_URL}/api/products?limit=1", timeout=15)
    r.raise_for_status()
    data = r.json()
    assert isinstance(data, list) and data, "No hay productos disponibles"
    return data[0]["id"]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=15)
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code}")
    body = r.json()
    return body.get("access_token") or body.get("token")


@pytest.fixture(scope="module")
def checkout_response(product_id):
    payload = {
        "items": [{"product_id": product_id, "qty": 1}],
        "customer": {
            "name": "TEST Cliente Redsys",
            "email": "test.redsys@example.com",
            "phone": "600111222",
            "address": "Calle Falsa 123",
            "city": "Sevilla",
            "postal_code": "41001",
            "country": "España",
            "tax_id": "",
            "notes": "",
        },
        "origin_url": BASE_URL,
    }
    r = requests.post(f"{BASE_URL}/api/checkout/redsys", json=payload, timeout=20)
    assert r.status_code == 200, f"checkout redsys failed: {r.status_code} {r.text}"
    return r.json()


# ---------- 1. Contract shape ----------
class TestCheckoutContract:
    def test_top_level_fields(self, checkout_response):
        r = checkout_response
        assert r["provider"] == "redsys"
        assert "sis-t.redsys.es" in r["endpoint"]
        assert r["Ds_SignatureVersion"] == "HMAC_SHA256_V1"
        assert r["Ds_MerchantParameters"] and isinstance(r["Ds_MerchantParameters"], str)
        assert r["Ds_Signature"].endswith("=") and len(r["Ds_Signature"]) == 44
        # order_number: 'P-YYYY-NNNNN'
        assert r["order_number"].startswith("P-")
        # merchant_order: dígitos, 12 chars
        assert len(r["merchant_order"]) == 12
        assert r["merchant_order"].isdigit()

    def test_merchant_parameters_content(self, checkout_response):
        params = decode_merchant_parameters(checkout_response["Ds_MerchantParameters"])
        assert params["Ds_Merchant_Order"] == checkout_response["merchant_order"]
        assert params["Ds_Merchant_MerchantCode"] == "367456167"
        assert params["Ds_Merchant_Terminal"] == "1"
        assert params["Ds_Merchant_Currency"] == "978"
        assert params["Ds_Merchant_TransactionType"] == "0"
        # amount son céntimos como string
        assert params["Ds_Merchant_Amount"].isdigit()
        assert int(params["Ds_Merchant_Amount"]) > 0
        assert "Ds_Merchant_UrlOK" in params
        assert "Ds_Merchant_UrlKO" in params
        assert "/api/payments/redsys/notify" in params["Ds_Merchant_MerchantURL"]

    def test_signature_is_valid_recompute(self, checkout_response):
        expected = create_signature(
            SECRET,
            checkout_response["Ds_MerchantParameters"],
            checkout_response["merchant_order"],
        )
        assert expected == checkout_response["Ds_Signature"]


# ---------- 2. Notification endpoint ----------
def _build_notification(merchant_order: str, ds_response: str = "0000",
                        auth_code: str = "123456"):
    payload = {
        "Ds_Order": merchant_order,
        "Ds_MerchantCode": "367456167",
        "Ds_Terminal": "1",
        "Ds_Currency": "978",
        "Ds_Response": ds_response,
        "Ds_AuthorisationCode": auth_code,
        "Ds_TransactionType": "0",
        "Ds_Amount": "100",
    }
    merchant_parameters = build_merchant_parameters(payload)
    signature = create_signature(SECRET, merchant_parameters, merchant_order)
    return merchant_parameters, signature


class TestNotify:
    def test_notify_valid_signature_paid(self, checkout_response):
        mo = checkout_response["merchant_order"]
        mp, sig = _build_notification(mo, "0000", "AUTH99")
        r = requests.post(
            f"{BASE_URL}/api/payments/redsys/notify",
            data={"Ds_MerchantParameters": mp, "Ds_Signature": sig,
                  "Ds_SignatureVersion": "HMAC_SHA256_V1"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        # Verifica persistencia via status endpoint
        s = requests.get(f"{BASE_URL}/api/checkout/redsys/status/{mo}", timeout=15).json()
        assert s["payment_status"] == "paid"
        assert s["status"] == "confirmed"
        assert s["ds_response"] == "0000"
        assert s["authorization_code"] == "AUTH99"

    def test_notify_bad_signature_rejected(self, product_id):
        # crea un pedido nuevo
        payload = {
            "items": [{"product_id": product_id, "qty": 1}],
            "customer": {"name": "TEST Bad Sig", "email": "bad@example.com",
                         "phone": "", "address": "x", "city": "x",
                         "postal_code": "00000", "country": "España"},
            "origin_url": BASE_URL,
        }
        co = requests.post(f"{BASE_URL}/api/checkout/redsys", json=payload, timeout=20).json()
        mo = co["merchant_order"]
        mp, _sig = _build_notification(mo, "0000")
        bad_sig = "A" * 43 + "="
        r = requests.post(
            f"{BASE_URL}/api/payments/redsys/notify",
            data={"Ds_MerchantParameters": mp, "Ds_Signature": bad_sig,
                  "Ds_SignatureVersion": "HMAC_SHA256_V1"},
            timeout=15,
        )
        assert r.status_code == 400
        # el pedido debe seguir pending
        s = requests.get(f"{BASE_URL}/api/checkout/redsys/status/{mo}", timeout=15).json()
        assert s["payment_status"] == "pending"
        assert s["status"] == "pending_payment"

    def test_notify_denied_response(self, product_id):
        payload = {
            "items": [{"product_id": product_id, "qty": 1}],
            "customer": {"name": "TEST Denied", "email": "denied@example.com",
                         "phone": "", "address": "x", "city": "x",
                         "postal_code": "00000", "country": "España"},
            "origin_url": BASE_URL,
        }
        co = requests.post(f"{BASE_URL}/api/checkout/redsys", json=payload, timeout=20).json()
        mo = co["merchant_order"]
        mp, sig = _build_notification(mo, "0180")
        r = requests.post(
            f"{BASE_URL}/api/payments/redsys/notify",
            data={"Ds_MerchantParameters": mp, "Ds_Signature": sig,
                  "Ds_SignatureVersion": "HMAC_SHA256_V1"},
            timeout=15,
        )
        assert r.status_code == 200
        s = requests.get(f"{BASE_URL}/api/checkout/redsys/status/{mo}", timeout=15).json()
        assert s["payment_status"] == "failed"
        assert s["status"] == "pending_payment"
        assert s["ds_response"] == "0180"


# ---------- 3. Order-by-merchant + Settings ----------
class TestExtra:
    def test_order_by_merchant(self, checkout_response):
        mo = checkout_response["merchant_order"]
        r = requests.get(f"{BASE_URL}/api/orders/by-merchant/{mo}", timeout=15)
        assert r.status_code == 200
        o = r.json()
        assert o["merchant_order"] == mo
        assert o["order_number"] == checkout_response["order_number"]
        assert o.get("payment_provider") == "redsys"

    def test_settings_contains_payment_meta(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/settings",
                         headers={"Authorization": f"Bearer {admin_token}"},
                         timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "payment" in data
        p = data["payment"]
        assert p["provider"] == "redsys"
        assert p["redsys_merchant_code"] == "367456167"
        assert p["redsys_terminal"] == "1"
        assert p["redsys_environment"] == "test"


# ---------- 4. Signature helpers unit test ----------
class TestSignatureMath:
    def test_verify_roundtrip(self):
        mo = "123456789012"
        params = {"Ds_Merchant_Order": mo, "Ds_Response": "0000"}
        mp = build_merchant_parameters(params)
        sig = create_signature(SECRET, mp, mo)
        assert verify_signature(SECRET, mp, mo, sig)

    def test_verify_reject_bad(self):
        mo = "123456789012"
        mp = build_merchant_parameters({"x": 1})
        assert not verify_signature(SECRET, mp, mo, "AAAA=")
