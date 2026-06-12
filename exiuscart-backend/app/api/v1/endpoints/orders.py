from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import uuid
from app.core.database import get_db
from app.models.user import User
from app.models.shop import Shop
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.channel_order_meta import ChannelOrderMeta
from app.models.customer import Customer
from app.schemas.order import OrderCreate, OrderResponse, OrderUpdate, ShipOrderIn
from app.api.v1.deps import get_current_user
from app.api.v1.endpoints.channels import trigger_stock_sync
from app.core.email import send_email, build_invoice_html, _FROM_BILLING

router = APIRouter()


def generate_order_number() -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M")
    unique = uuid.uuid4().hex[:4].upper()
    return f"ORD-{timestamp}-{unique}"


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
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

    # Calculate totals
    subtotal = 0
    order_items = []

    for item in order_data.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

        item_total = item.quantity * item.unit_price
        subtotal += item_total

        order_items.append({
            "product_id": item.product_id,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "total_price": item_total
        })

        # Update inventory
        product.quantity = max(0, product.quantity - item.quantity)

    # Calculate tax (5% VAT for UAE)
    tax_amount = subtotal * 0.05
    total = subtotal + tax_amount

    # Create order
    new_order = Order(
        order_number=generate_order_number(),
        shop_id=shop_id,
        customer_id=order_data.customer_id,
        source=order_data.source,
        subtotal=subtotal,
        tax_amount=tax_amount,
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

    return new_order


@router.get("/", response_model=List[OrderResponse])
async def get_orders(
    shop_id: int,
    status: Optional[str] = None,
    source: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Order).filter(Order.shop_id == shop_id)

    if status:
        query = query.filter(Order.status == status)
    if source:
        query = query.filter(Order.source == source)

    orders = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    return orders


@router.get("/{order_id}", response_model=OrderResponse)
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


@router.put("/{order_id}", response_model=OrderResponse)
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


@router.post("/{order_id}/ship", response_model=OrderResponse)
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
    order.status = "shipped"
    order.shipped_at = datetime.now(tz=None)

    db.commit()
    db.refresh(order)
    return order


@router.get("/{order_id}/details")
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

    # Enrich items with product names
    enriched_items = []
    for item in order.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        enriched_items.append({
            "id": item.id,
            "product_id": item.product_id,
            "product_name": product.name if product else f"Product #{item.product_id}",
            "product_sku": product.sku if product else None,
            "quantity": item.quantity,
            "unit_price": float(item.unit_price),
            "total_price": float(item.total_price),
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
        "tracking_number": order.tracking_number,
        "carrier": order.carrier,
        "shipped_at": order.shipped_at,
        "estimated_delivery": order.estimated_delivery,
        "created_at": order.created_at,
        "items": enriched_items,
        "channel_meta": channel_meta,
    }


class SendInvoiceIn(BaseModel):
    customer_email: Optional[str] = None  # override if not stored on customer


@router.post("/{order_id}/send-invoice")
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

    # Build enriched items
    items = []
    for item in order.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        items.append({
            "name": product.name if product else f"Product #{item.product_id}",
            "qty": item.quantity,
            "unit_price": float(item.unit_price),
            "total": float(item.total_price),
        })

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
        currency=shop.currency if shop else "AED",
        notes=order.notes,
    )

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


@router.get("/{order_id}/tracking")
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
