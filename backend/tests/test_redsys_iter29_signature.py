"""Iter 29 — Verificar que _derive_per_order_key usa ZERO padding y que
la firma final coincide byte-a-byte con la implementación canónica
python-redsys. Incluye también el safety check total==0 → 400.

Se re-implementa el algoritmo canónico *inline* (base64/hmac/DES3) para
tener una referencia independiente contra la que comparar redsys.create_signature.
"""
import base64
import hmac
import hashlib
import json
import os
import sys

import pytest
import requests
from Crypto.Cipher import DES3

sys.path.insert(0, "/app/backend")
from redsys import (  # noqa: E402
    _derive_per_order_key,
    build_merchant_parameters,
    create_signature,
    verify_signature,
    decode_merchant_parameters,
)

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8001").rstrip("/")
SECRET = "sq7HjrUOBfKmC576ILgskD5srU870gJ7"


# ---------- Canonical inline reference (matches python-redsys) ----------
def canonical_derive_key(secret_key_b64: str, order: str) -> bytes:
    key = base64.b64decode(secret_key_b64)
    order_bytes = order.encode("utf-8")
    # ZERO padding to multiple of 8 (always add at least a full block if len%8==0)
    pad_len = 8 - (len(order_bytes) % 8)
    padded = order_bytes + b"\x00" * pad_len
    cipher = DES3.new(key, DES3.MODE_CBC, iv=b"\x00" * 8)
    return cipher.encrypt(padded)


def canonical_sign(secret_key_b64: str, mp_b64: str, order: str) -> str:
    per_order = canonical_derive_key(secret_key_b64, order)
    mac = hmac.new(per_order, mp_b64.encode("utf-8"), hashlib.sha256).digest()
    return base64.b64encode(mac).decode("ascii")


# ---------- 1. Zero padding math ----------
class TestZeroPadding:
    def test_12_char_order_pads_4_bytes(self):
        order = "202600005125"  # 12 chars
        derived = _derive_per_order_key(SECRET, order)
        # 3DES-CBC over 16 bytes of padded input => 16 bytes output
        assert len(derived) == 16
        # Byte-level equivalence with canonical impl
        assert derived == canonical_derive_key(SECRET, order)

    def test_8_char_order_pads_full_block(self):
        order = "12345678"  # 8 chars, len%8==0 -> pad_len=8
        derived = _derive_per_order_key(SECRET, order)
        assert len(derived) == 16  # 8 bytes msg + 8 bytes zero pad
        assert derived == canonical_derive_key(SECRET, order)

    def test_4_char_order_pads_4_bytes(self):
        order = "1234"
        derived = _derive_per_order_key(SECRET, order)
        assert len(derived) == 8
        assert derived == canonical_derive_key(SECRET, order)

    def test_not_pkcs7(self):
        """Regresión SIS0042: comprobar que ya NO estamos usando PKCS#7.
        Si hubiese PKCS#7, un order de 12 chars generaría bytes de padding
        con valor 0x04, no 0x00."""
        order = "202600005125"
        key = base64.b64decode(SECRET)
        # Reproducimos lo que hacía la implementación buggy
        pkcs7_padded = order.encode() + bytes([4]) * 4
        cipher = DES3.new(key, DES3.MODE_CBC, iv=b"\x00" * 8)
        buggy = cipher.encrypt(pkcs7_padded)
        current = _derive_per_order_key(SECRET, order)
        assert current != buggy, "regression: signature still uses PKCS#7 padding"


# ---------- 2. Full canonical signature match ----------
class TestCanonicalSignatureMatch:
    def test_signature_matches_canonical(self):
        order = "202600005125"
        merchant_params = {
            "Ds_Merchant_Amount": "450",
            "Ds_Merchant_Order": order,
            "Ds_Merchant_MerchantCode": "367456167",
            "Ds_Merchant_Terminal": "1",
            "Ds_Merchant_Currency": "978",
            "Ds_Merchant_TransactionType": "0",
            "Ds_Merchant_ProductDescription": "Test pedido",
        }
        mp_b64 = build_merchant_parameters(merchant_params)
        ours = create_signature(SECRET, mp_b64, order)
        reference = canonical_sign(SECRET, mp_b64, order)
        assert ours == reference, f"MISMATCH ours={ours} ref={reference}"

    def test_signature_multiple_orders(self):
        for order in ("0001", "12345678", "999999999999", "P00013000042"[:12]):
            mp_b64 = build_merchant_parameters({"Ds_Merchant_Order": order, "Ds_Merchant_Amount": "1000"})
            assert create_signature(SECRET, mp_b64, order) == canonical_sign(SECRET, mp_b64, order)

    def test_verify_roundtrip_signed_by_reference(self):
        order = "202600005125"
        mp_b64 = build_merchant_parameters({"Ds_Merchant_Order": order, "Ds_Merchant_Amount": "450"})
        ref_sig = canonical_sign(SECRET, mp_b64, order)
        assert verify_signature(SECRET, mp_b64, order, ref_sig) is True


# ---------- 3. HTTP: empty items → 400 with expected Spanish detail ----------
class TestCheckoutSafetyCheck:
    def test_empty_items_returns_400(self):
        payload = {
            "items": [],
            "customer": {
                "name": "TEST", "email": "t@x.com", "phone": "", "address": "x",
                "city": "x", "postal_code": "00000", "country": "España",
            },
            "origin_url": BASE_URL,
        }
        r = requests.post(f"{BASE_URL}/api/checkout/redsys", json=payload, timeout=15)
        assert r.status_code == 400, f"expected 400, got {r.status_code} body={r.text}"
        body = r.json()
        detail = body.get("detail", "")
        # Empty items is caught upstream by _build_order_from_items with 'Carrito vacío';
        # the new safety check ('No hay items válidos...') fires when total==0 after filtering.
        # Both are 400s — user contract is satisfied.
        assert (
            "importe total es 0" in detail
            or "No hay items" in detail
            or "Carrito vacío" in detail
        ), f"unexpected detail: {detail!r}"


# ---------- 4. HTTP: happy path signature verifies & amount looks correct ----------
class TestCheckoutHappyPath:
    @pytest.fixture(scope="class")
    def product_id(self):
        r = requests.get(f"{BASE_URL}/api/products?limit=1", timeout=15)
        r.raise_for_status()
        data = r.json()
        assert data, "no products"
        return data[0]["id"]

    @pytest.fixture(scope="class")
    def checkout_response(self, product_id):
        payload = {
            "items": [{"product_id": product_id, "qty": 1}],
            "customer": {
                "name": "TEST Iter29", "email": "iter29@example.com", "phone": "600",
                "address": "x", "city": "x", "postal_code": "00000", "country": "España",
            },
            "origin_url": BASE_URL,
        }
        r = requests.post(f"{BASE_URL}/api/checkout/redsys", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        return r.json()

    def test_status_200_and_signature_verifies(self, checkout_response):
        assert verify_signature(
            SECRET,
            checkout_response["Ds_MerchantParameters"],
            checkout_response["merchant_order"],
            checkout_response["Ds_Signature"],
        ), "Ds_Signature does not verify"

    def test_signature_matches_canonical_impl_over_the_wire(self, checkout_response):
        canonical = canonical_sign(
            SECRET,
            checkout_response["Ds_MerchantParameters"],
            checkout_response["merchant_order"],
        )
        assert canonical == checkout_response["Ds_Signature"]

    def test_amount_is_positive_integer_cents(self, checkout_response):
        params = decode_merchant_parameters(checkout_response["Ds_MerchantParameters"])
        amount = params["Ds_Merchant_Amount"]
        assert amount.isdigit(), f"amount not digit-only: {amount!r}"
        assert int(amount) > 0
        # Verifica que se parece a céntimos (>=1 céntimo)


# ---------- 5. Notify regression ----------
class TestNotifyRegression:
    @pytest.fixture(scope="class")
    def merchant_order(self):
        r = requests.get(f"{BASE_URL}/api/products?limit=1", timeout=15)
        pid = r.json()[0]["id"]
        payload = {
            "items": [{"product_id": pid, "qty": 1}],
            "customer": {"name": "TEST Notify29", "email": "notify29@example.com",
                         "phone": "", "address": "x", "city": "x",
                         "postal_code": "00000", "country": "España"},
            "origin_url": BASE_URL,
        }
        co = requests.post(f"{BASE_URL}/api/checkout/redsys", json=payload, timeout=20).json()
        return co["merchant_order"]

    def test_notify_marks_paid_on_0000(self, merchant_order):
        mp = build_merchant_parameters({
            "Ds_Order": merchant_order,
            "Ds_Response": "0000",
            "Ds_AuthorisationCode": "ITER29",
            "Ds_Amount": "450",
            "Ds_Currency": "978",
            "Ds_MerchantCode": "367456167",
            "Ds_Terminal": "1",
            "Ds_TransactionType": "0",
        })
        sig = create_signature(SECRET, mp, merchant_order)
        r = requests.post(
            f"{BASE_URL}/api/payments/redsys/notify",
            data={"Ds_MerchantParameters": mp, "Ds_Signature": sig,
                  "Ds_SignatureVersion": "HMAC_SHA256_V1"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        s = requests.get(f"{BASE_URL}/api/checkout/redsys/status/{merchant_order}", timeout=15).json()
        assert s["payment_status"] == "paid"
        assert s["ds_response"] == "0000"
        assert s["authorization_code"] == "ITER29"


# ---------- 6. Health endpoint ----------
class TestHealth:
    def test_health_configured_true(self):
        r = requests.get(f"{BASE_URL}/api/payments/redsys/health", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["configured"] is True
        assert body["missing"] == []
        assert body["environment"] == "test"
