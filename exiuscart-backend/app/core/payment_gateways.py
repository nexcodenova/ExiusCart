"""
Payment gateway integrations for storefront checkout (Custom Website
channel). Deliberately gateway-agnostic at the schema/checkout level —
see ChannelConnection.payment_gateway (app/models/channel.py) — so adding
a second gateway later is a new function here plus a branch in
checkout.py, not a rename or a data migration.

Three gateways implemented: PayHere, Stripe, PayPal. Each stores its
credentials in the same two generic columns (gateway_merchant_id,
gateway_merchant_secret) — what they actually hold differs per gateway
(see the label mapping in checkout.py / the frontend), not the schema.
"""

import hashlib
import hmac
import json
import time

import httpx

STRIPE_API_BASE = "https://api.stripe.com/v1"
PAYPAL_API_BASE = "https://api-m.paypal.com"


# ── PayHere ──────────────────────────────────────────────────────────────────

def payhere_checkout_hash(merchant_id: str, order_id: str, amount: str, currency: str, merchant_secret: str) -> str:
    """The MD5 hash PayHere requires on every checkout request, per its
    'Create a payment' integration guide. `amount` must already be
    formatted to 2 decimal places before calling this."""
    secret_hash = hashlib.md5(merchant_secret.encode()).hexdigest().upper()
    raw = f"{merchant_id}{order_id}{amount}{currency}{secret_hash}"
    return hashlib.md5(raw.encode()).hexdigest().upper()


def payhere_verify_notification(
    merchant_id: str, order_id: str, amount: str, currency: str,
    status_code: str, merchant_secret: str, received_md5sig: str,
) -> bool:
    """Verifies a PayHere IPN webhook actually came from PayHere (and
    wasn't forged) before trusting it to mark an order paid."""
    secret_hash = hashlib.md5(merchant_secret.encode()).hexdigest().upper()
    raw = f"{merchant_id}{order_id}{amount}{currency}{status_code}{secret_hash}"
    local_md5sig = hashlib.md5(raw.encode()).hexdigest().upper()
    return local_md5sig == received_md5sig.upper()


# ── Stripe ───────────────────────────────────────────────────────────────────
# Credentials: gateway_merchant_id holds the Secret Key (sk_...),
# gateway_merchant_secret holds the Webhook Signing Secret (whsec_...).

def stripe_create_checkout_session(
    secret_key: str, order_number: str, amount: float, currency: str, success_url: str, cancel_url: str,
) -> dict:
    """Stripe Checkout Session — the customer is sent to session['url'] to
    pay; Stripe hosts the whole payment form, neither ExiusCart nor the
    storefront ever sees card details."""
    resp = httpx.post(
        f"{STRIPE_API_BASE}/checkout/sessions",
        auth=(secret_key, ""),
        data={
            "mode": "payment",
            "client_reference_id": order_number,
            "success_url": success_url,
            "cancel_url": cancel_url,
            "line_items[0][price_data][currency]": currency.lower(),
            "line_items[0][price_data][product_data][name]": f"Order {order_number}",
            "line_items[0][price_data][unit_amount]": str(int(round(amount * 100))),
            "line_items[0][quantity]": "1",
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def stripe_verify_webhook_signature(payload: bytes, sig_header: str, webhook_secret: str, tolerance_seconds: int = 300):
    """Verifies Stripe's Stripe-Signature header — HMAC-SHA256 over
    "{timestamp}.{raw body}" — before trusting a webhook. Returns the
    parsed event dict if genuine, None otherwise (forged, stale, or
    malformed signature)."""
    try:
        parts = dict(p.split("=", 1) for p in sig_header.split(","))
        timestamp = int(parts["t"])
        signature = parts["v1"]
    except Exception:
        return None
    if abs(time.time() - timestamp) > tolerance_seconds:
        return None
    signed_payload = f"{timestamp}.{payload.decode()}"
    expected = hmac.new(webhook_secret.encode(), signed_payload.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return None
    return json.loads(payload)


# ── PayPal ───────────────────────────────────────────────────────────────────
# Credentials: gateway_merchant_id holds the Client ID,
# gateway_merchant_secret holds the Client Secret.

def paypal_get_access_token(client_id: str, client_secret: str) -> str:
    resp = httpx.post(
        f"{PAYPAL_API_BASE}/v1/oauth2/token",
        auth=(client_id, client_secret),
        data={"grant_type": "client_credentials"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def paypal_create_order(
    client_id: str, client_secret: str, order_number: str, amount: float, currency: str, return_url: str, cancel_url: str,
) -> dict:
    """Creates a PayPal order and returns its id + the 'approve' link the
    customer is redirected to. Nothing is charged yet — that happens when
    payment-return captures it after the customer approves."""
    token = paypal_get_access_token(client_id, client_secret)
    resp = httpx.post(
        f"{PAYPAL_API_BASE}/v2/checkout/orders",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={
            "intent": "CAPTURE",
            "purchase_units": [{"reference_id": order_number, "amount": {"currency_code": currency, "value": f"{amount:.2f}"}}],
            "application_context": {"return_url": return_url, "cancel_url": cancel_url, "user_action": "PAY_NOW"},
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    approve_url = next((l["href"] for l in data.get("links", []) if l.get("rel") == "approve"), None)
    return {"id": data["id"], "approve_url": approve_url}


def paypal_capture_order(client_id: str, client_secret: str, paypal_order_id: str) -> dict:
    """Captures a previously-approved PayPal order — this is the actual
    charge. Called when the customer is sent back to the storefront's
    payment-return URL, never trusted from redirect params alone: the
    capture call itself is what proves the payment is real (it fails if
    the order was never genuinely approved)."""
    token = paypal_get_access_token(client_id, client_secret)
    resp = httpx.post(
        f"{PAYPAL_API_BASE}/v2/checkout/orders/{paypal_order_id}/capture",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()
