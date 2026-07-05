from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from decimal import Decimal
from pydantic import BaseModel
import uuid
from app.core.database import get_db
from app.api.v1.endpoints.usage import check_and_log_email
from app.models.user import User
from app.models.shop import Shop
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.channel_order_meta import ChannelOrderMeta
from app.models.customer import Customer
from app.schemas.order import OrderCreate, OrderResponse, OrderUpdate, ShipOrderIn
from app.api.v1.deps import get_current_user
from app.api.v1.endpoints.channels import trigger_stock_sync
from app.core.email import send_email, build_invoice_html, _FROM_BILLING, send_new_order_email
from app.core.thedersi import notify_thedersi_order_status, MONTHLY_ORDER_LIMITS
from app.models.subscription import Subscription
from app.models.bundle_component import BundleComponent
from app.models.channel import ChannelConnection

router = APIRouter()

_VALID_STATUSES = {"pending", "confirmed", "packing", "processing", "shipped", "in_transit", "delivered", "cancelled"}


def _notify_channel_order(order_id: int, status: str, db: Session, tracking_number: str = None, tracking_courier: str = None) -> None:
    meta = db.query(ChannelOrderMeta).filter(ChannelOrderMeta.order_id == order_id).first()
    print(f"[NOTIFY] order_id={order_id} status={status} meta={'found chan_id=' + str(meta.channel_order_id) if meta else 'MISSING'}", flush=True)
    if meta and meta.channel_order_id:
        notify_thedersi_order_status(meta.channel_order_id, status, tracking_number, tracking_courier)


def generate_order_number() -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M")
    unique = uuid.uuid4().hex[:4].upper()
    return f"ORD-{timestamp}-{unique}"


@router.post("/shops/{shop_id}/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    shop_id: int,
    order_data: OrderCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    # ── Monthly order limit check — POS is always unlimited ──────────────────
    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    plan_type = sub.plan_type if sub else None
    monthly_limit = MONTHLY_ORDER_LIMITS.get(plan_type)  # None = unlimited
    if monthly_limit is not None and order_data.source != "pos":
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        orders_this_month = db.query(Order).filter(
            Order.shop_id == shop_id,
            Order.source != "pos",
            Order.created_at >= month_start,
        ).count()
        if orders_this_month >= monthly_limit:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "order_limit_reached",
                    "limit": monthly_limit,
                    "used": orders_this_month,
                    "plan": plan_type,
                    "message": f"Monthly order limit of {monthly_limit} reached. Upgrade your plan to continue.",
                },
            )
    # ─────────────────────────────────────────────────────────────────────────

    # Calculate totals (use Decimal throughout to avoid float/Decimal type errors)
    subtotal = Decimal('0')
    order_items = []

    # Pre-flight stock check — validate all items before touching any inventory
    for item in order_data.items:
        pf_product = db.query(Product).filter(Product.id == item.product_id).first()
        if not pf_product:
            continue  # main loop below raises 404
        if (pf_product.quantity or 0) < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for '{pf_product.name}': "
                       f"{pf_product.quantity or 0} available, {item.quantity} requested",
            )
        if pf_product.is_bundle:
            components = db.query(BundleComponent).filter(
                BundleComponent.bundle_product_id == pf_product.id
            ).all()
            for c in components:
                comp = db.query(Product).filter(Product.id == c.component_product_id).first()
                needed = c.quantity * item.quantity
                if comp and (comp.quantity or 0) < needed:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient stock for bundle component '{comp.name}': "
                               f"{comp.quantity or 0} available, {needed} needed",
                    )

    for item in order_data.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

        item_total = Decimal(str(item.quantity)) * Decimal(str(item.unit_price))
        subtotal += item_total

        order_items.append({
            "product_id": item.product_id,
            "product_name": product.name,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "total_price": float(item_total)
        })

        # Update inventory
        product.quantity = max(0, product.quantity - item.quantity)
        if product.is_bundle:
            from app.api.v1.endpoints.bundles import deduct_bundle_components
            deduct_bundle_components(product.id, item.quantity, db)

    # Apply discount before tax
    discount_amount = Decimal(str(order_data.discount_amount or 0))
    after_discount = subtotal - discount_amount

    # Calculate tax using shop's VAT configuration
    if shop.vat_enabled and shop.vat_rate and float(shop.vat_rate) > 0:
        rate = Decimal(str(shop.vat_rate)) / 100
        if shop.prices_include_vat:
            tax_amount = after_discount * rate / (1 + rate)
            total = after_discount
        else:
            tax_amount = after_discount * rate
            total = after_discount + tax_amount
    else:
        tax_amount = Decimal('0')
        total = after_discount

    # POS sales are immediate — mark as delivered and paid on creation
    is_pos = order_data.source == "pos"

    # Resolve customer: use explicit id, else find-or-create from name/phone/email
    customer_id = order_data.customer_id
    if not customer_id and (order_data.customer_name or order_data.customer_phone or order_data.customer_email):
        existing = None
        if order_data.customer_phone:
            existing = db.query(Customer).filter(
                Customer.shop_id == shop_id,
                Customer.phone == order_data.customer_phone,
            ).first()
        if not existing and order_data.customer_email:
            existing = db.query(Customer).filter(
                Customer.shop_id == shop_id,
                Customer.email == order_data.customer_email,
            ).first()
        if existing:
            customer_id = existing.id
        else:
            new_customer = Customer(
                shop_id=shop_id,
                name=order_data.customer_name or "Walk-in Customer",
                phone=order_data.customer_phone,
                email=order_data.customer_email,
            )
            db.add(new_customer)
            db.flush()
            customer_id = new_customer.id

    # Create order
    new_order = Order(
        order_number=generate_order_number(),
        shop_id=shop_id,
        customer_id=customer_id,
        source=order_data.source,
        status="delivered" if is_pos else "pending",
        payment_status="paid" if is_pos else "pending",
        subtotal=subtotal,
        tax_amount=tax_amount,
        discount_amount=discount_amount,
        total=total,
        notes=order_data.notes,
        shipping_address=order_data.shipping_address
    )
    db.add(new_order)
    db.flush()

    # Create order items
    for item_data in order_items:
        order_item = OrderItem(order_id=new_order.id, **item_data)
        db.add(order_item)

    db.commit()
    db.refresh(new_order)

    # Push updated stock to TheDersi for every product sold via POS
    for item in order_data.items:
        trigger_stock_sync(item.product_id, shop_id, background_tasks)

    # Notify seller by email
    background_tasks.add_task(
        send_new_order_email,
        seller_email=current_user.email,
        seller_name=current_user.full_name,
        shop_name=shop.name,
        order_number=new_order.order_number,
        source=new_order.source,
        customer_name=order_data.customer_name or "Walk-in Customer",
        customer_phone=order_data.customer_phone,
        items=order_items,
        subtotal=float(subtotal),
        tax_amount=float(tax_amount),
        total=float(total),
        currency=shop.currency or "AED",
    )

    return new_order


@router.get("/shops/{shop_id}/orders", response_model=List[OrderResponse])
async def get_orders(
    shop_id: int,
    status: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    month: Optional[str] = None,  # format: "2025-01"
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=2000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Order).filter(Order.shop_id == shop_id)

    if status:
        query = query.filter(Order.status == status)
    if source:
        query = query.filter(Order.source == source)
    if search:
        query = query.filter(Order.order_number.ilike(f"%{search}%"))
    if month:
        try:
            year, mon = int(month[:4]), int(month[5:7])
            month_start = datetime(year, mon, 1, tzinfo=timezone.utc)
            next_mon, next_yr = (mon + 1, year) if mon < 12 else (1, year + 1)
            month_end = datetime(next_yr, next_mon, 1, tzinfo=timezone.utc)
            query = query.filter(Order.created_at >= month_start, Order.created_at < month_end)
        except (ValueError, IndexError):
            pass

    orders = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()

    # Attach customer name/phone without N+1: batch fetch customers referenced by these orders
    customer_ids = list({o.customer_id for o in orders if o.customer_id})
    if customer_ids:
        customers = {c.id: c for c in db.query(Customer).filter(Customer.id.in_(customer_ids)).all()}
        for o in orders:
            if o.customer_id and o.customer_id in customers:
                c = customers[o.customer_id]
                o.customer_name = c.name
                o.customer_phone = c.phone
    return orders


@router.get("/shops/{shop_id}/orders/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.shop_id == shop_id
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.put("/shops/{shop_id}/orders/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: int,
    shop_id: int,
    order_data: OrderUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.shop_id == shop_id
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    update_data = order_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(order, field, value)

    db.commit()
    db.refresh(order)
    return order


@router.post("/shops/{shop_id}/orders/{order_id}/ship", response_model=OrderResponse)
async def ship_order(
    order_id: int,
    shop_id: int,
    data: ShipOrderIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark an order as shipped with tracking number and carrier."""
    order = db.query(Order).filter(Order.id == order_id, Order.shop_id == shop_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.tracking_number = data.tracking_number
    order.carrier = data.carrier
    order.estimated_delivery = data.estimated_delivery
    if data.delivery_charge is not None:
        order.delivery_charge = data.delivery_charge
    order.status = "shipped"
    order.shipped_at = datetime.now(tz=None)

    db.commit()
    db.refresh(order)

    _notify_channel_order(order_id, "shipped", db, tracking_number=data.tracking_number, tracking_courier=data.carrier)

    return order


class UpdateStatusIn(BaseModel):
    status: str


@router.patch("/shops/{shop_id}/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: int,
    shop_id: int,
    data: UpdateStatusIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update order status and notify TheDersi if it came from a channel."""
    if data.status not in _VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status. Valid values: {sorted(_VALID_STATUSES)}")

    order = db.query(Order).filter(Order.id == order_id, Order.shop_id == shop_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    previous_status = order.status

    # Restore stock on cancel regardless of payment status — stock is deducted
    # at order creation for all orders, so it must be restored on any cancel.
    # Guard against re-cancelling to avoid double-restocking.
    restocked_ids: set = set()
    if data.status == "cancelled" and previous_status != "cancelled":
        # POS / WhatsApp / online orders: stock always deducted at creation → always restore.
        # Channel orders (TheDersi, Shopify…): stock is only deducted when payment_status == "paid".
        # Restoring stock for an unpaid channel order would add phantom units that were never removed.
        stock_was_deducted = order.source in ("pos", "whatsapp", "online") or order.payment_status == "paid"
        if stock_was_deducted:
            for item in order.items:
                product = db.query(Product).filter(Product.id == item.product_id).first()
                if product:
                    product.quantity = (product.quantity or 0) + item.quantity
                    restocked_ids.add(product.id)

    order.status = data.status
    db.commit()
    db.refresh(order)

    # Push restored stock back to TheDersi so the marketplace count matches
    from app.api.v1.endpoints.channels import _bg_push_stock
    for pid in restocked_ids:
        try:
            _bg_push_stock(pid, shop_id)
        except Exception:
            pass

    _notify_channel_order(order_id, data.status, db)

    return order


@router.get("/shops/{shop_id}/orders/{order_id}/details")
async def get_order_details(
    order_id: int,
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Full order detail: items enriched with product names + channel meta if applicable."""
    order = db.query(Order).filter(Order.id == order_id, Order.shop_id == shop_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Enrich items with product names + bundle components
    enriched_items = []
    for item in order.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        is_bundle = bool(product and product.is_bundle)
        components = []
        if is_bundle:
            for c in db.query(BundleComponent).filter(BundleComponent.bundle_product_id == product.id).all():
                cp = db.query(Product).filter(Product.id == c.component_product_id).first()
                components.append({
                    "product_name": cp.name if cp else f"Product #{c.component_product_id}",
                    "qty_per_bundle": c.quantity,
                    "total_qty": c.quantity * item.quantity,
                    "variant_size": c.variant_size,
                    "variant_color": c.variant_color,
                })
        enriched_items.append({
            "id": item.id,
            "product_id": item.product_id,
            "product_name": product.name if product else f"Product #{item.product_id}",
            "product_sku": product.sku if product else None,
            "quantity": item.quantity,
            "unit_price": float(item.unit_price),
            "total_price": float(item.total_price),
            "is_bundle": is_bundle,
            "bundle_components": components,
        })

    # Channel meta (TheDersi commission, delivery, etc.)
    meta = db.query(ChannelOrderMeta).filter(ChannelOrderMeta.order_id == order.id).first()
    channel_meta = None
    if meta:
        channel_meta = {
            "channel_type": meta.channel_type,
            "channel_order_id": meta.channel_order_id,
            "seller_plan": meta.seller_plan,
            "commission_rate": float(meta.commission_rate) if meta.commission_rate else None,
            "commission_amount": float(meta.commission_amount) if meta.commission_amount else None,
            "seller_net_earnings": float(meta.seller_net_earnings) if meta.seller_net_earnings else None,
            "delivery_fee": float(meta.delivery_fee) if meta.delivery_fee else None,
            "delivery_paid_by": meta.delivery_paid_by,
            "delivery_note": meta.delivery_note,
            "items_detail": meta.items_detail,
        }

    customer = db.query(Customer).filter(Customer.id == order.customer_id).first() if order.customer_id else None

    return {
        "id": order.id,
        "order_number": order.order_number,
        "status": order.status,
        "payment_status": order.payment_status,
        "source": order.source,
        "subtotal": float(order.subtotal),
        "tax_amount": float(order.tax_amount),
        "discount_amount": float(order.discount_amount),
        "total": float(order.total),
        "notes": order.notes,
        "shipping_address": order.shipping_address,
        "gift_wrap": order.gift_wrap or False,
        "gift_wrap_fee": float(order.gift_wrap_fee or 0),
        "gift_message": order.gift_message,
        "tracking_number": order.tracking_number,
        "carrier": order.carrier,
        "shipped_at": order.shipped_at,
        "estimated_delivery": order.estimated_delivery,
        "created_at": order.created_at,
        "items": enriched_items,
        "channel_meta": channel_meta,
        "customer": {
            "name": customer.name,
            "email": customer.email,
            "phone": customer.phone,
            "address": customer.address,
        } if customer else None,
    }


class SendInvoiceIn(BaseModel):
    customer_email: Optional[str] = None  # override if not stored on customer


@router.post("/shops/{shop_id}/orders/{order_id}/send-invoice")
async def send_invoice(
    order_id: int,
    shop_id: int,
    data: SendInvoiceIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a professional HTML invoice email to the customer."""
    order = db.query(Order).filter(Order.id == order_id, Order.shop_id == shop_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    shop = db.query(Shop).filter(Shop.id == shop_id).first()

    # Determine recipient email
    recipient = data.customer_email
    customer_name = "Customer"
    if not recipient and order.customer_id:
        customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
        if customer:
            recipient = customer.email
            customer_name = customer.name or "Customer"

    if not recipient:
        raise HTTPException(status_code=400, detail="No customer email available. Pass customer_email in the request.")

    # Build enriched items (include bundle component breakdown as sub-items)
    items = []
    for item in order.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        item_dict: dict = {
            "name": product.name if product else f"Product #{item.product_id}",
            "qty": item.quantity,
            "unit_price": float(item.unit_price),
            "total": float(item.total_price),
        }
        if product and product.is_bundle:
            components = db.query(BundleComponent).filter(
                BundleComponent.bundle_product_id == product.id
            ).all()
            sub_items = []
            for c in components:
                comp = db.query(Product).filter(Product.id == c.component_product_id).first()
                if comp:
                    label = comp.name
                    parts = [p for p in [c.variant_size, c.variant_color] if p]
                    if parts:
                        label += f" ({' / '.join(parts)})"
                    label += f" × {c.quantity * item.quantity}"
                    sub_items.append(label)
            if sub_items:
                item_dict["sub_items"] = sub_items
        items.append(item_dict)

    # Delivery: orders of 10,000+ get free delivery as a gift from TheDersi;
    # smaller orders show the delivery charge the seller set at ship time.
    FREE_DELIVERY_THRESHOLD = 10000
    delivery_charge = float(order.delivery_charge or 0)
    free_delivery_label = None
    if float(order.total) >= FREE_DELIVERY_THRESHOLD:
        free_delivery_label = "Free — a gift from TheDersi 🎁"
        delivery_charge = 0

    html = build_invoice_html(
        order_number=order.order_number,
        order_date=order.created_at.strftime("%d %b %Y") if order.created_at else "",
        customer_name=customer_name,
        customer_email=recipient,
        shop_name=shop.name if shop else "ExiusCart Store",
        items=items,
        subtotal=float(order.subtotal),
        tax_amount=float(order.tax_amount),
        discount_amount=float(order.discount_amount),
        total=float(order.total),
        currency="LKR" if db.query(ChannelConnection).filter(ChannelConnection.shop_id == shop_id, ChannelConnection.channel_type == "thedersi").first() else (shop.currency if shop else "AED"),
        notes=order.notes,
        delivery_charge=delivery_charge,
        free_delivery_label=free_delivery_label,
        order_already_paid=(order.payment_status == "paid"),
        gift_wrap_fee=float(order.gift_wrap_fee or 0),
    )

    # Check invoice email limit before sending
    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    plan = sub.plan_type if sub else None
    check_and_log_email(shop_id, "invoice", plan, recipient, order.id, db)

    sent = send_email(
        to=recipient,
        subject=f"Your Invoice — {order.order_number}",
        html_body=html,
        from_email=_FROM_BILLING,
    )

    return {
        "sent": sent,
        "recipient": recipient,
        "order_number": order.order_number,
        "message": "Invoice sent successfully" if sent else "Email queued (SES disabled — enable AWS_SES_ENABLED=true to send real emails)",
    }


@router.get("/shops/{shop_id}/orders/{order_id}/tracking")
async def get_tracking(
    order_id: int,
    shop_id: int,
    db: Session = Depends(get_db),
):
    """Public-ish tracking info — no auth required so customers can check status."""
    order = db.query(Order).filter(Order.id == order_id, Order.shop_id == shop_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return {
        "order_number": order.order_number,
        "status": order.status,
        "carrier": order.carrier,
        "tracking_number": order.tracking_number,
        "shipped_at": order.shipped_at,
        "estimated_delivery": order.estimated_delivery,
    }
