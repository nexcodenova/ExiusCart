"""Regression tests for the payout-linking bug fixed earlier this session:
a PayoutRequest must lock in exactly which commissions it covers at creation
time, and paying it must only ever settle those linked commissions — never
"whatever is currently approved," which could include commissions approved
after the request was made, or exclude ones reversed since."""
from app.api.v1.endpoints.affiliates import request_payout
from app.api.v1.endpoints.admin import pay_payout_request
from app.models.affiliate import PayoutRequest
from tests.factories import make_user, make_shop, make_affiliate, make_commission


def test_request_payout_links_only_approved_unlinked_commissions(db):
    user = make_user(db)
    shop = make_shop(db, owner=user)
    affiliate = make_affiliate(db)
    linkable = make_commission(db, affiliate, shop, amount="60.00", status="approved")
    make_commission(db, affiliate, shop, amount="60.00", status="approved")

    # Some other, already-existing payout request already claimed this one.
    other_request = PayoutRequest(affiliate_id=affiliate.id, amount="999.00", status="paid")
    db.add(other_request)
    db.flush()
    already_linked = make_commission(db, affiliate, shop, amount="999.00", status="approved")
    already_linked.payout_request_id = other_request.id

    not_yet_approved = make_commission(db, affiliate, shop, amount="500.00", status="pending")
    db.commit()

    result = request_payout(affiliate=affiliate, db=db)

    assert result["amount"] == 120.00  # only the two unlinked, approved $60 commissions
    db.refresh(linkable)
    assert linkable.payout_request_id == result["id"]
    db.refresh(already_linked)
    assert already_linked.payout_request_id == other_request.id  # untouched
    db.refresh(not_yet_approved)
    assert not_yet_approved.payout_request_id is None  # never eligible, still untouched


def test_request_payout_rejects_below_minimum(db):
    user = make_user(db)
    shop = make_shop(db, owner=user)
    affiliate = make_affiliate(db)
    make_commission(db, affiliate, shop, amount="50.00", status="approved")
    db.commit()

    import pytest
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        request_payout(affiliate=affiliate, db=db)
    assert exc.value.status_code == 422


def test_paying_a_request_ignores_commissions_approved_afterward(db):
    """The exact bug scenario: a request is created covering two commissions,
    then a THIRD commission gets approved before the request is paid. Paying
    the request must settle only the original two, not sweep in the third."""
    user = make_user(db)
    shop = make_shop(db, owner=user)
    affiliate = make_affiliate(db)
    make_commission(db, affiliate, shop, amount="60.00", status="approved")
    make_commission(db, affiliate, shop, amount="60.00", status="approved")
    db.commit()

    result = request_payout(affiliate=affiliate, db=db)

    # A new commission approved AFTER the request was created — must not be
    # swept into this payout just because it's "currently approved."
    later_commission = make_commission(db, affiliate, shop, amount="200.00", status="approved")
    db.commit()

    pay_payout_request(request_id=result["id"], db=db, _=None)

    db.refresh(later_commission)
    assert later_commission.status == "approved"  # untouched, not paid
    assert later_commission.payout_request_id is None


def test_paying_a_request_excludes_commissions_reversed_since(db):
    user = make_user(db)
    shop = make_shop(db, owner=user)
    affiliate = make_affiliate(db)
    kept = make_commission(db, affiliate, shop, amount="60.00", status="approved")
    refunded = make_commission(db, affiliate, shop, amount="60.00", status="approved")
    db.commit()

    result = request_payout(affiliate=affiliate, db=db)

    # A refund comes in on one of the two linked commissions before the
    # payout is actually paid out.
    refunded.status = "reversed"
    db.commit()

    pay_payout_request(request_id=result["id"], db=db, _=None)

    db.refresh(kept)
    assert kept.status == "paid"
    db.refresh(refunded)
    assert refunded.status == "reversed"  # excluded, not overwritten to "paid"
