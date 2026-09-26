"""Custom sending domains (Scale plan) and email monitoring.

Three jobs, all built on Amazon SES:

  1. Register a seller's domain with SES (DKIM), so their customers see
     `invoices@theirshop.com` instead of our shared address.
  2. Record every email we send (EmailEvent) and update it from the delivery
     notifications SES pushes back (delivered / bounced / complained ...).
  3. Protect our sending reputation: stop mailing addresses that bounced or
     complained, and switch a shop's marketing mail (and custom domain) off when
     its bounce or complaint rate gets too high.

SES is reached with API credentials from the environment (SES_API_ACCESS_KEY_ID,
SES_API_SECRET_ACCESS_KEY, SES_REGION). Notifications arrive through an SNS topic
pointed at /api/v1/webhooks/ses; SES_CONFIGURATION_SET names the SES configuration
set that publishes them. Without those settings the feature reports "not set up"
instead of failing, and mail keeps going out from the shared address.
"""
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.email_monitor import EmailDomain, EmailEvent, EmailShopControl, EmailSuppression

logger = logging.getLogger(__name__)

SES_REGION = os.getenv("SES_REGION", "ap-southeast-1")
SES_ACCESS_KEY = os.getenv("SES_API_ACCESS_KEY_ID", "")
SES_SECRET_KEY = os.getenv("SES_API_SECRET_ACCESS_KEY", "")
SES_CONFIGURATION_SET = os.getenv("SES_CONFIGURATION_SET", "")
SES_SNS_TOPIC_ARN = os.getenv("SES_SNS_TOPIC_ARN", "")

# Auto-protection: judged over the last WINDOW_DAYS days, only once there are enough
# emails to mean something. (SES itself reviews accounts at 5% bounces and 0.1%
# complaints and pauses them at 10% and 0.5%; we act at 5% and 0.5% per shop.)
WINDOW_DAYS = 7
MIN_SAMPLE = int(os.getenv("EMAIL_MIN_SAMPLE", "50"))
BOUNCE_LIMIT = float(os.getenv("EMAIL_BOUNCE_LIMIT", "0.05"))
COMPLAINT_LIMIT = float(os.getenv("EMAIL_COMPLAINT_LIMIT", "0.005"))

# A seller can't send as these: the domains are ours, or they are free mailboxes nobody can sign.
OUR_DOMAINS = ("exiuscart.com", "thedersi.lk", "thedersi.com", "prodora.com", "amazonses.com", "amazonaws.com")
FREE_MAIL = {
    "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "outlook.com", "hotmail.com", "live.com", "msn.com",
    "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "mail.com", "zoho.com", "yandex.com",
}
_DOMAIN_RE = re.compile(r"^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$")
_LOCAL_RE = re.compile(r"^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$")
_EMAIL_RE = re.compile(r"^[^@\s<>\",;]+@[^@\s<>\",;]+\.[^@\s<>\",;]+$")

# Send-quality outcomes, ranked: a later report never downgrades a worse one
# (a "delivered" that arrives after a "bounced" must not overwrite it).
_RANK = {"sent": 0, "delayed": 1, "delivered": 2, "rejected": 3, "bounced": 4, "complained": 5}


class EmailDomainError(Exception):
    def __init__(self, message: str, code: str = "invalid", status: int = 400):
        super().__init__(message)
        self.message, self.code, self.status = message, code, status


# ── Validation ────────────────────────────────────────────────────────────────

def clean_domain(value: str) -> str:
    d = (value or "").strip().lower().rstrip(".")
    d = re.sub(r"^https?://", "", d).split("/")[0]
    if d.startswith("www."):
        d = d[4:]
    if not _DOMAIN_RE.match(d):
        raise EmailDomainError("Enter a domain like mystore.com (no https:// and no email address).")
    if d in FREE_MAIL:
        raise EmailDomainError("Free mail domains such as gmail.com can't be used. Use a domain you own.")
    if any(d == o or d.endswith("." + o) for o in OUR_DOMAINS):
        raise EmailDomainError("That domain belongs to ExiusCart and can't be used.")
    return d


def clean_local(value: Optional[str]) -> str:
    v = (value or "invoices").strip().lower()
    if not _LOCAL_RE.match(v):
        raise EmailDomainError("The name before the @ can use letters, numbers, dots, dashes and underscores (for example: invoices).")
    return v


def valid_email(value: Optional[str]) -> bool:
    return bool(value and _EMAIL_RE.match(value.strip()))


# ── Amazon SES ────────────────────────────────────────────────────────────────

def ses_configured() -> bool:
    return bool(SES_ACCESS_KEY and SES_SECRET_KEY)


def _ses():
    """The SES v2 API client. Split out so tests can replace it."""
    if not ses_configured():
        raise EmailDomainError(
            "Custom email domains are not switched on yet. Please contact support.", code="not_configured", status=503)
    import boto3
    return boto3.client("sesv2", region_name=SES_REGION, aws_access_key_id=SES_ACCESS_KEY, aws_secret_access_key=SES_SECRET_KEY)


def _aws_error(e: Exception) -> str:
    resp = getattr(e, "response", None) or {}
    return (resp.get("Error") or {}).get("Code") or type(e).__name__


def dns_records(dom: EmailDomain) -> list:
    """What the seller adds at their domain provider: the 3 DKIM CNAMEs that prove they own the domain."""
    recs = [{"type": "CNAME", "name": f"{t}._domainkey.{dom.domain}", "value": f"{t}.dkim.amazonses.com", "purpose": "DKIM"}
            for t in (dom.dkim_tokens or [])]
    return recs


def register_domain(db: Session, shop_id: int, domain: str, local: Optional[str]) -> EmailDomain:
    d, lp = clean_domain(domain), clean_local(local)
    existing = db.query(EmailDomain).filter(EmailDomain.shop_id == shop_id).first()
    if existing:
        if existing.domain == d:
            existing.from_local = lp
            db.commit()
            return existing
        raise EmailDomainError("Remove your current domain before adding another one.", code="already_has_domain", status=409)
    if db.query(EmailDomain.id).filter(EmailDomain.domain == d).first():
        raise EmailDomainError("That domain is already used by another store.", code="domain_taken", status=409)

    ses = _ses()
    kwargs = {"EmailIdentity": d, "DkimSigningAttributes": {"NextSigningKeyLength": "RSA_2048_BIT"}}
    if SES_CONFIGURATION_SET:
        kwargs["ConfigurationSetName"] = SES_CONFIGURATION_SET
    try:
        info = ses.create_email_identity(**kwargs)
    except Exception as e:
        code = _aws_error(e)
        if code == "AlreadyExistsException":
            try:
                info = ses.get_email_identity(EmailIdentity=d)
            except Exception as e2:
                logger.error(f"[email-domain] get_email_identity {d}: {e2}")
                raise EmailDomainError("Could not reach the email service. Try again in a moment.", code="ses_error", status=502)
        else:
            logger.error(f"[email-domain] create_email_identity {d}: {code} {e}")
            raise EmailDomainError("The email service could not register this domain. Check the spelling and try again.", code="ses_error", status=502)

    dkim = info.get("DkimAttributes") or {}
    row = EmailDomain(shop_id=shop_id, domain=d, from_local=lp, status="pending",
                      dkim_tokens=list(dkim.get("Tokens") or []), dkim_status=dkim.get("Status") or "PENDING")
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def refresh_domain(db: Session, dom: EmailDomain) -> EmailDomain:
    """Ask SES whether the DNS records are now in place."""
    try:
        info = _ses().get_email_identity(EmailIdentity=dom.domain)
    except EmailDomainError:
        raise
    except Exception as e:
        code = _aws_error(e)
        if code == "NotFoundException":
            dom.status, dom.dkim_status = "failed", "NOT_FOUND"
            db.commit()
            return dom
        logger.error(f"[email-domain] get_email_identity {dom.domain}: {code} {e}")
        raise EmailDomainError("Could not reach the email service. Try again in a moment.", code="ses_error", status=502)

    dkim = info.get("DkimAttributes") or {}
    if dkim.get("Tokens"):
        dom.dkim_tokens = list(dkim["Tokens"])
    dom.dkim_status = dkim.get("Status") or dom.dkim_status
    dom.last_checked_at = datetime.now(timezone.utc)
    if dom.status != "suspended":
        if info.get("VerifiedForSendingStatus") and dom.dkim_status in (None, "SUCCESS"):
            if dom.status != "verified":
                dom.verified_at = datetime.now(timezone.utc)
            dom.status = "verified"
        elif dom.dkim_status in ("FAILED", "TEMPORARY_FAILURE"):
            dom.status = "failed"
        else:
            dom.status = "pending"
    db.commit()
    return dom


def remove_domain(db: Session, dom: EmailDomain) -> None:
    try:
        _ses().delete_email_identity(EmailIdentity=dom.domain)
    except EmailDomainError:
        raise
    except Exception as e:
        if _aws_error(e) != "NotFoundException":
            logger.error(f"[email-domain] delete_email_identity {dom.domain}: {e}")
            raise EmailDomainError("Could not reach the email service. Try again in a moment.", code="ses_error", status=502)
    db.delete(dom)
    db.commit()


# ── Which address does a shop's mail go out from? ─────────────────────────────

def _is_scale(db: Session, shop_id: int) -> bool:
    from app.models.subscription import Subscription
    sub = (db.query(Subscription)
           .filter(Subscription.shop_id == shop_id, Subscription.status.in_(("active", "trial", "trial_dollar")))
           .order_by(Subscription.id.desc()).first())
    return bool(sub and sub.plan_type == "scale")


def sending_domain(db: Session, shop_id: Optional[int]) -> Optional[EmailDomain]:
    """The shop's own domain, only when it is verified, not suspended, and the shop is on Scale."""
    if shop_id is None:
        return None
    dom = db.query(EmailDomain).filter(EmailDomain.shop_id == shop_id).first()
    if dom and dom.status == "verified" and _is_scale(db, shop_id):
        return dom
    return None


# ── Sending guards and the event log ──────────────────────────────────────────

def is_suppressed(db: Session, email: str) -> bool:
    return db.query(EmailSuppression.id).filter(EmailSuppression.email == (email or "").strip().lower()).first() is not None


def marketing_paused(db: Session, shop_id: Optional[int]) -> bool:
    if shop_id is None:
        return False
    ctl = db.query(EmailShopControl).filter(EmailShopControl.shop_id == shop_id).first()
    return bool(ctl and ctl.paused)


def new_event(db: Session, *, shop_id: Optional[int], category: str, kind: Optional[str], from_address: str,
              recipient: str, subject: str, status: str = "sent", detail: Optional[str] = None,
              event_uid: Optional[str] = None) -> EmailEvent:
    ev = EmailEvent(
        event_uid=event_uid or str(uuid.uuid4()), shop_id=shop_id, category=category, kind=kind,
        from_address=(from_address or "")[:255], from_domain=(from_address.split("@")[-1].lower() if "@" in (from_address or "") else None),
        recipient=(recipient or "")[:255], subject=(subject or "")[:300], status=status, detail=(detail or None),
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


def suppress(db: Session, email: str, reason: str, shop_id: Optional[int] = None, detail: Optional[str] = None) -> None:
    e = (email or "").strip().lower()
    if not e or db.query(EmailSuppression.id).filter(EmailSuppression.email == e).first():
        return
    db.add(EmailSuppression(email=e, reason=reason, shop_id=shop_id, detail=(detail or None) and detail[:255]))
    db.commit()


# ── Applying what SES reports ─────────────────────────────────────────────────

def _upgrade(ev: EmailEvent, status: str) -> bool:
    if ev.status in ("blocked", "suppressed", "skipped", "failed"):
        return False
    if _RANK.get(status, -1) >= _RANK.get(ev.status, 0):
        ev.status = status
        return True
    return False


def apply_ses_event(db: Session, msg: dict) -> int:
    """Handle one SES event (from SNS). Returns how many email rows it touched."""
    kind = msg.get("eventType") or msg.get("notificationType")
    if not kind:
        return 0
    mail = msg.get("mail") or {}
    tags = mail.get("tags") or {}
    uid = (tags.get("event_uid") or [None])[0] if isinstance(tags.get("event_uid"), list) else tags.get("event_uid")
    mid = mail.get("messageId")

    if kind == "Bounce":
        b = msg.get("bounce") or {}
        recips = [r.get("emailAddress") for r in (b.get("bouncedRecipients") or [])]
        diag = "; ".join(filter(None, [r.get("diagnosticCode") for r in (b.get("bouncedRecipients") or [])]))[:500]
        status, extra = "bounced", {"bounce_type": b.get("bounceType"), "bounce_subtype": b.get("bounceSubType"), "detail": diag or None}
    elif kind == "Complaint":
        c = msg.get("complaint") or {}
        recips = [r.get("emailAddress") for r in (c.get("complainedRecipients") or [])]
        status, extra = "complained", {"detail": c.get("complaintFeedbackType")}
    elif kind == "Delivery":
        recips = (msg.get("delivery") or {}).get("recipients") or []
        status, extra = "delivered", {"detail": (msg.get("delivery") or {}).get("smtpResponse")}
    elif kind == "DeliveryDelay":
        d = msg.get("deliveryDelay") or {}
        recips = [r.get("emailAddress") for r in (d.get("delayedRecipients") or [])]
        status, extra = "delayed", {"detail": d.get("delayType")}
    elif kind == "Reject":
        recips = mail.get("destination") or []
        status, extra = "rejected", {"detail": (msg.get("reject") or {}).get("reason")}
    elif kind == "Send":
        recips, status, extra = mail.get("destination") or [], "sent", {}
    else:
        return 0

    ev = None
    if uid:
        ev = db.query(EmailEvent).filter(EmailEvent.event_uid == uid).first()
    if ev is None and mid:
        ev = db.query(EmailEvent).filter(EmailEvent.ses_message_id == mid).first()
    if ev is None:
        # Mail we did not log (sent by another route). Record it so the monitor still shows it.
        src = (mail.get("source") or "")
        ev = EmailEvent(
            event_uid=str(uuid.uuid4()), category="system", from_address=src[:255],
            from_domain=(src.split("@")[-1].lower() if "@" in src else None),
            recipient=(recips[0] if recips else (mail.get("destination") or [""])[0])[:255],
            subject=((mail.get("commonHeaders") or {}).get("subject") or "")[:300], status="sent",
        )
        db.add(ev)
        db.flush()

    ev.via_webhook = True
    if mid and not ev.ses_message_id:
        ev.ses_message_id = mid
    changed = _upgrade(ev, status)
    if changed:
        for k, v in extra.items():
            if v:
                setattr(ev, k, v)

    permanent = kind == "Bounce" and (msg.get("bounce") or {}).get("bounceType") == "Permanent"
    if permanent or kind == "Complaint":
        for r in recips:
            if r:
                suppress(db, r, "bounce" if permanent else "complaint", ev.shop_id, extra.get("detail"))
    db.commit()

    if changed and status in ("bounced", "complained") and ev.shop_id:
        auto_protect(db, ev.shop_id)
    return 1


# ── Health and auto-protection ────────────────────────────────────────────────

_SENT_STATES = ("sent", "delayed", "delivered", "bounced", "complained")


def health(db: Session, *, shop_id: Optional[int] = None, domain: Optional[str] = None, days: int = WINDOW_DAYS) -> dict:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    q = db.query(EmailEvent.status, EmailEvent.bounce_type, func.count(EmailEvent.id)).filter(EmailEvent.created_at >= cutoff)
    if shop_id is not None:
        q = q.filter(EmailEvent.shop_id == shop_id)
    if domain is not None:
        q = q.filter(EmailEvent.from_domain == domain)
    counts = {"sent": 0, "delivered": 0, "bounced": 0, "hard_bounced": 0, "complained": 0, "blocked": 0}
    for status, btype, n in q.group_by(EmailEvent.status, EmailEvent.bounce_type).all():
        if status in _SENT_STATES:
            counts["sent"] += n
        if status == "delivered":
            counts["delivered"] += n
        elif status == "bounced":
            counts["bounced"] += n
            if btype == "Permanent":
                counts["hard_bounced"] += n
        elif status == "complained":
            counts["complained"] += n
        elif status in ("blocked", "suppressed"):
            counts["blocked"] += n
    s = counts["sent"]
    counts["bounce_rate"] = round(counts["hard_bounced"] / s, 4) if s else 0.0
    counts["complaint_rate"] = round(counts["complained"] / s, 4) if s else 0.0
    return counts


def auto_protect(db: Session, shop_id: int) -> Optional[str]:
    """Called after a bounce or complaint. When a shop's numbers are bad, suspend its custom domain
    and pause its marketing mail. Returns the reason when it acted."""
    h = health(db, shop_id=shop_id)
    reason = None
    if h["sent"] >= MIN_SAMPLE and h["bounce_rate"] >= BOUNCE_LIMIT:
        reason = f"{h['bounce_rate'] * 100:.1f}% of the last {h['sent']} emails bounced (limit {BOUNCE_LIMIT * 100:.0f}%)"
    elif h["sent"] >= MIN_SAMPLE and h["complained"] >= 2 and h["complaint_rate"] >= COMPLAINT_LIMIT:
        reason = f"{h['complaint_rate'] * 100:.2f}% of the last {h['sent']} emails were reported as spam (limit {COMPLAINT_LIMIT * 100:.1f}%)"
    if not reason:
        return None
    pause_shop(db, shop_id, reason, "auto")
    dom = db.query(EmailDomain).filter(EmailDomain.shop_id == shop_id).first()
    if dom and dom.status != "suspended":
        suspend_domain(db, dom, reason, "auto")
    try:
        from app.core.audit_log import record_audit_event
        record_audit_event(db, "email_auto_pause", shop_id=shop_id, description=f"Email paused automatically: {reason}", extra={"as": "system"})
    except Exception:
        pass
    logger.warning(f"[email-monitor] shop={shop_id} paused automatically: {reason}")
    return reason


def pause_shop(db: Session, shop_id: int, reason: str, source: str) -> None:
    ctl = db.query(EmailShopControl).filter(EmailShopControl.shop_id == shop_id).first()
    if ctl:
        ctl.paused, ctl.reason, ctl.source = True, reason[:255], source
    else:
        db.add(EmailShopControl(shop_id=shop_id, paused=True, reason=reason[:255], source=source))
    db.commit()


def resume_shop(db: Session, shop_id: int) -> None:
    ctl = db.query(EmailShopControl).filter(EmailShopControl.shop_id == shop_id).first()
    if ctl:
        ctl.paused, ctl.reason = False, None
        db.commit()


def suspend_domain(db: Session, dom: EmailDomain, reason: str, by: str) -> None:
    dom.status, dom.suspended_reason, dom.suspended_by = "suspended", reason[:255], by
    db.commit()


def resume_domain(db: Session, dom: EmailDomain) -> EmailDomain:
    """Back to work: ask SES again, so a domain whose records were removed does not come back as verified."""
    dom.suspended_reason = dom.suspended_by = None
    dom.status = "pending"
    db.commit()
    return refresh_domain(db, dom)
