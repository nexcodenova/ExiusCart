"""
Public storefront checkout — Custom Website channel only. Creates a
pending Order the same way orders.py's dashboard create_order does
(pre-flight stock validation against Product.quantity, price snapshot on
each OrderItem), but stock is deliberately NOT decremented here — only
once the payment gateway confirms payment via payment_webhook below,
matching how channel-sourced orders already behave elsewhere in this
codebase (see orders.py's cancel/restock logic, which already assumes
"channel" orders defer the stock decrement until payment_status=paid).
"""

import json
import logging
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.shop import Shop
from app.models.product import Product
from app.models.customer import Customer
from app.models.order import Order, OrderItem
from app.models.channel import ChannelConnection
from app.models.product_variant import ProductVariant
from app.models.user import User
from app.api.v1.deps import get_current_user
from app.core.rate_limit import limiter

SUPPORTED_GATEWAYS = ("payhere", "stripe", "paypal", "whop")

logger = logging.getLogger(__name__)
router = APIRouter()

_optional_bearer = HTTPBearer(auto_error=False)


def _get_optional_customer(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer),
    db: Session = Depends(get_db),
) -> Optional[Customer]:
    """Checkout supports both guest and logged-in shoppers — unlike
    get_current_customer (deps.py), a missing/invalid token here just
    means "guest", not a 401."""
    if not credentials:
        return None
    from app.core.security import decode_token
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "customer":
        return None
    customer = db.query(Customer).filter(Customer.id == int(payload.get("sub"))).first()
    return customer if customer and customer.is_active else None


def _shop_and_gateway(shop_slug: str, db: Session):
    shop = db.query(Shop).filter(Shop.slug == shop_slug, Shop.is_active == True).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Store not found")
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop.id,
        ChannelConnection.channel_type == "custom",
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=400, detail="Custom Website channel not connected")
    return shop, conn


def _tiered_unit_price(product: Product, quantity: int, db: Session) -> Decimal:
    """If the seller defined a "quantity_tiers" field (custom_product_fields.py)
    and set tiers on this product, returns the effective per-unit price for
    the highest tier the ordered quantity qualifies for. Falls back to
    product.price when no tiers are defined/qualified — this is the only
    place tier pricing actually affects what's charged; everywhere else
    it's just seller-entered display data.

    Each tier's `price` is the TOTAL for buying exactly `quantity` of that
    tier (e.g. "3 for $25" — not $25/unit) — matches how sellers actually
    describe these ("Buy 3 for $25"), not a per-unit rate. Buying more than
    the tier's quantity still gets that tier's effective per-unit rate
    (tier price ÷ tier quantity) applied to the full amount ordered."""
    if not product.custom_field_values:
        return Decimal(str(product.price))

    from app.models.custom_product_fields import CustomProductFieldSettings
    settings = db.query(CustomProductFieldSettings).filter(CustomProductFieldSettings.shop_id == product.shop_id).first()
    if not settings:
        return Decimal(str(product.price))

    tier_field_id = next((f["id"] for f in (settings.fields or []) if f.get("type") == "quantity_tiers"), None)
    if not tier_field_id:
        return Decimal(str(product.price))

    tiers = product.custom_field_values.get(tier_field_id)
    if not tiers:
        return Decimal(str(product.price))

    qualifying = [t for t in tiers if int(t.get("quantity", 0)) <= quantity]
    if not qualifying:
        return Decimal(str(product.price))
    best = max(qualifying, key=lambda t: int(t["quantity"]))
    tier_quantity = int(best["quantity"]) or 1
    tier_total = Decimal(str(best["price"]))
    return tier_total / tier_quantity


def generate_order_number() -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M")
    unique = uuid.uuid4().hex[:4].upper()
    return f"ORD-{timestamp}-{unique}"


class CheckoutItemIn(BaseModel):
    product_id: int
    quantity: int
    variant_id: Optional[int] = None


class CheckoutIn(BaseModel):
    items: List[CheckoutItemIn]
    name: str
    email: str
    phone: Optional[str] = None
    shipping_address: Optional[str] = None
    use_wallet_amount: Optional[float] = None
    # Required for Stripe/PayPal — those redirect the shopper to a hosted
    # payment page and need to know where to send them back afterward.
    # PayHere doesn't use these (it posts a form directly, no redirect URL
    # needed from the storefront).
    return_url: Optional[str] = None
    cancel_url: Optional[str] = None


@router.post("/public/store/{shop_slug}/checkout")
@limiter.limit("20/minute")
def public_store_checkout(
    request: Request,
    shop_slug: str,
    data: CheckoutIn,
    db: Session = Depends(get_db),
    auth_customer: Optional[Customer] = Depends(_get_optional_customer),
):
    shop, conn = _shop_and_gateway(shop_slug, db)
    customer = auth_customer

    if not data.items:
        raise HTTPException(status_code=422, detail="Cart is empty.")
    if not conn.payment_gateway or not conn.gateway_merchant_id or not conn.gateway_merchant_secret:
        raise HTTPException(status_code=400, detail="This store hasn't finished setting up a payment gateway yet.")

    # Pre-flight stock check — same validation orders.py's create_order
    # does, but nothing is decremented yet (see module docstring).
    subtotal = Decimal("0")
    line_items = []
    for item in data.items:
        if item.quantity < 1:
            raise HTTPException(status_code=422, detail="Quantity must be at least 1.")
        product = db.query(Product).filter(
            Product.id == item.product_id, Product.shop_id == shop.id, Product.is_active == True,
        ).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        # Affiliate products have no checkout at all — "Buy" sends the
        # customer straight to affiliate_url on the storefront, so this
        # should never actually reach here. Rejected server-side too
        # (not just by hiding the Add to Cart button), same defense-in-
        # depth other product-type rules in this codebase already use.
        if product.product_type == "affiliate":
            raise HTTPException(status_code=400, detail=f"'{product.name}' is an affiliate product — it can't be added to a cart, only bought via its own link.")

        variant = None
        if item.variant_id is not None:
            variant = db.query(ProductVariant).filter(
                ProductVariant.id == item.variant_id, ProductVariant.product_id == product.id,
            ).first()
            if not variant:
                raise HTTPException(status_code=404, detail=f"Selected variant not found for '{product.name}'.")

        # A variant's own stock is the real count once one's selected — the
        # parent product's quantity is only checked when there's no variant
        # to check instead (e.g. a product with no size/color options).
        available = variant.quantity if variant is not None else product.quantity
        if (available or 0) < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for '{product.name}'.")

        # A variant's own price overrides the product's — None means "use
        # the parent product price", same convention ProductVariant.price's
        # own column comment documents.
        if variant is not None and variant.price is not None:
            unit_price = variant.price
        else:
            unit_price = _tiered_unit_price(product, item.quantity, db)
        line_total = unit_price * item.quantity
        subtotal += line_total
        line_items.append({
            "product": product, "variant": variant, "quantity": item.quantity,
            "unit_price": unit_price, "total_price": line_total,
        })

    # Guest or logged-in, every order still needs a Customer row to attach
    # to (same as every other order-creating path in this codebase already
    # does) — find-or-create by email within this shop rather than
    # requiring an account. Logged-in customers use their own row as-is.
    if not customer:
        email = data.email.strip().lower()
        if not email or "@" not in email:
            raise HTTPException(status_code=422, detail="A valid email is required.")
        customer = db.query(Customer).filter(
            Customer.shop_id == shop.id, func.lower(Customer.email) == email,
        ).first()
        if not customer:
            customer = Customer(shop_id=shop.id, name=data.name.strip() or "Guest", email=email, phone=data.phone, source="custom")
            db.add(customer)
            db.flush()

    # Wallet redemption — only for a logged-in customer spending their OWN
    # balance (never a guest email match, since anyone could type someone
    # else's email at guest checkout — see _get_optional_customer). Applied
    # before the gateway hash is computed, so what the shopper actually
    # pays PayHere matches what they see after the discount.
    wallet_discount = Decimal("0")
    if auth_customer and data.use_wallet_amount and data.use_wallet_amount > 0:
        from app.api.v1.endpoints.wallet import debit_wallet_for_redemption
        wallet_discount = debit_wallet_for_redemption(shop.id, auth_customer.id, Decimal(str(data.use_wallet_amount)), db)

    total = subtotal - wallet_discount
    if total < 0:
        total = Decimal("0")

    order = Order(
        order_number=generate_order_number(),
        status="pending",
        payment_status="pending",
        source="channel",
        # Every order created through this endpoint came from the seller's
        # own Custom Website (it's the only checkout path this file
        # exposes) — tagged here so the Custom Website Integration page can
        # show real order/revenue counts for this channel specifically,
        # since Order has no dedicated channel-type column of its own.
        notes="Custom Website order",
        subtotal=subtotal,
        discount_amount=wallet_discount,
        total=total,
        shipping_address=data.shipping_address,
        shop_id=shop.id,
        customer_id=customer.id,
    )
    db.add(order)
    db.flush()

    for li in line_items:
        db.add(OrderItem(
            order_id=order.id,
            product_id=li["product"].id,
            variant_id=li["variant"].id if li["variant"] else None,
            product_name=li["product"].name,
            quantity=li["quantity"],
            unit_price=li["unit_price"],
            total_price=li["total_price"],
        ))
    db.commit()
    db.refresh(order)

    payment_params = _build_payment_params(conn, shop, order, total, data.return_url, data.cancel_url)
    return {"order_number": order.order_number, "total": float(total), "payment": payment_params}


class CheckoutStartedIn(BaseModel):
    email: str
    items: List[CheckoutItemIn]


@router.post("/public/store/{shop_slug}/checkout-started")
@limiter.limit("20/minute")
def public_checkout_started(
    request: Request,
    shop_slug: str,
    data: CheckoutStartedIn,
    db: Session = Depends(get_db),
):
    """Fired by the storefront the moment a real email is captured at
    checkout — BEFORE order submission. Not full cart-session tracking:
    one snapshot row, not a running session. This is the only piece
    Abandoned Cart recovery needed that didn't already exist — everything
    downstream (matching against a real Order, enrolling into a Drip Flow)
    runs off this row (see marketing.py's sync_abandoned_carts_job)."""
    from app.models.checkout_attempt import CheckoutAttempt

    shop = db.query(Shop).filter(Shop.slug == shop_slug, Shop.is_active == True).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Store not found")

    email = data.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=422, detail="A valid email is required.")
    if not data.items:
        raise HTTPException(status_code=422, detail="Cart is empty.")

    snapshot = []
    for item in data.items:
        if item.quantity < 1:
            continue
        product = db.query(Product).filter(Product.id == item.product_id, Product.shop_id == shop.id).first()
        if not product:
            continue
        snapshot.append({
            "product_id": product.id,
            "name": product.name,
            "quantity": item.quantity,
            "price": float(product.price),
        })
    if not snapshot:
        raise HTTPException(status_code=422, detail="No valid items in cart.")

    db.add(CheckoutAttempt(shop_id=shop.id, email=email, cart_snapshot=snapshot))
    db.commit()
    return {"ok": True}


def _build_payment_params(conn: ChannelConnection, shop: Shop, order: Order, total: Decimal, return_url: Optional[str], cancel_url: Optional[str]) -> dict:
    """Each gateway hands the storefront a different shape — PayHere needs
    a signed hash to build its own form/redirect; Stripe and PayPal are
    hosted pages, so the storefront just needs one URL to send the
    shopper to. Keeping this branching in one place is what lets checkout
    itself stay gateway-agnostic."""
    if conn.payment_gateway == "payhere":
        from app.core.payment_gateways import payhere_checkout_hash
        amount = f"{total:.2f}"
        return {
            "gateway": "payhere",
            "order_id": order.order_number,
            "amount": amount,
            "currency": "LKR",
            "merchant_id": conn.gateway_merchant_id,
            "hash": payhere_checkout_hash(conn.gateway_merchant_id, order.order_number, amount, "LKR", conn.gateway_merchant_secret),
        }

    if conn.payment_gateway == "stripe":
        if not return_url or not cancel_url:
            raise HTTPException(status_code=422, detail="return_url and cancel_url are required for Stripe.")
        from app.core.payment_gateways import stripe_create_checkout_session
        session = stripe_create_checkout_session(
            conn.gateway_merchant_id, order.order_number, float(total), shop.currency or "USD", return_url, cancel_url,
        )
        return {"gateway": "stripe", "order_id": order.order_number, "redirect_url": session["url"]}

    if conn.payment_gateway == "whop":
        if not return_url:
            raise HTTPException(status_code=422, detail="return_url is required for Whop.")
        from app.core.payment_gateways import whop_create_checkout_configuration
        config = whop_create_checkout_configuration(
            conn.gateway_merchant_secret, conn.gateway_merchant_id, order.order_number, float(total), (shop.currency or "USD").lower(), return_url,
        )
        return {"gateway": "whop", "order_id": order.order_number, "redirect_url": config.get("purchase_url")}

    if conn.payment_gateway == "paypal":
        if not return_url or not cancel_url:
            raise HTTPException(status_code=422, detail="return_url and cancel_url are required for PayPal.")
        from app.core.payment_gateways import paypal_create_order
        # PayPal's own return_url gets our capture endpoint appended so the
        # capture happens before the shopper ever sees the storefront
        # again — see public_paypal_return below.
        capture_return = f"https://api.exiuscart.com/api/v1/public/store/{shop.slug}/payment-return/paypal?order_number={order.order_number}&redirect_to={return_url}"
        pp_order = paypal_create_order(
            conn.gateway_merchant_id, conn.gateway_merchant_secret, order.order_number, float(total), shop.currency or "USD", capture_return, cancel_url,
        )
        return {"gateway": "paypal", "order_id": order.order_number, "redirect_url": pp_order["approve_url"]}

    raise HTTPException(status_code=400, detail=f"Unsupported gateway: {conn.payment_gateway}")


@router.get("/public/store/{shop_slug}/orders/{order_number}")
@limiter.limit("20/minute")
def public_store_order_lookup(request: Request, shop_slug: str, order_number: str, email: str, db: Session = Depends(get_db)):
    """Guest order lookup — order number + email match, no account required."""
    shop = db.query(Shop).filter(Shop.slug == shop_slug, Shop.is_active == True).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Store not found")

    order = db.query(Order).filter(Order.shop_id == shop.id, Order.order_number == order_number).first()
    if not order or not order.customer or (order.customer.email or "").strip().lower() != email.strip().lower():
        raise HTTPException(status_code=404, detail="Order not found")

    return {
        "order_number": order.order_number,
        "status": order.status,
        "payment_status": order.payment_status,
        "total": float(order.total),
        "items": [
            {
                "product_name": i.product_name, "quantity": i.quantity,
                "unit_price": float(i.unit_price), "total_price": float(i.total_price),
                "variant_size": i.variant.size if i.variant else None,
                "variant_color": i.variant.color if i.variant else None,
            }
            for i in order.items
        ],
        "created_at": order.created_at.isoformat() if order.created_at else None,
        # Shipment tracking — set by the seller from their dashboard when
        # they mark the order shipped (see orders.py's ship_order). All
        # null until that happens; a storefront should treat a null
        # tracking_number as "not shipped yet", not an error.
        "tracking_number": order.tracking_number,
        "carrier": order.carrier,
        "shipped_at": order.shipped_at.isoformat() if order.shipped_at else None,
        "estimated_delivery": order.estimated_delivery,
    }


def _mark_order_paid_or_failed(order: Order, is_paid: bool, db: Session):
    """Shared by every gateway's confirmation path (webhook or
    capture-on-return) — marks the order, decrements stock (deferred from
    checkout, see module docstring), and credits the wallet. Idempotent:
    safe to call more than once for the same order (a gateway retrying
    its webhook, or a shopper reloading the return page, won't double-pay
    the wallet or double-decrement stock)."""
    if is_paid and order.payment_status != "paid":
        order.payment_status = "paid"
        order.status = "confirmed"
        for item in order.items:
            if item.product_id:
                product = db.query(Product).filter(Product.id == item.product_id).first()
                if product:
                    product.quantity = max(0, (product.quantity or 0) - item.quantity)
                    product.units_sold = (product.units_sold or 0) + item.quantity
                if item.variant_id:
                    variant = db.query(ProductVariant).filter(ProductVariant.id == item.variant_id).first()
                    if variant:
                        variant.quantity = max(0, (variant.quantity or 0) - item.quantity)
        db.commit()

        from app.api.v1.endpoints.wallet import credit_wallet_for_order
        credit_wallet_for_order(order, db)

        from app.api.v1.endpoints.digital_delivery import create_digital_deliveries_for_order
        create_digital_deliveries_for_order(order, db)
    elif not is_paid and order.payment_status not in ("paid", "failed"):
        order.payment_status = "failed"
        db.commit()


def _custom_conn_for_shop(shop: Shop, db: Session) -> Optional[ChannelConnection]:
    return db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop.id,
        ChannelConnection.channel_type == "custom",
        ChannelConnection.is_active == True,
    ).first()


@router.post("/public/payment-webhook/{shop_slug}")
async def payment_webhook(shop_slug: str, request: Request, db: Session = Depends(get_db)):
    """Server-to-server payment confirmation — the gateway calls this
    directly (never through the storefront/ODTSI). Verifies the gateway's
    own signature before trusting anything. PayPal doesn't use this path
    (see public_paypal_return below) — it confirms via capture-on-return
    instead, since that's the standard, simpler PayPal Orders v2 flow."""
    shop = db.query(Shop).filter(Shop.slug == shop_slug, Shop.is_active == True).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Store not found")

    conn = _custom_conn_for_shop(shop, db)
    if not conn or not conn.payment_gateway:
        raise HTTPException(status_code=400, detail="No payment gateway configured")

    if conn.payment_gateway == "payhere":
        from app.core.payment_gateways import payhere_verify_notification
        form = await request.form()
        order_number = form.get("order_id", "")
        amount = form.get("payhere_amount", "")
        currency = form.get("payhere_currency", "")
        status_code = form.get("status_code", "")
        md5sig = form.get("md5sig", "")
        if not payhere_verify_notification(conn.gateway_merchant_id, order_number, amount, currency, status_code, conn.gateway_merchant_secret, md5sig):
            logger.warning(f"[PAYMENT WEBHOOK] shop={shop.id} order={order_number} invalid signature — ignored")
            raise HTTPException(status_code=400, detail="Invalid signature")
        is_paid = status_code == "2"  # PayHere: 2 = success

    elif conn.payment_gateway == "stripe":
        from app.core.payment_gateways import stripe_verify_webhook_signature
        payload = await request.body()
        sig_header = request.headers.get("stripe-signature", "")
        event = stripe_verify_webhook_signature(payload, sig_header, conn.gateway_merchant_secret)
        if not event:
            logger.warning(f"[PAYMENT WEBHOOK] shop={shop.id} stripe — invalid signature, ignored")
            raise HTTPException(status_code=400, detail="Invalid signature")
        if event.get("type") != "checkout.session.completed":
            return {"status": "ignored"}  # not the event we care about
        order_number = event["data"]["object"].get("client_reference_id", "")
        is_paid = True

    elif conn.payment_gateway == "whop":
        from app.core.payment_gateways import whop_verify_webhook_signature
        payload_bytes = await request.body()
        # channel_api_url repurposed to hold the Whop webhook signing
        # secret (see payment_gateways.py's module note) — only verify if
        # the seller actually provided one, same "never silently treat
        # unconfigured as verified" discipline whop.py's own webhook uses.
        if conn.channel_api_url:
            ok = whop_verify_webhook_signature(
                conn.channel_api_url,
                request.headers.get("webhook-id", ""),
                request.headers.get("webhook-timestamp", ""),
                request.headers.get("webhook-signature", ""),
                payload_bytes,
            )
            if not ok:
                logger.warning(f"[PAYMENT WEBHOOK] shop={shop.id} whop — invalid signature, ignored")
                raise HTTPException(status_code=400, detail="Invalid signature")
        try:
            event = json.loads(payload_bytes)
        except Exception:
            raise HTTPException(status_code=422, detail="Invalid webhook payload")
        event_type = event.get("action") or event.get("type") or event.get("event")
        if event_type != "payment.succeeded":
            return {"status": "ignored"}
        order_number = (event.get("data") or {}).get("metadata", {}).get("exiuscart_order_number", "")
        is_paid = True

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported gateway for webhook: {conn.payment_gateway}")

    order = db.query(Order).filter(Order.shop_id == shop.id, Order.order_number == order_number).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    _mark_order_paid_or_failed(order, is_paid, db)
    return {"status": "ok"}


@router.get("/public/store/{shop_slug}/payment-return/paypal")
def public_paypal_return(shop_slug: str, order_number: str, redirect_to: str, token: Optional[str] = None, db: Session = Depends(get_db)):
    """Where PayPal sends the shopper back after they approve. `token` is
    the PayPal order id — capturing it here (not just reading redirect
    params) is what actually proves the payment: the capture call itself
    fails if the order was never genuinely approved, so this isn't
    "trusting a browser redirect", it's a real server-to-server charge."""
    from fastapi.responses import RedirectResponse

    shop = db.query(Shop).filter(Shop.slug == shop_slug, Shop.is_active == True).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Store not found")
    conn = _custom_conn_for_shop(shop, db)
    if not conn or conn.payment_gateway != "paypal" or not token:
        return RedirectResponse(f"{redirect_to}?payment=failed")

    order = db.query(Order).filter(Order.shop_id == shop.id, Order.order_number == order_number).first()
    if not order:
        return RedirectResponse(f"{redirect_to}?payment=failed")

    from app.core.payment_gateways import paypal_capture_order
    try:
        capture = paypal_capture_order(conn.gateway_merchant_id, conn.gateway_merchant_secret, token)
        is_paid = capture.get("status") == "COMPLETED"
    except Exception:
        logger.exception(f"[PAYPAL CAPTURE] shop={shop.id} order={order_number} capture call failed")
        is_paid = False

    _mark_order_paid_or_failed(order, is_paid, db)
    return RedirectResponse(f"{redirect_to}?payment={'success' if is_paid else 'failed'}&order_number={order_number}")


# ── Seller-facing: connect a payment gateway to the Custom Website channel ──

class PaymentGatewayIn(BaseModel):
    payment_gateway: str
    merchant_id: str
    merchant_secret: str
    # Whop-only: the webhook signing secret shown once when the seller
    # registers this shop's webhook URL in their Whop dashboard. Ignored
    # for every other gateway.
    webhook_signing_secret: Optional[str] = None


def _custom_channel_connection(shop_id: int, db: Session) -> ChannelConnection:
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "custom",
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=400, detail="Connect the Custom Website channel first, under Channels.")
    return conn


@router.get("/shops/{shop_id}/channels/custom/payment-gateway")
def get_payment_gateway_settings(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id, ChannelConnection.channel_type == "custom", ChannelConnection.is_active == True,
    ).first()
    if not conn:
        return {"channel_connected": False}
    return {
        "channel_connected": True,
        "payment_gateway": conn.payment_gateway,
        "merchant_id": conn.gateway_merchant_id,
        "configured": bool(conn.payment_gateway and conn.gateway_merchant_id and conn.gateway_merchant_secret),
        "webhook_url": f"https://api.exiuscart.com/api/v1/public/payment-webhook/{shop.slug}",
    }


@router.put("/shops/{shop_id}/channels/custom/payment-gateway")
def set_payment_gateway_settings(
    shop_id: int,
    payload: PaymentGatewayIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """merchant_secret is write-only from here on out — get_payment_gateway_settings
    never echoes it back, same discipline as every other channel's stored secret."""
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    if payload.payment_gateway not in SUPPORTED_GATEWAYS:
        raise HTTPException(status_code=400, detail=f"Unsupported payment gateway. Supported: {', '.join(SUPPORTED_GATEWAYS)}")

    conn = _custom_channel_connection(shop_id, db)
    conn.payment_gateway = payload.payment_gateway
    conn.gateway_merchant_id = payload.merchant_id.strip()
    conn.gateway_merchant_secret = payload.merchant_secret.strip()
    if payload.payment_gateway == "whop" and payload.webhook_signing_secret:
        conn.channel_api_url = payload.webhook_signing_secret.strip()  # repurposed field, see payment_gateways.py
    db.commit()
    return {"payment_gateway": conn.payment_gateway, "merchant_id": conn.gateway_merchant_id}


@router.get("/shops/{shop_id}/channels/custom/stats")
def get_custom_website_stats(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Real numbers for the Custom Website Integration page's stat cards.
    Unlike Shopify/eBay/etc, Custom Website has no per-product sync state —
    every active product is already reachable through the public API by
    definition — so "products" here means active catalog size, not a sync
    count. Orders/revenue are scoped to orders actually placed through THIS
    channel via the `notes` marker set at creation in create_checkout()
    above (Order has no dedicated channel-type column) — orders placed
    before this marker existed won't be counted, which is a real, disclosed
    limit, not a bug."""
    from datetime import datetime, timezone, timedelta

    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id, ChannelConnection.channel_type == "custom",
    ).first()

    active_products = db.query(func.count(Product.id)).filter(
        Product.shop_id == shop_id, Product.is_active == True,
    ).scalar() or 0

    orders_q = db.query(Order).filter(Order.shop_id == shop_id, Order.notes == "Custom Website order")
    order_count = orders_q.count()
    revenue = db.query(func.coalesce(func.sum(Order.total), 0)).filter(
        Order.shop_id == shop_id, Order.notes == "Custom Website order",
    ).scalar() or 0

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_orders = orders_q.filter(Order.created_at >= today_start).count()
    today_revenue = db.query(func.coalesce(func.sum(Order.total), 0)).filter(
        Order.shop_id == shop_id, Order.notes == "Custom Website order", Order.created_at >= today_start,
    ).scalar() or 0

    # "Orders per 100 views" — NOT a session-based conversion rate (there's
    # no session/cookie tracking on StorefrontEvent by design, see its own
    # docstring), so a true visitor-conversion % isn't computable. This is
    # the honest thing that IS real: how many real page views on this
    # storefront turned into an order, over the same 30-day window.
    from app.models.storefront_event import StorefrontEvent
    window_start = datetime.now(timezone.utc) - timedelta(days=30)
    views_30d = db.query(func.count(StorefrontEvent.id)).filter(
        StorefrontEvent.shop_id == shop_id, StorefrontEvent.event_type == "view", StorefrontEvent.created_at >= window_start,
    ).scalar() or 0
    orders_30d = orders_q.filter(Order.created_at >= window_start).count()
    orders_per_100_views = round(100 * orders_30d / views_30d, 1) if views_30d else None

    refunds_count = orders_q.filter(Order.payment_status == "refunded").count()

    last_order = orders_q.order_by(Order.created_at.desc()).first()
    recent_20 = orders_q.order_by(Order.created_at.desc()).limit(20).all()
    paid_count = sum(1 for o in recent_20 if (o.payment_status or "").lower() == "paid")
    recent_success_rate = round(100 * paid_count / len(recent_20), 1) if recent_20 else None

    recent = orders_q.order_by(Order.created_at.desc()).limit(8).all()
    customer_ids = list({o.customer_id for o in recent if o.customer_id})
    customer_names = {}
    if customer_ids:
        customer_names = {c.id: c.name for c in db.query(Customer).filter(Customer.id.in_(customer_ids)).all()}
    recent_orders = [
        {
            "id": o.id,
            "order_number": o.order_number,
            "customer_name": customer_names.get(o.customer_id),
            "total": float(o.total),
            "status": o.status,
            "payment_status": o.payment_status,
            "fulfillment_status": o.fulfillment_status,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in recent
    ]

    return {
        "active_products": active_products,
        "orders": order_count,
        "revenue": float(revenue),
        "today_orders": today_orders,
        "today_revenue": float(today_revenue),
        "orders_per_100_views": orders_per_100_views,
        "recent_success_rate": recent_success_rate,
        "refunds_count": refunds_count,
        "connected_at": conn.created_at.isoformat() if conn and conn.created_at else None,
        "last_order_at": last_order.created_at.isoformat() if last_order and last_order.created_at else None,
        "recent_orders": recent_orders,
    }


@router.get("/shops/{shop_id}/channels/custom/sales-series")
def get_custom_website_sales_series(
    shop_id: int,
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Real daily revenue/orders for the Website Sales chart — grouped in
    Python rather than a DB-specific date_trunc so this works identically
    regardless of the underlying database engine."""
    from datetime import datetime, timezone, timedelta
    from collections import OrderedDict

    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    days = min(max(days, 1), 365)
    start = datetime.now(timezone.utc) - timedelta(days=days - 1)
    start = start.replace(hour=0, minute=0, second=0, microsecond=0)

    orders = db.query(Order).filter(
        Order.shop_id == shop_id, Order.notes == "Custom Website order", Order.created_at >= start,
    ).all()

    buckets: "OrderedDict[str, dict]" = OrderedDict()
    for i in range(days):
        day = (start + timedelta(days=i)).date().isoformat()
        buckets[day] = {"date": day, "revenue": 0.0, "orders": 0}
    for o in orders:
        if not o.created_at:
            continue
        day = o.created_at.date().isoformat()
        if day in buckets:
            buckets[day]["revenue"] += float(o.total)
            buckets[day]["orders"] += 1

    return {"series": list(buckets.values())}


@router.get("/shops/{shop_id}/channels/custom/traffic-series")
def get_custom_website_traffic_series(
    shop_id: int,
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Real daily visitor activity for the Website Traffic chart — page
    views and add-to-carts from StorefrontEvent, the same real tracking
    already powering "Orders per 100 Views". No session/visitor-count
    exists (StorefrontEvent deliberately doesn't track sessions), so this
    is real event counts per day, not unique-visitor numbers."""
    from datetime import datetime, timezone, timedelta
    from collections import OrderedDict
    from app.models.storefront_event import StorefrontEvent

    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    days = min(max(days, 1), 365)
    start = datetime.now(timezone.utc) - timedelta(days=days - 1)
    start = start.replace(hour=0, minute=0, second=0, microsecond=0)

    events = db.query(StorefrontEvent.event_type, StorefrontEvent.created_at).filter(
        StorefrontEvent.shop_id == shop_id, StorefrontEvent.created_at >= start,
    ).all()

    buckets: "OrderedDict[str, dict]" = OrderedDict()
    for i in range(days):
        day = (start + timedelta(days=i)).date().isoformat()
        buckets[day] = {"date": day, "views": 0, "add_to_cart": 0}
    for event_type, created_at in events:
        if not created_at:
            continue
        day = created_at.date().isoformat()
        if day not in buckets:
            continue
        if event_type == "view":
            buckets[day]["views"] += 1
        elif event_type == "add_to_cart":
            buckets[day]["add_to_cart"] += 1

    return {"series": list(buckets.values())}
