"""Small helpers for building the minimum valid rows a test needs — not a
full factory framework, just enough to keep test bodies readable."""
import itertools
from app.models.user import User
from app.models.shop import Shop
from app.models.affiliate import Affiliate, Commission

_counter = itertools.count(1)


def make_user(db, **overrides):
    n = next(_counter)
    user = User(
        email=overrides.pop("email", f"user{n}@test.local"),
        hashed_password="not-a-real-hash",
        full_name=overrides.pop("full_name", f"Test User {n}"),
        **overrides,
    )
    db.add(user)
    db.flush()
    return user


def make_shop(db, owner, **overrides):
    n = next(_counter)
    shop = Shop(
        name=overrides.pop("name", f"Test Shop {n}"),
        slug=overrides.pop("slug", f"test-shop-{n}"),
        owner_id=owner.id,
        **overrides,
    )
    db.add(shop)
    db.flush()
    return shop


def make_affiliate(db, **overrides):
    n = next(_counter)
    affiliate = Affiliate(
        name=overrides.pop("name", f"Affiliate {n}"),
        email=overrides.pop("email", f"affiliate{n}@test.local"),
        referral_code=overrides.pop("referral_code", f"REF{n}"),
        status=overrides.pop("status", "active"),
        payout_method=overrides.pop("payout_method", "paypal"),
        paypal_email=overrides.pop("paypal_email", f"affiliate{n}@paypal.test"),
        **overrides,
    )
    db.add(affiliate)
    db.flush()
    return affiliate


def make_commission(db, affiliate, shop, **overrides):
    commission = Commission(
        affiliate_id=affiliate.id,
        shop_id=shop.id,
        amount=overrides.pop("amount", "60.00"),
        status=overrides.pop("status", "approved"),
        **overrides,
    )
    db.add(commission)
    db.flush()
    return commission
