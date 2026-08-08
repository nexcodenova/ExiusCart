"""
Payment gateway integrations for storefront checkout (Custom Website
channel). Deliberately gateway-agnostic at the schema/checkout level —
see ChannelConnection.payment_gateway (app/models/channel.py) — so adding
a second gateway later is a new function here plus a branch in
checkout.py, not a rename or a data migration.

PayHere is the first (and currently only) gateway implemented.
"""

import hashlib


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
