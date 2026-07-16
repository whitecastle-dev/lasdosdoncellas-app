"""Redsys / CaixaBank TPV Virtual — helpers de firma para el flujo de redirección.

Referencia: canales.redsys.es (Manual integración por redirección HMAC_SHA256_V1).
La firma depende de una clave por-pedido derivada del secreto del comercio
mediante 3DES-CBC con IV=0 y el `Ds_Merchant_Order` como mensaje (padded).
"""
import base64
import hashlib
import hmac
import json
from typing import Dict

from Crypto.Cipher import DES3
from Crypto.Util.Padding import pad


def build_merchant_parameters(payload: Dict) -> str:
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return base64.b64encode(raw).decode("ascii")


def decode_merchant_parameters(merchant_parameters_b64: str) -> Dict:
    # Redsys puede devolver base64 estándar o URL-safe (con - y _)
    padded = merchant_parameters_b64 + "=" * (-len(merchant_parameters_b64) % 4)
    try:
        raw = base64.urlsafe_b64decode(padded)
    except Exception:
        raw = base64.b64decode(padded)
    return json.loads(raw.decode("utf-8"))


def _derive_per_order_key(secret_key_b64: str, order: str) -> bytes:
    secret = base64.b64decode(secret_key_b64)
    cipher = DES3.new(secret, DES3.MODE_CBC, iv=b"\x00" * 8)
    order_bytes = pad(order.encode("utf-8"), 8)
    return cipher.encrypt(order_bytes)


def create_signature(secret_key_b64: str, merchant_parameters_b64: str, order: str) -> str:
    per_order_key = _derive_per_order_key(secret_key_b64, order)
    mac = hmac.new(per_order_key, merchant_parameters_b64.encode("utf-8"), hashlib.sha256).digest()
    return base64.b64encode(mac).decode("ascii")


def verify_signature(secret_key_b64: str, merchant_parameters_b64: str, order: str, received_sig: str) -> bool:
    """Verifica firma tolerando el base64 URL-safe que a veces devuelve Redsys."""
    expected = create_signature(secret_key_b64, merchant_parameters_b64, order)
    # Normaliza URL-safe → estándar para comparación robusta
    normalized_received = received_sig.replace("-", "+").replace("_", "/")
    return hmac.compare_digest(expected, received_sig) or hmac.compare_digest(expected, normalized_received)
