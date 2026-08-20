import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload
from app.core.database import get_db
from app.models.shop import Shop
from app.models.product import Product
from app.models.product_fields import ProductImage
from app.models.reservation import Reservation
from app.models.order import Order
from app.models.user import User
from app.models.email_otp import EmailOTP
from app.models.email_log import EmailLog
from app.models.affiliate import Affiliate

logger = logging.getLogger(__name__)

router = APIRouter()


def _first_image(db: Session, product_id: int) -> str | None:
    img = db.query(ProductImage).filter(
        ProductImage.product_id == product_id
    ).order_by(ProductImage.sort_order).first()
    return img.url if img else None


@router.get("/public/store/{shop_slug}/categories")
def public_store_categories(shop_slug: str, channel: str = "custom", db: Session = Depends(get_db)):
    """No-auth — a custom storefront's category nav/grid reads this
    directly, live, instead of the storefront keeping its own copy.
    First real piece of the public storefront API described for the
    'ExiusCart is the whole backend, the site is just a frontend' plan."""
    from app.models.storefront_category import StorefrontCategory, STOREFRONT_CATEGORY_CHANNELS

    if channel not in STOREFRONT_CATEGORY_CHANNELS:
        raise HTTPException(status_code=400, detail=f"channel must be one of: {', '.join(STOREFRONT_CATEGORY_CHANNELS)}")

    shop = db.query(Shop).filter(Shop.slug == shop_slug, Shop.is_active == True).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Store not found")

    rows = db.query(StorefrontCategory).filter(
        StorefrontCategory.shop_id == shop.id,
        StorefrontCategory.channel_type == channel,
    ).order_by(StorefrontCategory.sort_order).all()
    return [
        {"id": r.id, "name": r.name, "slug": r.slug, "icon_url": r.icon_url, "parent_id": r.parent_id}
        for r in rows
    ]


def _custom_connection(shop_id: int, db: Session):
    from app.models.channel import ChannelConnection
    return db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id, ChannelConnection.channel_type == "custom", ChannelConnection.is_active == True,
    ).first()


def _ratings_by_product(product_ids: list[int], db: Session) -> dict[int, dict]:
    """Average rating + count of *approved* reviews only, one grouped query
    for the whole product list — avoids an N+1 query per product."""
    if not product_ids:
        return {}
    from app.models.review import ProductReview
    rows = (
        db.query(ProductReview.product_id, func.avg(ProductReview.rating), func.count(ProductReview.id))
        .filter(
            ProductReview.product_id.in_(product_ids),
            ProductReview.status == "approved",
        )
        .group_by(ProductReview.product_id)
        .all()
    )
    return {
        product_id: {"avg_rating": round(float(avg), 1) if avg is not None else None, "review_count": count}
        for product_id, avg, count in rows
    }


def _product_out(p: Product, category_id: str | None = None, category_slug: str | None = None, tier_field_id: str | None = None, rating: dict | None = None, source_currency: str = "USD", target_currency: str | None = None) -> dict:
    from app.core.currency import convert_amount_sync
    target_currency = target_currency or source_currency

    def _conv(amount) -> float:
        return convert_amount_sync(float(amount), source_currency, target_currency)

    images = [img.url for img in sorted(p.images, key=lambda i: i.sort_order)] if p.images else ([] if not p.image_url else [p.image_url])
    # Pulled out of custom_fields into its own top-level key, in the exact
    # shape the storefront needs to render it directly — quantity, the
    # TOTAL price for that quantity (see _tiered_unit_price in checkout.py,
    # same "3 for $25" semantics, not per-unit), plus optional label/badge/
    # recommended for display. No storefront has to separately fetch this
    # shop's field definitions just to find which custom_fields key holds it.
    quantity_tiers = []
    if tier_field_id and p.custom_field_values:
        raw_tiers = p.custom_field_values.get(tier_field_id) or []
        quantity_tiers = [
            {
                "quantity": t.get("quantity"),
                "price": _conv(t["price"]) if t.get("price") is not None else None,
                "label": t.get("label") or None,
                "badge": t.get("badge") or None,
                "badge_type": t.get("badge_type") or None,
                "recommended": bool(t.get("recommended")),
            }
            for t in raw_tiers
        ]
    return {
        "id": p.id,
        "name": p.name,
        "slug": p.slug,
        "description": p.description,
        # target_currency defaults to the shop's base_currency (see
        # Shop.currency's own comment) unless the seller opted into real
        # conversion via Shop.storefront_currency — either way, every price
        # below is ALREADY in this currency, not just labeled with it, so a
        # storefront doesn't need its own conversion logic at all.
        "currency": target_currency,
        "price": _conv(p.price),
        "compare_at_price": _conv(p.compare_at_price) if p.compare_at_price is not None else None,
        "in_stock": (p.quantity or 0) > 0,
        "quantity": p.quantity or 0,
        "images": images,
        # Legacy single field — still set by the internal Prodora import
        # pipeline, untouched. `videos` below is the new seller-manageable
        # multi-video list (YouTube/TikTok, oEmbed-resolved) — both can be
        # present; a storefront wanting the richer gallery should prefer
        # `videos`.
        "video_url": p.video_url,
        "videos": [
            {
                "url": v.url,
                "platform": v.platform,
                "thumbnail_url": v.thumbnail_url,
                "title": v.title,
                "embed_html": v.embed_html,
            }
            for v in sorted(p.videos, key=lambda v: v.sort_order)
        ] if p.videos else [],
        "tags": [t.strip() for t in p.tags.split(",")] if p.tags else [],
        # Size/color options — never exposed here before, so no Custom
        # Website storefront could render a variant picker or show a
        # variant's own image/stock/price. Same shape channels.py already
        # sends to marketplace channels (see _product_payload there).
        "variants": [
            {
                "id": v.id,
                "size": v.size,
                "color": v.color,
                "color_hex": v.color_hex,
                "sku": v.sku,
                "quantity": v.quantity or 0,
                "in_stock": (v.quantity or 0) > 0,
                "price": _conv(v.price) if v.price is not None else None,
                "image_url": v.image_url,
            }
            for v in p.variants
        ] if p.variants else [],
        "category_id": int(category_id) if category_id else None,
        # The real, linkable slug for category_id above (e.g. "electronics-a1b2c3")
        # — resolved here so every storefront gets a working category link/
        # breadcrumb for free, instead of each one having to separately fetch
        # the full category list and look up the id itself.
        "category_slug": category_slug,
        "quantity_tiers": quantity_tiers,
        # Just the summary (average + count) — full review text/photos come
        # from the dedicated /products/{slug}/reviews endpoint below, so a
        # product list response doesn't balloon with every review's text.
        "avg_rating": (rating or {}).get("avg_rating"),
        "review_count": (rating or {}).get("review_count", 0),
        # Real, earned social proof for products with no reviews yet — never
        # fabricated or estimated. view_count is raw page-load hits (not
        # unique visitors), incremented in public_store_product_detail below.
        # units_sold mirrors whatever "counts as sold" already means in the
        # order pipeline (see the units_sold column comment on Product).
        "view_count": p.view_count or 0,
        "units_sold": p.units_sold or 0,
        "custom_fields": p.custom_field_values or {},
    }


@router.get("/public/store/{shop_slug}/products")
def public_store_products(
    shop_slug: str,
    search: str | None = None,
    featured: bool | None = None,
    trending: bool | None = None,
    category: str | None = None,
    db: Session = Depends(get_db),
):
    """No-auth — a custom storefront's product listing reads this directly,
    live, same pattern as public_store_categories above."""
    from app.models.channel_category import ProductChannelCategory
    from app.models.storefront_category import StorefrontCategory
    from app.models.custom_product_fields import CustomProductFieldSettings

    shop = db.query(Shop).filter(Shop.slug == shop_slug, Shop.is_active == True).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Store not found")

    field_settings = db.query(CustomProductFieldSettings).filter(CustomProductFieldSettings.shop_id == shop.id).first()
    tier_field_id = next((f["id"] for f in (field_settings.fields if field_settings else []) or [] if f.get("type") == "quantity_tiers"), None)

    conn = _custom_connection(shop.id, db)
    category_map: dict[int, str] = {}
    # Opt-in, not opt-out: a product only shows on the storefront if it has
    # an explicit is_listed=True row for this connection. A product that's
    # never been individually opened+saved with Custom Website active (e.g.
    # bulk-imported products) has NO row at all — that must mean "not
    # listed," not "assume it's fine to show."
    listed_ids: set[int] | None = None
    category_filter_ids: set[int] | None = None

    if conn:
        listed_ids = set()
        rows = db.query(ProductChannelCategory).filter(ProductChannelCategory.channel_connection_id == conn.id).all()
        for r in rows:
            if r.is_listed:
                listed_ids.add(r.product_id)
                if r.channel_category_id:
                    category_map[r.product_id] = r.channel_category_id
        if category:
            cat = db.query(StorefrontCategory).filter(StorefrontCategory.shop_id == shop.id, StorefrontCategory.slug == category).first()
            if not cat:
                return []
            category_filter_ids = {pid for pid, cid in category_map.items() if cid == str(cat.id)}

    q = db.query(Product).options(
        selectinload(Product.images), selectinload(Product.videos), selectinload(Product.variants),
    ).filter(Product.shop_id == shop.id, Product.is_active == True)
    if search:
        q = q.filter(Product.name.ilike(f"%{search}%"))
    if featured:
        q = q.filter(Product.is_featured == True)
    if trending:
        q = q.filter(Product.is_trending == True)
    products = q.order_by(Product.created_at.desc()).all()

    if listed_ids is not None:
        products = [p for p in products if p.id in listed_ids]
    if category_filter_ids is not None:
        products = [p for p in products if p.id in category_filter_ids]

    # Resolve each referenced StorefrontCategory id to its real slug in one
    # batch query, so every product in the response carries a working
    # category link — not just the internal id.
    slug_by_cat_id: dict[str, str] = {}
    referenced_ids = {int(cid) for cid in category_map.values()}
    if referenced_ids:
        cats = db.query(StorefrontCategory).filter(StorefrontCategory.id.in_(referenced_ids)).all()
        slug_by_cat_id = {str(c.id): c.slug for c in cats}

    ratings = _ratings_by_product([p.id for p in products], db)
    source_currency = shop.base_currency or shop.currency or "USD"
    target_currency = shop.storefront_currency or source_currency

    return [
        _product_out(
            p, category_map.get(p.id), slug_by_cat_id.get(category_map.get(p.id) or ""), tier_field_id,
            rating=ratings.get(p.id), source_currency=source_currency, target_currency=target_currency,
        )
        for p in products
    ]


@router.get("/public/store/{shop_slug}/products/{slug}")
def public_store_product_detail(shop_slug: str, slug: str, db: Session = Depends(get_db)):
    """No-auth — single product detail for a storefront's PDP."""
    from app.models.channel_category import ProductChannelCategory
    from app.models.storefront_category import StorefrontCategory
    from app.models.custom_product_fields import CustomProductFieldSettings

    shop = db.query(Shop).filter(Shop.slug == shop_slug, Shop.is_active == True).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Store not found")

    field_settings = db.query(CustomProductFieldSettings).filter(CustomProductFieldSettings.shop_id == shop.id).first()
    tier_field_id = next((f["id"] for f in (field_settings.fields if field_settings else []) or [] if f.get("type") == "quantity_tiers"), None)

    product = db.query(Product).filter(
        Product.shop_id == shop.id, Product.slug == slug, Product.is_active == True,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    category_id = None
    conn = _custom_connection(shop.id, db)
    if conn:
        pcc = db.query(ProductChannelCategory).filter(
            ProductChannelCategory.product_id == product.id, ProductChannelCategory.channel_connection_id == conn.id,
        ).first()
        # Same opt-in rule as the list endpoint above: no row at all means
        # "never listed," not "assume it's fine to show."
        if not pcc or not pcc.is_listed:
            raise HTTPException(status_code=404, detail="Product not found")
        category_id = pcc.channel_category_id

    category_slug = None
    if category_id:
        cat = db.query(StorefrontCategory).filter(StorefrontCategory.id == int(category_id)).first()
        category_slug = cat.slug if cat else None

    # Raw page-load hits, not unique visitors — every real request to this
    # endpoint is one more view, on purpose (see the view_count column
    # comment on Product). Counted only once gating above has already
    # passed, so a 404'd/not-listed product's blocked requests don't count.
    product.view_count = (product.view_count or 0) + 1
    db.commit()

    rating = _ratings_by_product([product.id], db).get(product.id)
    source_currency = shop.base_currency or shop.currency or "USD"
    target_currency = shop.storefront_currency or source_currency
    return _product_out(product, category_id, category_slug, tier_field_id, rating=rating, source_currency=source_currency, target_currency=target_currency)


def _approved_reviews_out(product_id: int, db: Session) -> list[dict]:
    from app.models.review import ProductReview
    reviews = db.query(ProductReview).filter(
        ProductReview.product_id == product_id,
        ProductReview.status == "approved",
    ).order_by(ProductReview.submitted_at.desc()).limit(200).all()
    return [
        {
            "id": r.id,
            "customer_name": r.customer_name,
            "rating": r.rating,
            "comment": r.comment,
            "photo_url": r.photo_url,
            "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
        }
        for r in reviews
    ]


@router.get("/public/store/{shop_slug}/products/{slug}/reviews")
def public_store_product_reviews(shop_slug: str, slug: str, db: Session = Depends(get_db)):
    """No-auth — approved reviews for one product's PDP. Separate from the
    product detail response so a storefront that just needs the list/PDP
    summary isn't forced to download every review's full text every time."""
    shop = db.query(Shop).filter(Shop.slug == shop_slug, Shop.is_active == True).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Store not found")

    product = db.query(Product).filter(
        Product.shop_id == shop.id, Product.slug == slug, Product.is_active == True,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return _approved_reviews_out(product.id, db)


# ── Storefront customer auth (Custom Website channel only) ──────────────────
#
# A shopper account on the seller's OWN storefront — separate from
# ExiusCart's own seller/User login. Tokens are signed with the same
# JWT_SECRET_KEY as seller tokens (one shared secret app-wide) so every
# token here carries type="customer", checked by get_current_customer
# (app/api/v1/deps.py) — and get_current_user explicitly rejects that
# claim, so a customer token can never authenticate as a seller.

class CustomerSignupIn(BaseModel):
    name: str
    email: str
    password: str


class CustomerLoginIn(BaseModel):
    email: str
    password: str


def _customer_out(c) -> dict:
    return {"id": c.id, "name": c.name, "email": c.email}


@router.post("/public/store/{shop_slug}/auth/signup")
def public_store_signup(shop_slug: str, data: CustomerSignupIn, db: Session = Depends(get_db)):
    from app.core.security import get_password_hash, create_access_token
    from app.models.customer import Customer

    shop = db.query(Shop).filter(Shop.slug == shop_slug, Shop.is_active == True).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Store not found")

    email = data.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=422, detail="A valid email is required.")
    if len(data.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")

    existing = db.query(Customer).filter(
        Customer.shop_id == shop.id, func.lower(Customer.email) == email,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    customer = Customer(
        shop_id=shop.id,
        name=data.name.strip() or "Customer",
        email=email,
        password_hash=get_password_hash(data.password),
        # Same channel as a Custom Website guest checkout — "did they make an
        # account" is a separate question already answered by password_hash
        # being set, not something that needs its own top-level channel value.
        source="custom",
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)

    token = create_access_token({"sub": str(customer.id), "type": "customer", "shop_id": shop.id})
    return {"token": token, "customer": _customer_out(customer)}


@router.post("/public/store/{shop_slug}/auth/login")
def public_store_login(shop_slug: str, data: CustomerLoginIn, db: Session = Depends(get_db)):
    from app.core.security import verify_password, create_access_token
    from app.models.customer import Customer

    shop = db.query(Shop).filter(Shop.slug == shop_slug, Shop.is_active == True).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Store not found")

    email = data.email.strip().lower()
    customer = db.query(Customer).filter(
        Customer.shop_id == shop.id, func.lower(Customer.email) == email,
    ).first()
    if not customer or not customer.password_hash or not verify_password(data.password, customer.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    if not customer.is_active:
        raise HTTPException(status_code=403, detail="This account is deactivated.")

    token = create_access_token({"sub": str(customer.id), "type": "customer", "shop_id": shop.id})
    return {"token": token, "customer": _customer_out(customer)}


@router.get("/public/stats")
def public_stats(db: Session = Depends(get_db)):
    """No-auth endpoint — returns live platform stats for the marketing site."""
    orders_processed = db.query(Order).count()
    emails_generated = db.query(EmailLog).count()
    products_added = db.query(Product).count()
    return {
        "orders_processed": orders_processed,
        "emails_generated": emails_generated,
        "products_added": products_added,
    }


@router.get("/public/check-ref/{code}")
def check_ref(code: str, db: Session = Depends(get_db)):
    """No-auth endpoint — validates whether an affiliate referral code is active."""
    affiliate = db.query(Affiliate).filter(
        Affiliate.referral_code == code,
        Affiliate.status == "approved",
    ).first()
    return {"valid": affiliate is not None}


@router.get("/public/product/{barcode}")
def public_product_info(barcode: str, db: Session = Depends(get_db)):
    """No-auth endpoint — returns product info for QR code public pages."""
    product = db.query(Product).filter(Product.barcode == barcode).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    shop = db.query(Shop).filter(Shop.id == product.shop_id).first()

    # Active reservations for this product
    active_reservations = db.query(Reservation).filter(
        Reservation.product_id == product.id,
        Reservation.status == "active",
    ).order_by(Reservation.created_at.asc()).all()

    reserved_qty = sum(r.quantity for r in active_reservations)
    available = max(0, (product.quantity or 0) - reserved_qty)

    reservations_list = [
        {
            "id": r.id,
            "customer_name": r.customer_name,
            "quantity": r.quantity,
            "reservation_type": r.reservation_type,
            "advance_amount": float(r.advance_amount) if r.advance_amount else None,
            "lpo_number": r.lpo_number,
            "notes": r.notes,
            "expires_at": r.expires_at.isoformat() if r.expires_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in active_reservations
    ]

    return {
        "name": product.name,
        "sku": product.sku,
        "barcode": product.barcode,
        "price": float(product.price) if product.price else 0,
        "currency": shop.currency if shop else "AED",
        "stock": product.quantity or 0,
        "reserved": int(reserved_qty),
        "available": int(available),
        "shop_name": shop.name if shop else "",
        "image_url": product.image_url or _first_image(db, product.id),
        "category": product.category.name if product.category else None,
        "reservations": reservations_list,
    }


@router.get("/public/reservation/{reservation_id}")
def public_reservation_info(reservation_id: int, db: Session = Depends(get_db)):
    """No-auth endpoint — returns reservation info for QR code public pages."""
    r = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reservation not found")

    shop = db.query(Shop).filter(Shop.id == r.shop_id).first()

    product_stock = None
    product_reserved = None
    if r.product_id:
        product = db.query(Product).filter(Product.id == r.product_id).first()
        if product:
            total_reserved = db.query(func.sum(Reservation.quantity)).filter(
                Reservation.product_id == product.id,
                Reservation.status == "active",
            ).scalar() or 0
            product_stock = product.quantity or 0
            product_reserved = int(total_reserved)

    return {
        "id": r.id,
        "customer_name": r.customer_name,
        "customer_phone": r.customer_phone,
        "product_name": r.product_name,
        "quantity": r.quantity,
        "reservation_type": r.reservation_type,
        "status": r.status,
        "advance_amount": float(r.advance_amount) if r.advance_amount else None,
        "notes": r.notes,
        "lpo_number": r.lpo_number,
        "expires_at": r.expires_at.isoformat() if r.expires_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "shop_name": shop.name if shop else "",
        "currency": shop.currency if shop else "AED",
        "product_stock": product_stock,
        "product_reserved": product_reserved,
    }


# ── Social Media Lead Capture (no auth — token in URL) ────────────────────────

def _shop_by_token(token: str, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.lead_capture_token == token).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Invalid capture token")
    return shop


def _plan_eligible(shop: Shop, db: Session) -> bool:
    from app.models.subscription import Subscription
    from app.api.v1.endpoints.marketing import SOCIAL_LEAD_PLANS
    sub = db.query(Subscription).filter(Subscription.shop_id == shop.id).order_by(Subscription.id.desc()).first()
    plan = sub.plan_type if sub else "free_trial"
    return plan in SOCIAL_LEAD_PLANS


def _save_lead(shop_id: int, name: str, email: str, phone: str, company: str, source: str, db: Session):
    from app.models.marketing import ShopLead
    from app.api.v1.endpoints.marketing import LEAD_LIMITS
    from app.models.subscription import Subscription
    from sqlalchemy import func as sql_func

    # A public capture surface (popup, signup form) can be resubmitted by
    # the same visitor — refreshing the page, double-clicking submit, etc.
    # Without this, every resubmission burned another slot against the
    # shop's plan-limited lead quota. Treat a repeat email as the same
    # lead rather than creating a duplicate row.
    if email:
        existing = db.query(ShopLead).filter(
            ShopLead.shop_id == shop_id,
            sql_func.lower(ShopLead.email) == email.strip().lower(),
        ).first()
        if existing:
            return existing

    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    plan = sub.plan_type if sub else "free_trial"
    limit = LEAD_LIMITS.get(plan)
    if limit is not None:
        count = db.query(sql_func.count(ShopLead.id)).filter(ShopLead.shop_id == shop_id).scalar() or 0
        if count >= limit:
            logger.info(f"[LEAD CAPTURE] shop={shop_id} at limit ({count}/{limit}) — lead skipped")
            return None
    lead = ShopLead(shop_id=shop_id, name=name or "Unknown", email=email or None,
                    phone=phone or None, company=company or None, source=source, status="new")
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


# ── Google Ads ────────────────────────────────────────────────────────────────

@router.get("/public/lead-capture/{token}")
def google_ads_verify(token: str, google_key: str = None, db: Session = Depends(get_db)):
    """Google Ads pings this URL (GET) before activating the webhook. Must return 200."""
    _shop_by_token(token, db)
    return {"status": "ok"}


@router.post("/public/lead-capture/{token}")
async def google_ads_lead(token: str, request: Request, db: Session = Depends(get_db)):
    """
    Google Ads Lead Form webhook (POST).
    Google sends lead data here whenever someone submits an in-ad lead form.
    Payload: { "user_column_data": [{"column_name": "FULL_NAME", "string_value": "..."}] }
    """
    shop = _shop_by_token(token, db)
    if not _plan_eligible(shop, db):
        return {"status": "plan_not_eligible"}

    try:
        body = await request.json()
    except Exception:
        body = {}

    name = email = phone = company = ""

    # Parse Google's user_column_data format
    for col in body.get("user_column_data", []):
        cn = (col.get("column_name") or "").upper()
        val = col.get("string_value") or ""
        if cn == "FULL_NAME":
            name = val
        elif cn == "FIRST_NAME":
            name = val
        elif cn == "LAST_NAME":
            name = f"{name} {val}".strip()
        elif cn == "EMAIL":
            email = val
        elif cn == "PHONE_NUMBER":
            phone = val
        elif cn in ("COMPANY_NAME", "COMPANY"):
            company = val

    # Fallback: key_value_data format (older Google Ads API)
    if not name:
        for kv in body.get("key_value_data", []):
            k = (kv.get("key") or "").upper()
            v = kv.get("value") or ""
            if k in ("FULL_NAME", "FIRST_NAME"):
                name = v
            elif k == "EMAIL":
                email = v
            elif k == "PHONE_NUMBER":
                phone = v

    if not name:
        name = f"Google Lead #{body.get('lead_id', 'unknown')}"

    lead = _save_lead(shop.id, name, email, phone, company, "google_ads", db)
    logger.info(f"[LEAD CAPTURE] Google Ads → shop={shop.id} name={name} lead_id={lead.id if lead else 'skipped'}")
    return {"status": "ok"}


# ── Public Quotation (client view + accept/reject) ────────────────────────────

@router.get("/public/quotation/{token}")
def public_quotation_view(token: str, db: Session = Depends(get_db)):
    """No-auth endpoint — client views their quotation via share link."""
    from app.models.quotation import Quotation
    q = db.query(Quotation).filter(Quotation.client_token == token).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    shop = q.shop
    return {
        "quote_number": q.quote_number,
        "shop_name": shop.name if shop else "",
        "shop_logo": shop.logo_url if shop else None,
        "currency": shop.currency if shop else "AED",
        "customer_name": q.customer_name,
        "customer_email": q.customer_email,
        "customer_phone": q.customer_phone,
        "items": q.items,
        "subtotal": float(q.subtotal),
        "discount": float(q.discount),
        "tax": float(q.tax),
        "tax_rate": float(q.tax_rate or 0),
        "tax_type": q.tax_type or "fixed",
        "total": float(q.total),
        "notes": q.notes,
        "terms": q.terms,
        "payment_schedule": q.payment_schedule,
        "company_address": q.company_address,
        "company_trn": q.company_trn,
        "company_bank": q.company_bank,
        "status": q.status,
        "valid_until": q.valid_until.isoformat() if q.valid_until else None,
        "created_at": q.created_at.isoformat() if q.created_at else None,
        "client_accepted_name": q.client_accepted_name,
        "client_accepted_at": q.client_accepted_at.isoformat() if q.client_accepted_at else None,
    }


@router.post("/public/quotation/{token}/respond")
async def public_quotation_respond(token: str, request: Request, db: Session = Depends(get_db)):
    """No-auth endpoint — client accepts or rejects quotation via share link."""
    from app.models.quotation import Quotation
    from datetime import datetime, timezone
    q = db.query(Quotation).filter(Quotation.client_token == token).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if q.status not in ("pending",):
        raise HTTPException(status_code=400, detail="This quotation has already been responded to")
    try:
        body = await request.json()
    except Exception:
        body = {}
    action = body.get("action")
    if action not in ("accept", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'accept' or 'reject'")
    q.status = "accepted" if action == "accept" else "rejected"
    q.client_accepted_at = datetime.now(timezone.utc)
    q.client_accepted_name = body.get("name") or q.customer_name
    db.commit()
    return {"status": q.status}
